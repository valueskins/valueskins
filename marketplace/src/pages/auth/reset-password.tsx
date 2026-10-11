'use client';
import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { C } from '@/theme/colors';
import ValueSkinsLogo from '@/components/ValueSkinsLogo';

export default function ResetPassword() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) setError('Missing reset token');
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password !== confirm) { setError('Passwords do not match'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed'); return; }
      setSuccess(true);
      setTimeout(() => router.push('/auth/login'), 3000);
    } catch { setError('Network error'); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', fontFamily: "'Poppins', 'Helvetica Neue', Arial, sans-serif" }}>
      <div style={{ width: '100%', maxWidth: '440px' }}>
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div style={{ marginBottom: '24px' }}><ValueSkinsLogo theme="light" size={26} /></div>
          <p style={{ fontSize: '15px', color: C.textSecondary }}>Set a new password</p>
        </div>

        {error && <div style={{ padding: '10px 14px', background: 'var(--c-error-container)', color: C.error, borderRadius: '8px', fontSize: '13px', marginBottom: '16px', border: '1px solid var(--c-error)' }}>{error}</div>}

        {success ? (
          <div style={{ padding: '20px', textAlign: 'center' }}>
            <p style={{ color: C.text, fontSize: '14px', marginBottom: '16px' }}>
              Password reset successfully. Redirecting to login...
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: C.text, marginBottom: '6px' }}>New password</label>
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={e => setPassword(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', border: `1px solid ${C.border}`, borderRadius: '8px', fontSize: '14px', background: C.surface, color: C.text, outline: 'none' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: C.text, marginBottom: '6px' }}>Confirm password</label>
              <input
                type="password"
                required
                minLength={8}
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', border: `1px solid ${C.border}`, borderRadius: '8px', fontSize: '14px', background: C.surface, color: C.text, outline: 'none' }}
              />
            </div>
            <button
              type="submit"
              disabled={loading || !token}
              style={{ width: '100%', padding: '12px', background: C.primary, color: C.onPrimary, border: 'none', borderRadius: '8px', fontSize: '15px', fontWeight: 600, cursor: loading || !token ? 'not-allowed' : 'pointer', opacity: loading || !token ? 0.6 : 1 }}
            >
              {loading ? 'Resetting...' : 'Reset password'}
            </button>
            <p style={{ fontSize: '13px', color: C.textSecondary, textAlign: 'center', marginTop: '8px' }}>
              <Link href="/auth/login" style={{ color: C.primary, textDecoration: 'none', fontWeight: 600 }}>Back to login</Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
