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

      {/* How it works, in four lines. The full version is /how-it-works. */}
      <div style={{ maxWidth: '960px', margin: '0 auto', padding: '60px 24px 20px' }}>
        <Reveal reduced={reduced}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: C.text, textAlign: 'center', marginBottom: '48px' }}>
            How it works
          </h2>
        </Reveal>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '32px' }}>
          {[
            { step: '01', title: 'A brand posts a deal', desc: 'What it needs, the deadline and the amount. The amount is final.' },
            { step: '02', title: 'Creators apply', desc: 'Every creator sees every open deal. The brand picks one.' },
            { step: '03', title: 'The brand pays in three parts', desc: 'A flat fee to ValueSkins, then 30% to the creator before work starts and 70% after approval.' },
            { step: '04', title: 'The creator delivers', desc: 'The creator shares the content. The brand approves it or asks for changes.' },
          ].map((item, i) => (
            <Reveal key={item.step} reduced={reduced} delay={i * 90}>
              <div style={{
                background: C.surface, border: `1px solid ${C.border}`, borderRadius: '10px',
                padding: '28px', height: '100%',
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
        <div style={{ textAlign: 'center', marginTop: '32px' }}>
          <Link href="/how-it-works" style={{ fontSize: '0.9375rem', color: C.text, fontWeight: 600, textDecoration: 'underline', textUnderlineOffset: '3px' }}>
            Read the full walkthrough
          </Link>
        </div>
      </div>

      {/* What it costs. One number, stated once. */}
      <div style={{ maxWidth: '760px', margin: '0 auto', padding: '40px 24px 60px', textAlign: 'center' }}>
        <Reveal reduced={reduced}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: C.text, margin: '0 0 12px' }}>
            What it costs
          </h2>
          <p style={{ fontSize: '1rem', color: C.textSecondary, margin: '0 auto', maxWidth: '520px', lineHeight: 1.6 }}>
            ₹750 plus 18% GST per deal, which is ₹885. The brand pays it, and it comes out of the
            deal amount. Signing up, browsing and applying are free.
          </p>
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
