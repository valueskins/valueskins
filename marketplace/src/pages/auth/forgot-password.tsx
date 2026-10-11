'use client';
import { useState } from 'react';
import Link from 'next/link';
import { C } from '@/theme/colors';
import ValueSkinsLogo from '@/components/ValueSkinsLogo';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed'); return; }
      setSent(true);
    } catch { setError('Network error'); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', fontFamily: "'Poppins', 'Helvetica Neue', Arial, sans-serif" }}>
      <div style={{ width: '100%', maxWidth: '440px' }}>
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div style={{ marginBottom: '24px' }}><ValueSkinsLogo theme="light" size={26} /></div>
          <p style={{ fontSize: '15px', color: C.textSecondary }}>Reset your password</p>
        </div>

        {error && <div style={{ padding: '10px 14px', background: 'var(--c-error-container)', color: C.error, borderRadius: '8px', fontSize: '13px', marginBottom: '16px', border: '1px solid var(--c-error)' }}>{error}</div>}

        {sent ? (
          <div style={{ padding: '20px', textAlign: 'center' }}>
            <p style={{ color: C.text, fontSize: '14px', marginBottom: '16px' }}>
              If an account with that email exists, a reset link has been sent.
            </p>
            <Link href="/auth/login" style={{ color: C.primary, textDecoration: 'none', fontWeight: 600, fontSize: '14px' }}>Back to login</Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: C.text, marginBottom: '6px' }}>Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', border: `1px solid ${C.border}`, borderRadius: '8px', fontSize: '14px', background: C.surface, color: C.text, outline: 'none' }}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              style={{ width: '100%', padding: '12px', background: C.primary, color: C.onPrimary, border: 'none', borderRadius: '8px', fontSize: '15px', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1 }}
            >
              {loading ? 'Sending...' : 'Send reset link'}
            </button>
            <p style={{ fontSize: '13px', color: C.textSecondary, textAlign: 'center', marginTop: '8px' }}>
              Remember your password? <Link href="/auth/login" style={{ color: C.primary, textDecoration: 'none', fontWeight: 600 }}>Sign in</Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
