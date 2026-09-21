import test from 'node:test'
import assert from 'node:assert'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, extname } from 'node:path'

// EVERY BORDER-WIDTH UTILITY MUST HAVE A BORDER-STYLE TO GO WITH IT.
//
// Tailwind's `border`, `border-t`, `border-2` … set only a border-WIDTH. The
// matching `border-style: solid` normally comes from Preflight, which this
// app deliberately does not load (tailwind.config.ts) so it cannot restyle
// the older inline-styled screens. CSS's initial border-style is `none`, so
// a width utility on its own paints nothing at all.
//
// It did exactly that for the whole life of this codebase: 1,314 usages
// across 53 files, every one of them drawing no line, and nothing anywhere
// reporting a problem — tsc, eslint, the tests and the build were all green
// throughout, because a border that does not paint is not a type error.
// globals.css now supplies the style for the utilities the app uses.
//
// This test is the thing that keeps it fixed. Reaching for a width utility
// that globals.css does not cover — `border-r-2`, say — brings the silent
// failure straight back, so that is what fails here.

const ROOT = join(import.meta.dirname, '..', '..')
const SRC = join(ROOT, 'src')
// Comments are stripped first: the block below documents Preflight's own
// `{ border-width: 0; border-style: solid }` verbatim, and a comment that
// talks about a rule must not be mistaken for the rule.
const GLOBALS = readFileSync(join(SRC, 'app', 'globals.css'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')

/** Class names that set a border width and nothing else. */
const WIDTH_UTILITY = /\b(border(?:-[xytrbl])?(?:-(?:0|2|4|8))?)(?![\w-])/g

function tsxFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) tsxFiles(full, out)
    else if (extname(full) === '.tsx') out.push(full)
  }
  return out
}

/** The selectors globals.css declares a border-style for. */
function styledSelectors(): Set<string> {
  const covered = new Set<string>()
  // Only blocks that actually set a border-style count. A block mentioning
  // a class in a comment must not satisfy this test.
  for (const block of GLOBALS.matchAll(/([^{}]+)\{([^{}]*border-style\s*:[^{}]*)\}/g)) {
    for (const sel of block[1].split(',')) {
      const name = sel.trim().replace(/^\./, '')
      if (name) covered.add(name)
    }
  }
  return covered
}

test('globals.css declares a border-style at all', () => {
  // The canary for the whole mechanism. If this block is ever deleted,
  // every border in the app silently disappears again.
  assert.ok(styledSelectors().has('border'),
    'globals.css no longer gives `.border` a border-style — every Tailwind border in the app is now invisible')
})

test('border-dashed and border-none still win over the solid default', () => {
  const covered = styledSelectors()
  for (const explicit of ['border-dashed', 'border-none']) {
    assert.ok(covered.has(explicit),
      `${explicit} is used in the app but globals.css does not re-declare it, so the blanket solid rule overrides it`)
  }
})

test('EVERY border-width utility used in the app has a style rule', () => {
  const covered = styledSelectors()
  const missing = new Map<string, string>()

  for (const file of tsxFiles(SRC)) {
    const source = readFileSync(file, 'utf8')
    for (const attr of source.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\})/g)) {
      const classes = attr[1] ?? attr[2] ?? ''
      for (const match of classes.matchAll(WIDTH_UTILITY)) {
        const name = match[1]
        // `border` as a prefix of a colour/radius/collapse utility is not a
        // width utility; the regex's trailing guard already excludes those.
        if (!covered.has(name) && !missing.has(name)) {
          missing.set(name, file.slice(ROOT.length + 1))
        }
      }
    }
  }

  assert.deepEqual([...missing.keys()], [],
    'these border-width utilities paint nothing because globals.css gives them no border-style — add them to the rule there: ' +
    [...missing].map(([name, file]) => `${name} (${file})`).join(', '))
})
