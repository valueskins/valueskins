'use client';

interface DealCardProps {
  id: string;
  brand: string;
  title: string;
  budget: number;
  deadline: string;
  matchScore: string;
  featured?: boolean;
  onClick: () => void;
}

export default function DealCard({
  id,
  brand,
  title,
  budget,
  deadline,
  matchScore,
  featured,
  onClick,
}: DealCardProps) {
  return (
    <div
      onClick={onClick}
      style={{
        background: 'var(--c-surface)',
        border: '1px solid var(--c-border)',
        borderRadius: '8px',
        padding: '16px',
        cursor: 'pointer',
        transition: 'all 0.2s',
        boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
      }}
      onMouseEnter={(e) => {
        if (e.currentTarget instanceof HTMLElement) {
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
          e.currentTarget.style.transform = 'translateY(-2px)';
        }
      }}
      onMouseLeave={(e) => {
        if (e.currentTarget instanceof HTMLElement) {
          e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.05)';
          e.currentTarget.style.transform = 'translateY(0)';
        }
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '12px' }}>
        <div>
          <div style={{ fontSize: '12px', color: 'var(--c-text-variant)', fontWeight: 600 }}>{brand}</div>
          <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--c-text)', marginTop: '4px' }}>
            {title}
          </div>
        </div>
        {featured && (
          <span style={{
            background: 'var(--c-warning)',
            color: '#78350f',
            padding: '4px 8px',
            borderRadius: '4px',
            fontSize: '10px',
            fontWeight: 600,
          }}>
            Featured
          </span>
        )}
      </div>

      {/* Details Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
        <div>
          <div style={{ fontSize: '11px', color: 'var(--c-text-variant)', fontWeight: 600 }}>BUDGET</div>
          <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--c-accent)', marginTop: '4px' }}>
            ${budget.toLocaleString()}
          </div>
        </div>
        <div>
          <div style={{ fontSize: '11px', color: 'var(--c-text-variant)', fontWeight: 600 }}>DEADLINE</div>
          <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--c-text)', marginTop: '4px' }}>
            {deadline}
          </div>
        </div>
      </div>

      {/* Match Score */}
      <div style={{
        background: 'var(--c-surface-container)',
        border: '1px solid #93c5fd',
        borderRadius: '4px',
        padding: '8px 12px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <span style={{ fontSize: '12px', color: 'var(--c-text)', fontWeight: 600 }}>Match Score</span>
        <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--c-text)' }}>{matchScore}</span>
      </div>
    </div>
  );
}
