import Head from 'next/head';
import Link from 'next/link';
import { C } from '@/theme/colors';

// The whole product on one page, in the order it happens. Every figure here is
// the one the server charges: a flat 750 plus 18% GST, then 30% and 70% of
// what is left (see financials() in lib/deal-api).
const STEPS: Array<{ title: string; body: string }> = [
  {
    title: 'Sign in and set up',
    body: 'Sign in with Instagram. Add your email address, which is how the other side of a deal reaches you. Fill in your profile once in Settings. Creators also add the UPI ID they want to be paid on.',
  },
  {
    title: 'A brand posts a deal',
    body: 'The brand writes what it needs, sets the amount, the last date to apply and the date the content is due. The amount is final. There is no negotiation and no chat.',
  },
  {
    title: 'Creators apply',
    body: 'Every creator sees every open deal. If the amount works for you, apply. If it does not, skip it.',
  },
  {
    title: 'The brand picks one creator',
    body: 'The brand sees each applicant and can hover over a name to see their Instagram, age, gender, city, followers and past deals. It confirms one creator. That closes the deal to everyone else.',
  },
  {
    title: 'Payment 1: the ValueSkins fee',
    body: 'The brand pays ValueSkins a flat fee of ₹750 plus 18% GST, which is ₹885, through Razorpay. The fee comes out of the deal amount. It is the only money ValueSkins receives.',
  },
  {
    title: 'Payment 2: 30% to the creator',
    body: 'The brand pays the creator 30% of the remaining amount, straight to the creator\'s UPI ID. The brand enters the UPI reference, and the creator confirms the money arrived.',
  },
  {
    title: 'The creator delivers',
    body: 'The creator makes the content and shares a link to it on the deal page before the due date.',
  },
  {
    title: 'The brand reviews',
    body: 'The brand either approves the content or writes what should change. If changes are asked for, the creator shares a new link.',
  },
  {
    title: 'Payment 3: 70% to the creator',
    body: 'After approving, the brand pays the remaining 70% to the same UPI ID. The creator confirms it arrived.',
  },
  {
    title: 'Done',
    body: 'The deal is complete. Both sides can download a PDF record of the deal: who, what, how much and when.',
  },
];

const RULES: Array<{ title: string; body: string }> = [
  {
    title: 'One brand, one creator',
    body: 'Each deal has exactly one brand and one creator.',
  },
  {
    title: 'We never hold the creator\'s money',
    body: 'The 30% and the 70% go directly from the brand to the creator by UPI. ValueSkins only receives its own fee.',
  },
  {
    title: 'UPI IDs are not verified',
    body: 'We do not use any third-party UPI verification. Creators must enter their UPI ID correctly. Brands must check the name their UPI app shows before paying. A payment to a wrong UPI ID cannot be recalled.',
  },
  {
    title: 'Cancelling',
    body: 'A brand can cancel a deal at no cost until it pays the fee. After the fee is paid, the deal cannot be cancelled in the app and the fee is not refunded. Creators cannot cancel a deal.',
  },
  {
    title: 'Your profile is entered once',
    body: 'Profile details are saved once and cannot be changed later, except your follower count.',
  },
];

export default function HowItWorksPage() {
  const h2: React.CSSProperties = { fontSize: 16, fontWeight: 700, color: C.text, margin: '36px 0 14px' };
  const card: React.CSSProperties = {
    background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, marginBottom: 10,
  };
  const cell: React.CSSProperties = { padding: '9px 0', borderTop: `1px solid ${C.border}`, fontSize: 13 };

  return (
    <>
      <Head><title>How it works · ValueSkins</title></Head>
      <div style={{ minHeight: '100vh', background: C.bg, color: C.text, padding: '28px 16px 64px' }}>
        <div style={{ maxWidth: 640, margin: '0 auto' }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 8px' }}>How it works</h1>
          <p style={{ fontSize: 14, color: C.textMuted, lineHeight: 1.6, margin: 0 }}>
            Brands post paid deals. Creators apply. The amount is fixed, and the creator is paid
            directly.
          </p>

          <h2 style={h2}>Step by step</h2>
          {STEPS.map((s, i) => (
            <div key={s.title} style={{ ...card, display: 'flex', gap: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.accent, minWidth: 22 }}>
                {String(i + 1).padStart(2, '0')}
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{s.title}</div>
                <div style={{ fontSize: 13, color: C.textMuted, lineHeight: 1.6 }}>{s.body}</div>
              </div>
            </div>
          ))}

          <h2 style={h2}>An example</h2>
          <div style={card}>
            <div style={{ fontSize: 13, color: C.textMuted, lineHeight: 1.6, marginBottom: 10 }}>
              A brand posts a deal for ₹10,000.
            </div>
            {[
              ['ValueSkins fee (₹750 plus 18% GST)', '₹885.00'],
              ['Left for the creator', '₹9,115.00'],
              ['Paid before work starts (30%)', '₹2,734.50'],
              ['Paid after approval (70%)', '₹6,380.50'],
            ].map(([k, v]) => (
              <div key={k} style={{ ...cell, display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <span style={{ color: C.textMuted }}>{k}</span>
                <span style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{v}</span>
              </div>
            ))}
          </div>

          <h2 style={h2}>The rules</h2>
          {RULES.map((r) => (
            <div key={r.title} style={card}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{r.title}</div>
              <div style={{ fontSize: 13, color: C.textMuted, lineHeight: 1.6 }}>{r.body}</div>
            </div>
          ))}

          <h2 style={h2}>If something goes wrong</h2>
          <div style={card}>
            <div style={{ fontSize: 13, color: C.textMuted, lineHeight: 1.6 }}>
              Email{' '}
              <a href="mailto:founder@valueskins.com" style={{ color: C.text }}>founder@valueskins.com</a>{' '}
              with the deal and what happened. A person reads it and replies to both sides.
            </div>
          </div>

          <p style={{ fontSize: 12, color: C.outline, marginTop: 24 }}>
            The full terms are in the <Link href="/legal/terms" style={{ color: C.text }}>Terms of Service</Link>.
          </p>
        </div>
      </div>
    </>
  );
}
