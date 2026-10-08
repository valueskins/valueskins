'use client';
import type { GetServerSidePropsContext } from 'next';
import { getSessionUserId } from '@/lib/session';
import { query } from '@/lib/db';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import ValueSkinsLogo from '@/components/ValueSkinsLogo';

const C = {
  bg: '#0A0A0A',
  text: '#F5F5F0',
  textMuted: '#B8B4AC',
  accent: '#C8B89A',
  surface: '#1A1A18',
  border: '#2A2A28',
};

export async function getServerSideProps(ctx: GetServerSidePropsContext) {
  try {
    const cookie = ctx.req.headers.cookie || '';
    const userId = await getSessionUserId(cookie);
    if (!userId) return { redirect: { destination: '/auth/login', permanent: false } };

    const userResult = await query('SELECT id, display_name, email, google_access_token FROM accounts WHERE id = $1', [userId]);
    if (!userResult.rows[0]) return { redirect: { destination: '/auth/login', permanent: false } };

    const user = userResult.rows[0];
    const isGoogleConnected = !!user.google_access_token;

    const dealsResult = await query(
      `SELECT id, title, shoot_date, shoot_time, location, phase, requires_shoot_on_location
       FROM deals
       WHERE (creator_id = $1 OR brand_id = $1)
       AND requires_shoot_on_location = true
       AND phase IN ('accepted', 'softhold', 'checklist', 'approved')
       ORDER BY shoot_date DESC`,
      [userId]
    );

    return {
      props: {
        userId,
        displayName: user.display_name,
        googleAccountId: isGoogleConnected ? 'connected' : null,
        deals: dealsResult.rows || [],
      },
    };
  } catch {
    return { redirect: { destination: '/auth/login', permanent: false } };
  }
}

interface CalendarPageProps {
  userId: number;
  displayName: string;
  googleAccountId: string | null;
  deals: any[];
}

export default function CalendarPage({ userId, displayName, googleAccountId, deals }: CalendarPageProps) {
  const router = useRouter();
  const [isConnected, setIsConnected] = useState(!!googleAccountId);

  useEffect(() => {
    if (!userId) {
      router.push('/auth/login');
    }

    // Check for success/error query params
    if (router.query.success === 'google_connected') {
      setIsConnected(true);
      router.replace('/demo/calendar');
    }
    if (router.query.error) {
      console.error('Google connection error:', router.query.error);
      router.replace('/demo/calendar');
    }
  }, [userId, router]);

  const handleOpenGoogleCalendar = () => {
    window.open('https://calendar.google.com', '_blank');
  };

  const handleConnectGoogle = async () => {
    // Get OAuth URL from backend
    const res = await fetch('/api/auth/google-oauth-url');
    const data = await res.json();
    window.location.href = data.authUrl;
  };

  const hasLocationDeals = deals && deals.length > 0;

  return (
    <div style={{ minHeight: '100vh', background: C.bg, fontFamily: "'Inter', sans-serif" }}>
      {/* Header */}
      <div style={{ borderBottom: `1px solid ${C.border}`, padding: '20px 24px' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <ValueSkinsLogo />
            <span style={{ color: C.textMuted, fontSize: '14px' }}>Calendar</span>
          </div>
          <button
            onClick={() => router.push('/demo/marketplace')}
            style={{
              background: 'transparent',
              border: `1px solid ${C.border}`,
              color: C.text,
              padding: '8px 16px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            Back
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '60px 24px' }}>
        {!isConnected ? (
          <div style={{ textAlign: 'center', paddingTop: '40px' }}>
            <h1 style={{ fontSize: '32px', fontWeight: 700, color: C.text, margin: '0 0 20px' }}>
              ValueSkins Syncs to Google Calendar
            </h1>
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, padding: '32px', borderRadius: '12px', maxWidth: '600px', margin: '0 auto 40px', textAlign: 'left' }}>
              <p style={{ fontSize: '15px', color: C.text, margin: '0 0 16px', lineHeight: 1.8 }}>
                When you accept a deal that requires a shoot on location, ValueSkins automatically adds it to your Google Calendar with all the details:
              </p>
              <ul style={{ fontSize: '14px', color: C.textMuted, margin: '0 0 16px', paddingLeft: '20px', lineHeight: 1.8 }}>
                <li>Shoot date and time</li>
                <li>Location</li>
                <li>Brand name and compensation</li>
                <li>Submission and approval deadlines</li>
              </ul>
              <p style={{ fontSize: '15px', color: C.text, margin: '0', lineHeight: 1.8 }}>
                <strong>To use this feature, you must connect your Google Calendar account.</strong> We'll only access your calendar to add shoot dates, nothing else.
              </p>
            </div>
            <button
              onClick={handleConnectGoogle}
              style={{
                background: C.accent,
                color: C.bg,
                border: 'none',
                padding: '14px 40px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '16px',
                fontWeight: 600,
                transition: 'opacity 0.2s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.9')}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
            >
              Connect Google Calendar Now
            </button>
          </div>
        ) : hasLocationDeals ? (
          <>
            <h1 style={{ fontSize: '32px', fontWeight: 700, color: C.text, margin: '0 0 12px' }}>
              Your Schedule
            </h1>
            <p style={{ fontSize: '16px', color: C.textMuted, margin: '0 0 40px', maxWidth: '600px', lineHeight: 1.5 }}>
              All your shoot dates and deal deadlines sync to Google Calendar. Open your calendar to see all upcoming commitments in one place.
            </p>

            {/* Upcoming Deals Preview */}
            <div style={{ marginBottom: '40px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 600, color: C.text, margin: '0 0 20px' }}>
                Upcoming Shoots
              </h2>
              <div style={{ display: 'grid', gap: '12px' }}>
                {deals.slice(0, 5).map((deal) => (
                  <div
                    key={deal.id}
                    style={{
                      background: C.surface,
                      border: `1px solid ${C.border}`,
                      padding: '16px',
                      borderRadius: '8px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '14px', color: C.accent, fontWeight: 600, marginBottom: '4px' }}>
                        {new Date(deal.shoot_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </div>
                      <div style={{ fontSize: '15px', color: C.text, fontWeight: 500 }}>
                        {deal.title || `Deal #${deal.id}`}
                      </div>
                      {deal.shoot_time && (
                        <div style={{ fontSize: '13px', color: C.textMuted, marginTop: '4px' }}>
                          {deal.shoot_time}
                        </div>
                      )}
                      {deal.location && (
                        <div style={{ fontSize: '13px', color: C.textMuted }}>
                          {deal.location}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => router.push(`/deals/${deal.id}`)}
                      style={{
                        background: 'transparent',
                        border: `1px solid ${C.accent}`,
                        color: C.accent,
                        padding: '8px 16px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '13px',
                        fontWeight: 600,
                      }}
                    >
                      View Deal
                    </button>
                  </div>
                ))}
              </div>
              {deals.length > 5 && (
                <div style={{ marginTop: '16px', fontSize: '13px', color: C.textMuted, textAlign: 'center' }}>
                  {deals.length - 5} more upcoming shoots in Google Calendar
                </div>
              )}
            </div>

            {/* CTA */}
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, padding: '32px', borderRadius: '12px', textAlign: 'center' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 600, color: C.text, margin: '0 0 12px' }}>
                View Your Full Calendar
              </h3>
              <p style={{ fontSize: '14px', color: C.textMuted, margin: '0 0 24px', maxWidth: '450px', marginLeft: 'auto', marginRight: 'auto' }}>
                ValueSkins syncs all your shoot dates and deadlines directly to Google Calendar. This keeps everything in one place so you never miss a deadline or double-book a shoot.
              </p>
              <p style={{ fontSize: '13px', color: C.textMuted, margin: '0 0 20px', maxWidth: '450px', marginLeft: 'auto', marginRight: 'auto', fontStyle: 'italic' }}>
                Redirecting you to Google Calendar now.
              </p>
              <button
                onClick={handleOpenGoogleCalendar}
                style={{
                  background: C.accent,
                  color: C.bg,
                  border: 'none',
                  padding: '12px 32px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '15px',
                  fontWeight: 600,
                  transition: 'opacity 0.2s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.9')}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
              >
                Open Google Calendar
              </button>
            </div>
          </>
        ) : (
          <div style={{ textAlign: 'center', paddingTop: '60px' }}>
            <h1 style={{ fontSize: '28px', fontWeight: 700, color: C.text, margin: '0 0 12px' }}>
              No Scheduled Shoots Yet
            </h1>
            <p style={{ fontSize: '15px', color: C.textMuted, margin: '0 0 32px', maxWidth: '400px', marginLeft: 'auto', marginRight: 'auto' }}>
              When you accept deals that require a shoot on location, they'll appear here and sync to your Google Calendar.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                onClick={() => router.push('/demo/marketplace')}
                style={{
                  background: C.accent,
                  color: C.bg,
                  border: 'none',
                  padding: '12px 28px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '15px',
                  fontWeight: 600,
                }}
              >
                Browse Campaigns
              </button>
              <button
                onClick={handleOpenGoogleCalendar}
                style={{
                  background: 'transparent',
                  border: `1px solid ${C.accent}`,
                  color: C.accent,
                  padding: '12px 28px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '15px',
                  fontWeight: 600,
                }}
              >
                Open Google Calendar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
