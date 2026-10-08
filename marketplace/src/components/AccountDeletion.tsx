'use client';
import { withAlpha } from '@/theme/colors';

import { useState } from 'react';

const C = {
  bg: '#0A0A0A',
  surface: '#1A1A1A',
  border: '#2D2D2D',
  text: '#F5F5F0',
  textSecondary: '#D6D2C8',
  error: 'var(--c-error)',
  errorBg: '#7f1d1d',
  success: 'var(--c-accent)',
  successBg: '#052e16',
  warning: 'var(--c-warning)',
  warningBg: '#451a03',
  info: 'var(--c-accent)',
  infoBg: '#1e3a5f',
};

const sections = [
  {
    title: 'Immediate Actions (today)',
    items: [
      'A PDF report will be downloaded to your computer showing everything we have on file',
      'You will be logged out of all sessions on all devices immediately',
      'Your profile will no longer be visible to other users',
      'Active listings, campaigns, and deal rooms will be frozen (no new activity)',
    ],
  },
  {
    title: '30-Day Grace Period',
    items: [
      'You can cancel the deletion at any time by logging back in and clicking "Cancel Deletion"',
      'Your data is preserved during this period in case you change your mind',
      'Login again and go to Account Settings to cancel, your account will be fully restored',
      'After 30 days, cancellation is no longer possible',
    ],
  },
  {
    title: 'Permanently Deleted (day 30)',
    items: [
      'Profile information: name, email, username, avatar, bio, phone number',
      'All authentication data: passwords, Google/Apple login connections, sessions',
      'Notifications, email preferences, and saved settings',
      'Consent records (you will need to re-consent if you come back)',
      'Creator/brand profiles, portfolios, campaign applications',
      'Deal room messages and chat history',
    ],
  },
  {
    title: 'Retained for 7 Years (tax law)',
    items: [
      'Payment transaction records (amounts, dates, IDs), required by IRS/UK HMRC/Indian tax law',
      'Payout history and escrow release records',
      'Invoice records for tax reporting purposes',
      'These records are anonymized, your name/email is removed but the financial data stays',
      'After 7 years, these records are permanently destroyed',
    ],
  },
  {
    title: 'Retained Temporarily (anonymized)',
    items: [
      'Usage analytics and page visits: retained for 90 days, then permanently deleted',
      'Audit logs (who accessed what): retained for 90 days, then anonymized',
      'Backup copies of the database: retained for up to 90 days, then overwritten',
    ],
  },
  {
    title: 'What "Anonymized" Actually Means',
    items: [
      'Your email is replaced with a placeholder so no one can identify you',
      'Your name becomes "[Deleted User]" across the system',
      'The same email can be used to create a brand new account later',
      'Any remaining references are disconnected from your identity',
      'Payment records keep the transaction details but erase your personal info',
    ],
  },
  {
    title: 'What Happens to Your Work',
    items: [
      'Deal rooms you created or participated in remain (for other participants)',
      'Your messages in deal rooms show as "[deleted]", content removed',
      'Reviews about you: reviews you wrote are deleted, reviews about you are anonymized',
      'Campaigns you created: frozen and removed from active rotation',
      'Escrow amounts: any pending funds will be returned per our terms, contact support first',
    ],
  },
  {
    title: 'Re-Registration',
    items: [
      'After deletion completes (30 days), you can sign up again with the same email',
      'It will be treated as a brand new account, no history, no connections, no deals',
      'You will need to re-verify your email and set up your profile from scratch',
      'Previous payment methods are NOT retained, you will need to re-enter them',
    ],
  },
  {
    title: 'Legal Compliance',
    items: [
      'GDPR (EU users): Right to erasure fulfilled within 30 days. You can request earlier deletion via support.',
      'CCPA (California users): Right to delete + right to opt-out of data sale (we do not sell data).',
      'DPDP Act (India users): Right to erasure with 30-day processing window.',
      'Tax authorities (IRS, HMRC, etc.): Payment records retained for 7 years as required by law.',
      'All data is encrypted at rest (AES-256-GCM).',
      'Your PDF export serves as your record of what data we had at the time of deletion.',
    ],
  },
  {
    title: 'Timeline Summary',
    items: [
      'Today: PDF downloads, you are logged out, profile hidden, deals frozen',
      'Days 1-30: Grace period, login to cancel anytime',
      'Day 30: Most data permanently deleted, email freed',
      'Day 30-90: Backups overwritten, analytics purged, audit logs anonymized',
      'Year 7: Payment records permanently destroyed',
    ],
  },
];

export function AccountDeletionSection() {
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [confirmationPhrase, setConfirmationPhrase] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleDeleteAccount = async () => {
    if (confirmationPhrase !== 'PERMANENTLY DELETE MY ACCOUNT') {
      setError('Confirmation phrase does not match');
      return;
    }

    setIsDeleting(true);
    setError('');

    try {
      const response = await fetch('/api/legal/request-deletion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        const data = await response.json();
        if (response.status === 409) {
          setError('Deletion already requested. Login and go to Account Settings to cancel.');
          return;
        }
        throw new Error(data.error || 'Failed to request deletion');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `valueskins-deletion-export-${Date.now()}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      setSuccess(true);
      localStorage.clear();

      setTimeout(() => {
        window.location.href = '/';
      }, 4000);
    } catch (err: any) {
      setError(err.message || 'Failed to process deletion');
    } finally {
      setIsDeleting(false);
    }
  };

  if (success) {
    return (
      <div style={{
        padding: '20px',
        background: C.successBg,
        border: `1px solid ${withAlpha(C.success, 0x40)}`,
        borderRadius: '8px',
      }}>
        <div style={{ color: C.success, fontWeight: 700, fontSize: '15px', marginBottom: '8px' }}>
          Deletion Scheduled
        </div>
        <div style={{ fontSize: '13px', color: C.text, lineHeight: '1.5' }}>
          A PDF export of your data and work history has been downloaded to your computer.
          <br /><br />
          Your account will be permanently deleted after <strong>30 days</strong>.
          You are now logged out of all devices.
          <br /><br />
          If this was a mistake, simply log back in within 30 days to cancel the deletion.
          Your account will be fully restored.
          <br /><br />
          After 30 days, the same email can be used to create a brand new account.
        </div>
      </div>
    );
  }

  const warningBox = (title: string, children: React.ReactNode) => (
    <div style={{
      background: C.errorBg,
      border: `1px solid ${withAlpha(C.error, 0x40)}`,
      borderRadius: '8px',
      padding: '12px',
      marginBottom: '12px',
    }}>
      <div style={{ fontWeight: 700, fontSize: '13px', color: C.error, marginBottom: '6px' }}>
        {title}
      </div>
      <div style={{ fontSize: '12px', color: C.text, lineHeight: '1.6' }}>
        {children}
      </div>
    </div>
  );

  return (
    <div style={{ padding: '20px', borderTop: `1px solid ${C.border}`, marginTop: '20px' }}>
      <div style={{ marginBottom: '16px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 700, color: C.error, marginBottom: '8px' }}>
          Danger Zone
        </h3>
        <p style={{ fontSize: '13px', color: C.textSecondary, margin: 0 }}>
          Permanently delete your account and all associated data.
          A PDF export of everything we have on file will be downloaded first.
        </p>
      </div>

      <button
        onClick={() => setShowDeleteModal(true)}
        style={{
          padding: '10px 16px',
          background: C.error,
          color: '#fff',
          border: 'none',
          borderRadius: '6px',
          fontSize: '13px',
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        Delete Account
      </button>

      {showDeleteModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.85)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          overflow: 'auto',
          padding: '20px',
        }} onClick={() => setShowDeleteModal(false)}>
          <div
            style={{
              background: C.surface,
              border: `1px solid ${C.border}`,
              borderRadius: '12px',
              padding: '24px',
              maxWidth: '640px',
              width: '100%',
              maxHeight: '90vh',
              overflow: 'auto',
            }}
            onClick={e => e.stopPropagation()}
          >
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: C.error, marginBottom: '4px' }}>
              Permanent Account Deletion
            </h2>
            <p style={{ fontSize: '12px', color: C.textSecondary, marginBottom: '16px' }}>
              This action permanently deletes your account. Please read everything below before proceeding.
            </p>

            {warningBox('A PDF will download automatically after you confirm', (
              <span>This file contains your work history, profile data, and everything we have collected about you.
              Save it somewhere safe, it is your only record after deletion.</span>
            ))}

            {warningBox('You have 30 days to change your mind', (
              <span>If you log back in within 30 days, you can cancel the deletion and your account will be
              fully restored. After 30 days, cancellation is impossible.</span>
            ))}

            {warningBox('Your email can be reused after deletion', (
              <span>Once deletion completes (after 30 days), you can sign up again with the same email. It will be
              treated as a brand new account, no history, no connections, no deals.</span>
            ))}

            {warningBox('Some data is retained by law', (
              <span>Payment transaction records are kept for 7 years as required by tax laws (IRS, HMRC, etc.).
              These records are anonymized, your name and email are removed, but the financial data is retained
              for legal compliance. After 7 years, everything is permanently destroyed.</span>
            ))}

            {!showTerms && (
              <button
                onClick={() => setShowTerms(true)}
                style={{
                  display: 'block',
                  width: '100%',
                  padding: '10px',
                  background: 'transparent',
                  color: C.info,
                  border: `1px solid ${withAlpha(C.info, 0x40)}`,
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  marginBottom: '16px',
                }}
              >
                Show full details on what gets deleted, retained, and when
              </button>
            )}

            {showTerms && (
              <div style={{ marginBottom: '16px' }}>
                {sections.map((section) => (
                  <div
                    key={section.title}
                    style={{
                      background: C.bg,
                      border: `1px solid ${C.border}`,
                      borderRadius: '8px',
                      padding: '12px',
                      marginBottom: '8px',
                    }}
                  >
                    <div style={{ fontSize: '12px', fontWeight: 700, color: C.text, marginBottom: '6px' }}>
                      {section.title}
                    </div>
                    <ul style={{ margin: 0, padding: '0 0 0 16px', fontSize: '11px', color: C.textSecondary, lineHeight: '1.7' }}>
                      {section.items.map((item, i) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: C.textSecondary, marginBottom: '6px' }}>
                  Type this exactly to confirm:
                </div>
                <code style={{
                  display: 'block',
                  padding: '8px',
                  background: C.bg,
                  border: `1px solid ${C.border}`,
                  borderRadius: '6px',
                  color: C.warning,
                  fontSize: '12px',
                  marginBottom: '8px',
                  wordBreak: 'break-all',
                  fontWeight: 700,
                }}>
                  PERMANENTLY DELETE MY ACCOUNT
                </code>
                <input
                  type="text"
                  value={confirmationPhrase}
                  onChange={e => {
                    setConfirmationPhrase(e.target.value);
                    setError('');
                  }}
                  placeholder="Type confirmation phrase here"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: `1px solid ${C.border}`,
                    background: C.bg,
                    color: C.text,
                    borderRadius: '6px',
                    fontSize: '13px',
                    boxSizing: 'border-box',
                  }}
                />
              </label>
            </div>

            {error && (
              <div style={{
                padding: '8px 12px',
                background: C.errorBg,
                border: `1px solid ${withAlpha(C.error, 0x40)}`,
                borderRadius: '6px',
                color: C.error,
                fontSize: '12px',
                marginBottom: '16px',
              }}>
                {error}
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setConfirmationPhrase('');
                  setError('');
                  setShowTerms(false);
                }}
                disabled={isDeleting}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  background: 'transparent',
                  color: C.textSecondary,
                  border: `1px solid ${C.border}`,
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: isDeleting ? 'default' : 'pointer',
                  opacity: isDeleting ? 0.6 : 1,
                }}
              >
                Cancel, Keep My Account
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={isDeleting || confirmationPhrase !== 'PERMANENTLY DELETE MY ACCOUNT'}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  background: confirmationPhrase === 'PERMANENTLY DELETE MY ACCOUNT' ? C.error : C.error + '60',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: isDeleting || confirmationPhrase !== 'PERMANENTLY DELETE MY ACCOUNT' ? 'default' : 'pointer',
                  opacity: isDeleting || confirmationPhrase !== 'PERMANENTLY DELETE MY ACCOUNT' ? 0.6 : 1,
                }}
              >
                {isDeleting ? 'Downloading PDF and scheduling deletion...' : 'PERMANENTLY DELETE MY ACCOUNT'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
