'use client';

import { useState } from 'react';
import { C } from '@/theme/colors';

interface ProfilePreviewProps {
  type: 'creator' | 'brand';
  id: string | number;
  name: string;
  avatar?: string;
  followerCount?: number;
  engagementRate?: number;
  niche?: string;
  category?: string;
  dealsCount?: number;
  isOpen: boolean;
  position: { x: number; y: number };
}

export default function ProfilePreviewCard({
  type,
  name,
  avatar,
  followerCount,
  engagementRate,
  niche,
  category,
  dealsCount,
  isOpen,
  position,
}: ProfilePreviewProps) {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        left: `${position.x}px`,
        top: `${position.y + 10}px`,
        zIndex: 9999,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: '12px',
          padding: '16px',
          width: '280px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
          backdropFilter: 'blur(12px)',
        }}
      >
        {/* Header with avatar and name */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '12px', alignItems: 'flex-start' }}>
          {avatar ? (
            <img
              src={avatar}
              alt={name}
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '8px',
                objectFit: 'cover',
                flexShrink: 0,
              }}
            />
          ) : (
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '8px',
                background: C.border,
                flexShrink: 0,
              }}
            />
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: '15px',
                fontWeight: 600,
                color: C.text,
                marginBottom: '4px',
                wordBreak: 'break-word',
              }}
            >
              {name}
            </div>
            <div style={{ fontSize: '12px', color: C.textMuted }}>
              {type === 'creator' ? niche || 'Creator' : category || 'Brand'}
            </div>
          </div>
        </div>

        {/* Stats grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '12px',
            marginBottom: '12px',
            paddingBottom: '12px',
            borderBottom: `1px solid ${C.border}`,
          }}
        >
          {type === 'creator' ? (
            <>
              <div>
                <div style={{ fontSize: '11px', color: C.textMuted, marginBottom: '4px' }}>Followers</div>
                <div style={{ fontSize: '16px', fontWeight: 700, color: C.accent }}>
                  {followerCount ? (followerCount > 1000000 ? `${(followerCount / 1000000).toFixed(1)}M` : followerCount > 1000 ? `${(followerCount / 1000).toFixed(1)}K` : followerCount) : '-'}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: C.textMuted, marginBottom: '4px' }}>Engagement</div>
                <div style={{ fontSize: '16px', fontWeight: 700, color: C.accent }}>
                  {engagementRate ? `${engagementRate.toFixed(1)}%` : '-'}
                </div>
              </div>
            </>
          ) : (
            <>
              <div>
                <div style={{ fontSize: '11px', color: C.textMuted, marginBottom: '4px' }}>Active Campaigns</div>
                <div style={{ fontSize: '16px', fontWeight: 700, color: C.accent }}>
                  {dealsCount || '0'}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: C.textMuted, marginBottom: '4px' }}>Category</div>
                <div style={{ fontSize: '13px', color: C.text, fontWeight: 500 }}>
                  {category || '-'}
                </div>
              </div>
            </>
          )}
        </div>

        {/* CTA */}
        <div style={{ fontSize: '12px', color: C.textMuted, textAlign: 'center' }}>
          Click to view full profile
        </div>
      </div>
    </div>
  );
}
