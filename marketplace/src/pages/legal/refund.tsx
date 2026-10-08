'use client';
import Link from 'next/link';
const C = { bg: '#0A0A0A', text: '#F5F5F0', textSecondary: '#B8B4AC', primary: '#C8B89A' };
export default function RefundPolicy() {
  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, padding: '60px 20px' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <Link href="/" style={{ color: C.primary, textDecoration: 'none', fontSize: '14px', marginBottom: '32px', display: 'inline-block' }}>← Back</Link>
        <h1 style={{ fontSize: '32px', fontWeight: 800, marginBottom: '12px' }}>Refund & Cancellation Policy</h1>
        <p style={{ color: C.textSecondary, marginBottom: '40px' }}>Effective: July 11, 2026</p>
        <div style={{ lineHeight: '1.8', color: C.textSecondary }}>

          <h2 style={{ fontSize: '20px', fontWeight: 700, color: C.text, marginTop: '24px', marginBottom: '12px' }}>No Refunds</h2>
          <p>All purchases and payments on ValueSkins are final. <strong style={{ color: C.text }}>We do not offer refunds of any kind.</strong></p>
          <p>This applies to:</p>
          <p>• <strong style={{ color: C.text }}>ValueSkin purchases.</strong> All ValueSkin purchases are non-refundable. Once a ValueSkin is purchased, the transaction cannot be reversed.</p>
          <p>• <strong style={{ color: C.text }}>Escrow payments.</strong> All funds deposited into escrow for a Deal are non-refundable once the Deal is funded. Escrow fund releases are governed solely by the Deal terms agreed between the Creator and Brand.</p>
          <p>• <strong style={{ color: C.text }}>Platform fees.</strong> The 2% platform fee on completed transactions is non-refundable.</p>

          <h2 style={{ fontSize: '20px', fontWeight: 700, color: C.text, marginTop: '24px', marginBottom: '12px' }}>Deal Funded = No Refund</h2>
          <p>When a Brand funds a Deal, the payment is processed immediately and held in escrow by Razorpay (INR). Once funded, the Brand waives the right to a refund. The funds will be released according to the Deal terms:</p>
          <p>• If the Creator delivers and the Brand approves, funds release to the Creator.</p>
          <p>• If the Deal is cancelled by mutual agreement, funds release per the cancellation terms agreed between the parties.</p>
          <p>• If there is a dispute, funds remain frozen until resolution through the Platform's dispute process or arbitration.</p>
          <p>Under no circumstances does ValueSkins independently issue refunds.</p>

          <h2 style={{ fontSize: '20px', fontWeight: 700, color: C.text, marginTop: '24px', marginBottom: '12px' }}>Chargebacks</h2>
          <p>If a Brand initiates a chargeback with their bank or card issuer instead of using the Platform's dispute resolution process:</p>
          <p>• The relevant Creator account will be notified and may be suspended pending investigation.</p>
          <p>• We will provide all Deal records, communications, and delivery evidence to the payment processor to contest the chargeback.</p>
          <p>• Brands who abuse chargebacks may have their accounts permanently suspended.</p>

          <h2 style={{ fontSize: '20px', fontWeight: 700, color: C.text, marginTop: '24px', marginBottom: '12px' }}>Contact</h2>
          <p>If you have questions about this policy:</p>
          <p><strong>Email:</strong> <a href="mailto:founder@valueskins.com" style={{color: C.primary}}>founder@valueskins.com</a></p>
          

        </div>
      </div>
    </div>
  );
}
