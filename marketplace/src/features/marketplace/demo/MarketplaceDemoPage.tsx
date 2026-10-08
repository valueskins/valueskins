'use client';
import { C as THEME, withAlpha } from '@/theme/colors';
// ARCHITECTURE: See ARCHITECTURE_GUIDE.txt for codebase overview
// FILE PURPOSE: Creator-Brand Marketplace demo page - shows creator & brand workflow
// ROLE IN SYSTEM: Frontend UI component that displays marketplace, deals, chat, script negotiation
// DATA SOURCE: useDealSync.ts (local state) + api.ts (backend calls)
// OUTPUT: Interactive UI where creators browse offers and negotiate with brands

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useAuth, type Account } from '@/context/AuthContext';
import { getLevel, getProgressToNext } from '@/lib/levels';
import SettingsHub from '@/features/settings/SettingsHub';
import CreatorProfile from '@/features/profiles/CreatorProfile';
import { ValueSkinSprite } from '@/features/profiles/ProfileView';
import CampaignComposer, { CAMPAIGN_DRAFT_KEY } from '@/features/campaigns/CampaignComposer';
import { useReputationConfig } from '@/lib/useConfigStorage';
import { useDealSync, type DealState, type DealRoomPhase, type SharedApplication, type Campaign, type ChatMessage } from '@/features/valueskins/core/deals/useDealSync';
import { useRealtimeRoom } from '@/features/valueskins/core/realtime/useRealtimeRoom';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { apiFetch, backendUrl } from '@/lib/backend';
// Only what this page actually uses. The rest of the workflow client
// (applyToDeal, decideApplication, uploadContent, requestRevision,
// approveContent, cancelDeal) is deliberately not imported here: this page has
// no UI to hang those on, because it was built for the brand-offers model and
// has no "apply" control at all. See the gap list in Things-Commented-Out.md.
import {
  runPaymentStage,
  financials as workflowFinancials,
  type WorkflowStatus,
} from '@/lib/deal-api';
import { useWebSocket } from '@/hooks/useWebSocket';
import {
  type ValueSkinMap,
  type ValueSkinSlot,
  ValueSkinStickers,
  ValueskinAvatarToggle,
  ProfilePhotoWithLongPress,
  PROFESSION_BADGES,
  BRAND_CATEGORY_BADGES,
  defaultAboutMe,
} from '@/features/valueskins/core/identity/AvatarOptions';
import { STICKER_MANIFEST } from '@/features/valueskins/core/stickers/sticker-manifest';
import { TimelineView, DeliverablesView, InvoiceView, ContractView } from '@/components/DealPhaseExtensions';
import { ValueSkinEditModal } from '@/components/ValueSkinEditModal';
import { useUpdateValueSkin } from '@/lib/valueskins/hooks';
import NotificationsView from '@/features/marketplace/demo/views/NotificationsView';
import ExploreView from '@/features/marketplace/demo/views/ExploreView';
import SettingsView from '@/features/marketplace/demo/views/SettingsView';
import MessagesView from '@/features/marketplace/demo/views/MessagesView';
import { HoverCard, InstagramResumeBlock, type HoverProfile, type HoverInstagram } from '@/features/marketplace/demo/components/ProfileHoverCard';
import AppHeader, { type AppView } from '@/features/marketplace/demo/components/AppHeader';

/** Resolve badge from either map — brand categories OR creator professions */
function getBadge(name: string) {
  return BRAND_CATEGORY_BADGES[name] ?? PROFESSION_BADGES[name];
}

/** Get sticker image path for any profession — checks PROFESSION_BADGES, BRAND_CATEGORY_BADGES, then manifest */
function getStickerForProfession(profession: string): string | undefined {
  return PROFESSION_BADGES[profession]?.stickerImage || BRAND_CATEGORY_BADGES[profession]?.stickerImage || STICKER_MANIFEST[profession];
}

// App shell palette. This used to be a hardcoded light-only object with its own
// Tailwind greys, which is exactly why the themed panels (Profile, Settings)
// rendered dark inside a permanently-light shell. It now resolves to the shared
// theme vars, so the whole app follows Settings > Appearance.
// Key names are unchanged, so no call site in this 7k-line file had to move.
const C = {
  onPrimary: THEME.onPrimary, // correct foreground on C.primary in BOTH themes
  primary: THEME.primary,
  primaryGradient: `linear-gradient(135deg, ${THEME.primary}, ${THEME.secondary})`,
  bg: THEME.bg,
  surface: THEME.surface,
  surfaceAlt: THEME.surfaceAlt,
  card: THEME.card,
  text: THEME.text,
  textSecondary: THEME.textSecondary,
  textMuted: THEME.outline,
  border: THEME.border,
  borderLight: THEME.borderLight,
  // Semantic. The old values were #00D46A green, #FFAB00 orange and #ED4956
  // bright red — all three forbidden by BRANDING §4 (sand only, restrained
  // oxblood for errors). They now use the brand tokens.
  success: THEME.success,
  successBg: withAlpha(THEME.success, 0x14),
  successBorder: withAlpha(THEME.success, 0x40),
  warning: THEME.warning,
  warningBg: withAlpha(THEME.warning, 0x14),
  warningBorder: withAlpha(THEME.warning, 0x40),
  danger: THEME.error,
  dangerBg: withAlpha(THEME.error, 0x14),
  dangerBorder: withAlpha(THEME.error, 0x40),
  accent: THEME.accent,
  accentBg: withAlpha(THEME.accent, 0x14),
  accentBorder: withAlpha(THEME.accent, 0x40),
};

// ---- Deal type helpers ----

function resolveDealType(compensationType: string): DealState['dealType'] {
  const ct = (compensationType || '').toLowerCase();
  if (ct.includes('barter') || ct.includes('gifted') || ct.includes('product')) return 'barter';
  return 'paid';
}

function isInternationalDeal(creatorLocation: string, campaignLocation: string): boolean {
  if (!campaignLocation || ['remote','global','worldwide',''].includes(campaignLocation.toLowerCase())) return false;
  return creatorLocation.toLowerCase() !== campaignLocation.toLowerCase();
}

const DEAL_LABELS = {
  paid:       { proposer: 'Brand', receiver: 'Creator' },
  barter:     { proposer: 'Brand', receiver: 'Creator' },
  c2c_paid:   { proposer: 'Proposer', receiver: 'Collaborator' },
  c2c_collab: { proposer: 'Initiator', receiver: 'Collaborator' },
} as const;

const INR_CURRENCY = { code: 'INR', symbol: '₹' };

// System 1: Brand business types — what the brand IS (display-only, no matching logic)
// These are concrete storefront/business types, NOT creator professions.
// EXACTLY 7 brand categories — named DISTINCTLY from creator professions (Systems 2/3)
// so the two systems are never conflated.
const PROFESSIONS: Record<string, { name: string; subProfessions: string[] }> = {
  'Fashion & Beauty Organisation': { name: 'Fashion & Beauty Organisation', subProfessions: ['Fashion & Beauty Organisation'] },
  'F&B Organisation': { name: 'F&B Organisation', subProfessions: ['F&B Organisation'] },
  'Travel Organisation': { name: 'Travel Organisation', subProfessions: ['Travel Organisation'] },
  'Music Organisation': { name: 'Music Organisation', subProfessions: ['Music Organisation'] },
  'Tech Organisation': { name: 'Tech Organisation', subProfessions: ['Tech Organisation'] },
  'Education Organisation': { name: 'Education Organisation', subProfessions: ['Education Organisation'] },
  'Entertainment Organisation': { name: 'Entertainment Organisation', subProfessions: ['Entertainment Organisation'] },
};

// Creator data is now fetched from backend via /api/creators/match
// No hardcoded creators - all creator data comes from the backend API
const BRAND_MARKETPLACE_CREATORS: any[] = [];

// Systems 2/3: Creator professions — used in store for creators (not brands)
// EXACTLY 7 professions, matching PROFESSION_BADGES (source of truth).
const CREATOR_PROFESSIONS: Record<string, { name: string; subProfessions: string[] }> = {
  'Fashion & Beauty': { name: 'Fashion & Beauty', subProfessions: ['Fashion & Beauty'] },
  'Food': { name: 'Food', subProfessions: ['Food'] },
  'Travel': { name: 'Travel', subProfessions: ['Travel'] },
  'Music': { name: 'Music', subProfessions: ['Music'] },
  'Tech': { name: 'Tech', subProfessions: ['Tech'] },
  'Education': { name: 'Education', subProfessions: ['Education'] },
  'Comedy & Entertainment': { name: 'Comedy & Entertainment', subProfessions: ['Comedy & Entertainment'] },
};

const CAMPAIGN_TYPES = ['Product Review', 'Brand Ambassador', 'Sponsored Content', 'Event Coverage', 'Affiliate', 'Whitelabel', 'UGC', 'Podcast'];

// Sensitive content categories requiring explicit disclaimers
const SENSITIVE_CONTENT_KEYWORDS = [
  'health', 'skincare', 'medical', 'doctor', 'dermatolog', 'nutrition', 'diet', 'fitness',
  'mental health', 'therapy', 'supplement', 'vitamin', 'weight loss', 'workout', 'exercise',
  'legal', 'law', 'attorney', 'financial', 'investment', 'crypto', 'tax', 'insurance',
  'beauty', 'cosmetic', 'acne', 'skin condition', 'allerg', 'pharmaceutical'
];

// Helper to detect if content is sensitive
const isSensitiveContent = (text: string): boolean => {
  const lowerText = (text || '').toLowerCase();
  return SENSITIVE_CONTENT_KEYWORDS.some(keyword => lowerText.includes(keyword));
};

// Opportunity type with full brand brief
type Opportunity = {
  campaignId?: number;
  brand: string;
  brandWebsiteUrl?: string;
  type: string;
  match: string;
  featured: boolean;
  willingToBarter: boolean;
  // Brand brief — what the "Ask" button reveals
  about: string;
  budget: string;
  deadline: string;
  applicationDeadline?: string;
  deliverables: { format: string; count: number }[];
  requirements: string[];
  exclusivity: string;
  usageRights: string;
  revisionLimit: number;
  compensationType: string;
  location: string;
  audienceTarget: string;
  paymentSecured?: boolean;
  escrowPool?: number;
  creatorCount?: number;
  contentReview?: 'direct_upload' | 'review_required';
  // Script + other-information captured by the brand in the campaign composer
  scriptMode?: 'non_negotiable' | 'discussion' | 'creator_freedom';
  scriptText?: string;
  scriptFileName?: string;
  shootLocation?: string;
  expectations?: string;
  otherNotes?: string;
  // Point of Contact for the campaign
  poc?: { name: string; workEmail: string; role: string; phone?: string };
};

// Opportunities vary by profession — different brands want different skills
// No hardcoded opportunities — only real brand-created campaigns from shared state appear

// Channels — skin-gated group DMs. These appear alongside regular DMs with a ValueSkin badge.
const CHANNELS: any[] = [];

let razorpayLoadPromise: Promise<void> | null = null;

function ensureRazorpayLoaded(): Promise<void> {
  if (razorpayLoadPromise) return razorpayLoadPromise;
  razorpayLoadPromise = new Promise((resolve, reject) => {
    if (typeof (window as any).Razorpay !== 'undefined') { resolve(); return; }
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Failed to load Razorpay'));
    document.body.appendChild(s);
  });
  return razorpayLoadPromise;
}

export default function MarketplaceDemoPage(initialDealData?: {
  initialCampaigns?: any[];
  initialDealStates?: any;
  initialApplications?: any[];
}) {
  const { account, loading } = useAuth();
  const { connected: wsConnected, send: wsSend, subscribe: wsSubscribe } = useWebSocket();

  const userRole = account?.role;
  const isBrand = userRole === 'brand';
  const isCreator = userRole === 'creator';
  // Per-user localStorage keys — prevents XP/skin data bleeding between accounts
  const uid = account?.id ?? 'anon';
  const SK = {
    valueSkins:   `vs_demo_value_skins_${uid}`,
    persist:      `vs_demo_persist_${uid}`,

    version:      `vs_demo_version_${uid}`,
    dealSync:     `vs_demo_deal_sync_${uid}`,
    negCreator:   `vs_brand_negotiating_creator_${uid}`,
    campaigns:    `vs_demo_campaigns_${uid}`,
    applications: `vs_demo_applications_${uid}`,
  };
  const SKIN_PRICE_RUPEES = 950;

  const recordFakeBankTransaction = (entry: {
    type: 'payment' | 'escrow' | 'payout' | 'refund' | 'transfer';
    description: string;
    amount: number;
    status?: 'completed' | 'pending' | 'failed';
    reference?: string;
  }) => {
    try {
      const stored = localStorage.getItem('fake_bank_ledger');
      const ledger = stored ? JSON.parse(stored) : [];
      ledger.unshift({
        id: `txn_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        timestamp: new Date().toISOString(),
        type: entry.type,
        description: entry.description,
        amount: entry.amount,
        status: entry.status || 'completed',
        reference: entry.reference || `ref_${Date.now()}`,
      });
      localStorage.setItem('fake_bank_ledger', JSON.stringify(ledger));
    } catch (err) {
      console.error('FakeBank record failed:', err);
    }
  };
  const [activeView, setActiveView] = useState<'profile' | 'mim' | 'store' | 'admin' | 'messages' | 'settings' | 'explore' | 'notifications' | 'events'>(() => {

    if (typeof window !== 'undefined') {
      const p = window.location.pathname;
      // ?view=store deep-links to the Store tab, so Settings -> Manage ValueSkins
      // lands on the same store the bottom tab opens. One store, two doors.
      const v = new URLSearchParams(window.location.search).get('view');
      if (v === 'store' || v === 'profile' || v === 'settings' || v === 'mim') {
        return v as 'store' | 'profile' | 'settings' | 'mim';
      }
      if (p === '/feed' || p === '/demo/marketplace' || p === '/') return 'mim';
      if (p === '/explore') return 'explore';
      if (p === '/store') return 'store';
      if (p === '/messages') return 'messages';
      if (p === '/notifications') return 'notifications';
      if (p === '/settings') return 'settings';
      if (p.startsWith('/profile')) return 'profile';
    }
    return 'mim';
  });
  const [isMobile, setIsMobile] = useState(false);
  const [authStatus, setAuthStatus] = useState<'loading' | 'authenticated' | 'unauthenticated'>('loading');

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 480);
    check();
    window.addEventListener('resize', check);
    setAuthStatus('authenticated');

    return () => window.removeEventListener('resize', check);
  }, []);

  // ── Work History: hosted events ──────────────────────────────────

  const [activeTab, setActiveTab] = useState('posts');
  const [isFollowing, setIsFollowing] = useState(false);
  const [likedPosts, setLikedPosts] = useState<number[]>([]);

  // Editable profile
  const [profileName, setProfileName] = useState('');

  useEffect(() => {
    if (account?.display_name) {
      setProfileName(account.display_name);
    }

  }, [account]);
  const [profileBio, setProfileBio] = useState('');
  const [profileAvatar, setProfileAvatar] = useState<string | null>(null);
  const [profileLocation, setProfileLocation] = useState('');
  const [profileEmail, setProfileEmail] = useState('');
  const [profileHeight, setProfileHeight] = useState('');
  const [profileAddress, setProfileAddress] = useState('');
  const [profileWhatTheyDo, setProfileWhatTheyDo] = useState('');
  const [portfolioImage, setPortfolioImage] = useState<string | null>(null);

  // Notifications
  const [notifications, setNotifications] = useState<Array<{ id: number; type: string; text: string; time: string; read: boolean }>>([]);

  // Onboarding
  // Creator profile preview (from brand marketplace)
  const [previewCreator, setPreviewCreator] = useState<typeof BRAND_MARKETPLACE_CREATORS[0] | null>(null);

  // Explore
  const [exploreTab, setExploreTab] = useState<'trending' | 'skins' | 'creators'>('trending');

  // DM messages state — mutable copy so sending works
  const [dmMessages, setDmMessages] = useState<Record<number, Array<{ id: number; sender: 'me' | 'them'; text: string; time: string }>>>({
    1: [
      { id: 1, sender: 'them', text: 'Hey, saw your latest post. Really cool work on the API design!', time: '10:23 AM' },
      { id: 2, sender: 'me', text: 'Thanks! Spent a while getting the pagination right', time: '10:25 AM' },
      { id: 3, sender: 'them', text: 'The cursor-based approach is solid. We switched to that too last quarter', time: '10:26 AM' },
      { id: 4, sender: 'me', text: 'Yeah offset pagination just falls apart at scale', time: '10:28 AM' },
    ],
    2: [
      { id: 1, sender: 'me', text: 'Hey Priya! How did the interview go?', time: '9:15 AM' },
      { id: 2, sender: 'them', text: 'Thanks for the referral! Got the interview.', time: '9:45 AM' },
      { id: 3, sender: 'them', text: 'System design round went really well. They liked my approach to the notification service', time: '9:46 AM' },
    ],
    3: [
      { id: 1, sender: 'them', text: 'Working on a new RAG pipeline. Want to see the architecture?', time: 'Yesterday' },
      { id: 2, sender: 'me', text: 'Definitely, send it over', time: 'Yesterday' },
      { id: 3, sender: 'them', text: 'Sent you the architecture diagram', time: '11:30 AM' },
    ],
    4: [{ id: 1, sender: 'them', text: 'Can we sync on the dataset tomorrow?', time: '2:00 PM' }],
    5: [
      { id: 1, sender: 'them', text: 'Found the issue, misconfigured env var in staging', time: '8:30 AM' },
      { id: 2, sender: 'me', text: 'Nice catch. Push when ready', time: '8:45 AM' },
      { id: 3, sender: 'them', text: 'Pipeline is green now. Pushed the fix.', time: '9:00 AM' },
    ],
    6: [{ id: 1, sender: 'them', text: 'Recipe collab sounds great, let me know the details', time: 'Yesterday' }],
    7: [
      { id: 1, sender: 'them', text: 'Check out this paper on multimodal embeddings', time: '2 days ago' },
      { id: 2, sender: 'me', text: 'Looks interesting, will read tonight', time: '2 days ago' },
    ],
  });

  // Community messages — mutable copy
  const [communityMessages, setCommunityMessages] = useState<Record<number, Array<{ id: number; author: string; handle: string; text: string; time: string }>>>({
    0: [
      { id: 0, author: 'Marcus T.', handle: '@ml_marcus', text: 'Just shipped a RAG pipeline that cut hallucination rate by 60%. Happy to share the architecture.', time: '4h ago' },
      { id: 1, author: 'Priya S.', handle: '@priya_builds', text: 'Monthly hiring board is live, drop your referral links below.', time: '3h ago' },
      { id: 2, author: 'Alex R.', handle: '@alex_codes', text: 'Rust > Go for anything that matters. Fight me.', time: '2h ago' },
    ],
    1: [
      { id: 3, author: 'Dr. Chen', handle: '@drchen', text: 'Interesting presentation today, 34F with atypical chest pain. What would your differential be?', time: '3h ago' },
      { id: 4, author: 'Dr. Williams', handle: '@drwilliams', text: 'CME webinar this Friday at 6PM EST. See you there.', time: '2d ago' },
    ],
    2: [
      { id: 5, author: 'Sam K.', handle: '@samk_ceo', text: 'Lesson from year 3: hire for mindset, train for skill. Churn dropped 40%.', time: '5h ago' },
      { id: 6, author: 'Lin M.', handle: '@lin_builds', text: 'We just crossed ₹8 Cr ARR. Sharing the full breakdown next week. AMA.', time: '1h ago' },
    ],
  });

  // 3-slot ValueSkin state — persisted to localStorage
  const [valueSkins, setValueSkins] = useState<ValueSkinMap>({});
  const [skinsLoaded, setSkinsLoaded] = useState(false);

  // Restore valueSkins from localStorage on mount (wait for auth so uid is stable)
  useEffect(() => {
    if (loading) return;
    try {
      const stored = localStorage.getItem(SK.valueSkins);
      if (stored) setValueSkins(JSON.parse(stored));
    } catch (e) { /* ignore corrupted data */ }
    setSkinsLoaded(true);
  }, [loading, SK.valueSkins]);

  // Persist valueSkins to localStorage — only after initial load
  useEffect(() => {
    if (!skinsLoaded || loading) return;
    try {
      localStorage.setItem(SK.valueSkins, JSON.stringify(valueSkins));
    } catch (e) { /* quota exceeded — safe to ignore */ }
  }, [valueSkins, skinsLoaded, loading]);

  const [valueskinAvatarEnabled, setValueskinAvatarEnabled] = useState(false);
  const [skinPositions, setSkinPositions] = useState<Record<string, {x: number, y: number}>>({});
  const [draggingSkin, setDraggingSkin] = useState<string | null>(null);
  const [hoveringSticker, setHoveringSticker] = useState<string | null>(null);
  const draggingOffset = useRef<{x: number, y: number}>({x: 0, y: 0});
  const dragMoved = useRef(false);
  const profileAreaRef = useRef<HTMLDivElement>(null);
  const dealRoomRef = useRef<HTMLDivElement>(null);
  const [showAvatarSettings, setShowAvatarSettings] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [purchaseToast, setPurchaseToast] = useState<string | null>(null);

  // ── Persist key states to localStorage (only after auth resolves) ──
  useEffect(() => {
    if (loading) return;
    try {
      const s = localStorage.getItem(SK.persist);
      if (s) {
        const d = JSON.parse(s);
        if (d.marketplaceRole) setMarketplaceRole(d.marketplaceRole);
        if (d.brandValueSkins) setBrandValueSkins(d.brandValueSkins);
        if (d.activeBrandSkin) setActiveBrandSkin(d.activeBrandSkin);
        if (d.selectedMarketplaceSkin) setSelectedMarketplaceSkin(d.selectedMarketplaceSkin);
        if (d.profileName) setProfileName(d.profileName);
        if (d.profileBio) setProfileBio(d.profileBio);
        if (d.profileAvatar) setProfileAvatar(d.profileAvatar);
        if (d.selectedCountry) setSelectedCountry(d.selectedCountry);
        if (d.selectedLanguages) setSelectedLanguages(d.selectedLanguages);
        if (d.rateCard) setRateCard(d.rateCard);
        if (d.profileDealTypes) setProfileDealTypes(d.profileDealTypes);
        if (d.willingToBarter !== undefined) setWillingToBarter(d.willingToBarter);
        if (d.notifications) setNotifications(d.notifications);
        if (d.joinedCommunities) setJoinedCommunities(d.joinedCommunities);
        if (d.dmMessages) setDmMessages(d.dmMessages);
        if (d.communityMessages) setCommunityMessages(d.communityMessages);
        if (d.skinPitchTexts) setSkinPitchTexts(d.skinPitchTexts);
        if (d.skinPitchVideos) setSkinPitchVideos(d.skinPitchVideos);
        if (d.brandProfileSelections) setBrandProfileSelections(d.brandProfileSelections);
        if (d.creatorEnergy) setCreatorEnergy(d.creatorEnergy);
        if (d.metrics) setMetrics(d.metrics);
        if (d.skinPositions) setSkinPositions(d.skinPositions);
      }
    } catch (e) { /* ignore */ }
  }, [loading, SK.persist]);

  const { factors } = useReputationConfig();

  const [showMetricsModal, setShowMetricsModal] = useState(false);
  const [showReputationModal, setShowReputationModal] = useState(false);
  // Store is a two-pane master/detail now — the old category modal is gone.
  const [storeCategory, setStoreCategory] = useState<string | null>(null);
  const [storeSearch, setStoreSearch] = useState('');
  const [creatorCounts, setCreatorCounts] = useState<Record<string, number>>({});
  // Set right after a skin is applied, so the profile plays the slap animation.
  // Settings tab: the hub, or the older preferences panel opened from it.
  const [settingsPane, setSettingsPane] = useState<'hub' | 'preferences' | 'creator-preferences'>('hub');

  // ValueSkin edit modal state
  const [showEditValueSkinModal, setShowEditValueSkinModal] = useState(false);
  const [editingValueSkinId, setEditingValueSkinId] = useState<string | null>(null);
  const [editingValueSkinData, setEditingValueSkinData] = useState<any>(null);

  // Marketplace role & gate
  const [marketplaceRole, setMarketplaceRole] = useState<'none' | 'creator' | 'brand'>('none');
  const [brandValueSkins, setBrandValueSkins] = useState<string[]>([]);

  // Auto-set marketplace role based on account role
  useEffect(() => {
    if (isBrand) {
      setMarketplaceRole('brand');
    } else if (isCreator) {
      setMarketplaceRole('creator');
    } else {
      setMarketplaceRole('none');
    }
  }, [isBrand, isCreator]);
  const [activeBrandSkin, setActiveBrandSkin] = useState<string | null>(null);
  const [backendCreators, setBackendCreators] = useState<any[]>([]);
  const [creatorsLoading, setCreatorsLoading] = useState(false);
  const [pendingDealCreatorName, setPendingDealCreatorName] = useState<string | null>(null);

  // Fetch creators from backend API when brand skin changes
  useEffect(() => {
    if (!activeBrandSkin) {
      setBackendCreators([]);
      return;
    }
    setCreatorsLoading(true);
    fetch(`/api/creators/match?brandValueSkin=${encodeURIComponent(activeBrandSkin)}&limit=50`)
      .then(r => r.json())
      .then(d => {
        if (d.creators && Array.isArray(d.creators)) {
          setBackendCreators(d.creators.map((c: any, idx: number) => ({
            ...c,
            valueSkin: activeBrandSkin,
            _origIdx: idx,
            rate: c.rate || '₹0',
            featured: false,
            willingToBarter: true,
          })));
        }
      })
      .catch(e => {
        console.error('Failed to fetch creators:', e);
        setBackendCreators([]);
      })
      .finally(() => setCreatorsLoading(false));
  }, [activeBrandSkin]);

  // [REMOVED] A poll of /api/realtime/state for "pending deals from
  // CampaignDetail bid acceptance". That endpoint does not exist (it 404'd on
  // every mount), and the bidding flow it served was deleted with the
  // no-negotiation decision. Confirmed deals now arrive over the WebSocket.
  // Auto-open deal room when pending deal creator is found in backendCreators
  useEffect(() => {
    if (pendingDealCreatorName && backendCreators.length > 0) {
      const idx = backendCreators.findIndex((c: any) => c.name === pendingDealCreatorName);
      if (idx >= 0) {
        const origIdx = backendCreators[idx]._origIdx ?? idx;
        setNegotiatingCreator(origIdx);
        setPendingDealCreatorName(null);
      }
    }
  }, [backendCreators, pendingDealCreatorName]);

  // Fetch creator counts by profession for store view
  useEffect(() => {
    if (activeView === 'store' && Object.keys(creatorCounts).length === 0) {
      fetch('/api/creators/count-by-profession')
        .then(r => r.json())
        .then(data => {
          if (Array.isArray(data)) {
            const counts: Record<string, number> = {};
            data.forEach((item: any) => {
              counts[item.profession] = item.count;
            });
            setCreatorCounts(counts);
          }
        })
        .catch(e => console.error('Failed to fetch creator counts:', e));
    }
  }, [activeView, creatorCounts]);

  // Fetch all creators for continuous auto-matching (picks up new signups)
  const fetchAllCreators = useCallback(async (force = false) => {
    setAllCreatorsLoading(true);
    try {
      const res = await fetch(`/api/creators/all${force ? '?refresh=true' : ''}`);
      if (res.ok) {
        const data = await res.json();
        if (data.creators && Array.isArray(data.creators)) {
          setAllCreators(data.creators);
        }
      }
    } catch (e) {
      console.error('Failed to fetch all creators:', e);
    } finally {
      setAllCreatorsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAllCreators();
    const interval = setInterval(fetchAllCreators, 30_000);
    return () => clearInterval(interval);
  }, [fetchAllCreators]);

  // Brand ValueSkin as marketing — brands can promote products/campaigns via their skin
  const [brandProfileSelections, setBrandProfileSelections] = useState<Record<string, string>>({});
  const [brandSkinMode, setBrandSkinMode] = useState<'static' | 'promo'>('static');
  const [brandPromoText, setBrandPromoText] = useState('');
  const [brandPromoUrl, setBrandPromoUrl] = useState('');

  // Creator ValueSkin showcase — creators can add a pitch video + text to their skin
  const [creatorSkinMode, setCreatorSkinMode] = useState<'static' | 'showcase'>('showcase');
  // Per-skin pitch text and video — keyed by profession name
  const [skinPitchTexts, setSkinPitchTexts] = useState<Record<string, string>>({});
  const [skinPitchVideos, setSkinPitchVideos] = useState<Record<string, { url: string; name: string }>>({});
  const [showSkinShowcaseModal, setShowSkinShowcaseModal] = useState<string | null>(null); // skin name when open
  // Accessors for the currently open skin showcase
  const creatorPitchText = showSkinShowcaseModal ? (skinPitchTexts[showSkinShowcaseModal] ?? '') : '';
  const setCreatorPitchText = (text: string) => { if (showSkinShowcaseModal) setSkinPitchTexts(prev => ({ ...prev, [showSkinShowcaseModal]: text })); };
  const creatorPitchVideoUrl = showSkinShowcaseModal ? (skinPitchVideos[showSkinShowcaseModal]?.url ?? '') : '';
  const creatorPitchVideoName = showSkinShowcaseModal ? (skinPitchVideos[showSkinShowcaseModal]?.name ?? '') : '';
  const setCreatorPitchVideoUrl = (url: string) => { if (showSkinShowcaseModal) setSkinPitchVideos(prev => ({ ...prev, [showSkinShowcaseModal]: { url, name: prev[showSkinShowcaseModal]?.name ?? '' } })); };
  const setCreatorPitchVideoName = (name: string) => { if (showSkinShowcaseModal) setSkinPitchVideos(prev => ({ ...prev, [showSkinShowcaseModal]: { url: prev[showSkinShowcaseModal]?.url ?? '', name } })); };

  // Ask modal — shows full brand brief for an opportunity
  const [askModalOpp, setAskModalOpp] = useState<Opportunity | null>(null);

  // Which ValueSkin the creator is viewing the marketplace for
  const [selectedMarketplaceSkin, setSelectedMarketplaceSkin] = useState<string | null>(null);
  const [creatorCampaignSearch, setCreatorCampaignSearch] = useState('');

  // Auto-select single skin if only one is owned
  useEffect(() => {
    const ownedProfessions = Object.values(valueSkins)
      .map(entry => entry?.profession)
      .filter(Boolean) as string[];

    if (ownedProfessions.length === 1 && !selectedMarketplaceSkin) {
      setSelectedMarketplaceSkin(ownedProfessions[0]);
    }
  }, [valueSkins, selectedMarketplaceSkin]);

  // Clear stale localStorage on version bump — reset all in-memory state
  useEffect(() => {
    if (loading || typeof window === 'undefined') return;
    const VERSION = 'v2';
    if (localStorage.getItem(SK.version) !== VERSION) {
      localStorage.removeItem(SK.valueSkins);
      localStorage.removeItem(SK.persist);
      localStorage.removeItem(SK.dealSync);
      localStorage.setItem(SK.version, VERSION);
      setValueSkins({});
      setMarketplaceRole('none');
      setBrandValueSkins([]);
      setActiveBrandSkin(null);
      setSelectedMarketplaceSkin(null);
    }
  }, [loading, SK.version, SK.valueSkins, SK.persist, SK.dealSync]);

  // ValueSkin edit handlers
  const { update: updateValueSkin, loading: updateLoading } = useUpdateValueSkin(editingValueSkinId || '');

  const handleOpenEditModal = useCallback((valueSkinId: string, data: any) => {
    setEditingValueSkinId(valueSkinId);
    setEditingValueSkinData(data);
    setShowEditValueSkinModal(true);
  }, []);

  const handleSaveEditValueSkin = useCallback(
    async (updates: any) => {
      if (!editingValueSkinId) return;
      try {
        const result = await updateValueSkin(updates);

        // Update local state immediately with the new profession name
        setValueSkins((prev) => {
          const updated = { ...prev };
          // Find and update the skin with the old profession name
          for (const [key, skin] of Object.entries(updated)) {
            if (skin?.profession === editingValueSkinData.name) {
              updated[key] = {
                ...skin,
                profession: updates.profession || editingValueSkinData.name,
              };
              break;
            }
          }
          return updated;
        });

        // Close modal and reset editing state
        setShowEditValueSkinModal(false);
        setEditingValueSkinId(null);
      } catch (err) {
        console.error('Failed to save ValueSkin:', err);
        throw err;
      }
    },
    [editingValueSkinId, editingValueSkinData, updateValueSkin]
  );

  // Negotiation state — tracks which opportunity/creator has opened negotiation
  const [negotiatingOpp, setNegotiatingOpp] = useState<number | null>(null);
  const [negotiatingCreator, setNegotiatingCreatorRaw] = useState<number | null>(() => {
    if (typeof window === 'undefined') return null;
    const v = localStorage.getItem(SK.negCreator);
    return v !== null ? parseInt(v) : null;
  });
  const setNegotiatingCreator = (v: number | null) => { setNegotiatingCreatorRaw(v); if (v === null) localStorage.removeItem(SK.negCreator); else localStorage.setItem(SK.negCreator, String(v)); };

  const [brandCurrentOppIndex, setBrandCurrentOppIndex] = useState(0);

  // Deal sync hook — bridges localStorage with backend API
  const dealSync = useDealSync(account?.id, initialDealData ? {
    campaigns: initialDealData.initialCampaigns,
    dealStates: initialDealData.initialDealStates,
    applications: initialDealData.initialApplications,
  } : undefined);
  // Shared room — every client sees the same state, live over WebSocket.
  const {
    state: sharedState,
    syncing: sharedSyncing,
    realtimeConnected,
    createCampaign: sharedCreateCampaign,
    updateDeal: sharedUpdateDeal,
    addMessage: sharedAddMessage,
    sendNotification: sharedSendNotification,
    createApplication: sharedCreateApplication,
  } = useRealtimeRoom();
  const { dealStates, setDealStates, getOrCreateDeal, updateDeal: localUpdateDeal } = dealSync;

  // Ref to bridge activeOpportunities declaration order (defined later at line ~2395)
  const activeOppsRef = useRef<any[]>([]);

  // CRITICAL FIX: Sync shared state back to local state for real-time multi-device updates
  useEffect(() => {
    if (sharedState.deals && Object.keys(sharedState.deals).length > 0) {
      setDealStates(prev => {
        const updated: Record<string, DealState> = { ...prev };
        for (const [key, fbDeal] of Object.entries(sharedState.deals)) {
          // Merge remote snapshot under LOCAL state so in-flight typing is never clobbered
          updated[key] = {
            ...((fbDeal as Partial<DealState>) || {}),
            ...(prev[key] || ({} as DealState)),
          };
        }
        return updated;
      });
    }
  }, [sharedState.deals, setDealStates]);

  // Auto-scroll deal room into view when it opens
  useEffect(() => {
    if (negotiatingOpp !== null && dealRoomRef.current) {
      setTimeout(() => {
        dealRoomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }, [negotiatingOpp]);

  // Auto-scroll creator chat
  const chatEndRef = useRef<HTMLDivElement>(null);
  const brandChatEndRef = useRef<HTMLDivElement>(null);
  // Track previous brandDealKey to reset notifications when switching creators

  // Sync shared messages back to local deal state — merge, don't replace
  useEffect(() => {
    if (!sharedState.messages) return;
    let dealKey: string | null = null;
    if (marketplaceRole === 'creator' && selectedMarketplaceSkin && negotiatingOpp !== null) {
      const matchingCreator = backendCreators.find((c: any) => c.valueSkin === selectedMarketplaceSkin);
      if (matchingCreator) {
        dealKey = `${matchingCreator.name}|${selectedMarketplaceSkin}|${negotiatingOpp}`;
      }
    } else if (marketplaceRole === 'brand' && negotiatingCreator !== null) {
      const creator = backendCreators.find((c: any) => c._origIdx === negotiatingCreator);
      if (creator) {
        dealKey = `${creator.name}|${creator.valueSkin}|${brandCurrentOppIndex}`;
      }
    }

    if (!dealKey) return;
    const fbMessages = sharedState.messages[dealKey] || [];
    if (fbMessages.length > 0) {
      setDealStates(prev => {
        const existing = prev[dealKey];
        if (!existing) return { ...prev, [dealKey]: { intent: 'campaign' as const, phase: 'chatroom' as const, briefFilled: true, briefTitle: '', offerAmount: '', counterAmount: '', brandResponseAmount: '', chatMessages: fbMessages as ChatMessage[], chatInput: '', performanceClause: false, advancePercent: 50, approvalPercent: 50 } };
        // Merge: use local messages as base, append any from shared state not already present
        const localMsgs = existing.chatMessages || [];
        const localMap = new Set(localMsgs.map(m => m.id));
        const newFromFb = (fbMessages as ChatMessage[]).filter(m => !localMap.has(m.id));
        if (newFromFb.length === 0) return prev;
        return { ...prev, [dealKey]: { ...existing, chatMessages: [...localMsgs, ...newFromFb] } };
      });
    }
  }, [sharedState.messages, selectedMarketplaceSkin, negotiatingOpp, marketplaceRole, negotiatingCreator, brandCurrentOppIndex, setDealStates, backendCreators]);

  // Sync payment milestones + creator deal lifecycle from dealStates to local UI state (real-time)
  useEffect(() => {
    let dealKey: string | null = null;
    if (marketplaceRole === 'creator' && selectedMarketplaceSkin && negotiatingOpp !== null) {
      const matchingCreator = backendCreators.find((c: any) => c.valueSkin === selectedMarketplaceSkin);
      if (matchingCreator) {
        dealKey = `${matchingCreator.name}|${selectedMarketplaceSkin}|${negotiatingOpp}`;
      }
    } else if (marketplaceRole === 'brand' && negotiatingCreator !== null) {
      const creator = backendCreators.find((c: any) => c._origIdx === negotiatingCreator);
      if (creator) {
        dealKey = `${creator.name}|${creator.valueSkin}|${brandCurrentOppIndex}`;
      }
    }

    if (!dealKey) return;
    const deal = dealStates[dealKey];
    if (!deal) return;
    // Payment milestones: sync from dealStates to local UI state so UI updates in real-time
    if (deal.paymentMilestones) {
      setPaymentMilestones(deal.paymentMilestones);
    }
    // Creator deal lifecycle: sync from dealStates
    if (deal.creatorDealLifecycle) {
      setCreatorDealLifecycle(deal.creatorDealLifecycle as CreatorDealLifecycle);
    }
    // Deliverable statuses: sync from dealStates
    if (deal.deliverableStatuses) {
      setDeliverableStatuses(deal.deliverableStatuses);
    }
    // Brand approval phase: sync from dealStates
    if (deal.brandApprovalPhase) {
      setBrandApprovalPhase(deal.brandApprovalPhase as BrandApprovalPhase);
    }
  }, [marketplaceRole, selectedMarketplaceSkin, negotiatingOpp, negotiatingCreator, brandCurrentOppIndex, dealStates, backendCreators]);

  const updateDeal = useCallback((key: string, updates: Partial<DealState>) => {
    localUpdateDeal(key, updates);
    sharedUpdateDeal(key, updates);
  }, [localUpdateDeal, sharedUpdateDeal]);

  /**
   * Pulls the deal's real status from the server into local state.
   *
   * The server owns the workflow; this page only renders it. Called after any
   * action that changes it, and after a payment — where it matters most,
   * because Razorpay accepting a payment does not advance the deal. The
   * webhook does, and it may not have landed yet, so the status here can still
   * read COMMISSION_PAID one moment later. `pendingPaymentStage` is cleared
   * only once the status actually moves, so the UI keeps saying "confirming"
   * until the money is really recognised.
   */
  const refreshWorkflowStatus = useCallback(async (key: string | null, serverDealId?: string) => {
    if (!key || !serverDealId) return;
    try {
      const res = await fetch(`/api/deals/${serverDealId}/applications`, { credentials: 'include' });
      if (!res.ok) return;
      const data = await res.json();
      const status = data?.workflow_status as WorkflowStatus | undefined;
      if (!status) return;
      const paidStages: Record<string, WorkflowStatus> = {
        commission: 'COMMISSION_PAID',
        advance: 'ADVANCE_PAID',
        remaining: 'COMPLETED',
      };
      const current = (dealStates as any)[key];
      const pending = current?.pendingPaymentStage;
      const settled = pending ? status === paidStages[pending] : false;
      updateDeal(key, {
        workflowStatus: status,
        ...(settled ? { pendingPaymentStage: undefined } : {}),
      });
    } catch (err) {
      // A failed refresh leaves the last known status in place rather than
      // clearing it, so the UI degrades to stale instead of blank.
      console.warn('[workflow] status refresh failed', (err as Error).message);
    }
  }, [dealStates, updateDeal]);
  const dealsLoaded = dealSync.loaded;

  // Active deal key — STABLE across creator/brand for two-device sync
  // In demo: creator always has a counterpart in BRAND_MARKETPLACE_CREATORS (matched by skin)
  // Use: creatorName|creatorSkin to enable cross-party deal lookup
  let activeDealKey: string | null = null;
  if (marketplaceRole === 'creator' && selectedMarketplaceSkin) {
    // Find the creator in backendCreators matching this creator's skin
    const matchingCreator = backendCreators.find((c: any) => c.valueSkin === selectedMarketplaceSkin);
    if (matchingCreator) {
      // PRIMARY: if user explicitly selected an opp, use it (with opportunity index)
      if (negotiatingOpp !== null) {
        activeDealKey = `${matchingCreator.name}|${selectedMarketplaceSkin}|${negotiatingOpp}`;
      }
      // FALLBACK: if no opp selected but there's an active deal with this creator, find it
      else {
        const prefix = `${matchingCreator.name}|${selectedMarketplaceSkin}|`;
        const activeDealKeyFound = Object.keys(dealStates).find(key => key.startsWith(prefix) && dealStates[key]?.phase && dealStates[key]?.phase !== 'brief');
        if (activeDealKeyFound) {
          activeDealKey = activeDealKeyFound;
        }
      }
    } else if (negotiatingOpp !== null) {
      // Fallback: use profileName directly (matches the key format used in View Deal)
      activeDealKey = `${profileName}|${selectedMarketplaceSkin}|${negotiatingOpp}`;
    }
  }

  const activeDeal = activeDealKey ? getOrCreateDeal(activeDealKey) : null;

  // Auto-scroll creator chat to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeDeal?.chatMessages?.length]);

  // Convenience accessors for the active deal (backward compat with existing render code)
  const dealRoomPhase = activeDeal?.phase ?? 'brief';
  const setDealRoomPhase = (p: DealRoomPhase) => {
    if (activeDealKey) {
      updateDeal(activeDealKey, { phase: p });
      // Real-time notification: broadcast phase change to other device/user
      const opp = activeOpportunities[negotiatingOpp ?? 0];
      const phaseNames: Record<DealRoomPhase, string> = {
        brief: 'Deal initiated',
        offer: 'Brand sent offer',
        pending: 'Offer pending',
        counter: 'Creator countered',
        brand_considering: 'Brand reviewing',
        brand_countered: 'Brand countered',
        brand_rejected: 'Brand rejected',
        brand_reviewing: 'Brand reviewing',
        last_offer: 'Last offer',
        rejected: 'Rejected',
        chatroom: 'In negotiation',
        formal_offer: 'Formal offer sent',
        checklist: 'Terms checklist',
        accepted: 'Deal accepted',
        softhold: 'Payment hold',
      };
      sharedSendNotification(opp?.brand || 'Brand', 'application', `${phaseNames[p]} · ${opp?.brand} & you are now at: ${phaseNames[p]}`);
      setPurchaseToast(`Deal moved to: ${phaseNames[p]}`);
      setTimeout(() => setPurchaseToast(null), 2500);
    }
  };
  const dealIntent = activeDeal?.intent ?? 'campaign';
  const setDealIntent = (i: 'explore' | 'campaign' | 'long-term') => { if (activeDealKey) updateDeal(activeDealKey, { intent: i }); };
  const dealBriefFilled = activeDeal?.briefFilled ?? false;
  const setDealBriefFilled = (v: boolean) => { if (activeDealKey) updateDeal(activeDealKey, { briefFilled: v }); };
  const dealBriefTitle = activeDeal?.briefTitle ?? '';
  const setDealBriefTitle = (v: string) => { if (activeDealKey) updateDeal(activeDealKey, { briefTitle: v }); };
  const dealOfferAmount = activeDeal?.offerAmount ?? '';
  const setDealOfferAmount = (v: string) => { if (activeDealKey) updateDeal(activeDealKey, { offerAmount: v }); };
  const dealCounterAmount = activeDeal?.counterAmount ?? '';
  const setDealCounterAmount = (v: string) => { if (activeDealKey) updateDeal(activeDealKey, { counterAmount: v }); };
  const dealBrandResponseAmount = activeDeal?.brandResponseAmount ?? '';

  // Simulate brand reviewing a creator counter-offer.
  // Picks one of four realistic outcomes after a delay (3-6s).
  const simulateBrandResponse = (creatorCounter: number, brandOffer: number, key: string) => {
    const diff = creatorCounter - brandOffer;
    const pct = diff / brandOffer;
    // Determine outcome based on how far the counter is from the original offer
    const rand = Math.random();
    let outcome: 'accept' | 'counter' | 'last_offer' | 'reject';
    if (pct <= 0.05) {
      // Within 5% — brand almost always accepts
      outcome = rand < 0.85 ? 'accept' : 'counter';
    } else if (pct <= 0.2) {
      // 5-20% gap — brand likely counters back
      outcome = rand < 0.15 ? 'accept' : rand < 0.65 ? 'counter' : rand < 0.85 ? 'last_offer' : 'reject';
    } else {
      // >20% gap — brand more likely to push back hard or reject
      outcome = rand < 0.05 ? 'accept' : rand < 0.35 ? 'counter' : rand < 0.65 ? 'last_offer' : 'reject';
    }
    const delay = 3000 + Math.random() * 3000; // 3-6 seconds
    setTimeout(() => {
      if (outcome === 'accept') {
        updateDeal(key, { phase: 'accepted', brandResponseAmount: String(creatorCounter) });
      } else if (outcome === 'counter') {
        // Brand meets halfway
        const midpoint = Math.round((creatorCounter + brandOffer) / 2 / 50) * 50;
        updateDeal(key, { phase: 'brand_countered', brandResponseAmount: String(midpoint) });
      } else if (outcome === 'last_offer') {
        // Brand slightly above original but below midpoint
        const lastOffer = Math.round((brandOffer + (creatorCounter - brandOffer) * 0.25) / 50) * 50;
        updateDeal(key, { phase: 'brand_countered', brandResponseAmount: String(lastOffer) });
      } else {
        updateDeal(key, { phase: 'brand_rejected', brandResponseAmount: '' });
      }
    }, delay);
  };

  const chatMessages = activeDeal?.chatMessages ?? [];
  const setChatMessages = (fn: ((prev: DealState['chatMessages']) => DealState['chatMessages']) | DealState['chatMessages']) => {
    if (!activeDealKey) return;
    setDealStates(prev => {
      const deal = prev[activeDealKey] || getOrCreateDeal(activeDealKey);
      const newMsgs = typeof fn === 'function' ? fn(deal.chatMessages || []) : fn;
      return { ...prev, [activeDealKey]: { ...deal, chatMessages: newMsgs } };
    });
  };
  const chatInput = activeDeal?.chatInput ?? '';
  const setChatInput = (v: string) => { if (activeDealKey) updateDeal(activeDealKey, { chatInput: v }); };
  const performanceClause = activeDeal?.performanceClause ?? false;
  const setPerformanceClause = (v: boolean) => { if (activeDealKey) updateDeal(activeDealKey, { performanceClause: v }); };
  const advancePercent = activeDeal?.advancePercent ?? 50;
  const approvalPercent = activeDeal?.approvalPercent ?? 50;
  const setPaymentSplit = (advance: number, approval: number) => {
    if (activeDealKey) updateDeal(activeDealKey, { advancePercent: advance, approvalPercent: approval });
  };

  // Deal type and workflow-specific accessors
  const dealType = activeDeal?.dealType ?? 'paid';
  const setDealType = (t: DealState['dealType']) => {
    if (activeDealKey) updateDeal(activeDealKey, { dealType: t });
  };
  const goodsTrackerStatus = activeDeal?.goodsTrackerStatus ?? 'goods_preparing';
  const setGoodsTrackerStatus = (s: DealState['goodsTrackerStatus']) => {
    if (activeDealKey) updateDeal(activeDealKey, { goodsTrackerStatus: s });
  };
  const c2cContentStatus = activeDeal?.c2cContentStatus ?? 'content_creating';
  const setC2cContentStatus = (s: DealState['c2cContentStatus']) => {
    if (activeDealKey) updateDeal(activeDealKey, { c2cContentStatus: s });
  };

  const offerExpiresLabel = '23h 47m';

  // Active deals indicator: count of in-progress deals across all skins
  const activeDeals = Object.entries(dealStates).filter(([k, d]) => d.phase !== 'brief' && (marketplaceRole !== 'creator' || !selectedMarketplaceSkin || k.includes(`|${selectedMarketplaceSkin}|`)));

  // Tooltip state for intent/campaign type badges
  const [hoveredTooltip, setHoveredTooltip] = useState<string | null>(null);

  // Energy state (creator)
  const [creatorEnergy, setCreatorEnergy] = useState<'available' | 'limited' | 'burnout' | 'pause'>('available');

  // Deal preference toggles (profile section)
  const [profileDealTypes, setProfileDealTypes] = useState<string[]>(['Paid']);
  const [profileExclusivity, setProfileExclusivity] = useState(false);
  const [profileNda, setProfileNda] = useState(false);
  const [profileUsageRights, setProfileUsageRights] = useState(false);
  const [profileOnCamera, setProfileOnCamera] = useState(true);

  // Not available dates (vacation / break)
  const [notAvailableFrom, setNotAvailableFrom] = useState('');
  const [notAvailableTo, setNotAvailableTo] = useState('');
  const [creatorSettingsOpen, setCreatorSettingsOpen] = useState<'location' | 'identity' | 'audience' | 'deals' | null>(null);
  // Soft hold active
  const [softHoldActive, setSoftHoldActive] = useState(false);

  // Creator pricing (editable in marketplace)
  const [creatorRate, setCreatorRate] = useState('5000');

  // Brand offer details (editable in marketplace)
  const [brandBudget, setBrandBudget] = useState('4000');
  const [brandCampaignDesc, setBrandCampaignDesc] = useState('Looking for authentic content creators to showcase our product');
  const [brandCampaignType, setBrandCampaignType] = useState('Product Review');

  // Brand-side deal room state — uses dealStates for real-time sync (was: localStorage-only)
  // Key format MUST match creator side: creatorName|creatorSkin
  const getBrandDealKey = useCallback(() => {
    if (negotiatingCreator === null) return null;
    const creator = backendCreators.find((c: any) => c._origIdx === negotiatingCreator);
    if (!creator) return null;
    // Format: creatorName|creatorSkin|oppIndex — includes opportunity context for multi-deal support
    return `${creator.name}|${creator.valueSkin}|${brandCurrentOppIndex}`;
  }, [negotiatingCreator, brandCurrentOppIndex, backendCreators]);

  const brandDealKey = getBrandDealKey();
  const brandDeal = brandDealKey ? getOrCreateDeal(brandDealKey) : null;

  // Auto-scroll brand chat to bottom on new messages
  const brandChatMsgLen = brandDeal?.chatMessages?.length ?? 0;
  useEffect(() => {
    brandChatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [brandChatMsgLen]);

  // AUTO-SYNC: Brand side — when switching to brand role, sync to active deal from creator side
  useEffect(() => {
    if (marketplaceRole === 'brand' && negotiatingCreator === null && activeDealKey) {
      // Extract creator index and opp from activeDealKey when switching from creator to brand
      const parts = activeDealKey.split('|');
      if (parts.length === 3) {
        const creatorName = parts[0];
        const skinName = parts[1];
        const oppIdx = parseInt(parts[2]);
        const creatorIdx = backendCreators.findIndex((c: any) => c.name === creatorName && c.valueSkin === skinName);
        if (creatorIdx >= 0) {
          setNegotiatingCreator(creatorIdx);
          setBrandCurrentOppIndex(oppIdx);
        }
      }
    }
  }, [marketplaceRole, activeDealKey, negotiatingCreator, dealStates]);

  // AUTO-SYNC: Creator side — auto-open active deal when navigating to marketplace
  useEffect(() => {
    if (marketplaceRole === 'creator' && selectedMarketplaceSkin && negotiatingOpp === null) {
      const matchingCreator = backendCreators.find((c: any) => c.valueSkin === selectedMarketplaceSkin);
      if (matchingCreator) {
        // Find first active deal for this creator+skin combo (new format: creatorName|creatorSkin|oppIndex)
        const prefix = `${matchingCreator.name}|${selectedMarketplaceSkin}|`;
        const activeDealKey = Object.keys(dealStates).find(key => key.startsWith(prefix) && dealStates[key]?.phase && dealStates[key]?.phase !== 'brief');
        if (activeDealKey) {
          const oppIndex = parseInt(activeDealKey.split('|')[2] || '0');
          setNegotiatingOpp(oppIndex);
        }
      }
    }
  }, [marketplaceRole, selectedMarketplaceSkin, negotiatingOpp, dealStates]);

  // AUTO-SYNC: Brand side should find open deals if they reload without negotiatingCreator set
  useEffect(() => {
    if (marketplaceRole === 'brand' && negotiatingCreator === null) {
      // Search through all deals to find one that has been initiated by a creator
      for (const [key, deal] of Object.entries(dealStates)) {
        if (deal && deal.phase !== 'brief' && deal.creatorMarketplaceIndex !== undefined) {
          // Found an active deal, auto-switch to it
          setNegotiatingCreator(deal.creatorMarketplaceIndex);
          // Also restore the correct opportunity index from the deal key
          const oppIdx = parseInt(key.split('|')[2] || '0');
          setBrandCurrentOppIndex(oppIdx);
          break; // Only auto-open the first active deal
        }
      }
    }
  }, [dealStates, marketplaceRole, negotiatingCreator]);

  // Use dealStates phase, fallback to 'brief' if no deal yet
  const brandDealPhase = (brandDeal?.phase as any) || 'brief';
  const setBrandDealPhase = (p: DealRoomPhase) => {
    if (!brandDealKey) return;
    updateDeal(brandDealKey, { phase: p });
  };
  const [brandDealIntent, setBrandDealIntent] = useState<'explore' | 'campaign' | 'long-term'>('campaign');
  const [brandBriefTitle, setBrandBriefTitle] = useState('');
  const [brandBriefDeliverables, setBrandBriefDeliverables] = useState('');
  const [brandBriefAbout, setBrandBriefAbout] = useState('');
  const [brandBriefCampaignDesc, setBrandBriefCampaignDesc] = useState('');
  const [brandOfferNonNegotiable, setBrandOfferNonNegotiable] = useState(false);
  const [brandCounterAmount, setBrandCounterAmount] = useState('');
  const [brandChatInput, setBrandChatInput] = useState('');
  const [brandSoftHoldHours, setBrandSoftHoldHours] = useState<24 | 48 | 72>(48);

  // Auto-matching — now computed live via campaignMatches useMemo
  const [creatorNotifications, setCreatorNotifications] = useState<Array<any>>([]);
  // Read the creator's counter amount from shared deal state (set by creator's counter-offer handler)
  const brandDealCounterAmount = brandDeal?.counterAmount || '';
  // Agreed amount = latest counter or original offer
  const agreedDealAmount = brandDealCounterAmount || brandDeal?.offerAmount || brandBudget || '5000';
  const downloadDealSummary = useCallback((dealKey: string, deal: any) => {
    if (typeof window === 'undefined' || !deal) return;
    const nowIso = new Date().toISOString();
    const agreedAmount = deal.agreementAmount || deal.counterAmount || deal.offerAmount || agreedDealAmount || '0';
    const messages = (deal.chatMessages || []) as Array<{ sender?: string; text?: string; time?: string; isoTime?: string }>;
    const deliverableLinks = (deal.deliverableLinks || {}) as Record<number, string>;
    const statuses = (deal.deliverableStatuses || {}) as Record<number, string>;
    const milestones = deal.paymentMilestones || { advance: 'pending', approval: 'pending' };
    const lines = [
      'VALUESKINS DEAL SUMMARY (EVIDENCE RECORD)',
      '----------------------------------------',
      `Generated At: ${nowIso}`,
      `Deal Key: ${dealKey}`,
      `Final Status: ${deal.creatorDealLifecycle === 'approved' || deal.brandApprovalPhase === 'approved' ? 'Approved and Deal Completed' : 'In Progress'}`,
      '',
      'PARTIES',
      `Creator: ${deal.creatorName || 'N/A'}`,
      `Brand: ${deal.brandName || profileName || 'N/A'}`,
      `Creator Skin: ${deal.creatorSkin || selectedMarketplaceSkin || 'N/A'}`,
      '',
      'COMMERCIAL TERMS',
      `Agreed Amount (INR): ${agreedAmount}`,
      `Deal Type: ${deal.dealType || 'paid'}`,
      `Offer Amount: ${deal.offerAmount || 'N/A'}`,
      `Counter Amount: ${deal.counterAmount || 'N/A'}`,
      `Agreement Amount: ${deal.agreementAmount || 'N/A'}`,
      '',
      'PAYMENT MILESTONES',
      `Advance: ${milestones.advance || 'pending'}`,
      `Approval: ${milestones.approval || 'pending'}`,
      '',
      'DELIVERABLES SUBMITTED',
      ...(Object.keys(deliverableLinks).length > 0
        ? Object.entries(deliverableLinks).map(([idx, link]) => `#${parseInt(idx) + 1} | Status: ${statuses[parseInt(idx)] || 'uploaded'} | Link: ${link}`)
        : ['None']),
      '',
      'CHAT / NEGOTIATION LOG',
      ...(messages.length > 0
        ? messages.map((m, i) => `${i + 1}. [${m.isoTime || m.time || 'N/A'}] ${String(m.sender || 'unknown').toUpperCase()}: ${m.text || ''}`)
        : ['No messages recorded']),
      '',
      'LEGAL NOTE',
      'This document is an exported platform summary for dispute review and record-keeping.',
    ];

    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `valueskins-deal-summary-${dealKey.replace(/\|/g, '-')}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, [agreedDealAmount, profileName, selectedMarketplaceSkin]);

  // Messages state (DMs + Communities)
  const [messagesTab, setMessagesTab] = useState<'dms' | 'communities' | 'create'>('dms');
  const [activeCommunity, setActiveCommunity] = useState<number | null>(null);
  const [activeDmId, setActiveDmId] = useState<number | null>(null);
  const [joinedCommunities, setJoinedCommunities] = useState<number[]>([]);
  const [newCommName, setNewCommName] = useState('');
  const [newCommDesc, setNewCommDesc] = useState('');
  const [newCommVisibility, setNewCommVisibility] = useState<'public' | 'private'>('public');
  const [newCommGateType, setNewCommGateType] = useState<'any_valueskin' | 'specific'>('any_valueskin');
  const [newCommProfessions, setNewCommProfessions] = useState<string[]>([]);
  const [dmInput, setDmInput] = useState('');
  // Settings state
  const [selectedCountry, setSelectedCountry] = useState('');
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>(['English']);
  // Admin pricing
  const [communityTierCredits, setCommunityTierCredits] = useState(0);
  const [marketplaceTierCredits, setMarketplaceTierCredits] = useState(100);
  const [platformCommissionPct, setPlatformCommissionPct] = useState(12); // Platform commission % per deal
  const [commissionPaidBy, setCommissionPaidBy] = useState<'brand' | 'creator'>('brand'); // Who pays the commission

  // Admin-configurable insight visibility
  const [visibleInsights, setVisibleInsights] = useState<Record<string, boolean>>({
    score: true,
    engagement: true,
    onTime: true,
    deals: true,
    rating: true,
    trustLevel: true,
    breakdown: true,
  });

  // Creator reputation & verification
  const [showCredentialForm, setShowCredentialForm] = useState(false);
  const [credentials, setCredentials] = useState<{ platform: string; handle: string }[]>([]);
  const [identityProofs, setIdentityProofs] = useState<Array<{platform: string; handle: string; verified: boolean}>>([]);
  const [resolvedFraudSignals, setResolvedFraudSignals] = useState<number[]>([]);
  // Safety system — Meta admin controls
  const [safetyDmRateLimit, setSafetyDmRateLimit] = useState(10);
  const [safetyMinBrandTrust, setSafetyMinBrandTrust] = useState(3);
  const [safetyRequireVerifiedBrand, setSafetyRequireVerifiedBrand] = useState(true);
  const [safetyRequireBrief, setSafetyRequireBrief] = useState(true);
  const [safetyReportThreshold, setSafetyReportThreshold] = useState(3);
  const [safetyRecontactCooldown, setSafetyRecontactCooldown] = useState(30);
  const [safetyProposalFormOnly, setSafetyProposalFormOnly] = useState(true);
  const [safetyOffPlatformBlock, setSafetyOffPlatformBlock] = useState(true);
  const [safetyNewBrandWarmIntro, setSafetyNewBrandWarmIntro] = useState(true);
  type DealCommMode = 'valueskins_chatroom' | 'platform_dms';
  const [dealCommMode, setDealCommMode] = useState<DealCommMode>('valueskins_chatroom');
  const [safetyNewBrandDealCount, setSafetyNewBrandDealCount] = useState(0);
  const [savedSafetyToast, setSavedSafetyToast] = useState(false);
  // Creator-side safety controls
  const [creatorAllowedNiches, setCreatorAllowedNiches] = useState<string[]>([]);
  const [creatorBlockedBrands, setCreatorBlockedBrands] = useState<string[]>([]);
  const [creatorShowSafetySettings, setCreatorShowSafetySettings] = useState(false);
  const [activeDisputeStage, setActiveDisputeStage] = useState<number | null>(null);
  const [disputeReason, setDisputeReason] = useState('');
  const [disputeEvidenceUrls, setDisputeEvidenceUrls] = useState<string[]>(['']);

  // Barter/exposure toggle — managed in Settings, stored server-side
  const [willingToBarter, setWillingToBarter] = useState(false);
  const [filterBarterOnly, setFilterBarterOnly] = useState(false);
  const [filterOppsBarterOnly, setFilterOppsBarterOnly] = useState(false);

  const [sharedNotifications, setSharedNotifications] = useState<Array<{id: string; type: 'campaign' | 'application' | 'message'; message: string; createdAt: number; read: boolean}>>([]);

  // Brand field filter — which ValueSkin profession the brand wants to target
  const [brandSearchQuery, setBrandSearchQuery] = useState('');
  const [brandSearchMode, setBrandSearchMode] = useState<'profession' | 'name' | 'general'>('profession');
  const [filterAudienceAge, setFilterAudienceAge] = useState<string | null>(null);
  const [filterAudienceLang, setFilterAudienceLang] = useState<string | null>(null);
  const [filterAudienceLoc, setFilterAudienceLoc] = useState('');
  const [filterMinDeal, setFilterMinDeal] = useState('');
  const [filterDealType, setFilterDealType] = useState<string | null>(null);
  const [filterResponseMax, setFilterResponseMax] = useState<number | null>(null);
  const [showAudienceFilters, setShowAudienceFilters] = useState(false);

  // Rate card
  const [rateCard, setRateCard] = useState({ reel: '', story: '', post: '', podcast: '', live: '' });
  const [creatorAvailableFrom, setCreatorAvailableFrom] = useState('2026-03-01');
  const [creatorMaxActiveDeals, setCreatorMaxActiveDeals] = useState(3);
  const [contractMode, setContractMode] = useState<'one-off' | 'long-term' | 'both'>('both');
  const [dealCompletionRate] = useState(94);
  const [verifiedIncomeTier] = useState<'starter' | '10k+' | '50k+' | '100k+'>('50k+');
  const [isFirstDealOpen, setIsFirstDealOpen] = useState(false);
  const [showRateCard, setShowRateCard] = useState(false);
  const [showPortfolio, setShowPortfolio] = useState(false);
  const [usageRightsDays, setUsageRightsDays] = useState(90);
  const [exclusivityUntil, setExclusivityUntil] = useState('');
  const [revisionLimit, setRevisionLimit] = useState(2);

  // Admin feature flags
  const [adminShowRateCard, setAdminShowRateCard] = useState(true);
  const [adminShowPortfolio, setAdminShowPortfolio] = useState(true);
  const [adminShowDealCompletion, setAdminShowDealCompletion] = useState(true);
  const [adminShowIncomeTier, setAdminShowIncomeTier] = useState(true);
  const [adminShowFirstDealBadge, setAdminShowFirstDealBadge] = useState(true);
  const [adminShowExclusivitySignal, setAdminShowExclusivitySignal] = useState(true);
  const [adminShowRevisionLimit, setAdminShowRevisionLimit] = useState(true);
  const [adminShowUsageRightsDuration, setAdminShowUsageRightsDuration] = useState(true);
  const [adminShowAvailabilityCalendar, setAdminShowAvailabilityCalendar] = useState(true);
  const [adminShowSimilarCreators, setAdminShowSimilarCreators] = useState(true);
  const [adminShowBrandTrackRecord, setAdminShowBrandTrackRecord] = useState(true);
  const [adminShowMutualRating, setAdminShowMutualRating] = useState(true);
  const [adminAllowLongTermContracts, setAdminAllowLongTermContracts] = useState(true);
  const [adminSavedFeaturesTab, setAdminSavedFeaturesTab] = useState(false);

  // Campaigns + applications — from deal sync hook (API-backed with localStorage fallback)
  const { applications: sharedApplications, setApplications: setSharedApplications, campaigns, setCampaigns } = dealSync;

  // ── Real-time WebSocket subscription: live deal + campaign updates ──
  useEffect(() => {
    if (!wsConnected) return;

    const unsubs = [
      wsSubscribe('deal_updated', (msg) => {
        const deal = msg.deal as Partial<DealState> | undefined;
        const key = msg.deal_key as string | undefined;
        if (deal && key) {
          setDealStates(prev => ({ ...prev, [key]: { ...prev[key], ...deal } as DealState }));
        }
      }),
      wsSubscribe('campaign_updated', (msg) => {
        const campaign = msg.campaign as Campaign | undefined;
        if (campaign) {
          setCampaigns(prev => {
            const idx = prev.findIndex(c => c.id === campaign.id);
            if (idx >= 0) { const next = [...prev]; next[idx] = campaign; return next; }
            return [...prev, campaign];
          });
        }
      }),
      wsSubscribe('application_updated', (msg) => {
        const app = msg.application as SharedApplication | undefined;
        if (app) {
          setSharedApplications(prev => {
            const idx = prev.findIndex((a: any) => a.id === app.id);
            if (idx >= 0) { const next = [...prev]; next[idx] = app as any; return next; }
            return [...prev, app as any];
          });
        }
      }),
      wsSubscribe('notification', (msg) => {
        const notif = msg.notification as { title: string; message: string } | undefined;
        if (notif) {
          setNotifications(prev => [notif as any, ...prev]);
        }
      }),
    ];

    return () => unsubs.forEach(u => u());
  }, [wsConnected, wsSubscribe, setDealStates, setCampaigns, setSharedApplications, setNotifications]);

  const forceRefreshCampaigns = useCallback(async () => {
    try {
      // Pull latest from shared DB (update in-place, don't append-only).
      const res = await fetch('/api/realtime/state');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.campaigns)) {
          setCampaigns(prev => {
            const dbCampaigns = data.campaigns as Campaign[];
            const localMap = new Map(prev.map(c => [c.id, c]));

            // Update existing or add new campaigns
            let hasChanges = false;
            dbCampaigns.forEach(dbCampaign => {
              const localCampaign = localMap.get(dbCampaign.id);
              if (!localCampaign || JSON.stringify(localCampaign) !== JSON.stringify(dbCampaign)) {
                localMap.set(dbCampaign.id, dbCampaign);
                hasChanges = true;
              }
            });

            if (!hasChanges) return prev;
            return Array.from(localMap.values());
          });
        }
      }
    } catch (e) {
      console.error('Failed to refresh campaigns:', e);
    }
  }, [setCampaigns]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchAllCreators(true), forceRefreshCampaigns()]);
    setRefreshing(false);
  }, [fetchAllCreators, forceRefreshCampaigns]);

  // Merge shared campaigns into local state (cross-device sync)
  // Updates existing campaigns and adds new ones for real-time visibility
  // Also persist to localStorage for cross-session persistence
  useEffect(() => {
    if (sharedState.campaigns.length > 0) {
      setCampaigns(prev => {
        const fbCampaigns = sharedState.campaigns as Campaign[];
        const localMap = new Map(prev.map(c => [c.id, c]));

        // Update existing or add new campaigns
        let hasChanges = false;
        fbCampaigns.forEach(fbCampaign => {
          const localCampaign = localMap.get(fbCampaign.id);
          if (!localCampaign || JSON.stringify(localCampaign) !== JSON.stringify(fbCampaign)) {
            localMap.set(fbCampaign.id, fbCampaign);
            hasChanges = true;
          }
        });

        if (!hasChanges) return prev;
        const updated = Array.from(localMap.values());
        // Persist to localStorage
        localStorage.setItem('valueskins_campaigns', JSON.stringify(updated));
        return updated;
      });
    }
  }, [sharedState.campaigns, setCampaigns]);

  // On mount, load campaigns from localStorage for persistence across sessions
  useEffect(() => {
    const stored = localStorage.getItem('valueskins_campaigns');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setCampaigns(parsed);
        }
      } catch (e) {
        // Invalid JSON, ignore
      }
    }
    // Pull the latest campaigns from shared state on load so previously-created
    // campaigns render immediately without having to create a new one first.
    forceRefreshCampaigns();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Shared state always active
    if (sharedState.applications.length > 0) {
      setSharedApplications(sharedState.applications as SharedApplication[]);
    }
  }, [sharedState.applications, setSharedApplications]);

  // Sync deal states from shared state (other device's deal updates appear here)
  useEffect(() => {
    // Shared state always active
    const fbDeals = sharedState.deals;
    if (Object.keys(fbDeals).length > 0) {
      setDealStates(prev => {
        const merged = { ...prev };
        for (const [key, deal] of Object.entries(fbDeals)) {
          const mergedDeal = { ...merged[key], ...(deal as Partial<DealState>) } as DealState;
          mergedDeal.chatMessages = Array.isArray(mergedDeal.chatMessages) ? mergedDeal.chatMessages : [];
          merged[key] = mergedDeal;
        }
        return merged;
      });
    }
  }, [sharedState.deals]);

  // Sync shared messages into deal chatMessages
  useEffect(() => {
    const fbMessages = sharedState.messages;
    if (Object.keys(fbMessages).length > 0) {
      setDealStates(prev => {
        const merged: Record<string, DealState> = { ...prev };
        for (const [dealKey, msgs] of Object.entries(fbMessages)) {
          const existing = merged[dealKey] || ({} as DealState);
          merged[dealKey] = {
            ...existing,
            chatMessages: Array.isArray(msgs) ? msgs as ChatMessage[] : [],
          } as DealState;
        }
        return merged;
      });
    }
  }, [sharedState.messages]);

  // Sync shared notifications
  useEffect(() => {
    // Shared state always active
    if (sharedState.notifications.length > 0) {
      setSharedNotifications(sharedState.notifications);
      const newNotifs = sharedState.notifications.filter((n: any) => !n.read);
      if (newNotifs.length > 0) {
        newNotifs.forEach((n: any) => {
          const msg = n.type === 'campaign' ? `New campaign: ${n.message}` : n.type === 'application' ? `New application: ${n.message}` : `Message: ${n.message}`;
          setNotifications(prev => [{ id: parseInt(n.id) || Date.now(), type: n.type, text: msg, time: 'just now', read: false }, ...prev.slice(0, 9)]);
          // Feature 3: Show toast notification
          setPurchaseToast(msg);
          setTimeout(() => setPurchaseToast(null), 4000);
        });
      }
    }
  }, [sharedState.notifications]);

  // No seeded campaigns or applications — only real data from shared state

  const [marketplaceTab, setMarketplaceTab] = useState<'creators' | 'campaigns' | 'applications' | 'sent'>('creators');
  // All creators across all professions — used for continuous live auto-matching
  const [allCreators, setAllCreators] = useState<any[]>([]);
  const [allCreatorsLoading, setAllCreatorsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hiddenSentDealIds, setHiddenSentDealIds] = useState<Set<number>>(new Set());
  const [showCampaignCreator, setShowCampaignCreator] = useState(false);
  // Scroll target for the brand dashboard "View Past Campaigns" button
  const brandPastRef = useRef<HTMLDivElement | null>(null);

  // Barter goods tracker and international compliance states
  const [goodsTrackingInput, setGoodsTrackingInput] = useState('');
  const [intlTaxAcknowledged, setIntlTaxAcknowledged] = useState(false);

  // Payment milestone states — tracks which stages have been released
  const [advanceReleased, setAdvanceReleased] = useState(false);

  const [approvalReleased, setApprovalReleased] = useState(false);

  // Communities creation state
  const [showCreateCommunity, setShowCreateCommunity] = useState(false);
  const [newCommunityName, setNewCommunityName] = useState('');
  const [newCommunityDescription, setNewCommunityDescription] = useState('');
  const [newCommunityGateType, setNewCommunityGateType] = useState<'any_valueskin' | 'specific' | 'manual'>('any_valueskin');
  const [newCommunityRequiredSkin, setNewCommunityRequiredSkin] = useState('');
  const [newCommunityPrice, setNewCommunityPrice] = useState('');
  const [newCommunityMembers, setNewCommunityMembers] = useState<string[]>([]);

  // Tip system state
  const [showTipModal, setShowTipModal] = useState(false);
  const [tipAmount, setTipAmount] = useState('');
  const [tipForDealId, setTipForDealId] = useState<number | null>(null);

  // Dispute resolution state
  const [showDisputeModal, setShowDisputeModal] = useState<number|null>(null);
  const [disputeForDealId, setDisputeForDealId] = useState<number | null>(null);
  const [disputeType, setDisputeType] = useState<'late_delivery' | 'quality_issue' | 'payment' | 'other'>('other');
  const [disputeDescription, setDisputeDescription] = useState('');
  const [intlCustomsAcknowledged, setIntlCustomsAcknowledged] = useState(false);

  // Campaign payment hold modal (shown after publish, before batch send)
  const [showEscrowFundingModal, setShowEscrowFundingModal] = useState(false);
  const [paymentHoldInProgress, setEscrowFundingInProgress2] = useState(false);
  const [showBrandPaymentModal, setShowBrandPaymentModal] = useState(false);
  const [brandPaymentInProgress, setBrandPaymentInProgress] = useState(false);
  const [pendingCampaignForEscrow, setPendingCampaignForEscrow] = useState<Campaign | null>(null);

  // Feature 4: Batch campaign sending
  const [lastCreatedCampaignId, setLastCreatedCampaignId] = useState<number | null>(null);

  // Feature 2: Creator profile display
  const [showCreatorProfileModal, setShowCreatorProfileModal] = useState(false);
  const [selectedProfileCreator, setSelectedProfileCreator] = useState<typeof BRAND_MARKETPLACE_CREATORS[0] | null>(null);

  // Profile completion check
  const isProfileComplete = useCallback(() => {
    const requiredFields = ['profileName', 'profileEmail', 'profileLocation'];
    if (isBrand) {
      requiredFields.push('profileAddress', 'profileWhatTheyDo');
    } else {
      requiredFields.push('profileHeight');
    }

    return requiredFields.every(field => {
      const value = {
        profileName,
        profileEmail,
        profileLocation,
        profileHeight,
        profileAddress,
        profileWhatTheyDo,
      }[field];
      return value && value.toString().trim().length > 0;
    });
  }, [profileName, profileEmail, profileLocation, profileHeight, profileAddress, profileWhatTheyDo, isBrand]);

  // Convenience aliases for backward compatibility
  const persistCampaigns = (updated: Campaign[]) => {
    setCampaigns(updated);
    fetch('/api/realtime/state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: { campaigns: updated } }),
    }).catch(() => {});
  };
  const persistApplications = (updated: SharedApplication[]) => {
    setSharedApplications(updated);
    updated.forEach(a => sharedCreateApplication(a));
  };
  const downloadDealReport = useCallback(async (dealKey: string) => {
    const deal = dealStates[dealKey];
    if (!deal) return;
    const opp = activeOpportunities[parseInt(dealKey.split('|')[2] || '0')];
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);
    const monoFont = await doc.embedFont(StandardFonts.Courier);
    const gray = rgb(0.4, 0.4, 0.4);
    const dark = rgb(0.15, 0.15, 0.15);
    const black = rgb(0, 0, 0);
    const white = rgb(1, 1, 1);
    const accent = rgb(0.2, 0.4, 0.8);
    let page = doc.addPage([612, 792]);
    const m = 50;
    let y = 750;
    const wrap = (text: string, size: number, maxW: number) => {
      const f = size <= 8 ? monoFont : font;
      const words = text.split(' ');
      const linesOut: string[] = [];
      let line = '';
      for (const w of words) {
        const test = line ? line + ' ' + w : w;
        if (f.widthOfTextAtSize(test, size) > maxW) {
          linesOut.push(line);
          line = w;
        } else {
          line = test;
        }
      }
      if (line) linesOut.push(line);
      return linesOut;
    };
    const drawLine = (text: string, size: number, x: number, opts?: { bold?: boolean; color?: any; mono?: boolean }) => {
      const f = opts?.mono ? monoFont : opts?.bold ? boldFont : font;
      page.drawText(text, { x, y, size, font: f, color: opts?.color || dark });
      y -= size + 4;
    };
    const drawWrapped = (text: string, size: number, x: number, maxW: number, opts?: { bold?: boolean; color?: any; mono?: boolean }) => {
      const wrapped = wrap(text, size, maxW);
      for (const w of wrapped) {
        drawLine(w, size, x, opts);
      }
    };
    const drawSep = () => {
      y -= 4;
      page.drawLine({ start: { x: m, y }, end: { x: 562, y }, thickness: 1, color: rgb(0.85, 0.85, 0.85) });
      y -= 8;
    };
    const drawSectionTitle = (title: string) => {
      y -= 6;
      page.drawRectangle({ x: m, y: y - 2, width: 150, height: 16, color: accent });
      page.drawText(title, { x: m + 6, y: y, size: 10, font: boldFont, color: white });
      y -= 22;
    };

    drawLine('VALUESKINS', 22, m, { bold: true, color: accent });
    drawLine('FINAL DEAL REPORT, SETTLEMENT DOCUMENT', 14, m, { bold: true, color: black });
    drawSep();
    drawLine(`Generated: ${new Date().toISOString().replace('T', ' ').slice(0, 19)} UTC`, 9, m, { color: gray });
    drawLine(`Deal ID: ${dealKey}`, 9, m, { color: gray });
    drawLine(`Status: ${deal.phase}`, 9, m, { color: gray });
    y -= 10;

    drawSectionTitle('DEAL OVERVIEW');
    drawWrapped(`Title: ${deal.briefTitle || opp?.type || 'N/A'}`, 11, m, 500, { bold: true });
    drawWrapped(`Brand: ${opp?.brand || 'N/A'}`, 10, m, 500);
    drawLine(`Offer Amount: ₹${deal.offerAmount || '0'}`, 10, m);
    drawLine(`Counter Amount: ₹${deal.counterAmount || '0'}`, 10, m);
    drawLine(`Final Amount: ₹${deal.agreementAmount || deal.offerAmount || '0'}`, 10, m, { bold: true });
    drawLine(`Performance Clause: ${deal.performanceClause ? 'Yes' : 'No'}`, 10, m);
    drawLine(`Payment Split: Advance ${deal.advancePercent}% / Approval ${deal.approvalPercent}%`, 9, m, { color: gray });
    if (deal.poc) {
      drawLine(`Point of Contact: ${deal.poc.name} (${deal.poc.workEmail}), ${deal.poc.role}`, 9, m, { color: gray });
    }
    if (opp?.contentReview) {
      drawLine(`Content Review Mode: ${opp.contentReview === 'review_required' ? 'Review required before publish' : 'Direct upload, no review'}`, 9, m, { color: gray });
    }
    drawSep();

    drawSectionTitle('FULL MESSAGE LOG (AUDIT TRAIL)');
    const msgs = deal.chatMessages || [];
    if (msgs.length === 0) {
      drawLine('(No messages recorded)', 10, m, { color: gray });
    } else {
      for (const msg of msgs) {
        if (y < 80) { page = doc.addPage([612, 792]); y = 750; }
        const ts = msg.isoTime ? new Date(msg.isoTime).toISOString().replace('T', ' ').slice(0, 19) + ' UTC' : msg.time;
        const sender = msg.sender === 'brand' ? 'BRAND' : msg.sender === 'creator' ? 'CREATOR' : msg.sender?.toUpperCase() || 'UNKNOWN';
        drawLine(`[${ts}] ${sender}:`, 8, m, { mono: true, bold: true, color: accent });
        drawWrapped(msg.text || '', 8, m + 12, 500, { mono: true, color: dark });
      }
    }
    drawSep();

    drawSectionTitle('DELIVERABLES & TIMELINE');
    const dStatuses = deal.deliverableStatuses || {};
    if (Object.keys(dStatuses).length > 0) {
      Object.entries(dStatuses).forEach(([idx, status]) => {
        drawLine(`  Deliverable #${idx}: ${status}`, 10, m);
      });
    } else {
      drawLine('No deliverables recorded', 10, m, { color: gray });
    }
    if (deal.paymentSecured) {
      drawLine(`Payment: Secured (Pool: ₹${deal.escrowPool || 'N/A'})`, 10, m);
    }
    drawSep();

    drawSectionTitle('PAYMENT MILESTONES');
    const pMilestones = deal.paymentMilestones || {};
    drawLine(`  Advance: ${pMilestones.advance || 'pending'}`, 10, m);
    drawLine(`  Approval: ${pMilestones.approval || 'pending'}`, 10, m);
    drawSep();

    const tips = deal.tipsReceived || [];
    if (tips.length > 0) {
      drawSectionTitle('TIPS');
      tips.forEach(t => {
        const extra = t.message ? ': ' + t.message : '';
        drawLine(`  ₹${t.amount} from ${t.from}${extra}`, 10, m);
      });
      drawSep();
    }

    const disputes = deal.disputes || [];
    if (disputes.length > 0) {
      drawSectionTitle('DISPUTES');
      disputes.forEach(d => {
        drawLine(`  [#${d.id}] ${d.type}, ${d.status} (filed by ${d.filledBy})`, 10, m);
        drawWrapped(`    ${d.description}`, 9, m + 10, 490, { color: gray });
      });
      drawSep();
    }

    y -= 8;
    page.drawLine({ start: { x: m, y }, end: { x: 562, y }, thickness: 2, color: accent });
    y -= 12;
    page.drawText('END OF REPORT', { x: m, y, size: 11, font: boldFont, color: accent });
    y -= 16;
    page.drawText('This document is an official Valueskins deal settlement record.', { x: m, y, size: 8, font: font, color: gray });
    y -= 12;
    page.drawText('All messages, amounts, milestones, and disputes are captured above.', { x: m, y, size: 8, font: font, color: gray });

    const pdfBytes = await doc.save();
    const blob = new Blob([pdfBytes as BlobPart], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const filename = `valueskins-deal-${dealKey.replace(/[^a-zA-Z0-9]/g, '-')}-${new Date().toISOString().slice(0, 10)}.pdf`;
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);

    // Log report for admin panel
    const reportLog = {
      dealKey,
      filename,
      timestamp: new Date().toISOString(),
      dealData: {
        phase: deal.phase,
        brand: opp?.brand || 'Unknown',
        creatorName: deal.creatorName || 'Unknown',
        amount: deal.agreementAmount || deal.offerAmount || '0',
      }
    };
    console.log('[DealReport]', reportLog);
  }, [dealStates]);

  const forceFetchApplications = useCallback(async () => {
    try {
      const res = await fetch('/api/realtime/state');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.applications)) {
          setSharedApplications(data.applications as SharedApplication[]);
        }
      }
    } catch (e) {
      console.error('Failed to fetch applications:', e);
    }
  }, [setSharedApplications]);
  const resetMvpDemoState = () => {
    // Full MVP reset: clear in-memory state and persisted demo storage.
    setDealStates({});
    setSharedApplications([]);
    setCampaigns([]);
    setCompletedDeals([]);
    setUploadedItems([]);
    setNegotiatingOpp(null);
    setNegotiatingCreator(null);
    setSelectedMarketplaceSkin(null);
    setCreatorMarketplaceTab('opportunities');
    setMarketplaceTab('creators');
    setCreatorCampaignSearch('');
    // The composer owns the campaign draft now — clear it rather than five
    // individual form fields.
    if (typeof window !== 'undefined') localStorage.removeItem(CAMPAIGN_DRAFT_KEY);
    setPurchaseToast('MVP reset complete, demo restarted from beginning');
    setTimeout(() => setPurchaseToast(null), 2500);
    if (typeof window !== 'undefined') {
      const keys = [
        SK.persist,
        SK.dealSync,
        SK.valueSkins,
        SK.campaigns,
        SK.applications,
        SK.negCreator,
      ];
      keys.forEach(k => localStorage.removeItem(k));
      // Reload to guarantee every derived state starts fresh for pitch flow.
      window.location.reload();
    }
  };

  // Keep legacy myApplications wired to sharedApplications for creator view
  const myApplications = sharedApplications;
  // Gap 4: deal lifecycle
  type CreatorDealLifecycle = 'checklist'|'deliverables'|'submitted'|'approved';
  type BrandApprovalPhase = 'accepted'|'funding'|'funded'|'reviewing'|'approved';
  // Read from shared deal state for real-time cross-role sync
  // Fallback to brandDeal for brand side (where activeDeal is null)
  const creatorDealLifecycle: CreatorDealLifecycle = (activeDeal?.creatorDealLifecycle as CreatorDealLifecycle) || (brandDeal?.creatorDealLifecycle as CreatorDealLifecycle) || 'checklist';
  const setCreatorDealLifecycle = (lc: CreatorDealLifecycle) => { const targetKey = activeDealKey || brandDealKey; if (targetKey) updateDeal(targetKey, { creatorDealLifecycle: lc }); };
  const brandApprovalPhase: BrandApprovalPhase = (brandDeal?.brandApprovalPhase as BrandApprovalPhase) || 'accepted';
  const setBrandApprovalPhase = (p: BrandApprovalPhase) => { if (brandDealKey) updateDeal(brandDealKey, { brandApprovalPhase: p }); };
  // MIGRATION: Existing deals where brand already accepted → skip to deliverables
  useEffect(() => {
    if (marketplaceRole === 'creator' && dealRoomPhase === 'accepted' && brandApprovalPhase === 'accepted' && creatorDealLifecycle !== 'deliverables' && activeDealKey) {
      updateDeal(activeDealKey, { phase: 'softhold', creatorDealLifecycle: 'deliverables', paymentSecured: true });
    }
  }, [marketplaceRole, dealRoomPhase, brandApprovalPhase, creatorDealLifecycle, activeDealKey]);
  const [dealUploadSimulated, setDealUploadSimulated] = useState(false);
  type CompletedDeal = { id:number; brand:string; amount:number; completedAt:string; deliverable:string; usageRightsDays?:number; exclusivityDays?:number; exclusivitySkin?:string; disputed?:boolean; disputeReason?:string; disputeStatus?:'filed'|'under_review'|'resolved'; contractSignedAt?:string; tipped?:number; };
  const [completedDeals, setCompletedDeals] = useState<CompletedDeal[]>([]);
  // Track uploaded deliverables across all deals (for "Uploaded" profile tab)
  type UploadedItem = { id:string; brand:string; dealId:string; format:string; link:string; uploadedAt:string; };
  const [uploadedItems, setUploadedItems] = useState<UploadedItem[]>([]);
  // Deliverable checklist tracking (per-deliverable status + content links)
  // Deliverable statuses + links — synced from shared deal state for brand to see creator submissions
  const deliverableStatuses: Record<number, 'pending'|'linking'|'uploaded'|'approved'> = (activeDeal?.deliverableStatuses as Record<number, 'pending'|'linking'|'uploaded'|'approved'>) || {};
  const setDeliverableStatuses = (v: Record<number, 'pending'|'linking'|'uploaded'|'approved'> | ((prev: Record<number, 'pending'|'linking'|'uploaded'|'approved'>) => Record<number, 'pending'|'linking'|'uploaded'|'approved'>)) => {
    if (!activeDealKey) return;
    const newVal = typeof v === 'function' ? v(deliverableStatuses) : v;
    updateDeal(activeDealKey, { deliverableStatuses: newVal });
  };
  const deliverableLinks: Record<number, string> = (activeDeal?.deliverableLinks as Record<number, string>) || {};
  const setDeliverableLinks = (v: Record<number, string> | ((prev: Record<number, string>) => Record<number, string>)) => {
    if (!activeDealKey) return;
    const newVal = typeof v === 'function' ? v(deliverableLinks) : v;
    updateDeal(activeDealKey, { deliverableLinks: newVal });
  };
  const [deliverableLinkInputs, setDeliverableLinkInputs] = useState<Record<number, string>>({});
  // Feature 2: Available for deals toggle
  const [availableForDeals, setAvailableForDeals] = useState(true);
  // Feature 3: Market rates panel
  const [showMarketRates, setShowMarketRates] = useState(false);
  // Feature 6: Creator pipeline view
  const [creatorMarketplaceTab, setCreatorMarketplaceTab] = useState<'opportunities'|'pipeline'>('opportunities');
  // Feature 7: Public profile link copied
  const [profileLinkCopied, setProfileLinkCopied] = useState(false);
  // Deal cancellation
  const [showCancelDealModal, setShowCancelDealModal] = useState(false);
  const [submittedForReview, setSubmittedForReview] = useState(false);
  const [campaignsSectionOpen, setCampaignsSectionOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  // Deal rating (post-completion)
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [dealRating, setDealRating] = useState(0);
  const [dealRatingComment, setDealRatingComment] = useState('');
  const [ratingSubmitted, setRatingSubmitted] = useState(false);
  const [displayCreatorRating, setDisplayCreatorRating] = useState(false);
  // Brand-side rating
  const [brandShowRatingModal, setBrandShowRatingModal] = useState(false);
  const [brandDealRating, setBrandDealRating] = useState(0);
  const [brandRatingComment, setBrandRatingComment] = useState('');
  const [brandRatingSubmitted, setBrandRatingSubmitted] = useState(false);
  const [displayBrandRating, setDisplayBrandRating] = useState(false);
  // Payment milestone tracking — synced from shared deal state for real-time cross-role visibility
  type MilestoneStatus = 'pending'|'released';
  const paymentMilestones: Record<string, MilestoneStatus> = (activeDeal?.paymentMilestones as Record<string, MilestoneStatus>) || { advance: 'pending', approval: 'pending' };
  const setPaymentMilestones = (v: Record<string, MilestoneStatus> | ((prev: Record<string, MilestoneStatus>) => Record<string, MilestoneStatus>)) => {
    if (!activeDealKey) return;
    const newVal = typeof v === 'function' ? v(paymentMilestones) : v;
    updateDeal(activeDealKey, { paymentMilestones: newVal as Record<'advance' | 'approval', MilestoneStatus> });
  };
  // Dispute evidence input
  const [disputeEvidence, setDisputeEvidence] = useState('');
  // Escrow funding — synced from shared deal state
  const paymentSecured = activeDeal?.paymentSecured ?? false;
  const setEscrowFunded = (v: boolean) => { if (activeDealKey) updateDeal(activeDealKey, { paymentSecured: v }); };
  const [escrowFundingInProgress, setEscrowFundingInProgress] = useState(false);
  // Contract agreement (before finalization)
  const [contractChecks, setContractChecks] = useState<Record<string, boolean>>({});
  const [contractSignature, setContractSignature] = useState('');
  const [signatureJurisdiction, setSignatureJurisdiction] = useState('US');
  // Script workflow — simplified binary choice
  const scriptDraft = activeDeal?.scriptDraft ?? '';
  const scriptMode = activeDeal?.scriptMode ?? 'creator_freedom';
  const scriptAccepted = activeDeal?.scriptAccepted ?? false;
  const publishEvents = activeDeal?.publishEvents ?? [];
  const appendPublishEvent = (event: { id: number; type: 'video_published' | 'milestone_released'; message: string; at: string }) => {
    if (!activeDealKey) return;
    updateDeal(activeDealKey, { publishEvents: [...publishEvents, event] });
  };
  // Exclusivity tracking (active exclusivities from completed deals)
  const activeExclusivities = completedDeals.filter(d => {
    if (!d.exclusivityDays || !d.exclusivitySkin) return false;
    const expiresAt = new Date(d.completedAt).getTime() + d.exclusivityDays * 86400000;
    return expiresAt > Date.now();
  });
  // Gap 5: level-up
  const [showLevelUpModal, setShowLevelUpModal] = useState(false);
  const [levelUpFrom, setLevelUpFrom] = useState(1);
  const [levelUpTo, setLevelUpTo] = useState(2);

  const [metrics, setMetrics] = useState({
    followers: 0, engagement: 0, dealsCompleted: 0,
    avgDealValue: 0, onTimeRate: 0, brandRating: 0,
  });

  // Persist state to localStorage — must be declared after ALL state variables it references
  useEffect(() => {
    if (!skinsLoaded || loading) return;
    try {
      localStorage.setItem(SK.persist, JSON.stringify({
        marketplaceRole, brandValueSkins, activeBrandSkin, selectedMarketplaceSkin, profileName, profileBio, profileAvatar,
        selectedCountry, selectedLanguages, rateCard, profileDealTypes, willingToBarter,
        notifications, joinedCommunities, dmMessages, communityMessages,
        brandProfileSelections, creatorEnergy, metrics, skinPitchTexts, skinPitchVideos,
        skinPositions,
      }));
    } catch (e) { /* ignore */ }
  }, [marketplaceRole, brandValueSkins, activeBrandSkin, selectedMarketplaceSkin, profileName, profileBio, profileAvatar,
      selectedCountry, selectedLanguages, rateCard, profileDealTypes, willingToBarter,
      notifications, joinedCommunities, dmMessages, communityMessages,
      brandProfileSelections, creatorEnergy, metrics, skinsLoaded, skinPitchTexts, skinPitchVideos,
      skinPositions, loading]);

  // ── Hover card system ──────────────────────────────────────────────
  const [hoverProfile, setHoverProfile] = useState<{ profile: HoverProfile; x: number; y: number } | null>(null);
  const hoverTimers = useRef<{ show?: ReturnType<typeof setTimeout>; hide?: ReturnType<typeof setTimeout> }>({});

  const showHoverCard = useCallback((profile: HoverProfile, e: React.MouseEvent) => {
    clearTimeout(hoverTimers.current.hide);
    hoverTimers.current.show = setTimeout(() => {
      setHoverProfile({ profile, x: e.clientX + 12, y: e.clientY + 12 });
    }, 350);
  }, []);

  const updateHoverPosition = useCallback((e: React.MouseEvent) => {
    setHoverProfile(prev => prev ? { ...prev, x: e.clientX + 12, y: e.clientY + 12 } : null);
  }, []);

  const hideHoverCard = useCallback(() => {
    clearTimeout(hoverTimers.current.show);
    hoverTimers.current.hide = setTimeout(() => setHoverProfile(null), 200);
  }, []);

  const buildBrandHover = useCallback((brandName: string): HoverProfile => {
    // Count completed deals with this brand by looking at deal.brandName (stored when deal was created)
    let brandDealCount = 0;
    let totalDealValue = 0;

    for (const [key, deal] of Object.entries(dealStates)) {
      if (!deal) continue;
      if (deal.creatorDealLifecycle !== 'approved' && deal.brandApprovalPhase !== 'approved') continue;
      // Use stored brandName from deal (this is set when deal is created)
      if (deal.brandName === brandName) {
        brandDealCount++;
        // Add deal amount if available
        if (deal.offerAmount) {
          const amount = parseInt(deal.offerAmount.toString().replace(/[^0-9]/g, '')) || 0;
          totalDealValue += amount;
        }
      }
    }

    // Also count from completedDeals array if it exists
    for (const cd of completedDeals) {
      if (cd.brand === brandName) {
        brandDealCount++;
        if (cd.amount) totalDealValue += cd.amount;
      }
    }

    const avgDealValue = brandDealCount > 0 ? Math.round(totalDealValue / brandDealCount) : 0;

    return {
      role: 'brand',
      name: brandName,
      skin: undefined, // Don't show brand's own ValueSkin - show what brand they represent
      bio: profileBio,
      brandProfileSelections,
      brandValueSkins,
      completedDeals: brandDealCount,
      selectedCountry,
      location: profileLocation,
      email: profileEmail,
      address: profileAddress,
      whatTheyDo: profileWhatTheyDo,
      metrics: {
        followers: 0,
        engagement: 0,
        dealsCompleted: brandDealCount,
        avgDealValue: avgDealValue,
        onTimeRate: 0, // Don't show for brands
        brandRating: metrics.brandRating,
      },
    };
  }, [brandValueSkins, profileBio, brandProfileSelections, completedDeals, selectedCountry, metrics, dealStates, profileLocation, profileEmail, profileAddress, profileWhatTheyDo]);

  const buildCreatorHover = useCallback((creatorName: string, creatorSkin?: string): HoverProfile => {
    const sk = creatorSkin || Object.values(valueSkins).find(e => e?.profession)?.profession;
    const slot = sk ? (Object.keys(valueSkins) as Array<keyof typeof valueSkins>).find(k => valueSkins[k]?.profession === sk) : undefined;
    const rawAbout = slot && valueSkins[slot]?.aboutMe ? valueSkins[slot]!.aboutMe : '';
    const aboutMe = rawAbout && defaultAboutMe(sk || '') !== rawAbout ? rawAbout : '';
    let creatorDealCount = 0;
    for (const [key, deal] of Object.entries(dealStates)) {
      if (!deal) continue;
      if (deal.creatorDealLifecycle !== 'approved' && deal.brandApprovalPhase !== 'approved') continue;
      if (deal.creatorName === creatorName && (!creatorSkin || deal.creatorSkin === creatorSkin)) { creatorDealCount++; continue; }
      const parts = key.split('|');
      if (parts[0] === creatorName && (!creatorSkin || parts[1] === creatorSkin)) { creatorDealCount++; }
    }
    // Virtual Resume Instagram data. Mirrors what the Instagram OAuth login
    // persists, plus the manage_insights block. Until Meta Advanced Access is
    // granted the insights are sample values so the review surface never renders
    // empty — reach/impressions are derived from the follower base (3.9x / 7.8x
    // per 30 days, a stable, realistic ratio).
    const igFollowers = metrics.followers > 0 ? metrics.followers : 12400;
    return {
      role: 'creator',
      name: creatorName,
      skin: sk,
      bio: profileBio,
      aboutMe,
      location: profileLocation,
      email: profileEmail,
      height: profileHeight,
      metrics: {
        followers: metrics.followers, engagement: metrics.engagement,
        dealsCompleted: creatorDealCount, avgDealValue: metrics.avgDealValue,
        onTimeRate: metrics.onTimeRate, brandRating: metrics.brandRating,
      },
      instagram: {
        username: creatorName.toLowerCase().replace(/[^a-z0-9_.]/g, ''),
        name: creatorName,
        accountType: 'BUSINESS',
        followers: igFollowers,
        posts: 143,
        following: 512,
bio: profileBio
        ? `${profileBio} · ${isBrand ? 'Open for creator collabs on ValueSkins' : 'Open to brand collabs on ValueSkins'}`
        : isBrand
          ? 'Brand · Open to creator collaborations · DM for rates #valueskins'
          : 'Creator · Open to brand collaborations · DM for rates #valueskins',
        verified: true,
        insights: {
          reach: Math.round(igFollowers * 3.9),
          impressions: Math.round(igFollowers * 7.8),
          engagementRate: metrics.engagement > 0 ? metrics.engagement : 4.8,
          profileViews: Math.round(igFollowers * 0.19),
          syncedAt: '2h ago',
        },
      },
      rateCard,
      completedDeals: creatorDealCount,
      availableFrom: creatorAvailableFrom,
      selectedCountry,
    };
  }, [valueSkins, profileBio, metrics, rateCard, creatorAvailableFrom, selectedCountry, dealStates, profileLocation, profileEmail, profileHeight]);

  // Virtual Resume · Instagram — the own-profile edition of the block shown
  // in the hover card. Rendered directly on the profile section so Meta App
  // Review can see BOTH permissions on the page itself: instagram_business_basic
  // (profile data row) and instagram_business_manage_insights (analytics below
  // it). When the creator has an authorized Instagram connection (real OAuth
  // + social_media_accounts row) the stored profile and insight values from
  // the Graph API replace these values; until a connection exists or Advanced
  // Access is granted, the insights stay as samples (derived from the follower
  // base) so the surface never renders empty.
  const [realIg, setRealIg] = useState<HoverInstagram & { connected: boolean } | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch('/api/social/instagram', { credentials: 'include' })
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (cancelled || !d || d.connected !== true) return;
        setRealIg({
          connected: true,
          username: d.username || undefined,
          name: d.displayName || undefined,
          accountType: d.accountType || 'BUSINESS',
          followers: typeof d.followers === 'number' ? d.followers : undefined,
          posts: typeof d.mediaCount === 'number' ? d.mediaCount : undefined,
          bio: d.bio || undefined,
          verified: true,
          insights: d.insights
            ? {
                reach: d.insights.reach != null ? Number(d.insights.reach) : undefined,
                impressions: d.insights.impressions != null ? Number(d.insights.impressions) : undefined,
                profileViews: d.insights.profileViews != null ? Number(d.insights.profileViews) : undefined,
                engagementRate: d.insights.engagementRate != null ? Number(d.insights.engagementRate) : undefined,
                syncedAt: d.insights.syncedAt || undefined,
              }
            : undefined,
        });
      })
      .catch(() => { /* no connection — resume falls back to samples */ });
    return () => { cancelled = true; };
  }, []);

  const getOwnInstagram = (): HoverInstagram => {
    const ownName = heroProfile?.display_name || account?.display_name || profileName || 'Your Name';
    const igFollowers = metrics.followers > 0 ? metrics.followers : 12400;

    // A real authorized Instagram connection wins: profile fields come from
    // the Graph API (instagram_business_basic). Insights use the stored Graph
    // API values (instagram_business_manage_insights) or sample-derived values
    // until advanced access is granted.
    if (realIg?.connected && realIg.username) {
      const sampleInsights = {
        reach: Math.round(igFollowers * 3.9),
        impressions: Math.round(igFollowers * 7.8),
        engagementRate: metrics.engagement > 0 ? metrics.engagement : 4.8,
        profileViews: Math.round(igFollowers * 0.19),
        syncedAt: '2h ago (sample)',
      };
      const insights = realIg.insights
        ? {
            reach: realIg.insights.reach ?? sampleInsights.reach,
            impressions: realIg.insights.impressions ?? sampleInsights.impressions,
            engagementRate: realIg.insights.engagementRate ?? sampleInsights.engagementRate,
            profileViews: realIg.insights.profileViews ?? sampleInsights.profileViews,
            syncedAt: realIg.insights.syncedAt || sampleInsights.syncedAt,
          }
        : sampleInsights;
      return {
        username: realIg.username,
        name: realIg.name || realIg.username,
        accountType: realIg.accountType || 'BUSINESS',
        followers: realIg.followers ?? igFollowers,
        posts: realIg.posts,
        bio: realIg.bio || (profileBio ? `${profileBio} · Open to brand collabs on ValueSkins` : 'Creator · Open to brand collaborations · DM for rates #valueskins'),
        verified: realIg.verified ?? true,
        insights,
      };
    }

    return {
      username: ownName.toLowerCase().replace(/[^a-z0-9_.]/g, '') || 'creator',
      name: ownName,
      accountType: 'BUSINESS',
      followers: igFollowers,
      posts: 143,
      following: 512,
      bio: profileBio ? `${profileBio} · Open to brand collabs on ValueSkins` : 'Creator · Open to brand collaborations · DM for rates #valueskins',
      verified: true,
      insights: {
        reach: Math.round(igFollowers * 3.9),
        impressions: Math.round(igFollowers * 7.8),
        engagementRate: metrics.engagement > 0 ? metrics.engagement : 4.8,
        profileViews: Math.round(igFollowers * 0.19),
        syncedAt: '2h ago',
      },
    };
  };

  // Track Record stats, computed server-side from completed deals.
  // /api/profile/stats previously did not exist, so this fetch 404'd and the UI
  // silently kept its hardcoded defaults.
  const [trackRecord, setTrackRecord] = useState<Record<string, number> | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch("/api/profile/stats", { credentials: "include" });
        if (!response.ok) return;
        const statsData = await response.json();
        setTrackRecord(statsData);
        setMetrics(prev => ({
          followers: statsData.followers || prev.followers,
          engagement: statsData.engagement || prev.engagement,
          dealsCompleted: statsData.dealsCompleted || prev.dealsCompleted,
          avgDealValue: statsData.avgDealValue || prev.avgDealValue,
          onTimeRate: statsData.onTimeRate || prev.onTimeRate,
          brandRating: statsData.avgRating || prev.brandRating,
        }));
      } catch {
        // stats stay null; the profile renders its zero state
      }
    };
    fetchStats();
  }, []);

  // Fetch ValueSkins from API based on user role
  useEffect(() => {
    const fetchValueSkins = async () => {
      try {
        const endpoint = marketplaceRole === "brand" ? "/api/brand-valueskins" : "/api/valueskins";
        const response = await fetch(endpoint, { credentials: "include" });
        if (response.ok) {
          const data = await response.json();
          if (marketplaceRole === "brand") {
            setBrandValueSkins(data.skins.map((s: any) => s.category));
          } else {
            const skinsMap: Record<string, any> = {};
            data.skins.forEach((s: any) => {
              skinsMap[s.slot] = { profession: s.profession, aboutMe: s.aboutMe || "" };
            });
            // Only overwrite if backend returned data, to avoid wiping localStorage state
            if (Object.keys(skinsMap).length > 0) {
              setValueSkins(skinsMap);
            }
          }
        }
      } catch (err) {
        console.error("Failed to fetch ValueSkins:", err);
      }
    };
    if (skinsLoaded) { fetchValueSkins(); }
  }, [marketplaceRole, skinsLoaded]);

  const handleFollow = () => {
    setIsFollowing(!isFollowing);
    setMetrics(prev => ({ ...prev, followers: prev.followers + (isFollowing ? -1 : 1) }));
  };

  const toggleLike = (i: number) => {
    setLikedPosts(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i]);
  };

  const updateMetric = (key: string, value: string) => {
    setMetrics(prev => ({ ...prev, [key]: parseFloat(value) || 0 }));
  };

  const assignSkinAfterPayment = (profession: string) => {
    if (marketplaceRole === 'brand' && brandValueSkins.length >= 1) return;
    if (marketplaceRole === 'creator' && ownedSkins.length >= 1) return;
    recordFakeBankTransaction({
      type: 'payment',
      description: `ValueSkin Purchase: ${profession}`,
      amount: SKIN_PRICE_RUPEES * 100,
      reference: `vs_${Date.now()}`,
    });

    if (marketplaceRole === 'brand') {
      const isValidBrandCategory = Object.values(PROFESSIONS).some(cat => cat.subProfessions.includes(profession));
      if (!isValidBrandCategory) return;
      setBrandValueSkins(prev => [...prev, profession]);
      if (!activeBrandSkin) setActiveBrandSkin(profession);
      setActiveView('mim');
      setPurchaseToast(`${profession} added to your ValueSkins`);
      setTimeout(() => setPurchaseToast(null), 3000);
      return;
    }
    const badge = PROFESSION_BADGES[profession];
    const label = badge?.abbreviation ?? profession.split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 3);

    setValueSkins(prev => ({
      ...prev,
      ['profession']: { profession, aboutMe: defaultAboutMe(profession) },
    }));
    setSelectedMarketplaceSkin(profession);
    setActiveView('profile');
  };

  const downloadReceipt = async (profession: string, orderId: string, paymentId: string) => {
    try {
      const doc = await PDFDocument.create();
      const font = await doc.embedFont(StandardFonts.Helvetica);
      const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);
      const gray = rgb(0.4, 0.4, 0.4);
      const dark = rgb(0.15, 0.15, 0.15);
      const accent = rgb(0.22, 0.74, 0.5);
      const page = doc.addPage([400, 520]);
      const m = 30;
      let y = 480;

      const line = (text: string, size: number, opts?: { bold?: boolean; color?: any }) => {
        page.drawText(text, { x: m, y, size, font: opts?.bold ? boldFont : font, color: opts?.color || dark });
        y -= size + 6;
      };
      const sep = () => { y -= 4; page.drawLine({ start: { x: m, y }, end: { x: 370, y }, thickness: 1, color: rgb(0.85, 0.85, 0.85) }); y -= 8; };

      line('VALUESKINS', 22, { bold: true, color: accent });
      line('Payment Receipt', 14, { bold: true, color: dark });
      sep();
      line(`Receipt #: VS-${Date.now().toString(36).toUpperCase()}`, 10, { color: gray });
      line(`Date: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`, 10, { color: gray });
      sep();
      line('PAYMENT DETAILS', 11, { bold: true });
      line(`Item: ${profession} ValueSkin`, 10);
      line(`Order ID: ${orderId}`, 8, { color: gray });
      line(`Payment ID: ${paymentId}`, 8, { color: gray });
      line(`Amount Paid: ₹950.00`, 14, { bold: true, color: accent });
      line(`Status: Completed`, 10, { color: rgb(0.22, 0.74, 0.5) });
      sep();
      line('No GST charged, seller is not GST-registered.', 8, { color: gray });
      line('This is not a tax invoice.', 8, { color: gray });

      const pdfBytes = await doc.save();
      const blob = new Blob([pdfBytes as BlobPart], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `receipt-vs-${Date.now()}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Receipt download failed:', err);
    }
  };

  // TEST PAYMENT CODE (DISABLED) - Re-enable with purchaseProfession if needed
  /*
  const startRazorpayPayment = async (profession: string) => {
    try {
      await ensureRazorpayLoaded();
    } catch {
      setPurchaseToast('Failed to load payment gateway. Try again.');
      setTimeout(() => setPurchaseToast(null), 3000);
      return;
    }

    try {
      const res = await fetch('/api/razorpay-test/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amountInRupees: SKIN_PRICE_RUPEES }),
      });
      const data = await res.json();
      if (!data.order) {
        setPurchaseToast('Payment service unavailable. Try again.');
        setTimeout(() => setPurchaseToast(null), 3000);
        return;
      }

      const options = {
        key: data.keyId,
        amount: data.order.amount,
        currency: data.order.currency,
        name: 'ValueSkins',
        description: `Purchase ${profession} ValueSkin`,
        order_id: data.order.id,
        handler: async (response: any) => {
          const verifyRes = await fetch('/api/razorpay-test/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            }),
          });
          const verifyData = await verifyRes.json();
          if (verifyData.verified) {
            assignSkinAfterPayment(profession);
            downloadReceipt(profession, response.razorpay_order_id, response.razorpay_payment_id);
          } else {
            setPurchaseToast('Payment could not be verified. Contact support.');
            setTimeout(() => setPurchaseToast(null), 4000);
          }
        },
        modal: {
          ondismiss: () => {
            setPurchaseToast('Payment cancelled.');
            setTimeout(() => setPurchaseToast(null), 3000);
          },
        },
        prefill: { name: profileName || '' },
        theme: { color: '#000' },
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.open();
    } catch (err) {
      console.error('Razorpay error:', err);
      setPurchaseToast('Something went wrong. Please try again.');
      setTimeout(() => setPurchaseToast(null), 3000);
    }
  };
  */

  const purchaseProfession = (profession: string) => {
    if (marketplaceRole === 'brand') {
      if (brandValueSkins.includes(profession)) {
        setPurchaseToast(`You already own ${profession}`);
        setTimeout(() => setPurchaseToast(null), 3000);
        return;
      }
      if (brandValueSkins.length >= 1) {
        setPurchaseToast('You can only have 1 ValueSkin.');
        setTimeout(() => setPurchaseToast(null), 3000);
        return;
      }
    }
    if (marketplaceRole === 'creator' && ownedSkins.length >= 1) {
      setPurchaseToast('You can only have 1 ValueSkin.');
      setTimeout(() => setPurchaseToast(null), 3000);
      return;
    }
    // Directly assign ValueSkin without payment (test payment code is commented out above)
    assignSkinAfterPayment(profession);
  };

  const handleDealComplete = (earnedAmount: number, brandName: string, deliverable: string, skinProfession?: string, usageRightsDays?: number, exclusivityDays?: number, exclusivitySkin?: string) => {
    const updatedMetrics = {
      ...metrics,
      dealsCompleted: metrics.dealsCompleted + 1,
      avgDealValue: Math.round((metrics.avgDealValue * metrics.dealsCompleted + earnedAmount * 100) / (metrics.dealsCompleted + 1)),
    };
    setMetrics(updatedMetrics);
    setCompletedDeals(prev => [...prev, { id: Date.now(), brand: brandName, amount: earnedAmount, completedAt: new Date().toLocaleDateString(), deliverable, usageRightsDays, exclusivityDays, exclusivitySkin, contractSignedAt: contractSignature ? new Date().toISOString() : undefined }]);

    // Check for level-up based on deal completions
    const prevLevel = getLevel(metrics.dealsCompleted);
    const newLevel = getLevel(updatedMetrics.dealsCompleted);
    if (newLevel > prevLevel) {
      setLevelUpFrom(prevLevel);
      setLevelUpTo(newLevel);
      setShowLevelUpModal(true);
    } else {
      setPurchaseToast('Deal complete, earnings added to your balance');
      setTimeout(() => setPurchaseToast(null), 3000);
    }
  };


  // Which professions are already assigned (to show status in store)
  const assignedProfessions = new Set(
    Object.values(valueSkins).map(e => e?.profession).filter(Boolean) as string[]
  );

  const hasValueSkin = Object.values(valueSkins).some(entry => entry?.profession);

  // §9 data bindings for the profile hero. The worn ValueSkin is the
  // profession; name/handle/location come from the real profile row.
  const wornProfession = Object.values(valueSkins).find(e => e?.profession)?.profession || '';
  const [heroProfile, setHeroProfile] = useState<{
    display_name?: string; username?: string; location?: string; country?: string;
  } | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch('/api/profile/me', { credentials: 'include' })
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (!cancelled && d) setHeroProfile(d); })
      .catch(() => { /* hero falls back to account + local state */ });
    return () => { cancelled = true; };
  }, []);
  const hasAnySkin = hasValueSkin || brandValueSkins.length > 0;

  // List of owned skins for the marketplace skin selector
  const ownedSkins = Object.entries(valueSkins)
    .filter(([, entry]) => entry?.profession)
    .map(([slot, entry]) => ({ slot: slot as ValueSkinSlot, profession: entry!.profession }));

  // Profile level based on deals completed
  const currentLevel = getLevel(metrics.dealsCompleted);

  // Auto-expire campaigns past deadline
  const today = new Date().toISOString().split('T')[0];
  const liveCampaigns = useMemo(() => (campaigns || []).map(c => {
    if (c.status === 'open' && c.deadline && c.deadline < today) return { ...c, status: 'expired' as const };
    return c;
  }), [campaigns, today]);

  // Backfill SharedApplication entries from existing dealStates (e.g. deals created before SharedApplication was introduced)
  const hasBackfilledApps = useRef(false);
  useEffect(() => {
    if (hasBackfilledApps.current) return;
    const dealKeys = Object.keys(dealStates);
    if (dealKeys.length === 0 || liveCampaigns.length === 0) return;
    const newApps: SharedApplication[] = [];
    for (const [dealKey, deal] of Object.entries(dealStates)) {
      if (!deal || deal.phase === 'brief') continue;
      const parts = dealKey.split('|');
      const creatorName = parts[0];
      const creatorSkin = parts[1];
      const oppIndex = parts[2] ? parseInt(parts[2]) : undefined;
      const alreadyHasApp = sharedApplications.some(a =>
        (a.creatorName === creatorName && oppIndex !== undefined && a.opportunityIndex === oppIndex) ||
        (a.creatorName === creatorName && deal.campaignId !== undefined && a.campaignId === deal.campaignId)
      );
      if (alreadyHasApp) continue;
      let matchedCampaign: Campaign | undefined;
      if (deal.campaignId) {
        matchedCampaign = liveCampaigns.find(c => c.id === deal.campaignId);
      }
      if (!matchedCampaign) {
        matchedCampaign = liveCampaigns.find(c =>
          c.requiredProfessions.includes(creatorSkin)
        );
      }
      if (!matchedCampaign) continue;
      const creatorProfile = BRAND_MARKETPLACE_CREATORS.find(c => c.name === creatorName);
      const app: SharedApplication = {
        id: Date.now() + newApps.length + Math.floor(Math.random() * 1000),
        campaignId: matchedCampaign.id,
        campaignTitle: matchedCampaign.title,
        creatorProfession: creatorSkin,
        creatorHandle: creatorProfile?.handle || `@${creatorName.replace(/\s+/g, '').toLowerCase()}`,
        status: 'pending' as const,
        appliedAt: new Date().toISOString(),
        opportunityIndex: oppIndex,
        creatorName,
        creatorFollowers: creatorProfile?.followers,
        creatorEngagement: creatorProfile?.engagement,
        creatorLevel: creatorProfile?.level,
        creatorMatchScore: creatorProfile?.matchScore,
        creatorRate: creatorProfile?.rate,
        creatorDealCompletionRate: creatorProfile?.dealCompletionRate,
        creatorPortfolio: creatorProfile?.portfolio,
        creatorAudienceLocation: creatorProfile?.audienceLocation,
        creatorAudienceAge: creatorProfile?.audienceAge,
        creatorResponseTimeHrs: creatorProfile?.responseTimeHrs,
        creatorInstagramUrl: creatorProfile?.instagramUrl,
        creatorWebsiteUrl: creatorProfile?.websiteUrl,
      };
      newApps.push(app);
    }
    if (newApps.length > 0) {
      const updated = [...sharedApplications, ...newApps];
      setSharedApplications(updated);
      updated.forEach(a => sharedCreateApplication(a));
    }
    hasBackfilledApps.current = true;
  }, [dealStates, liveCampaigns, sharedApplications, setSharedApplications, sharedCreateApplication]);

  // Continuous live auto-matching: recomputes whenever campaigns or allCreators change
  // Browse creators — search & filter state
  const [creatorSearchQuery, setCreatorSearchQuery] = useState('');
  const [creatorFilterProfession, setCreatorFilterProfession] = useState<string | null>(null);
  const [creatorFilterLocation, setCreatorFilterLocation] = useState<string | null>(null);

  // Check if creator matches campaign requirements
  const creatorMatchesCampaignRequirements = (campaign: Campaign, creatorProfession: string, creatorData?: any): boolean => {
    // ONLY hard-block on profession. All other preferences are soft-blocks (show warning instead)
    if (campaign.requiredProfessions.length > 0 && !campaign.requiredProfessions.includes(creatorProfession)) {
      // Try partial match on profession
      const skinLower = creatorProfession.toLowerCase();
      const match = campaign.requiredProfessions.some(r => {
        const rLower = r.toLowerCase();
        // handle 'Video Editor' vs 'Video editing'
        if (skinLower.includes('video') && rLower.includes('video')) return true;
        if (skinLower.includes('ugc') && rLower.includes('ugc')) return true;
        if (skinLower.includes('software') && rLower.includes('software')) return true;
        if (skinLower.includes('design') && rLower.includes('design')) return true;
        if (skinLower.includes('write') && rLower.includes('write')) return true;
        return skinLower.includes(rLower) || rLower.includes(skinLower);
      });
      if (!match) return false;
    }

    // REMOVED: Hard-blocks on country, location, age, language
    // All creators matching the profession can see the campaign
    // Preference mismatches show a warning but allow application

    return true;
  };

  // Helper: Check if campaign matches creator's preferences (used for warning badge)
  const campaignMatchesCreatorPreferences = (campaign: Campaign, creatorData?: any): { matches: boolean; reason?: string } => {
    if (!creatorData) return { matches: true };

    // Check country match
    if (campaign.country) {
      const creatorCountry = creatorData.country || creatorData.audienceLocation || '';
      if (creatorCountry && campaign.country.toLowerCase().trim() !== creatorCountry.toLowerCase().trim()) {
        return { matches: false, reason: `This brand is in ${campaign.country}, but your preferences are set to ${creatorCountry}` };
      }
    }

    // Check location match (legacy single location field)
    if (campaign.location && campaign.location.trim().toLowerCase() !== 'remote') {
      const campaignLoc = campaign.location.toLowerCase().trim();
      const creatorLoc = creatorData.audienceLocation?.toLowerCase().trim() || '';
      if (creatorLoc && !creatorLoc.includes(campaignLoc) && campaignLoc !== creatorLoc) {
        return { matches: false, reason: `Campaign requires ${campaign.location}, but your preferences are set to ${creatorData.audienceLocation}` };
      }
    }

    // Check locations array match (new multi-city targeting)
    if ((campaign as any).locations && Array.isArray((campaign as any).locations) && (campaign as any).locations.length > 0) {
      const creatorLoc = (creatorData.location || creatorData.audienceLocation || '').toLowerCase().trim();
      if (creatorLoc) {
        const locationMatches = (campaign as any).locations.some((loc: string) =>
          loc.toLowerCase().trim() === creatorLoc || creatorLoc.includes(loc.toLowerCase().trim())
        );
        if (!locationMatches) {
          return {
            matches: false,
            reason: `Campaign targets ${(campaign as any).locations.join(', ')}, but your location is set to ${creatorData.location || creatorData.audienceLocation}`
          };
        }
      }
    }

    return { matches: true };
  };

  // Opportunities for the currently selected skin — sorted by match % descending
  // Merge hardcoded opportunities with brand-created campaigns (converted to Opportunity format)
  const campaignOpportunities: Opportunity[] = liveCampaigns
    .filter(c => {
      if (c.status !== 'open' || !selectedMarketplaceSkin) return false;
      // Get the current creator's data if available (from marketplace creators)
      const currentCreator = BRAND_MARKETPLACE_CREATORS.find(cr => cr.valueSkin === selectedMarketplaceSkin);
      return creatorMatchesCampaignRequirements(c, selectedMarketplaceSkin, currentCreator);
    })
    .map(c => ({
      campaignId: c.id,
      brand: c.brandName || 'Brand',
      type: c.title,
      match: '100%',
      featured: true,
      willingToBarter: (c.compensationType || '').toLowerCase().includes('barter'),
      about: c.about || c.description,
      budget: `₹${parseInt(c.budget || '0').toLocaleString()}`,
      deadline: c.deliveryDeadline && c.deliveryDeadline.trim() ? c.deliveryDeadline : undefined,
      applicationDeadline: c.deadline,
      deliverables: (c.deliverables || '').split(',').map(d => {
              const trimmed = d.trim();
              const countMatch = trimmed.match(/^(\d+)[xX]\s*(.+)₹/);
              return countMatch ? { format: countMatch[2].trim(), count: parseInt(countMatch[1]) } : { format: trimmed, count: 1 };
            }),
      requirements: c.requirements || [],
      exclusivity: c.exclusivity || 'None',
      usageRights: c.usageRights || '30 days, social only',
      revisionLimit: c.revisionLimit || 2,
      compensationType: c.compensationType || 'Paid',
      location: c.location || 'Remote',
      audienceTarget: c.audienceTarget || '',
      paymentSecured: c.paymentSecured || false,
      escrowPool: c.escrowPool || 0,
      requiredValueskin: c.requiredValueskin || 'profession',
      creatorCount: c.creatorCount || 1,
      contentReview: c.contentReview || 'review_required',
      scriptMode: c.scriptMode,
      scriptText: c.scriptText || '',
      scriptFileName: c.scriptFileName || '',
      shootLocation: c.shootLocation || '',
      expectations: c.expectations || '',
      otherNotes: c.otherNotes || '',
    }));
  const activeOpportunities = selectedMarketplaceSkin
    ? campaignOpportunities.slice().sort((a, b) => parseInt(b.match) - parseInt(a.match))
    : [];
  activeOppsRef.current = activeOpportunities;

  // Deals the creator missed (expired campaigns matching their skins)
  const missedDeals = selectedMarketplaceSkin
    ? liveCampaigns.filter(c => c.status === 'expired' && (c.requiredProfessions.length === 0 || c.requiredProfessions.includes(selectedMarketplaceSkin)))
    : [];

  // ── Demo session identity ───────────────────────────────────────────
  // The marketplace demo signs you in locally (role + profile + skins), with
  // no auth cookie. SettingsHub checks the real session API first and falls
  // back to this identity so it never claims you are logged out in the demo.
  const demoSignedIn = marketplaceRole !== 'none' || !!profileName || !!account;
  const demoAccount: Account | null = demoSignedIn
    ? {
        id: typeof account?.id === 'number' ? account.id : -1,
        email: account?.email || null,
        display_name: profileName || account?.display_name || 'User',
        avatar_url: profileAvatar || account?.avatar_url || null,
      }
    : null;

  const handleDemoLogout = () => {
    try {
      localStorage.removeItem(SK.persist);
      localStorage.removeItem(SK.valueSkins);
      localStorage.removeItem(SK.dealSync);
      localStorage.removeItem(SK.campaigns);
      localStorage.removeItem(SK.applications);
    } catch (e) { /* ignore */ }
    setMarketplaceRole('none');
    setValueSkins({});
    setBrandValueSkins([]);
    setActiveBrandSkin(null);
    setSelectedMarketplaceSkin(null);
    setProfileName('');
    setProfileBio('');
    setProfileAvatar(null);
    setSettingsPane('hub');
    setActiveView('mim');
    // SettingsHub already POSTed /api/auth/logout (cleared the session cookie),
    // so reload to drop the in-memory account and land on the signed-out role
    // selection screen.
    window.location.href = '/demo/marketplace';
  };

  return (
    <div style={{ background: C.bg, minHeight: '100vh', display: 'flex', flexDirection: 'column', color: C.text, fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif", overflowX: 'clip' }}>

      {/* The spine lives up here now, beside the wordmark, rather than as a
          fixed bar on the floor. Sticky, so it stays reachable on long pages —
          which only works because the overflow:auto scroll container that used
          to wrap main content is gone. */}
      {activeView !== 'events' && (
        <AppHeader activeView={activeView} onSelect={(v: AppView) => setActiveView(v)} />
      )}

      {/* ── MAIN CONTENT ──────────────────────────── */}
      {/* NOT `overflow:auto`. This wrapper has no height constraint, so it
          never actually scrolled — it just grew to fit its content. But per
          spec `auto` still establishes a scroll container, and position:sticky
          resolves against its nearest scrolling ancestor. That made every
          sticky header and rail in the app stick to this div (which does not
          scroll) instead of the viewport, so they silently did nothing. */}
      <div style={{ flex: 1 }}>

      {/* Delete Account Confirmation Modal */}
      {showDeleteConfirm && (
        <div style={{ position:'fixed', top:0, left:0, right:0, bottom:0, background:'rgba(0,0,0,0.75)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:9999 }}>
          <div style={{ background:C.surface, borderRadius:'16px', padding:'24px', maxWidth:'400px', width:'95vw', border:`1px solid ${C.border}` }}>
            <div style={{ fontSize:'18px', fontWeight:700, color:C.text, marginBottom:'8px' }}>Delete Account?</div>
            <div style={{ fontSize:'13px', color:C.textSecondary, marginBottom:'16px', lineHeight:1.5 }}>This will permanently delete your account and all data. This cannot be undone.</div>
            <div style={{ display:'flex', gap:'8px' }}>
              <button onClick={() => setShowDeleteConfirm(false)} style={{ flex:1, background:'none', border:`1px solid ${C.border}`, borderRadius:'8px', padding:'11px', color:C.text, fontWeight:700, fontSize:'13px', cursor:'pointer' }}>Cancel</button>
              <button onClick={async () => { try { const r = await fetch('/api/auth/delete-account', { method: 'POST', credentials: 'include' }); if (r.ok) { window.location.href = '/auth/login'; } else { const e = await r.json(); alert('Delete failed: ' + (e.error || 'Unknown error')); } } catch (err) { console.error('Delete failed:', err); alert('Delete failed'); } }} style={{ flex:1, background:'var(--c-error)', border:'none', borderRadius:'8px', padding:'11px', color:'var(--c-surface-lowest)', fontWeight:700, fontSize:'13px', cursor:'pointer' }}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* ── ONBOARDING OVERLAY ──────────────────────────── */}

      {/* ValueSkin Showcase Modal — add video + pitch when clicking your skin */}
      {showSkinShowcaseModal && (
        <div style={{ position:'fixed', top:0, left:0, right:0, bottom:0, background:'rgba(0,0,0,0.8)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:99999 }}>
          <div style={{ background:C.surface, borderRadius:'16px', padding:'24px', maxWidth:'440px', width:'95vw', maxHeight:'90vh', overflowY:'auto', border:`1px solid ${C.border}`, position:'relative' }}>
            <button onClick={() => setShowSkinShowcaseModal(null)} style={{ position:'absolute', top:'14px', right:'16px', background:'none', border:'none', color:C.textMuted, fontSize:'22px', cursor:'pointer', lineHeight:1 }}>x</button>

            {(() => {
              const skinBadge = getBadge(showSkinShowcaseModal);
              const skinColor = skinBadge?.color ?? C.primary;
              const skinLevel = getLevel(metrics.dealsCompleted);
              const skinProgress = getProgressToNext(metrics.dealsCompleted);
              return (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                    {getStickerForProfession(showSkinShowcaseModal) ? (
                      <img src={getStickerForProfession(showSkinShowcaseModal)!} alt={showSkinShowcaseModal} style={{ width: '40px', height: '40px', objectFit: 'contain' }} />
                    ) : (
                      <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: `${skinColor}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, color: skinColor }}>{skinBadge?.abbreviation ?? '?'}</div>
                    )}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '16px', fontWeight: 700, color: C.text }}>{showSkinShowcaseModal}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: skinColor }}>Level {skinLevel}</span>
                        <div style={{ flex: 1, height: '4px', borderRadius: '2px', background: C.border, overflow: 'hidden', maxWidth: '120px' }}>
                          <div style={{ width: `${skinProgress}%`, height: '100%', background: skinColor, borderRadius: '2px', transition: 'width 0.3s' }} />
                        </div>
                        <span style={{ fontSize: '0.75rem', color: C.textMuted }}>{metrics.dealsCompleted} deals</span>
                      </div>
                    </div>
                  </div>
                  {ownedSkins.length === 1 && (
                    <div style={{ fontSize: '0.75rem', color: C.textMuted, marginBottom: '12px', padding: '6px 10px', background: C.surfaceAlt, borderRadius: '6px' }}>
                      Followers contribute to XP with a single skin equipped
                    </div>
                  )}
                </>
              );
            })()}
            <div style={{ fontSize:'12px', color:C.textSecondary, marginBottom:'20px' }}>Brands see this when they click your ValueSkin. Tell them why they should collab with you.</div>

            {/* Mode toggle */}
            <div style={{ display:'flex', gap:8, marginBottom:16 }}>
              <button onClick={()=>setCreatorSkinMode('static')} style={{ flex:1, padding:'10px', borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer', background:creatorSkinMode==='static'?C.primary:C.bg, color:creatorSkinMode==='static'?'var(--c-surface-lowest)':C.textSecondary, border:`1px solid ${creatorSkinMode==='static'?C.primary:C.border}` }}>
                Static Skin
              </button>
              <button onClick={()=>setCreatorSkinMode('showcase')} style={{ flex:1, padding:'10px', borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer', background:creatorSkinMode==='showcase'?C.primary:C.bg, color:creatorSkinMode==='showcase'?'var(--c-surface-lowest)':C.textSecondary, border:`1px solid ${creatorSkinMode==='showcase'?C.primary:C.border}` }}>
                Showcase Mode
              </button>
            </div>

            {creatorSkinMode === 'static' && (
              <div style={{ textAlign:'center', padding:'30px 20px', color:C.textMuted, fontSize:13 }}>
                Your ValueSkin displays as a standard badge. Switch to Showcase to add a video pitch and bio.
              </div>
            )}

            {creatorSkinMode === 'showcase' && (
              <>
                {/* Video upload section */}
                <div style={{ marginBottom:16 }}>
                  <div style={{ fontSize:'0.75rem', fontWeight:700, color:C.textMuted, textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:8 }}>Pitch Video</div>
                  <div style={{ fontSize:'0.75rem', color:C.textSecondary, marginBottom:8 }}>Record a short video explaining why brands should work with you. This plays when they click your skin.</div>

                  {!creatorPitchVideoUrl ? (
                    <label style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:8, padding:'24px', background:C.bg, border:`2px dashed ${C.border}`, borderRadius:10, cursor:'pointer', transition:'border-color 0.2s' }}>
                      <input
                        type="file"
                        accept="video/mp4,video/webm,video/quicktime"
                        style={{ display:'none' }}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            if (file.size > 50 * 1024 * 1024) {
                              setPurchaseToast('Video must be under 50MB');
                              setTimeout(() => setPurchaseToast(null), 3000);
                              return;
                            }
                            const url = URL.createObjectURL(file);
                            setCreatorPitchVideoUrl(url);
                            setCreatorPitchVideoName(file.name);
                          }
                        }}
                      />
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={C.textSecondary} strokeWidth="1.5">
                        <polygon points="23 7 16 12 23 17 23 7" />
                        <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                      </svg>
                      <span style={{ fontSize:13, fontWeight:600, color:C.text }}>Upload pitch video</span>
                      <span style={{ fontSize:11, color:C.textMuted }}>MP4, WebM or MOV &middot; Max 50MB</span>
                    </label>
                  ) : (
                    <div style={{ position:'relative' }}>
                      <video
                        src={creatorPitchVideoUrl}
                        controls
                        style={{ width:'100%', borderRadius:10, maxHeight:220, background:'#000' }}
                      />
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:6 }}>
                        <span style={{ fontSize:11, color:C.textMuted }}>{creatorPitchVideoName}</span>
                        <button onClick={() => { URL.revokeObjectURL(creatorPitchVideoUrl); setCreatorPitchVideoUrl(''); setCreatorPitchVideoName(''); }} style={{ background:'none', border:`1px solid ${C.border}`, borderRadius:6, padding:'4px 10px', fontSize:11, color:C.textMuted, cursor:'pointer', fontWeight:600 }}>Remove</button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Text pitch */}
                <div style={{ marginBottom:16 }}>
                  <div style={{ fontSize:'0.75rem', fontWeight:700, color:C.textMuted, textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:6 }}>Written Pitch</div>
                  <textarea
                    value={creatorPitchText}
                    onChange={e => setCreatorPitchText(e.target.value)}
                    placeholder={`Why should brands hire you as a ${showSkinShowcaseModal}? e.g. "I've built products used by 50K+ devs..."`}
                    rows={3}
                    style={{ width:'100%', background:C.bg, border:`1px solid ${C.border}`, borderRadius:8, color:C.text, padding:'10px', fontSize:13, fontFamily:'inherit', outline:'none', resize:'none', boxSizing:'border-box' as const }}
                  />
                </div>

                {/* Preview card */}
                {creatorPitchText && (
                  <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:10, padding:12, marginBottom:8 }}>
                    <div style={{ fontSize:10, fontWeight:700, color:C.textSecondary, textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:8 }}>How brands see your skin</div>
                    <div style={{ fontSize:12, color:C.text, lineHeight:1.5 }}>{creatorPitchText}</div>
                  </div>
                )}
              </>
            )}

            <button onClick={() => { setShowSkinShowcaseModal(null); setPurchaseToast(creatorSkinMode === 'showcase' ? 'Showcase saved, brands will see your pitch' : 'Skin set to static'); setTimeout(()=>setPurchaseToast(null),3000); }} style={{ width:'100%', background:creatorSkinMode==='showcase'?C.primary:C.primary, border:'none', borderRadius:8, padding:'12px', color:'var(--c-surface-lowest)', fontWeight:700, fontSize:14, cursor:'pointer', marginTop:8 }}>
              {creatorSkinMode === 'showcase' ? 'Save Showcase' : 'Done'}
            </button>
          </div>
        </div>
      )}

      {/* ValueSkin Edit Modal */}
      <ValueSkinEditModal
        isOpen={showEditValueSkinModal}
        onClose={() => setShowEditValueSkinModal(false)}
        valueSkinId={editingValueSkinId || ''}
        currentData={editingValueSkinData || { name: '', description: '', pitch: '', video: '' }}
        onSave={handleSaveEditValueSkin}
        isLoading={updateLoading}
        userRole={marketplaceRole === 'brand' ? 'brand' : 'creator'}
      />

      {/* Ask Modal — full brand brief */}
      {askModalOpp && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999 }} onClick={() => setAskModalOpp(null)}>
          <div style={{ background: C.surface, borderRadius: '16px', padding: '24px', maxWidth: '480px', width: '95vw', maxHeight: '90vh', overflowY: 'auto', border: `1px solid ${C.border}`, position: 'relative' }} onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setAskModalOpp(null)} style={{ position: 'absolute', top: '14px', right: '16px', background: 'none', border: 'none', color: C.textMuted, fontSize: '22px', cursor: 'pointer', lineHeight: 1 }}>x</button>

            {/* Brand header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
              <div
                onMouseEnter={(e) => showHoverCard(buildBrandHover(askModalOpp.brand), e)}
                onMouseMove={updateHoverPosition}
                onMouseLeave={hideHoverCard}
                style={{ width: 44, height: 44, borderRadius: '10px', background: `linear-gradient(135deg, ${C.primary}, ${C.primary})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, color: 'var(--c-surface-lowest)', cursor: 'pointer' }}>
                {askModalOpp.brand.charAt(0)}
              </div>
              <div>
                <a
                  onMouseEnter={(e) => showHoverCard(buildBrandHover(askModalOpp.brand), e)}
                  onMouseMove={updateHoverPosition}
                  onMouseLeave={hideHoverCard}
                  href={askModalOpp.brandWebsiteUrl || `https://portfolio.valueskins.com/${askModalOpp.brand.replace(/\s+/g, '').toLowerCase()}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: '16px', fontWeight: 700, color: C.text, textDecoration: 'none', display: 'block', cursor: 'pointer' }}>{askModalOpp.brand}</a>
                <div style={{ fontSize: '12px', color: C.textSecondary }}>{askModalOpp.type}</div>
              </div>
            </div>

            {/* About */}
            <div style={{ marginBottom: '18px' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>About this campaign</div>
              <div style={{ fontSize: '13px', color: C.text, lineHeight: 1.6 }}>{askModalOpp.about}</div>
            </div>

            {/* Deliverables */}
            <div style={{ marginBottom: '18px' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>Deliverables</div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {askModalOpp.deliverables.map((d, idx) => (
                  <div key={idx} style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: '8px', padding: '8px 14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '18px', fontWeight: 700, color: C.primary }}>{d.count}</span>
                    <span style={{ fontSize: '12px', color: C.text, fontWeight: 500 }}>{d.format}{d.count > 1 ? 's' : ''}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Script — what the brand expects creators to follow */}
            {(askModalOpp.scriptText || askModalOpp.scriptFileName || (askModalOpp.scriptMode && askModalOpp.scriptMode !== 'creator_freedom')) && (
              <div style={{ marginBottom: '18px' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>Script</div>
                <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: '10px', padding: '12px' }}>
                  {askModalOpp.scriptMode === 'non_negotiable' && (
                    <div style={{ fontSize: '11px', fontWeight: 700, color: C.warning, marginBottom: '8px' }}>🔒 Non-negotiable, the brand provides the exact script that must be followed.</div>
                  )}
                  {askModalOpp.scriptMode === 'discussion' && (
                    <div style={{ fontSize: '11px', fontWeight: 700, color: C.primary, marginBottom: '8px' }}>✏️ Collaborative, both parties edit the script together.</div>
                  )}
                  {askModalOpp.scriptFileName && (
                    <div style={{ fontSize: '12px', fontWeight: 600, color: C.text, marginBottom: askModalOpp.scriptText ? '6px' : 0 }}>📎 {askModalOpp.scriptFileName}</div>
                  )}
                  {askModalOpp.scriptText && (
                    <div style={{ fontSize: '12px', color: C.textSecondary, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{askModalOpp.scriptText}</div>
                  )}
                </div>
              </div>
            )}

            {/* Key details grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '18px' }}>
              <div style={{ background: C.bg, borderRadius: '10px', padding: '12px', border: `1px solid ${C.border}` }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Budget</div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: C.textSecondary }}>{askModalOpp.budget}</div>
              </div>
              <div style={{ background: C.bg, borderRadius: '10px', padding: '12px', border: `1px solid ${C.border}` }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '2px' }}>Deliver by</div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: C.text }}>{askModalOpp.deadline ? new Date(askModalOpp.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Not set'}</div>
                {askModalOpp.applicationDeadline && <div style={{ fontSize:'9px', color:C.textMuted, marginTop:'4px' }}>Apply by: {new Date(askModalOpp.applicationDeadline).toLocaleDateString('en-US', { month:'short', day:'numeric' })}</div>}
              </div>
              <div style={{ background: C.bg, borderRadius: '10px', padding: '12px', border: `1px solid ${C.border}` }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Compensation</div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: C.text }}>{askModalOpp.compensationType}</div>
              </div>
              <div style={{ background: C.bg, borderRadius: '10px', padding: '12px', border: `1px solid ${C.border}` }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Location</div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: C.text }}>{askModalOpp.location}</div>
              </div>
            </div>

            {/* Terms */}
            <div style={{ marginBottom: '18px' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>Terms</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', padding: '6px 0', borderBottom: `1px solid ${C.border}` }}>
                  <span style={{ color: C.textSecondary }}>Exclusivity</span>
                  <span style={{ color: C.text, fontWeight: 500 }}>{askModalOpp.exclusivity}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', padding: '6px 0', borderBottom: `1px solid ${C.border}` }}>
                  <span style={{ color: C.textSecondary }}>Usage rights</span>
                  <span style={{ color: C.text, fontWeight: 500 }}>{askModalOpp.usageRights}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', padding: '6px 0', borderBottom: `1px solid ${C.border}` }}>
                  <span style={{ color: C.textSecondary }}>Revision limit</span>
                  <span style={{ color: C.text, fontWeight: 500 }}>{askModalOpp.revisionLimit} revision{askModalOpp.revisionLimit !== 1 ? 's' : ''}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', padding: '6px 0', borderBottom: `1px solid ${C.border}` }}>
                  <span style={{ color: C.textSecondary }}>Target audience</span>
                  <span style={{ color: C.text, fontWeight: 500 }}>{askModalOpp.audienceTarget}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', padding: '6px 0' }}>
                  <span style={{ color: C.textSecondary }}>Match</span>
                  <span style={{ color: C.primary, fontWeight: 700 }}>{askModalOpp.match}</span>
                </div>
                {askModalOpp.contentReview && (
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:'12px', padding:'6px 0' }}>
                    <span style={{ color:C.textSecondary }}>Content review</span>
                    <span style={{ color: askModalOpp.contentReview==='review_required'?C.warning:C.success, fontWeight:600 }}>
                      {askModalOpp.contentReview==='review_required' ? '📋 Review required' : '✅ Direct upload'}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Other information — shoot location + brand expectations */}
            {(askModalOpp.shootLocation || askModalOpp.expectations || askModalOpp.otherNotes) && (
              <div style={{ marginBottom: '20px' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>Other information</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {askModalOpp.shootLocation && (
                    <div style={{ fontSize: '12px', color: C.text, lineHeight: 1.5 }}>
                      <span style={{ fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Shoot location: </span>
                      {askModalOpp.shootLocation}
                    </div>
                  )}
                  {askModalOpp.expectations && (
                    <div style={{ fontSize: '12px', color: C.text, lineHeight: 1.5 }}>
                      <span style={{ fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.4px' }}>What the brand expects: </span>
                      {askModalOpp.expectations}
                    </div>
                  )}
                  {askModalOpp.otherNotes && (
                    <div style={{ fontSize: '12px', color: C.textSecondary, lineHeight: 1.5 }}>{askModalOpp.otherNotes}</div>
                  )}
                </div>
              </div>
            )}

            {/* Requirements */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>Requirements</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {askModalOpp.requirements.map((req, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '12px', color: C.text, lineHeight: 1.5 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.primary} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginTop: 2, flexShrink: 0 }}><polyline points="20 6 9 17 4 12"/></svg>
                    {req}
                  </div>
                ))}
              </div>
            </div>

            {/* CTA */}
            <button
              onClick={() => setAskModalOpp(null)}
              style={{ width: '100%', background: C.primary, border: 'none', borderRadius: '8px', padding: '12px', color: C.onPrimary, fontWeight: 700, fontSize: '14px', cursor: 'pointer' }}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Level-Up Modal */}
      {showLevelUpModal && (
        <div style={{ position:'fixed', top:0, left:0, right:0, bottom:0, background:'rgba(0,0,0,0.6)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:99999 }}>
          <div style={{ background:'var(--c-surface-lowest)', borderRadius:'20px', padding:'40px 28px 28px', maxWidth:'340px', width:'90vw', textAlign:'center' }}>
            {/* Level badge */}
            <div style={{ width:'72px', height:'72px', borderRadius:'50%', background:`linear-gradient(135deg, ${C.primary}, var(--c-accent))`, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 20px' }}>
              <span style={{ fontSize:'28px', fontWeight:800, color:'var(--c-surface-lowest)' }}>{levelUpTo}</span>
            </div>
            <div style={{ fontSize:'22px', fontWeight:800, color:'#1A1A1A', marginBottom:'8px' }}>Level Up</div>
            <div style={{ fontSize:'15px', color:'#666', marginBottom:'8px', lineHeight:1.5 }}>
              You reached Level {levelUpTo}
            </div>
            <div style={{ fontSize:'13px', color:'#999', marginBottom:'28px' }}>
              Deal completed successfully. Your reputation has been updated.
            </div>
            <div style={{ display:'flex', justifyContent:'center', gap:'32px', marginBottom:'28px' }}>
              <div style={{ textAlign:'center' }}>
                <div style={{ fontSize:'28px', fontWeight:800, color:'#CCC' }}>{levelUpFrom}</div>
                <div style={{ fontSize:'0.75rem', color:'#999', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.5px', marginTop:'2px' }}>Before</div>
              </div>
              <div style={{ display:'flex', alignItems:'center', color:C.primary, fontSize:'20px' }}>&rarr;</div>
              <div style={{ textAlign:'center' }}>
                <div style={{ fontSize:'28px', fontWeight:800, color:C.primary }}>{levelUpTo}</div>
                <div style={{ fontSize:'0.75rem', color:C.primary, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.5px', marginTop:'2px' }}>After</div>
              </div>
            </div>
            <button onClick={() => { setShowLevelUpModal(false); setPurchaseToast('Deal complete, earnings added to your balance'); setTimeout(() => setPurchaseToast(null), 3000); }} style={{ width:'100%', background:C.primary, border:'none', borderRadius:'12px', padding:'14px', color:'var(--c-surface-lowest)', fontWeight:700, fontSize:'15px', cursor:'pointer' }}>
              Continue
            </button>
          </div>
        </div>
      )}

      {/* Toast */}
      {purchaseToast && (
        <div style={{
          position: 'fixed', bottom: '32px', left: '50%', transform: 'translateX(-50%)',
          background: C.card, color: C.text, padding: '14px 24px', borderRadius: '14px',
          fontSize: '14px', fontWeight: 600, zIndex: 99999,
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', gap: '10px', whiteSpace: 'nowrap',
          border: `1px solid ${C.border}`,
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.primary} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          {purchaseToast}
        </div>
      )}

      {/* Main Content */}
      <div style={{ display: activeView === 'events' ? 'none' : 'flex', flex: 1, justifyContent: 'center', overflowX: 'clip', paddingBottom: '60px' }}>
        {/* Content column. It used to be pinned to 600px (900px for a few views),
            which left most of a desktop screen as empty margin. Store and Market
            are dense, two-pane layouts and get the full width; reading views stay
            measured so line length does not get uncomfortable. */}
        <div style={{
          width: '100%',
          // Store and Market run near full-bleed — they are two-pane layouts and
          // 1280px left a wide empty gutter on a desktop screen. They now take
          // the viewport minus a margin, capped so the panes do not stretch
          // absurdly on an ultrawide. Reading views stay measured, because line
          // length past ~860px gets uncomfortable.
          // Settings joins store/market/admin: since the rail came back it is a
          // two-pane layout too, and at 860px it rendered ~705px of content
          // with ~375px of dead gutter either side.
          maxWidth: (activeView === 'store' || activeView === 'mim' || activeView === 'admin' || activeView === 'settings')
            ? 'min(1760px, calc(100vw - 48px))'
            // Profile is an identity page, not a reading column: the sample and
            // Profile page.md §0 both put it at 900px, so the shell has to let
            // 900 through rather than clipping it to the 860 reading width.
            : activeView === 'profile'
            ? '960px'
            : '860px',
          // No side rules. They drew a visible column edge down both sides of
          // every screen, which store-page-mock.svg does not have — the mock is
          // full-bleed and lets whitespace do the framing (BRANDING §6:
          // "breathing room over density", borders "thin, quiet").
          
          background: C.bg,
          overflowX: 'clip',
        }}>

          {/* ── PROFILE VIEW ──────────────────────────────────── */}
          {activeView === 'profile' && (
            <>
              {/* ── PROFILE VIEW ── */}
              {/* 900px, per profile-identity-sample.html's .wrap and Profile
                  page.md §0 ("content column 900px, centered"). The column
                  keeps the identity page from collapsing to a narrow reading
                  column — the Virtual Resume card gets full width. */}
              <div style={{ padding: '34px 28px 80px', maxWidth: '900px', margin: '0 auto' }}>

                {/* ── PROFILE VIEW ── The Instagram Virtual Resume IS the profile
                    section: both permissions render here so Meta App Review
                    sees instagram_business_basic and instagram_business_manage
                    _insights on the page itself. */}
                <div style={{ marginBottom: '16px' }}>
                  <InstagramResumeBlock ig={getOwnInstagram()} />
                </div>

                {/* ValueSkins */}
                {!isBrand && (
                  <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '16px', padding: '20px', marginBottom: '16px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: C.textMuted, marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Your ValueSkins</div>
                    {ownedSkins.length === 0 ? (
                      <div style={{ fontSize: '13px', color: C.textMuted, textAlign: 'center', padding: '20px 0' }}>No ValueSkins yet. Add one from the marketplace.</div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {ownedSkins.map(({ slot, profession }) => {
                          const badge = PROFESSION_BADGES[profession];
                          const level = getLevel(metrics.dealsCompleted);
                          return (
                            <div key={slot} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: C.bg, borderRadius: '10px', border: `1px solid ${C.border}` }}>
                              <div style={{ fontSize: '28px' }}>{badge?.emoji ?? '⭐'}</div>
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: '14px', fontWeight: 700, color: C.text, textTransform: 'capitalize' }}>{profession}</div>
                                <div style={{ fontSize: '0.75rem', color: C.textMuted }}>Level {level} · {slot}</div>
                              </div>
                              <div style={{ padding: '4px 10px', borderRadius: '20px', background: C.primary + '22', color: C.primary, fontSize: '12px', fontWeight: 700 }}>Lv.{level}</div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Delete Account lives in Settings; profile editing opens the
                    Creator Profile Preferences pane from the Settings tab. */}

              </div>
            </>
          )}

          {activeView === 'mim' && (
            <>
              {/* Layer 2: Role selection — show whenever no demo role is chosen,
                  regardless of the linked account role, so non-brand/creator
                  accounts aren't left with a blank marketplace. */}
              {marketplaceRole === 'none' && (
                <>
                  <div style={{ padding: '12px 16px 0', position: 'sticky', top: 'var(--vs-header-h, 0px)', background: C.bg, zIndex: 10 }}>
                    <span style={{ fontSize: '22px', fontWeight: 700, color: C.text }}>Marketplace</span>
                  </div>
                  <div style={{ padding: '40px 16px' }}>
                    <div style={{ textAlign: 'center', marginBottom: '28px' }}>
                      <h2 style={{ fontSize: '20px', fontWeight: 700, color: C.text, marginBottom: '6px' }}>Choose your role</h2>
                      <p style={{ fontSize: '14px', color: C.textSecondary }}>Start trading collaborations and deals</p>
                    </div>
                    <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                      {([
                        { role: 'creator' as const, title: 'Login as Creator', desc: 'Find partnership briefs matched to your ValueSkins', icon: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2' },
                        { role: 'brand' as const, title: 'Login as Brand', desc: 'Find creators for collabs, launches, and paid placements', icon: 'M22 12h-4l-3 9L9 3l-3 9H2' },
                      ]).map(({ role, title, desc, icon }) => (
                        <button
                          key={role}
                          onClick={async () => { setMarketplaceRole(role); await fetch('/api/auth/update-role', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ role }) }); }}
                          style={{
                            flex: 1, background: C.card, border: `1px solid ${C.border}`, borderRadius: '16px',
                            padding: '32px 20px', cursor: 'pointer', textAlign: 'center', transition: 'all 0.15s',
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.primary; e.currentTarget.style.background = C.surfaceAlt; }}
                          onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.background = C.card; }}
                        >
                          <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: `${withAlpha(C.primary, 0x15)}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={C.primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d={icon} />
                              {role === 'creator' && <circle cx="12" cy="7" r="4" />}
                            </svg>
                          </div>
                          <div style={{ fontSize: '16px', fontWeight: 700, color: C.text, marginBottom: '8px' }}>{title}</div>
                          <div style={{ fontSize: '13px', color: C.textSecondary, lineHeight: 1.5, marginBottom: '20px' }}>{desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* Layer 3a: Creator Marketplace */}
              {marketplaceRole === 'creator' && (() => {
                const isProfileComplete = profileName || account?.display_name;

                if (!isProfileComplete) {
                  return (
                    <div style={{ padding: '40px 20px', textAlign: 'center', background: C.card, borderRadius: '12px', margin: '20px', border: `1px solid ${C.border}` }}>
                      <div style={{ fontSize: '20px', fontWeight: 700, color: C.text, marginBottom: '12px' }}>Complete Your Profile</div>
                      <div style={{ fontSize: '14px', color: C.textSecondary, marginBottom: '24px', lineHeight: 1.5, maxWidth: '400px', margin: '0 auto 24px' }}>
                        Before accessing the marketplace, please complete your profile information. This helps us provide better matches and insights.
                      </div>
                    </div>
                  );
                }

                return (
                <>
                  {/* Marketplace header */}
                  <div style={{ padding: '12px 16px 0', position: 'sticky', top: 'var(--vs-header-h, 0px)', background: C.bg, zIndex: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', marginBottom: '16px' }}>
                      <span style={{ fontSize: '22px', fontWeight: 700, color: C.text }}>Marketplace</span>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                        <button
                          onClick={() => setShowCampaignCreator(true)}
                          style={{ background: C.primary, color: C.onPrimary, border: 'none', borderRadius: '8px', padding: '8px 14px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                          Create New Campaign
                        </button>
                        <button
                          onClick={() => setCreatorMarketplaceTab('pipeline')}
                          style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: '8px', padding: '8px 14px', fontSize: '13px', fontWeight: 600, color: C.textSecondary, cursor: 'pointer' }}
                        >
                          View Past Campaigns
                        </button>
                      </div>
                    </div>

                    {/* Available for deals toggle + tab selector */}
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'12px', gap:'8px' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
                        <span style={{ fontSize:'0.75rem', fontWeight:700, color:C.textMuted }}>Available for deals</span>
                        <button onClick={() => setAvailableForDeals(!availableForDeals)} style={{ width:36, height:20, borderRadius:20, border:'none', background: availableForDeals ? C.success : C.border, cursor:'pointer', display:'flex', alignItems:'center', padding: availableForDeals ? '0 2px 0 16px' : '0 16px 0 2px', transition:'all 0.2s' }}>
                          <div style={{ width:16, height:16, borderRadius:'50%', background:'var(--c-surface-lowest)', transition:'all 0.2s' }} />
                        </button>
                        {availableForDeals && <span style={{ fontSize:'0.75rem', fontWeight:700, color:C.success, background:'rgba(200, 184, 154,0.1)', padding:'2px 8px', borderRadius:'12px' }}>Taking deals</span>}
                      </div>
                      <div style={{ display:'flex', gap:'6px', alignItems:'center' }}>
                        {(['opportunities','pipeline'] as const).map(tab => (
                          <button key={tab} onClick={() => setCreatorMarketplaceTab(tab)} style={{ padding:'4px 10px', fontSize:'0.75rem', fontWeight:700, borderRadius:'6px', border:`1px solid ${creatorMarketplaceTab === tab ? C.primary : C.border}`, background: creatorMarketplaceTab === tab ? C.primary : 'transparent', color: creatorMarketplaceTab === tab ? 'var(--c-surface-lowest)' : C.textSecondary, cursor:'pointer' }}>
                            {tab === 'opportunities' ? 'Opportunities' : 'My Pipeline'}
                          </button>
                        ))}
                        <button onClick={handleRefresh} title="Refresh campaigns and creator pool" style={{ background:'none', border:`1px solid ${C.border}`, borderRadius:'6px', cursor:'pointer', padding:'4px 10px', display:'flex', alignItems:'center', gap:'4px', color:C.textMuted, fontSize:'0.75rem', fontWeight:600, opacity: refreshing ? 0.5 : 1 }}>
                          <span style={{ width:6, height:6, borderRadius:'50%', background: realtimeConnected ? 'var(--c-accent)' : 'var(--c-text-variant)', flexShrink:0 }} title={realtimeConnected ? 'Real-time connected' : 'Offline, data refreshes on reload'} />
                          {refreshing ? '↻' : '⟳'} Refresh
                        </button>
                      </div>
                    </div>

                    {/* Category filter chips — scrollable */}
                    {creatorMarketplaceTab === 'opportunities' && (
                    <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '12px', scrollbarWidth: 'none' }}>
                      {!isBrand && ownedSkins.map(s => s.profession).map(skin => {
                        const isActive = selectedMarketplaceSkin === skin;
                        return (
                          <button
                            key={skin}
                            onClick={() => { setSelectedMarketplaceSkin(skin); setNegotiatingOpp(null); }}
                            style={{
                              padding: '7px 16px', borderRadius: '20px', border: 'none', whiteSpace: 'nowrap',
                              background: isActive ? C.text : C.card,
                              color: isActive ? C.bg : C.textSecondary,
                              fontWeight: 600, fontSize: '13px', cursor: 'pointer', transition: 'all 0.15s', flexShrink: 0,
                            }}
                          >
                            {skin}
                          </button>
                        );
                      })}
                    </div>
                    )}
                  </div>

                  <div style={{ padding: '0 16px 16px' }}>
                    {(<>

                    {/* No skin selected prompt (only when there are skins to pick) */}
                    {!selectedMarketplaceSkin && !isBrand && ownedSkins.length > 0 && (
                      <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                        <div style={{ fontSize: '14px', color: C.textSecondary, lineHeight: 1.6 }}>
                          Select a category above to see opportunities matched to your ValueSkins.
                        </div>
                      </div>
                    )}

                    {/* Feature 6: Creator Pipeline View (Meta data source: deal states from backend) */}
                    {creatorMarketplaceTab === 'pipeline' && (() => {
                      // Match deal keys regardless of name prefix (could be profileName or matchingCreator.name)
                      const pipelineDeals = Object.entries(dealStates)
                        .filter(([k]) => !selectedMarketplaceSkin || k.includes(`|${selectedMarketplaceSkin}|`))
                        .map(([key, deal]) => ({ key, ...deal }));

                      // Strict filtering: deals must be ONLY in one column
                      // A deal is "Past Deals" if EITHER side approved it
                      const pastDeals = pipelineDeals.filter(d => d.creatorDealLifecycle === 'approved' || d.brandApprovalPhase === 'approved');
                      const activePipelineDeals = pipelineDeals.filter(d => d.creatorDealLifecycle !== 'approved' && d.brandApprovalPhase !== 'approved');

                      const columns = {
                        'Active': activePipelineDeals.filter(d =>
                          ['offer', 'pending', 'brand_considering', 'brand_reviewing', 'formal_offer'].includes(d.phase)
                        ),
                        'In Progress': activePipelineDeals.filter(d =>
                          ['checklist', 'softhold'].includes(d.phase)
                        ),
                        'Past Deals': pastDeals,
                      };

                      return (
                        <div style={{ marginBottom: '20px' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                            {Object.entries(columns).map(([colName, deals]) => (
                              <div key={colName} style={{ background: C.card, borderRadius: '12px', padding: '14px', border: `1px solid ${C.border}` }}>
                                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  {colName}
                                  <span style={{ background: C.surfaceAlt, padding: '2px 7px', borderRadius: '10px', fontSize: '0.75rem', color: C.textSecondary }}>{deals.length}</span>
                                </div>
                                {deals.length === 0 ? (
                                  <div style={{ fontSize: '0.75rem', color: C.textMuted, textAlign: 'center', padding: '20px 0' }}>No deals</div>
                                ) : (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {deals.map((deal, idx) => {
                                      // For Past Deals, use brandName stored in deal (not opportunity lookup)
                                      const brandName = deal.brandName || 'Brand';
                                      const oppIdx = parseInt(deal.key.split('|')[2] || '0');
                                      const opp = activeOpportunities[oppIdx];
                                      return (
                                        <div key={idx} style={{ background: C.bg, borderRadius: '8px', padding: '10px', border: `1px solid ${C.border}`, cursor: 'pointer', transition: 'all 0.2s' }} onClick={() => { if (opp) setNegotiatingOpp(oppIdx); }}>
                                          <div
                                            onMouseEnter={(e) => showHoverCard(buildBrandHover(brandName), e)}
                                            onMouseMove={updateHoverPosition}
                                            onMouseLeave={hideHoverCard}
                                            style={{ fontSize: '12px', fontWeight: 700, color: C.text, marginBottom: '3px', cursor: 'pointer' }}
                                          >{brandName}</div>
                                          <div style={{ fontSize: '0.75rem', color: C.textSecondary, marginBottom: '4px' }}>{opp?.budget || 'N/A'}</div>
                                          <div style={{ fontSize: '9px', color: C.textMuted, background: `${withAlpha(C.primary, 0x15)}`, padding: '2px 6px', borderRadius: '4px', display: 'inline-block' }}>
                                            Completed
                                          </div>
                                          <button onClick={e => { e.stopPropagation(); downloadDealReport(deal.key); }} style={{ width:'100%', marginTop:'8px', background:C.primary, border:'none', borderRadius:'6px', padding:'5px 8px', color:'var(--c-surface-lowest)', fontSize:'0.75rem', fontWeight:600, cursor:'pointer' }}>
                                            Download the final report
                                          </button>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                          {pipelineDeals.length === 0 && (
                            <div style={{ textAlign: 'center', padding: '40px 20px', color: C.textMuted }}>
                              <div style={{ fontSize: '14px', marginBottom: '4px' }}>No active deals</div>
                              <div style={{ fontSize: '12px' }}>Switch to Opportunities to find new brands to work with.</div>
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* Opportunities for selected skin */}
                    {selectedMarketplaceSkin && (
                      <>
                        {activeOpportunities.filter(opp => (!filterOppsBarterOnly || opp.willingToBarter) && (!creatorCampaignSearch.trim() || opp.brand.toLowerCase().includes(creatorCampaignSearch.trim().toLowerCase()) || (opp.about||'').toLowerCase().includes(creatorCampaignSearch.trim().toLowerCase()) || (opp.budget||'').toLowerCase().includes(creatorCampaignSearch.trim().toLowerCase()))).length === 0 && (
                          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                            <div style={{ fontSize: '14px', color: C.textSecondary, lineHeight: 1.6 }}>
                              No campaigns targeting {selectedMarketplaceSkin} yet. Brands will create campaigns that appear here in real-time.
                            </div>
                          </div>
                        )}
                        {activeOpportunities.filter(opp => (!filterOppsBarterOnly || opp.willingToBarter) && (!creatorCampaignSearch.trim() || opp.brand.toLowerCase().includes(creatorCampaignSearch.trim().toLowerCase()) || (opp.about||'').toLowerCase().includes(creatorCampaignSearch.trim().toLowerCase()) || (opp.budget||'').toLowerCase().includes(creatorCampaignSearch.trim().toLowerCase()))).map((opp) => {
                          // Deal key format: creatorName|creatorSkin|oppIndex (allows multiple deals per creator)
                          // Use actual opportunity index from activeOpportunities (not filtered index)
                          const actualOppIndex = activeOpportunities.indexOf(opp);
                          const matchingCreator = backendCreators.find((c: any) => c.valueSkin === selectedMarketplaceSkin);
                          const dealCreatorName = matchingCreator?.name || profileName;
                          const dealKey = `${dealCreatorName}|${selectedMarketplaceSkin}|${actualOppIndex}`;
                          const relatedDealEntries = Object.entries(dealStates).filter(([k, d]) =>
                            k.startsWith(`${dealCreatorName}|${selectedMarketplaceSkin}|`) ||
                            (d?.creatorName === dealCreatorName && d?.creatorSkin === selectedMarketplaceSkin)
                          );
                          const existingDealEntry =
                            relatedDealEntries.find(([k, d]) => k === dealKey || d?.opportunityIndex === actualOppIndex) ||
                            (dealStates[dealKey] ? [dealKey, dealStates[dealKey]] as [string, typeof dealStates[string]] : undefined);
                          const existingDeal = existingDealEntry?.[1];
                          const hasActiveDeal = !!existingDeal && existingDeal.phase !== 'brief';
                          const isDealDone = !!existingDeal && (existingDeal.creatorDealLifecycle === 'approved' || existingDeal.brandApprovalPhase === 'approved');
                          const isNegotiating = negotiatingOpp === actualOppIndex || hasActiveDeal;
                          const brandInitial = opp.brand.charAt(0).toUpperCase();
                          return (
                            <div
                              key={actualOppIndex}
                              style={{ background: C.card, borderRadius: '16px', padding: '16px', marginBottom: '12px', border: `1px solid ${C.border}` }}
                            >
                              {/* Brand header row */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                                <div
                                  onMouseEnter={(e) => showHoverCard(buildBrandHover(opp.brand), e)}
                                  onMouseMove={updateHoverPosition}
                                  onMouseLeave={hideHoverCard}
                                  style={{ width: '40px', height: '40px', borderRadius: '50%', background: `linear-gradient(135deg, ${C.primary}, var(--c-accent))`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, cursor: 'pointer' }}
                                >
                                  <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--c-surface-lowest)' }}>{brandInitial}</span>
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <a
                                    onMouseEnter={(e) => showHoverCard(buildBrandHover(opp.brand), e)}
                                    onMouseMove={updateHoverPosition}
                                    onMouseLeave={hideHoverCard}
                                    href={opp.brandWebsiteUrl || `https://portfolio.valueskins.com/${opp.brand.replace(/\s+/g, '')}`} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={{ fontSize: '15px', fontWeight: 700, color: C.text, textDecoration: 'none', display: 'block', cursor: 'pointer' }}>{opp.brand}</a>
                                  <div style={{ fontSize: '13px', color: C.textSecondary }}>{opp.type}</div>
                                </div>
                                <div style={{ fontSize: '14px', fontWeight: 700, color: C.primary }}>{opp.match}</div>
                              </div>

                              {/* Budget + deliverable pills */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
                                <span style={{ fontSize: '14px', fontWeight: 700, color: C.text }}>{opp.budget}</span>
                                {opp.deliverables.map((d, di) => (
                                  <span key={di} style={{ fontSize: '12px', fontWeight: 600, color: C.textSecondary, background: C.surfaceAlt, padding: '4px 10px', borderRadius: '20px' }}>
                                    {d.count} {d.format}{d.count > 1 ? 's' : ''}
                                  </span>
                                ))}
                                {opp.willingToBarter && <span style={{ fontSize: '12px', fontWeight: 600, color: C.success, background: `${withAlpha(C.success, 0x15)}`, padding: '4px 10px', borderRadius: '20px' }}>Barter</span>}
                                {opp.contentReview && (
                                  <span style={{ fontSize:'0.75rem', fontWeight:600, color: opp.contentReview==='review_required'?C.warning:C.success, background: opp.contentReview==='review_required'?`${withAlpha(C.warning, 0x12)}`:`${withAlpha(C.success, 0x15)}`, padding:'4px 10px', borderRadius:'20px' }}>
                                    {opp.contentReview==='review_required' ? '📋 Review' : '✅ Direct'}
                                  </span>
                                )}
                              </div>

                              {/* Brief strip — shoot location, expectations, script draft */}
                              {(opp.shootLocation || opp.expectations || opp.scriptFileName || opp.scriptText) && (
                                <div style={{ marginBottom: '12px', fontSize: '12px', color: C.textSecondary, lineHeight: 1.5 }}>
                                  {opp.shootLocation && (
                                    <div style={{ marginBottom: '3px' }}>
                                      <span style={{ fontWeight: 700, color: C.textMuted }}>Shoot: </span>{opp.shootLocation}
                                    </div>
                                  )}
                                  {opp.expectations && (
                                    <div style={{ marginBottom: '3px' }}>
                                      <span style={{ fontWeight: 700, color: C.textMuted }}>Expectations: </span>
                                      {opp.expectations.length > 110 ? opp.expectations.slice(0, 110) + '…' : opp.expectations}
                                    </div>
                                  )}
                                  {(opp.scriptFileName || opp.scriptText) && (
                                    <div>
                                      <span style={{ fontWeight: 700, color: C.textMuted }}>Script: </span>
                                      {opp.scriptFileName ? `📎 ${opp.scriptFileName}` : null}
                                      {opp.scriptFileName && opp.scriptText ? ', ' : null}
                                      {opp.scriptText && !opp.scriptFileName ? 'Brand script' : null}
                                      {opp.scriptMode === 'non_negotiable' ? ' (non-negotiable, locked)' : ''}
                                      {opp.scriptMode === 'discussion' ? ' (collaborative)' : ''}
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Action row */}
                              <div style={{ display: 'flex', gap: '8px' }}>
                                <button
                                  onClick={(e) => { e.stopPropagation(); setAskModalOpp(opp); }}
                                  style={{ flex: 1, fontSize: '13px', fontWeight: 600, color: C.textSecondary, background: 'transparent', border: `1px solid ${C.border}`, padding: '10px', borderRadius: '10px', cursor: 'pointer' }}
                                >
                                  Details
                                </button>
                                <button
                                  onClick={() => {
                                    if (isDealDone) {
                                      setPurchaseToast('This deal is already completed and locked.');
                                      setTimeout(() => setPurchaseToast(null), 2500);
                                      return;
                                    }
                                    if (!dealKey) return;
                                    setNegotiatingOpp(actualOppIndex);
                                    // Only reset deal state if starting fresh (no active deal yet)
                                    if (!existingDeal || existingDeal.phase === 'brief') {
                                      updateDeal(dealKey, {
                                        phase: 'pending',
                                        offerAmount: opp.budget?.replace(/[^0-9]/g, '') || '5000',
                                        counterAmount: '',
                                        dealType: resolveDealType(opp.compensationType || 'Paid'),
                                        isInternationalDeal: isInternationalDeal(matchingCreator?.audienceLocation || '', opp.location || ''),
                                        poc: opp.poc,
                                        opportunityIndex: actualOppIndex,
                                        creatorName: dealCreatorName,
                                        creatorSkin: selectedMarketplaceSkin,
                                        creatorMarketplaceIndex: matchingCreator ? (matchingCreator as any)._origIdx : undefined,
                                      });
                                      if (opp.campaignId) {
                                        const newApp: SharedApplication = {
                                          id: Date.now(),
                                          campaignId: opp.campaignId,
                                          campaignTitle: opp.type,
                                          creatorProfession: selectedMarketplaceSkin || '',
                                          creatorHandle: matchingCreator?.handle || `@${profileName.replace(/\s+/g, '_')}`,
                                          status: 'pending',
                                          appliedAt: new Date().toISOString(),
                                          creatorName: matchingCreator?.name || profileName || 'Demo Creator',
                                          creatorFollowers: `${(metrics.followers / 1000).toFixed(metrics.followers >= 1000000 ? 1 : 0)}${metrics.followers >= 1000000 ? 'M' : 'K'}`,
                                          creatorEngagement: `${metrics.engagement.toFixed(1)}%`,
                                          creatorLevel: getLevel(metrics.dealsCompleted),
                                          creatorMatchScore: opp.match,
                                          creatorRate: rateCard.reel ? `₹${rateCard.reel}` : '₹3,000',
                                          creatorDealCompletionRate: 95,
                                          creatorPortfolio: [],
                                          creatorAudienceLocation: selectedCountry || 'USA',
                                          creatorAudienceAge: '25-34',
                                          creatorResponseTimeHrs: 6,
                                          creatorWebsiteUrl: `https://portfolio.valueskins.com/${profileName.replace(/\s+/g, '_')}`,
                                          opportunityIndex: actualOppIndex,
                                        };
                                        if (!sharedApplications.some(a => a.opportunityIndex === actualOppIndex && a.campaignId === opp.campaignId && a.creatorName === profileName)) {
                                          persistApplications([...sharedApplications, newApp]);
                                        }
                                      }
                                    }
                                  }}
                                  style={{ flex: 1, fontSize: '13px', fontWeight: 700, color: 'var(--c-surface-lowest)', background: isDealDone ? C.textMuted : hasActiveDeal ? C.success : C.primary, border: 'none', padding: '10px', borderRadius: '10px', cursor: isDealDone ? 'default' : 'pointer', opacity: isDealDone ? 0.6 : 1 }}
                                >
                                  {isDealDone ? 'Approved and Deal Completed' : hasActiveDeal ? 'Open Deal' : 'View Deal'}
                                </button>
                              </div>

                              {/* Deal Room — shown when: negotiating this opp OR there's an active deal for this opp */}
                              {(negotiatingOpp === actualOppIndex) && (
                                <div ref={dealRoomRef} style={{ background: C.card, borderRadius: '16px', padding: '16px', border: `1px solid ${C.border}` }}>
                                  {/* Deal Room Back Button */}
                                  <button onClick={() => setNegotiatingOpp(null)} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', color: C.textSecondary, cursor: 'pointer', fontSize: '12px', fontWeight: 600, padding: '0 0 10px', marginBottom: '2px' }}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.textSecondary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                                    Back to marketplace
                                  </button>
                                  {/* Deal Room header — shield + brand */}
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                                    <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: `${withAlpha(C.primary, 0x15)}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                                      </svg>
                                    </div>
                                    <div style={{ flex: 1 }}>
                                      <div style={{ fontSize: '15px', fontWeight: 700, color: C.text }}>
                                        Deal Room · <a
                                          onMouseEnter={(e) => showHoverCard(buildBrandHover(opp.brand), e)}
                                          onMouseMove={updateHoverPosition}
                                          onMouseLeave={hideHoverCard}
                                          href={opp.brandWebsiteUrl || `https://portfolio.valueskins.com/${opp.brand.replace(/\s+/g, '')}`} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={{ color: C.primary, textDecoration: 'none', cursor:'pointer' }}>{opp.brand}</a>
                                      </div>
                                      <div style={{ fontSize: '12px', color: C.textMuted }}>
                                        {dealRoomPhase === 'accepted' || dealRoomPhase === 'softhold' ? 'Deal accepted, terms locked' : dealRoomPhase === 'formal_offer' ? 'Review formal offer' : 'Fixed deal, final amount set by the brand'}
                                      </div>
                                    </div>
                                  </div>

                                  {/* Feature 1: Deal Lifecycle Phase Indicator */}
                                  <div style={{ marginBottom:'12px', padding:'10px 12px', background:C.bg, borderRadius:'10px', border:`1px solid ${C.border}` }}>
                                    <div style={{ fontSize:'9px', fontWeight:700, color:C.textMuted, textTransform:'uppercase', marginBottom:'8px', letterSpacing:'0.5px' }}>Deal Progression</div>
                                    <div style={{ display:'flex', alignItems:'center', gap:'4px' }}>
                                      {(() => {
                                        const STEPS = ['brief', 'offer', 'accepted', 'completed'];
                                        const LABELS: Record<string, string> = { brief:'Brief', offer:'Offer', accepted:'Accepted', completed:'Completed' };
                                        const phaseOrder: Record<string, number> = { brief:0, offer:1, pending:1, brand_considering:1.5, brand_reviewing:1.5, brand_countered:2, counter:2, last_offer:2.5, formal_offer:2.5, checklist:2.5, accepted:3, softhold:4, rejected:-1, brand_rejected:-1 };
                                        const current = phaseOrder[dealRoomPhase] ?? 0;
                                        return STEPS.map((step, idx, arr) => {
                                          const stepPos = idx;
                                          const isActive = current >= 0 && Math.floor(current) === stepPos;
                                          const isCompleted = current >= stepPos + 0.5;
                                          return (
                                            <React.Fragment key={step}>
                                              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'4px' }}>
                                                <div style={{ width:'28px', height:'28px', borderRadius:'50%', background: dealRoomPhase === 'rejected' || dealRoomPhase === 'brand_rejected' ? C.danger : isCompleted ? C.success : !isActive && current < stepPos && current !== -1 ? C.border : isActive ? C.primary : C.border, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.75rem', fontWeight:700, color: isCompleted || isActive ? 'var(--c-surface-lowest)' : C.textMuted, transition:'all 0.2s' }}>
                                                  {dealRoomPhase === 'rejected' || dealRoomPhase === 'brand_rejected' ? '✕' : isCompleted ? '✓' : idx + 1}
                                                </div>
                                                <div style={{ fontSize:'8px', color: isActive ? C.primary : C.textMuted, fontWeight: isActive ? 700 : 400, textAlign:'center', minWidth:'40px' }}>{LABELS[step]}</div>
                                              </div>
                                              {idx < arr.length - 1 && (
                                                <div style={{ flex:1, height:'2px', background: isCompleted ? C.success : C.border, margin:'0 2px', marginTop:'-8px' }} />
                                              )}
                                            </React.Fragment>
                                          );
                                        });
                                      })()}
                                    </div>
                                  </div>

                                  {/* Audit trail notice */}
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', padding: '8px 12px', background: `${withAlpha(C.primary, 0x08)}`, borderRadius: '10px' }}>
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={C.primary} strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                                    <span style={{ fontSize: '0.75rem', color: C.textSecondary }}>All messages logged with UTC timestamps</span>
                                  </div>

                                  {/* Brand identity + intent */}
                                  <div style={{ fontSize: '0.75rem', color: C.textMuted, marginBottom: '10px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                    <span
                                      onMouseEnter={() => setHoveredTooltip('intent')}
                                      onMouseLeave={() => setHoveredTooltip(null)}
                                      style={{ background: C.bg, padding: '2px 8px', borderRadius: '4px', border: `1px solid ${C.border}`, cursor: 'help', position: 'relative' }}
                                    >
                                      Intent: <strong style={{ color: C.text }}>Campaign</strong>
                                      {hoveredTooltip === 'intent' && (
                                        <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 10px', width: 220, zIndex: 10, fontSize: 11, lineHeight: 1.5, color: C.text, boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>
                                          <strong>What is Intent?</strong><br/>
                                          How the brand wants to work with you:<br/>
                                          <span style={{ color: C.textSecondary }}>Explore</span>, just browsing, no commitment<br/>
                                          <span style={{ color: C.primary }}>Campaign</span>, specific paid project<br/>
                                          <span style={{ color: 'var(--c-accent)' }}>Long-term</span>, ongoing partnership/retainer
                                        </div>
                                      )}
                                    </span>
                                    <span
                                      onMouseEnter={() => setHoveredTooltip('campaign_type')}
                                      onMouseLeave={() => setHoveredTooltip(null)}
                                      style={{ background: C.bg, padding: '2px 8px', borderRadius: '4px', border: `1px solid ${C.border}`, cursor: 'help', position: 'relative' }}
                                    >
                                      Type: <strong style={{ color: C.text }}>{brandCampaignType}</strong>
                                      {hoveredTooltip === 'campaign_type' && (
                                        <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 10px', width: 240, zIndex: 10, fontSize: 11, lineHeight: 1.5, color: C.text, boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>
                                          <strong>Campaign Types:</strong><br/>
                                          <span style={{ color: C.textSecondary }}>Product Review</span>, showcase/review their product<br/>
                                          <span style={{ color: C.primary }}>Sponsored Content</span>, branded post/reel<br/>
                                          <span style={{ color: 'var(--c-accent)' }}>Brand Ambassador</span>, represent the brand over time<br/>
                                          <span style={{ color: 'var(--c-warning)' }}>UGC</span>, user-generated content for their ads<br/>
                                          <span style={{ color: C.textMuted }}>Affiliate</span>, earn per sale/click you drive
                                        </div>
                                      )}
                                    </span>
                                  </div>

                                  {/* Creator sees brand's offer — respond with accept or counter */}
                                  {(dealRoomPhase === 'pending' || dealRoomPhase === 'brief') && (
                                    <>
                                      <div style={{ background: 'rgba(200, 184, 154,0.06)', borderRadius: '8px', padding: '12px', marginBottom: '12px', border: `1px solid rgba(200, 184, 154,0.2)` }}>
                                        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: C.primary, marginBottom: '6px' }}>Brand Offer Received</div>
                                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '4px' }}>
                                          <span style={{ fontSize: '22px', fontWeight: 800, color: C.text }}>${parseInt(dealOfferAmount || opp.budget?.replace(/[^0-9]/g, '') || '5000').toLocaleString()}</span>
                                          <span style={{ fontSize: '12px', color: C.textMuted }}>/post</span>
                                        </div>
                                        {activeDeal?.briefTitle && <div style={{ fontSize: '0.75rem', color: C.textSecondary, marginTop: '4px' }}>Campaign: {activeDeal.briefTitle}</div>}
                                      </div>
                                      <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                                        {/* ── [v1] No negotiation — brand's campaign amount is FINAL. Accept locks the deal immediately. */}
                                        <button
                                          onClick={() => {
                                            const localKey = `${profileName}|${selectedMarketplaceSkin}|${actualOppIndex}`;
                                            const now = new Date();
                                            const timeStr = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: false });
                                            const acceptMsg = { id: Date.now(), sender: 'creator' as const, text: `Creator accepted the fixed deal at ₹${parseInt(dealOfferAmount || opp.budget?.replace(/[^0-9]/g, '') || '5000').toLocaleString()}/post (no negotiation)`, time: timeStr, isoTime: now.toISOString(), seen: false };
                                            const existingMsgs = (activeDeal?.chatMessages) || [];
                                            updateDeal(localKey, {
                                              phase: 'accepted',
                                              offerAmount: opp.budget?.replace(/[^0-9]/g, '') || '5000',
                                              chatMessages: [...(existingMsgs as any[]), acceptMsg],
                                            });
                                            setPurchaseToast('Deal accepted, terms locked');
                                            setTimeout(() => setPurchaseToast(null), 2500);
                                          }}
                                          style={{ flex: 1, background: C.success, border: 'none', padding: '9px', borderRadius: '8px', color: 'var(--c-surface-lowest)', fontWeight: 600, cursor: 'pointer', fontSize: '12px' }}
                                        >
                                          Accept Deal, ₹{parseInt(dealOfferAmount || opp.budget?.replace(/[^0-9]/g, '') || '5000').toLocaleString()} (fixed)
                                        </button>
                                        <button
                                          onClick={() => {
                                            if (activeDealKey) {
                                              const now = new Date();
                                              const timeStr = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: false });
                                              const rejectMsg = { id: Date.now(), sender: 'creator' as const, text: 'Creator declined the offer', time: timeStr, isoTime: now.toISOString(), seen: false };
                                              setChatMessages(prev => [...prev, rejectMsg]);
                                              sharedAddMessage(activeDealKey || '', rejectMsg);
                                              setDealRoomPhase('rejected');
                                              updateDeal(activeDealKey, { phase: 'rejected' });
                                            }
                                            setNegotiatingOpp(null);
                                            setPurchaseToast('Offer rejected');
                                            setTimeout(() => setPurchaseToast(null), 2000);
                                          }}
                                          style={{ flex: 1, background: 'none', border: `1px solid rgba(176, 65, 62,0.3)`, padding: '9px', borderRadius: '8px', color: 'var(--c-error)', fontWeight: 600, cursor: 'pointer', fontSize: '12px' }}
                                        >
                                          Reject
                                        </button>
                                      </div>
                                    </>
                                  )}

                                  {/* ── [v1 COMMENTED OUT] Negotiation UI — no negotiation in v1. See Things-Commented-Out.md. */}
                                  {false && dealRoomPhase === 'counter' && (
                                    <div style={{ background: 'rgba(255,193,7,0.06)', borderRadius: '8px', padding: '12px', border: `1px solid rgba(255,193,7,0.2)` }}>
                                      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--c-warning)', marginBottom: '6px' }}>Counter Offer Sent</div>
                                      <div style={{ fontSize: '12px', color: C.text, marginBottom: '8px' }}>Your counter-offer of <strong>${parseInt(dealCounterAmount || '0').toLocaleString()}</strong> has been sent to the brand.</div>
                                      <div style={{ fontSize: '0.75rem', color: C.textSecondary, lineHeight: 1.5 }}>Waiting for their response, they can accept, reject, or send a counter-offer back.</div>
                                    </div>
                                  )}

                                  {/* ── [v1 COMMENTED OUT] Negotiation UI — brand's amount is final, no counters. */}
                                  {false && dealRoomPhase === 'pending' && dealCounterAmount && parseInt(dealOfferAmount || '0') === parseInt(dealCounterAmount) && (
                                    <div style={{ background: 'rgba(76,175,80,0.06)', borderRadius: '8px', padding: '12px', border: `1px solid rgba(76,175,80,0.2)` }}>
                                      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: C.success, marginBottom: '6px' }}>Counter-Offer Accepted!</div>
                                      <div style={{ fontSize: '12px', color: C.text, marginBottom: '8px' }}>{opp.brand} accepted your counter-offer of <strong>${parseInt(dealCounterAmount).toLocaleString()}/post</strong></div>
                                      <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                                        <button
                                          onClick={() => {
                                            const now = new Date();
                                            const timeStr = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: false });
                                            const acceptMsg = { id: Date.now(), sender: 'creator' as const, text: `Creator confirmed agreement at ₹${parseInt(dealCounterAmount).toLocaleString()}/post`, time: timeStr, isoTime: now.toISOString(), seen: false };
                                            setChatMessages(prev => [...prev, acceptMsg]);
                                            sharedAddMessage(activeDealKey || '', acceptMsg);
                                            updateDeal(activeDealKey!, { phase: 'accepted' });
                                            setDealRoomPhase('accepted');
                                          }}
                                          style={{ flex: 1, background: C.success, border: 'none', padding: '9px', borderRadius: '8px', color: 'var(--c-surface-lowest)', fontWeight: 600, cursor: 'pointer', fontSize: '12px' }}
                                        >
                                          Confirm & Accept
                                        </button>
                                        <button
                                          onClick={() => setShowCancelDealModal(true)}
                                          style={{ flex: 1, background: 'none', border: `1px solid rgba(176, 65, 62,0.3)`, padding: '9px', borderRadius: '8px', color: 'var(--c-error)', fontWeight: 600, cursor: 'pointer', fontSize: '12px' }}
                                        >
                                          Decline
                                        </button>
                                      </div>
                                    </div>
                                  )}

                                  {dealRoomPhase === 'rejected' && (
                                    <div style={{ textAlign: 'center', padding: '20px 12px' }}>
                                      <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(176, 65, 62,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--c-error)" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                                      </div>
                                      <div style={{ fontSize: '15px', fontWeight: 700, color: C.text, marginBottom: '4px' }}>Deal Rejected</div>
                                      <div style={{ fontSize: '12px', color: C.textSecondary, marginBottom: '14px' }}>You declined this offer. Return to marketplace to explore other opportunities.</div>
                                      <button onClick={() => setNegotiatingOpp(null)} style={{ width: '100%', background: C.primary, border: 'none', padding: '10px', borderRadius: '8px', color: C.onPrimary, fontWeight: 600, cursor: 'pointer', fontSize: '12px' }}>Back to Marketplace</button>
                                    </div>
                                  )}

                                  {dealRoomPhase === 'formal_offer' && (() => {
                                    const agreedPrice = dealCounterAmount || dealOfferAmount || opp.budget.replace(/[^0-9]/g, '') || '5000';
                                    const totalPrice = parseInt(agreedPrice) || 5000;
                                    // Creator submitted this — show waiting screen, not the signing UI
                                    if (activeDeal?.formalOfferSentByCreator) {
                                      return (
                                        <div style={{ textAlign: 'center', padding: '24px 12px' }}>
                                          <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'rgba(200, 184, 154,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={C.primary} strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                                          </div>
                                          <div style={{ fontSize: '14px', fontWeight: 700, color: C.text, marginBottom: '6px' }}>Final Offer Submitted</div>
                                          <div style={{ fontSize: '12px', color: C.textSecondary, lineHeight: 1.6, marginBottom: '16px' }}>
                                            Your offer of <strong>${totalPrice.toLocaleString()}</strong> has been sent to {opp.brand}.<br />
                                            Waiting for them to review and approve.
                                          </div>
                                          <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: '8px', padding: '10px', fontSize: '0.75rem', color: C.textMuted }}>
                                            You cannot edit terms at this stage. If the brand rejects, you can renegotiate.
                                          </div>
                                        </div>
                                      );
                                    }
                                    const advPct = advancePercent;
                                    const approvalPct = approvalPercent;
                                    const refId = `DR-${activeDealKey ? Math.abs(activeDealKey.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 9000 + 1000) : '0000'}-${opp.brand.replace(/\s/g, '').slice(0, 3).toUpperCase()}`;
                                    const briefText = `${opp.about || ''} ${opp.requirements?.join(' ') || ''} ${opp.deliverables?.map(d => d.format).join(', ') || ''}`;
                                    const hasSensitiveContent = isSensitiveContent(briefText) || isSensitiveContent(opp.brand);
                                    return (
                                      <>
                                        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '12px' }}>Formal Offer, Review &amp; Accept</div>
                                        <div style={{ fontSize: '0.75rem', color: C.textSecondary, marginBottom: '14px', lineHeight: 1.5 }}>
                                          The brand has submitted their final offer based on your chat negotiation. This document is the binding record of what was agreed.
                                        </div>
                                        {/* Sensitive content disclaimer */}
                                        {hasSensitiveContent && (
                                          <div style={{ background: 'rgba(255,152,0,0.08)', border: '1px solid rgba(255,152,0,0.3)', borderRadius: '8px', padding: '10px', marginBottom: '12px' }}>
                                            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#ff9800', marginBottom: '4px', textTransform: 'uppercase' }}>⚠️ Content Disclaimer Required</div>
                                            <div style={{ fontSize: '0.75rem', color: C.textSecondary, lineHeight: 1.5 }}>
                                              This campaign involves regulated or sensitive topics (healthcare, skincare, legal, financial, etc.). <strong>You must include clear disclaimers</strong> in your content such as:
                                              <ul style={{ margin: '6px 0 0 16px', paddingLeft: 0 }}>
                                                <li style={{ fontSize: '0.75rem', marginBottom: '3px' }}>"This is my personal opinion/experience, not professional advice"</li>
                                                <li style={{ fontSize: '0.75rem', marginBottom: '3px' }}>"Based on advice from my [doctor/lawyer/specialist]"</li>
                                                <li style={{ fontSize: '0.75rem' }}>"Consult a qualified professional before acting on this"</li>
                                              </ul>
                                            </div>
                                            <div style={{ fontSize: '0.75rem', color: C.warning, marginTop: '6px' }}>Failure to include disclaimers may result in account penalties. See <a href="/terms" style={{ color: C.warning, textDecoration: 'underline' }}>Terms &amp; Conditions</a> for details.</div>
                                          </div>
                                        )}

                                        {/* Price */}
                                        <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: '10px', padding: '12px', marginBottom: '10px' }}>
                                          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>Agreed Total</div>
                                          <div style={{ fontSize: '24px', fontWeight: 800, color: C.text }}>${totalPrice.toLocaleString()}</div>
                                          <div style={{ fontSize: '0.75rem', color: C.textSecondary, marginTop: '2px' }}>{opp.type}</div>
                                        </div>

                                        {/* Payment split */}
                                        <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: '10px', padding: '12px', marginBottom: '10px' }}>
                                          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>Payment Schedule (your terms)</div>
                                          {[
                                            { label: 'Advance', desc: 'Paid before work begins', pct: advPct, color: C.success },
                                            { label: 'On approval', desc: 'Paid after brand signs off', pct: approvalPct, color: C.warning },
                                          ].map(row => (
                                            <div key={row.label} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                                              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: row.color, flexShrink: 0 }} />
                                              <div style={{ flex: 1 }}>
                                                <div style={{ fontSize: '12px', fontWeight: 600, color: C.text }}>{row.label} <span style={{ color: C.textMuted, fontWeight: 400 }}>· {row.desc}</span></div>
                                              </div>
                                              <div style={{ fontSize: '13px', fontWeight: 700, color: row.color }}>{row.pct}% <span style={{ fontSize: '0.75rem', color: C.textMuted, fontWeight: 400 }}>(${Math.round(totalPrice * row.pct / 100).toLocaleString()})</span></div>
                                            </div>
                                          ))}
                                        </div>

                                        {/* Deliverables */}
                                        <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: '10px', padding: '12px', marginBottom: '10px' }}>
                                          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>Deliverables</div>
                                          {opp.deliverables.map((d, di) => (
                                            <div key={di} style={{ fontSize: '12px', color: C.text, marginBottom: '3px' }}>{d.count}x {d.format}</div>
                                          ))}
                                          {opp.deadline && <div style={{ fontSize: '0.75rem', color: C.textMuted, marginTop: '4px' }}>Deliver by: {new Date(opp.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>}
                                          {opp.applicationDeadline && <div style={{ fontSize:'0.75rem', color:C.textMuted, marginTop:'2px' }}>Apply by: {new Date(opp.applicationDeadline).toLocaleDateString('en-US', { month:'short', day:'numeric' })}</div>}
                                        </div>

                                        {/* Ref + timestamp */}
                                        <div style={{ fontSize: '0.75rem', color: C.textMuted, marginBottom: '14px', display: 'flex', gap: '6px', alignItems: 'center' }}>
                                          <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke={C.primary} strokeWidth="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                                          <span style={{ fontFamily: 'monospace' }}>{refId}</span>
                                          <span>· Submitted {new Date().toISOString().replace('T', ' ').slice(0, 19)} UTC</span>
                                        </div>

                                        {/* Exclusivity conflict warning */}
                                        {activeExclusivities.some(d => d.exclusivitySkin === (selectedMarketplaceSkin || '')) && (
                                          <div style={{ background:'rgba(176, 65, 62,0.08)', border:'1px solid rgba(176, 65, 62,0.3)', borderRadius:'8px', padding:'10px', marginBottom:'10px' }}>
                                            <div style={{ fontSize:'0.75rem', fontWeight:700, color:'var(--c-error)', marginBottom:'3px' }}>Exclusivity Conflict</div>
                                            <div style={{ fontSize:'0.75rem', color:C.textSecondary, lineHeight:1.4 }}>
                                              You have an active exclusivity agreement with <strong>{activeExclusivities.find(d => d.exclusivitySkin === selectedMarketplaceSkin)?.brand}</strong> for this skin.
                                              Accepting this deal may violate that agreement.
                                            </div>
                                          </div>
                                        )}

                                        {/* Contract agreement */}
                                        <div style={{ background:C.bg, border:`1px solid ${C.border}`, borderRadius:'10px', padding:'12px', marginBottom:'10px' }}>
                                          <div style={{ fontSize:'0.75rem', fontWeight:700, color:C.textMuted, textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:'8px' }}>Contract Terms</div>
                                          {[
                                            { key: 'deliverables', label: `I agree to deliver ${opp.deliverables.map(d => `${d.count}x ${d.format}`).join(', ')} by ${opp.deadline ? new Date(opp.deadline).toLocaleDateString('en-US', { month:'short', day:'numeric' }) : 'agreed date'}` },
                                            { key: 'payment', label: `Payment of ₹${totalPrice.toLocaleString()} split as: ${advPct}% advance, ${approvalPct}% on approval` },
                                            { key: 'usage', label: `Brand may use content for ${opp.usageRights || 'agreed period'} per usage rights terms` },
                                            { key: 'exclusivity', label: `Exclusivity: ${opp.exclusivity || 'None'}, I will not promote competing brands during this period` },
                                            { key: 'revisions', label: `Up to ${opp.revisionLimit} revision round${opp.revisionLimit !== 1 ? 's' : ''} included at no extra cost` },
                                          ].map(term => (
                                            <div key={term.key} onClick={() => setContractChecks(prev => ({ ...prev, [term.key]: !prev[term.key] }))} style={{ display:'flex', alignItems:'flex-start', gap:'10px', padding:'8px 0', borderBottom:`1px solid ${C.border}`, cursor:'pointer', fontSize:'0.75rem', color: contractChecks[term.key] ? C.text : C.textSecondary, lineHeight:1.4, transition:'color 0.15s' }}>
                                              <div style={{ width:18, height:18, borderRadius:4, border: contractChecks[term.key] ? `2px solid ${C.success}` : `2px solid ${C.border}`, background: contractChecks[term.key] ? C.success : 'transparent', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, marginTop:1, transition:'all 0.15s' }}>
                                                {contractChecks[term.key] && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--c-surface-lowest)" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                                              </div>
                                              <span style={{ textDecoration: contractChecks[term.key] ? 'line-through' : 'none', opacity: contractChecks[term.key] ? 0.7 : 1 }}>{term.label}</span>
                                            </div>
                                          ))}
                                          <div style={{ marginTop:'10px' }}>
                                            <div style={{ fontSize:'0.75rem', color:C.textMuted, marginBottom:'4px' }}>Signature jurisdiction</div>
                                            <select value={signatureJurisdiction} onChange={e => setSignatureJurisdiction(e.target.value)} style={{ width:'100%', background:C.card, border:`1px solid ${C.border}`, borderRadius:'6px', padding:'7px 8px', fontSize:'0.75rem', color:C.text, boxSizing:'border-box', marginBottom:'8px', cursor:'pointer' }}>
                                              {[
                                                { code:'US', label:'United States (E-SIGN Act)' },
                                                { code:'EU', label:'European Union (eIDAS)' },
                                                { code:'UK', label:'United Kingdom (ECA 2000)' },
                                                { code:'IN', label:'India (IT Act 2000)' },
                                                { code:'CA', label:'Canada (PIPEDA)' },
                                                { code:'AU', label:'Australia (ETA 1999)' },
                                                { code:'BR', label:'Brazil (MP 2200-2)' },
                                                { code:'JP', label:'Japan (ESIGN Law)' },
                                                { code:'KR', label:'South Korea (DSEA)' },
                                                { code:'SG', label:'Singapore (ETA)' },
                                                { code:'AE', label:'UAE (Federal Law No. 1)' },
                                                { code:'OTHER', label:'Other jurisdiction' },
                                              ].map(j => <option key={j.code} value={j.code}>{j.label}</option>)}
                                            </select>
                                            <div style={{ fontSize:'0.75rem', color:C.textMuted, marginBottom:'4px' }}>Type your full name to sign</div>
                                            <input value={contractSignature} onChange={e => setContractSignature(e.target.value)} placeholder={profileName || 'Your Name'} style={{ width:'100%', background:C.card, border:`1px solid ${C.border}`, borderRadius:'6px', padding:'8px', fontSize:'12px', color:C.text, boxSizing:'border-box', fontStyle:'italic' }} />
                                          </div>
                                        </div>

                                        {(() => {
                                          const checkedCount = ['deliverables','payment','usage','exclusivity','revisions'].filter(k => contractChecks[k]).length;
                                          const allChecked = checkedCount === 5;
                                          const signed = contractSignature.trim().length >= 2;
                                          const canAccept = allChecked && signed;
                                          return (
                                        <>
                                        {!canAccept && (
                                          <div style={{ fontSize:'0.75rem', color:C.textMuted, marginBottom:'6px' }}>
                                            {!allChecked && <span>{checkedCount}/5 terms checked. </span>}
                                            {!signed && <span>Sign your name to continue.</span>}
                                          </div>
                                        )}
                                        <div style={{ background: 'rgba(200, 184, 154,0.06)', border: '1px solid rgba(200, 184, 154,0.2)', borderRadius: '8px', padding: '10px', marginBottom: '10px', fontSize: '0.75rem', color: C.textSecondary, lineHeight: 1.5 }}>
                                          ⚠️ Once you accept, terms are locked. Check all details carefully, no edits after signing.
                                        </div>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                          <button
                                            disabled={!canAccept}
                                            onClick={() => {
                                              updateDeal(activeDealKey!, { phase: 'accepted', offerAmount: agreedPrice });
                                              const existingIdx = sharedApplications.findIndex(a =>
                                                a.opportunityIndex === actualOppIndex && a.campaignId === (opp.campaignId || -1) && a.creatorName === profileName
                                              );
                                              if (existingIdx >= 0) {
                                                const updated = [...sharedApplications];
                                                updated[existingIdx] = { ...updated[existingIdx], status: 'accepted' as const };
                                                persistApplications(updated);
                                              } else {
                                                const newApp: SharedApplication = {
                                                  id: Date.now(), campaignId: opp.campaignId || -1,
                                                  campaignTitle: `Deal with ${opp.brand}`,
                                                  creatorProfession: selectedMarketplaceSkin || '',
                                                  creatorHandle: '@creator_demo', status: 'accepted',
                                                  appliedAt: new Date().toLocaleDateString(),
                                                  creatorName: matchingCreator?.name || profileName || 'Demo Creator',
                                                  creatorFollowers: `${(metrics.followers / 1000).toFixed(metrics.followers >= 1000000 ? 1 : 0)}${metrics.followers >= 1000000 ? 'M' : 'K'}`,
                                                  creatorEngagement: `${metrics.engagement.toFixed(1)}%`,
                                                  creatorLevel: getLevel(metrics.dealsCompleted),
                                                  creatorMatchScore: '94%', creatorRate: rateCard.reel ? `₹${rateCard.reel}` : '₹3,000',
                                                  creatorDealCompletionRate: 95, creatorPortfolio: [],
                                                  creatorAudienceLocation: selectedCountry || 'USA', creatorAudienceAge: '25-34',
                                                  creatorResponseTimeHrs: 6, creatorWebsiteUrl: `https://portfolio.valueskins.com/creator_demo`,
                                                  opportunityIndex: actualOppIndex,
                                                };
                                                persistApplications([...sharedApplications, newApp]);
                                              }
                                            }}
                                            style={{ flex: 2, background: canAccept ? C.success : C.border, border: 'none', padding: '11px', borderRadius: '10px', color: 'var(--c-surface-lowest)', fontWeight: 700, cursor: canAccept ? 'pointer' : 'not-allowed', fontSize: '13px', opacity: canAccept ? 1 : 0.5 }}
                                          >Sign &amp; Accept Deal</button>
                                          <button
                                            onClick={() => {
                                              if (activeDealKey) {
                                                setDealStates(prev => { const next = {...prev}; delete next[activeDealKey]; return next; });
                                              }
                                              setNegotiatingOpp(null);
                                              setPurchaseToast('Deal rejected');
                                              setTimeout(() => setPurchaseToast(null), 3000);
                                            }}
                                            style={{ flex: 1, background: 'transparent', border: `1px solid rgba(176, 65, 62,0.3)`, padding: '11px', borderRadius: '10px', color: 'rgba(176, 65, 62,0.85)', fontWeight: 600, cursor: 'pointer', fontSize: '13px' }}
                                          >Reject</button>
                                        </div>
                                        </>
                                          );
                                        })()}
                                      </>
                                    );
                                  })()}

                                  {dealRoomPhase === 'accepted' && marketplaceRole === 'creator' && brandApprovalPhase !== 'accepted' && (() => {
                                    // Render based on deal type
                                    if (dealType === 'barter') {
                                      // BARTER DEAL — product incoming, no money
                                      return (
                                        <>
                                          {activeDeal?.isInternationalDeal && (
                                            <div style={{ background: C.warningBg, border: `1px solid ${C.warningBorder}`, borderRadius: '8px', padding: '10px', marginBottom: '10px' }}>
                                              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: C.warning, marginBottom: '4px' }}>Cross-border deal</div>
                                              <div style={{ fontSize: '0.75rem', color: C.textSecondary, lineHeight: 1.5 }}>
                                                This is a cross-border deal. Ensure compliance with your local tax authority. ValueSkins does not provide legal advice.
                                              </div>
                                            </div>
                                          )}
                                          <div style={{ padding: '12px', background: 'rgba(76,175,80,0.08)', borderRadius: '10px', marginBottom: '10px', border: '1px solid rgba(76,175,80,0.2)' }}>
                                            <div style={{ fontSize: '13px', fontWeight: 700, color: C.success, marginBottom: '4px' }}>Deal confirmed, product incoming</div>
                                            <div style={{ fontSize: '0.75rem', color: C.textSecondary, marginBottom: '8px' }}>Terms are locked and recorded. Chat remains open for coordination.</div>
                                            <div style={{ fontSize: '12px', fontWeight: 700, color: C.text, marginBottom: '6px' }}>{opp.brand} will send product</div>
                                            {opp.deadline && (
                                              <div style={{ fontSize: '0.75rem', color: C.textSecondary, marginBottom: '3px' }}>Deliver by: <strong>{new Date(opp.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</strong></div>
                                            )}
                                            <div style={{ fontSize: '0.75rem', color: C.textSecondary }}>Exclusivity: <strong>{opp.exclusivity || 'None'}</strong></div>
                                          </div>
                                          {/* POC Card */}
                                          {activeDeal?.poc && (
                                            <div style={{ background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: '8px', padding: '10px', marginBottom: '10px' }}>
                                              <div style={{ fontSize: '9px', fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>Point of Contact</div>
                                              <div
                                                onMouseEnter={(e) => showHoverCard(buildBrandHover(opp?.brand || profileName), e)}
                                                onMouseMove={updateHoverPosition}
                                                onMouseLeave={hideHoverCard}
                                                style={{ fontSize: '12px', fontWeight: 600, color: C.text, cursor: 'pointer' }}>{activeDeal.poc.name}</div>
                                              <div style={{ fontSize: '0.75rem', color: C.primary, marginTop: '2px' }}>{activeDeal.poc.workEmail}</div>
                                              <div style={{ fontSize: '0.75rem', color: C.textSecondary, marginTop: '2px' }}>{activeDeal.poc.role}</div>
                                            </div>
                                          )}
                                          <div style={{ display: 'flex', gap: '8px' }}>
                                            <button onClick={() => { setDealRoomPhase('softhold'); setGoodsTrackerStatus('goods_preparing'); }} style={{ flex: 2, background: C.primary, border: 'none', padding: '10px', borderRadius: '8px', color: C.onPrimary, fontWeight: 600, cursor: 'pointer', fontSize: '13px' }}>
                                              Begin Work
                                            </button>
                                            <button onClick={() => setShowCancelDealModal(true)} style={{ flex: 1, background: 'none', border: `1px solid rgba(176, 65, 62,0.3)`, padding: '10px', borderRadius: '8px', color: 'var(--c-error)', fontSize: '12px', cursor: 'pointer', fontWeight: 500 }}>
                                              Cancel
                                            </button>
                                          </div>
                                        </>
                                      );
                                    } else if (dealType === 'c2c_collab') {
                                      // C2C COLLAB — no money, just content
                                      return (
                                        <>
                                          <div style={{ padding: '12px', background: 'rgba(200, 184, 154,0.08)', borderRadius: '10px', marginBottom: '10px', border: '1px solid rgba(200, 184, 154,0.2)' }}>
                                            <div style={{ fontSize: '13px', fontWeight: 700, color: C.accent, marginBottom: '4px' }}>Collaboration confirmed</div>
                                            <div style={{ fontSize: '0.75rem', color: C.textSecondary, marginBottom: '8px' }}>You're ready to create content together. Terms are locked and recorded.</div>
                                            <div style={{ fontSize: '12px', fontWeight: 700, color: C.text, marginBottom: '6px' }}>Collaborating with {opp.brand}</div>
                                            {opp.deadline && (
                                              <div style={{ fontSize: '0.75rem', color: C.textSecondary }}>Deliver by: <strong>{new Date(opp.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</strong></div>
                                            )}
                                          </div>
                                          {/* Script section — simplified binary choice */}
                                          <div style={{ background: C.bg, borderRadius: '8px', border: `1px solid ${C.border}`, padding: '12px' }}>
                                            {scriptMode === 'brand_provides' ? (
                                              <>
                                                <div style={{ fontSize:'13px', fontWeight:700, color:C.text, marginBottom:'10px' }}>Brand Script</div>
                                                <div style={{ fontSize:'0.75rem', color:C.text, background:C.surfaceAlt, border:`1px solid ${C.border}`, borderRadius:'6px', padding:'10px', marginBottom:'12px', whiteSpace:'pre-wrap', lineHeight:1.5, maxHeight:'150px', overflowY:'auto' }}>
                                                  {scriptDraft || 'No script provided'}
                                                </div>
                                                {!scriptAccepted ? (
                                                  <div style={{ display:'flex', gap:'8px' }}>
                                                    <button
                                                      onClick={() => {
                                                        if (activeDealKey) updateDeal(activeDealKey, { scriptAccepted: true });
                                                        setPurchaseToast('Script accepted');
                                                        setTimeout(() => setPurchaseToast(null), 2000);
                                                      }}
                                                      style={{ flex:1, background:C.primary, border:'none', borderRadius:'6px', padding:'8px', fontSize:'0.75rem', fontWeight:700, color:'var(--c-surface-lowest)', cursor:'pointer' }}
                                                    >
                                                      ✓ Accept Script
                                                    </button>
                                                    <button
                                                      onClick={() => setPurchaseToast('Discuss alternatives in the chat room below')}
                                                      style={{ flex:1, background:'none', border:`1px solid ${C.border}`, borderRadius:'6px', padding:'8px', fontSize:'0.75rem', fontWeight:700, color:C.text, cursor:'pointer' }}
                                                    >
                                                      Discuss
                                                    </button>
                                                  </div>
                                                ) : (
                                                  <div style={{ padding:'8px', background:`${withAlpha(C.success, 0x12)}`, border:`1px solid ${withAlpha(C.success, 0x30)}`, borderRadius:'6px', color:C.success, fontSize:'0.75rem', fontWeight:700, textAlign:'center' }}>
                                                    ✓ Script Accepted
                                                  </div>
                                                )}
                                              </>
                                            ) : (
                                              <>
                                                <div style={{ fontSize:'13px', fontWeight:700, color:C.text, marginBottom:'6px' }}>Creative Freedom</div>
                                                <div style={{ fontSize:'0.75rem', color:C.textSecondary, marginBottom:'10px' }}>You have full creative freedom. Discuss ideas and direction in the chat room below.</div>
                                              </>
                                            )}
                                          </div>
                                          {/* Checklist */}
                                          <div style={{ background: C.bg, borderRadius: '8px', border: `1px solid ${C.border}`, padding: '8px' }}>
                                            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>Checklist</div>
                                            {[
                                              'Deliverables',
                                              'Timeline',
                                              'Payment terms',
                                              'Contract',
                                            ].map((item, i) => (
                                              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '3px 0', fontSize: '0.75rem', color: C.text }}>
                                                <div style={{ width: 12, height: 12, borderRadius: 3, background: C.success, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                  <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="var(--c-surface-lowest)" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                                                </div>
                                                {item}
                                              </div>
                                            ))}
                                          </div>
                                          {/* POC Card */}
                                          {activeDeal?.poc && (
                                            <div style={{ background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: '8px', padding: '10px', marginBottom: '10px' }}>
                                              <div style={{ fontSize: '9px', fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>Point of Contact</div>
                                              <div
                                                onMouseEnter={(e) => showHoverCard(buildBrandHover(opp?.brand || profileName), e)}
                                                onMouseMove={updateHoverPosition}
                                                onMouseLeave={hideHoverCard}
                                                style={{ fontSize: '12px', fontWeight: 600, color: C.text, cursor: 'pointer' }}>{activeDeal.poc.name}</div>
                                              <div style={{ fontSize: '0.75rem', color: C.primary, marginTop: '2px' }}>{activeDeal.poc.workEmail}</div>
                                              <div style={{ fontSize: '0.75rem', color: C.textSecondary, marginTop: '2px' }}>{activeDeal.poc.role}</div>
                                            </div>
                                          )}
                                          <div style={{ display: 'flex', gap: '8px' }}>
                                            <button disabled={scriptMode === 'brand_provides' && !scriptAccepted} onClick={() => { if(scriptMode === 'creator_freedom' || scriptAccepted) { setDealRoomPhase('softhold'); setC2cContentStatus('content_creating'); } else setPurchaseToast('Please accept the script first'); }} style={{ flex: 2, background: (scriptMode === 'creator_freedom' || scriptAccepted) ? C.primary : C.border, border: 'none', padding: '10px', borderRadius: '8px', color: 'var(--c-surface-lowest)', fontWeight: 600, cursor: (scriptMode === 'creator_freedom' || scriptAccepted) ? 'pointer' : 'not-allowed', fontSize: '13px', opacity: (scriptMode === 'creator_freedom' || scriptAccepted) ? 1 : 0.5 }}>
                                              Begin Work
                                            </button>
                                            <button onClick={() => setShowCancelDealModal(true)} style={{ flex: 1, background: 'none', border: `1px solid rgba(176, 65, 62,0.3)`, padding: '10px', borderRadius: '8px', color: 'var(--c-error)', fontSize: '12px', cursor: 'pointer', fontWeight: 500 }}>
                                              Cancel
                                            </button>
                                          </div>
                                        </>
                                      );
                                    } else {
                                      // PAID & C2C_PAID — escrow payment breakdown
                                      const agreedPrice = dealCounterAmount || dealOfferAmount || opp.budget.replace(/[^0-9]/g, '') || '5000';
                                      const totalPrice = parseInt(agreedPrice) || 5000;
                                      const advPct = advancePercent;
                                      const approvalPct = approvalPercent;
                                      const refId = `DR-${activeDealKey ? Math.abs(activeDealKey.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 9000 + 1000) : '0000'}-${opp.brand.replace(/\s/g, '').slice(0, 3).toUpperCase()}`;
                                      const signedAt = new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
                                      return (
                                        <>
                                          {activeDeal?.isInternationalDeal && (
                                            <div style={{ background: C.warningBg, border: `1px solid ${C.warningBorder}`, borderRadius: '8px', padding: '10px', marginBottom: '10px' }}>
                                              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: C.warning, marginBottom: '4px' }}>Cross-border deal</div>
                                              <div style={{ fontSize: '0.75rem', color: C.textSecondary, lineHeight: 1.5 }}>
                                                This is a cross-border deal. Ensure compliance with your local tax authority. ValueSkins does not provide legal advice.
                                              </div>
                                            </div>
                                          )}
                                          {/* v1 payment breakdown. Replaces the escrow block, which
                                              showed a configurable advance/approval split funded into
                                              escrow. The split is now fixed by the spec — a flat 885
                                              commission, then 30% and 70% of what is left — and paid
                                              directly to the creator, so there is nothing to configure
                                              and no pool to hold. Figures come from the same helper the
                                              server uses, verified equal at every budget. */}
                                          <div style={{ padding: '12px', background: withAlpha(C.primary, 0x14), borderRadius: '10px', marginBottom: '10px', border: `1px solid ${C.border}` }}>
                                            <div style={{ fontSize: '13px', fontWeight: 700, color: C.text, marginBottom: '4px' }}>Deal confirmed</div>
                                            <div style={{ fontSize: '0.75rem', color: C.textSecondary, marginBottom: '8px' }}>Terms are locked and recorded. The amount is final.</div>
                                            <div style={{ fontSize: '12px', fontWeight: 700, color: C.text, marginBottom: '6px' }}>₹{totalPrice.toLocaleString()} budget</div>
                                            {(() => {
                                              const F = workflowFinancials(totalPrice);
                                              return [
                                                { label: 'ValueSkins commission', amount: F.commissionTotal, note: 'incl. 18% GST' },
                                                { label: 'You receive', amount: F.creatorTotal, note: '' },
                                                { label: 'Advance (30%)', amount: F.advance, note: 'on confirmation' },
                                                { label: 'Final (70%)', amount: F.final, note: 'on approval' },
                                              ].map(r => (
                                                <div key={r.label} style={{ fontSize: '0.75rem', color: C.textSecondary, display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                                                  <span>{r.label}{r.note ? ` · ${r.note}` : ''}</span>
                                                  <span style={{ color: C.text, fontWeight: 600 }}>₹{r.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                                </div>
                                              ));
                                            })()}
                                            <div style={{ marginTop: '8px', fontSize: '9px', color: C.primary, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke={C.primary} strokeWidth="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                                              <span style={{ fontFamily: 'monospace' }}>{refId}</span> · {signedAt}
                                            </div>
                                          </div>

                                          {/* Script section — simplified binary choice */}
                                          <div style={{ background: C.bg, borderRadius: '8px', border: `1px solid ${C.border}`, padding: '12px' }}>
                                            {scriptMode === 'brand_provides' ? (
                                              <>
                                                <div style={{ fontSize:'13px', fontWeight:700, color:C.text, marginBottom:'10px' }}>Brand Script</div>
                                                <div style={{ fontSize:'0.75rem', color:C.text, background:C.surfaceAlt, border:`1px solid ${C.border}`, borderRadius:'6px', padding:'10px', marginBottom:'12px', whiteSpace:'pre-wrap', lineHeight:1.5, maxHeight:'150px', overflowY:'auto' }}>
                                                  {scriptDraft || 'No script provided'}
                                                </div>
                                                {!scriptAccepted ? (
                                                  <div style={{ display:'flex', gap:'8px' }}>
                                                    <button
                                                      onClick={() => {
                                                        if (activeDealKey) updateDeal(activeDealKey, { scriptAccepted: true });
                                                        setPurchaseToast('Script accepted');
                                                        setTimeout(() => setPurchaseToast(null), 2000);
                                                      }}
                                                      style={{ flex:1, background:C.primary, border:'none', borderRadius:'6px', padding:'8px', fontSize:'0.75rem', fontWeight:700, color:'var(--c-surface-lowest)', cursor:'pointer' }}
                                                    >
                                                      ✓ Accept Script
                                                    </button>
                                                    <button
                                                      onClick={() => setPurchaseToast('Discuss alternatives in the chat room below')}
                                                      style={{ flex:1, background:'none', border:`1px solid ${C.border}`, borderRadius:'6px', padding:'8px', fontSize:'0.75rem', fontWeight:700, color:C.text, cursor:'pointer' }}
                                                    >
                                                      Discuss
                                                    </button>
                                                  </div>
                                                ) : (
                                                  <div style={{ padding:'8px', background:`${withAlpha(C.success, 0x12)}`, border:`1px solid ${withAlpha(C.success, 0x30)}`, borderRadius:'6px', color:C.success, fontSize:'0.75rem', fontWeight:700, textAlign:'center' }}>
                                                    ✓ Script Accepted
                                                  </div>
                                                )}
                                              </>
                                            ) : (
                                              <>
                                                <div style={{ fontSize:'13px', fontWeight:700, color:C.text, marginBottom:'6px' }}>Creative Freedom</div>
                                                <div style={{ fontSize:'0.75rem', color:C.textSecondary, marginBottom:'10px' }}>You have full creative freedom. Discuss ideas and direction in the chat room below.</div>
                                              </>
                                            )}
                                          </div>
                                          {/* Checklist */}
                                          <div style={{ background: C.bg, borderRadius: '8px', border: `1px solid ${C.border}`, padding: '8px' }}>
                                            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>Checklist</div>
                                            {[
                                              'Deliverables',
                                              'Timeline',
                                              'Payment terms',
                                              'Contract',
                                            ].map((item, i) => (
                                              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '3px 0', fontSize: '0.75rem', color: C.text }}>
                                                <div style={{ width: 12, height: 12, borderRadius: 3, background: C.success, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                  <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="var(--c-surface-lowest)" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                                                </div>
                                                {item}
                                              </div>
                                            ))}
                                          </div>
                                          {/* Deadline & Rights summary */}
                                          <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: '8px', padding: '10px', marginBottom: '10px' }}>
                                            {opp.deadline && (
                                              <div style={{ fontSize: '0.75rem', color: C.text, marginBottom: '3px' }}>Deliver by: <strong>{new Date(opp.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</strong></div>
                                            )}
                                            <div style={{ fontSize: '0.75rem', color: C.text, marginBottom: '3px' }}>Usage rights: <strong>{opp.usageRights || `${opp.revisionLimit * 30} days`}</strong></div>
                                            <div style={{ fontSize: '0.75rem', color: C.text, marginBottom: '3px' }}>Exclusivity: <strong>{opp.exclusivity || 'None'}</strong></div>
                                            {opp.contentReview && (
                                              <div style={{ marginTop:'4px', fontSize:'0.75rem', padding:'4px 6px', borderRadius:'4px', background:opp.contentReview==='review_required'?`${withAlpha(C.warning, 0x15)}`:C.success+'20', color:opp.contentReview==='review_required'?C.warning:C.success, fontWeight:600 }}>
                                                {opp.contentReview==='review_required' ? '📋 Content review required before publish' : '✅ Direct upload, no review needed'}
                                              </div>
                                            )}
                                          </div>
                                          {/* POC Card */}
                                          {activeDeal?.poc && (
                                            <div style={{ background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: '8px', padding: '10px', marginBottom: '10px' }}>
                                              <div style={{ fontSize: '9px', fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>Point of Contact</div>
                                              <div
                                                onMouseEnter={(e) => showHoverCard(buildBrandHover(opp?.brand || profileName), e)}
                                                onMouseMove={updateHoverPosition}
                                                onMouseLeave={hideHoverCard}
                                                style={{ fontSize: '12px', fontWeight: 600, color: C.text, cursor: 'pointer' }}>{activeDeal.poc.name}</div>
                                              <div style={{ fontSize: '0.75rem', color: C.primary, marginTop: '2px' }}>{activeDeal.poc.workEmail}</div>
                                              <div style={{ fontSize: '0.75rem', color: C.textSecondary, marginTop: '2px' }}>{activeDeal.poc.role}</div>
                                            </div>
                                          )}
                                          <div style={{ display: 'flex', gap: '8px' }}>
                                            <button onClick={() => { setDealRoomPhase('softhold'); setEscrowFunded(false); setEscrowFundingInProgress(false); setCreatorDealLifecycle('checklist'); }} style={{ flex: 2, background: C.primary, border: 'none', padding: '10px', borderRadius: '8px', color: C.onPrimary, fontWeight: 600, cursor: 'pointer', fontSize: '13px' }}>
                                              Begin Work
                                            </button>
                                            <button onClick={() => setShowCancelDealModal(true)} style={{ flex: 1, background: 'none', border: `1px solid rgba(176, 65, 62,0.3)`, padding: '10px', borderRadius: '8px', color: 'var(--c-error)', fontSize: '12px', cursor: 'pointer', fontWeight: 500 }}>
                                              Cancel
                                            </button>
                                          </div>
                                        </>
                                      );
                                    }
                                  })()}

                                  {(dealRoomPhase === 'chatroom' || dealRoomPhase === 'accepted' || dealRoomPhase === 'pending' || dealRoomPhase === 'counter' || dealRoomPhase === 'last_offer' || dealRoomPhase === 'softhold' || dealRoomPhase === 'checklist') && (
                                    <>
                                      {/* Chat + Sidebar layout */}
                                      <div style={{ display: 'flex', gap: '8px', minHeight: '340px' }}>
                                        {/* ── [v1 COMMENTED OUT] Deal Room Chat box — see Things-Commented-Out.md.
                                            Kept in code (hidden via {false && …}) so it can be restored later. */}
                                        {false && (
                                        /* Chat area */
                                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.bg, borderRadius: '8px', border: `1px solid ${C.border}`, overflow: 'hidden' }}>
                                          <div style={{ padding: '8px 10px', borderBottom: `1px solid ${C.border}`, fontSize: '0.75rem', fontWeight: 700, color: C.primary, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                              <div style={{ width: 6, height: 6, borderRadius: '50%', background: C.success, animation: 'pulse 2s ease-in-out infinite' }} />
                                              Deal Room Chat
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'rgba(211,47,47,0.08)', border: '1px solid rgba(211,47,47,0.2)', borderRadius: '5px', padding: '2px 6px' }}>
                                              <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--c-error)', animation: 'pulse 1.4s ease-in-out infinite' }} />
                                              <span style={{ fontSize: '9px', color: 'var(--c-error)', fontWeight: 700, letterSpacing: '0.4px' }}>AUDIT LOG</span>
                                              <span style={{ fontSize: '9px', color: C.textMuted, fontWeight: 400 }}>{chatMessages.length} documented</span>
                                            </div>
                                          </div>
                                          {/* Messages */}
                                          <div style={{ flex: 1, overflowY: 'auto', padding: '8px', display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '220px' }}>
                                            {chatMessages.map((msg, mi) => {
                                              const isMe = msg.sender === 'me' || msg.sender === marketplaceRole;
                                              return (
                                              <div key={msg.id} style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start' }}>
                                                <div style={{
                                                  maxWidth: '80%',
                                                  padding: '6px 10px',
                                                  borderRadius: isMe ? '10px 10px 2px 10px' : '10px 10px 10px 2px',
                                                  background: isMe ? C.primary : C.surfaceAlt,
                                                  color: isMe ? 'var(--c-surface-lowest)' : C.text,
                                                  fontSize: '12px',
                                                  lineHeight: 1.4,
                                                }}>
                                                  {msg.text}
                                                  <div style={{ fontSize: '9px', color: msg.sender === 'me' ? 'rgba(255,255,255,0.5)' : C.textMuted, marginTop: '3px', textAlign: 'right' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 3 }}>
                                                      <span>{msg.time}</span>
                                                      {msg.sender === 'me' && (
                                                        <span style={{ display: 'inline-flex', gap: 1 }}>
                                                          {msg.seen ? (
                                                            <svg width="16" height="10" viewBox="0 0 16 10" fill="none" stroke="#4fc3f7" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="1,5 4,8 8,2"/><polyline points="6,5 9,8 13,2"/></svg>
                                                          ) : (
                                                            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="1,5 3.5,8 9,2"/></svg>
                                                          )}
                                                        </span>
                                                      )}
                                                    </div>
                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '3px', marginTop: '1px', opacity: 0.7 }}>
                                                      <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                                                      <span>Logged · {msg.isoTime ? new Date(msg.isoTime).toISOString().replace('T', ' ').slice(0, 19) + ' UTC' : '-'}</span>
                                                    </div>
                                                    {msg.seen && msg.seenAt && (
                                                      <div style={{ marginTop: '1px', opacity: 0.7 }}>
                                                        Seen · {new Date(msg.seenAt).toISOString().replace('T', ' ').slice(0, 19) + ' UTC'}
                                                      </div>
                                                    )}
                                                  </div>
                                                </div>
                                              </div>
                                            );
                                            })}
                                            <div ref={chatEndRef} />
                                          </div>
                                          {/* Input — always active for post-deal communication */}
                                          <form onSubmit={(e) => {
                                            e.preventDefault();
                                            if (!chatInput.trim()) return;
                                            const now = new Date();
                                            const timeStr = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: false });
                                            const isoNow = now.toISOString();
                                            const msgSender: 'brand' | 'creator' = (marketplaceRole as 'brand' | 'creator') === 'brand' ? 'brand' : 'creator';
                                            const newMsg = { id: Date.now(), sender: msgSender, text: chatInput.trim(), time: timeStr, isoTime: isoNow, seen: false };
                                            setChatMessages(prev => [...prev, newMsg]);
                                            sharedAddMessage(activeDealKey ?? '', newMsg);
                                            setChatInput('');
                                          }} style={{ display: 'flex', gap: '4px', padding: '6px', borderTop: `1px solid ${C.border}` }}>
                                            <input
                                              type="text"
                                              value={chatInput}
                                              onChange={(e) => setChatInput(e.target.value)}
                                              placeholder="Type a message..."
                                              style={{ flex: 1, padding: '6px 10px', background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: '14px', color: C.text, fontSize: '12px', outline: 'none' }}
                                            />
                                            <button type="submit" disabled={!chatInput.trim()} style={{ padding: '6px 12px', background: chatInput.trim() ? C.primary : `${withAlpha(C.primary, 0x40)}`, color: 'var(--c-surface-lowest)', border: 'none', borderRadius: '14px', fontSize: '0.75rem', fontWeight: 600, cursor: chatInput.trim() ? 'pointer' : 'not-allowed' }}>Send</button>
                                          </form>
                                        </div>
                                        )}

                                        {/* Sidebar: checklist + payment (now full-width, chat column hidden above) */}
                                        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                          {/* Campaign brief */}
                                          <div style={{ background: C.bg, borderRadius: '8px', border: `1px solid ${C.border}`, padding: '8px' }}>
                                            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>Campaign Brief</div>
                                            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: C.text, marginBottom: '3px', lineHeight: 1.3 }}>{opp.type || opp.brand}</div>
                                            <div style={{ fontSize: '0.75rem', color: C.textSecondary, marginBottom: '5px', lineHeight: 1.4 }}>{opp.about ? opp.about.slice(0, 80) + (opp.about.length > 80 ? '…' : '') : ''}</div>
                                            {opp.deliverables?.length > 0 && (
                                              <div style={{ fontSize: '0.75rem', color: C.textMuted, marginBottom: '3px' }}>
                                                {opp.deliverables.map((d: {count:number;format:string}) => `${d.count}x ${d.format}`).join(', ')}
                                              </div>
                                            )}
                                            <div style={{ display:'flex', justifyContent:'space-between', marginTop:'4px' }}>
                                              <span style={{ fontSize:'0.75rem', color:C.success, fontWeight:700 }}>{opp.budget}</span>
                                              {opp.deadline && <span style={{ fontSize:'9px', color:C.textMuted }}>{new Date(opp.deadline).toLocaleDateString('en-US',{month:'short',day:'numeric'})}</span>}
                                            </div>
                                            {opp.contentReview && (
                                              <div style={{ marginTop:'4px', fontSize:'9px', padding:'3px 5px', borderRadius:'4px', background:opp.contentReview==='review_required'?`${withAlpha(C.warning, 0x15)}`:C.success+'20', color:opp.contentReview==='review_required'?C.warning:C.success, fontWeight:600 }}>
                                                {opp.contentReview==='review_required' ? '📋 Review required before publish' : '✅ Direct upload, no review'}
                                              </div>
                                            )}
                                            {opp.shootLocation && (
                                              <div style={{ marginTop:'5px', fontSize:'0.75rem', color:C.textSecondary, lineHeight:1.4 }}>📍 Shoot: <strong style={{ color:C.text, fontWeight:600 }}>{opp.shootLocation}</strong></div>
                                            )}
                                            {(opp.expectations || opp.otherNotes) && (
                                              <div style={{ marginTop:'4px', fontSize:'0.75rem', color:C.textSecondary, lineHeight:1.4 }}>
                                                {(opp.expectations || opp.otherNotes).slice(0, 90)}{(opp.expectations || opp.otherNotes).length > 90 ? '…' : ''}
                                              </div>
                                            )}
                                            {(opp.scriptFileName || opp.scriptText) && (
                                              <div style={{ marginTop:'4px', fontSize:'0.75rem', color:C.textSecondary, lineHeight:1.4 }}>
                                                <span style={{ color:C.text, fontWeight:600 }}>Script: </span>
                                                {opp.scriptFileName ? `📎 ${opp.scriptFileName}` : 'Brand script'}
                                                {opp.scriptMode === 'non_negotiable' ? ' (locked)' : ''}
                                                {opp.scriptMode === 'discussion' ? ' (collaborative)' : ''}
                                              </div>
                                            )}
                                          </div>
                                          {/* Checklist */}
                                          <div style={{ background: C.bg, borderRadius: '8px', border: `1px solid ${C.border}`, padding: '8px' }}>
                                            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>Checklist</div>
                                            {[
                                              'Deliverables',
                                              'Timeline',
                                              'Payment terms',
                                              'Contract',
                                            ].map((item, i) => (
                                              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '3px 0', fontSize: '0.75rem', color: C.text }}>
                                                <div style={{ width: 12, height: 12, borderRadius: 3, background: C.success, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                  <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="var(--c-surface-lowest)" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                                                </div>
                                                {item}
                                              </div>
                                            ))}
                                          </div>

                                          {/* Phase-specific extensions */}
                                          {dealRoomPhase === 'accepted' && activeDeal && (
                                            <>
                                              <ContractView dealId={activeDealKey || ''} />
                                              <TimelineView
                                                dealId={activeDealKey || ''}
                                                timeline={[
                                                  { date: new Date(Date.now() + 7*24*60*60*1000).toISOString(), event: 'Shoot day', type: 'milestone', completed: false, reminder_sent: false, details: { time: '10:00 AM', location: 'Location TBD' } },
                                                  { date: new Date(Date.now() + 14*24*60*60*1000).toISOString(), event: 'Submit deliverables', type: 'deliverable', completed: false, reminder_sent: false },
                                                  { date: new Date(Date.now() + 21*24*60*60*1000).toISOString(), event: 'Brand approval deadline', type: 'approval', completed: false, reminder_sent: false },
                                                  { date: new Date(Date.now() + 28*24*60*60*1000).toISOString(), event: 'Post content (embargo date)', type: 'posting', completed: false, reminder_sent: false },
                                                  { date: new Date(Date.now() + 35*24*60*60*1000).toISOString(), event: 'Payment due', type: 'payment', completed: false, reminder_sent: false },
                                                ]}
                                              />
                                            </>
                                          )}

                                          {/* Brand approves deliverables — shown when creator has submitted */}
                                          {creatorDealLifecycle === 'submitted' && brandApprovalPhase === 'reviewing' && (
                                            <div style={{ background: C.card, border: `1px solid ${C.success}`, borderRadius: '10px', padding: '14px', marginBottom: '12px' }}>
                                              <div style={{ fontSize: '12px', fontWeight: 700, color: C.text, marginBottom: '8px' }}>Deliverables Ready for Review</div>
                                              <div style={{ fontSize: '0.75rem', color: C.textSecondary, marginBottom: '10px', lineHeight: 1.5 }}>
                                                The creator has submitted their deliverables. Review and approve to complete the deal and release the approval milestone.
                                              </div>
                                              {activeDeal?.deliverableLinks && Object.entries(activeDeal.deliverableLinks).map(([key, url]) => (
                                                <div key={key} style={{ fontSize: '0.75rem', marginBottom: '4px' }}>
                                                  <span style={{ color: C.textMuted }}>{key === '0' ? 'Google Drive' : 'Social Media'}: </span>
                                                  <a href={url as string} target="_blank" rel="noopener noreferrer" style={{ color: C.primary }}>{(url as string).slice(0, 40)}...</a>
                                                </div>
                                              ))}
                                              <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                                                <button onClick={() => {
                                                  const earnedAmount = parseInt(dealCounterAmount || dealOfferAmount || '5000');
                                                  const brandName = opp?.brand || profileName;
                                                  const updatedMetrics = {
                                                    ...metrics,
                                                    dealsCompleted: metrics.dealsCompleted + 1,
                                                    avgDealValue: Math.round((metrics.avgDealValue * metrics.dealsCompleted + earnedAmount * 100) / (metrics.dealsCompleted + 1)),
                                                  };
                                                  setMetrics(updatedMetrics);
                                                  setCompletedDeals(prev => [...prev, { id: Date.now(), brand: brandName, amount: earnedAmount, completedAt: new Date().toLocaleDateString(), deliverable: 'content', usageRightsDays: undefined, exclusivityDays: undefined, exclusivitySkin: undefined }]);
                                                  const prevLevel = getLevel(metrics.dealsCompleted);
                                                  const newLevel = getLevel(updatedMetrics.dealsCompleted);
                                                  if (newLevel > prevLevel && marketplaceRole === 'creator') {
                                                    setLevelUpFrom(prevLevel);
                                                    setLevelUpTo(newLevel);
                                                    setShowLevelUpModal(true);
                                                  }
                                                  setCreatorDealLifecycle('approved');
                                                  setBrandApprovalPhase('approved');
                                                  setPaymentMilestones(prev => ({ ...prev, approval: 'released' }));
                                                  if (activeDealKey) {
                                                    updateDeal(activeDealKey, {
                                                      creatorDealLifecycle: 'approved',
                                                      brandApprovalPhase: 'approved',
                                                      paymentMilestones: { advance: 'released', approval: 'released' },
                                                    });
                                                  }
                                                  if (marketplaceRole !== 'creator') {
                                                    setPurchaseToast(`Deal completed, earnings released to ${brandName}`);
                                                    setTimeout(() => setPurchaseToast(null), 3000);
                                                  }
                                                }} style={{ flex: 1, background: C.success, border: 'none', padding: '10px', borderRadius: '8px', color: 'var(--c-surface-lowest)', fontWeight: 700, cursor: 'pointer', fontSize: '12px' }}>
                                                  Approve & Complete Deal
                                                </button>
                                              </div>
                                            </div>
                                          )}

                                          {/* DeliverablesView removed — main deliverables section is shown in content area */}

                                          {dealRoomPhase === 'checklist' && activeDeal && (
                                            <InvoiceView
                                              dealId={activeDealKey || ''}
                                              invoice={{
                                                id: `inv_${activeDealKey}`,
                                                amount: parseInt((activeDeal.offerAmount || dealOfferAmount || '0').replace(/[^0-9]/g, '') || '0'),
                                                due_date: new Date(Date.now() + 7*24*60*60*1000).toISOString(),
                                                status: 'sent',
                                                days_overdue: 0,
                                              }}
                                            />
                                          )}

                                          {/* ── [v1 COMMENTED OUT] Negotiation UI — "Your Counter" input. Brand amount is final. See Things-Commented-Out.md. */}
                                          {false && dealRoomPhase !== 'accepted' && dealRoomPhase !== 'softhold' && dealRoomPhase !== 'checklist' && !activeDeal?.formalOfferSentByCreator && <div style={{ background: C.bg, borderRadius: '8px', border: `1px solid ${C.border}`, padding: '8px' }}>
                                            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>Your Counter</div>
                                            <div style={{ fontSize: '0.75rem', color: C.textSecondary, marginBottom: '4px' }}>
                                              Brand offer: <strong style={{ color: C.text }}>${parseInt(dealOfferAmount || opp.budget.replace(/[^0-9]/g, '') || '0').toLocaleString()}</strong>
                                            </div>

                                            <input
                                              type="number"
                                              value={dealCounterAmount}
                                              onChange={e => setDealCounterAmount(e.target.value)}
                                              placeholder="Your ask (₹)"
                                              style={{ width: '100%', background: C.card, border: `1px solid ${C.border}`, borderRadius: '6px', padding: '6px 8px', fontSize: '12px', color: C.text, boxSizing: 'border-box', marginBottom: '4px' }}
                                            />
                                            <button
                                              disabled={!dealCounterAmount || parseInt(dealCounterAmount) <= 0}
                                              onClick={() => {
                                                const brandOffer = parseInt(dealOfferAmount || opp.budget.replace(/[^0-9]/g, '') || '0');
                                                const creatorAsk = parseInt(dealCounterAmount);
                                                const now = new Date();
                                                const timeStr = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: false });
                                                const counterMsg = { id: Date.now(), sender: 'creator' as const, text: `Counter-offer: ₹${creatorAsk.toLocaleString()} (brand offered ₹${brandOffer.toLocaleString()})`, time: timeStr, isoTime: now.toISOString(), seen: false };
                                                setChatMessages(prev => [...prev, counterMsg]);
                                                sharedAddMessage(activeDealKey ?? '', counterMsg);
                                                // Write counter amount + phase + chat messages to shared deal state
                                                // so brand sees the update in real-time under Sent Deals
                                                if (activeDealKey) {
                                                  updateDeal(activeDealKey, {
                                                    phase: 'counter' as DealRoomPhase,
                                                    counterAmount: String(creatorAsk),
                                                  });
                                                }
                                                sharedSendNotification(opp?.brand || 'Brand', 'message', `Creator countered: ₹${creatorAsk.toLocaleString()} (you offered ₹${brandOffer.toLocaleString()})`);
                                                setPurchaseToast(`Counter sent: ₹${creatorAsk.toLocaleString()}`);
                                                setTimeout(() => setPurchaseToast(null), 2000);
                                              }}
                                              style={{ width: '100%', background: dealCounterAmount && parseInt(dealCounterAmount) > 0 ? C.primary : C.border, border: 'none', padding: '6px', borderRadius: '6px', color: 'var(--c-surface-lowest)', fontWeight: 600, fontSize: '0.75rem', cursor: dealCounterAmount && parseInt(dealCounterAmount) > 0 ? 'pointer' : 'not-allowed', opacity: dealCounterAmount && parseInt(dealCounterAmount) > 0 ? 1 : 0.5 }}
                                            >
                                              Send Counter
                                            </button>
                                          </div>}

                                          {!['deliverables','submitted','approved'].includes(creatorDealLifecycle) && dealRoomPhase !== 'accepted' && dealRoomPhase !== 'softhold' && dealRoomPhase !== 'checklist' && (
                                          <div style={{ background: C.bg, borderRadius: '8px', border: `1px solid ${C.border}`, padding: '8px' }}>
                                            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>Payment Plan</div>
                                            {[
                                              { label: 'Advance', value: advancePercent, color: C.success, key: 'advance' as const },
                                              { label: 'On approval', value: approvalPercent, color: C.warning, key: 'approval' as const },
                                            ].map(s => (
                                              <div key={s.key} style={{ marginBottom: '6px' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '2px' }}>
                                                  <span style={{ color: s.color, fontWeight: 600 }}>{s.label}</span>
                                                  <span style={{ color: C.text, fontWeight: 700 }}>{s.value}%</span>
                                                </div>
                                                <input type="range" min={0} max={100} step={5} value={s.value} onChange={e => {
                                                  const newVal = parseInt(e.target.value);
                                                  if (s.key === 'advance') {
                                                    setPaymentSplit(newVal, 100 - newVal);
                                                  } else {
                                                    setPaymentSplit(100 - newVal, newVal);
                                                  }
                                                }} style={{ width: '100%', height: '4px', accentColor: s.color }} />
                                              </div>
                                            ))}
                                          </div>
                                          )}

                                          {/* ── [v1 COMMENTED OUT] Negotiation UI — creator "Submit Formal Offer" (counters). Brand's deal is final. */}
                                          {false && !activeDeal?.formalOfferSentByCreator && (
                                          <div style={{ background: C.bg, borderRadius: '8px', border: `1px solid ${C.border}`, padding: '8px' }}>
                                            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>Finalize</div>
                                            <button
                                              onClick={() => {
                                                if (activeDealKey) {
                                                  updateDeal(activeDealKey, { phase: 'formal_offer' as DealRoomPhase, formalOfferSentByCreator: true });
                                                }
                                              }}
                                              style={{ width: '100%', background: C.primary, border: 'none', padding: '7px', borderRadius: '6px', color: C.onPrimary, fontWeight: 600, fontSize: '0.75rem', cursor: 'pointer', lineHeight: 1.3 }}
                                            >
                                              Submit Formal Offer
                                            </button>
                                          </div>
                                          )}

                                          {/* Reject brand */}
                                          <button
                                            onClick={() => {
                                              if (activeDealKey) {
                                                setDealStates(prev => { const next = {...prev}; delete next[activeDealKey]; return next; });
                                              }
                                              setNegotiatingOpp(null);
                                              setPurchaseToast('Deal declined, brand notified');
                                              setTimeout(() => setPurchaseToast(null), 3000);
                                            }}
                                            style={{ width: '100%', background: 'none', border: `1px solid rgba(176, 65, 62,0.3)`, padding: '7px', borderRadius: '6px', color: 'rgba(176, 65, 62,0.85)', fontWeight: 600, fontSize: '0.75rem', cursor: 'pointer', marginTop: '4px' }}
                                          >
                                            Reject Brand
                                          </button>
                                        </div>
                                      </div>
                                    </>
                                  )}

                                  {/* Creator sees brand's last offer — accept or walk away */}
                                  {dealRoomPhase === 'last_offer' && (
                                    <>
                                      <div style={{ background: 'rgba(230,81,0,0.06)', borderRadius: '8px', padding: '12px', marginBottom: '12px', border: `1px solid rgba(230,81,0,0.2)` }}>
                                        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: C.warning, marginBottom: '6px' }}>Final Offer from Brand</div>
                                        <div style={{ fontSize: '22px', fontWeight: 800, color: C.text, marginBottom: '4px' }}>${parseInt(dealOfferAmount || '0').toLocaleString()}<span style={{ fontSize: '12px', color: C.textMuted, fontWeight: 400 }}>/post</span></div>
                                        <div style={{ fontSize: '0.75rem', color: C.textSecondary, lineHeight: 1.4 }}>The brand has indicated this is their final offer. You can accept or decline.</div>
                                      </div>
                                      <div style={{ display: 'flex', gap: '8px' }}>
                                        <button
                                          onClick={() => {
                                            if (activeDealKey) {
                                              const now = new Date();
                                              const timeStr = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: false });
                                              const acceptMsg = { id: Date.now(), sender: 'creator' as const, text: `Creator accepted final offer: ₹${parseInt(dealOfferAmount || '0').toLocaleString()}/post`, time: timeStr, isoTime: now.toISOString(), seen: false };
                                              setChatMessages(prev => [...prev, acceptMsg]);
                                              sharedAddMessage(activeDealKey || '', acceptMsg);
                                              updateDeal(activeDealKey, { phase: 'accepted', offerAmount: dealOfferAmount });
                                            }
                                            setPurchaseToast('Deal accepted');
                                            setTimeout(() => setPurchaseToast(null), 2000);
                                          }}
                                          style={{ flex: 1, background: C.success, border: 'none', padding: '9px', borderRadius: '8px', color: 'var(--c-surface-lowest)', fontWeight: 600, cursor: 'pointer', fontSize: '12px' }}
                                        >
                                          Accept ${parseInt(dealOfferAmount || '0').toLocaleString()}
                                        </button>
                                        <button
                                          onClick={() => {
                                            if (activeDealKey) {
                                              const now = new Date();
                                              const timeStr = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: false });
                                              const declineMsg = { id: Date.now(), sender: 'creator' as const, text: 'Creator declined the final offer.', time: timeStr, isoTime: now.toISOString(), seen: false };
                                              setChatMessages(prev => [...prev, declineMsg]);
                                              sharedAddMessage(activeDealKey || '', declineMsg);
                                              updateDeal(activeDealKey, { phase: 'rejected' });
                                            }
                                            setNegotiatingOpp(null);
                                            setPurchaseToast('Deal declined');
                                            setTimeout(() => setPurchaseToast(null), 2000);
                                          }}
                                          style={{ flex: 1, background: 'none', border: `1px solid rgba(176, 65, 62,0.4)`, padding: '9px', borderRadius: '8px', color: 'rgba(176, 65, 62,0.85)', fontWeight: 600, cursor: 'pointer', fontSize: '12px' }}
                                        >
                                          Decline
                                        </button>
                                      </div>
                                    </>
                                  )}

                                  {/* Creator sees brand withdrawal */}
                                  {dealRoomPhase === 'rejected' && (
                                    <div style={{ textAlign: 'center', padding: '20px 0' }}>
                                      <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(176, 65, 62,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px' }}>
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(176, 65, 62,0.7)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                                      </div>
                                      <div style={{ fontSize: '14px', fontWeight: 700, color: C.text, marginBottom: '4px' }}>Deal Ended</div>
                                      <div style={{ fontSize: '12px', color: C.textSecondary, marginBottom: '16px' }}>The other party has withdrawn from this deal.</div>
                                      <button
                                        onClick={() => setNegotiatingOpp(null)}
                                        style={{ background: C.primary, border: 'none', padding: '8px 20px', borderRadius: '8px', color: C.onPrimary, fontWeight: 600, cursor: 'pointer', fontSize: '12px' }}
                                      >
                                        Back to Marketplace
                                      </button>
                                    </div>
                                  )}

                                  {dealRoomPhase === 'checklist' && (
                                    <>
                                      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '10px' }}>Expectation Checklist</div>
                                      {[
                                        { key: 'Content format (posts / reels / stories)', req: true },
                                        { key: 'Maximum revision rounds', req: true },
                                        { key: 'Usage rights & exclusivity', req: true },
                                        { key: 'Payment schedule confirmed', req: true },
                                        { key: 'Final deliverable deadline', req: true },
                                        { key: 'Approval process defined', req: false },
                                        { key: 'Metrics reporting agreed', req: false },
                                      ].map((item, ci) => (
                                        <div key={ci} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 0', borderBottom: `1px solid ${C.border}` }}>
                                          <div style={{ width: '16px', height: '16px', borderRadius: '4px', background: C.success, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--c-surface-lowest)" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                                          </div>
                                          <span style={{ fontSize: '12px', color: C.text, flex: 1 }}>{item.key}</span>
                                          {item.req && <span style={{ fontSize: '9px', color: C.primary, fontWeight: 700, textTransform: 'uppercase' }}>Required</span>}
                                        </div>
                                      ))}
                                      <button onClick={() => {
                                        setDealRoomPhase('softhold');
                                        setEscrowFunded(false);
                                        setEscrowFundingInProgress(false);
                                        if (activeDealKey) {
                                          updateDeal(activeDealKey, { phase: 'softhold' });
                                        }
                                      }} style={{ width: '100%', background: C.primary, border: 'none', padding: '10px', borderRadius: '8px', color: C.onPrimary, fontWeight: 600, cursor: 'pointer', fontSize: '13px', marginTop: '12px' }}>
                                        Confirm &amp; Finalise Deal
                                      </button>
                                    </>
                                  )}

                                  {/* Escrow funding gate — brand must fund before creator uploads */}
                                  {dealRoomPhase === 'softhold' && (() => {
                                    switch(dealType) {
                                      // PAID & C2C_PAID: Escrow workflow
                                      case 'paid':
                                      case 'c2c_paid': {
                                        const agreedPrice = parseInt(dealCounterAmount || dealOfferAmount || '5000') || 5000;
                                        const advPct = advancePercent;
                                        const approvalPct = approvalPercent;

                                        // Escrow gate — reads from shared deal state (brand funds escrow from their side)
                                        if (!paymentSecured && creatorDealLifecycle === 'checklist') {
                                          // Check if brand has funded escrow via shared deal state
                                          if (activeDeal?.paymentSecured) {
                                            // Brand funded — auto-advance creator to deliverables phase
                                            setTimeout(() => {
                                              setEscrowFunded(true);
                                              setCreatorDealLifecycle('deliverables');
                                              if (activeDealKey) {
                                                updateDeal(activeDealKey, { creatorDealLifecycle: 'deliverables' });
                                              }
                                            }, 0);
                                            const advanceAmt = Math.round(agreedPrice * 0.3);
                                            return (
                                              <div style={{ textAlign:'center', padding:'16px 0' }}>
                                                <div style={{ width:'44px', height:'44px', borderRadius:'50%', background:'rgba(200, 184, 154,0.1)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 12px' }}>
                                                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={C.success} strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                                                </div>
                                                <div style={{ fontSize:'14px', fontWeight:700, color:C.success, marginBottom:'4px' }}>Escrow Funded</div>
                                                <div style={{ fontSize:'12px', color:C.textSecondary, marginBottom:'8px' }}>Brand deposited ${agreedPrice.toLocaleString()} into escrow.</div>
                                                <div style={{ background:'rgba(46,125,50,0.06)', border:'1px solid rgba(46,125,50,0.2)', borderRadius:'8px', padding:'10px', marginBottom:'8px' }}>
                                                  <div style={{ fontSize:'13px', fontWeight:700, color:C.success }}>Advance paid: ${advanceAmt.toLocaleString()}</div>
                                                  <div style={{ fontSize:'0.75rem', color:C.textSecondary, marginTop:'2px' }}>30% advance deposited to your account. Begin deliverables to unlock remaining milestones.</div>
                                                </div>
                                              </div>
                                            );
                                          }
                                          return (
                                            <div style={{ padding:'8px 0 16px' }}>
                                              {/* Phase status bar — creator view */}
                                              <div style={{ display:'flex', alignItems:'center', gap:'4px', marginBottom:'16px', padding:'8px 10px', background:'rgba(200, 184, 154,0.06)', borderRadius:'8px', border:'1px solid rgba(200, 184, 154,0.2)' }}>
                                                {[
                                                  { label:'Offer', done: true },
                                                  { label:'Accepted', done: true },
                                                  { label:'Brand Funds', done: false, active: true },
                                                  { label:'Your Work', done: false },
                                                ].map((s, i) => (
                                                  <div key={i} style={{ display:'flex', alignItems:'center', gap:'4px', flex: i < 3 ? 'none' : 1 }}>
                                                    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'2px' }}>
                                                      <div style={{ width:'18px', height:'18px', borderRadius:'50%', background: s.done ? C.success : s.active ? C.primary : C.border, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'9px', color:'var(--c-surface-lowest)', fontWeight:700 }}>
                                                        {s.done ? '✓' : i + 1}
                                                      </div>
                                                      <div style={{ fontSize:'8px', color: s.done ? C.success : s.active ? C.primary : C.textMuted, fontWeight: s.active ? 700 : 400, whiteSpace:'nowrap' }}>{s.label}</div>
                                                    </div>
                                                    {i < 3 && <div style={{ width:'16px', height:'1px', background: s.done ? C.success : C.border, marginBottom:'10px' }} />}
                                                  </div>
                                                ))}
                                              </div>
                                              <div style={{ textAlign:'center' }}>
                                              <div style={{ width:'44px', height:'44px', borderRadius:'50%', background:C.surfaceAlt, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 12px' }}>
                                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={C.primary} strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                                              </div>
                                              <div style={{ fontSize:'14px', fontWeight:700, color:C.text, marginBottom:'4px' }}>Awaiting Escrow</div>
                                              <div style={{ fontSize:'12px', color:C.textSecondary, marginBottom:'16px', lineHeight:1.5 }}>
                                                The brand must deposit <strong>${agreedPrice.toLocaleString()}</strong> into escrow before you can begin work. The advance (30%) will be paid directly to you on deposit.
                                              </div>
                                              <div style={{ background:C.bg, border:`1px solid ${C.border}`, borderRadius:'10px', padding:'12px' }}>
                                                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'6px' }}>
                                                  <span style={{ fontSize:'0.75rem', color:C.textMuted }}>Escrow account</span>
                                                  <span style={{ fontSize:'12px', fontWeight:700, color:C.textMuted }}>Awaiting brand deposit</span>
                                                </div>
                                                <div style={{ width:'100%', height:'6px', background:C.card, borderRadius:'3px', overflow:'hidden' }}>
                                                  <div style={{ width:'0%', height:'100%', background:C.border, borderRadius:'3px' }} />
                                                </div>
                                                <div style={{ fontSize:'0.75rem', color:C.textMuted, marginTop:'6px' }}>
                                                  ₹0 / ₹${agreedPrice.toLocaleString()} deposited
                                                </div>
                                              </div>
                                              </div>{/* end textAlign:center */}
                                            </div>
                                          );
                                        }

                                        // Deliverables phase (when paymentSecured && lifecycle==='deliverables')
                                        if (creatorDealLifecycle === 'deliverables') {
                                          const deadlineStr = opp.deadline ? new Date(opp.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null;
                                          const daysLeft = opp.deadline ? Math.ceil((new Date(opp.deadline).getTime() - Date.now()) / 86400000) : null;
                                          const hasGoogleDriveLink = !!deliverableLinks[0];
                                          const hasSocialLink = !!deliverableLinks[1];
                                          const googleDriveVal = deliverableLinkInputs[0] || '';
                                          const socialLinkVal = deliverableLinkInputs[1] || '';
                                          const isValidUrl = (u: string) => u.startsWith('http://') || u.startsWith('https://');
                                          const atLeastOneSubmitted = hasGoogleDriveLink || hasSocialLink;
                                          return (
                                            <>
                                              <div style={{ fontSize:'13px', fontWeight:700, color:C.textMuted, textTransform:'uppercase', letterSpacing:'0.6px', marginBottom:'6px' }}>Submit Deliverable Links</div>
                                              <div style={{ fontSize:'0.75rem', color:C.textSecondary, marginBottom:'12px', lineHeight:1.5 }}>
                                                Provide a link to your work. Use a <strong>Google Drive link</strong> for the draft/sample, or paste a <strong>social media upload link</strong> for the final published content.
                                              </div>
                                              {deadlineStr && (
                                                <div style={{ background: daysLeft !== null && daysLeft <= 3 ? 'rgba(176, 65, 62,0.08)' : C.bg, border: `1px solid ${daysLeft !== null && daysLeft <= 3 ? 'rgba(176, 65, 62,0.3)' : C.border}`, borderRadius:'8px', padding:'10px', marginBottom:'12px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                                                  <div>
                                                    <div style={{ fontSize:'0.75rem', fontWeight:700, color:C.textMuted, textTransform:'uppercase', letterSpacing:'0.4px' }}>Deadline</div>
                                                    <div style={{ fontSize:'13px', fontWeight:600, color:C.text }}>{deadlineStr}</div>
                                                  </div>
                                                  {daysLeft !== null && (
                                                    <div style={{ fontSize:'12px', fontWeight:700, color: daysLeft <= 3 ? 'var(--c-error)' : daysLeft <= 7 ? 'var(--c-warning)' : C.success }}>
                                                      {daysLeft <= 0 ? 'Overdue' : `${daysLeft}d left`}
                                                    </div>
                                                  )}
                                                </div>
                                              )}
                                              <div style={{ background:C.bg, border:`1px solid ${C.border}`, borderRadius:'8px', padding:'10px', marginBottom:'12px' }}>
                                                <div style={{ fontSize:'0.75rem', fontWeight:700, color:C.textMuted, textTransform:'uppercase', letterSpacing:'0.4px', marginBottom:'6px' }}>Rights & Exclusivity</div>
                                                <div style={{ fontSize:'0.75rem', color:C.text, marginBottom:'3px' }}>Usage rights: <strong>{opp.usageRights || `${opp.revisionLimit * 30} days`}</strong></div>
                                                <div style={{ fontSize:'0.75rem', color:C.text, marginBottom:'3px' }}>Exclusivity: <strong>{opp.exclusivity || 'None'}</strong></div>
                                                <div style={{ fontSize:'0.75rem', color:C.text }}>Revision limit: <strong>{opp.revisionLimit} round{opp.revisionLimit !== 1 ? 's' : ''}</strong></div>
                                              </div>
                                              <div style={{ background:C.bg, border:`1px solid ${C.border}`, borderRadius:'10px', padding:'16px', marginBottom:'12px' }}>
                                                <div style={{ marginBottom:'14px' }}>
                                                  <div style={{ fontSize:'0.75rem', fontWeight:600, color:C.text, marginBottom:'6px' }}>Google Drive link (sample / draft)</div>
                                                  {hasGoogleDriveLink ? (
                                                    <div style={{ display:'flex', alignItems:'center', gap:'8px', padding:'8px 10px', background:C.surfaceAlt, borderRadius:'6px' }}>
                                                      <a href={deliverableLinks[0]} target="_blank" rel="noopener noreferrer" style={{ flex:1, fontSize:'0.75rem', color:C.primary, textDecoration:'none', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{deliverableLinks[0]}</a>
                                                      <div style={{ fontSize:'9px', fontWeight:700, color:C.success, background:'rgba(200, 184, 154,0.1)', padding:'2px 7px', borderRadius:'6px', flexShrink:0 }}>Submitted</div>
                                                    </div>
                                                  ) : (
                                                    <div style={{ display:'flex', gap:'6px' }}>
                                                      <input type="text" value={googleDriveVal} onChange={e => setDeliverableLinkInputs(prev => ({ ...prev, [0]: e.target.value }))} placeholder="https://drive.google.com/..." style={{ flex:1, background:C.surfaceAlt, border:`1px solid ${isValidUrl(googleDriveVal) ? C.success : C.border}`, borderRadius:'6px', color:C.text, padding:'7px 10px', fontSize:'0.75rem', fontFamily:'inherit', outline:'none' }} />
                                                      <button disabled={!isValidUrl(googleDriveVal)} onClick={() => { setDeliverableLinks(prev => ({ ...prev, [0]: googleDriveVal })); setDeliverableLinkInputs(prev => ({ ...prev, [0]: '' })); setDeliverableStatuses(prev => ({ ...prev, [0]: 'uploaded' })); }} style={{ background: isValidUrl(googleDriveVal) ? C.success : C.border, border:'none', borderRadius:'6px', padding:'7px 12px', color:'var(--c-surface-lowest)', fontSize:'0.75rem', fontWeight:700, cursor: isValidUrl(googleDriveVal) ? 'pointer' : 'not-allowed', opacity: isValidUrl(googleDriveVal) ? 1 : 0.5, flexShrink:0 }}>Confirm</button>
                                                    </div>
                                                  )}
                                                </div>
                                                <div>
                                                  <div style={{ fontSize:'0.75rem', fontWeight:600, color:C.text, marginBottom:'6px' }}>Social media upload link (final)</div>
                                                  {hasSocialLink ? (
                                                    <div style={{ display:'flex', alignItems:'center', gap:'8px', padding:'8px 10px', background:C.surfaceAlt, borderRadius:'6px' }}>
                                                      <a href={deliverableLinks[1]} target="_blank" rel="noopener noreferrer" style={{ flex:1, fontSize:'0.75rem', color:C.primary, textDecoration:'none', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{deliverableLinks[1]}</a>
                                                      <div style={{ fontSize:'9px', fontWeight:700, color:C.success, background:'rgba(200, 184, 154,0.1)', padding:'2px 7px', borderRadius:'6px', flexShrink:0 }}>Submitted</div>
                                                    </div>
                                                  ) : (
                                                    <div style={{ display:'flex', gap:'6px' }}>
                                                      <input type="text" value={socialLinkVal} onChange={e => setDeliverableLinkInputs(prev => ({ ...prev, [1]: e.target.value }))} placeholder="https://instagram.com/..." style={{ flex:1, background:C.surfaceAlt, border:`1px solid ${isValidUrl(socialLinkVal) ? C.success : C.border}`, borderRadius:'6px', color:C.text, padding:'7px 10px', fontSize:'0.75rem', fontFamily:'inherit', outline:'none' }} />
                                                      <button disabled={!isValidUrl(socialLinkVal)} onClick={() => { setDeliverableLinks(prev => ({ ...prev, [1]: socialLinkVal })); setDeliverableLinkInputs(prev => ({ ...prev, [1]: '' })); setDeliverableStatuses(prev => ({ ...prev, [1]: 'uploaded' })); }} style={{ background: isValidUrl(socialLinkVal) ? C.success : C.border, border:'none', borderRadius:'6px', padding:'7px 12px', color:'var(--c-surface-lowest)', fontSize:'0.75rem', fontWeight:700, cursor: isValidUrl(socialLinkVal) ? 'pointer' : 'not-allowed', opacity: isValidUrl(socialLinkVal) ? 1 : 0.5, flexShrink:0 }}>Confirm</button>
                                                    </div>
                                                  )}
                                                </div>
                                              </div>
                                              <div style={{ background:C.bg, border:`1px solid ${C.border}`, borderRadius:'8px', padding:'10px', marginBottom:'10px' }}>
                                                <div style={{ fontSize:'0.75rem', fontWeight:700, color:C.textMuted, textTransform:'uppercase', letterSpacing:'0.4px', marginBottom:'8px' }}>Payment Milestones</div>
                                                {[
                                                  { key: 'advance' as const, label: 'Advance', pct: advancePercent, color: C.success },
                                                  { key: 'approval' as const, label: 'On approval', pct: approvalPercent, color: 'var(--c-warning)' },
                                                ].map(m => (
                                                  <div key={m.key} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'6px 0', borderBottom:`1px solid ${C.border}` }}>
                                                    <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
                                                      <div style={{ width:'8px', height:'8px', borderRadius:'50%', background: paymentMilestones[m.key] === 'released' ? C.success : m.color, opacity: paymentMilestones[m.key] === 'released' ? 1 : 0.4 }} />
                                                      <span style={{ fontSize:'0.75rem', color:C.text, fontWeight:500 }}>{m.label}</span>
                                                    </div>
                                                    <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
                                                      <span style={{ fontSize:'12px', fontWeight:700, color: paymentMilestones[m.key] === 'released' ? C.success : C.text }}>${Math.round(agreedPrice * m.pct / 100).toLocaleString()}</span>
                                                      <span style={{ fontSize:'9px', fontWeight:600, color: paymentMilestones[m.key] === 'released' ? C.success : C.textMuted, textTransform:'uppercase' }}>{paymentMilestones[m.key] === 'released' ? 'Paid' : 'Pending'}</span>
                                                    </div>
                                                  </div>
                                                ))}
                                              </div>
                                              <div style={{ background:'rgba(46,125,50,0.06)', border:'1px solid rgba(46,125,50,0.2)', borderRadius:'8px', padding:'10px', marginBottom:'12px', fontSize:'0.75rem', color:C.textSecondary }}>
                                                Brand payment on-hold: ${agreedPrice.toLocaleString()}, released per milestones above
                                              </div>
                                              {atLeastOneSubmitted && !submittedForReview && activeDeal?.creatorDealLifecycle !== 'submitted' && activeDeal?.creatorDealLifecycle !== 'approved' && (
                                                <button onClick={() => {
                                                  setSubmittedForReview(true);
                                                  const agreedAmt = parseInt(dealCounterAmount || '5000');
                                                  setCreatorDealLifecycle('submitted');
                                                  setPaymentMilestones({ advance: 'released', approval: 'pending' });
                                                  if (activeDealKey) {
                                                    updateDeal(activeDealKey, {
                                                      creatorDealLifecycle: 'submitted',
                                                      brandApprovalPhase: 'reviewing',
                                                      paymentMilestones: { advance: 'released', approval: 'pending' },
                                                      deliverableStatuses: deliverableStatuses,
                                                      deliverableLinks: deliverableLinks,
                                                    });
                                                    sharedSendNotification(opp?.brand || 'Brand', 'application', `Deliverables submitted: ${agreedAmt.toLocaleString()} – Advance milestone released. Awaiting approval.`);
                                                  }
                                                  setPurchaseToast(`Submitted for review, ₹${Math.round(agreedAmt * advancePercent / 100).toLocaleString()} released, ₹${Math.round(agreedAmt * approvalPercent / 100).toLocaleString()} pending approval`);
                                                  setTimeout(() => setPurchaseToast(null), 4000);
                                                }} style={{ width:'100%', background:C.primary, border:'none', padding:'10px', borderRadius:'8px', color:'var(--c-surface-lowest)', fontWeight:600, cursor:'pointer', fontSize:'13px', marginBottom:'8px' }}>
                                                  Submit for Review
                                                </button>
                                              )}
                                              {atLeastOneSubmitted && (submittedForReview || activeDeal?.creatorDealLifecycle === 'submitted') && activeDeal?.creatorDealLifecycle !== 'approved' && (
                                                <div style={{ width:'100%', padding:'10px', background:'rgba(200, 184, 154,0.08)', border:`1px solid rgba(200, 184, 154,0.25)`, borderRadius:'8px', color:C.primary, fontWeight:600, fontSize:'13px', textAlign:'center', marginBottom:'8px' }}>
                                                  ⏳ Waiting for brand&apos;s approval
                                                </div>
                                              )}
                                              <button onClick={() => setShowCancelDealModal(true)} style={{ width:'100%', background:'none', border:`1px solid rgba(176, 65, 62,0.3)`, padding:'8px', borderRadius:'8px', color:'var(--c-error)', fontSize:'0.75rem', cursor:'pointer', fontWeight:500 }}>
                                                Cancel Deal
                                              </button>
                                            </>
                                          );
                                        }

                                          // Submitted phase (when lifecycle==='submitted')
                                          if (creatorDealLifecycle === 'submitted') {
                                            return (
                                              <>
                                                <div style={{ background:'rgba(0,102,204,0.06)', border:`1px solid rgba(0,102,204,0.2)`, borderRadius:'8px', padding:'12px', marginBottom:'12px' }}>
                                                  <div style={{ fontSize:'13px', fontWeight:700, color:C.text, marginBottom:'4px' }}>Deliverables Submitted</div>
                                                  <div style={{ fontSize:'0.75rem', color:C.textSecondary, marginBottom:'8px' }}>Waiting for brand approval, typically within 48h.</div>
                                                  <div style={{ fontSize:'0.75rem', color:C.textMuted, marginBottom:'2px' }}>Advance: <span style={{ color:C.success, fontWeight:600 }}>Paid</span></div>
                                                  <div style={{ fontSize:'0.75rem', color:C.textMuted }}>Approval milestone: <span style={{ color:'var(--c-warning)', fontWeight:600 }}>Pending brand approval</span></div>
                                                </div>
                                                <button onClick={() => {
                                                  const earnedAmount = parseInt(dealCounterAmount || dealOfferAmount || '5000');
                                                  const brandName = opp?.brand || profileName;
                                                  const updatedMetrics = {
                                                    ...metrics,
                                                    dealsCompleted: metrics.dealsCompleted + 1,
                                                    avgDealValue: Math.round((metrics.avgDealValue * metrics.dealsCompleted + earnedAmount * 100) / (metrics.dealsCompleted + 1)),
                                                  };
                                                  setMetrics(updatedMetrics);
                                                  setCompletedDeals(prev => [...prev, { id: Date.now(), brand: brandName, amount: earnedAmount, completedAt: new Date().toLocaleDateString(), deliverable: 'content' }]);
                                                  const prevLevel = getLevel(metrics.dealsCompleted);
                                                  const newLevel = getLevel(updatedMetrics.dealsCompleted);
                                                  if (newLevel > prevLevel) {
                                                    setLevelUpFrom(prevLevel);
                                                    setLevelUpTo(newLevel);
                                                    setShowLevelUpModal(true);
                                                  }
                                                  setCreatorDealLifecycle('approved');
                                                  setBrandApprovalPhase('approved');
                                                  setPaymentMilestones(prev => ({ ...prev, approval: 'released' }));
                                                  if (activeDealKey) {
                                                    updateDeal(activeDealKey, {
                                                      creatorDealLifecycle: 'approved',
                                                      brandApprovalPhase: 'approved',
                                                      paymentMilestones: { advance: 'released', approval: 'released' },
                                                    });
                                                  }
                                                }} style={{ width:'100%', background:C.success, border:'none', padding:'10px', borderRadius:'8px', color:'var(--c-surface-lowest)', fontWeight:700, cursor:'pointer', fontSize:'12px', marginBottom:'8px' }}>
                                                  Complete Deal & Update Level
                                                </button>
                                              </>
                                            );
                                          }

                                        // Approved phase (when lifecycle==='approved')
                                        if (creatorDealLifecycle === 'approved') {
                                          return (
                                            <>
                                              <div style={{ textAlign:'center', padding:'12px 0' }}>
                                                <div style={{ width:'40px', height:'40px', borderRadius:'50%', background:C.surfaceAlt, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 10px' }}>
                                                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C.textSecondary} strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                                                </div>
                                                <div style={{ fontSize:'15px', fontWeight:700, color:C.text, marginBottom:'4px' }}>Approved and Deal Completed</div>
                                                <div style={{ fontSize:'12px', color:C.textSecondary, marginBottom:'16px' }}>All deliverables approved. All milestones paid.</div>
                                                  <button
                                                    onClick={() => { if (activeDealKey && activeDeal) downloadDealSummary(activeDealKey, activeDeal); }}
                                                    style={{ width:'100%', background:'none', border:`1px solid ${C.border}`, borderRadius:'8px', padding:'7px', color:C.textSecondary, fontWeight:600, cursor:'pointer', fontSize:'0.75rem', marginBottom:'6px' }}
                                                  >
                                                    Download Legal Deal Summary (.txt) (.txt)
                                                  </button>
                                                  <button
                                                    onClick={() => { if (activeDealKey) downloadDealReport(activeDealKey); }}
                                                    style={{ width:'100%', background:C.primary, border:'none', borderRadius:'8px', padding:'9px', color:'var(--c-surface-lowest)', fontWeight:700, cursor:'pointer', fontSize:'12px', marginBottom:'12px' }}
                                                  >
                                                    Download Deal Report (.pdf)
                                                  </button>
                                                <div style={{ background:'rgba(46,125,50,0.06)', border:'1px solid rgba(46,125,50,0.2)', borderRadius:'8px', padding:'12px', marginBottom:'14px' }}>
                                                  <div style={{ fontSize:'0.75rem', color:C.textMuted, marginBottom:'2px' }}>Total Earnings</div>
                                                  <div style={{ fontSize:'22px', fontWeight:800, color:C.success }}>${parseInt(dealCounterAmount || '5000').toLocaleString()}</div>
                                                  <div style={{ fontSize:'0.75rem', color:C.textMuted, marginTop:'4px' }}>Advance + Approval milestones</div>
                                                </div>
                                                {!ratingSubmitted ? (
                                                  <div style={{ background:C.bg, border:`1px solid ${C.border}`, borderRadius:'10px', padding:'14px', marginBottom:'14px', textAlign:'left' }}>
                                                    <div style={{ fontSize:'0.75rem', fontWeight:700, color:C.textMuted, textTransform:'uppercase', letterSpacing:'0.4px', marginBottom:'8px' }}>Rate this brand</div>
                                                    <div style={{ display:'flex', gap:'6px', marginBottom:'10px', justifyContent:'center' }}>
                                                      {[1,2,3,4,5].map(star => (
                                                        <button key={star} onClick={() => setDealRating(star)} style={{ background:'none', border:'none', cursor:'pointer', fontSize:'24px', color: star <= dealRating ? 'var(--c-warning)' : C.border, transition:'color 0.1s', padding:'2px' }}>
                                                          {star <= dealRating ? '\u2605' : '\u2606'}
                                                        </button>
                                                      ))}
                                                    </div>
                                                    <textarea value={dealRatingComment} onChange={e => setDealRatingComment(e.target.value)} placeholder="How was working with this brand?" rows={2} style={{ width:'100%', background:C.card, border:`1px solid ${C.border}`, borderRadius:'6px', padding:'8px', fontSize:'12px', color:C.text, resize:'none', boxSizing:'border-box' }} />
                                                    <button onClick={() => { setRatingSubmitted(true); if (activeDealKey) { updateDeal(activeDealKey, { creatorRating: dealRating, creatorRatingComment: dealRatingComment, displayCreatorRating: false }); } setPurchaseToast('Rating submitted'); setTimeout(() => setPurchaseToast(null), 3000); }} disabled={dealRating === 0} style={{ width:'100%', background: dealRating > 0 ? C.primary : C.border, border:'none', padding:'8px', borderRadius:'6px', color:'var(--c-surface-lowest)', fontWeight:600, fontSize:'12px', cursor: dealRating > 0 ? 'pointer' : 'not-allowed', marginTop:'8px', opacity: dealRating > 0 ? 1 : 0.5 }}>
                                                      Submit Rating
                                                    </button>
                                                  </div>
                                                ) : (
                                                  <div style={{ background:'rgba(0,102,204,0.06)', border:`1px solid rgba(0,102,204,0.2)`, borderRadius:'8px', padding:'10px', marginBottom:'14px' }}>
                                                    <div style={{ fontSize:'12px', color:C.textSecondary, marginBottom:'8px' }}>
                                                      Rating submitted: {dealRating}/5
                                                    </div>
                                                    <label style={{ display:'flex', alignItems:'center', gap:'8px', fontSize:'12px', color:C.text, cursor:'pointer' }}>
                                                      <input type="checkbox" checked={displayCreatorRating} onChange={e => { setDisplayCreatorRating(e.target.checked); if (activeDealKey) { updateDeal(activeDealKey, { displayCreatorRating: e.target.checked }); } }} style={{ cursor:'pointer' }} />
                                                      Show this review on my ValueSkins profile
                                                    </label>
                                                  </div>
                                                )}
                                                <div style={{ background:C.bg, border:`1px solid ${C.border}`, borderRadius:'8px', padding:'10px', marginBottom:'10px', textAlign:'left' }}>
                                                  {/* Was "Escrow Release" with a two-stage release from a
                                                      held pool. There is no pool: the brand makes three
                                                      direct payments and the creator is paid out of each. */}
                                                  <div style={{ fontSize:'0.75rem', fontWeight:700, color:C.textMuted, textTransform:'uppercase', letterSpacing:'0.4px', marginBottom:'6px' }}>Payment Schedule</div>
                                                  {[
                                                    { label:'Commission', status:'Paid by brand on confirmation' },
                                                    { label:'Advance (30%)', status:'Paid to you after the commission' },
                                                    { label:'Final (70%)', status:'Paid to you on approval' },
                                                  ].map(m => (
                                                    <div key={m.label} style={{ display:'flex', alignItems:'center', gap:'6px', padding:'3px 0', fontSize:'0.75rem' }}>
                                                      <div style={{ width:'8px', height:'8px', borderRadius:'50%', background:C.success }} />
                                                      <span style={{ color:C.text, flex:1 }}>{m.label}</span>
                                                      <span style={{ color:C.success, fontSize:'0.75rem' }}>{m.status}</span>
                                                    </div>
                                                  ))}
                                                </div>
                                                {opp && (
                                                  <div style={{ background:C.bg, border:`1px solid ${C.border}`, borderRadius:'8px', padding:'10px', marginBottom:'10px', textAlign:'left' }}>
                                                    <div style={{ fontSize:'0.75rem', fontWeight:700, color:C.textMuted, textTransform:'uppercase', letterSpacing:'0.4px', marginBottom:'6px' }}>Active Rights</div>
                                                    <div style={{ fontSize:'0.75rem', color:C.text, marginBottom:'3px' }}>
                                                      Content usage: <strong>{opp.usageRights || `${opp.revisionLimit * 30} days`}</strong>
                                                      <span style={{ color:C.textMuted }}>, expires {new Date(Date.now() + (opp.revisionLimit || 3) * 30 * 86400000).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' })}</span>
                                                    </div>
                                                    {opp.exclusivity && opp.exclusivity !== 'None' && (
                                                      <div style={{ fontSize:'0.75rem', color:C.text }}>
                                                        Exclusivity: <strong>{opp.exclusivity}</strong>
                                                        <span style={{ color:'var(--c-warning)' }}>, do not accept competing deals</span>
                                                      </div>
                                                    )}
                                                  </div>
                                                )}
                                                {contractSignature && (
                                                  <div style={{ background:'rgba(0,102,204,0.04)', border:`1px solid rgba(0,102,204,0.15)`, borderRadius:'8px', padding:'8px 10px', marginBottom:'10px', fontSize:'0.75rem', color:C.textMuted, textAlign:'left' }}>
                                                    Contract signed by <strong style={{ color:C.text, fontStyle:'italic' }}>{contractSignature}</strong> on {new Date().toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' })}
                                                  </div>
                                                )}
                                                <div style={{ display:'flex', gap:'8px' }}>
                                                  <button onClick={() => { if (activeDealKey) { setDealStates(prev => { const next = {...prev}; delete next[activeDealKey]; return next; }); } setNegotiatingOpp(null); setCreatorDealLifecycle('checklist'); setDealUploadSimulated(false); setDeliverableStatuses({}); setDeliverableLinks({}); setDeliverableLinkInputs({}); setPaymentMilestones({ advance:'pending', upload:'pending', approval:'pending' }); setDealRating(0); setDealRatingComment(''); setRatingSubmitted(false); setContractChecks({}); setContractSignature(''); setEscrowFunded(false); setEscrowFundingInProgress(false); }} style={{ flex:2, background:C.primary, border:'none', padding:'10px', borderRadius:'8px', color:'var(--c-surface-lowest)', fontWeight:600, cursor:'pointer', fontSize:'13px' }}>
                                                    Withdraw to Bank
                                                  </button>
                                                  <button onClick={() => setShowDisputeModal(Date.now())} style={{ flex:1, background:'none', border:`1px solid rgba(176, 65, 62,0.3)`, padding:'10px', borderRadius:'8px', color:'var(--c-error)', fontSize:'0.75rem', cursor:'pointer', fontWeight:500 }}>
                                                    Dispute
                                                  </button>
                                                </div>
                                              </div>
                                            </>
                                          );
                                        }
                                        return null;
                                      }

                                      // BARTER: Goods tracking workflow (6 states)
                                      case 'barter': {
                                        const status = goodsTrackerStatus;
                                        const trackingInput = goodsTrackingInput;
                                        return (
                                          <>
                                            <div style={{ fontSize:'0.75rem', fontWeight:700, color:C.textMuted, textTransform:'uppercase', letterSpacing:'0.6px', marginBottom:'10px' }}>Goods Tracking</div>
                                            {status === 'goods_preparing' && (
                                              <div style={{ background:'rgba(160,138,94,0.06)', border:`1px solid rgba(160,138,94,0.2)`, borderRadius:'8px', padding:'12px', marginBottom:'12px' }}>
                                                <div style={{ fontSize:'13px', fontWeight:700, color:C.text, marginBottom:'4px' }}>Brand is Preparing Your Product</div>
                                                <div style={{ fontSize:'0.75rem', color:C.textSecondary }}>Your product is being selected and packaged. You will receive tracking information once it ships.</div>
                                              </div>
                                            )}
                                            {status === 'goods_shipped' && (
                                              <div style={{ background:'rgba(200, 184, 154,0.06)', border:`1px solid rgba(200, 184, 154,0.2)`, borderRadius:'8px', padding:'12px', marginBottom:'12px' }}>
                                                <div style={{ fontSize:'13px', fontWeight:700, color:C.text, marginBottom:'4px' }}>Your Product is On The Way</div>
                                                <div style={{ fontSize:'0.75rem', color:C.textSecondary, marginBottom:'8px' }}>
                                                  Tracking: <strong>{trackingInput || 'Tracking info shown by brand'}</strong>
                                                </div>
                                                <button onClick={() => {
                                                  setGoodsTrackerStatus('goods_delivered');
                                                  if (activeDealKey) {
                                                    updateDeal(activeDealKey, { goodsTrackerStatus: 'goods_delivered' });
                                                  }
                                                  setPurchaseToast('Marked as received');
                                                  setTimeout(() => setPurchaseToast(null), 3000);
                                                }} style={{ width:'100%', background:C.primary, border:'none', padding:'8px', borderRadius:'6px', color:'var(--c-surface-lowest)', fontWeight:600, cursor:'pointer', fontSize:'0.75rem' }}>
                                                  Mark as Received
                                                </button>
                                              </div>
                                            )}
                                            {status === 'goods_delivered' && (
                                              <div style={{ background:'rgba(200, 184, 154,0.06)', border:`1px solid rgba(200, 184, 154,0.2)`, borderRadius:'8px', padding:'12px', marginBottom:'12px' }}>
                                                <div style={{ fontSize:'13px', fontWeight:700, color:C.text, marginBottom:'4px' }}>Product Received</div>
                                                <div style={{ fontSize:'0.75rem', color:C.textSecondary, marginBottom:'8px' }}>Great! Now create content featuring this product. You have until the deadline to submit.</div>
                                                <button onClick={() => {
                                                  setGoodsTrackerStatus('content_due');
                                                  if (activeDealKey) {
                                                    updateDeal(activeDealKey, { goodsTrackerStatus: 'content_due' });
                                                  }
                                                  setPurchaseToast('Ready to create content');
                                                  setTimeout(() => setPurchaseToast(null), 3000);
                                                }} style={{ width:'100%', background:C.primary, border:'none', padding:'8px', borderRadius:'6px', color:'var(--c-surface-lowest)', fontWeight:600, cursor:'pointer', fontSize:'0.75rem' }}>
                                                  Start Creating
                                                </button>
                                              </div>
                                            )}
                                            {status === 'content_due' && (
                                              <div style={{ background:'rgba(160,138,94,0.06)', border:`1px solid rgba(160,138,94,0.2)`, borderRadius:'8px', padding:'12px', marginBottom:'12px' }}>
                                                <div style={{ fontSize:'13px', fontWeight:700, color:C.text, marginBottom:'4px' }}>Create Content</div>
                                                <div style={{ fontSize:'0.75rem', color:C.textSecondary, marginBottom:'8px' }}>Submit a link to your published content featuring the product</div>
                                                <input
                                                  type="text"
                                                  value={deliverableLinkInputs[0] || ''}
                                                  onChange={e => setDeliverableLinkInputs(prev => ({ ...prev, 0: e.target.value }))}
                                                  placeholder="https://www.portfolio.valueskins.com/p/..."
                                                  style={{ width:'100%', background:C.surfaceAlt, border:`1px solid ${/instagram\.com\/(p|reels?|tv)\/[A-Za-z0-9_-]+/.test(deliverableLinkInputs[0] || '') ? C.success : C.border}`, borderRadius:'6px', color:C.text, padding:'7px 10px', fontSize:'0.75rem', fontFamily:'inherit', outline:'none', marginBottom:'8px', boxSizing:'border-box' }}
                                                />
                                                <button
                                                  disabled={!/instagram\.com\/(p|reels?|tv)\/[A-Za-z0-9_-]+/.test(deliverableLinkInputs[0] || '')}
                                                  onClick={() => {
                                                    setDeliverableLinks(prev => ({ ...prev, 0: deliverableLinkInputs[0] }));
                                                    setGoodsTrackerStatus('content_submitted');
                                                    setDeliverableLinkInputs(prev => ({ ...prev, 0: '' }));
                                                    if (activeDealKey) {
                                                      updateDeal(activeDealKey, { goodsTrackerStatus: 'content_submitted' });
                                                    }
                                                    setPurchaseToast('Content submitted for review');
                                                    setTimeout(() => setPurchaseToast(null), 3000);
                                                  }}
                                                  style={{ width:'100%', background: /instagram\.com\/(p|reels?|tv)\/[A-Za-z0-9_-]+/.test(deliverableLinkInputs[0] || '') ? C.primary : C.border, border:'none', borderRadius:'6px', padding:'8px', color:'var(--c-surface-lowest)', fontWeight:600, cursor: /instagram\.com\/(p|reels?|tv)\/[A-Za-z0-9_-]+/.test(deliverableLinkInputs[0] || '') ? 'pointer' : 'not-allowed', opacity: /instagram\.com\/(p|reels?|tv)\/[A-Za-z0-9_-]+/.test(deliverableLinkInputs[0] || '') ? 1 : 0.5, fontSize:'0.75rem' }}
                                                >
                                                  Submit Content
                                                </button>
                                              </div>
                                            )}
                                            {status === 'content_submitted' && (
                                              <div style={{ background:'rgba(160,138,94,0.06)', border:`1px solid rgba(160,138,94,0.2)`, borderRadius:'8px', padding:'12px', marginBottom:'12px' }}>
                                                <div style={{ fontSize:'13px', fontWeight:700, color:C.text, marginBottom:'4px' }}>Content Submitted</div>
                                                <div style={{ fontSize:'0.75rem', color:C.textSecondary }}>Your content is awaiting brand approval. This typically takes 24-48 hours.</div>
                                              </div>
                                            )}
                                            {status === 'content_approved' && (
                                              <div style={{ textAlign:'center', padding:'12px 0' }}>
                                                <div style={{ width:'40px', height:'40px', borderRadius:'50%', background:C.surfaceAlt, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 10px' }}>
                                                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C.success} strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                                                </div>
                                                <div style={{ fontSize:'15px', fontWeight:700, color:C.text, marginBottom:'4px' }}>Approved and Deal Completed</div>
                                                <div style={{ fontSize:'12px', color:C.textSecondary, marginBottom:'16px' }}>Brand approved your content. Barter deal finished.</div>
                                                <div style={{ display:'flex', gap:'8px' }}>
                                                  <button onClick={() => { if (activeDealKey) { setDealStates(prev => { const next = {...prev}; delete next[activeDealKey]; return next; }); } setNegotiatingOpp(null); }} style={{ flex:1, background:C.primary, border:'none', padding:'10px', borderRadius:'8px', color:'var(--c-surface-lowest)', fontWeight:600, cursor:'pointer', fontSize:'12px' }}>
                                                    Close
                                                  </button>
                                                </div>
                                              </div>
                                            )}
                                          </>
                                        );
                                      }

                                      // C2C_COLLAB: Content tracking (3 states)
                                      case 'c2c_collab': {
                                        const status = c2cContentStatus;
                                        return (
                                          <>
                                            <div style={{ fontSize:'0.75rem', fontWeight:700, color:C.textMuted, textTransform:'uppercase', letterSpacing:'0.6px', marginBottom:'10px' }}>Content Collaboration</div>
                                            {status === 'content_creating' && (
                                              <div style={{ background:'rgba(160,138,94,0.06)', border:`1px solid rgba(160,138,94,0.2)`, borderRadius:'8px', padding:'12px', marginBottom:'12px' }}>
                                                <div style={{ fontSize:'13px', fontWeight:700, color:C.text, marginBottom:'4px' }}>In Progress</div>
                                                <div style={{ fontSize:'0.75rem', color:C.textSecondary, marginBottom:'8px' }}>Submit your content link when ready</div>
                                                <input
                                                  type="text"
                                                  value={deliverableLinkInputs[0] || ''}
                                                  onChange={e => setDeliverableLinkInputs(prev => ({ ...prev, 0: e.target.value }))}
                                                  placeholder="https://www.portfolio.valueskins.com/p/..."
                                                  style={{ width:'100%', background:C.surfaceAlt, border:`1px solid ${/instagram\.com\/(p|reels?|tv)\/[A-Za-z0-9_-]+/.test(deliverableLinkInputs[0] || '') ? C.success : C.border}`, borderRadius:'6px', color:C.text, padding:'7px 10px', fontSize:'0.75rem', fontFamily:'inherit', outline:'none', marginBottom:'8px', boxSizing:'border-box' }}
                                                />
                                                <button
                                                  disabled={!/instagram\.com\/(p|reels?|tv)\/[A-Za-z0-9_-]+/.test(deliverableLinkInputs[0] || '')}
                                                  onClick={() => {
                                                    setDeliverableLinks(prev => ({ ...prev, 0: deliverableLinkInputs[0] }));
                                                    setC2cContentStatus('content_submitted');
                                                    setDeliverableLinkInputs(prev => ({ ...prev, 0: '' }));
                                                    if (activeDealKey) {
                                                      updateDeal(activeDealKey, { c2cContentStatus: 'content_submitted' });
                                                    }
                                                    setPurchaseToast('Content submitted');
                                                    setTimeout(() => setPurchaseToast(null), 3000);
                                                  }}
                                                  style={{ width:'100%', background: /instagram\.com\/(p|reels?|tv)\/[A-Za-z0-9_-]+/.test(deliverableLinkInputs[0] || '') ? C.primary : C.border, border:'none', borderRadius:'6px', padding:'8px', color:'var(--c-surface-lowest)', fontWeight:600, cursor: /instagram\.com\/(p|reels?|tv)\/[A-Za-z0-9_-]+/.test(deliverableLinkInputs[0] || '') ? 'pointer' : 'not-allowed', opacity: /instagram\.com\/(p|reels?|tv)\/[A-Za-z0-9_-]+/.test(deliverableLinkInputs[0] || '') ? 1 : 0.5, fontSize:'0.75rem' }}
                                                >
                                                  Submit
                                                </button>
                                              </div>
                                            )}
                                            {status === 'content_submitted' && (
                                              <div style={{ background:'rgba(160,138,94,0.06)', border:`1px solid rgba(160,138,94,0.2)`, borderRadius:'8px', padding:'12px', marginBottom:'12px' }}>
                                                <div style={{ fontSize:'13px', fontWeight:700, color:C.text, marginBottom:'4px' }}>Submitted</div>
                                                <div style={{ fontSize:'0.75rem', color:C.textSecondary }}>Waiting for collaborator approval</div>
                                              </div>
                                            )}
                                            {status === 'content_approved' && (
                                              <div style={{ textAlign:'center', padding:'12px 0' }}>
                                                <div style={{ width:'40px', height:'40px', borderRadius:'50%', background:C.surfaceAlt, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 10px' }}>
                                                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C.success} strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                                                </div>
                                                <div style={{ fontSize:'15px', fontWeight:700, color:C.text, marginBottom:'4px' }}>Collaboration Complete</div>
                                                <div style={{ fontSize:'12px', color:C.textSecondary, marginBottom:'16px' }}>Collaborator approved. Deal finished.</div>
                                                <button onClick={() => { if (activeDealKey) { setDealStates(prev => { const next = {...prev}; delete next[activeDealKey]; return next; }); } setNegotiatingOpp(null); }} style={{ width:'100%', background:C.primary, border:'none', padding:'10px', borderRadius:'8px', color:'var(--c-surface-lowest)', fontWeight:600, cursor:'pointer', fontSize:'12px' }}>
                                                  Close
                                                </button>
                                              </div>
                                            )}
                                          </>
                                        );
                                      }

                                      default:
                                        return null;
                                    }
                                  })()}

                                  {/* POC Contact Card — visible at all deal phases when POC exists */}
                                  {activeDeal?.poc && ['chatroom','checklist','accepted','softhold'].includes(dealRoomPhase) && (
                                    <div style={{ background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: '8px', padding: '10px', marginTop: '12px' }}>
                                      <div style={{ fontSize: '9px', fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>Point of Contact</div>
                                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <div>
                                          <div
                                            onMouseEnter={(e) => {
                                              const brandName = (opp as any)?.brand || activeDeal?.poc?.name || profileName;
                                              showHoverCard(buildBrandHover(brandName), e);
                                            }}
                                            onMouseMove={updateHoverPosition}
                                            onMouseLeave={hideHoverCard}
                                            style={{ fontSize: '12px', fontWeight: 600, color: C.text, cursor: 'pointer' }}>{activeDeal.poc.name}</div>
                                          <div style={{ fontSize: '0.75rem', color: C.primary, marginTop: '1px' }}>{activeDeal.poc.workEmail}</div>
                                          {activeDeal.poc.role && <div style={{ fontSize: '0.75rem', color: C.textSecondary, marginTop: '1px' }}>{activeDeal.poc.role}</div>}
                                        </div>
                                        <button
                                          onClick={() => {
                                            const workEmail = activeDeal.poc?.workEmail || '';
                                            if (workEmail) {
                                              window.open(`mailto:${workEmail}`, '_blank');
                                            }
                                            setPurchaseToast(`Contacting ${activeDeal.poc?.name || 'POC'} via email`);
                                            setTimeout(() => setPurchaseToast(null), 2000);
                                          }}
                                          style={{ background: C.primary, border: 'none', borderRadius: '6px', padding: '5px 12px', color: C.onPrimary, fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}
                                        >
                                          Message
                                        </button>
                                      </div>
                                    </div>
                                  )}

                                  {!['brief','pending','offer','counter','brand_considering','brand_countered','brand_rejected','accepted','chatroom','checklist','softhold'].includes(dealRoomPhase) && (
                                    <div style={{ textAlign: 'center', padding: '18px 8px' }}>
                                      <div style={{ fontSize: '12px', color: C.textSecondary, marginBottom: '8px' }}>Deal phase - {dealRoomPhase.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</div>
                                      <button onClick={() => setNegotiatingOpp(null)} style={{ background: 'none', border: `1px solid ${C.border}`, padding: '8px 16px', borderRadius: '8px', color: C.textSecondary, cursor: 'pointer', fontSize: '12px' }}>Close</button>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </>
                    )}
                    </>)}

                  </div>
                </>
                );
              })()}

              {/* Layer 3b: Brand Marketplace */}
              {marketplaceRole === 'brand' && (
                <>
                  <div style={{
                    padding: '20px 16px 0', position: 'sticky', top: 'var(--vs-header-h, 0px)', zIndex: 10,
                    // §2a: tonal wash, not decoration — a single-family depth
                    // gradient with a faint deep-sand glow top-right. Layered
                    // over the theme background so light mode is unaffected.
                    background: `radial-gradient(60% 50% at 85% 0%, rgba(160,138,94,0.10), transparent 70%), ${C.bg}`,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', marginBottom: '18px' }}>
                      <div>
                        {/* §2b: ~40px, weight 700, tight tracking, left-aligned,
                            with a quiet muted sub-line under it. */}
                        <div style={{ fontSize: 'clamp(28px, 3.4vw, 40px)', fontWeight: 700, color: C.text, letterSpacing: '-0.02em', lineHeight: 1.05 }}>Brand Dashboard</div>
                        <div style={{ fontSize: '15px', color: C.textSecondary, marginTop: '6px' }}>Your campaigns, applicants, and deals</div>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <button
                          onClick={handleRefresh}
                          title="Refresh campaigns from shared state"
                          style={{
                            background: 'none', border: `1px solid ${C.border}`, borderRadius: '8px',
                            padding: '8px 12px', fontSize: '13px', fontWeight: 600, color: C.textSecondary,
                            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
                            opacity: refreshing ? 0.5 : 1,
                          }}
                        >
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: realtimeConnected ? 'var(--c-accent)' : 'var(--c-text-variant)', flexShrink: 0 }} title={realtimeConnected ? 'Real-time connected' : 'Offline, data refreshes on reload'} />
                          {refreshing ? '↻' : '⟳'} Refresh
                        </button>
                        <button
                          onClick={() => { setCampaignsSectionOpen(true); brandPastRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}
                          title="View past deals and expired campaigns"
                          style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: '8px', padding: '8px 14px', fontSize: '13px', fontWeight: 600, color: C.textSecondary, cursor: 'pointer' }}
                        >
                          View Past Campaigns
                        </button>
                        <button
                          onClick={() => setShowCampaignCreator(true)}
                          style={{
                            background: C.primary, color: C.onPrimary, border: 'none', borderRadius: '8px',
                            padding: '8px 14px', fontSize: '13px', fontWeight: 700, cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: '6px'
                          }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                          Create New Campaign
                        </button>
                      </div>
                    </div>
                    {/* Only show discovery search if a campaign exists */}
                    {campaigns.length > 0 && (
                      <div style={{ position: 'relative', marginBottom: '14px' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.textMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}>
                          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                        </svg>
                        <input type="text" placeholder="Search creators..." style={{ width: '100%', background: C.card, border: 'none', borderRadius: '12px', padding: '12px 12px 12px 40px', color: C.text, fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
                      </div>
                    )}
                  </div>
                  <div style={{ padding: '0 16px 16px' }}>
                    {/* Campaign composer — ui-specs/Market.md §3.
                        The modal is retired: campaign creation is long and
                        multi-field, so it cramped content and forced scrolling
                        in a small window. The full-page composer carries a
                        persistent frame (Back + title + Draft·autosaved +
                        Launch) which is what keeps the user oriented (G4), and
                        it autosaves so Back never loses work. */}
                    {/* ── [v1 COMMENTED OUT] Brand Negotiation View + its chat — no negotiation in v1, brand fixes the deal up-front. See Things-Commented-Out.md. */}
                    {false && negotiatingCreator !== null && brandDeal && (
                      <div style={{ position:'fixed', top:0, left:0, right:0, bottom:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:9998, padding:'16px' }}>
                        <div style={{ background:C.surface, borderRadius:'16px', maxWidth:'600px', width:'100%', maxHeight:'90vh', overflowY:'auto', border:`1px solid ${C.border}`, display:'flex', flexDirection:'column' }}>
                          {/* Header */}
                          <div style={{ padding:'20px', borderBottom:`1px solid ${C.border}`, display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
                            <div>
                              <div style={{ fontSize:'18px', fontWeight:700, color:C.text }}>Negotiation with {backendCreators.find((c: any) => c._origIdx === negotiatingCreator)?.name || 'Creator'}</div>
                              <div style={{ fontSize:'13px', color:C.textSecondary, marginTop:'4px' }}>{backendCreators.find((c: any) => c._origIdx === negotiatingCreator)?.valueSkin}</div>
                            </div>
                            <button onClick={() => setNegotiatingCreator(null)} style={{ background:'none', border:'none', color:C.textMuted, fontSize:'24px', cursor:'pointer', lineHeight:1 }}>×</button>
                          </div>

                          {/* Deal Details Section */}
                          <div style={{ padding:'20px', borderBottom:`1px solid ${C.border}`, flexShrink:0 }}>
                            <div style={{ fontSize:'0.75rem', fontWeight:700, color:C.textMuted, textTransform:'uppercase', letterSpacing:'0.6px', marginBottom:'12px' }}>Negotiated Deal Terms</div>
                            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px', marginBottom:'12px' }}>
                              <div style={{ background:C.bg, borderRadius:'10px', padding:'12px', border:`1px solid ${C.border}` }}>
                                <div style={{ fontSize:'0.75rem', color:C.textMuted, marginBottom:'4px' }}>Last Negotiated Price</div>
                                <div style={{ fontSize:'18px', fontWeight:700, color:C.success }}>₹{parseInt(String(brandDeal?.counterAmount || brandDeal?.offerAmount || '0').replace(/[^0-9]/g, '')).toLocaleString()}</div>
                              </div>
                              <div style={{ background:C.bg, borderRadius:'10px', padding:'12px', border:`1px solid ${C.border}` }}>
                                <div style={{ fontSize:'0.75rem', color:C.textMuted, marginBottom:'4px' }}>Phase</div>
                                <div style={{ fontSize:'14px', fontWeight:700, color:C.primary, textTransform:'capitalize' }}>{brandDeal?.phase || 'pending'}</div>
                              </div>
                            </div>
                            <div style={{ background:C.bg, borderRadius:'10px', padding:'12px', border:`1px solid ${C.border}` }}>
                              <div style={{ fontSize:'0.75rem', color:C.textMuted, marginBottom:'8px' }}>Deal Structure</div>
                              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px', fontSize:'13px' }}>
                                <div>
                                  <div style={{ color:C.textMuted, marginBottom:'2px' }}>Advance</div>
                                  <div style={{ fontWeight:700, color:C.text }}>{(brandDeal?.advancePercent || 30)}% - ₹{Math.round(parseInt(String(brandDeal?.counterAmount || brandDeal?.offerAmount || '0').replace(/[^0-9]/g, '')) * ((brandDeal?.advancePercent || 30) / 100)).toLocaleString()}</div>
                                </div>
                                <div>
                                  <div style={{ color:C.textMuted, marginBottom:'2px' }}>On Approval</div>
                                  <div style={{ fontWeight:700, color:C.text }}>{(brandDeal?.approvalPercent || 70)}% - ₹{Math.round(parseInt(String(brandDeal?.counterAmount || brandDeal?.offerAmount || '0').replace(/[^0-9]/g, '')) * ((brandDeal?.approvalPercent || 70) / 100)).toLocaleString()}</div>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Chat Messages Section */}
                          <div style={{ flex:1, padding:'16px', overflowY:'auto', minHeight:'200px', display:'flex', flexDirection:'column', gap:'8px' }}>
                            {(brandDeal?.chatMessages || []).length === 0 ? (
                              <div style={{ textAlign:'center', color:C.textMuted, padding:'20px' }}>No messages yet. Start the conversation!</div>
                            ) : (
                              (brandDeal?.chatMessages || []).map((msg: any, i: number) => (
                                <div key={i} style={{ display:'flex', justifyContent: msg.sender === 'brand' ? 'flex-end' : 'flex-start', marginBottom:'8px' }}>
                                  <div style={{ background: msg.sender === 'brand' ? C.primary : C.bg, color: msg.sender === 'brand' ? C.onPrimary : C.text, borderRadius:'10px', padding:'10px 12px', maxWidth:'70%', wordBreak:'break-word', fontSize:'13px' }}>
                                    <div>{msg.text}</div>
                                    <div style={{ fontSize:'0.7rem', opacity:0.7, marginTop:'4px' }}>{msg.time}</div>
                                  </div>
                                </div>
                              ))
                            )}
                            <div ref={brandChatEndRef} />
                          </div>

                          {/* Input Area */}
                          <div style={{ padding:'16px', borderTop:`1px solid ${C.border}`, flexShrink:0, display:'flex', gap:'8px' }}>
                            <input
                              type="text"
                              placeholder="Send a message..."
                              value={brandDeal?.chatInput || ''}
                              onChange={(e) => { if (brandDealKey) updateDeal(brandDealKey, { chatInput: e.target.value }); }}
                              onKeyPress={(e) => {
                                if (e.key === 'Enter' && (e.target as any).value.trim() && brandDealKey) {
                                  const now = new Date();
                                  const newMsg = { id: Date.now(), sender: 'brand' as const, text: (e.target as any).value, time: now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: false }), isoTime: now.toISOString(), seen: false };
                                  updateDeal(brandDealKey, { chatInput: '', chatMessages: [...(brandDeal?.chatMessages || []), newMsg] });
                                }
                              }}
                              style={{ flex:1, padding:'10px 12px', borderRadius:'8px', border:`1px solid ${C.border}`, background:C.bg, color:C.text, fontSize:'13px', outline:'none' }}
                            />
                            <button
                              onClick={() => {
                                if ((brandDeal?.chatInput || '').trim() && brandDealKey) {
                                  const now = new Date();
                                  const newMsg = { id: Date.now(), sender: 'brand' as const, text: brandDeal.chatInput, time: now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: false }), isoTime: now.toISOString(), seen: false };
                                  updateDeal(brandDealKey, { chatInput: '', chatMessages: [...(brandDeal?.chatMessages || []), newMsg] });
                                }
                              }}
                              style={{ padding:'10px 16px', borderRadius:'8px', background:C.primary, color:C.onPrimary, border:'none', fontWeight:700, fontSize:'13px', cursor:'pointer' }}
                            >Send</button>
                          </div>

                          {/* Action Buttons */}
                          <div style={{ padding:'16px', borderTop:`1px solid ${C.border}`, flexShrink:0, display:'flex', gap:'8px', justifyContent:'flex-end' }}>
                            <button
                              onClick={() => setNegotiatingCreator(null)}
                              style={{ padding:'10px 16px', borderRadius:'8px', background:'none', border:`1px solid ${C.border}`, color:C.text, fontWeight:600, fontSize:'13px', cursor:'pointer' }}
                            >Close</button>
                            <button
                              onClick={() => {
                                if (brandDealKey) {
                                  updateDeal(brandDealKey, { phase: 'formal_offer', brandApprovalPhase: 'reviewing' });
                                  setShowBrandPaymentModal(true);
                                  setNegotiatingCreator(null);
                                  setPurchaseToast('Processing payment...');
                                  setTimeout(() => setPurchaseToast(null), 3000);
                                }
                              }}
                              style={{ padding:'10px 16px', borderRadius:'8px', background:C.success, color:'var(--c-surface-lowest)', border:'none', fontWeight:700, fontSize:'13px', cursor:'pointer' }}
                            >Accept & Pay</button>
                          </div>
                        </div>
                      </div>
                    )}

                    

                    {/* Brand Payment Modal — commission payment after deal acceptance */}
                    {showBrandPaymentModal && activeDealKey && (() => {
                      const deal = dealStates[activeDealKey];
                      if (!deal) return null;
                      const dealAmount = parseInt(String(deal.counterAmount || deal.offerAmount || '0').replace(/[^0-9]/g, '') || '0');
                      const commission = Math.round(dealAmount * platformCommissionPct / 100);
                      const creatorName = deal.creatorName || 'Creator';
                      return (
                      <div style={{ position:'fixed', top:0, left:0, right:0, bottom:0, background:'rgba(0,0,0,0.85)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:10000 }}>
                        <div style={{ background:C.surface, borderRadius:'16px', padding:'28px', maxWidth:'440px', width:'95vw', border:`1px solid ${C.border}` }}>
                          <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'6px' }}>
                            <div style={{ width:36, height:36, borderRadius:'50%', background:C.surfaceAlt, display:'flex', alignItems:'center', justifyContent:'center' }}>
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.warning} strokeWidth="2"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                            </div>
                            <div style={{ fontSize:'16px', fontWeight:700, color:C.text }}>Complete Payment</div>
                          </div>
                          <div style={{ fontSize:'12px', color:C.textSecondary, marginBottom:'20px', lineHeight:1.5 }}>
                            Before {creatorName} begins work, pay ValueSkins' commission on this deal. The creator's advance will be held securely and released per your agreement.
                          </div>

                          {/* Deal Summary */}
                          <div style={{ background:C.bg, border:`1px solid ${C.border}`, borderRadius:'10px', padding:'14px', marginBottom:'14px' }}>
                            <div style={{ fontSize:'12px', fontWeight:700, color:C.text, marginBottom:'8px' }}>{creatorName}, {deal.creatorSkin}</div>
                            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px', marginBottom:'8px' }}>
                              <div>
                                <div style={{ fontSize:'0.75rem', color:C.textMuted, fontWeight:600, marginBottom:'2px' }}>Deal Amount</div>
                                <div style={{ fontSize:'14px', fontWeight:700, color:C.text }}>₹{dealAmount.toLocaleString()}</div>
                              </div>
                              <div>
                                <div style={{ fontSize:'0.75rem', color:C.textMuted, fontWeight:600, marginBottom:'2px' }}>Your Commission</div>
                                <div style={{ fontSize:'14px', fontWeight:700, color:C.warning }}>₹{commission.toLocaleString()}</div>
                              </div>
                            </div>
                            <div style={{ fontSize:'0.75rem', color:C.textSecondary, paddingTop:'8px', borderTop:`1px solid ${C.border}` }}>
                              {platformCommissionPct}% platform fee on creator deals
                            </div>
                          </div>

                          {/* Payment Methods */}
                          <div style={{ background:C.bg, border:`1px solid ${C.border}`, borderRadius:'10px', padding:'12px', marginBottom:'14px' }}>
                            <div style={{ fontSize:'0.75rem', fontWeight:700, color:C.textMuted, textTransform:'uppercase', letterSpacing:'0.4px', marginBottom:'8px' }}>Payment Method</div>
                            <div style={{ fontSize:'12px', color:C.textSecondary, padding:'8px', background:C.card, borderRadius:'6px', border:`1px solid ${C.border}` }}>
                              Razorpay (Credit/Debit Card, UPI, NetBanking)
                            </div>
                          </div>

                          {/* Payment Progress */}
                          {brandPaymentInProgress && (
                            <div style={{ marginBottom:'14px' }}>
                              <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.75rem', color:C.textMuted, marginBottom:'6px' }}>
                                <span>Processing payment...</span>
                                <span style={{ color:'var(--c-warning)', fontWeight:600 }}>Verifying</span>
                              </div>
                              <div style={{ width:'100%', height:'6px', background:C.card, borderRadius:'3px', overflow:'hidden' }}>
                                <div style={{ width:'70%', height:'100%', background:'var(--c-warning)', borderRadius:'3px', transition:'width 1.5s ease' }} />
                              </div>
                            </div>
                          )}

                          {/* Action Buttons */}
                          <div style={{ display:'flex', gap:'8px' }}>
                            <button
                              disabled={brandPaymentInProgress}
                              onClick={async () => {
                                // Wired to the real workflow. What changed and why:
                                //  - was POST /api/razorpay-test/*, a test route
                                //  - the amount was computed here and posted as
                                //    `amount: commission * 100`, so the payer chose
                                //    what they paid. The server now derives it from
                                //    the deal's stored budget and we send none.
                                //  - the Razorpay key was hardcoded in this file; it
                                //    now arrives with the order, so test and live
                                //    cannot drift apart.
                                //  - the deal is no longer marked paid here. Razorpay
                                //    accepting a payment is not the same as it having
                                //    settled; the webhook advances the deal, and we
                                //    refetch rather than assert.
                                const serverDealId = (dealStates as any)[activeDealKey]?.serverDealId;
                                if (!serverDealId) {
                                  setPurchaseToast('This deal has not been published to the server yet.');
                                  setTimeout(() => setPurchaseToast(null), 4000);
                                  return;
                                }
                                setBrandPaymentInProgress(true);
                                try {
                                  const outcome = await runPaymentStage(serverDealId, 'commission', {
                                    description: `Deal commission for ${creatorName}`,
                                    themeColor: C.primary,
                                  });

                                  if (outcome.status === 'dismissed') {
                                    setPurchaseToast('Payment cancelled.');
                                    setTimeout(() => setPurchaseToast(null), 3000);
                                    return;
                                  }
                                  if (outcome.status === 'error') {
                                    setPurchaseToast(outcome.error);
                                    setTimeout(() => setPurchaseToast(null), 5000);
                                    return;
                                  }

                                  // Accepted by Razorpay. The webhook confirms it, so
                                  // this is "confirming", not "paid".
                                  updateDeal(activeDealKey, { pendingPaymentStage: 'commission' });
                                  setShowBrandPaymentModal(false);
                                  setPurchaseToast('Payment submitted. Confirming with the bank...');
                                  setTimeout(() => setPurchaseToast(null), 5000);
                                  await refreshWorkflowStatus(activeDealKey, serverDealId);
                                } catch (error) {
                                  console.error('Payment error:', error);
                                  setPurchaseToast(`Payment failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
                                } finally {
                                  setBrandPaymentInProgress(false);
                                }
                              }}
                              style={{ flex:1, background: brandPaymentInProgress ? C.border : C.primary, border:'none', borderRadius:'8px', padding:'11px', color:'var(--c-surface-lowest)', fontWeight:700, cursor: brandPaymentInProgress ? 'not-allowed' : 'pointer', fontSize:'13px', opacity: brandPaymentInProgress ? 0.6 : 1 }}
                            >
                              {brandPaymentInProgress ? 'Processing...' : `Pay ₹${commission.toLocaleString()}`}
                            </button>
                            <button
                              disabled={brandPaymentInProgress}
                              onClick={() => setShowBrandPaymentModal(false)}
                              style={{ padding:'11px 16px', background:'none', border:`1px solid ${C.border}`, borderRadius:'8px', color:C.text, fontWeight:600, cursor: brandPaymentInProgress ? 'not-allowed' : 'pointer', fontSize:'13px', opacity: brandPaymentInProgress ? 0.6 : 1 }}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      </div>
                      );
                    })()}

                    {/* Cancel Deal Modal */}
                    {showCancelDealModal && (
                      <div style={{ position:'fixed', top:0, left:0, right:0, bottom:0, background:'rgba(0,0,0,0.6)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:9999, padding:'16px' }}>
                        <div style={{ background:C.surface, borderRadius:'14px', padding:'20px', maxWidth:'380px', width:'100%', border:`1px solid ${C.border}` }}>
                          <div style={{ fontSize:'15px', fontWeight:700, color:C.text, marginBottom:'4px' }}>Cancel this deal?</div>
                          <div style={{ fontSize:'12px', color:C.textSecondary, marginBottom:'14px' }}>This action cannot be undone. The brand will be notified.</div>
                          <div style={{ fontSize:'0.75rem', fontWeight:600, color:C.textMuted, marginBottom:'6px' }}>Reason</div>
                          {['Scheduling conflict', 'Terms changed after agreement', 'Found better opportunity', 'Brand unresponsive', 'Personal reasons', 'Other'].map(reason => (
                            <button key={reason} onClick={() => setCancelReason(reason)} style={{ display:'block', width:'100%', textAlign:'left', background: cancelReason === reason ? `${withAlpha(C.primary, 0x12)}` : C.card, border: `1px solid ${cancelReason === reason ? C.primary : C.border}`, borderRadius:'8px', padding:'9px 12px', fontSize:'12px', color:C.text, cursor:'pointer', marginBottom:'4px', fontWeight: cancelReason === reason ? 600 : 400 }}>
                              {reason}
                            </button>
                          ))}
                          <div style={{ display:'flex', gap:'8px', marginTop:'14px' }}>
                            <button onClick={() => { setShowCancelDealModal(false); setCancelReason(''); }} style={{ flex:1, background:'none', border:`1px solid ${C.border}`, borderRadius:'8px', padding:'10px', color:C.text, fontWeight:600, fontSize:'13px', cursor:'pointer' }}>Keep Deal</button>
                            <button onClick={() => { if (activeDealKey) { setDealStates(prev => { const next = {...prev}; delete next[activeDealKey]; return next; }); } setNegotiatingOpp(null); setCreatorDealLifecycle('checklist'); setDealUploadSimulated(false); setDeliverableStatuses({}); setDeliverableLinks({}); setDeliverableLinkInputs({}); setPaymentMilestones({ advance:'pending', upload:'pending', approval:'pending' }); setShowCancelDealModal(false); setCancelReason(''); setPurchaseToast('Deal cancelled'); setTimeout(() => setPurchaseToast(null), 3000); }} disabled={!cancelReason} style={{ flex:1, background: cancelReason ? 'var(--c-error)' : C.border, border:'none', borderRadius:'8px', padding:'10px', color:'var(--c-surface-lowest)', fontWeight:600, fontSize:'13px', cursor: cancelReason ? 'pointer' : 'not-allowed', opacity: cancelReason ? 1 : 0.5 }}>Cancel Deal</button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Feature 2: Creator Profile Modal */}
                    {/* Dispute Modal */}
                    {showDisputeModal !== null && (
                      <div style={{ position:'fixed', top:0, left:0, right:0, bottom:0, background:'rgba(0,0,0,0.6)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:9999, padding:'16px' }}>
                        <div style={{ background:C.surface, borderRadius:'14px', padding:'20px', maxWidth:'400px', width:'100%', border:`1px solid ${C.border}` }}>
                          <div style={{ fontSize:'15px', fontWeight:700, color:C.text, marginBottom:'4px' }}>File a Dispute</div>
                          <div style={{ fontSize:'12px', color:C.textSecondary, marginBottom:'14px' }}>Disputes are reviewed within 48 hours. Provide evidence to support your claim.</div>
                          <div style={{ fontSize:'0.75rem', fontWeight:600, color:C.textMuted, marginBottom:'6px' }}>Reason</div>
                          {['Brand did not pay after approval', 'Brand used content beyond agreed rights', 'Brand violated exclusivity terms', 'Content was used without credit', 'Payment amount was incorrect', 'Other'].map(reason => (
                            <button key={reason} onClick={() => setDisputeReason(reason)} style={{ display:'block', width:'100%', textAlign:'left', background: disputeReason === reason ? `${withAlpha(C.primary, 0x12)}` : C.card, border: `1px solid ${disputeReason === reason ? C.primary : C.border}`, borderRadius:'8px', padding:'9px 12px', fontSize:'12px', color:C.text, cursor:'pointer', marginBottom:'4px', fontWeight: disputeReason === reason ? 600 : 400 }}>
                              {reason}
                            </button>
                          ))}
                          <div style={{ marginTop:'10px' }}>
                            <div style={{ fontSize:'0.75rem', fontWeight:600, color:C.textMuted, marginBottom:'4px' }}>Evidence (describe or paste links)</div>
                            <textarea value={disputeEvidence} onChange={e => setDisputeEvidence(e.target.value)} placeholder="Describe what happened, include screenshots or links..." rows={3} style={{ width:'100%', background:C.card, border:`1px solid ${C.border}`, borderRadius:'6px', padding:'8px', fontSize:'12px', color:C.text, resize:'none', boxSizing:'border-box' }} />
                          </div>
                          <div style={{ display:'flex', gap:'8px', marginTop:'14px' }}>
                            <button onClick={() => { setShowDisputeModal(null); setDisputeReason(''); setDisputeEvidence(''); }} style={{ flex:1, background:'none', border:`1px solid ${C.border}`, borderRadius:'8px', padding:'10px', color:C.text, fontWeight:600, fontSize:'13px', cursor:'pointer' }}>Cancel</button>
                            <button onClick={() => {
                              setCompletedDeals(prev => prev.map(d => d.id === showDisputeModal ? { ...d, disputed: true, disputeReason, disputeStatus: 'filed' as const } : d));
                              setPurchaseToast('Dispute filed, under review');
                              setTimeout(() => setPurchaseToast(null), 3000);
                              setShowDisputeModal(null); setDisputeReason(''); setDisputeEvidence('');
                            }} disabled={!disputeReason} style={{ flex:1, background: disputeReason ? 'var(--c-error)' : C.border, border:'none', borderRadius:'8px', padding:'10px', color:'var(--c-surface-lowest)', fontWeight:600, fontSize:'13px', cursor: disputeReason ? 'pointer' : 'not-allowed', opacity: disputeReason ? 1 : 0.5 }}>File Dispute</button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Tip Modal */}
                    {showTipModal && tipForDealId !== null && (
                      <div style={{ position:'fixed', top:0, left:0, right:0, bottom:0, background:'rgba(0,0,0,0.6)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:9999, padding:'16px' }}>
                        <div style={{ background:C.surface, borderRadius:'14px', padding:'20px', maxWidth:'400px', width:'100%', border:`1px solid ${C.border}` }}>
                          <div style={{ fontSize:'15px', fontWeight:700, color:C.text, marginBottom:'4px' }}>Send a Tip 💰</div>
                          <div style={{ fontSize:'12px', color:C.textSecondary, marginBottom:'14px' }}>Thank this creator for excellent work. Tips go directly to them with zero platform fees.</div>
                          <div style={{ marginBottom:'14px' }}>
                            <div style={{ fontSize:'0.75rem', fontWeight:600, color:C.textMuted, marginBottom:'6px' }}>Tip amount (₹) *</div>
                            <input type="number" value={tipAmount} onChange={e => setTipAmount(e.target.value)} placeholder="Enter amount" min="1" style={{ width:'100%', background:C.card, border:`1px solid ${C.border}`, borderRadius:'8px', padding:'10px 12px', fontSize:'13px', color:C.text, boxSizing:'border-box' }} />
                          </div>
                          <div style={{ marginBottom:'14px', padding:'10px 12px', background:`${withAlpha(C.warning, 0x12)}`, border:`1px solid ${withAlpha(C.warning, 0x30)}`, borderRadius:'8px' }}>
                            <div style={{ fontSize:'0.75rem', color:C.warning, fontWeight:600 }}>Direct payout</div>
                            <div style={{ fontSize:'0.75rem', color:C.textSecondary, marginTop:'2px' }}>${tipAmount ? parseInt(tipAmount).toLocaleString() : '0'}.00 will go straight to the creator. No commission, no fees.</div>
                          </div>
                          <div style={{ display:'flex', gap:'8px' }}>
                            <button onClick={() => { setShowTipModal(false); setTipAmount(''); setTipForDealId(null); }} style={{ flex:1, background:'none', border:`1px solid ${C.border}`, borderRadius:'8px', padding:'10px', color:C.text, fontWeight:600, fontSize:'13px', cursor:'pointer' }}>Cancel</button>
                            <button onClick={() => { if (tipAmount && completedDeals[tipForDealId!]) { const updatedDeals = [...completedDeals]; updatedDeals[tipForDealId!] = { ...updatedDeals[tipForDealId!], tipped: (updatedDeals[tipForDealId!].tipped || 0) + parseInt(tipAmount) }; setCompletedDeals(updatedDeals); setPurchaseToast(`💰 Tip of ₹${parseInt(tipAmount).toLocaleString()} sent to ${completedDeals[tipForDealId!].brand}`); setTimeout(() => setPurchaseToast(null), 3000); setShowTipModal(false); setTipAmount(''); setTipForDealId(null); } }} disabled={!tipAmount || parseInt(tipAmount) < 1} style={{ flex:1, background: (tipAmount && parseInt(tipAmount) >= 1) ? C.warning : C.border, border:'none', borderRadius:'8px', padding:'10px', color:tipAmount && parseInt(tipAmount) >= 1 ? '#000' : C.text, fontWeight:600, fontSize:'13px', cursor: (tipAmount && parseInt(tipAmount) >= 1) ? 'pointer' : 'not-allowed', opacity: (tipAmount && parseInt(tipAmount) >= 1) ? 1 : 0.5 }}>Send Tip</button>
                          </div>
                        </div>
                      </div>
                    )}

                    {showCreatorProfileModal && selectedProfileCreator && (
                      <div style={{ position:'fixed', top:0, left:0, right:0, bottom:0, background:'rgba(0,0,0,0.75)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:9999, padding:'16px' }}>
                        <div style={{ background:C.surface, borderRadius:'16px', padding:'24px', maxWidth:'500px', width:'100%', maxHeight:'90vh', overflowY:'auto', border:`1px solid ${C.border}`, position:'relative' }}>
                          <button onClick={() => { setShowCreatorProfileModal(false); setSelectedProfileCreator(null); }} style={{ position:'absolute', top:'16px', right:'16px', background:'none', border:'none', color:C.textMuted, fontSize:'22px', cursor:'pointer', lineHeight:1 }}>x</button>
                          <div style={{ display:'flex', gap:'12px', alignItems:'flex-start', marginBottom:'16px' }}>
                            <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${selectedProfileCreator.name.replace(/\s/g,'')}`} alt={selectedProfileCreator.name} style={{ width:'60px', height:'60px', borderRadius:'50%', background:C.surfaceAlt }} />
                            <div style={{ flex:1 }}>
                              <div style={{ fontSize:'16px', fontWeight:700, color:C.text, marginBottom:'4px' }}>{selectedProfileCreator.name}</div>
                              <a href={`https://portfolio.valueskins.com/${selectedProfileCreator.handle.replace('@', '')}`} target="_blank" rel="noopener noreferrer" style={{ fontSize:'12px', color:C.primary, textDecoration:'none' }}>{selectedProfileCreator.handle}</a>
                              <div style={{ fontSize:'0.75rem', color:C.textSecondary, marginTop:'4px' }}>4.8★ rating from {(selectedProfileCreator.name.charCodeAt(0) % 15) + 5} deals</div>
                            </div>
                          </div>
                          <div style={{ marginBottom:'16px', padding:'10px 12px', background:C.card, borderRadius:'10px', border:`1px solid ${C.border}` }}>
                            <div style={{ fontSize:'0.75rem', fontWeight:700, color:C.textMuted, textTransform:'uppercase', marginBottom:'8px' }}>Quick Stats</div>
                            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px' }}>
                              <div><div style={{ fontSize:'12px', fontWeight:700, color:C.text }}>{selectedProfileCreator.followers}</div><div style={{ fontSize:'9px', color:C.textMuted }}>Followers</div></div>
                              <div><div style={{ fontSize:'12px', fontWeight:700, color:C.text }}>{selectedProfileCreator.engagement}</div><div style={{ fontSize:'9px', color:C.textMuted }}>Engagement</div></div>
                              <div><div style={{ fontSize:'12px', fontWeight:700, color:C.text }}>{selectedProfileCreator.dealCompletionRate}%</div><div style={{ fontSize:'9px', color:C.textMuted }}>Completion Rate</div></div>
                              <div><div style={{ fontSize:'12px', fontWeight:700, color:C.text }}>${(selectedProfileCreator.minDealUsd / 1000).toFixed(1)}K</div><div style={{ fontSize:'9px', color:C.textMuted }}>Min Deal</div></div>
                            </div>
                          </div>
                          <div style={{ marginBottom:'16px' }}>
                            <div style={{ fontSize:'0.75rem', fontWeight:700, color:C.textMuted, textTransform:'uppercase', marginBottom:'8px' }}>ValueSkin</div>
                            <div style={{ fontSize:'13px', fontWeight:700, color:C.text, background:C.card, padding:'10px 12px', borderRadius:'8px', border:`1px solid ${C.border}` }}>{selectedProfileCreator.valueSkin}</div>
                          </div>
                          {/* Feature 7: Public Profile Link */}
                          <div style={{ marginBottom:'16px' }}>
                            <div style={{ fontSize:'0.75rem', fontWeight:700, color:C.textMuted, textTransform:'uppercase', marginBottom:'8px' }}>Share Profile</div>
                            <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
                              <div style={{ flex:1, fontSize:'12px', color:C.primary, background:C.card, padding:'10px 12px', borderRadius:'8px', border:`1px solid ${C.border}`, fontFamily:'monospace', wordBreak:'break-all' }}>valueskins.com/@{selectedProfileCreator.handle.replace('@','')}</div>
                              <button onClick={() => { navigator.clipboard.writeText(`valueskins.com/@${selectedProfileCreator.handle.replace('@','')}`); setProfileLinkCopied(true); setTimeout(() => setProfileLinkCopied(false), 2000); }} style={{ padding:'10px 12px', background:profileLinkCopied ? C.success : C.primary, border:'none', borderRadius:'8px', color:'var(--c-surface-lowest)', fontWeight:700, fontSize:'12px', cursor:'pointer', transition:'all 0.2s', flexShrink:0 }}>
                                {profileLinkCopied ? 'Copied' : 'Copy'}
                              </button>
                            </div>
                          </div>
                          <div style={{ marginBottom:'16px' }}>
                            <div style={{ fontSize:'0.75rem', fontWeight:700, color:C.textMuted, textTransform:'uppercase', marginBottom:'8px' }}>Audience</div>
                            <div style={{ display:'flex', gap:'6px', flexWrap:'wrap' }}>
                              <span style={{ fontSize:'0.75rem', padding:'4px 8px', background:C.card, borderRadius:'6px', border:`1px solid ${C.border}`, color:C.textSecondary }}>{selectedProfileCreator.audienceAgeRange}</span>
                              <span style={{ fontSize:'0.75rem', padding:'4px 8px', background:C.card, borderRadius:'6px', border:`1px solid ${C.border}`, color:C.textSecondary }}>{selectedProfileCreator.audienceLocation}</span>
                              <span style={{ fontSize:'0.75rem', padding:'4px 8px', background:C.card, borderRadius:'6px', border:`1px solid ${C.border}`, color:C.textSecondary }}>{selectedProfileCreator.audienceLang}</span>
                            </div>
                          </div>
                          <div style={{ marginBottom:'16px' }}>
                            <div style={{ fontSize:'0.75rem', fontWeight:700, color:C.textMuted, textTransform:'uppercase', marginBottom:'8px' }}>Deal Types</div>
                            <div style={{ display:'flex', gap:'6px', flexWrap:'wrap' }}>
                              {selectedProfileCreator.dealTypes.map(dt => (
                                <span key={dt} style={{ fontSize:'0.75rem', fontWeight:600, padding:'4px 8px', background:C.card, borderRadius:'6px', border:`1px solid ${C.border}`, color:C.textSecondary }}>{dt}</span>
                              ))}
                            </div>
                          </div>
                          <div style={{ marginBottom:'16px' }}>
                            <div style={{ fontSize:'0.75rem', fontWeight:700, color:C.textMuted, textTransform:'uppercase', marginBottom:'8px' }}>Portfolio</div>
                            <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
                              {selectedProfileCreator.portfolio.map((p, idx) => (
                                <div key={idx} style={{ fontSize:'0.75rem', color:C.text, padding:'6px 8px', background:C.card, borderRadius:'6px', border:`1px solid ${C.border}` }}>▶ {p}</div>
                              ))}
                            </div>
                          </div>
                          <button onClick={() => { setShowCreatorProfileModal(false); setSelectedProfileCreator(null); }} style={{ width:'100%', background:C.primary, border:'none', borderRadius:'8px', padding:'11px', color:'var(--c-surface-lowest)', fontWeight:700, fontSize:'13px', cursor:'pointer' }}>Close</button>
                        </div>
                      </div>
                    )}

                    {/* Brand Identity — skin selector or redirect to store.
                        The selector only earns its space when there is more
                        than one skin to switch between. With exactly one it
                        rendered a large bordered panel offering no choice, which
                        is the "ACTIVE VALUESKIN" box. The zero-skin prompt still
                        shows, because that one has something to say.
                        Its border was rgba(230,81,0,0.3) — an orange, which §4
                        does not contain. */}
                    {campaigns.length > 0 && (
                      brandValueSkins.length > 1 ? (
                        <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:'12px', padding:'14px 16px', marginBottom:'14px' }}>
                          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'10px' }}>
                            <div style={{ fontSize:'0.75rem', fontWeight:700, color:C.textMuted, textTransform:'uppercase', letterSpacing:'0.6px' }}>Active ValueSkin</div>
                            {brandValueSkins.length < 1 && (
                              <button onClick={() => setActiveView('store')} style={{ background:'none', border:`1px solid ${C.border}`, borderRadius:'6px', padding:'4px 10px', fontSize:'0.75rem', color:C.textSecondary, cursor:'pointer', fontWeight:600 }}>+ Add Skin</button>
                            )}
                          </div>
                          <div style={{ display:'flex', gap:'8px', marginBottom:'10px' }}>
                            {brandValueSkins.map(skin => {
                              const isActive = activeBrandSkin === skin;
                              const badge = BRAND_CATEGORY_BADGES[skin] ?? PROFESSION_BADGES[skin];
                              return (
                                <button
                                  key={skin}
                                  onClick={() => setActiveBrandSkin(skin)}
                                  style={{
                                    flex: 1, padding:'10px 8px', borderRadius:'10px', cursor:'pointer', transition:'all 0.15s',
                                    background: isActive ? `${badge?.color ?? C.primary}15` : C.bg,
                                    border: `2px solid ${isActive ? (badge?.color ?? C.primary) : C.border}`,
                                  }}
                                >
                                  {getStickerForProfession(skin) ? (
                                    <img src={getStickerForProfession(skin)!} alt={skin} style={{ width:'32px', height:'32px', objectFit:'contain', margin:'0 auto 4px' }} />
                                  ) : (
                                    <div style={{ fontSize:'0.75rem', fontWeight:700, letterSpacing:'0.5px', textTransform:'uppercase', color: badge?.color ?? C.primary, marginBottom:'3px' }}>
                                      {badge?.abbreviation ?? skin.slice(0,3).toUpperCase()}
                                    </div>
                                  )}
                                  <div style={{ fontSize:'0.75rem', color: isActive ? C.text : C.textSecondary, fontWeight: isActive ? 600 : 400, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                                    {skin}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ) : brandValueSkins.length === 0 ? (
                        <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:'12px', padding:'14px 16px', marginBottom:'14px' }}>
                          <div style={{ fontSize:'0.75rem', fontWeight:700, color:C.textMuted, textTransform:'uppercase', letterSpacing:'0.6px', marginBottom:'8px' }}>Ready to collaborate?</div>
                          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                            <div style={{ fontSize:'12px', color:C.textMuted }}>Create a campaign and connect with creators</div>
                            <button onClick={() => setActiveView('store')} style={{ background:C.primary, border:'none', borderRadius:'6px', padding:'6px 12px', fontSize:'0.75rem', fontWeight:700, color:C.onPrimary, cursor:'pointer' }}>Create Campaign</button>
                          </div>
                        </div>
                      ) : null
                    )}

                    {/* Active Campaigns — campaigns with status 'open' */}
                    {(() => {
                      const activeCampaigns = liveCampaigns.filter(c => c.status === 'open');
                      return activeCampaigns.length > 0 ? (
                        // app-merged-sample.html — the campaign card is a `.stub`:
                        // 22px padding, 14px radius, a 16px/700 title, and ONE
                        // muted 14px line joining the facts with " · ". The old
                        // card stacked five stacked rows at 10-13px, which read
                        // as a dense form rather than a listing.
                        <div style={{ marginBottom: '20px' }}>
                          {/* .sl — section label with the trailing hairline */}
                          <div style={{ display:'flex', alignItems:'center', gap:'12px', margin:'6px 0 14px' }}>
                            <span style={{ fontSize:'12px', fontWeight:700, letterSpacing:'0.14em', textTransform:'uppercase', color:C.textSecondary }}>
                              Open campaigns
                            </span>
                            <span aria-hidden="true" style={{ flex:1, height:'1px', background:C.border }} />
                          </div>

                          {/* .cards — two up, collapsing to one on narrow */}
                          <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap:'14px' }}>
                          {activeCampaigns.map((c, i) => {
                            const preferenceMatch = campaignMatchesCreatorPreferences(c);
                            // The sample's meta line: category · rate · level · extra.
                            // Built from whatever this campaign actually has, so a
                            // sparse record does not render dangling separators.
                            const meta = [
                              c.brandName,
                              c.budget ? `₹${parseInt(c.budget || '0').toLocaleString()}` : null,
                              c.requiredProfessions?.length ? c.requiredProfessions.join(', ') : null,
                              c.paymentSecured ? 'Payment Secured' : 'Payment Pending',
                              c.deadline || null,
                            ].filter(Boolean).join(' · ');
                            return (
                              <div
                                key={i}
                                onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.accent; }}
                                onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.border; }}
                                style={{
                                  background: C.card, border: `1px solid ${C.border}`,
                                  borderRadius: '14px', padding: '22px',
                                  transition: 'border-color 180ms linear',
                                }}
                              >
                                <h3 style={{ fontSize:'16px', fontWeight:700, color:C.text, margin:0 }}>{c.title}</h3>
                                <p style={{ fontSize:'14px', color:C.textSecondary, margin:'6px 0 0', lineHeight:1.5 }}>{meta}</p>
                                {c.description && (
                                  <p style={{ fontSize:'14px', color:C.textSecondary, margin:'6px 0 0', lineHeight:1.5 }}>{c.description}</p>
                                )}
                                {!preferenceMatch.matches && preferenceMatch.reason && (
                                  <p style={{ fontSize:'13px', color:C.textMuted, margin:'12px 0 0', lineHeight:1.5 }}>
                                    {preferenceMatch.reason}, you can still apply.
                                  </p>
                                )}
                              </div>
                            );
                          })}
                          </div>
                        </div>
                      ) : null;
                    })()}

                    {/* Browse Creators — simple search & filter for brands to find creators */}
                    {brandValueSkins.length > 0 && (
                      <div style={{ marginBottom: '20px' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:'12px', margin:'6px 0 14px' }}>
                          <span style={{ fontSize:'12px', fontWeight:700, letterSpacing:'0.14em', textTransform:'uppercase', color:C.textSecondary }}>
                            Browse Creators
                          </span>
                          <span aria-hidden="true" style={{ flex:1, height:'1px', background:C.border }} />
                        </div>

                        {/* Filters */}
                        <div style={{ display:'flex', gap:'10px', marginBottom:'16px', flexWrap:'wrap' }}>
                          <input
                            type="text"
                            placeholder="Search creator name..."
                            value={creatorSearchQuery}
                            onChange={(e) => setCreatorSearchQuery(e.target.value)}
                            style={{ flex:1, minWidth:'200px', background:C.surfaceAlt, border:`1px solid ${C.border}`, borderRadius:'8px', padding:'10px 12px', fontSize:'13px', color:C.text, boxSizing:'border-box' }}
                          />
                          <select
                            value={creatorFilterProfession || ''}
                            onChange={(e) => setCreatorFilterProfession(e.target.value || null)}
                            style={{ background:C.surfaceAlt, border:`1px solid ${C.border}`, borderRadius:'8px', padding:'10px 12px', fontSize:'13px', color:C.text, cursor:'pointer' }}
                          >
                            <option value="">All professions</option>
                            {Object.keys(PROFESSION_BADGES).map(p => (
                              <option key={p} value={p}>{p}</option>
                            ))}
                          </select>
                        </div>

                        {/* Creator Cards */}
                        <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(280px, 1fr))', gap:'14px' }}>
                          {backendCreators
                            .filter(c => {
                              if (creatorSearchQuery && !c.name.toLowerCase().includes(creatorSearchQuery.toLowerCase())) return false;
                              if (creatorFilterProfession && c.valueSkin !== creatorFilterProfession) return false;
                              return true;
                            })
                            .map((c, i) => (
                              <div key={i} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:'12px', padding:'16px', cursor:'pointer', transition:'border-color 180ms' }}
                                onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.accent; }}
                                onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.border; }}
                              >
                                <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'12px' }}>
                                  <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${c.name.replace(/\s/g,'')}`} alt={c.name} style={{ width:'40px', height:'40px', borderRadius:'50%' }} />
                                  <div style={{ flex:1, minWidth:0 }}>
                                    <div style={{ fontSize:'13px', fontWeight:700, color:C.text }}>{c.name}</div>
                                    <div style={{ fontSize:'0.75rem', color:C.textSecondary }}>{c.valueSkin}</div>
                                  </div>
                                </div>
                                <div style={{ fontSize:'12px', color:C.textSecondary, marginBottom:'12px', lineHeight:1.4 }}>
                                  {c.followers} followers · {c.engagement}% engagement
                                </div>
                                {/* ── [v1 COMMENTED OUT] "View Profile & Invite" opened the negotiation modal, which is disabled in v1. See Things-Commented-Out.md. */}
                                <button
                                  onClick={() => {
                                    setPurchaseToast('Creator invitations arrive in a later release, post your campaign and creators will apply.');
                                    setTimeout(() => setPurchaseToast(null), 3200);
                                  }}
                                  style={{ width:'100%', background:C.primary, border:'none', borderRadius:'6px', padding:'8px', fontSize:'12px', fontWeight:700, color:'var(--c-surface-lowest)', cursor:'pointer' }}
                                >
                                  View Profile
                                </button>
                              </div>
                            ))}
                        </div>

                        {backendCreators.filter(c => {
                          if (creatorSearchQuery && !c.name.toLowerCase().includes(creatorSearchQuery.toLowerCase())) return false;
                          if (creatorFilterProfession && c.valueSkin !== creatorFilterProfession) return false;
                          return true;
                        }).length === 0 && (
                          <div style={{ textAlign:'center', padding:'40px 20px', color:C.textSecondary }}>
                            <div style={{ fontSize:'14px', marginBottom:'8px' }}>Create a campaign first to see the list of creators available</div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Applicants & Offers — creator applications/offers received for this brand's campaigns */}
                    {(() => {
                      const applicantDeals: any[] = Object.entries(dealStates)
                        .filter(([k, d]) => {
                          if (!d || !d.phase || d.phase === 'brief') return false;
                          return d.creatorMarketplaceIndex !== undefined || !!d.creatorName || !!d.creatorSkin;
                        })
                        .map(([key, d]) => ({ key, ...d }))
                        .filter((d: any, i: number, arr: any[]) => {
                          const uid = `${d.creatorName || d.key.split('|')[0]}|${d.creatorSkin || d.key.split('|')[1]}|${d.opportunityIndex ?? d.key.split('|')[2]}`;
                          const prevUid = (x: any) => `${x.creatorName || x.key.split('|')[0]}|${x.creatorSkin || x.key.split('|')[1]}|${x.opportunityIndex ?? x.key.split('|')[2]}`;
                          return arr.findIndex((x: any) => prevUid(x) === uid) === i;
                        });
                      if (applicantDeals.length === 0) return null;
                      const statusOf = (d: any) => {
                        if (d.phase === 'accepted') return { label: 'Accepted', color: C.success };
                        if (d.phase === 'rejected') return { label: 'Rejected', color: 'var(--c-error)' };
                        if (d.phase === 'formal_offer') return { label: 'Final offer, awaiting your approval', color: C.primary };
                        if (d.phase === 'pending') return { label: 'Awaiting your decision', color: 'var(--c-warning)' };
                        if (d.phase === 'checklist' || d.phase === 'softhold') return { label: 'In progress', color: C.success };
                        return { label: 'Applied', color: C.textSecondary };
                      };
                      const pushStatusMessage = (key: string, text: string) => {
                        const now = new Date();
                        updateDeal(key, {
                          chatMessages: [...((dealStates as any)[key]?.chatMessages || []), {
                            id: Date.now(),
                            sender: 'brand' as const,
                            text,
                            time: now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: false }),
                            isoTime: now.toISOString(),
                            seen: false,
                          }],
                        });
                      };
                      return (
                        <div style={{ background:C.card, borderRadius:'12px', padding:'14px', marginBottom:'14px', border:`1px solid ${C.border}` }}>
                          <div style={{ fontSize:'0.75rem', fontWeight:700, color:C.textMuted, textTransform:'uppercase', letterSpacing:'0.6px', marginBottom:'4px' }}>
                            Applicants ({applicantDeals.length})
                          </div>
                          <div style={{ fontSize:'0.75rem', color:C.textSecondary, marginBottom:'10px' }}>Any applicants will be notified.</div>
                          {applicantDeals.map((d: any, i: number) => {
                            const creatorName = d.creatorName || d.key.split('|')[0];
                            const creatorSkin = d.creatorSkin || d.key.split('|')[1];
                            const offer = d.counterAmount || d.offerAmount || '-';
                            const st = statusOf(d);
                            const actionable = d.phase === 'formal_offer' || d.phase === 'pending';
                            const paymentPending = d.phase === 'formal_offer' && d.brandApprovalPhase !== 'accepted';
                            return (
                              <div key={d.key} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:'8px', padding:'10px 0', borderTop:i>0?`1px solid ${C.border}`:'none' }}>
                                <div style={{ flex:1, minWidth:0 }}>
                                  <div
                                    onMouseEnter={(e) => showHoverCard(buildCreatorHover(creatorName, creatorSkin), e)}
                                    onMouseMove={updateHoverPosition}
                                    onMouseLeave={hideHoverCard}
                                    style={{ fontSize:'13px', fontWeight:600, color:C.text, cursor:'pointer' }}
                                  >{creatorName}</div>
                                  <div style={{ fontSize:'0.75rem', color:C.textSecondary, marginTop:'2px' }}>{creatorSkin}</div>
                                  <div style={{ fontSize:'0.75rem', color:C.text, marginTop:'4px' }}>Offer: <strong>${parseInt(String(offer).replace(/[^0-9]/g, '')) ? parseInt(String(offer).replace(/[^0-9]/g, '')).toLocaleString() : offer}</strong></div>
                                </div>
                                <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:'6px' }}>
                                  <span style={{ fontSize:'0.75rem', fontWeight:600, color:st.color, background:`${withAlpha(st.color, 0x12)}`, padding:'2px 8px', borderRadius:'10px', border:`1px solid ${withAlpha(st.color, 0x30)}` }}>{st.label}</span>
                                  {actionable && (
                                    <div style={{ display:'flex', flexDirection:'column', gap:'6px', alignItems:'flex-end' }}>
                                      {/* ── [v1 COMMENTED OUT] "View Negotiation" — negotiation removed. See Things-Commented-Out.md. */}
                                      {false && (
                                      <button
                                        onClick={() => {
                                          const creator = backendCreators.find((c: any) => c.name === creatorName && c.valueSkin === creatorSkin);
                                          if (creator) {
                                            setNegotiatingCreator(creator._origIdx);
                                            setBrandCurrentOppIndex(parseInt(d.key.split('|')[2]));
                                          }
                                        }}
                                        style={{ background:'none', border:`1px solid ${C.border}`, borderRadius:'6px', padding:'5px 10px', fontSize:'0.75rem', fontWeight:600, color:C.primary, cursor:'pointer', whiteSpace:'nowrap' }}
                                      >View Negotiation</button>
                                      )}
                                      <div style={{ display:'flex', gap:'6px' }}>
                                        <button
                                          onClick={() => {
                                            updateDeal(d.key, { phase: 'formal_offer', brandApprovalPhase: 'reviewing' });
                                            setShowBrandPaymentModal(true);
                                            setPurchaseToast(`Processing payment for ${creatorName}`);
                                          }}
                                          style={{ background:C.success, border:'none', borderRadius:'6px', padding:'5px 10px', fontSize:'0.75rem', fontWeight:700, color:'var(--c-surface-lowest)', cursor:'pointer' }}
                                        >Accept & Pay</button>
                                        <button
                                          disabled={paymentPending}
                                          onClick={() => {
                                            updateDeal(d.key, { phase: 'rejected' });
                                            pushStatusMessage(d.key, 'Brand declined the offer.');
                                            setPurchaseToast(`${creatorName} has been notified of your decision`);
                                            setTimeout(() => setPurchaseToast(null), 3000);
                                          }}
                                          style={{ background:paymentPending ? 'rgba(176, 65, 62,0.15)' : 'none', border:`1px solid rgba(176, 65, 62,${paymentPending ? '0.15' : '0.3'})`, borderRadius:'6px', padding:'5px 10px', fontSize:'0.75rem', fontWeight:700, color:paymentPending ? 'rgba(176, 65, 62,0.5)' : 'var(--c-error)', cursor:paymentPending ? 'not-allowed' : 'pointer', opacity:paymentPending ? 0.6 : 1 }}
                                        >{paymentPending ? 'Complete payment first' : 'Reject'}</button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}

                    {/* Brand Past Deals — computed from dealStates */}
                    {(() => {
                      const brandPastDeals = Object.entries(dealStates)
                        .filter(([k, d]) => d.brandApprovalPhase === 'approved' || d.creatorDealLifecycle === 'approved')
                        .map(([key, d]) => ({ key, creatorName: key.split('|')[0], creatorSkin: key.split('|')[1], ...d }));
                      if (brandPastDeals.length === 0) return null;
                      return (
                        <div ref={brandPastRef} style={{ background:C.card, borderRadius:'12px', padding:'14px', marginBottom:'14px', border:`1px solid ${C.border}` }}>
                          <div style={{ fontSize:'0.75rem', fontWeight:700, color:C.textMuted, textTransform:'uppercase', letterSpacing:'0.6px', marginBottom:'10px' }}>
                            Past Deals ({brandPastDeals.length})
                          </div>
                          {brandPastDeals.map((d, i) => (
                            <div key={i} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 0', borderTop:i>0?`1px solid ${C.border}`:'none' }}>
                              <div style={{ flex:1 }}>
                                <div
                                  onMouseEnter={(e) => showHoverCard(buildCreatorHover(d.creatorName, d.creatorSkin), e)}
                                  onMouseMove={updateHoverPosition}
                                  onMouseLeave={hideHoverCard}
                                  style={{ fontSize:'13px', fontWeight:600, color:C.text, cursor:'pointer' }}>{d.creatorName}</div>
                                <div style={{ fontSize:'0.75rem', color:C.textSecondary }}>{d.creatorSkin} · Completed</div>
                              </div>
                              <button onClick={() => downloadDealReport(d.key)} style={{ background:C.primary, border:'none', borderRadius:'6px', padding:'5px 10px', fontSize:'0.75rem', fontWeight:600, color:'var(--c-surface-lowest)', cursor:'pointer' }}>Download the final report</button>
                            </div>
                          ))}
                        </div>
                      );
                    })()}

                    {/* Past Campaigns — expired campaigns */}
                    {(() => {
                      const expiredCampaigns = liveCampaigns.filter(c => c.status === 'expired');
                      return expiredCampaigns.length > 0 ? (
                        <div style={{ marginTop:'24px', paddingTop:'20px', borderTop:`1px solid ${C.border}` }}>
                          <button
                            onClick={() => setCampaignsSectionOpen(v => !v)}
                            style={{ width:'100%', display:'flex', justifyContent:'space-between', alignItems:'center', background:'none', border:'none', padding:'0 0 14px', cursor:'pointer' }}
                          >
                            <span style={{ fontSize:'12px', fontWeight:700, color:C.text, textTransform:'uppercase', letterSpacing:'0.5px', display:'flex', alignItems:'center', gap:'6px' }}>
                              Past Campaigns
                              {expiredCampaigns.length > 0 && <span style={{ fontSize:'0.75rem', background:C.textMuted, color:'var(--c-surface-lowest)', padding:'1px 5px', borderRadius:'8px' }}>{expiredCampaigns.length}</span>}
                            </span>
                          </button>
                          {/* Same .stub treatment as the open campaigns above —
                              app-merged-sample.html. This block was still the
                              old dense card: eight stacked rows at 10-13px with
                              profession pills, level, deliverables and two
                              badges. It also printed the budget with a dollar
                              sign while the open campaigns above used rupees;
                              F1 says INR for V1, so both are rupees now. */}
                          <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap:'14px', marginTop:'10px' }}>
                            {expiredCampaigns.map((c,i) => {
                              const meta = [
                                c.brandName,
                                c.budget ? `₹${parseInt(c.budget || '0').toLocaleString()}` : null,
                                c.requiredProfessions?.length ? c.requiredProfessions.join(', ') : null,
                                `Level L${c.minLevel || 1}${(c.maxLevel && c.maxLevel !== c.minLevel) ? `–L${c.maxLevel}` : ''}`,
                                c.creatorCount ? `Hired ${c.creatorCount}` : null,
                                c.deadline ? `Expired ${c.deadline}` : null,
                              ].filter(Boolean).join(' · ');
                              return (
                                <div key={i} style={{
                                  background: C.card, border: `1px solid ${C.border}`,
                                  borderRadius: '14px', padding: '22px', opacity: 0.72,
                                }}>
                                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', gap:'12px' }}>
                                    <h3 style={{ fontSize:'16px', fontWeight:700, color:C.text, margin:0 }}>{c.title}</h3>
                                    <span style={{ fontSize:'0.75rem', fontWeight:600, letterSpacing:'0.08em', textTransform:'uppercase', color:C.textMuted, flex:'none' }}>Expired</span>
                                  </div>
                                  <p style={{ fontSize:'14px', color:C.textSecondary, margin:'6px 0 0', lineHeight:1.5 }}>{meta}</p>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : null;
                    })()}

                  </div>
                </>
              )}

              {/* Campaign composer overlay — shared by Creator and Brand flows */}
              {showCampaignCreator && (
                <div style={{ position:'fixed', top:0, left:0, right:0, bottom:0, zIndex:9999, background:C.bg, overflowY:'auto' }}>
                  <CampaignComposer
                    brandName={profileName}
                    professions={Object.keys(PROFESSION_BADGES)}
                    currencySymbol={INR_CURRENCY.symbol}
                    onBack={() => setShowCampaignCreator(false)}
                    onLaunch={(draft) => {
                      if (draft.brandName.trim()) setProfileName(draft.brandName.trim());
                      const budget = parseInt(draft.budget || '0', 10) || 0;
                      const escrowPool = budget * draft.creatorCount;
                      const newC: Campaign = {
                        id: Date.now(),
                        brandName: draft.brandName || profileName,
                        brandProfession: draft.profession,
                        title: draft.title,
                        description: draft.description,
                        requiredProfessions: [],
                        minLevel: draft.minLevel,
                        maxLevel: draft.maxLevel,
                        budget: draft.budget,
                        deadline: draft.deadline,
                        deliveryDeadline: draft.deliveryDeadline,
                        location: '',
                        locations: draft.locations,
                        country: draft.country,
                        nonNegotiables: [],
                        deliverables: draft.deliverables,
                        compensationType: draft.compensation,
                        exclusivity: draft.exclusivity,
                        usageRights: draft.usageRights,
                        scriptMode: draft.scriptMode,
                        scriptText: draft.scriptText,
                        scriptFileName: draft.scriptFileName,
                        shootLocation: draft.shootLocation,
                        expectations: draft.expectations,
                        otherNotes: draft.otherNotes,
                        contentReview: draft.contentReview,
                        status: 'open',
                        applicants: 0,
                        creatorCount: draft.creatorCount,
                        paymentSecured: false,
                        escrowPool,
                        escrowAllocated: 0,
                        hasDigitalRights: draft.hasDigitalRights,
                        digitalRightsAmount: draft.digitalRightsAmount,
                        digitalRightsDays: draft.digitalRightsDays,
                        digitalRightsReels: draft.digitalRightsReels,
                        digitalRightsStories: draft.digitalRightsStories,
                        poc: draft.pocName.trim() ? {
                          name: draft.pocName.trim(),
                          workEmail: draft.pocEmail.trim(),
                          role: draft.pocRole.trim(),
                          phone: draft.pocPhone.trim() || undefined,
                        } : undefined,
                      };
                      const updated = [...campaigns, newC];
                      persistCampaigns(updated);
                      setCampaigns(updated);
                      localStorage.setItem('valueskins_campaigns', JSON.stringify(updated));
                      sharedCreateCampaign(newC);
                      // Also save to PostgreSQL so it is visible across devices
                      const demoUuid = localStorage.getItem('vs_demo_user_id') || (() => {
                        const u = crypto.randomUUID?.() || 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16); });
                        localStorage.setItem('vs_demo_user_id', u);
                        return u;
                      })();
                      fetch('/api/campaigns/list', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          user_id: demoUuid,
                          title: newC.title,
                          description: newC.description,
                          budget_per_creator: budget,
                          total_budget: escrowPool,
                          deadline: newC.deadline || null,
                          delivery_type: 'no_delivery',
                          usage_rights_days: 365,
                          required_niches: [],
                        }),
                      }).catch(() => {});
                      setShowCampaignCreator(false);
                      setLastCreatedCampaignId(newC.id);
                      setPendingCampaignForEscrow(newC);
                      setShowEscrowFundingModal(true);
                      setEscrowFundingInProgress2(false);
                    }}
                  />
                </div>
              )}

              {/* Escrow Funding Modal — shown after campaign publish, before batch send */}
              {showEscrowFundingModal && pendingCampaignForEscrow && (
                <div style={{ position:'fixed', top:0, left:0, right:0, bottom:0, background:'rgba(0,0,0,0.85)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:10000 }}>
                  <div style={{ background:C.surface, borderRadius:'16px', padding:'28px', maxWidth:'440px', width:'95vw', border:`1px solid ${C.border}` }}>
                    <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'6px' }}>
                      <div style={{ width:36, height:36, borderRadius:'50%', background:C.surfaceAlt, display:'flex', alignItems:'center', justifyContent:'center' }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.primary} strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                      </div>
                      <div style={{ fontSize:'16px', fontWeight:700, color:C.text }}>Fund Escrow</div>
                    </div>
                    <div style={{ fontSize:'12px', color:C.textSecondary, marginBottom:'20px', lineHeight:1.5 }}>
                      Deposit funds upfront to cover all creators in this campaign. Funds are held securely and released per each creator's agreed payment milestones. Unused funds are returned if fewer creators are hired.
                      <div style={{ marginTop:'8px', fontSize:'0.75rem', color:C.success, fontWeight:600 }}>Any applicants will be notified.</div>
                    </div>

                    {/* Campaign summary */}
                    <div style={{ background:C.bg, border:`1px solid ${C.border}`, borderRadius:'10px', padding:'14px', marginBottom:'14px' }}>
                      <div style={{ fontSize:'12px', fontWeight:700, color:C.text, marginBottom:'10px' }}>{pendingCampaignForEscrow.title}</div>
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px' }}>
                        {(() => { const c = INR_CURRENCY; return (<>
                        {[
                          { label:'Per creator', value:`${c.symbol}${parseInt(pendingCampaignForEscrow.budget||'0').toLocaleString()}` },
                          { label:'Creators hiring', value:`${pendingCampaignForEscrow.creatorCount || 1}` },
                        ].map(row => (
                          <div key={row.label} style={{ background:C.surfaceAlt, borderRadius:'6px', padding:'8px 10px' }}>
                            <div style={{ fontSize:'0.75rem', color:C.textMuted, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.4px', marginBottom:'3px' }}>{row.label}</div>
                            <div style={{ fontSize:'14px', fontWeight:700, color:C.text }}>{row.value}</div>
                          </div>
                        ))}
                        </>)})()}
                      </div>
                      {(() => { const c = INR_CURRENCY; return (
                      <div style={{ marginTop:'10px', padding:'10px', background:'rgba(200, 184, 154,0.06)', border:'1px solid rgba(200, 184, 154,0.2)', borderRadius:'8px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                        <span style={{ fontSize:'12px', color:C.textSecondary, fontWeight:600 }}>Total escrow deposit</span>
                        <span style={{ fontSize:'20px', fontWeight:800, color:C.success }}>{c.symbol}{(pendingCampaignForEscrow.escrowPool||0).toLocaleString()}</span>
                      </div>
                      )})()}
                    </div>

                    {/* Payment milestone breakdown */}
                    <div style={{ background:C.bg, border:`1px solid ${C.border}`, borderRadius:'8px', padding:'12px', marginBottom:'16px' }}>
                      <div style={{ fontSize:'0.75rem', fontWeight:700, color:C.textMuted, textTransform:'uppercase', letterSpacing:'0.4px', marginBottom:'8px' }}>How funds are released per creator</div>
                      {[
                        { label:'Advance (on deal acceptance)', pct:advancePercent },
                        { label:'On brand approval', pct:approvalPercent },
                      ].map(m => (
                        <div key={m.label} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'5px 0', borderBottom:`1px solid ${C.border}` }}>
                          <span style={{ fontSize:'0.75rem', color:C.textSecondary }}>{m.label}</span>
                          <span style={{ fontSize:'0.75rem', fontWeight:700, color:C.text }}>{m.pct}%</span>
                        </div>
                      ))}
                    </div>

                    {/* Escrow progress bar */}
                    {paymentHoldInProgress && (
                      <div style={{ marginBottom:'14px' }}>
                        <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.75rem', color:C.textMuted, marginBottom:'6px' }}>
                          <span>Processing deposit...</span>
                          <span style={{ color:'var(--c-warning)', fontWeight:600 }}>Verifying</span>
                        </div>
                        <div style={{ width:'100%', height:'6px', background:C.card, borderRadius:'3px', overflow:'hidden' }}>
                          <div style={{ width:'70%', height:'100%', background:'var(--c-warning)', borderRadius:'3px', transition:'width 1.5s ease' }} />
                        </div>
                      </div>
                    )}

                    <button
                      disabled={paymentHoldInProgress}
                      onClick={() => {
                        setEscrowFundingInProgress2(true);
                        setTimeout(() => {
                          persistCampaigns(campaigns.map(c => c.id === pendingCampaignForEscrow.id ? { ...c, paymentSecured: true } : c));
                          recordFakeBankTransaction({
                            type: 'escrow',
                            description: `Campaign escrow deposit: ${pendingCampaignForEscrow.title}`,
                            amount: (pendingCampaignForEscrow.escrowPool || 0) * 100,
                            reference: `escrow_${pendingCampaignForEscrow.id}_${Date.now()}`,
                          });

                          setEscrowFundingInProgress2(false);
                          setShowEscrowFundingModal(false);
                          setCampaignsSectionOpen(true);
                          setPurchaseToast(`Payment secured, ₹${(pendingCampaignForEscrow.escrowPool||0).toLocaleString()} secured. Browse creators to invite.`);
                          setTimeout(() => setPurchaseToast(null), 4000);
                        }, 2000);
                      }}
                      style={{ width:'100%', background: paymentHoldInProgress ? C.border : C.primary, border:'none', borderRadius:'10px', padding:'13px', color:'var(--c-surface-lowest)', fontWeight:700, fontSize:'14px', cursor: paymentHoldInProgress ? 'not-allowed' : 'pointer', opacity: paymentHoldInProgress ? 0.6 : 1, marginBottom:'8px' }}
                    >
                      {paymentHoldInProgress ? 'Finding matching creators...' : `Deposit ₹${(pendingCampaignForEscrow.escrowPool||0).toLocaleString()} as Secure Payment`}
                    </button>
                    <div style={{ fontSize:'0.75rem', color:C.textMuted, textAlign:'center', lineHeight:1.5 }}>
                      Funds are non-transferable until released per milestone. Unused funds return within 5 business days.
                    </div>
                  </div>
                </div>
              )}

            </>
          )}

          {/* ── [v1 COMMENTED OUT] MESSAGES VIEW — DMs + Communities chat. Chatbox removed in v1. See Things-Commented-Out.md. */}
          {false && activeView === 'messages' && <MessagesView valueSkins={valueSkins} profileName={profileName} hasValueSkin={hasValueSkin} />}
          {activeView === 'admin' && (
            <>
              <div style={{ height: '60px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', paddingLeft: '20px', fontWeight: 'bold', fontSize: '16px', background: C.surface }}>
                Admin Panel
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: C.primary, background: `rgba(0,102,204,0.1)`, padding: '3px 8px', borderRadius: '6px', marginLeft: '10px' }}>Meta</span>
              </div>
              <div style={{ padding: '20px' }}>
                <div style={{ marginBottom: '24px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: C.textMuted, letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: '12px' }}>
                    Insights Tab, Visible Metrics
                  </div>
                  <p style={{ fontSize: '13px', color: C.textSecondary, marginBottom: '16px', lineHeight: 1.5 }}>
                    Configure which metrics appear in the public Insights tab on creator profiles. Toggle metrics on or off to customize the experience.
                  </p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {([
                      { key: 'score', label: 'Reputation Score', description: 'Overall verified score out of 1000 with progress bar' },
                      { key: 'engagement', label: 'Engagement Rate', description: 'Audience engagement percentage metric' },
                      { key: 'onTime', label: 'On-Time Delivery', description: 'Reliability metric for brand partnerships' },
                      { key: 'deals', label: 'Deals Completed', description: 'Total number of completed brand deals' },
                      { key: 'rating', label: 'Brand Rating', description: 'Average rating from brand partnerships' },
                      { key: 'trustLevel', label: 'Trust Level', description: 'Visual trust level indicator (1-5)' },
                      { key: 'breakdown', label: 'Score Breakdown', description: 'Detailed factor-by-factor score analysis' },
                    ] as const).map(({ key, label, description }) => (
                      <div
                        key={key}
                        onClick={() => setVisibleInsights(prev => ({ ...prev, [key]: !prev[key] }))}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '14px 16px', background: C.card, borderRadius: '10px',
                          border: `1px solid ${visibleInsights[key] ? C.primary : C.border}`,
                          cursor: 'pointer', transition: 'all 0.15s',
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '14px', fontWeight: 600, color: C.text, marginBottom: '2px' }}>{label}</div>
                          <div style={{ fontSize: '0.75rem', color: C.textMuted }}>{description}</div>
                        </div>
                        <div style={{
                          width: '44px', height: '24px', borderRadius: '12px',
                          background: visibleInsights[key] ? C.primary : C.border,
                          position: 'relative', transition: 'background 0.2s', flexShrink: 0, marginLeft: '12px',
                        }}>
                          <div style={{
                            width: '20px', height: '20px', borderRadius: '50%', background: 'var(--c-surface-lowest)',
                            position: 'absolute', top: '2px',
                            left: visibleInsights[key] ? '22px' : '2px',
                            transition: 'left 0.2s',
                          }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ padding: '14px', background: 'rgba(0,102,204,0.06)', borderRadius: '10px', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.75rem', color: C.textSecondary, lineHeight: 1.5 }}>
                    Changes are applied instantly to the Insights tab on all creator profiles. Visit Profile → Insights tab to preview.
                  </div>
                </div>

                {/* ValueSkin Pricing Control */}
                <div style={{ marginTop: '24px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: C.textMuted, letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: '12px' }}>
                    ValueSkin Pricing
                  </div>
                  <p style={{ fontSize: '13px', color: C.textSecondary, marginBottom: '16px', lineHeight: 1.5 }}>
                    Set the credit cost per tier. All professions use global defaults unless overridden.
                  </p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {[
                      { tier: 'community', label: 'Community tier', desc: 'Join communities only' },
                      { tier: 'marketplace', label: 'Marketplace tier', desc: 'Communities + brand deals' },
                    ].map(({ tier, label, desc }) => (
                      <div
                        key={tier}
                        style={{
                          padding: '14px 16px', background: C.card, borderRadius: '10px',
                          border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: '12px',
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '14px', fontWeight: 600, color: C.text, marginBottom: '2px' }}>{label}</div>
                          <div style={{ fontSize: '0.75rem', color: C.textMuted }}>{desc}</div>
                        </div>
                        <input
                          type="number"
                          min="0"
                          value={tier === 'community' ? communityTierCredits : marketplaceTierCredits}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || 0;
                            if (tier === 'community') setCommunityTierCredits(val);
                            else setMarketplaceTierCredits(val);
                          }}
                          style={{
                            width: '60px', padding: '8px', borderRadius: '6px',
                            border: `1px solid ${C.border}`, background: C.surface, color: C.text,
                            textAlign: 'center', fontSize: '13px', fontWeight: 600,
                          }}
                        />
                        <span style={{ fontSize: '12px', color: C.textSecondary, minWidth: '80px' }}>
                          ${(tier === 'community' ? communityTierCredits : marketplaceTierCredits) * 8}.00 INR
                        </span>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={() => {
                      setPurchaseToast('Pricing updated');
                      setTimeout(() => setPurchaseToast(null), 3000);
                    }}
                    style={{
                      width: '100%', marginTop: '16px', padding: '12px 16px', borderRadius: '6px',
                      border: 'none', background: C.primary, color: C.onPrimary, fontSize: '13px', fontWeight: 600,
                      cursor: 'pointer', transition: 'all 0.15s',
                    }}
                  >
                    Save Pricing
                  </button>
                </div>

                {/* Platform Commission Control */}
                <div style={{ marginTop: '24px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: C.textMuted, letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: '12px' }}>
                    Deal Commission
                  </div>
                  <p style={{ fontSize: '13px', color: C.textSecondary, marginBottom: '16px', lineHeight: 1.5 }}>
                    Set the platform commission percentage charged on every completed deal.
                  </p>
                  {/* Commission Payer Toggle */}
                  <div style={{ marginBottom: '16px', padding: '12px 14px', background: C.card, borderRadius: '10px', border: `1px solid ${C.border}` }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', marginBottom: '10px' }}>
                      Commission Paid By
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => setCommissionPaidBy('brand')}
                        style={{
                          flex: 1,
                          padding: '10px 12px',
                          borderRadius: '6px',
                          border: 'none',
                          background: commissionPaidBy === 'brand' ? C.primary : C.surface,
                          color: commissionPaidBy === 'brand' ? 'var(--c-surface-lowest)' : C.textSecondary,
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                        }}
                      >
                        Brand (Creator keeps full amount)
                      </button>
                      <button
                        onClick={() => setCommissionPaidBy('creator')}
                        style={{
                          flex: 1,
                          padding: '10px 12px',
                          borderRadius: '6px',
                          border: 'none',
                          background: commissionPaidBy === 'creator' ? C.primary : C.surface,
                          color: commissionPaidBy === 'creator' ? 'var(--c-surface-lowest)' : C.textSecondary,
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                        }}
                      >
                        Creator (Deducted from payout)
                      </button>
                    </div>
                  </div>
                  <div style={{ padding: '14px 16px', background: C.card, borderRadius: '10px', border: `1px solid ${C.border}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: 600, color: C.text }}>Commission rate</div>
                        <div style={{ fontSize: '0.75rem', color: C.textMuted }}>Applied to all deal types (paid, c2c_paid)</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <input
                          type="number"
                          min="0"
                          max="50"
                          value={platformCommissionPct}
                          onChange={(e) => setPlatformCommissionPct(Math.max(0, Math.min(50, parseInt(e.target.value) || 0)))}
                          style={{ width: '56px', padding: '8px', borderRadius: '6px', border: `1px solid ${C.border}`, background: C.surface, color: C.text, textAlign: 'center', fontSize: '15px', fontWeight: 700 }}
                        />
                        <span style={{ fontSize: '14px', fontWeight: 700, color: C.text }}>%</span>
                      </div>
                    </div>
                    {/* Commission slider */}
                    <input
                      type="range"
                      min="0"
                      max="50"
                      value={platformCommissionPct}
                      onChange={(e) => setPlatformCommissionPct(parseInt(e.target.value))}
                      style={{ width: '100%', cursor: 'pointer' }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: C.textMuted, marginTop: '4px' }}>
                      <span>0%</span>
                      <span>25%</span>
                      <span>50%</span>
                    </div>
                    {/* Example calculation */}
                    <div style={{ marginTop: '12px', padding: '10px', background: C.bg, borderRadius: '6px', border: `1px solid ${C.border}` }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', marginBottom: '8px' }}>Example: ₹10,000 deal @ {platformCommissionPct}%</div>
                      {commissionPaidBy === 'brand' ? (
                        <>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '3px' }}>
                            <span style={{ color: C.textSecondary }}>Creator receives</span>
                            <span style={{ color: C.success, fontWeight: 700 }}>₹10,000</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                            <span style={{ color: C.textSecondary }}>Brand pays (total)</span>
                            <span style={{ color: C.primary, fontWeight: 700 }}>${(10000 + 10000 * platformCommissionPct / 100).toLocaleString()}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginTop: '3px', paddingTop: '3px', borderTop: `1px solid ${C.border}`, color: C.textMuted }}>
                            <span>ValueSkins revenue</span>
                            <span>${(10000 * platformCommissionPct / 100).toLocaleString()}</span>
                          </div>
                        </>
                      ) : (
                        <>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '3px' }}>
                            <span style={{ color: C.textSecondary }}>Creator receives</span>
                            <span style={{ color: C.success, fontWeight: 700 }}>${(10000 - 10000 * platformCommissionPct / 100).toLocaleString()}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                            <span style={{ color: C.textSecondary }}>Brand pays (total)</span>
                            <span style={{ color: C.primary, fontWeight: 700 }}>₹10,000</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginTop: '3px', paddingTop: '3px', borderTop: `1px solid ${C.border}`, color: C.textMuted }}>
                            <span>ValueSkins revenue</span>
                            <span>${(10000 * platformCommissionPct / 100).toLocaleString()}</span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setPurchaseToast(`Commission set to ${platformCommissionPct}%`);
                      setTimeout(() => setPurchaseToast(null), 3000);
                    }}
                    style={{ width: '100%', marginTop: '12px', padding: '12px 16px', borderRadius: '6px', border: 'none', background: C.primary, color: C.onPrimary, fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
                  >
                    Save Commission Rate
                  </button>
                </div>

                {/* Fraud Detection Dashboard */}
                <div style={{
                  borderRadius: '12px',
                  border: `1px solid ${C.borderLight}`,
                  padding: '16px',
                  marginTop: '20px',
                  backgroundColor: C.bg,
                }}>
                  <h3 style={{ marginTop: 0, marginBottom: '12px', color: C.text }}>Fraud Detection Dashboard</h3>

                  {[
                    { id: 1, type: 'self_dealing', creator: '@alex_codes', severity: 'medium', time: '2 days ago' },
                    { id: 2, type: 'velocity_spike', creator: '@ml_marcus', severity: 'high', time: '5 hours ago' },
                    { id: 3, type: 'rating_collusion', creator: '@priya_builds', severity: 'low', time: '1 week ago' },
                  ].filter(s => !resolvedFraudSignals.includes(s.id)).map((signal) => (
                    <div key={signal.id} style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '12px',
                      backgroundColor: 'rgba(176, 65, 62,0.06)',
                      borderRadius: '8px',
                      marginBottom: '8px',
                      fontSize: '13px',
                    }}>
                      <div>
                        <span style={{ fontWeight: 500, color: C.text }}>{signal.type}</span>
                        {' | '}
                        <span style={{ color: C.textSecondary }}>{signal.creator}</span>
                        {' | '}
                        <span style={{
                          padding: '2px 6px',
                          backgroundColor: signal.severity === 'high' ? C.textMuted : signal.severity === 'medium' ? 'var(--c-warning)' : C.textSecondary,
                          color: 'white',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          fontWeight: 'bold',
                        }}>
                          {signal.severity.toUpperCase()}
                        </span>
                        {' | '}
                        <span style={{ color: C.textSecondary, fontSize: '12px' }}>{signal.time}</span>
                      </div>
                      <button
                        onClick={() => setResolvedFraudSignals([...resolvedFraudSignals, signal.id])}
                        style={{
                          padding: '6px 12px',
                          backgroundColor: C.primary,
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          fontSize: '12px',
                          cursor: 'pointer',
                          fontWeight: 500,
                        }}
                      >
                        Resolve
                      </button>
                    </div>
                  ))}

                  <button
                    onClick={() => alert('Scan queued, results in ~2 minutes')}
                    style={{
                      width: '100%',
                      marginTop: '12px',
                      padding: '10px',
                      backgroundColor: C.primary,
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '13px',
                      fontWeight: '500',
                      cursor: 'pointer',
                    }}
                  >
                    Run Full Scan
                  </button>
                </div>
              </div>

              {/* ── CREATOR SAFETY CONTROLS ─────────────────────── */}
              <div style={{ padding: '20px', borderTop: `1px solid ${C.border}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: C.text }}>Creator Safety Controls</div>
                </div>
                <div style={{ fontSize: '0.75rem', color: C.textSecondary, marginBottom: '18px', lineHeight: 1.5 }}>
                  Platform-level rules enforced on all outreach. Creators cannot override these, they set the floor. Brands that violate are throttled or suspended.
                </div>

                {/* DM / Proposal Rate Limit */}
                <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '10px', padding: '14px 16px', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: C.text }}>Brand Outreach Rate Limit</div>
                      <div style={{ fontSize: '0.75rem', color: C.textSecondary, marginTop: '2px' }}>Max proposals a brand can send per day across all creators</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <button onClick={() => setSafetyDmRateLimit(Math.max(1, safetyDmRateLimit - 1))} style={{ width: '24px', height: '24px', borderRadius: '4px', border: `1px solid ${C.border}`, background: C.bg, color: C.text, cursor: 'pointer', fontSize: '14px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                      <span style={{ fontSize: '16px', fontWeight: 800, color: C.primary, minWidth: '28px', textAlign: 'center' }}>{safetyDmRateLimit}</span>
                      <button onClick={() => setSafetyDmRateLimit(Math.min(100, safetyDmRateLimit + 1))} style={{ width: '24px', height: '24px', borderRadius: '4px', border: `1px solid ${C.border}`, background: C.bg, color: C.text, cursor: 'pointer', fontSize: '14px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                    </div>
                  </div>
                  <input type="range" min={1} max={50} value={safetyDmRateLimit} onChange={e => setSafetyDmRateLimit(Number(e.target.value))} style={{ width: '100%', accentColor: C.primary }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: C.textMuted, marginTop: '2px' }}>
                    <span>1 (strict)</span><span>25 (standard)</span><span>50 (open)</span>
                  </div>
                </div>

                {/* Re-contact cooldown */}
                <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '10px', padding: '14px 16px', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: C.text }}>Re-contact Cooldown</div>
                      <div style={{ fontSize: '0.75rem', color: C.textSecondary, marginTop: '2px' }}>Days a brand is blocked from re-contacting a creator after decline</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {[7, 14, 30, 60, 90].map(d => (
                        <button key={d} onClick={() => setSafetyRecontactCooldown(d)}
                          style={{ padding: '4px 7px', borderRadius: '5px', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
                            background: safetyRecontactCooldown === d ? `${withAlpha(C.primary, 0x20)}` : C.bg,
                            color: safetyRecontactCooldown === d ? C.primary : C.textMuted,
                            border: `1px solid ${safetyRecontactCooldown === d ? C.primary : C.border}`,
                          }}>{d}d</button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Report-to-throttle threshold */}
                <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '10px', padding: '14px 16px', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: C.text }}>Auto-Throttle Threshold</div>
                      <div style={{ fontSize: '0.75rem', color: C.textSecondary, marginTop: '2px' }}>Reports needed from creators before brand outreach is auto-suspended</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {[1, 2, 3, 5, 10].map(n => (
                        <button key={n} onClick={() => setSafetyReportThreshold(n)}
                          style={{ padding: '4px 7px', borderRadius: '5px', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
                            background: safetyReportThreshold === n ? 'rgba(176, 65, 62,0.15)' : C.bg,
                            color: safetyReportThreshold === n ? C.textMuted : C.textMuted,
                            border: `1px solid ${safetyReportThreshold === n ? C.textMuted : C.border}`,
                          }}>{n}</button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Min brand trust score to contact */}
                <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '10px', padding: '14px 16px', marginBottom: '10px' }}>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: C.text, marginBottom: '4px' }}>Minimum Brand Trust Score to Contact</div>
                  <div style={{ fontSize: '0.75rem', color: C.textSecondary, marginBottom: '10px' }}>Brands below this score see creator profiles but cannot initiate contact</div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {[1, 2, 3, 4, 5].map(n => (
                      <button key={n} onClick={() => setSafetyMinBrandTrust(n)}
                        style={{ flex: 1, padding: '8px 4px', borderRadius: '7px', fontSize: '12px', fontWeight: 700, cursor: 'pointer',
                          background: safetyMinBrandTrust === n ? `${withAlpha(C.primary, 0x20)}` : C.bg,
                          color: safetyMinBrandTrust === n ? C.primary : C.textMuted,
                          border: `1px solid ${safetyMinBrandTrust === n ? C.primary : C.border}`,
                        }}>{'★'.repeat(n)}</button>
                    ))}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: C.textMuted, marginTop: '6px', textAlign: 'center' }}>
                    Current: min {safetyMinBrandTrust}★, brands below are read-only
                  </div>
                </div>

                {/* New brand warm intro threshold */}
                <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '10px', padding: '14px 16px', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: C.text }}>New Brand Warm Intro Gate</div>
                      <div style={{ fontSize: '0.75rem', color: C.textSecondary, marginTop: '2px' }}>Brands with fewer than N completed deals must be vouched before cold outreach</div>
                    </div>
                    <button onClick={() => setSafetyNewBrandWarmIntro(p => !p)}
                      style={{ width: '44px', height: '24px', borderRadius: '12px', border: 'none', backgroundColor: safetyNewBrandWarmIntro ? C.primary : 'rgba(255,255,255,0.15)', cursor: 'pointer', position: 'relative', flexShrink: 0, transition: 'background-color 0.2s' }}>
                      <div style={{ width: '20px', height: '20px', borderRadius: '50%', backgroundColor: 'var(--c-surface-lowest)', position: 'absolute', top: '2px', left: safetyNewBrandWarmIntro ? '22px' : '2px', transition: 'left 0.2s' }} />
                    </button>
                  </div>
                  {safetyNewBrandWarmIntro && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '0.75rem', color: C.textSecondary }}>Gate brands with fewer than</span>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        {[0, 1, 3, 5, 10].map(n => (
                          <button key={n} onClick={() => setSafetyNewBrandDealCount(n)}
                            style={{ padding: '3px 7px', borderRadius: '5px', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
                              background: safetyNewBrandDealCount === n ? `${withAlpha(C.primary, 0x20)}` : C.bg,
                              color: safetyNewBrandDealCount === n ? C.primary : C.textMuted,
                              border: `1px solid ${safetyNewBrandDealCount === n ? C.primary : C.border}`,
                            }}>{n}</button>
                        ))}
                      </div>
                      <span style={{ fontSize: '0.75rem', color: C.textSecondary }}>completed deals</span>
                    </div>
                  )}
                </div>

                {/* Toggle switches row */}
                <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '10px', padding: '14px 16px', marginBottom: '16px' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '12px' }}>Platform-Wide Enforcement</div>
                  {([
                    { label: 'Require verified Brand ValueSkin to contact', desc: 'Unverified brands cannot initiate any outreach', value: safetyRequireVerifiedBrand, set: setSafetyRequireVerifiedBrand },
                    { label: 'Proposal form required (no free-text cold DMs)', desc: 'All contact must be a structured brief, not a message', value: safetyRequireBrief, set: setSafetyRequireBrief },
                    { label: 'Block off-platform contact requests', desc: 'Auto-flag messages asking for phone/email/WhatsApp', value: safetyOffPlatformBlock, set: setSafetyOffPlatformBlock },
                  ] as const).map(({ label, desc, value, set }) => (
                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '8px 0', borderTop: `1px solid ${C.border}` }}>
                      <div style={{ flex: 1, paddingRight: '12px' }}>
                        <div style={{ fontSize: '12px', fontWeight: 600, color: C.text }}>{label}</div>
                        <div style={{ fontSize: '0.75rem', color: C.textSecondary, marginTop: '1px' }}>{desc}</div>
                      </div>
                      <button onClick={() => set((p: boolean) => !p)}
                        style={{ width: '40px', height: '22px', borderRadius: '11px', border: 'none', backgroundColor: value ? C.primary : 'rgba(255,255,255,0.12)', cursor: 'pointer', position: 'relative', flexShrink: 0, transition: 'background-color 0.2s' }}>
                        <div style={{ width: '18px', height: '18px', borderRadius: '50%', backgroundColor: 'var(--c-surface-lowest)', position: 'absolute', top: '2px', left: value ? '20px' : '2px', transition: 'left 0.2s' }} />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Save button */}
                <button
                  onClick={() => { setSavedSafetyToast(true); setTimeout(() => setSavedSafetyToast(false), 3000); }}
                  style={{ width: '100%', padding: '12px', background: C.primary, border: 'none', borderRadius: '8px', color: C.onPrimary, fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}
                >
                  {savedSafetyToast ? 'Safety settings saved' : 'Save Safety Settings'}
                </button>

                {/* Live policy summary */}
                <div style={{ marginTop: '12px', padding: '12px 14px', background: 'rgba(0,102,204,0.05)', border: `1px solid rgba(0,102,204,0.15)`, borderRadius: '8px', fontSize: '0.75rem', color: C.textSecondary, lineHeight: 1.7 }}>
                  <strong style={{ color: C.text, display: 'block', marginBottom: '4px' }}>Current Policy Summary</strong>
                  • Brands can send max <strong style={{ color: C.text }}>{safetyDmRateLimit}</strong> proposals/day<br/>
                  • Declined brand locked out for <strong style={{ color: C.text }}>{safetyRecontactCooldown} days</strong><br/>
                  • Auto-suspended after <strong style={{ color: C.text }}>{safetyReportThreshold}</strong> creator report{safetyReportThreshold !== 1 ? 's' : ''}<br/>
                  • Minimum brand trust to contact: <strong style={{ color: C.text }}>{'★'.repeat(safetyMinBrandTrust)}</strong><br/>
                  {safetyNewBrandWarmIntro && <>• Brands with &lt;{safetyNewBrandDealCount} deals need warm intro<br/></>}
                  {safetyRequireVerifiedBrand && <>• Verified Brand ValueSkin required<br/></>}
                  {safetyRequireBrief && <>• Proposal form mandatory, no cold DMs<br/></>}
                  {safetyOffPlatformBlock && <>• Off-platform contact requests auto-flagged<br/></>}
                </div>
              </div>

              {/* ── FEATURE FLAGS ───────────────────────────────── */}
              <div style={{ padding: '20px', borderTop: `1px solid ${C.border}` }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={C.primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: C.text }}>Feature Flags</div>
                  </div>
                  <span style={{ fontSize: '0.75rem', color: C.textMuted }}>Toggle any feature platform-wide</span>
                </div>
                <div style={{ fontSize: '0.75rem', color: C.textSecondary, marginBottom: '16px' }}>
                  All features are on by default. Turn off to hide from all creators and brands instantly.
                </div>

                {([
                  { label: 'Rate Card', desc: 'Per-format pricing (Reel/Story/Post) visible on creator cards', value: adminShowRateCard, set: setAdminShowRateCard },
                  { label: 'Availability Calendar', desc: 'Creator "available from" date shown on cards and in search', value: adminShowAvailabilityCalendar, set: setAdminShowAvailabilityCalendar },
                  { label: 'Portfolio Samples', desc: 'Past brand work visible on creator cards', value: adminShowPortfolio, set: setAdminShowPortfolio },
                  { label: 'Deal Completion Rate', desc: 'Creator % of started deals finished, penalises ghosting', value: adminShowDealCompletion, set: setAdminShowDealCompletion },
                  { label: 'Verified Income Tier', desc: 'Trust badge showing lifetime earnings tier (₹10K+, ₹50K+, etc)', value: adminShowIncomeTier, set: setAdminShowIncomeTier },
                  { label: 'First-Deal Badge', desc: 'Badge shown on creators open to discounted first collaboration', value: adminShowFirstDealBadge, set: setAdminShowFirstDealBadge },
                  { label: 'Exclusivity Slot Signal', desc: 'Shows "Slot taken until [date]" when creator is exclusive with a brand', value: adminShowExclusivitySignal, set: setAdminShowExclusivitySignal },
                  { label: 'Revision Limit Display', desc: 'Number of revisions included shown upfront on creator cards', value: adminShowRevisionLimit, set: setAdminShowRevisionLimit },
                  { label: 'Usage Rights Duration', desc: 'Days of usage rights shown before deal accepted', value: adminShowUsageRightsDuration, set: setAdminShowUsageRightsDuration },
                  { label: 'Brand Track Record', desc: 'Brand deals completed + avg payment time + creator ratings of brand', value: adminShowBrandTrackRecord, set: setAdminShowBrandTrackRecord },
                  { label: 'Mutual Rating System', desc: 'Both parties rate each other after deal close', value: adminShowMutualRating, set: setAdminShowMutualRating },
                  { label: 'Similar Creators', desc: 'Suggest creators similar to ones a brand already worked with', value: adminShowSimilarCreators, set: setAdminShowSimilarCreators },
                  { label: 'Long-Term Contracts', desc: 'Multi-month ambassador deals with recurring escrow milestones', value: adminAllowLongTermContracts, set: setAdminAllowLongTermContracts },
                ] as const).map(({ label, desc, value, set }) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '10px 0', borderTop: `1px solid ${C.border}` }}>
                    <div style={{ flex: 1, paddingRight: '12px' }}>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: value ? C.text : C.textMuted }}>{label}</div>
                      <div style={{ fontSize: '0.75rem', color: C.textMuted, marginTop: '1px' }}>{desc}</div>
                    </div>
                    <button onClick={() => set((p: boolean) => !p)}
                      style={{ width: '40px', height: '22px', borderRadius: '11px', border: 'none', backgroundColor: value ? C.primary : 'rgba(255,255,255,0.1)', cursor: 'pointer', position: 'relative', flexShrink: 0, transition: 'background-color 0.2s' }}>
                      <div style={{ width: '18px', height: '18px', borderRadius: '50%', backgroundColor: 'var(--c-surface-lowest)', position: 'absolute', top: '2px', left: value ? '20px' : '2px', transition: 'left 0.2s' }} />
                    </button>
                  </div>
                ))}

                <button
                  onClick={() => { setAdminSavedFeaturesTab(true); setTimeout(() => setAdminSavedFeaturesTab(false), 3000); }}
                  style={{ width: '100%', marginTop: '16px', padding: '11px', background: C.primary, border: 'none', borderRadius: '8px', color: C.onPrimary, fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}
                >
                  {adminSavedFeaturesTab ? 'Feature flags saved' : 'Save Feature Flags'}
                </button>
              </div>

              {/* ── DEAL COMMUNICATION MODE ───────────────────────── */}
              <div style={{ padding: '20px', borderTop: `1px solid ${C.border}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: C.text }}>Deal Communication Mode</div>
                </div>
                <div style={{ fontSize: '0.75rem', color: C.textSecondary, marginBottom: '16px', lineHeight: 1.5 }}>
                  Choose how brand deals and negotiations happen on the platform. This is a platform-level decision that affects all users.
                </div>

                {/* Option 1: ValueSkins Chatroom */}
                <div
                  onClick={() => setDealCommMode('valueskins_chatroom')}
                  style={{
                    background: dealCommMode === 'valueskins_chatroom' ? 'rgba(0,102,204,0.06)' : C.card,
                    border: `2px solid ${dealCommMode === 'valueskins_chatroom' ? C.primary : C.border}`,
                    borderRadius: '12px', padding: '16px', marginBottom: '10px', cursor: 'pointer', transition: 'all 0.15s',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: C.text }}>ValueSkins Deal Room</div>
                    <div style={{ width: '20px', height: '20px', borderRadius: '50%', border: `2px solid ${dealCommMode === 'valueskins_chatroom' ? C.primary : C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {dealCommMode === 'valueskins_chatroom' && <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: C.primary }} />}
                    </div>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: C.textSecondary, lineHeight: 1.6 }}>
                    Separate deal room environment purpose-built for negotiations. Offers, counters, contracts, and chat happen inside ValueSkins. Isolated from personal DMs.
                  </div>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '10px' }}>
                    {['Immutable audit log', 'Hash-chain integrity', 'Exact-second timestamps', 'Seen receipts', 'Deal reference IDs', 'Contract signing'].map(f => (
                      <span key={f} style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '9px', fontWeight: 600, background: 'rgba(0,102,204,0.1)', color: C.primary }}>{f}</span>
                    ))}
                  </div>
                </div>

                {/* Option 2: Instagram DMs */}
                <div
                  onClick={() => setDealCommMode('platform_dms')}
                  style={{
                    background: dealCommMode === 'platform_dms' ? 'rgba(0,102,204,0.06)' : C.card,
                    border: `2px solid ${dealCommMode === 'platform_dms' ? C.primary : C.border}`,
                    borderRadius: '12px', padding: '16px', marginBottom: '10px', cursor: 'pointer', transition: 'all 0.15s',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: C.text }}>Instagram Direct Messages</div>
                    <div style={{ width: '20px', height: '20px', borderRadius: '50%', border: `2px solid ${dealCommMode === 'platform_dms' ? C.primary : C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {dealCommMode === 'platform_dms' && <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: C.primary }} />}
                    </div>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: C.textSecondary, lineHeight: 1.6 }}>
                    Route deal conversations through the platform's existing DM system. Creators and brands communicate in the same inbox they already use. ValueSkins injects a compliance layer on top.
                  </div>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '10px' }}>
                    {['Familiar UX', 'No context switching', 'Existing notification system'].map(f => (
                      <span key={f} style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '9px', fontWeight: 600, background: 'rgba(255,255,255,0.06)', color: C.textSecondary }}>{f}</span>
                    ))}
                  </div>
                </div>

                {/* Non-negotiable security notice */}
                <div style={{ background: 'rgba(211,47,47,0.06)', border: '1px solid rgba(211,47,47,0.2)', borderRadius: '10px', padding: '14px 16px', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--c-error)" strokeWidth="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--c-error)' }}>Non-negotiable, applies to both modes</span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: C.textSecondary, lineHeight: 1.6 }}>
                    Regardless of communication mode, the following security features are enforced on every deal message and cannot be disabled:
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '10px' }}>
                    {[
                      { label: 'Immutable audit trail', desc: 'Every message, offer, counter, and phase change is stored as an append-only record. No edits, no deletions.' },
                      { label: 'Exact-second timestamps', desc: 'Send time, delivery time, and read time logged to the second in UTC for every message.' },
                      { label: 'Hash-chain integrity', desc: 'Each event is SHA-256 hashed with the previous event hash. Tampering with any record breaks the chain.' },
                      { label: 'Seen receipts with proof', desc: 'The exact moment the other party reads a message is recorded and visible to both sides.' },
                      { label: 'No ghosting enforcement', desc: 'Neither party can exit a live deal without selecting a documented rejection reason. Repeat offenders lose trust score.' },
                      { label: 'Exportable transcript', desc: 'Full deal history exportable as a legally defensible PDF at any time by either party.' },
                    ].map(item => (
                      <div key={item.label} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '6px 0' }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--c-error)" strokeWidth="2.5" strokeLinecap="round" style={{ marginTop: 2, flexShrink: 0 }}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                        <div>
                          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: C.text }}>{item.label}</div>
                          <div style={{ fontSize: '0.75rem', color: C.textMuted, lineHeight: 1.4 }}>{item.desc}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {dealCommMode === 'platform_dms' && (
                  <div style={{ background: 'rgba(230,81,0,0.06)', border: '1px solid rgba(230,81,0,0.2)', borderRadius: '10px', padding: '14px 16px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: C.text, marginBottom: '6px' }}>Integration requirements for Instagram DMs</div>
                    <div style={{ fontSize: '0.75rem', color: C.textSecondary, lineHeight: 1.6 }}>
                      If DMs are chosen as the communication channel, the platform must expose the following hooks to ValueSkins:
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '8px' }}>
                      {[
                        'Message webhook: every DM in a deal thread forwarded to ValueSkins for audit logging',
                        'Read receipt webhook: exact timestamp when recipient opens the message',
                        'Message metadata injection: ValueSkins appends audit ID and hash to each message payload',
                        'Thread isolation: deal-tagged DM threads are flagged and cannot be deleted by either party',
                        'Moderation override: platform moderators can freeze a deal thread on abuse reports',
                        'Export API: full thread exportable via API with all metadata for legal compliance',
                      ].map((req, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', fontSize: '0.75rem', color: C.text, lineHeight: 1.5 }}>
                          <span style={{ color: C.primary, fontWeight: 700, flexShrink: 0 }}>{i + 1}.</span>
                          {req}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <button
                  onClick={() => { setPurchaseToast(`Communication mode set to: ${dealCommMode === 'valueskins_chatroom' ? 'ValueSkins Deal Room' : 'Instagram DMs with security layer'}`); setTimeout(() => setPurchaseToast(null), 3000); }}
                  style={{ width: '100%', marginTop: '14px', padding: '11px', background: C.primary, border: 'none', borderRadius: '8px', color: C.onPrimary, fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}
                >
                  Save Communication Mode
                </button>
              </div>
            </>
          )}

          {/* ── [v1 COMMENTED OUT] STORE VIEW — the "Store / Niche / 3-types-of-ValueSkins" selector.
              v1 = lifestyle & fashion only, niche-agnostic creators. The entire store view (niche
              grids, category cards, purchase flow) is disabled. See Things-Commented-Out.md. */}
          {false && (() => {
            // ONE store. Two-pane master/detail per ui-specs/phase-2/store-page-mock.svg.
            // This replaces the old category-grid + modal: the right pane now shows the
            // skins directly, so buying is one click instead of two.
            // Purchase flow unchanged — same purchaseProfession(), same guards.
            const catMap = marketplaceRole === 'brand' ? PROFESSIONS : CREATOR_PROFESSIONS;
            const allCats = Object.values(catMap) as { name: string; subProfessions: string[] }[];
            const q = storeSearch.trim().toLowerCase();
            const cats = allCats.filter(c =>
              !q || c.name.toLowerCase().includes(q) || c.subProfessions.some(sp => sp.toLowerCase().includes(q))
            );
            const selectedName = (storeCategory && catMap[storeCategory]) ? storeCategory : (cats[0]?.name ?? allCats[0]?.name);
            const selected = selectedName ? catMap[selectedName] : undefined;
            const isBrandRole = marketplaceRole === 'brand';
            const ownedCount = isBrandRole ? brandValueSkins.length : ownedSkins.length;

            return (
            <>
              <div style={{ padding: '12px 16px 0', position: 'sticky', top: 'var(--vs-header-h, 0px)', background: C.bg, zIndex: 10 }}>
                <span style={{ fontSize: '22px', fontWeight: 700, color: C.text, display: 'block', marginBottom: '4px' }}>
                  {isBrandRole ? 'Select Your Niche' : 'ValueSkins Closet'}
                </span>
                <span style={{ fontSize: '13px', color: C.textSecondary, display: 'block', marginBottom: '14px' }}>
                  {isBrandRole
                    ? !storeCategory ? 'Select your niche from the store to launch campaigns' : `Launch campaigns for ${storeCategory}`
                    : 'Pick a profession to see its skins.'
                  }
                </span>
                <div style={{ position: 'relative', marginBottom: '14px' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.textMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}>
                    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                  </svg>
                  <input
                    type="text"
                    placeholder="Search professions..."
                    value={storeSearch}
                    onChange={(e) => setStoreSearch(e.target.value)}
                    aria-label="Search professions"
                    style={{ width: '100%', background: C.card, border: 'none', borderRadius: '12px', padding: '12px 12px 12px 40px', color: C.text, fontSize: '16px', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div style={{ padding: '0 16px 24px', display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'minmax(280px, 360px) 1fr', gap: '28px', alignItems: 'start' }}>

                {/* LEFT — numbered profession list. Sticky, the same way the
                    Settings rail is: this is the navigation for the pane on the
                    right, and scrolling a long skin grid should not scroll the
                    thing you use to change what is in it. Offset below the app
                    header plus the store's own sticky title block. */}
                <div style={{
                  position: 'sticky',
                  top: 'calc(var(--vs-header-h, 0px) + 148px)',
                  alignSelf: 'start',
                  maxHeight: 'calc(100dvh - var(--vs-header-h, 0px) - 168px)',
                  overflowY: 'auto',
                }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: C.textSecondary, margin: '4px 0 6px' }}>Browse professions</div>
                  {cats.map((prof, i) => {
                    const active = prof.name === selectedName;
                    const owns = isBrandRole
                      ? prof.subProfessions.some(sp => brandValueSkins.includes(sp))
                      : ownedSkins.some(s => prof.subProfessions.includes(s.profession));
                    const creatorCount = creatorCounts[prof.name] || 0;
                    return (
                      <button
                        key={prof.name}
                        onClick={() => setStoreCategory(prof.name)}
                        onMouseEnter={(e) => { if (!active) { e.currentTarget.style.background = 'rgba(200,184,154,0.07)'; const m = e.currentTarget.firstElementChild as HTMLElement; if (m) m.style.opacity = '1'; } }}
                        onMouseLeave={(e) => { if (!active) { e.currentTarget.style.background = 'transparent'; const m = e.currentTarget.firstElementChild as HTMLElement; if (m) m.style.opacity = '0'; } }}
                        style={{
                          position: 'relative', width: '100%', minHeight: '52px', display: 'flex', alignItems: 'center', gap: '10px',
                          padding: '0 12px', border: 'none', borderBottom: `1px solid ${C.border}`,
                          background: active ? 'rgba(200,184,154,0.14)' : 'transparent',
                          borderRadius: active ? '6px' : 0, cursor: 'pointer', textAlign: 'left',
                          transition: 'background 160ms cubic-bezier(0.16,1,0.3,1)',
                        }}
                      >
                        {/* Sand edge marker — solid when this row is selected,
                            faded in on hover (mock). Opacity only, so it
                            composites; §10.5 allows transform and opacity. */}
                        <span aria-hidden="true" style={{
                          position: 'absolute', left: 0, top: 0, bottom: 0, width: '2px',
                          background: C.accent,
                          opacity: active ? 1 : 0,
                          transition: 'opacity 160ms cubic-bezier(0.16,1,0.3,1)',
                        }} />
                        <span style={{ fontSize: '0.75rem', color: C.textMuted, minWidth: '18px' }}>{String(i + 1).padStart(2, '0')}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '15px', fontWeight: 600, color: C.text }}>{prof.name}</div>
                          {creatorCount > 0 && (
                            <div style={{ fontSize: '0.75rem', color: C.textMuted, marginTop: '2px' }}>
                              {creatorCount} {creatorCount === 1 ? 'creator' : 'creators'}
                            </div>
                          )}
                        </div>
                        <span style={{ fontSize: '12px', color: owns ? C.primary : C.textSecondary, fontWeight: owns ? 600 : 400 }}>
                          {owns ? 'Owned' : `${prof.subProfessions.length} skins`}
                        </span>
                        <span aria-hidden="true" style={{ color: active ? C.primary : C.textMuted }}>›</span>
                      </button>
                    );
                  })}
                  {cats.length === 0 && (
                    <p style={{ fontSize: '13px', color: C.textSecondary, padding: '18px 2px' }}>No professions match “{storeSearch}”.</p>
                  )}
                </div>

                {/* RIGHT — skins in the selected profession */}
                {selected && (
                  <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '18px', padding: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                      <h2 style={{ fontSize: '20px', fontWeight: 700, color: C.text, margin: 0 }}>{selected.name}</h2>
                      <span style={{ fontSize: '0.75rem', color: C.textSecondary, border: `1px solid ${C.border}`, borderRadius: '13px', padding: '5px 14px' }}>
                        {selected.subProfessions.length} skins · {ownedCount}/1 owned
                      </span>
                    </div>

                    <div style={{ height: '1px', background: C.border, margin: '16px 0 14px' }} />

                    <div style={{ marginBottom: '18px' }}>
                      <p style={{ fontSize: '13px', color: C.textSecondary, margin: '0 0 12px' }}>
                        {/* No price. GP3 and flagged.md F1 both say currency stays
                            unset until the final hardcode pass, and the mock shows
                            none — leading with price is also the Tata Nano rule
                            (BRANDING §1). */}
                        {isBrandRole
                          ? 'Tap any profession to add it to your brand ValueSkins.'
                          : 'Tap a badge to apply it as your ValueSkin. One active skin at a time.'}
                      </p>
                      {isBrandRole && storeCategory && (
                        <button
                          onClick={() => {
                            setMarketplaceTab('campaigns');
                            setActiveView('mim');
                          }}
                          style={{
                            padding: '12px 20px',
                            background: C.primary,
                            color: 'var(--c-surface-lowest)',
                            border: 'none',
                            borderRadius: '10px',
                            fontSize: '15px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'opacity 160ms',
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.9'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
                        >
                          ✨ Launch a Campaign
                        </button>
                      )}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : '1fr 1fr', gap: '10px' }}>
                      {selected.subProfessions.map((sub: string) => {
                        const defined = getBadge(sub);
                        const abbr = defined?.abbreviation ?? sub.split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 3);
                        const badgeColor = defined?.color ?? C.primary;
                        const stickerSrc = defined?.stickerImage || STICKER_MANIFEST[sub];
                        const isOwned = isBrandRole && brandValueSkins.includes(sub);
                        const isActiveHere = !isBrandRole && assignedProfessions.has(sub);
                        const isFull = (isBrandRole ? brandValueSkins.length >= 1 : ownedSkins.length >= 1) && !isOwned && !isActiveHere;
                        return (
                          <button
                            key={sub}
                            onClick={() => !isFull && purchaseProfession(sub)}
                            disabled={!!isFull}
                            onMouseEnter={(e) => { if (!isFull) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.background = 'rgba(200,184,154,0.07)'; } }}
                            onMouseLeave={(e) => { if (!isFull) { e.currentTarget.style.transform = 'none'; e.currentTarget.style.borderColor = (isActiveHere || isOwned) ? C.accent : C.border; e.currentTarget.style.background = (isActiveHere || isOwned) ? withAlpha(C.primary, 0x12) : C.card; } }}
                            style={{
                              transition: 'transform 180ms cubic-bezier(0.16,1,0.3,1), border-color 180ms linear, background 180ms linear',
                              background: (isActiveHere || isOwned) ? `${withAlpha(C.primary, 0x12)}` : C.card,
                              border: `1px solid ${(isActiveHere || isOwned) ? C.accent : C.border}`,
                              borderRadius: '12px', color: isFull ? C.textMuted : C.text,
                              padding: '14px 12px', cursor: isFull ? 'default' : 'pointer',
                              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
                              opacity: isFull ? 0.45 : 1, position: 'relative', minHeight: '44px',
                            }}
                          >
                            {/* The mock shows a pixel ValueSkin on every card.
                                Where a profession has no sticker art yet, fall
                                back to the pixel sprite rather than tinted
                                initials — the tint came from professions.ts,
                                which is off-palette, and initials read as a
                                placeholder rather than an identity. */}
                            {stickerSrc ? (
                              <img src={stickerSrc} alt="" style={{ width: '56px', height: '56px', objectFit: 'contain', borderRadius: '8px' }} />
                            ) : (
                              <ValueSkinSprite size={56} />
                            )}
                            <span style={{ fontSize: '13px', fontWeight: 600, textAlign: 'center', lineHeight: 1.3 }}>{sub}</span>
                            {(isActiveHere || isOwned) ? (
                              <span style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: C.accent }}>Equipped</span>
                            ) : isFull ? (
                              <span style={{ fontSize: '0.75rem', color: C.textMuted }}>Max skins (1/1)</span>
                            ) : (
                              /* Mock: a full-width Acquire button per card, solid
                                 primary — off-white on dark, near-black on light
                                 (G5 rule 4). Rendered as a span because the card
                                 itself is the button. */
                              <span style={{
                                width: '100%', marginTop: '2px', padding: '9px 10px', borderRadius: '8px',
                                background: C.primary, color: C.onPrimary,
                                fontSize: '13px', fontWeight: 600, textAlign: 'center',
                              }}>Acquire</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </>
            );
          })()}

          {/* ── NOTIFICATIONS VIEW ────────────────────────────── */}
          {activeView === 'notifications' && <NotificationsView hasAnySkin={hasAnySkin} />}

          {/* ── EXPLORE VIEW ──────────────────────────────────── */}
          {activeView === 'explore' && <ExploreView sharedState={sharedState} creatorProfile={myProfile} />}
          {/* ── SETTINGS VIEW ────────────────────────────────── */}
          {/* Settings tab. The hub is what used to live at /account/settings;
              the older preferences panel is now a pane inside it rather than a
              separate route, so nothing leaves the app shell. */}
          {activeView === 'settings' && settingsPane === 'hub' && (
            <SettingsHub
              embedded
              onOpenPreferences={() => setSettingsPane('preferences')}
              onOpenCreatorPreferences={() => setSettingsPane('creator-preferences')}
              fallbackAccount={demoAccount}
              onLogout={handleDemoLogout}
            />
          )}

          {/* Creator Profile Preferences — features/profiles/CreatorProfile.tsx,
              built to ui-specs/Creator Profile Preferences.md. It shipped with
              no importer, so the editor was unreachable in the app; it is a
              pane here rather than a route so nothing leaves the app shell. */}
          {activeView === 'settings' && settingsPane === 'creator-preferences' && (
            <CreatorProfile embedded onBack={() => setSettingsPane('hub')} />
          )}

          {/* Calendar view temporarily disabled - code archived in /archived/calendar-feature */}

          {activeView === 'settings' && settingsPane === 'preferences' && (
            <>
              <button
                onClick={() => setSettingsPane('hub')}
                style={{
                  margin: '12px 16px 0', minHeight: '44px', padding: '0 14px',
                  background: 'none', border: `1px solid ${C.border}`, borderRadius: '8px',
                  color: C.text, fontSize: '14px', fontWeight: 600, cursor: 'pointer',
                }}
              >
                ← Settings
              </button>
            <SettingsView
              role={marketplaceRole as 'brand' | 'creator' | 'viewer'}
              brandValueSkins={brandValueSkins}
              selectedCountry={selectedCountry}
              setSelectedCountry={setSelectedCountry}
              rateCard={rateCard}
              setRateCard={setRateCard}
              creatorAvailableFrom={creatorAvailableFrom}
              setCreatorAvailableFrom={setCreatorAvailableFrom}
              selectedLanguages={selectedLanguages}
              setSelectedLanguages={setSelectedLanguages}
              profileDealTypes={profileDealTypes}
              setProfileDealTypes={setProfileDealTypes}
              willingToBarter={willingToBarter}
              setWillingToBarter={setWillingToBarter}
              brandProfileSelections={brandProfileSelections}
              setBrandProfileSelections={setBrandProfileSelections}
              skinPitchTexts={skinPitchTexts}
              setSkinPitchTexts={setSkinPitchTexts}
              skinPitchVideos={skinPitchVideos}
              setSkinPitchVideos={setSkinPitchVideos}
              creatorEnergy={creatorEnergy}
              setCreatorEnergy={setCreatorEnergy}
              portfolioImage={portfolioImage}
              setPortfolioImage={setPortfolioImage}
              profileName={profileName}
              profileBio={profileBio}
            />
            </>
          )}
        </div>
      </div>

      {/* Profile hover card */}
      {hoverProfile && (
        <div
          onMouseEnter={() => { clearTimeout(hoverTimers.current.hide); }}
          onMouseLeave={() => { hoverTimers.current.hide = setTimeout(() => setHoverProfile(null), 200); }}
        >
          <HoverCard profile={hoverProfile.profile} x={hoverProfile.x} y={hoverProfile.y} />
        </div>
      )}

      {/* ── MODALS ──────────────────────────────────────────── */}

      {showMetricsModal && (
        <Modal onClose={() => setShowMetricsModal(false)}>
          <h2 style={{ fontSize: '22px', fontWeight: 'bold', marginBottom: '20px', color: C.text }}>Edit Your Metrics</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <MetricInput label="Followers" value={metrics.followers} onChange={(v) => updateMetric('followers', v)} />
            <MetricInput label="Engagement Rate (%)" value={metrics.engagement} onChange={(v) => updateMetric('engagement', v)} />
            <MetricInput label="Deals Completed" value={metrics.dealsCompleted} onChange={(v) => updateMetric('dealsCompleted', v)} />
            <MetricInput label="Average Deal Value (₹)" value={metrics.avgDealValue} onChange={(v) => updateMetric('avgDealValue', v)} />
            <MetricInput label="On-Time Rate (%)" value={metrics.onTimeRate} onChange={(v) => updateMetric('onTimeRate', v)} />
            <MetricInput label="Brand Rating" value={metrics.brandRating} onChange={(v) => updateMetric('brandRating', v)} />
          </div>
          <div style={{ background: C.primary, borderRadius: '12px', padding: '16px', marginTop: '20px', textAlign: 'center', color: C.onPrimary }}>
            <div style={{ fontSize: '14px', opacity: 0.9, marginBottom: '4px' }}>Highest Skin Level</div>
            <div style={{ fontSize: '32px', fontWeight: 'bold' }}>LEVEL {currentLevel}</div>
            {ownedSkins.length === 0 && <div style={{ fontSize: '0.75rem', opacity: 0.7, marginTop: '4px' }}>No ValueSkin equipped, purchase one from the Closet</div>}
            {ownedSkins.length === 1 && <div style={{ fontSize: '0.75rem', opacity: 0.7, marginTop: '4px' }}>Followers contribute to XP with 1 skin</div>}
          </div>
        </Modal>
      )}

      {showReputationModal && (() => {
        const totalMax = factors.reduce((sum, f) => sum + f.maxPoints, 0);
        const score = 847;
        const pct = Math.round((score / totalMax) * 100);
        // Simulated per-factor scores
        const factorScores: Record<string, number> = {
          'Content Consistency': 82,
          'Audience Engagement': 91,
          'Brand Partnerships': 78,
          'On-time Delivery': 99,
          'Community Trust': 85,
          'Profile Completeness': 95,
        };
        return (
          <Modal onClose={() => setShowReputationModal(false)}>
            {/* Score header */}
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>Reputation Score</div>
              <div style={{ fontSize: '42px', fontWeight: 800, color: C.primary, lineHeight: 1 }}>{score}</div>
              <div style={{ fontSize: '13px', color: C.textSecondary, marginTop: '4px' }}>out of {totalMax} possible points</div>
              <div style={{ height: '6px', background: C.border, borderRadius: '3px', overflow: 'hidden', margin: '14px 0 0' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: C.primary, borderRadius: '3px', transition: 'width 0.3s' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: C.textMuted, marginTop: '4px', fontWeight: 600 }}>
                <span>0</span>
                <span style={{ color: pct >= 80 ? C.success : C.textSecondary }}>Top {100 - pct + 3}% of creators</span>
                <span>{totalMax}</span>
              </div>
            </div>

            {/* Quick stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '20px' }}>
              {[
                { label: 'Level', value: `${currentLevel}`, sub: 'of 5' },
                { label: 'Deals', value: `${metrics.dealsCompleted}`, sub: 'completed' },
                { label: 'Avg Deal', value: `₹${Math.round(metrics.avgDealValue / 1000)}k`, sub: 'per deal' },
              ].map(s => (
                <div key={s.label} style={{ textAlign: 'center', padding: '12px 8px', background: C.surfaceAlt, borderRadius: '10px' }}>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: C.text, lineHeight: 1 }}>{s.value}</div>
                  <div style={{ fontSize: '0.75rem', color: C.textMuted, marginTop: '4px' }}>{s.sub}</div>
                  <div style={{ fontSize: '9px', fontWeight: 700, color: C.textSecondary, textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '2px' }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Factor breakdown */}
            <div style={{ fontSize: '12px', fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '10px' }}>Score Breakdown</div>
            {factors.map((factor) => {
              const earned = factorScores[factor.name] ?? Math.round(factor.maxPoints * 0.8);
              const fillPct = Math.round((earned / factor.maxPoints) * 100);
              return (
                <div key={factor.name} style={{ background: C.surfaceAlt, padding: '14px', borderRadius: '10px', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '13px', color: C.text }}>{factor.name}</div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: '12px' }}>
                      <span style={{ fontSize: '15px', fontWeight: 800, color: fillPct >= 90 ? C.success : fillPct >= 70 ? C.primary : C.warning }}>{earned}</span>
                      <span style={{ fontSize: '0.75rem', color: C.textMuted }}>/{factor.maxPoints}</span>
                    </div>
                  </div>
                  <div style={{ height: '4px', background: C.border, borderRadius: '2px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${fillPct}%`, background: fillPct >= 90 ? C.success : fillPct >= 70 ? C.primary : C.warning, borderRadius: '2px', transition: 'width 0.3s' }} />
                  </div>
                </div>
              );
            })}

            {/* Footer */}
            <div style={{ marginTop: '16px', padding: '12px', background: 'rgba(0,102,204,0.06)', borderRadius: '10px', textAlign: 'center' }}>
              <div style={{ fontSize: '0.75rem', color: C.textSecondary, lineHeight: 1.5 }}>
                Scores are computed from verified engagement data, transaction history, and peer attestations. Updated every 24 hours.
              </div>
            </div>
          </Modal>
        );
      })()}

      {/* Store Modal — shows brand types for brands, creator professions for creators */}
      {/* Store category modal removed — the two-pane store shows skins inline. */}

      {/* Brand Store Modal */}
      {/* Brand Store Modal — this is now unused since brands buy skins from the main store like creators */}

      {/* ── EVENTS VIEW ──────────────────────────── */}
      {activeView === 'events' && (
        <div style={{ padding: '80px 20px', textAlign: 'center' }}>
          <div style={{
            background: C.surface,
            border: `2px solid ${C.border}`,
            borderRadius: '24px',
            padding: '80px 40px',
            maxWidth: '500px',
            margin: '0 auto',
          }}>
            <div style={{ fontSize: '48px', marginBottom: '20px', opacity: 0.4 }}>📅</div>
            <div style={{
              display: 'inline-block', padding: '6px 16px',
              background: `${withAlpha(C.textMuted, 0x15)}`, border: `1px solid ${withAlpha(C.textMuted, 0x30)}`,
              borderRadius: '999px', color: C.textMuted, fontSize: '12px',
              fontWeight: 600, marginBottom: '24px', textTransform: 'uppercase',
              letterSpacing: '1px',
            }}>
              COMING SOON
            </div>
            <h2 style={{ fontSize: '28px', fontWeight: 800, color: C.textMuted, marginBottom: '16px' }}>Events</h2>
            <p style={{ fontSize: '15px', color: C.textMuted, margin: 0, lineHeight: '1.6' }}>
              The events feature is currently in development and will be available soon. Stay tuned for updates!
            </p>
          </div>
        </div>
      )}

      {/* The bottom tab bar was retired when the spine moved into AppHeader.
          Keeping both would have meant two navs competing, and the floor bar
          was also where the consent banner kept colliding with navigation. */}
      </div>
    </div>
  );
}

function NavItem({ label, active, onClick, badgeCount }: { label: string; active: boolean; onClick: () => void; badgeCount?: number }) {
  return (
    <button
      onClick={onClick}
      style={{ background: 'transparent', border: 'none', borderRadius: '10px', padding: '12px 14px', color: active ? C.text : C.textSecondary, fontWeight: active ? 700 : 400, fontSize: '15px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px', transition: 'all 0.15s', width: '100%', justifyContent: 'flex-start', position: 'relative' }}
      onMouseEnter={(e) => { if (!active) { e.currentTarget.style.color = C.text; } }}
      onMouseLeave={(e) => { if (!active) { e.currentTarget.style.color = C.textSecondary; } }}
    >
      <span>{label}</span>
      {badgeCount !== undefined && badgeCount > 0 && (
        <span style={{ minWidth: '18px', height: '18px', borderRadius: '9px', background: C.danger, color: 'var(--c-surface-lowest)', fontSize: '0.75rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px' }}>{badgeCount}</span>
      )}
    </button>
  );
}

function Modal({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: C.card, borderRadius: '20px', padding: '24px', maxWidth: '500px', width: '95vw', maxHeight: '90vh', overflowY: 'auto', position: 'relative' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', color: C.textMuted, fontSize: '24px', cursor: 'pointer', lineHeight: 1 }}>×</button>
        {children}
      </div>
    </div>
  );
}

function MetricInput({ label, value, onChange }: { label: string; value: number; onChange: (v: string) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <label style={{ fontSize: '13px', fontWeight: '600', color: C.text }}>{label}</label>
      <input
        type="text" value={value.toLocaleString()}
        onChange={(e) => onChange(e.target.value.replace(/,/g, ''))}
        style={{ background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: '8px', color: C.text, padding: '10px 12px', fontSize: '14px', fontFamily: 'inherit', outline: 'none' }}
        onFocus={(e) => { e.currentTarget.style.borderColor = C.primary; }}
        onBlur={(e) => { e.currentTarget.style.borderColor = C.border; }}
      />
    </div>
  );
}

// Legacy calculateLevel — engagement and deal value only, views/followers excluded
function calculateLevel(metrics: any, levels: any): number {
  for (let level = 5; level >= 1; level--) {
    const t = levels[level];
    if (metrics.engagement >= t.engagement && metrics.avgDealValue >= t.dealValue) return level;
  }
  return 1;
}
