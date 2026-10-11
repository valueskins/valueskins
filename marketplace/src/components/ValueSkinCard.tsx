'use client';
import { withAlpha } from '@/theme/colors';
import CreatorLevelBadge from './CreatorLevelBadge';
import { getLevel, getLevelInfo } from '@/lib/levels';

interface BrandReview {
  id: string | number;
  brandName: string;
  brandAvatar?: string;
  text: string;
  createdAt: string;
}

interface PortfolioItem {
  id: string;
  title: string;
  image_url?: string;
  type?: string;
}

interface ValueSkinCardData {
  displayName: string;
  username: string;
  avatarUrl?: string;
  bio?: string;
  niche?: string;
  location?: string;
  dealsCompleted: number;
  dateJoined?: string;
  socialLinks?: {
    instagram?: string;
  };
  portfolio?: PortfolioItem[];
  reviews?: BrandReview[];
  valueSkin?: string;
}

interface Props {
  data: ValueSkinCardData;
  variant?: 'full' | 'compact';
  onViewProfile?: () => void;
  onMessage?: () => void;
}

const C = {
  bg: '#0A0A0A',
  surface: '#1A1A1A',
  surfaceAlt: '#2D2D2D',
  text: '#F5F5F0',
  textMuted: '#B8B4AC',
  textSecondary: '#D6D2C8',
  primary: '#C8B89A',
  success: 'var(--c-accent)',
  warning: 'var(--c-warning)',
  accent: 'var(--c-accent)',
  border: 'var(--c-border)',
};

function SocialIcon({ platform, handle }: { platform: string; handle?: string }) {
  if (!handle) return null;
  return (
    <a
      href={`https://${platform}.com/${handle}`}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '4px 10px',
        background: `${withAlpha(C.primary, 0x10)}`,
        border: `1px solid ${C.border}`,
        borderRadius: '6px',
        color: C.textSecondary,
        fontSize: '11px',
        fontWeight: 600,
        textDecoration: 'none',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = `${withAlpha(C.primary, 0x20)}`; e.currentTarget.style.borderColor = C.primary; }}
      onMouseLeave={e => { e.currentTarget.style.background = `${withAlpha(C.primary, 0x10)}`; e.currentTarget.style.borderColor = C.border; }}
    >
      {platform === 'instagram' && <span style={{ fontSize: '12px' }}>IG</span>}
      @{handle}
    </a>
  );
}

export default function ValueSkinCard({ data, variant = 'full', onViewProfile, onMessage }: Props) {
  const level = getLevel(data.dealsCompleted);
  const levelInfo = getLevelInfo(level);

  const avatarEl = data.avatarUrl ? (
    <img
      src={data.avatarUrl}
      alt={data.displayName}
      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
    />
  ) : (
    <span style={{ fontSize: '28px', fontWeight: 700, color: C.text }}>
      {data.displayName?.charAt(0)?.toUpperCase() || '?'}
    </span>
  );

  if (variant === 'compact') {
    return (
      <div style={{
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: '12px',
        padding: '16px',
        width: '320px',
      }}>
        {/* Avatar + Level row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
          <div style={{
            width: '44px',
            height: '44px',
            borderRadius: '50%',
            background: `${levelInfo.color}20`,
            border: `2px solid ${levelInfo.color}40`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            flexShrink: 0,
          }}>
            {avatarEl}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '14px', fontWeight: 700, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {data.displayName}
            </div>
            <div style={{ fontSize: '12px', color: C.textMuted }}>
              @{data.username}
            </div>
          </div>
          <CreatorLevelBadge dealsCompleted={data.dealsCompleted} size="sm" />
        </div>

        {/* Niche */}
        {data.niche && (
          <div style={{ fontSize: '12px', color: C.primary, fontWeight: 600, marginBottom: '8px' }}>
            {data.niche}
          </div>
        )}

        {/* Bio (truncated) */}
        {data.bio && (
          <div style={{
            fontSize: '12px',
            color: C.textSecondary,
            lineHeight: '1.5',
            marginBottom: '12px',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}>
            {data.bio}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '12px', color: C.textMuted }}>
          <span><strong style={{ color: C.text }}>{data.dealsCompleted}</strong> deals</span>
          {data.location && <span>{data.location}</span>}
        </div>
      </div>
    );
  }

  return (
    <div style={{
      background: C.surface,
      border: `1px solid ${C.border}`,
      borderRadius: '16px',
      overflow: 'hidden',
      width: '100%',
      maxWidth: '420px',
    }}>
      {/* Header - Avatar + Name + Level */}
      <div style={{
        padding: '24px 24px 20px',
        background: `linear-gradient(180deg, ${levelInfo.color}15 0%, transparent 100%)`,
        borderBottom: `1px solid ${C.border}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: `${levelInfo.color}20`,
            border: `3px solid ${levelInfo.color}50`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            flexShrink: 0,
          }}>
            {avatarEl}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <span style={{ fontSize: '18px', fontWeight: 700, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {data.displayName}
              </span>
            </div>
            <div style={{ fontSize: '13px', color: C.textMuted, marginBottom: '8px' }}>
              @{data.username}
            </div>
            <CreatorLevelBadge dealsCompleted={data.dealsCompleted} size="md" showLabel showProgress />
          </div>
        </div>
      </div>

      {/* Niche */}
      {data.niche && (
        <div style={{ padding: '14px 24px', borderBottom: `1px solid ${C.border}` }}>
          <div style={{ fontSize: '11px', color: C.textMuted, textTransform: 'uppercase', marginBottom: '4px' }}>
            Category
          </div>
          <div style={{ fontSize: '14px', fontWeight: 600, color: C.primary }}>
            {data.niche}
          </div>
          {data.location && (
            <div style={{ fontSize: '12px', color: C.textMuted, marginTop: '2px' }}>
              {data.location}
            </div>
          )}
        </div>
      )}

      {/* Stats row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        borderBottom: `1px solid ${C.border}`,
      }}>
        <StatCell label="Deals" value={String(data.dealsCompleted)} />
        <StatCell label="Level" value={`Lv.${level}`} color={levelInfo.color} />
        {data.dateJoined && (
          <StatCell label="Joined" value={new Date(data.dateJoined).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })} />
        )}
      </div>

      {/* Bio */}
      {data.bio && (
        <div style={{ padding: '16px 24px', borderBottom: `1px solid ${C.border}` }}>
          <div style={{ fontSize: '11px', color: C.textMuted, textTransform: 'uppercase', marginBottom: '6px' }}>
            About
          </div>
          <div style={{ fontSize: '13px', color: C.textSecondary, lineHeight: '1.6' }}>
            {data.bio}
          </div>
        </div>
      )}

      {/* Social Links */}
      {data.socialLinks && (
        <div style={{ padding: '16px 24px', borderBottom: data.reviews?.length ? `1px solid ${C.border}` : 'none' }}>
          <div style={{ fontSize: '11px', color: C.textMuted, textTransform: 'uppercase', marginBottom: '8px' }}>
            Social
          </div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {data.socialLinks.instagram && <SocialIcon platform="instagram" handle={data.socialLinks.instagram} />}
          </div>
        </div>
      )}

      {/* Brand Reviews */}
      {data.reviews && data.reviews.length > 0 && (
        <div style={{ padding: '16px 24px' }}>
          <div style={{ fontSize: '11px', color: C.textMuted, textTransform: 'uppercase', marginBottom: '10px' }}>
            Brand Reviews ({data.reviews.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {data.reviews.slice(0, 3).map((review) => (
              <div key={review.id} style={{
                background: C.bg,
                borderRadius: '8px',
                padding: '12px',
                border: `1px solid ${C.border}`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <div style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    background: C.primary + '30',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '11px',
                    fontWeight: 700,
                    color: C.primary,
                  }}>
                    {review.brandName?.charAt(0) || 'B'}
                  </div>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: C.text }}>{review.brandName}</div>
                </div>
                <div style={{ fontSize: '12px', color: C.textSecondary, lineHeight: '1.5', fontStyle: 'italic' }}>
                  "{review.text.replace(/<[^>]*>/g, '').replace(/[<>"'&]/g, '')}"
                </div>
              </div>
            ))}
            {data.reviews.length > 3 && (
              <div style={{ fontSize: '12px', color: C.textMuted, textAlign: 'center' }}>
                +{data.reviews.length - 3} more reviews
              </div>
            )}
          </div>
        </div>
      )}

      {/* Actions */}
      <div style={{ padding: '16px 24px', borderTop: `1px solid ${C.border}`, display: 'flex', gap: '8px' }}>
        {onViewProfile && (
          <button
            onClick={onViewProfile}
            style={{
              flex: 1,
              padding: '10px',
              background: C.primary,
              color: 'var(--c-on-primary)',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 700,
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            View Profile
          </button>
        )}
        {onMessage && (
          <button
            onClick={onMessage}
            style={{
              flex: 1,
              padding: '10px',
              background: 'transparent',
              color: C.primary,
              border: `1px solid ${C.primary}`,
              borderRadius: '8px',
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            Message
          </button>
        )}
      </div>
    </div>
  );
}

function StatCell({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{
      padding: '12px',
      textAlign: 'center',
      borderRight: `1px solid ${C.border}`,
    }}>
      <div style={{ fontSize: '16px', fontWeight: 700, color: color || C.text }}>
        {value}
      </div>
      <div style={{ fontSize: '10px', color: C.textMuted, textTransform: 'uppercase', marginTop: '2px' }}>
        {label}
      </div>
    </div>
  );
}

export type { ValueSkinCardData, BrandReview };
