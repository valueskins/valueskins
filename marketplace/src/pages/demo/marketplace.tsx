'use client';
import type { GetServerSidePropsContext } from 'next';
import { getSessionUserId } from '@/lib/session';
import { query } from '@/lib/db';
import { useRouter } from 'next/router';
import { useAuth } from '@/context/AuthContext';
import { useEffect, useState } from 'react';
import MarketplaceDemoPage from '@/features/marketplace/demo/MarketplaceDemoPage';
import ValueSkinsLogo from '@/components/ValueSkinsLogo';
import LoadingState from '@/components/LoadingState';

// ValueSkins dark treatment
const C = {
  bg: '#0A0A0A',
  text: '#F5F5F0',
  textMuted: '#B8B4AC',
  accent: '#C8B89A',
};

export async function getServerSideProps(ctx: GetServerSidePropsContext) {
  // This shell keeps deals, campaigns and applications in localStorage, so two
  // people on two devices never saw the same deal. The deal workflow now lives
  // on server-backed pages; only the settings and store views are still served
  // from here, and they are reached by an explicit ?view=.
  if (typeof ctx.query.view !== 'string') {
    return { redirect: { destination: '/deals/browse', permanent: false } };
  }

  const empty = { props: { initialCampaigns: [], initialDealStates: null, initialApplications: [] } };
  try {
    const cookie = ctx.req.headers.cookie || '';
    const { getAccountId } = await import('@/lib/session');
    const accountId = await getAccountId(cookie);
    if (!accountId) return empty;

    const campResult = await query(
      `SELECT c.*, COUNT(ci.id) as invite_count,
        COUNT(ci.id) FILTER (WHERE ci.status = 'accepted') as accepted_count
       FROM campaigns c
       LEFT JOIN campaign_invites ci ON c.id = ci.campaign_id
       WHERE c.brand_id = $1
       GROUP BY c.id ORDER BY c.created_at DESC LIMIT 50`,
      [accountId]
    );

    return {
      props: {
        initialCampaigns: campResult.rows || [],
        initialDealStates: null,
        initialApplications: [],
      },
    };
  } catch {
    return empty;
  }
}

interface DemoWrapperProps {
  initialCampaigns?: any[];
  initialDealStates?: any;
  initialApplications?: any[];
}

export default function DemoWrapper({ initialCampaigns = [], initialDealStates = null, initialApplications = [] }: DemoWrapperProps) {
  const router = useRouter();
  const { account, loading } = useAuth();
  const [isLocalhost, setIsLocalhost] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const host = window.location.hostname;
    setIsLocalhost(host === 'localhost' || host === '127.0.0.1' || host.startsWith('192.168'));
    setMounted(true);
  }, []);

  if (!mounted || loading) {
    return (
      <LoadingState />
    );
  }

  // On localhost: show skip button if not logged in, else go straight to marketplace
  if (isLocalhost && !account) {
    return (
      <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.text, fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif", flexDirection: 'column', gap: '20px' }}>
        <button
          onClick={() => router.push('/auth/login')}
          style={{ padding: '12px 24px', background: C.primary, border: 'none', borderRadius: '8px', color: C.onPrimary, fontWeight: 600, cursor: 'pointer', fontSize: '1rem' }}
        >
          Login
        </button>
      </div>
    );
  }

  if (!account) {
    router.replace('/auth/login');
    return null;
  }

  return <MarketplaceDemoPage initialCampaigns={initialCampaigns} initialDealStates={initialDealStates} initialApplications={initialApplications} />;
}
