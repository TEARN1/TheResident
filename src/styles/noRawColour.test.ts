import test from 'node:test'
import assert from 'node:assert'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, extname } from 'node:path'

// NO COMPONENT MAY NAME A COLOUR.
//
// This is the guardrail for the whole design system. Before it, ~2,100
// hardcoded colour values lived across 50 of 67 component files —
// `text-white` 427 times, `text-gray-500` 355 times (at 4.10:1, failing
// accessibility the entire time), `border-white/10` 238 times. That is what
// made a real light theme impossible: there was no theme, only a colour
// scheme painted onto two thousand elements.
//
// The migration is done. This is what stops it happening again. Every
// previous cleanup in this project came back precisely because nothing
// enforced it.
//
// See docs/DESIGN-OVERHAUL.md item 21.

const ROOT = join(import.meta.dirname, '..', '..')
const SRC = join(ROOT, 'src')

// Tailwind utilities that name a literal colour instead of a role.
const BANNED = [
  'bg-black', 'bg-white', 'text-white', 'text-black',
  'border-white', 'border-black',
  // Gradient stops were missed by the first migration, which is how a dark
  // `from-content-muted to-black` placeholder survived into the light theme
  // as a black hole where a photo should be.
  'from-black', 'to-black', 'via-black',
  'from-white', 'to-white', 'via-white',
  ...['gray', 'red', 'green', 'blue', 'yellow', 'amber', 'emerald', 'rose',
      'teal', 'violet', 'purple', 'orange', 'indigo', 'sky', 'slate', 'zinc',
      'neutral', 'stone', 'lime', 'cyan', 'fuchsia', 'pink']
    .flatMap(c => ['bg', 'text', 'border', 'ring', 'from', 'to', 'via', 'divide',
                   'placeholder', 'shadow'].map(p => `${p}-${c}-`))
]

// Genuine exceptions, each with its reason. Keep this list SHORT; an entry
// here is a promise that the colour cannot follow the theme, not a way to
// skip the work.
const ALLOWED_FILES = new Set<string>([
  // Brand marks belonging to other companies. Facebook blue is Facebook blue
  // in both themes; theming someone else's logo is wrong, not clever.
  'src/app/auth/page.tsx',
  // Gossip post backdrops are ARTWORK a resident picks for their own post,
  // like a wallpaper. They must look the same to everyone who sees that post,
  // regardless of the theme the VIEWER is using, so they are deliberately
  // literal — see the comment on BACKGROUND_PRESETS.
  'src/app/dashboard/gossip/page.tsx',
  // The <meta name="theme-color"> tags are per-scheme by definition: each one
  // names the colour for one scheme, so neither can be a theme-following token.
  'src/app/layout.tsx',
  // VibeMap was allowlisted here with the reason "markers are drawn to a
  // canvas/Leaflet layer that takes colour strings, not CSS, so a var() would
  // resolve to nothing". THAT WAS WRONG. Leaflet's divIcon takes an HTML
  // string that goes into the DOM, so `style="border:2px solid var(--x)"`
  // resolves exactly like any other CSS — proven by doing it (item 145).
  //
  // It stays listed for the CLASS-based check above only because its Leaflet
  // path options (polyline stroke and similar) are passed as plain strings
  // where a custom property genuinely may not resolve. The CSS-property check
  // below does NOT exempt it, which is the half that was hiding nine white
  // marker rings.
  'src/app/dashboard/components/map/VibeMap.tsx'
])

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const f = join(dir, e)
    if (statSync(f).isDirectory()) walk(f, out)
    else if (['.tsx', '.ts'].includes(extname(e)) && !e.includes('.test.')) out.push(f)
  }
  return out
}

const files = walk(SRC)

test('the scanner is actually looking at files', () => {
  assert.ok(files.length > 30, `only ${files.length} files scanned — the walker has broken, not passed`)
})

test('no component names a literal colour', () => {
  const offences: string[] = []
  for (const file of files) {
    const rel = file.slice(ROOT.length + 1).replace(/\\/g, '/')
    if (ALLOWED_FILES.has(rel)) continue
    const src = readFileSync(file, 'utf8')
    const lines = src.split('\n')
    lines.forEach((line, i) => {
      // Comments explaining the migration legitimately mention the old names.
      const code = line.replace(/\/\/.*$/, '').replace(/\/\*.*?\*\//g, '')
      for (const b of BANNED) {
        if (new RegExp(`(?<![\\w-])${b.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(code)) {
          offences.push(`  ${rel}:${i + 1}  ${b}`)
          return
        }
      }
      // Raw hex, outside comments.
      const hex = code.match(/#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?\b/)
      if (hex) offences.push(`  ${rel}:${i + 1}  ${hex[0]}`)
    })
  }

  assert.deepStrictEqual(
    offences.slice(0, 40), [],
    `\n\n${offences.length} place(s) name a colour instead of a role.\n\n` +
    'A literal colour cannot follow the theme, so it is right in one theme\n' +
    'and wrong in the other. Use a token: bg-surface, text-content-muted,\n' +
    'border-default, text-danger. The full set is in src/styles/tokens.css.\n\n' +
    offences.slice(0, 40).join('\n') +
    (offences.length > 40 ? `\n  … and ${offences.length - 40} more` : '') + '\n'
  )
})

test('the scanner would catch a planted violation', () => {
  // Without this, the test above passes just as happily when the regex is
  // broken as when the code is clean. A regex-based check in this project has
  // already shipped silently inert once (\b vs \y in POSIX); its canary is
  // the only reason that was caught.
  const sample = '<div className="bg-black text-gray-500">x</div>'
  const hit = BANNED.some(b =>
    new RegExp(`(?<![\\w-])${b.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(sample))
  assert.ok(hit, 'the banned-utility regex no longer matches bg-black — it is broken')
  assert.ok(/#[0-9a-fA-F]{6}\b/.test('color: #D4AF37'), 'the hex regex is broken')
})

// ── The blind spot this check had ─────────────────────────────────────────
//
// Everything above scans Tailwind utility CLASSES. The map's Leaflet markers
// are built as raw HTML strings inside template literals:
//
//   html: `<div style="...;border:2px solid white">`
//
// Nine `solid white` rings, two `color:white` labels and two rgba() glows
// lived there through the entire colour migration, invisible to this file,
// because none of them is a class. In dark mode a white ring is the brightest
// thing on the map, so every marker read as urgent.
//
// This catches CSS-property colours wherever they appear — inline styles,
// template literals, divIcon HTML.

// The trailing boundary is (?![\w-]) and NOT \b, which is the bug my own
// canary caught: \b after `)` can never match, because `)` is not a word
// character and neither is whatever follows it. With \b there, this pattern
// silently skipped every rgba() and the check only appeared to pass because
// the glows had already been replaced by hand. A guardrail that cannot see
// half of what it claims to cover is worse than none.
const CSS_COLOUR = /(?:background|background-color|color|border(?:-\w+)?|box-shadow|fill|stroke)\s*:\s*[^;"'`}]*?\b(white|black|rgba?\([^)]*\)|#[0-9a-fA-F]{3,8})(?![\w-])/g

/**
 * Files where a literal colour in a CSS property is correct. Keep this
 * shorter than ALLOWED_FILES — the whole point of this check is the cases
 * that list was letting through.
 */
const CSS_COLOUR_EXEMPT = new Set<string>([
  // Per-scheme <meta name="theme-color">: each names the colour for ONE
  // scheme, so neither can follow the theme.
  'src/app/layout.tsx',
  // Resident-chosen post artwork, deliberately literal for every viewer.
  'src/app/dashboard/gossip/page.tsx'
])

test('no CSS property names a literal colour', () => {
  const offences: string[] = []
  for (const file of files) {
    const rel = file.slice(ROOT.length + 1).replace(/\\/g, '/')
    // Deliberately NOT ALLOWED_FILES: that list exempts whole files from the
    // class-based check for reasons that do not apply to CSS properties, and
    // VibeMap being on it is exactly why nine hardcoded marker rings survived
    // the entire colour migration.
    if (CSS_COLOUR_EXEMPT.has(rel)) continue
    const src = readFileSync(file, 'utf8')
    for (const m of src.matchAll(new RegExp(CSS_COLOUR.source, 'g'))) {
      // A var() fallback is still token-driven; `transparent` and `none` are
      // not colours anyone can get wrong.
      if (/var\(/.test(m[0])) continue
      const line = src.slice(0, m.index).split('\n').length
      offences.push(`  ${rel}:${line}  ${m[0].trim().slice(0, 60)}`)
    }
  }
  assert.deepStrictEqual(
    offences, [],
    '\n\nThese name a colour in a CSS property rather than using a token.\n' +
    'Tokens work in both themes; a literal does not:\n\n' + offences.join('\n') + '\n'
  )
})

test('the CSS-property scan would catch a planted violation', () => {
  // A fresh regex per assertion: CSS_COLOUR carries the `g` flag, and .test()
  // on a global regex advances lastIndex between calls, so reusing it makes
  // the second assertion depend on where the first one stopped.
  const re = () => new RegExp(CSS_COLOUR.source, 'g')
  // Both shapes that actually occurred in this codebase.
  assert.ok(re().test('html: `<div style="border:2px solid white">`'))
  assert.ok(re().test('box-shadow:0 0 0 4px rgba(34,197,94,0.25)'))
  // And a token does NOT trip it.
  assert.ok(!re().test('border:2px solid var(--marker-ring)'))
})
