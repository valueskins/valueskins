// Past deals, for both roles: every deal this account was part of that has
// finished, with its report available to download at any time.
//
// A brand sees the deals it posted; a creator sees the deals it was confirmed
// on. The report (the ADP) is generated on request from the deal's records, so
// it is the same document whenever it is downloaded.
import type { GetServerSidePropsContext } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import { C, withAlpha } from '@/theme/colors';
import { financials } from '@/lib/deal-api';
import { handleLabel } from '@/lib/handle';
import MarketTabs from '@/components/deal/MarketTabs';

interface PastDeal {
  id: string;
  title: string;
  amount: string;
  workflow_status: 'COMPLETED' | 'CANCELLED';
  finished_at: string | null;
  counterpart_username: string | null;
}

export async function getServerSideProps(ctx: GetServerSidePropsContext) {
  const { getSessionUser } = await import('@/lib/session');
  const { query } = await import('@/lib/db');
  const me = await getSessionUser(ctx.req.headers.cookie || '');
  if (!me) {
    return { redirect: { destination: '/auth/login', permanent: false } };
  }
  if (me.role !== 'brand' && me.role !== 'creator') {
    return { redirect: { destination: '/settings', permanent: false } };
  }

  // Each role is matched on its own column, so nobody is ever shown a deal
  // they were not a party to.
  const mine = me.role === 'brand' ? 'd.brand_id' : 'd.creator_id';
  const other = me.role === 'brand' ? 'd.creator_id' : 'd.brand_id';
  try {
    const r = await query(
      `SELECT d.id, d.title, d.amount, d.workflow_status,
              COALESCE(d.cancelled_at, d.updated_at) AS finished_at,
              u.username AS counterpart_username
         FROM deals d
         LEFT JOIN users u ON u.id = ${other}
        WHERE ${mine} = $1
          AND d.workflow_status IN ('COMPLETED', 'CANCELLED')
        ORDER BY COALESCE(d.cancelled_at, d.updated_at) DESC NULLS LAST
        LIMIT 200`,
      [me.id]
    );
    return { props: { role: me.role, deals: JSON.parse(JSON.stringify(r.rows || [])) } };
  } catch (err) {
    console.error('[deals/past] list failed', (err as Error).message);
    return { props: { role: me.role, deals: [], failed: true } };
  }
}

export default function PastDealsPage({
  role,
  deals = [],
  failed = false,
}: {
  role: 'brand' | 'creator';
  deals: PastDeal[];
  failed?: boolean;
}) {
  const card: React.CSSProperties = {
    background: C.surface, border: `1px solid ${C.border}`,
    borderRadius: 12, padding: 28, marginBottom: 20,
  };
  const when = (v: string | null) =>
    v ? new Date(v).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '';

  return (
    <>
      <Head><title>Past deals · ValueSkins</title></Head>
      <div style={{ minHeight: '100vh', background: C.bg, color: C.text, padding: '72px 24px 140px' }}>
        <div style={{ maxWidth: 780, margin: '0 auto' }}>
          <MarketTabs active="past" role={role} />

          <h1 style={{ fontSize: 26, fontWeight: 700, margin: '0 0 4px' }}>Past deals</h1>
          <p style={{ fontSize: 14, color: C.outline, margin: '0 0 32px' }}>
            Finished deals stay here. You can download the report for a completed deal whenever
            you need it.
          </p>

          {failed && (
            <div role="alert" style={{ ...card, borderColor: C.error, fontSize: 15 }}>
              Could not load your past deals. Please refresh the page.
            </div>
          )}

          {!failed && deals.length === 0 && (
            <div style={{ ...card, fontSize: 15, color: C.outline }}>
              No past deals yet. A deal moves here once it is completed or cancelled.
            </div>
          )}

          {deals.map((d) => {
            const budget = Number(d.amount) || 0;
            const completed = d.workflow_status === 'COMPLETED';
            // A creator sees what they were paid; a brand sees what it spent.
            const figure = role === 'creator' ? financials(budget).creatorTotal : budget;
            return (
              <div key={d.id} style={card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 6 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 16, fontWeight: 700 }}>{d.title}</div>
                    <div style={{ fontSize: 13, color: C.outline }}>
                      {d.counterpart_username ? `${handleLabel(d.counterpart_username)} · ` : ''}
                      {completed ? 'Completed' : 'Cancelled'}
                      {d.finished_at ? ` · ${when(d.finished_at)}` : ''}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <div style={{ fontSize: 16, fontWeight: 700 }}>₹{figure.toLocaleString('en-IN')}</div>
                    <div style={{ fontSize: 12, color: C.outline }}>
                      {role === 'creator' ? 'you received' : 'deal amount'}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                  {completed && (
                    // A plain link to the file: the server sends it as a
                    // download, and it works however many times it is used.
                    <a
                      href={`/api/deals/${d.id}/download-adp`}
                      style={{
                        background: C.primary, color: C.onPrimary, borderRadius: 8,
                        padding: '13px 26px', fontSize: 14, fontWeight: 700, textDecoration: 'none',
                      }}
                    >
                      Download report (PDF)
                    </a>
                  )}
                  <Link
                    href={`/deals/${d.id}`}
                    style={{
                      border: `1px solid ${C.border}`, color: C.text, borderRadius: 8,
                      padding: '13px 26px', fontSize: 14, fontWeight: 600, textDecoration: 'none',
                      background: completed ? 'transparent' : withAlpha(C.primary, 0x08),
                    }}
                  >
                    View deal
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
