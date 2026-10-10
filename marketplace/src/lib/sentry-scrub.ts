// Removes personal data from an error report before it leaves for Sentry.
//
// Error text is written for a developer and can carry whatever was in hand
// when it failed: an email address, a UPI ID, a session id. None of that is
// needed to fix a bug, and sending it to a third party would break our own
// rule that logs hold no personal data. Everything is scrubbed here, once, for
// both the browser and the server.

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
// name@bank, which the email pattern misses because there is no dot.
const UPI = /\b[A-Za-z0-9._-]{2,64}@[A-Za-z]{2,32}\b/g;
const SESSION = /valueskins_session=[^;\s"']+/g;
const LONG_HEX = /\b[0-9a-f]{32,}\b/gi;

export function scrubText(value: string): string {
  return value
    .replace(SESSION, 'valueskins_session=[removed]')
    .replace(EMAIL, '[email]')
    .replace(UPI, '[upi]')
    .replace(LONG_HEX, '[token]');
}

function scrubDeep(value: unknown, depth = 0): unknown {
  if (depth > 6) return '[truncated]';
  if (typeof value === 'string') return scrubText(value);
  if (Array.isArray(value)) return value.map((v) => scrubDeep(v, depth + 1));
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      // Keys that only ever hold something private are dropped outright.
      if (/cookie|authorization|password|secret|token|email|upi|vpa|phone/i.test(k)) {
        out[k] = '[removed]';
      } else {
        out[k] = scrubDeep(v, depth + 1);
      }
    }
    return out;
  }
  return value;
}

/** Sentry `beforeSend`: returns the event with personal data removed. */
export function scrubEvent<T>(event: T): T {
  const e = event as any;
  if (!e || typeof e !== 'object') return event;

  // Never the visitor's identity or address, and never what they sent us.
  delete e.user;
  if (e.request) {
    delete e.request.cookies;
    delete e.request.data;
    delete e.request.query_string;
    if (e.request.headers) {
      for (const h of Object.keys(e.request.headers)) {
        if (/cookie|authorization|x-forwarded-for|x-real-ip/i.test(h)) delete e.request.headers[h];
      }
    }
    // The path is useful; anything after "?" can hold a token.
    if (typeof e.request.url === 'string') e.request.url = e.request.url.split('?')[0];
  }

  if (typeof e.message === 'string') e.message = scrubText(e.message);
  if (e.logentry?.message) e.logentry.message = scrubText(String(e.logentry.message));
  for (const ex of e.exception?.values || []) {
    if (typeof ex.value === 'string') ex.value = scrubText(ex.value);
  }
  for (const b of e.breadcrumbs || []) {
    if (typeof b.message === 'string') b.message = scrubText(b.message);
    if (b.data) b.data = scrubDeep(b.data);
  }
  if (e.extra) e.extra = scrubDeep(e.extra);
  if (e.contexts) e.contexts = scrubDeep(e.contexts);
  return event;
}
