import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/context/AuthContext';
import Head from 'next/head';

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(180deg, #07111f 0%, #0A0A0A 40%, #111827 100%)',
    fontFamily: "'Poppins', 'Helvetica Neue', Arial, sans-serif",
    padding: '20px',
  } as React.CSSProperties,
  card: {
    background: 'rgba(10, 10, 10, 0.86)',
    border: '2px solid rgba(184, 180, 172, 0.18)',
    borderRadius: '24px',
    padding: '80px 40px',
    textAlign: 'center',
    maxWidth: '500px',
    width: '100%',
  } as React.CSSProperties,
  title: {
    fontSize: '28px',
    fontWeight: 800,
    color: '#B8B4AC',
    marginBottom: '16px',
  } as React.CSSProperties,
  subtitle: {
    fontSize: '15px',
    color: '#64748b',
    margin: 0,
    lineHeight: '1.6',
  } as React.CSSProperties,
  badge: {
    display: 'inline-block',
    padding: '6px 16px',
    background: 'rgba(184, 180, 172, 0.1)',
    border: '1px solid rgba(184, 180, 172, 0.2)',
    borderRadius: '999px',
    color: '#B8B4AC',
    fontSize: '12px',
    fontWeight: 600,
    marginBottom: '24px',
    textTransform: 'uppercase' as const,
    letterSpacing: '1px',
  },
  icon: {
    fontSize: '48px',
    marginBottom: '20px',
    opacity: 0.4,
  },
};

export default function UpcomingEventsPage() {
  const router = useRouter();
  const { account, loading: authLoading } = useAuth();

  useEffect(() => {
    if (authLoading) return;
    if (!account) {
      router.replace('/auth/login?redirect=/upcoming-events');
      return;
    }
  }, [account, authLoading, router]);

  if (authLoading) return null;

  return (
    <>
      <Head>
        <title>Upcoming Events - ValueSkins</title>
      </Head>
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={styles.badge}>COMING SOON</div>
          <h1 style={styles.title}>Upcoming Events</h1>
          <p style={styles.subtitle}>
            The events feature is currently in development and will be available soon.
            Stay tuned for updates!
          </p>
        </div>
      </div>
    </>
  );
}
