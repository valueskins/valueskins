'use client';
import Link from 'next/link';
const C = { bg: '#0A0A0A', surface: 'rgba(10, 10, 10, 0.86)', border: 'rgba(184, 180, 172, 0.18)', text: '#F5F5F0', textSecondary: '#B8B4AC', primary: '#C8B89A' };

export default function Contact() {
  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, padding: '60px 20px' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <Link href="/" style={{ color: C.primary, textDecoration: 'none', fontSize: '14px', marginBottom: '32px', display: 'inline-block' }}>← Back</Link>
        <h1 style={{ fontSize: '32px', fontWeight: 800, marginBottom: '12px' }}>Contact Us</h1>
        <p style={{ color: C.textSecondary, marginBottom: '40px' }}>We would love to hear from you</p>

        <div style={{ lineHeight: '1.8', color: C.textSecondary }}>

          <h2 style={{ fontSize: '20px', fontWeight: 700, color: C.text, marginTop: '24px', marginBottom: '12px' }}>Get in Touch</h2>

          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '12px', padding: '24px', marginTop: '16px', marginBottom: '24px' }}>
            <div style={{ marginBottom: '20px' }}>
              <p style={{ margin: '0 0 4px 0' }}><strong style={{ color: C.text }}>Registered Entity:</strong></p>
              <span style={{ color: C.text, fontSize: '15px' }}>Valueskins Pvt. Ltd.</span>
            </div>
            <div style={{ marginBottom: '20px' }}>
              <p style={{ margin: '0 0 4px 0' }}><strong style={{ color: C.text }}>Email:</strong></p>
              <a href="mailto:founder@valueskins.com" style={{ color: C.primary, fontSize: '15px' }}>founder@valueskins.com</a>
            </div>
            <div style={{ marginBottom: '20px' }}>
              <p style={{ margin: '0 0 4px 0' }}><strong style={{ color: C.text }}>Phone:</strong></p>
              <a href="tel:+918805695324" style={{ color: C.primary, fontSize: '15px' }}>+91 88056 95324</a>
            </div>
            <div style={{ marginBottom: '20px' }}>
              <p style={{ margin: '0 0 4px 0' }}><strong style={{ color: C.text }}>GSTIN:</strong></p>
              <span style={{ color: C.primary, fontSize: '15px' }}>27AAMCV5525E1Z5</span>
            </div>
          </div>

          <h2 style={{ fontSize: '20px', fontWeight: 700, color: C.text, marginTop: '32px', marginBottom: '12px' }}>Response Time</h2>
          <p>We acknowledge all inquiries within 24 hours and aim to resolve most issues within 2-3 business days.</p>

          <h2 style={{ fontSize: '20px', fontWeight: 700, color: C.text, marginTop: '32px', marginBottom: '12px' }}>Grievance Officer</h2>
          <p>For complaints regarding data privacy or platform conduct, contact our Grievance Officer at <a href="mailto:founder@valueskins.com" style={{ color: C.primary }}>founder@valueskins.com</a>. We are required to acknowledge within 24 hours and resolve within 15 days under Indian law.</p>

          <h2 style={{ fontSize: '20px', fontWeight: 700, color: C.text, marginTop: '32px', marginBottom: '12px' }}>Business Hours</h2>
          <p>Monday to Saturday, 10:00 AM to 7:00 PM IST. We respond to emails outside business hours as well.</p>

        </div>
      </div>
    </div>
  );
}
