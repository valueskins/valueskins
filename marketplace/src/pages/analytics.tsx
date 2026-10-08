'use client';
import { withAlpha } from '@/theme/colors';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';

const C = {
  bg: 'var(--c-bg)',
  card: '#13172b',
  cardBorder: '#1e2340',
  surface: '#1a1f3a',
  text: '#f1f5f9',
  textMuted: '#64748b',
  textSecondary: '#B8B4AC',
  primary: 'var(--c-accent)',
  success: 'var(--c-accent)',
  warning: 'var(--c-warning)',
  danger: 'var(--c-error)',
  accent: 'var(--c-accent)',
  chart: '#C8B89A',
};

function formatCurrency(n: number): string {
  if (n >= 1_000_000) return `₹${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `₹${(n / 1_000).toFixed(1)}K`;
  return `₹${n.toLocaleString()}`;
}

function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: '12px', padding: '20px' }}>
      <div style={{ fontSize: '12px', color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>{label}</div>
      <div style={{ fontSize: '28px', fontWeight: 700, color: color || C.text }}>{value}</div>
      {sub && <div style={{ fontSize: '12px', color: C.textMuted, marginTop: '4px' }}>{sub}</div>}
    </div>
  );
}

function MiniBarChart({ data, color = C.primary, height = 80 }: { data: Array<{ label: string; value: number }>; color?: string; height?: number }) {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height, paddingTop: '8px' }}>
      {data.map((d, i) => (
        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
          <div style={{
            width: '100%', background: color, borderRadius: '3px 3px 0 0',
            height: `${(d.value / max) * (height - 20)}px`,
            opacity: 0.7 + (d.value / max) * 0.3,
            transition: 'height 0.3s',
          }} />
          <div style={{ fontSize: '8px', color: C.textMuted, transform: 'rotate(-45deg)', transformOrigin: 'left', whiteSpace: 'nowrap' }}>{d.label}</div>
        </div>
      ))}
    </div>
  );
}

function HorizontalBar({ label, value, max, color = C.primary }: { label: string; value: number; max: number; color?: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
      <div style={{ width: '120px', fontSize: '11px', color: C.textSecondary, textAlign: 'right', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</div>
      <div style={{ flex: 1, background: C.surface, borderRadius: '4px', height: '16px', overflow: 'hidden' }}>
        <div style={{ width: `${Math.min(pct, 100)}%`, background: color, height: '100%', borderRadius: '4px', transition: 'width 0.3s' }} />
      </div>
      <div style={{ width: '60px', fontSize: '11px', color: C.text, fontWeight: 600, textAlign: 'right', flexShrink: 0 }}>{formatCurrency(value)}</div>
    </div>
  );
}

type Tab = 'overview' | 'revenue' | 'deals' | 'brands' | 'campaigns' | 'performance' | 'levels' | 'spend' | 'creators' | 'relationships' | 'marketplace';

export default function AnalyticsPage() {
  const { account } = useAuth();
  const [role, setRole] = useState<'creator' | 'brand'>('creator');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<Tab>('overview');

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/analytics/me?role=${role}`, {
        headers: { 'x-user-id': String(account?.id || '') },
        credentials: 'include',
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Failed'); }
      const result = await res.json();
      setData(result.data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [role, account?.id]);

  useEffect(() => { if (account?.id) fetchAnalytics(); }, [fetchAnalytics, account?.id]);

  if (!account) return <div style={{ padding: '40px', color: C.textMuted, textAlign: 'center' }}>Sign in to view analytics</div>;

  const d = data || {};
  const creatorTabs: { key: Tab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'revenue', label: 'Revenue' },
    { key: 'deals', label: 'Deals' },
    { key: 'brands', label: 'Brands' },
    { key: 'campaigns', label: 'Campaigns' },
    { key: 'performance', label: 'Performance' },
  ];
  const brandTabs: { key: Tab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'spend', label: 'Spend' },
    { key: 'campaigns', label: 'Campaigns' },
    { key: 'creators', label: 'Creators' },
    { key: 'relationships', label: 'Relationships' },
    { key: 'marketplace', label: 'Marketplace' },
  ];

  const tabs = role === 'creator' ? creatorTabs : brandTabs;

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, padding: '32px 24px', fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif" }}>
      {/* Header */}
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
          <div>
            <h1 style={{ fontSize: '28px', fontWeight: 700, margin: '0 0 4px' }}>Analytics</h1>
            <p style={{ fontSize: '14px', color: C.textMuted, margin: 0 }}>
              {role === 'creator' ? 'Your marketplace performance and earnings' : 'Your campaign and spend insights'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => setRole('creator')} style={{
              padding: '8px 16px', borderRadius: '8px', border: `1px solid ${role === 'creator' ? C.primary : C.cardBorder}`,
              background: role === 'creator' ? C.primary + '20' : 'transparent',
              color: role === 'creator' ? C.primary : C.textMuted, fontWeight: 600, fontSize: '13px', cursor: 'pointer',
            }}>Creator</button>
            <button onClick={() => setRole('brand')} style={{
              padding: '8px 16px', borderRadius: '8px', border: `1px solid ${role === 'brand' ? C.primary : C.cardBorder}`,
              background: role === 'brand' ? C.primary + '20' : 'transparent',
              color: role === 'brand' ? C.primary : C.textMuted, fontWeight: 600, fontSize: '13px', cursor: 'pointer',
            }}>Brand</button>
            <button onClick={fetchAnalytics} style={{
              padding: '8px 16px', borderRadius: '8px', border: `1px solid ${C.cardBorder}`,
              background: C.surface, color: C.textSecondary, fontWeight: 600, fontSize: '13px', cursor: 'pointer',
            }}>Refresh</button>
          </div>
        </div>

        {error && (
          <div style={{ background: `${withAlpha(C.danger, 0x15)}`, border: `1px solid ${withAlpha(C.danger, 0x30)}`, borderRadius: '8px', padding: '12px 16px', color: C.danger, fontSize: '13px', marginBottom: '24px' }}>
            {error}
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '4px', borderBottom: `1px solid ${C.cardBorder}`, paddingBottom: '12px', marginBottom: '24px', overflowX: 'auto' }}>
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              padding: '8px 16px', borderRadius: '8px', border: 'none',
              background: tab === t.key ? C.primary + '20' : 'transparent',
              color: tab === t.key ? C.primary : C.textMuted, fontWeight: 600, fontSize: '13px', cursor: 'pointer', whiteSpace: 'nowrap',
            }}>{t.label}</button>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '80px 0', color: C.textMuted, fontSize: '14px' }}>Loading analytics...</div>
        ) : role === 'creator' ? <CreatorDashboard data={d} tab={tab} /> : <BrandDashboard data={d} tab={tab} />}
      </div>
    </div>
  );
}

// ─── CREATOR DASHBOARD ──────────────────────────────────────────

function CreatorDashboard({ data, tab }: { data: any; tab: Tab }) {
  const r = data.revenue || {};
  const dl = data.deals || {};
  const br = data.brands || {};
  const cp = data.campaigns || {};
  const pf = data.performance || {};
  const lv = data.levels || {};

  if (tab === 'overview') {
    return (
      <div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
          <StatCard label="Lifetime Earnings" value={formatCurrency(r.lifetimeEarnings)} sub={`${r.thisMonth > 0 ? `₹${r.thisMonth.toLocaleString()} this month` : 'No activity this month'}`} color={C.success} />
          <StatCard label="Deals Completed" value={String(dl.total || 0)} color={C.primary} />
          <StatCard label="Brands Worked With" value={String(br.totalBrands || 0)} sub={`${br.repeatBrands} repeat (${br.repeatPercent}%)`} color={C.accent} />
          <StatCard label="Avg Rating" value={(pf.avgRating || 0).toFixed(1)} sub={`${pf.totalReviews} reviews`} color={C.warning} />
        </div>

        {/* Recent revenue trend */}
        {r.byMonth && r.byMonth.length > 0 && (
          <div style={{ background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: '12px', padding: '20px', marginBottom: '24px' }}>
            <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>Revenue Trend (12 months)</div>
            <MiniBarChart data={r.byMonth.map((m: any) => ({ label: m.month, value: m.earnings }))} color={C.success} height={100} />
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
          {/* Top Brands */}
          {br.topBrands && br.topBrands.length > 0 && (
            <div style={{ background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: '12px', padding: '20px' }}>
              <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>Top Brands by Revenue</div>
              {br.topBrands.slice(0, 5).map((b: any, i: number) => (
                <HorizontalBar key={i} label={b.brandName} value={b.revenue} max={br.topBrands[0]?.revenue || 1} />
              ))}
            </div>
          )}

          {/* Deal Status */}
          {dl.byStatus && dl.byStatus.length > 0 && (
            <div style={{ background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: '12px', padding: '20px' }}>
              <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>Deal Status Breakdown</div>
              {dl.byStatus.map((s: any, i: number) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: i < dl.byStatus.length - 1 ? `1px solid ${C.cardBorder}` : 'none', fontSize: '13px' }}>
                  <span style={{ color: C.textSecondary, textTransform: 'capitalize' }}>{s.status}</span>
                  <span style={{ fontWeight: 600, color: s.status === 'completed' ? C.success : s.status === 'cancelled' ? C.danger : C.text }}>{s.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (tab === 'revenue') {
    return (
      <div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '16px', marginBottom: '24px' }}>
          <StatCard label="Lifetime" value={formatCurrency(r.lifetimeEarnings)} color={C.success} />
          <StatCard label="This Month" value={formatCurrency(r.thisMonth)} color={C.primary} />
          <StatCard label="This Quarter" value={formatCurrency(r.thisQuarter)} color={C.accent} />
          <StatCard label="This Year" value={formatCurrency(r.thisYear)} color={C.warning} />
        </div>
        {r.byMonth && r.byMonth.length > 0 && (
          <div style={{ background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: '12px', padding: '20px', marginBottom: '24px' }}>
            <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>Monthly Earnings</div>
            <MiniBarChart data={r.byMonth.map((m: any) => ({ label: m.month, value: m.earnings }))} color={C.success} height={120} />
          </div>
        )}
        {r.byBrand && r.byBrand.length > 0 && (
          <div style={{ background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: '12px', padding: '20px' }}>
            <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>Earnings by Brand</div>
            {r.byBrand.slice(0, 10).map((b: any, i: number) => (
              <HorizontalBar key={i} label={b.brandName} value={b.earnings} max={r.byBrand[0]?.earnings || 1} color={C.primary} />
            ))}
          </div>
        )}
        {(!r.byMonth || r.byMonth.length === 0) && (
          <div style={{ textAlign: 'center', padding: '40px', color: C.textMuted, background: C.card, borderRadius: '12px', border: `1px solid ${C.cardBorder}` }}>
            Complete your first deal to see revenue analytics
          </div>
        )}
      </div>
    );
  }

  if (tab === 'deals') {
    return (
      <div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '16px', marginBottom: '24px' }}>
          <StatCard label="Total" value={String(dl.total || 0)} color={C.text} />
          <StatCard label="Active" value={String(dl.active || 0)} color={C.primary} />
          <StatCard label="Completed" value={String(dl.total - dl.active - (dl.cancelled || 0))} color={C.success} />
          <StatCard label="Acceptance" value={`${dl.acceptanceRate || 0}%`} color={C.warning} />
        </div>
        {dl.byStatus && dl.byStatus.length > 0 && (
          <div style={{ background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: '12px', padding: '20px', marginBottom: '24px' }}>
            <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>Deal Status Distribution</div>
            {dl.byStatus.map((s: any, i: number) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: i < dl.byStatus.length - 1 ? `1px solid ${C.cardBorder}` : 'none', fontSize: '14px' }}>
                <span style={{ color: C.textSecondary, textTransform: 'capitalize' }}>{s.status}</span>
                <span style={{ fontWeight: 700, color: s.status === 'completed' ? C.success : s.status === 'cancelled' ? C.danger : C.text }}>{s.count}</span>
              </div>
            ))}
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }}>
          <StatCard label="Repeat Deal Rate" value={`${dl.repeatDealRate || 0}%`} sub="Deals with repeat brands" color={C.accent} />
          <StatCard label="Completion Rate" value={`${dl.completionRate || 0}%`} sub="Of total deals" color={C.success} />
        </div>
      </div>
    );
  }

  if (tab === 'brands') {
    return (
      <div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '16px', marginBottom: '24px' }}>
          <StatCard label="Total Brands" value={String(br.totalBrands || 0)} color={C.primary} />
          <StatCard label="Repeat Brands" value={String(br.repeatBrands || 0)} color={C.success} />
          <StatCard label="Repeat Rate" value={`${br.repeatPercent || 0}%`} color={C.accent} />
          <StatCard label="Avg/Brand" value={formatCurrency(br.avgRevenuePerBrand || 0)} color={C.warning} />
        </div>
        {br.topBrands && br.topBrands.length > 0 && (
          <div style={{ background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: '12px', padding: '20px' }}>
            <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>Top Brands</div>
            {br.topBrands.map((b: any, i: number) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: i < br.topBrands.length - 1 ? `1px solid ${C.cardBorder}` : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ color: C.textMuted, fontSize: '12px' }}>#{i + 1}</span>
                  <span style={{ fontSize: '13px', fontWeight: 600 }}>{b.brandName}</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: C.success }}>{formatCurrency(b.revenue)}</div>
                  <div style={{ fontSize: '11px', color: C.textMuted }}>{b.deals} deal{b.deals !== 1 ? 's' : ''}</div>
                </div>
              </div>
            ))}
          </div>
        )}
        {(!br.topBrands || br.topBrands.length === 0) && (
          <div style={{ textAlign: 'center', padding: '40px', color: C.textMuted, background: C.card, borderRadius: '12px', border: `1px solid ${C.cardBorder}` }}>
            Complete deals to build brand relationships
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ textAlign: 'center', padding: '40px', color: C.textMuted, background: C.card, borderRadius: '12px', border: `1px solid ${C.cardBorder}` }}>
      Analytics for this section will appear as you complete more deals
    </div>
  );
}

// ─── BRAND DASHBOARD ──────────────────────────────────────────

function BrandDashboard({ data, tab }: { data: any; tab: Tab }) {
  const s = data.spend || {};
  const cr = data.creators || {};
  const cp = data.campaigns || {};
  const mp = data.marketplace || {};
  const rl = data.relationships || {};

  if (tab === 'overview') {
    return (
      <div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
          <StatCard label="Total Spend" value={formatCurrency(s.total)} sub={`${s.thisMonth > 0 ? `₹${s.thisMonth.toLocaleString()} this month` : 'No spend this month'}`} color={C.danger} />
          <StatCard label="Campaigns" value={String(cp.created || 0)} sub={`${cp.active} active`} color={C.primary} />
          <StatCard label="Creators Hired" value={String(cr.totalCreators || 0)} sub={`${cr.repeatCreators} repeat`} color={C.accent} />
          <StatCard label="Avg Campaign Cost" value={formatCurrency(cp.avgCost || 0)} color={C.warning} />
        </div>
        {s.byMonth && s.byMonth.length > 0 && (
          <div style={{ background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: '12px', padding: '20px', marginBottom: '24px' }}>
            <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>Monthly Spend (12 months)</div>
            <MiniBarChart data={s.byMonth.map((m: any) => ({ label: m.month, value: m.amount }))} color={C.danger} height={100} />
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
          {rl.mostHired && rl.mostHired.length > 0 && (
            <div style={{ background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: '12px', padding: '20px' }}>
              <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>Most-Hired Creators</div>
              {rl.mostHired.slice(0, 5).map((c: any, i: number) => (
                <HorizontalBar key={i} label={c.creatorName} value={c.totalSpend} max={rl.mostHired[0]?.totalSpend || 1} color={C.accent} />
              ))}
            </div>
          )}
          {s.byCreator && s.byCreator.length > 0 && (
            <div style={{ background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: '12px', padding: '20px' }}>
              <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>Spend by Creator</div>
              {s.byCreator.slice(0, 5).map((c: any, i: number) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: i < Math.min(5, s.byCreator.length) - 1 ? `1px solid ${C.cardBorder}` : 'none', fontSize: '12px' }}>
                  <span style={{ color: C.textSecondary }}>{c.creatorName}</span>
                  <span style={{ fontWeight: 600, color: C.text }}>{formatCurrency(c.amount)} ({c.dealCount} deals)</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (tab === 'spend') {
    return (
      <div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '16px', marginBottom: '24px' }}>
          <StatCard label="Total Spend" value={formatCurrency(s.total)} color={C.danger} />
          <StatCard label="This Month" value={formatCurrency(s.thisMonth)} color={C.primary} />
          <StatCard label="This Quarter" value={formatCurrency(s.thisQuarter)} color={C.accent} />
          <StatCard label="This Year" value={formatCurrency(s.thisYear)} color={C.warning} />
        </div>
        {s.byMonth && s.byMonth.length > 0 && (
          <div style={{ background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: '12px', padding: '20px', marginBottom: '24px' }}>
            <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>Monthly Spend</div>
            <MiniBarChart data={s.byMonth.map((m: any) => ({ label: m.month, value: m.amount }))} color={C.danger} height={120} />
          </div>
        )}
      </div>
    );
  }

  if (tab === 'creators') {
    return (
      <div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '16px', marginBottom: '24px' }}>
          <StatCard label="Total Hired" value={String(cr.totalCreators || 0)} color={C.primary} />
          <StatCard label="Repeat" value={String(cr.repeatCreators || 0)} color={C.success} />
          <StatCard label="Retention" value={`${cr.retentionRate || 0}%`} color={C.accent} />
          <StatCard label="Avg Cost" value={formatCurrency(cr.avgCostPerCreator || 0)} color={C.warning} />
        </div>
        {s.byCreator && s.byCreator.length > 0 && (
          <div style={{ background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: '12px', padding: '20px' }}>
            <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>Spend by Creator</div>
            {s.byCreator.slice(0, 10).map((c: any, i: number) => (
              <HorizontalBar key={i} label={c.creatorName} value={c.amount} max={s.byCreator[0]?.amount || 1} color={C.primary} />
            ))}
          </div>
        )}
      </div>
    );
  }

  if (tab === 'relationships') {
    return (
      <div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
          <StatCard label="Rehire Rate" value={`${rl.rehireRate || 0}%`} color={C.success} />
          <StatCard label="Total Hired" value={String(cr.totalCreators || 0)} color={C.primary} />
        </div>
        {rl.mostHired && rl.mostHired.length > 0 && (
          <div style={{ background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: '12px', padding: '20px', marginBottom: '16px' }}>
            <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>Most-Hired Creators</div>
            {rl.mostHired.map((c: any, i: number) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: i < rl.mostHired.length - 1 ? `1px solid ${C.cardBorder}` : 'none' }}>
                <span style={{ fontSize: '13px', fontWeight: 600 }}>{c.creatorName}</span>
                <span style={{ color: C.textMuted, fontSize: '13px' }}>{c.deals} deals, {formatCurrency(c.totalSpend)}</span>
              </div>
            ))}
          </div>
        )}
        {rl.longestRelationships && rl.longestRelationships.length > 0 && (
          <div style={{ background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: '12px', padding: '20px' }}>
            <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>Longest Relationships</div>
            {rl.longestRelationships.map((c: any, i: number) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: i < rl.longestRelationships.length - 1 ? `1px solid ${C.cardBorder}` : 'none', fontSize: '13px' }}>
                <span style={{ fontWeight: 600 }}>{c.creatorName}</span>
                <span style={{ color: C.textMuted }}>{c.daysSinceFirst} days, {c.totalDeals} deals</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ textAlign: 'center', padding: '40px', color: C.textMuted, background: C.card, borderRadius: '12px', border: `1px solid ${C.cardBorder}` }}>
      Run campaigns and hire creators to see analytics
    </div>
  );
}
