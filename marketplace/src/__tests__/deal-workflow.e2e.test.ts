/**
 * @jest-environment node
 *
 * End-to-end walk of one deal against a REAL Postgres database: post, apply,
 * confirm, three payments, revision loop, approval, payouts queued, ADP
 * generated. Unit tests cover the money arithmetic; this covers the thing they
 * cannot — that the SQL, the state writes and the PDF actually work together.
 *
 * Needs a scratch database. Set up and run with:
 *   npm run test:setup-db
 *   TEST_DATABASE_URL=postgresql://localhost:5432/vs_e2e npx jest deal-workflow.e2e
 *
 * Skips itself when TEST_DATABASE_URL is unset, so it never breaks a CI run
 * that has no database.
 */
import crypto from 'crypto';
import zlib from 'zlib';

const TEST_DB = process.env.TEST_DATABASE_URL || '';
const describeDb = TEST_DB ? describe : describe.skip;

if (!TEST_DB) {
  // eslint-disable-next-line no-console
  console.warn('[deal-workflow.e2e] skipped: TEST_DATABASE_URL is not set');
}

// Point the pool at the scratch database before lib/db is first imported: it
// reads DATABASE_URL at module scope, so a later assignment has no effect.
process.env.DATABASE_URL = TEST_DB;
process.env.RAZORPAY_WEBHOOK_SECRET =
  process.env.RAZORPAY_WEBHOOK_SECRET || 'whsec_test_e2e';

const BRAND_ID = 4101;
const CREATOR_ID = 4102;

/** pdfkit writes text as hex strings inside TJ arrays, not as literal (...). */
function extractPdfText(pdf: Buffer): string {
  let blob = Buffer.alloc(0);
  const streams = pdf.toString('latin1').matchAll(/stream\r?\n([\s\S]*?)endstream/g);
  for (const m of streams) {
    const raw = Buffer.from(m[1], 'latin1');
    try {
      blob = Buffer.concat([blob, zlib.inflateSync(raw)]);
    } catch {
      blob = Buffer.concat([blob, raw]);
    }
  }
  const body = blob.toString('latin1');
  let text = '';
  for (const arr of body.matchAll(/\[([\s\S]*?)\]\s*TJ/g)) {
    for (const hex of arr[1].matchAll(/<([0-9A-Fa-f]*)>/g)) {
      text += Buffer.from(hex[1], 'hex').toString('latin1');
    }
    text += ' ';
  }
  return text;
}

describeDb('deal workflow end to end', () => {
  jest.setTimeout(60_000);

  /* eslint-disable @typescript-eslint/no-var-requires */
  const { query, queryOne } = require('@/lib/db-pool');
  const { WORKFLOW, dealFinancials, canCancel } = require('@/lib/deal-workflow');
  const { confirmPaymentStage, queuePayout } = require('@/lib/deal-payments');
  const { generateAndRecordAdp } = require('@/lib/adp-generator');
  const { verifyWebhookSignature } = require('@/lib/razorpay');
  /* eslint-enable @typescript-eslint/no-var-requires */

  const F = dealFinancials(10000);
  let dealId = '';

  beforeAll(async () => {
    for (const table of [
      'adp_reports', 'payouts', 'deal_workflow_payments',
      'email_communications', 'applications', 'deals',
    ]) {
      await query(`DELETE FROM ${table}`);
    }
    await query('DELETE FROM users WHERE id IN ($1,$2)', [BRAND_ID, CREATOR_ID]);
    await query(
      `INSERT INTO users (id,username,role,email,email_verified,instagram_user_id,
                          bank_details_completed,razorpay_fund_account_id)
       VALUES ($1,'e2e_brand','brand','brand@e2e.local',true,'ig_brand_e2e',true,''),
              ($2,'e2e_creator','creator','creator@e2e.local',true,'ig_creator_e2e',true,'fa_e2e')`,
      [BRAND_ID, CREATOR_ID]
    );
  });

  afterAll(async () => {
    const { pool } = require('@/lib/db-pool');
    await pool.end();
  });

  it('posts a deal as OPEN with all three deadlines', async () => {
    const row = await queryOne(
      `INSERT INTO deals (brand_id,title,description,amount,workflow_status,
          application_deadline,content_upload_deadline,deal_deadline,published_at,status,phase)
       VALUES ($1,'E2E Summer Collection','3 posts + 1 reel',10000,'OPEN',
          NOW()+INTERVAL '7 days',NOW()+INTERVAL '14 days',NOW()+INTERVAL '21 days',
          NOW(),'open','open')
       RETURNING id`,
      [BRAND_ID]
    );
    dealId = row.id;
    expect(dealId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('locks the deal to exactly one confirmed creator', async () => {
    await query(
      'INSERT INTO applications (deal_id,creator_id) VALUES ($1,$2)',
      [dealId, CREATOR_ID]
    );
    await query(
      `UPDATE applications SET status='CONFIRMED' WHERE deal_id=$1 AND creator_id=$2`,
      [dealId, CREATOR_ID]
    );
    await query(
      `UPDATE deals SET creator_id=$2, workflow_status='CONFIRMED',
              applications_closed=TRUE WHERE id=$1`,
      [dealId, CREATOR_ID]
    );
    const d = await queryOne(
      'SELECT workflow_status, creator_id FROM deals WHERE id=$1',
      [dealId]
    );
    expect(d.workflow_status).toBe(WORKFLOW.CONFIRMED);
    expect(Number(d.creator_id)).toBe(CREATOR_ID);
    // Spec: cancellable up to here, and not past it.
    expect(canCancel(WORKFLOW.CONFIRMED)).toBe(true);
  });

  it('advances through commission then advance payments', async () => {
    for (const [type, amount, expected] of [
      ['COMMISSION', F.commissionTotal, WORKFLOW.COMMISSION_PAID],
      ['ADVANCE', F.advance, WORKFLOW.ADVANCE_PAID],
    ] as [string, number, string][]) {
      await query(
        `INSERT INTO deal_workflow_payments (deal_id,type,amount,razorpay_order_id,status)
         VALUES ($1,$2,$3,$4,'PENDING')`,
        [dealId, type, amount, `e2e_order_${type}`]
      );
      const result = await confirmPaymentStage({
        orderId: `e2e_order_${type}`,
        paymentId: `e2e_pay_${type}`,
      });
      expect(result).not.toBeNull();
      expect(result.alreadyConfirmed).toBe(false);
      expect(result.newStatus).toBe(expected);
    }
    expect(canCancel(WORKFLOW.ADVANCE_PAID)).toBe(false);
  });

  // Razorpay retries webhooks. A replay must not advance the deal a second time.
  it('treats a replayed payment webhook as a no-op', async () => {
    const replay = await confirmPaymentStage({
      orderId: 'e2e_order_COMMISSION',
      paymentId: 'e2e_pay_COMMISSION',
    });
    expect(replay.alreadyConfirmed).toBe(true);

    const rows = await query(
      `SELECT COUNT(*)::int AS c FROM deal_workflow_payments
        WHERE deal_id=$1 AND type='COMMISSION' AND status='CONFIRMED'`,
      [dealId]
    );
    expect(rows.rows[0].c).toBe(1);
  });

  it('runs the revision loop and reaches approval', async () => {
    await query(
      `UPDATE deals SET content_link='https://drive.google.com/file/d/e2e/view',
              content_uploaded_at=NOW(), workflow_status='CONTENT_UPLOADED' WHERE id=$1`,
      [dealId]
    );
    await query(
      `UPDATE deals SET feedback='Brighter colours',
              workflow_status='REVISION_REQUESTED' WHERE id=$1`,
      [dealId]
    );
    await query(
      `UPDATE deals SET content_link='https://drive.google.com/file/d/e2ev2/view',
              revision_count=revision_count+1, workflow_status='CONTENT_UPLOADED' WHERE id=$1`,
      [dealId]
    );
    await query(
      `UPDATE deals SET workflow_status='APPROVED_FOR_FINAL_PAYMENT' WHERE id=$1`,
      [dealId]
    );
    const d = await queryOne(
      'SELECT workflow_status, revision_count FROM deals WHERE id=$1',
      [dealId]
    );
    expect(d.workflow_status).toBe(WORKFLOW.APPROVED_FOR_FINAL_PAYMENT);
    expect(d.revision_count).toBe(1);
  });

  it('completes the deal on the final payment', async () => {
    await query(
      `INSERT INTO deal_workflow_payments (deal_id,type,amount,razorpay_order_id,status)
       VALUES ($1,'FINAL',$2,'e2e_order_FINAL','PENDING')`,
      [dealId, F.final]
    );
    const result = await confirmPaymentStage({
      orderId: 'e2e_order_FINAL',
      paymentId: 'e2e_pay_FINAL',
    });
    expect(result.newStatus).toBe(WORKFLOW.COMPLETED);
  });

  it('queues each payout once and they sum to the creator total', async () => {
    await queuePayout({ dealId, creatorId: CREATOR_ID, type: 'ADVANCE', amount: F.advance });
    await queuePayout({ dealId, creatorId: CREATOR_ID, type: 'FINAL', amount: F.final });

    // The partial unique index must refuse a second advance payout.
    const duplicate = await queuePayout({
      dealId, creatorId: CREATOR_ID, type: 'ADVANCE', amount: F.advance,
    });
    expect(duplicate.queued).toBe(false);

    const rows = await query(
      'SELECT type, amount::numeric AS amount FROM payouts WHERE deal_id=$1 ORDER BY type',
      [dealId]
    );
    expect(rows.rows).toHaveLength(2);
    const total = rows.rows.reduce((s: number, r: any) => s + Number(r.amount), 0);
    expect(Math.round(total * 100) / 100).toBe(F.creatorTotal);
  });

  it('generates an ADP containing all eight spec sections', async () => {
    const result = await generateAndRecordAdp(dealId);
    expect(result).not.toBeNull();
    expect(result.pdf.subarray(0, 5).toString()).toBe('%PDF-');

    const text = extractPdfText(result.pdf);
    for (const needle of [
      'Deal Report',           // heading
      'Deal Identifiers',      // 1
      'Deal Terms',            // 2
      'Financial Breakdown',   // 3
      'ValueSkins Commission', // 4
      'Creator Advance',       // 5
      'Creator Final',         // 6
      'Delivery Proof',        // 7
      'Razorpay Fees',         // 8
      'ig_brand_e2e',
      'ig_creator_e2e',
      'E2E Summer Collection',
      '885',
      '2,734.50',
      '6,380.50',
      '9,115',
      'drive.google.com',
      'e2e_pay_COMMISSION',
    ]) {
      expect(text).toContain(needle);
    }

    const row = await queryOne('SELECT pdf_url FROM adp_reports WHERE deal_id=$1', [dealId]);
    expect(row).not.toBeNull();
  });

  // The signature must be checked against the exact bytes received. Verifying a
  // re-serialised body was a real bug here: JSON.stringify of a parsed object
  // need not reproduce what was signed.
  describe('webhook signature', () => {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET as string;
    const body = JSON.stringify({
      event: 'payment.captured',
      payload: { payment: { entity: { id: 'pay_x', order_id: 'order_y' } } },
    });
    const signature = crypto.createHmac('sha256', secret).update(body).digest('hex');

    it('accepts the genuine signature', () => {
      expect(verifyWebhookSignature(body, signature, secret)).toBe(true);
    });

    it('rejects a forged signature', () => {
      expect(verifyWebhookSignature(body, 'deadbeef', secret)).toBe(false);
    });

    it('rejects a tampered body', () => {
      const tampered = body.replace('payment.captured', 'payment.failed');
      expect(verifyWebhookSignature(tampered, signature, secret)).toBe(false);
    });
  });
});
