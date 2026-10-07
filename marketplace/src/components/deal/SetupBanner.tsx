// Tells a signed-in user which setup step still blocks them, with a link to
// the page that completes it.
//
// The server refuses to transact until the email is confirmed (and, for a
// creator, a UPI ID is on file), but nothing in the workflow pages said so or
// linked to where it is done: a new account simply hit a 403.
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { C, withAlpha } from '@/theme/colors';
import { getOnboardingStatus, isOk } from '@/lib/deal-api';

type Step = 'email' | 'verify_email' | 'bank_details';

const COPY: Record<Step, { text: string; cta: string; href: string }> = {
  email: {
    text: 'Add your email address to start. Confirmations and deal reports are sent there.',
    cta: 'Add email',
    href: '/settings/email',
  },
  verify_email: {
    text: 'Confirm your email address using the link we sent you.',
    cta: 'Check or resend',
    href: '/settings/email',
  },
  bank_details: {
    text: 'Add the UPI ID brands should pay you on.',
    cta: 'Add UPI ID',
    href: '/settings/payout',
  },
};

export default function SetupBanner() {
  const [step, setStep] = useState<Step | null>(null);

  useEffect(() => {
    let live = true;
    void (async () => {
      const res = await getOnboardingStatus();
      if (!live || !isOk(res)) return;
      const next = res.data.next_step;
      // A brand pays; it is never paid, so it has no payout step.
      if (next === 'ready' || (next === 'bank_details' && res.data.role !== 'creator')) return;
      setStep(next);
    })();
    return () => { live = false; };
  }, []);

  if (!step) return null;
  const c = COPY[step];

  return (
    <div
      role="status"
      style={{
        background: withAlpha(C.accent, 0x14),
        border: `1px solid ${C.accent}`,
        borderRadius: 12,
        padding: 14,
        marginBottom: 12,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        fontSize: 12,
      }}
    >
      <span>{c.text}</span>
      <Link
        href={c.href}
        style={{ color: C.text, fontWeight: 700, whiteSpace: 'nowrap', textDecoration: 'underline' }}
      >
        {c.cta}
      </Link>
    </div>
  );
}
