import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { createHmac } from 'node:crypto';
import worker from './worker.mjs';

test('paid check-in is time-bound, station-bound and retryable only by the same PC', async () => {
  const DB = database();
  DB.db.exec(readFileSync(new URL('./counter-checkins.sql', import.meta.url), 'utf8'));
  const id = '00000000-0000-4000-8000-000000000001';
  DB.db.prepare(`INSERT INTO bookings VALUES (?, 'Player', '', unixepoch()-10,
    unixepoch()+3590, 1, 20000, NULL, 'confirmed', 'order_fixture', NULL)`).run(id);
  const api = (device, token = 'counter-test') => worker.fetch(new Request('https://example.net/counter/check-in', {
    method: 'POST', headers: { Authorization: 'Bearer ' + token }, body: JSON.stringify({ id, device }),
  }), { DB, COUNTER_TOKEN: 'counter-test' });
  const device = 'a'.repeat(32);
  assert.equal((await api(device, 'wrong')).status, 401);
  assert.equal((await api(device)).status, 409);
  DB.db.exec("UPDATE bookings SET payment_id='pay_fixture', starts=unixepoch()+10");
  assert.equal((await api(device)).status, 409);
  DB.db.exec("UPDATE bookings SET starts=unixepoch()-10, station=2");
  assert.equal((await api(device)).status, 409);
  DB.db.exec("UPDATE bookings SET station=1");
  assert.equal((await api(device)).status, 200);
  assert.equal((await api(device)).status, 200);
  assert.equal((await api('b'.repeat(32))).status, 409);
});

function database() {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(new URL('./schema.sql', import.meta.url), 'utf8'));
  return {
    db,
    prepare(statement) {
      const stmt = db.prepare(statement);
      return { bind(...args) {
        return {
          first: async () => stmt.get(...args),
          all: async () => ({ results: stmt.all(...args) }),
          run: async () => ({ meta: stmt.run(...args) }),
          execute: () => ({ meta: stmt.run(...args) }),
        };
      } };
    },
    async batch(statements) {
      db.exec('BEGIN');
      try {
        const result = statements.map(statement => statement.execute());
        db.exec('COMMIT');
        return result;
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
  };
}

test('shared capacity, atomic owner edits, and captured payment replay', async t => {
  const DB = database();
  const env = { DB, SITE_ORIGIN: 'https://staging.example.net', OWNER_TOKEN: 'owner-test', RAZORPAY_KEY_ID: 'rzp_test_x',
    RAZORPAY_KEY_SECRET: 'test-key', RAZORPAY_WEBHOOK_SECRET: 'test-webhook' };
  const tomorrow = new Date(Date.now() + 86400000 + 19800000).toISOString().slice(0, 10);
  const date = tomorrow < '2026-12-01' ? '2026-12-01' : tomorrow;
  let orders = 0;
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    if (String(_url).endsWith('/payments/pay_checkout')) {
      return Response.json({ id: 'pay_checkout', order_id: 'order_test1', amount: 20000,
        currency: 'INR', status: 'captured' });
    }
    const data = JSON.parse(options.body);
    return Response.json({ id: 'order_test' + ++orders, amount: data.amount, currency: data.currency });
  });
  const api = (path, data, owner = false) => worker.fetch(new Request('https://example.net' + path, {
    method: data ? 'POST' : 'GET', body: data && JSON.stringify(data),
    headers: owner ? { Authorization: 'Bearer owner-test' } : {},
  }), env);
  const booking = { date, time: '10:00', minutes: 60, name: 'Test Player', phone: '9876543210' };
  assert.equal((await api('/owner')).status, 401);
  const settings = await api('/owner/settings', { opens: '10:00', closes: '19:30',
    stations: 1, hourly_paise: 20000, two_hour_paise: 35000, three_hour_paise: 50000, online: true }, true);
  assert.equal(settings.status, 200);
  assert.equal((await (await api('/availability?date=' + date + '&minutes=120')).json()).amount, 35000);
  assert.equal((await api('/owner/bookings', { ...booking, time: '19:00' }, true)).status, 400);
  const owner = await (await api('/owner/bookings', booking, true)).json();
  assert.ok(owner.id);
  const slots = async () => (await (await api('/availability?date=' + date + '&minutes=60')).json()).slots;
  const stateAt = async time => (await slots()).find(slot => slot.time === time)?.status;
  assert.equal(await stateAt('10:00'), 'booked');
  assert.equal(await stateAt('10:30'), undefined);
  assert.equal(await stateAt('19:00'), undefined);
  assert.ok((await slots()).every(slot => slot.time.endsWith(':00')));
  assert.equal(await stateAt('11:00'), 'available');
  assert.equal((await api('/bookings', { ...booking, time: '10:30' })).status, 400);

  const attempts = await Promise.all([api('/bookings', { ...booking, time: '11:00' }),
    api('/bookings', { ...booking, time: '11:00' })]);
  assert.deepEqual(attempts.map(response => response.status).sort(), [201, 409]);
  const customer = await attempts.find(response => response.ok).json();
  assert.equal(await stateAt('11:00'), 'held');
  assert.equal((await api('/owner/bookings', { ...booking, id: owner.id, minutes: 90 }, true)).status, 409);
  assert.equal(DB.db.prepare('SELECT COUNT(*) AS count FROM blocks WHERE booking_id=?').get(owner.id).count, 2);
  assert.equal((await api('/owner/bookings', { ...booking, id: owner.id, time: '12:00' }, true)).status, 201);
  const expiry = await (await api('/bookings', booking)).json();
  DB.db.prepare('UPDATE bookings SET expires=unixepoch()-1 WHERE id=?').run(expiry.id);
  assert.equal((await api('/owner/bookings', booking, true)).status, 201);

  async function webhook(reservation, paymentId) {
    const body = JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: {
      id: paymentId, order_id: reservation.orderId, amount: reservation.amount, status: 'captured', currency: 'INR',
    } } } });
    const signature = createHmac('sha256', env.RAZORPAY_WEBHOOK_SECRET).update(body).digest('hex');
    return worker.fetch(new Request('https://example.net/webhook', { method: 'POST', body,
      headers: { 'X-Razorpay-Signature': signature } }), env);
  }
  const signature = createHmac('sha256', env.RAZORPAY_KEY_SECRET)
    .update(customer.orderId + '|pay_checkout').digest('hex');
  const payment = { id: customer.id, paymentId: 'pay_checkout', signature };
  assert.equal((await api('/verify', { ...payment, signature: '0'.repeat(64) })).status, 400);
  assert.equal((await (await api('/verify', payment)).json()).status, 'confirmed');
  assert.equal(await stateAt('11:00'), 'booked');
  assert.equal((await webhook(customer, 'pay_checkout')).status, 200);
  assert.equal((await webhook(expiry, 'pay_late')).status, 200);
  assert.equal(DB.db.prepare('SELECT status FROM bookings WHERE id=?').get(customer.id).status, 'confirmed');
  assert.equal(DB.db.prepare('SELECT status FROM bookings WHERE id=?').get(expiry.id).status, 'payment_review');
  assert.equal((await api('/webhook', {})).status, 401);
  assert.equal((await api('/owner/cancel', { id: customer.id }, true)).status, 409);
  assert.equal((await api('/owner/cancel', { id: owner.id }, true)).status, 200);
  assert.equal(DB.db.prepare('SELECT COUNT(*) AS count FROM blocks WHERE booking_id=?').get(owner.id).count, 0);
});

test('Razorpay Test Mode creates an order for the selected package', {
  skip: !process.env.WILDCAT_TEST_RAZORPAY_ID,
}, async () => {
  const DB = database();
  DB.db.exec('UPDATE settings SET online=1');
  const env = {
    DB, SITE_ORIGIN: 'https://staging.example.net',
    RAZORPAY_KEY_ID: process.env.WILDCAT_TEST_RAZORPAY_ID,
    RAZORPAY_KEY_SECRET: process.env.WILDCAT_TEST_RAZORPAY_SECRET,
    RAZORPAY_WEBHOOK_SECRET: 'isolated-test',
  };
  assert.ok(env.RAZORPAY_KEY_ID.startsWith('rzp_test_'));
  const tomorrow = new Date(Date.now() + 86400000 + 19800000).toISOString().slice(0, 10);
  const date = tomorrow < '2026-12-01' ? '2026-12-01' : tomorrow;
  const response = await worker.fetch(new Request('https://staging.example.net/bookings', {
    method: 'POST', body: JSON.stringify({ date, time: '11:00', minutes: 120,
      name: 'Wildcat QA', phone: '9999999999' }),
  }), env);
  assert.equal(response.status, 201);
  const booking = await response.json();
  assert.match(booking.orderId, /^order_/);
  assert.equal(booking.amount, 35000);
  assert.equal(DB.db.prepare('SELECT COUNT(*) AS count FROM blocks').get().count, 4);
});
