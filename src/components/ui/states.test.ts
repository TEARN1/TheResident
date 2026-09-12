import test from 'node:test'
import assert from 'node:assert'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const UI = import.meta.dirname
const SRC = join(UI, '..', '..')
const read = (p: string) => readFileSync(p, 'utf8')

/**
 * Strip comments before asserting on content. Both of the checks below first
 * failed on this file's own prose — the docblock explaining that the icon used
 * to be opacity-10, and the one explaining why no turnaround time is promised.
 * A guardrail that cannot be explained in a comment is a guardrail people
 * delete the comment to satisfy.
 */
function code(src: string): string {
  return src
    .replace(/\/\*[^]*?\*\//g, '')
    .split('\n')
    .filter(l => !l.trim().startsWith('//'))
    .join('\n')
}

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap(e => {
    const full = join(dir, e)
    if (statSync(full).isDirectory()) return walk(full)
    return full.endsWith('.tsx') ? [full] : []
  })
}

// Section I of docs/DESIGN-OVERHAUL.md, made enforceable.
//
// The point of item 163 is that with almost no production data, EMPTY is the
// state most first users see. It is the first impression, not an edge case —
// and the failure mode is subtle: an empty list and a failed fetch rendering
// the same words, so the app tells a resident the neighbourhood is quiet when
// in fact the request errored. That is the same shape as the panic alert that
// reached nobody: the interface asserting something it does not know.

test('EmptyState can tell the three situations apart', () => {
  const src = read(join(SRC, 'app/dashboard/components/shared/EmptyState.tsx'))
  for (const variant of ['empty', 'filtered', 'error', 'offline']) {
    assert.ok(src.includes(`'${variant}'`), `EmptyState lost the ${variant} variant`)
  }
})

test('the error and offline states are announced, not just drawn', () => {
  const src = read(join(SRC, 'app/dashboard/components/shared/EmptyState.tsx'))
  assert.ok(src.includes("role={variant === 'error' || variant === 'offline' ? 'status' : undefined}"),
    'a list that silently swaps to "could not load" is a silent failure')
})

// Item 168. The icon was rendering at opacity-10 — on a light surface, very
// nearly not drawn at all. The thing meant to make the state look designed
// was invisible.
test('the empty-state icon is actually visible', () => {
  const src = code(read(join(SRC, 'app/dashboard/components/shared/EmptyState.tsx')))
  assert.ok(!/opacity-(5|10|20)\b/.test(src),
    'the empty-state icon is back to being nearly invisible')
})

test('the skeleton shimmer is opt-in to motion, not opt-out', () => {
  const css = read(join(SRC, 'app/globals.css'))
  const i = css.indexOf('.skeleton {')
  assert.ok(i > -1, 'the skeleton surface is gone')
  // The animation must live inside a no-preference query, so the static block
  // is the default path rather than an override a later edit could forget.
  const after = css.slice(i)
  const anim = after.indexOf('skeleton-sweep')
  const guard = after.indexOf('prefers-reduced-motion: no-preference')
  assert.ok(guard > -1 && guard < anim,
    'the skeleton animation is not behind a reduced-motion guard')
})

test('a skeleton announces itself as busy rather than as a pile of boxes', () => {
  const src = read(join(UI, 'Skeleton.tsx'))
  assert.ok(src.includes('aria-busy') && src.includes("role=\"status\""))
  assert.ok(src.includes('aria-hidden'), 'the decorative blocks are not hidden from screen readers')
})

// Item 176. The honest-limits rule this project keeps re-learning: do not
// promise a timeframe the system cannot keep.
test('the verification gate does not invent a turnaround time', () => {
  const src = code(read(join(UI, 'GatedNotice.tsx')))
  assert.ok(!/\b\d+\s*(hours?|days?|weeks?)\b/i.test(src),
    'GatedNotice quotes a timeframe; there is no queue that can honour one')
})

// CANARY: prove the file walk and reads are hitting real content, so none of
// the assertions above can pass by looking at nothing.
test('CANARY: the state components are actually being read', () => {
  const files = walk(SRC)
  assert.ok(files.length > 50, `only walked ${files.length} files`)
  assert.ok(read(join(UI, 'Skeleton.tsx')).length > 400)
  assert.ok(read(join(SRC, 'app/dashboard/components/shared/EmptyState.tsx')).length > 400)
})
