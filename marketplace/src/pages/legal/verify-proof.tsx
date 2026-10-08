'use client';
import Link from 'next/link';
import { useState, useRef } from 'react';

const C = { bg: '#0A0A0A', text: '#F5F5F0', textSecondary: '#B8B4AC', primary: '#C8B89A', success: 'var(--c-accent)', error: '#f87171' };

export default function VerifyProof() {
  const [result, setResult] = useState<{ valid: boolean; checks: any; details: any; computedChainTip?: string; reportedChainTip?: string } | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleVerify = async () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file) { setError('Select a proof file'); return; }

    setError('');
    setLoading(true);
    try {
      const text = await file.text();
      const proof = JSON.parse(text);

      if (!proof.hashChain || !proof.signature) {
        setError('Invalid proof file: missing hashChain or signature');
        setLoading(false);
        return;
      }

      const resp = await fetch('/api/deals/verify-proof', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(proof),
      });
      const data = await resp.json();
      if (!resp.ok) { setError(data.error || 'Verification failed'); setLoading(false); return; }
      setResult(data);
    } catch (e) {
      setError('Failed to parse proof file');
    }
    setLoading(false);
  };

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, padding: '60px 20px' }}>
      <div style={{ maxWidth: '700px', margin: '0 auto' }}>
        <Link href="/" style={{ color: C.primary, textDecoration: 'none', fontSize: '14px', marginBottom: '32px', display: 'inline-block' }}>← Back</Link>
        <h1 style={{ fontSize: '28px', fontWeight: 800, marginBottom: '8px' }}>Verify Deal Proof</h1>
        <p style={{ color: C.textSecondary, marginBottom: '28px', fontSize: '14px' }}>
          Upload a proof file exported from a deal to verify its cryptographic integrity.
          This tool works independently, you don&apos;t need a ValueSkins account to verify.
        </p>

        <div style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid rgba(255,255,255,0.08)`, borderRadius: '12px', padding: '24px', marginBottom: '20px' }}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ fontSize: '12px', fontWeight: 600, color: C.textSecondary, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '8px' }}>Proof File (.json)</label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              style={{ width: '100%', padding: '10px', background: C.bg, border: `1px solid rgba(255,255,255,0.12)`, borderRadius: '8px', color: C.text, fontSize: '14px' }}
            />
          </div>
          <button
            onClick={handleVerify}
            disabled={loading}
            style={{
              width: '100%', padding: '12px', background: C.primary, border: 'none', borderRadius: '8px',
              color: '#fff', fontWeight: 700, cursor: loading ? 'wait' : 'pointer', fontSize: '14px', opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? 'Verifying...' : 'Verify Proof'}
          </button>
        </div>

        {error && (
          <div style={{ padding: '16px', background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: '8px', color: C.error, fontSize: '13px', marginBottom: '20px' }}>
            {error}
          </div>
        )}

        {result && (
          <div style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid rgba(255,255,255,0.08)`, borderRadius: '12px', padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <div style={{
                width: '12px', height: '12px', borderRadius: '50%',
                background: result.valid ? C.success : C.error,
              }} />
              <span style={{ fontSize: '18px', fontWeight: 700, color: result.valid ? C.success : C.error }}>
                {result.valid ? 'PASSED, Proof is authentic' : 'FAILED, Proof may be tampered'}
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <CheckRow label="Cryptographic signature" passed={result.checks.signatureValid} />
              <CheckRow label="Hash chain integrity" passed={result.checks.hashChainValid} />
              <CheckRow label="Individual message hashes" passed={!result.checks.individualHashIssues} />
            </div>

            <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: `1px solid rgba(255,255,255,0.08)`, fontSize: '12px', color: C.textSecondary }}>
              <p>Messages in proof: {result.details.messageCount}</p>
              <p>Algorithm: {result.details.algorithm}</p>
              <p>Signing key: {result.details.keyId}</p>
              <p>Exported: {result.details.exportedAt}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function CheckRow({ label, passed }: { label: string; passed: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
      <span style={{ color: passed ? C.success : C.error }}>
        {passed ? 'PASS' : 'FAIL'}
      </span>
      <span style={{ color: C.textSecondary }}>{label}</span>
    </div>
  );
}
