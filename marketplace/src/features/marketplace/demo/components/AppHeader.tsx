'use client';

import ValueSkinsLogo from '@/components/ValueSkinsLogo';
import { C } from '@/theme/colors';

// The app spine, moved from the floor to the top and sat beside the wordmark.
//
// It was a fixed bottom bar with 10px labels and a bare dot. Up here it can
// carry the brand, so the wordmark and the nav read as one panel instead of
// the wordmark being absent from the app entirely.
//
// The wordmark follows the live theme — ValueSkinsLogo resolves to the
// --c-logo-* tokens, which are BRANDING §3's exact values per treatment
// (#0A0A0A/#2D2D2D/#A08A5E on light, #F5F5F0/#B8B4AC/#C8B89A on dark).
//
// Icons are thin line marks on currentColor: no icon set exists in the brand,
// and §1 rules out emoji, so these are drawn to the same weight as the ones
// already in MarketplaceLayout rather than pulled from a library.

export type AppView = 'profile' | 'mim' | 'store' | 'settings';

const STROKE = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

function IconProfile() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" {...STROKE} aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" />
    </svg>
  );
}
function IconMarket() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" {...STROKE} aria-hidden="true">
      <path d="M3 9.5 4.5 4h15L21 9.5" />
      <path d="M3 9.5h18" />
      <path d="M5 9.5V20h14V9.5" />
      <path d="M9.5 20v-5h5v5" />
    </svg>
  );
}
/* ── [v1 COMMENTED OUT] IconStore was only used by the disabled 'Niche' tab. See Things-Commented-Out.md. */
// function IconStore() {
//   return (
//     <svg width="20" height="20" viewBox="0 0 24 24" {...STROKE} aria-hidden="true">
//       <path d="M6 8h12l1 12H5L6 8Z" />
//       <path d="M9 8V6a3 3 0 0 1 6 0v2" />
//     </svg>
//   );
// }
function IconSettings() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" {...STROKE} aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v2.5M12 18.5V21M21 12h-2.5M5.5 12H3M18.4 5.6l-1.8 1.8M7.4 16.6l-1.8 1.8M18.4 18.4l-1.8-1.8M7.4 7.4 5.6 5.6" />
    </svg>
  );
}
function IconCalendar() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" {...STROKE} aria-hidden="true">
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M4 10h16" />
      <path d="M8 4v-2M16 4v-2" />
    </svg>
  );
}

const TABS: { view: AppView; label: string; Icon: () => JSX.Element }[] = [
  { view: 'profile',  label: 'Profile',  Icon: IconProfile },
  { view: 'mim',      label: 'Market',   Icon: IconMarket },
  /* ── [v1 COMMENTED OUT] 'Niche' tab (store). v1 = lifestyle & fashion only, niche-agnostic creators. See Things-Commented-Out.md. */
  // { view: 'store',    label: 'Niche',    Icon: IconStore },
  { view: 'settings', label: 'Settings', Icon: IconSettings },
];

export default function AppHeader({
  activeView,
  onSelect,
}: {
  activeView: string;
  onSelect: (v: AppView) => void;
}) {
  return (
    <>
    {/* Published so the store's search bar and the market's header — both
        sticky at top:0 — start below this one instead of sliding under it. */}
    <style>{`:root { --vs-header-h: 73px; }`}</style>
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 300,
        background: C.bg,
        borderBottom: `1px solid ${C.border}`,
        // Frosted so content scrolling under it stays legible without the bar
        // needing to be opaque enough to feel heavy.
        backdropFilter: 'blur(12px)',
      }}
    >
      <div
        style={{
          maxWidth: 'min(1760px, calc(100vw - 48px))',
          margin: '0 auto',
          padding: '14px 0',
          display: 'flex',
          alignItems: 'center',
          gap: '28px',
          flexWrap: 'wrap',
        }}
      >
        {/* G1: the wordmark as plain text — no pill, no container. */}
        <button
          onClick={() => onSelect('profile')}
          aria-label="ValueSkins home"
          style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', flex: 'none' }}
        >
          <ValueSkinsLogo size={20} hideTagline />
        </button>

        <nav aria-label="Primary" style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1, flexWrap: 'wrap' }}>
          {TABS.map(({ view, label, Icon }) => {
            const active = activeView === view;
            return (
              <button
                key={view}
                onClick={() => onSelect(view)}
                aria-current={active ? 'page' : undefined}
                onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = 'rgba(200,184,154,0.07)'; }}
                onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent'; }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '9px',
                  minHeight: '44px',
                  padding: '0 14px',
                  borderRadius: '8px',
                  border: 'none',
                  background: active ? 'rgba(200,184,154,0.12)' : 'transparent',
                  color: active ? C.text : C.textMuted,
                  // Was 10px on the bottom bar. This is the readable size.
                  fontSize: '0.9375rem',
                  fontWeight: active ? 600 : 500,
                  fontFamily: "'Poppins', 'Helvetica Neue', Arial, sans-serif",
                  cursor: 'pointer',
                  transition: 'background 160ms cubic-bezier(0.16,1,0.3,1), color 160ms linear',
                }}
              >
                <Icon />
                <span>{label}</span>
              </button>
            );
          })}
        </nav>

        {/* The theme control used to sit here. Removed on request — light and
            dark both still work and the switch lives in Settings > Appearance,
            which is where a preference that persists per user belongs. */}
      </div>
    </header>
    </>
  );
}
