// The account's details, with the fields its role actually has.
//
// A brand was being asked for a "Full name", an age range and a gender. Those
// are a person's attributes; a brand has a brand name and a website. Each role
// gets its own form, and both are saved to the account rather than to the
// browser.
import { useEffect, useState } from 'react';
import { C } from '@/theme/colors';

type Role = 'brand' | 'creator';

const COPY: Record<Role, {
  title: string;
  name: string;
  namePlaceholder: string;
  city: string;
  cityPlaceholder: string;
}> = {
  creator: {
    title: 'Your Details',
    name: 'Full name',
    namePlaceholder: 'Your full name',
    city: 'City',
    cityPlaceholder: 'Where you are based',
  },
  brand: {
    title: 'Brand Details',
    name: 'Brand name',
    namePlaceholder: 'The name creators will know you by',
    city: 'City',
    cityPlaceholder: 'Where the brand is based',
  },
};

export default function ProfileDetails({ role }: { role: Role }) {
  const copy = COPY[role];
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [website, setWebsite] = useState('');
  const [saved, setSaved] = useState({ name: '', city: '', website: '' });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string; field?: string } | null>(null);

  useEffect(() => {
    let live = true;
    fetch('/api/profile/details', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!live) return;
        if (d) {
          const next = { name: d.name || '', city: d.city || '', website: d.website || '' };
          setName(next.name); setCity(next.city); setWebsite(next.website); setSaved(next);
        }
        setLoading(false);
      })
      .catch(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch('/api/profile/details', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(role === 'brand' ? { name, city, website } : { name, city }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ ok: false, text: data.error || 'Could not save', field: data.field });
      } else {
        const next = { name: data.name || '', city: data.city || '', website: data.website || '' };
        setName(next.name); setCity(next.city); setWebsite(next.website); setSaved(next);
        setMessage({ ok: true, text: 'Saved' });
      }
    } catch {
      setMessage({ ok: false, text: 'Could not reach the server' });
    } finally {
      setBusy(false);
    }
  }

  const dirty = name !== saved.name || city !== saved.city || website !== saved.website;
  const off = busy || loading || !dirty;

  const label: React.CSSProperties = {
    display: 'block', fontSize: '11px', fontWeight: 700, color: C.textMuted,
    textTransform: 'uppercase', marginBottom: '6px',
  };
  const input = (field: string): React.CSSProperties => ({
    width: '100%', background: C.bg,
    border: `1px solid ${message && !message.ok && message.field === field ? C.danger : C.border}`,
    borderRadius: '8px', color: C.text, padding: '10px 12px', fontSize: '13px',
    fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', marginBottom: '14px',
  });

  return (
    <div style={{ marginBottom: '24px' }}>
      <div style={{ fontSize: '12px', fontWeight: 700, color: C.textMuted, letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: '12px' }}>
        {copy.title}
      </div>
      <form onSubmit={save} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '12px', padding: '16px' }}>
        <label htmlFor="pd-name" style={label}>{copy.name}</label>
        <input
          id="pd-name" type="text" value={name} disabled={loading} maxLength={80}
          autoComplete={role === 'brand' ? 'organization' : 'name'}
          placeholder={copy.namePlaceholder}
          onChange={(e) => { setName(e.target.value); setMessage(null); }}
          style={input('name')}
        />

        {role === 'brand' && (
          <>
            <label htmlFor="pd-website" style={label}>Website (optional)</label>
            <input
              id="pd-website" type="url" inputMode="url" value={website} disabled={loading} maxLength={200}
              autoComplete="url" autoCapitalize="none" placeholder="yourbrand.com"
              onChange={(e) => { setWebsite(e.target.value); setMessage(null); }}
              style={input('website')}
            />
          </>
        )}

        <label htmlFor="pd-city" style={label}>{copy.city}</label>
        <input
          id="pd-city" type="text" value={city} disabled={loading} maxLength={60}
          autoComplete="address-level2" placeholder={copy.cityPlaceholder}
          onChange={(e) => { setCity(e.target.value); setMessage(null); }}
          style={input('city')}
        />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <span role="status" style={{ fontSize: '11px', color: message?.ok === false ? C.danger : C.textSecondary }}>
            {message?.text || ''}
          </span>
          <button
            type="submit" disabled={off}
            style={{
              padding: '9px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 700,
              border: 'none', color: C.onPrimary,
              background: off ? C.border : C.primary, cursor: off ? 'not-allowed' : 'pointer',
            }}
          >
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </div>
  );
}
