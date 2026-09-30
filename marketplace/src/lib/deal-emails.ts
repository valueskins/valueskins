// The 11 build-spec deal emails. Every send is recorded in
// email_communications, which is the audit trail both parties can read on the
// deal page. Sends never throw: a mail failure must not roll back a payment.
import nodemailer from 'nodemailer';
import { query, queryOne } from '@/lib/db-pool';

const FROM_NAME = 'ValueSkins';
const FROM_EMAIL = process.env.SMTP_FROM || 'noreply@valueskins.com';
const DISPUTE_EMAIL = 'valueskinsfounder@gmail.com';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.valueskins.com';

export type DealEmailType =
  | 'DEAL_CREATED'
  | 'NEW_APPLICATION'
  | 'APPLICATION_APPROVED'
  | 'COMMISSION_CONFIRMED'
  | 'ADVANCE_CONFIRMED'
  | 'CONTENT_UPLOADED'
  | 'REVISION_REQUESTED'
  | 'FINAL_APPROVAL'
  | 'FINAL_CONFIRMED'
  | 'ADP_READY'
  | 'DEAL_CANCELLED'
  | 'CONTENT_OVERDUE';

function getTransport() {
  if (process.env.SMTP_HOST && process.env.SMTP_PORT) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: process.env.SMTP_SECURE === 'true',
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
    });
  }
  // No SMTP configured: jsonTransport still exercises the full path and the
  // row still lands in email_communications, so the trail is never silently
  // missing in development.
  return nodemailer.createTransport({ jsonTransport: true });
}

const money = (n: number) =>
  `${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} INR`;

const dealUrl = (dealId: string) => `${APP_URL}/deals/${dealId}`;

function layout(heading: string, lines: string[], cta?: { label: string; url: string }) {
  const body = lines.map((l) => `<p>${l}</p>`).join('');
  const button = cta
    ? `<p><a href="${cta.url}" style="background:#000;color:#fff;padding:12px 20px;text-decoration:none;display:inline-block">${cta.label}</a></p>`
    : '';
  return {
    html: `<div style="font-family:system-ui,sans-serif;max-width:600px"><h2>${heading}</h2>${body}${button}<hr><p style="color:#666;font-size:12px">ValueSkins. Disputes: ${DISPUTE_EMAIL}</p></div>`,
    text: `${heading}\n\n${lines.map((l) => l.replace(/<[^>]+>/g, '')).join('\n\n')}${cta ? `\n\n${cta.label}: ${cta.url}` : ''}\n\nDisputes: ${DISPUTE_EMAIL}`,
  };
}

type Built = { subject: string; html: string; text: string };

const TEMPLATES: Record<DealEmailType, (d: any) => Built> = {
  DEAL_CREATED: (d) => ({
    subject: `Deal posted: ${d.title}`,
    ...layout('Your deal is live', [
      `<strong>${d.title}</strong>`,
      d.description,
      `Budget: ${money(d.budget)}`,
      `Applications close: ${d.application_deadline}`,
      `Content due: ${d.content_upload_deadline}`,
    ], { label: 'View deal', url: dealUrl(d.deal_id) }),
  }),

  NEW_APPLICATION: (d) => ({
    subject: `New application: ${d.title}`,
    ...layout('A creator applied to your deal', [
      `<strong>${d.creator_username}</strong> applied to <strong>${d.title}</strong>.`,
      `Followers: ${d.creator_followers ?? 'n/a'}`,
      'Review their profile and confirm or pass.',
    ], { label: 'Review application', url: dealUrl(d.deal_id) }),
  }),

  APPLICATION_APPROVED: (d) => ({
    subject: `You are confirmed: ${d.title}`,
    ...layout('You have been confirmed for this deal', [
      `Brand: <strong>${d.brand_username}</strong>`,
      `Deal: <strong>${d.title}</strong>`,
      `Your total: ${money(d.creator_total)} (advance ${money(d.advance)}, final ${money(d.final)})`,
      `Content due: ${d.content_upload_deadline}`,
      'The brand pays the commission and your 30% advance next. You will be emailed when the advance lands.',
    ], { label: 'View deal', url: dealUrl(d.deal_id) }),
  }),

  COMMISSION_CONFIRMED: (d) => ({
    subject: `Commission paid: ${d.title}`,
    ...layout('Commission payment confirmed', [
      `Deal: <strong>${d.title}</strong>`,
      `Amount: ${money(d.amount)} (${money(d.base)} + ${money(d.gst)} GST)`,
      `Razorpay payment ID: ${d.payment_id}`,
      'The GST invoice is issued by Razorpay to the brand email on file.',
    ], { label: 'View deal', url: dealUrl(d.deal_id) }),
  }),

  ADVANCE_CONFIRMED: (d) => ({
    subject: `Advance paid: ${d.title}`,
    ...layout('Advance payment confirmed', [
      `Deal: <strong>${d.title}</strong>`,
      `Advance (30%): ${money(d.amount)}`,
      `Razorpay payment ID: ${d.payment_id}`,
      'Expect the funds in your bank account within 1-2 business days.',
      `Upload your content by ${d.content_upload_deadline}.`,
    ], { label: 'Upload content', url: dealUrl(d.deal_id) }),
  }),

  CONTENT_UPLOADED: (d) => ({
    subject: `Content uploaded: ${d.title}`,
    ...layout('The creator uploaded content', [
      `Deal: <strong>${d.title}</strong>`,
      `Content link: <a href="${d.content_link}">${d.content_link}</a>`,
      d.revision_count > 0
        ? `This is revision ${d.revision_count}.`
        : 'Review it and either request changes or give final approval.',
    ], { label: 'Review content', url: dealUrl(d.deal_id) }),
  }),

  REVISION_REQUESTED: (d) => ({
    subject: `Changes requested: ${d.title}`,
    ...layout('The brand requested changes', [
      `Deal: <strong>${d.title}</strong>`,
      `Feedback: ${d.feedback}`,
      'Upload a new link when the changes are done.',
    ], { label: 'Re-upload content', url: dealUrl(d.deal_id) }),
  }),

  FINAL_APPROVAL: (d) => ({
    subject: `Approved: ${d.title}`,
    ...layout('Your content was approved', [
      `Deal: <strong>${d.title}</strong>`,
      `Final payment pending: ${money(d.final)}`,
      'Expect the funds in your account within 2 business days of the brand paying.',
    ], { label: 'View deal', url: dealUrl(d.deal_id) }),
  }),

  FINAL_CONFIRMED: (d) => ({
    subject: `Final payment confirmed: ${d.title}`,
    ...layout('Final payment confirmed', [
      `Deal: <strong>${d.title}</strong>`,
      `Final (70%): ${money(d.amount)}`,
      `Razorpay payment ID: ${d.payment_id}`,
      'This deal is now complete. The deal report follows in a separate email.',
    ], { label: 'View deal', url: dealUrl(d.deal_id) }),
  }),

  ADP_READY: (d) => ({
    subject: `Deal report: ${d.title}`,
    ...layout('Your deal report is ready', [
      `Deal: <strong>${d.title}</strong>`,
      'The report includes the agreed terms, all three invoices, and the delivery proof.',
    ], { label: 'Download report', url: `${APP_URL}/api/deals/${d.deal_id}/download-adp` }),
  }),

  DEAL_CANCELLED: (d) => ({
    subject: `Deal cancelled: ${d.title}`,
    ...layout('This deal was cancelled', [
      `Deal: <strong>${d.title}</strong>`,
      `Reason: ${d.reason || 'No reason given'}`,
      d.refund_note || 'No payment had been made, so there is nothing to refund.',
    ]),
  }),

  CONTENT_OVERDUE: (d) => ({
    subject: `Content overdue: ${d.title}`,
    ...layout('Content is overdue', [
      `Deal: <strong>${d.title}</strong>`,
      `The content upload deadline (${d.content_upload_deadline}) passed ${d.days_overdue} day(s) ago.`,
      `This deal is in limbo. Reach ${DISPUTE_EMAIL} if you need it resolved.`,
    ], { label: 'View deal', url: dealUrl(d.deal_id) }),
  }),
};

// Sends one deal email and records it in the audit trail. Never throws.
export async function sendDealEmail(opts: {
  dealId: string;
  type: DealEmailType;
  recipientId: number;
  senderId?: number | null;
  data: Record<string, any>;
  attachments?: { filename: string; content: Buffer }[];
}): Promise<{ sent: boolean }> {
  const build = TEMPLATES[opts.type];
  if (!build) return { sent: false };

  let recipientEmail = '';
  try {
    const row = await queryOne('SELECT email FROM users WHERE id = $1', [opts.recipientId]);
    recipientEmail = (row as any)?.email || '';
  } catch {
    // fall through: recorded below as a failed delivery
  }

  const built = build({ ...opts.data, deal_id: opts.dealId });
  let sent = false;
  let deliveryError = '';

  if (!recipientEmail) {
    deliveryError = 'no_email_on_file';
  } else {
    try {
      const info = await getTransport().sendMail({
        from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
        to: recipientEmail,
        subject: built.subject,
        html: built.html,
        text: built.text,
        attachments: opts.attachments,
      });
      sent = !!info.messageId;
    } catch (err) {
      deliveryError = (err as Error).message.slice(0, 300);
      console.warn('[deal-email] send failed', { type: opts.type, dealId: opts.dealId, err: deliveryError });
    }
  }

  try {
    await query(
      `INSERT INTO email_communications
         (deal_id, sender_id, recipient_id, email_type, subject, body, attachments, delivery_status, delivery_error)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        opts.dealId,
        opts.senderId ?? null,
        opts.recipientId,
        opts.type,
        built.subject,
        built.text,
        JSON.stringify((opts.attachments || []).map((a) => a.filename)),
        sent ? 'sent' : 'failed',
        deliveryError,
      ]
    );
  } catch (err) {
    console.error('[deal-email] audit write failed', (err as Error).message);
  }

  return { sent };
}

// Sends the same email to both parties (spec: several emails go to both).
export async function sendDealEmailToBoth(opts: {
  dealId: string;
  type: DealEmailType;
  brandId: number;
  creatorId: number | null;
  data: Record<string, any>;
  attachments?: { filename: string; content: Buffer }[];
}) {
  const targets = [opts.brandId, opts.creatorId].filter(
    (id): id is number => typeof id === 'number'
  );
  await Promise.all(
    targets.map((recipientId) =>
      sendDealEmail({
        dealId: opts.dealId,
        type: opts.type,
        recipientId,
        data: opts.data,
        attachments: opts.attachments,
      })
    )
  );
}
