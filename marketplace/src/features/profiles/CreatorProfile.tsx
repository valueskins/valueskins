'use client';
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/context/AuthContext';
import { getCurrencySymbol } from '@/lib/currency';
import { C as TH } from '@/theme/colors';
import LoadingState from '@/components/LoadingState';

// Creator Profile Preferences — per ui-specs/Creator Profile Preferences.md.
// Tabbed editor (was accordion), live completion bar, reputation read-only,
// near-black Save (no gold), sand accents (no green/orange/red). All existing
// features + API calls preserved.
const FONT = "'Inter', 'Helvetica Neue', Arial, sans-serif";

const C = {
  bg: TH.bg,
  surface: TH.surface,
  surfaceAlt: TH.surfaceAlt,
  text: TH.text,
  textMuted: TH.textMuted,
  // sand is identical in both themes (BRANDING §4) — these stay literal
  primary: '#C8B89A',
  sand: '#C8B89A',
  deepSand: '#A08A5E',
  success: '#C8B89A', // was green — sand (G3)
  warning: '#B8B4AC', // was orange — neutral muted (G3)
  danger: '#B0413E', // was bright red — restrained brick (G3)
  border: TH.border,
};

interface CreatorProfileData {
  display_name: string;
  username: string;
  bio: string;
  location: string;
  country: string;
  languages: string[];
  niche: string;
  followers_count: number;
  pitch_video_url: string;
  pitch_text: string;
  completed_deals: Array<{
    id: string;
    deal_title: string;
    brand_name: string;
    completion_date: string;
    pdf_url: string;
  }>;
  open_for_work: boolean;
  min_deal_value: number;
  preferred_deal_types: string[];
  availability: string;
  response_time: string;
  trust_score: number;
  completion_rate: number;
  repeat_client_rate: number;
  avg_rating: number;
  verified: boolean;
}

const initialData: CreatorProfileData = {
  display_name: '',
  username: '',
  bio: '',
  location: '',
  country: '',
  languages: [],
  niche: '',
  followers_count: 0,
  pitch_video_url: '',
  pitch_text: '',
  completed_deals: [],
  open_for_work: true,
  min_deal_value: 500,
  preferred_deal_types: ['paid', 'barter'],
  availability: 'available',
  response_time: '24',
  trust_score: 0,
  completion_rate: 0,
  repeat_client_rate: 0,
  avg_rating: 0,
  verified: false,
};

type Tab = 'identity' | 'social' | 'pitch' | 'marketplace';

export default function CreatorProfile({
  embedded = false,
  onBack,
}: {
  /** Inside the app shell: drop the page background and full-height wrapper,
   *  since the shell already provides its own chrome and bottom tab spine. */
  embedded?: boolean;
  /** Where "Back to profile" goes. Defaults to routing to /profile/me. */
  onBack?: () => void;
} = {}) {
  const router = useRouter();
  const { account } = useAuth();
  const [profile, setProfile] = useState<CreatorProfileData>(initialData);
  const [tab, setTab] = useState<Tab>('identity');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [currencySymbol, setCurrencySymbol] = useState('₹');

  const hasValueSkins = account?.modules?.some((m) => m.code === 'valueskin' && m.is_active) || false;
  const isBrand = account?.modules?.some((m) => m.code === 'brand' && m.is_active) || false;
  const showMarketplaceSettings = hasValueSkins;

  useEffect(() => {
    if (account) {
      setProfile((prev) => ({ ...prev, display_name: account.display_name || prev.display_name }));
      fetchProfile();
    }
    getCurrencySymbol().then((sym) => setCurrencySymbol(sym));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account]);

  const fetchProfile = async () => {
    try {
      const res = await fetch('/api/profile/creator', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setProfile({ ...initialData, ...data });
      }
    } catch (err) {
      console.error('Failed to fetch profile:', err);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/profile/creator', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(profile),
      });
      if (!res.ok) {
        const data = await res.json();
        setMessage(data.error || 'Failed to save');
        return;
      }
      setMessage('Saved');
      setTimeout(() => setMessage(''), 2000);
    } catch (err: any) {
      setMessage(err.message || 'Error saving profile');
    } finally {
      setSaving(false);
    }
  };

  // Live completion (spec §2) — replaces the New·0% / 33% chips.
  const completion = useMemo(() => {
    const checks = [
      !!profile.display_name,
      !!profile.username,
      !!profile.bio,
      !!profile.location,
      !!profile.niche,
      profile.followers_count > 0,
      !!(profile.pitch_text || profile.pitch_video_url),
      profile.min_deal_value > 0,
    ];
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  }, [profile]);

  if (!account) {
    return (
      <LoadingState fullScreen={!embedded} />
    );
  }

  const tabs = ([
    { id: 'identity', label: 'Identity', show: true },
    { id: 'social', label: 'Social Capital', show: showMarketplaceSettings },
    { id: 'pitch', label: 'Pitch', show: showMarketplaceSettings },
    { id: 'marketplace', label: 'Marketplace', show: showMarketplaceSettings },
  ] as { id: Tab; label: string; show: boolean }[]).filter((t) => t.show);

  return (
    <div style={{
      minHeight: embedded ? undefined : '100vh',
      background: embedded ? undefined : C.bg,
      color: C.text, fontFamily: FONT, padding: '20px',
    }}>
      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
        {/* Sticky header + completion bar (spec §2) */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h1 style={{ fontSize: '2rem', fontWeight: 700, margin: 0 }}>Profile</h1>
              {message && <span style={{ fontSize: '0.8125rem', color: message === 'Saved' ? C.sand : C.danger }}>{message}</span>}
            </div>
            <button
              onClick={() => (onBack ? onBack() : router.push('/profile/me'))}
              style={{ padding: '10px 20px', background: 'transparent', color: C.text, border: `1px solid rgba(160,138,94,0.35)`, borderRadius: '6px', fontWeight: 600, cursor: 'pointer', fontFamily: FONT }}
            >
              Back to profile
            </button>
          </div>

          {/* Completion bar */}
          <div style={{ marginBottom: '8px', display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', color: C.textMuted }}>
            <span>Profile completion</span>
            <span>{completion}%</span>
          </div>
          <div style={{ height: '6px', background: 'rgba(160,138,94,0.18)', borderRadius: '3px', overflow: 'hidden' }}>
            <div style={{ width: `${completion}%`, height: '100%', background: C.sand, transition: 'width 0.4s cubic-bezier(0.16,1,0.3,1)' }} />
          </div>
        </div>

        {/* Segmented tabs with sliding sand indicator (spec §2) */}
        <div style={{ display: 'flex', gap: '4px', background: C.surface, border: `1px solid ${C.border}`, borderRadius: '8px', padding: '4px', marginBottom: '24px', flexWrap: 'wrap' }}>
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                flex: '1 1 auto',
                padding: '10px 16px',
                borderRadius: '6px',
                border: 'none',
                cursor: 'pointer',
                fontFamily: FONT,
                fontSize: '0.875rem',
                fontWeight: tab === t.id ? 600 : 400,
                background: tab === t.id ? 'rgba(200,184,154,0.14)' : 'transparent',
                color: tab === t.id ? C.text : C.textMuted,
                transition: 'background 0.2s, color 0.2s',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '10px', padding: '28px', marginBottom: '24px' }}>
          {tab === 'identity' && (
            <form style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
              <InputField label="Display Name" value={profile.display_name} onChange={(v) => setProfile({ ...profile, display_name: v })} />
              <InputField label="Username" value={profile.username} onChange={(v) => setProfile({ ...profile, username: v })} placeholder="no spaces" />
              <InputField label="Niche (e.g., Tech, Fashion, Fitness)" value={profile.niche} onChange={(v) => setProfile({ ...profile, niche: v })} />
              <InputField label="City" value={profile.location} onChange={(v) => setProfile({ ...profile, location: v })} />
              <InputField label="Country" value={profile.country} onChange={(v) => setProfile({ ...profile, country: v })} />
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelCap}>Bio</label>
                <textarea
                  value={profile.bio}
                  onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
                  placeholder="Tell brands about yourself, your expertise, and why they should work with you"
                  style={{ ...fieldStyle, minHeight: '100px', fontFamily: FONT }}
                />
              </div>
              <SaveButton onClick={handleSave} loading={saving} />
            </form>
          )}

          {tab === 'social' && (
            <form style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
              <InputField type="number" label="Follower Count" value={String(profile.followers_count)} onChange={(v) => setProfile({ ...profile, followers_count: parseInt(v) || 0 })} />
              <SaveButton onClick={handleSave} loading={saving} />
            </form>
          )}

          {tab === 'pitch' && (
            <form>
              <div style={{ marginBottom: '16px' }}>
                <label style={labelCap}>Pitch Video Link</label>
                <input
                  type="url"
                  placeholder="https://drive.google.com/file/d/... or https://dropbox.com/..."
                  value={profile.pitch_video_url}
                  onChange={(e) => setProfile({ ...profile, pitch_video_url: e.target.value })}
                  style={{ ...fieldStyle, marginBottom: '8px' }}
                />
                <div style={{ fontSize: '0.75rem', color: C.textMuted }}>
                  Share a link to your pitch video from Google Drive, Dropbox, OneDrive, or similar cloud storage
                </div>
                {profile.pitch_video_url && <div style={{ fontSize: '0.75rem', color: C.sand, marginTop: '8px' }}>Link added</div>}
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={labelCap}>Pitch Text</label>
                <textarea
                  value={profile.pitch_text}
                  onChange={(e) => setProfile({ ...profile, pitch_text: e.target.value })}
                  placeholder="Why should brands hire you? What's your unique value?"
                  style={{ ...fieldStyle, minHeight: '80px', fontFamily: FONT }}
                />
              </div>
              <SaveButton onClick={handleSave} loading={saving} />
            </form>
          )}

          {tab === 'marketplace' && (
            <form style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input type="checkbox" checked={profile.open_for_work} onChange={(e) => setProfile({ ...profile, open_for_work: e.target.checked })} />
                <span style={{ fontSize: '0.875rem' }}>Open for work</span>
              </label>
              <InputField type="number" label={`Minimum Deal Value (${currencySymbol})`} value={String(profile.min_deal_value)} onChange={(v) => setProfile({ ...profile, min_deal_value: parseInt(v) || 500 })} />
              <InputField type="number" label="Typical Response Time (hours)" value={String(profile.response_time)} onChange={(v) => setProfile({ ...profile, response_time: v })} />
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelCap}>Preferred Deal Types</label>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {['paid', 'barter', 'equity', 'ambassador'].map((type) => {
                    const sel = profile.preferred_deal_types.includes(type);
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => {
                          const updated = sel
                            ? profile.preferred_deal_types.filter((t) => t !== type)
                            : [...profile.preferred_deal_types, type];
                          setProfile({ ...profile, preferred_deal_types: updated });
                        }}
                        style={{
                          padding: '8px 16px',
                          borderRadius: '6px',
                          border: sel ? `1px solid ${C.sand}` : `1px solid ${C.border}`,
                          background: sel ? C.sand : 'transparent',
                          color: sel ? '#0A0A0A' : C.textMuted,
                          cursor: 'pointer',
                          fontWeight: sel ? 600 : 400,
                          fontSize: '0.8125rem',
                          fontFamily: FONT,
                        }}
                      >
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                      </button>
                    );
                  })}
                </div>
              </div>
              <SaveButton onClick={handleSave} loading={saving} />
            </form>
          )}
        </div>

        {/* Work History — read-only (preserved) */}
        {showMarketplaceSettings && (
          <ReadOnlyCard title="Work History">
            {profile.completed_deals.length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
                {profile.completed_deals.map((deal) => (
                  <div key={deal.id} style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: '8px', padding: '16px' }}>
                    <div style={{ fontSize: '0.875rem', fontWeight: 600, color: C.text }}>{deal.deal_title}</div>
                    <div style={{ fontSize: '0.75rem', color: C.textMuted, marginBottom: '8px' }}>with {deal.brand_name}</div>
                    <div style={{ fontSize: '0.75rem', color: C.textMuted, marginBottom: '12px' }}>
                      Completed: {new Date(deal.completion_date).toLocaleDateString()}
                    </div>
                    {deal.pdf_url && (
                      <a href={deal.pdf_url} download style={{ display: 'inline-block', padding: '8px 12px', background: C.sand, color: '#0A0A0A', borderRadius: '6px', textDecoration: 'none', fontSize: '0.75rem', fontWeight: 600 }}>
                        Download PDF
                      </a>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ color: C.textMuted, fontSize: '0.875rem' }}>
                No completed deals yet. Your work history will appear here after you complete your first ValueSkins deal.
              </div>
            )}
          </ReadOnlyCard>
        )}

        {/* Reputation — read-only strip, earned not edited (spec §3).
            Trust score in deep sand, rest neutral — no green/orange. */}
        {showMarketplaceSettings && (
          <ReadOnlyCard title="Reputation & Trust" note="Earned automatically from completed deals, not editable.">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px' }}>
              <StatBox label="Trust Score" value={`${profile.trust_score}%`} color={C.deepSand} />
              <StatBox label="Completion Rate" value={`${profile.completion_rate}%`} color={C.text} />
              <StatBox label="Repeat Client Rate" value={`${profile.repeat_client_rate}%`} color={C.text} />
              <StatBox label="Average Rating" value={`${profile.avg_rating}/5`} color={C.text} />
            </div>
          </ReadOnlyCard>
        )}
      </div>
    </div>
  );
}

const fieldStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  background: TH.surface,
  border: `1px solid ${C.border}`,
  borderRadius: '6px',
  color: C.text,
  fontSize: '1rem',
  boxSizing: 'border-box',
  fontFamily: FONT,
};

const labelCap: React.CSSProperties = {
  display: 'block',
  fontSize: '0.75rem',
  color: C.textMuted,
  marginBottom: '8px',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
};

function ReadOnlyCard({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '10px', padding: '24px', marginBottom: '20px' }}>
      <h2 style={{ fontSize: '1.125rem', fontWeight: 700, margin: '0 0 4px', color: C.text }}>{title}</h2>
      {note && <div style={{ fontSize: '0.75rem', color: C.textMuted, marginBottom: '16px' }}>{note}</div>}
      {!note && <div style={{ marginBottom: '16px' }} />}
      {children}
    </div>
  );
}

function InputField({ label, value, onChange, placeholder = '', type = 'text' }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <label style={{ display: 'block' }}>
      <div style={labelCap}>{label}</div>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={fieldStyle} />
    </label>
  );
}

function StatBox({ label, value, color = C.sand }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: '8px', padding: '16px', textAlign: 'center' }}>
      <div style={{ fontSize: '0.75rem', color: C.textMuted, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</div>
      <div style={{ fontSize: '1.5rem', fontWeight: 700, color }}>{value}</div>
    </div>
  );
}

// Near-black Save with Saved micro-confirm (spec §2/§5 — no gold fill).
function SaveButton({ onClick, loading }: { onClick: () => void; loading: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      style={{
        padding: '12px 24px',
        background: TH.primary,
        color: TH.onPrimary,
        border: 'none',
        borderRadius: '6px',
        fontWeight: 700,
        cursor: loading ? 'not-allowed' : 'pointer',
        opacity: loading ? 0.6 : 1,
        fontSize: '0.875rem',
        fontFamily: FONT,
      }}
    >
      {loading ? 'Saving...' : 'Save Changes'}
    </button>
  );
}
