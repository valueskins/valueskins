'use client';
import Link from 'next/link';
const C = { bg: '#0A0A0A', surface: 'rgba(10, 10, 10, 0.86)', border: 'rgba(184, 180, 172, 0.18)', text: '#F5F5F0', textSecondary: '#B8B4AC', primary: '#C8B89A' };

export default function About() {
  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, padding: '60px 20px' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <Link href="/" style={{ color: C.primary, textDecoration: 'none', fontSize: '14px', marginBottom: '32px', display: 'inline-block' }}>← Back</Link>
        <h1 style={{ fontSize: '32px', fontWeight: 800, marginBottom: '12px' }}>About ValueSkins</h1>
        <p style={{ color: C.textSecondary, marginBottom: '40px' }}>Brands post deals. Creators apply.</p>

        <div style={{ lineHeight: '1.8', color: C.textSecondary }}>

          <h2 style={{ fontSize: '20px', fontWeight: 700, color: C.text, marginTop: '24px', marginBottom: '12px' }}>What We Do</h2>
          <p>ValueSkins is a platform where brands post paid deals and creators apply for them. Each deal has one brand, one creator and one fixed amount.</p>

          <h2 style={{ fontSize: '20px', fontWeight: 700, color: C.text, marginTop: '24px', marginBottom: '12px' }}>How It Works</h2>
          <p>A brand posts a deal with a fixed amount. Creators apply, and the brand picks one. The creator makes the content, and the brand approves it or asks for changes.</p>

          <h2 style={{ fontSize: '20px', fontWeight: 700, color: C.text, marginTop: '24px', marginBottom: '12px' }}>Payments</h2>
          <p>The brand pays ValueSkins a flat fee of ₹750 plus 18% GST (₹885) per deal through Razorpay. The brand then pays the creator directly by UPI: 30% of the remaining amount before work starts and 70% after approving the content. ValueSkins does not hold the creator's money.</p>

          <h2 style={{ fontSize: '20px', fontWeight: 700, color: C.text, marginTop: '24px', marginBottom: '12px' }}>Company Information</h2>
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '12px', padding: '24px', marginTop: '16px' }}>
            <p><strong style={{ color: C.text }}>Registered Entity:</strong> Valueskins Pvt. Ltd.</p>
            <p><strong style={{ color: C.text }}>Founder:</strong> Saketh Velamuri</p>
            <p><strong style={{ color: C.text }}>Email:</strong> <a href="mailto:founder@valueskins.com" style={{ color: C.primary }}>founder@valueskins.com</a></p>
            <p><strong style={{ color: C.text }}>Phone:</strong> <a href="tel:+918805695324" style={{ color: C.primary }}>+91 88056 95324</a></p>
            <p><strong style={{ color: C.text }}>GSTIN:</strong> 27AAMCV5525E1Z5</p>
          </div>

          <h2 style={{ fontSize: '20px', fontWeight: 700, color: C.text, marginTop: '24px', marginBottom: '12px' }}>Contact Us</h2>
          <p>Have questions? Reach out at <a href="mailto:founder@valueskins.com" style={{ color: C.primary }}>founder@valueskins.com</a>.</p>

        </div>
      </div>
    </div>
  );
}
