import * as Sentry from '@sentry/nextjs';
import { scrubEvent } from './src/lib/sentry-scrub';

// Server-side error reporting. Loaded once per server process by
// src/instrumentation.ts.
//
// Errors only. Tracing, profiling and replays are off: they are separate
// quotas, and the aim here is to hear about failures while staying inside
// Sentry's free plan (5,000 errors a month).
const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN || '';

Sentry.init({
  dsn,
  enabled: !!dsn && process.env.NODE_ENV === 'production',
  environment: process.env.VERCEL_ENV || process.env.NODE_ENV || 'development',
  tracesSampleRate: 0,
  sendDefaultPii: false,
  integrations: [
    // Most API routes catch their own errors and write console.error rather
    // than throwing, so without this the failures that matter most would never
    // be reported. Warnings are left out to keep the volume down.
    Sentry.captureConsoleIntegration({ levels: ['error'] }),
  ],
  beforeSend: (event) => scrubEvent(event),
});
