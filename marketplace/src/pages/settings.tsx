'use client';

import SettingsView from '@/features/marketplace/demo/views/SettingsView';
import { useAuth } from '@/context/AuthContext';

export default function SettingsPage() {
  const { account } = useAuth();
  // The role comes from the signed-in account. This passed "creator" for
  // everyone, so a brand was shown creator settings.
  return <SettingsView role={account?.role === 'brand' ? 'brand' : 'creator'} />;
}
