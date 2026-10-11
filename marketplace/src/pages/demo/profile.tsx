'use client';
import { useState } from 'react';
import Head from 'next/head';
import ProfileView, { type ProfileData } from '@/features/profiles/ProfileView';

// No-auth rendering of the phase-2 profile page so it can be reviewed on a
// preview deployment, where Google OAuth cannot complete (the redirect_uri
// whitelist is bound to the production domain).
//
// The sample data below is the exact data shown in
// ui-specs/phase-2/profile-page-mock.svg, so this page can be compared against
// that mock side by side. Nothing here reads or writes real user data.

const MOCK_PROFILE: ProfileData = {
  display_name: 'Anshul Khatri',
  username: 'anshulk',
  profession: 'Software Engineer',
  location: 'Bengaluru',
  country: 'India',
  languages: ['English', 'Hindi'],
  open_for_work: true,
  is_verified: true,
  deals_completed: 18,      // -> Signal, Level 3, 17 more deals to Aura
  deals_this_month: 3,
  avg_rating: 4.9,
  repeat_rate: 42,
  on_time_rate: 100,
  avg_response_hours: 2,
  trust_score: 92,
};

export default function DemoProfilePage() {
  // Replay the slap-to-profile equip animation on demand so it can be reviewed
  // without going through a real purchase.
  const [equipRun, setEquipRun] = useState(0);

  return (
    <>
      <Head>
        <title>Profile preview · ValueSkins</title>
        <meta name="robots" content="noindex" />
      </Head>

      <button
        onClick={() => setEquipRun(n => n + 1)}
        style={{
          position: 'fixed', right: 20, bottom: 20, zIndex: 50,
          minHeight: 44, padding: '0 20px', borderRadius: 10,
          background: 'var(--c-primary)', color: 'var(--c-on-primary)', border: 'none',
          fontFamily: "'Poppins', 'Helvetica Neue', Arial, sans-serif",
          fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer',
        }}
      >
        Play equip animation
      </button>

      <ProfileView
        key={equipRun}
        profile={MOCK_PROFILE}
        justEquipped={equipRun > 0}
      />
    </>
  );
}
