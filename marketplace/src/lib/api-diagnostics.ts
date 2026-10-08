/**
 * Frontend API Diagnostics
 *
 * PURPOSE
 *   Give the ValueSkins team a way to see, from any browser, exactly what the
 *   frontend is doing when "the backend doesn't work". The single most common
 *   cause of "works on my machine, fails on theirs" is the browser being told to
 *   call `http://localhost:8080` (the developer default) instead of the real
 *   backend — which fails for every visitor except the developer.
 *
 * WHAT THIS PROVIDES
 *   1. `getEffectiveConfig()` — the resolved backend URL / WS URL / mock flag at
 *      RUNTIME in the browser. Prints once to the console on boot so the dev
 *      console always shows what the site is really calling.
 *   2. Ring buffer of recent API calls (method, URL, status/error, duration).
 *      Every failure is also logged with the FULL url so it is greppable.
 *   3. `window.__VALUE_SKINS_DIAG__` — inspectable from any browser console.
 *   4. `<DiagnosticsPanel/>` — visible overlay toggled with `?diag=1` (or
 *      `#diag`) so it can be shown during demos / investor calls.
 *
 * SECURITY
 *   Never logs Authorization headers, tokens, bodies, or cookies. Only method,
 *   URL, status, duration and error message (error messages never contain the
 *   token; `fetch` errors are like "Failed to fetch").
 */

import { BACKEND_CONFIG, DEBUG } from './config';

export interface DiagRequestEntry {
  ts: string;
  method: string;
  url: string;
  ok: boolean;
  status?: number;
  error?: string;
  durationMs: number;
  from: 'browser' | 'server';
}

export interface EffectiveConfig {
  apiUrl: string;
  apiUrlFromDefault: boolean;
  wsUrl: string;
  wsUrlFromDefault: boolean;
  mockApi: boolean;
  environment: string;
  inBrowser: boolean;
  userAgent?: string;
  href?: string;
}

const MAX_ENTRIES = 50;

let ringBuffer: DiagRequestEntry[] = [];
let bootLogged = false;

export function getEffectiveConfig(): EffectiveConfig {
  const inBrowser = typeof window !== 'undefined';
  const apiUrl = BACKEND_CONFIG.API_URL;
  const wsUrl = BACKEND_CONFIG.WS_URL;

  return {
    apiUrl,
    // A default is in play when the env var was never set (localhost fallback).
    apiUrlFromDefault: apiUrl === 'http://localhost:8080',
    wsUrl,
    wsUrlFromDefault: wsUrl === 'ws://localhost:8080/ws',
    mockApi: DEBUG.MOCK_API,
    environment: process.env.NODE_ENV || 'development',
    inBrowser,
    userAgent: inBrowser ? navigator.userAgent : undefined,
    href: inBrowser ? window.location.href : undefined,
  };
}

function logBoot() {
  if (bootLogged || typeof window === 'undefined') return;
  bootLogged = true;

  const cfg = getEffectiveConfig();
  // Deliberately a distinct banner so it is findable in any console.
  console.info(
    `[diag] ValueSkins frontend boot, backend URL: ${cfg.apiUrl}` +
      (cfg.apiUrlFromDefault ? '  ⚠️  USING LOCALHOST DEFAULT (env NOT set!)' : '') +
      ` | ws: ${cfg.wsUrl}` +
      ` | MOCK_API: ${cfg.mockApi}` +
      ` | env: ${cfg.environment}`
  );

  if (cfg.apiUrlFromDefault && cfg.environment === 'production') {
    console.warn(
      '[diag] CRITICAL: production build is calling http://localhost:8080. ' +
        'Set NEXT_PUBLIC_BACKEND_URL (and NEXT_PUBLIC_WS_URL) in the Vercel ' +
        'Production environment, then redeploy. Visitors are hitting their OWN machine.'
    );
  }

  if (cfg.mockApi) {
    console.warn(
      '[diag] MOCK_API is active, API calls are being faked locally. ' +
        'Real backend requests will not appear in server logs.'
    );
  }
}

export function recordRequest(entry: DiagRequestEntry) {
  ringBuffer.push(entry);
  if (ringBuffer.length > MAX_ENTRIES) {
    ringBuffer = ringBuffer.slice(ringBuffer.length - MAX_ENTRIES);
  }

  if (typeof window !== 'undefined') {
    const g = window as unknown as Record<string, unknown>;
    g.__VALUE_SKINS_DIAG__ = { config: getEffectiveConfig(), requests: [...ringBuffer] };
  }
}

export function getRecentRequests(): DiagRequestEntry[] {
  return [...ringBuffer];
}

/**
 * Log a failed/finished request. Always logs failures (regardless of flags);
 * successes only when NEXT_PUBLIC_LOG_API_REQUESTS is true.
 */
export function logApiRequest(entry: DiagRequestEntry) {
  recordRequest(entry);

  if (!entry.ok || DEBUG.LOG_API_REQUESTS) {
    const line =
      `[diag] ${entry.ok ? 'OK  ' : 'FAIL'} ${entry.method} ${entry.url} ` +
      `${entry.status ?? '-'} ${entry.durationMs}ms` +
      (entry.error ? ` | ${entry.error}` : '');
    if (entry.ok) {
      console.info(line);
    } else {
      console.warn(line);
    }
  }
}

/**
 * Returns true when the current page should show the diagnostics panel.
 * Triggered by `?diag=1`, `&diag=1`, or `#diag` in the URL.
 */
export function isDiagMode(): boolean {
  if (typeof window === 'undefined') return false;
  return window.location.hash === '#diag' || /[?&]diag=1/.test(window.location.search);
}

export function exposeDiagGlobals() {
  if (typeof window === 'undefined') return;
  const g = window as unknown as Record<string, unknown>;
  g.__VALUE_SKINS_DIAG__ = {
    config: getEffectiveConfig(),
    requests: getRecentRequests(),
    helpers: {
      refresh: () => (g.__VALUE_SKINS_DIAG__ = { config: getEffectiveConfig(), requests: getRecentRequests() }),
    },
  };
}

export function bootDiagnostics() {
  logBoot();
  exposeDiagGlobals();
}
