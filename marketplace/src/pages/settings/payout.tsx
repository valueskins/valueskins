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
import { getOnboardingStatus, getPayoutStatus, setupPayout, isOk } from '@/lib/deal-api';

type Method = 'upi' | 'bank';

export default function PayoutSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [configured, setConfigured] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const [emailReady, setEmailReady] = useState<boolean | null>(null);
  const [method, setMethod] = useState<Method>('upi');
  const [upi, setUpi] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifsc, setIfsc] = useState('');
  const [holder, setHolder] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorField, setErrorField] = useState<string | undefined>();

  const load = useCallback(async () => {
    const [payout, onboarding] = await Promise.all([getPayoutStatus(), getOnboardingStatus()]);
    if (isOk(payout)) {
      setConfigured(payout.data.configured);
      setHint(payout.data.display_hint);
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

    const res = await setupPayout(
      method === 'upi'
        ? { payment_method: 'upi', upi_id: upi.trim(), account_holder_name: holder.trim() || undefined }
        : {
            payment_method: 'bank',
            account_number: accountNumber.trim(),
            ifsc: ifsc.trim().toUpperCase(),
            account_holder_name: holder.trim() || undefined,
          }
    );
    setBusy(false);

    if (!isOk(res)) {
      setError(res.error);
      setErrorField(res.field);
      return;
    }
    // Clear the raw values from component state the moment they are no longer
    // needed; there is no reason for them to sit in memory after this.
    setAccountNumber('');
    setIfsc('');
    setUpi('');
    setConfigured(true);
    setHint(res.data.display_hint);
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
              <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                {(['upi', 'bank'] as Method[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => { setMethod(m); setError(null); }}
                    style={{
                      flex: 1, padding: '9px',
                      background: method === m ? withAlpha(C.primary, 0x22) : 'transparent',
                      border: `1px solid ${method === m ? C.primary : C.border}`,
                      borderRadius: 8, color: C.text,
                      fontWeight: method === m ? 700 : 500, fontSize: 13, cursor: 'pointer',
                    }}
                  >
                    {m === 'upi' ? 'UPI' : 'Bank transfer'}
                  </button>
                ))}
              </div>

              <label style={lbl} htmlFor="holder">Account holder name</label>
              <input
                id="holder" value={holder} onChange={(e) => setHolder(e.target.value)}
                placeholder="As it appears on the account"
                autoComplete="name"
                style={input(errorField === 'account_holder_name')}
              />

              {method === 'upi' ? (
                <>
                  <label style={lbl} htmlFor="upi">UPI ID</label>
                  <input
                    id="upi" value={upi} onChange={(e) => setUpi(e.target.value)}
                    placeholder="name@bank" inputMode="email" autoCapitalize="none"
                    style={input(errorField === 'upi_id' || errorField === 'address')}
                  />
                </>
              ) : (
                <>
                  <label style={lbl} htmlFor="acct">Account number</label>
                  <input
                    id="acct" value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ''))}
                    placeholder="Digits only" inputMode="numeric" autoComplete="off"
                    style={input(errorField === 'account_number')}
                  />
                  <label style={lbl} htmlFor="ifsc">IFSC code</label>
                  <input
                    id="ifsc" value={ifsc}
                    onChange={(e) => setIfsc(e.target.value.toUpperCase())}
                    placeholder="e.g. HDFC0000001" autoCapitalize="characters" autoComplete="off"
                    maxLength={11}
                    style={input(errorField === 'ifsc')}
                  />
                </>
              )}

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
                These details go straight to Razorpay, our payment processor. ValueSkins stores only a
                token and the last four digits — we never keep your account number. You can enter this
                once; changing it later goes through support.
              </div>

              <button
                type="submit"
                disabled={busy || !holder.trim() || (method === 'upi' ? !upi.trim() : !(accountNumber.trim() && ifsc.trim()))}
                style={{
                  width: '100%', padding: '12px',
                  background: busy ? C.border : C.primary, border: 'none', borderRadius: 8,
                  color: C.onPrimary, fontWeight: 700, fontSize: 13,
                  cursor: busy ? 'not-allowed' : 'pointer',
                }}
              >
                {busy ? 'Saving…' : 'Save payout details'}
              </button>
            </form>
          )}
        </div>
      </div>
    </>
  );
}
