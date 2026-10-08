'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { getLevel, getLevelInfo, getNextLevelInfo, getProgressToNext, LEVEL_THRESHOLDS } from '@/lib/levels';
import { useTheme } from '@/theme/ThemeContext';

// Loaded lazily so the equip animation costs nothing on a normal profile view.
const SlapToProfile = dynamic(() => import('@/features/valueskins/SlapToProfile'), { ssr: false });

// Presentational profile page — built to ui-specs/phase-2/Profile page.md.
// Every value here comes from that spec; visual reference profile-page-mock.svg.
// Currency is intentionally absent (GP3 / flagged.md F1).
//
// Kept free of auth and data-fetching so it can be rendered both by the real
// /profile/me page and by /demo/profile with sample data.

const FONT = "'Inter', 'Helvetica Neue', Arial, sans-serif";
const EASE = 'cubic-bezier(0.16,1,0.3,1)';
const WARM_SAND = '#C8B89A';
const DEEP_SAND = '#A08A5E';

// §8 colour tokens, re-mapped onto BRANDING §4.
//
// The spec's table was written against _global-conventions G5, which grounds
// light on #F4F3EE with #FFFFFF cards. §4 has neither colour, and §4 is the
// authority ("if a build disagrees with them, they win"). Light is therefore
// Off White with a tonal Off White→Warm Sand ramp, and cards sit flat and
// separate with the sand hairline rather than a white fill.
//
// Structure, spacing and motion still follow the spec exactly — only the
// colours are re-mapped.
const TOKENS = {
  dark: {
    bgA: '#0A0A0A', bgB: '#141310', bgC: '#1C1B17',
    head: '#F5F5F0', text: '#B8B4AC', muted2: '#8A867E',
    card: '#141310', hair: 'rgba(245,245,240,0.08)', divider: 'rgba(245,245,240,0.10)',
    cardbrd: 'rgba(200,184,154,0.16)', headerBg: 'rgba(10,10,10,0.7)',
  },
  light: {
    bgA: '#F5F5F0', bgB: '#F2EEE4', bgC: '#EAE2D0',
    head: '#0A0A0A', text: '#2D2D2D', muted2: '#6E6A60',
    card: '#F5F5F0', hair: 'rgba(160,138,94,0.18)', divider: 'rgba(160,138,94,0.20)',
    cardbrd: 'rgba(160,138,94,0.34)', headerBg: 'rgba(245,245,240,0.85)',
  },
} as const;

type Theme = 'dark' | 'light';
// Structural, so the dark and light token objects share one type.
type Tokens = { [K in keyof typeof TOKENS.dark]: string };

export interface ProfileData {
  display_name?: string;
  username?: string;
  profession?: string;
  location?: string;
  country?: string;
  languages?: string[];
  open_for_work?: boolean;
  is_verified?: boolean;
  deals_completed?: number;
  deals_this_month?: number;
  avg_rating?: number;
  repeat_rate?: number;
  on_time_rate?: number;
  avg_response_hours?: number;
  trust_score?: number;
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const on = () => setReduced(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return reduced;
}

function useViewportWidth() {
  const [w, setW] = useState(1200);
  useEffect(() => {
    const on = () => setW(window.innerWidth);
    on();
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return w;
}

// §6 — count-up 0 -> value. Starts ~0.45s, runs 1000ms, ease-out cubic 1-(1-p)^3.
function useCountUp(target: number, reduced: boolean, decimals: number) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (reduced) { setValue(target); return; }
    let raf = 0;
    let start = 0;
    const tick = (now: number) => {
      if (!start) start = now;
      const p = Math.min(1, (now - start) / 1000);
      setValue(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    const timer = setTimeout(() => { raf = requestAnimationFrame(tick); }, 450);
    return () => { clearTimeout(timer); cancelAnimationFrame(raf); };
  }, [target, reduced]);
  return decimals ? value.toFixed(decimals) : String(Math.round(value));
}

// §2 — ValueSkin pixel art: 12x12 grid, palette-tied (BRANDING §10.4),
// mirroring the reference sprite in profile-page-mock.svg.
// B was '#3B6FB0' — a blue, which BRANDING §4 bans outright and §10.4 rules out
// again ("palette-tied only ... No new colours"), despite the comment above
// claiming it was already palette-tied. It is now a themed brand neutral:
// charcoal on light, muted grey on dark, so the figure reads on either ground
// instead of vanishing into one of them (G5 rule 3 — always theme-paint).
const S = '#241C15', F = '#E8B98A', E = '#141414', B = 'var(--c-skin-garment)', A = '#C8B89A', _ = null;
const SKIN_GRID: (string | null)[][] = [
  [_, _, _, _, S, S, S, S, _, _, _, _],
  [_, _, _, S, S, S, S, S, S, _, _, _],
  [_, _, _, S, F, F, F, F, S, _, _, _],
  [_, _, _, S, F, E, F, E, S, _, _, _],
  [_, _, _, _, F, F, F, F, F, _, _, _],
  [_, _, _, _, F, F, F, F, F, _, _, _],
  [_, _, _, _, _, F, F, F, _, _, _, _],
  [_, _, _, B, B, B, B, B, B, _, _, _],
  [_, _, F, B, B, B, B, B, B, F, _, _],
  [_, _, F, B, B, B, B, B, B, F, _, _],
  [_, _, _, B, B, B, B, B, B, _, _, _],
  [_, _, _, _, _, A, A, _, _, _, _, _],
];

export function ValueSkinSprite({ size, mono }: { size: number; mono?: string }) {
  // `mono` flattens the sprite to a single colour — used by the drifting
  // background layer, where a full-colour figure reads as a pale smudge on the
  // light ground. G5 rule 3 wants the figure near-black on light and off-white
  // on dark, which a silhouette gives for free. Omitted everywhere else, so the
  // full-colour identity mark is unchanged.
  return (
    <svg
      width={size} height={size} viewBox="0 0 12 12"
      shapeRendering="crispEdges" aria-hidden="true"
      style={{ imageRendering: 'pixelated', display: 'block' }}
    >
      {SKIN_GRID.map((row, y) =>
        row.map((c, x) => (c ? <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill={mono ?? c} /> : null))
      )}
    </svg>
  );
}

interface StatCard {
  key: string; label: string; value: number; decimals: number;
  unit?: string; delta: string; deltaToken?: string; sand?: boolean;
}

export default function ProfileView({
  profile,
  onSettings,
  onEditProfile,
  embedded = false,
  containerWidth,
  justEquipped = false,
  onEquipAnimationDone,
}: {
  profile: ProfileData | null;
  onSettings?: () => void;
  onEditProfile?: () => void;
  /** Inside the app shell: drop the sticky header and page background, since the
   *  app already provides its own chrome and bottom tab spine. */
  embedded?: boolean;
  /** Width to resolve §7 breakpoints against. Defaults to the viewport; pass the
   *  column width when embedded so the layout responds to its container. */
  containerWidth?: number;
  /** Play the slap-to-profile equip animation into the ValueSkin frame. */
  justEquipped?: boolean;
  onEquipAnimationDone?: () => void;
}) {
  const reduced = useReducedMotion();
  const viewportWidth = useViewportWidth();
  const vw = containerWidth ?? viewportWidth;
  // Follows the global theme (Settings > Appearance). This used to be private
  // state defaulting to 'dark', which is why the profile rendered dark cards
  // inside a light app shell.
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [barWidth, setBarWidth] = useState(0);
  const frameRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setMounted(true); }, []);

  // §9 — data bindings. Stats are computed server-side and read-only (§5).
  const dealsDone = Number(profile?.deals_completed ?? 0);
  const level = getLevel(dealsDone);
  const levelInfo = getLevelInfo(level);
  const nextInfo = getNextLevelInfo(level);
  const progress = getProgressToNext(dealsDone);

  const stats: StatCard[] = useMemo(() => [
    { key: 'deals', label: 'Deals done', value: dealsDone, decimals: 0, delta: 'this month', deltaToken: `+${Number(profile?.deals_this_month ?? 0)}` },
    { key: 'rating', label: 'Avg rating', value: Number(profile?.avg_rating ?? 0), decimals: 1, unit: '/5', delta: `from ${dealsDone} brands`, sand: true },
    { key: 'repeat', label: 'Repeat clients', value: Number(profile?.repeat_rate ?? 0), decimals: 0, unit: '%', delta: 'came back for more' },
    { key: 'ontime', label: 'On-time delivery', value: Number(profile?.on_time_rate ?? 0), decimals: 0, unit: '%', delta: 'every deal, on time' },
    { key: 'response', label: 'Avg response', value: Number(profile?.avg_response_hours ?? 0), decimals: 0, unit: 'h', delta: 'fast to reply' },
    { key: 'trust', label: 'Trust score', value: Number(profile?.trust_score ?? 0), decimals: 0, unit: '%', delta: 'earned, not claimed', sand: true },
  ], [profile, dealsDone]);

  // §6 — level bar animates 0 -> target over 1s, starting ~0.45s
  useEffect(() => {
    const target = progress ? progress.progress * 100 : 100;
    if (reduced) { setBarWidth(target); return; }
    const timer = setTimeout(() => setBarWidth(target), 450);
    return () => clearTimeout(timer);
  }, [progress, reduced]);

  const t: Tokens = TOKENS[theme];
  const isNarrow = vw <= 760;   // §7
  const isTiny = vw <= 460;     // §7
  const shown = mounted || reduced;

  const displayName = profile?.display_name || 'Your profile';
  const handle = profile?.username || 'you';
  const profession = profile?.profession || 'Creator';
  const place = [profile?.location, profile?.country].filter(Boolean).join(', ');
  const languages: string[] = profile?.languages?.length ? profile.languages : ['English'];

  const pill: React.CSSProperties = { fontSize: '0.75rem', fontWeight: 600, padding: '6px 13px', borderRadius: 20, fontFamily: FONT, whiteSpace: 'nowrap' };
  const action: React.CSSProperties = { fontSize: '0.875rem', fontWeight: 600, padding: '11px 20px', borderRadius: 10, fontFamily: FONT, cursor: 'pointer' };
  const enter = (delay: number, dist: number) => ({
    opacity: shown ? 1 : 0,
    transform: shown ? 'translateY(0)' : `translateY(${dist}px)`,
    transition: reduced ? 'none' : `opacity 0.7s ${EASE} ${delay}s, transform 0.7s ${EASE} ${delay}s`,
  });

  const body = (
    <>
        {/* §1 — sticky header. Standalone only: inside the app shell the page
            already has a header and a bottom tab spine, and a second wordmark
            here would duplicate it (see P2-F2). */}
        {!embedded && (
        <header style={{
          position: 'sticky', top: 0, zIndex: 20,
          padding: isNarrow ? '16px 20px' : '16px 40px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          background: t.headerBg,
          backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
          borderBottom: `1px solid ${t.hair}`,
        }}>
          <span style={{ color: t.head, fontWeight: 700, fontSize: '1.25rem', letterSpacing: '0.18em' }}>VALUESKINS</span>

          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <button
              onClick={onSettings}
              style={{ fontSize: '0.875rem', fontWeight: 600, padding: '9px 18px', borderRadius: 9, border: `1px solid ${t.divider}`, background: 'transparent', color: t.head, fontFamily: FONT, cursor: 'pointer' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = t.cardbrd; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = t.divider; }}
            >
              Settings
            </button>

            {/* Theme lives in Settings > Appearance — one control, not one per page. */}
          </div>
        </header>
        )}

        {/* §0 — 900px content column */}
        <div style={{
          maxWidth: 900, margin: '0 auto',
          padding: embedded
            ? (isTiny ? '16px 16px 24px' : '20px 20px 28px')
            : (isTiny ? '34px 20px 80px' : '34px 28px 80px'),
        }}>

          {/* §2 — identity hero. Dark gradient in BOTH themes. */}
          <section style={{
            position: 'relative', borderRadius: 22,
            padding: isNarrow ? '30px 24px' : '36px 38px',
            display: 'flex', flexDirection: isNarrow ? 'column' : 'row',
            alignItems: 'center', gap: 34,
            textAlign: isNarrow ? 'center' : 'left',
            background: 'linear-gradient(155deg,#0A0A0A 0%,#17150F 55%,#22201A 100%)',
            border: '1px solid rgba(200,184,154,0.22)',
            boxShadow: '0 40px 80px -42px rgba(10,10,10,0.6)',
            overflow: 'hidden',
            ...enter(0.05, 16),
          }}>
            <span aria-hidden="true" style={{
              position: 'absolute', inset: 0, pointerEvents: 'none',
              background: 'radial-gradient(48% 70% at 86% -12%, rgba(160,138,94,0.24), transparent 62%)',
            }} />

            <div style={{ flex: 1, position: 'relative', minWidth: 0 }}>
              <h1 style={{ fontSize: 'clamp(1.875rem,4.5vw,2.5rem)', fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1, color: '#F5F5F0', margin: 0 }}>
                {displayName}
              </h1>

              <p style={{ marginTop: 8, marginBottom: 0, fontSize: '0.875rem', color: '#B8B4AC' }}>
                @{handle} · <b style={{ color: '#C9C5BC', fontWeight: 500 }}>{profession}</b>{place && ` · ${place}`}
              </p>

              <p style={{ marginTop: 14, marginBottom: 0, fontSize: '0.875rem', color: '#C9C5BC' }}>
                Speaks <b style={{ color: '#F5F5F0', fontWeight: 600 }}>{languages.join(', ')}</b>
                {profile?.open_for_work !== false && ' · Open for work'}
              </p>

              {/* V1: the ValueSkin Type layer (Passion / Professional / Hobby,
                  Project.md §28) is DROPPED, so no Type pill here — only the
                  earned Tier and verification. */}
              <div style={{ marginTop: 16, display: 'flex', gap: 9, flexWrap: 'wrap', justifyContent: isNarrow ? 'center' : 'flex-start' }}>
                <span style={{ ...pill, background: WARM_SAND, color: '#0A0A0A' }}>
                  {levelInfo.label} · Level {level}
                </span>
                {profile?.is_verified && (
                  <span style={{ ...pill, border: '1px solid rgba(200,184,154,0.35)', color: WARM_SAND }}>Verified</span>
                )}
              </div>

              <div style={{ marginTop: 20, display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: isNarrow ? 'center' : 'flex-start' }}>
                <button style={{ ...action, background: t.head, color: t.bgA, border: `1px solid ${t.head}` }}>
                  Watch pitch clip
                </button>
                <button
                  onClick={onEditProfile}
                  style={{ ...action, background: 'transparent', border: '1px solid rgba(245,245,240,0.28)', color: '#F5F5F0' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(245,245,240,0.6)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(245,245,240,0.28)'; }}
                >
                  Edit profile
                </button>
              </div>
            </div>

            {/* ValueSkin frame — no caption (§2). Also the landing target for
                the slap-to-profile equip animation. */}
            <div
              ref={frameRef}
              style={{
                position: 'relative', flex: 'none', width: 160, height: 160, borderRadius: 18,
                background: 'rgba(245,245,240,0.04)',
                border: '1px solid rgba(200,184,154,0.30)',
                boxShadow: 'inset 0 1px 0 rgba(245,245,240,0.08)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                animation: reduced
                  ? 'none'
                  : justEquipped
                    ? `vsShake 400ms ${EASE}, vsFloat 5s ${EASE} infinite 400ms`
                    : `vsFloat 5s ${EASE} infinite`,
              }}
            >
              {/* hidden while the flying clone is mid-air, so it appears to land */}
              <span style={{ opacity: justEquipped ? 0 : 1, transition: 'opacity 120ms linear 620ms' }}>
                <ValueSkinSprite size={126} />
              </span>
            </div>
          </section>

          {/* §3 — level progress card */}
          <section style={{
            marginTop: 18, borderRadius: 16, padding: '22px 24px',
            background: t.card, border: `1px solid ${t.cardbrd}`,
            ...enter(0.18, 12),
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <span style={{ fontSize: '0.9375rem', fontWeight: 700, color: t.head }}>{levelInfo.label}</span>
                <span style={{ fontSize: '0.75rem', fontWeight: 500, color: t.muted2, marginLeft: 6 }}>Level {level} · earned</span>
              </div>
              <span style={{ fontSize: '0.75rem', color: t.muted2 }}>
                {progress && nextInfo
                  ? `${Math.max(0, progress.needed - progress.current)} more deals → ${nextInfo.label}`
                  : `Top tier, ${LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1].label}`}
              </span>
            </div>

            <div style={{ marginTop: 12, height: 8, borderRadius: 4, background: t.divider, overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 4, width: `${barWidth}%`,
                background: `linear-gradient(90deg,${DEEP_SAND},${WARM_SAND})`,
                transition: reduced ? 'none' : `width 1s ${EASE}`,
              }} />
            </div>

            <p style={{ marginTop: 10, marginBottom: 0, fontSize: '0.78125rem', color: t.muted2 }}>
              Levels rise only on completed, paid deals, never bought, never gamed.
            </p>
          </section>

          {/* §4 — section label + trailing hairline */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '28px 0 14px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: t.muted2 }}>
              Track record
            </span>
            <span style={{ flex: 1, height: 1, background: t.divider }} />
          </div>

          {/* §5 — stats grid: 3 across, 2 across <=760, 1 across <=460 */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: isTiny ? '1fr' : isNarrow ? '1fr 1fr' : 'repeat(3,1fr)',
            gap: 14,
          }}>
            {stats.map((s, i) => (
              <StatTile key={s.key} stat={s} t={t} reduced={reduced} shown={shown} delay={0.24 + i * 0.06} />
            ))}
          </div>

          <p style={{ marginTop: 12, marginBottom: 0, fontSize: '0.75rem', color: t.muted2 }}>
            Stats are earned automatically from completed deals, they can&apos;t be edited or bought.
          </p>
        </div>

      <style jsx global>{`
        @keyframes vsFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-5px); }
        }
        @media (prefers-reduced-motion: reduce) {
          @keyframes vsFloat { 0%, 100% { transform: none; } }
        }
      `}</style>

      {justEquipped && (
        <SlapToProfile active targetRef={frameRef} onDone={onEquipAnimationDone} />
      )}
    </>
  );

  // Embedded: the app shell owns the background and chrome, so return the
  // content as-is. Standalone: wrap it in the §0 full-bleed fixed background.
  if (embedded) return body;

  return (
    <div style={{
      minHeight: '100dvh',
      background: `linear-gradient(150deg, ${t.bgA} 0%, ${t.bgB} 60%, ${t.bgC} 100%)`,
      backgroundAttachment: 'fixed',
      fontFamily: FONT,
      overflowX: 'hidden',
    }}>
      {body}
    </div>
  );
}

function StatTile({ stat, t, reduced, shown, delay }: { stat: StatCard; t: Tokens; reduced: boolean; shown: boolean; delay: number }) {
  const value = useCountUp(stat.value, reduced, stat.decimals);
  return (
    <div style={{
      borderRadius: 16, padding: '22px 24px',
      background: t.card, border: `1px solid ${t.cardbrd}`,
      opacity: shown ? 1 : 0,
      transform: shown ? 'translateY(0)' : 'translateY(12px)',
      transition: reduced ? 'none' : `opacity 0.6s ${EASE} ${delay}s, transform 0.6s ${EASE} ${delay}s`,
    }}>
      <div style={{ fontSize: '0.75rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: t.muted2 }}>
        {stat.label}
      </div>
      <div style={{ fontSize: '1.875rem', fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1, marginTop: 8, color: stat.sand ? DEEP_SAND : t.head }}>
        {value}
        {stat.unit && <span style={{ fontSize: '0.875rem', fontWeight: 500, color: t.muted2 }}>{stat.unit}</span>}
      </div>
      <div style={{ marginTop: 8, fontSize: '0.75rem', color: t.muted2 }}>
        {stat.deltaToken && <span style={{ color: DEEP_SAND, fontWeight: 600 }}>{stat.deltaToken} </span>}
        {stat.delta}
      </div>
    </div>
  );
}
