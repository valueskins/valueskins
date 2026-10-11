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
      style={{ display: 'flex', gap: 40, borderBottom: `1px solid ${C.border}`, marginBottom: 56 }}
    >
      {tabs.map((t) => {
        const on = t.key === active;
        return (
          <Link
            key={t.key}
            href={t.href}
            aria-current={on ? 'page' : undefined}
            style={{
              padding: '0 0 16px', textDecoration: 'none', textTransform: 'uppercase',
              fontSize: 12, letterSpacing: '0.14em',
              fontWeight: on ? 600 : 400,
              color: on ? C.text : C.textMuted,
              // The underline sits on the rule beneath the tabs.
              boxShadow: on ? `0 1px 0 ${C.text}` : 'none',
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
