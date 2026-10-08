'use client';
import Link from 'next/link';

const C = {
  bg: '#0A0A0A',
  surface: 'rgba(10, 10, 10, 0.86)',
  border: 'rgba(184, 180, 172, 0.18)',
  text: '#F5F5F0',
  textSecondary: '#B8B4AC',
  primary: '#C8B89A',
};

const sections = [
  {
    title: 'Legal Documents',
    items: [
      { href: '/legal/terms', label: 'Terms of Service', desc: 'Rules governing your use of the platform, liability limits, and dispute resolution.' },
      { href: '/legal/privacy', label: 'Privacy Policy', desc: 'How we collect, process, store, and protect your personal data.' },
      { href: '/legal/refund', label: 'Refund & Cancellation Policy', desc: 'How cancellations and refunds work on the platform.' },
      { href: '/legal/cookies', label: 'Cookie Policy', desc: 'How we use cookies and similar tracking technologies.' },
    ],
  },
  {
    title: 'Your Rights',
    items: [
      { href: '/legal/about', label: 'About ValueSkins', desc: 'What we do, how it works, and company information.' },
      { href: '/legal/contact', label: 'Contact Us', desc: 'Get in touch with our team.' },
      { href: '/legal/data-request', label: 'Data Access & Export', desc: 'Request access to your data or export it (GDPR/CCPA).' },
      { href: '/legal/grievance', label: 'Grievance Officer', desc: 'Contact our Grievance Officer under IT Act and DPDP Act.' },
      { href: '/account/settings', label: 'Delete My Account', desc: 'Request permanent deletion of your account and data.' },
    ],
  },
  {
    title: 'Compliance',
    items: [
      { href: '/legal/grievance', label: 'India (DPDP Act, IT Act)', desc: 'Compliance with India\'s Digital Personal Data Protection Act, 2023 and Information Technology Act, 2000.' },
      { href: '/legal/privacy', label: 'GDPR (Europe)', desc: 'Your rights under the General Data Protection Regulation if you are in the EU/EEA.' },
      { href: '/legal/privacy', label: 'CCPA (California)', desc: 'Your rights under the California Consumer Privacy Act if you are a California resident.' },
    ],
  },
];

export default function LegalHub() {
  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, padding: '60px 20px' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <Link href="/" style={{ color: C.primary, textDecoration: 'none', fontSize: '14px', marginBottom: '32px', display: 'inline-block' }}>
          Back to Home
        </Link>

        <h1 style={{ fontSize: '32px', fontWeight: 800, marginBottom: '8px' }}>Legal</h1>
        <p style={{ color: C.textSecondary, marginBottom: '48px', fontSize: '15px' }}>
          Legal documents, privacy information, and your rights as a ValueSkins user.
        </p>

        {sections.map(section => (
          <div key={section.title} style={{ marginBottom: '40px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: C.text, marginBottom: '16px', paddingBottom: '8px', borderBottom: `1px solid ${C.border}` }}>
              {section.title}
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {section.items.map(item => (
                <Link
                  key={item.href + item.label}
                  href={item.href}
                  style={{
                    display: 'block',
                    padding: '16px',
                    background: C.surface,
                    border: `1px solid ${C.border}`,
                    borderRadius: '10px',
                    color: C.text,
                    textDecoration: 'none',
                    transition: 'border-color 0.15s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = C.primary)}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = C.border)}
                >
                  <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '4px', color: C.primary }}>{item.label}</div>
                  <div style={{ fontSize: '13px', color: C.textSecondary, lineHeight: 1.4 }}>{item.desc}</div>
                </Link>
              ))}
            </div>
          </div>
        ))}

        <div style={{ marginTop: '48px', padding: '20px', background: C.surface, border: `1px solid ${C.border}`, borderRadius: '12px' }}>
          <p style={{ fontSize: '13px', color: C.textSecondary, lineHeight: 1.6, margin: 0 }}>
            <strong style={{ color: C.text }}>Questions?</strong> Contact us at{' '}
            <a href="mailto:founder@valueskins.com" style={{ color: C.primary }}>founder@valueskins.com</a>
            {' '}or call{' '}
            <a href="tel:+918805695324" style={{ color: C.primary }}>+91 88056 95324</a>.
            We respond within 24 hours.
          </p>
        </div>
      </div>
    </div>
  );
}
