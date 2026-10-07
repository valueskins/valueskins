'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';
import { C } from '@/theme/colors';
import ValueSkinsLogo from '@/components/ValueSkinsLogo';
import DriftingSkins from '@/components/DriftingSkins';

const FONT = "'Inter', 'Helvetica Neue', Arial, sans-serif";

// prefers-reduced-motion — reveals resolve to visible, count-up/parallax off.
function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const on = () => setReduced(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return reduced;
}

// Staggered scroll reveal (spec §2) — fades + rises on enter. Transform/opacity only.
function Reveal({
  children,
  from = 'up',
  delay = 0,
  reduced,
  style,
}: {
  children: React.ReactNode;
  from?: 'up' | 'left' | 'right';
  delay?: number;
  reduced: boolean;
  style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (reduced) {
      setShown(true);
      return;
    }
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            setShown(true);
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.15 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [reduced]);

  const offset =
    from === 'left' ? 'translateX(-40px)' : from === 'right' ? 'translateX(40px)' : 'translateY(28px)';

  return (
    <div
      ref={ref}
      style={{
        opacity: shown ? 1 : 0,
        transform: shown ? 'none' : offset,
        transition: `opacity 700ms cubic-bezier(0.16,1,0.3,1) ${delay}ms, transform 700ms cubic-bezier(0.16,1,0.3,1) ${delay}ms`,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// Count-up (spec §2/§3a) — animates the pricing number into view.
function CountUp({ to, suffix = '', reduced }: { to: number; suffix?: string; reduced: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [val, setVal] = useState(reduced ? to : 0);

  useEffect(() => {
    if (reduced) {
      setVal(to);
      return;
    }
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          const start = performance.now();
          const dur = 1100;
          const tick = (now: number) => {
            const p = Math.min(1, (now - start) / dur);
            const eased = 1 - Math.pow(1 - p, 3);
            setVal(Math.round(eased * to));
            if (p < 1) raf = requestAnimationFrame(tick);
          };
          raf = requestAnimationFrame(tick);
          io.disconnect();
        }
      },
      { threshold: 0.5 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [to, reduced]);

  return (
    <span ref={ref}>
      {val}
      {suffix}
    </span>
  );
}

export default function HomePage() {
  const router = useRouter();
  const { account, loading } = useAuth();
  const reduced = usePrefersReducedMotion();
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    if (reduced) return;
    const on = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, [reduced]);

  useEffect(() => {
    if (loading) return;
    if (account && account.onboarding_stage === 'complete') {
      router.replace('/deals/browse');
    }
  }, [account, loading, router]);

  // Deliberately NOT gated on `loading`. Gating here put a blank screen in
  // front of the front door for 6-10s in production — the auth probe resolves
  // far slower in the browser than /api/auth/me does on its own (~0.5s), and
  // every visitor paid for it before seeing anything. Landing on the welcome
  // page immediately is the point; a signed-in visitor sees the hero for a
  // moment before the redirect below fires, which is the cheaper trade.
  if (account && account.onboarding_stage === 'complete') return null;

  // Hero parallax + fade as you leave it (spec §2). Transform/opacity only.
  const heroFade = reduced ? 1 : Math.max(0, 1 - scrollY / 420);
  const heroLift = reduced ? 0 : Math.min(60, scrollY * 0.25);

  return (
    <div style={{ minHeight: '100vh', background: C.bg, fontFamily: FONT }}>
      {/* Hero — full-bleed brand moment, same drifting ValueSkin texture as the
          login screen (BRANDING §10.4: the skin is a recurring brand device). */}
      <div style={{ position: 'relative', overflow: 'hidden' }}>
      <DriftingSkins />
      <div
        style={{
          position: 'relative',
          maxWidth: '960px',
          margin: '0 auto',
          padding: '80px 24px 60px',
          textAlign: 'center',
          opacity: heroFade,
          transform: `translateY(-${heroLift}px)`,
        }}
      >
        <div style={{ marginBottom: '40px' }}>
          <ValueSkinsLogo size={32} />
        </div>

        <h1 style={{ fontSize: 'clamp(2.5rem, 6vw, 3rem)', fontWeight: 800, color: C.text, margin: '0 0 20px', lineHeight: 1.1, letterSpacing: '-0.02em' }}>
          The marketplace for<br />creators and brands
        </h1>
        <p style={{ fontSize: '1.125rem', color: C.textSecondary, margin: '0 auto 40px', maxWidth: '540px', lineHeight: 1.6 }}>
          Brands post deals. Creators apply. The amount is fixed up front, and
          the creator is paid directly - 30% to start, the rest on approval.
        </p>

        {/* ONE call to action. Sign-in is OAuth only and the callback creates
            the account on first use, so "Get Started" and "Sign In" were the
            same journey wearing two labels. All routed to /auth/login. */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
          <Link href="/auth/login" style={{
            display: 'inline-block', padding: '14px 32px', background: C.text, color: C.bg,
            borderRadius: '8px', fontSize: '0.9375rem', fontWeight: 700, textDecoration: 'none',
            transition: 'transform 0.15s',
          }}>
            Get Started
          </Link>
          {/* The run club lives at its own URL so it needs no space here beyond
              a quiet line. The product is not blacked out for it. */}
          <Link href="/run-club" style={{
            fontSize: '0.8125rem', color: C.textSecondary, textDecoration: 'underline',
            textUnderlineOffset: '3px',
          }}>
            Or join our Pune run club
          </Link>
        </div>

        {/* Scroll hint — bobbing chevron (spec §2) */}
        {!reduced && (
          <div style={{ marginTop: '56px', opacity: heroFade }}>
            <div style={{ fontSize: '0.75rem', letterSpacing: '0.14em', color: C.textSecondary, marginBottom: '8px' }}>SCROLL</div>
            <div style={{ animation: 'vsBob 1.8s ease-in-out infinite', color: C.accent, fontSize: '18px' }}>⌄</div>
          </div>
        )}
      </div>
      </div>

      {/* How It Works */}
      <div style={{ maxWidth: '960px', margin: '0 auto', padding: '60px 24px' }}>
        <Reveal reduced={reduced}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: C.text, textAlign: 'center', marginBottom: '48px' }}>
            How It Works
          </h2>
        </Reveal>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '32px' }}>
          {[
            { step: '01', title: 'Create Your Profile', desc: 'Showcase your skills, portfolio, and rates. Brands find you, or you find them.' },
            { step: '02', title: 'Make a Deal', desc: 'Brands post briefs, creators negotiate terms. Deliverables, deadlines, and payment are agreed upfront.' },
            { step: '03', title: 'Paid In Stages', desc: 'The creator gets 30% to start and the rest once the brand approves the work. Payments run through Razorpay.' },
            { step: '04', title: 'Deliver and Get Paid', desc: 'Creator submits work. Brand reviews and approves. Payment releases instantly. Reputation grows.' },
          ].map((item, i) => (
            <Reveal key={item.step} reduced={reduced} delay={i * 90}>
              <div style={{
                background: C.surface, border: `1px solid ${C.border}`, borderRadius: '10px',
                padding: '28px', transition: 'border-color 0.15s', height: '100%',
              }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: C.accent, marginBottom: '12px', letterSpacing: '0.1em' }}>
                  STEP {item.step}
                </div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: C.text, margin: '0 0 10px' }}>{item.title}</h3>
                <p style={{ fontSize: '0.9375rem', color: C.textSecondary, margin: 0, lineHeight: 1.6 }}>{item.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>

      {/* For Creators / For Brands — opposing reveal (spec §2) */}
      <div style={{ maxWidth: '960px', margin: '0 auto', padding: '40px 24px 60px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '32px' }}>
          <Reveal reduced={reduced} from="left">
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '10px', padding: '32px', height: '100%' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: C.text, margin: '0 0 16px' }}>For Creators</h3>
              <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                {[
                  'Build a public profile with your portfolio',
                  'Get discovered by brands looking for creators',
                  'Negotiate deal terms before committing',
                  'Paid 30% up front, the rest on approval',
                  'All communication documented and on-record',
                  'Build reputation with completed deals',
                ].map((item, i) => (
                  <li key={i} style={{ fontSize: '0.9375rem', color: C.textSecondary, padding: '6px 0', lineHeight: 1.5 }}>
                    <span style={{ color: C.accent, marginRight: '8px' }}>→</span>{item}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
          <Reveal reduced={reduced} from="right">
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '10px', padding: '32px', height: '100%' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: C.text, margin: '0 0 16px' }}>For Brands</h3>
              <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                {[
                  'Browse verified creator profiles and portfolios',
                  'Post campaign briefs and receive pitches',
                  'Set clear deliverables, deadlines, and budgets',
                  'You only pay the rest once you approve the work',
                  'Only pay for work you are satisfied with',
                  'Track every deal from start to finish',
                ].map((item, i) => (
                  <li key={i} style={{ fontSize: '0.9375rem', color: C.textSecondary, padding: '6px 0', lineHeight: 1.5 }}>
                    <span style={{ color: C.accent, marginRight: '8px' }}>→</span>{item}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        </div>
      </div>

      {/* Pricing — reshaped, 12% vs agencies (spec §3a). Not led by a giant number. */}
      <div style={{ maxWidth: '760px', margin: '0 auto', padding: '40px 24px 60px', textAlign: 'center' }}>
        <Reveal reduced={reduced}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: C.text, margin: '0 0 12px' }}>
            Pricing that only wins when you do
          </h2>
          <p style={{ fontSize: '1rem', color: C.textSecondary, margin: '0 auto 36px', maxWidth: '520px', lineHeight: 1.6 }}>
            No subscription, no upfront fees. You only pay when a deal completes.
          </p>
          <div
            style={{
              display: 'flex',
              gap: '24px',
              justifyContent: 'center',
              alignItems: 'stretch',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '10px', padding: '28px 36px', minWidth: '200px' }}>
              <div style={{ fontSize: '0.75rem', letterSpacing: '0.1em', color: C.textSecondary, marginBottom: '10px' }}>VALUESKINS</div>
              <div style={{ fontSize: '2.25rem', fontWeight: 800, color: C.accent, lineHeight: 1 }}>
                <CountUp to={12} suffix="%" reduced={reduced} />
              </div>
            </div>
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '10px', padding: '28px 36px', minWidth: '200px' }}>
              <div style={{ fontSize: '0.75rem', letterSpacing: '0.1em', color: C.textSecondary, marginBottom: '10px' }}>TYPICAL AGENCIES</div>
              <div style={{ fontSize: '2.25rem', fontWeight: 800, color: C.textSecondary, lineHeight: 1 }}>15–25%</div>
            </div>
          </div>
          <p style={{ fontSize: '0.9375rem', color: C.textSecondary, margin: '28px auto 0', maxWidth: '480px', lineHeight: 1.6 }}>
            Less than half of what agencies charge — and only when the work is done.
          </p>
          <div style={{ marginTop: '32px' }}>
            <Link href="/competitors" style={{
              fontSize: '0.9375rem', color: C.accent, textDecoration: 'none', fontWeight: 600,
              borderBottom: `1px solid ${C.accent}`, paddingBottom: '2px'
            }}>
              See how we compare to competitors →
            </Link>
          </div>
        </Reveal>
      </div>

      {/* The closing "Ready to get started?" block existed only to host a third
          CTA to the same destination. With one call to action in the hero, the
          section had nothing left to do, so it goes with the button. */}

      <style>{`
        @keyframes vsBob {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(6px); }
        }
      `}</style>
    </div>
  );
}
