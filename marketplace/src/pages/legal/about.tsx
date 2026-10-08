'use client';
import Link from 'next/link';
const C = { bg: '#0A0A0A', surface: 'rgba(10, 10, 10, 0.86)', border: 'rgba(184, 180, 172, 0.18)', text: '#F5F5F0', textSecondary: '#B8B4AC', primary: '#C8B89A' };

export default function About() {
  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, padding: '60px 20px' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <Link href="/" style={{ color: C.primary, textDecoration: 'none', fontSize: '14px', marginBottom: '32px', display: 'inline-block' }}>← Back</Link>
        <h1 style={{ fontSize: '32px', fontWeight: 800, marginBottom: '12px' }}>About ValueSkins</h1>
        <p style={{ color: C.textSecondary, marginBottom: '40px' }}>The marketplace for serious creators and brands</p>

        <div style={{ lineHeight: '1.8', color: C.textSecondary }}>

          <h2 style={{ fontSize: '20px', fontWeight: 700, color: C.text, marginTop: '24px', marginBottom: '12px' }}>What We Do</h2>
          <p>ValueSkins is a marketplace platform that connects content creators with brands for paid campaigns. We handle the entire deal lifecycle, from discovery and negotiation to payment and delivery, so creators can focus on creating and brands can focus on results.</p>

          <h2 style={{ fontSize: '20px', fontWeight: 700, color: C.text, marginTop: '24px', marginBottom: '12px' }}>How It Works</h2>
          <p><strong style={{ color: C.text }}>For Creators:</strong> Build a profile showcasing your skills, portfolio, and rates. Get discovered by brands looking for creators like you. Accept deals, deliver work, and get paid, all through the platform.</p>
          <p><strong style={{ color: C.text }}>For Brands:</strong> Browse creator profiles, post campaign briefs, and negotiate deal terms. Fund deals through secure escrow. Review deliverables and release payment only when you approve.</p>

          <h2 style={{ fontSize: '20px', fontWeight: 700, color: C.text, marginTop: '24px', marginBottom: '12px' }}>Escrow-Based Payments</h2>
          <p>Every deal on ValueSkins is protected by escrow. When a brand funds a deal, the payment is held securely by our payment partner (Razorpay for INR). Funds are only released to the creator once the brand approves the deliverables. This protects both sides, creators get guaranteed payment, and brands only pay for work they approve.</p>

          <h2 style={{ fontSize: '20px', fontWeight: 700, color: C.text, marginTop: '24px', marginBottom: '12px' }}>Our Platform Fee</h2>
          <p>ValueSkins charges a 2% platform fee on completed transactions. There are no upfront costs, no subscription fees, and no charges for cancelled deals. We only make money when you do.</p>

          <h2 style={{ fontSize: '20px', fontWeight: 700, color: C.text, marginTop: '24px', marginBottom: '12px' }}>Company Information</h2>
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '12px', padding: '24px', marginTop: '16px' }}>
            <p><strong style={{ color: C.text }}>Registered Entity:</strong> Valueskins Pvt. Ltd.</p>
            <p><strong style={{ color: C.text }}>Founder:</strong> Saketh Velamuri</p>
            <p><strong style={{ color: C.text }}>Email:</strong> <a href="mailto:valueskinsfounder@gmail.com" style={{ color: C.primary }}>valueskinsfounder@gmail.com</a></p>
            <p><strong style={{ color: C.text }}>Phone:</strong> </p>
          </div>

          <h2 style={{ fontSize: '20px', fontWeight: 700, color: C.text, marginTop: '24px', marginBottom: '12px' }}>Contact Us</h2>
          <p>Have questions? Reach out at <a href="mailto:valueskinsfounder@gmail.com" style={{ color: C.primary }}>valueskinsfounder@gmail.com</a> or call .</p>

        </div>
      </div>
    </div>
  );
}
