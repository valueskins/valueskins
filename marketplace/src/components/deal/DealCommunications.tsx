// The email audit trail for a deal.
//
// Every notification is already recorded server-side — who it went to, when,
// and whether it was delivered — and nothing displayed it. In a dispute the
// record that would settle it existed only in the database.
//
// Shown to both parties deliberately: a trail only one side can read is not a
// record, it is a claim. Delivery failures are shown too rather than hidden,
// because "the brand says they emailed me" is exactly what this resolves.
import { useEffect, useState } from 'react';
import { handleLabel } from '@/lib/handle';
import { C, withAlpha } from '@/theme/colors';
import { getCommunications, isOk } from '@/lib/deal-api';

interface Entry {
  id: string;
  email_type: string;
  subject: string;
  delivery_status: string;
  sent_at: string;
  read_at: string | null;
  sender_username: string | null;
  recipient_username: string | null;
}

const TYPE_LABEL: Record<string, string> = {
  DEAL_CREATED: 'Deal posted',
  NEW_APPLICATION: 'New application',
  APPLICATION_APPROVED: 'Creator confirmed',
  COMMISSION_CONFIRMED: 'Commission paid',
  ADVANCE_CONFIRMED: 'Advance paid',
  CONTENT_UPLOADED: 'Content delivered',
  REVISION_REQUESTED: 'Changes requested',
  FINAL_APPROVAL: 'Content approved',
  FINAL_CONFIRMED: 'Final payment',
  ADP_READY: 'Deal report',
  DEAL_CANCELLED: 'Deal cancelled',
  CONTENT_OVERDUE: 'Content overdue',
};

export default function DealCommunications({ dealId }: { dealId: string }) {
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || entries) return;
    let cancelled = false;
    (async () => {
      const res = await getCommunications(dealId);
      if (cancelled) return;
      if (!isOk(res)) setError(res.error);
      else setEntries((res.data.communications || []) as Entry[]);
    })();
    return () => { cancelled = true; };
  }, [open, entries, dealId]);

  const card: React.CSSProperties = {
    background: C.surface, border: `1px solid ${C.border}`,
    borderRadius: 12, padding: 16, marginBottom: 12,
  };

  return (
    <div style={card}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          width: '100%', background: 'none', border: 'none', padding: 0,
          cursor: 'pointer', color: C.text, fontFamily: 'inherit',
        }}
      >
        <span
          style={{
            fontSize: 11, fontWeight: 700, color: C.outline,
            textTransform: 'uppercase', letterSpacing: '0.5px',
          }}
        >
          Record of notifications{entries ? ` (${entries.length})` : ''}
        </span>
        <span style={{ fontSize: 11, color: C.outline }}>{open ? 'Hide' : 'Show'}</span>
      </button>

      {open && (
        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 11, color: C.outline, marginBottom: 8, lineHeight: 1.5 }}>
            Every notification sent about this deal, visible to both parties. Timestamps are UTC.
          </div>

          {!entries && !error && <div style={{ fontSize: 11, color: C.outline }}>Loading…</div>}
          {error && <div style={{ fontSize: 11, color: C.error }}>{error}</div>}
          {entries?.length === 0 && (
            <div style={{ fontSize: 11, color: C.outline }}>Nothing sent yet.</div>
          )}

          {entries?.map((e) => {
            const failed = e.delivery_status !== 'sent';
            return (
              <div
                key={e.id}
                style={{
                  borderTop: `1px solid ${C.border}`,
                  padding: '7px 0',
                  display: 'flex', gap: 10, alignItems: 'baseline',
                }}
              >
                <span
                  style={{
                    fontSize: 10, color: C.outline, whiteSpace: 'nowrap',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {new Date(e.sent_at).toISOString().replace('T', ' ').slice(0, 16)}
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: 12, color: C.text }}>
                    {TYPE_LABEL[e.email_type] || e.email_type}
                  </span>
                  {e.recipient_username && (
                    <span style={{ fontSize: 10, color: C.outline }}> → {handleLabel(e.recipient_username)}</span>
                  )}
                </span>
                {failed && (
                  <span
                    style={{
                      fontSize: 9, color: C.error, border: `1px solid ${C.error}`,
                      background: withAlpha(C.error, 0x14),
                      borderRadius: 4, padding: '1px 5px', whiteSpace: 'nowrap',
                    }}
                  >
                    not delivered
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
