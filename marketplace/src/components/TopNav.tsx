'use client';

import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';

// The header of the signed-in app: the name on the left, and the four places
// the app has in the middle. Marketplace, Settings, How it works, Guide for
// brands.
export const TOP_NAV_HEIGHT = 76;

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
    {
      href: '/guide-for-brands',
      label: 'Guide for brands',
      match: (p: string) => p.startsWith('/guide-for-brands'),
    },
  ];

  // Fetch each section's code ahead of the click, so only its data is left to
  // load when it is chosen.
  useEffect(() => {
    for (const s of sections) void router.prefetch(s.href).catch(() => {});
  }, [account?.role]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <style>{`
        body { padding-top: ${TOP_NAV_HEIGHT}px; }
        @keyframes vsNavLoad { 0% { transform: translateX(-100%); } 100% { transform: translateX(350%); } }
        .vs-nav { padding: 0 40px; }
        .vs-nav-side { flex: 1 1 0; }
        .vs-nav-menu { gap: 44px; }
        .vs-nav-link { position: relative; padding: 6px 0; }
        .vs-nav-link::after {
          content: ""; position: absolute; left: 0; bottom: 0; height: 1px; width: 0;
          background: var(--c-text); transition: width 0.2s ease;
        }
        .vs-nav-link:hover::after, .vs-nav-link[aria-current="page"]::after { width: 100%; }
        /* On a phone there is no room for the name beside the menu, so the
           menu takes the full width and stays reachable. */
        @media (max-width: 720px) {
          .vs-nav { padding: 0 16px; }
          .vs-nav-side { display: none; }
          .vs-nav-menu { gap: 14px; width: 100%; justify-content: space-between; overflow-x: auto; scrollbar-width: none; }
          .vs-nav-menu::-webkit-scrollbar { display: none; }
          /* Four sections have to share a phone's width. */
          .vs-nav-link { font-size: 10px !important; letter-spacing: 0.06em !important; }
        }
      `}</style>
      <nav
        aria-label="Primary"
        className="vs-nav"
        style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9000,
          height: TOP_NAV_HEIGHT, display: 'flex', alignItems: 'center',
          background: 'var(--c-bg)', borderBottom: '1px solid var(--c-border)',
          fontFamily: "'Poppins', 'Helvetica Neue', Arial, sans-serif",
        }}
      >
        <div className="vs-nav-side">
          <Link
            href="/"
            aria-label="ValueSkins home"
            style={{ fontWeight: 700, letterSpacing: '0.18em', fontSize: 18, color: 'var(--c-text)', textDecoration: 'none' }}
          >
            VALUESKINS
          </Link>
        </div>

        <div className="vs-nav-menu" style={{ display: 'flex', alignItems: 'center' }}>
          {sections.map((s) => {
            const active = pending ? pending === s.label : s.match(router.pathname);
            return (
              <Link
                key={s.label}
                href={s.href}
                className="vs-nav-link"
                aria-current={active ? 'page' : undefined}
                onClick={() => { if (!s.match(router.pathname)) setPending(s.label); }}
                style={{
                  textDecoration: 'none', textTransform: 'uppercase',
                  fontSize: 12, letterSpacing: '0.14em', whiteSpace: 'nowrap',
                  fontWeight: active ? 600 : 400,
                  color: active ? 'var(--c-text)' : 'var(--c-text-muted)',
                }}
              >
                {s.label}
              </Link>
            );
          })}
        </div>

        {/* Mirrors the left side so the menu sits in the true centre. */}
        <div className="vs-nav-side" />

        {/* A moving line under the bar while the next page is on its way. */}
        {loading && (
          <div
            aria-hidden="true"
            style={{ position: 'absolute', left: 0, right: 0, bottom: -1, height: 2, overflow: 'hidden' }}
          >
            <div
              style={{
                width: '30%', height: '100%', background: 'var(--c-text)',
                animation: 'vsNavLoad 0.9s linear infinite',
              }}
            />
          </div>
        )}
      </nav>
    </>
  );
}
