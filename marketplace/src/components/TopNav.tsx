'use client';

import Link from 'next/link';
import { useRouter } from 'next/router';

// The app has three places: the marketplace, settings, and a page explaining
// how it all works. The navigation is the screen's width divided equally
// between them, at the top.
//
// It replaces the four-tab bar at the bottom of the screen (Profile, Market,
// Store, Settings). The store is gone, and the profile now lives in Settings.
const SECTIONS = [
  {
    // /deals/browse sends a brand on to /campaigns, so one link serves both roles.
    href: '/deals/browse',
    label: 'Marketplace',
    match: (p: string) => p.startsWith('/deals') || p.startsWith('/campaigns'),
  },
  {
    href: '/settings',
    label: 'Settings',
    match: (p: string) => p.startsWith('/settings') || p.startsWith('/account') || p.startsWith('/profile'),
  },
  {
    href: '/how-it-works',
    label: 'How it works',
    match: (p: string) => p.startsWith('/how-it-works'),
  },
];

export const TOP_NAV_HEIGHT = 56;

export default function TopNav() {
  const { pathname } = useRouter();

  return (
    <>
      {/* Pages below start under the bar. */}
      <style>{`body { padding-top: ${TOP_NAV_HEIGHT}px; }`}</style>
      <nav
        aria-label="Primary"
        style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9000,
          height: TOP_NAV_HEIGHT, display: 'grid', gridTemplateColumns: `repeat(${SECTIONS.length}, 1fr)`,
          background: 'var(--c-bg)', borderBottom: '1px solid var(--c-border)',
          fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
        }}
      >
        {SECTIONS.map((s, i) => {
          const active = s.match(pathname);
          return (
            <Link
              key={s.href}
              href={s.href}
              aria-current={active ? 'page' : undefined}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                textDecoration: 'none',
                fontSize: '0.875rem', letterSpacing: '0.04em',
                fontWeight: active ? 700 : 500,
                color: active ? 'var(--c-text)' : 'var(--c-text-muted)',
                background: active ? 'var(--c-surface)' : 'transparent',
                borderLeft: i === 0 ? 'none' : '1px solid var(--c-border)',
                // The active half is marked along its whole bottom edge.
                boxShadow: active ? 'inset 0 -2px 0 var(--c-accent)' : 'none',
              }}
            >
              {s.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
