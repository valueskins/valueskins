// The creator's applications and deals.
//
// Fixes a dead end: a creator who applied had no way back to the deal. The
// button greyed out to "Applied" and the deal was then reachable only by a URL
// they no longer had — and with SMTP unconfigured, nothing told them when a
// brand confirmed them either.
import { useCallback, useEffect, useState } from 'react';
import type { GetServerSidePropsContext } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { C, withAlpha } from '@/theme/colors';
import { getMyApplications, nextAction, financials, isOk, type WorkflowStatus } from '@/lib/deal-api';
import { useWebSocket } from '@/hooks/useWebSocket';
import SetupBanner from '@/components/deal/SetupBanner';

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

interface Row {
  id: string;
  deal_id: string;
  status: 'APPLIED' | 'CONFIRMED' | 'REJECTED';
  created_at: string;
  title: string;
  amount: string;
  workflow_status: WorkflowStatus;
  application_deadline: string | null;
}

const APPLICATION_LABEL: Record<Row['status'], string> = {
  APPLIED: 'Waiting on the brand',
  CONFIRMED: 'You were picked',
  REJECTED: 'Not this time',
};

export default function MyDealsPage() {
  const router = useRouter();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { connected, subscribe } = useWebSocket();

  const load = useCallback(async () => {
    const res = await getMyApplications();
    if (!isOk(res)) {
      if (res.status === 401) { router.replace('/auth/login'); return; }
      setError(res.error);
      return;
    }
    setRows((res.data.applications || []) as Row[]);
    setError(null);
  }, [router]);

  useEffect(() => { void load(); }, [load]);

  // The whole point of this page is finding out you were picked, so it has to
  // update without a refresh.
  useEffect(() => {
    if (!connected) return;
    const off = subscribe('mutate', (msg) => {
      if ((msg as any)?.collection === 'deals') void load();
    });
    return () => off();
  }, [connected, subscribe, load]);

  useEffect(() => { if (connected) void load(); }, [connected]); // eslint-disable-line react-hooks/exhaustive-deps

  // The socket is an accelerator, not the mechanism: without this the page
  // never learned the creator had been picked unless they reloaded it.
  useEffect(() => {
    const id = setInterval(() => { void load(); }, 20000);
    return () => clearInterval(id);
  }, [load]);

  const card: React.CSSProperties = {
    background: C.surface, border: `1px solid ${C.border}`,
    borderRadius: 12, padding: 16, marginBottom: 10,
  };

  // Deals needing the creator's attention come first: a confirmed deal waiting
  // on an upload matters far more than one that was passed over.
  const sorted = rows
    ? [...rows].sort((a, b) => {
        const score = (r: Row) => {
          if (r.status === 'REJECTED') return 2;
          return nextAction(r.workflow_status).actor === 'creator' ? 0 : 1;
        };
        return score(a) - score(b);
      })
    : null;

  return (
    <>
      <Head><title>Your deals · ValueSkins</title></Head>
      <div style={{ minHeight: '100vh', background: C.bg, color: C.text, padding: '24px 16px 48px' }}>
        <div style={{ maxWidth: 640, margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Your deals</h1>
              <p style={{ fontSize: 12, color: C.outline, margin: '2px 0 0' }}>
                Everything you have applied to.
              </p>
            </div>
            <button
              onClick={() => router.push('/deals/browse')}
              style={{
                background: C.primary, border: 'none', borderRadius: 8,
                padding: '10px 14px', color: C.onPrimary, fontWeight: 600,
                fontSize: 13, cursor: 'pointer',
              }}
            >
              Browse deals
            </button>
          </div>

          <SetupBanner />

          {!rows && !error && <div style={{ fontSize: 13, color: C.outline }}>Loading…</div>}

          {error && (
            <div role="alert" style={{ ...card, borderColor: C.error, fontSize: 13 }}>{error}</div>
          )}

          {sorted?.length === 0 && (
            <div style={{ ...card, fontSize: 13, color: C.outline }}>
              You have not applied to anything yet. Open deals are on the browse page.
            </div>
          )}

          {sorted?.map((r) => {
            const budget = Number(r.amount) || 0;
            const F = financials(budget);
            const action = nextAction(r.workflow_status);
            const yourMove = r.status === 'CONFIRMED' && action.actor === 'creator';
            const dim = r.status === 'REJECTED';
            return (
              <Link key={r.id} href={`/deals/${r.deal_id}`} style={{ textDecoration: 'none' }}>
                <div style={{ ...card, cursor: 'pointer', opacity: dim ? 0.6 : 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{r.title}</div>
                      <div style={{ fontSize: 11, color: C.outline, marginTop: 2 }}>
                        {APPLICATION_LABEL[r.status]}
                        {r.status === 'CONFIRMED' ? ` · ${action.label.toLowerCase()}` : ''}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>
                        ₹{F.creatorTotal.toLocaleString('en-IN')}
                      </div>
                      <div style={{ fontSize: 10, color: C.outline }}>you receive</div>
                    </div>
                  </div>
                  {yourMove && (
                    <div
                      style={{
                        marginTop: 10, fontSize: 11, color: C.text,
                        background: withAlpha(C.primary, 0x1e),
                        border: `1px solid ${C.primary}`,
                        borderRadius: 6, padding: '5px 9px', display: 'inline-block',
                      }}
                    >
                      Your move: {action.label.toLowerCase()}
                    </div>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </>
  );
}
