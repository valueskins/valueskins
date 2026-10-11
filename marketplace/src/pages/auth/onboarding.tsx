'use client';
import { useEffect, useState } from 'react';
import ValueSkinsLogo from '@/components/ValueSkinsLogo';
import { useAuth } from '@/context/AuthContext';

// Role Selection (Front Door) — per ui-specs/Role Selection.md, with the single
// phase-2 change from ui-specs/phase-2/Welcome screen.md (GP1): the role cards
// are entry points into auth, not direct role routers. Visuals are unchanged.
const FONT = "'Poppins', 'Helvetica Neue', Arial, sans-serif";

// GP1: a role picked before OAuth is held transiently and applied after login.
// It is a convenience pre-selection, never the commit.
const PENDING_ROLE_COOKIE = 'vs_pending_role';
const PENDING_ROLE_MAX_AGE = 15 * 60; // 15 min — long enough to finish OAuth

function readPendingRole(): 'creator' | 'brand' | null {
  if (typeof document === 'undefined') return null;
  const m = document.cookie.match(/(?:^|;\s*)vs_pending_role=(creator|brand)(?:;|$)/);
  return m ? (m[1] as 'creator' | 'brand') : null;
}

function writePendingRole(role: 'creator' | 'brand') {
  document.cookie = `${PENDING_ROLE_COOKIE}=${role}; Max-Age=${PENDING_ROLE_MAX_AGE}; Path=/; SameSite=Lax`;
}

function clearPendingRole() {
  document.cookie = `${PENDING_ROLE_COOKIE}=; Max-Age=0; Path=/; SameSite=Lax`;
}

function useReduced() {
  const [r, setR] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setR(mq.matches);
    const on = () => setR(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return r;
}

// Proof counter count-up on load (spec §1). Illustrative pre-launch (spec §4).
function Counter({ to, prefix = '', reduced }: { to: number; prefix?: string; reduced: boolean }) {
  const [v, setV] = useState(reduced ? to : 0);
  useEffect(() => {
    if (reduced) {
      setV(to);
      return;
    }
    const start = performance.now();
    const dur = 1200;
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / dur);
      setV(Math.round((1 - Math.pow(1 - p, 3)) * to));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, reduced]);
  return (
    <span>
      {prefix}
      {v.toLocaleString('en-IN')}
    </span>
  );
}

export default function Onboarding() {
  const reduced = useReduced();
  const { account, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hovered, setHovered] = useState<'creator' | 'brand' | null>(null);
  const [mounted, setMounted] = useState(false);
  const [stats, setStats] = useState({ creators: 0, deals: 0, paidOut: 0 });

  useEffect(() => {
    setMounted(true);
    // GP1: if a role was picked at the welcome screen before OAuth, pre-select it
    // here so the user only has to confirm.
    const pending = readPendingRole();
    if (pending) setHovered(pending);

    // Fetch real stats from the database
    fetch('/api/admin/dashboard')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d) setStats({ creators: d.totalUsers ?? 0, deals: d.totalDeals ?? 0, paidOut: d.totalPaidOut ?? 0 });
      })
      .catch(() => {});
  }, []);

  // GP1 step 2: a returning user who already committed a role skips the prompt.
  useEffect(() => {
    if (!authLoading && account?.onboarding_stage === 'complete') {
      clearPendingRole();
      window.location.replace('/demo/marketplace');
    }
  }, [authLoading, account?.onboarding_stage]);

  // GP1: clicking a card means two different things depending on auth state.
  //   signed out -> this is an ENTRY POINT: hold the choice, go to login/OAuth.
  //   signed in  -> this IS the commit; the post-OAuth prompt is the source of truth.
  const handleSelect = async (role: 'brand' | 'creator') => {
    if (!authLoading && !account) {
      writePendingRole(role);
      window.location.href = '/auth/login';
      return;
    }

    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/onboarding-complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ role }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed');
      }
      clearPendingRole();
      window.location.href = '/demo/marketplace';
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  const cards: { role: 'creator' | 'brand'; title: string; desc: string; reveal: string[] }[] = [
    {
      role: 'creator',
      title: "I'm a Creator",
      desc: 'Apply to brand campaigns, showcase your content, and get paid for your influence.',
      reveal: ['Earned reputation', 'Guaranteed escrow payment', 'On-record deals'],
    },
    {
      role: 'brand',
      title: "I'm a Brand",
      desc: 'Create campaigns, find the right creators, and grow your brand through authentic content.',
      reveal: ['Verified creators', 'Pay only on approval', 'Real outcomes'],
    },
  ];

  const entrance = (i: number): React.CSSProperties =>
    reduced
      ? {}
      : {
          opacity: mounted ? 1 : 0,
          transform: mounted ? 'none' : 'translateY(16px)',
          transition: `opacity 600ms cubic-bezier(0.16,1,0.3,1) ${i * 110}ms, transform 600ms cubic-bezier(0.16,1,0.3,1) ${i * 110}ms`,
        };

  return (
    <div
      style={{
        minHeight: '100vh',
        // Tonal dark gradient + faint sand glow (BRANDING §10.2 / spec §1)
        background:
          'radial-gradient(60% 45% at 82% 0%, rgba(160,138,94,0.16), transparent 66%), linear-gradient(150deg, #0A0A0A 0%, #161512 55%, #20201B 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 20px',
        fontFamily: FONT,
        color: '#F5F5F0',
      }}
    >
      <div style={{ width: '100%', maxWidth: '860px' }}>
        {/* Hero */}
        <div style={{ textAlign: 'center', marginBottom: '40px', ...entrance(0) }}>
          <ValueSkinsLogo theme="dark" size={34} />
          <h1 style={{ fontSize: 'clamp(1.6rem, 4vw, 2rem)', fontWeight: 700, margin: '28px 0 10px', lineHeight: 1.15 }}>
            Where creators and brands close deals on{' '}
            <span style={{ color: '#C8B89A' }}>earned trust</span>.
          </h1>
          <p style={{ fontSize: '1rem', color: '#B8B4AC', margin: 0 }}>
            Verified identities. Real reputation. Money that actually moves.
          </p>
        </div>

        {/* Proof counters — real DB counts with pre-launch fallback */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '40px', flexWrap: 'wrap', marginBottom: '40px', ...entrance(1) }}>
          {[
            { label: 'Creators verified', node: <Counter to={stats.creators || 0} reduced={reduced} /> },
            { label: 'Deals completed', node: <Counter to={stats.deals || 0} reduced={reduced} /> },
            { label: 'Paid to creators', node: <Counter to={stats.paidOut || 0} prefix="₹" reduced={reduced} /> },
          ].map((s) => (
            <div key={s.label} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#F5F5F0' }}>{s.node}</div>
              <div style={{ fontSize: '0.75rem', letterSpacing: '0.08em', color: '#B8B4AC', marginTop: '4px' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {error && (
          <div style={{ padding: '10px 14px', background: 'rgba(176,65,62,0.12)', color: '#E88', borderRadius: '6px', fontSize: '0.8125rem', marginBottom: '20px', textAlign: 'center', border: '1px solid rgba(176,65,62,0.4)' }}>
            {error}
          </div>
        )}

        {/* Role split — spotlight on hover, dims the other (spec §1) */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', ...entrance(2) }}>
          {cards.map((card) => {
            const isHovered = hovered === card.role;
            const dimmed = hovered !== null && !isHovered;
            return (
              <button
                key={card.role}
                onClick={() => handleSelect(card.role)}
                disabled={loading}
                onMouseEnter={() => setHovered(card.role)}
                onMouseLeave={() => setHovered(null)}
                onFocus={() => setHovered(card.role)}
                onBlur={() => setHovered(null)}
                style={{
                  padding: '36px 28px',
                  border: `1px solid ${isHovered ? 'rgba(200,184,154,0.55)' : 'rgba(200,184,154,0.2)'}`,
                  borderRadius: '10px',
                  background: isHovered ? 'rgba(200,184,154,0.06)' : 'rgba(255,255,255,0.02)',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  textAlign: 'left',
                  color: '#F5F5F0',
                  fontFamily: FONT,
                  transition: reduced ? 'none' : 'transform 0.25s cubic-bezier(0.16,1,0.3,1), border-color 0.2s, background 0.2s, opacity 0.2s',
                  transform: !reduced && isHovered ? 'translateY(-4px)' : 'none',
                  opacity: loading ? 0.5 : dimmed ? 0.55 : 1,
                }}
              >
                <div style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '10px' }}>{card.title}</div>
                <div style={{ fontSize: '0.9375rem', color: '#B8B4AC', lineHeight: 1.5, marginBottom: '16px' }}>{card.desc}</div>
                {/* Hidden feature lines reveal on hover (spec §1) */}
                <div
                  style={{
                    maxHeight: isHovered && !reduced ? '120px' : reduced ? 'none' : '0',
                    opacity: isHovered || reduced ? 1 : 0,
                    overflow: 'hidden',
                    transition: reduced ? 'none' : 'max-height 0.3s ease, opacity 0.3s ease',
                  }}
                >
                  {card.reveal.map((line) => (
                    <div key={line} style={{ fontSize: '0.8125rem', color: '#C8B89A', padding: '3px 0' }}>
                      <span style={{ marginRight: '8px' }}>→</span>
                      {line}
                    </div>
                  ))}
                  <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#F5F5F0', marginTop: '10px' }}>
                    Continue as {card.role === 'creator' ? 'Creator' : 'Brand'} →
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Current-flow copy kept verbatim. NOTE: contradicts Role Selection.md §1
            ("You can change your role anytime in settings.") — flagged, not changed. */}
        <div style={{ textAlign: 'center', marginTop: '24px', fontSize: '0.75rem', color: '#B8B4AC' }}>
          {loading ? 'Setting up your account…' : 'This selection is permanent and cannot be changed later.'}
        </div>
      </div>
    </div>
  );
}
