import { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';

export const config = {
  api: { bodyParser: false },
};

const VERIFY_TOKEN = process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN || '';

function timingSafeEqualBytes(a: Buffer | string, b: Buffer | string): boolean {
  const bufA = Buffer.isBuffer(a) ? a : Buffer.from(String(a));
  const bufB = Buffer.isBuffer(b) ? b : Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && typeof token === 'string' && typeof challenge === 'string') {
      if (!VERIFY_TOKEN) {
        console.error('INSTAGRAM_WEBHOOK_VERIFY_TOKEN not set');
        return res.status(500).send('Webhook not configured');
      }
      if (timingSafeEqualBytes(token, VERIFY_TOKEN)) {
        return res.status(200).send(challenge);
      }
      return res.status(403).send('Forbidden');
    }
    return res.status(400).send('Bad request');
  }

  if (req.method === 'POST') {
    const appSecret = process.env.INSTAGRAM_CLIENT_SECRET || '';
    if (!VERIFY_TOKEN || !appSecret) {
      console.error('Instagram webhook secrets not set, webhook disabled');
      return res.status(500).send('Webhook not configured');
    }

    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    const rawBody = Buffer.concat(chunks);

    const signature = req.headers['x-hub-signature-256'] as string;
    if (!signature) return res.status(401).send('Missing signature');

    const expected = 'sha256=' + crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');
    if (!timingSafeEqualBytes(expected, signature)) {
      console.error('Instagram webhook signature verification failed');
      return res.status(401).send('Invalid signature');
    }

    try {
      let payload: any = {};
      try {
        payload = JSON.parse(rawBody.toString('utf8'));
      } catch {
        return res.status(400).send('Invalid JSON');
      }

      const field = payload.field;
      const value = payload.value;
      console.log('[instagram-webhook]', {
        object: payload.object,
        field,
        valueId: value?.id,
        time: value?.time,
      });

      return res.status(200).json({ received: true });
    } catch (error: any) {
      console.error('Instagram webhook error:', error);
      return res.status(500).send('Internal error');
    }
  }

  return res.status(405).send('Method not allowed');
}