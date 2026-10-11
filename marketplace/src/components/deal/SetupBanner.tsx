// What the signed-in account still has to fill in before it can post a deal or
// apply to one, with a link to where it is done.
//
// Two forms of the same list: a short banner on the marketplace pages, and the
// full checklist at the top of Settings. Both read /api/profile/setup-status,
// which uses the same rule the server enforces, so what is shown here is
// exactly what would be refused.
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { C, withAlpha } from '@/theme/colors';

interface Status {
  role: 'creator' | 'brand';
  complete: boolean;
  items: Array<{ key: string; label: string; done: boolean }>;
}

export default function SetupBanner({ variant = 'banner' }: { variant?: 'banner' | 'checklist' }) {
  const [status, setStatus] = useState<Status | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/profile/setup-status', { credentials: 'include' });
      if (res.ok) setStatus(await res.json());
    } catch {
      /* nothing to show if it cannot be read; the server still enforces it */
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  // In Settings the list should tick off as each section is saved. Saving
  // happens in sibling components, so re-read on focus and on a short timer
  // while something is still outstanding.
  useEffect(() => {
    if (variant !== 'checklist' || !status || status.complete) return;
    const onFocus = () => { void load(); };
    window.addEventListener('focus', onFocus);
    const id = setInterval(() => { void load(); }, 5000);
    return () => { window.removeEventListener('focus', onFocus); clearInterval(id); };
  }, [variant, status, load]);

  if (!status) return null;
  const todo = status.items.filter((i) => !i.done);
  const action = status.role === 'brand' ? 'post a deal' : 'apply to deals';

  const box: React.CSSProperties = {
    background: C.surfaceAlt,
    border: `1px solid ${C.border}`,
    borderRadius: 12,
    padding: 28,
    marginBottom: variant === 'checklist' ? 24 : 12,
    fontSize: 14,
    color: C.text,
    lineHeight: 1.6,
  };

  if (variant === 'banner') {
    if (status.complete) return null;
    return (
      <div role="status" style={{ ...box, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <span>
          Finish setting up your account before you can {action}.{' '}
          {todo.length === 1 ? `One step left: ${todo[0].label.toLowerCase()}.` : `${todo.length} steps left.`}
        </span>
        <Link
          href="/settings?setup=1"
          style={{ color: C.text, fontWeight: 700, whiteSpace: 'nowrap', textDecoration: 'underline' }}
        >
          Go to Settings
        </Link>
      </div>
    );
  }

  return (
    <div role="status" style={box}>
      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>
        {status.complete
          ? `Your account is set up. You can ${action}.`
          : `Complete everything below before you can ${action}.`}
      </div>
      {status.items.map((i) => (
        <div key={i.key} style={{ display: 'flex', gap: 10, alignItems: 'baseline', padding: '2px 0' }}>
          <span
            aria-hidden="true"
            style={{ width: 34, fontSize: 12, fontWeight: 700, letterSpacing: '0.4px', color: i.done ? C.textMuted : C.text }}
          >
            {i.done ? 'DONE' : 'TO DO'}
          </span>
          <span style={{ color: i.done ? C.textMuted : C.text, textDecoration: i.done ? 'line-through' : 'none' }}>
            {i.label}
            <span style={{ position: 'absolute', left: -9999 }}>{i.done ? ' (done)' : ' (to do)'}</span>
          </span>
        </div>
      ))}
    </div>
  );
}
