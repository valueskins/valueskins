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
    body: 'We do not use any third-party UPI verification. Please enter your UPI ID carefully, and check the name your UPI app shows before paying. A payment to a wrong UPI ID cannot be recalled.',
  },
  {
    title: 'Cancelling',
    body: 'A brand can cancel a deal at no cost until it pays the fee. After the fee is paid, the deal cannot be cancelled in the app and the fee is not refunded. Creators cannot cancel a deal.',
  },
  {
    title: 'Your profile is entered once',
    body: 'Profile details are saved once. After that only your follower count can be changed on the site. If you made a mistake, email us and we will correct it.',
  },
];

// What the product does not do yet, said up front and kindly. Each of these is
// also reflected in the Terms (section 3) so the two never disagree.
const LIMITS: Array<{ group: string; items: Array<{ title: string; body: string }> }> = [
  {
    group: 'Scope',
    items: [
      {
        title: 'Instagram only, for now',
        body: 'Every social platform needs a different kind of content. We are focused on Instagram deals so that we can do one thing well before adding others.',
      },
      {
        title: 'No niches yet',
        body: 'In this first version we assume creators are open to all kinds of content work. Deals are not sorted by niche, so every creator sees every deal.',
      },
      {
        title: 'India and rupees only',
        body: 'At the moment the service is offered in India, and all amounts are in Indian rupees.',
      },
      {
        title: 'One creator per deal',
        body: 'A deal is between one brand and one creator. We do not yet support campaigns with several creators or creator teams.',
      },
      {
        title: 'Website only',
        body: 'ValueSkins works in your browser. We do not have a mobile app yet.',
      },
      {
        title: 'One login per account',
        body: 'The service is for adults aged 18 and over, and each account has a single login. We do not yet offer team or agency accounts.',
      },
    ],
  },
  {
    group: 'Money and tax',
    items: [
      {
        title: 'We do not hold or protect payments',
        body: 'Brands pay creators directly, and the money never passes through us. This keeps things simple, but it also means we are unable to guarantee or recover a payment for either side. We ask both sides to deal with each other in good faith.',
      },
      {
        title: 'UPI IDs are not verified',
        body: 'We do not currently use any third-party UPI verification. We kindly ask creators to enter their UPI ID carefully, and brands to check the name their UPI app shows before paying.',
      },
      {
        title: 'No GST on creator payments',
        body: 'Payments to creators are plain UPI payments, and we do not issue a GST invoice for them. A creator who is registered for GST would need to raise their own invoice to the brand outside ValueSkins, and a brand is not able to claim input tax credit on a creator payment through us.',
      },
      {
        title: 'Tax deducted at source is not handled',
        body: 'If a brand is required to deduct tax from a payment to a creator, it will need to do that itself. We are not able to do it on its behalf.',
      },
      {
        title: 'One flat fee for every deal',
        body: 'Our fee is the same whatever the size of the deal. We know this is a larger share of a small deal than of a big one.',
      },
    ],
  },
  {
    group: 'Deals',
    items: [
      {
        title: 'Fixed price, no chat',
        body: 'The amount is set by the brand and is not negotiated here. There is no chat on the site. The two sides are welcome to write to each other by email.',
      },
      {
        title: 'Deadlines are a reminder, not a lock',
        body: 'If content is late, we send a reminder. We do not cancel the deal or return money automatically. If a delay becomes a problem, please write to us and a person will look into it.',
      },
      {
        title: 'Usage rights are up to each deal',
        body: 'How a brand may use the content is whatever the deal says. We do not set a standard, so we suggest brands write it clearly and creators read it before applying.',
      },
      {
        title: 'Disagreements are handled by a person',
        body: 'There is no automatic dispute system. If something goes wrong, please email us. Someone will read it and reply to both sides. We will do our best, though we are not able to promise a particular outcome.',
      },
      {
        title: 'We do not store the content',
        body: 'Content is shared as a link that the creator hosts elsewhere. Please keep your own copy.',
      },
      {
        title: 'No results tracking',
        body: 'We do not measure how a post performs once it is live.',
      },
    ],
  },
  {
    group: 'Profiles',
    items: [
      {
        title: 'Follower counts are entered by the user',
        body: 'We do not read follower numbers from Instagram, and we are not able to check them. We trust users to keep theirs honest and current.',
      },
      {
        title: 'Profiles are not verified',
        body: 'We confirm that a person controls the Instagram account they sign in with. We do not check anything else they tell us about themselves.',
      },
      {
        title: 'Profiles are saved once',
        body: 'After saving, only the follower count can be changed on the site. If something was entered by mistake, please email us and we will correct it.',
      },
    ],
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

          <h2 style={h2}>Our drawbacks and assumptions</h2>
          <p style={{ fontSize: 13, color: C.textMuted, lineHeight: 1.6, margin: '0 0 6px' }}>
            We try to do right by both brands and creators, but we are still new. Here is what we
            are not able to offer yet. We would rather you hear it from us now, and we plan to
            improve each of these as we grow. Thank you for your patience.
          </p>
          {LIMITS.map((g) => (
            <div key={g.group}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.outline, textTransform: 'uppercase', letterSpacing: '0.6px', margin: '20px 0 8px' }}>
                {g.group}
              </div>
              {g.items.map((r) => (
                <div key={r.title} style={card}>
                  <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{r.title}</div>
                  <div style={{ fontSize: 13, color: C.textMuted, lineHeight: 1.6 }}>{r.body}</div>
                </div>
              ))}
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
