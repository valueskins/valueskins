'use client';
import { withAlpha } from '@/theme/colors';
import { useState, useEffect } from 'react';
import MarketplaceLayout from '@/components/MarketplaceLayout';

const C = {
  bg: 'var(--c-bg)', surface: 'var(--c-surface)', text: 'var(--c-text)', textMuted: 'var(--c-text-muted)',
  primary: 'var(--c-primary)', success: 'var(--c-accent)', border: 'var(--c-border)',
};

export default function NotificationSettingsPage() {
  const [prefs, setPrefs] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    fetch('/api/settings/notifications', { credentials: 'include' })
      .then(r => r.json()).then(d => setPrefs(d.preferences)).catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const toggle = async (key: string) => {
    const updated = { ...prefs, [key]: !prefs[key] };
    setPrefs(updated);
    setSaving(true);
    try {
      const res = await fetch('/api/settings/notifications', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ [key]: updated[key] }),
      });
      if (res.ok) setMsg('Saved');
      else setPrefs({ ...prefs, [key]: !updated[key] });
    } catch { setPrefs({ ...prefs, [key]: !updated[key] }); }
    finally { setSaving(false); setTimeout(() => setMsg(''), 2000); }
  };

  if (loading) return <MarketplaceLayout title="Notifications" hideBottomNav><div style={{ padding: '20px', color: C.textMuted }}>Loading...</div></MarketplaceLayout>;

  return (
    <MarketplaceLayout title="Notifications" hideBottomNav>
      <div style={{ padding: '16px', color: C.text, fontFamily: "'Poppins', 'Helvetica Neue', Arial, sans-serif" }}>
        <h1 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '8px' }}>Notification Preferences</h1>
        <p style={{ fontSize: '13px', color: C.textMuted, marginBottom: '20px' }}>Choose how you receive updates from ValueSkins.</p>

        {msg && <div style={{ padding: '8px 12px', background: `${withAlpha(C.success, 0x20)}`, borderRadius: '6px', fontSize: '12px', color: C.success, marginBottom: '12px' }}>{msg}</div>}

        <div style={{ display: 'grid', gap: '2px', background: C.surface, borderRadius: '8px', border: `1px solid ${C.border}`, overflow: 'hidden' }}>
          {[
            { key: 'notifications', label: 'Deal & Message Notifications', desc: 'Get notified about deal updates, new messages, and payment confirmations' },
            { key: 'marketing', label: 'Marketing & Promotions', desc: 'Campaign invitations, product updates, and promotional content' },
            { key: 'product_updates', label: 'Product Updates', desc: 'New features, platform improvements, and changelog announcements' },
          ].map(item => (
            <div key={item.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', borderBottom: `1px solid ${C.border}` }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 600 }}>{item.label}</div>
                <div style={{ fontSize: '12px', color: C.textMuted }}>{item.desc}</div>
              </div>
              <button onClick={() => toggle(item.key)}
                style={{ width: '44px', height: '24px', borderRadius: '12px', border: 'none', cursor: 'pointer', position: 'relative', background: prefs?.[item.key] ? C.primary : C.textMuted, transition: 'background 0.2s' }}>
                <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: '#fff', position: 'absolute', top: '3px', left: prefs?.[item.key] ? '23px' : '3px', transition: 'left 0.2s' }} />
              </button>
            </div>
          ))}
        </div>

        <p style={{ fontSize: '12px', color: C.textMuted, marginTop: '12px' }}>{saving ? 'Saving...' : 'Changes are saved immediately.'}</p>
      </div>
    </MarketplaceLayout>
  );
}
