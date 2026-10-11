'use client';
import { useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';

const C = {
  onPrimary: 'var(--c-on-primary)', // correct foreground on C.primary in BOTH themes
  primary: '#0A0A0A',
  bg: '#ffffff',
  text: 'var(--c-text)',
  textSecondary: 'var(--c-text-variant)',
  border: 'var(--c-border)',
  error: 'var(--c-error)',
  success: 'var(--c-accent)',
};

export default function TwoFactorDisable() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleDisable = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/2fa/disable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ totp_code: code }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to disable 2FA');
      }
      setDone(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '28px', fontFamily: "'Poppins', 'Helvetica Neue', Arial, sans-serif" }}>
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: C.text, marginBottom: '8px' }}>2FA disabled</h1>
          <button onClick={() => router.push('/account/settings')} style={{ padding: '12px 24px', background: C.primary, color: C.onPrimary, border: 'none', borderRadius: '8px', fontSize: '17px', fontWeight: 600, cursor: 'pointer' }}>
            Back to settings
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '28px', fontFamily: "'Poppins', 'Helvetica Neue', Arial, sans-serif" }}>
      <div style={{ width: '100%', maxWidth: '440px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: C.text, marginBottom: '8px' }}>Disable two-factor authentication</h1>
        <p style={{ fontSize: '17px', color: C.textSecondary, marginBottom: '48px' }}>Enter a code from your authenticator app to confirm.</p>
        {error && <div style={{ padding: '10px', background: 'var(--c-error-container)', color: C.error, borderRadius: '8px', fontSize: '15px', marginBottom: '16px' }}>{error}</div>}
        <input type="text" placeholder="000000" value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} style={{ width: '100%', padding: '12px', border: `1px solid ${C.border}`, borderRadius: '8px', fontSize: '16px', marginBottom: '16px', textAlign: 'center', letterSpacing: '8px', boxSizing: 'border-box' }} />
        <button onClick={handleDisable} disabled={loading || code.length < 6} style={{ width: '100%', padding: '12px', background: code.length < 6 ? C.border : 'var(--c-error)', color: 'var(--c-text)', border: 'none', borderRadius: '8px', fontSize: '17px', fontWeight: 600, cursor: code.length < 6 ? 'not-allowed' : 'pointer', marginBottom: '16px' }}>
          {loading ? 'Disabling...' : 'Disable 2FA'}
        </button>
        <Link href="/account/settings" style={{ display: 'block', textAlign: 'center', fontSize: '15px', color: C.primary, textDecoration: 'none' }}>Cancel</Link>
      </div>
    </div>
  );
}
