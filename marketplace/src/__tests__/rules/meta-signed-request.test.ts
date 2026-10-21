import crypto from 'crypto';
import { parseSignedRequest } from '@/lib/meta-signed-request';

const SECRET = 'test-secret';
const b64url = (b: Buffer) => b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const sign = (payload: object, secret = SECRET) => {
  const encoded = b64url(Buffer.from(JSON.stringify(payload)));
  return `${b64url(crypto.createHmac('sha256', secret).update(encoded).digest())}.${encoded}`;
};

describe('parseSignedRequest', () => {
  it('returns the payload of a request signed with the app secret', () => {
    const parsed = parseSignedRequest(sign({ algorithm: 'HMAC-SHA256', user_id: '17841400000000', issued_at: 1 }), SECRET);
    expect(parsed?.user_id).toBe('17841400000000');
  });

  it('refuses a request signed with another secret', () => {
    expect(parseSignedRequest(sign({ algorithm: 'HMAC-SHA256', user_id: '1' }, 'other'), SECRET)).toBeNull();
  });

  it('refuses a tampered payload', () => {
    const [sig] = sign({ algorithm: 'HMAC-SHA256', user_id: '1' }).split('.');
    const forged = b64url(Buffer.from(JSON.stringify({ algorithm: 'HMAC-SHA256', user_id: '2' })));
    expect(parseSignedRequest(`${sig}.${forged}`, SECRET)).toBeNull();
  });

  it('refuses a missing secret, malformed input and non-numeric ids', () => {
    expect(parseSignedRequest(sign({ algorithm: 'HMAC-SHA256', user_id: '1' }), '')).toBeNull();
    expect(parseSignedRequest('not-a-request', SECRET)).toBeNull();
    expect(parseSignedRequest(undefined, SECRET)).toBeNull();
    expect(parseSignedRequest(sign({ algorithm: 'HMAC-SHA256', user_id: "1' OR 1=1" }), SECRET)).toBeNull();
  });
});
