import { NextApiRequest, NextApiResponse } from 'next';
import { withApiHandler } from '@/lib/api-handler';
import { setupCors } from '@/lib/cors';
import { queryOne, query, transaction } from '@/lib/db';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import crypto from 'crypto';

const RETENTION_PERIOD_DAYS: Record<string, number> = {
  EU: 30,
  US: 30,
  CA: 30,
  AU: 30,
  GB: 30,
  IN: 30,
  BR: 30,
  JP: 30,
  DEFAULT: 30,
};

const TAX_RETENTION_YEARS: Record<string, number> = {
  EU: 7,
  US: 7,
  CA: 7,
  AU: 7,
  GB: 7,
  IN: 8,
  BR: 5,
  JP: 7,
  DEFAULT: 7,
};

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (setupCors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const sessionToken = req.cookies.valueskins_session;
    if (!sessionToken) return res.status(401).json({ error: 'Unauthorized' });

    const session = await queryOne(
      'SELECT user_id FROM auth_sessions WHERE id = $1 AND is_active = TRUE AND expires_at > NOW()',
      [sessionToken]
    );
    if (!session) return res.status(401).json({ error: 'Session expired' });

    const userId = session.user_id;

    const existingRequest = await queryOne(
      'SELECT status, deletion_deadline FROM deletion_queue WHERE user_id = $1',
      [userId]
    );
    if (existingRequest && existingRequest.status === 'pending') {
      return res.status(409).json({
        error: 'Deletion already requested',
        cancellation_link: '/api/legal/cancel-deletion',
        deletion_deadline: existingRequest.deletion_deadline,
      });
    }

    const user = await queryOne('SELECT id, email, display_name, avatar_url, username, role, country, created_at, last_login_at, retention_country FROM users WHERE id = $1', [userId]);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const country = (user.retention_country || user.country || 'US').toUpperCase();
    const graceDays = RETENTION_PERIOD_DAYS[country] || RETENTION_PERIOD_DAYS.DEFAULT;
    const taxYears = TAX_RETENTION_YEARS[country] || TAX_RETENTION_YEARS.DEFAULT;

    const deals = await query(
      `SELECT id, title, status, offer_amount, budget, value_skin, content_type,
              delivery_type, deliverables, completed_at, created_at
       FROM deals
       WHERE brand_id = $1 OR creator_id = $1
       ORDER BY created_at DESC`,
      [userId]
    );

    const dealMessages = await query(
      `SELECT dm.id, dm.deal_id, dm.message, dm.created_at
       FROM deal_messages dm
       JOIN deals d ON dm.deal_id = d.id
       WHERE d.brand_id = $1 OR d.creator_id = $1
       ORDER BY dm.created_at DESC`,
      [userId]
    );

    const payments = await query(
      `SELECT dp.id, dp.deal_id, dp.amount, dp.status, dp.payment_date, dp.transaction_id
       FROM deal_payments dp
       JOIN deals d ON dp.deal_id = d.id
       WHERE d.brand_id = $1 OR d.creator_id = $1
       ORDER BY dp.payment_date DESC`,
      [userId]
    );

    const escrow = await query(
      `SELECT de.id, de.deal_id, de.amount, de.status, de.created_at, de.released_at
       FROM deal_escrow de
       JOIN deals d ON de.deal_id = d.id
       WHERE d.brand_id = $1 OR d.creator_id = $1
       ORDER BY de.created_at DESC`,
      [userId]
    );

    const reviews = await query(
      `SELECT dr.id, dr.deal_id, dr.rating, dr.comment, dr.created_at
       FROM deal_reviews dr
       JOIN deals d ON dr.deal_id = d.id
       WHERE d.brand_id = $1 OR d.creator_id = $1 OR dr.reviewer_id = $1
       ORDER BY dr.created_at DESC`,
      [userId]
    );

    const campaigns = await query(
      `SELECT id, title, description, budget, status, value_skin, created_at
       FROM campaigns WHERE brand_id = $1
       ORDER BY created_at DESC`,
      [userId]
    );

    const consents = await query(
      'SELECT consent_type, granted, version, created_at FROM user_consents WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );

    const notifications = await query(
      'SELECT id, title, message, type, read_at, created_at FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 500',
      [userId]
    );

    const sessions = await query(
      'SELECT id, is_active, created_at, expires_at, last_activity_at FROM auth_sessions WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );

    const valueSkins = await query(
      'SELECT value_skin, purchased_at FROM user_value_skins WHERE user_id = $1 ORDER BY purchased_at DESC',
      [userId]
    );

    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
    const fontMono = await doc.embedFont(StandardFonts.Courier);

    let page = doc.addPage([612, 792]);
    const { width, height } = page.getSize();
    let y = height - 50;

    function wrap(text: string, maxWidth: number): string[] {
      const words = text.split(' ');
      const lines: string[] = [];
      let current = '';
      for (const word of words) {
        const test = current ? current + ' ' + word : word;
        if (font.widthOfTextAtSize(test, 10) > maxWidth) {
          if (current) lines.push(current);
          current = word;
        } else {
          current = test;
        }
      }
      if (current) lines.push(current);
      return lines;
    }

    function addLine(text: string, size = 10, bold = false, color = rgb(0, 0, 0)) {
      const f = bold ? fontBold : font;
      const lines = wrap(text, width - 80);
      for (const line of lines) {
        if (y < 50) {
          page = doc.addPage([612, 792]);
          y = height - 50;
        }
        page.drawText(line, { x: 40, y, size, font: f, color });
        y -= size + 4;
      }
    }

    function addMono(text: string, size = 8, color = rgb(0.2, 0.2, 0.2)) {
      if (y < 50) {
        page = doc.addPage([612, 792]);
        y = height - 50;
      }
      page.drawText(text, { x: 50, y, size, font: fontMono, color });
      y -= size + 4;
    }

    function addDivider() {
      y -= 6;
      page.drawLine({ start: { x: 40, y }, end: { x: width - 40, y }, thickness: 0.5, color: rgb(0.8, 0.8, 0.8) });
      y -= 10;
    }

    const formatDate = (d: any) => d ? new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A';
    const formatCurrency = (n: any) => n ? `$${Number(n).toLocaleString()}` : 'N/A';

    addLine('ValueSkins - Account Deletion Export', 18, true, rgb(0.1, 0.1, 0.1));
    addLine(`Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`, 8, false, rgb(0.4, 0.4, 0.4));
    addLine(`Country: ${country} | Grace Period: ${graceDays} days | Tax Retention: ${taxYears} years`, 8, false, rgb(0.4, 0.4, 0.4));
    y -= 8;
    addDivider();

    addLine('SECTION 1: WORK HISTORY', 14, true, rgb(0.2, 0.2, 0.6));
    y -= 4;

    addLine('Account Profile', 12, true);
    addLine(`Display Name: ${user.display_name || 'Not set'}`);
    addLine(`Email: ${user.email || 'Not set'}`);
    addLine(`Username: ${user.username || 'Not set'}`);
    addLine(`Role: ${user.role || 'Not set'}`);
    addLine(`Account Created: ${formatDate(user.created_at)}`);
    addLine(`Last Login: ${formatDate(user.last_login_at)}`);
    addDivider();

    if (deals?.rows?.length > 0) {
      addLine(`Deals (${deals.rows.length})`, 12, true);
      for (const deal of deals.rows) {
        addLine(`  #${deal.id}, ${deal.title || 'Untitled'}, ${deal.status || 'Unknown'}, ${formatCurrency(deal.offer_amount)}`);
        addLine(`    Value Skin: ${deal.value_skin || 'N/A'} | Type: ${deal.content_type || 'N/A'} | Delivery: ${deal.delivery_type || 'N/A'}`);
        addLine(`    Created: ${formatDate(deal.created_at)} | Completed: ${formatDate(deal.completed_at)}`);
        const delivs = deal.deliverables;
        if (Array.isArray(delivs) && delivs.length > 0) {
          addLine(`    Deliverables: ${delivs.length} item(s)`);
        }
      }
      addDivider();
    }

    if (dealMessages?.rows?.length > 0) {
      addLine(`Messages (${dealMessages.rows.length})`, 12, true);
      const maxMsgs = Math.min(dealMessages.rows.length, 100);
      for (let i = 0; i < maxMsgs; i++) {
        const msg = dealMessages.rows[i];
        const preview = msg.message.length > 100 ? msg.message.substring(0, 100) + '...' : msg.message;
        addLine(`  [${formatDate(msg.created_at)}] Deal #${msg.deal_id}: ${preview}`);
      }
      addDivider();
    }

    if (payments?.rows?.length > 0) {
      addLine(`Payments (${payments.rows.length})`, 12, true);
      for (const pmt of payments.rows) {
        addLine(`  #${pmt.id}, ${formatCurrency(pmt.amount)}, ${pmt.status || 'Unknown'}, ${formatDate(pmt.payment_date)}`);
      }
      addDivider();
    }

    if (escrow?.rows?.length > 0) {
      addLine(`Escrow Records (${escrow.rows.length})`, 12, true);
      for (const es of escrow.rows) {
        addLine(`  Deal #${es.deal_id}, ${formatCurrency(es.amount)}, ${es.status}, Created: ${formatDate(es.created_at)}`);
      }
      addDivider();
    }

    if (reviews?.rows?.length > 0) {
      addLine(`Reviews & Ratings (${reviews.rows.length})`, 12, true);
      for (const rev of reviews.rows) {
        addLine(`  Deal #${rev.deal_id}, Rating: ${rev.rating}/5-${formatDate(rev.created_at)}`);
        if (rev.comment) addLine(`    "${rev.comment.substring(0, 150)}"`);
      }
      addDivider();
    }

    if (campaigns?.rows?.length > 0) {
      addLine(`Campaigns (${campaigns.rows.length})`, 12, true);
      for (const cmp of campaigns.rows) {
        addLine(`  #${cmp.id}, ${cmp.title || 'Untitled'}, ${cmp.status || 'Unknown'}, ${formatCurrency(cmp.budget)}`);
      }
      addDivider();
    }

    addLine('SECTION 2: DATA COLLECTED ABOUT YOU', 14, true, rgb(0.2, 0.2, 0.6));
    y -= 4;

    addLine('Profile Data', 12, true);
    addLine('  - Email address, display name, username, avatar URL');
    addLine('  - Account role (creator/brand), bio, location, social links');
    addLine(`  - Value Skins purchased: ${valueSkins?.rows?.length || 0}`);
    addLine('  - Profile portfolio items, pitch materials');
    addLine('  - Email verification status, last login timestamp');
    addDivider();

    addLine('Consent Records', 12, true);
    if (consents?.rows?.length > 0) {
      for (const c of consents.rows) {
        addLine(`  - ${c.consent_type}: ${c.granted ? 'Granted' : 'Denied'} (v${c.version || '1.0'}), ${formatDate(c.created_at)}`);
      }
    } else {
      addLine('  (No consent records found)');
    }
    addDivider();

    addLine('Communications Data', 12, true);
    addLine(`  - Deal messages: ${dealMessages?.rows?.length || 0}`);
    addLine(`  - Notifications: ${notifications?.rows?.length || 0}`);
    addDivider();

    addLine('Usage & Security Data', 12, true);
    addLine(`  - Active sessions: ${sessions?.rows?.length || 0}`);
    addLine('  - IP addresses, user agent, login timestamps');
    addLine('  - Feature interactions and page views');
    addLine('  - Cookie-based session tracking');
    addDivider();

    addLine('Data We Do NOT Collect', 12, true);
    addLine('  - Government IDs, passport numbers, driver licenses');
    addLine('  - Financial account numbers (full bank details)');
    addLine('  - Exact GPS location (only country-level)');
    addLine('  - Biometric data, health information');
    addLine('  - Political, religious, or sexual orientation data');
    addDivider();

    addLine('Legal & Retention', 12, true);
    addLine(`Country applied: ${country}`);
    addLine(`Account deletion grace period: ${graceDays} days`);
    addLine(`Payment records retained for: ${taxYears} years (tax compliance)`);
    addLine('After grace period: profile data is anonymized');
    addLine('Anonymized email is freed for new account registration');
    addLine('Backup copies may persist up to 90 days after anonymization');
    addLine('');
    addLine('After account deletion, you can re-register with the same');
    addLine('email address, it will be treated as a brand new account.');
    addDivider();

    addLine('Thank you for being part of ValueSkins.', 12, true, rgb(0.3, 0.3, 0.3));
    addLine('This export is provided for your records.', 10, false, rgb(0.4, 0.4, 0.4));

    const pdfBytes = await doc.save();
    const pdfBase64 = Buffer.from(pdfBytes).toString('base64');

    const exportId = crypto.randomUUID();

    await query(
      `INSERT INTO pending_deletion_exports (id, user_id, history_pdf_base64, compliance_json)
       VALUES ($1, $2, $3, $4)`,
      [exportId, userId, pdfBase64, JSON.stringify({
        exported_at: new Date().toISOString(),
        user_id: userId,
        country,
        grace_days: graceDays,
        tax_retention_years: taxYears,
        work_history: {
          deals: deals?.rows?.length || 0,
          messages: dealMessages?.rows?.length || 0,
          payments: payments?.rows?.length || 0,
          campaigns: campaigns?.rows?.length || 0,
        },
      })]
    );

    await transaction(async (client) => {
      await client.query(
        `INSERT INTO deletion_queue (user_id, requested_at, deletion_deadline, status, export_id, retention_months)
         VALUES ($1, NOW(), NOW() + $2::INTERVAL, 'pending', $3, $4)`,
        [userId, `${graceDays} days`, exportId, taxYears * 12]
      );

      await client.query(
        'UPDATE auth_sessions SET is_active = FALSE WHERE user_id = $1',
        [userId]
      );

      await client.query(
        `INSERT INTO audit_logs (table_name, operation, user_id, new_values)
         VALUES ('users', 'DELETE_REQUESTED', $1, $2)`,
        [userId, JSON.stringify({ deletion_deadline: `${graceDays} days`, country, export_id: exportId })]
      );

      await client.query(
        `UPDATE users SET retention_country = $2 WHERE id = $1`,
        [userId, country]
      );
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="valueskins-deletion-export-${Date.now()}.pdf"`);
    res.setHeader('Content-Length', pdfBytes.length);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Deletion-Status', 'scheduled');
    res.setHeader('X-Deletion-Deadline', new Date(Date.now() + graceDays * 24 * 60 * 60 * 1000).toISOString());
    res.setHeader('X-Export-ID', exportId);

    return res.status(200).send(Buffer.from(pdfBytes));
  } catch (error) {
    console.error('Deletion request error:', error);
    return res.status(500).json({ error: 'Failed to process deletion request' });
  }
}

export default withApiHandler(handler, {
  allowedMethods: ['POST'],
  rateLimit: { maxRequests: 2, windowMs: 24 * 60 * 60 * 1000 },
});
