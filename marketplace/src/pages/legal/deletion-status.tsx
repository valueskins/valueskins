// Where Meta sends someone after they ask, from Instagram, for their
// ValueSkins data to be deleted. Shows their confirmation code and what
// happens next.
import Link from 'next/link';
import { useRouter } from 'next/router';

const C = {
  bg: 'var(--c-bg)',
  text: 'var(--c-text)',
  textSecondary: 'var(--c-text-muted)',
  primary: 'var(--c-primary)',
};

export default function DeletionStatusPage() {
  const { query } = useRouter();
  const raw = typeof query.code === 'string' ? query.code : '';
  const code = /^[a-f0-9]{16}$/.test(raw) ? raw : '';

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, padding: '120px 24px 160px' }}>
      <div style={{ maxWidth: '600px', margin: '0 auto', lineHeight: 1.7 }}>
        <Link href="/legal" style={{ color: C.primary, textDecoration: 'none', fontSize: '14px', marginBottom: '32px', display: 'inline-block' }}>
          Back to Legal
        </Link>
        <h1 style={{ fontSize: '28px', marginBottom: '16px' }}>Data deletion request</h1>
        {code && (
          <p>
            Confirmation code: <strong style={{ fontFamily: 'monospace' }}>{code}</strong>
          </p>
        )}
        <p style={{ color: C.textSecondary }}>
          We have received your request to delete your ValueSkins data. You have been signed out, and
          your account and personal data will be deleted within 30 days. Records we must keep by law,
          such as payment and tax records, are kept only for as long as the law requires.
        </p>
        <p style={{ color: C.textSecondary }}>
          For questions about this request, email founder@valueskins.com and quote your confirmation
          code.
        </p>
      </div>
    </div>
  );
}
