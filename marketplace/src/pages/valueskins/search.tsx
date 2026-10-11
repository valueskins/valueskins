'use client';

import { useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';

const C = {
  bg: '#0A0A0A',
  surface: '#1A1A1A',
  border: 'var(--c-border)',
  text: '#F5F5F0',
  textSecondary: '#D6D2C8',
  primary: '#0066CC',
  success: 'var(--c-accent)',
  error: 'var(--c-error)',
};

interface ValueskinResult {
  id: string;
  valueskinCode: string;
  tier: number;
  creator: {
    id: number;
    username: string;
    displayName: string;
    avatarUrl: string;
  };
  profession: {
    name: string;
    category: string;
  };
}

export default function ValueskinSearchPage() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [result, setResult] = useState<ValueskinResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) {
      setError('Enter a ValueSkin ID');
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const res = await fetch(`/api/valueskins/search?code=${encodeURIComponent(code)}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'ValueSkin not found');
      }
      const data = await res.json();
      setResult(data);
    } catch (err: any) {
      setError(err.message || 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: C.bg, padding: '40px 20px' }}>
      <div style={{ maxWidth: '600px', margin: '0 auto' }}>
        <div style={{ marginBottom: '40px', textAlign: 'center' }}>
          <h1 style={{ fontSize: '32px', fontWeight: 700, color: C.text, margin: '0 0 12px 0' }}>
            Search ValueSkins
          </h1>
          <p style={{ fontSize: '14px', color: C.textSecondary, margin: 0 }}>
            Find creators by their unique ValueSkin ID
          </p>
        </div>

        <form onSubmit={handleSearch} style={{ marginBottom: '40px' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              placeholder="Enter ValueSkin ID (e.g., VS-XXXXXXXX-XXXX)"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              style={{
                flex: 1,
                padding: '12px 16px',
                background: C.surface,
                border: `1px solid ${C.border}`,
                borderRadius: '8px',
                color: C.text,
                fontSize: '14px',
              }}
            />
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: '12px 24px',
                background: C.primary,
                color: 'var(--c-on-primary)',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.6 : 1,
              }}
            >
              {loading ? 'Searching...' : 'Search'}
            </button>
          </div>
        </form>

        {error && (
          <div style={{
            padding: '16px',
            background: 'rgba(176, 65, 62, 0.1)',
            color: 'var(--c-error)',
            border: `1px solid ${C.error}`,
            borderRadius: '8px',
            marginBottom: '20px',
            fontSize: '14px',
          }}>
            {error}
          </div>
        )}

        {result && (
          <div style={{
            padding: '24px',
            background: C.surface,
            border: `1px solid ${C.border}`,
            borderRadius: '12px',
          }}>
            <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
              <div
                style={{
                  width: '100px',
                  height: '100px',
                  borderRadius: '8px',
                  background: C.primary,
                  color: 'var(--c-on-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '40px',
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                {result.creator.displayName.charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <h2 style={{ fontSize: '20px', fontWeight: 700, color: C.text, margin: '0 0 4px 0' }}>
                  {result.creator.displayName}
                </h2>
                <p style={{ fontSize: '14px', color: C.textSecondary, margin: '0 0 12px 0' }}>
                  @{result.creator.username}
                </p>
                <div style={{
                  display: 'inline-block',
                  padding: '6px 12px',
                  background: C.bg,
                  border: `1px solid ${C.border}`,
                  borderRadius: '6px',
                  fontSize: '12px',
                  color: C.textSecondary,
                  marginBottom: '12px',
                }}>
                  {result.profession.name} • Tier {result.tier}
                </div>
              </div>
            </div>

            <div style={{
              padding: '16px',
              background: C.bg,
              border: `1px solid ${C.border}`,
              borderRadius: '8px',
              marginBottom: '20px',
            }}>
              <p style={{ fontSize: '12px', color: C.textSecondary, margin: '0 0 6px 0', textTransform: 'uppercase' }}>
                ValueSkin ID
              </p>
              <p style={{ fontSize: '16px', fontWeight: 700, color: C.text, margin: 0 }}>
                {result.valueskinCode}
              </p>
            </div>

            <Link
              href={`/creator/${result.creator.username}`}
              style={{
                display: 'inline-block',
                padding: '12px 24px',
                background: C.primary,
                color: 'var(--c-on-primary)',
                borderRadius: '8px',
                textDecoration: 'none',
                fontSize: '14px',
                fontWeight: 600,
              }}
            >
              View Full Profile →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
