import { dateInIndia, request, rupees } from './api.mjs';

const form = document.querySelector('#booking');
const { date, minutes } = form.elements;
const get = id => document.getElementById(id);
const times = get('times');
const pay = get('pay');
const status = get('status');
const clock = new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' });
const calendar = new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' });
const formatTime = (day, time) => clock.format(new Date(day + 'T' + time + ':00+05:30'));
const describe = ({ date: day, time, minutes: length }) =>
  calendar.format(new Date(day + 'T12:00:00+05:30')) + ' · ' + formatTime(day, time) + ' IST · ' + length + ' min';

let busy = false;
let locked = false;
let sequence = 0;
let result;
let visibleTimes = '';
date.value = date.min = dateInIndia();
date.max = new Date(Date.parse(date.min) + 14 * 86400000).toISOString().slice(0, 10);

function updateSummary() {
  const time = form.elements.time?.value;
  if (!locked) get('selection').textContent = time ? describe({ date: date.value, time, minutes: minutes.value }) : 'Choose a start time';
  get('amount').textContent = result?.online ? rupees(result.amount) : '—';
  pay.disabled = busy || locked || !result?.online || !time;
  pay.textContent = result?.online ? 'Pay ' + rupees(result.amount) : 'Online booking unavailable';
  get('payment-note').textContent = result?.online ? 'Secure checkout with Razorpay' : 'Call the gaming café to book.';
}

async function refresh() {
  const requestNumber = ++sequence;
  const day = date.value;
  const params = new URLSearchParams({ date: day, minutes: minutes.value });
  try {
    const latest = await request('/availability?' + params);
    if (requestNumber !== sequence) return;
    const slots = latest.slots.filter(slot => slot.remaining).map(slot => slot.time);
    const signature = [day, ...slots].join('/');
    if (signature !== visibleTimes) {
      const selected = form.elements.time?.value;
      times.replaceChildren(...slots.map(time => {
        const label = document.createElement('label');
        const radio = document.createElement('input');
        const caption = document.createElement('span');
        radio.type = 'radio';
        radio.name = 'time';
        radio.value = time;
        radio.required = true;
        radio.checked = time === selected;
        caption.textContent = formatTime(day, time);
        label.append(radio, caption);
        return label;
      }));
      visibleTimes = signature;
    }
    const message = slots.length ? '' : 'No times available. Try another date or a shorter session.';
    if (get('availability').textContent !== message) get('availability').textContent = message;
    result = latest;
  } catch {
    if (requestNumber !== sequence) return;
    result = undefined;
    get('availability').textContent = 'Could not load times. Try again or call the gaming café.';
  }
  updateSummary();
}

form.addEventListener('change', event => {
  if (event.target === date || event.target === minutes) {
    result = undefined;
    visibleTimes = '';
    times.replaceChildren();
    get('availability').textContent = 'Checking available times…';
    updateSummary();
    refresh();
  } else if (event.target.name === 'time') updateSummary();
});

get('copy').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(get('reference').textContent);
    get('copy').textContent = 'Reference copied';
  } catch {
    status.textContent = 'Select the booking reference to copy it.';
  }
});

form.addEventListener('submit', async event => {
  event.preventDefault();
  if (pay.disabled) return;
  const details = Object.fromEntries(new FormData(form));
  details.minutes = Number(details.minutes);
  details.phone = details.phone.replace(/[\s()-]/g, '');
  if (!/^\+?\d{10,15}$/.test(details.phone)) {
    status.textContent = 'Enter a valid mobile number.';
    form.elements.phone.focus();
    return;
  }
  busy = true;
  updateSummary();
  status.textContent = 'Reserving your time…';
  const unlock = () => { busy = false; updateSummary(); refresh(); };
  try {
    if (!window.Razorpay) throw new Error('Checkout could not load. Refresh the page and try again.');
    const booking = await request('/bookings', details);
    status.textContent = 'Your time is held until ' + clock.format(booking.expires * 1000) + ' IST.';
    new window.Razorpay({
      key: booking.key, order_id: booking.orderId, amount: booking.amount, currency: 'INR',
      name: 'Wildcat IT Solutions', description: 'Gaming session',
      prefill: { name: details.name, contact: details.phone },
      modal: { ondismiss() {
        if (locked) return;
        status.textContent = 'Checkout closed. If you paid, contact the shop with reference ' + booking.id + '.';
        unlock();
      } },
      async handler(payment) {
        locked = true;
        status.textContent = 'Verifying payment…';
        try {
          const verified = await request('/verify', { id: booking.id,
            paymentId: payment.razorpay_payment_id, signature: payment.razorpay_signature });
          if (verified.status === 'confirmed') {
            status.textContent = 'Payment verified.';
            get('confirmed-slot').textContent = describe(details);
            get('reference').textContent = booking.id;
            get('confirmation').hidden = false;
            get('copy').focus();
          } else {
            status.textContent = 'Payment arrived after the hold expired. Call the shop with reference ' + booking.id + '.';
          }
        } catch {
          status.textContent = 'Payment confirmation is pending. Call the shop with reference ' + booking.id + ' before paying again.';
        } finally { unlock(); }
      },
    }).open();
  } catch (error) {
    status.textContent = error.message;
    unlock();
  }
});
refresh();
setInterval(() => { if (!document.hidden && !busy && !locked) refresh(); }, 5000);
