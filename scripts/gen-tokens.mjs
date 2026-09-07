#!/usr/bin/env node
// Generates src/styles/tokens.css from one palette definition.
//
// WHY GENERATED. The dark palette has to appear in three places — the
// [data-theme='dark'] block, the prefers-color-scheme media query for viewers
// who never chose, and nowhere else — and a token that drifts between them is
// a component that looks right in one and wrong in another. Writing them by
// hand guarantees that drift eventually. This writes all three from one
// source, so they cannot disagree.
//
// Colours are stored as CHANNELS ("250 248 243") rather than hex, because
// that is what lets Tailwind's <alpha-value> work: `bg-accent/10` compiles to
// rgb(var(--accent-rgb) / 0.1). The existing code uses colour-with-opacity
// over 400 times (border-white/10 alone appears 238 times), so without this
// the migration would have to invent a named token for every opacity step.
//
//   node scripts/gen-tokens.mjs
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

const hex = h => {
  const s = h.replace('#', '')
  const f = s.length === 3 ? s.split('').map(c => c + c).join('') : s
  return [0, 2, 4].map(i => parseInt(f.slice(i, i + 2), 16)).join(' ')
}

// Verified against WCAG AA before being written here; src/styles/tokens.test.ts
// re-checks every pair on every run and fails the build under 4.5:1.
const LIGHT = {
  surface: '#FAF8F3', 'surface-raised': '#FFFFFF', 'surface-sunken': '#F1EDE4',
  'text-primary': '#1A1712', 'text-muted': '#5A5348', 'text-subtle': '#6E6658',
  'text-on-accent': '#FFFFFF',
  accent: '#8A6A19', 'accent-hover': '#745714',
  success: '#1E7A3E', warning: '#8A5A00', danger: '#B3261E', info: '#1D4ED8',
  border: '#1A1712',
  'area-housing': '#8A6A19', 'area-community': '#1D4ED8',
  'area-services': '#0F766E', 'area-safety': '#B3261E'
}

const DARK = {
  surface: '#16140F', 'surface-raised': '#211E17', 'surface-sunken': '#100E0A',
  'text-primary': '#F5F1E8', 'text-muted': '#A9A296', 'text-subtle': '#8F8878',
  'text-on-accent': '#16140F',
  accent: '#D4AF37', 'accent-hover': '#E3C258',
  success: '#4ADE80', warning: '#FBBF24', danger: '#FF7A70', info: '#93C5FD',
  border: '#F5F1E8',
  'area-housing': '#D4AF37', 'area-community': '#93C5FD',
  'area-services': '#5EEAD4', 'area-safety': '#FF7A70'
}

const vars = p => Object.entries(p)
  .map(([k, v]) => `  --${k}-rgb: ${hex(v)};        /* ${v} */`).join('\n')

// Alpha steps used through the app, named so components never spell out a
// number: --border-default is one thing, not "the border at 12%".
const DERIVED = `
  /* Convenience aliases. Components should prefer the Tailwind utilities
     (bg-surface, text-content-muted); these exist for hand-written CSS. */
  --surface:         rgb(var(--surface-rgb));
  --surface-raised:  rgb(var(--surface-raised-rgb));
  --surface-sunken:  rgb(var(--surface-sunken-rgb));
  --text-primary:    rgb(var(--text-primary-rgb));
  --text-muted:      rgb(var(--text-muted-rgb));
  --text-subtle:     rgb(var(--text-subtle-rgb));
  --accent:          rgb(var(--accent-rgb));
  --accent-hover:    rgb(var(--accent-hover-rgb));
  --accent-soft:     rgb(var(--accent-rgb) / 0.12);
  --accent-border:   rgb(var(--accent-rgb) / 0.30);
  --success-soft:    rgb(var(--success-rgb) / 0.12);
  --warning-soft:    rgb(var(--warning-rgb) / 0.12);
  --danger-soft:     rgb(var(--danger-rgb) / 0.12);
  --info-soft:       rgb(var(--info-rgb) / 0.12);
  --border-default:  rgb(var(--border-rgb) / 0.13);
  --border-strong:   rgb(var(--border-rgb) / 0.24);
  --border-subtle:   rgb(var(--border-rgb) / 0.06);
  --surface-overlay: rgb(var(--surface-sunken-rgb) / 0.66);
  --text-on-accent:  rgb(var(--text-on-accent-rgb));
  --success:         rgb(var(--success-rgb));
  --warning:         rgb(var(--warning-rgb));
  --danger:          rgb(var(--danger-rgb));
  --info:            rgb(var(--info-rgb));
  /* Section accents. These need plain colour aliases as well as channels:
     a gradient referencing an UNDEFINED custom property is an invalid
     declaration, and the whole gradient is dropped. That silently turned the
     landing page's background-clip:text headline transparent — the text was
     simply gone, with nothing in the console to say so. */
  --area-housing:   rgb(var(--area-housing-rgb));
  --area-community: rgb(var(--area-community-rgb));
  --area-services:  rgb(var(--area-services-rgb));
  --area-safety:    rgb(var(--area-safety-rgb));`

const STATIC = `
  /* ── Elevation ────────────────────────────────────────────────────────
     Real shadows in light. The frosted-glass treatment (126 uses) is mud
     over a light ground; it is kept for dark mode only. */
  --elevation-1: 0 1px 2px rgb(var(--border-rgb) / 0.06);
  --elevation-2: 0 2px 8px rgb(var(--border-rgb) / 0.08);
  --elevation-3: 0 8px 24px rgb(var(--border-rgb) / 0.10);
  --elevation-4: 0 16px 48px rgb(var(--border-rgb) / 0.14);

  /* ── Radius ── four values, replacing the dozen currently in use. */
  --radius-sm: 6px; --radius-md: 10px; --radius-lg: 16px; --radius-full: 999px;

  /* ── Spacing ── 4px base. Nothing outside this scale. */
  --space-1: 4px;   --space-2: 8px;   --space-3: 12px;  --space-4: 16px;
  --space-5: 20px;  --space-6: 24px;  --space-8: 32px;  --space-10: 40px;
  --space-12: 48px; --space-16: 64px;

  /* ── Layout ──────────────────────────────────────────────────────────
     --nav-height replaces the guessed \`padding-bottom: 5rem\`, whose own
     comment called it "a deliberately generous flat estimate".
     --tap-min is Apple's floor; the app currently has 11px targets. */
  --content-max: 680px; --gutter: 16px;
  --nav-height: 64px; --header-height: 56px; --tap-min: 44px;

  /* ── Motion ── 120-240ms. Slower feels sluggish on a phone. */
  --duration-fast: 120ms; --duration-base: 180ms; --duration-slow: 240ms;
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);

  /* ── Focus ── defined once; focus styling is currently inconsistent. */
  --focus-ring: 0 0 0 2px var(--surface), 0 0 0 4px var(--accent);`

const HEADER = `/* ===========================================================================
   THE RESIDENT — DESIGN TOKENS
   ===========================================================================

   GENERATED BY scripts/gen-tokens.mjs — do not hand-edit, run the script.

   The dark palette must appear both in [data-theme='dark'] and in the
   prefers-color-scheme media query (for the majority of viewers, who never
   made an explicit choice). A token that drifts between those two is a
   component that looks right in one and wrong in the other, so both are
   written from one source here rather than maintained by hand.

   WHY THIS FILE EXISTS.

   Before it, the app did not have a theme. It had a colour scheme painted
   onto roughly 2,100 individual elements across 50 of 67 component files —
   \`bg-black\` 135 times, \`text-white\` 421 times, \`text-gray-500\` 355 times.
   globals.css said so itself:

     "The dashboard forces data-theme=night on every mount and is built
      almost entirely from hardcoded dark Tailwind utilities rather than
      these variables, so it can never honor a real light mode without that
      being rewritten wholesale."

   That is why the app felt inescapably dark. It was inescapable.

   THE RULES.

   1. Colours are named by ROLE, never value. \`--text-muted\`, not
      \`--gray-500\`. A role survives a redesign; a value does not.
   2. No component may name a colour. A \`#\` or a \`bg-black\` in a .tsx file
      is a bug, enforced by src/styles/tokens.test.ts.
   3. Every token exists in BOTH themes. One defined only in light is a
      component that disappears in dark.
   4. Every foreground/background pair is verified against WCAG AA. The
      values here are computed, not chosen; the weakest pair in either theme
      scores 4.72:1.
   5. Colours are stored as CHANNELS so Tailwind's opacity modifiers work:
      \`bg-accent/10\` → \`rgb(var(--accent-rgb) / 0.1)\`. The app uses
      colour-with-opacity over 400 times.

   LIGHT IS THE DEFAULT. This app is used outdoors, on phones, in South
   African sun. Dark mode is real and good, but it is the choice, not the
   cage.
   =========================================================================== */
`

const out = `${HEADER}
:root {
${vars(LIGHT)}
${DERIVED}
${STATIC}
}

/* ── Dark, chosen explicitly ─────────────────────────────────────────────
   Warm charcoal, not pure black: #0a0a0a is what made the old theme feel
   like a void rather than a room. */
:root[data-theme='dark'] {
${vars(DARK)}
}

/* ── Dark, because the phone is ──────────────────────────────────────────
   Guarded so an explicit light choice still beats a dark OS. */
@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) {
${vars(DARK)}
  }
}

/* Native controls, scrollbars and browser chrome follow the theme too —
   otherwise a select dropdown or date picker appears in the wrong one. */
:root { color-scheme: light; }
:root[data-theme='dark'] { color-scheme: dark; }
@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) { color-scheme: dark; }
}
`

writeFileSync(join(import.meta.dirname, '..', 'src', 'styles', 'tokens.css'), out)
console.log('→ wrote src/styles/tokens.css')
