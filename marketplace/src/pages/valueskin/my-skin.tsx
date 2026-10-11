'use client';
import { withAlpha } from '@/theme/colors';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import LoadingState from '@/components/LoadingState';

const C = {
  bg: '#0A0A0A',
  surface: '#1A1A1A',
  border: 'var(--c-border)',
  text: '#F5F5F0',
  textSecondary: '#D6D2C8',
  primary: '#0066CC',
  success: 'var(--c-accent)',
  warning: 'var(--c-warning)',
};

interface ValueSkin {
  id: string;
  valueskinCode: string;
  tier: number;
  profession: {
    name: string;
    category: string;
  };
  createdAt: string;
}

export default function MyValueSkinPage() {
  const router = useRouter();
  const [valueskin, setValueskin] = useState<ValueSkin | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchMyValueskin();
  }, []);

  const fetchMyValueskin = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/creator/my-valueskin');
      if (!res.ok) {
        if (res.status === 404) {
          router.replace('/store');
          return;
        }
        throw new Error('Failed to fetch');
      }
      const data = await res.json();
      setValueskin(data.valueskin);
    } catch (err: any) {
      setError(err.message || 'Failed to load your ValueSkin');
      setTimeout(() => router.replace('/store'), 2000);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <LoadingState />
    );
  }

  if (error || !valueskin) {
    return (
      <div style={{ minHeight: '100vh', background: C.bg, padding: '40px 20px' }}>
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
          <div style={{
            padding: '16px',
            background: 'rgba(176, 65, 62, 0.1)',
            color: 'var(--c-error)',
            border: '1px solid var(--c-error)',
            borderRadius: '8px',
            marginBottom: '20px',
          }}>
            {error || 'No ValueSkin found. Redirecting to store...'}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bg, padding: '40px 20px' }}>
      <div style={{ maxWidth: '700px', margin: '0 auto' }}>
        <Link href="/" style={{ color: C.primary, textDecoration: 'none', fontSize: '14px', marginBottom: '24px', display: 'inline-block' }}>
          ← Back to Home
        </Link>

        <div style={{ marginBottom: '40px' }}>
          <h1 style={{ fontSize: '32px', fontWeight: 700, color: C.text, margin: '0 0 12px 0' }}>
            Your ValueSkin
          </h1>
          <p style={{ fontSize: '14px', color: C.textSecondary, margin: 0 }}>
            Your unique ValueSkin identity and marketplace access
          </p>
        </div>

        {/* Main ValueSkin Card */}
        <div style={{
          padding: '32px',
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: '12px',
          marginBottom: '32px',
        }}>
          {/* Profession Header */}
          <div style={{ marginBottom: '32px' }}>
            <div style={{ fontSize: '12px', color: C.textSecondary, textTransform: 'uppercase', fontWeight: 600, marginBottom: '8px' }}>
              Profession
            </div>
            <h2 style={{ fontSize: '28px', fontWeight: 700, color: C.text, margin: 0 }}>
              {valueskin.profession.name}
            </h2>
            <p style={{ fontSize: '14px', color: C.textSecondary, margin: '8px 0 0 0' }}>
              {valueskin.profession.category}
            </p>
          </div>

          {/* ValueSkin Code */}
          <div style={{
            padding: '16px',
            background: C.bg,
            border: `1px solid ${C.border}`,
            borderRadius: '8px',
            marginBottom: '24px',
          }}>
            <div style={{ fontSize: '12px', color: C.textSecondary, textTransform: 'uppercase', fontWeight: 600, marginBottom: '6px' }}>
              Your Unique ValueSkin ID
            </div>
            <div style={{
              fontSize: '18px',
              fontWeight: 700,
              color: C.primary,
              fontFamily: 'monospace',
              wordBreak: 'break-all',
            }}>
              {valueskin.valueskinCode}
            </div>
          </div>

          {/* Tier */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
            <div>
              <div style={{ fontSize: '12px', color: C.textSecondary, textTransform: 'uppercase', fontWeight: 600, marginBottom: '6px' }}>
                Tier
              </div>
              <div style={{ fontSize: '20px', fontWeight: 700, color: C.text }}>
                Level {valueskin.tier}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '12px', color: C.textSecondary, textTransform: 'uppercase', fontWeight: 600, marginBottom: '6px' }}>
                Purchased
              </div>
              <div style={{ fontSize: '14px', color: C.text }}>
                {new Date(valueskin.createdAt).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </div>
            </div>
          </div>

          {/* Share Section */}
          <div style={{
            padding: '16px',
            background: C.bg,
            border: `1px solid ${C.border}`,
            borderRadius: '8px',
            marginBottom: '24px',
          }}>
            <div style={{ fontSize: '12px', color: C.textSecondary, textTransform: 'uppercase', fontWeight: 600, marginBottom: '12px' }}>
              Share Your ValueSkin
            </div>
            <p style={{ fontSize: '13px', color: C.textSecondary, margin: '0 0 12px 0' }}>
              Share your unique ID with others to connect and showcase your expertise
            </p>
            <button
              onClick={() => {
                navigator.clipboard.writeText(valueskin.valueskinCode);
                alert('ValueSkin ID copied to clipboard!');
              }}
              style={{
                width: '100%',
                padding: '12px',
                background: C.primary,
                color: 'var(--c-on-primary)',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Copy ID to Clipboard
            </button>
          </div>

          {/* Actions */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <Link
              href="/demo/marketplace"
              style={{
                padding: '12px',
                background: C.primary,
                color: 'var(--c-on-primary)',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                textDecoration: 'none',
                textAlign: 'center',
              }}
            >
              Go to Marketplace
            </Link>
            <Link
              href="/valueskins/search"
              style={{
                padding: '12px',
                background: C.surface,
                color: C.primary,
                border: `1px solid ${C.border}`,
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                textDecoration: 'none',
                textAlign: 'center',
              }}
            >
              Search by ID
            </Link>
          </div>
        </div>

        {/* Info Section */}
        <div style={{
          padding: '20px',
          background: `${withAlpha(C.primary, 0x15)}`,
          border: `1px solid ${withAlpha(C.primary, 0x40)}`,
          borderRadius: '8px',
        }}>
          <div style={{ fontSize: '14px', fontWeight: 600, color: C.text, marginBottom: '8px' }}>
            What is a ValueSkin?
          </div>
          <p style={{ fontSize: '13px', color: C.textSecondary, margin: 0, lineHeight: 1.6 }}>
            Your ValueSkin is your unique digital identity on ValueSkins marketplace. It grants you exclusive access to negotiate deals, collaborate with brands, and build your reputation as a creator.
          </p>
        </div>
      </div>
    </div>
  );
}
