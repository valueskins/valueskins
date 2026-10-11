'use client';
import Head from 'next/head';
import MarketplaceDemoPage from '@/features/marketplace/demo/MarketplaceDemoPage';

// ── PREVIEW MODE (TEMPORARY) ────────────────────────────────────────────────
// A no-database, no-login view of the full app so the UI can be reviewed on the
// live URL while the database is down (Render subscription lapsed).
//
// It renders MarketplaceDemoPage directly — NOT through pages/demo/marketplace,
// whose getServerSideProps queries the DB and would 500 while it is down. There
// is no getServerSideProps here, so nothing hits Postgres to load this page.
//
// AuthContext detects the /preview path and supplies a mock account (see
// PREVIEW_ACCOUNT), so every screen renders. Data-backed fetches (stats, skins)
// still fail against the dead DB and simply leave those areas empty — the shells
// are what we are previewing.
//
// OAuth is untouched. Remove this file + the PREVIEW block in AuthContext in one
// commit once the database is back.
export default function PreviewPage() {
  return (
    <>
      <Head>
        <title>Preview · ValueSkins</title>
        <meta name="robots" content="noindex" />
      </Head>

      {/* Unmistakable it is not the real, data-backed app. */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 100000,
          background: '#A08A5E',
          color: '#0A0A0A',
          textAlign: 'center',
          fontFamily: "'Poppins', 'Helvetica Neue', Arial, sans-serif",
          fontSize: '11px',
          fontWeight: 700,
          letterSpacing: '0.08em',
          padding: '3px 8px',
        }}
      >
        UI PREVIEW · MOCK ACCOUNT · NO LIVE DATA
      </div>

      <MarketplaceDemoPage initialCampaigns={[]} initialDealStates={null} initialApplications={[]} />
    </>
  );
}
