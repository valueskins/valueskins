'use client';
import { withAlpha } from '@/theme/colors';
import { useState, useEffect } from 'react';
import MarketplaceLayout from '@/components/MarketplaceLayout';
import ErrorBanner from '@/components/ErrorBanner';
import LoadingSkeleton from '@/components/LoadingSkeleton';
import EmptyState from '@/components/EmptyState';

const C = {
  bg: 'var(--c-bg)', surface: '#111827', text: '#E0E0DA', textMuted: 'var(--c-text-variant)',
  primary: 'var(--c-accent)', success: 'var(--c-accent)', danger: 'var(--c-error)', warning: 'var(--c-warning)', border: 'var(--c-border)',
};

export default function PaymentHistoryPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  const fetchHistory = async (type: string, pageNum = 1, append = false) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/payments/history?type=${type}&page=${pageNum}&pageSize=20`, { credentials: 'include' });
      if (!res.ok) { setError('Failed to load payment history'); setLoading(false); return; }
      const json = await res.json();
      if (append && data) {
        json.payments = [...(data.payments || []), ...(json.payments || [])];
        json.escrow = [...(data.escrow || []), ...(json.escrow || [])];
      }
      setData(json);
      setHasMore(json.pagination?.hasMore || false);
      setPage(pageNum);
    } catch { setError('Failed to load payment history'); }
    setLoading(false);
  };

  useEffect(() => { fetchHistory(filter); }, [filter]);

  const allItems = [...(data?.payments || []), ...(data?.escrow || [])]
    .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return (
    <MarketplaceLayout title="Payment History" hideBottomNav>
      <div style={{ padding: '16px', color: C.text, fontFamily: "'Poppins', 'Helvetica Neue', Arial, sans-serif" }}>
        <h1 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '16px' }}>Payment History</h1>

        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          {[{ id: 'all', label: 'All' }, { id: 'incoming', label: 'Received' }, { id: 'outgoing', label: 'Sent' }].map(f => (
            <button key={f.id} onClick={() => setFilter(f.id)}
              style={{ padding: '6px 14px', borderRadius: '6px', border: `1px solid ${filter === f.id ? C.primary : C.border}`, background: filter === f.id ? C.primary : 'transparent', color: filter === f.id ? '#fff' : C.textMuted, cursor: 'pointer', fontSize: '13px', fontWeight: filter === f.id ? 600 : 400 }}>
              {f.label}
            </button>
          ))}
        </div>

        {error && <ErrorBanner message={error} />}

        {loading && page === 1 && <LoadingSkeleton count={3} />}

        {!loading && allItems.length === 0 && !error && (
          <EmptyState message="No payment history yet." />
        )}

        {allItems.length > 0 && (
          <div style={{ display: 'grid', gap: '8px' }}>
            {allItems.map((item: any) => (
              <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', background: C.surface, borderRadius: '8px', border: `1px solid ${C.border}` }}>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 600 }}>{item.deal_title || `Deal #${item.deal_id}`}</div>
                  <div style={{ fontSize: '12px', color: C.textMuted }}>{new Date(item.created_at).toLocaleDateString()} &middot; {item.type}</div>
                  {item.transaction_id && <div style={{ fontSize: '11px', color: C.textMuted }}>TX: {item.transaction_id.slice(0, 16)}...</div>}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: item.type === 'escrow' ? C.primary : C.success }}>${Number(item.amount || 0).toLocaleString()}</div>
                  <div style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '4px', textTransform: 'capitalize', background: item.status === 'completed' || item.status === 'released' ? `${withAlpha(C.success, 0x20)}` : `${withAlpha(C.warning, 0x20)}`, color: item.status === 'completed' || item.status === 'released' ? C.success : C.warning }}>{item.status || 'pending'}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {loading && page > 1 && <div style={{ textAlign: 'center', padding: '20px', color: C.textMuted }}>Loading more...</div>}

        {hasMore && !loading && (
          <div style={{ textAlign: 'center', marginTop: '20px' }}>
            <button onClick={() => fetchHistory(filter, page + 1, true)}
              style={{ padding: '10px 24px', background: 'transparent', color: C.primary, border: `1px solid ${C.primary}`, borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}>
              Load More
            </button>
          </div>
        )}
      </div>
    </MarketplaceLayout>
  );
}
