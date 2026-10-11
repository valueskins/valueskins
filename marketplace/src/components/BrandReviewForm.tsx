'use client';
import { withAlpha } from '@/theme/colors';
import { useState } from 'react';

interface Props {
  dealId: string | number;
  creatorId: string | number;
  creatorName: string;
  onSubmitted?: () => void;
  onCancel?: () => void;
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
  border: 'var(--c-border)',
};

export default function BrandReviewForm({ dealId, creatorId, creatorName, onSubmitted, onCancel }: Props) {
  const [reviewText, setReviewText] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const handleSubmit = async () => {
    const trimmed = reviewText.trim();
    if (trimmed.length < 10) {
      setError('Review must be at least 10 characters');
      return;
    }
    if (trimmed.length > 1000) {
      setError('Review must be under 1000 characters');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const safeText = trimmed
        .replace(/<[^>]*>/g, '')
        .replace(/[<>"'&]/g, '')
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');

      const res = await fetch('/api/deals/reviews/brand-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          dealId,
          creatorId,
          reviewText: safeText,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to submit review');
      }

      setDone(true);
      onSubmitted?.();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (done) {
    return (
      <div style={{
        background: C.surface,
        border: `1px solid ${withAlpha(C.success, 0x40)}`,
        borderRadius: '12px',
        padding: '20px',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: '28px', marginBottom: '8px' }}></div>
        <div style={{ fontSize: '15px', fontWeight: 700, color: C.success, marginBottom: '4px' }}>
          Review Submitted
        </div>
        <div style={{ fontSize: '13px', color: C.textMuted }}>
          Your review of {creatorName} is now part of their ValueSkin.
        </div>
      </div>
    );
  }

  return (
    <div style={{
      background: C.surface,
      border: `1px solid ${C.border}`,
      borderRadius: '12px',
      padding: '20px',
    }}>
      <div style={{ fontSize: '14px', fontWeight: 700, color: C.text, marginBottom: '4px' }}>
        Review {creatorName}
      </div>
      <div style={{ fontSize: '12px', color: C.textMuted, marginBottom: '14px' }}>
        Your review will become part of their ValueSkin. Help other brands understand what it's like working with this creator.
      </div>

      {error && (
        <div style={{
          padding: '8px 12px',
          background: 'rgba(176, 65, 62, 0.13)',
          border: '1px solid var(--c-error)',
          borderRadius: '8px',
          color: 'var(--c-error)',
          fontSize: '12px',
          marginBottom: '12px',
        }}>
          {error}
        </div>
      )}

      <textarea
        value={reviewText}
        onChange={e => setReviewText(e.target.value)}
        placeholder="e.g. Excellent communication. Delivered ahead of schedule. Easy to work with."
        maxLength={1000}
        style={{
          width: '100%',
          minHeight: '90px',
          padding: '12px',
          background: C.bg,
          border: `1px solid ${C.border}`,
          borderRadius: '8px',
          color: C.text,
          fontSize: '13px',
          fontFamily: 'inherit',
          resize: 'vertical',
          boxSizing: 'border-box',
        }}
      />
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: '8px',
      }}>
        <span style={{ fontSize: '11px', color: C.textMuted }}>
          {reviewText.length}/1000
        </span>
        <div style={{ display: 'flex', gap: '8px' }}>
          {onCancel && (
            <button
              onClick={onCancel}
              disabled={saving}
              style={{
                padding: '8px 16px',
                background: 'transparent',
                color: C.textMuted,
                border: `1px solid ${C.border}`,
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          )}
          <button
            onClick={handleSubmit}
            disabled={saving}
            style={{
              padding: '8px 20px',
              background: C.primary,
              color: 'var(--c-on-primary)',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 700,
              fontSize: '12px',
              cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.6 : 1,
            }}
          >
            {saving ? 'Submitting...' : 'Submit Review'}
          </button>
        </div>
      </div>
    </div>
  );
}
