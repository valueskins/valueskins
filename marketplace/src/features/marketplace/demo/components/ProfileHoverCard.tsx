'use client';

import React from 'react';
import { PROFESSION_BADGES, BRAND_CATEGORY_BADGES, defaultAboutMe } from '@/features/valueskins/core/identity/AvatarOptions';
import { getLevel, getLevelInfo, getProgressToNext } from '@/lib/levels';
import { STICKER_MANIFEST } from '@/features/valueskins/core/stickers/sticker-manifest';

function getStickerForProfession(profession: string): string | undefined {
  return PROFESSION_BADGES[profession]?.stickerImage || BRAND_CATEGORY_BADGES[profession]?.stickerImage || STICKER_MANIFEST[profession];
}

// Instagram / Virtual Resume data as documented for Meta Graph API review.
// - instagram_business_basic      -> basic profile fields below (rendered on the resume).
// - instagram_business_manage_insights -> analytics block rendered directly below it.
export type HoverInstagram = {
  username?: string;
  name?: string;
  accountType?: string;
  followers?: number;
  posts?: number;
  following?: number;
  bio?: string;
  website?: string;
  verified?: boolean;
  insights?: {
    reach?: number;
    impressions?: number;
    engagementRate?: number;
    profileViews?: number;
    syncedAt?: string;
  };
};

type HoverProfile = {
  role: 'brand' | 'creator';
  name: string;
  skin?: string;
  bio?: string;
  avatarUrl?: string;
  instagram?: HoverInstagram;
  // Shared fields
  location?: string;
  email?: string;
  // Brand fields
  brandProfileSelections?: Record<string, string>;
  brandValueSkins?: string[];
  address?: string;
  whatTheyDo?: string;
  // Creator fields
  aboutMe?: string;
  height?: string;
  metrics?: {
    followers: number;
    engagement: number;
    dealsCompleted: number;
    avgDealValue: number;
    onTimeRate: number;
    brandRating: number;
  };
  rateCard?: { reel?: string; story?: string; post?: string; podcast?: string; live?: string };
  completedDeals?: number;
  portfolioImage?: string | null;
  availableFrom?: string;
  selectedCountry?: string;
};

const C = {
  primary: '#0A0A0A',
  bg: 'var(--c-surface-lowest)',
  surface: '#F5F5F0',
  surfaceAlt: '#f1f5f9',
  card: 'var(--c-surface-lowest)',
  text: '#0A0A0A',
  textSecondary: 'var(--c-text-muted)',
  textMuted: '#B8B4AC',
  border: '#E0E0DA',
  success: 'var(--c-accent)',
};

function fmt(n: number | undefined): string {
  if (typeof n !== 'number' || !isFinite(n) || n <= 0) return '0';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 10_000) return `${Math.round(n / 1000)}K`;
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}K`;
  return String(Math.round(n));
}

// The insights footer shows when data was last pulled from Meta. ISO
// timestamps from the sync endpoint render as relative time; sample strings
// ("2h ago (sample)") pass through untouched.
function relSync(t?: string): string {
  if (!t) return 'synced at login';
  const fresh = Date.now() - new Date(t).getTime();
  if (!isFinite(fresh)) return t;
  if (fresh < 0) return 'synced just now';
  const mins = Math.floor(fresh / 60000);
  if (mins < 1) return 'synced just now';
  if (mins < 60) return `synced ${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `synced ${hrs}h ago`;
  return `synced ${Math.floor(hrs / 24)}d ago`;
}

// The two statement banners are shown verbatim on the resume so Meta App
// Review can map each requested permission to the surface that uses it.
const IG_BASIC_NOTE =
  'After the creator logs in with Instagram, the authorized account\x27s basic profile data is displayed here on their Virtual Resume: Instagram username, account type, profile picture, follower count, post count, and bio. This data is read at login and rendered on this profile page.';
const IG_INSIGHTS_NOTE =
  'Directly below the basic profile, the creator\x27s Instagram analytics are displayed on the same Virtual Resume: reach, impressions, engagement, and profile views. These insights give brands an accurate view of the creator\x27s performance, and they are read from the authorized account only.';

export function InstagramResumeBlock({ ig }: { ig: HoverInstagram }) {
  // Only render stats we actually have — a connected real account may not
  // expose "following", and miss a media count until first sync.
  const igStats: { label: string; value: string }[] = [
    ig.followers != null && { label: 'Followers', value: fmt(ig.followers) },
    ig.posts != null && { label: 'Posts', value: fmt(ig.posts) },
    ig.following != null && { label: 'Following', value: fmt(ig.following) },
  ].filter(Boolean) as { label: string; value: string }[];
  const insights = [
    { label: 'Reach', value: fmt(ig.insights?.reach || 0) },
    { label: 'Impressions', value: fmt(ig.insights?.impressions || 0) },
    { label: 'Engagement', value: `${ig.insights?.engagementRate ?? 0}%` },
    { label: 'Profile Views', value: fmt(ig.insights?.profileViews || 0) },
  ];
  const isBusiness = (ig.accountType || '').toUpperCase() === 'BUSINESS';

  return (
    <div style={{
      marginBottom: '10px',
      borderRadius: '10px',
      overflow: 'hidden',
      border: '1px solid rgba(225,48,108,0.28)',
      background: '#FFF',
    }}>
      {/* Instagram header */}
      <div style={{
        padding: '8px 10px',
        background: 'linear-gradient(135deg, #F58529 0%, #DD2A7B 50%, #8134AF 100%)',
        display: 'flex', alignItems: 'center', gap: '8px',
      }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
          <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
          <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
        </svg>
        <span style={{ fontSize: '11px', fontWeight: 800, color: '#fff', letterSpacing: '0.4px', textTransform: 'uppercase' }}>
          Instagram · Virtual Resume
        </span>
      </div>

      {/* instagram_business_basic banner + data */}
      <div style={{ padding: '10px 10px 4px' }}>
        <div style={{
          padding: '6px 8px', borderRadius: '6px',
          background: 'rgba(0,102,204,0.06)', border: '1px solid rgba(0,102,204,0.18)',
          fontSize: '10.5px', lineHeight: 1.45, color: '#334', marginBottom: '8px',
        }}>
          <span style={{ fontWeight: 800, color: '#0066CC', fontFamily: 'monospace' }}>instagram_business_basic</span>
          <span style={{ color: '#667' }}>, {IG_BASIC_NOTE}</span>
        </div>

        {/* Basic profile row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
          <div style={{
            width: '40px', height: '40px', borderRadius: '50%', overflow: 'hidden', flexShrink: 0,
            background: 'linear-gradient(135deg, #F58529, #DD2A7B, #8134AF)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: '16px', fontWeight: 800,
          }}>
            <span style={{
              width: '34px', height: '34px', borderRadius: '50%', background: '#141414',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {(ig.name || ig.username || '?').charAt(0).toUpperCase()}
            </span>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#0A0A0A', display: 'flex', alignItems: 'center', gap: '5px' }}>
              @{ig.username || 'creator'}
              {ig.verified && (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="#0066CC" aria-label="Verified">
                  <path d="M12 1.5l2.6 1.9 3.2-.3 1 3.1 2.9 1.5-.8 3.1 1.8 2.7-1.9 2.6.1 3.2-3.1.9-1.7 2.8-3.1-.9-2.8 1.8-2.6-2-3.1.8-.9-3.1-2.8-1.8 1.7-2.7-.1-3.2 2.5-2.1-.5-3.1 3.1-1 .9-3L11.2 2z" />
                  <path d="M10.6 13.6l-1.9-1.9-1.3 1.3 3.2 3.2 5.6-5.6-1.3-1.3z" fill="#fff" />
                </svg>
              )}
            </div>
            <div style={{ fontSize: '11px', color: '#667' }}>
              {ig.name || 'Instagram Creator'}
              {isBusiness && <span style={{ fontWeight: 700 }}> · Business</span>}
            </div>
          </div>
          <div style={{
            fontSize: '9px', fontWeight: 800, letterSpacing: '0.5px', textTransform: 'uppercase',
            color: isBusiness ? '#0066CC' : '#7A4F01',
            background: isBusiness ? 'rgba(0,102,204,0.08)' : 'rgba(245,133,41,0.12)',
            borderRadius: '4px', padding: '2px 6px', whiteSpace: 'nowrap',
          }}>
            {isBusiness ? 'Business' : 'Creator account'}
          </div>
        </div>

        {/* Basic stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '6px', marginBottom: '6px' }}>
          {igStats.map((s) => (
            <div key={s.label} style={{ textAlign: 'center', padding: '4px 2px', background: '#F7F7F2', borderRadius: '6px', border: '1px solid #ECECE6' }}>
              <div style={{ fontSize: '13px', fontWeight: 800, color: '#0A0A0A' }}>{s.value}</div>
              <div style={{ fontSize: '9px', fontWeight: 700, color: '#AAA49B', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Bio + website */}
        {(ig.bio || ig.website) && (
          <div style={{ fontSize: '11px', color: '#556', lineHeight: 1.4, marginBottom: '6px' }}>
            {ig.bio && <div style={{ whiteSpace: 'pre-wrap' }}>{ig.bio}</div>}
            {ig.website && <div style={{ color: '#0066CC', fontWeight: 600, marginTop: '2px', wordBreak: 'break-all' }}>{ig.website}</div>}
          </div>
        )}
      </div>

      {/* instagram_business_manage_insights banner + analytics */}
      <div style={{ padding: '5px 10px 10px', borderTop: '1px solid #F0EDE6' }}>
        <div style={{
          padding: '6px 8px', borderRadius: '6px',
          background: 'rgba(221,42,123,0.06)', border: '1px solid rgba(221,42,123,0.2)',
          fontSize: '10.5px', lineHeight: 1.45, color: '#334', marginBottom: '8px',
        }}>
          <span style={{ fontWeight: 800, color: '#DD2A7B', fontFamily: 'monospace' }}>instagram_business_manage_insights</span>
          <span style={{ color: '#667' }}>, {IG_INSIGHTS_NOTE}</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
          {insights.map((m) => (
            <div key={m.label} style={{ padding: '8px', background: '#F7F7F2', borderRadius: '8px', border: '1px solid #ECECE6' }}>
              <div style={{ fontSize: '13px', fontWeight: 800, color: '#DD2A7B' }}>{m.value}</div>
              <div style={{ fontSize: '9px', fontWeight: 700, color: '#AAA49B', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{m.label}</div>
            </div>
          ))}
        </div>

        <div style={{ fontSize: '10px', color: '#AAA49B', marginTop: '6px', textAlign: 'right' }}>
          Meta insights · {relSync(ig.insights?.syncedAt)}
        </div>
      </div>
    </div>
  );
}

function HoverCard({ profile, x, y }: { profile: HoverProfile; x: number; y: number }) {
  const cardRef = React.useRef<HTMLDivElement>(null);
  const [adjustedX, setAdjustedX] = React.useState(x);
  const [adjustedY, setAdjustedY] = React.useState(y);

  React.useEffect(() => {
    if (cardRef.current) {
      const rect = cardRef.current.getBoundingClientRect();
      const maxX = window.innerWidth - rect.width - 16;
      const maxY = window.innerHeight - rect.height - 16;
      setAdjustedX(Math.min(x, maxX));
      setAdjustedY(Math.min(y, maxY));
    }
  }, [x, y]);

  const skinBadge = profile.skin ? (profile.role === 'brand' ? (BRAND_CATEGORY_BADGES[profile.skin] ?? PROFESSION_BADGES[profile.skin]) : PROFESSION_BADGES[profile.skin]) : undefined;
  const isDefaultAbout = profile.aboutMe && defaultAboutMe(profile.skin || '') === profile.aboutMe;
  const level = profile.role === 'creator'
    ? getLevel(profile.metrics?.dealsCompleted ?? 0)
    : undefined;
  const levelInfo = level ? getLevelInfo(level) : undefined;
  const progress = profile.role === 'creator'
    ? getProgressToNext(profile.metrics?.dealsCompleted ?? 0)
    : null;

  return (
    <div
      ref={cardRef}
      style={{
        position: 'fixed',
        left: adjustedX,
        top: adjustedY,
        zIndex: 99999,
        width: '320px',
        background: 'var(--c-surface-lowest)',
        borderRadius: '16px',
        border: '1px solid #E0E0DA',
        boxShadow: '0 12px 40px rgba(0,0,0,0.15), 0 2px 8px rgba(0,0,0,0.06)',
        overflow: 'hidden',
        pointerEvents: 'auto',
        fontSize: '13px',
        color: '#0A0A0A',
      }}
    >
      {/* Header */}
      <div style={{
        padding: '16px 16px 12px',
        background: 'linear-gradient(135deg, #0A0A0A, #2D2D2D)',
        color: 'var(--c-surface-lowest)',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
      }}>
        {/* Avatar */}
        <div style={{
          width: '48px', height: '48px', borderRadius: '50%',
          background: 'rgba(255,255,255,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '22px', fontWeight: 800, color: 'var(--c-surface-lowest)',
          flexShrink: 0, overflow: 'hidden',
        }}>
          {profile.avatarUrl ? (
            <img src={profile.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            profile.name.charAt(0).toUpperCase()
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '16px', fontWeight: 700, lineHeight: 1.2 }}>{profile.name}</div>
          <div style={{ fontSize: '11px', opacity: 0.85, marginTop: '2px' }}>
            {profile.role === 'brand' ? 'Brand' : 'Creator'}
            {profile.selectedCountry && ` · ${profile.selectedCountry}`}
          </div>
        </div>
        {profile.role === 'creator' && profile.skin && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '4px',
            background: 'rgba(255,255,255,0.2)',
            borderRadius: '20px', padding: '4px 10px',
            fontSize: '11px', fontWeight: 600,
          }}>
            <span>{skinBadge?.abbreviation ?? profile.skin.slice(0, 3).toUpperCase()}</span>
          </div>
        )}
      </div>

      <div style={{ padding: '12px 16px', maxHeight: '560px', overflowY: 'auto' }}>
        {/* Level (creator) */}
        {level && levelInfo && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            marginBottom: '10px',
            padding: '8px 10px',
            background: '#F5F5F0',
            borderRadius: '8px',
            border: '1px solid #E0E0DA',
          }}>
            <div style={{
              width: '28px', height: '28px', borderRadius: '50%',
              background: levelInfo.color, display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              color: 'var(--c-surface-lowest)', fontSize: '12px', fontWeight: 800, flexShrink: 0,
            }}>
              {level}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#0A0A0A' }}>
                Level {level} · {levelInfo.label}
              </div>
              {progress && (
                <div style={{ marginTop: '4px' }}>
                  <div style={{
                    height: '3px', borderRadius: '2px',
                    background: '#E0E0DA', overflow: 'hidden',
                  }}>
                    <div style={{
                      width: `${progress.progress * 100}%`, height: '100%',
                      background: levelInfo.color, borderRadius: '2px',
                    }} />
                  </div>
                  <div style={{ fontSize: '10px', color: '#B8B4AC', marginTop: '2px' }}>
                    {progress.current}/{progress.needed} to next level
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Location and Email/Contact — shared for both */}
        {(profile.location || profile.email) && (
          <div style={{ marginBottom: '10px', display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px' }}>
            {profile.location && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#0A0A0A' }}>
                <span style={{ color: '#B8B4AC', fontWeight: 600 }}>📍 Location:</span>
                <span>{profile.location}</span>
              </div>
            )}
            {profile.email && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#0A0A0A' }}>
                <span style={{ color: '#B8B4AC', fontWeight: 600 }}>✉️ Email:</span>
                <span style={{ fontSize: '11px', wordBreak: 'break-all' }}>{profile.email}</span>
              </div>
            )}
          </div>
        )}

        {/* Skin / Profession badge — only show for creators */}
        {profile.role === 'creator' && profile.skin && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            marginBottom: '10px',
            padding: '8px 10px',
            background: `${skinBadge?.color ?? '#0A0A0A'}10`,
            borderRadius: '8px',
            border: `1px solid ${skinBadge?.color ?? '#0A0A0A'}30`,
          }}>
            {getStickerForProfession(profile.skin) ? (
              <img src={getStickerForProfession(profile.skin)!} alt={profile.skin}
                style={{ width: '32px', height: '32px', objectFit: 'contain', borderRadius: '6px' }} />
            ) : (
              <div style={{
                width: '32px', height: '32px', borderRadius: '6px',
                background: `${skinBadge?.color ?? '#0A0A0A'}20`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '14px', fontWeight: 700, color: skinBadge?.color ?? '#0A0A0A',
              }}>
                {skinBadge?.abbreviation ?? profile.skin.slice(0, 3).toUpperCase()}
              </div>
            )}
            <div>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#0A0A0A' }}>
                {profile.skin}
              </div>
            </div>
          </div>
        )}

        {/* Creator Height */}
        {profile.role === 'creator' && profile.height && (
          <div style={{
            marginBottom: '10px',
            padding: '6px 10px',
            background: '#F5F5F0',
            borderRadius: '8px',
            border: '1px solid #E0E0DA',
            fontSize: '12px', fontWeight: 600, color: '#0A0A0A',
          }}>
            📏 Height: {profile.height}
          </div>
        )}

        {/* Brand Info: Address & What They Do */}
        {profile.role === 'brand' && (profile.address || profile.whatTheyDo) && (
          <div style={{ marginBottom: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {profile.address && (
              <div style={{
                padding: '8px 10px',
                background: '#F5F5F0',
                borderRadius: '8px',
                border: '1px solid #E0E0DA',
              }}>
                <div style={{ fontSize: '10px', fontWeight: 700, color: '#B8B4AC', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
                  Address
                </div>
                <div style={{ fontSize: '12px', color: '#0A0A0A', lineHeight: 1.4 }}>
                  {profile.address}
                </div>
              </div>
            )}
            {profile.whatTheyDo && (
              <div style={{
                padding: '8px 10px',
                background: '#F5F5F0',
                borderRadius: '8px',
                border: '1px solid #E0E0DA',
              }}>
                <div style={{ fontSize: '10px', fontWeight: 700, color: '#B8B4AC', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
                  What They Do
                </div>
                <div style={{ fontSize: '12px', color: '#0A0A0A', lineHeight: 1.4 }}>
                  {profile.whatTheyDo}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Brand Profile Info */}
        {profile.role === 'brand' && profile.brandProfileSelections && (
          <div style={{ marginBottom: '10px' }}>
            {Object.entries(profile.brandProfileSelections).map(([key, val]) => (
              <div key={key} style={{
                display: 'flex', justifyContent: 'space-between',
                padding: '4px 0', fontSize: '12px',
                borderBottom: '1px solid var(--c-surface)',
              }}>
                <span style={{ color: '#B8B4AC' }}>{key}</span>
                <span style={{ fontWeight: 600, color: '#0A0A0A' }}>{val}</span>
              </div>
            ))}
          </div>
        )}

        {/* Creator About Me — only show if user actually wrote something */}
        {profile.role === 'creator' && profile.aboutMe && !isDefaultAbout && (
          <div style={{
            marginBottom: '10px',
            padding: '8px 10px',
            background: '#F5F5F0',
            borderRadius: '8px',
            border: '1px solid #E0E0DA',
          }}>
            <div style={{ fontSize: '10px', fontWeight: 700, color: '#B8B4AC', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
              About
            </div>
            <div style={{ fontSize: '12px', color: 'var(--c-text-muted)', lineHeight: 1.4 }}>
              {profile.aboutMe}
            </div>
          </div>
        )}

        {/* Bio */}
        {profile.bio && (
          <div style={{
            marginBottom: '10px',
            padding: '8px 10px',
            background: '#F5F5F0',
            borderRadius: '8px',
            border: '1px solid #E0E0DA',
          }}>
            <div style={{ fontSize: '10px', fontWeight: 700, color: '#B8B4AC', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
              Bio
            </div>
            <div style={{ fontSize: '12px', color: 'var(--c-text-muted)', lineHeight: 1.4 }}>
              {profile.bio}
            </div>
          </div>
        )}

        {/* Metrics grid — different for brands vs creators */}
        {profile.metrics && (
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px',
            marginBottom: '10px',
          }}>
            {(profile.role === 'brand' ? [
              { label: 'Deals', value: profile.metrics.dealsCompleted, color: '#0A0A0A' },
              { label: 'Avg Deal', value: `₹${profile.metrics.avgDealValue > 0 ? (profile.metrics.avgDealValue / 100).toLocaleString() : '0'}`, color: 'var(--c-accent)' },
              { label: 'Rating', value: `${profile.metrics.brandRating}/5`, color: 'var(--c-accent)' },
            ] : [
              { label: 'Deals', value: profile.metrics.dealsCompleted, color: '#0A0A0A' },
              { label: 'Avg Deal', value: `₹${(profile.metrics.avgDealValue / 100).toLocaleString()}`, color: 'var(--c-accent)' },
              { label: 'On Time', value: `${profile.metrics.onTimeRate}%`, color: '#A08A5E' },
              { label: 'Rating', value: `${profile.metrics.brandRating}/5`, color: 'var(--c-accent)' },
            ]).map(stat => (
              <div key={stat.label} style={{
                padding: '6px 8px',
                background: '#F5F5F0',
                borderRadius: '6px',
                border: '1px solid #E0E0DA',
              }}>
                <div style={{ fontSize: '9px', fontWeight: 700, color: '#B8B4AC', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  {stat.label}
                </div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: stat.color }}>
                  {stat.value}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Creator followers & engagement */}
        {profile.role === 'creator' && profile.metrics && (
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px',
            marginBottom: '10px',
          }}>
            <div style={{
              padding: '6px 8px',
              background: '#F5F5F0',
              borderRadius: '6px',
              border: '1px solid #E0E0DA',
            }}>
              <div style={{ fontSize: '9px', fontWeight: 700, color: '#B8B4AC', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Followers
              </div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#0A0A0A' }}>
                {(profile.metrics.followers / 1000).toFixed(1)}K
              </div>
            </div>
            <div style={{
              padding: '6px 8px',
              background: '#F5F5F0',
              borderRadius: '6px',
              border: '1px solid #E0E0DA',
            }}>
              <div style={{ fontSize: '9px', fontWeight: 700, color: '#B8B4AC', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Engagement
              </div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#0A0A0A' }}>
                {profile.metrics.engagement}%
              </div>
            </div>
          </div>
        )}

        {/* Instagram / Virtual Resume block (Meta Graph API data) */}
        {profile.role === 'creator' && profile.instagram && (
          <InstagramResumeBlock ig={profile.instagram} />
        )}

        {/* Creator Rate Card */}
        {profile.role === 'creator' && profile.rateCard && (
          <div style={{
            marginBottom: '10px',
            padding: '8px 10px',
            background: '#F5F5F0',
            borderRadius: '8px',
            border: '1px solid #E0E0DA',
          }}>
            <div style={{ fontSize: '10px', fontWeight: 700, color: '#B8B4AC', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>
              Rate Card
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {Object.entries(profile.rateCard).filter(([, v]) => v).map(([k, v]) => (
                <div key={k} style={{
                  fontSize: '11px', fontWeight: 600,
                  background: '#E0E0DA', borderRadius: '4px',
                  padding: '2px 8px', color: 'var(--c-text-muted)',
                }}>
                  {k}: ₹{v}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Availability */}
        {profile.role === 'creator' && profile.availableFrom && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            fontSize: '11px', color: '#B8B4AC', marginBottom: '6px',
          }}>
            <span>Available from {profile.availableFrom}</span>
          </div>
        )}

        {/* Completed deals count */}
        {profile.completedDeals !== undefined && profile.completedDeals > 0 && (
          <div style={{
            fontSize: '11px', color: '#B8B4AC', textAlign: 'center',
            padding: '6px', borderTop: '1px solid var(--c-surface)', marginTop: '4px',
          }}>
            {profile.completedDeals} deal{profile.completedDeals !== 1 ? 's' : ''} completed
          </div>
        )}
      </div>
    </div>
  );
}

export type { HoverProfile };
export { HoverCard };
