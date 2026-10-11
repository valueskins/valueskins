'use client';
import { useEffect, useRef, useState } from 'react';
import { ValueSkinSprite } from '@/features/profiles/ProfileView';

// Slap-to-profile — built to ui-specs/phase-2/slap-animation-storyboard.svg.
// Transform and opacity only; reduced motion skips the flight entirely.
//
//   1 · Rises in   220px clone at screen centre, scale .3->1.15, rotate -8->3
//                  ~320ms ease-OUT
//   2 · Slams      FLIP to the ValueSkin frame, translate + scale(~.53)
//                  ~340ms ease-IN (accelerating reads as impact)
//   3 · Lands      sand ring pulse 500ms + card shake 400ms, Equipped toast ~3.2s

const RISE_MS = 320;
const SLAM_MS = 340;
const RING_MS = 500;
const SHAKE_MS = 400;
const TOAST_MS = 3200;
const CLONE_PX = 220;

type Phase = 'idle' | 'rise' | 'slam' | 'land';

export default function SlapToProfile({
  active,
  targetRef,
  onDone,
}: {
  /** Flip to true to play the sequence once. */
  active: boolean;
  /** The ValueSkin frame the skin slams into. */
  targetRef: React.RefObject<HTMLElement>;
  onDone?: () => void;
}) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [showToast, setShowToast] = useState(false);
  const [target, setTarget] = useState<{ x: number; y: number; size: number } | null>(null);
  const played = useRef(false);

  useEffect(() => {
    if (!active || played.current) return;
    played.current = true;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      // Skip the flight; land straight on the result state.
      setShowToast(true);
      const t = setTimeout(() => { setShowToast(false); onDone?.(); }, TOAST_MS);
      return () => clearTimeout(t);
    }

    const el = targetRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setTarget({ x: r.left + r.width / 2, y: r.top + r.height / 2, size: r.width });

    const timers: ReturnType<typeof setTimeout>[] = [];
    setPhase('rise');
    timers.push(setTimeout(() => setPhase('slam'), RISE_MS));
    timers.push(setTimeout(() => { setPhase('land'); setShowToast(true); }, RISE_MS + SLAM_MS));
    timers.push(setTimeout(() => setPhase('idle'), RISE_MS + SLAM_MS + RING_MS));
    timers.push(setTimeout(() => { setShowToast(false); onDone?.(); }, RISE_MS + SLAM_MS + TOAST_MS));
    return () => timers.forEach(clearTimeout);
  }, [active, targetRef, onDone]);

  if (!active) return null;

  const centreX = typeof window !== 'undefined' ? window.innerWidth / 2 : 0;
  const centreY = typeof window !== 'undefined' ? window.innerHeight / 2 : 0;

  // Beat 2 scales the 220px clone down onto the frame (~.53 at a 160px frame).
  const landScale = target ? (target.size * 0.79) / CLONE_PX : 0.53;

  const flying = phase === 'rise' || phase === 'slam';

  return (
    <>
      {flying && target && (
        <div
          aria-hidden="true"
          style={{
            position: 'fixed',
            left: 0,
            top: 0,
            width: CLONE_PX,
            height: CLONE_PX,
            zIndex: 10001,
            pointerEvents: 'none',
            transformOrigin: 'center center',
            transform:
              phase === 'rise'
                ? `translate(${centreX - CLONE_PX / 2}px, ${centreY - CLONE_PX / 2}px) scale(1.15) rotate(3deg)`
                : `translate(${target.x - CLONE_PX / 2}px, ${target.y - CLONE_PX / 2}px) scale(${landScale}) rotate(0deg)`,
            opacity: phase === 'rise' ? 1 : 1,
            transition:
              phase === 'rise'
                ? `transform ${RISE_MS}ms cubic-bezier(0.16,1,0.3,1)`
                : `transform ${SLAM_MS}ms cubic-bezier(0.55,0,1,0.45)`,
          }}
        >
          <ValueSkinSprite size={CLONE_PX} />
        </div>
      )}

      {/* Beat 3 — sand ring pulse over the frame */}
      {phase === 'land' && target && (
        <span
          aria-hidden="true"
          style={{
            position: 'fixed',
            left: target.x,
            top: target.y,
            width: target.size,
            height: target.size,
            marginLeft: -target.size / 2,
            marginTop: -target.size / 2,
            borderRadius: '50%',
            border: '2px solid rgba(200,184,154,0.35)',
            zIndex: 10000,
            pointerEvents: 'none',
            animation: `vsRing ${RING_MS}ms cubic-bezier(0.16,1,0.3,1) forwards`,
          }}
        />
      )}

      {showToast && (
        <div
          role="status"
          style={{
            position: 'fixed',
            left: '50%',
            bottom: 96,
            transform: 'translateX(-50%)',
            zIndex: 10002,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '9px 18px',
            borderRadius: 17,
            background: '#0A0A0A',
            border: '1px solid rgba(200,184,154,0.4)',
            color: '#C8B89A',
            fontSize: '0.75rem',
            fontWeight: 700,
            fontFamily: "'Poppins', 'Helvetica Neue', Arial, sans-serif",
          }}
        >
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#C8B89A' }} />
          Equipped
        </div>
      )}

      <style jsx global>{`
        @keyframes vsRing {
          0%   { transform: scale(0.7); opacity: 0.9; }
          100% { transform: scale(1.6); opacity: 0; }
        }
        @keyframes vsShake {
          0%, 100% { transform: translateX(0); }
          25%      { transform: translateX(-3px); }
          75%      { transform: translateX(3px); }
        }
        @media (prefers-reduced-motion: reduce) {
          @keyframes vsRing  { 0%, 100% { opacity: 0; } }
          @keyframes vsShake { 0%, 100% { transform: none; } }
        }
      `}</style>
    </>
  );
}

export const SLAP_SHAKE_MS = SHAKE_MS;
