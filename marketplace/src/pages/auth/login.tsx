'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Head from 'next/head';
// import { getGoogleAuthUrl } from '@/lib/oauth'; // Google OAuth — commented out (kept for reference)
import { getInstagramAuthUrl } from '@/lib/oauth';
import { ValueSkinSprite } from '@/features/profiles/ProfileView';

// Login Page — per "login page.md" v2 (dark premium).
// Fixed dark. The spec's light toggle (§0b) is deliberately NOT shipped here —
// the auth screen is a single brand moment and should not offer a theme choice.
// The light tokens are kept below so the surface can be flipped if that changes.
// One brand moment: the centered hero wordmark IS the logo — no pill, no nav
// logo, top-left stays empty (§1). No black divider band (§4).
// Single viewport, no scroll (§3) — the global footer is suppressed for this
// route in _app.tsx and a slim footer is pinned here instead (§0b.6).
//
// AUTH: Google OAuth is commented out and replaced by Instagram OAuth
// (Instagram Login via Meta). See handleInstagramAuth below.

const FONT = "'Inter', 'Helvetica Neue', Arial, sans-serif";
const EASE = 'cubic-bezier(0.16,1,0.3,1)';
const DEEP_SAND = '#A08A5E';

type Theme = 'dark' | 'light';

const T = {
  dark: {
    surface:
      'radial-gradient(60% 45% at 84% -8%, rgba(160,138,94,0.18), transparent 60%), linear-gradient(155deg,#0A0A0A,#161512 58%,#20201A)',
    head: '#F5F5F0',
    body: '#C9C5BC',
    muted: '#8A867E',
    hair: 'rgba(245,245,240,0.10)',
    btnBg: '#F5F5F0',
    btnLabel: '#0A0A0A',
    btnShadow: '0 10px 30px -12px rgba(200,184,154,0.45)',
  },
  light: {
    surface:
      'radial-gradient(60% 45% at 84% -8%, rgba(160,138,94,0.16), transparent 60%), linear-gradient(155deg,#F4F3EE,#EEE9DE 58%,#E6E0D2)',
    head: '#0A0A0A',
    body: '#2D2D2D',
    muted: '#6E6A60',
    hair: 'rgba(160,138,94,0.22)',
    btnBg: '#0A0A0A',
    btnLabel: '#F5F5F0',
    btnShadow: '0 10px 30px -12px rgba(45,45,45,0.35)',
  },
} as const;

// §0b.2 — drifting ValueSkin pixel identities, faint, slow float.
const DRIFTERS = [
  { left: '8%', top: '18%', size: 96, dur: 17, delay: 0 },
  { left: '82%', top: '24%', size: 74, dur: 21, delay: 2.5 },
  { left: '16%', top: '68%', size: 68, dur: 19, delay: 1.2 },
  { left: '74%', top: '72%', size: 104, dur: 23, delay: 3.4 },
  { left: '46%', top: '12%', size: 58, dur: 25, delay: 4.1 },
];

export default function Login() {
  const [error, setError] = useState('');
  const [hover, setHover] = useState(false);
  const [pressed, setPressed] = useState(false);
  // Fixed dark — the auth screen has no theme toggle.
  const theme: Theme = 'dark';
  const [mounted, setMounted] = useState(false);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    // Starting a real login always exits preview mode, so a lingering preview
    // flag (from a /preview visit in this tab) can never shadow a real session.
    try { window.sessionStorage.removeItem('vs_preview'); } catch {}

    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const on = () => setReduced(mq.matches);
    mq.addEventListener('change', on);
    setMounted(true);

    // The sign-in callback sends people back here with a reason when it has to
    // stop. Only known codes are shown, never text taken from the URL.
    const code = new URLSearchParams(window.location.search).get('error');
    const REASONS: Record<string, string> = {
      account_type_unsupported:
        'This Instagram account is not a Business or Creator account. Switch it to a professional account in Instagram settings, then sign in again.',
      account_type_unreadable:
        'We could not read your Instagram account type. Please make sure the account is public and is a Business or Creator account, then try again.',
    };
    if (code && REASONS[code]) setError(REASONS[code]);

    return () => mq.removeEventListener('change', on);
  }, []);

  // ─── AUTH ───────────────────────────────────────────────────────────
  // GOOGLE OAUTH — COMMENTED OUT (kept for reference, do not delete)
  // const handleGoogleAuth = async () => {
  //   try {
  //     const url = await getGoogleAuthUrl();
  //     window.location.href = url;
  //   } catch {
  //     setError('Failed to start login');
  //   }
  // };

  // Instagram Login (via Meta) — logging in also verifies account control,
  // since only the holder of the account's credentials can complete OAuth.
  const handleInstagramAuth = async () => {
    try {
      const url = await getInstagramAuthUrl();
      window.location.href = url;
    } catch {
      setError('Failed to start login');
    }
  };
  // ────────────────────────────────────────────────────────────────────

  const t = T[theme];
  const shown = mounted || reduced;

  // §0b.2 — staggered entrance: wordmark → tagline → line → button → sign-up → trust → footer
  const enter = useMemo(
    () => (delay: number) => ({
      opacity: shown ? 1 : 0,
      transform: shown ? 'translateY(0)' : 'translateY(10px)',
      transition: reduced ? 'none' : `opacity 0.6s ${EASE} ${delay}s, transform 0.6s ${EASE} ${delay}s`,
    }),
    [shown, reduced],
  );

  return (
    <>
      <Head><title>Sign in · ValueSkins</title></Head>

      <div
        className="vs-login"
        style={{
          position: 'relative',
          minHeight: '100dvh',
          background: t.surface,
          display: 'flex',
          flexDirection: 'column',
          fontFamily: FONT,
          overflow: 'hidden', // §3: one viewport, never scrolls
        }}
      >
        {/* §0b.2 — drifting ValueSkin identities, opacity ~0.09 */}
        <div aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.09 }}>
          {DRIFTERS.map((d, i) => (
            <span
              key={i}
              style={{
                position: 'absolute',
                left: d.left,
                top: d.top,
                animation: reduced ? 'none' : `vsDrift ${d.dur}s ${EASE} ${d.delay}s infinite`,
              }}
            >
              <ValueSkinSprite size={d.size} />
            </span>
          ))}
        </div>

        {/* No theme toggle on the auth screen — this is a fixed dark brand
            moment. Top-left stays empty (§1); top-right is now empty too. */}
        <div style={{ position: 'relative', height: 24 }} />

        {/* Auth zone — grows and optically centers (§2) */}
        <div
          style={{
            position: 'relative',
            flex: '1 1 auto',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            padding: '8px 20px 24px',
          }}
        >
          <div style={{ width: '100%', maxWidth: 460, textAlign: 'center' }}>

            {/* Hero wordmark — the only logo on this page (§1, §2) */}
            <div style={enter(0.05)}>
              <div
                style={{
                  color: t.head, fontWeight: 700,
                  fontSize: 'clamp(30px, 5vw, 40px)',
                  letterSpacing: '0.18em', lineHeight: 1,
                }}
              >
                VALUESKINS
              </div>
              {/* Tagline ~25% of wordmark, dots in Deep Sand (§2) */}
              <div
                style={{
                  marginTop: 12, color: t.body, fontWeight: 500,
                  fontSize: 'clamp(9px, 1.4vw, 11px)', letterSpacing: '0.34em',
                  ...enter(0.13),
                }}
              >
                TRUST <span style={{ color: DEEP_SAND }}>·</span> EARNED{' '}
                <span style={{ color: DEEP_SAND }}>·</span> SERIOUS
              </div>
            </div>

            {/* §0b.3 — one confident line (replaces the cut sub-headline) */}
            <p
              style={{
                margin: '26px 0 0', color: t.body,
                fontSize: 'clamp(15px, 1.8vw, 19px)', lineHeight: 1.5,
                ...enter(0.21),
              }}
            >
              Brands post deals. Creators apply. Fixed price, paid directly.
            </p>

            {error && (
              <div
                role="alert"
                style={{
                  marginTop: 20, padding: '10px 14px',
                  background: 'rgba(176,65,62,0.10)', color: '#D98682',
                  border: '1px solid rgba(176,65,62,0.35)', borderRadius: 8,
                  fontSize: '0.8125rem',
                }}
              >
                {error}
              </div>
            )}

            {/* §0b.4 — solid single action, 10px radius, soft tinted shadow, hover lift */}
            <button
              onClick={handleInstagramAuth}
              onMouseEnter={() => setHover(true)}
              onMouseLeave={() => { setHover(false); setPressed(false); }}
              onMouseDown={() => setPressed(true)}
              onMouseUp={() => setPressed(false)}
              style={{
                width: '100%', maxWidth: 420, marginTop: 32,
                minHeight: 52, padding: '15px 20px',
                background: t.btnBg, color: t.btnLabel, border: 'none',
                borderRadius: 10,
                fontSize: '1rem', fontWeight: 600, fontFamily: FONT,
                cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                boxShadow: hover && !reduced ? t.btnShadow : '0 6px 18px -12px rgba(10,10,10,0.5)',
                transform: reduced ? 'none' : pressed ? 'translateY(1px)' : hover ? 'translateY(-1px)' : 'translateY(0)',
                transition: reduced ? 'none' : 'transform 0.15s ease, box-shadow 0.2s ease',
                ...enter(0.29),
              }}
            >
              {/* GOOGLE GLYPH — COMMENTED OUT (kept for reference, do not delete)
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              Continue with Google
              */}
              {/* Instagram glyph */}
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                <rect x="2.2" y="2.2" width="19.6" height="19.6" rx="5.4" fill="none" stroke="currentColor" strokeWidth="1.9" />
                <circle cx="12" cy="12" r="4.6" fill="none" stroke="currentColor" strokeWidth="1.9" />
                <circle cx="17.4" cy="6.6" r="1.25" fill="currentColor" />
              </svg>
              Continue with Instagram
            </button>

            <p style={{ margin: '16px 0 0', fontSize: '0.6875rem', color: t.muted, lineHeight: 1.5, ...enter(0.5) }}>
              By continuing, you agree to our{' '}
              <Link href="/legal/terms" style={{ color: t.muted, textDecoration: 'underline', textUnderlineOffset: 2 }}>
                Terms of Service
              </Link>{' '}
              and{' '}
              <Link href="/legal/privacy" style={{ color: t.muted, textDecoration: 'underline', textUnderlineOffset: 2 }}>
                Privacy Policy
              </Link>
              .
            </p>
          </div>
        </div>

        {/* §0b.6 — slim footer pinned to the bottom, hairline top, no black band */}
        <footer
          style={{
            position: 'relative',
            borderTop: `1px solid ${t.hair}`,
            padding: '14px 24px',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            gap: 12, flexWrap: 'wrap',
            fontSize: '0.75rem', color: t.muted,
            ...enter(0.57),
          }}
        >
          <span>© 2026 ValueSkins</span>
          <span style={{ display: 'flex', gap: 14 }}>
            <Link href="/legal/terms" style={{ color: t.muted, textDecoration: 'none' }}>Terms</Link>
            <Link href="/legal/privacy" style={{ color: t.muted, textDecoration: 'none' }}>Privacy</Link>
            <Link href="/legal/cookies" style={{ color: t.muted, textDecoration: 'none' }}>Cookies</Link>
          </span>
        </footer>
      </div>

      <style jsx global>{`
        @keyframes vsDrift {
          0%, 100% { transform: translate3d(0, 0, 0); }
          50%      { transform: translate3d(0, -22px, 0); }
        }
        /* §6 — sand focus ring, never removed without replacement */
        .vs-login a:focus-visible,
        .vs-login button:focus-visible {
          outline: 2px solid ${DEEP_SAND};
          outline-offset: 2px;
        }
        @media (prefers-reduced-motion: reduce) {
          @keyframes vsDrift { 0%, 100% { transform: none; } }
        }
      `}</style>
    </>
  );
}
