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
  danger: 'var(--c-error)',
  warning: 'var(--c-warning)',
};

export default function AdminDisputes() {
  const router = useRouter();
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [disputes, setDisputes] = useState<any[]>([]);
  const [selectedDispute, setSelectedDispute] = useState<any | null>(null);
  const [resolution, setResolution] = useState('');
  const [notes, setNotes] = useState('');
  const [resolving, setResolving] = useState(false);
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
      loadDisputes();
    } catch (err) {
      router.push('/admin/login');
    } finally {
      setLoading(false);
    }
  };

  const loadDisputes = async () => {
    try {
      const res = await fetch('/api/admin/disputes', {
        credentials: 'include',
      });

      if (res.ok) {
        const data = await res.json();
        setDisputes(data.disputes || []);
      } else {
        setError('Failed to load disputes');
      }
    } catch (err) {
      setError('Error loading disputes');
    }
  };

  const handleResolveDispute = async () => {
    if (!selectedDispute || !resolution || !notes) {
      setError('Please fill in all fields');
      return;
    }

    setResolving(true);
    setError('');

    try {
      const res = await fetch('/api/admin/resolve-dispute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          disputeId: selectedDispute.id,
          dealId: selectedDispute.deal_id,
          resolution,
          notes,
          payoutAdjustmentPct: resolution === 'split' ? 50 : resolution === 'creator' ? 100 : 0,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to resolve dispute');
      }

      // Reload disputes
      loadDisputes();
      setSelectedDispute(null);
      setResolution('');
      setNotes('');
    } catch (err: any) {
      setError(err.message || 'Failed to resolve dispute');
    } finally {
      setResolving(false);
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
        <h1 style={{ fontSize: '24px', fontWeight: 800, color: C.text, margin: 0, flex: 1 }}>Disputed Deals</h1>
      </div>

      {/* Content */}
      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '40px 20px' }}>
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

        {disputes.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <p style={{ color: C.textSecondary, fontSize: '16px' }}>No disputed deals at this time.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: selectedDispute ? '1fr 1fr' : '1fr', gap: '24px' }}>
            {/* Disputes List */}
            <div>
              <h2 style={{ fontSize: '16px', fontWeight: 600, color: C.text, marginBottom: '16px' }}>Open Disputes ({disputes.length})</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {disputes.map((dispute) => (
                  <div
                    key={dispute.id}
                    onClick={() => setSelectedDispute(dispute)}
                    style={{
                      padding: '16px',
                      background: selectedDispute?.id === dispute.id ? C.primary : C.card,
                      color: selectedDispute?.id === dispute.id ? '#000' : C.text,
                      border: `1px solid ${C.border}`,
                      borderRadius: '8px',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                  >
                    <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Deal: {dispute.deal_id}</div>
                    <div style={{ fontSize: '13px', marginBottom: '4px' }}>{dispute.reason?.replace(/_/g, ' ').toUpperCase()}</div>
                    <div style={{ fontSize: '11px', opacity: 0.8 }}>Raised: {new Date(dispute.created_at).toLocaleDateString()}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Dispute Detail & Resolution */}
            {selectedDispute && (
              <div>
                <h2 style={{ fontSize: '16px', fontWeight: 600, color: C.text, marginBottom: '16px' }}>Resolution</h2>

                <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '8px', padding: '16px', marginBottom: '16px' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: 600, color: C.text, marginBottom: '12px' }}>Dispute Details</h3>

                  <div style={{ fontSize: '12px', color: C.textSecondary, lineHeight: '1.6' }}>
                    <div><strong>Deal ID:</strong> {selectedDispute.deal_id}</div>
                    <div><strong>Raised By:</strong> {selectedDispute.raised_by}</div>
                    <div><strong>Reason:</strong> {selectedDispute.reason?.replace(/_/g, ' ').toUpperCase()}</div>
                    <div><strong>Description:</strong> {selectedDispute.description}</div>
                    <div><strong>Status:</strong> {selectedDispute.status?.toUpperCase()}</div>
                    <div><strong>Evidence:</strong> {selectedDispute.evidence_urls?.length || 0} files</div>
                  </div>

                  {/* PDF Versions */}
                  {selectedDispute.pdf_versions && selectedDispute.pdf_versions.length > 0 && (
                    <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: `1px solid ${C.border}` }}>
                      <h4 style={{ fontSize: '12px', fontWeight: 600, color: C.text, marginBottom: '8px' }}>PDF Versions (Proof Timeline)</h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {selectedDispute.pdf_versions.map((version: any, idx: number) => (
                          <a
                            key={idx}
                            href={`/api/deals/download-pdf?path=${encodeURIComponent(version.path)}`}
                            download
                            style={{
                              padding: '8px',
                              background: 'var(--c-border)',
                              color: C.primary,
                              textDecoration: 'none',
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontWeight: 600,
                              textAlign: 'center',
                            }}
                          >
                            v{selectedDispute.pdf_versions.length - idx} - {version.timestamp}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Resolution Form */}
                <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '8px', padding: '16px' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: 600, color: C.text, marginBottom: '12px' }}>Resolve Dispute</h3>

                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: C.text, marginBottom: '8px' }}>Resolution</label>
                    <select
                      value={resolution}
                      onChange={(e) => setResolution(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px',
                        border: `1px solid ${C.border}`,
                        borderRadius: '4px',
                        fontSize: '12px',
                        background: C.surface,
                        color: C.text,
                        boxSizing: 'border-box',
                      }}
                    >
                      <option value="">-- Select resolution --</option>
                      <option value="creator">Full Payment to Creator</option>
                      <option value="brand">Full Refund to Brand</option>
                      <option value="split">Split 50/50</option>
                      <option value="ban-creator">Ban Creator</option>
                      <option value="ban-brand">Ban Brand</option>
                    </select>
                  </div>

                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: C.text, marginBottom: '8px' }}>Admin Notes</label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Explain the resolution and reasoning..."
                      style={{
                        width: '100%',
                        padding: '8px',
                        border: `1px solid ${C.border}`,
                        borderRadius: '4px',
                        fontSize: '12px',
                        background: C.surface,
                        color: C.text,
                        boxSizing: 'border-box',
                        minHeight: '80px',
                        fontFamily: 'monospace',
                      }}
                    />
                  </div>

                  <button
                    onClick={handleResolveDispute}
                    disabled={resolving || !resolution || !notes}
                    style={{
                      width: '100%',
                      padding: '10px',
                      background: C.primary,
                      color: 'var(--c-on-primary)',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '14px',
                      fontWeight: 600,
                      cursor: resolving || !resolution || !notes ? 'not-allowed' : 'pointer',
                      opacity: resolving || !resolution || !notes ? 0.6 : 1,
                    }}
                  >
                    {resolving ? 'Resolving...' : 'Confirm Resolution'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
