// Payout details, entered once.
//
// Replaces the deleted payout-onboarding page, which posted to an endpoint that
// took `creator_id` from the request body with no authentication.
//
// What the form makes plain, because it is unusual and people should not have to
// guess: ValueSkins never stores the account number. It goes straight to
// Razorpay, which returns a token, and the token plus a masked tail is all that
// is kept. That is also why there is no edit button — changing a payout
// destination is the single most valuable thing a stolen session could do, so it
// goes through support rather than a form.
import { useCallback, useEffect, useState } from 'react';
import Head from 'next/head';
import { C, withAlpha } from '@/theme/colors';
import { getOnboardingStatus, isOk } from '@/lib/deal-api';


export default function PayoutSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [configured, setConfigured] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const [emailReady, setEmailReady] = useState<boolean | null>(null);
  const [upi, setUpi] = useState('');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorField, setErrorField] = useState<string | undefined>();

  const load = useCallback(async () => {
    const [payoutRes, onboarding] = await Promise.all([
      fetch('/api/profile/payout-upi', { credentials: 'include' }).then((r) => r.json()).catch(() => null),
      getOnboardingStatus(),
    ]);
    if (payoutRes) {
      setConfigured(!!payoutRes.configured);
      setHint(payoutRes.masked || null);
    }
    if (isOk(onboarding)) {
      // Payouts require a verified email first: it is where confirmations go.
      setEmailReady(onboarding.data.email_verified);
    }
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setErrorField(undefined);

    const res = await fetch('/api/profile/payout-upi', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ upi_id: upi.trim(), share_consent: consent }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);

    if (!res.ok) {
      setError(data.error || 'Could not save your UPI ID');
      setErrorField(data.field);
      return;
    }
    setUpi('');
    setConfigured(true);
    setHint(data.masked || null);
  }

  const card: React.CSSProperties = {
    background: C.surface, border: `1px solid ${C.border}`,
    borderRadius: 12, padding: 18, marginBottom: 12,
  };
  const input = (invalid?: boolean): React.CSSProperties => ({
    width: '100%', background: C.surfaceAlt,
    border: `1px solid ${invalid ? C.error : C.border}`,
    borderRadius: 8, color: C.text, padding: '10px 12px',
    fontSize: 13, fontFamily: 'inherit', outline: 'none',
    boxSizing: 'border-box', marginBottom: 10,
  });
  const lbl: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: C.outline, display: 'block', marginBottom: 4 };

  return (
    <>
      <Head><title>Payout details — ValueSkins</title></Head>
      <div style={{ minHeight: '100vh', background: C.bg, color: C.text, padding: '24px 16px 48px' }}>
        <div style={{ maxWidth: 480, margin: '0 auto' }}>
          <h1 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 4px' }}>Payout details</h1>
          <p style={{ fontSize: 12, color: C.outline, margin: '0 0 16px' }}>
            Where your earnings go. Entered once.
          </p>

          {loading && <div style={{ fontSize: 13, color: C.outline }}>Loading…</div>}

          {!loading && emailReady === false && (
            <div style={{ ...card, borderColor: C.warning, background: withAlpha(C.warning, 0x14) }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Confirm your email first</div>
              <div style={{ fontSize: 12, color: C.textMuted }}>
                Payout confirmations and your deal reports are sent there, so it has to be verified
                before earnings can be routed anywhere.
              </div>
            </div>
          )}

          {!loading && configured && (
            <div style={{ ...card, borderColor: C.accent, background: withAlpha(C.accent, 0x14) }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Payout details on file</div>
              <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 8 }}>
                Paying out to <strong>{hint || 'your saved account'}</strong>.
              </div>
              <div style={{ fontSize: 11, color: C.outline, lineHeight: 1.5 }}>
                We hold a token from Razorpay, not your account number — so there is nothing here to
                show you in full. To change these details, contact support: changing a payout
                destination is deliberately not something a signed-in session can do on its own.
              </div>
            </div>
          )}

          {!loading && !configured && emailReady !== false && (
            <form onSubmit={submit} style={card}>
              <label style={lbl} htmlFor="upi">Your UPI ID</label>
              <input
                id="upi" value={upi} onChange={(e) => setUpi(e.target.value)}
                placeholder="name@okhdfcbank"
                inputMode="email" autoCapitalize="none" autoComplete="off"
                style={input(errorField === 'upi_id')}
              />

              {/* Said plainly rather than buried: we disclose this to one brand,
                  so the creator should know before, not discover it after. */}
              <label
                style={{
                  display: 'flex', gap: 10, alignItems: 'flex-start',
                  fontSize: 12, color: C.textMuted, lineHeight: 1.55,
                  margin: '4px 0 12px', cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  style={{ marginTop: 2, flexShrink: 0 }}
                />
                <span>
                  Share my UPI ID with brands I am confirmed on, so they can pay me directly.
                  It is never shown to anyone else.
                </span>
              </label>

              {error && (
                <div role="alert" style={{ fontSize: 12, color: C.error, marginBottom: 10 }}>
                  {error}
                </div>
              )}

              <div
                style={{
                  fontSize: 11, color: C.outline, lineHeight: 1.55,
                  background: C.surfaceAlt, border: `1px solid ${C.border}`,
                  borderRadius: 8, padding: 10, marginBottom: 12,
                }}
              >
                UPI only. We do not accept or store bank account numbers. Brands pay you
                directly, so your money never passes through ValueSkins, and the deal only
                moves forward once you confirm a payment arrived.
              </div>

              <button
                type="submit"
                disabled={busy || !upi.trim() || !consent}
                style={{
                  width: '100%', padding: '12px',
                  background: busy || !upi.trim() || !consent ? C.border : C.primary,
                  border: 'none', borderRadius: 8, color: C.onPrimary,
                  fontWeight: 700, fontSize: 13,
                  cursor: busy || !upi.trim() || !consent ? 'not-allowed' : 'pointer',
                }}
              >
                {busy ? 'Saving…' : 'Save UPI ID'}
              </button>
            </form>
          )}
        </div>
      </div>
    </>
  );
}
