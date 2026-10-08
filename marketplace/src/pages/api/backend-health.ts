/**
 * Server-side backend health probe.
 *
 * PURPOSE
 *   Runs ON the Next.js/Vercel server (not in the visitor's browser) and asks
 *   the backend for its health. This splits the "backend not working" complaint
 *   into two different problems:
 *
 *     A) Browser is calling the wrong URL (e.g. http://localhost:8080 baked
 *        into the build)  →  this probe still succeeds because the server uses
 *        the production backend URL directly.
 *
 *     B) The deployed backend itself is down / unreachable  →  this probe
 *        returns reachable:false, error:... and shows WHY.
 *
 * USAGE
 *   GET /api/backend-health                  → probes the default production URL
 *   GET /api/backend-health?url=<https://…> → probes a specific URL (for testing)
 *
 * SECURITY (SSRF guard per CLAUDE.md)
 *   - GET only.
 *   - http/https schemes only.
 *   - Blocks loopback/private/link-local hostnames so the public endpoint can
 *     not be used to probe internal infrastructure.
 *   - 5s timeout, no redirects, response body capped.
 */

import { NextApiRequest, NextApiResponse } from 'next';

// valueskins-api.onrender.com does not exist — probing it reported the backend
// as down (HTTP 404) while it was actually healthy. The live service is
// valueskins-web-service, and its liveness path is /health/live.
const PRODUCTION_BACKEND_HEALTH = 'https://valueskins-web-service.onrender.com/health/live';
const TIMEOUT_MS = 5000;
const MAX_BODY_BYTES = 4096;

function isPrivateHostname(host: string): boolean {
  const h = host.toLowerCase().replace(/\.$/, '');

  // loopback / local
  if (h === 'localhost' || h.endsWith('.localhost')) return true;
  if (h === 'local' || h.endsWith('.local') || h.endsWith('.internal')) return true;

  // IPv6 loopback
  if (h === '::1' || h === '[::1]') return true;

  // IPv4 literals
  const ipv4 = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const [a, b, c, d] = ipv4.slice(1).map(Number);
    if (a === 127) return true; // 127.0.0.0/8
    if (a === 10) return true; // 10.0.0.0/8
    if (a === 169 && b === 254) return true; // link-local
    if (a === 192 && b === 168) return true; // 192.168.0.0/16
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
    if (a === 0 || a >= 224) return true; // 0.0.0.0/8, multicast/reserved
  }
  return false;
}

function sanitizeProbeUrl(raw: string | undefined): string | null {
  if (!raw) return PRODUCTION_BACKEND_HEALTH;
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
  if (isPrivateHostname(u.hostname)) return null;
  return u.toString();
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const rawUrl = typeof req.query.url === 'string' ? req.query.url : undefined;
  const probeUrl = sanitizeProbeUrl(rawUrl);
  const startedAt = Date.now();

  if (!probeUrl) {
    return res.status(400).json({ error: 'Invalid url, must be http(s) to a public host' });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(probeUrl, {
      method: 'GET',
      headers: {
        Accept: 'application/json, text/plain',
        'User-Agent': 'valueskins-backend-health-probe/1.0',
      },
      redirect: 'manual',
      signal: controller.signal,
    });

    const bodyBuffer = Buffer.from(await response.arrayBuffer()).subarray(0, MAX_BODY_BYTES);
    const text = bodyBuffer.toString('utf8');
    let body: unknown = null;
    try {
      body = JSON.parse(text);
    } catch {
      body = text.slice(0, 500);
    }

    const durationMs = Date.now() - startedAt;

    const note =
      response.ok
        ? 'Backend is reachable and healthy from the server (Vercel) network. ' +
          'If it still fails in a visitor browser, the browser is calling a different URL, check NEXT_PUBLIC_BACKEND_URL.'
        : `Backend responded but with HTTP ${response.status}.`;

    return res.status(200).json({
      ok: response.ok,
      probedUrl: probeUrl,
      reachable: true,
      status: response.status,
      body,
      durationMs,
      from: 'vercel-server',
      timestamp: new Date().toISOString(),
      note,
    });
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    const message = error instanceof Error ? error.message : 'Unknown error';

    return res.status(200).json({
      ok: false,
      probedUrl: probeUrl,
      reachable: false,
      status: null,
      error: message,
      durationMs,
      from: 'vercel-server',
      timestamp: new Date().toISOString(),
      note:
        'Backend NOT reachable from the server (Vercel) network. ' +
        'Either the Render service is down/paused, the URL is wrong, or DNS/TLS is failing. ' +
        'Check the Render dashboard (valueskins-api) and the logs there.',
    });
  } finally {
    clearTimeout(timer);
  }
}
