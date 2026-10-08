'use client';
import { useState } from 'react';
import MarketplaceLayout from '@/components/MarketplaceLayout';

const C = {
  bg: 'var(--c-bg)', surface: '#111827', surfaceAlt: '#1A1A1A',
  text: '#E0E0DA', textMuted: 'var(--c-text-variant)', primary: 'var(--c-accent)',
  success: 'var(--c-accent)', border: '#1A1A1A',
};

const FAQS = [
  {
    q: 'What is ValueSkins?',
    a: 'ValueSkins is a marketplace connecting brands with creators. Brands post campaigns and deals; creators apply, deliver content, and get paid through our secure escrow system.',
  },
  {
    q: 'How does payment work?',
    a: 'Brands fund escrow before work starts. Once deliverables are approved, payment is released to the creator. The platform deducts a small service fee from each transaction.',
  },
  {
    q: 'What is a ValueSkin?',
    a: 'A ValueSkin is your professional identity on the platform, it represents your niche, style, and value tier. Creators choose a Skin during onboarding; brands use it to discover talent.',
  },
  {
    q: 'How are creators matched to brands?',
    a: 'Our algorithm considers your ValueSkin, niche, follower count, engagement rate, past deal performance, and platform presence. Brands can also search and invite creators directly.',
  },
  {
    q: 'What fees does ValueSkins charge?',
    a: 'Platform fees vary by deal size and creator tier. The exact percentage is displayed before you accept a deal. There are no fees to browse or apply.',
  },
  {
    q: 'How do I get verified as a brand?',
    a: 'Submit your business details and domain from the brand registration page. Our team reviews and verifies within 1-3 business days. Verified brands get a badge on their profile.',
  },
  {
    q: 'Can I cancel a deal?',
    a: 'Deals can be cancelled by mutual agreement before escrow is funded. After funding, the escrow terms apply. Contact support if you need assistance.',
  },
  {
    q: 'Is my data secure?',
    a: 'Yes. We encrypt data in transit and at rest. We never share your personal data with third parties. See our privacy policy for full details.',
  },
  {
    q: 'How do I export my data?',
    a: 'Go to Account > Data to request a full export of your data. We deliver a JSON file with all your information within 48 hours.',
  },
  {
    q: 'How do I delete my account?',
    a: 'Go to Account > Data and click "Delete Account". Your data is permanently removed within 30 days per GDPR requirements.',
  },
];

export default function HelpPage() {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  return (
    <MarketplaceLayout title="Help Center" hideBottomNav>
      <div style={{ padding: '16px', color: C.text, fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif" }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '4px' }}>Help Center</h1>
        <p style={{ fontSize: '13px', color: C.textMuted, marginBottom: '20px' }}>Frequently asked questions about using ValueSkins.</p>

        <div style={{ display: 'grid', gap: '4px' }}>
          {FAQS.map((faq, i) => (
            <div key={i} style={{ background: C.surface, borderRadius: '8px', border: `1px solid ${C.border}`, overflow: 'hidden' }}>
              <button onClick={() => setOpenIdx(openIdx === i ? null : i)}
                style={{ width: '100%', padding: '14px 16px', background: 'none', border: 'none', color: C.text, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '14px', fontWeight: 600, textAlign: 'left' }}>
                {faq.q}
                <span style={{ color: C.primary, transform: openIdx === i ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', fontSize: '12px' }}>-</span>
              </button>
              {openIdx === i && (
                <div style={{ padding: '0 16px 14px', fontSize: '13px', color: C.textMuted, lineHeight: 1.6 }}>{faq.a}</div>
              )}
            </div>
          ))}
        </div>

        <div style={{ textAlign: 'center', padding: '24px', color: C.textMuted, fontSize: '13px' }}>
          Need more help? <a href="mailto:valueskinsfounder@gmail.com" style={{ color: C.primary }}>Contact us</a>
        </div>
      </div>
    </MarketplaceLayout>
  );
}
