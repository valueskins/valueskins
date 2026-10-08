import type { AppProps } from 'next/app';
import { useRouter } from 'next/router';
import { AuthProvider } from '@/context/AuthContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import Footer from '@/components/Footer';
import CookieConsent from '@/components/CookieConsent';
import TopNav from '@/components/TopNav';
import { ThemeProvider } from '@/theme/ThemeContext';
import '@/styles/globals.css';

// The login page ships its own slim footer (login page.md §0b.6) and has to fit
// in a single viewport with no scroll (§3) — the tall global footer breaks that.
const ROUTES_WITHOUT_GLOBAL_FOOTER = ['/auth/login'];

// The signed-in app has two sections, Marketplace and Settings, and TopNav is
// how you move between them. It is shown on every page that belongs to either.
const ROUTES_WITH_NAV = [
  '/deals/browse',
  '/deals/mine',
  '/deals/[dealId]',
  '/campaigns',
  '/campaigns/create',
  '/settings',
  '/settings/email',
  '/settings/payout',
  '/account/data',
  '/profile/[id]',
];

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const hideFooter = ROUTES_WITHOUT_GLOBAL_FOOTER.includes(router.pathname);
  const showNav = ROUTES_WITH_NAV.includes(router.pathname);

  return (
    <ErrorBoundary>
      <ThemeProvider>
      <AuthProvider>
      {showNav && <TopNav />}
      <Component {...pageProps} />
      {!hideFooter && <Footer />}
      <CookieConsent />
    </AuthProvider>
    </ThemeProvider>
    </ErrorBoundary>
  );
}
