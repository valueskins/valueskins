'use client';
import { useState } from 'react';
import Link from 'next/link';

const C = {
  bg: 'var(--c-bg)',
  surface: 'var(--c-surface)',
  border: 'var(--c-border)',
  text: 'var(--c-text)',
  textSecondary: 'var(--c-text-muted)',
  primary: 'var(--c-primary)',
};

export default function DataRequestPage() {
  const [email, setEmail] = useState('');
  const [requestType, setRequestType] = useState<'access' | 'export' | 'delete'>('access');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const res = await fetch('/api/legal/data-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, requestType }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Request failed'); return; }
      setMessage(data.message || 'Request submitted. Check your email for confirmation.');
    } catch { setError('Network error. Try again.'); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, padding: '120px 24px 160px' }}>
      <div style={{ maxWidth: '600px', margin: '0 auto' }}>
        <Link href="/legal" style={{ color: C.primary, textDecoration: 'none', fontSize: '14px', marginBottom: '32px', display: 'inline-block' }}>
          Back to Legal
        </Link>

        <h1 style={{ fontSize: '32px', fontWeight: 800, marginBottom: '12px' }}>Data Access & Export</h1>
        <p style={{ color: C.textSecondary, marginBottom: '32px' }}>
          Exercise your rights under GDPR (Europe), CCPA (California), and DPDP Act (India). We will process your request within 30 days.
        </p>

        {error && <div style={{ padding: '10px 14px', background: '#fef2f2', color: 'var(--c-error)', borderRadius: '8px', fontSize: '13px', marginBottom: '16px', border: '1px solid #fecaca' }}>{error}</div>}
        {message && <div style={{ padding: '10px 14px', background: '#f0fdf4', color: 'var(--c-accent)', borderRadius: '8px', fontSize: '13px', marginBottom: '16px', border: '1px solid #bbf7d0' }}>{message}</div>}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: C.text, marginBottom: '6px' }}>Email address</label>
            <input type="email" required value={email} onChange={e => setEmail(e.target.value)} style={{ width: '100%', padding: '10px 12px', border: `1px solid ${C.border}`, borderRadius: '8px', fontSize: '14px', background: C.surface, color: C.text, outline: 'none', boxSizing: 'border-box' }} />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: C.text, marginBottom: '6px' }}>Request type</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {([
                { value: 'access', label: 'Access my data', desc: 'See what personal data we hold about you' },
                { value: 'export', label: 'Export my data', desc: 'Download all your data in a portable format' },
                { value: 'delete', label: 'Delete my data', desc: 'Request permanent deletion of your personal data' },
              ] as const).map(opt => (
                <label key={opt.value} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '12px', background: C.surface, border: `1px solid ${requestType === opt.value ? C.primary : C.border}`, borderRadius: '8px', cursor: 'pointer' }}>
                  <input type="radio" name="requestType" value={opt.value} checked={requestType === opt.value} onChange={() => setRequestType(opt.value)} style={{ marginTop: '2px' }} />
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: C.text }}>{opt.label}</div>
                    <div style={{ fontSize: '12px', color: C.textSecondary }}>{opt.desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <button type="submit" disabled={loading} style={{ width: '100%', padding: '12px', background: C.primary, color: '#000', border: 'none', borderRadius: '8px', fontSize: '15px', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1 }}>
            {loading ? 'Submitting...' : 'Submit request'}
          </button>
        </form>
      </div>
    </div>
  );
}
