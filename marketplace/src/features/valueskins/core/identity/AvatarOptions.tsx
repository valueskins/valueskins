'use client';

import { useState, useRef, useCallback } from 'react';
import type { IdentityAttestation, AttestationCategory, CredentialDisplayConfiguration } from '@/lib/credential-protocol';
import { createAttestation, computeAuthenticityIndex, entryToAttestation, attestationToEntry, DEFAULT_DISPLAY_CONFIG } from '@/lib/credential-protocol';
import { STICKER_MANIFEST } from '@/features/valueskins/core/stickers/sticker-manifest';

//  Types 

export type ValueSkinSlot = 'profession';

export const SLOT_LABELS: Record<ValueSkinSlot, string> = {
  profession: 'Profession',
};

export const SLOT_COLORS: Record<ValueSkinSlot, string> = {
  profession: '#0066CC',
};

// Map of slot → active profession name + editable About Me text
// The optional `attestation` field links to the full credential protocol
// artifact for verification, federation, and trust scoring.
// Custom image and pitch video are used for the hover preview card.
export interface ValueSkinEntry {
  profession: string;
  aboutMe: string;
  attestation?: IdentityAttestation;
  customImage?: string;
  pitchVideoUrl?: string;
}

export type ValueSkinMap = Partial<Record<ValueSkinSlot, ValueSkinEntry>>;

export interface ProfessionBadge {
  id: string;
  label: string;
  abbreviation: string;
  color: string;
  stickerImage?: string;
  emoji?: string;
}

//  Profession Definitions 

// Source of truth for Systems 2 & 3 (campaign targeting + creator registration).
// EXACTLY 7 niches — the platform is intentionally focused on these.
export const PROFESSION_BADGES: Record<string, ProfessionBadge> = {
  'Fashion & Beauty':        { id: 'fab',  label: 'Fashion & Beauty',        abbreviation: 'F&B', color: '#E91E63', emoji: '' },
  'Food':                    { id: 'food', label: 'Food',                    abbreviation: 'FOOD', color: '#E65100', emoji: '' },
  'Travel':                  { id: 'trvl', label: 'Travel',                  abbreviation: 'TRVL', color: '#01579B', emoji: '' },
  'Music':                   { id: 'mus',  label: 'Music',                   abbreviation: 'MUS', color: '#C62828', emoji: '' },
  'Tech':                    { id: 'tech', label: 'Tech',                    abbreviation: 'TECH', color: '#0066CC', emoji: '' },
  'Education':               { id: 'edu',  label: 'Education',               abbreviation: 'EDU', color: '#1565C0', emoji: '' },
  'Comedy & Entertainment':  { id: 'com',  label: 'Comedy & Entertainment',  abbreviation: 'C&E', color: '#FF6F00', emoji: '' },
};

// Brand-category badges (Type 1 ValueSkins) — mirrors PROFESSIONS keys in MarketplaceDemoPage.tsx
// EXACTLY 7 categories — named DISTINCTLY from creator professions (Systems 2/3).
export const BRAND_CATEGORY_BADGES: Record<string, ProfessionBadge> = {
  'Fashion & Beauty Organisation':  { id: 'faborg',  label: 'Fashion & Beauty Organisation',  abbreviation: 'F&B', color: '#E91E63' },
  'F&B Organisation':               { id: 'fnborg',  label: 'F&B Organisation',               abbreviation: 'F&B', color: '#E65100' },
  'Travel Organisation':            { id: 'trvorg',  label: 'Travel Organisation',            abbreviation: 'TRVL', color: '#01579B' },
  'Music Organisation':             { id: 'musorg',  label: 'Music Organisation',             abbreviation: 'MUS', color: '#C62828' },
  'Tech Organisation':              { id: 'tchorg',  label: 'Tech Organisation',              abbreviation: 'TECH', color: '#0066CC' },
  'Education Organisation':         { id: 'eduorg',  label: 'Education Organisation',         abbreviation: 'EDU', color: '#1565C0' },
  'Entertainment Organisation':     { id: 'entorg',  label: 'Entertainment Organisation',     abbreviation: 'ENT', color: '#FF6F00' },
};

//  Default About Me text per profession 

export function defaultAboutMe(profession: string): string {
  const defaults: Record<string, string> = {
    'Fashion & Beauty': 'Fashion & beauty that turns heads and drives sales. We create content that showcases your style and makes people stop scrolling.',
    'Food': 'Great food, beautifully told. We create content that makes people hungry and drives foot traffic to your doors.',
    'Travel': 'Boutique experiences worth traveling for. We create content that makes people book, wander, and share.',
    'Music': 'Sound that moves people. We create content that makes audiences listen, follow, and show up.',
    'Tech': 'Product-led storytelling for modern technology. We partner with brands who can explain complex products simply.',
    'Education': 'Learning that people actually finish. We create content that makes complex topics clear and enrollments climb.',
    'Comedy & Entertainment': 'Content people watch twice. We create entertainment that keeps audiences laughing, sharing, and coming back.',
    'Restaurant': 'Modern restaurant bringing bold flavors and unforgettable dining experiences. We create content that makes people hungry and drives foot traffic.',
    'Cafe': 'Neighborhood cafe crafting specialty coffee and artisanal pastries. Warm atmosphere, quality ingredients, and a loyal community of regulars.',
    'Boutique': 'Curated boutique offering handpicked fashion and accessories. We tell stories through style and connect with customers who love unique finds.',
    'Hotel': 'Boutique hotel delivering memorable stays with personalized service. Every detail designed to create share-worthy guest experiences.',
    'Gym': 'Modern fitness facility focused on results-driven training. We help people transform their health through innovative programs.',
    'SaaS Company': 'B2B SaaS platform solving real problems for real businesses. We partner with creators who can explain complex products simply.',
    'Cosmetics Brand': 'Clean beauty brand committed to ingredients you can trust. We believe in real beauty, real results, and real transparency.',
    'Lifestyle': 'Everyday life, shot beautifully. I create authentic lifestyle content that feels real and connects brands with real people.',
  };
  return defaults[profession] ?? `${profession}, click Edit to write your brand story and explain what makes you unique.`;
}

//  Profession Sticker (clickable — opens About Me panel) 
// Shows badge abbreviation + a tiny slot label underneath.

export function ProfessionSticker({
  profession,
  slot,
  size = 'default',
  valueSkins,
  onValueSkinsChange,
  clickable = true,
  level,
  hideSlotLabel,
}: {
  profession: string;
  slot: ValueSkinSlot;
  size?: 'small' | 'default' | 'large';
  valueSkins?: ValueSkinMap;
  onValueSkinsChange?: (updated: ValueSkinMap) => void;
  clickable?: boolean;
  level?: number;
  hideSlotLabel?: boolean;
}) {
  const defined = PROFESSION_BADGES[profession] ?? BRAND_CATEGORY_BADGES[profession];
  const badge: ProfessionBadge = defined ?? {
    id: profession.toLowerCase().replace(/\s+/g, '_'),
    label: profession,
    abbreviation: profession.split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 3),
    color: SLOT_COLORS[slot],
  };
  const [showPanel, setShowPanel] = useState(false);

  const badgeDims   = { small: 20, default: 24, large: 32 };
  const badgeFonts  = { small: '7px', default: '8px', large: '10px' };
  const labelFonts  = { small: '6px', default: '7px', large: '8px' };
  const dim         = badgeDims[size];
  const fontSize    = badgeFonts[size];
  const labelSize   = labelFonts[size];

  const handleAboutMeChange = (text: string) => {
    if (!onValueSkinsChange || !valueSkins) return;
    onValueSkinsChange({
      ...valueSkins,
      [slot]: { profession, aboutMe: text },
    });
  };

  const currentAboutMe = valueSkins?.[slot]?.aboutMe ?? defaultAboutMe(profession);

  return (
    <>
      <div
        title={clickable ? `${hideSlotLabel ? '' : SLOT_LABELS[slot] + ': '}${badge.label}, click to view` : badge.label}
        onClick={clickable ? () => setShowPanel(true) : undefined}
        style={{
          display: 'inline-flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '2px',
          cursor: clickable ? 'pointer' : 'default',
          flexShrink: 0,
        }}
      >
        {/* Sticker — no shape, no border, no background. Just the raw icon floating free. */}
        {(badge.stickerImage || STICKER_MANIFEST[profession]) ? (
          <img
            src={badge.stickerImage || STICKER_MANIFEST[profession]}
            alt={badge.label}
            draggable={false}
            style={{ width: `${dim}px`, height: `${dim}px`, objectFit: 'contain', display: 'block', flexShrink: 0 }}
          />
        ) : (
          <span style={{ fontSize, fontWeight: 700, color: badge.color, letterSpacing: '-0.3px', lineHeight: 1, flexShrink: 0 }}>
            {badge.abbreviation}
          </span>
        )}
      </div>

      {showPanel && (
        <AboutMePanel
          slot={slot}
          profession={profession}
          badge={badge}
          valueSkins={valueSkins ?? {}}
          onValueSkinsChange={onValueSkinsChange}
          onClose={() => setShowPanel(false)}
          level={level}
          hideSlotLabel={hideSlotLabel}
        />
      )}
    </>
  );
}

function AboutMePanel({
  slot: initialSlot,
  profession,
  badge,
  valueSkins,
  onValueSkinsChange,
  onClose,
  level,
  hideSlotLabel,
}: {
  slot: ValueSkinSlot;
  profession: string;
  badge: ProfessionBadge;
  valueSkins: ValueSkinMap;
  onValueSkinsChange?: (updated: ValueSkinMap) => void;
  onClose: () => void;
  level?: number;
  hideSlotLabel?: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [customImageUrl, setCustomImageUrl] = useState('');
  const [pitchVideoUrl, setPitchVideoUrl] = useState('');

  const s: ValueSkinSlot = 'profession';
  const entry = valueSkins[s];
  const slotBadge = entry ? (PROFESSION_BADGES[entry.profession] ?? BRAND_CATEGORY_BADGES[entry.profession]) : undefined;

  const startEdit = () => {
    setDraft(entry?.aboutMe ?? defaultAboutMe(entry?.profession ?? ''));
    setCustomImageUrl(entry?.customImage ?? '');
    setPitchVideoUrl(entry?.pitchVideoUrl ?? '');
    setIsEditing(true);
  };

  const save = () => {
    if (!onValueSkinsChange) return;
    onValueSkinsChange({
      ...valueSkins,
      [s]: {
        ...(valueSkins[s] || { profession, aboutMe: '' }),
        aboutMe: draft,
        customImage: customImageUrl || undefined,
        pitchVideoUrl: pitchVideoUrl || undefined,
      },
    });
    setIsEditing(false);
  };

  const discard = () => setIsEditing(false);

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.82)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        zIndex: 9999,
      }}
    >
      <div style={{
        width: '100%', maxWidth: '600px',
        background: '#141414',
        borderRadius: '16px 16px 0 0',
        border: '1px solid #262626',
        borderBottom: 'none',
        padding: '24px',
        maxHeight: '85vh',
        overflowY: 'auto',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: '17px', color: '#E0E0E0' }}>About Me</div>
            <div style={{ fontSize: '12px', color: '#555', marginTop: '2px' }}>
              Your ValueSkin profile details
            </div>
          </div>
          {level !== undefined && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              background: 'rgba(0,102,204,0.1)', borderRadius: '10px',
              padding: '8px 14px', marginRight: '12px',
            }}>
              <div style={{ display: 'flex', gap: '3px' }}>
                {[1, 2, 3, 4, 5].map(i => (
                  <div key={i} style={{
                    width: '14px', height: '5px', borderRadius: '3px',
                    background: i <= level ? '#0066CC' : '#333',
                  }} />
                ))}
              </div>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#0066CC' }}>
                LVL {level}
              </span>
            </div>
          )}
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#555', fontSize: '22px', cursor: 'pointer', lineHeight: 1 }}
          >
            ×
          </button>
        </div>

        {!entry ? (
          <div style={{
            marginBottom: '16px', padding: '14px',
            background: '#1A1A1A', borderRadius: '10px',
            border: '1px solid #262626',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              {!hideSlotLabel && (
                <span style={{
                  fontSize: '10px', fontWeight: 700, letterSpacing: '0.8px',
                  textTransform: 'uppercase', color: SLOT_COLORS[s],
                }}>
                  {SLOT_LABELS[s]}
                </span>
              )}
            </div>
            <div style={{ fontSize: '13px', color: '#444', fontStyle: 'italic' }}>
              No {hideSlotLabel ? 'badge' : SLOT_LABELS[s].toLowerCase()} active.
            </div>
          </div>
        ) : (
          <div style={{
            marginBottom: '16px', padding: '14px',
            background: '#1A1A1A', borderRadius: '10px',
            border: `1px solid ${isEditing ? '#0066CC' : '#262626'}`,
            transition: 'border-color 0.15s',
          }}>
            {/* Slot header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              {slotBadge && (
                (slotBadge.stickerImage || STICKER_MANIFEST[entry.profession]) ? (
                  <img
                    src={slotBadge.stickerImage || STICKER_MANIFEST[entry.profession]}
                    alt={slotBadge.label}
                    draggable={false}
                    style={{ width: '28px', height: '28px', borderRadius: '7px', imageRendering: 'pixelated', flexShrink: 0 }}
                  />
                ) : (
                  <div style={{
                    width: '28px', height: '28px', borderRadius: '7px',
                    background: slotBadge.color,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <span style={{ color: '#fff', fontSize: '8px', fontWeight: 700 }}>
                      {slotBadge.abbreviation}
                    </span>
                  </div>
                )
              )}
              <div>
                {!hideSlotLabel && (
                  <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase', color: SLOT_COLORS[s] }}>
                    {SLOT_LABELS[s]}
                  </div>
                )}
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#C0C0C0' }}>
                  {entry.profession}
                </div>
              </div>
              {!isEditing && onValueSkinsChange && (
                <button
                  onClick={startEdit}
                  style={{
                    marginLeft: 'auto', padding: '5px 10px',
                    background: 'transparent', border: '1px solid #333',
                    borderRadius: '6px', color: '#666', fontSize: '12px',
                    fontWeight: 600, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: '4px',
                  }}
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                  Edit
                </button>
              )}
            </div>

              {/* About Me text or textarea */}
              {isEditing ? (
                <>
                  <label style={{ display: 'block', marginBottom: '10px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#666', textTransform: 'uppercase', marginBottom: '4px', letterSpacing: '0.5px' }}>About Me</div>
                    <textarea
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      autoFocus
                      style={{
                        width: '100%', minHeight: '80px',
                        background: '#111', border: '1px solid #0066CC',
                        borderRadius: '8px', color: '#E0E0E0',
                        fontSize: '13px', lineHeight: '1.6',
                        padding: '10px', fontFamily: 'inherit',
                        resize: 'vertical', outline: 'none', boxSizing: 'border-box',
                      }}
                    />
                  </label>

                  <label style={{ display: 'block', marginBottom: '10px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#666', textTransform: 'uppercase', marginBottom: '4px', letterSpacing: '0.5px' }}>Custom Image (Hover Card)</div>
                    <input
                      type="text"
                      placeholder="Paste image URL (JPG/PNG)"
                      value={customImageUrl}
                      onChange={(e) => setCustomImageUrl(e.target.value)}
                      style={{
                        width: '100%', padding: '8px',
                        background: '#111', border: '1px solid #333',
                        borderRadius: '6px', color: '#E0E0E0',
                        fontSize: '12px', boxSizing: 'border-box', outline: 'none',
                      }}
                    />
                    {customImageUrl && (
                      <div style={{ marginTop: '6px', borderRadius: '6px', overflow: 'hidden', height: '100px' }}>
                        <img src={customImageUrl} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                    )}
                  </label>

                  <label style={{ display: 'block', marginBottom: '10px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#666', textTransform: 'uppercase', marginBottom: '4px', letterSpacing: '0.5px' }}>Pitch Video URL (Why Hire You)</div>
                    <input
                      type="text"
                      placeholder="Paste video URL (MP4/WebM)"
                      value={pitchVideoUrl}
                      onChange={(e) => setPitchVideoUrl(e.target.value)}
                      style={{
                        width: '100%', padding: '8px',
                        background: '#111', border: '1px solid #333',
                        borderRadius: '6px', color: '#E0E0E0',
                        fontSize: '12px', boxSizing: 'border-box', outline: 'none',
                      }}
                    />
                    {pitchVideoUrl && (
                      <div style={{ marginTop: '6px', borderRadius: '6px', overflow: 'hidden', height: '120px' }}>
                        <video src={pitchVideoUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} controls />
                      </div>
                    )}
                  </label>

                  <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                    <button
                      onClick={save}
                      style={{
                        flex: 1, padding: '8px', background: '#0066CC',
                        border: 'none', borderRadius: '7px', color: '#fff',
                        fontWeight: 600, fontSize: '13px', cursor: 'pointer',
                      }}
                    >
                      Save
                    </button>
                    <button
                      onClick={discard}
                      style={{
                        padding: '8px 14px', background: '#1A1A1A',
                        border: '1px solid #333', borderRadius: '7px',
                        color: '#888', fontWeight: 600, fontSize: '13px', cursor: 'pointer',
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p style={{ color: '#AAA', fontSize: '13px', lineHeight: '1.7', margin: '0 0 12px', whiteSpace: 'pre-wrap' }}>
                    {entry.aboutMe}
                  </p>
                  {entry.customImage && (
                    <div style={{ borderRadius: '6px', overflow: 'hidden', height: '60px', marginBottom: '8px' }}>
                      <img src={entry.customImage} alt="card" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                  )}
                  {entry.pitchVideoUrl && (
                    <div style={{ fontSize: '12px', color: '#0066CC', fontWeight: 600 }}>
                       Pitch video attached
                    </div>
                  )}
                </>
              )}
            </div>
        )}
      </div>
    </div>
  );
}

//  Profile Card Display — custom hover preview 

export function ProfileCardDisplay({
  valueSkins,
  onValueSkinsChange,
  displayName,
  level,
}: {
  valueSkins: ValueSkinMap;
  onValueSkinsChange?: (updated: ValueSkinMap) => void;
  displayName: string;
  level?: number;
}) {
  const professionEntry = valueSkins.profession;
  if (!professionEntry?.customImage) return null;

  const [showCard, setShowCard] = useState(false);

  return (
    <>
      <div
        onMouseEnter={() => setShowCard(true)}
        onMouseLeave={() => setShowCard(false)}
        style={{
          position: 'relative',
          cursor: 'pointer',
          width: '120px',
          height: '140px',
          borderRadius: '8px',
          overflow: 'hidden',
          border: '2px solid rgba(0,102,204,0.4)',
          background: '#1A1A1A',
          flexShrink: 0,
        }}
      >
        <img
          src={professionEntry.customImage}
          alt={displayName}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block',
          }}
        />
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: showCard ? 0 : 1,
          transition: 'opacity 0.2s',
        }}>
          <span style={{ fontSize: '32px' }}></span>
        </div>
      </div>

      {showCard && (
        <ProfileCardPreview
          valueSkins={valueSkins}
          onValueSkinsChange={onValueSkinsChange}
          displayName={displayName}
          level={level}
          onClose={() => setShowCard(false)}
        />
      )}
    </>
  );
}

//  Profile Card Preview (hover modal) 

function ProfileCardPreview({
  valueSkins,
  onValueSkinsChange,
  displayName,
  level,
  onClose,
}: {
  valueSkins: ValueSkinMap;
  onValueSkinsChange?: (updated: ValueSkinMap) => void;
  displayName: string;
  level?: number;
  onClose: () => void;
}) {
  const professionEntry = valueSkins.profession;
  if (!professionEntry) return null;

  return (
    <div
      onMouseLeave={onClose}
      style={{
        position: 'fixed',
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 10000,
        animation: 'fadeIn 0.2s ease-out',
      }}
    >
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translate(-50%, -48%); }
          to { opacity: 1; transform: translate(-50%, -50%); }
        }
      `}</style>

      <div style={{
        width: '100%',
        maxWidth: '480px',
        background: '#141414',
        borderRadius: '16px',
        border: '1px solid #262626',
        overflow: 'hidden',
        boxShadow: '0 20px 60px rgba(0,0,0,0.8)',
      }}>
        {/* Image Section */}
        {professionEntry.customImage && (
          <div style={{
            width: '100%',
            height: '280px',
            overflow: 'hidden',
            background: '#0A0A0A',
          }}>
            <img
              src={professionEntry.customImage}
              alt={displayName}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                display: 'block',
              }}
            />
          </div>
        )}

        {/* Content Section */}
        <div style={{ padding: '24px' }}>
          {/* Header */}
          <div style={{ marginBottom: '16px' }}>
            <h3 style={{ margin: '0 0 4px', fontSize: '18px', fontWeight: 700, color: '#E0E0E0' }}>
              {displayName}
            </h3>
            <p style={{ margin: 0, fontSize: '13px', color: '#0066CC', fontWeight: 600 }}>
              {professionEntry.profession}
            </p>
          </div>

          {/* About Me */}
          <p style={{
            fontSize: '13px',
            lineHeight: '1.6',
            color: '#AAA',
            margin: '0 0 16px',
            maxHeight: '80px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            {professionEntry.aboutMe}
          </p>

          {/* Video Section */}
          {professionEntry.pitchVideoUrl && (
            <div style={{
              marginBottom: '16px',
              borderRadius: '8px',
              overflow: 'hidden',
              background: '#1A1A1A',
              border: '1px solid #262626',
            }}>
              <video
                src={professionEntry.pitchVideoUrl}
                controls
                style={{
                  width: '100%',
                  height: '180px',
                  objectFit: 'cover',
                  display: 'block',
                  background: '#000',
                }}
              />
            </div>
          )}

          {/* Edit Button (only for owner) */}
          {onValueSkinsChange && (
            <button
              onClick={() => {
                // Could trigger edit mode here if needed
              }}
              style={{
                width: '100%',
                padding: '10px',
                background: '#0066CC',
                border: 'none',
                borderRadius: '8px',
                color: '#fff',
                fontWeight: 600,
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              View Full Profile
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function ValueSkinStickers({
  valueSkins,
  onValueSkinsChange,
  size = 'default',
  level,
  onSkinClick,
  hideSlotLabel,
}: {
  valueSkins: ValueSkinMap;
  onValueSkinsChange?: (updated: ValueSkinMap) => void;
  size?: 'small' | 'default' | 'large';
  level?: number;
  onSkinClick?: (profession: string) => void;
  hideSlotLabel?: boolean;
}) {
  const s: ValueSkinSlot = 'profession';
  const entry = valueSkins[s];
  if (!entry) return null;

  return (
    <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-start', flexShrink: 0 }}>
      <div key={s} onClick={onSkinClick ? (e) => { e.stopPropagation(); onSkinClick(entry.profession); } : undefined} style={onSkinClick ? { cursor: 'pointer' } : undefined}>
        <ProfessionSticker
          profession={entry.profession}
          slot={s}
          size={size}
          valueSkins={valueSkins}
          onValueSkinsChange={onValueSkinsChange}
          level={level}
          clickable={!onSkinClick}
          hideSlotLabel={hideSlotLabel}
        />
      </div>
    </div>
  );
}

//  Valueskins Avatar Overlay (shown in long-press viewer) 

export function ValueskinAvatarOverlay({
  level,
  valueSkins,
  size = 220,
}: {
  level: number;
  valueSkins?: ValueSkinMap;
  size?: number;
}) {
  const professionEntry = valueSkins?.profession;
  const badge = professionEntry ? (PROFESSION_BADGES[professionEntry.profession] ?? BRAND_CATEGORY_BADGES[professionEntry.profession]) : null;

  return (
    <div style={{
      width: `${size}px`, height: `${size}px`, borderRadius: '50%',
      background: '#0066CC',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      color: '#fff', border: '3px solid #2A2A2A',
      boxShadow: '0 2px 24px rgba(0,60,120,0.45)',
      userSelect: 'none',
    }}>
      <svg width={size * 0.28} height={size * 0.28} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
      </svg>
      <span style={{ fontSize: `${Math.max(size * 0.1, 10)}px`, fontWeight: 700, letterSpacing: '0.5px', marginTop: '4px', textTransform: 'uppercase' }}>
        Level {level}
      </span>
      {badge && (
        <span style={{ fontSize: `${Math.max(size * 0.07, 9)}px`, fontWeight: 600, marginTop: '2px', opacity: 0.85 }}>
          {badge.abbreviation}
        </span>
      )}
    </div>
  );
}

//  Long-Press Avatar Viewer 

export function AvatarLongPressViewer({
  visible,
  onClose,
  showValueskinAvatar,
  level,
  valueSkins,
  avatarUrl,
  displayName,
  onValueSkinsChange,
}: {
  visible: boolean;
  onClose: () => void;
  showValueskinAvatar: boolean;
  level: number;
  valueSkins: ValueSkinMap;
  avatarUrl: string;
  displayName: string;
  onValueSkinsChange?: (updated: ValueSkinMap) => void;
}) {
  if (!visible) return null;

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        zIndex: 9999, cursor: 'pointer',
      }}
    >
      <button onClick={onClose} style={{ position: 'absolute', top: '20px', right: '20px', background: 'none', border: 'none', color: '#555', fontSize: '28px', cursor: 'pointer', lineHeight: 1 }}>
        ×
      </button>

      <div style={{ marginBottom: '20px' }}>
        {showValueskinAvatar ? (
          <ValueskinAvatarOverlay level={level} valueSkins={valueSkins} size={220} />
        ) : (
          <img src={avatarUrl} alt={displayName} style={{ width: '220px', height: '220px', borderRadius: '50%', border: '3px solid rgba(255,255,255,0.12)', objectFit: 'cover' }} />
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
        <span style={{ color: '#E0E0E0', fontSize: '18px', fontWeight: 600 }}>{displayName}</span>
        <ValueSkinStickers valueSkins={valueSkins} onValueSkinsChange={onValueSkinsChange} size="large" />
      </div>

      {showValueskinAvatar && (
        <div style={{ fontSize: '12px', color: '#0066CC', fontWeight: 600, marginBottom: '4px' }}>
          Valueskins Avatar Active
        </div>
      )}
      <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '12px', marginTop: '4px' }}>
        Tap outside to close
      </span>
    </div>
  );
}

//  Profile Photo with Long-Press Detection 

const LONG_PRESS_MS = 400;

export function ProfilePhotoWithLongPress({
  showValueskinAvatar,
  level,
  valueSkins,
  avatarUrl,
  displayName,
  size = 86,
  onValueSkinsChange,
}: {
  showValueskinAvatar: boolean;
  level: number;
  valueSkins: ValueSkinMap;
  avatarUrl: string;
  displayName: string;
  size?: number;
  onValueSkinsChange?: (updated: ValueSkinMap) => void;
}) {
  const [showViewer, setShowViewer] = useState(false);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didLongPress = useRef(false);

  const startPress = useCallback(() => {
    didLongPress.current = false;
    pressTimer.current = setTimeout(() => {
      didLongPress.current = true;
      setShowViewer(true);
    }, LONG_PRESS_MS);
  }, []);

  const endPress = useCallback(() => {
    if (pressTimer.current) { clearTimeout(pressTimer.current); pressTimer.current = null; }
  }, []);

  const cancelPress = useCallback(() => {
    if (pressTimer.current) { clearTimeout(pressTimer.current); pressTimer.current = null; }
  }, []);

  const hasAnyValueSkin = Object.keys(valueSkins).length > 0;

  return (
    <>
      <div
        onMouseDown={startPress} onMouseUp={endPress} onMouseLeave={cancelPress}
        onTouchStart={startPress} onTouchEnd={endPress} onTouchCancel={cancelPress}
        style={{ cursor: 'pointer', userSelect: 'none', WebkitUserSelect: 'none', touchAction: 'none', position: 'relative' }}
      >
        {/* Profile photo — always the real photo */}
        <img
          src={avatarUrl} alt={displayName} draggable={false}
          style={{
            width: `${size}px`, height: `${size}px`, borderRadius: '50%',
            border: '2px solid #333',
            objectFit: 'cover',
          }}
        />
        {/* Small Valueskins indicator when avatar mode is active */}
        {showValueskinAvatar && (
          <div style={{
            position: 'absolute', bottom: 0, right: 0,
            width: `${Math.round(size * 0.28)}px`, height: `${Math.round(size * 0.28)}px`,
            borderRadius: '50%', background: '#0066CC', border: '2px solid #0A0A0A',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width={Math.round(size * 0.14)} height={Math.round(size * 0.14)} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
        )}
      </div>

      <AvatarLongPressViewer
        visible={showViewer} onClose={() => setShowViewer(false)}
        showValueskinAvatar={showValueskinAvatar}
        level={level} valueSkins={valueSkins} avatarUrl={avatarUrl} displayName={displayName}
        onValueSkinsChange={onValueSkinsChange}
      />
    </>
  );
}

//  Valueskins Avatar Toggle 

export function ValueskinAvatarToggle({
  enabled,
  onChange,
}: {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <span style={{ fontSize: '13px', fontWeight: 600, color: '#E0E0E0', marginBottom: '2px' }}>
        Valueskins Avatar
      </span>
      <p style={{ fontSize: '12px', color: '#666', margin: '0 0 8px', lineHeight: 1.5 }}>
        When enabled, long-pressing your profile shows your Valueskins badge instead of the Instagram animated avatar. Your profile photo is never changed.
      </p>
      {(['default', 'valueskins'] as const).map((opt) => {
        const active = opt === 'valueskins' ? enabled : !enabled;
        return (
          <label key={opt} style={{
            display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '12px',
            borderRadius: '8px', cursor: 'pointer',
            border: `2px solid ${active ? '#0066CC' : '#333'}`,
            background: active ? 'rgba(0,102,204,0.08)' : '#1A1A1A',
            transition: 'all 0.15s',
          }}>
            <input
              type="radio" name="valueskin-avatar"
              checked={active} onChange={() => onChange(opt === 'valueskins')}
              style={{ marginTop: '2px', accentColor: '#0066CC' }}
            />
            <div>
              <div style={{ fontWeight: 600, fontSize: '14px', color: '#E0E0E0' }}>
                {opt === 'default' ? 'Default Avatar' : 'Valueskins Avatar'}
              </div>
              <div style={{ fontSize: '12px', color: '#888', lineHeight: 1.4, marginTop: '2px' }}>
                {opt === 'default'
                  ? 'Instagram shows your standard animated avatar on long-press.'
                  : 'Long-press shows your Valueskins verified level badge instead.'}
              </div>
            </div>
          </label>
        );
      })}
    </div>
  );
}
