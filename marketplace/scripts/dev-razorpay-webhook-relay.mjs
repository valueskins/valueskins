// LOCAL ONLY. Razorpay cannot deliver webhooks to localhost, so a test payment
// never advances a local deal. This plays Razorpay's part: it asks the Razorpay
// test API whether each PENDING workflow order has a payment, and if so posts
// the same signed webhook Razorpay would to the local app. The app's webhook
// handler, signature check included, runs unchanged.
//
// Usage (from marketplace/, with `npm run dev` running):
//   node scripts/dev-razorpay-webhook-relay.mjs
import fs from 'node:fs';
import crypto from 'node:crypto';
import pg from 'pg';

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n')
    .map((l) => l.match(/^([A-Z0-9_]+)=(.*)$/)).filter(Boolean)
    .map((m) => [m[1], m[2].trim().replace(/^"|"$/g, '')])
);
const { RAZORPAY_KEY_ID: keyId, RAZORPAY_KEY_SECRET: keySecret,
  RAZORPAY_WEBHOOK_SECRET: hookSecret, DATABASE_URL: dbUrl } = env;
const APP = process.env.APP_URL || 'http://localhost:3000';

if (!keyId?.startsWith('rzp_test_')) throw new Error('Refusing: RAZORPAY_KEY_ID is not a test key');
if (!/@(localhost|127\.0\.0\.1)[:/]/.test(dbUrl || '')) throw new Error('Refusing: DATABASE_URL is not local');
if (!hookSecret) throw new Error('RAZORPAY_WEBHOOK_SECRET is not set in .env.local');

const pool = new pg.Pool({ connectionString: dbUrl });
const auth = 'Basic ' + Buffer.from(`${keyId}:${keySecret}`).toString('base64');
const sent = new Set();

async function tick() {
  const { rows } = await pool.query(
    `SELECT razorpay_order_id FROM deal_workflow_payments
      WHERE status = 'PENDING' AND razorpay_order_id IS NOT NULL`
  );
  for (const { razorpay_order_id: orderId } of rows) {
    const r = await fetch(`https://api.razorpay.com/v1/orders/${orderId}/payments`, { headers: { Authorization: auth } });
    if (!r.ok) { console.error(`[relay] ${orderId}: Razorpay ${r.status}`); continue; }
    for (const p of (await r.json()).items || []) {
      const event = p.status === 'failed' ? 'payment.failed'
        : p.status === 'captured' || p.status === 'authorized' ? `payment.${p.status}` : null;
      if (!event || sent.has(`${p.id}:${event}`)) continue;
      const body = JSON.stringify({ event, payload: { payment: { entity: p } } });
      const sig = crypto.createHmac('sha256', hookSecret).update(body).digest('hex');
      const res = await fetch(`${APP}/api/webhooks/razorpay`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-razorpay-signature': sig }, body,
      });
      console.log(`[relay] ${event} ${p.id} (order ${orderId}) -> app ${res.status}`);
      if (res.ok) sent.add(`${p.id}:${event}`);
    }
  }
}

console.log(`[relay] watching pending orders every 3s, forwarding to ${APP}`);
for (;;) {
  await tick().catch((e) => console.error('[relay]', e.message));
  await new Promise((r) => setTimeout(r, 3000));
}
