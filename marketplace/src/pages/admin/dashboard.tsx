'use client';
import { useState, useEffect } from 'react';

const C = {
  bg: 'var(--c-bg)', surface: '#111827', surfaceAlt: '#1A1A1A',
  text: '#E0E0DA', textMuted: 'var(--c-text-variant)', primary: 'var(--c-accent)',
  success: 'var(--c-accent)', warning: 'var(--c-warning)', danger: 'var(--c-error)', border: '#1A1A1A',
};

export default function AdminDashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/dashboard', { credentials: 'include' })
      .then(r => r.json()).then(setData).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ padding: 32, color: C.text }}>Loading...</div>;
  if (!data) return <div style={{ padding: 32, color: C.danger }}>Failed to load. Admin access required.</div>;

  const statCards = [
    { label: 'Total Users', value: data.users?.total || 0, sub: `${data.users?.new_this_week || 0} new this week` },
    { label: 'Active Deals', value: data.deals?.active || 0, sub: `${data.deals?.total || 0} total deals` },
    { label: 'Escrow Locked', value: `₹${Number(data.escrow?.total_locked || 0).toLocaleString()}`, sub: `${data.escrow?.total || 0} active` },
    { label: 'Total Paid', value: `₹${Number(data.payments?.total_paid || 0).toLocaleString()}`, sub: `${data.payments?.total || 0} transactions` },
    { label: 'Brand Verifications', value: data.brands?.pending || 0, sub: `${data.brands?.total || 0} total` },
  ];

  return (
    <div style={{ padding: '24px', maxWidth: '1000px', margin: '0 auto', color: C.text, fontFamily: "'Poppins', 'Helvetica Neue', Arial, sans-serif" }}>
      <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '20px' }}>Admin Dashboard</h1>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px', marginBottom: '24px' }}>
        {statCards.map(s => (
          <div key={s.label} style={{ padding: '16px', background: C.surface, borderRadius: '8px', border: `1px solid ${C.border}` }}>
            <div style={{ fontSize: '12px', color: C.textMuted, marginBottom: '4px' }}>{s.label}</div>
            <div style={{ fontSize: '24px', fontWeight: 700, color: C.primary }}>{s.value}</div>
            <div style={{ fontSize: '11px', color: C.textMuted, marginTop: '4px' }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {data.phaseBreakdown?.length > 0 && (
        <div style={{ padding: '16px', background: C.surface, borderRadius: '8px', border: `1px solid ${C.border}` }}>
          <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>Deals by Phase</h2>
          {data.phaseBreakdown.map((p: any) => (
            <div key={p.phase} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: `1px solid ${C.border}`, fontSize: '14px' }}>
              <span style={{ textTransform: 'capitalize', color: C.text }}>{p.phase}</span>
              <span style={{ color: C.primary, fontWeight: 600 }}>{p.count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
