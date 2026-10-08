// Post a deal.
//
// Instagram only, so there is no platform or format choice to make. Deliverables
// are counted instead: a collab is "2 reels and 1 story", not one dropdown value.
//
// Two dates are asked for, because those are the two a brand actually has in
// mind: when the content must be approved, and when it goes live. The
// application deadline is derived from them rather than being a third field,
// since whoever is picked needs time left to shoot.
//
// Styled from the theme tokens. It previously used #f5f5f5 panels, #999 text and
// a #007AFF button, so the payment breakdown dissolved into the themed
// background and that blue is not in the brand palette.
import type { GetServerSidePropsContext } from 'next';
import { useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { C, withAlpha } from '@/theme/colors';
import { createDeal, financials, isOk } from '@/lib/deal-api';

export async function getServerSideProps(ctx: GetServerSidePropsContext) {
  const { getSessionUserId } = await import('@/lib/session');
  const { queryOne } = await import('@/lib/db');
  const userId = await getSessionUserId(ctx.req.headers.cookie || '');
  if (!userId) {
    return { redirect: { destination: '/auth/login', permanent: false } };
  }
  const row = await queryOne('SELECT role, email FROM users WHERE id = $1', [userId]);
  // No email, no marketplace: it is the contact shown to the other party.
  if (!(row as any)?.email) {
    return { redirect: { destination: '/settings/email', permanent: false } };
  }
  // Brand surface. A creator could otherwise fill in this whole form and only
  // discover at submit that they cannot post deals.
  if ((row as any)?.role !== 'brand') {
    return { redirect: { destination: '/deals/browse', permanent: false } };
  }
  return { props: {} };
}

// Instagram's actual content types. A collab is usually several of them.
const DELIVERABLE_KINDS = [
  { key: 'reels', label: 'Reels', hint: 'Short video' },
  { key: 'posts', label: 'Posts', hint: 'Single image' },
  { key: 'carousels', label: 'Carousels', hint: 'Multi-image post' },
  { key: 'stories', label: 'Stories', hint: 'Live for 24 hours' },
] as const;

type DeliverableKey = (typeof DELIVERABLE_KINDS)[number]['key'];

const iso = (d: string) => new Date(`${d}T12:00:00`).toISOString();
const todayPlus = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

export default function CreateCampaign() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [budget, setBudget] = useState(10000);
  const [requirements, setRequirements] = useState('');
  const [script, setScript] = useState('');
  const [counts, setCounts] = useState<Record<DeliverableKey, number>>({
    reels: 1, posts: 0, carousels: 0, stories: 0,
  });
  const [approvalDate, setApprovalDate] = useState(todayPlus(14));
  const [postingDate, setPostingDate] = useState(todayPlus(21));

  const F = financials(budget);
  const totalItems = Object.values(counts).reduce((a, b) => a + b, 0);

  const deliverableSummary = DELIVERABLE_KINDS
    .filter((k) => counts[k.key] > 0)
    .map((k) => `${counts[k.key]} ${counts[k.key] === 1 ? k.label.replace(/s$/, '') : k.label}`)
    .join(', ');

  function bump(key: DeliverableKey, by: number) {
    setCounts((c) => ({ ...c, [key]: Math.max(0, Math.min(20, c[key] + by)) }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (totalItems === 0) {
      setError('Add at least one deliverable.');
      return;
    }
    const approval = new Date(`${approvalDate}T12:00:00`);
    const posting = new Date(`${postingDate}T12:00:00`);
    if (approval.getTime() <= Date.now()) {
      setError('The approval date must be in the future.');
      return;
    }
    if (posting.getTime() < approval.getTime()) {
      setError('Content cannot be posted before it is approved.');
      return;
    }

    // Applications close partway to the approval date, so whoever is picked has
    // time left to make the content. Asking the brand for a third date would be
    // asking them to solve that themselves.
    const now = Date.now();
    const applicationClose = new Date(now + Math.max((approval.getTime() - now) * 0.35, 86400000));
    if (applicationClose.getTime() >= approval.getTime()) {
      setError('Set the approval date at least two days out, so creators have time to apply.');
      return;
    }

    const description = [
      `Deliverables: ${deliverableSummary}`,
      requirements && `Brief:\n${requirements}`,
      script && `Script / direction:\n${script}`,
      `Approved by: ${approval.toDateString()}`,
      `Posted by: ${posting.toDateString()}`,
    ].filter(Boolean).join('\n\n');

    setLoading(true);
    const res = await createDeal({
      title: title.trim(),
      description,
      budget: Number(budget),
      application_deadline: applicationClose.toISOString(),
      content_upload_deadline: iso(approvalDate),
      deal_deadline: iso(postingDate),
      publish: true,
    });
    setLoading(false);

    if (!isOk(res)) {
      setError(res.error);
      return;
    }
    router.push(`/deals/${res.data.deal_id}`);
  }

  const field: React.CSSProperties = { marginBottom: 20 };
  const lbl: React.CSSProperties = {
    display: 'block', fontSize: 12, fontWeight: 600,
    color: C.outline, marginBottom: 6,
  };
  const input: React.CSSProperties = {
    width: '100%', background: C.surfaceAlt, border: `1px solid ${C.border}`,
    borderRadius: 8, color: C.text, padding: '10px 12px', fontSize: 14,
    fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
  };

  return (
    <>
      <Head><title>Post a deal · ValueSkins</title></Head>
      <div style={{ minHeight: '100vh', background: C.bg, color: C.text, padding: '24px 16px 48px' }}>
        <div style={{ maxWidth: 560, margin: '0 auto' }}>
          <button
            onClick={() => router.push('/campaigns')}
            style={{
              background: 'none', border: 'none', color: C.outline,
              fontSize: 12, cursor: 'pointer', padding: 0, marginBottom: 14,
            }}
          >
            ← Your deals
          </button>

          <h1 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 4px' }}>Post a deal</h1>
          <p style={{ fontSize: 12, color: C.outline, margin: '0 0 22px' }}>
            Instagram collabs. The amount you set is final, so creators either apply or they do not.
          </p>

          <form onSubmit={handleSubmit}>
            <div style={field}>
              <label style={lbl} htmlFor="title">Campaign title</label>
              <input
                id="title" value={title} onChange={(e) => setTitle(e.target.value)}
                placeholder="Summer collection launch" required maxLength={200} style={input}
              />
            </div>

            <div style={field}>
              <label style={lbl} htmlFor="budget">Budget (₹)</label>
              <input
                id="budget" type="number" value={budget}
                onChange={(e) => setBudget(parseFloat(e.target.value) || 0)}
                min={1000} max={1000000} required style={input}
              />
            </div>

            {/* Counts rather than a format dropdown: a collab is normally several items. */}
            <div style={field}>
              <label style={lbl}>Deliverables</label>
              <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden' }}>
                {DELIVERABLE_KINDS.map((k, i) => (
                  <div
                    key={k.key}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '10px 12px', background: C.surface,
                      borderTop: i === 0 ? 'none' : `1px solid ${C.border}`,
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: counts[k.key] > 0 ? 700 : 500 }}>
                        {k.label}
                      </div>
                      <div style={{ fontSize: 11, color: C.outline }}>{k.hint}</div>
                    </div>
                    <button
                      type="button" aria-label={`One fewer ${k.label}`}
                      onClick={() => bump(k.key, -1)}
                      disabled={counts[k.key] === 0}
                      style={{
                        width: 32, height: 32, borderRadius: 6,
                        border: `1px solid ${C.border}`, background: 'transparent',
                        color: C.text, fontSize: 16,
                        cursor: counts[k.key] === 0 ? 'not-allowed' : 'pointer',
                        opacity: counts[k.key] === 0 ? 0.4 : 1,
                      }}
                    >
                      −
                    </button>
                    <div
                      aria-live="polite"
                      style={{
                        minWidth: 26, textAlign: 'center', fontSize: 15,
                        fontWeight: 700, fontVariantNumeric: 'tabular-nums',
                        color: counts[k.key] > 0 ? C.text : C.outline,
                      }}
                    >
                      {counts[k.key]}
                    </div>
                    <button
                      type="button" aria-label={`One more ${k.label}`}
                      onClick={() => bump(k.key, 1)}
                      style={{
                        width: 32, height: 32, borderRadius: 6, border: 'none',
                        background: C.primary, color: C.onPrimary,
                        fontSize: 16, cursor: 'pointer',
                      }}
                    >
                      +
                    </button>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 11, color: totalItems ? C.textMuted : C.error, marginTop: 6 }}>
                {totalItems ? deliverableSummary : 'Add at least one deliverable.'}
              </div>
            </div>

            {/* The two dates a brand actually has in mind. */}
            <div style={field}>
              <label style={lbl}>Timeline</label>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 150 }}>
                  <label htmlFor="approval" style={{ ...lbl, fontSize: 11, marginBottom: 4 }}>
                    Final approval by
                  </label>
                  <input
                    id="approval" type="date" value={approvalDate}
                    min={todayPlus(2)}
                    onChange={(e) => setApprovalDate(e.target.value)}
                    required style={input}
                  />
                </div>
                <div style={{ flex: 1, minWidth: 150 }}>
                  <label htmlFor="posting" style={{ ...lbl, fontSize: 11, marginBottom: 4 }}>
                    Final posting by
                  </label>
                  <input
                    id="posting" type="date" value={postingDate}
                    min={approvalDate}
                    onChange={(e) => setPostingDate(e.target.value)}
                    required style={input}
                  />
                </div>
              </div>
              <div style={{ fontSize: 11, color: C.outline, marginTop: 6 }}>
                Applications close partway to the approval date, so whoever you pick has time to shoot.
              </div>
            </div>

            <div style={field}>
              <label style={lbl} htmlFor="brief">Brief</label>
              <textarea
                id="brief" value={requirements} onChange={(e) => setRequirements(e.target.value)}
                placeholder="What do you need? Who is it for? What is the key message?"
                required rows={4} style={{ ...input, resize: 'vertical' }}
              />
            </div>

            <div style={field}>
              <label style={lbl} htmlFor="script">Script or direction (optional)</label>
              <textarea
                id="script" value={script} onChange={(e) => setScript(e.target.value)}
                placeholder="Talking points, product demo notes, anything to avoid"
                rows={3} style={{ ...input, resize: 'vertical' }}
              />
            </div>

            {/* Themed, with an accent border so it reads as a panel instead of
                dissolving into the page as the old #f5f5f5 block did. */}
            <div
              style={{
                background: withAlpha(C.primary, 0x12),
                border: `1px solid ${C.accent}`,
                borderRadius: 10, padding: 16, marginBottom: 22,
              }}
            >
              <div
                style={{
                  fontSize: 11, fontWeight: 700, color: C.text,
                  textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 12,
                }}
              >
                Payment breakdown
              </div>
              {([
                ['Total budget', `₹${budget.toLocaleString('en-IN')}`, true],
                ['ValueSkins commission', `₹${F.commissionTotal.toLocaleString('en-IN')}`, false],
                ['Creator gets', `₹${F.creatorTotal.toLocaleString('en-IN')}`, true],
              ] as [string, string, boolean][]).map(([k, v, strong]) => (
                <div
                  key={k}
                  style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}
                >
                  <span style={{ color: C.textMuted }}>{k}</span>
                  <span style={{ color: C.text, fontWeight: strong ? 700 : 500 }}>{v}</span>
                </div>
              ))}
              <div style={{ borderTop: `1px solid ${C.border}`, marginTop: 10, paddingTop: 10 }}>
                <div style={{ fontSize: 11, color: C.outline, marginBottom: 6 }}>
                  You pay the creator directly, in two parts
                </div>
                {([
                  ['30% when they start', F.advance],
                  ['70% on your approval', F.final],
                ] as [string, number][]).map(([k, v]) => (
                  <div
                    key={k}
                    style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}
                  >
                    <span style={{ color: C.textMuted }}>{k}</span>
                    <span style={{ color: C.text, fontWeight: 600 }}>
                      ₹{v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {error && (
              <div role="alert" style={{ color: C.error, fontSize: 13, marginBottom: 12 }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || totalItems === 0}
              style={{
                width: '100%', padding: '14px',
                background: loading || totalItems === 0 ? C.border : C.primary,
                color: C.onPrimary, border: 'none', borderRadius: 8,
                fontSize: 15, fontWeight: 700,
                cursor: loading || totalItems === 0 ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? 'Publishing…' : 'Publish deal'}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
