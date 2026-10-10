import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // Security headers
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set(
    'Strict-Transport-Security',
    'max-age=31536000; includeSubDomains; preload'
  );
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=()'
  );

  // Backend origins for connect-src, derived from the SAME env vars the client
  // reads. This was previously a hardcoded wss://valueskins-api.render.com — a
  // host that no longer exists — so the CSP silently blocked every WebSocket and
  // API call to the real backend. Deriving it means the allowlist cannot drift
  // away from what the app actually connects to.
  const backendOrigins = [
    process.env.NEXT_PUBLIC_BACKEND_URL,
    process.env.NEXT_PUBLIC_WS_URL,
  ]
    .filter((u): u is string => Boolean(u))
    .map((u) => {
      try {
        return new URL(u).origin; // strips the /ws path; connect-src wants origins
      } catch {
        return '';
      }
    })
    .filter(Boolean);

  // Error reports go to the host named in the Sentry DSN. Derived from the DSN
  // so that it is allowed exactly when reporting is switched on.
  let sentryOrigin = '';
  try {
    if (process.env.NEXT_PUBLIC_SENTRY_DSN) sentryOrigin = new URL(process.env.NEXT_PUBLIC_SENTRY_DSN).origin;
  } catch {
    sentryOrigin = '';
  }

  // The app talks to the same host over both https (REST) and wss (realtime),
  // so allow both schemes for every backend host.
  const connectSrc = Array.from(
    new Set(
      backendOrigins.flatMap((origin) => {
        const host = origin.replace(/^[a-z]+:\/\//, '');
        return [`https://${host}`, `wss://${host}`];
      })
    )
  ).join(' ');

  // CSP - Content Security Policy (prevent XSS, clickjacking, etc.)
  response.headers.set(
    'Content-Security-Policy',
    // font-src / style-src carry the Google Fonts origins because the brand
    // typeface is loaded from there (_document links fonts.googleapis.com,
    // which serves woff2 from fonts.gstatic.com). Without them the CSP blocked
    // every Inter file and the whole product silently fell back to Helvetica —
    // _global-conventions.md G2 makes Inter the only typeface in the product,
    // so this was breaking brand typography on every page. Both origins are
    // Google-operated and serve static font assets only.
    "default-src 'self'; " +
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://accounts.google.com https://checkout.razorpay.com https://www.instagram.com; " +
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
      "img-src 'self' data: https:; " +
      "font-src 'self' data: https://fonts.gstatic.com; " +
      `connect-src 'self' https://accounts.google.com https://api.razorpay.com https://api.instagram.com https://graph.instagram.com https://www.instagram.com${connectSrc ? ` ${connectSrc}` : ''}${sentryOrigin ? ` ${sentryOrigin}` : ''}; ` +
      // www.google.com is needed for the Maps embed on /run-club: without it the
      // CSP blocks the iframe and the map renders as an empty box.
      'frame-src https://accounts.google.com https://api.razorpay.com https://www.instagram.com https://www.google.com'
  );

  // Prevent MIME type sniffing
  response.headers.set('X-Content-Type-Options', 'nosniff');

  // Prevent clickjacking
  response.headers.set('X-Frame-Options', 'SAMEORIGIN');

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
