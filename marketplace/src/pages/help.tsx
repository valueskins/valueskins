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
    a: 'A place where brands post paid deals and creators apply for them. Each deal has one brand, one creator and one fixed amount.',
  },
  {
    q: 'Am I a brand or a creator?',
    a: 'That comes from your Instagram account. A Business account is a brand and posts deals. A Creator account is a creator and applies to deals. The account needs to be public, and personal accounts cannot sign in.',
  },
  {
    q: 'How does payment work?',
    a: 'The brand makes three payments. First a flat fee of ₹750 plus 18% GST (₹885) to ValueSkins through Razorpay. Then 30% of the remaining amount to the creator before work starts, and 70% after the brand approves the content. The two creator payments go directly to the creator by UPI.',
  },
  {
    q: 'Does ValueSkins hold the money?',
    a: 'No. ValueSkins only receives its own fee. The creator is paid directly by the brand.',
  },
  {
    q: 'Can I negotiate the amount?',
    a: 'No. The brand sets the amount when it posts the deal. If it does not work for you, do not apply.',
  },
  {
    q: 'Is my UPI ID verified?',
    a: 'No. We do not use any third-party UPI verification. Enter your UPI ID and the name on the account exactly. Brands should check the name their UPI app shows before paying.',
  },
  {
    q: 'Can I change my profile?',
    a: 'Your profile is saved once. After that only your follower count can be changed.',
  },
  {
    q: 'Can I cancel a deal?',
    a: 'A brand can cancel at no cost until it pays the ValueSkins fee. After that the deal cannot be cancelled in the app and the fee is not refunded. Creators cannot cancel a deal.',
  },
  {
    q: 'How do I delete my account?',
    a: 'Go to Account, then Data, and choose Delete Account. Your data is removed within 30 days.',
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
          Need more help? <a href="mailto:founder@valueskins.com" style={{ color: C.primary }}>Contact us</a>
        </div>
      </div>
    </MarketplaceLayout>
  );
}
