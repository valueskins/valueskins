// "Why brands should hire you", as text.
//
// This was a photo upload that kept the image in the browser, so no brand ever
// saw it. It is now a short piece of text saved to the account and shown to
// brands on the virtual resume.
import { useEffect, useState } from 'react';
import { C } from '@/theme/colors';

const MAX = 600;

export default function PitchText() {
  const [saved, setSaved] = useState('');
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    let live = true;
    fetch('/api/profile/pitch', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!live) return;
        if (d) { setSaved(d.pitch || ''); setText(d.pitch || ''); }
        setLoading(false);
      })
      .catch(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, []);

  async function save() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch('/api/profile/pitch', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pitch: text }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ ok: false, text: data.error || 'Could not save' });
      } else {
        setSaved(data.pitch ?? text);
        setText(data.pitch ?? text);
        setMessage({ ok: true, text: 'Saved' });
      }
    } catch {
      setMessage({ ok: false, text: 'Could not reach the server' });
    } finally {
      setBusy(false);
    }
  }

  const dirty = text.trim() !== saved.trim();
  const over = text.length > MAX;

  return (
    <div style={{ marginBottom: '16px' }}>
      <div style={{ fontSize: '12px', fontWeight: 700, color: C.textMuted, letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: '12px' }}>
        Why Brands Should Hire You
      </div>
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '12px', padding: '16px' }}>
        <label htmlFor="pitch-text" style={{ display: 'block', fontSize: '12px', color: C.textSecondary, marginBottom: '10px', lineHeight: 1.5 }}>
          A few sentences in your own words. Brands see this when they look at your resume.
        </label>
        <textarea
          id="pitch-text"
          value={text}
          onChange={(e) => { setText(e.target.value); setMessage(null); }}
          disabled={loading}
          rows={5}
          placeholder={loading ? 'Loading…' : 'What you make, who watches it, and what a brand gets from working with you.'}
          style={{
            width: '100%', background: C.bg, border: `1px solid ${over ? C.danger : C.border}`,
            borderRadius: '8px', color: C.text, padding: '10px 12px', fontSize: '13px',
            fontFamily: 'inherit', outline: 'none', resize: 'vertical', boxSizing: 'border-box',
            lineHeight: 1.5,
          }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginTop: 10 }}>
          <span style={{ fontSize: '11px', color: over ? C.danger : C.textMuted }}>
            {text.length}/{MAX}
            {message && (
              <span role="status" style={{ marginLeft: 10, color: message.ok ? C.textSecondary : C.danger }}>
                {message.text}
              </span>
            )}
          </span>
          <button
            onClick={save}
            disabled={busy || loading || !dirty || over}
            style={{
              padding: '9px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 700,
              border: 'none', color: C.onPrimary,
              background: busy || loading || !dirty || over ? C.border : C.primary,
              cursor: busy || loading || !dirty || over ? 'not-allowed' : 'pointer',
            }}
          >
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
