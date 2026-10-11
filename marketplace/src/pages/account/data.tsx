'use client';
import { withAlpha } from '@/theme/colors';
import { useEffect, useState } from 'react';
import Link from 'next/link';

const C = { bg: 'var(--c-bg)', surface: 'var(--c-surface)', border: 'var(--c-border)', text: 'var(--c-text)', textSecondary: 'var(--c-text-muted)', primary: 'var(--c-primary)', danger: 'var(--c-error)' };

export default function MyData() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/account/me');
        if (res.ok) {
          const data = await res.json();
          setUser(data);
        }
      } catch (error) {
        console.error('Failed to load user data');
      }
      setLoading(false);
    })();
  }, []);

  const [isExporting, setIsExporting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [deleteSuccess, setDeleteSuccess] = useState(false);

  const exportData = async () => {
    setIsExporting(true);
    try {
      const res = await fetch('/api/legal/export-history');
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `valueskins-history-${Date.now()}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      } else {
        const fallbackRes = await fetch('/api/legal/export');
        if (fallbackRes.ok) {
          const blob = await fallbackRes.blob();
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `valueskins-export-${Date.now()}.json`;
          a.click();
        }
      }
    } finally {
      setIsExporting(false);
    }
  };

  const requestDeletion = async () => {
    setIsDeleting(true);
    setDeleteError('');
    setDeleteSuccess(false);

    try {
      const res = await fetch('/api/legal/request-deletion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!res.ok) {
        const data = await res.json();
        if (res.status === 409) {
          setDeleteError('Deletion already requested. Check your account status.');
          return;
        }
        throw new Error(data.error || 'Failed to request deletion');
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `valueskins-deletion-export-${Date.now()}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      setDeleteSuccess(true);
      localStorage.clear();

      setTimeout(() => {
        window.location.href = '/';
      }, 4000);
    } catch (err: any) {
      setDeleteError(err.message || 'Failed to process deletion');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, padding: '40px 20px' }}>
      <div style={{ maxWidth: '600px', margin: '0 auto' }}>
        <Link href="/" style={{ color: C.primary, textDecoration: 'none', marginBottom: '32px', display: 'inline-block' }}>← Back</Link>

        <h1 style={{ fontSize: '28px', fontWeight: 800, marginBottom: '32px' }}>My Data</h1>

        {loading ? (
          <p>Loading...</p>
        ) : user ? (
          <div>
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '12px', padding: '24px', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '16px' }}>Account Information</h2>
              <p><strong>Email:</strong> {user.email}</p>
              <p><strong>Name:</strong> {user.display_name || 'Not set'}</p>
              <p style={{ color: C.textSecondary, fontSize: '14px', marginTop: '16px' }}>You can update this info in Settings</p>
            </div>

            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '12px', padding: '24px', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '16px' }}>Data Management</h2>
              <button onClick={exportData} disabled={isExporting} style={{ width: '100%', padding: '12px', background: C.primary, color: '#0A0A0A', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: isExporting ? 'default' : 'pointer', marginBottom: '12px', opacity: isExporting ? 0.6 : 1 }}>
                {isExporting ? 'Generating PDF...' : '📥 Download My Data (PDF)'}
              </button>
              <p style={{ color: C.textSecondary, fontSize: '13px' }}>Get a comprehensive PDF of your account history and collected data</p>
            </div>

            {deleteSuccess ? (
              <div style={{ background: C.surface, border: '1px solid rgba(200, 184, 154, 0.25)', borderRadius: '12px', padding: '24px' }}>
                <div style={{ color: 'var(--c-accent)', fontWeight: 700, fontSize: '15px', marginBottom: '8px' }}>
                  ✓ Deletion Scheduled
                </div>
                <p style={{ color: C.textSecondary, fontSize: '13px', margin: 0 }}>
                  Your PDF export was downloaded. Your account will be permanently deleted after 30 days.
                  You can re-register with the same email after deletion.
                </p>
              </div>
            ) : (
              <div style={{ background: C.surface, border: `1px solid ${C.danger}`, borderRadius: '12px', padding: '24px' }}>
                <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '16px', color: C.danger }}>Danger Zone</h2>
                <button onClick={requestDeletion} disabled={isDeleting} style={{ width: '100%', padding: '12px', background: isDeleting ? `${withAlpha(C.danger, 0x60)}` : C.danger, color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: isDeleting ? 'default' : 'pointer', marginBottom: '12px' }}>
                  {isDeleting ? 'Downloading PDF...' : '🗑️ Delete Account'}
                </button>
                {deleteError && (
                  <div style={{ color: C.danger, fontSize: '12px', padding: '8px', background: 'rgba(252,165,165,0.1)', borderRadius: '6px', marginBottom: '8px' }}>
                    {deleteError}
                  </div>
                )}
                <p style={{ color: C.textSecondary, fontSize: '13px', margin: 0 }}>
                  A PDF export of all your data will be downloaded first. You have 30 days to cancel. After deletion, you can re-register with the same email.
                </p>
              </div>
            )}
          </div>
        ) : (
          <p>You need to log in</p>
        )}
      </div>
    </div>
  );
}
