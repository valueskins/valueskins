'use client';
import { getLevel, getLevelInfo, getProgressToNext, getNextLevelInfo } from '@/lib/levels';

interface Props {
  dealsCompleted: number;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  showProgress?: boolean;
}

const SIZE_MAP = {
  sm: { badge: '20px', icon: '10px', text: '10px', gap: '3px' },
  md: { badge: '28px', icon: '14px', text: '13px', gap: '6px' },
  lg: { badge: '40px', icon: '20px', text: '16px', gap: '8px' },
};

export default function CreatorLevelBadge({ dealsCompleted, size = 'md', showLabel = false, showProgress = false }: Props) {
  const level = getLevel(dealsCompleted);
  const info = getLevelInfo(level);
  const next = getNextLevelInfo(level);
  const progress = getProgressToNext(dealsCompleted);
  const s = SIZE_MAP[size];

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: s.gap }}>
      {/* Level badge circle */}
      <div style={{
        width: s.badge,
        height: s.badge,
        borderRadius: '50%',
        background: `linear-gradient(135deg, ${info.color}40, ${info.color}80)`,
        border: `2px solid ${info.color}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}>
        <span style={{ fontSize: s.icon, fontWeight: 800, color: info.color, lineHeight: 1 }}>
          {level}
        </span>
      </div>

      <div>
        <div style={{
          fontSize: s.text,
          fontWeight: 700,
          color: info.color,
          lineHeight: 1.2,
        }}>
          Lv.{level} {showLabel ? info.label : ''}
        </div>

        {showLabel && !showProgress && (
          <div style={{ fontSize: '11px', color: 'var(--c-text-muted)', lineHeight: 1.2 }}>
            {dealsCompleted} deal{dealsCompleted !== 1 ? 's' : ''} completed
          </div>
        )}

        {showProgress && next && progress && (
          <div style={{ marginTop: '4px' }}>
            <div style={{
              width: '100px',
              height: '4px',
              background: 'var(--c-surface)',
              borderRadius: '2px',
              overflow: 'hidden',
            }}>
              <div style={{
                width: `${Math.round(progress.progress * 100)}%`,
                height: '100%',
                background: info.color,
                borderRadius: '2px',
                transition: 'width 0.3s ease',
              }} />
            </div>
            <div style={{ fontSize: '10px', color: 'var(--c-text-muted)', marginTop: '2px' }}>
              {progress.current}/{progress.needed} to Lv.{level + 1} {next.label}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
