'use client';
import { useState } from 'react';
import Link from 'next/link';
// import { getGoogleAuthUrl } from '@/lib/oauth'; // Google OAuth — commented out (kept for reference)
import { getInstagramAuthUrl } from '@/lib/oauth';
import { C } from '@/theme/colors';
import ValueSkinsLogo from '@/components/ValueSkinsLogo';

// Note: Using unified ValueSkins theme - same functionality, consistent styling

export default function Signup() {
  const [error, setError] = useState('');

  // GOOGLE OAUTH — COMMENTED OUT (kept for reference, do not delete)
  // const handleGoogleAuth = async () => {
  //   try {
  //     const url = await getGoogleAuthUrl();
  //     window.location.href = url;
  //   } catch {
  //     setError('Failed to start signup');
  //   }
  // };

  // Instagram Login (via Meta) — signing up also verifies account control.
  const handleInstagramAuth = async () => {
    try {
      const url = await getInstagramAuthUrl();
      window.location.href = url;
    } catch {
      setError('Failed to start signup');
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', fontFamily: "'Poppins', 'Helvetica Neue', Arial, sans-serif" }}>
      <div style={{ width: '100%', maxWidth: '440px' }}>
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div style={{ marginBottom: '24px' }}><ValueSkinsLogo theme="light" size={26} /></div>
          <p style={{ fontSize: '15px', color: C.textSecondary }}>
            Create one account. Access everything.
          </p>
        </div>

        {error && <div style={{ padding: '10px 14px', background: 'var(--c-error-container)', color: C.error, borderRadius: '8px', fontSize: '13px', marginBottom: '16px', border: '1px solid var(--c-error)' }}>{error}</div>}

        <button onClick={handleInstagramAuth} style={{ width: '100%', padding: '12px', background: C.bg, color: C.text, border: `1px solid ${C.border}`, borderRadius: '8px', fontSize: '15px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '10px' }}>
          {/* GOOGLE GLYPH — COMMENTED OUT (kept for reference, do not delete)
          <svg width="18" height="18" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
          Sign up with Google
          */}
          {/* Instagram glyph */}
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><rect x="2.2" y="2.2" width="19.6" height="19.6" rx="5.4" fill="none" stroke="currentColor" strokeWidth="1.9"/><circle cx="12" cy="12" r="4.6" fill="none" stroke="currentColor" strokeWidth="1.9"/><circle cx="17.4" cy="6.6" r="1.25" fill="currentColor"/></svg>
          Sign up with Instagram
        </button>

        <p style={{ fontSize: '13px', color: C.textSecondary, textAlign: 'center', marginTop: '24px' }}>
          Already have an account? <Link href="/auth/login" style={{ color: C.primary, textDecoration: 'none', fontWeight: 600 }}>Sign in</Link>
        </p>
      </div>
    </div>
  );
}
