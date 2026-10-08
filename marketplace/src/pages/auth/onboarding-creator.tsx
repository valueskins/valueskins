'use client';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { C } from '@/theme/colors';
import { PROFESSION_BADGES } from '@/features/valueskins/core/identity/AvatarOptions';

// Creator Setup (Onboarding) — per ui-specs/Creator setup Page.md.
// 5 consolidated steps with a live creator-card preview. Sand accents, no
// emoji, near-black primary button (no gold fill). The onboarding-complete
// API call + payload are UNCHANGED — this is a UI + inputs pass.
const FONT = "'Inter', 'Helvetica Neue', Arial, sans-serif";

type Step = 'role-select' | 'identity' | 'valueskin' | 'howyouwork' | 'rate' | 'review';

interface CreatorOnboarding {
  userRole: 'creator' | 'brand' | '';
  displayName: string;
  location: { city: string; country: string; countryCode: string };
  timezone: string;
  languages: string[];
  ageRange: string;
  socialAccounts: Array<{
    platform: string;
    username: string;
    followerCount: number;
    engagementRate: number;
    audienceDemographics: { ageRanges: string[]; genders: string[] };
  }>;
  website?: string;
  niches: string[];
  contentStyle: string;
  tone: string;
  keywords: string[];
  archetype: string;
  introVideoUrl?: string;
  collaborationOpenness: 'open' | 'selective' | 'closed';
  dealTypes: string[];
  rateCard: { [key: string]: number };
  minDealValue: number;
  negotiable: boolean;
  workingHours: { start: string; end: string };
  shootAvailability: string[];
  travelWilling: boolean;
  travelBudget?: string;
  turnaroundDays: number;
  revisionLimit: number;
  communicationStyle: string;
  equipment: string[];
  hasStudio: boolean;
  personalPreferences: {
    clothingSizes?: string;
    foodAllergies?: string;
    hotelPreferences?: string;
    flightClass?: string;
    accessibility?: string;
  };
  previousCampaigns: Array<{ brand: string; contentType: string; date: string; link?: string }>;
  testimonials: string[];
  exclusivityRestrictions: string[];
  selectedValueSkin: string;
  availabilityStatus: 'open' | 'limited' | 'booked';
}

const LANGUAGE_OPTIONS = ['English', 'Hindi', 'Tamil', 'Telugu', 'Kannada', 'Malayalam', 'Marathi', 'Bengali', 'Gujarati', 'Punjabi'];
const SCRIPT_STYLES = ['Full creative freedom', 'Collaborative script', 'Brand-provided script'];

export default function OnboardingCreator() {
  const router = useRouter();
  const { userId: userIdParam } = router.query;
  const [step, setStep] = useState<Step>('role-select');
  const [loading, setLoading] = useState(false);
  const [skinQuery, setSkinQuery] = useState('');

  const [data, setData] = useState<CreatorOnboarding>({
    userRole: '',
    displayName: '',
    location: { city: '', country: '', countryCode: '' },
    timezone: 'UTC',
    languages: [],
    ageRange: '',
    socialAccounts: [{ platform: 'instagram', username: '', followerCount: 0, engagementRate: 0, audienceDemographics: { ageRanges: [], genders: [] } }],
    niches: [],
    contentStyle: '',
    tone: '',
    keywords: [],
    archetype: '',
    collaborationOpenness: 'open',
    dealTypes: [],
    rateCard: {},
    minDealValue: 0,
    negotiable: true,
    workingHours: { start: '09:00', end: '18:00' },
    shootAvailability: [],
    travelWilling: false,
    turnaroundDays: 5,
    revisionLimit: 2,
    communicationStyle: 'professional',
    equipment: [],
    hasStudio: false,
    personalPreferences: {},
    previousCampaigns: [],
    testimonials: [],
    exclusivityRestrictions: [],
    selectedValueSkin: '',
    availabilityStatus: 'open',
  });

  const handleRoleSelect = (role: 'creator' | 'brand') => {
    if (role === 'brand') {
      router.push('/auth/onboarding-brand');
      return;
    }
    setData({ ...data, userRole: 'creator' });
    setStep('identity');
  };

  // FLOW UNCHANGED — same onboarding-complete payload + skin save as before.
  const handleComplete = async () => {
    setLoading(true);
    try {
      const userId = localStorage.getItem('user_id') || userIdParam;
      const res = await fetch('/api/auth/onboarding-complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': userId as string },
        credentials: 'include',
        body: JSON.stringify({
          role: data.userRole,
          bio: `${data.displayName} - ${data.niches.join(', ')}`,
          location: data.location,
          interests: data.niches,
          skills: data.equipment,
          languages: data.languages,
          contentTypes: Object.keys(data.rateCard),
          audienceAge: data.ageRange,
          audienceGender: '',
          experienceLevel: data.archetype,
          socialMediaAccounts: data.socialAccounts,
          collaborationOpen: data.collaborationOpenness !== 'closed',
          creatorProfile: data,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to complete onboarding');
      }
      await fetch('/api/auth/onboarding-draft', {
        method: 'DELETE',
        headers: { 'x-user-id': userId as string },
      }).catch(() => {});
      if (data.selectedValueSkin) {
        await fetch('/api/skins/manage', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, valueSkin: data.selectedValueSkin }),
        }).catch((e) => console.warn('Failed to save value skin during onboarding:', e));
      }
      router.push('/demo/marketplace');
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const steps: Step[] = data.userRole === 'creator' ? ['identity', 'valueskin', 'howyouwork', 'rate', 'review'] : [];
  const currentStepIndex = steps.indexOf(step as any);

  // Live completion % (spec §2) — how much of the identity is filled.
  const completion = useMemo(() => {
    const checks = [
      !!data.displayName,
      !!data.location.city,
      !!data.selectedValueSkin,
      data.languages.length > 0,
      !!data.contentStyle,
      data.minDealValue > 0,
    ];
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  }, [data]);

  const toggle = (arr: string[], val: string) =>
    arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val];

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px 14px',
    border: '1px solid rgba(160,138,94,0.28)',
    borderRadius: '6px',
    background: C.bg,
    color: C.text,
    fontSize: '1rem',
    fontFamily: FONT,
    marginBottom: '12px',
    boxSizing: 'border-box',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '0.75rem',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: C.textSecondary,
    marginBottom: '8px',
    fontWeight: 600,
  };

  // Sand-selected pill (spec §5 — no green/blue, no gold fill on primary)
  const pill = (selected: boolean): React.CSSProperties => ({
    padding: '8px 14px',
    borderRadius: '6px',
    border: selected ? '1px solid #C8B89A' : '1px solid rgba(160,138,94,0.28)',
    background: selected ? '#C8B89A' : C.bg,
    color: selected ? '#0A0A0A' : C.textSecondary,
    fontSize: '0.8125rem',
    fontWeight: selected ? 600 : 400,
    cursor: 'pointer',
    fontFamily: FONT,
    transition: 'all 0.15s cubic-bezier(0.16,1,0.3,1)',
  });

  // ---- Role select (kept as first step; UI restyled, flow unchanged) ----
  if (step === 'role-select') {
    return (
      <div style={{ minHeight: '100vh', background: C.bg, color: C.text, padding: '20px', fontFamily: FONT }}>
        <div style={{ maxWidth: '600px', margin: '0 auto', paddingTop: '60px' }}>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '12px', textAlign: 'center' }}>Welcome to ValueSkins</h1>
          <p style={{ fontSize: '1rem', color: C.textSecondary, textAlign: 'center', marginBottom: '48px' }}>Are you a creator or a brand?</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            {([
              { role: 'creator' as const, title: 'Creator', desc: 'Share your content and collaborate with brands' },
              { role: 'brand' as const, title: 'Brand', desc: 'Find creators and launch campaigns' },
            ]).map((r) => (
              <button
                key={r.role}
                onClick={() => handleRoleSelect(r.role)}
                style={{ padding: '32px 24px', background: C.surface, border: '1px solid rgba(160,138,94,0.28)', borderRadius: '10px', cursor: 'pointer', textAlign: 'center', fontFamily: FONT }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#C8B89A'; e.currentTarget.style.background = 'rgba(200,184,154,0.05)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(160,138,94,0.28)'; e.currentTarget.style.background = C.surface; }}
              >
                <div style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '8px', color: C.text }}>{r.title}</div>
                <p style={{ fontSize: '0.8125rem', color: C.textSecondary, margin: 0 }}>{r.desc}</p>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const skinEntries = Object.entries(PROFESSION_BADGES).filter(
    ([name, badge]) => !skinQuery || name.toLowerCase().includes(skinQuery.toLowerCase()) || badge.label.toLowerCase().includes(skinQuery.toLowerCase()),
  );
  const selectedBadge = data.selectedValueSkin ? PROFESSION_BADGES[data.selectedValueSkin] : undefined;

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, padding: '20px', fontFamily: FONT }}>
      <div style={{ maxWidth: '980px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 320px', gap: '32px', alignItems: 'start' }}>
        {/* ---- Form column ---- */}
        <div>
          {/* Segmented progress (spec §3) */}
          <div style={{ marginBottom: '32px' }}>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              {steps.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => idx < currentStepIndex && setStep(steps[idx])}
                  style={{ flex: 1, height: '4px', background: idx <= currentStepIndex ? '#C8B89A' : 'rgba(160,138,94,0.22)', border: 'none', borderRadius: '2px', cursor: idx < currentStepIndex ? 'pointer' : 'default', transition: 'background 0.3s' }}
                  aria-label={`Step ${idx + 1}`}
                />
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: C.textSecondary }}>
              <span>Step {currentStepIndex + 1} of {steps.length}</span>
              <span>{Math.round(((currentStepIndex + 1) / steps.length) * 100)}%</span>
            </div>
          </div>

          <div style={{ background: C.surface, border: '1px solid rgba(160,138,94,0.22)', borderRadius: '10px', padding: '32px', marginBottom: '24px' }}>
            {/* Step 1 — Identity */}
            {step === 'identity' && (
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '4px' }}>Identity</h2>
                <p style={{ fontSize: '0.875rem', color: C.textSecondary, marginBottom: '20px' }}>The basics brands see first.</p>
                <label style={labelStyle}>Display name</label>
                <input autoFocus type="text" placeholder="e.g. Anshul Mehta" value={data.displayName} onChange={(e) => setData({ ...data, displayName: e.target.value })} style={inputStyle} />
                <label style={labelStyle}>Instagram handle</label>
                <input
                  type="text"
                  placeholder="@yourhandle"
                  value={data.socialAccounts[0]?.username || ''}
                  onChange={(e) => setData({ ...data, socialAccounts: [{ ...data.socialAccounts[0], platform: 'instagram', username: e.target.value }] })}
                  style={inputStyle}
                />
                <label style={labelStyle}>City</label>
                <input type="text" placeholder="e.g. Bengaluru" value={data.location.city} onChange={(e) => setData({ ...data, location: { ...data.location, city: e.target.value } })} style={inputStyle} />
              </div>
            )}

            {/* Step 2 — Choose your ValueSkin (search + list) */}
            {step === 'valueskin' && (
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '4px' }}>Choose your ValueSkin</h2>
                <p style={{ fontSize: '0.875rem', color: C.textSecondary, marginBottom: '16px' }}>Your profession identity, brands match with you on this.</p>
                <input type="text" placeholder="Search professions…" value={skinQuery} onChange={(e) => setSkinQuery(e.target.value)} style={inputStyle} />
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', maxHeight: '260px', overflowY: 'auto' }}>
                  {skinEntries.map(([name, badge]) => {
                    const sel = data.selectedValueSkin === name;
                    return (
                      <button key={name} onClick={() => setData({ ...data, selectedValueSkin: name })} style={pill(sel)}>
                        {badge.label}
                      </button>
                    );
                  })}
                  {skinEntries.length === 0 && <p style={{ fontSize: '0.8125rem', color: C.textSecondary }}>No professions match “{skinQuery}”.</p>}
                </div>
              </div>
            )}

            {/* Step 3 — How you work (languages + script style) */}
            {step === 'howyouwork' && (
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '4px' }}>How you work</h2>
                <p style={{ fontSize: '0.875rem', color: C.textSecondary, marginBottom: '20px' }}>Languages you create in, and how you like to work with scripts.</p>
                <label style={labelStyle}>Content languages</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '20px' }}>
                  {LANGUAGE_OPTIONS.map((lang) => (
                    <button key={lang} onClick={() => setData({ ...data, languages: toggle(data.languages, lang) })} style={pill(data.languages.includes(lang))}>
                      {lang}
                    </button>
                  ))}
                </div>
                <label style={labelStyle}>Script collaboration style</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {SCRIPT_STYLES.map((s) => (
                    <button key={s} onClick={() => setData({ ...data, contentStyle: s })} style={pill(data.contentStyle === s)}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 4 — Rate & availability */}
            {step === 'rate' && (
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '4px' }}>Rate & availability</h2>
                <p style={{ fontSize: '0.875rem', color: C.textSecondary, marginBottom: '20px' }}>Your starting rate and how open you are to work.</p>
                <label style={labelStyle}>Rate from (₹)</label>
                <input type="number" min={0} placeholder="e.g. 5000" value={data.minDealValue || ''} onChange={(e) => setData({ ...data, minDealValue: Number(e.target.value) || 0 })} style={inputStyle} />
                <label style={labelStyle}>Availability</label>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {(['open', 'limited', 'booked'] as const).map((s) => (
                    <button key={s} onClick={() => setData({ ...data, availabilityStatus: s })} style={pill(data.availabilityStatus === s)}>
                      {s === 'open' ? 'Open' : s === 'limited' ? 'Limited' : 'Booked'}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 5 — Review */}
            {step === 'review' && (
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '4px' }}>You&apos;re set</h2>
                <p style={{ fontSize: '0.875rem', color: C.textSecondary, marginBottom: '20px' }}>Review your identity, then launch your profile.</p>
                <div style={{ fontSize: '0.9375rem', color: C.text, lineHeight: 1.9 }}>
                  <div><span style={{ color: C.textSecondary }}>Name, </span>{data.displayName || '-'}</div>
                  <div><span style={{ color: C.textSecondary }}>City, </span>{data.location.city || '-'}</div>
                  <div><span style={{ color: C.textSecondary }}>ValueSkin, </span>{data.selectedValueSkin || '-'}</div>
                  <div><span style={{ color: C.textSecondary }}>Languages, </span>{data.languages.join(', ') || '-'}</div>
                  <div><span style={{ color: C.textSecondary }}>Rate from, </span>{data.minDealValue ? `₹${data.minDealValue.toLocaleString('en-IN')}` : '-'}</div>
                </div>
              </div>
            )}
          </div>

          {/* Nav — near-black primary (no gold fill, spec §3) */}
          <div style={{ display: 'flex', gap: '12px' }}>
            {currentStepIndex > 0 && (
              <button onClick={() => setStep(steps[currentStepIndex - 1])} style={{ flex: 1, padding: '12px', border: '1px solid rgba(160,138,94,0.28)', background: 'transparent', color: C.text, borderRadius: '6px', cursor: 'pointer', fontFamily: FONT, fontWeight: 500 }}>
                Back
              </button>
            )}
            {currentStepIndex < steps.length - 1 && (
              <button onClick={() => setStep(steps[currentStepIndex + 1])} style={{ flex: 1, padding: '12px', background: C.text, color: C.bg, border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontFamily: FONT }}>
                Continue
              </button>
            )}
            {currentStepIndex === steps.length - 1 && (
              <button onClick={handleComplete} disabled={loading} style={{ flex: 1, padding: '12px', background: C.text, color: C.bg, border: 'none', borderRadius: '6px', cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 600, fontFamily: FONT, opacity: loading ? 0.6 : 1 }}>
                {loading ? 'Launching…' : 'Launch profile'}
              </button>
            )}
          </div>
        </div>

        {/* ---- Live preview card (spec §2) — premium dark, fills as you go ---- */}
        <div style={{ position: 'sticky', top: '20px' }}>
          <div
            style={{
              background: 'linear-gradient(160deg,#0A0A0A,#161512 60%,#20201B)',
              border: '1px solid rgba(200,184,154,0.28)',
              borderRadius: '12px',
              padding: '24px',
              color: '#F5F5F0',
            }}
          >
            <div style={{ fontSize: '0.7rem', letterSpacing: '0.14em', color: '#B8B4AC', marginBottom: '16px' }}>LIVE PREVIEW</div>
            {/* ValueSkin slot */}
            <div
              style={{
                width: '96px',
                height: '96px',
                margin: '0 auto 16px',
                borderRadius: '10px',
                border: '1px solid rgba(200,184,154,0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(255,255,255,0.02)',
                fontSize: '1.5rem',
                fontWeight: 700,
                color: '#C8B89A',
              }}
            >
              {selectedBadge ? selectedBadge.abbreviation : '-'}
            </div>
            <div style={{ textAlign: 'center', fontSize: '1.125rem', fontWeight: 700 }}>{data.displayName || 'Your name'}</div>
            <div style={{ textAlign: 'center', fontSize: '0.8125rem', color: '#B8B4AC', marginBottom: '16px' }}>
              {data.socialAccounts[0]?.username ? `@${data.socialAccounts[0].username.replace(/^@/, '')}` : '@handle'}
              {data.location.city ? ` · ${data.location.city}` : ''}
            </div>
            {data.selectedValueSkin && (
              <div style={{ textAlign: 'center', fontSize: '0.8125rem', color: '#C8B89A', marginBottom: '12px' }}>{data.selectedValueSkin}</div>
            )}
            {data.languages.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', justifyContent: 'center', marginBottom: '12px' }}>
                {data.languages.map((l) => (
                  <span key={l} style={{ fontSize: '0.7rem', color: '#B8B4AC', border: '1px solid rgba(200,184,154,0.25)', borderRadius: '4px', padding: '2px 8px' }}>{l}</span>
                ))}
              </div>
            )}
            {data.minDealValue > 0 && (
              <div style={{ textAlign: 'center', fontSize: '0.8125rem', color: '#F5F5F0' }}>From ₹{data.minDealValue.toLocaleString('en-IN')}</div>
            )}
            <div style={{ marginTop: '18px', borderTop: '1px solid rgba(200,184,154,0.18)', paddingTop: '12px', fontSize: '0.7rem', color: '#B8B4AC', textAlign: 'center' }}>
              {completion}% complete
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
