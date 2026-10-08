'use client';
import { withAlpha } from '@/theme/colors';

import React, { useState } from 'react';
import PitchText from '@/components/PitchText';
import ProfileDetails from '@/components/ProfileDetails';
import { PROFESSION_BADGES, BRAND_CATEGORY_BADGES } from '@/features/valueskins/core/identity/AvatarOptions';
import { STICKER_MANIFEST } from '@/features/valueskins/core/stickers/sticker-manifest';
import { getLevel, getProgressToNext } from '@/lib/levels';

// App palette, resolved to the shared theme vars.
//
// This was a hardcoded light-only object — bg '#F5F5F0', text '#0A0A0A',
// a white card, '#8B8B85' muted, '#E0E0DA' borders — so on the dark theme the
// Settings screen rendered a light header bar and light form fields floating on
// a near-black page. That is the same light-panel-in-a-dark-shell bug
// theme/colors.ts warns about, reintroduced locally.
//
// `warning` was also '#F97316', an orange that is not in BRANDING §4; sand
// carries warning state, as it does elsewhere in the product.
//
// Key names are unchanged, so no call site in this file had to move.
const C = {
  onPrimary: 'var(--c-on-primary)', // correct foreground on C.primary in BOTH themes
  primary: 'var(--c-primary)',
  primaryGradient: 'linear-gradient(135deg, var(--c-bg), var(--c-surface-highest))',
  bg: 'var(--c-bg)',
  surface: 'var(--c-surface)',
  surfaceAlt: 'var(--c-surface-container)',
  card: 'var(--c-surface-lowest)',
  text: 'var(--c-text)',
  textSecondary: 'var(--c-text-muted)',
  textMuted: 'var(--c-text-variant)',
  border: 'var(--c-border)',
  borderLight: 'var(--c-border-light)',
  success: 'var(--c-accent)',
  successBg: 'rgba(200, 184, 154, 0.08)',
  successBorder: 'rgba(200, 184, 154, 0.25)',
  warning: 'var(--c-warning)',
  warningBg: 'rgba(200, 184, 154, 0.08)',
  warningBorder: 'rgba(200, 184, 154, 0.25)',
  danger: 'var(--c-error)',
  dangerBg: 'rgba(176, 65, 62, 0.08)',
  dangerBorder: 'rgba(176, 65, 62, 0.25)',
  accent: 'var(--c-accent)',
  accentBg: 'rgba(160, 138, 94, 0.08)',
  accentBorder: 'rgba(160, 138, 94, 0.25)',
};

const BRAND_CATEGORIES: Record<string, { name: string; subCategories: string[] }> = {
  'Company Size':  { name: 'Company Size',  subCategories: ['Startup', 'SMB', 'Mid-Market', 'Enterprise', 'Agency', 'Solo Brand', 'Non-Profit', 'Government'] },
};

function getStickerForProfession(profession: string): string | undefined {
  return PROFESSION_BADGES[profession]?.stickerImage || BRAND_CATEGORY_BADGES[profession]?.stickerImage || STICKER_MANIFEST[profession];
}

function Modal({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: C.card, borderRadius: '20px', padding: '24px', maxWidth: '500px', width: '95vw', maxHeight: '90vh', overflowY: 'auto', position: 'relative' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', color: C.textMuted, fontSize: '24px', cursor: 'pointer', lineHeight: 1 }}>x</button>
        {children}
      </div>
    </div>
  );
}

interface Props {
  role?: 'brand' | 'creator' | 'viewer';
  brandValueSkins?: string[];
  // Shared state — written here, read by hover card + profile sidebar.
  // Optional — falls back to local state when not passed (standalone page usage).
  activeSelectedCountry?: string;
  setSelectedCountry?: (v: string) => void;
  rateCard?: { reel: string; story: string; post: string; podcast: string; live: string };
  setRateCard?: (v: { reel: string; story: string; post: string; podcast: string; live: string } | ((prev: { reel: string; story: string; post: string; podcast: string; live: string }) => { reel: string; story: string; post: string; podcast: string; live: string })) => void;
  creatorAvailableFrom?: string;
  setCreatorAvailableFrom?: (v: string) => void;
  selectedLanguages?: string[];
  setSelectedLanguages?: (v: string[] | ((prev: string[]) => string[])) => void;
  profileDealTypes?: string[];
  setProfileDealTypes?: (v: string[] | ((prev: string[]) => string[])) => void;
  willingToBarter?: boolean;
  setWillingToBarter?: (v: boolean) => void;
  brandProfileSelections?: Record<string, string>;
  setBrandProfileSelections?: (v: Record<string, string> | ((prev: Record<string, string>) => Record<string, string>)) => void;
  skinPitchTexts?: Record<string, string>;
  setSkinPitchTexts?: (v: Record<string, string> | ((prev: Record<string, string>) => Record<string, string>)) => void;
  skinPitchVideos?: Record<string, { url: string; name: string }>;
  setSkinPitchVideos?: (v: Record<string, { url: string; name: string }> | ((prev: Record<string, { url: string; name: string }>) => Record<string, { url: string; name: string }>)) => void;
  creatorEnergy?: string;
  setCreatorEnergy?: (v: string) => void;
  portfolioImage?: string | null;
  setPortfolioImage?: (v: string | null) => void;
  profileName?: string;
  profileBio?: string;
}

export default function SettingsView({
  role = 'creator',
  brandValueSkins: propBrandValueSkins,
  selectedCountry: propSelectedCountry,
  setSelectedCountry: propSetSelectedCountry,
  rateCard: propRateCard,
  setRateCard: propSetRateCard,
  creatorAvailableFrom: propCreatorAvailableFrom,
  setCreatorAvailableFrom: propSetCreatorAvailableFrom,
  selectedLanguages: propSelectedLanguages,
  setSelectedLanguages: propSetSelectedLanguages,
  profileDealTypes: propProfileDealTypes,
  setProfileDealTypes: propSetProfileDealTypes,
  willingToBarter: propWillingToBarter,
  setWillingToBarter: propSetWillingToBarter,
  brandProfileSelections: propBrandProfileSelections,
  setBrandProfileSelections: propSetBrandProfileSelections,
  skinPitchTexts: propSkinPitchTexts,
  setSkinPitchTexts: propSetSkinPitchTexts,
  skinPitchVideos: propSkinPitchVideos,
  setSkinPitchVideos: propSetSkinPitchVideos,
  creatorEnergy: propCreatorEnergy,
  setCreatorEnergy: propSetCreatorEnergy,
  portfolioImage: propPortfolioImage,
  setPortfolioImage: propSetPortfolioImage,
  profileName: propProfileName,
  profileBio: propProfileBio,
}: Props) {
  // ── Fallback local state for shared props ────────────────────────
  const [localCountry, setLocalCountry] = useState('');
  const [localRateCard, setLocalRateCard] = useState({ reel: '', story: '', post: '', podcast: '', live: '' });
  const [localAvailableFrom, setLocalAvailableFrom] = useState('2026-03-01');
  const [localLanguages, setLocalLanguages] = useState<string[]>(['English']);
  const [localDealTypes, setLocalDealTypes] = useState<string[]>(['Paid']);
  const [localBarter, setLocalBarter] = useState(false);
  const [localBrandSelections, setLocalBrandSelections] = useState<Record<string, string>>({});
  const [localPitchTexts, setLocalPitchTexts] = useState<Record<string, string>>({});
  const [localPitchVideos, setLocalPitchVideos] = useState<Record<string, { url: string; name: string }>>({});
  const [localPortfolioImage, setLocalPortfolioImage] = useState<string | null>(null);
  const [localCreatorEnergy] = useState<'available' | 'limited' | 'burnout' | 'pause'>('available');

  // Use prop if provided, else fall back to local
  const activeSelectedCountry = propSelectedCountry ?? localCountry;
  const setActiveSelectedCountry = propSetSelectedCountry ?? setLocalCountry;
  const activeRateCard = propRateCard ?? localRateCard;
  const setActiveRateCard = propSetRateCard ?? setLocalRateCard;
  const activeCreatorAvailableFrom = propCreatorAvailableFrom ?? localAvailableFrom;
  const setActiveCreatorAvailableFrom = propSetCreatorAvailableFrom ?? setLocalAvailableFrom;
  const activeSelectedLanguages = propSelectedLanguages ?? localLanguages;
  const setActiveSelectedLanguages = propSetSelectedLanguages ?? setLocalLanguages;
  const activeProfileDealTypes = propProfileDealTypes ?? localDealTypes;
  const setActiveProfileDealTypes = propSetProfileDealTypes ?? setLocalDealTypes;
  const activeWillingToBarter = propWillingToBarter ?? localBarter;
  const setActiveWillingToBarter = propSetWillingToBarter ?? setLocalBarter;
  const activeBrandProfileSelections = propBrandProfileSelections ?? localBrandSelections;
  const setActiveBrandProfileSelections = propSetBrandProfileSelections ?? setLocalBrandSelections;
  const activeSkinPitchTexts = propSkinPitchTexts ?? localPitchTexts;
  const setActiveSkinPitchTexts = propSetSkinPitchTexts ?? setLocalPitchTexts;
  const activeSkinPitchVideos = propSkinPitchVideos ?? localPitchVideos;
  const setActiveSkinPitchVideos = propSetSkinPitchVideos ?? setLocalPitchVideos;
  const activePortfolioImage = propPortfolioImage ?? localPortfolioImage;
  const setActivePortfolioImage = propSetPortfolioImage ?? setLocalPortfolioImage;
  const activeCreatorEnergy = propCreatorEnergy ?? localCreatorEnergy;

  // ── General (all roles) ──────────────────────────────────────────
  const [creatorSettingsOpen, setCreatorSettingsOpen] = useState<string | null>(null);
  const [purchaseToast, setPurchaseToast] = useState<string | null>(null);

  // ── Brand-only state ─────────────────────────────────────────────

  // ── Creator-only state ───────────────────────────────────────────
  const [notAvailableFrom, setNotAvailableFrom] = useState('');
  const [notAvailableTo, setNotAvailableTo] = useState('');
  const [profileExclusivity, setProfileExclusivity] = useState(false);
  const [profileNda, setProfileNda] = useState(false);
  const [profileUsageRights, setProfileUsageRights] = useState(false);
  const [profileOnCamera, setProfileOnCamera] = useState(true);

  // Skin showcase
  // valueSkins — mock empty map (real data comes from backend)
  const [valueSkins] = useState<Record<string, any>>({});
  const [creatorSkinMode, setCreatorSkinMode] = useState<'static' | 'showcase'>('showcase');
  const [showSkinShowcaseModal, setShowSkinShowcaseModal] = useState<string | null>(null);
  const creatorPitchText = showSkinShowcaseModal ? (activeSkinPitchTexts[showSkinShowcaseModal] ?? '') : '';
  const setCreatorPitchText = (text: string) => { if (showSkinShowcaseModal) setActiveSkinPitchTexts(prev => ({ ...prev, [showSkinShowcaseModal]: text })); };
  const creatorPitchVideoUrl = showSkinShowcaseModal ? (activeSkinPitchVideos[showSkinShowcaseModal]?.url ?? '') : '';
  const creatorPitchVideoName = showSkinShowcaseModal ? (activeSkinPitchVideos[showSkinShowcaseModal]?.name ?? '') : '';
  const setCreatorPitchVideoUrl = (url: string) => { if (showSkinShowcaseModal) setActiveSkinPitchVideos(prev => ({ ...prev, [showSkinShowcaseModal]: { url, name: prev[showSkinShowcaseModal]?.name ?? '' } })); };
  const setCreatorPitchVideoName = (name: string) => { if (showSkinShowcaseModal) setActiveSkinPitchVideos(prev => ({ ...prev, [showSkinShowcaseModal]: { url: prev[showSkinShowcaseModal]?.url ?? '', name } })); };

  // Inbox & safety
  const [creatorAllowedNiches, setCreatorAllowedNiches] = useState<string[]>([]);
  const [creatorBlockedBrands, setCreatorBlockedBrands] = useState<string[]>([]);
  const [creatorShowSafetySettings, setCreatorShowSafetySettings] = useState(false);

  // Rate card
  const [contractMode, setContractMode] = useState<'one-off' | 'long-term' | 'both'>('both');
  const [creatorMaxActiveDeals, setCreatorMaxActiveDeals] = useState(3);
  const [adminShowRateCard] = useState(true);

  // Availability calendar
  const [isFirstDealOpen, setIsFirstDealOpen] = useState(false);
  const [adminShowAvailabilityCalendar] = useState(true);

  // Deal structure defaults
  const [revisionLimit, setRevisionLimit] = useState(2);
  const [usageRightsDays, setUsageRightsDays] = useState(90);
  const [exclusivityUntil, setExclusivityUntil] = useState('');

  // Metrics (for showcase modal)
  const [metrics] = useState({ followers: 18400, engagement: 4.2, dealsCompleted: 17, avgDealValue: 2500, onTimeRate: 96, brandRating: 4.6 });

  const ownedSkins = Object.values(valueSkins).filter(Boolean);
  const ownedSkinsList = Object.entries(valueSkins).filter(([, v]) => v?.profession).map(([, v]) => v!.profession);

  return (
    <>
      {/* Toast */}
      {purchaseToast && (
        <div style={{ position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)', background: C.text, color: 'var(--c-surface-lowest)', padding: '10px 20px', borderRadius: '10px', fontSize: '13px', fontWeight: 600, zIndex: 99999, boxShadow: '0 4px 12px rgba(0,0,0,0.25)' }}>
          {purchaseToast}
        </div>
      )}

      {/* Header */}
      <div style={{ height: '60px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingLeft: '20px', paddingRight: '20px', fontWeight: 'bold', fontSize: '16px', background: C.surface }}>
        <div>
          Settings
          <span style={{ fontSize: '11px', fontWeight: 600, color: C.textSecondary, marginLeft: '10px' }}>ValueSkins preferences</span>
        </div>
      </div>
      <div style={{ padding: '20px' }}>

        {/* Details for this account's role, saved to the account. Replaced a
            single "My Profile" form that asked a brand for a full name, an age
            range and a gender, and kept the answers in localStorage. */}
        <ProfileDetails role={role === 'brand' ? 'brand' : 'creator'} />

        {/* A brand's own words, shown to creators on its resume. */}
        {role === 'brand' && <PitchText role="brand" />}

        {/* ── Brand Profile ── */}
        {role === 'brand' && (
          <div style={{ marginBottom: '24px' }}>
            {(() => {
              const open = creatorSettingsOpen === 'brandProfile';
              return (
                <>
                  <button onClick={() => setCreatorSettingsOpen(open ? null : 'brandProfile')} style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: C.card, border: `1px solid ${C.border}`, borderRadius: open ? '10px 10px 0 0' : '10px', padding: '12px 14px', cursor: 'pointer', color: C.text }}>
                    <span style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase', color: C.textMuted }}>Brand Profile</span>
                    <span style={{ fontSize: '14px', color: C.textMuted }}>{open ? '\u25B2' : '\u25BC'}</span>
                  </button>
                  {open && (
                    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderTop: 'none', borderRadius: '0 0 10px 10px', padding: '14px' }}>
                      <div style={{ fontSize: '11px', color: C.textSecondary, marginBottom: '12px', lineHeight: 1.5 }}>
                        Define your brand profile so creators understand who you are. Select one option from each category.
                      </div>
                      {Object.values(BRAND_CATEGORIES).map((cat) => {
                        const currentSelection = activeBrandProfileSelections[cat.name];
                        return (
                          <div key={cat.name} style={{ marginBottom: '14px' }}>
                            <div style={{ fontSize: '10px', fontWeight: 700, color: C.textMuted, letterSpacing: '0.6px', textTransform: 'uppercase', marginBottom: '8px' }}>{cat.name}</div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                              {cat.subCategories.map((sub) => {
                                const selected = currentSelection === sub;
                                return (
                                  <button
                                    key={sub}
                                    onClick={() => {
                                      setActiveBrandProfileSelections(prev => ({ ...prev, [cat.name]: selected ? '' : sub }));
                                      if (!selected) { setPurchaseToast(`${cat.name}: ${sub}`); setTimeout(() => setPurchaseToast(null), 2000); }
                                    }}
                                    style={{
                                      padding: '5px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: selected ? 600 : 400,
                                      background: selected ? `${withAlpha(C.primary, 0x15)}` : C.bg,
                                      border: `1px solid ${selected ? C.primary : C.border}`,
                                      color: selected ? C.primary : C.textSecondary,
                                      cursor: 'pointer', transition: 'all 0.15s',
                                    }}
                                  >
                                    {sub}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        )}



        {/* ── CREATOR-ONLY SETTINGS ── */}
        {role !== 'brand' && (<>

          {/* Availability */}
          <div style={{ marginBottom: '24px' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: C.textMuted, letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: '12px' }}>
              Availability
            </div>
            <div style={{ fontSize: '11px', color: C.textSecondary, marginBottom: '12px', lineHeight: 1.4 }}>
              You are assumed available for deals at all times. Set dates below only if you are taking a break.
            </div>
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '10px', padding: '14px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', marginBottom: '10px' }}>Not available from</div>
              <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '10px', color: C.textMuted, marginBottom: '4px' }}>From</div>
                  <input type="date" value={notAvailableFrom} onChange={e => setNotAvailableFrom(e.target.value)}
                    style={{ width: '100%', background: C.bg, border: `1px solid ${C.border}`, borderRadius: '8px', color: C.text, padding: '8px 10px', fontSize: '12px', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' as const }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '10px', color: C.textMuted, marginBottom: '4px' }}>To</div>
                  <input type="date" value={notAvailableTo} onChange={e => setNotAvailableTo(e.target.value)}
                    style={{ width: '100%', background: C.bg, border: `1px solid ${C.border}`, borderRadius: '8px', color: C.text, padding: '8px 10px', fontSize: '12px', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' as const }} />
                </div>
              </div>
              {(notAvailableFrom || notAvailableTo) && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: '11px', color: 'var(--c-warning)' }}>
                    You will appear as unavailable during this period.
                  </div>
                  <button onClick={() => { setNotAvailableFrom(''); setNotAvailableTo(''); }}
                    style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: '6px', padding: '4px 10px', fontSize: '10px', color: C.textSecondary, cursor: 'pointer' }}>
                    Clear
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* ── INBOX & SAFETY ── */}
          <div style={{ marginBottom: '16px' }}>
            <button onClick={() => setCreatorShowSafetySettings(p => !p)} style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: C.card, border: `1px solid ${C.border}`, borderRadius: creatorShowSafetySettings ? '10px 10px 0 0' : '10px', padding: '12px 14px', cursor: 'pointer', color: C.text }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={C.textMuted} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                <span style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase', color: C.textMuted }}>Inbox & Safety</span>
              </div>
              <span style={{ fontSize: '14px', color: C.textMuted }}>{creatorShowSafetySettings ? '\u25B2' : '\u25BC'}</span>
            </button>
            {creatorShowSafetySettings && (
              <div style={{ background: C.card, border: `1px solid ${C.border}`, borderTop: 'none', borderRadius: '0 0 10px 10px', padding: '14px' }}>
                {/* ── [v1 COMMENTED OUT] Brand-niche filters — v1 is niche-agnostic (lifestyle & fashion only). See Things-Commented-Out.md. */}
                  {false && <div style={{ marginBottom: '12px' }}>
                  <div style={{ fontSize: '10px', fontWeight: 700, color: C.textMuted, marginBottom: '6px', textTransform: 'uppercase' }}>Only accept proposals from these brand niches</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                    {['Fashion & Beauty Organisation', 'F&B Organisation', 'Travel Organisation', 'Music Organisation', 'Tech Organisation', 'Education Organisation', 'Entertainment Organisation'].map(n => {
                      const active = creatorAllowedNiches.includes(n);
                      return (
                        <button key={n} onClick={() => setCreatorAllowedNiches(prev => active ? prev.filter(x => x !== n) : [...prev, n])}
                          style={{ padding: '3px 9px', borderRadius: '12px', fontSize: '11px', cursor: 'pointer', fontWeight: 600,
                            background: active ? `${withAlpha(C.primary, 0x20)}` : C.bg,
                            color: active ? C.primary : C.textSecondary,
                            border: `1px solid ${active ? C.primary : C.border}`,
                          }}>{n}</button>
                      );
                    })}
                  </div>
                  {creatorAllowedNiches.length === 0 && (
                    <div style={{ fontSize: '10px', color: C.textMuted, marginTop: '4px' }}>None selected = all niches allowed</div>
                  )}
                </div>}
                <div style={{ marginBottom: '4px' }}>
                  <div style={{ fontSize: '10px', fontWeight: 700, color: C.textMuted, marginBottom: '6px', textTransform: 'uppercase' }}>Blocked Brands</div>
                  {creatorBlockedBrands.length === 0 ? (
                    <div style={{ fontSize: '11px', color: C.textMuted, padding: '8px', background: C.bg, borderRadius: '7px', textAlign: 'center' }}>No brands blocked</div>
                  ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                      {creatorBlockedBrands.map(b => (
                        <span key={b} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '12px', fontSize: '11px', background: 'rgba(176, 65, 62,0.1)', color: C.textMuted, border: '1px solid rgba(176, 65, 62,0.2)' }}>
                          {b}
                          <button onClick={() => setCreatorBlockedBrands(prev => prev.filter(x => x !== b))} style={{ background: 'none', border: 'none', color: C.textMuted, cursor: 'pointer', fontSize: '12px', padding: 0, lineHeight: 1 }}>x</button>
                        </span>
                      ))}
                    </div>
                  )}
                  <button onClick={() => { const name = prompt('Block brand name:'); if (name?.trim()) setCreatorBlockedBrands(prev => [...prev, name.trim()]); }}
                    style={{ marginTop: '6px', padding: '5px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 600, background: 'transparent', border: `1px solid ${C.border}`, color: C.textSecondary, cursor: 'pointer' }}>
                    + Block a brand
                  </button>
                </div>
                <div style={{ marginTop: '12px', padding: '9px 11px', background: 'rgba(0,102,204,0.05)', borderRadius: '7px', fontSize: '10px', color: C.textSecondary, lineHeight: 1.6 }}>
                  Platform-level limits set by Meta also apply and cannot be turned off by you. These are your <em>personal</em> controls on top.
                </div>
              </div>
            )}
          </div>

          {/* Text, saved to the account. Was a photo kept in the browser. */}
          <PitchText role="creator" />

        </>)}
        {/* ── END CREATOR-ONLY SETTINGS ── */}

        {/* Privacy & Data Controls */}
        <div style={{ marginBottom: '12px' }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: C.textMuted, letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: '12px' }}>
            Privacy & Data Controls
          </div>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '12px', overflow: 'hidden' }}>
            {[
              { label: 'Download My Data', sub: 'Export all your data in JSON format', action: () => alert('Data export initiated — you will receive an email with download link within 24 hours'), color: C.primary, icon: 'DL' },
              { label: 'Request Data Deletion', sub: 'Permanently erase your account (GDPR Art. 17) — 30 day process', action: () => alert('Data deletion request submitted.\n\nYour account will be anonymized within 30 days as required by GDPR.\nYou can cancel this request within 24 hours.'), color: C.textMuted, icon: 'DEL' },
            ].map(({ label, sub, action, color, icon }, i) => (
              <div
                key={label}
                onClick={action}
                style={{
                  padding: '14px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px',
                  borderBottom: i === 0 ? `1px solid ${C.border}` : 'none',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
              >
                <span style={{ fontSize: '16px' }}>{icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color }}>{label}</div>
                  <div style={{ fontSize: '11px', color: C.textSecondary, marginTop: '1px' }}>{sub}</div>
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.textMuted} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </div>
            ))}
          </div>
        </div>

      </div>

    </>
  );
}
