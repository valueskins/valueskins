'use client';
import { withAlpha } from '@/theme/colors';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import MarketplaceLayout from '@/components/MarketplaceLayout';

const C = {
  bg: '#0A0A0A', surface: '#1A1A1A', surfaceAlt: '#2D2D2D',
  text: '#F5F5F0', textMuted: '#B8B4AC', primary: '#C8B89A',
  success: 'var(--c-accent)', warning: 'var(--c-warning)', danger: 'var(--c-error)', border: '#2D2D2D',
};

export default function BriefDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const [brief, setBrief] = useState<any>(null);
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [matching, setMatching] = useState(false);

  const fetchBrief = async () => {
    if (!id) return;
    try {
      const res = await fetch(`/api/briefs?id=${id}`, { credentials: 'include' });
      if (res.ok) setBrief((await res.json()).brief);
    } catch {} finally { setLoading(false); }
  };

  const findMatches = async () => {
    setMatching(true);
    try {
      const res = await fetch(`/api/briefs/match?id=${id}`, { credentials: 'include' });
      if (res.ok) setMatches((await res.json()).matches || []);
    } catch {} finally { setMatching(false); }
  };

  useEffect(() => { if (id) fetchBrief(); }, [id]);

  if (loading) return <MarketplaceLayout title="Brief" hideBottomNav><div style={{ padding: '20px', color: C.textMuted }}>Loading...</div></MarketplaceLayout>;
  if (!brief) return <MarketplaceLayout title="Brief" hideBottomNav><div style={{ padding: '20px', color: C.danger }}>Brief not found</div></MarketplaceLayout>;

  return (
    <MarketplaceLayout title="Brief" hideBottomNav>
      <div style={{ padding: '16px', color: C.text, fontFamily: "'Poppins', 'Helvetica Neue', Arial, sans-serif" }}>
        <button onClick={() => router.push('/briefs')} style={{ background: 'none', border: 'none', color: C.primary, cursor: 'pointer', marginBottom: '16px', fontSize: '14px' }}>&larr; Back</button>

        <div style={{ padding: '20px', background: C.surface, borderRadius: '8px', border: `1px solid ${C.border}`, marginBottom: '16px' }}>
          <h1 style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 8px' }}>{brief.title}</h1>
          <p style={{ color: C.textMuted, fontSize: '14px', lineHeight: 1.5, marginBottom: '16px' }}>{brief.description}</p>
          {brief.campaign_goals && <p style={{ fontSize: '13px', color: C.textMuted, marginBottom: '8px' }}><strong style={{ color: C.text }}>Goals:</strong> {brief.campaign_goals}</p>}
          {brief.target_audience && <p style={{ fontSize: '13px', color: C.textMuted, marginBottom: '8px' }}><strong style={{ color: C.text }}>Audience:</strong> {brief.target_audience}</p>}
          <div style={{ display: 'flex', gap: '12px', fontSize: '12px', color: C.textMuted, flexWrap: 'wrap' }}>
            {brief.budget_range && <span style={{ padding: '4px 8px', background: C.surfaceAlt, borderRadius: '4px' }}>Budget: {brief.budget_range}</span>}
            {brief.deadline && <span style={{ padding: '4px 8px', background: C.surfaceAlt, borderRadius: '4px' }}>Deadline: {new Date(brief.deadline).toLocaleDateString()}</span>}
            <span style={{ padding: '4px 8px', background: C.surfaceAlt, borderRadius: '4px', textTransform: 'capitalize' }}>{brief.status}</span>
          </div>
          {brief.required_niches?.length > 0 && (
            <div style={{ marginTop: '12px' }}>
              <span style={{ fontSize: '12px', color: C.textMuted }}>Niches: </span>
              {brief.required_niches.map((n: string) => <span key={n} style={{ padding: '2px 8px', background: `${withAlpha(C.primary, 0x20)}`, borderRadius: '4px', fontSize: '11px', color: C.primary, marginRight: '4px' }}>{n}</span>)}
            </div>
          )}
        </div>

        <button onClick={findMatches} disabled={matching}
          style={{ width: '100%', padding: '10px', background: C.primary, color: '#000', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', opacity: matching ? 0.6 : 1, marginBottom: '16px' }}>
          {matching ? 'Finding matches...' : 'Find Matching Creators'}
        </button>

        {matches.length > 0 && (
          <div>
            <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '10px' }}>Matches ({matches.length})</h2>
            <div style={{ display: 'grid', gap: '8px' }}>
              {matches.map((m: any) => (
                <div key={m.id} onClick={() => router.push(`/profile/${m.id}`)}
                  style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px', background: C.surface, borderRadius: '8px', border: `1px solid ${C.border}`, cursor: 'pointer' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: C.surfaceAlt, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: 600, color: C.text }}>
                    {(m.display_name || '?')[0]}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: '14px' }}>{m.display_name || `Creator #${m.id}`}</div>
                    <div style={{ fontSize: '12px', color: C.textMuted }}>
                      {m.followers_count ? `${Number(m.followers_count).toLocaleString()} followers` : ''}
                      {m.matched_niches?.length > 0 && ` \u00b7 ${m.matched_niches.length} niche match${m.matched_niches.length > 1 ? 'es' : ''}`}
                    </div>
                  </div>
                  {m.algo_score && <div style={{ fontSize: '13px', color: C.primary, fontWeight: 600 }}>{Math.round(m.algo_score * 100)}%</div>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </MarketplaceLayout>
  );
}
