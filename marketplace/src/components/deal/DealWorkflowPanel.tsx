// The deal workflow, as one panel.
//
// This is the UI the workflow had been missing. The existing marketplace page
// was built for the superseded brand-offers model: it has no control to apply
// to a deal, confirm an applicant, deliver content, or request a revision, so
// there was nowhere to hang those endpoints. Every action below is one call.
//
// Two rules it follows throughout:
//   - the server owns the state. Nothing here guesses the next status; it acts,
//     then refetches. A payment in particular is only "submitted" until the
//     webhook confirms it, so the panel says "confirming" rather than "paid".
//   - the server owns the money. No amount is ever sent. The figures shown come
//     from a helper asserted equal to the server's at every budget, and the
//     amount actually charged is computed server-side from the deal's budget.
import { useCallback, useEffect, useState } from 'react';
import { C, withAlpha } from '@/theme/colors';
import CreatorResume from './CreatorResume';
import DirectPaymentPanel from './DirectPaymentPanel';
import {
  applyToDeal,
  decideApplication,
  uploadContent,
  requestRevision,
  approveContent,
  cancelDeal,
  publishDeal,
  getDealApplications,
  runPaymentStage,
  financials,
  nextAction,
  canCancelDeal,
  progressOf,
  isOk,
  type WorkflowStatus,
  type DealApplication,
} from '@/lib/deal-api';

export type Viewer = 'brand' | 'creator';

export interface DealWorkflowPanelProps {
  dealId: string;
  viewer: Viewer;
  title: string;
  budget: number;
  status: WorkflowStatus;
  /** Set for the creator view once the deal is confirmed to them. */
  isConfirmedCreator?: boolean;
  contentLink?: string;
  feedback?: string;
  revisionCount?: number;
  applicationsOpen?: boolean;
  alreadyApplied?: boolean;
  /** Called after any action that may have changed server state. */
  onChanged?: () => void;
}

const money = (n: number) =>
  `₹${Number(n || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const STAGES: { status: WorkflowStatus; label: string }[] = [
  { status: 'OPEN', label: 'Posted' },
  { status: 'CONFIRMED', label: 'Creator picked' },
  { status: 'COMMISSION_PAID', label: 'Commission' },
  { status: 'ADVANCE_PAID', label: 'Advance' },
  { status: 'CONTENT_UPLOADED', label: 'Delivered' },
  { status: 'APPROVED_FOR_FINAL_PAYMENT', label: 'Approved' },
  { status: 'COMPLETED', label: 'Paid' },
];

export default function DealWorkflowPanel(props: DealWorkflowPanelProps) {
  const {
    dealId, viewer, title, budget, status,
    isConfirmedCreator, contentLink, feedback, revisionCount = 0,
    applicationsOpen, alreadyApplied, onChanged,
  } = props;

  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'bad'; text: string } | null>(null);
  const [applications, setApplications] = useState<DealApplication[] | null>(null);
  const [linkInput, setLinkInput] = useState('');
  const [feedbackInput, setFeedbackInput] = useState('');
  // A payment handed to Razorpay but not yet confirmed by the webhook.
  const [confirming, setConfirming] = useState(false);
  // Which applicant's history is expanded. One at a time: comparing two is the
  // job of the list, and several open panels makes the rows unscannable.
  const [openResume, setOpenResume] = useState<string | null>(null);

  const F = financials(budget);
  const action = nextAction(status);
  const waitingOnMe = action.actor === viewer;

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 6000);
    return () => clearTimeout(t);
  }, [notice]);

  // Any server state change is reported upward rather than patched locally, so
  // the panel cannot drift from the deal it is rendering.
  const run = useCallback(
    async <T,>(key: string, fn: () => Promise<any>, okText?: string) => {
      setBusy(key);
      setNotice(null);
      try {
        const res = await fn();
        if (!isOk(res)) {
          setNotice({ kind: 'bad', text: res.error });
          return null;
        }
        if (okText) setNotice({ kind: 'ok', text: okText });
        onChanged?.();
        return res.data as T;
      } finally {
        setBusy(null);
      }
    },
    [onChanged]
  );

  const loadApplications = useCallback(async () => {
    const res = await getDealApplications(dealId);
    if (isOk(res)) setApplications(res.data.applications);
  }, [dealId]);

  useEffect(() => {
    // Only the owning brand may read this; for a creator it would 403.
    if (viewer === 'brand') void loadApplications();
  }, [viewer, loadApplications, status]);

  async function pay(stage: 'commission' | 'advance' | 'remaining', label: string) {
    setBusy(stage);
    setNotice(null);
    try {
      const outcome = await runPaymentStage(dealId, stage, {
        description: `${label} — ${title}`,
        themeColor: C.primary,
      });
      if (outcome.status === 'dismissed') {
        setNotice({ kind: 'bad', text: 'Payment cancelled.' });
        return;
      }
      if (outcome.status === 'error') {
        setNotice({ kind: 'bad', text: outcome.error });
        return;
      }
      // Razorpay accepting it is not settlement. The webhook advances the deal.
      setConfirming(true);
      setNotice({ kind: 'ok', text: 'Payment submitted. Confirming with the bank…' });
      onChanged?.();
    } finally {
      setBusy(null);
    }
  }

  // Once the status moves past the stage we paid, the webhook has landed.
  useEffect(() => {
    if (confirming && status !== 'CONFIRMED') setConfirming(false);
  }, [status, confirming]);

  const card: React.CSSProperties = {
    background: C.surface,
    border: `1px solid ${C.border}`,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  };
  const label: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 700,
    color: C.outline,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginBottom: 8,
  };
  const btn = (primary = true, disabled = false): React.CSSProperties => ({
    background: disabled ? C.border : primary ? C.primary : 'transparent',
    border: primary ? 'none' : `1px solid ${C.border}`,
    borderRadius: 8,
    padding: '11px 14px',
    color: primary ? C.onPrimary : C.text,
    fontWeight: 600,
    fontSize: 13,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.55 : 1,
  });
  const input: React.CSSProperties = {
    width: '100%',
    background: C.surfaceAlt,
    border: `1px solid ${C.border}`,
    borderRadius: 8,
    color: C.text,
    padding: '9px 11px',
    fontSize: 13,
    fontFamily: 'inherit',
    outline: 'none',
    boxSizing: 'border-box',
  };

  const currentIndex = STAGES.findIndex((s) => s.status === status);

  return (
    <div>
      {/* Progress. A revision sits at the delivery stage rather than moving
          backwards, so the bar never appears to lose ground. */}
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{title}</div>
          <div style={{ fontSize: 12, color: C.outline }}>{money(budget)}</div>
        </div>
        <div style={{ height: 4, background: C.surfaceAlt, borderRadius: 2, overflow: 'hidden', marginBottom: 8 }}>
          <div
            style={{
              width: `${Math.round(progressOf(status) * 100)}%`,
              height: '100%',
              background: C.primary,
              transition: 'width .35s ease',
            }}
          />
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {STAGES.map((s, i) => (
            <span
              key={s.status}
              style={{
                fontSize: 10,
                padding: '2px 7px',
                borderRadius: 999,
                background: i <= currentIndex ? withAlpha(C.primary, 0x22) : 'transparent',
                border: `1px solid ${i <= currentIndex ? C.primary : C.border}`,
                color: i <= currentIndex ? C.text : C.outline,
              }}
            >
              {s.label}
            </span>
          ))}
        </div>
        <div style={{ marginTop: 10, fontSize: 12, color: waitingOnMe ? C.text : C.outline }}>
          {status === 'CANCELLED'
            ? 'This deal was cancelled.'
            : confirming
              ? 'Confirming your payment with the bank…'
              : waitingOnMe
                ? `Your move: ${action.label.toLowerCase()}`
                : action.actor === 'none'
                  ? action.label
                  : `Waiting on the ${action.actor}: ${action.label.toLowerCase()}`}
        </div>
        {revisionCount > 0 && (
          <div style={{ marginTop: 4, fontSize: 11, color: C.outline }}>
            {revisionCount} revision{revisionCount === 1 ? '' : 's'} so far
          </div>
        )}
      </div>

      {notice && (
        <div
          role={notice.kind === 'bad' ? 'alert' : 'status'}
          style={{
            ...card,
            marginBottom: 12,
            background: withAlpha(notice.kind === 'bad' ? C.error : C.accent, 0x14),
            borderColor: notice.kind === 'bad' ? C.error : C.accent,
            fontSize: 12,
            color: C.text,
          }}
        >
          {notice.text}
        </div>
      )}

      {/* Money. Shown before any payment so nothing is a surprise. */}
      <div style={card}>
        <div style={label}>Payment breakdown</div>
        {[
          { k: 'ValueSkins commission', v: F.commissionTotal, note: 'incl. 18% GST' },
          { k: viewer === 'creator' ? 'You receive' : 'Creator receives', v: F.creatorTotal, note: '' },
          { k: 'Advance (30%)', v: F.advance, note: '' },
          { k: 'Final (70%)', v: F.final, note: '' },
        ].map((r) => (
          <div key={r.k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
            <span style={{ color: C.textMuted }}>
              {r.k}
              {r.note ? ` · ${r.note}` : ''}
            </span>
            <span style={{ color: C.text, fontWeight: 600 }}>{money(r.v)}</span>
          </div>
        ))}
      </div>

      {/* ---- CREATOR: apply ------------------------------------------------ */}
      {viewer === 'creator' && status === 'OPEN' && (
        <div style={card}>
          <div style={label}>Apply</div>
          <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 10 }}>
            The amount is final — there is no negotiation. Apply only if {money(F.creatorTotal)} works for you.
          </div>
          <button
            disabled={!!busy || alreadyApplied || applicationsOpen === false}
            onClick={() => run('apply', () => applyToDeal(dealId), 'Applied. The brand will be in touch.')}
            style={btn(true, !!busy || alreadyApplied || applicationsOpen === false)}
          >
            {alreadyApplied
              ? 'Applied'
              : applicationsOpen === false
                ? 'Applications closed'
                : busy === 'apply'
                  ? 'Applying…'
                  : 'Apply to this deal'}
          </button>
        </div>
      )}

      {/* ---- BRAND: publish a draft ---------------------------------------- */}
      {viewer === 'brand' && status === 'DRAFT' && (
        <div style={card}>
          <div style={label}>Not live yet</div>
          <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 10 }}>
            Creators cannot see this until you publish it.
          </div>
          <button
            disabled={!!busy}
            onClick={() => run('publish', () => publishDeal(dealId), 'Deal is live.')}
            style={btn(true, !!busy)}
          >
            {busy === 'publish' ? 'Publishing…' : 'Publish deal'}
          </button>
        </div>
      )}

      {/* ---- BRAND: applicants -------------------------------------------- */}
      {viewer === 'brand' && (status === 'OPEN' || status === 'CONFIRMED') && (
        <div style={card}>
          <div style={label}>
            Applicants{applications ? ` (${applications.length})` : ''}
          </div>
          {!applications && <div style={{ fontSize: 12, color: C.outline }}>Loading…</div>}
          {applications?.length === 0 && (
            <div style={{ fontSize: 12, color: C.outline }}>No applications yet.</div>
          )}
          {applications?.map((a) => (
            <div key={a.id} style={{ padding: '9px 0', borderTop: `1px solid ${C.border}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, color: C.text, fontWeight: 600 }}>
                  @{a.username}
                  {a.status === 'CONFIRMED' && (
                    <span style={{ marginLeft: 6, fontSize: 10, color: C.accent }}>CONFIRMED</span>
                  )}
                  {a.status === 'REJECTED' && (
                    <span style={{ marginLeft: 6, fontSize: 10, color: C.outline }}>passed</span>
                  )}
                </div>
                <div style={{ fontSize: 11, color: C.outline }}>
                  {(a.followers_count ?? 0).toLocaleString()} followers · {a.completed_deals} completed
                </div>
              </div>
              {a.status === 'APPLIED' && status === 'OPEN' && (
                <>
                  {/* Look before you choose: this is a decision about who gets paid. */}
                  <button
                    onClick={() => setOpenResume((v) => (v === a.username ? null : a.username))}
                    aria-expanded={openResume === a.username}
                    style={{ ...btn(false, false), padding: '7px 11px', fontSize: 12 }}
                  >
                    {openResume === a.username ? 'Hide' : 'History'}
                  </button>
                  <button
                    disabled={!!busy}
                    onClick={() =>
                      run('confirm', () => decideApplication(a.id, 'confirm'), `Confirmed @${a.username}.`)
                        .then(loadApplications)
                    }
                    style={{ ...btn(true, !!busy), padding: '7px 11px', fontSize: 12 }}
                  >
                    Confirm
                  </button>
                  <button
                    disabled={!!busy}
                    onClick={() =>
                      run('reject', () => decideApplication(a.id, 'reject')).then(loadApplications)
                    }
                    style={{ ...btn(false, !!busy), padding: '7px 11px', fontSize: 12 }}
                  >
                    Pass
                  </button>
                </>
              )}
              </div>
              {openResume === a.username && <CreatorResume username={a.username} />}
            </div>
          ))}
          {status === 'OPEN' && (applications?.length ?? 0) > 0 && (
            <div style={{ marginTop: 8, fontSize: 11, color: C.outline }}>
              Confirming one creator closes the deal to everyone else.
            </div>
          )}
        </div>
      )}

      {/* ---- BRAND: the commission, via Razorpay ------------------------- */}
      {viewer === 'brand' && status === 'CONFIRMED' && (
        <div style={card}>
          <div style={label}>Step 1 of 3 — commission</div>
          <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 10 }}>
            {money(F.commissionTotal)} to ValueSkins. Non-refundable once paid, and the deal can no
            longer be cancelled.
          </div>
          <button
            disabled={!!busy || confirming}
            onClick={() => pay('commission', 'Commission')}
            style={btn(true, !!busy || confirming)}
          >
            {confirming ? 'Confirming…' : busy ? 'Opening checkout…' : `Pay ${money(F.commissionTotal)}`}
          </button>
        </div>
      )}

      {/* ---- The advance and final go direct, brand UPI to creator UPI ----
           Razorpay cannot move this money for us: Route needs ₹40L of turnover
           and RazorpayX needs a current account. So the creator's share never
           passes through ValueSkins, and the creator's own confirmation is what
           advances the deal. */}
      {(status === 'COMMISSION_PAID' || status === 'APPROVED_FOR_FINAL_PAYMENT') && (
        <DirectPaymentPanel dealId={dealId} viewer={viewer} onChanged={onChanged} />
      )}

      {/* ---- CREATOR: deliver --------------------------------------------- */}
      {viewer === 'creator' && isConfirmedCreator &&
        (status === 'ADVANCE_PAID' || status === 'REVISION_REQUESTED') && (
          <div style={card}>
            <div style={label}>
              {status === 'REVISION_REQUESTED' ? 'Changes requested' : 'Deliver your content'}
            </div>
            {status === 'REVISION_REQUESTED' && feedback && (
              <div
                style={{
                  background: withAlpha(C.warning, 0x14),
                  border: `1px solid ${C.warning}`,
                  borderRadius: 8, padding: 10, marginBottom: 10,
                  fontSize: 12, color: C.text,
                }}
              >
                {feedback}
              </div>
            )}
            <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 8 }}>
              Paste a Google Drive link. Make sure the brand can open it.
            </div>
            <input
              value={linkInput}
              onChange={(e) => setLinkInput(e.target.value)}
              placeholder="https://drive.google.com/file/d/…"
              aria-label="Google Drive link"
              style={{ ...input, marginBottom: 10 }}
            />
            <button
              disabled={!!busy || !linkInput.trim()}
              onClick={() =>
                run('upload', () => uploadContent(dealId, linkInput.trim()), 'Content sent for review.')
                  .then((ok) => { if (ok) setLinkInput(''); })
              }
              style={btn(true, !!busy || !linkInput.trim())}
            >
              {busy === 'upload' ? 'Submitting…' : 'Submit for review'}
            </button>
          </div>
        )}

      {/* ---- BRAND: review ------------------------------------------------ */}
      {viewer === 'brand' && status === 'CONTENT_UPLOADED' && (
        <div style={card}>
          <div style={label}>Review the content</div>
          {contentLink && (
            <a
              href={contentLink}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: 12, color: C.primary, wordBreak: 'break-all', display: 'block', marginBottom: 12 }}
            >
              {contentLink}
            </a>
          )}
          <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 6 }}>
            Ask for changes, or approve to release the final payment.
          </div>
          <textarea
            value={feedbackInput}
            onChange={(e) => setFeedbackInput(e.target.value)}
            placeholder="What needs changing?"
            aria-label="Revision feedback"
            rows={3}
            style={{ ...input, marginBottom: 10, resize: 'vertical' }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              disabled={!!busy || !feedbackInput.trim()}
              onClick={() =>
                run('revise', () => requestRevision(dealId, feedbackInput.trim()), 'Changes requested.')
                  .then((ok) => { if (ok) setFeedbackInput(''); })
              }
              style={{ ...btn(false, !!busy || !feedbackInput.trim()), flex: 1 }}
            >
              Request changes
            </button>
            <button
              disabled={!!busy}
              onClick={() => run('approve', () => approveContent(dealId), 'Approved. Pay the remaining 70% to finish.')}
              style={{ ...btn(true, !!busy), flex: 1 }}
            >
              {busy === 'approve' ? 'Approving…' : 'Approve'}
            </button>
          </div>
        </div>
      )}

      {/* ---- Completed: the report ---------------------------------------- */}
      {status === 'COMPLETED' && (
        <div style={card}>
          <div style={label}>Deal report</div>
          <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 10 }}>
            The agreed terms, all three invoices and the delivery proof, as one PDF.
          </div>
          <a
            href={`/api/deals/${dealId}/download-adp`}
            style={{ ...btn(true), display: 'inline-block', textDecoration: 'none' }}
          >
            Download report
          </a>
        </div>
      )}

      {/* ---- BRAND: cancel, only while it is still allowed ----------------- */}
      {viewer === 'brand' && canCancelDeal(status) && (
        <div style={card}>
          <div style={label}>Cancel</div>
          <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 10 }}>
            You can cancel free of charge until the commission is paid. After that the deal must run to completion.
          </div>
          <button
            disabled={!!busy}
            onClick={() => {
              if (!window.confirm('Cancel this deal? Applicants will be released.')) return;
              void run('cancel', () => cancelDeal(dealId, 'Cancelled by brand'), 'Deal cancelled.');
            }}
            style={{ ...btn(false, !!busy), color: C.error, borderColor: C.error }}
          >
            {busy === 'cancel' ? 'Cancelling…' : 'Cancel deal'}
          </button>
        </div>
      )}
    </div>
  );
}
