// ADP (Automatically Downloaded PDF): the deal report generated on completion.
// Eight sections per the build spec: identifiers, agreed terms, financials, the
// three invoices, delivery proof, and the Razorpay fees we absorb.
import PDFDocument from 'pdfkit';
import { query, queryOne } from '@/lib/db-pool';
import { dealFinancials } from '@/lib/deal-workflow';
import { calculateRazorpayFees } from '@/lib/payment-workflow';

export interface AdpSnapshot {
  deal: any;
  brand: any;
  creator: any;
  payments: any[];
  financials: ReturnType<typeof dealFinancials>;
}

const money = (n: number) =>
  `${Number(n || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} INR`;

const when = (d: any) => (d ? new Date(d).toISOString().replace('T', ' ').slice(0, 19) + ' UTC' : 'n/a');

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

  return {
    deal: d,
    brand: brand as any,
    creator: creator as any,
    payments: paymentsRes.rows || [],
    financials: dealFinancials(Number(d.amount) || 0),
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

      invoice(4, 'Invoice 1: ValueSkins Commission (GST)', byType('COMMISSION'), () => {
        kv('Base', money(f.commissionBase));
        kv('GST (18%)', money(f.commissionGst));
        if (brand?.gstin) kv('Brand GSTIN', brand.gstin);
      });
      invoice(5, 'Invoice 2: Creator Advance Payment (Non-GST)', byType('ADVANCE'), () => {
        kv('Creator', creator?.username ? `@${creator.username}` : 'n/a');
        kv('Description', '30% advance payment');
      });
      invoice(6, 'Invoice 3: Creator Final Payment (Non-GST)', byType('FINAL'), () => {
        kv('Creator', creator?.username ? `@${creator.username}` : 'n/a');
        kv('Description', '70% final payment');
      });

      h1('7. Delivery Proof');
      kv('Content link', deal.content_link || 'n/a');
      kv('Uploaded at', when(deal.content_uploaded_at));
      kv('Revisions requested', String(deal.revision_count ?? 0));

      h1('8. Razorpay Fees (absorbed by ValueSkins)');
      const fees = [
        ['Commission', f.commissionTotal],
        ['Advance', f.advance],
        ['Final', f.final],
      ] as const;
      let totalFees = 0;
      for (const [label, amt] of fees) {
        const fee = calculateRazorpayFees(amt).paymentFee;
        totalFees += fee;
        kv(`${label} fee (2%)`, money(fee));
      }
      kv('Total fees', money(totalFees));

      doc
        .moveDown(1)
        .fontSize(8)
        .text(
          'This report is generated from ValueSkins payment records. Disputes: founder@valueskins.com',
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
