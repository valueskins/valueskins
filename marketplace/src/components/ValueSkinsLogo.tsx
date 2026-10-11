'use client';

import React from 'react';

// ValueSkins wordmark — spec per BRANDING.md §3.
// The word IS the logo: no icon, no symbol. Do not add one.
//
// Colour follows the live theme by default. The three colours resolve to CSS
// custom properties (--c-logo-*) defined per theme in styles/globals.css, so
// the mark re-skins with the rest of the product.
//
// It used to take a hardcoded `theme` prop that baked in a hex. Every caller
// that passed theme="light" rendered a #0A0A0A wordmark, which is invisible
// on the near-black dark surface — the front door lost its own brand mark.
// Pass `theme` now ONLY to pin the mark against a surface that is itself
// hardcoded to one treatment (e.g. the login page's fixed dark hero).

const FONT_STACK = "'Poppins', 'Helvetica Neue', Arial, sans-serif";

// BRANDING §3 exact values, for the pinned cases.
const FIXED = {
  dark:  { word: 'var(--c-logo-word)', tag: 'var(--c-logo-tag)', dot: 'var(--c-logo-dot)' },
  light: { word: 'var(--c-logo-word)', tag: 'var(--c-logo-tag)', dot: 'var(--c-logo-dot)' },
};

const THEMED = { word: 'var(--c-logo-word)', tag: 'var(--c-logo-tag)', dot: 'var(--c-logo-dot)' };

interface LogoProps {
  /** Omit to follow the live theme. Pass a value only to pin against a fixed surface. */
  theme?: 'dark' | 'light';
  /** Wordmark font size in px. Tagline scales at 25%. */
  size?: number;
  /** Hide the tagline lockup — use for small placements (nav, footer). */
  hideTagline?: boolean;
  style?: React.CSSProperties;
}

export function ValueSkinsLogo({ theme, size = 44, hideTagline = false, style }: LogoProps) {
  const c = theme ? FIXED[theme] : THEMED;

  return (
    <div
      role="img"
      aria-label="ValueSkins"
      style={{ fontFamily: FONT_STACK, textAlign: 'center', lineHeight: 1, ...style }}
    >
      <div style={{ color: c.word, fontWeight: 700, fontSize: size, letterSpacing: '0.18em' }}>
        VALUESKINS
      </div>
    </div>
  );
}

export default ValueSkinsLogo;
