// The profile: what the other side of a deal sees when they hover over this
// account. Entered once, then fixed, apart from the follower count.
//
// The two roles have different forms. A creator is a person (name, age,
// gender, city); a brand is a business (brand name, website, city).
import { useEffect, useState } from 'react';
import { C, withAlpha } from '@/theme/colors';

type Role = 'brand' | 'creator';
const GENDERS = ['Male', 'Female', 'Non-binary', 'Prefer not to say'];

interface Details {
  role: Role;
  locked: boolean;
  name: string;
  city: string;
  followers: number;
  website?: string;
  age?: number | null;
  gender?: string;
}

const COPY: Record<Role, { name: string; namePlaceholder: string; cityPlaceholder: string; audience: string }> = {
  creator: {
    name: 'Full name',
    namePlaceholder: 'Your full name',
    cityPlaceholder: 'Where you are based',
    audience: 'brands',
  },
  brand: {
    name: 'Brand name',
    namePlaceholder: 'The name creators will know you by',
    cityPlaceholder: 'Where the brand is based',
    audience: 'creators',
  },
};

export default function ProfileDetails({ role }: { role: Role }) {
  const copy = COPY[role];
  const [details, setDetails] = useState<Details | null>(null);
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [website, setWebsite] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  const [followers, setFollowers] = useState('');
  const [understood, setUnderstood] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string; field?: string } | null>(null);

  function apply(d: Details) {
    setDetails(d);
    setName(d.name || '');
    setCity(d.city || '');
    setWebsite(d.website || '');
    setAge(d.age ? String(d.age) : '');
    setGender(d.gender || '');
    setFollowers(String(d.followers ?? 0));
  }

  useEffect(() => {
    let live = true;
    fetch('/api/profile/details', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (live) { if (d) apply(d); setLoading(false); } })
      .catch(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, []);

  const locked = !!details?.locked;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const body = locked
        ? { followers }
        : role === 'brand'
          ? { name, city, website, followers }
          : { name, city, age, gender, followers };
      const res = await fetch('/api/profile/details', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ ok: false, text: data.error || 'Could not save', field: data.field });
      } else {
        apply(data);
        setMessage({ ok: true, text: locked ? 'Follower count updated' : 'Profile saved' });
      }
    } catch {
      setMessage({ ok: false, text: 'Could not reach the server' });
    } finally {
      setBusy(false);
    }
  }

  const followersChanged = followers.trim() !== String(details?.followers ?? 0);
  const off = busy || loading || (locked ? !followersChanged : !understood);

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
  const fixed = (k: string, v: string) => (
    <div key={k} style={{ marginBottom: '14px' }}>
      <div style={label}>{k}</div>
      <div style={{ fontSize: '13px', color: C.text, fontWeight: 600, wordBreak: 'break-word' }}>{v || 'Not given'}</div>
    </div>
  );

  return (
    <div style={{ marginBottom: '24px' }}>
      <div style={{ fontSize: '12px', fontWeight: 700, color: C.textMuted, letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: '12px' }}>
        Profile
      </div>

      {/* Said before anything is typed, not after. */}
      <div
        style={{
          fontSize: '12px', color: C.text, lineHeight: 1.6, marginBottom: '12px',
          background: withAlpha(C.accent, 0x14), border: `1px solid ${C.accent}`,
          borderRadius: '10px', padding: '12px 14px',
        }}
      >
        Everything you enter in this section is visible to {copy.audience} when they hover over
        your profile.
      </div>

      <form onSubmit={save} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '12px', padding: '16px' }}>
        {loading && <div style={{ fontSize: '13px', color: C.textMuted, marginBottom: '14px' }}>Loading…</div>}

        {/* Taken from Instagram at sign-in, never chosen here. */}
        {!loading && (
          <div style={{ marginBottom: '14px', paddingBottom: '14px', borderBottom: `1px solid ${C.border}` }}>
            <div style={label}>Account type</div>
            <div style={{ fontSize: '14px', color: C.text, fontWeight: 700 }}>
              {role === 'brand' ? 'Brand' : 'Creator'}
            </div>
            <div style={{ fontSize: '11px', color: C.textMuted, lineHeight: 1.5, marginTop: 4 }}>
              {role === 'brand'
                ? 'Your Instagram account is a Business account, so you post deals.'
                : 'Your Instagram account is a Creator account, so you apply to deals.'}
              {' '}This comes from Instagram and cannot be changed here.
            </div>
          </div>
        )}

        {!loading && locked && (
          <>
            {fixed(copy.name, name)}
            {role === 'creator' && fixed('Age', age)}
            {role === 'creator' && fixed('Gender', gender)}
            {role === 'brand' && fixed('Website', website)}
            {fixed('City', city)}
            <div style={{ fontSize: '11px', color: C.textMuted, lineHeight: 1.5, margin: '-4px 0 14px' }}>
              These were saved once and cannot be changed.
              {role === 'creator' ? ' Your age goes up by one each year without you doing anything.' : ''}
            </div>
          </>
        )}

        {!loading && !locked && (
          <>
            <label htmlFor="pd-name" style={label}>{copy.name}</label>
            <input
              id="pd-name" type="text" value={name} maxLength={80} required
              autoComplete={role === 'brand' ? 'organization' : 'name'}
              placeholder={copy.namePlaceholder}
              onChange={(e) => { setName(e.target.value); setMessage(null); }}
              style={input('name')}
            />

            {role === 'creator' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label htmlFor="pd-age" style={label}>Age</label>
                  <input
                    id="pd-age" type="number" inputMode="numeric" min={18} max={99} value={age} required
                    placeholder="18 or over"
                    onChange={(e) => { setAge(e.target.value); setMessage(null); }}
                    style={input('age')}
                  />
                </div>
                <div>
                  <label htmlFor="pd-gender" style={label}>Gender</label>
                  <select
                    id="pd-gender" value={gender} required
                    onChange={(e) => { setGender(e.target.value); setMessage(null); }}
                    style={{ ...input('gender'), cursor: 'pointer' }}
                  >
                    <option value="">Select</option>
                    {GENDERS.map((g) => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
              </div>
            )}

            {role === 'brand' && (
              <>
                <label htmlFor="pd-website" style={label}>Website (optional)</label>
                <input
                  id="pd-website" type="text" inputMode="url" value={website} maxLength={200}
                  autoComplete="url" autoCapitalize="none" placeholder="yourbrand.com"
                  onChange={(e) => { setWebsite(e.target.value); setMessage(null); }}
                  style={input('website')}
                />
              </>
            )}

            <label htmlFor="pd-city" style={label}>City</label>
            <input
              id="pd-city" type="text" value={city} maxLength={60} required
              autoComplete="address-level2" placeholder={copy.cityPlaceholder}
              onChange={(e) => { setCity(e.target.value); setMessage(null); }}
              style={input('city')}
            />
          </>
        )}

        {!loading && (
          <>
            <label htmlFor="pd-followers" style={label}>Instagram followers</label>
            <input
              id="pd-followers" type="number" inputMode="numeric" min={0} value={followers} required
              onChange={(e) => { setFollowers(e.target.value); setMessage(null); }}
              style={input('followers')}
            />
            <div style={{ fontSize: '11px', color: C.textMuted, lineHeight: 1.5, margin: '-8px 0 14px' }}>
              You can update this whenever it changes. The new number shows on your profile straight away.
            </div>
          </>
        )}

        {!loading && !locked && (
          <label
            style={{
              display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: '12px',
              color: C.text, lineHeight: 1.55, marginBottom: '14px', cursor: 'pointer',
            }}
          >
            <input
              type="checkbox" checked={understood}
              onChange={(e) => setUnderstood(e.target.checked)}
              style={{ marginTop: 2, flexShrink: 0 }}
            />
            <span>
              I have checked these details. I understand that after saving, only my follower count
              can be changed.
            </span>
          </label>
        )}

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
            {busy ? 'Saving…' : locked ? 'Update followers' : 'Save profile'}
          </button>
        </div>
      </form>
    </div>
  );
}
