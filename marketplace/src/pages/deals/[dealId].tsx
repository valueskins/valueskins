// The deal page, rebuilt for the current workflow.
//
// The previous version of this file drove the escrow model — an offer hero with
// Accept / Counter / Decline and a chat column — and was deleted with the escrow
// engine. This one renders the nine-state workflow instead: whichever party is
// looking sees only the actions that are theirs, and the server decides what
// those are.
import { useCallback, useEffect, useState } from 'react';
import { handleLabel } from '@/lib/handle';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { C } from '@/theme/colors';
import DealWorkflowPanel from '@/components/deal/DealWorkflowPanel';
import { useWebSocket } from '@/hooks/useWebSocket';
import DealCommunications from '@/components/deal/DealCommunications';
import type { WorkflowStatus } from '@/lib/deal-api';

interface DealView {
  id: string;
  title: string;
  description: string;
  budget: number;
  workflow_status: WorkflowStatus;
  application_deadline: string | null;
  content_upload_deadline: string | null;
  deal_deadline: string | null;
  content_link: string;
  feedback: string;
  revision_count: number;
  applications_open: boolean;
  viewer: 'brand' | 'creator';
  is_confirmed_creator: boolean;
  counterpart: { username: string; followers_count: number | null } | null;
}

export default function DealPage() {
  const router = useRouter();
  const dealId = typeof router.query.dealId === 'string' ? router.query.dealId : '';

  const [deal, setDeal] = useState<DealView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { connected, subscribe } = useWebSocket();

  const load = useCallback(async () => {
    if (!dealId) return;
    try {
      const res = await fetch(`/api/deals/${dealId}`, { credentials: 'include' });
      if (res.status === 401) {
        router.replace('/auth/login');
        return;
      }
      if (!res.ok) {
        setError(res.status === 404 ? 'This deal does not exist, or you do not have access to it.' : 'Could not load this deal.');
        return;
      }
      setDeal(await res.json());
      setError(null);
    } catch {
      setError('Could not reach the server.');
    } finally {
      setLoading(false);
    }
  }, [dealId, router]);

  useEffect(() => { void load(); }, [load]);

  // Payment confirmation arrives from the webhook, which lands after the request
  // that started it returned — so the page has to be told, not asked. The socket
  // does that: the server pushes when the deal's row changes and we refetch.
  useEffect(() => {
    if (!connected || !dealId) return;
    const off = subscribe('mutate', (msg) => {
      const m = msg as any;
      if (m?.collection !== 'deals') return;
      // Only this deal; another deal changing is not our business.
      if (m?.key && m.key !== dealId) return;
      void load();
    });
    return () => off();
  }, [connected, subscribe, dealId, load]);

  // Backstop while a payment is in flight. Much slower than before, because the
  // socket now carries it; this only covers a dropped connection at the exact
  // moment the webhook fires.
  useEffect(() => {
    if (!deal) return;
    const awaitingWebhook = deal.workflow_status === 'CONFIRMED'
      || deal.workflow_status === 'COMMISSION_PAID'
      || deal.workflow_status === 'APPROVED_FOR_FINAL_PAYMENT';
    if (!awaitingWebhook) return;
    const id = setInterval(() => { void load(); }, 20000);
    return () => clearInterval(id);
  }, [deal, load]);

  // A reconnect may have missed the transition entirely.
  useEffect(() => {
    if (connected) void load();
  }, [connected]); // eslint-disable-line react-hooks/exhaustive-deps

  const page: React.CSSProperties = {
    minHeight: '100vh',
    background: C.bg,
    color: C.text,
    fontFamily: 'inherit',
    padding: '20px 16px 48px',
  };
  const wrap: React.CSSProperties = { maxWidth: 640, margin: '0 auto' };

  return (
    <>
      <Head><title>{deal ? `${deal.title} · ValueSkins` : 'Deal · ValueSkins'}</title></Head>
      <div style={page}>
        <div style={wrap}>
          <button
            onClick={() => router.push('/deals/browse')}
            style={{
              background: 'none', border: 'none', color: C.outline,
              fontSize: 12, cursor: 'pointer', padding: 0, marginBottom: 14,
            }}
          >
            ← Back to deals
          </button>

          {loading && <div style={{ fontSize: 13, color: C.outline }}>Loading…</div>}

          {error && (
            <div
              role="alert"
              style={{
                background: C.surface, border: `1px solid ${C.error}`,
                borderRadius: 12, padding: 16, fontSize: 13,
              }}
            >
              {error}
            </div>
          )}

          {deal && (
            <>
              <div
                style={{
                  background: C.surface, border: `1px solid ${C.border}`,
                  borderRadius: 12, padding: 16, marginBottom: 12,
                }}
              >
                <div style={{ fontSize: 11, color: C.outline, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>
                  {deal.viewer === 'brand' ? 'Your deal' : 'Brand deal'}
                  {deal.counterpart ? ` · ${handleLabel(deal.counterpart.username)}` : ''}
                </div>
                <div style={{ fontSize: 13, color: C.textMuted, whiteSpace: 'pre-wrap', lineHeight: 1.55 }}>
                  {deal.description}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginTop: 12 }}>
                  {[
                    ['Applications close', deal.application_deadline],
                    ['Content due', deal.content_upload_deadline],
                    ['Deal ends', deal.deal_deadline],
                  ].map(([k, v]) => (
                    <div key={String(k)}>
                      <div style={{ fontSize: 10, color: C.outline, textTransform: 'uppercase' }}>{k}</div>
                      <div style={{ fontSize: 12, color: C.text }}>
                        {v ? new Date(String(v)).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <DealWorkflowPanel
                dealId={deal.id}
                viewer={deal.viewer}
                title={deal.title}
                budget={deal.budget}
                status={deal.workflow_status}
                isConfirmedCreator={deal.is_confirmed_creator}
                contentLink={deal.content_link}
                feedback={deal.feedback}
                revisionCount={deal.revision_count}
                applicationsOpen={deal.applications_open}
                onChanged={load}
              />

              <DealCommunications dealId={deal.id} />
            </>
          )}
        </div>
      </div>
    </>
  );
}
