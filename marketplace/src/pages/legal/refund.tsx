'use client';
import Link from 'next/link';

const C = { bg: '#0A0A0A', text: '#F5F5F0', textSecondary: '#B8B4AC', primary: '#C8B89A' };

const EMAIL = 'founder@valueskins.com';

function H({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{ fontSize: '20px', fontWeight: 700, color: C.text, marginTop: '24px', marginBottom: '12px' }}>
      {children}
    </h2>
  );
}

function Mail() {
  return <a href={`mailto:${EMAIL}`} style={{ color: C.primary }}>{EMAIL}</a>;
}

export default function RefundPolicy() {
  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, padding: '60px 20px' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <Link href="/" style={{ color: C.primary, textDecoration: 'none', fontSize: '14px', marginBottom: '32px', display: 'inline-block' }}>Back</Link>
        <h1 style={{ fontSize: '32px', fontWeight: 800, marginBottom: '12px' }}>Refund and Cancellation Policy</h1>
        <p style={{ color: C.textSecondary, marginBottom: '40px' }}>Effective: October 8, 2026</p>
        <div style={{ lineHeight: '1.8', color: C.textSecondary }}>

          <p>This policy forms part of our <Link href="/legal/terms" style={{ color: C.primary }}>Terms of Service</Link>. Words defined there have the same meaning here.</p>

          <H>1. What You Pay ValueSkins</H>
          <p>The only payment ValueSkins receives is its fee: 750 rupees plus Goods and Services Tax at the applicable rate (currently 18%, making 885 rupees) for each Deal. The Brand pays it through our payment processor after confirming a Creator.</p>
          <p>Signing up, browsing, and applying are free. There is nothing else to refund.</p>

          <H>2. Cancelling a Deal</H>
          <p><strong>Before the fee is paid:</strong> A Brand may cancel a Deal at no cost.</p>
          <p><strong>After the fee is paid:</strong> The Deal cannot be cancelled through the Platform.</p>
          <p><strong>Creators:</strong> A Creator cannot cancel a Deal through the Platform after being confirmed. A Creator who cannot carry out a Deal must tell the Brand and us by email without delay.</p>

          <H>3. Refund of the Fee</H>
          <p>The fee pays for the use of the Platform to post a Deal, receive applications, and confirm a Creator. That service has been provided by the time the fee is paid, so the fee is not refundable once paid, except in the cases below.</p>
          <p>We will refund the fee in full where:</p>
          <ul style={{ paddingLeft: '20px', marginBottom: '12px' }}>
            <li>the fee was charged more than once for the same Deal;</li>
            <li>the fee was charged because of a technical error on our side; or</li>
            <li>a refund is required by applicable law.</li>
          </ul>
          <p><strong>How to ask:</strong> Email <Mail /> with the Deal and the payment reference. We will acknowledge your request within 24 hours and decide it within 15 days.</p>
          <p><strong>How a refund is paid:</strong> An approved refund is sent to the original payment method through our payment processor. It usually reaches you within 5 to 7 working days, depending on your bank.</p>

          <H>4. Payments Made to a Creator</H>
          <p>A Brand pays the Creator directly by UPI. That money does not pass through ValueSkins. We do not hold it, and we cannot refund, reverse, or recover it.</p>
          <p>If a Brand has paid a Creator and the Deal does not go ahead, or the Brand believes the content was not delivered as agreed, the return of that money is a matter between the Brand and the Creator. Either may email <Mail /> and we will review the Deal record as described in the Terms of Service, but we do not guarantee any outcome and we do not compensate either party.</p>
          <p>A UPI payment sent to an incorrect UPI ID cannot be recalled by ValueSkins. The Brand should contact its own bank or UPI application without delay.</p>

          <H>5. Chargebacks</H>
          <p>If you believe the fee was charged in error, please email us first so that we can put it right. If a chargeback is raised with a bank or card issuer for a fee that was correctly charged, we will provide the Deal record to our payment processor to contest it, and we may suspend the account while it is reviewed.</p>

          <H>6. Contact</H>
          <p>Questions about this policy: <Mail /> or <a href="tel:+918805695324" style={{ color: C.primary }}>+91 88056 95324</a>.</p>

        </div>
      </div>
    </div>
  );
}
