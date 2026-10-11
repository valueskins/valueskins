'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';

const C = {
  bg: '#0A0A0A',
  surface: 'rgba(10, 10, 10, 0.86)',
  card: 'rgba(20, 20, 20, 0.8)',
  border: 'rgba(184, 180, 172, 0.18)',
  text: '#F5F5F0',
  textSecondary: '#B8B4AC',
  primary: '#C8B89A',
};

export default function AdminPDFs() {
  const router = useRouter();
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pdfs, setPDFs] = useState<any[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify' }),
        credentials: 'include',
      });

      if (!res.ok) {
        router.push('/admin/login');
        return;
      }

      setAuthenticated(true);
      loadPDFs();
    } catch (err) {
      router.push('/admin/login');
    } finally {
      setLoading(false);
    }
  };

  const loadPDFs = async () => {
    try {
      const res = await fetch('/api/admin/pdfs', {
        credentials: 'include',
      });

      if (res.ok) {
        const data = await res.json();
        setPDFs(data.pdfs || []);
      } else {
        setError('Failed to load PDFs');
      }
    } catch (err) {
      setError('Error loading PDFs');
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: C.textSecondary }}>Loading...</p>
      </div>
    );
  }

  if (!authenticated) {
    return null;
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bg }}>
      {/* Header */}
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Link href="/admin/main" style={{ color: C.primary, textDecoration: 'none', fontSize: '14px', marginRight: '20px' }}>← Back</Link>
        <h1 style={{ fontSize: '24px', fontWeight: 800, color: C.text, margin: 0, flex: 1 }}>Deal PDFs</h1>
      </div>

      {/* Content */}
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '40px 20px' }}>
        {error && (
          <div style={{
            padding: '16px',
            background: 'var(--c-error-container)',
            color: 'var(--c-error)',
            borderRadius: '8px',
            marginBottom: '20px',
            border: `1px solid var(--c-error)`
          }}>
            {error}
          </div>
        )}

        {pdfs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <p style={{ color: C.textSecondary, fontSize: '16px' }}>No PDFs generated yet.</p>
            <p style={{ color: C.textSecondary, fontSize: '14px' }}>Deal completion PDFs will appear here once deals are completed.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                  <th style={{ padding: '12px', textAlign: 'left', color: C.text, fontWeight: 600, fontSize: '14px' }}>Deal ID</th>
                  <th style={{ padding: '12px', textAlign: 'left', color: C.text, fontWeight: 600, fontSize: '14px' }}>Generated</th>
                  <th style={{ padding: '12px', textAlign: 'left', color: C.text, fontWeight: 600, fontSize: '14px' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {pdfs.map((pdf, idx) => (
                  <tr key={idx} style={{ borderBottom: `1px solid ${C.border}`, background: idx % 2 === 0 ? C.surface : 'transparent' }}>
                    <td style={{ padding: '12px', color: C.text, fontSize: '14px' }}>{pdf.deal_id}</td>
                    <td style={{ padding: '12px', color: C.textSecondary, fontSize: '14px' }}>{new Date(pdf.created_at).toLocaleDateString()}</td>
                    <td style={{ padding: '12px' }}>
                      <a href={pdf.url} target="_blank" rel="noopener noreferrer" style={{
                        padding: '4px 12px',
                        background: C.primary,
                        color: 'var(--c-on-primary)',
                        textDecoration: 'none',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontWeight: 600,
                        display: 'inline-block'
                      }}>
                        Download
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
