// The creator's UPI ID: see what is saved, and change it.
//
// Brands pay the creator directly on this ID, so two things matter here. The
// creator has to be able to read back exactly what is saved, because a UPI
// payment to a mistyped ID cannot be recalled. And they have to be able to
// change it themselves. The ID is typed twice for the same reason a password
// is: the app has no way to check it is the right one, and says so.
//
// Rendered inside Settings, and on its own page at /settings/payout.
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { C, withAlpha } from '@/theme/colors';
import { getOnboardingStatus, isOk } from '@/lib/deal-api';

export default function PayoutUpi({ role = 'creator' }: { role?: 'creator' | 'brand' }) {
  const isCreator = role !== 'brand';
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState<string | null>(null);
  const [savedName, setSavedName] = useState('');
  const [name, setName] = useState('');
  const [emailReady, setEmailReady] = useState<boolean | null>(null);
  const [editing, setEditing] = useState(false);
  const [upi, setUpi] = useState('');
  const [upiAgain, setUpiAgain] = useState('');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorField, setErrorField] = useState<string | undefined>();
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [payoutRes, onboarding] = await Promise.all([
      fetch('/api/profile/payout-upi', { credentials: 'include' }).then((r) => r.json()).catch(() => null),
      getOnboardingStatus(),
    ]);
    if (payoutRes) {
      setSaved(payoutRes.upi_id || null);
      setSavedName(payoutRes.account_name || '');
    }
    if (isOk(onboarding)) {
      // Payouts require a verified email first: it is where confirmations go.
      setEmailReady(onboarding.data.email_verified);
    }
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const mismatch = upiAgain.length > 0 && upi.trim() !== upiAgain.trim();
  // Consent is to sharing the ID with a confirmed brand, which only applies to a
  // creator. A brand's ID is shown to nobody, so there is nothing to agree to.
  const canSubmit = !busy && !!upi.trim() && upi.trim() === upiAgain.trim() && name.trim().length >= 2 && (consent || !isCreator);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    setErrorField(undefined);
    setNotice(null);

    const res = await fetch('/api/profile/payout-upi', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ upi_id: upi.trim(), account_name: name.trim(), share_consent: isCreator ? consent : false }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);

    if (!res.ok) {
      setError(data.error || 'Could not save your UPI ID');
      setErrorField(data.field);
      return;
    }
    setSaved(data.upi_id || upi.trim());
    setSavedName(data.account_name || name.trim());
    setName('');
    setNotice(data.changed ? 'UPI ID changed. We have emailed you a confirmation.' : 'UPI ID saved.');
    setUpi('');
    setUpiAgain('');
    setConsent(false);
    setEditing(false);
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
  const showForm = !loading && emailReady !== false && (!saved || editing);

  return (
    <div>
          {/* Stated outright: nothing behind this form checks the ID. */}
          <div
            role="note"
            style={{
              ...card, borderColor: C.warning, background: withAlpha(C.warning, 0x14),
              fontSize: 12, lineHeight: 1.6,
            }}
          >
            <strong>We do not currently use any third-party UPI verification.</strong> We cannot
            check that a UPI ID exists or that it belongs to you, so enter it exactly right. A
            payment sent to a wrong UPI ID cannot be recalled.
          </div>

          {loading && <div style={{ fontSize: 13, color: C.outline }}>Loading…</div>}

          {notice && (
            <div role="status" style={{ ...card, borderColor: C.accent, background: withAlpha(C.accent, 0x14), fontSize: 12 }}>
              {notice}
            </div>
          )}

          {!loading && emailReady === false && (
            <div style={{ ...card, borderColor: C.warning, background: withAlpha(C.warning, 0x14) }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Confirm your email first</div>
              <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 8 }}>
                Payment confirmations and your deal reports are sent there, so it has to be
                confirmed before a UPI ID can be saved.
              </div>
              <Link href="/settings/email" style={{ color: C.text, fontSize: 12, fontWeight: 700 }}>
                Go to email settings
              </Link>
            </div>
          )}

          {!loading && saved && !editing && (
            <div style={card}>
              <div style={lbl}>Your UPI ID</div>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6, wordBreak: 'break-all' }}>{saved}</div>
              <div style={lbl}>Name on the account</div>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
                {savedName || (
                  <span style={{ color: C.warning, fontWeight: 500 }}>
                    {isCreator
                      ? 'Not added yet. Use Change UPI ID to add it, so brands can check it before paying.'
                      : 'Not added yet. Use Change UPI ID to add it.'}
                  </span>
                )}
              </div>
              <div style={{ fontSize: 11, color: C.outline, lineHeight: 1.5, marginBottom: 12 }}>
                Check this is exactly right. A UPI payment sent to the wrong ID cannot be recalled.
                {isCreator
                  ? 'It is shown only to you and to brands you are confirmed on.'
                  : 'It is shown only to you. It is not shown to creators.'}
              </div>
              {emailReady !== false && (
                <button
                  onClick={() => { setEditing(true); setName(savedName); setNotice(null); setError(null); }}
                  style={{
                    background: 'none', border: `1px solid ${C.border}`, borderRadius: 8,
                    padding: '9px 14px', color: C.text, fontWeight: 600, fontSize: 13, cursor: 'pointer',
                  }}
                >
                  Change UPI ID
                </button>
              )}
            </div>
          )}

          {showForm && (
            <form onSubmit={submit} style={card}>
              <label style={lbl} htmlFor="upi">{saved ? 'New UPI ID' : 'Your UPI ID'}</label>
              <input
                id="upi" value={upi} onChange={(e) => setUpi(e.target.value)}
                placeholder="name@okhdfcbank"
                inputMode="email" autoCapitalize="none" autoComplete="off" spellCheck={false}
                style={input(errorField === 'upi_id')}
              />

              <label style={lbl} htmlFor="upi-again">Type it again</label>
              <input
                id="upi-again" value={upiAgain} onChange={(e) => setUpiAgain(e.target.value)}
                placeholder="name@okhdfcbank"
                inputMode="email" autoCapitalize="none" autoComplete="off" spellCheck={false}
                // Pasting the first field into the second would defeat the point.
                onPaste={(e) => e.preventDefault()}
                aria-invalid={mismatch}
                style={input(mismatch)}
              />
              {mismatch && (
                <div role="alert" style={{ fontSize: 12, color: C.error, margin: '-4px 0 10px' }}>
                  The two UPI IDs do not match.
                </div>
              )}

              <label style={lbl} htmlFor="acct-name">Name on the bank account</label>
              <input
                id="acct-name" value={name} onChange={(e) => setName(e.target.value)}
                placeholder="As your UPI app shows it"
                autoComplete="name" maxLength={80}
                style={input(errorField === 'account_name')}
              />
              <div style={{ fontSize: 11, color: C.outline, lineHeight: 1.5, margin: '-4px 0 10px' }}>
                The brand sees this next to your UPI ID and checks it against the name their UPI
                app shows before paying.
              </div>

              {/* Said plainly rather than buried: we disclose this to one brand,
                  so the creator should know before, not discover it after. */}
              {isCreator && (
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
                    Share my UPI ID and this name with brands I am confirmed on, so they can pay me directly.
                    It is never shown to anyone else.
                  </span>
                </label>
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
                UPI only. We do not accept or store bank account numbers.{' '}
                {isCreator
                  ? 'Brands pay you directly, so your money never passes through ValueSkins, and the deal only moves forward once you confirm a payment arrived.'
                  : 'This is kept on your account. ValueSkins does not send money to it or take money from it.'}
                {saved ? ' We email you whenever it is changed.' : ''}
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="submit"
                  disabled={!canSubmit}
                  style={{
                    flex: 1, padding: '12px',
                    background: canSubmit ? C.primary : C.border,
                    border: 'none', borderRadius: 8, color: C.onPrimary,
                    fontWeight: 700, fontSize: 13,
                    cursor: canSubmit ? 'pointer' : 'not-allowed',
                  }}
                >
                  {busy ? 'Saving…' : saved ? 'Save new UPI ID' : 'Save UPI ID'}
                </button>
                {saved && (
                  <button
                    type="button"
                    onClick={() => { setEditing(false); setUpi(''); setUpiAgain(''); setConsent(false); setError(null); }}
                    style={{
                      padding: '12px 16px', background: 'none', border: `1px solid ${C.border}`,
                      borderRadius: 8, color: C.text, fontWeight: 600, fontSize: 13, cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          )}
    </div>
  );
}
