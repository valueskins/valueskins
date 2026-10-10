// The open-deal feed, with the apply control the app was missing.
//
// Spec: every open deal is visible to every creator, with no niche filtering
// and no negotiation. Applying is one action; if the amount does not suit, the
// creator simply does not apply.
//
// Live updates arrive over the WebSocket to the Render server, which is where
// the connections actually live — a new deal appears without a refresh.
//
// The `since` cursor is still here, on a slow timer, as a safety net for the
// cases a socket cannot cover: the tab was asleep, the connection dropped
// mid-reconnect, or Redis lost an event. It is a backstop, not the mechanism.
import { useCallback, useEffect, useRef, useState } from 'react';
import type { GetServerSidePropsContext } from 'next';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { C, withAlpha } from '@/theme/colors';
import { getFeed, applyToDeal, financials, isOk, type FeedDeal } from '@/lib/deal-api';
import { useWebSocket } from '@/hooks/useWebSocket';
import SetupBanner from '@/components/deal/SetupBanner';
import ResumeHover from '@/components/deal/ResumeHover';

export async function getServerSideProps(ctx: GetServerSidePropsContext) {
  const { getSessionUser } = await import('@/lib/session');
  // One query for the session, the role and the email together.
  const row = await getSessionUser(ctx.req.headers.cookie || '');
  if (!row) {
    return { redirect: { destination: '/auth/login', permanent: false } };
  }
  // No email, no marketplace: it is the contact shown to the other party.
  if (!(row as any)?.email) {
    return { redirect: { destination: '/settings/email', permanent: false } };
  }
  // Brands have their own home. Sending them here showed deals they can never
  // apply to, their own included, each with an Apply button.
  if ((row as any)?.role === 'brand') {
    return { redirect: { destination: '/campaigns', permanent: false } };
  }
  // Creators only. An account with no confirmed role gets neither side's pages.
  if ((row as any)?.role !== 'creator') {
    return { redirect: { destination: '/settings', permanent: false } };
  }
  return { props: {} };
}

// The `since` cursor makes this a cheap request, and it is the only delivery
// path when no socket is connected, so it cannot be minutes long.
const RECONCILE_MS = 30_000;

export default function BrowseDealsPage() {
  const router = useRouter();
  const [deals, setDeals] = useState<FeedDeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [applying, setApplying] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const cursor = useRef<string | null>(null);
  const { connected, subscribe } = useWebSocket();

  const loadInitial = useCallback(async () => {
    const res = await getFeed({ limit: 50 });
    if (!isOk(res)) {
      setError(res.status === 401 ? 'Sign in to browse deals.' : res.error);
      setLoading(false);
      return;
    }
    setDeals(res.data.deals);
    cursor.current = res.data.cursor;
    setError(null);
    setLoading(false);
  }, []);

  // Asks only for what is newer than the newest deal held, then prepends it.
  const reconcile = useCallback(async () => {
    if (!cursor.current) return void loadInitial();
    const res = await getFeed({ since: cursor.current, limit: 50 });
    if (!isOk(res) || res.data.deals.length === 0) return;
    setDeals((prev) => {
      const seen = new Set(prev.map((d) => d.id));
      const fresh = res.data.deals.filter((d) => !seen.has(d.id));
      return fresh.length ? [...fresh, ...prev] : prev;
    });
    if (res.data.cursor) cursor.current = res.data.cursor;
  }, [loadInitial]);

  useEffect(() => { void loadInitial(); }, [loadInitial]);

  // The socket tells us something changed; we then refetch rather than trusting
  // the frame's contents. The server's own list is the authority, and a payload
  // crafted by anything on that channel is not.
  useEffect(() => {
    if (!connected) return;
    const offNew = subscribe('new-deal', () => { void reconcile(); });
    const offMutate = subscribe('mutate', (msg) => {
      if ((msg as any)?.collection === 'deals') void reconcile();
    });
    return () => { offNew(); offMutate(); };
  }, [connected, subscribe, reconcile]);

  // Backstop for a sleeping tab or a dropped socket.
  useEffect(() => {
    const timer = setInterval(() => { void reconcile(); }, RECONCILE_MS);
    return () => clearInterval(timer);
  }, [reconcile]);

  // A reconnect may have missed events while it was down.
  useEffect(() => {
    if (connected) void reconcile();
  }, [connected]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 5000);
    return () => clearTimeout(t);
  }, [notice]);

  async function apply(deal: FeedDeal) {
    setApplying(deal.id);
    const res = await applyToDeal(deal.id);
    setApplying(null);
    if (!isOk(res)) {
      setNotice(res.error);
      return;
    }
    setNotice(`Applied to "${deal.title}".`);
    // Reflect it immediately; the next reconcile confirms from the server.
    setDeals((prev) =>
      prev.map((d) => (d.id === deal.id ? { ...d, already_applied: true } : d))
    );
  }

  const card: React.CSSProperties = {
    background: C.surface,
    border: `1px solid ${C.border}`,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  };

  return (
    <>
      <Head><title>Browse deals · ValueSkins</title></Head>
      <div style={{ minHeight: '100vh', background: C.bg, color: C.text, padding: '20px 16px 48px' }}>
        <div style={{ maxWidth: 640, margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 4 }}>
            <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Open deals</h1>
            <button
              onClick={() => router.push('/deals/mine')}
              style={{
                background: 'none', border: `1px solid ${C.border}`, borderRadius: 8,
                padding: '8px 12px', color: C.text, fontWeight: 600,
                fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap',
              }}
            >
              Your deals
            </button>
          </div>
          <p style={{ fontSize: 12, color: C.outline, margin: '0 0 16px' }}>
            Every open deal, no filtering. The amount is final, apply only if it works for you.
          </p>

          <SetupBanner />

          {notice && (
            <div role="status" style={{ ...card, background: withAlpha(C.accent, 0x14), borderColor: C.accent, fontSize: 12 }}>
              {notice}
            </div>
          )}

          {loading && <div style={{ fontSize: 13, color: C.outline }}>Loading…</div>}

          {error && (
            <div role="alert" style={{ ...card, borderColor: C.error, fontSize: 13 }}>
              {error}
            </div>
          )}

          {!loading && !error && deals.length === 0 && (
            <div style={{ ...card, fontSize: 13, color: C.outline }}>
              No open deals right now. New ones appear here as brands post them.
            </div>
          )}

          {deals.map((deal) => {
            const budget = Number(deal.budget) || 0;
            const F = financials(budget);
            const closed = !deal.applications_open;
            return (
              <div key={deal.id} style={card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 6 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{deal.title}</div>
                    <div style={{ fontSize: 11, color: C.outline }}>
                      <ResumeHover username={deal.brand_username} />
                      {deal.brand_followers ? ` · ${deal.brand_followers.toLocaleString()} followers` : ''}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {/* What the creator actually receives, not the gross budget:
                        showing the budget alone overstates it by the commission. */}
                    <div style={{ fontSize: 14, fontWeight: 700 }}>
                      ₹{F.creatorTotal.toLocaleString('en-IN')}
                    </div>
                    <div style={{ fontSize: 10, color: C.outline }}>you receive</div>
                  </div>
                </div>

                <div style={{ fontSize: 12, color: C.textMuted, lineHeight: 1.5, marginBottom: 10, whiteSpace: 'pre-wrap' }}>
                  {deal.description.length > 260
                    ? `${deal.description.slice(0, 260)}…`
                    : deal.description}
                </div>

                <div style={{ display: 'flex', gap: 14, marginBottom: 12, flexWrap: 'wrap' }}>
                  {[
                    ['Apply by', deal.application_deadline],
                    ['Deliver by', deal.content_upload_deadline],
                  ].map(([k, v]) => (
                    <div key={String(k)}>
                      <div style={{ fontSize: 10, color: C.outline, textTransform: 'uppercase' }}>{k}</div>
                      <div style={{ fontSize: 12 }}>
                        {v ? new Date(String(v)).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '-'}
                      </div>
                    </div>
                  ))}
                  <div>
                    <div style={{ fontSize: 10, color: C.outline, textTransform: 'uppercase' }}>Applicants</div>
                    <div style={{ fontSize: 12 }}>{Number(deal.application_count) || 0}</div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    disabled={deal.already_applied || closed || applying === deal.id}
                    onClick={() => void apply(deal)}
                    style={{
                      flex: 1,
                      background: deal.already_applied || closed ? C.border : C.primary,
                      border: 'none', borderRadius: 8, padding: '10px',
                      color: deal.already_applied || closed ? C.text : C.onPrimary,
                      fontWeight: 600, fontSize: 13,
                      cursor: deal.already_applied || closed ? 'not-allowed' : 'pointer',
                      opacity: deal.already_applied || closed ? 0.6 : 1,
                    }}
                  >
                    {deal.already_applied ? 'Applied'
                      : closed ? 'Applications closed'
                        : applying === deal.id ? 'Applying…'
                          : 'Apply'}
                  </button>
                  <button
                    onClick={() => router.push(`/deals/${deal.id}`)}
                    style={{
                      background: 'none', border: `1px solid ${C.border}`, borderRadius: 8,
                      padding: '10px 14px', color: C.text, fontWeight: 600, fontSize: 13, cursor: 'pointer',
                    }}
                  >
                    Details
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
