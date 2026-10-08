'use client';
import { withAlpha } from '@/theme/colors';
import CreatorLevelBadge from './CreatorLevelBadge';
import { getLevel, getLevelInfo } from '@/lib/levels';

interface HoverCardData {
  displayName: string;
  username: string;
  avatarUrl?: string;
  bio?: string;
  niche?: string;
  location?: string;
  dealsCompleted: number;
  valueSkin?: string;
  rate?: number;
  workedWith?: boolean;
  topReview?: {
    brandName: string;
    text: string;
  };
}

interface Props {
  data: HoverCardData;
  style?: React.CSSProperties;
  onViewFullProfile?: () => void;
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
  danger: 'var(--c-error)',
  border: '#2D2D2D',
};

export default function ValueSkinHoverCard({ data, style, onViewFullProfile }: Props) {
  const level = getLevel(data.dealsCompleted);
  const levelInfo = getLevelInfo(level);

  const avatarEl = data.avatarUrl ? (
    <img
      src={data.avatarUrl}
      alt={data.displayName}
      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
    />
  ) : (
    <span style={{ fontSize: '20px', fontWeight: 700, color: C.text }}>
      {data.displayName?.charAt(0)?.toUpperCase() || '?'}
    </span>
  );

  return (
    <div
      style={{
        position: 'absolute',
        zIndex: 100,
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: '14px',
        boxShadow: '0 12px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(56,189,248,0.1)',
        width: '340px',
        overflow: 'hidden',
        pointerEvents: 'auto',
        ...style,
      }}
    >
      {/* Top gradient strip */}
      <div style={{
        height: '4px',
        background: `linear-gradient(90deg, ${levelInfo.color}, ${C.primary})`,
      }} />

      <div style={{ padding: '16px' }}>
        {/* Avatar + Name + Level row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            background: `${levelInfo.color}20`,
            border: `2px solid ${levelInfo.color}50`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            flexShrink: 0,
          }}>
            {avatarEl}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '15px', fontWeight: 700, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {data.displayName}
            </div>
            <div style={{ fontSize: '12px', color: C.textMuted, marginBottom: '4px' }}>
              @{data.username}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CreatorLevelBadge dealsCompleted={data.dealsCompleted} size="sm" />
              <span style={{ fontSize: '11px', color: C.textMuted }}>
                {data.dealsCompleted} deal{data.dealsCompleted !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
        </div>

        {/* Niche + Location pill */}
        {(data.niche || data.location) && (
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '10px' }}>
            {data.niche && (
              <span style={{
                padding: '3px 10px',
                borderRadius: '12px',
                background: `${withAlpha(C.primary, 0x15)}`,
                color: C.primary,
                fontSize: '11px',
                fontWeight: 600,
                border: `1px solid ${withAlpha(C.primary, 0x30)}`,
              }}>
                {data.niche}
              </span>
            )}
            {data.location && (
              <span style={{
                padding: '3px 10px',
                borderRadius: '12px',
                background: C.bg,
                color: C.textMuted,
                fontSize: '11px',
              }}>
                {data.location}
              </span>
            )}
          </div>
        )}

        {/* Rate card */}
        {data.rate && (
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            marginBottom: '12px', padding: '8px 12px', background: C.bg, borderRadius: '8px',
          }}>
            <span style={{ fontSize: '12px', color: C.textMuted }}>Starting rate</span>
            <span style={{ fontSize: '16px', fontWeight: 700, color: C.primary }}>₹{data.rate.toLocaleString()}</span>
          </div>
        )}

        {/* Worked with badge */}
        {data.workedWith && (
          <div style={{
            marginBottom: '12px', padding: '8px 12px', background: `${withAlpha(C.success, 0x15)}`,
            borderRadius: '8px', fontSize: '12px', color: C.success, fontWeight: 600,
            border: `1px solid ${withAlpha(C.success, 0x30)}`,
          }}>
             Worked together before
          </div>
        )}

        {/* Bio */}
        {data.bio && (
          <div style={{
            fontSize: '12px',
            color: C.textSecondary,
            lineHeight: '1.5',
            marginBottom: '12px',
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}>
            {data.bio}
          </div>
        )}

        {/* Top review */}
        {data.topReview && (
          <div style={{
            background: C.bg,
            borderRadius: '8px',
            padding: '10px 12px',
            border: `1px solid ${C.border}`,
            marginBottom: '12px',
          }}>
            <div style={{ fontSize: '10px', color: C.textMuted, textTransform: 'uppercase', marginBottom: '4px' }}>
              Brand Review
            </div>
            <div style={{ fontSize: '12px', color: C.textSecondary, lineHeight: '1.5', fontStyle: 'italic' }}>
              "{(data.topReview.text || '').replace(/<[^>]*>/g, '').replace(/[<>"'&]/g, '').substring(0, 120)}{(data.topReview.text || '').length > 120 ? '...' : ''}"
            </div>
            <div style={{ fontSize: '11px', color: C.primary, fontWeight: 600, marginTop: '4px' }}>
             , {data.topReview.brandName}
            </div>
          </div>
        )}

        {/* View Profile link */}
        {onViewFullProfile && (
          <button
            onClick={onViewFullProfile}
            style={{
              width: '100%',
              padding: '8px',
              background: 'transparent',
              color: C.primary,
              border: `1px solid ${C.border}`,
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = `${withAlpha(C.primary, 0x10)}`; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
          >
            View Full Profile
          </button>
        )}
      </div>
    </div>
  );
}
