'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import MarketplaceLayout from '@/components/MarketplaceLayout';
import BriefForm from '@/features/briefs/BriefForm';
import ErrorBanner from '@/components/ErrorBanner';
import LoadingSkeleton from '@/components/LoadingSkeleton';
import EmptyState from '@/components/EmptyState';

const C = {
  bg: '#0A0A0A', surface: '#1A1A1A', surfaceAlt: '#2D2D2D',
  text: '#F5F5F0', textMuted: '#B8B4AC', primary: '#C8B89A',
  success: 'var(--c-accent)', warning: 'var(--c-warning)', border: '#2D2D2D',
};

export default function BriefsPage() {
  const [briefs, setBriefs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const router = useRouter();

  const fetchBriefs = async (pageNum = 1, append = false) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/briefs?page=${pageNum}&pageSize=20`, { credentials: 'include' });
      if (!res.ok) { setError('Failed to load briefs'); setLoading(false); return; }
      const data = await res.json();
      setBriefs(append ? [...briefs, ...(data.briefs || [])] : (data.briefs || []));
      setHasMore(data.pagination?.hasMore || false);
      setPage(pageNum);
    } catch { setError('Failed to load briefs'); }
    setLoading(false);
  };

  useEffect(() => { fetchBriefs(); }, []);

  return (
    <MarketplaceLayout title="Briefs" hideBottomNav>
      <div style={{ padding: '16px', color: C.text, fontFamily: "'Poppins', 'Helvetica Neue', Arial, sans-serif" }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h1 style={{ fontSize: '22px', fontWeight: 700, margin: 0 }}>Briefs</h1>
          <button onClick={() => setShowForm(!showForm)}
            style={{ padding: '8px 16px', background: C.primary, color: '#000', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', fontSize: '13px' }}>
            {showForm ? 'Cancel' : '+ New Brief'}
          </button>
        </div>

        {showForm && (
          <div style={{ marginBottom: '20px' }}>
            <BriefForm onSaved={() => { setShowForm(false); fetchBriefs(); }} />
          </div>
        )}

        {error && <ErrorBanner message={error} />}

        {loading && page === 1 && <LoadingSkeleton count={3} />}

        {!loading && briefs.length === 0 && !error && (
          <EmptyState message="No briefs yet. Create one to describe what you're looking for." />
        )}

        {briefs.length > 0 && (
          <div style={{ display: 'grid', gap: '10px' }}>
            {briefs.map((b: any) => (
              <div key={b.id} onClick={() => router.push(`/briefs/${b.id}`)}
                style={{ padding: '14px', background: C.surface, borderRadius: '8px', border: `1px solid ${C.border}`, cursor: 'pointer' }}>
                <div style={{ fontSize: '15px', fontWeight: 600, marginBottom: '4px' }}>{b.title}</div>
                <div style={{ fontSize: '13px', color: C.textMuted, marginBottom: '8px' }}>{b.description?.slice(0, 120)}</div>
                <div style={{ display: 'flex', gap: '12px', fontSize: '12px', color: C.textMuted }}>
                  {b.budget_range && <span>Budget: {b.budget_range}</span>}
                  {b.required_niches?.length > 0 && <span>{b.required_niches.length} niche{b.required_niches.length > 1 ? 's' : ''}</span>}
                  {b.deadline && <span>Due: {new Date(b.deadline).toLocaleDateString()}</span>}
                </div>
              </div>
            ))}
          </div>
        )}

        {loading && page > 1 && <div style={{ textAlign: 'center', padding: '20px', color: C.textMuted }}>Loading more...</div>}

        {hasMore && !loading && (
          <div style={{ textAlign: 'center', marginTop: '20px' }}>
            <button onClick={() => fetchBriefs(page + 1, true)}
              style={{ padding: '10px 24px', background: 'transparent', color: C.primary, border: `1px solid ${C.primary}`, borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}>
              Load More
            </button>
          </div>
        )}
      </div>
    </MarketplaceLayout>
  );
}
