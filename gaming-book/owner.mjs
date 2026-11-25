import { dateInIndia, request, rupees } from './api.mjs';

const signin = document.querySelector('#signin');
const settings = document.querySelector('#settings');
const session = document.querySelector('#session');
const schedule = document.querySelector('#schedule');
const status = document.querySelector('#status');
const reset = document.querySelector('#reset-session');
let token;
let editing;
let fingerprint;
let saving = false;
const format = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata',
  day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
session.elements.date.value = dateInIndia();

function stopEditing() {
  editing = null;
  session.reset();
  session.elements.date.value = dateInIndia();
  reset.hidden = true;
  document.querySelector('#session-title').textContent = 'Add an owner session';
}
reset.addEventListener('click', stopEditing);

async function refresh(loadSettings = false) {
  const result = await request('/owner', null, token);
  if (loadSettings) {
    for (const field of ['opens', 'closes', 'stations']) settings.elements[field].value = result.settings[field];
    settings.elements.rate.value = result.settings.hourly_paise / 100;
    settings.elements.twoHour.value = result.settings.two_hour_paise / 100;
    settings.elements.threeHour.value = result.settings.three_hour_paise / 100;
    settings.elements.online.checked = Boolean(result.settings.online);
  }
  const nextFingerprint = JSON.stringify(result.bookings);
  if (fingerprint === nextFingerprint) return;
  fingerprint = nextFingerprint;
  schedule.replaceChildren();
  if (!result.bookings.length) schedule.append(Object.assign(document.createElement('li'), { textContent: 'No sessions yet.' }));
  for (const booking of result.bookings) {
    const entry = document.createElement('li');
    const state = booking.status === 'payment_review' ? 'Payment received after hold expired. Review in Razorpay.' :
      booking.amount ? 'Paid ' + rupees(booking.amount) : 'Owner session';
    entry.textContent = format.format(booking.starts * 1000) + ' to ' + format.format(booking.ends * 1000) +
      ' IST Â· Station ' + booking.station + ' Â· ' + booking.name + ' Â· ' + state + ' Â· ' + booking.id +
      (booking.phone ? ' Â· ' + booking.phone : '') + (booking.payment_id ? ' Â· ' + booking.payment_id : '');
    if (!booking.amount && booking.status === 'confirmed' && booking.ends > Date.now() / 1000) {
      const edit = document.createElement('button');
      edit.textContent = 'Edit';
      edit.onclick = () => {
        editing = booking.id;
        const local = new Date((booking.starts + 19800) * 1000).toISOString();
        session.elements.date.value = local.slice(0, 10);
        session.elements.time.value = local.slice(11, 16);
        session.elements.minutes.value = (booking.ends - booking.starts) / 60;
        for (const key of ['station', 'name', 'phone']) session.elements[key].value = booking[key];
        reset.hidden = false;
        document.querySelector('#session-title').textContent = 'Edit owner session';
        session.elements.date.focus();
      };
      const cancel = document.createElement('button');
      cancel.textContent = 'Cancel session';
      cancel.onclick = async () => {
        if (!window.confirm('Cancel this owner session?')) return;
        await submit('/owner/cancel', { id: booking.id }, 'Session cancelled.');
      };
      entry.append(edit, cancel);
    }
    schedule.append(entry);
  }
}
async function submit(path, data, success) {
  if (saving) return false;
  saving = true;
  try {
    await request(path, data, token);
    status.textContent = success;
  } catch (error) {
    status.textContent = error.message;
    return false;
  } finally {
    saving = false;
  }
  try { await refresh(); } catch (error) { status.textContent += ' ' + error.message; }
  return true;
}
signin.addEventListener('submit', async event => {
  event.preventDefault();
  token = signin.elements.token.value;
  try {
    await refresh(true);
    signin.reset();
    signin.hidden = true;
    document.querySelector('#panel').hidden = false;
    status.textContent = '';
    void loadHistory();
  } catch (error) {
    token = null;
    status.textContent = error.message;
  }
});
settings.addEventListener('submit', async event => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(settings));
  await submit('/owner/settings', { opens: data.opens, closes: data.closes, stations: Number(data.stations),
    hourly_paise: Math.round(Number(data.rate) * 100), two_hour_paise: Math.round(Number(data.twoHour) * 100),
    three_hour_paise: Math.round(Number(data.threeHour) * 100), online: settings.elements.online.checked }, 'Settings saved.');
});
const verification = document.querySelector('#verify-booking');
verification.addEventListener('submit', async event => {
  event.preventDefault();
  const output = document.querySelector('#verify-result');
  const button = verification.querySelector('button');
  button.disabled = true;
  output.textContent = 'Checking bookingâ€¦';
  try {
    const id = verification.elements.reference.value.trim();
    const booking = await request('/owner/verify?id=' + encodeURIComponent(id), null, token);
    const states = { held: 'Awaiting payment', confirmed: booking.payment_id ? 'Paid and confirmed' : 'Owner reservation',
      payment_review: 'Payment requires review', cancelled: 'Cancelled' };
    output.textContent = (states[booking.status] || booking.status) + ' Â· ' +
      format.format(booking.starts * 1000) + ' to ' + format.format(booking.ends * 1000) +
      ' IST Â· Station ' + booking.station + ' Â· ' + rupees(booking.amount);
  } catch (error) {
    output.textContent = error.message;
  } finally {
    button.disabled = false;
  }
});
session.addEventListener('submit', async event => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(session));
  data.minutes = Number(data.minutes);
  data.station = data.station ? Number(data.station) : null;
  if (editing) data.id = editing;
  if (await submit('/owner/bookings', data, 'Session saved.')) stopEditing();
});
setInterval(() => {
  if (token && !document.hidden) refresh().catch(() => {});
}, 5000);

const historyList = document.querySelector('#booking-history');
const historyStatus = document.querySelector('#history-status');
const historyMore = document.querySelector('#history-more');
let historyOffset = 0;

async function loadHistory() {
  historyMore.disabled = true;
  historyStatus.textContent = 'Loading booking history…';
  try {
    const result = await request('/owner/history?offset=' + historyOffset, null, token);
    for (const booking of result.bookings) {
      const row = document.createElement('li');
      const state = booking.status === 'cancelled' ? 'Cancelled' :
        booking.status === 'payment_review' ? 'Payment requires review' :
        booking.payment_id ? 'Paid · Reserved time ended' : 'Owner session · Reserved time ended';
      row.textContent = format.format(booking.starts * 1000) + ' to ' +
        format.format(booking.ends * 1000) + ' IST · Station ' + booking.station +
        ' · ' + booking.name + ' · ' + state + ' · ' + rupees(booking.amount) + ' · ' + booking.id;
      historyList.append(row);
    }
    historyOffset += result.bookings.length;
    historyStatus.textContent = historyOffset ? '' : 'No past or cancelled bookings yet.';
    historyMore.hidden = !result.more;
    historyMore.textContent = 'Load older bookings';
  } catch (error) {
    historyStatus.textContent = error.message;
    historyMore.hidden = false;
    historyMore.textContent = 'Retry';
  } finally {
    historyMore.disabled = false;
  }
}
historyMore.addEventListener('click', loadHistory);
