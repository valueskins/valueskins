import nodemailer from 'nodemailer';
import { query, queryOne } from '@/lib/db-pool';

export type EmailType = 'deal_update' | 'new_message' | 'payment_confirmed' | 'payout_processed' | 'password_reset' | 'email_verification' | 'campaign_invite' | 'welcome' | 'deal_completed' | 'usage_rights_expiring' | 'payout_changed';

const FROM_NAME = 'ValueSkins';
const FROM_EMAIL = process.env.SMTP_FROM || 'noreply@valueskins.com';

function getTransport() {
  if (process.env.SMTP_HOST && process.env.SMTP_PORT) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: process.env.SMTP_SECURE === 'true',
      auth: process.env.SMTP_USER ? {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      } : undefined,
    });
  }
  return nodemailer.createTransport({ jsonTransport: true });
}

const TEMPLATES: Record<EmailType, { subject: string; build: (data: any) => { html: string; text: string } }> = {
  welcome: {
    subject: 'Welcome to ValueSkins!',
    build: (data: any) => ({
      html: `<h1>Welcome${data.name ? `, ${data.name}` : ''}!</h1><p>You've joined ValueSkins, the marketplace connecting brands with creators.</p><p>Complete your profile and start discovering opportunities.</p>`,
      text: `Welcome${data.name ? `, ${data.name}` : ''}! You've joined ValueSkins. Complete your profile and start discovering opportunities.`,
    }),
  },
  deal_update: {
    subject: (data: any) => `Deal #${data.deal_id}: ${data.status || 'Status Update'}`,
    build: (data: any) => ({
      html: `<h2>Deal Update</h2><p>Deal #${data.deal_id} has been updated.</p><p><strong>Status:</strong> ${data.status || 'Updated'}</p>${data.message ? `<p>${data.message}</p>` : ''}<p><a href="${process.env.NEXT_PUBLIC_URL || ''}/deals/${data.deal_id}" style="background:#6366f1;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;">View Deal</a></p>`,
      text: `Deal #${data.deal_id} has been updated. Status: ${data.status || 'Updated'}${data.message ? `\n${data.message}` : ''}\n\nView: ${process.env.NEXT_PUBLIC_URL || ''}/deals/${data.deal_id}`,
    }),
  },
  new_message: {
    subject: (data: any) => `New message from ${data.sender_name || 'someone'} on deal #${data.deal_id}`,
    build: (data: any) => ({
      html: `<h2>New Message</h2><p><strong>${data.sender_name || 'Someone'}</strong> sent a message on deal #${data.deal_id}.</p><blockquote style="padding:12px;background:#f1f5f9;border-radius:6px;margin:12px 0;">${data.preview || ''}</blockquote><p><a href="${process.env.NEXT_PUBLIC_URL || ''}/deals/${data.deal_id}" style="background:#6366f1;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;">Reply</a></p>`,
      text: `New message from ${data.sender_name || 'someone'} on deal #${data.deal_id}:\n\n${data.preview || ''}\n\nReply: ${process.env.NEXT_PUBLIC_URL || ''}/deals/${data.deal_id}`,
    }),
  },
  payment_confirmed: {
    subject: (data: any) => `Payment confirmed, ₹${data.amount} for deal #${data.deal_id}`,
    build: (data: any) => ({
      html: `<h2>Payment Confirmed</h2><p>₹${data.amount} has been received for deal #${data.deal_id}.</p><p><a href="${process.env.NEXT_PUBLIC_URL || ''}/deals/${data.deal_id}" style="background:#6366f1;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;">View Deal</a></p>`,
      text: `Payment confirmed: ₹${data.amount} received for deal #${data.deal_id}.\n\nView: ${process.env.NEXT_PUBLIC_URL || ''}/deals/${data.deal_id}`,
    }),
  },
  payout_processed: {
    subject: (data: any) => `Payout of ₹${data.amount} processed`,
    build: (data: any) => ({
      html: `<h2>Payout Processed</h2><p>₹${data.amount} has been sent to your account.</p>${data.deal_id ? `<p>Deal #${data.deal_id}</p>` : ''}`,
      text: `Payout of ₹${data.amount} has been sent to your account.${data.deal_id ? ` Deal #${data.deal_id}` : ''}`,
    }),
  },
  password_reset: {
    subject: 'Reset your ValueSkins password',
    build: (data: any) => ({
      html: `<h2>Password Reset</h2><p>Click the link below to reset your password. This link expires in 15 minutes.</p><p><a href="${data.reset_url}" style="background:#6366f1;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;">Reset Password</a></p><p>If you didn't request this, ignore this email.</p>`,
      text: `Reset your password here: ${data.reset_url}\n\nThis link expires in 15 minutes. If you didn't request this, ignore this email.`,
    }),
  },
  email_verification: {
    subject: 'Verify your email address',
    build: (data: any) => ({
      html: `<h2>Verify Your Email</h2><p>Click the link below to verify your email address.</p><p><a href="${data.verify_url}" style="background:#000;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;">Verify Email</a></p><p style="color:#666;font-size:12px">If the button does not work, copy this link into your browser:<br>${data.verify_url}</p>`,
      text: `Verify your email: ${data.verify_url}`,
    }),
  },
  payout_changed: {
    subject: 'Your ValueSkins UPI ID was changed',
    build: (data: any) => ({
      html: `<h2>Your UPI ID was changed</h2><p>Payments for your deals will now be sent to <strong>${data.masked}</strong>.</p><p>If you did not make this change, reply to this email straight away and sign out of ValueSkins on every device.</p>`,
      text: `Your ValueSkins UPI ID was changed. Payments for your deals will now be sent to ${data.masked}.\n\nIf you did not make this change, reply to this email straight away and sign out of ValueSkins on every device.`,
    }),
  },
  campaign_invite: {
    subject: (data: any) => `You're invited to join "${data.campaign_title}"`,
    build: (data: any) => ({
      html: `<h2>Campaign Invitation</h2><p>You've been invited to join the campaign <strong>"${data.campaign_title}"</strong>.</p>${data.brand_name ? `<p>by ${data.brand_name}</p>` : ''}${data.budget ? `<p>Budget: ₹${data.budget}</p>` : ''}<p><a href="${process.env.NEXT_PUBLIC_URL || ''}/campaigns/${data.campaign_id}" style="background:#6366f1;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;">View Invitation</a></p>`,
      text: `You're invited to join "${data.campaign_title}"${data.brand_name ? ` by ${data.brand_name}` : ''}${data.budget ? ` Budget: ₹${data.budget}` : ''}\n\nView: ${process.env.NEXT_PUBLIC_URL || ''}/campaigns/${data.campaign_id}`,
    }),
  },
  deal_completed: {
    subject: (data: any) => `Deal #${data.deal_id} completed!`,
    build: (data: any) => ({
      html: `<h2>Deal Completed</h2><p>Deal #${data.deal_id} has been completed successfully.</p>${data.title ? `<p><strong>${data.title}</strong></p>` : ''}<p><a href="${process.env.NEXT_PUBLIC_URL || ''}/deals/${data.deal_id}" style="background:#6366f1;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;">View Deal Summary</a></p>`,
      text: `Deal #${data.deal_id} completed!${data.title ? ` ${data.title}` : ''}\n\nView: ${process.env.NEXT_PUBLIC_URL || ''}/deals/${data.deal_id}`,
    }),
  },
  usage_rights_expiring: {
    subject: (data: any) => `Your usage rights for ${data.creator_name || 'creator'}'s content expire in 5 days`,
    build: (data: any) => ({
      html: `<h2>Usage Rights Expiring Soon</h2><p>Your usage rights for <strong>${data.creator_name || 'Creator'}</strong>'s content (Deal #${data.deal_id}) expire in 5 days.</p><p>Please stop running this content as an ad after <strong>${data.expiration_date || 'the expiration date'}</strong>.</p><p>If you need extended rights, contact the creator to negotiate a new agreement.</p><p><a href="${process.env.NEXT_PUBLIC_URL || ''}/deals/${data.deal_id}" style="background:#6366f1;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;">View Deal</a></p>`,
      text: `Your usage rights for ${data.creator_name || 'Creator'}'s content (Deal #${data.deal_id}) expire in 5 days.\n\nPlease stop running this content as an ad after ${data.expiration_date || 'the expiration date'}.\n\nIf you need extended rights, contact the creator to negotiate a new agreement.\n\nView: ${process.env.NEXT_PUBLIC_URL || ''}/deals/${data.deal_id}`,
    }),
  },
};

function resolveSubject(template: typeof TEMPLATES[EmailType], data: any): string {
  if (typeof template.subject === 'function') return template.subject(data);
  return template.subject;
}

export async function sendEmail(options: {
  to: string; userId?: number; type: EmailType; data: any;
}): Promise<{ sent: boolean; logged: boolean }> {
  const template = TEMPLATES[options.type];
  if (!template) return { sent: false, logged: false };

  const subject = resolveSubject(template, options.data);
  const { html, text } = template.build(options.data);

  let sent = false;

  try {
    const transport = getTransport();
    const info = await transport.sendMail({
      from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
      to: options.to, subject, html, text,
    });
    sent = !!info.messageId;
  } catch (err) {
    console.warn('[Email] Send failed (logged to queue):', (err as Error).message);
  }

  // The log is a record of the attempt, not part of it. It used to be awaited
  // bare, so when the table was missing the insert threw and took the caller's
  // whole request down with it.
  let logged = true;
  try {
    await query(
      `INSERT INTO email_queue (recipient_email, subject, body_html, body_text, email_type, user_id, sent, sent_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())`,
      [options.to, subject, html, text, options.type, options.userId || null, sent]
    );
  } catch (err) {
    logged = false;
    console.error('[Email] could not record the attempt', (err as Error).message);
  }

  return { sent, logged };
}

export async function sendNotificationEmail(options: {
  userId: number; type: EmailType; data: any;
}): Promise<{ sent: boolean; reason?: string }> {
  const prefs = await queryOne(
    'SELECT email, marketing, notifications, product_updates FROM users u LEFT JOIN user_email_preferences p ON p.user_id = u.id WHERE u.id = $1',
    [options.userId]
  );
  if (!prefs?.email) return { sent: false, reason: 'no_email' };

  const prefsRow: any = prefs;
  const typeCategory = getEmailCategory(options.type);
  if (typeCategory === 'marketing' && prefsRow.marketing === false) return { sent: false, reason: 'marketing_opt_out' };
  if (typeCategory === 'notifications' && prefsRow.notifications === false) return { sent: false, reason: 'notifications_opt_out' };

  const result = await sendEmail({ to: prefsRow.email, userId: options.userId, type: options.type, data: options.data });
  return { sent: result.sent };
}

function getEmailCategory(type: EmailType): 'marketing' | 'notifications' {
  if (type === 'welcome' || type === 'campaign_invite') return 'marketing';
  return 'notifications';
}

export async function getEmailQueue(page = 1, pageSize = 50) {
  const offset = (page - 1) * pageSize;
  const rows = await query(
    'SELECT id, recipient_email, subject, email_type, user_id, sent, sent_at, created_at FROM email_queue ORDER BY created_at DESC LIMIT $1 OFFSET $2',
    [pageSize, offset]
  );
  return rows.rows;
}
