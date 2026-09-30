/**
 * ARCHITECTURE: See ARCHITECTURE_GUIDE.txt for codebase overview
 * FILE PURPOSE: Core state management hook for deal negotiation
 * ROLE IN SYSTEM: Central place where all deal data lives (offers, scripts, chat, etc)
 * WHAT IT DOES:
 *   - Manages deal state using React hooks
 *   - Syncs with localStorage (offline support)
 *   - Syncs across browser tabs via BroadcastChannel
 * CONSUMED BY: instagram/page.tsx, tiktok/page.tsx, youtube/page.tsx, linkedin/page.tsx
 *
 * Deal synchronization hook — bridges localStorage state with backend API.
 *
 * Strategy:
 * 1. On mount, attempt to load deal rooms from backend API
 * 2. If backend is reachable, use it as source of truth and sync to localStorage
 * 3. If backend is unreachable, fall back to localStorage (offline mode)
 * 4. All mutations attempt API first, then update localStorage
 * 5. BroadcastChannel keeps multiple tabs in sync
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { loadSharedState, subscribeSharedState } from '@/lib/shared-state';

// ---- Types matching the demo page's DealState ----

// Deal room phases.
//
// The negotiation phases ('counter', 'brand_considering', 'brand_countered',
// 'brand_reviewing', 'last_offer') belong to the superseded offer/counter model.
// ValueSkins runs "one shot kill": a creator who dislikes the price does not
// apply, and there is no price conversation. They are kept in the union so the
// commented-out negotiation UI still typechecks if it is restored — see
// docs/COMMENTED_OUT_FEATURES.md — but nothing should transition into them.
export type DealRoomPhase = 'brief' | 'offer' | 'pending' | 'counter' | 'brand_considering' | 'brand_countered' | 'brand_rejected' | 'brand_reviewing' | 'last_offer' | 'rejected' | 'chatroom' | 'formal_offer' | 'checklist' | 'accepted' | 'softhold';

/** The server's nine-state workflow. This is the authority, not `phase`. */
export type WorkflowStatus =
  | 'DRAFT' | 'OPEN' | 'CONFIRMED' | 'COMMISSION_PAID' | 'ADVANCE_PAID'
  | 'CONTENT_UPLOADED' | 'REVISION_REQUESTED' | 'APPROVED_FOR_FINAL_PAYMENT'
  | 'COMPLETED' | 'CANCELLED';

export type PaymentMilestoneStatus = 'pending' | 'released';

export type DealState = {
  phase: DealRoomPhase;
  intent: 'explore' | 'campaign' | 'long-term';
  briefFilled: boolean;
  briefTitle: string;
  offerAmount: string;
  counterAmount: string;
  brandResponseAmount: string; // amount brand counter-offered back after creator countered
  agreementAmount?: string; // final agreed amount after negotiation
  chatMessages: ChatMessage[];
  chatInput: string;
  performanceClause: boolean;
  advancePercent: number;
  approvalPercent: number;
  // Payment milestone tracking — synced real-time
  paymentMilestones?: Record<'advance' | 'approval', PaymentMilestoneStatus>;
  creatorDealLifecycle?: 'checklist' | 'scripting' | 'deliverables' | 'submitted' | 'approved'; // Creator side
  // Script workflow: simple binary choice
  // 'brand_provides': Brand gives script, creator accepts/rejects in one click
  // 'creator_freedom': Creator has full creative freedom, discuss in chat
  scriptMode?: 'brand_provides' | 'creator_freedom';
  scriptDraft?: string; // Brand's script text (if scriptMode === 'brand_provides')
  scriptAccepted?: boolean; // Creator accepted the brand's script (if applicable)
  // Webhook simulation logs (MVP)
  publishEvents?: Array<{ id: number; type: 'video_published' | 'milestone_released'; message: string; at: string }>;
  deliverableStatuses?: Record<number, 'pending' | 'linking' | 'uploaded' | 'approved'>; // Per-deliverable status
  // Brand-side state — persisted so role-switching preserves progress
  brandPhase?: string;          // BrandDealPhase
  brandApprovalPhase?: string;  // BrandApprovalPhase
  formalOfferSentByCreator?: boolean;
  deliverableLinks?: Record<number, string>; // Instagram URLs per deliverable index
  // Backend IDs — populated when synced with API
  backendDealRoomId?: number;
  backendLastMessageId?: number;
  // The real deal row's UUID, returned by /api/deals/create-workflow-deal.
  // Required by every workflow call: the local `activeDealKey`
  // ("creator|skin|index") identifies a deal in this browser only, and the
  // server has never heard of it. Undefined means the deal is local-only and
  // no payment can be taken for it.
  serverDealId?: string;
  // Mirror of deals.workflow_status, refreshed after each server call. The
  // server decides this; the UI only displays it.
  workflowStatus?: WorkflowStatus;
  // Set when a payment has been handed to Razorpay but the webhook has not yet
  // confirmed it, so the UI can show "confirming" instead of implying success.
  pendingPaymentStage?: 'commission' | 'advance' | 'remaining';
  // Deal type differentiation — determines workflow (escrow vs goods vs content tracking)
  dealType?: 'paid' | 'barter' | 'c2c_paid' | 'c2c_collab';
  type?: string; // Generic type field for deal display
  // Barter-only: goods lifecycle and tracking number
  goodsTrackerStatus?: 'goods_preparing' | 'goods_shipped' | 'goods_delivered' | 'content_due' | 'content_submitted' | 'content_approved';
  goodsTrackingNumber?: string;
  // C2C collab (unpaid) only: content lifecycle
  c2cContentStatus?: 'content_creating' | 'content_submitted' | 'content_approved';
  // International deal flags and compliance acknowledgments
  isInternationalDeal?: boolean;
  customsComplianceAcknowledged?: boolean;
  // Escrow state — synced between brand (funder) and creator (receiver)
  escrowFunded?: boolean;
  // Payment milestone tracking — which stages have been released to creator
  milestoneAdvanceReleased?: boolean;
  milestoneUploadReleased?: boolean;
  milestoneApprovalReleased?: boolean;
  // Tip system — brand can tip after deal completion
  tipsReceived?: Array<{ amount: string; from: string; timestamp: string; message?: string }>;
  // Dispute tracking
  disputes?: Array<{
    id: number;
    type: 'late_delivery' | 'quality_issue' | 'payment' | 'other';
    description: string;
    filledBy: 'creator' | 'brand';
    timestamp: string;
    status: 'open' | 'resolved';
  }>;
  // Point of Contact — set at campaign creation, shown to both parties
  poc?: { name: string; workEmail: string; role: string; phone?: string };
  // Campaign linkage — connects deal to its originating campaign for Sent Deals tracking
  campaignId?: number;
  campaignTitle?: string;
  // Deal context — ensures both parties can find the same deal
  // creatorName|creatorSkin is the deal key itself, but we also store context for reference
  creatorMarketplaceIndex?: number; // BRAND_MARKETPLACE_CREATORS array index
  opportunityIndex?: number;        // activeOpportunities array index (creator side)
  creatorName?: string;             // Name of creator from BRAND_MARKETPLACE_CREATORS
  creatorSkin?: string;             // ValueSkin (profession) of creator
  brandName?: string;               // Name of brand (stored when deal is created)
  // Ratings and reviews — both sides rate each other after deal completion
  creatorRating?: number;           // 1-5 stars from creator to brand
  creatorRatingComment?: string;    // Creator's review comment
  displayCreatorRating?: boolean;   // Creator chose to show on profile
  brandRating?: number;             // 1-5 stars from brand to creator
  brandRatingComment?: string;      // Brand's review comment
  displayBrandRating?: boolean;     // Brand chose to show on profile
  // Payment and escrow
  paymentSecured?: boolean;
  escrowPool?: number;
};

export type ChatMessage = {
  id: number;
  sender: 'me' | 'brand' | 'creator';
  text: string;
  time: string;       // display time (e.g. "2:34 PM")
  isoTime: string;    // full ISO timestamp for audit log (e.g. "2026-03-18T14:34:07.421Z")
  seen?: boolean;
  seenAt?: string;    // ISO timestamp of when the other party opened/read the message
};

// A single entry in the deal's immutable event ledger
export type DealEvent = {
  id: number;
  type: 'offer_sent' | 'offer_received' | 'counter_sent' | 'counter_received' | 'accepted' | 'rejected' | 'message_sent' | 'message_seen' | 'deal_signed' | 'content_submitted' | 'content_approved' | 'payment_released';
  actor: 'creator' | 'brand' | 'system';
  label: string;       // human-readable description
  isoTime: string;     // ISO timestamp
  hash: string;        // SHA-256 of (prevHash + type + actor + isoTime + label) — chain integrity
};

export type SharedApplication = {
  id: number;
  campaignId: number;
  campaignTitle: string;
  creatorProfession: string;
  creatorHandle: string;
  status: 'pending' | 'accepted' | 'rejected' | 'invited';
  appliedAt: string;
  opportunityIndex?: number; // Index in activeOpportunities for deal key lookup
  // Creator insights — visible to brand when reviewing application
  creatorName?: string;
  creatorFollowers?: string;
  creatorEngagement?: string;
  creatorLevel?: number;
  creatorMatchScore?: string;
  creatorRate?: string;
  creatorDealCompletionRate?: number;
  creatorPortfolio?: string[];
  creatorAudienceLocation?: string;
  creatorAudienceAge?: string;
  creatorResponseTimeHrs?: number;
  creatorInstagramUrl?: string;
  creatorWebsiteUrl?: string;
};

export type Campaign = {
  id: number;
  brandName?: string;
  brandProfession: string;
  title: string;
  description: string;
  about?: string;
  requiredProfessions: string[];
  requiredValueskin?: string;
  minLevel: number;
  maxLevel: number;
  budget: string;
  deadline: string;
  deliveryDeadline?: string;
  location: string;
  nonNegotiables: string[];
  deliverables: string;
  compensationType?: string;
  exclusivity?: string;
  usageRights?: string;
  revisionLimit?: number;
  audienceTarget?: string;
  requirements?: string[];
  scriptMode?: 'non_negotiable' | 'discussion' | 'creator_freedom';
  scriptText?: string;
  scriptFileName?: string;
  shootLocation?: string;
  expectations?: string;
  otherNotes?: string;
  allowContentApprovalPayment?: boolean;
  contentReview?: 'direct_upload' | 'review_required';
  status: 'open' | 'closed' | 'expired';
  applicants: number;
  creatorCount?: number;
  escrowFunded?: boolean;
  escrowPool?: number;
  escrowAllocated?: number;
  country?: string;
  locations?: string[];
  poc?: { name: string; workEmail: string; role: string; phone?: string };
  hasDigitalRights?: boolean;
  digitalRightsAmount?: string;
  digitalRightsDays?: string;
  digitalRightsReels?: number;
  digitalRightsStories?: number;
  paymentSecured?: boolean;
};

// ---- Storage keys ----
const STORAGE_DEALS = 'vs_demo_deal_states';
const STORAGE_APPLICATIONS = 'vs_demo_applications';
const STORAGE_CAMPAIGNS = 'vs_demo_campaigns';
const BC_NAME = 'vs_demo_sync';
const STORAGE_VERSION_KEY = 'vs_demo_data_version';
const CURRENT_DATA_VERSION = '4'; // bump to clear old mock data

// One-time purge of stale mock data from previous sessions
if (typeof window !== 'undefined') {
  const storedVersion = localStorage.getItem(STORAGE_VERSION_KEY);
  if (storedVersion !== CURRENT_DATA_VERSION) {
    localStorage.removeItem(STORAGE_DEALS);
    localStorage.removeItem(STORAGE_APPLICATIONS);
    localStorage.removeItem(STORAGE_CAMPAIGNS);
    localStorage.setItem(STORAGE_VERSION_KEY, CURRENT_DATA_VERSION);
  }
}

// ---- Backend connectivity check ----
import { backendUrl, apiFetch, isBackendReachable } from '@/lib/backend';

let pgBackendOnline: boolean | null = null;
let lastCheck = 0;
const CHECK_INTERVAL = 30_000;

async function isBackendOnline(): Promise<boolean> {
  const now = Date.now();
  if (pgBackendOnline !== null && now - lastCheck < CHECK_INTERVAL) {
    return pgBackendOnline;
  }
  pgBackendOnline = await isBackendReachable();
  lastCheck = now;
  return pgBackendOnline ?? false;
}

// ---- localStorage helpers ----
function loadFromStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : fallback;
  } catch {
    return fallback;
  }
}

function saveToStorage<T>(key: string, data: T): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch { /* quota exceeded — safe to ignore */ }
}

function broadcastSync(): void {
  try {
    new BroadcastChannel(BC_NAME).postMessage('sync');
  } catch { /* unsupported — safe to ignore */ }
}

// ---- Main hook ----

export function useDealSync(userId?: number, initialData?: {
  campaigns?: Campaign[];
  dealStates?: Record<string, DealState>;
  applications?: SharedApplication[];
}) {
  const [dealStates, setDealStates] = useState<Record<string, DealState>>(initialData?.dealStates || {});
  const [applications, setApplications] = useState<SharedApplication[]>(initialData?.applications || []);
  const [campaigns, setCampaigns] = useState<Campaign[]>(initialData?.campaigns || []);
  const [loaded, setLoaded] = useState(!!initialData);
  const [online, setOnline] = useState(false);
  const syncInProgress = useRef(false);

  // Cross-device sync ref — prevent echo loops when merging remote updates
  const externalUpdateRef = useRef(false);

  // Initial load — merge SSR data with localStorage, then try backend
  useEffect(() => {
    let cancelled = false;

    async function init() {
      // If SSR provided data, use it as base but ALSO merge with localStorage
      if (initialData && (initialData.campaigns || initialData.dealStates || initialData.applications)) {
        const localCampaigns = loadFromStorage<Campaign[]>(STORAGE_CAMPAIGNS, []);
        if (localCampaigns.length > 0) {
          const initIds = new Set((initialData.campaigns || []).map(c => c.id));
          const localOnly = localCampaigns.filter(c => !initIds.has(c.id));
          if (localOnly.length > 0) {
            setCampaigns([...(initialData.campaigns || []), ...localOnly]);
          }
        }
        const localDeals = loadFromStorage<Record<string, DealState>>(STORAGE_DEALS, {});
        if (Object.keys(localDeals).length > 0) {
          setDealStates(prev => {
            const initDeals = initialData.dealStates || {};
            const merged = { ...localDeals };
            for (const [k, v] of Object.entries(initDeals)) {
              merged[k] = { ...(merged[k] || {} as DealState), ...(v as Partial<DealState>) };
            }
            return merged;
          });
        }
        const localApps = loadFromStorage<SharedApplication[]>(STORAGE_APPLICATIONS, []);
        if (localApps.length > 0) {
          const initAppIds = new Set((initialData.applications || []).map(a => a.id));
          const localOnlyApps = localApps.filter(a => !initAppIds.has(a.id));
          if (localOnlyApps.length > 0) {
            setApplications([...(initialData.applications || []), ...localOnlyApps]);
          }
        }
      }
      if (!cancelled) setLoaded(true);

      const backendUp = await isBackendOnline();
      if (cancelled) return;
      setOnline(backendUp);
      if (!backendUp) return;

      // ── Try Render backend API endpoints ──

      // 1. Load campaigns from backend
      try {
        const campRes = await apiFetch<{ campaigns: any[] }>('/marketplace/opportunities');
        if (!cancelled && campRes.data?.campaigns) {
          const dbCampaigns: Campaign[] = campRes.data.campaigns.map((c: any) => ({
            id: c.id,
            brandName: c.brand_name || '',
            brandProfession: '',
            title: c.title || '',
            description: c.description || '',
            requiredProfessions: c.required_profession_name ? [c.required_profession_name] : [],
            minLevel: c.required_level || 0,
            maxLevel: c.required_level || 0,
            budget: String(c.reward_amount || '0'),
            deadline: c.deadline || '',
            location: '',
            nonNegotiables: [],
            deliverables: '',
            status: c.status === 'open' ? 'open' : 'closed',
            applicants: Number(c.application_count || 0),
          }));
          setCampaigns(prev => {
            const prevIds = new Set(prev.map(c => c.id));
            const newOnes = dbCampaigns.filter(c => !prevIds.has(c.id));
            if (newOnes.length === 0) return prev;
            return [...prev, ...newOnes];
          });
        }
      } catch { /* fall through */ }

      // 2. Load deals from backend
      try {
        const dealRes = await apiFetch<{ deals: any[] }>('/marketplace/deals/mine');
        if (!cancelled && dealRes.data?.deals) {
          const dbDeals: Record<string, DealState> = {};
          for (const d of dealRes.data.deals) {
            const key = `${d.title || 'Deal'}:${d.id}`;
            dbDeals[key] = {
              phase: mapDbDealPhase(d.status),
              intent: 'campaign',
              briefFilled: true,
              briefTitle: d.title || '',
              offerAmount: String(d.offerAmount || ''),
              counterAmount: '',
              brandResponseAmount: '',
              chatMessages: [],
              chatInput: '',
              performanceClause: false,
              advancePercent: 50,
              approvalPercent: 50,
              backendDealRoomId: typeof d.id === 'number' ? d.id : undefined,
              creatorName: d.partnerName,
            };
          }
          setDealStates(prev => {
            const merged = { ...prev };
            for (const [k, v] of Object.entries(dbDeals)) {
              if (!merged[k]) merged[k] = v;
            }
            return merged;
          });
        }
      } catch { /* fall through */ }

      // 3. Load applications from backend
      try {
        const appRes = await apiFetch<{ applications: any[] }>('/marketplace/applications/mine');
        if (!cancelled && appRes.data?.applications) {
          const dbApps: SharedApplication[] = appRes.data.applications.map((b: any) => ({
            id: b.id,
            campaignId: b.opportunity_id,
            campaignTitle: b.opportunity_title || '',
            creatorProfession: '',
            creatorHandle: b.username || '',
            status: mapBidStatus(b.status),
            appliedAt: b.created_at || new Date().toISOString(),
          }));
          setApplications(prev => {
            const prevIds = new Set(prev.map(a => a.id));
            const newOnes = dbApps.filter(a => !prevIds.has(a.id));
            if (newOnes.length === 0) return prev;
            return [...prev, ...newOnes];
          });
        }
      } catch { /* fall through */ }
    }

    init();
    return () => { cancelled = true; };
  }, []); // Only run on mount — initialData is the initial state, not a dependency

  // Persist deals to localStorage on change
  useEffect(() => {
    if (!loaded) return;
    saveToStorage(STORAGE_DEALS, dealStates);
    broadcastSync();
  }, [dealStates, loaded]);

  // Persist applications to localStorage on change
  useEffect(() => {
    if (!loaded) return;
    saveToStorage(STORAGE_APPLICATIONS, applications);
    broadcastSync();
  }, [applications, loaded]);

  // Persist campaigns to localStorage on change
  useEffect(() => {
    if (!loaded) return;
    // Don't overwrite localStorage with empty data if it previously had data
    const stored = loadFromStorage<Campaign[]>(STORAGE_CAMPAIGNS, []);
    if (campaigns.length === 0 && stored.length > 0) return;
    saveToStorage(STORAGE_CAMPAIGNS, campaigns);
    broadcastSync();
  }, [campaigns, loaded]);

  // Listen for cross-tab sync
  useEffect(() => {
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel(BC_NAME);
      bc.onmessage = () => {
        setDealStates(loadFromStorage(STORAGE_DEALS, {}));
        setApplications(loadFromStorage(STORAGE_APPLICATIONS, []));
        setCampaigns(loadFromStorage(STORAGE_CAMPAIGNS, []));
      };
    } catch { /* unsupported */ }

    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_DEALS) setDealStates(loadFromStorage(STORAGE_DEALS, {}));
      if (e.key === STORAGE_APPLICATIONS) setApplications(loadFromStorage(STORAGE_APPLICATIONS, []));
      if (e.key === STORAGE_CAMPAIGNS) setCampaigns(loadFromStorage(STORAGE_CAMPAIGNS, []));
    };
    window.addEventListener('storage', onStorage);
    return () => {
      bc?.close();
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  // Ensure every deal object has a chatMessages array (sync sources may store partial deals)
  const withChatMessages = (deal: Partial<DealState> | undefined): DealState => ({
    ...(deal || {} as Partial<DealState>),
    chatMessages: Array.isArray(deal?.chatMessages) ? deal.chatMessages as ChatMessage[] : [],
  } as DealState);


  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    async function loadShared() {
      try {
        const data = await loadSharedState();
        if (cancelled || !data) return;
        externalUpdateRef.current = true;
        if (data.deals && typeof data.deals === 'object') {
          setDealStates(prev => {
            const merged = { ...prev };
            for (const [k, v] of Object.entries(data.deals)) {
              const remote = withChatMessages(v as Partial<DealState>);
              const local = merged[k];
              if (local) {
                const localDeal = withChatMessages(local);
                merged[k] = { ...remote, ...localDeal, chatMessages: localDeal.chatMessages.length > 0 ? localDeal.chatMessages : remote.chatMessages };
              } else {
                merged[k] = remote;
              }
            }
            return merged;
          });
        }
        const sharedApps = Object.values(data.applications || {}) as SharedApplication[];
        if (sharedApps.length > 0) setApplications(sharedApps);
        const sharedCampaigns = Object.values(data.campaigns || {}) as Campaign[];
        if (sharedCampaigns.length > 0) {
          setCampaigns(prev => {
            const localIds = new Set(prev.map(c => c.id));
            const newOnes = sharedCampaigns.filter(c => !localIds.has(c.id));
            if (newOnes.length === 0) return prev;
            return [...prev, ...newOnes];
          });
        }
        setTimeout(() => { externalUpdateRef.current = false; }, 200);
      } catch { /* shared DB not reachable — no-op */ }
    }

    loadShared();
    return () => { cancelled = true; };
  }, [userId]);

  // 2. Subscribe to shared-state changes from other devices (WebSocket realtime).
  //    only mirrors those changes back into local state.
  useEffect(() => {
    if (!userId) return;
    const unsubscribe = subscribeSharedState((data) => {
      externalUpdateRef.current = true;
      if (data.deals && typeof data.deals === 'object') {
        setDealStates(prev => {
          const merged = { ...prev };
          for (const [k, v] of Object.entries(data.deals)) {
            const remote = withChatMessages(v as Partial<DealState>);
            const local = merged[k];
            if (local) {
              const localDeal = withChatMessages(local);
              merged[k] = { ...remote, ...localDeal, chatMessages: localDeal.chatMessages.length > 0 ? localDeal.chatMessages : remote.chatMessages };
            } else {
              merged[k] = remote;
            }
          }
          return merged;
        });
      }
      const sharedApps = Object.values(data.applications || {}) as SharedApplication[];
      if (sharedApps.length > 0) setApplications(sharedApps);
      const sharedCampaigns = Object.values(data.campaigns || {}) as Campaign[];
      if (sharedCampaigns.length > 0) {
        setCampaigns(prev => {
          const localIds = new Set(prev.map(c => c.id));
          const newOnes = sharedCampaigns.filter(c => !localIds.has(c.id));
          if (newOnes.length === 0) return prev;
          return [...prev, ...newOnes];
        });
      }
      if (data.messages && typeof data.messages === 'object') {
        setDealStates(prev => {
          let updated = prev;
          for (const [dealKey, msgs] of Object.entries(data.messages)) {
            const existing = updated[dealKey];
            if (!existing || !Array.isArray(msgs) || msgs.length === 0) continue;
            const localIds = new Set((existing.chatMessages || []).map(m => m.id));
            const newMsgs = (msgs as ChatMessage[]).filter(m => !localIds.has(m.id));
            if (newMsgs.length === 0) continue;
            updated = { ...updated, [dealKey]: { ...existing, chatMessages: [...(existing.chatMessages || []), ...newMsgs] } };
          }
          return updated;
        });
      }
      setTimeout(() => { externalUpdateRef.current = false; }, 200);
    });
    return unsubscribe;
  }, [userId]);

  // ---- Deal state helpers ----

  const getOrCreateDeal = useCallback((key: string): DealState => {
    const existing = dealStates[key];
    if (!existing) return {
      phase: 'brief' as const,
      intent: 'campaign' as const,
      briefFilled: false,
      briefTitle: '',
      offerAmount: '',
      counterAmount: '',
      brandResponseAmount: '',
      chatMessages: [
        { id: 1, sender: 'brand' as const, text: 'Hey! Excited to work together on this campaign.', time: 'just now', isoTime: new Date().toISOString(), seen: false },
      ],
      chatInput: '',
      performanceClause: false,
      advancePercent: 100,
      approvalPercent: 0,
      dealType: undefined,
      goodsTrackerStatus: undefined,
      goodsTrackingNumber: undefined,
      c2cContentStatus: undefined,
      isInternationalDeal: false,
      customsComplianceAcknowledged: false,
      poc: undefined,
    };
    return withChatMessages(existing);
  }, [dealStates]);

  const updateDeal = useCallback((key: string, patch: Partial<DealState>) => {
    setDealStates(prev => {
      const existing = prev[key] ?? {
        phase: 'brief' as const,
        intent: 'campaign' as const,
        briefFilled: false,
        briefTitle: '',
        offerAmount: '',
        counterAmount: '',
        chatMessages: [
          { id: 1, sender: 'brand' as const, text: 'Hey! Excited to work together on this campaign.', time: 'just now', isoTime: new Date().toISOString(), seen: false },
        ],
        chatInput: '',
        performanceClause: false,
        advancePercent: 70,

        approvalPercent: 0,
        dealType: undefined,
        goodsTrackerStatus: undefined,
        goodsTrackingNumber: undefined,
        c2cContentStatus: undefined,
        isInternationalDeal: false,
        customsComplianceAcknowledged: false,
        poc: undefined,
      };
      return { ...prev, [key]: withChatMessages({ ...existing, ...prev[key], ...patch }) };
    });
  }, []);

  // ---- API-backed mutations ----

  /** Open a deal room — tries Render backend first, falls back to local state */
  const openDealRoom = useCallback(async (
    key: string,
    creatorPersonaId: number,
    briefData: {
      intent: string;
      title: string;
      description: string;
      deliverables: string;
      campaignType: string;
      compensationType?: string;
    }
  ) => {
    try {
      const res = await apiFetch<{ deal_room_id: number }>('/deal-rooms', {
        method: 'POST',
        body: JSON.stringify({
          creator_persona_id: creatorPersonaId,
          intent: briefData.intent,
          brief_title: briefData.title,
          brief_description: briefData.description,
          brief_deliverables: briefData.deliverables,
          brief_campaign_type: briefData.campaignType,
          compensation_type: briefData.compensationType,
        }),
      });
      if (res.data?.deal_room_id) {
        updateDeal(key, {
          phase: 'offer',
          intent: briefData.intent as DealState['intent'],
          briefFilled: true,
          briefTitle: briefData.title,
          backendDealRoomId: res.data.deal_room_id,
        });
        return res.data.deal_room_id;
      }
    } catch { /* fall through */ }

    updateDeal(key, {
      phase: 'offer',
      intent: briefData.intent as DealState['intent'],
      briefFilled: true,
      briefTitle: briefData.title,
    });
    return null;
  }, [updateDeal]);

  /** Send a chat message — persists to Render backend */
  const sendMessage = useCallback(async (
    key: string,
    text: string,
    sender: 'me' | 'brand' = 'me'
  ) => {
    const deal = dealStates[key];
    const dealId = deal?.backendDealRoomId;
    const newMsg: ChatMessage = {
      id: Date.now(),
      sender,
      text,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isoTime: new Date().toISOString(),
      seen: false,
    };

    // Optimistic local update
    setDealStates(prev => {
      const existing = prev[key];
      if (!existing) return prev;
      return {
        ...prev,
        [key]: {
          ...existing,
          chatMessages: [...(existing.chatMessages || []), newMsg],
          chatInput: '',
        },
      };
    });

    // Persist to Render backend
    if (dealId) {
      try {
        await apiFetch(`/deal-rooms/${dealId}/messages`, {
          method: 'POST',
          body: JSON.stringify({ content: text }),
        });
      } catch { /* message saved locally */ }
    }
  }, [dealStates]);

  /** Make an offer — persists offer message to Render backend */
  const makeOffer = useCallback(async (
    key: string,
    amountCents: number,
    note?: string
  ) => {
    const deal = dealStates[key];
    const dealId = deal?.backendDealRoomId;
    const offerText = `Offer: ₹${(amountCents / 100).toFixed(0)}${note ? ` - ${note}` : ''}`;

    if (dealId) {
      try {
        await apiFetch(`/deal-rooms/${dealId}/messages`, {
          method: 'POST',
          body: JSON.stringify({ content: offerText }),
        });
      } catch { /* local fallback */ }
    }

    updateDeal(key, { phase: 'counter', offerAmount: String(amountCents / 100) });
  }, [dealStates, updateDeal]);

  /** Submit application — writes to Render backend */
  const submitApplication = useCallback(async (
    opportunityId: number,
    personaId: number,
    pitch: string,
    appData: Omit<SharedApplication, 'id'>
  ) => {
    let appId = Date.now();

    try {
      const res = await apiFetch<{ application_id: number }>('/marketplace/applications', {
        method: 'POST',
        body: JSON.stringify({
          opportunity_id: opportunityId,
          persona_id: personaId,
          pitch,
        }),
      });
      if (res.data?.application_id) {
        appId = res.data.application_id;
      }
    } catch { /* fall through to local fallback */ }

    const newApp: SharedApplication = { ...appData, id: appId };
    setApplications(prev => [...prev, newApp]);
  }, []);

  /** Accept application (brand side) — updates Render backend */
  const acceptApplication = useCallback(async (
    applicationId: number,
    opportunityId: number,
    personaId: number
  ) => {
    try {
      await apiFetch('/brands/applications/accept', {
        method: 'POST',
        body: JSON.stringify({ opportunity_id: opportunityId, persona_id: personaId }),
      });
    } catch { /* local update still applies */ }

    setApplications(prev =>
      prev.map(a => a.id === applicationId ? { ...a, status: 'accepted' as const } : a)
    );
  }, []);

  /** Create campaign (brand side) — writes to Render backend */
  const createCampaign = useCallback(async (campaign: Omit<Campaign, 'id'>) => {
    let campId = Date.now();

    try {
      const res = await apiFetch<{ opportunity_id: number }>('/marketplace/opportunities', {
        method: 'POST',
        body: JSON.stringify({
          title: campaign.title,
          description: campaign.description,
          category: campaign.brandProfession || 'General',
          required_profession_id: 1,
          required_level: campaign.minLevel || 1,
          reward_amount: campaign.budget || '0',
          duration_days: 30,
        }),
      });
      if (res.data?.opportunity_id) {
        campId = res.data.opportunity_id;
      }
    } catch { /* fall through to local fallback */ }

    const newCampaign: Campaign = { ...campaign, id: campId };
    setCampaigns(prev => [...prev, newCampaign]);
  }, []);

  /** Finalize deal — updates Render backend */
  const finalizeDeal = useCallback(async (key: string) => {
    const deal = dealStates[key];
    const dealId = deal?.backendDealRoomId;

    if (dealId) {
      try {
        await apiFetch(`/deal-rooms/${dealId}/finalize`, {
          method: 'POST',
          body: JSON.stringify({}),
        });
      } catch { /* local update still applies */ }
    }

    updateDeal(key, { phase: 'accepted' });
  }, [dealStates, updateDeal]);

  /** Background sync — creates Render backend records for local-only deals */
  const syncToBackend = useCallback(async () => {
    if (syncInProgress.current) return;
    syncInProgress.current = true;

    try {
      const backendUp = await isBackendOnline();
      if (!backendUp) return;
      setOnline(true);

      for (const [key, deal] of Object.entries(dealStates)) {
        if (deal.backendDealRoomId || deal.phase === 'brief') continue;

        try {
          const res = await apiFetch<{ deal_room_id: number }>('/deal-rooms', {
            method: 'POST',
            body: JSON.stringify({
              creator_persona_id: 1,
              intent: deal.intent || 'campaign',
              brief_title: deal.briefTitle || key.split(':')[0],
              brief_description: 'Synced from local state',
              brief_deliverables: '',
              brief_campaign_type: 'paid',
            }),
          });
          if (res.data?.deal_room_id) {
            updateDeal(key, {
              backendDealRoomId: res.data.deal_room_id,
            });
          }
        } catch { /* skip this deal */ }
      }
    } finally {
      syncInProgress.current = false;
    }
  }, [dealStates, updateDeal]);

  // Run background sync every 60 seconds
  useEffect(() => {
    if (!loaded) return;
    const interval = setInterval(syncToBackend, 60_000);
    return () => clearInterval(interval);
  }, [loaded, syncToBackend]);

  return {
    // State
    dealStates,
    setDealStates,
    applications,
    setApplications,
    campaigns,
    setCampaigns,
    loaded,
    online,

    // Deal helpers
    getOrCreateDeal,
    updateDeal,

    // API-backed mutations
    openDealRoom,
    sendMessage,
    makeOffer,
    submitApplication,
    acceptApplication,
    createCampaign,
    finalizeDeal,
    syncToBackend,
  };
}

// ---- Helpers ----

function mapStatusToPhase(status: string): DealRoomPhase {
  switch (status) {
    case 'active': return 'chatroom';
    case 'accepted': return 'accepted';
    case 'completed': return 'accepted';
    case 'cancelled':
    case 'expired':
    case 'rejected': return 'brief';
    default: return 'brief';
  }
}

function mapDbDealPhase(status: string): DealRoomPhase {
  switch (status) {
    case 'offer':
    case 'negotiation': return 'offer';
    case 'active':
    case 'in_progress': return 'chatroom';
    case 'checklist': return 'checklist';
    case 'accepted':
    case 'completed': return 'accepted';
    case 'rejected':
    case 'cancelled': return 'rejected';
    default: return 'brief';
  }
}

function mapBidStatus(status: string): SharedApplication['status'] {
  switch (status) {
    case 'pending': return 'pending';
    case 'accepted': return 'accepted';
    case 'rejected': return 'rejected';
    case 'withdrawn': return 'pending';
    default: return 'pending';
  }
}
