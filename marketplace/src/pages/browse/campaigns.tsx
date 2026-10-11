'use client';
import { withAlpha } from '@/theme/colors';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import type { GetServerSidePropsContext } from 'next';
import { getSessionUserId } from '@/lib/session';
import { query } from '@/lib/db';
import MarketplaceLayout from '@/components/MarketplaceLayout';

export async function getServerSideProps(ctx: GetServerSidePropsContext) {
  const cookie = ctx.req.headers.cookie || '';
  const userId = await getSessionUserId(cookie);
  if (!userId) return { props: { initialCampaigns: [], initialPagination: null } };

  try {
    const page = 1, pageSize = 20, offset = 0;
    const conditions: string[] = ["c.status = 'active'", "(c.deadline IS NULL OR c.deadline >= NOW())"];
    const params: any[] = [];
    let p = 1;

    conditions.push(`NOT EXISTS (SELECT 1 FROM campaign_bids cb WHERE cb.campaign_id = c.id AND cb.creator_id = $${p})`);
    params.push(userId); p++;
    conditions.push(`NOT EXISTS (SELECT 1 FROM campaign_invites ci WHERE ci.campaign_id = c.id AND ci.creator_id = $${p})`);
    params.push(userId);

    const whereClause = conditions.join(' AND ');
    const countResult = await query(`SELECT COUNT(*) as total FROM campaigns c WHERE ${whereClause}`, params);
    const total = parseInt(countResult.rows[0]?.total || '0');

    params.push(pageSize, offset);
    const r = await query(
      `SELECT c.*, a.display_name as brand_name, a.username as brand_username, a.avatar_url as brand_avatar
       FROM campaigns c JOIN accounts a ON c.brand_id = a.id
       WHERE ${whereClause} ORDER BY c.created_at DESC LIMIT $${p} OFFSET $${p + 1}`,
      params
    );

    return {
      props: {
        initialCampaigns: r.rows || [],
        initialPagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize), hasMore: page * pageSize < total },
      },
    };
  } catch {
    return { props: { initialCampaigns: [], initialPagination: null } };
  }
}

interface BrowseCampaignsProps {
  initialCampaigns: any[];
  initialPagination: { page: number; pageSize: number; total: number; totalPages: number; hasMore: boolean } | null;
}

const C = {
  bg: '#0A0A0A', surface: '#1A1A1A', surfaceAlt: '#2D2D2D',
  text: '#F5F5F0', textMuted: '#B8B4AC', primary: '#C8B89A',
  success: 'var(--c-accent)', warning: 'var(--c-warning)', border: '#2D2D2D',
};

export default function BrowseCampaigns({ initialCampaigns = [], initialPagination = null }: BrowseCampaignsProps) {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<any[]>(initialCampaigns);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [maxBudget, setMaxBudget] = useState('');
  const [page, setPage] = useState(initialPagination?.page || 1);
  const [hasMore, setHasMore] = useState(initialPagination?.hasMore || false);

  const fetchCampaigns = async (pageNum = 1, append = false) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(pageNum), pageSize: '20' });
      if (search) params.set('search', search);
      if (maxBudget) params.set('maxBudget', maxBudget);
      const res = await fetch(`/api/browse/campaigns?${params}`, { credentials: 'include' });
      if (res.ok) {
        const d = await res.json();
        setCampaigns(append ? [...campaigns, ...(d.campaigns || [])] : (d.campaigns || []));
        setHasMore(d.pagination?.hasMore || false);
        setPage(pageNum);
      }
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => {
    if (!initialCampaigns.length) fetchCampaigns();
  }, []);

  return (
    <MarketplaceLayout title="Browse Campaigns" hideHeader>
      <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto', color: C.text, fontFamily: "'Poppins', 'Helvetica Neue', Arial, sans-serif" }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '16px' }}>Browse Campaigns</h1>

        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
          <input placeholder="Search campaigns..." value={search} onChange={e => setSearch(e.target.value)}
            style={{ flex: 1, padding: '10px', background: C.surface, border: `1px solid ${C.border}`, borderRadius: '6px', color: C.text, fontSize: '13px' }} />
          <input type="number" placeholder="Max budget" value={maxBudget} onChange={e => setMaxBudget(e.target.value)}
            style={{ width: '120px', padding: '10px', background: C.surface, border: `1px solid ${C.border}`, borderRadius: '6px', color: C.text, fontSize: '13px' }} />
          <button onClick={() => fetchCampaigns()}
            style={{ padding: '10px 16px', background: C.primary, color: '#000', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', fontSize: '13px' }}>
            Search
          </button>
        </div>

        {loading && page === 1 && <div style={{ textAlign: 'center', padding: '40px', color: C.textMuted }}>Loading campaigns...</div>}

        {!loading && campaigns.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px', color: C.textMuted }}>
            No open campaigns match your criteria right now.
          </div>
        )}

        <div style={{ display: 'grid', gap: '10px' }}>
          {campaigns.map((c: any) => (
            <div key={c.id}
              onClick={() => router.push(`/campaigns/${c.id}`)}
              style={{ padding: '14px', background: C.surface, borderRadius: '8px', border: `1px solid ${C.border}`, cursor: 'pointer' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span style={{ fontSize: '15px', fontWeight: 600 }}>{c.title}</span>
                    <span style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '4px', background: `${withAlpha(C.success, 0x20)}`, color: C.success }}>{c.status}</span>
                  </div>
                  <div style={{ fontSize: '12px', color: C.textMuted, marginBottom: '4px' }}>{c.description?.slice(0, 120) || 'No description'}</div>
                  <div style={{ display: 'flex', gap: '12px', fontSize: '11px', color: C.textMuted }}>
                    <span>by <strong style={{ color: C.text }}>{c.brand_name || 'Brand'}</strong></span>
                    <span>Budget: <strong style={{ color: C.primary }}>₹{c.budget_per_creator}</strong></span>
                    {c.brand_rating > 0 && <span>Rating: <strong style={{ color: C.warning }}>{c.brand_rating}/5</strong></span>}
                  </div>
                </div>
                <div style={{ textAlign: 'right', marginLeft: '12px' }}>
                  <div style={{ fontSize: '11px', padding: '4px 8px', background: C.primary, color: '#000', borderRadius: '4px', fontWeight: 600 }}>
                    Place Bid
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {loading && page > 1 && <div style={{ textAlign: 'center', padding: '20px', color: C.textMuted }}>Loading more...</div>}

        {hasMore && !loading && (
          <div style={{ textAlign: 'center', marginTop: '20px' }}>
            <button onClick={() => fetchCampaigns(page + 1, true)}
              style={{ padding: '10px 24px', background: 'transparent', color: C.primary, border: `1px solid ${C.primary}`, borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}>
              Load More
            </button>
          </div>
        )}
      </div>
    </MarketplaceLayout>
  );
}
