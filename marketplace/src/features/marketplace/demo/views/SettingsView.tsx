'use client';
import { withAlpha } from '@/theme/colors';

import React, { useState } from 'react';
import PitchText from '@/components/PitchText';
import ProfileDetails from '@/components/ProfileDetails';
import PayoutUpi from '@/components/PayoutUpi';
import EmailSettings from '@/components/EmailSettings';
import SetupBanner from '@/components/deal/SetupBanner';
import Link from 'next/link';
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
  successBg: 'var(--c-surface-container)',
  successBorder: 'var(--c-border)',
  warning: 'var(--c-warning)',
  warningBg: 'var(--c-surface-container)',
  warningBorder: 'var(--c-border)',
  danger: 'var(--c-error)',
  dangerBg: 'var(--c-error-container)',
  dangerBorder: 'var(--c-error)',
  accent: 'var(--c-accent)',
  accentBg: 'var(--c-surface-container)',
  accentBorder: 'var(--c-border)',
};

const BRAND_CATEGORIES: Record<string, { name: string; subCategories: string[] }> = {
  'Company Size':  { name: 'Company Size',  subCategories: ['Startup', 'SMB', 'Mid-Market', 'Enterprise', 'Agency', 'Solo Brand', 'Non-Profit', 'Government'] },
};

function getStickerForProfession(profession: string): string | undefined {
  return PROFESSION_BADGES[profession]?.stickerImage || BRAND_CATEGORY_BADGES[profession]?.stickerImage || STICKER_MANIFEST[profession];
}

function Modal({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(17,17,17,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
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
        <div style={{ position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)', background: C.text, color: 'var(--c-surface-lowest)', padding: '10px 20px', borderRadius: '10px', fontSize: '15px', fontWeight: 600, zIndex: 99999, boxShadow: '0 4px 12px rgba(0,0,0,0.25)' }}>
          {purchaseToast}
        </div>
      )}

      <div style={{ padding: '72px 24px 140px', maxWidth: 780, margin: '0 auto' }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, margin: '0 0 56px', color: C.text }}>Settings</h1>

        {/* Details for this account's role, saved to the account. Replaced a
            single "My Profile" form that asked a brand for a full name, an age
            range and a gender, and kept the answers in localStorage. */}
        {/* What still has to be filled in before posting or applying. */}
        <SetupBanner variant="checklist" />

        <ProfileDetails role={role === 'brand' ? 'brand' : 'creator'} />

        {/* Email: seen and changed here, not on another page. */}
        <EmailSettings />

        {/* Both roles can see and change their UPI ID here. A creator's is shown
            to the brand that confirms them; a brand's is shown to nobody. */}
        <div style={{ marginBottom: '56px' }}>
          <div style={{ fontSize: '14px', fontWeight: 700, color: C.textMuted, letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: '16px' }}>UPI ID</div>
          <PayoutUpi role={role === 'brand' ? 'brand' : 'creator'} />
        </div>

        {/* A brand's own words, shown to creators on its resume. */}
        {role === 'brand' && <PitchText role="brand" />}

        {/* ── CREATOR-ONLY SETTINGS ── */}
        {role !== 'brand' && (<>

          {/* Text, saved to the account. Was a photo kept in the browser. */}
          <PitchText role="creator" />

        </>)}
        {/* ── END CREATOR-ONLY SETTINGS ── */}

        {/* Your data: the page that actually exports it and takes deletion requests. */}
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '14px', fontWeight: 700, color: C.textMuted, letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: '16px' }}>
            Your data
          </div>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '12px', padding: '28px' }}>
            <div style={{ fontSize: '15px', color: C.textSecondary, lineHeight: 1.7, marginBottom: '16px' }}>
              Download a copy of your data, or ask for your account to be deleted.
            </div>
            <a href="/account/data" style={{ color: C.text, fontWeight: 600, textDecoration: 'underline', textUnderlineOffset: 3 }}>
              Open your data page
            </a>
          </div>
        </div>

      </div>

    </>
  );
}
