const BLOCK = 1800;
const HOUR = 3600;
const DAY = 86400;
const now = () => Math.floor(Date.now() / 1000);
const sql = (env, statement, ...args) => env.DB.prepare(statement).bind(...args);
const settings = env => sql(env, 'SELECT * FROM settings WHERE id=1').first();
const reply = (data, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
function check(condition, message, status = 400) {
  if (!condition) throw Object.assign(new Error(message), { status });
}
const validTime = /^(?:[01]\d|2[0-3]):(?:00|30)$/;
const instant = (date, time) => Date.parse(date + 'T' + time + ':00+05:30') / 1000;
function windowFor(date, config) {
  check(typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date), 'Choose a valid date.');
  const midnight = instant(date, '00:00');
  const today = Math.floor((now() + 19800) / DAY) * DAY - 19800;
  check(midnight >= today && midnight <= today + 14 * DAY &&
    new Date((midnight + 19800) * 1000).toISOString().slice(0, 10) === date,
    'Choose a valid date within the next 14 days.');
  return [instant(date, config.opens), instant(date, config.closes)];
}
function lengthOf(minutes) {
  check(Number.isInteger(minutes) && minutes >= 30 && minutes <= 180 && minutes % 30 === 0,
    'Choose 30 minutes to 3 hours.');
  return minutes * 60;
}
function customerLength(minutes) {
  check([60, 120, 180].includes(minutes), 'Choose a 1, 2 or 3 hour package.');
  return lengthOf(minutes);
}
function customerAmount(minutes, config) {
  if (minutes === 60) return config.hourly_paise;
  return minutes === 120 ? config.two_hour_paise : config.three_hour_paise;
}
const productionOrigin = 'https://wildcatdesk.shop';
const paymentReady = env => Boolean(env.RAZORPAY_KEY_SECRET && env.RAZORPAY_WEBHOOK_SECRET &&
  ((env.SITE_ORIGIN || productionOrigin) === productionOrigin
    ? env.RAZORPAY_KEY_ID?.startsWith('rzp_live_')
    : env.RAZORPAY_KEY_ID?.startsWith('rzp_test_')));
const availableOnline = (env, config) => Boolean(config.online && [config.hourly_paise, config.two_hour_paise, config.three_hour_paise].every(price => price >= 100) &&
  paymentReady(env));
async function availability(env, params, config) {
  const [open, close] = windowFor(params.get('date'), config);
  const minutes = Number(params.get('minutes'));
  const length = customerLength(minutes);
  const { results } = await sql(env, `SELECT b.station,b.starts,r.status FROM blocks b JOIN bookings r
    ON r.id=b.booking_id WHERE b.starts>=? AND b.starts<?
    AND (r.status='confirmed' OR (r.status='held' AND r.expires>unixepoch()))`, open, close).all();
  const occupied = new Map(results.map(row => [row.station + '/' + row.starts, row.status]));
  const slots = [];
  const firstHour = Math.ceil((open + BLOCK) / HOUR) * HOUR - BLOCK;
  for (let start = firstHour; start + length <= close; start += HOUR) {
    if (start < now() + 60) continue;
    let remaining = 0;
    let withoutHolds = 0;
    for (let station = 1; station <= config.stations; station++) {
      const blocks = Array.from({ length: length / BLOCK }, (_, index) => start + index * BLOCK);
      if (blocks.every(block => !occupied.has(station + '/' + block))) remaining++;
      if (blocks.every(block => occupied.get(station + '/' + block) !== 'confirmed')) withoutHolds++;
    }
    slots.push({ time: new Date((start + 19800) * 1000).toISOString().slice(11, 16), remaining,
      status: remaining ? 'available' : withoutHolds ? 'held' : 'booked' });
  }
  return { slots, amount: customerAmount(minutes, config), online: availableOnline(env, config) };
}
async function reserve(env, data, config, owner) {
  const [open, close] = windowFor(data.date, config);
  check(typeof data.time === 'string' && validTime.test(data.time) && (owner || data.time.endsWith(':00')),
    owner ? 'Choose a start time.' : 'Choose a start time on the hour.');
  const start = instant(data.date, data.time);
  const end = start + (owner ? lengthOf(data.minutes) : customerLength(data.minutes));
  check(start >= open && end <= close && (owner ? end > now() : start >= now() + 60),
    'Choose a session within opening hours.');
  const name = typeof data.name === 'string' ? data.name.trim() : '';
  const phone = typeof data.phone === 'string' ? data.phone.trim() : '';
  check(name.length >= 2 && name.length <= 80 && ((owner && !phone) || /^\+?\d{10,15}$/.test(phone)),
    'Enter a name and a valid mobile number.');
  check(owner || availableOnline(env, config), 'Online booking is currently closed.', 503);
  const amount = owner ? 0 : customerAmount(data.minutes, config);
  const id = owner && data.id ? data.id : crypto.randomUUID();
  const editing = owner && Boolean(data.id);
  const expires = owner ? null : Math.min(now() + 600, start);
  const stations = owner && data.station != null ? [data.station] :
    Array.from({ length: config.stations }, (_, index) => index + 1);
  check(stations.every(station => Number.isInteger(station) && station >= 1 && station <= config.stations),
    'Choose a configured station.');
  for (const station of stations) {
    try {
      const batch = [
        sql(env, `DELETE FROM blocks WHERE station=? AND starts>=? AND starts<?
          AND booking_id IN (SELECT id FROM bookings WHERE status='held' AND expires<=unixepoch())`, station, start, end),
      ];
      if (editing) {
        batch.push(sql(env, `DELETE FROM blocks WHERE booking_id=? AND EXISTS
          (SELECT 1 FROM bookings WHERE id=? AND status='confirmed' AND amount=0 AND ends>unixepoch())`, id, id));
      }
      const updateIndex = batch.length;
      batch.push(editing
        ? sql(env, `UPDATE bookings SET name=?,phone=?,starts=?,ends=?,station=?
          WHERE id=? AND status='confirmed' AND amount=0 AND ends>unixepoch()`, name, phone, start, end, station, id)
        : sql(env, `INSERT INTO bookings(id,name,phone,starts,ends,station,amount,expires,status)
          VALUES (?,?,?,?,?,?,?,?,?)`, id, name, phone, start, end, station, amount, expires, owner ? 'confirmed' : 'held'));
      for (let block = start; block < end; block += BLOCK) {
        batch.push(editing
          ? sql(env, `INSERT INTO blocks SELECT ?,?,id FROM bookings WHERE id=? AND status='confirmed' AND amount=0 AND ends>unixepoch()`,
            station, block, id)
          : sql(env, 'INSERT INTO blocks VALUES (?,?,?)', station, block, id));
      }
      const results = await env.DB.batch(batch);
      check(results[updateIndex].meta.changes, 'This owner session is unavailable for editing.', 409);
      return { id, station, amount, expires };
    } catch (error) {
      if (!String(error.message).includes('UNIQUE constraint failed: blocks.station, blocks.starts')) throw error;
    }
  }
  check(false, 'That slot just filled up. Choose another time.', 409);
}
async function gateway(env, path, payload) {
  const response = await fetch('https://api.razorpay.com/v1/' + path, {
    method: payload ? 'POST' : 'GET',
    headers: { Authorization: 'Basic ' + btoa(env.RAZORPAY_KEY_ID + ':' + env.RAZORPAY_KEY_SECRET),
      'Content-Type': 'application/json' },
    body: payload ? JSON.stringify(payload) : undefined,
  });
  check(response.ok, 'Payment service temporarily unavailable.', 502);
  return response.json();
}
async function signed(secret, text, hex) {
  if (!secret || typeof hex !== 'string' || !/^[a-f0-9]{64}$/i.test(hex)) return false;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  return crypto.subtle.verify('HMAC', key,
    Uint8Array.from(hex.match(/../g), pair => parseInt(pair, 16)), encoder.encode(text));
}
async function recordPayment(env, booking, payment) {
  check(payment.order_id === booking.order_id && payment.status === 'captured' &&
    payment.amount === booking.amount && payment.currency === 'INR', 'Payment capture is pending verification.', 409);
  const result = await sql(env, `UPDATE bookings SET status=CASE
      WHEN status='held' AND expires>unixepoch() THEN 'confirmed'
      WHEN status='held' THEN 'payment_review' ELSE status END,
    payment_id=? WHERE id=? AND (payment_id IS NULL OR payment_id=?) RETURNING id,status`,
    payment.id, booking.id, payment.id).first();
  check(result, 'Payment needs owner review.', 409);
  return result;
}
async function ownerRoute(request, env, path) {
  check(env.OWNER_TOKEN && request.headers.get('Authorization') === 'Bearer ' + env.OWNER_TOKEN,
    'Owner sign-in required.', 401);
  if (request.method === 'GET' && path === '/owner/verify') {
    const id = new URL(request.url).searchParams.get('id')?.trim();
    check(/^[0-9a-f-]{36}$/i.test(id || ''), 'Enter the full booking reference.');
    const booking = await sql(env, `SELECT id, starts, ends, station, amount, status, payment_id
      FROM bookings WHERE id=?`, id.toLowerCase()).first();
    check(booking, 'No booking matches this reference.', 404);
    return reply(booking);
  }
  if (request.method === 'GET' && path === '/owner') {
    const { results } = await sql(env, `SELECT * FROM bookings WHERE status='payment_review'
      OR status='confirmed' AND ends>? ORDER BY starts LIMIT 250`, now() - DAY).all();
    return reply({ settings: await settings(env), bookings: results });
  }
  check(request.method === 'POST', 'Unknown endpoint.', 404);
  const data = await request.json();
  if (path === '/owner/settings') {
    check(validTime.test(data.opens) && validTime.test(data.closes) && data.opens < data.closes &&
      Number.isInteger(data.stations) && data.stations >= 1 && data.stations <= 20 &&
      [data.hourly_paise, data.two_hour_paise, data.three_hour_paise].every(price =>
        Number.isInteger(price) && price >= 100 && price <= 1000000),
    'Check the hours, station count and package prices.');
    check(!data.online || paymentReady(env), 'Configure checkout for this environment before enabling online bookings.', 409);
    await sql(env, 'UPDATE settings SET opens=?,closes=?,stations=?,hourly_paise=?,two_hour_paise=?,three_hour_paise=?,online=? WHERE id=1',
      data.opens, data.closes, data.stations, data.hourly_paise, data.two_hour_paise, data.three_hour_paise, data.online ? 1 : 0).run();
    return reply(await settings(env));
  }
  if (path === '/owner/bookings') return reply(await reserve(env, data, await settings(env), true), 201);
  if (path === '/owner/cancel') {
    const [updated] = await env.DB.batch([
      sql(env, "UPDATE bookings SET status='cancelled' WHERE id=? AND status='confirmed' AND amount=0", data.id),
      sql(env, "DELETE FROM blocks WHERE booking_id=? AND EXISTS(SELECT 1 FROM bookings WHERE id=? AND status='cancelled')",
        data.id, data.id),
    ]);
    check(updated.meta.changes, 'Only unpaid owner sessions can be cancelled here.', 409);
    return reply({ status: 'cancelled' });
  }
  return reply({ error: 'Unknown endpoint.' }, 404);
}
async function route(request, env, url) {
  const path = url.pathname;
  if (path === '/counter/check-in' && request.method === 'POST') {
    check(env.COUNTER_TOKEN && request.headers.get('Authorization') === 'Bearer ' + env.COUNTER_TOKEN,
      'Shop PC sign-in required.', 401);
    const { id, device } = await request.json();
    check(typeof id === 'string' && /^[0-9a-f-]{36}$/i.test(id) &&
      typeof device === 'string' && /^[0-9a-f]{32}$/.test(device), 'Invalid check-in.');
    const booking = await sql(env, `INSERT INTO booking_checkins (booking_id, device)
      SELECT id, ? FROM bookings WHERE id=? AND status='confirmed' AND payment_id IS NOT NULL
        AND amount>0 AND station=1 AND starts<=unixepoch() AND ends>unixepoch()
      ON CONFLICT(booking_id) DO UPDATE SET device=excluded.device
      WHERE booking_checkins.device=excluded.device RETURNING booking_id`, device, id.toLowerCase()).first();
    check(booking, 'Booking is unavailable, outside its reserved time, or already checked in on another PC.', 409);
    return reply(await sql(env, 'SELECT id, starts, ends, amount, payment_id FROM bookings WHERE id=?',
      booking.booking_id).first());
  }
  if (request.method === 'GET' && path === '/') {
    const config = await settings(env);
    check(config, 'Booking settings are unavailable.', 503);
    return reply({ service: 'Wildcat booking API', status: 'ok',
      onlineBooking: availableOnline(env, config) });
  }
  if (path.startsWith('/owner')) return ownerRoute(request, env, path);
  if (request.method === 'GET' && path === '/availability') {
    return reply(await availability(env, url.searchParams, await settings(env)));
  }
  check(request.method === 'POST', 'Unknown endpoint.', 404);
  if (path === '/webhook') {
    const raw = await request.text();
    check(await signed(env.RAZORPAY_WEBHOOK_SECRET, raw, request.headers.get('X-Razorpay-Signature')),
      'Invalid webhook signature.', 401);
    const event = JSON.parse(raw);
    if (event.event === 'payment.captured') {
      const payment = event.payload.payment.entity;
      const booking = await sql(env, 'SELECT * FROM bookings WHERE order_id=?', payment.order_id).first();
      if (booking) await recordPayment(env, booking, payment);
    }
    return reply({ received: true });
  }
  const data = await request.json();
  if (path === '/bookings') {
    const booking = await reserve(env, data, await settings(env), false);
    try {
      const order = await gateway(env, 'orders', { amount: booking.amount, currency: 'INR', receipt: booking.id });
      check(order.id && order.amount === booking.amount && order.currency === 'INR',
        'Payment service returned an invalid order.', 502);
      await sql(env, 'UPDATE bookings SET order_id=? WHERE id=?', order.id, booking.id).run();
      return reply({ ...booking, orderId: order.id, key: env.RAZORPAY_KEY_ID }, 201);
    } catch (error) {
      await sql(env, "UPDATE bookings SET expires=unixepoch() WHERE id=? AND status='held'", booking.id).run();
      throw error;
    }
  }
  if (path === '/verify') {
    const booking = await sql(env, 'SELECT * FROM bookings WHERE id=?', data.id).first();
    check(booking?.order_id && typeof data.paymentId === 'string' && /^pay_[a-zA-Z0-9]+$/.test(data.paymentId) &&
      await signed(env.RAZORPAY_KEY_SECRET, booking.order_id + '|' + data.paymentId, data.signature),
    'Invalid payment confirmation.');
    return reply(await recordPayment(env, booking, await gateway(env, 'payments/' + data.paymentId)));
  }
  return reply({ error: 'Unknown endpoint.' }, 404);
}
export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin');
    const allowed = origin && origin === (env.SITE_ORIGIN || productionOrigin);
    let response;
    try {
      check(!origin || allowed, 'Origin is not allowed.', 403);
      response = request.method === 'OPTIONS' ? new Response(null, { status: 204 }) :
        await route(request, env, new URL(request.url));
    } catch (error) {
      response = error.status ? reply({ error: error.message }, error.status) :
        error instanceof SyntaxError ? reply({ error: 'Invalid request.' }, 400) :
          reply({ error: 'Booking service temporarily unavailable.' }, 503);
    }
    if (allowed) {
      response.headers.set('Access-Control-Allow-Origin', origin);
      response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      response.headers.set('Vary', 'Origin');
    }
    return response;
  },
};
