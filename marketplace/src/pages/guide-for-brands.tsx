import Head from 'next/head';
import Link from 'next/link';
import { C } from '@/theme/colors';

// A budgeting reference for brands. Nothing on this page is ValueSkins' own
// figure: every tier, range and percentage is copied from one Indian
// publisher, Kofluence, as it appeared on the date below. When the source is
// updated, update SOURCE and the rows together, and change nothing that the
// source does not say.
const SOURCE = {
  name: 'Kofluence',
  title: 'Micro vs Nano vs Macro Influencers: Which Tier Delivers the Best ROI in 2026',
  url: 'https://www.kofluence.com/?p=68787',
  published: '22 July 2026',
  retrieved: '11 October 2026',
};

const TIERS: Array<{ name: string; followers: string; reel: string; engagement: string }> = [
  { name: 'Nano', followers: '1,000 to 10,000', reel: '₹1,000 to ₹12,000', engagement: '5% to 10%' },
  { name: 'Micro', followers: '10,000 to 100,000', reel: '₹2,000 to ₹80,000', engagement: '3% to 7%' },
  { name: 'Macro', followers: 'Roughly 100,000 to 10 lakh', reel: '₹84,000 to ₹7.9 lakh', engagement: '1% to 3%' },
  { name: 'Mega', followers: 'Above 10 lakh', reel: '₹8 lakh and above', engagement: '0.5% to 1.5%' },
];

const NOTES: Array<{ title: string; body: string }> = [
  {
    title: 'This is only a guide',
    body: 'You decide the amount of your deal. You can offer more than these ranges or less than them. Nothing on ValueSkins checks your amount against this page, and creators are free to apply or not.',
  },
  {
    title: 'These are not our figures',
    body: 'We did not research, calculate or adjust anything here. We are publishing what the source says so that you have one place to look. If the source is wrong, or has changed since the date shown, the source is the one to go by.',
  },
  {
    title: 'The prices are for one Instagram Reel in India',
    body: 'The source gives its ranges in rupees for a single Reel. It does not give separate ranges for feed posts or stories, so none are shown. It also notes that rates vary widely by niche and engagement, that finance and tech creators charge 30% to 50% more than lifestyle creators at every tier, and that GST is added where it applies.',
  },
  {
    title: 'What the source does not publish',
    body: 'The source gives follower ranges, Reel prices and engagement rates. It does not publish retention, watch time or reach for each tier, so none are shown. You can ask a creator for a screenshot of their own Instagram insights before you confirm them.',
  },
  {
    title: 'What your deal amount covers here',
    body: 'On ValueSkins the amount you enter is the whole budget. The ValueSkins fee of ₹750 plus 18% GST comes out of it, and so do digital rights if you ask for them. The source prices a single Reel without those, so keep that in mind when you compare.',
  },
];

export default function GuideForBrandsPage() {
  const h2: React.CSSProperties = { fontSize: 18, fontWeight: 700, color: C.text, margin: '72px 0 24px' };
  const card: React.CSSProperties = {
    background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 28, marginBottom: 20,
  };
  const cell: React.CSSProperties = { padding: '9px 0', borderTop: `1px solid ${C.border}`, fontSize: 15 };
  const link: React.CSSProperties = { color: C.text };

  return (
    <>
      <Head><title>Guide for brands · ValueSkins</title></Head>
      <div style={{ minHeight: '100vh', background: C.bg, color: C.text, padding: '72px 24px 140px' }}>
        <div style={{ maxWidth: 780, margin: '0 auto' }}>
          <h1 style={{ fontSize: 30, fontWeight: 700, margin: '0 0 8px' }}>Guide for brands</h1>
          <p style={{ fontSize: 16, color: C.textMuted, lineHeight: 1.6, margin: 0 }}>
            On ValueSkins the brand sets the final amount of a deal. This page shows how creators
            are usually grouped by follower count and what each group usually charges, so you have
            a reference when you decide your budget.
          </p>

          <div style={{ ...card, marginTop: 32, background: 'var(--c-surface-container)' }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Please read this first</div>
            <div style={{ fontSize: 15, color: C.textMuted, lineHeight: 1.6 }}>
              This is only a guide. You can go above or below it. The figures are not ours: they
              are published by {SOURCE.name}, an Indian influencer marketing company, and we are showing them here as they appear there.
            </div>
          </div>

          <h2 style={h2}>Creator tiers and usual rates</h2>
          {TIERS.map((t) => (
            <div key={t.name} style={card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
                <div style={{ fontSize: 16, fontWeight: 700 }}>{t.name}</div>
                <div style={{ fontSize: 15, color: C.textMuted }}>{t.followers} followers</div>
              </div>
              {[
                ['One Instagram Reel', t.reel],
                ['Engagement rate', t.engagement],
              ].map(([k, v]) => (
                <div key={k} style={{ ...cell, display: 'flex', justifyContent: 'space-between', gap: 16 }}>
                  <span style={{ color: C.textMuted }}>{k}</span>
                  <span style={{ fontWeight: 700, textAlign: 'right' }}>{v}</span>
                </div>
              ))}
            </div>
          ))}
          <p style={{ fontSize: 14, color: C.outline, lineHeight: 1.6, margin: '0 0 0' }}>
            Prices are in rupees for one Instagram Reel. Engagement rate is the share of a
            creator&apos;s followers who like, comment on, save or share a post.
          </p>

          <h2 style={h2}>How to read this</h2>
          {NOTES.map((n) => (
            <div key={n.title} style={card}>
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{n.title}</div>
              <div style={{ fontSize: 15, color: C.textMuted, lineHeight: 1.6 }}>{n.body}</div>
            </div>
          ))}

          <h2 style={h2}>The source</h2>
          <div style={card}>
            <div style={{ fontSize: 15, color: C.textMuted, lineHeight: 1.6 }}>
              Everything in the table above comes from one publisher, {SOURCE.name}. ValueSkins is
              not connected to {SOURCE.name} and did not produce these figures.
            </div>
            <div style={{ ...cell, marginTop: 16 }}>
              <div style={{ color: C.textMuted, marginBottom: 2 }}>Tiers, follower ranges, Reel prices and engagement rates</div>
              <a href={SOURCE.url} target="_blank" rel="noopener noreferrer" style={link}>
                {SOURCE.title}
              </a>
              <div style={{ color: C.textMuted, fontSize: 14 }}>Published by the source on {SOURCE.published}.</div>
            </div>
            <div style={{ ...cell, color: C.textMuted }}>
              We copied these figures on {SOURCE.retrieved}. The source may have changed since.
            </div>
          </div>

          <p style={{ fontSize: 14, color: C.outline, marginTop: 24 }}>
            How deals and payments work is on the{' '}
            <Link href="/how-it-works" style={link}>How it works</Link> page.
          </p>
        </div>
      </div>
    </>
  );
}
