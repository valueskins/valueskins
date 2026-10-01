// The brand's deals.
//
// Replaces a page that listed rows from the old `campaigns` table through
// `CampaignList`, which drove the bidding flow and was deleted with it. A brand's
// work now lives in `deals`, keyed by workflow_status, so this lists that and
// says whose move each one is waiting on.
//
// It reads the database in getServerSideProps rather than through an endpoint:
// the session is already resolved here and the list is the first thing a brand
// sees, so a second round trip from the browser would only add latency.
// MarketplaceLayout is deliberately not used — it is a fixed 470px shell with an
// undefined background token.
import type { GetServerSidePropsContext } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { getSessionUserId } from '@/lib/session';
import { query } from '@/lib/db';
import { C, withAlpha } from '@/theme/colors';
import { nextAction, financials, type WorkflowStatus } from '@/lib/deal-api';

interface DealRow {
  id: string;
  title: string;
  amount: string;
  workflow_status: WorkflowStatus;
  application_deadline: string | null;
  created_at: string;
  application_count: number;
  creator_username: string | null;
}

export async function getServerSideProps(ctx: GetServerSidePropsContext) {
  const cookie = ctx.req.headers.cookie || '';
  const userId = await getSessionUserId(cookie);
  if (!userId) {
    return { redirect: { destination: '/auth/login', permanent: false } };
  }

  try {
    const r = await query(
      `SELECT d.id, d.title, d.amount, d.workflow_status,
              d.application_deadline, d.created_at,
              (SELECT COUNT(*)::int FROM applications a WHERE a.deal_id = d.id) AS application_count,
              u.username AS creator_username
         FROM deals d
         LEFT JOIN users u ON u.id = d.creator_id
        WHERE d.brand_id = $1
        ORDER BY d.created_at DESC
        LIMIT 100`,
      [userId]
    );
    // Dates do not survive Next's props serialisation, hence the round trip.
    return { props: { deals: JSON.parse(JSON.stringify(r.rows || [])) } };
  } catch (err) {
    // An empty list beats a 500 here: the page still offers "post a deal".
    console.error('[campaigns] list failed', (err as Error).message);
    return { props: { deals: [] } };
  }
}

const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Draft',
  OPEN: 'Open for applications',
  CONFIRMED: 'Creator confirmed',
  COMMISSION_PAID: 'Commission paid',
  ADVANCE_PAID: 'Advance paid',
  CONTENT_UPLOADED: 'Awaiting your review',
  REVISION_REQUESTED: 'Revision requested',
  APPROVED_FOR_FINAL_PAYMENT: 'Approved',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

export default function BrandDealsPage({ deals = [] }: { deals: DealRow[] }) {
  const router = useRouter();

  const card: React.CSSProperties = {
    background: C.surface,
    border: `1px solid ${C.border}`,
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
  };

  return (
    <>
      <Head><title>Your deals — ValueSkins</title></Head>
      <div style={{ minHeight: '100vh', background: C.bg, color: C.text, padding: '24px 16px 48px' }}>
        <div style={{ maxWidth: 640, margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Your deals</h1>
              <p style={{ fontSize: 12, color: C.outline, margin: '2px 0 0' }}>{deals.length} total</p>
            </div>
            <button
              onClick={() => router.push('/campaigns/create')}
              style={{
                background: C.primary, border: 'none', borderRadius: 8,
                padding: '10px 14px', color: C.onPrimary, fontWeight: 600,
                fontSize: 13, cursor: 'pointer',
              }}
            >
              Post a deal
            </button>
          </div>

          {deals.length === 0 && (
            <div style={{ ...card, fontSize: 13, color: C.outline }}>
              No deals yet. Post one and creators will be able to apply.
            </div>
          )}

          {deals.map((d) => {
            const budget = Number(d.amount) || 0;
            const F = financials(budget);
            const action = nextAction(d.workflow_status);
            const yourMove = action.actor === 'brand';
            return (
              <Link key={d.id} href={`/deals/${d.id}`} style={{ textDecoration: 'none' }}>
                <div style={{ ...card, cursor: 'pointer' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{d.title}</div>
                      <div style={{ fontSize: 11, color: C.outline, marginTop: 2 }}>
                        {STATUS_LABEL[d.workflow_status] || d.workflow_status}
                        {d.creator_username ? ` · @${d.creator_username}` : ''}
                        {d.workflow_status === 'OPEN'
                          ? ` · ${d.application_count} applicant${d.application_count === 1 ? '' : 's'}`
                          : ''}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>
                        ₹{budget.toLocaleString('en-IN')}
                      </div>
                      <div style={{ fontSize: 10, color: C.outline }}>
                        creator gets ₹{F.creatorTotal.toLocaleString('en-IN')}
                      </div>
                    </div>
                  </div>
                  {/* Surfaced on the list so a brand can see at a glance which
                      deals are stalled waiting on them. */}
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
