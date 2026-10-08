// Email collection and confirmation.
//
// Fixes a dead end: the backend requires a verified email before anything can be
// transacted, and the payout page told users to "confirm your email first" with
// nowhere to do it. Every new account hit that wall.
//
// Also handles the ?token= link from the confirmation email, so one page covers
// entering the address, resending, and verifying.
import { useCallback, useEffect, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { C, withAlpha } from '@/theme/colors';
import { getOnboardingStatus, setEmail, isOk } from '@/lib/deal-api';

type Step = 'email' | 'verify_email' | 'bank_details' | 'ready';

export default function EmailSettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<Step>('email');
  const [current, setCurrent] = useState('');
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  const load = useCallback(async () => {
    const res = await getOnboardingStatus();
    if (!isOk(res)) {
      if (res.status === 401) { router.replace('/auth/login'); return; }
      setError(res.error);
      setLoading(false);
      return;
    }
    setStep(res.data.next_step as Step);
    setCurrent(res.data.email || '');
    if (!input) setInput(res.data.email || '');
    setLoading(false);
  }, [router, input]);

  useEffect(() => { void load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // The confirmation email links back here with a token.
  useEffect(() => {
    const token = typeof router.query.token === 'string' ? router.query.token : '';
    if (!token || verifying) return;
    setVerifying(true);
    (async () => {
      try {
        const res = await fetch(`/api/auth/verify-email?token=${encodeURIComponent(token)}`, {
          credentials: 'include',
        });
        if (res.ok) {
          setNotice('Email confirmed.');
          // Drop the token from the URL so a refresh does not retry a
          // one-time token and show a spurious failure.
          void router.replace('/settings/email', undefined, { shallow: true });
          await load();
        } else {
          const body = await res.json().catch(() => ({}));
          setError(body.error || 'That confirmation link is invalid or has expired. Send a new one below.');
        }
      } catch {
        setError('Could not reach the server.');
      } finally {
        setVerifying(false);
      }
    })();
  }, [router.query.token]); // eslint-disable-line react-hooks/exhaustive-deps

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    const res = await setEmail(input.trim());
    setBusy(false);
    if (!isOk(res)) {
      setError(res.error);
      return;
    }
    setNotice(
      res.data.email_verified
        ? 'Email confirmed.'
        : `Confirmation sent to ${res.data.email}. Open the link in that email.`
    );
    await load();
  }

  const card: React.CSSProperties = {
    background: C.surface, border: `1px solid ${C.border}`,
    borderRadius: 12, padding: 18, marginBottom: 12,
  };

  return (
    <>
      <Head><title>Email · ValueSkins</title></Head>
      <div style={{ minHeight: '100vh', background: C.bg, color: C.text, padding: '24px 16px 48px' }}>
        <div style={{ maxWidth: 460, margin: '0 auto' }}>
          <h1 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 4px' }}>Your email</h1>
          <p style={{ fontSize: 12, color: C.outline, margin: '0 0 16px' }}>
            Invoices, payout confirmations and your deal reports are sent here, so it has to be
            confirmed before you can transact.
          </p>

          {loading && <div style={{ fontSize: 13, color: C.outline }}>Loading…</div>}

          {notice && (
            <div role="status" style={{ ...card, borderColor: C.accent, background: withAlpha(C.accent, 0x14), fontSize: 13 }}>
              {notice}
            </div>
          )}
          {error && (
            <div role="alert" style={{ ...card, borderColor: C.error, fontSize: 13 }}>
              {error}
            </div>
          )}

          {!loading && (step === 'bank_details' || step === 'ready') && (
            <div style={{ ...card, borderColor: C.accent, background: withAlpha(C.accent, 0x14) }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                {current} is confirmed
              </div>
              <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 10 }}>
                {step === 'bank_details'
                  ? 'Next: add your payout details.'
                  : 'Your account is ready.'}
              </div>
              <button
                onClick={() => router.push(step === 'bank_details' ? '/settings/payout' : '/deals/browse')}
                style={{
                  background: C.primary, border: 'none', borderRadius: 8, padding: '10px 14px',
                  color: C.onPrimary, fontWeight: 600, fontSize: 13, cursor: 'pointer',
                }}
              >
                {step === 'bank_details' ? 'Add payout details' : 'Browse deals'}
              </button>
            </div>
          )}

          {!loading && (step === 'email' || step === 'verify_email') && (
            <form onSubmit={submit} style={card}>
              {step === 'verify_email' && (
                <div
                  style={{
                    fontSize: 12, color: C.text, background: withAlpha(C.warning, 0x14),
                    border: `1px solid ${C.warning}`, borderRadius: 8, padding: 10, marginBottom: 12,
                  }}
                >
                  We sent a confirmation link to <strong>{current}</strong>. Open it to finish.
                  Not arrived? Check spam, or send it again below.
                </div>
              )}

              <label htmlFor="email" style={{ fontSize: 11, fontWeight: 600, color: C.outline, display: 'block', marginBottom: 4 }}>
                Email address
              </label>
              <input
                id="email"
                type="email"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                autoCapitalize="none"
                required
                style={{
                  width: '100%', background: C.surfaceAlt, border: `1px solid ${C.border}`,
                  borderRadius: 8, color: C.text, padding: '10px 12px', fontSize: 13,
                  fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', marginBottom: 12,
                }}
              />

              {/* Changing a confirmed address clears the verified flag server
                  side, so say so rather than letting it surprise anyone. */}
              {step === 'verify_email' && input.trim() !== current && (
                <div style={{ fontSize: 11, color: C.outline, marginBottom: 10 }}>
                  Changing the address will send the confirmation to the new one instead.
                </div>
              )}

              <button
                type="submit"
                disabled={busy || !input.trim()}
                style={{
                  width: '100%', padding: '12px',
                  background: busy || !input.trim() ? C.border : C.primary,
                  border: 'none', borderRadius: 8, color: C.onPrimary,
                  fontWeight: 700, fontSize: 13,
                  cursor: busy || !input.trim() ? 'not-allowed' : 'pointer',
                }}
              >
                {busy ? 'Sending…' : step === 'verify_email' ? 'Send the link again' : 'Confirm this email'}
              </button>
            </form>
          )}
        </div>
      </div>
    </>
  );
}
