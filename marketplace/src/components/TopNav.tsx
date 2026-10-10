'use client';

import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';

// The app has three places: the marketplace, settings, and a page explaining
// how it all works. The navigation is the screen's width divided equally
// between them, at the top.
export const TOP_NAV_HEIGHT = 56;

export default function TopNav() {
  const router = useRouter();
  const { account } = useAuth();
  // The section just clicked. A server-rendered page takes a moment to arrive,
  // and until it did the bar gave no sign the click had registered, so people
  // clicked again. This marks the target as active on the click itself.
  const [pending, setPending] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const start = () => setLoading(true);
    const done = () => { setLoading(false); setPending(null); };
    router.events.on('routeChangeStart', start);
    router.events.on('routeChangeComplete', done);
    router.events.on('routeChangeError', done);
    return () => {
      router.events.off('routeChangeStart', start);
      router.events.off('routeChangeComplete', done);
      router.events.off('routeChangeError', done);
    };
  }, [router.events]);

  const sections = [
    {
      // Straight to the right page for the role. Linking brands to
      // /deals/browse and letting the server redirect them cost a second full
      // page request on every click.
      href: account?.role === 'brand' ? '/campaigns' : '/deals/browse',
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

  // Fetch each section's code ahead of the click, so only its data is left to
  // load when it is chosen.
  useEffect(() => {
    for (const s of sections) void router.prefetch(s.href).catch(() => {});
  }, [account?.role]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      {/* Pages below start under the bar. */}
      <style>{`
        body { padding-top: ${TOP_NAV_HEIGHT}px; }
        @keyframes vsNavLoad { 0% { transform: translateX(-100%); } 100% { transform: translateX(350%); } }
      `}</style>
      <nav
        aria-label="Primary"
        style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9000,
          height: TOP_NAV_HEIGHT, display: 'grid',
          gridTemplateColumns: `repeat(${sections.length}, 1fr)`,
          background: 'var(--c-bg)', borderBottom: '1px solid var(--c-border)',
          fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
        }}
      >
        {sections.map((s, i) => {
          const active = pending ? pending === s.label : s.match(router.pathname);
          return (
            <Link
              key={s.label}
              href={s.href}
              aria-current={active ? 'page' : undefined}
              onClick={() => { if (!s.match(router.pathname)) setPending(s.label); }}
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
                // Instant: no fade between the click and the highlight.
                transition: 'none',
              }}
            >
              {s.label}
            </Link>
          );
        })}

        {/* A moving line under the bar while the next page is on its way. */}
        {loading && (
          <div
            aria-hidden="true"
            style={{ position: 'absolute', left: 0, right: 0, bottom: -1, height: 2, overflow: 'hidden' }}
          >
            <div
              style={{
                width: '30%', height: '100%', background: 'var(--c-accent)',
                animation: 'vsNavLoad 0.9s linear infinite',
              }}
            />
          </div>
        )}
      </nav>
    </>
  );
}
