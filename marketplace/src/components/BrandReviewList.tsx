'use client';
import { withAlpha } from '@/theme/colors';
import { useState, useEffect } from 'react';

interface BrandReview {
  id: number;
  brandName: string;
  brandAvatar?: string;
  text: string;
  createdAt: string;
  dealTitle?: string;
}

interface Props {
  creatorId: string | number;
  showTitle?: boolean;
  maxItems?: number;
}

const C = {
  bg: '#0A0A0A',
  surface: '#1A1A1A',
  text: '#F5F5F0',
  textMuted: '#B8B4AC',
  textSecondary: '#D6D2C8',
  primary: '#C8B89A',
  border: 'var(--c-border)',
};

export default function BrandReviewList({ creatorId, showTitle = true, maxItems }: Props) {
  const [reviews, setReviews] = useState<BrandReview[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!creatorId) return;
    setLoading(true);
    fetch(`/api/creators/${creatorId}/brand-reviews`, { credentials: 'include' })
      .then(res => res.ok ? res.json() : { reviews: [] })
      .then(data => setReviews(data.reviews || []))
      .catch(() => setReviews([]))
      .finally(() => setLoading(false));
  }, [creatorId]);

  const displayReviews = maxItems ? reviews.slice(0, maxItems) : reviews;

  if (loading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', color: C.textMuted, fontSize: '13px' }}>
        Loading reviews...
      </div>
    );
  }

  if (reviews.length === 0) {
    return (
      <div style={{
        padding: '24px',
        textAlign: 'center',
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: '12px',
      }}>
        <div style={{ fontSize: '13px', color: C.textMuted, marginBottom: '4px' }}>
          No brand reviews yet
        </div>
        <div style={{ fontSize: '12px', color: C.textMuted }}>
          Reviews from brands will appear here after completed deals.
        </div>
      </div>
    );
  }

  return (
    <div>
      {showTitle && (
        <div style={{
          fontSize: '16px',
          fontWeight: 700,
          color: C.text,
          marginBottom: '14px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}>
          Brand Reviews
          <span style={{
            fontSize: '12px',
            fontWeight: 600,
            color: C.primary,
            background: `${withAlpha(C.primary, 0x15)}`,
            padding: '2px 10px',
            borderRadius: '12px',
          }}>
            {reviews.length}
          </span>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {displayReviews.map((review) => (
          <div key={review.id} style={{
            background: C.surface,
            border: `1px solid ${C.border}`,
            borderRadius: '10px',
            padding: '14px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: `${withAlpha(C.primary, 0x20)}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '13px',
                fontWeight: 700,
                color: C.primary,
                flexShrink: 0,
              }}>
                {review.brandName?.charAt(0) || 'B'}
              </div>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: C.text }}>
                  {review.brandName}
                </div>
                <div style={{ fontSize: '11px', color: C.textMuted }}>
                  {new Date(review.createdAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                  {review.dealTitle && ` · ${review.dealTitle}`}
                </div>
              </div>
            </div>
            <div style={{
              fontSize: '13px',
              color: C.textSecondary,
              lineHeight: '1.6',
              fontStyle: 'italic',
              borderLeft: `2px solid ${withAlpha(C.primary, 0x40)}`,
              paddingLeft: '12px',
            }}>
              "{review.text.replace(/<[^>]*>/g, '').replace(/[<>"'&]/g, '')}"
            </div>
          </div>
        ))}
      </div>

      {maxItems && reviews.length > maxItems && (
        <div style={{
          textAlign: 'center',
          marginTop: '12px',
          fontSize: '13px',
          color: C.primary,
          fontWeight: 600,
          cursor: 'pointer',
        }}>
          +{reviews.length - maxItems} more reviews
        </div>
      )}
    </div>
  );
}

export type { BrandReview };
