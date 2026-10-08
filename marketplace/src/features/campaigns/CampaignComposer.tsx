'use client';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { C } from '@/theme/colors';
import { ValueSkinSprite } from '@/features/profiles/ProfileView';

// Campaign Composer — ui-specs/Market.md §3.
//
// Replaces the Create Campaign modal. The spec retires the modal because
// campaign creation is long and multi-field: a modal cramped the content and
// forced scrolling inside a small window. A full page is correct *because* it
// carries a persistent frame that keeps the user oriented (_global-conventions
// G4), and the draft autosaves so Back never loses work.
//
// Field styling (§3c), beige level range (§3d) and motion (§3e) are pinned to
// exact values by the spec. Currency stays unset (GP3 / flagged F1) — the
// symbol arrives as a prop.

const FONT = "'Inter', 'Helvetica Neue', Arial, sans-serif";

// Sand is identical in both themes, so these stay literal (BRANDING §4).
const WARM_SAND = '#C8B89A';
const DEEP_SAND = '#A08A5E';
const NEAR_BLACK = '#0A0A0A';
const SAND_HAIR = 'rgba(160,138,94,0.28)';
const SAND_RING = '0 0 0 3px rgba(160,138,94,0.16)';
const SAND_TINT = 'rgba(200,184,154,0.14)';
const EASE = 'cubic-bezier(0.16,1,0.3,1)';

export const CAMPAIGN_DRAFT_KEY = 'valueskins_campaign_draft';
const DRAFT_KEY = CAMPAIGN_DRAFT_KEY;

export type ScriptMode = 'non_negotiable' | 'discussion' | 'creator_freedom';
export type ContentReview = 'direct_upload' | 'review_required';

export interface CampaignDraft {
  brandName: string;
  title: string;
  description: string;
  profession: string;
  locations: string[];
  contentLanguage: string;
  minLevel: number;
  maxLevel: number;
  budget: string;
  deliverables: string;
  compensation: string;
  exclusivity: string;
  usageRights: string;
  deadline: string;
  deliveryDeadline: string;
  scriptMode: ScriptMode;
  scriptText: string;
  /** Filename of a script draft the brand attaches inside the Script box. */
  scriptFileName: string;
  shootLocation: string;
  expectations: string;
  otherNotes: string;
  contentReview: ContentReview;
  hasDigitalRights: boolean;
  digitalRightsAmount: string;
  digitalRightsDays: string;
  digitalRightsReels: number;
  digitalRightsStories: number;
  pocName: string;
  pocRole: string;
  pocEmail: string;
  pocPhone: string;
}

export const EMPTY_DRAFT: CampaignDraft = {
  brandName: '', title: '', description: '', profession: '', locations: [],
  contentLanguage: 'English', minLevel: 1, maxLevel: 5, budget: '',
  deliverables: '', compensation: 'Paid', exclusivity: 'None',
  usageRights: '30 days, social only', deadline: '', deliveryDeadline: '',
  scriptMode: 'creator_freedom', scriptText: '', scriptFileName: '',
  shootLocation: '', expectations: '', otherNotes: '',
  contentReview: 'review_required',
  hasDigitalRights: false, digitalRightsAmount: '', digitalRightsDays: '30',
  digitalRightsReels: 0, digitalRightsStories: 0,
  pocName: '', pocRole: '', pocEmail: '', pocPhone: '',
};

const LANGUAGES = ['English','Hindi','Spanish','French','German','Portuguese','Arabic','Japanese','Korean','Chinese','Italian','Dutch','Russian','Turkish','Vietnamese','Thai','Indonesian','Malay','Tamil','Telugu','Bengali','Marathi','Gujarati','Kannada','Malayalam','Punjabi','Urdu'];
const USAGE_RIGHTS = ['30 days, social only','60 days, social only','90 days, all platforms','120 days, all platforms','180 days, all platforms','Perpetual'];
const EXCLUSIVITY = ['None','Category exclusive, 30 days','Category exclusive, 90 days','Category exclusive, 180 days'];
const COMPENSATION = ['Paid','Paid + Barter','Barter only','Performance-based'];

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const on = () => setReduced(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return reduced;
}

function useWidth() {
  const [w, setW] = useState(1200);
  useEffect(() => {
    const on = () => setW(window.innerWidth);
    on();
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return w;
}

// Module scope on purpose: a component defined inside the render body gets a
// fresh identity every render, which makes React remount the whole form —
// restarting the entrance animation and stealing focus from the active input.
// The §3e stagger comes from :nth-child in CSS so no index has to be threaded.
function Row({ span = 1, two, children }: { span?: 1 | 2; two: boolean; children: React.ReactNode }) {
  return (
    <div className="vs-cc-field" style={{ gridColumn: two && span === 2 ? '1 / -1' : 'auto' }}>
      {children}
    </div>
  );
}

export default function CampaignComposer({
  initialDraft,
  brandName,
  professions,
  currencySymbol,
  onBack,
  onLaunch,
}: {
  initialDraft?: Partial<CampaignDraft>;
  /** Prefills the brand name field from the signed-in account. */
  brandName?: string;
  /** Target profession/niche options — the same taxonomy the Store uses. */
  professions: string[];
  /** GP3 / F1 — the symbol is supplied, never hardcoded in the composer. */
  currencySymbol: string;
  onBack: () => void;
  onLaunch: (draft: CampaignDraft) => void;
}) {
  const reduced = useReducedMotion();
  const vw = useWidth();
  const twoCol = vw >= 960;          // §3-0 — preview drops below the form under 960
  const formTwoCol = vw >= 760;      // §3b — form collapses to one column under ~760

  const [draft, setDraft] = useState<CampaignDraft>(() => ({
    ...EMPTY_DRAFT,
    brandName: brandName || '',
    ...initialDraft,
  }));
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const restored = useRef(false);

  // Restore a draft left behind by a previous session (G4 / GP2). The local
  // copy paints immediately; the server copy then wins if it exists, which is
  // what makes the draft survive a re-login or a different device.
  useEffect(() => {
    if (restored.current) return;
    restored.current = true;

    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        setDraft((d) => ({ ...d, ...(JSON.parse(raw) as Partial<CampaignDraft>) }));
        setSavedAt(Date.now());
      }
    } catch {
      // a corrupt local draft is not worth blocking the composer over
    }

    let cancelled = false;
    fetch('/api/drafts/campaign', { credentials: 'include' })
      .then((r) => (r.status === 200 ? r.json() : null))
      .then((d) => {
        if (cancelled || !d?.data) return;
        setDraft((cur) => ({ ...cur, ...(d.data as Partial<CampaignDraft>) }));
        setSavedAt(Date.now());
      })
      .catch(() => { /* offline or signed out — the local copy stands */ });
    return () => { cancelled = true; };
  }, []);

  // Autosave, debounced. The visible marker is what kills the "did I lose my
  // work?" fear the convention calls out.
  useEffect(() => {
    if (!restored.current) return;
    const t = setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
        setSavedAt(Date.now());
      } catch {
        // storage full or blocked — the composer still works, just unsaved
      }
      // GP2: persist server-side too, so ending the session cannot cost the draft
      fetch('/api/drafts/campaign', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      }).catch(() => { /* local copy already saved; retry on the next edit */ });
    }, 600);
    return () => clearTimeout(t);
  }, [draft]);

  const set = useCallback(<K extends keyof CampaignDraft>(k: K, v: CampaignDraft[K]) => {
    setDraft((d) => ({ ...d, [k]: v }));
  }, []);

  // UI-only: whether the "paste script text" area is expanded inside the Script box.
  const [showScriptPaste, setShowScriptPaste] = useState(false);

  // The composer autosaves JSON, so we persist the draft's *name* (the actual
  // file is what the brand sends in the deal room). The name surfaces in the
  // live preview and in the created campaign.
  const handleScriptFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) set('scriptFileName', f.name);
  };

  const escrowTotal = useMemo(
    () => parseInt(draft.budget || '0', 10) || 0,
    [draft.budget]
  );

  const handleLaunch = () => {
    const missing: string[] = [];
    const invalid: string[] = [];

    if (!draft.title.trim()) missing.push('Campaign title');
    if (!draft.description.trim()) missing.push('Description');
    if (!draft.budget) missing.push('Budget');
    if (!draft.pocName.trim()) missing.push('Point of contact name');
    if (!draft.pocEmail.trim()) missing.push('Point of contact email');
    if (!draft.pocPhone.trim()) missing.push('Point of contact phone');

    // Validate email format
    if (draft.pocEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.pocEmail.trim())) {
      invalid.push('Point of contact email is invalid');
    }

    // Validate phone format (exactly 10 digits)
    const phoneDigits = draft.pocPhone.replace(/\D/g, '');
    if (draft.pocPhone.trim() && phoneDigits.length !== 10) {
      invalid.push('Point of contact phone must be exactly 10 digits');
    }

    if (missing.length || invalid.length) {
      const allErrors = [...missing, ...invalid];
      setError(`Still needed: ${allErrors.join(', ')}`);
      return;
    }
    setError(null);
    try { localStorage.removeItem(DRAFT_KEY); } catch { /* nothing to clear */ }
    fetch('/api/drafts/campaign', { method: 'DELETE', credentials: 'include' })
      .catch(() => { /* the stored draft expires on its own */ });
    onLaunch(draft);
  };

  // ---- shared styles (§3c) -------------------------------------------------
  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.04em',
    textTransform: 'uppercase', color: C.textMuted, marginBottom: '8px',
  };
  const helpStyle: React.CSSProperties = {
    fontSize: '0.8125rem', color: C.textMuted, marginTop: '-2px', marginBottom: '8px', lineHeight: 1.5,
  };
  const fieldBase: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', fontFamily: FONT,
    fontSize: '1rem',                    // G6 — never below 16px (iOS zoom)
    padding: '13px 14px', borderRadius: '6px',
    background: C.surface, color: C.text,
    border: `1px solid ${SAND_HAIR}`, outline: 'none',
    transition: reduced ? 'none' : `border-color 150ms ${EASE}, box-shadow 150ms ${EASE}`,
  };
  const onFocus = (e: React.FocusEvent<HTMLElement>) => {
    e.currentTarget.style.borderColor = DEEP_SAND;
    e.currentTarget.style.boxShadow = SAND_RING;
  };
  const onBlur = (e: React.FocusEvent<HTMLElement>) => {
    e.currentTarget.style.borderColor = SAND_HAIR;
    e.currentTarget.style.boxShadow = 'none';
  };


  const Text = (
    k: keyof CampaignDraft, label: string, opts: { help?: string; placeholder?: string; type?: string; numeric?: boolean } = {}
  ) => (
    <>
      <label style={labelStyle} htmlFor={`cc-${k}`}>{label}</label>
      {opts.help && <div style={helpStyle}>{opts.help}</div>}
      <input
        id={`cc-${k}`}
        type={opts.type || 'text'}
        value={String(draft[k] ?? '')}
        placeholder={opts.placeholder}
        onChange={(e) => set(k, (opts.numeric ? e.target.value.replace(/[^0-9]/g, '') : e.target.value) as never)}
        onFocus={onFocus}
        onBlur={onBlur}
        style={fieldBase}
      />
    </>
  );

  const Area = (k: keyof CampaignDraft, label: string, help?: string, placeholder?: string) => (
    <>
      <label style={labelStyle} htmlFor={`cc-${k}`}>{label}</label>
      {help && <div style={helpStyle}>{help}</div>}
      <textarea
        id={`cc-${k}`}
        value={String(draft[k] ?? '')}
        placeholder={placeholder}
        onChange={(e) => set(k, e.target.value as never)}
        onFocus={onFocus}
        onBlur={onBlur}
        style={{ ...fieldBase, height: '110px', resize: 'vertical' }}   // §3c
      />
    </>
  );

  const Select = (k: keyof CampaignDraft, label: string, options: string[], help?: string, placeholder?: string) => (
    <>
      <label style={labelStyle} htmlFor={`cc-${k}`}>{label}</label>
      {help && <div style={helpStyle}>{help}</div>}
      <select
        id={`cc-${k}`}
        value={String(draft[k] ?? '')}
        onChange={(e) => set(k, e.target.value as never)}
        onFocus={onFocus}
        onBlur={onBlur}
        style={fieldBase}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </>
  );

  // §3d — beige selected. The old build used a black L1 and a green L5; green
  // is a flat BRANDING §4 violation and both are gone.
  const levelRow = (which: 'minLevel' | 'maxLevel') => (
    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: which === 'maxLevel' ? '8px' : 0 }}>
      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: C.textMuted, width: '30px', flexShrink: 0 }}>
        {which === 'minLevel' ? 'Min' : 'Max'}
      </span>
      {[1, 2, 3, 4, 5].map((l) => {
        const on = draft[which] === l;
        return (
          <button
            key={l}
            type="button"
            onClick={() => {
              if (which === 'minLevel') {
                set('minLevel', l);
                if (l > draft.maxLevel) set('maxLevel', l);
              } else {
                set('maxLevel', l);
                if (l < draft.minLevel) set('minLevel', l);
              }
            }}
            onMouseDown={(e) => { if (!reduced) e.currentTarget.style.transform = 'scale(0.98)'; }}
            onMouseUp={(e) => { e.currentTarget.style.transform = 'none'; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; }}
            style={{
              flex: 1, minHeight: '44px', borderRadius: '6px', cursor: 'pointer',
              fontFamily: FONT, fontSize: '0.875rem', fontWeight: on ? 600 : 500,
              background: on ? WARM_SAND : C.surface,
              color: on ? NEAR_BLACK : C.textSecondary,
              border: `1px solid ${on ? WARM_SAND : SAND_HAIR}`,
              transition: reduced ? 'none' : `background 150ms ${EASE}, border-color 150ms ${EASE}, transform 150ms ${EASE}`,
            }}
          >
            L{l}
          </button>
        );
      })}
    </div>
  );

  // §3d — larger card choices get a bordered + faintly tinted selected state; a
  // full sand fill would be too heavy at this size.
  const cardChoice = (selected: boolean, title: string, sub: string, onClick: () => void) => (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'block', width: '100%', textAlign: 'left', cursor: 'pointer',
        padding: '14px 16px', borderRadius: '6px', fontFamily: FONT,
        background: selected ? SAND_TINT : C.surface,
        border: selected ? `1.5px solid ${C.primary}` : `1px solid ${SAND_HAIR}`,
        transition: reduced ? 'none' : `background 150ms ${EASE}, border-color 150ms ${EASE}`,
      }}
    >
      <div style={{ fontSize: '0.9375rem', fontWeight: 600, color: C.text, marginBottom: '3px' }}>{title}</div>
      <div style={{ fontSize: '0.8125rem', color: C.textMuted, lineHeight: 1.5 }}>{sub}</div>
    </button>
  );

  const chip = (on: boolean, label: string, onClick: () => void) => (
    <button
      type="button"
      onClick={onClick}
      style={{
        minHeight: '44px', padding: '0 16px', borderRadius: '6px', cursor: 'pointer', fontFamily: FONT,
        fontSize: '0.875rem', fontWeight: on ? 600 : 500,
        background: on ? WARM_SAND : C.surface,
        color: on ? NEAR_BLACK : C.textSecondary,
        border: `1px solid ${on ? WARM_SAND : SAND_HAIR}`,
        transition: reduced ? 'none' : `background 150ms ${EASE}, border-color 150ms ${EASE}`,
      }}
    >
      {label}
    </button>
  );

  const draftMarker = savedAt ? 'Draft · autosaved' : 'Draft';

  return (
    <div style={{ fontFamily: FONT, minHeight: '100%', background: C.bg, color: C.text }}>
      <style>{`
        .vs-cc-field { animation: vsCcRise 380ms ${EASE}; }
        .vs-cc-field:nth-child(n+2)  { animation-delay: 28ms; }
        .vs-cc-field:nth-child(n+5)  { animation-delay: 56ms; }
        .vs-cc-field:nth-child(n+9)  { animation-delay: 84ms; }
        .vs-cc-field:nth-child(n+13) { animation-delay: 112ms; }
        @keyframes vsCcRise { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
        @media (prefers-reduced-motion: reduce) {
          .vs-cc-field { animation: none; }
        }
        .vs-cc-launch:hover { transform: translateY(-1px); }
        .vs-cc-launch:active { transform: scale(0.99); }
        @media (prefers-reduced-motion: reduce) { .vs-cc-launch:hover, .vs-cc-launch:active { transform: none; } }
      `}</style>

      {/* §3-0 — persistent header. Never scrolls away; this frame is what keeps
          the user oriented and is the reason a full page is safe here (G4). */}
      <div
        style={{
          position: 'sticky', top: 0, zIndex: 30,
          display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap',
          padding: '14px 24px',
          background: C.surface,
          borderBottom: `1px solid ${SAND_HAIR}`,
        }}
      >
        <button
          type="button"
          onClick={onBack}
          style={{
            minHeight: '44px', padding: '0 16px', borderRadius: '6px', cursor: 'pointer',
            background: 'none', border: `1px solid ${SAND_HAIR}`, color: C.text,
            fontFamily: FONT, fontSize: '0.875rem', fontWeight: 600,
          }}
        >
          ‹ Back
        </button>
        <div style={{ flex: 1, minWidth: '160px' }}>
          <div style={{ fontSize: '1.25rem', fontWeight: 700, letterSpacing: '-0.01em' }}>New Campaign</div>
          <div style={{ fontSize: '0.75rem', color: C.textMuted, marginTop: '2px' }}>{draftMarker}</div>
        </div>
        <button
          type="button"
          className="vs-cc-launch"
          onClick={handleLaunch}
          style={{
            minHeight: '44px', padding: '0 24px', borderRadius: '6px', cursor: 'pointer',
            background: C.primary, color: C.onPrimary, border: 'none',
            fontFamily: FONT, fontSize: '1rem', fontWeight: 600,
            transition: reduced ? 'none' : `transform 150ms ${EASE}`,
          }}
        >
          Launch Campaign
        </button>
      </div>

      {error && (
        <div
          role="alert"
          style={{
            margin: '16px 24px 0', padding: '12px 16px', borderRadius: '6px',
            background: SAND_TINT, border: `1px solid ${SAND_HAIR}`,
            fontSize: '0.875rem', color: C.text,
          }}
        >
          {error}
        </div>
      )}

      {/* §3-0 — two columns: form left, sticky live preview right. */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: twoCol ? 'minmax(0,1fr) 380px' : 'minmax(0,1fr)',
          gap: '40px', alignItems: 'start',
          padding: '24px', maxWidth: '1240px', margin: '0 auto',
        }}
      >
        {/* ---- form ---- */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: formTwoCol ? '1fr 1fr' : '1fr',
            columnGap: '40px', rowGap: '22px', alignContent: 'start',
          }}
        >
          <Row span={2} two={formTwoCol}>{Text('brandName', 'Brand name')}</Row>
          <Row span={2} two={formTwoCol}>{Text('title', 'Campaign title')}</Row>
          <Row span={2} two={formTwoCol}>
            {Area('description', 'About your product / campaign',
              'Creators need to understand what they are promoting. Be specific, what is the product, who is it for, and what makes it worth their audience’s trust. Any exclusivity or non-compete clause must be stated here.')}
          </Row>

          {/* ── [v1 COMMENTED OUT] Profession / niche targeting — v1 is niche-agnostic (lifestyle & fashion). See Things-Commented-Out.md. */}
          {false && <Row two={formTwoCol}>{Select('profession', 'Target profession / niche', professions, 'Only creators wearing this ValueSkin are matched.', 'Select a profession…')}</Row>}
          <Row span={2} two={formTwoCol}>
            <label style={labelStyle}>Target locations (cities)</label>
            <div style={helpStyle}>Select which cities you want to work with. Leave empty to target all locations.</div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px' }}>
              <input
                type="text"
                placeholder="Add a city (e.g., Mumbai, Delhi, Bangalore)"
                onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                  if (e.key === 'Enter' && (e.target as HTMLInputElement).value.trim()) {
                    const newCity = (e.target as HTMLInputElement).value.trim();
                    if (!draft.locations.includes(newCity)) {
                      set('locations', [...draft.locations, newCity]);
                    }
                    (e.target as HTMLInputElement).value = '';
                  }
                }}
                style={{ flex: 1, minWidth: '200px', padding: '8px 12px', borderRadius: '6px', border: `1px solid ${SAND_HAIR}`, background: C.surface, color: C.text, fontSize: '0.9375rem', outline: 'none' }}
              />
            </div>
            {draft.locations.length > 0 && (
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '12px' }}>
                {draft.locations.map((city, idx) => (
                  <div key={idx} style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    padding: '6px 12px', borderRadius: '20px',
                    background: SAND_TINT, border: `1px solid ${SAND_HAIR}`,
                    fontSize: '0.875rem', fontWeight: 600, color: C.text,
                  }}>
                    {city}
                    <button
                      type="button"
                      onClick={() => set('locations', draft.locations.filter((_, i) => i !== idx))}
                      style={{
                        background: 'none', border: 'none', color: 'inherit', cursor: 'pointer',
                        fontSize: '1.2rem', lineHeight: 1, padding: '0 4px', marginLeft: '4px',
                      }}
                    >×</button>
                  </div>
                ))}
              </div>
            )}
          </Row>

          <Row two={formTwoCol}>{Select('contentLanguage', 'Content language', LANGUAGES, 'Which language should the creator use?')}</Row>

          <Row two={formTwoCol}>{Text('budget', `Budget (${currencySymbol})`, { numeric: true })}</Row>

          <Row span={2} two={formTwoCol}>{Text('deliverables', 'Deliverables', { placeholder: 'e.g. 1 reel, 3 stories' })}</Row>

          <Row span={2} two={formTwoCol}>
            <label style={labelStyle}>Compensation type</label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {COMPENSATION.map((t) => (
                <React.Fragment key={t}>{chip(draft.compensation === t, t, () => set('compensation', t))}</React.Fragment>
              ))}
            </div>
          </Row>

          <Row two={formTwoCol}>{Select('exclusivity', 'Exclusivity', EXCLUSIVITY)}</Row>
          <Row two={formTwoCol}>{Select('usageRights', 'Usage rights', USAGE_RIGHTS)}</Row>

          <Row two={formTwoCol}>{Text('deadline', 'Application deadline', { type: 'date' })}</Row>
          <Row two={formTwoCol}>{Text('deliveryDeadline', 'Delivery deadline', { type: 'date' })}</Row>

          <Row span={2} two={formTwoCol}>
            <label style={labelStyle}>Script</label>
            <div style={{ display: 'grid', gap: '8px' }}>
              {cardChoice(draft.scriptMode === 'non_negotiable', "Non-negotiable (locked)", "You provide the exact script creators must use.", () => set('scriptMode', 'non_negotiable'))}
              {cardChoice(draft.scriptMode === 'discussion', "Collaborative (both edit)", "Both parties negotiate and edit the script together.", () => set('scriptMode', 'discussion'))}
              {cardChoice(draft.scriptMode === 'creator_freedom', "Creator freedom", "The creator has complete freedom; you review and approve.", () => set('scriptMode', 'creator_freedom'))}
            </div>

            {/* Script draft — the brand can always send a script draft to creators */}
            <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: `1px solid ${SAND_HAIR}` }}>
              <label style={labelStyle}>Send a script draft</label>
              <div style={helpStyle}>
                Attach a script draft (or paste it below) so creators know exactly what to produce. Optional, skip it and the creator writes the script.
              </div>

              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                <label
                  htmlFor="cc-script-file"
                  style={{
                    minHeight: '44px', padding: '0 16px', borderRadius: '6px', cursor: 'pointer',
                    display: 'inline-flex', alignItems: 'center', gap: '8px', fontFamily: FONT,
                    fontSize: '0.875rem', fontWeight: 600,
                    background: draft.scriptFileName ? SAND_TINT : C.surface,
                    color: draft.scriptFileName ? C.primary : C.textSecondary,
                    border: `1px solid ${draft.scriptFileName ? C.primary : SAND_HAIR}`,
                  }}
                >
                  <span aria-hidden="true">📎</span>
                  {draft.scriptFileName ? 'Replace script draft' : 'Attach script draft'}
                  <input
                    id="cc-script-file"
                    type="file"
                    accept=".txt,.docx,.pdf,.doc,.md"
                    style={{ display: 'none' }}
                    onChange={handleScriptFile}
                    onFocus={onFocus}
                    onBlur={onBlur}
                  />
                </label>
                <button
                  type="button"
                  onClick={() => setShowScriptPaste((b) => !b)}
                  style={{
                    minHeight: '44px', padding: '0 16px', borderRadius: '6px', cursor: 'pointer',
                    fontFamily: FONT, fontSize: '0.875rem', fontWeight: 600,
                    background: 'none', color: C.textSecondary,
                    border: `1px solid ${SAND_HAIR}`,
                  }}
                >
                  {showScriptPaste ? 'Hide script text' : 'Or paste script text'}
                </button>
              </div>

              {draft.scriptFileName && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px', padding: '8px 12px', borderRadius: '6px', background: SAND_TINT, border: `1px solid ${SAND_HAIR}` }}>
                  <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: C.text, wordBreak: 'break-all' }}>📄 {draft.scriptFileName}</span>
                  <button
                    type="button"
                    onClick={() => set('scriptFileName', '')}
                    style={{ marginLeft: 'auto', background: 'none', border: 'none', color: C.textMuted, cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 600, padding: '4px' }}
                  >Remove</button>
                </div>
              )}

              {(showScriptPaste || draft.scriptMode === 'non_negotiable') && (
                <div style={{ marginTop: '12px' }}>
                  {Area('scriptText',
                    draft.scriptMode === 'non_negotiable' ? 'Locked script (required)' : 'Paste your script draft',
                    draft.scriptMode === 'non_negotiable'
                      ? 'Creators must follow this exact script, paste it in full.'
                      : 'Paste the full script, every scene, line, and filming direction.',
                    draft.scriptMode === 'non_negotiable'
                      ? 'Paste the exact script creators must follow…'
                      : 'Paste your script draft here…')}
                </div>
              )}
            </div>
          </Row>

          <Row span={2} two={formTwoCol}>
            <label style={labelStyle}>Content delivery mode</label>
            <div style={{ display: 'grid', gap: '8px' }}>
              {cardChoice(draft.contentReview === 'review_required', "Review content before publish", "The creator sends a link for you to review before the final publish.", () => set('contentReview', 'review_required'))}
            </div>
          </Row>

          <Row span={2} two={formTwoCol}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '0.9375rem', fontWeight: 600, color: C.text }}>
              <input
                type="checkbox"
                checked={draft.hasDigitalRights}
                onChange={(e) => set('hasDigitalRights', e.target.checked)}
                style={{ width: '18px', height: '18px', accentColor: DEEP_SAND, cursor: 'pointer' }}
              />
              Offer separate digital &amp; ad rights
            </label>
            <div style={{ ...helpStyle, marginTop: '8px' }}>
              The creator charges extra for repurposing rights. This is in addition to the content fee.
            </div>
          </Row>

          {draft.hasDigitalRights && (
            <>
              <Row two={formTwoCol}>{Text('digitalRightsAmount', `Digital rights amount (${currencySymbol})`, { numeric: true })}</Row>
              <Row two={formTwoCol}>{Select('digitalRightsDays', 'Digital rights duration (days)', ['30', '60', '90', '120', '180', 'Perpetual'])}</Row>
              <Row two={formTwoCol}>
                <label style={labelStyle}>Reels with rights</label>
                <input
                  type="number" min={0} value={draft.digitalRightsReels}
                  onChange={(e) => set('digitalRightsReels', Math.max(0, parseInt(e.target.value || '0', 10)))}
                  onFocus={onFocus} onBlur={onBlur} style={fieldBase}
                />
              </Row>
              <Row two={formTwoCol}>
                <label style={labelStyle}>Stories with rights</label>
                <input
                  type="number" min={0} value={draft.digitalRightsStories}
                  onChange={(e) => set('digitalRightsStories', Math.max(0, parseInt(e.target.value || '0', 10)))}
                  onFocus={onFocus} onBlur={onBlur} style={fieldBase}
                />
              </Row>
            </>
          )}

          <Row span={2} two={formTwoCol}>
            <div style={{ border: `1px solid ${SAND_HAIR}`, borderRadius: '10px', padding: '16px', background: 'rgba(200,184,154,0.05)' }}>
              <div style={{ fontSize: '0.9375rem', fontWeight: 600, color: C.text, marginBottom: '4px' }}>Other information</div>
              <div style={helpStyle}>
                Extra details that help creators plan the shoot and know exactly what you expect. Optional.
              </div>

              <div style={{ marginBottom: '14px' }}>
                {Text('shootLocation', 'Shoot location', { placeholder: 'e.g. Bandra, Mumbai (studio) or Kolkata (outdoor)', help: 'Where will the shoot happen? Creators use this to check travel, time and equipment.' })}
              </div>

              <div style={{ marginBottom: '14px' }}>
                {Area('expectations', 'What you expect from the creator',
                  'Be specific, e.g. a 60s talking-head reel, walk the product through the camera, show unboxing, tag the brand page, post within 7 days.',
                  'Describe what a great result looks like for this campaign…')}
              </div>

              <div>
                {Area('otherNotes', 'Anything else',
                  'Shoot timings, equipment needed, prop/branding requests, or any other notes for creators.',
                  'Any other notes for creators…')}
              </div>
            </div>
          </Row>

          <Row span={2} two={formTwoCol}>
            <div style={{ fontSize: '0.9375rem', fontWeight: 600, color: C.text }}>Point of contact</div>
            <div style={{ ...helpStyle, marginTop: '6px', marginBottom: 0 }}>
              The person creators reference for this campaign. Shown to both parties in the deal room.
            </div>
          </Row>
          <Row two={formTwoCol}>{Text('pocName', 'Full name')}</Row>
          <Row two={formTwoCol}>{Text('pocRole', 'Role / title', { placeholder: 'e.g. Partnerships Manager' })}</Row>
          <Row two={formTwoCol}>{Text('pocEmail', 'Work email', { type: 'email' })}</Row>
          <Row two={formTwoCol}>{Text('pocPhone', 'Phone (optional)', { type: 'tel' })}</Row>

          {/* §3b — the primary action spans both columns and closes the form. */}
          <Row span={2} two={formTwoCol}>
            <button
              type="button"
              className="vs-cc-launch"
              onClick={handleLaunch}
              style={{
                width: '100%', minHeight: '52px', borderRadius: '6px', cursor: 'pointer',
                background: C.primary, color: C.onPrimary, border: 'none',
                fontFamily: FONT, fontSize: '1rem', fontWeight: 600,
                transition: reduced ? 'none' : `transform 150ms ${EASE}`,
              }}
            >
              Launch Campaign
            </button>
          </Row>
        </div>

        {/* ---- live preview (§3-0) ----
            Always the premium dark brand surface, in both themes, so it reads
            as a finished artifact even mid-draft. */}
        <aside
          style={{
            position: twoCol ? 'sticky' : 'static',
            top: twoCol ? '96px' : undefined,
            borderRadius: '16px', padding: '24px',
            background: 'linear-gradient(155deg,#0A0A0A 0%,#17150F 55%,#22201A 100%)',
            border: `1px solid rgba(200,184,154,0.22)`,
            boxShadow: '0 40px 80px -42px rgba(10,10,10,0.6)',
          }}
        >
          <div style={{ fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#8A867E', marginBottom: '16px' }}>
            Creators will see
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '18px' }}>
            <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: 'rgba(245,245,240,0.04)', border: '1px solid rgba(200,184,154,0.30)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <ValueSkinSprite size={30} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '0.9375rem', fontWeight: 600, color: '#F5F5F0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {draft.brandName || 'Your brand'}
              </div>
              <div style={{ fontSize: '0.8125rem', color: '#8A867E' }}>
                {draft.profession || 'Profession not set'}
              </div>
            </div>
          </div>

          <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#F5F5F0', lineHeight: 1.25, letterSpacing: '-0.01em' }}>
            {draft.title || 'Campaign title'}
          </div>

          <div style={{ fontSize: '0.875rem', color: '#C9C5BC', lineHeight: 1.6, marginTop: '10px' }}>
            {draft.description || 'Your description assembles here as you type.'}
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '16px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '6px 13px', borderRadius: '20px', background: WARM_SAND, color: NEAR_BLACK }}>
              {draft.compensation}
            </span>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '6px 13px', borderRadius: '20px', border: '1px solid rgba(200,184,154,0.35)', color: WARM_SAND }}>
              {draft.contentLanguage}
            </span>
          </div>

          <div style={{ height: '1px', background: 'rgba(245,245,240,0.10)', margin: '20px 0' }} />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <div style={{ fontSize: '0.6875rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: '#8A867E' }}>Budget</div>
              <div style={{ fontSize: '1.375rem', fontWeight: 700, color: '#F5F5F0', marginTop: '6px', letterSpacing: '-0.02em' }}>
                {draft.budget ? `${currencySymbol}${parseInt(draft.budget, 10).toLocaleString()}` : '-'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.6875rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: '#8A867E' }}>Deliverables</div>
              <div style={{ fontSize: '0.875rem', color: '#C9C5BC', marginTop: '6px', lineHeight: 1.5 }}>{draft.deliverables || '-'}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.6875rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: '#8A867E' }}>Deliver by</div>
              <div style={{ fontSize: '0.875rem', color: '#C9C5BC', marginTop: '6px' }}>{draft.deliveryDeadline || '-'}</div>
            </div>
          </div>

          {draft.scriptFileName || draft.scriptText.trim() ? (
            <div style={{ marginTop: '20px' }}>
              <div style={{ fontSize: '0.6875rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: '#8A867E', marginBottom: '6px' }}>Script</div>
              {draft.scriptFileName && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8125rem', fontWeight: 600, color: WARM_SAND, marginBottom: '4px' }}>
                  📎 {draft.scriptFileName}
                </div>
              )}
              {draft.scriptText.trim() && (
                <div style={{ fontSize: '0.8125rem', color: '#C9C5BC', lineHeight: 1.5 }}>
                  {draft.scriptText.trim().slice(0, 140)}{draft.scriptText.trim().length > 140 ? '…' : ''}
                </div>
              )}
            </div>
          ) : (
            <div style={{ marginTop: '20px' }}>
              <div style={{ fontSize: '0.6875rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: '#8A867E', marginBottom: '6px' }}>Script</div>
              <div style={{ fontSize: '0.8125rem', color: '#8A867E' }}>No script, creator writes it</div>
            </div>
          )}

          {(draft.shootLocation || draft.expectations || draft.otherNotes) && (
            <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid rgba(245,245,240,0.10)' }}>
              <div style={{ fontSize: '0.6875rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: '#8A867E', marginBottom: '8px' }}>Other information</div>
              {draft.shootLocation && (
                <div style={{ fontSize: '0.8125rem', color: '#C9C5BC', marginBottom: '4px' }}>
                  <span style={{ fontWeight: 600, color: '#F5F5F0' }}>Shoot:</span> {draft.shootLocation}
                </div>
              )}
              {draft.expectations && (
                <div style={{ fontSize: '0.8125rem', color: '#C9C5BC', marginBottom: '4px', lineHeight: 1.5 }}>
                  <span style={{ fontWeight: 600, color: '#F5F5F0' }}>Expectations:</span> {draft.expectations}
                </div>
              )}
              {draft.otherNotes && (
                <div style={{ fontSize: '0.8125rem', color: '#C9C5BC', lineHeight: 1.5 }}>
                  {draft.otherNotes}
                </div>
              )}
            </div>
          )}

          {escrowTotal > 0 && (
            <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid rgba(245,245,240,0.10)' }}>
              <div style={{ fontSize: '0.6875rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: '#8A867E' }}>Total escrow required</div>
              <div style={{ fontSize: '1.375rem', fontWeight: 700, color: DEEP_SAND, marginTop: '6px', letterSpacing: '-0.02em' }}>
                {currencySymbol}{escrowTotal.toLocaleString()}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#8A867E', marginTop: '4px' }}>
                Held in escrow, released on approval.
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
