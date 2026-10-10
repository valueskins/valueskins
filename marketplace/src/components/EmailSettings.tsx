// The account's email address, shown and changed in place inside Settings.
//
// A change goes through the same confirmation as the first time: the new
// address is saved as unconfirmed and a link is sent to it. Nothing here marks
// an address confirmed; only opening that link does.
import { useCallback, useEffect, useState } from 'react';
import { C, withAlpha } from '@/theme/colors';
import { getOnboardingStatus, setEmail, isOk } from '@/lib/deal-api';

export default function EmailSettings() {
  const [loading, setLoading] = useState(true);
  const [current, setCurrent] = useState('');
  const [verified, setVerified] = useState(false);
  const [editing, setEditing] = useState(false);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    const res = await getOnboardingStatus();
    if (isOk(res)) {
      setCurrent(res.data.email || '');
      setVerified(!!res.data.email_verified);
    }
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  // The confirmation link opens in another tab. Coming back to this one should
  // show the address as confirmed without a manual reload.
  useEffect(() => {
    const onFocus = () => { void load(); };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [load]);

  async function send(address: string) {
    setBusy(true);
    setMessage(null);
    const res = await setEmail(address.trim());
    setBusy(false);
    if (!isOk(res)) {
      setMessage({ ok: false, text: res.error });
      return;
    }
    setMessage({
      ok: true,
      text: res.data.email_verified
        ? 'This address is already confirmed.'
        : `We sent a confirmation link to ${res.data.email}. Open it to finish.`,
    });
    setEditing(false);
    setInput('');
    await load();
  }

  const showForm = !loading && (!current || editing);
  const changed = input.trim().toLowerCase() !== current.toLowerCase();
  const off = busy || !input.trim() || (!!current && !changed);

  const lbl: React.CSSProperties = {
    display: 'block', fontSize: '11px', fontWeight: 700, color: C.textMuted,
    textTransform: 'uppercase', marginBottom: '6px',
  };
  const ghost: React.CSSProperties = {
    background: 'none', border: `1px solid ${C.border}`, borderRadius: '8px',
    padding: '9px 14px', color: C.text, fontWeight: 600, fontSize: '13px', cursor: 'pointer',
  };

  return (
    <div style={{ marginBottom: '24px' }}>
      <div style={{ fontSize: '12px', fontWeight: 700, color: C.textMuted, letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: '12px' }}>
        Email Address
      </div>
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '12px', padding: '16px' }}>
        {loading && <div style={{ fontSize: '13px', color: C.textMuted }}>Loading…</div>}

        {!loading && current && !editing && (
          <>
            <div style={lbl}>Your email</div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: C.text, wordBreak: 'break-all', marginBottom: '6px' }}>
              {current}
            </div>
            <div style={{ fontSize: '12px', color: verified ? C.textSecondary : C.warning, marginBottom: '12px', lineHeight: 1.5 }}>
              {verified
                ? 'Confirmed. Deal notices are sent here, and it is shown to the other side of your deals.'
                : 'Not confirmed yet. Open the link we emailed you. Check spam if it has not arrived.'}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => { setEditing(true); setInput(''); setMessage(null); }}
                style={ghost}
              >
                Change email
              </button>
              {!verified && (
                <button type="button" disabled={busy} onClick={() => send(current)} style={{ ...ghost, opacity: busy ? 0.6 : 1 }}>
                  {busy ? 'Sending…' : 'Send the link again'}
                </button>
              )}
            </div>
          </>
        )}

        {showForm && (
          <form onSubmit={(e) => { e.preventDefault(); if (!off) void send(input); }}>
            <label htmlFor="settings-email" style={lbl}>{current ? 'New email address' : 'Email address'}</label>
            <input
              id="settings-email" type="email" value={input} required
              onChange={(e) => { setInput(e.target.value); setMessage(null); }}
              placeholder="you@example.com" autoComplete="email" autoCapitalize="none"
              style={{
                width: '100%', background: C.bg, border: `1px solid ${C.border}`, borderRadius: '8px',
                color: C.text, padding: '10px 12px', fontSize: '13px', fontFamily: 'inherit',
                outline: 'none', boxSizing: 'border-box', marginBottom: '10px',
              }}
            />
            <div style={{ fontSize: '11px', color: C.textMuted, lineHeight: 1.5, marginBottom: '12px' }}>
              We will email a confirmation link to this address.
              {current && verified
                ? ' Until you open it, your account counts as unconfirmed, so paying and changing a UPI ID are paused. We also tell your current address about the change.'
                : ''}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="submit" disabled={off}
                style={{
                  padding: '9px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 700,
                  border: 'none', color: C.onPrimary,
                  background: off ? C.border : C.primary, cursor: off ? 'not-allowed' : 'pointer',
                }}
              >
                {busy ? 'Sending…' : 'Send confirmation link'}
              </button>
              {current && (
                <button type="button" onClick={() => { setEditing(false); setInput(''); setMessage(null); }} style={ghost}>
                  Cancel
                </button>
              )}
            </div>
          </form>
        )}

        {message && (
          <div
            role={message.ok ? 'status' : 'alert'}
            style={{
              marginTop: '12px', fontSize: '12px', lineHeight: 1.5, borderRadius: '8px', padding: '10px',
              color: C.text,
              background: withAlpha(message.ok ? C.accent : C.danger, 0x14),
              border: `1px solid ${message.ok ? C.accent : C.danger}`,
            }}
          >
            {message.text}
          </div>
        )}
      </div>
    </div>
  );
}
