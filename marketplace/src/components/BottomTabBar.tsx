'use client';

import Link from 'next/link';
import { useRouter } from 'next/router';
import { useState } from 'react';

// G8 — the bottom tab bar is the app spine: Profile · Market · Store · Settings,
// persistently visible, never scrolled away, above content.
//
// Why this exists rather than MarketplaceLayout: that shell renders a 470px
// phone column on desktop (it would shrink /feed from 1200px), backgrounds
// itself with `--ig-bg` — a token defined nowhere in the codebase — and its nav
// is an Instagram-style set, not this spine. Most of its callers pass
// hideBottomNav, so it was not supplying a tab bar at all.
//
// Labels rather than icons: BRANDING §6 is restraint, §1 rules out emoji, and
// no brand icon set exists yet. Inventing one here would be off-spec.

const TABS = [
  { href: '/profile/me',        label: 'Profile',  match: (p: string) => p.startsWith('/profile') },
  // /deals/browse redirects brands to /campaigns, so one href serves both roles.
  { href: '/deals/browse',      label: 'Market',   match: (p: string) => p.startsWith('/deals') || p.startsWith('/campaigns') || p.startsWith('/demo/marketplace') || p === '/marketplace' || p === '/feed' },
  { href: '/valueskins/store',  label: 'Store',    match: (p: string) => p.startsWith('/valueskins') },
  { href: '/settings',          label: 'Settings', match: (p: string) => p.startsWith('/settings') },
];

const BAR_HEIGHT = 64;

export default function BottomTabBar() {
  const router = useRouter();
  const [pressed, setPressed] = useState<string | null>(null);
  const path = router.pathname;

  return (
    <>
      {/* Nothing hides under the bar (G8). The variable also lets anything
          else pinned to the floor — the consent banner — stack above it
          instead of covering the navigation. */}
      <style>{`
        :root { --vs-tabbar-height: ${BAR_HEIGHT}px; }
        body { padding-bottom: ${BAR_HEIGHT}px; }
      `}</style>

      <nav
        aria-label="Primary"
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 9000,
          height: BAR_HEIGHT,
          display: 'flex',
          alignItems: 'stretch',
          justifyContent: 'center',
          gap: 0,
          background: 'var(--c-bg)',
          borderTop: '1px solid var(--c-border)',
          fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
        }}
      >
        {TABS.map((t) => {
          const active = t.match(path);
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? 'page' : undefined}
              onPointerDown={() => setPressed(t.href)}
              onPointerUp={() => setPressed(null)}
              onPointerLeave={() => setPressed(null)}
              style={{
                flex: '0 1 140px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                textDecoration: 'none',
                color: active ? 'var(--c-text)' : 'var(--c-text-muted)',
                fontSize: '0.8125rem',
                fontWeight: active ? 600 : 400,
                letterSpacing: '0.02em',
                // Transform + opacity only, per BRANDING §10.5.
                transform: pressed === t.href ? 'scale(0.96)' : 'none',
                transition: 'transform 160ms cubic-bezier(0.16,1,0.3,1), color 160ms linear',
              }}
            >
              <span>{t.label}</span>
              {/* Active marker — a small sand dot (G8). */}
              <span
                aria-hidden="true"
                style={{
                  width: 4,
                  height: 4,
                  borderRadius: '50%',
                  background: active ? 'var(--c-accent)' : 'transparent',
                }}
              />
            </Link>
          );
        })}
      </nav>
    </>
  );
}
