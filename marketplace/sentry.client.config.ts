import * as Sentry from '@sentry/nextjs';
import { scrubEvent } from './src/lib/sentry-scrub';

// Browser error reporting. Imported once from pages/_app.
//
// Errors only: no tracing and no session replay. Those are separate quotas and
// a much larger download, and replay would record people's screens. The DSN is
// not a secret (it only allows sending reports), which is why it can be public.
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN || '';

Sentry.init({
  dsn,
  enabled: !!dsn && process.env.NODE_ENV === 'production',
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV || process.env.NODE_ENV || 'development',
  tracesSampleRate: 0,
  sendDefaultPii: false,
  // Browser extensions and network blips are not our bugs.
  ignoreErrors: [
    'ResizeObserver loop limit exceeded',
    'ResizeObserver loop completed with undelivered notifications',
    'Non-Error promise rejection captured',
    /^Network Error$/i,
    /Load failed/i,
    /Failed to fetch/i,
  ],
  denyUrls: [/^chrome-extension:\/\//i, /^moz-extension:\/\//i, /^safari-(web-)?extension:\/\//i],
  beforeSend: (event) => scrubEvent(event),
});
