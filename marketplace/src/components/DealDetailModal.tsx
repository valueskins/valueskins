'use client';

interface DealDetailModalProps {
  deal: {
    id: string;
    brand: string;
    title: string;
    description: string;
    budget: number;
    deadline: string;
    deliverables: Array<{ type: string; count: number; dueDate: string }>;
    requirements: string[];
    usageRights: string;
    exclusivity: string;
  };
  onClose: () => void;
  onApply: () => void;
}

export default function DealDetailModal({ deal, onClose, onApply }: DealDetailModalProps) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--c-surface)',
          borderRadius: '12px',
          maxWidth: '600px',
          width: '90%',
          maxHeight: '80vh',
          overflow: 'auto',
          boxShadow: '0 20px 25px rgba(0, 0, 0, 0.15)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: '24px',
          borderBottom: '1px solid var(--c-border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'start',
        }}>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--c-text-variant)', fontWeight: 600 }}>Brand</div>
            <h2 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--c-text)', margin: '8px 0 0 0' }}>
              {deal.title}
            </h2>
            <div style={{ fontSize: '14px', color: 'var(--c-text-variant)', marginTop: '4px' }}>{deal.brand}</div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: 'var(--c-text-variant)',
            }}
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '24px' }}>
          {/* Budget & Deadline */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '16px',
            marginBottom: '24px',
          }}>
            <div style={{
              background: 'var(--c-surface-container)',
              border: '1px solid var(--c-border)',
              borderRadius: '8px',
              padding: '16px',
            }}>
              <div style={{ fontSize: '12px', color: 'var(--c-text)', fontWeight: 600 }}>BUDGET</div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--c-accent)', marginTop: '8px' }}>
                ${deal.budget.toLocaleString()}
              </div>
            </div>
            <div style={{
              background: 'var(--c-surface-container)',
              border: '1px solid #fcd34d',
              borderRadius: '8px',
              padding: '16px',
            }}>
              <div style={{ fontSize: '12px', color: 'var(--c-text)', fontWeight: 600 }}>DEADLINE</div>
              <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--c-warning)', marginTop: '8px' }}>
                {deal.deadline}
              </div>
            </div>
          </div>

          {/* Description */}
          <section style={{ marginBottom: '24px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--c-text)', marginBottom: '8px' }}>
              About This Deal
            </h3>
            <p style={{ fontSize: '14px', color: 'var(--c-text-muted)', lineHeight: '1.6' }}>
              {deal.description}
            </p>
          </section>

          {/* Deliverables */}
          <section style={{ marginBottom: '24px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--c-text)', marginBottom: '12px' }}>
              Deliverables
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {deal.deliverables.map((del, idx) => (
                <div
                  key={idx}
                  style={{
                    background: 'var(--c-surface)',
                    border: '1px solid var(--c-border)',
                    borderRadius: '6px',
                    padding: '12px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--c-text)' }}>
                      {del.type}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--c-text-variant)', marginTop: '2px' }}>
                      Qty: {del.count} · Due: {del.dueDate}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Requirements */}
          <section style={{ marginBottom: '24px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--c-text)', marginBottom: '12px' }}>
              Requirements
            </h3>
            <ul style={{ fontSize: '13px', color: 'var(--c-text-muted)', lineHeight: '1.8', paddingLeft: '20px' }}>
              {deal.requirements.map((req, idx) => (
                <li key={idx}>{req}</li>
              ))}
            </ul>
          </section>

          {/* Terms */}
          <div style={{
            background: 'var(--c-surface)',
            border: '1px solid var(--c-border)',
            borderRadius: '6px',
            padding: '12px',
            marginBottom: '24px',
            fontSize: '12px',
          }}>
            <div style={{ marginBottom: '8px' }}>
              <strong style={{ color: 'var(--c-text)' }}>Usage Rights:</strong>{' '}
              <span style={{ color: 'var(--c-text-variant)' }}>{deal.usageRights}</span>
            </div>
            <div>
              <strong style={{ color: 'var(--c-text)' }}>Exclusivity:</strong>{' '}
              <span style={{ color: 'var(--c-text-variant)' }}>{deal.exclusivity}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid var(--c-border)',
          display: 'flex',
          gap: '12px',
          justifyContent: 'flex-end',
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '10px 20px',
              border: '1px solid var(--c-border)',
              background: 'var(--c-surface)',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: 600,
              color: 'var(--c-text)',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={onApply}
            style={{
              padding: '10px 24px',
              background: 'var(--c-surface)',
              border: 'none',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: 600,
              color: 'var(--c-text)',
              cursor: 'pointer',
            }}
          >
            Apply Now
          </button>
        </div>
      </div>
    </div>
  );
}
