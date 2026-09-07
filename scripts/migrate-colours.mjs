#!/usr/bin/env node
// One-shot migration: hardcoded colour utilities → design tokens.
//
// There were ~2,100 of these across 50 of 67 component files. Doing it by
// hand is a week of work and a hundred chances to typo a class name that
// silently does nothing; doing it with a script makes the mapping itself
// reviewable, which is the part that actually needs judgement.
//
// The mapping is ordered LONGEST FIRST so `text-gray-500` is never matched by
// a rule for `text-gray-5`, and every pattern is anchored on word boundaries
// so `bg-black` cannot match inside `bg-blackcurrant`.
//
//   node scripts/migrate-colours.mjs [--dry]
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { join, extname } from 'node:path'

const DRY = process.argv.includes('--dry')
const SRC = join(import.meta.dirname, '..', 'src')

// [pattern, replacement, why]
const MAP = [
  // ── Text ────────────────────────────────────────────────────────────────
  // text-gray-500 is the headline: 355 uses, 4.10:1 against the old
  // background, failing WCAG AA the whole time. It is secondary text, so it
  // becomes text-content-muted (7.15:1 light, 7.27:1 dark).
  ['text-gray-500', 'text-content-muted'],
  ['text-gray-400', 'text-content-muted'],
  ['text-gray-600', 'text-content-subtle'],
  ['text-gray-700', 'text-content-subtle'],
  ['text-gray-300', 'text-content'],
  ['text-gray-200', 'text-content'],
  ['text-gray-100', 'text-content'],
  ['text-white', 'text-content'],
  ['text-gold-primary', 'text-accent'],
  ['text-gold-secondary', 'text-accent'],

  // ── Surfaces ────────────────────────────────────────────────────────────
  // Ordered so the alpha variants are consumed before the bare one.
  ['bg-black/90', 'bg-surface-sunken/90'],
  ['bg-black/80', 'bg-surface-sunken/80'],
  ['bg-black/70', 'bg-surface-sunken/70'],
  ['bg-black/60', 'bg-surface-sunken/60'],
  ['bg-black/50', 'bg-surface-sunken/50'],
  ['bg-black/40', 'bg-surface-sunken/40'],
  ['bg-black/30', 'bg-surface-sunken/30'],
  ['bg-black/20', 'bg-surface-sunken/20'],
  ['bg-black', 'bg-surface'],
  ['bg-white/20', 'bg-surface-raised/20'],
  ['bg-white/10', 'bg-surface-raised/10'],
  ['bg-white/5', 'bg-surface-raised/5'],
  ['bg-white/2', 'bg-surface-raised/[0.02]'],
  ['bg-white', 'bg-surface-raised'],
  ['bg-gray-900', 'bg-surface'],
  ['bg-gray-800', 'bg-surface-raised'],
  ['bg-gold-primary', 'bg-accent'],
  ['bg-gold-secondary', 'bg-accent'],

  // ── Borders ─────────────────────────────────────────────────────────────
  // border-white/10 (238) and /5 (131) are invisible on a light ground.
  ['border-white/20', 'border-strong'],
  ['border-white/10', 'border-default'],
  ['border-white/5', 'border-subtle'],
  ['border-gold-primary', 'border-accent'],

  // ── Status ──────────────────────────────────────────────────────────────
  // One meaning, one colour. "Error" currently renders as text-red-400 in
  // some files and #ef4444 in others, so it does not look the same twice.
  ['text-red-300', 'text-danger'], ['text-red-400', 'text-danger'],
  ['text-red-500', 'text-danger'], ['text-red-600', 'text-danger'],
  ['bg-red-500/20', 'bg-danger/20'], ['bg-red-500/10', 'bg-danger/10'],
  ['bg-red-500', 'bg-danger'], ['bg-red-600', 'bg-danger'],
  ['border-red-500/40', 'border-danger/40'], ['border-red-500/30', 'border-danger/30'],
  ['border-red-500/20', 'border-danger/20'], ['border-red-400/30', 'border-danger/30'],

  ['text-green-300', 'text-success'], ['text-green-400', 'text-success'],
  ['text-green-500', 'text-success'], ['text-green-600', 'text-success'],
  ['text-emerald-400', 'text-success'], ['text-emerald-500', 'text-success'],
  ['bg-green-500/20', 'bg-success/20'], ['bg-green-500/10', 'bg-success/10'],
  ['bg-green-500', 'bg-success'], ['bg-emerald-500/10', 'bg-success/10'],
  ['border-green-500/30', 'border-success/30'], ['border-green-500/20', 'border-success/20'],
  ['border-emerald-500/20', 'border-success/20'],

  ['text-amber-300', 'text-warning'], ['text-amber-400', 'text-warning'],
  ['text-amber-500', 'text-warning'], ['text-yellow-400', 'text-warning'],
  ['text-yellow-500', 'text-warning'], ['text-orange-400', 'text-warning'],
  ['bg-amber-500/20', 'bg-warning/20'], ['bg-amber-500/10', 'bg-warning/10'],
  ['bg-yellow-500/10', 'bg-warning/10'], ['bg-amber-500', 'bg-warning'],
  ['border-amber-500/30', 'border-warning/30'], ['border-amber-500/20', 'border-warning/20'],
  ['border-yellow-500/20', 'border-warning/20'],

  ['text-blue-300', 'text-info'], ['text-blue-400', 'text-info'],
  ['text-blue-500', 'text-info'], ['text-sky-400', 'text-info'],
  ['text-indigo-400', 'text-info'], ['text-violet-400', 'text-info'],
  ['text-purple-400', 'text-info'], ['text-teal-400', 'text-info'],
  ['bg-blue-500/20', 'bg-info/20'], ['bg-blue-500/10', 'bg-info/10'],
  ['bg-blue-500', 'bg-info'],
  ['border-blue-500/30', 'border-info/30'], ['border-blue-500/20', 'border-info/20']
]

// Longest pattern first, so a shorter rule can never eat a longer one.
MAP.sort((a, b) => b[0].length - a[0].length)

function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    const f = join(dir, e)
    if (statSync(f).isDirectory()) walk(f, out)
    else if (['.tsx', '.ts'].includes(extname(e)) && !e.includes('.test.')) out.push(f)
  }
  return out
}

const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// text-black needs CONTEXT, not a blanket rule. Of its 119 uses, 56 sit on a
// solid `bg-gold-primary` fill — those want the on-accent token, which flips
// with the theme. The other 63 sit on tinted or neutral backgrounds
// (bg-gold-primary/10, bg-white/5, bg-green-500/10), where on-accent resolves
// to white in the light theme and would render white text on a white card.
// So: solid accent fill in the same class attribute → on-accent; otherwise
// it is just primary text.
function migrateTextBlack(src) {
  return src.replace(/(class(?:Name)?\s*=\s*[`"'])([^`"']*?)([`"'])/g, (m, open, body, close) => {
    if (!/(?<![\w-])text-black(?![\w-])/.test(body)) return m
    // Three cases, all three checked by hand against the real markup:
    //   solid gold fill in scope  → on-accent (72 uses)
    //   some OTHER background     → primary text (7 uses)
    //   no background at all      → on-accent; all 3 such cases sit inside a
    //                               solid bg-gold-primary parent element.
    const onSolidAccent = /(?<![\w-])bg-gold-primary(?![\w\-/])/.test(body)
    const hasOtherBg = /(?<![\w-])bg-[a-z]/.test(body)
    const to = onSolidAccent || !hasOtherBg ? 'text-content-on-accent' : 'text-content'
    return open + body.replace(/(?<![\w-])text-black(?![\w-])/g, to) + close
  })
}
let files = 0, total = 0
const perRule = new Map()

for (const file of walk(SRC)) {
  const before = readFileSync(file, 'utf8')
  let after = migrateTextBlack(before)
  {
    const n = (before.match(/(?<![\w-])text-black(?![\w-])/g) || []).length
    if (n) { perRule.set('text-black (context-aware)', (perRule.get('text-black (context-aware)') || 0) + n); total += n }
  }
  for (const [from, to] of MAP) {
    // (?<![\w-]) / (?![\w-]) so `bg-black` never matches inside `bg-black/40`
    // (already handled by ordering) nor inside a longer identifier.
    const re = new RegExp(`(?<![\\w-])${esc(from)}(?![\\w-])`, 'g')
    const hits = (after.match(re) || []).length
    if (hits) {
      perRule.set(from, (perRule.get(from) || 0) + hits)
      total += hits
      after = after.replace(re, to)
    }
  }
  if (after !== before) {
    files++
    if (!DRY) writeFileSync(file, after)
  }
}

console.log(`${DRY ? '[dry run] ' : ''}${total} replacements across ${files} files\n`)
for (const [k, v] of [...perRule].sort((a, b) => b[1] - a[1]).slice(0, 18)) {
  console.log(`  ${String(v).padStart(4)}  ${k}`)
}
