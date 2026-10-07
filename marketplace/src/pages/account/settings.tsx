'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/router';

// Settings lives on the Settings tab inside the app now
// (MarketplaceDemoPage, activeView === 'settings'), rendering
// features/settings/SettingsHub.tsx — the same component this page used to be.
//
// Kept as a redirect so existing links and bookmarks still land in the right
// place instead of 404ing.
export default function SettingsRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/settings');
  }, [router]);

  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0A0A0A',
        color: '#8A867E',
        fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
      }}
    >
      Opening Settings…
    </div>
  );
}
