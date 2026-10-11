import Head from 'next/head';
import Link from 'next/link';
import { C } from '@/theme/colors';

// The whole product on one page, in the order it happens. Every figure here is
// the one the server charges: a flat 750 plus 18% GST, then 30% and 70% of
// what is left (see financials() in lib/deal-api).
const STEPS: Array<{ title: string; body: string }> = [
  {
    title: 'Sign in with Instagram',
    body: 'Sign in with your Instagram account. It needs to be public and either a Business account or a Creator account. A Business account is a brand here and posts deals. A Creator account is a creator here and applies to them. We read this from Instagram when you sign in. It is not something you pick, and personal accounts cannot sign in.',
  },
  {
    title: 'Finish Settings',
    body: 'Settings opens with a checklist of what is left to do. Fill in your profile: a creator gives their name, age, gender, city and follower count, and a brand gives its brand name, website, city and follower count. Add your email address and confirm it with the link we send you. Write a few lines about yourself or your brand. Both sides add a UPI ID, typed twice, with the name on the account: a creator the one they want to be paid on, a brand the one it pays from. Until everything on the checklist is done, a brand cannot post a deal and a creator cannot apply to one.',
  },
  {
    title: 'A brand posts a deal',
    body: 'The first question is whether the brand wants digital rights, meaning the right to reuse the content itself, for example on its own pages or in an ad. If yes, the brand writes how, where, when and until when it will use the content, and the amount it enters already includes those rights. There is no separate fee for them. The brand then enters the amount, and the payment breakdown appears as it types. It says how many reels, posts, carousels or stories it needs, and sets the dates.',
  },
  {
    title: 'The brief is written in full',
    body: 'The brand explains what it is promoting, who it is for, the message, the tone, and anything that must or must not appear. It also answers five questions so nothing is left to guess: whether a product will be sent and whether the creator keeps it, where the content will be made, whether travel is provided or repaid, whether other costs are covered, and where the content will be posted. The amount is final. There is no negotiation and no chat.',
  },
  {
    title: 'Creators apply',
    body: 'Current deals lists every open deal. Open Details to read the full brief and every answer before you decide, and hover over the brand\'s name to see who they are. If the amount works for you, apply. If it does not, skip it.',
  },
  {
    title: 'The brand picks one creator',
    body: 'The brand sees each applicant and can hover over a name to see their Instagram page, age, gender, city, followers, why brands should hire them, their past deals and their email address. It confirms one creator, which closes the deal to everyone else. The creator is emailed a copy of the brief, including the digital rights terms.',
  },
  {
    title: 'Payment 1: the ValueSkins fee',
    body: 'The brand pays ValueSkins a flat fee of ₹750 plus 18% GST, which is ₹885, through Razorpay. The fee comes out of the deal amount. It is the only money ValueSkins receives.',
  },
  {
    title: 'Payment 2: 30% to the creator',
    body: 'The brand is shown the creator\'s UPI ID and the name on the account. It can tap Pay in UPI app on a phone, or scan the code from a computer, and the amount is already filled in. Before entering the PIN, the brand checks that its UPI app shows the same name. The brand then enters the UPI reference, and the creator confirms the money arrived.',
  },
  {
    title: 'The creator delivers',
    body: 'The creator makes the content and submits a Google Drive link to it on the deal page before the due date. In Drive, the link has to be set to Anyone with the link. We check that the link opens for everyone before the brand is told, and if it is private we say so straight away so it can be fixed.',
  },
  {
    title: 'The brand reviews',
    body: 'The brand opens the link and either approves the content or writes what it wants changed in the box on the deal page. The creator sees the request there and is emailed it, makes the changes, and submits a new link. This repeats until the brand approves.',
  },
  {
    title: 'Payment 3: 70% to the creator',
    body: 'After approving, the brand pays the remaining 70% the same way, to the same UPI ID. The creator confirms it arrived.',
  },
  {
    title: 'Done',
    body: 'The deal is complete and moves from Current deals to Past deals. Both sides can download the deal report as a PDF from there whenever they want. It records who the two sides were, the brief and the digital rights terms, the amounts, the payments and the dates.',
  },
];

const RULES: Array<{ title: string; body: string }> = [
  {
    title: 'Brands post, creators apply',
    body: 'A brand cannot apply to deals and a creator cannot post them. Which one you are comes from your Instagram account type.',
  },
  {
    title: 'One brand, one creator',
    body: 'Each deal has exactly one brand and one creator.',
  },
  {
    title: 'Digital rights are part of the price',
    body: 'If a deal includes digital rights, the amount already covers them and the brand may use the content only as it wrote in the deal. If a deal does not include them, the brand may not reuse the content beyond the agreed posts.',
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
    title: 'Your email is shared only with the other side of your deals',
    body: 'A brand sees the email of creators who applied to its deals, and a creator sees the email of a brand whose deal they applied to. Nobody else sees it.',
  },
  {
    title: 'Cancelling',
    body: 'A brand can cancel a deal at no cost until it pays the fee. After the fee is paid, the deal cannot be cancelled in the app and the fee is not refunded. Creators cannot cancel a deal.',
  },
  {
    title: 'Your profile is entered once',
    body: 'Profile details are saved once. After that only your follower count can be changed on the site. If you made a mistake, email us and we will correct it.',
  },
  {
    title: 'Changing your email or UPI ID',
    body: 'Both can be changed in Settings. A new email address has to be confirmed with a fresh link before you can pay or change a UPI ID again, and we tell your old address about the change. When a UPI ID is changed we email you to say so.',
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
  const h2: React.CSSProperties = { fontSize: 18, fontWeight: 700, color: C.text, margin: '72px 0 24px' };
  const card: React.CSSProperties = {
    background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 28, marginBottom: 20,
  };
  const cell: React.CSSProperties = { padding: '9px 0', borderTop: `1px solid ${C.border}`, fontSize: 15 };

  return (
    <>
      <Head><title>How it works · ValueSkins</title></Head>
      <div style={{ minHeight: '100vh', background: C.bg, color: C.text, padding: '72px 24px 140px' }}>
        <div style={{ maxWidth: 780, margin: '0 auto' }}>
          <h1 style={{ fontSize: 30, fontWeight: 700, margin: '0 0 8px' }}>How it works</h1>
          <p style={{ fontSize: 16, color: C.textMuted, lineHeight: 1.6, margin: 0 }}>
            Brands post paid deals. Creators apply. The amount is fixed, and the creator is paid
            directly.
          </p>

          <h2 style={h2}>Step by step</h2>
          {STEPS.map((s, i) => (
            <div key={s.title} style={{ ...card, display: 'flex', gap: 14 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.accent, minWidth: 22 }}>
                {String(i + 1).padStart(2, '0')}
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{s.title}</div>
                <div style={{ fontSize: 15, color: C.textMuted, lineHeight: 1.6 }}>{s.body}</div>
              </div>
            </div>
          ))}

          <h2 style={h2}>An example</h2>
          <div style={card}>
            <div style={{ fontSize: 15, color: C.textMuted, lineHeight: 1.6, marginBottom: 20 }}>
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
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{r.title}</div>
              <div style={{ fontSize: 15, color: C.textMuted, lineHeight: 1.6 }}>{r.body}</div>
            </div>
          ))}

          <h2 style={h2}>Our drawbacks and assumptions</h2>
          <p style={{ fontSize: 15, color: C.textMuted, lineHeight: 1.6, margin: '0 0 6px' }}>
            We try to do right by both brands and creators, but we are still new. Here is what we
            are not able to offer yet. We would rather you hear it from us now, and we plan to
            improve each of these as we grow. Thank you for your patience.
          </p>
          {LIMITS.map((g) => (
            <div key={g.group}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.outline, textTransform: 'uppercase', letterSpacing: '0.6px', margin: '20px 0 8px' }}>
                {g.group}
              </div>
              {g.items.map((r) => (
                <div key={r.title} style={card}>
                  <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{r.title}</div>
                  <div style={{ fontSize: 15, color: C.textMuted, lineHeight: 1.6 }}>{r.body}</div>
                </div>
              ))}
            </div>
          ))}

          <h2 style={h2}>If something goes wrong</h2>
          <div style={card}>
            <div style={{ fontSize: 15, color: C.textMuted, lineHeight: 1.6 }}>
              Email{' '}
              <a href="mailto:founder@valueskins.com" style={{ color: C.text }}>founder@valueskins.com</a>{' '}
              with the deal and what happened. A person reads it and replies to both sides.
              Or text us on WhatsApp at{' '}
              <a
                href="https://wa.me/918805695324" target="_blank" rel="noopener noreferrer"
                style={{ color: C.text }}
              >
                88056 95324
              </a>.
            </div>
          </div>

          <p style={{ fontSize: 14, color: C.outline, marginTop: 24 }}>
            The full terms are in the <Link href="/legal/terms" style={{ color: C.text }}>Terms of Service</Link>.
          </p>
        </div>
      </div>
    </>
  );
}
