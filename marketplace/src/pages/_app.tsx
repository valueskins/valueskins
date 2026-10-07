import type { AppProps } from 'next/app';
import { useRouter } from 'next/router';
import { AuthProvider } from '@/context/AuthContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import Footer from '@/components/Footer';
import CookieConsent from '@/components/CookieConsent';
import BottomTabBar from '@/components/BottomTabBar';
import { ThemeProvider } from '@/theme/ThemeContext';
import '@/styles/globals.css';

// The login page ships its own slim footer (login page.md §0b.6) and has to fit
// in a single viewport with no scroll (§3) — the tall global footer breaks that.
const ROUTES_WITHOUT_GLOBAL_FOOTER = ['/auth/login'];

// G8: the tab bar is the app spine. These seven pages render bare — no header,
// no back, no nav — so until the floating wordmark was removed they had exactly
// one escape hatch, and it was a brand mark, not navigation. G4: "Never drop a
// user somewhere with no frame and no way back."
//
// Scoped to these routes for now rather than mounted app-wide, so it cannot
// double up with the nav MarketplaceLayout already draws on /campaigns and
// /browse/campaigns. Widen this list when the bar becomes the Dock.
const ROUTES_WITH_TAB_BAR = [
  '/feed',
  '/notifications',
  '/settings',
  '/analytics',
  '/marketplace',
  '/events',
  // The deal workflow. These rendered with no navigation at all, so a user who
  // landed on one had no way to reach settings or their profile.
  '/deals/browse',
  '/deals/mine',
  '/deals/[dealId]',
  '/campaigns',
  '/campaigns/create',
  '/settings/email',
  '/settings/payout',
];

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const hideFooter = ROUTES_WITHOUT_GLOBAL_FOOTER.includes(router.pathname);
  const showTabBar = ROUTES_WITH_TAB_BAR.includes(router.pathname);

  return (
    <ErrorBoundary>
      <ThemeProvider>
      <AuthProvider>
      <Component {...pageProps} />
      {!hideFooter && <Footer />}
      {showTabBar && <BottomTabBar />}
      <CookieConsent />
    </AuthProvider>
    </ThemeProvider>
    </ErrorBoundary>
  );
}
