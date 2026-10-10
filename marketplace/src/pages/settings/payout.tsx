// The UPI ID on its own page. The same form is also shown inside Settings.
import Head from 'next/head';
import { C } from '@/theme/colors';
import PayoutUpi from '@/components/PayoutUpi';
import { useAuth } from '@/context/AuthContext';

export default function PayoutSettingsPage() {
  const { account } = useAuth();
  const role = account?.role === 'brand' ? 'brand' : 'creator';
  return (
    <>
      <Head><title>Payout details · ValueSkins</title></Head>
      <div style={{ minHeight: '100vh', background: C.bg, color: C.text, padding: '24px 16px 48px' }}>
        <div style={{ maxWidth: 480, margin: '0 auto' }}>
          <h1 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 4px' }}>Payout details</h1>
          <p style={{ fontSize: 12, color: C.outline, margin: '0 0 16px' }}>
            {role === 'brand' ? 'The UPI ID saved on your account.' : 'The UPI ID brands pay you on.'}
          </p>
          <PayoutUpi role={role} />
        </div>
      </div>
    </>
  );
}
