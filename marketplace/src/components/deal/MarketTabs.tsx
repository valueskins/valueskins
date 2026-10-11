// The two screens of the marketplace: what is happening now, and what is done.
// Shown at the top of every marketplace page, for both roles.
import Link from 'next/link';
import { C } from '@/theme/colors';

export default function MarketTabs({
  active,
  role,
}: {
  active: 'current' | 'past';
  role: 'brand' | 'creator';
}) {
  const tabs = [
    // A brand's current deals are the ones it posted; a creator's start at the
    // open deals it can apply to.
    { key: 'current', label: 'Current deals', href: role === 'brand' ? '/campaigns' : '/deals/browse' },
    { key: 'past', label: 'Past deals', href: '/deals/past' },
  ] as const;

  return (
    <nav
      aria-label="Deals"
      style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0, marginBottom: 20,
        border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden',
      }}
    >
      {tabs.map((t, i) => {
        const on = t.key === active;
        return (
          <Link
            key={t.key}
            href={t.href}
            aria-current={on ? 'page' : undefined}
            style={{
              padding: '11px 12px', textAlign: 'center', textDecoration: 'none',
              fontSize: 13, fontWeight: on ? 700 : 500,
              color: on ? C.text : C.textMuted,
              background: on ? C.surface : 'transparent',
              borderLeft: i === 0 ? 'none' : `1px solid ${C.border}`,
              boxShadow: on ? `inset 0 -2px 0 ${C.accent}` : 'none',
              transition: 'none',
            }}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
