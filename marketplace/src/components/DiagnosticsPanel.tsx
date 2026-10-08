import { useEffect, useState, useCallback } from 'react';
import {
  getEffectiveConfig,
  getRecentRequests,
  isDiagMode,
  bootDiagnostics,
  type DiagRequestEntry,
  type EffectiveConfig,
} from '@/lib/api-diagnostics';

interface ProbeResult {
  ok: boolean;
  probedUrl: string;
  reachable: boolean;
  status: number | null;
  error?: string;
  note?: string;
  durationMs?: number;
}

const C = {
  bg: 'rgba(10, 10, 14, 0.94)',
  panel: '#14141b',
  border: '#2a2a35',
  text: '#e8e8ef',
  muted: '#9a9aa8',
  ok: '#3ddc84',
  bad: '#ff5c5c',
  warn: '#ffb020',
  mono: "'SF Mono', 'Menlo', monospace",
};

function Row({ label, value, tone }: { label: string; value: string; tone?: 'ok' | 'bad' | 'warn' }) {
  const color = tone === 'ok' ? C.ok : tone === 'bad' ? C.bad : tone === 'warn' ? C.warn : C.text;
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, fontFamily: C.mono, fontSize: 11 }}>
      <span style={{ color: C.muted }}>{label}</span>
      <span style={{ color, wordBreak: 'break-all', textAlign: 'right', maxWidth: '70%' }}>{value}</span>
    </div>
  );
}

function RequestList({ requests }: { requests: DiagRequestEntry[] }) {
  if (requests.length === 0) {
    return <div style={{ color: C.muted, fontSize: 11 }}>No API calls yet.</div>;
  }
  return (
    <div style={{ maxHeight: 180, overflowY: 'auto' }}>
      {requests.map((r, i) => (
        <div
          key={i}
          style={{
            fontFamily: C.mono,
            fontSize: 10,
            color: r.ok ? C.muted : C.bad,
            padding: '2px 0',
            borderTop: `1px solid ${C.border}`,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {r.ok ? 'OK  ' : 'FAIL'} {r.method.padEnd(4)} {r.url} → {r.status ?? r.error ?? '?'} ({r.durationMs}ms)
        </div>
      ))}
    </div>
  );
}

export default function DiagnosticsPanel() {
  const [visible, setVisible] = useState(false);
  const [requests, setRequests] = useState<DiagRequestEntry[]>([]);
  const [config, setConfig] = useState<EffectiveConfig | null>(null);
  const [probe, setProbe] = useState<ProbeResult | null>(null);
  const [probeLoading, setProbeLoading] = useState(false);

  useEffect(() => {
    bootDiagnostics();
    setConfig(getEffectiveConfig());
    setRequests(getRecentRequests());

    const refresh = () => {
      setRequests(getRecentRequests());
      setConfig(getEffectiveConfig());
    };
    const interval = setInterval(refresh, 1500);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setVisible(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      clearInterval(interval);
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  useEffect(() => {
    if (isDiagMode()) setVisible(true);
  }, []);

  const runProbe = useCallback(async () => {
    setProbeLoading(true);
    setProbe(null);
    try {
      const res = await fetch('/api/backend-health', { headers: { Accept: 'application/json' } });
      const data = (await res.json()) as ProbeResult;
      setProbe(data);
    } catch (e) {
      setProbe({ ok: false, probedUrl: '', reachable: false, status: null, error: String(e) });
    } finally {
      setProbeLoading(false);
    }
  }, []);

  if (!visible) {
    return (
      <button
        onClick={() => setVisible(true)}
        style={{
          position: 'fixed',
          bottom: 12,
          right: 12,
          zIndex: 2147483000,
          background: C.panel,
          color: C.muted,
          border: `1px solid ${C.border}`,
          borderRadius: 6,
          fontSize: 10,
          fontFamily: C.mono,
          padding: '4px 8px',
          cursor: 'pointer',
        }}
        title="Open diagnostics panel (also ?diag=1 in URL)"
      >
        diag
      </button>
    );
  }

  const cfgWarnings: string[] = [];
  if (config?.apiUrlFromDefault) {
    cfgWarnings.push(
      'API URL is the localhost default, the build was made WITHOUT NEXT_PUBLIC_BACKEND_URL. Visitors are calling THEIR OWN machine. Set it on Vercel and redeploy.'
    );
  }
  if (config?.mockApi) {
    cfgWarnings.push('MOCK_API is active, calls are faked in the browser; real backend requests are not being made.');
  }
  if (config?.environment === 'production' && config?.apiUrlFromDefault) {
    cfgWarnings.push('PRODUCTION build hitting localhost, this is the "backend not working for the investor" scenario.');
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 12,
        right: 12,
        zIndex: 2147483000,
        width: 460,
        maxWidth: '94vw',
        maxHeight: '80vh',
        overflowY: 'auto',
        background: C.bg,
        border: `1px solid ${C.border}`,
        borderRadius: 10,
        padding: 14,
        color: C.text,
        fontSize: 12,
        boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <strong style={{ fontSize: 13 }}>ValueSkins Diagnostics</strong>
        <button
          onClick={() => setVisible(false)}
          style={{
            background: 'transparent',
            color: C.muted,
            border: `1px solid ${C.border}`,
            borderRadius: 4,
            fontSize: 10,
            cursor: 'pointer',
            padding: '2px 6px',
            fontFamily: C.mono,
          }}
        >
          close (Esc)
        </button>
      </div>

      {cfgWarnings.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          {cfgWarnings.map((w, i) => (
            <div
              key={i}
              style={{
                background: 'rgba(255,176,32,0.12)',
                border: `1px solid ${C.warn}`,
                borderRadius: 6,
                padding: 8,
                color: C.warn,
                fontSize: 11,
                marginBottom: 6,
              }}
            >
              ⚠ {w}
            </div>
          ))}
        </div>
      )}

      {config && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 12 }}>
          <Row label="API URL" value={config.apiUrl} tone={config.apiUrlFromDefault ? 'bad' : 'ok'} />
          <Row label="WS URL" value={config.wsUrl} tone={config.wsUrlFromDefault ? 'warn' : 'ok'} />
          <Row label="MOCK_API" value={String(config.mockApi)} tone={config.mockApi ? 'warn' : 'ok'} />
          <Row label="env" value={config.environment} />
          <Row label="page" value={config.href ?? '-'} />
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button
          onClick={runProbe}
          disabled={probeLoading}
          style={{
            background: 'rgba(99,102,241,0.2)',
            color: C.text,
            border: '1px solid var(--c-accent)',
            borderRadius: 6,
            fontSize: 11,
            padding: '6px 10px',
            cursor: 'pointer',
          }}
        >
          {probeLoading ? 'Probing…' : 'Probe backend (from server)'}
        </button>
        <a
          href="/api/backend-health"
          target="_blank"
          rel="noopener noreferrer"
          style={{ alignSelf: 'center', color: 'var(--c-accent)', fontSize: 11 }}
        >
          open raw JSON ↗
        </a>
      </div>

      {probe && (
        <div
          style={{
            marginBottom: 12,
            padding: 8,
            borderRadius: 6,
            border: `1px solid ${probe.ok ? C.ok : C.bad}`,
            background: probe.ok ? 'rgba(61,220,132,0.08)' : 'rgba(255,92,92,0.08)',
            fontSize: 11,
          }}
        >
          <div style={{ fontFamily: C.mono, marginBottom: 4 }}>
            <span style={{ color: probe.ok ? C.ok : C.bad }}>{probe.ok ? 'HEALTHY' : 'UNREACHABLE'}</span>
            {', '}
            <span style={{ color: C.muted }}>{probe.probedUrl}</span>
            {probe.status != null && <span> → HTTP {probe.status}</span>}
            {probe.durationMs != null && <span> ({probe.durationMs}ms)</span>}
          </div>
          {probe.error && <div style={{ color: C.bad, fontFamily: C.mono }}>{probe.error}</div>}
          {probe.note && <div style={{ color: C.muted, marginTop: 4 }}>{probe.note}</div>}
        </div>
      )}

      <div style={{ marginBottom: 6, color: C.muted, fontSize: 11 }}>Recent API calls:</div>
      <RequestList requests={requests} />

      <div style={{ marginTop: 10, color: C.muted, fontSize: 10 }}>
        Every API call is logged to the browser console with a <span style={{ fontFamily: C.mono }}>[diag]</span> prefix.
        The server logs every request that reaches it, if calls never appear there, the browser is not hitting the backend.
      </div>
    </div>
  );
}
