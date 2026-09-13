import test from 'node:test'
import assert from 'node:assert'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { wrapTarget } from './Modal'

const SRC = readFileSync(join(import.meta.dirname, 'Modal.tsx'), 'utf8')
// The trap, Escape, scroll lock and focus restore live in the hook, so the
// 16 existing hand-rolled overlays can adopt them without being rewritten.
// Modal uses the same hook — one implementation, two entry points.
const HOOK = readFileSync(
  join(import.meta.dirname, '..', '..', 'utils', 'useDialogBehaviour.ts'), 'utf8')

// Items 179 and 187. Seven modal surfaces in this app trapped focus in none of
// them: a keyboard user who opened a dialog and pressed Tab walked out of it
// into the page behind — still there, still focusable, now covered by an
// overlay they cannot see past. They were tabbing through controls that were,
// to them, invisible.

test('Tab from the last control wraps to the first', () => {
  assert.strictEqual(wrapTarget(2, 3, false), 0)
})

test('Shift+Tab from the first control wraps to the last', () => {
  assert.strictEqual(wrapTarget(0, 3, true), 2)
})

// Both halves matter. With only the forward wrap, focus escapes backwards —
// which is harder to notice and exactly as broken.
test('the middle of the list is left to the browser', () => {
  assert.strictEqual(wrapTarget(1, 3, false), null)
  assert.strictEqual(wrapTarget(1, 3, true), null)
})

test('a single focusable control wraps to itself in both directions', () => {
  assert.strictEqual(wrapTarget(0, 1, false), 0)
  assert.strictEqual(wrapTarget(0, 1, true), 0)
})

// activeElement can be outside the list — the dialog container itself holds
// focus on open, before anything inside it is reached.
test('focus starting outside the list still lands inside on Shift+Tab', () => {
  assert.strictEqual(wrapTarget(-1, 3, true), 2)
})

test('an empty dialog does not hand focus back to the page behind it', () => {
  assert.strictEqual(wrapTarget(-1, 0, false), null)
  assert.strictEqual(wrapTarget(0, 0, true), null)
})

// The DOM half — restoring focus to the opener, Escape, the scroll lock —
// cannot be unit-tested without a renderer, so these assert the wiring is
// present rather than that it behaves. Stated plainly so nobody reads this
// file as full coverage of the trap.
test('the modal restores focus to whatever opened it', () => {
  assert.ok(HOOK.includes('returnTo.current = document.activeElement'),
    'the opener is no longer remembered')
  assert.ok(HOOK.includes('returnTo.current?.focus?.()'),
    'focus is no longer restored on close — the user lands at the top of the document')
})

// The behaviour existing in a hook is worth nothing if Modal stops calling it.
test('Modal actually uses the shared behaviour', () => {
  assert.ok(SRC.includes('useDialogBehaviour(open, onClose, panelRef)'),
    'Modal no longer wires up the focus trap')
})

test('Escape closes, and the dialog names itself', () => {
  assert.ok(HOOK.includes("e.key === 'Escape'"), 'Escape no longer closes the dialog')
  assert.ok(SRC.includes('aria-modal="true"'))
  assert.ok(SRC.includes('aria-label={title}'),
    'a dialog with no accessible name is announced as just "dialog"')
})

// ── Adoption ──────────────────────────────────────────────────────────────
//
// A focus trap that exists and is used by nothing protects nobody. There were
// 16 hand-rolled overlays in this app and not one of them trapped focus; this
// check is what stops a seventeenth being written the old way.

import { readdirSync, statSync } from 'node:fs'

const SRC_ROOT = join(import.meta.dirname, '..', '..')
function walkTsx(dir: string): string[] {
  return readdirSync(dir).flatMap(e => {
    const full = join(dir, e)
    return statSync(full).isDirectory() ? walkTsx(full) : (full.endsWith('.tsx') ? [full] : [])
  })
}

test('no overlay is hand-rolled without the shared dialog behaviour', () => {
  const offenders: string[] = []
  for (const file of walkTsx(SRC_ROOT)) {
    if (/DialogShell\.tsx$|Modal\.tsx$/.test(file)) continue
    const src = readFileSync(file, 'utf8')
    // A dialog is an overlay that declares itself one. A fullscreen VIEW —
    // the map, for instance — is not a dialog and is correctly excluded by
    // this, because it has no role="dialog" and traps nothing.
    if (!src.includes('role="dialog"')) continue
    if (src.includes('DialogShell') || src.includes('useDialogBehaviour')) continue
    offenders.push(file.replace(SRC_ROOT, 'src'))
  }
  assert.deepStrictEqual(offenders, [],
    '\n\nThese declare role="dialog" but do not use DialogShell or\n' +
    'useDialogBehaviour, so a keyboard user tabs straight out of them into\n' +
    'the page behind:\n' + offenders.join('\n') + '\n')
})
