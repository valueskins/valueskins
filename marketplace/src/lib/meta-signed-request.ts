// Meta's signed_request, sent to the deauthorize and data-deletion callbacks:
// "<base64url signature>.<base64url JSON payload>", where the signature is
// HMAC-SHA256 of the encoded payload keyed with the Instagram app secret.
// Returns the payload only when the signature checks out.
import crypto from 'crypto';

export interface MetaSignedRequest {
  user_id: string;
  algorithm: string;
  issued_at?: number;
}

const fromBase64Url = (s: string) =>
  Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');

export function parseSignedRequest(signedRequest: unknown, secret: string): MetaSignedRequest | null {
  if (typeof signedRequest !== 'string' || !secret || signedRequest.length > 4096) return null;
  const [encodedSig, encodedPayload, ...rest] = signedRequest.split('.');
  if (!encodedSig || !encodedPayload || rest.length) return null;

  const expected = crypto.createHmac('sha256', secret).update(encodedPayload).digest();
  const actual = fromBase64Url(encodedSig);
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) return null;

  try {
    const payload = JSON.parse(fromBase64Url(encodedPayload).toString('utf8'));
    if (String(payload?.algorithm).toUpperCase() !== 'HMAC-SHA256') return null;
    const userId = String(payload?.user_id ?? '');
    if (!/^\d{1,30}$/.test(userId)) return null;
    return { user_id: userId, algorithm: payload.algorithm, issued_at: payload.issued_at };
  } catch {
    return null;
  }
}
