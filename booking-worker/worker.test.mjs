import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { createHmac } from 'node:crypto';
import worker from './worker.mjs';

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
  const env = { DB, OWNER_TOKEN: 'owner-test', RAZORPAY_KEY_ID: 'rzp_test_x',
    RAZORPAY_KEY_SECRET: 'test-key', RAZORPAY_WEBHOOK_SECRET: 'test-webhook' };
  const date = new Date(Date.now() + 86400000 + 19800000).toISOString().slice(0, 10);
  let orders = 0;
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
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
    stations: 1, hourly_paise: 20000, online: true }, true);
  assert.equal(settings.status, 200);
  assert.equal((await api('/owner/bookings', { ...booking, time: '19:00' }, true)).status, 400);
  const owner = await (await api('/owner/bookings', booking, true)).json();
  assert.ok(owner.id);
  assert.equal((await api('/bookings', { ...booking, time: '10:30' })).status, 409);

  const attempts = await Promise.all([api('/bookings', { ...booking, time: '11:00' }),
    api('/bookings', { ...booking, time: '11:00' })]);
  assert.deepEqual(attempts.map(response => response.status).sort(), [201, 409]);
  const customer = await attempts.find(response => response.ok).json();
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
  assert.equal((await webhook(customer, 'pay_first')).status, 200);
  assert.equal((await webhook(customer, 'pay_first')).status, 200);
  assert.equal((await webhook(expiry, 'pay_late')).status, 200);
  assert.equal(DB.db.prepare('SELECT status FROM bookings WHERE id=?').get(customer.id).status, 'confirmed');
  assert.equal(DB.db.prepare('SELECT status FROM bookings WHERE id=?').get(expiry.id).status, 'payment_review');
  assert.equal((await api('/webhook', {})).status, 401);
  assert.equal((await api('/owner/cancel', { id: customer.id }, true)).status, 409);
  assert.equal((await api('/owner/cancel', { id: owner.id }, true)).status, 200);
  assert.equal(DB.db.prepare('SELECT COUNT(*) AS count FROM blocks WHERE booking_id=?').get(owner.id).count, 0);
});
