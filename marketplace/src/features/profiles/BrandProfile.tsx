'use client';
import { withAlpha } from '@/theme/colors';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/context/AuthContext';
import { getCurrencySymbol } from '@/lib/currency';
import LoadingState from '@/components/LoadingState';

// G3: no green/orange/red — sand/neutral/brick per BRANDING §4/§10.7
const C = {
  bg: '#0A0A0A',
  surface: '#1A1A1A',
  surfaceAlt: '#2D2D2D',
  text: '#F5F5F0',
  textMuted: '#B8B4AC',
  primary: '#C8B89A',
  success: '#C8B89A', // was green
  warning: '#B8B4AC', // was orange
  danger: '#B0413E', // was bright red — restrained brick
  border: 'var(--c-border)',
};

const FONT = "'Poppins', 'Helvetica Neue', Arial, sans-serif";

interface BrandProfileData {
  display_name: string;
  username: string;
  bio: string;
  location: string;
  country: string;
  languages: string[];
  niche: string;
  followers_count: number;
  pitch_text: string;
  open_for_work: boolean;
  min_deal_value: number;
  preferred_deal_types: string[];
  availability: string;
  response_time: string;
  verified: boolean;
  // Work History (auto-fetched from completed ValueSkins deals)
  completed_deals: Array<{
    id: string;
    deal_title: string;
    creator_name: string;
    completion_date: string;
    pdf_url: string;
  }>;
}

const initialData: BrandProfileData = {
  display_name: '',
  username: '',
  bio: '',
  location: '',
  country: '',
  languages: [],
  niche: '',
  followers_count: 0,
  pitch_text: '',
  open_for_work: true,
  min_deal_value: 500,
  preferred_deal_types: ['paid'],
  availability: 'available',
  response_time: '24',
  verified: false,
  completed_deals: [],
};

type EditSection = null | 'identity' | 'social' | 'pitch' | 'portfolio' | 'marketplace';

export default function BrandProfile() {
  const router = useRouter();
  const { account } = useAuth();
  const [profile, setProfile] = useState<BrandProfileData>(initialData);
  const [editing, setEditing] = useState<EditSection>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [currencySymbol, setCurrencySymbol] = useState('₹');

  useEffect(() => {
    if (account) {
      setProfile(prev => ({
        ...prev,
        display_name: account.display_name || prev.display_name
      }));
      fetchProfile();
    }
    getCurrencySymbol().then(sym => setCurrencySymbol(sym));
  }, [account]);

  const fetchProfile = async () => {
    try {
      const res = await fetch('/api/profile/brand', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        const mapped = {
          ...initialData,
          ...data,
        };
        setProfile(mapped);
      }
    } catch (err) {
      console.error('Failed to fetch profile:', err);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/profile/brand', {
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

      setMessage('Profile saved successfully');
      setEditing(null);
      setTimeout(() => setMessage(''), 2000);
    } catch (err: any) {
      setMessage(err.message || 'Error saving profile');
    } finally {
      setSaving(false);
    }
  };

  if (!account) {
    return (
      <LoadingState />
    );
  }

  // Essential fields (required to use the platform)
  const essentialFields = [
    { label: 'Brand name', done: !!profile.display_name },
    { label: 'Bio', done: !!profile.bio },
    { label: 'Location', done: !!profile.location },
  ];

  const essentialMissing = essentialFields.filter((f) => !f.done).map((f) => f.label);

  // Optional fields (nice to have, shown as warnings)
  const optionalFields = [
    { label: 'About this brand', done: !!profile.pitch_text },
  ];

  const optionalMissing = optionalFields.filter((f) => !f.done).map((f) => f.label);

  return (
    <div style={{ minHeight: '100vh', background: `linear-gradient(180deg, ${C.bg} 0%, #161512 100%)`, color: C.text, fontFamily: FONT, padding: '28px' }}>
      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
        {message && (
          <div style={{ padding: '12px 16px', background: message.includes('success') ? `${withAlpha(C.success, 0x20)}` : `${withAlpha(C.danger, 0x20)}`, border: `1px solid ${message.includes('success') ? C.success : C.danger}`, borderRadius: '8px', color: message.includes('success') ? C.success : C.danger, marginBottom: '48px', fontSize: '16px' }}>
            {message}
          </div>
        )}

        <div style={{ marginBottom: '32px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
            <h1 style={{ fontSize: '32px', fontWeight: 800, margin: 0 }}>Brand Profile</h1>
            <button
              onClick={() => router.push('/')}
              style={{ padding: '10px 20px', background: 'transparent', color: C.primary, border: `1px solid ${C.primary}`, borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}
            >
              Back
            </button>
          </div>

          {profile.verified && <div style={{ padding: '13px 26px', background: `${withAlpha(C.success, 0x20)}`, border: `1px solid ${C.success}`, borderRadius: '8px', color: C.success, fontSize: '15px', fontWeight: 600, display: 'inline-block', marginBottom: '16px' }}>Verified</div>}

          {/* Essential fields missing - blocks access */}
          {essentialMissing.length > 0 && (
            <div style={{ marginTop: '16px', padding: '12px 16px', background: `${withAlpha(C.danger, 0x20)}`, border: `1px solid ${C.danger}`, borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '15px', color: C.danger, fontWeight: 600 }}>Complete these to get started:</span>
              {essentialMissing.map((label) => (
                <span key={label} style={{ fontSize: '14px', color: C.danger, background: `${withAlpha(C.danger, 0x22)}`, border: `1px solid ${withAlpha(C.danger, 0x55)}`, borderRadius: '20px', padding: '3px 10px', fontWeight: 500 }}>
                  {label}
                </span>
              ))}
            </div>
          )}

          {/* Optional fields missing - just a warning */}
          {essentialMissing.length === 0 && optionalMissing.length > 0 && (
            <div style={{ marginTop: '16px', padding: '12px 16px', background: `${withAlpha(C.warning, 0x14)}`, border: `1px solid ${C.warning}`, borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '15px', color: C.warning, fontWeight: 600 }}>Optional - helps attract creators:</span>
              {optionalMissing.map((label) => (
                <span key={label} style={{ fontSize: '14px', color: C.warning, background: `${withAlpha(C.warning, 0x22)}`, border: `1px solid ${withAlpha(C.warning, 0x55)}`, borderRadius: '20px', padding: '3px 10px', fontWeight: 500 }}>
                  {label}
                </span>
              ))}
            </div>
          )}

          {/* All done */}
          {essentialMissing.length === 0 && optionalMissing.length === 0 && (
            <div style={{ marginTop: '16px', padding: '12px 16px', background: `${withAlpha(C.success, 0x14)}`, border: `1px solid ${C.success}`, borderRadius: '8px', fontSize: '15px', color: C.success, fontWeight: 600 }}>
              Your profile is complete!
            </div>
          )}
        </div>

        <Section title="Identity" isOpen={editing === 'identity'} onToggle={() => setEditing(editing === 'identity' ? null : 'identity')}>
          {editing !== 'identity' ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
              <div>
                <div style={{ fontSize: '14px', color: C.textMuted, marginBottom: '4px', textTransform: 'uppercase' }}>Name</div>
                <div style={{ fontSize: '18px', fontWeight: 600 }}>{profile.display_name || 'Not set'}</div>
              </div>
              <div>
                <div style={{ fontSize: '14px', color: C.textMuted, marginBottom: '4px', textTransform: 'uppercase' }}>Username</div>
                <div style={{ fontSize: '18px', fontWeight: 600 }}>@{profile.username || 'Not set'}</div>
              </div>
              <div>
                <div style={{ fontSize: '14px', color: C.textMuted, marginBottom: '4px', textTransform: 'uppercase' }}>Niche</div>
                <div style={{ fontSize: '18px', fontWeight: 600 }}>{profile.niche || 'Not specified'}</div>
              </div>
              <div>
                <div style={{ fontSize: '14px', color: C.textMuted, marginBottom: '4px', textTransform: 'uppercase' }}>Location</div>
                <div style={{ fontSize: '18px', fontWeight: 600 }}>{profile.location ? `${profile.location}, ${profile.country}` : 'Not set'}</div>
              </div>
            </div>
          ) : (
            <form style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
              <InputField label="Brand Name" value={profile.display_name} onChange={v => setProfile({ ...profile, display_name: v })} />
              <InputField label="Username" value={profile.username} onChange={v => setProfile({ ...profile, username: v })} placeholder="no spaces" />
              <InputField label="Industry (e.g., Tech, Fashion, Fitness)" value={profile.niche} onChange={v => setProfile({ ...profile, niche: v })} />
              <InputField label="City" value={profile.location} onChange={v => setProfile({ ...profile, location: v })} />
              <InputField label="Country" value={profile.country} onChange={v => setProfile({ ...profile, country: v })} />
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', fontSize: '14px', color: C.textMuted, marginBottom: '6px', textTransform: 'uppercase' }}>About Your Brand</label>
                <textarea
                  value={profile.bio}
                  onChange={e => setProfile({ ...profile, bio: e.target.value })}
                  placeholder="Tell creators about your brand, what you do, and why they should work with you"
                  style={{ width: '100%', padding: '12px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: '8px', color: C.text, minHeight: '100px', boxSizing: 'border-box', fontFamily: 'inherit', fontSize: '16px' }}
                />
              </div>
              <SaveButton onClick={handleSave} loading={saving} />
            </form>
          )}
        </Section>

        <Section title="Followers" isOpen={editing === 'social'} onToggle={() => setEditing(editing === 'social' ? null : 'social')}>
          {editing !== 'social' ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px' }}>
              <StatBox label="Followers" value={`${(profile.followers_count / 1000).toFixed(1)}K`} />
            </div>
          ) : (
            <form style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
              <InputField type="number" label="Follower Count" value={String(profile.followers_count)} onChange={v => setProfile({ ...profile, followers_count: parseInt(v) || 0 })} />
              <SaveButton onClick={handleSave} loading={saving} />
            </form>
          )}
        </Section>

        <Section title="About This Brand" isOpen={editing === 'pitch'} onToggle={() => setEditing(editing === 'pitch' ? null : 'pitch')}>
          {editing !== 'pitch' ? (
            <div>
              {profile.pitch_text && (
                <div>
                  <div style={{ fontSize: '16px', lineHeight: '1.6' }}>{profile.pitch_text}</div>
                </div>
              )}
              {!profile.pitch_text && <div style={{ color: C.textMuted }}>No brand description added yet. Add information about your brand, what you look for in creators, and your campaign goals.</div>}
            </div>
          ) : (
            <form style={{ display: 'grid', gridTemplateColumns: '1 / -1', gap: '16px' }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', fontSize: '14px', color: C.textMuted, marginBottom: '6px', textTransform: 'uppercase' }}>Brand Description</label>
                <textarea
                  value={profile.pitch_text}
                  onChange={e => setProfile({ ...profile, pitch_text: e.target.value })}
                  placeholder="Tell creators about your brand. What do you do? What kind of partnerships are you looking for? What makes your brand special?"
                  style={{ width: '100%', padding: '12px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: '8px', color: C.text, minHeight: '100px', boxSizing: 'border-box', fontFamily: 'inherit', fontSize: '16px' }}
                />
              </div>
              <SaveButton onClick={handleSave} loading={saving} />
            </form>
          )}
        </Section>

        {/* Work History Section (auto-fetched from completed ValueSkins deals) */}
        <Section title="Work History" isOpen={editing === 'portfolio'} onToggle={() => setEditing(editing === 'portfolio' ? null : 'portfolio')} canEdit={false}>
          {profile.completed_deals.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
              {profile.completed_deals.map((deal) => (
                <div key={deal.id} style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: '8px', padding: '28px' }}>
                  <div style={{ marginBottom: '8px' }}>
                    <div style={{ fontSize: '16px', fontWeight: 600, color: C.text }}>{deal.deal_title}</div>
                    <div style={{ fontSize: '14px', color: C.textMuted }}>with {deal.creator_name}</div>
                  </div>
                  <div style={{ fontSize: '14px', color: C.textMuted, marginBottom: '16px' }}>
                    Completed: {new Date(deal.completion_date).toLocaleDateString()}
                  </div>
                  {deal.pdf_url && (
                    <a href={deal.pdf_url} download style={{
                      display: 'inline-block',
                      padding: '13px 26px',
                      background: C.primary,
                      color: 'var(--c-on-primary)',
                      borderRadius: '6px',
                      textDecoration: 'none',
                      fontSize: '14px',
                      fontWeight: 600,
                    }}>
                      Download PDF
                    </a>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ color: C.textMuted, fontSize: '16px' }}>
              No completed deals yet. Your work history will appear here after you complete your first ValueSkins deal.
            </div>
          )}
        </Section>

        <Section title="Marketplace & Availability" isOpen={editing === 'marketplace'} onToggle={() => setEditing(editing === 'marketplace' ? null : 'marketplace')}>
          {editing !== 'marketplace' ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
              <div>
                <div style={{ fontSize: '14px', color: C.textMuted, marginBottom: '4px', textTransform: 'uppercase' }}>Status</div>
                <div style={{ fontSize: '18px', fontWeight: 600, color: profile.open_for_work ? C.success : C.danger }}>
                  {profile.open_for_work ? 'Actively Hiring' : 'Not Hiring'}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '14px', color: C.textMuted, marginBottom: '4px', textTransform: 'uppercase' }}>Min Deal Value</div>
                <div style={{ fontSize: '18px', fontWeight: 600 }}>{currencySymbol}{profile.min_deal_value}</div>
              </div>
              <div>
                <div style={{ fontSize: '14px', color: C.textMuted, marginBottom: '4px', textTransform: 'uppercase' }}>Response Time</div>
                <div style={{ fontSize: '18px', fontWeight: 600 }}>{profile.response_time} hours</div>
              </div>
            </div>
          ) : (
            <form style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="checkbox"
                  checked={profile.open_for_work}
                  onChange={e => setProfile({ ...profile, open_for_work: e.target.checked })}
                />
                <span style={{ fontSize: '16px' }}>Actively hiring creators</span>
              </label>

              <InputField type="number" label={`Minimum Deal Value (${currencySymbol})`} value={String(profile.min_deal_value)} onChange={v => setProfile({ ...profile, min_deal_value: parseInt(v) || 500 })} />
              <InputField type="number" label="Typical Response Time (hours)" value={String(profile.response_time)} onChange={v => setProfile({ ...profile, response_time: v })} />

              <SaveButton onClick={handleSave} loading={saving} />
            </form>
          )}
        </Section>
      </div>
    </div>
  );
}

function Section({ title, isOpen, onToggle, canEdit = true, children }: { title: string; isOpen: boolean; onToggle: () => void; canEdit?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '10px', marginBottom: '48px', overflow: 'hidden' }}>
      <button
        onClick={onToggle}
        style={{
          width: '100%',
          padding: '28px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontFamily: FONT,
        }}
      >
        <h2 style={{ fontSize: '1.125rem', fontWeight: 700, margin: 0, color: C.text }}>{title}</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {canEdit && <span style={{ fontSize: '0.75rem', color: C.textMuted }}>Edit</span>}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ transform: `rotate(${isOpen ? 180 : 0}deg)`, transition: 'transform 0.3s' }}>
            <path d="M6 9l6 6 6-6" stroke={C.textMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </button>
      {isOpen && <div style={{ padding: '28px', paddingTop: 0, borderTop: `1px solid ${C.border}` }}>{children}</div>}
    </div>
  );
}

function InputField({ label, value, onChange, placeholder = '', type = 'text' }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <label style={{ display: 'block' }}>
      <div style={{ fontSize: '14px', color: C.textMuted, marginBottom: '6px', textTransform: 'uppercase' }}>{label}</div>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ width: '100%', padding: '10px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: '8px', color: C.text, fontSize: '16px', boxSizing: 'border-box' }}
      />
    </label>
  );
}

function StatBox({ label, value, color = C.primary }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: '8px', padding: '28px', textAlign: 'center' }}>
      <div style={{ fontSize: '14px', color: C.textMuted, marginBottom: '8px', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: '24px', fontWeight: 700, color }}>{value}</div>
    </div>
  );
}

function SaveButton({ onClick, loading }: { onClick: () => void; loading: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      style={{
        padding: '12px 24px',
        background: C.text,
        color: 'var(--c-on-primary)',
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
