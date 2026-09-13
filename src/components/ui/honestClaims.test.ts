import test from 'node:test'
import assert from 'node:assert'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const SRC = join(import.meta.dirname, '..', '..')
function walk(dir: string): string[] {
  return readdirSync(dir).flatMap(e => {
    const full = join(dir, e)
    return statSync(full).isDirectory() ? walk(full) : (full.endsWith('.tsx') ? [full] : [])
  })
}

// WHY THIS FILE EXISTS.
//
// The single most repeated defect in this codebase is the interface asserting
// something it does not know:
//
//   * a panic alert advertised as "real-time community alerts" that reached
//     nobody,
//   * "it will be reviewed" on a report queue nothing read,
//   * "Loading conversations…" forever,
//   * "Nothing posted yet" when the request had actually failed,
//   * every listing labelled "Verified" with no verification behind it,
//   * "Street Captain status" and "emergency dispatch features" that exist
//     nowhere in the code or the schema.
//
// None of it was visible to tsc, the tests or the build, because every one of
// them is a true statement about the code and a false one about the world.
//
// This cannot check truth. What it CAN do is make the highest-risk words —
// the ones a resident uses to decide whether to trust a stranger with a
// deposit or a key — impossible to render unconditionally without somebody
// deciding to.

const CLAIM_WORDS =
  /(Verified|Trusted|Certified|Guaranteed|Background.checked|Insured|Vetted)/

/** An element whose visible text makes a claim, with nothing guarding it. */
function unconditionalClaims(): string[] {
  const out: string[] = []
  for (const file of walk(SRC)) {
    if (file.endsWith('.test.ts') || file.endsWith('.test.tsx')) continue
    const lines = readFileSync(file, 'utf8').split('\n')
    lines.forEach((line, i) => {
      const m = line.match(new RegExp('>\\s*' + CLAIM_WORDS.source + '\\b[^<{]*<'))
      if (!m) return
      // A conditional anywhere in the preceding few lines means someone
      // decided when this renders. That is all this check asks for.
      const context = lines.slice(Math.max(0, i - 6), i + 1).join('\n')
      if (/\?|&&|if \(/.test(context)) return
      out.push(`${file.replace(SRC, 'src')}:${i + 1}  ${line.trim().slice(0, 80)}`)
    })
  }
  return out
}

test('no trust claim renders unconditionally', () => {
  const bad = unconditionalClaims()
  assert.deepStrictEqual(
    bad, [],
    '\n\nThese render a trust word with no condition behind them. Either gate\n' +
    'the claim on the data that justifies it, or do not make it:\n\n' +
    bad.join('\n') + '\n'
  )
})

// CANARY. A scan that quietly matches nothing passes forever.
test('CANARY: the claim scan is reading real components', () => {
  const files = walk(SRC)
  assert.ok(files.length > 50, `only walked ${files.length} files`)
  // The pattern must still match the shape it is meant to catch.
  const sample = '<span className="x">Verified</span>'
  assert.ok(new RegExp('>\\s*' + CLAIM_WORDS.source + '\\b[^<{]*<').test(sample),
    'the claim pattern no longer matches a plain claim element')
})
