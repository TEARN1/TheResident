import test from 'node:test'
import assert from 'node:assert'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// GUARDRAILS FOR THE DESIGN TOKEN LAYER
//
// Every previous cleanup in this project came back, because nothing enforced
// it. The colour scheme is the worst case: ~2,100 hardcoded values across 50
// of 67 component files, which is what made a real light theme impossible and
// the app feel inescapably dark.
//
// These tests are what make the token layer permanent rather than a good
// intention. See docs/DESIGN-OVERHAUL.md items 21, 22 and 193.

const ROOT = join(import.meta.dirname, '..', '..')
const TOKENS = readFileSync(join(ROOT, 'src', 'styles', 'tokens.css'), 'utf8')

/** Relative luminance, per WCAG 2.1. */
function luminance(hex: string): number {
  let h = hex.replace('#', '')
  if (h.length === 3) h = h.split('').map(c => c + c).join('')
  const [r, g, b] = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255)
  const f = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

/** Read a token's hex value out of a specific block of tokens.css. */
function tokensIn(block: string): Map<string, string> {
  const out = new Map<string, string>()
  // Tokens are stored as channels ("250 248 243") so Tailwind's opacity
  // modifiers work; convert back to hex for the contrast maths.
  for (const m of block.matchAll(/--([a-z0-9-]+)-rgb:\s*(\d{1,3})\s+(\d{1,3})\s+(\d{1,3})\s*;/g)) {
    const hex = '#' + [m[2], m[3], m[4]]
      .map(n => Number(n).toString(16).padStart(2, '0')).join('')
    out.set('--' + m[1], hex)
  }
  return out
}

function blockFor(selector: string): string {
  const i = TOKENS.indexOf(selector)
  assert.ok(i !== -1, `tokens.css has no ${selector} block — the scanner is broken, not passing`)
  const start = TOKENS.indexOf('{', i)
  // Match to the closing brace of this block, allowing nested-free content.
  let depth = 0
  for (let j = start; j < TOKENS.length; j++) {
    if (TOKENS[j] === '{') depth++
    else if (TOKENS[j] === '}') { depth--; if (depth === 0) return TOKENS.slice(start, j) }
  }
  throw new Error(`unterminated ${selector} block`)
}

const LIGHT = tokensIn(blockFor(':root {'))
const DARK = tokensIn(blockFor(":root[data-theme='dark']"))

test('the scanner actually found tokens', () => {
  assert.ok(LIGHT.size > 10, `only ${LIGHT.size} light tokens parsed — the parser has broken, not passed`)
  assert.ok(DARK.size > 10, `only ${DARK.size} dark tokens parsed — the parser has broken, not passed`)
})

test('every colour token is defined in BOTH themes', () => {
  // A token defined only in light is a component that vanishes in dark.
  const missing = [...LIGHT.keys()].filter(k => !DARK.has(k))
  assert.deepStrictEqual(
    missing, [],
    '\n\nThese colour tokens exist in the light theme but not the dark one.\n' +
    'Anything using them will be wrong — or invisible — in dark mode:\n\n  ' +
    missing.join('\n  ') + '\n'
  )
})

// Foreground/background pairs that must be readable. This is the check that
// would have caught text-gray-500 at 4.10:1 — the app's most-used text
// colour, 355 occurrences, failing AA the whole time.
const PAIRS: Array<[string, string, number]> = [
  ['--text-primary', '--surface', 4.5],
  ['--text-primary', '--surface-raised', 4.5],
  ['--text-muted', '--surface', 4.5],
  ['--text-muted', '--surface-raised', 4.5],
  ['--text-subtle', '--surface', 4.5],
  ['--text-subtle', '--surface-raised', 4.5],
  ['--accent', '--surface', 4.5],
  ['--accent', '--surface-raised', 4.5],
  ['--success', '--surface', 4.5],
  ['--warning', '--surface', 4.5],
  ['--danger', '--surface', 4.5],
  ['--info', '--surface', 4.5],
  ['--text-on-accent', '--accent', 4.5]
]

for (const [themeName, tokens] of [['light', LIGHT], ['dark', DARK]] as const) {
  test(`${themeName} theme meets WCAG AA contrast`, () => {
    const failures: string[] = []
    for (const [fg, bg, min] of PAIRS) {
      const f = tokens.get(fg), b = tokens.get(bg)
      if (!f || !b) { failures.push(`  ${fg} or ${bg} is not defined in ${themeName}`); continue }
      const ratio = contrast(f, b)
      if (ratio < min) {
        failures.push(`  ${fg} (${f}) on ${bg} (${b}) = ${ratio.toFixed(2)}:1, needs ${min}:1`)
      }
    }
    assert.deepStrictEqual(
      failures, [],
      `\n\nThese ${themeName}-theme colour pairs are not readable:\n\n` +
      failures.join('\n') +
      '\n\nPick a darker (light theme) or lighter (dark theme) value. This is\n' +
      'not a style preference — below 4.5:1 the text is hard to read for\n' +
      'people with ordinary eyesight, in daylight, on a phone.\n'
    )
  })
}

test('the contrast check would catch a real failure', () => {
  // Without this, the tests above pass just as happily when the maths is
  // broken as when the palette is good. text-gray-500 on the OLD background
  // is the actual regression this suite exists to prevent.
  const ratio = contrast('#6b7280', '#0a0a0a')
  assert.ok(
    ratio < 4.5,
    `the canary scored ${ratio.toFixed(2)} — it should FAIL at 4.10; the contrast maths is wrong`
  )
  assert.ok(contrast('#FFFFFF', '#000000') > 20, 'black on white should be ~21:1; the maths is wrong')
})
