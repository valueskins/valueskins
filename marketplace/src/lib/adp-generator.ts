// ADP (Automatically Downloaded PDF): the deal report generated on completion.
// Eight sections per the build spec: identifiers, agreed terms, financials, the
// three invoices, delivery proof, and the Razorpay fees we absorb.
import PDFDocument from 'pdfkit';
import { query, queryOne } from '@/lib/db-pool';
import { dealFinancials } from '@/lib/deal-workflow';
import { calculateRazorpayFees } from '@/lib/payment-workflow';
import { listDealEvents, describeDealEvent, type DealEventRow } from '@/lib/deal-events';

export interface AdpSnapshot {
  deal: any;
  brand: any;
  creator: any;
  payments: any[];
  financials: ReturnType<typeof dealFinancials>;
  // Everything below is optional so a snapshot stored before these were added
  // still renders.
  /** The 30% and 70% payments, made by UPI and recorded on the deal. */
  directPayments?: any[];
  /** Every action on the deal, oldest first. */
  events?: DealEventRow[];
  /** Every email the platform sent about the deal. */
  emails?: any[];
  /** id -> username, for everyone named in the events. */
  names?: Record<string, string>;
}

const money = (n: number) =>
  `${Number(n || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} INR`;

// India time. Both parties are in India, and a UTC timestamp reads five and a
// half hours away from what either of them remembers.
const when = (d: any) =>
  d
    ? new Date(d).toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
      }) + ' IST'
    : 'n/a';

export async function collectAdpData(dealId: string): Promise<AdpSnapshot | null> {
  const deal = await queryOne(
    `SELECT id, brand_id, creator_id, title, description, amount, workflow_status,
            application_deadline, content_upload_deadline, deal_deadline,
            content_link, content_uploaded_at, revision_count,
            created_at, published_at, updated_at
       FROM deals WHERE id = $1`,
    [dealId]
  );
  if (!deal) return null;

  const d = deal as any;
  const [brand, creator, paymentsRes] = await Promise.all([
    queryOne(
      'SELECT id, username, instagram_user_id, email, gstin FROM users WHERE id = $1',
      [d.brand_id]
    ),
    d.creator_id
      ? queryOne(
          'SELECT id, username, instagram_user_id, email FROM users WHERE id = $1',
          [d.creator_id]
        )
      : Promise.resolve(null),
    query(
      `SELECT type, amount, razorpay_payment_id, razorpay_order_id,
              razorpay_invoice_id, status, updated_at
         FROM deal_workflow_payments
        WHERE deal_id = $1
        ORDER BY CASE type WHEN 'COMMISSION' THEN 1 WHEN 'ADVANCE' THEN 2 ELSE 3 END`,
      [dealId]
    ),
  ]);

  const [events, directRes, emailRes] = await Promise.all([
    listDealEvents(dealId),
    query(
      `SELECT type, amount, reference, paid_to_vpa, note, recorded_at,
              confirmed_at, disputed_at, dispute_reason
         FROM direct_payments
        WHERE deal_id = $1
        ORDER BY recorded_at`,
      [dealId]
    ),
    query(
      `SELECT email_type, subject, sender_id, recipient_id, delivery_status, sent_at
         FROM email_communications
        WHERE deal_id = $1
        ORDER BY sent_at, created_at`,
      [dealId]
    ),
  ]);

  // Names for everyone the record mentions: the two parties, and any creator
  // who applied and was not picked.
  const ids = new Set<number>();
  for (const v of [d.brand_id, d.creator_id]) if (v) ids.add(Number(v));
  for (const e of events) {
    if (e.actor_id) ids.add(Number(e.actor_id));
    if (e.detail?.creator_id) ids.add(Number(e.detail.creator_id));
  }
  for (const m of emailRes.rows || []) {
    if (m.sender_id) ids.add(Number(m.sender_id));
    if (m.recipient_id) ids.add(Number(m.recipient_id));
  }
  const names: Record<string, string> = {};
  if (ids.size > 0) {
    const who = await query('SELECT id, username FROM users WHERE id = ANY($1::bigint[])', [Array.from(ids)]);
    for (const r of who.rows || []) names[String(r.id)] = r.username || '';
  }

  return {
    deal: d,
    brand: brand as any,
    creator: creator as any,
    payments: paymentsRes.rows || [],
    financials: dealFinancials(Number(d.amount) || 0),
    directPayments: directRes.rows || [],
    events,
    emails: emailRes.rows || [],
    names,
  };
}

export function renderAdpPdf(snap: AdpSnapshot): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const { deal, brand, creator, payments, financials: f } = snap;

      const h1 = (t: string) => doc.moveDown(0.8).fontSize(13).text(t, { underline: true }).moveDown(0.3).fontSize(10);
      const kv = (k: string, v: string) => doc.fontSize(10).text(`${k}: ${v}`);

      doc.fontSize(17).text('ValueSkins Deal Report (ADP)', { align: 'center' });
      doc.fontSize(9).text(`Generated: ${when(new Date())}`, { align: 'center' });

      h1('1. Deal Identifiers');
      kv('Brand Instagram ID', brand?.instagram_user_id || 'n/a');
      kv('Creator Instagram ID', creator?.instagram_user_id || 'n/a');
      kv('Deal ID', deal.id);

      h1('2. Deal Terms Agreed Upon');
      kv('Title', deal.title || '');
      kv('Brand', brand?.username ? `@${brand.username}` : 'n/a');
      kv('Creator', creator?.username ? `@${creator.username}` : 'n/a');
      doc.moveDown(0.2).text('Description / deliverables:', { continued: false });
      doc.fontSize(9).text(deal.description || '', { align: 'left' }).fontSize(10);
      kv('Deal amount', money(Number(deal.amount)));
      kv('Application deadline', when(deal.application_deadline));
      kv('Content upload deadline', when(deal.content_upload_deadline));
      kv('Deal deadline', when(deal.deal_deadline));
      kv('Published', when(deal.published_at));
      kv('Completed', when(deal.updated_at));

      h1('3. Financial Breakdown');
      kv('Original budget', money(f.budget));
      kv('ValueSkins commission (750 + 18% GST)', money(f.commissionTotal));
      kv('Creator deal amount', money(f.creatorTotal));
      kv('Advance (30%)', money(f.advance));
      kv('Final (70%)', money(f.final));

      const byType = (t: string) => payments.find((p) => p.type === t);
      const invoice = (
        n: number,
        title: string,
        row: any,
        extra?: () => void
      ) => {
        h1(`${n}. ${title}`);
        if (!row) {
          doc.text('No payment recorded for this stage.');
          return;
        }
        kv('Amount', money(Number(row.amount)));
        extra?.();
        kv('Status', row.status);
        kv('Payment date', when(row.updated_at));
        kv('Razorpay payment ID', row.razorpay_payment_id || 'n/a');
        kv('Razorpay order ID', row.razorpay_order_id || 'n/a');
        if (row.razorpay_invoice_id) kv('Razorpay invoice ID', row.razorpay_invoice_id);
      };

      invoice(4, 'Payment 1: ValueSkins Fee (GST invoice)', byType('COMMISSION'), () => {
        kv('Base', money(f.commissionBase));
        kv('GST (18%)', money(f.commissionGst));
        if (brand?.gstin) kv('Brand GSTIN', brand.gstin);
      });
      // The 30% and the 70% are paid by UPI directly to the creator and recorded
      // on the deal. They never pass through Razorpay, so they are read from
      // the direct payment records, which is where they actually are.
      const direct = snap.directPayments || [];
      const directPayment = (n: number, title: string, type: string, share: string) => {
        h1(`${n}. ${title}`);
        const rows = direct.filter((p) => p.type === type);
        if (rows.length === 0) {
          doc.text('No payment recorded for this stage.');
          return;
        }
        for (const row of rows) {
          kv('Amount', money(Number(row.amount)));
          kv('Description', share);
          kv('Paid to UPI ID', row.paid_to_vpa || 'n/a');
          kv('UPI reference given by the brand', row.reference || 'n/a');
          kv('Recorded by the brand', when(row.recorded_at));
          if (row.confirmed_at) kv('Confirmed received by the creator', when(row.confirmed_at));
          if (row.disputed_at) {
            kv('Reported as not received by the creator', when(row.disputed_at));
            if (row.dispute_reason) kv('Reason given', String(row.dispute_reason));
          }
          if (!row.confirmed_at && !row.disputed_at) kv('Status', 'Waiting for the creator to confirm');
          if (rows.length > 1) doc.moveDown(0.3);
        }
      };
      directPayment(5, 'Payment 2: Advance to the Creator (30%, by UPI)', 'ADVANCE', '30% advance payment');
      directPayment(6, 'Payment 3: Final to the Creator (70%, by UPI)', 'FINAL', '70% final payment');

      h1('7. Delivery Proof');
      kv('Final content link', deal.content_link || 'n/a');
      kv('Submitted at', when(deal.content_uploaded_at));
      kv('Rounds of changes requested', String((snap.events || []).filter((e) => e.event_type === 'CHANGES_REQUESTED').length || deal.revision_count || 0));
      doc.fontSize(9).text('Every submission and every change request is listed in full in section 8.').fontSize(10);

      // ---- the whole story, in order ------------------------------------
      const names = snap.names || {};
      const who = (id: number | null) => {
        if (!id) return 'ValueSkins';
        const name = names[String(id)] ? `@${names[String(id)]}` : `user ${id}`;
        if (String(id) === String(deal.brand_id)) return `Brand ${name}`;
        return `Creator ${name}`;
      };

      h1('8. Complete Record of the Deal');
      const events = snap.events || [];
      if (events.length === 0) {
        doc.text('No actions were recorded for this deal.');
      } else {
        doc.fontSize(9).text(
          'Every action taken on this deal by either party, in the order it happened. Times are India Standard Time.'
        ).moveDown(0.4).fontSize(10);
        for (const ev of events) {
          const { line, quote } = describeDealEvent(ev, who);
          doc.fontSize(9).fillColor('#555555').text(when(ev.created_at));
          doc.fontSize(10).fillColor('#000000').text(line);
          // What was actually written, word for word, set apart from our own
          // description of the action.
          if (quote) doc.fontSize(9).text(quote, { indent: 14 }).fontSize(10);
          doc.moveDown(0.35);
        }
      }

      h1('9. Emails Sent About the Deal');
      const emails = snap.emails || [];
      if (emails.length === 0) {
        doc.text('No emails were recorded for this deal.');
      } else {
        for (const m of emails) {
          doc.fontSize(9).text(
            `${when(m.sent_at)}  ${m.subject || m.email_type}  (to ${who(Number(m.recipient_id) || null)}${
              m.delivery_status && m.delivery_status !== 'sent' ? `, ${m.delivery_status}` : ''
            })`
          );
        }
        doc.fontSize(10);
      }

      // Only the fee goes through Razorpay, so it is the only payment that
      // carries a Razorpay charge.
      h1('10. Razorpay Charge on the Fee (absorbed by ValueSkins)');
      kv('Charge on the fee (2%)', money(calculateRazorpayFees(f.commissionTotal).paymentFee));

      doc
        .moveDown(1)
        .fontSize(8)
        .text(
          'This report is generated from ValueSkins records of the deal. Questions or disputes: founder@valueskins.com, or WhatsApp 88056 95324.',
          { align: 'center' }
        );

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Generates the ADP and records it. The PDF itself is not stored (spec: no file
 * storage) — the row keeps a JSON snapshot so a later regeneration reproduces
 * the same report even if the deal rows change.
 */
export async function generateAndRecordAdp(
  dealId: string
): Promise<{ pdf: Buffer; snapshot: AdpSnapshot } | null> {
  const snap = await collectAdpData(dealId);
  if (!snap) return null;
  const pdf = await renderAdpPdf(snap);

  await query(
    `INSERT INTO adp_reports (deal_id, pdf_url, snapshot)
     VALUES ($1,$2,$3)
     ON CONFLICT (deal_id) DO UPDATE
       SET snapshot = EXCLUDED.snapshot, generated_at = NOW()`,
    [dealId, `/api/deals/${dealId}/download-adp`, JSON.stringify(snap)]
  );

  return { pdf, snapshot: snap };
}
