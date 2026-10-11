'use client';

import React, { useState, useEffect } from 'react';

interface DealPDFDownloaderProps {
  dealId: string;
  dealPhase: string;
  onDownload?: () => void;
}

export default function DealPDFDownloader({ dealId, dealPhase, onDownload }: DealPDFDownloaderProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [versions, setVersions] = useState<any[]>([]);
  const [showVersions, setShowVersions] = useState(false);

  // Can only generate PDF in in_progress, review, or completed phases
  const canGenerate = ['in_progress', 'review', 'completed'].includes(dealPhase);

  const handleGeneratePDF = async () => {
    if (!canGenerate) {
      setError('PDF can only be generated while deal is in progress or under review');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/deals/generate-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ dealId, action: 'generate' }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to generate PDF');
      }

      // Download the PDF
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `deal-${dealId}-${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      // Refresh versions list
      loadVersions();
      onDownload?.();
    } catch (err: any) {
      setError(err.message || 'Failed to generate PDF');
    } finally {
      setLoading(false);
    }
  };

  const loadVersions = async () => {
    try {
      const res = await fetch('/api/deals/generate-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ dealId, action: 'list-versions' }),
      });

      if (res.ok) {
        const data = await res.json();
        setVersions(data.versions || []);
      }
    } catch (err) {
      console.error('Failed to load PDF versions:', err);
    }
  };

  useEffect(() => {
    if (canGenerate) {
      loadVersions();
    }
  }, [dealId, canGenerate]);

  return (
    <div style={{ padding: '16px', background: 'var(--c-border)', borderRadius: '8px', border: '1px solid var(--c-border)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: 'var(--c-text)' }}>Deal Proof Documents</h3>
        {canGenerate && (
          <button
            onClick={handleGeneratePDF}
            disabled={loading}
            style={{
              padding: '8px 16px',
              background: 'var(--c-primary)',
              color: 'var(--c-on-primary)',
              border: 'none',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? '⏳ Generating...' : '📄 Generate PDF'}
          </button>
        )}
      </div>

      {error && (
        <div style={{
          padding: '8px',
          background: 'var(--c-error-container)',
          color: 'var(--c-error)',
          borderRadius: '4px',
          fontSize: '12px',
          marginBottom: '12px',
        }}>
          {error}
        </div>
      )}

      {!canGenerate && (
        <p style={{ fontSize: '12px', color: 'var(--c-text-muted)', margin: 0 }}>
          PDF generation available once deal is in progress
        </p>
      )}

      {canGenerate && versions.length > 0 && (
        <div>
          <button
            onClick={() => setShowVersions(!showVersions)}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--c-text)',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 600,
              padding: 0,
              textDecoration: 'underline',
            }}
          >
            {showVersions ? '▼' : '▶'} View {versions.length} PDF Version{versions.length !== 1 ? 's' : ''} (Proof History)
          </button>

          {showVersions && (
            <div style={{ marginTop: '12px' }}>
              {versions.map((version, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: '8px',
                    background: 'rgba(10, 10, 10, 0.5)',
                    borderRadius: '4px',
                    marginBottom: '8px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div style={{ fontSize: '11px', color: 'var(--c-text-muted)' }}>
                    <div style={{ fontWeight: 600, color: 'var(--c-text)' }}>v{versions.length - idx}</div>
                    <div>{version.timestamp}</div>
                  </div>
                  <a
                    href={`/api/deals/download-pdf?path=${encodeURIComponent(version.path)}`}
                    download
                    style={{
                      padding: '4px 12px',
                      background: 'var(--c-primary)',
                      color: 'var(--c-on-primary)',
                      textDecoration: 'none',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: 600,
                    }}
                  >
                    Download
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
