// The direct brand-to-creator payment step.
//
// Neither Razorpay payout path is open to us, so the creator's share goes
// straight from the brand's UPI to the creator's. This panel is the record of
// money we never touch, which is why it is careful about two things:
//
//   - The creator's confirmation is what moves the deal. The brand recording a
//     payment does nothing on its own, and the UI says so plainly rather than
//     implying progress.
//   - It updates live. A brand that has paid is waiting on the creator, and a
//     creator who has been paid is waiting to be told. Neither should have to
//     reload, so a confirmation pushes over the WebSocket.
import { useCallback, useEffect, useState } from 'react';
import { C, withAlpha } from '@/theme/colors';
import { useWebSocket } from '@/hooks/useWebSocket';
import UpiPayButton from './UpiPayButton';

interface DirectPayment {
  id: string;
  type: 'ADVANCE' | 'FINAL';
  amount: string;
  reference: string;
  paid_to_vpa: string;
  recorded_at: string;
  confirmed_at: string | null;
  disputed_at: string | null;
  dispute_reason: string;
}

interface State {
  expected_stage: 'ADVANCE' | 'FINAL' | null;
  amount_due: number | null;
  destination: { vpa?: string; name?: string; blocked?: string };
  payments: DirectPayment[];
}

const BLOCKED_REASON: Record<string, string> = {
  creator_has_no_upi: 'The creator has not added a UPI ID yet. They are being asked for it.',
  no_consent: 'The creator has not yet agreed to share their UPI ID with you.',
  no_creator: 'No creator is confirmed on this deal.',
  not_brand: 'Only the brand on this deal can see payment details.',
};

const money = (n: number | string) =>
  `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function DirectPaymentPanel({
  dealId,
  viewer,
  onChanged,
}: {
  dealId: string;
  viewer: 'brand' | 'creator';
  onChanged?: () => void;
}) {
  const [state, setState] = useState<State | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reference, setReference] = useState('');
  const [disputing, setDisputing] = useState<string | null>(null);
  const [disputeReason, setDisputeReason] = useState('');
  const { connected, subscribe } = useWebSocket();

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/deals/${dealId}/direct-payment`, { credentials: 'include' });
      if (!res.ok) return;
      setState(await res.json());
    } catch {
      /* leave the last known state rather than blanking the panel */
    }
  }, [dealId]);

  useEffect(() => { void load(); }, [load]);

  // The counterparty is waiting on this, so it has to arrive without a reload.
  useEffect(() => {
    if (!connected) return;
    const off = subscribe('mutate', (msg) => {
      const m = msg as any;
      if (m?.collection !== 'deals') return;
      if (m?.key && m.key !== dealId) return;
      void load();
      onChanged?.();
    });
    return () => off();
  }, [connected, subscribe, dealId, load, onChanged]);

  useEffect(() => { if (connected) void load(); }, [connected]); // eslint-disable-line react-hooks/exhaustive-deps

  // Same reason as the deal page's own timer: the other party's confirmation
  // has to show up even when no socket is connected.
  useEffect(() => {
    const id = setInterval(() => { void load(); }, 20000);
    return () => clearInterval(id);
  }, [load]);

  async function act(url: string, body: any, method: 'POST' | 'PATCH') {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(url, {
        method,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Something went wrong');
        return false;
      }
      await load();
      onChanged?.();
      return true;
    } finally {
      setBusy(false);
    }
  }

  if (!state) return null;

  const { expected_stage: stage, amount_due: due, destination, payments } = state;
  // Scoped to the current stage: unscoped, the confirmed advance was found
  // first at the final stage, hiding the creator's confirm button.
  const live = payments.find((p) => p.type === stage && !p.disputed_at);
  const pending = live && !live.confirmed_at ? live : null;

  const card: React.CSSProperties = {
    background: C.surface, border: `1px solid ${C.border}`,
    borderRadius: 12, padding: 16, marginBottom: 12,
  };
  const label: React.CSSProperties = {
    fontSize: 11, fontWeight: 700, color: C.outline,
    textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8,
  };
  const input: React.CSSProperties = {
    width: '100%', background: C.surfaceAlt, border: `1px solid ${C.border}`,
    borderRadius: 8, color: C.text, padding: '9px 11px', fontSize: 13,
    fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', marginBottom: 10,
  };
  const btn = (primary = true, off = false): React.CSSProperties => ({
    background: off ? C.border : primary ? C.primary : 'transparent',
    border: primary ? 'none' : `1px solid ${C.border}`,
    borderRadius: 8, padding: '11px 14px',
    color: primary ? C.onPrimary : C.text,
    fontWeight: 600, fontSize: 13,
    cursor: off ? 'not-allowed' : 'pointer', opacity: off ? 0.55 : 1,
  });

  return (
    <div style={card}>
      <div style={label}>
        {stage === 'ADVANCE' ? 'Advance payment (30%)'
          : stage === 'FINAL' ? 'Final payment (70%)'
            : 'Direct payments'}
      </div>

      {error && (
        <div role="alert" style={{ fontSize: 12, color: C.error, marginBottom: 10 }}>{error}</div>
      )}

      {/* ---- Brand: pay, then record ---------------------------------- */}
      {viewer === 'brand' && stage && !pending && (
        <>
          {destination.blocked ? (
            <div
              style={{
                fontSize: 12, color: C.text, lineHeight: 1.6,
                background: withAlpha(C.warning, 0x14),
                border: `1px solid ${C.warning}`, borderRadius: 8, padding: 10,
              }}
            >
              {BLOCKED_REASON[destination.blocked] || 'Payment details are not available yet.'}
            </div>
          ) : (
            <>
              <p style={{ fontSize: 12, color: C.textMuted, margin: '0 0 10px', lineHeight: 1.6 }}>
                Send {money(due || 0)} to the creator&apos;s UPI, then record the reference here.
                The deal moves on once they confirm it arrived.
              </p>
              <div
                style={{
                  background: C.surfaceAlt, border: `1px solid ${C.border}`,
                  borderRadius: 8, padding: 12, marginBottom: 12,
                }}
              >
                <div style={{ fontSize: 10, color: C.outline, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Pay this UPI ID
                </div>
                <div
                  style={{
                    fontSize: 16, fontWeight: 700, color: C.text,
                    fontFamily: 'ui-monospace, monospace', marginTop: 4, wordBreak: 'break-all',
                  }}
                >
                  {destination.vpa}
                </div>
                <div style={{ fontSize: 12, color: C.textMuted, marginTop: 6 }}>
                  Amount: <strong style={{ color: C.text }}>{money(due || 0)}</strong>
                </div>
                {destination.name && (
                  <div style={{ fontSize: 12, color: C.textMuted, marginTop: 6 }}>
                    Account name: <strong style={{ color: C.text }}>{destination.name}</strong>
                  </div>
                )}
              </div>

              {/* The one check available before money moves. */}
              <div
                style={{
                  fontSize: 12, color: C.text, lineHeight: 1.6,
                  background: withAlpha(C.warning, 0x14),
                  border: `1px solid ${C.warning}`, borderRadius: 8, padding: 10, marginBottom: 12,
                }}
              >
                {destination.name
                  ? <>Before you enter your PIN, check that your UPI app shows the name <strong>{destination.name}</strong>. If it shows a different name, do not pay.</>
                  : <>The creator has not given the name on this account. Check the name your UPI app shows before you enter your PIN, and do not pay if it looks wrong.</>}
                {' '}A UPI payment cannot be recalled.
              </div>

              {destination.vpa && (
                <UpiPayButton
                  vpa={destination.vpa}
                  name={destination.name}
                  amount={Number(due) || 0}
                  note={stage === 'ADVANCE' ? 'ValueSkins advance' : 'ValueSkins final payment'}
                />
              )}

              <label htmlFor="ref" style={{ fontSize: 11, fontWeight: 600, color: C.outline, display: 'block', marginBottom: 4 }}>
                UPI reference or UTR number
              </label>
              <input
                id="ref"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="From your bank or UPI app"
                autoCapitalize="characters"
                style={input}
              />
              <button
                disabled={busy || reference.trim().length < 6}
                onClick={async () => {
                  const okd = await act(
                    `/api/deals/${dealId}/direct-payment`,
                    { stage, reference: reference.trim() },
                    'POST'
                  );
                  if (okd) setReference('');
                }}
                style={btn(true, busy || reference.trim().length < 6)}
              >
                {busy ? 'Recording…' : 'I have sent this payment'}
              </button>
            </>
          )}
        </>
      )}

      {/* ---- Brand: waiting on the creator --------------------------- */}
      {viewer === 'brand' && pending && (
        <div
          style={{
            fontSize: 12, color: C.text, lineHeight: 1.6,
            background: withAlpha(C.warning, 0x14),
            border: `1px solid ${C.warning}`, borderRadius: 8, padding: 12,
          }}
        >
          <strong>Waiting for the creator to confirm.</strong>
          <div style={{ marginTop: 6, color: C.textMuted }}>
            You recorded {money(pending.amount)}, reference {pending.reference}. The deal moves on
            when they confirm it arrived. Nothing here advances until they do.
          </div>
        </div>
      )}

      {/* ---- Creator: confirm or dispute ----------------------------- */}
      {viewer === 'creator' && pending && (
        <>
          <p style={{ fontSize: 12, color: C.textMuted, margin: '0 0 10px', lineHeight: 1.6 }}>
            The brand says it sent you <strong style={{ color: C.text }}>{money(pending.amount)}</strong>,
            reference <strong style={{ color: C.text }}>{pending.reference}</strong>.
            Check your bank before confirming — this is what moves the deal forward.
          </p>

          {disputing === pending.id ? (
            <>
              <textarea
                value={disputeReason}
                onChange={(e) => setDisputeReason(e.target.value)}
                rows={3}
                placeholder="What happened? For example: nothing arrived, or the amount was short."
                aria-label="What went wrong"
                style={{ ...input, resize: 'vertical' }}
              />
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  disabled={busy || !disputeReason.trim()}
                  onClick={async () => {
                    const okd = await act(
                      `/api/deals/${dealId}/direct-payment/${pending.id}`,
                      { action: 'dispute', reason: disputeReason.trim() },
                      'PATCH'
                    );
                    if (okd) { setDisputing(null); setDisputeReason(''); }
                  }}
                  style={{ ...btn(false, busy || !disputeReason.trim()), flex: 1, color: C.error, borderColor: C.error }}
                >
                  Report a problem
                </button>
                <button onClick={() => setDisputing(null)} style={{ ...btn(false), flex: 1 }}>
                  Back
                </button>
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                disabled={busy}
                onClick={() =>
                  act(
                    `/api/deals/${dealId}/direct-payment/${pending.id}`,
                    { action: 'confirm' },
                    'PATCH'
                  )
                }
                style={{ ...btn(true, busy), flex: 1, minWidth: 170 }}
              >
                {busy ? 'Confirming…' : 'Yes, I received it'}
              </button>
              <button onClick={() => setDisputing(pending.id)} style={btn(false)}>
                It has not arrived
              </button>
            </div>
          )}
        </>
      )}

      {viewer === 'creator' && !pending && stage && (
        <p style={{ fontSize: 12, color: C.textMuted, margin: 0, lineHeight: 1.6 }}>
          Waiting for the brand to send the {stage === 'ADVANCE' ? 'advance' : 'final payment'} of{' '}
          {money(due || 0)} to your UPI.
        </p>
      )}

      {/* ---- The record --------------------------------------------- */}
      {payments.length > 0 && (
        <div style={{ marginTop: 14, borderTop: `1px solid ${C.border}`, paddingTop: 10 }}>
          <div style={{ ...label, marginBottom: 6 }}>Record</div>
          {payments.map((p) => (
            <div key={p.id} style={{ fontSize: 11, color: C.textMuted, padding: '3px 0' }}>
              {p.type === 'ADVANCE' ? 'Advance' : 'Final'} · {money(p.amount)} · {p.reference}
              {p.confirmed_at && <span style={{ color: C.accent }}> · confirmed</span>}
              {p.disputed_at && (
                <span style={{ color: C.error }}> · disputed: {p.dispute_reason}</span>
              )}
              {!p.confirmed_at && !p.disputed_at && (
                <span style={{ color: C.warning }}> · awaiting confirmation</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
