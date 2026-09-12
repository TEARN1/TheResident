import test from 'node:test'
import assert from 'node:assert'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { buttonClass } from './Button'
import { initialsFrom } from './Avatar'

const UI_DIR = import.meta.dirname
const files = readdirSync(UI_DIR).filter(f => f.endsWith('.tsx'))
const read = (f: string) => readFileSync(join(UI_DIR, f), 'utf8')

// WHY THIS FILE EXISTS.
//
// The --elevation-* design tokens sat in tokens.css, fully defined and used by
// nothing at all, for the entire design overhaul. Nobody noticed because
// nothing checks that a thing which was built is actually reachable. These
// components are the same shape of risk: a component library that half the
// app ignores is worse than no library, because now there are two answers.

test('every interactive component clears the 44px tap target', () => {
  // Item 55, and the one measurable rule that stopped this app shipping
  // 11px buttons. Applies to anything a finger lands on.
  const interactive = ['Button.tsx', 'Tabs.tsx', 'SearchInput.tsx', 'Field.tsx', 'PageHeader.tsx']
  for (const f of interactive) {
    const src = read(f)
    assert.ok(
      src.includes('min-h-[44px]') || src.includes('h-[44px]'),
      `${f} has no 44px minimum on its tap targets`
    )
  }
})

test('every button size clears 44px, not just the default', () => {
  for (const size of ['sm', 'md', 'lg'] as const) {
    const cls = buttonClass({ size })
    assert.ok(
      /min-h-\[4[4-9]px\]|min-h-\[[5-9][0-9]px\]/.test(cls),
      `size ${size} does not clear 44px: ${cls}`
    )
  }
})

// A loading button that is still pressable is the double-submit bug. The
// component ties the two together; this asserts nobody unties them.
test('Button disables itself while loading', () => {
  const src = read('Button.tsx')
  assert.ok(src.includes('disabled={disabled || loading}'),
    'the loading state no longer implies disabled')
})

test('every button variant in the hierarchy exists', () => {
  // Item 37. A missing variant means the next destructive action gets
  // hand-typed again, which is how they all ended up different.
  for (const v of ['primary', 'secondary', 'tertiary', 'destructive'] as const) {
    assert.ok(buttonClass({ variant: v }).length > 0)
  }
  assert.notStrictEqual(buttonClass({ variant: 'primary' }), buttonClass({ variant: 'secondary' }))
  assert.ok(buttonClass({ variant: 'destructive' }).includes('danger'))
})

test('initialsFrom never renders an empty avatar', () => {
  assert.strictEqual(initialsFrom('Thandi Mahlangu'), 'TM')
  assert.strictEqual(initialsFrom('Sipho'), 'SI')
  assert.strictEqual(initialsFrom(null), '?')
  assert.strictEqual(initialsFrom(''), '?')
  assert.strictEqual(initialsFrom('   '), '?')
})

// Item 38, made enforceable. A status told apart only by being red is
// invisible to a colour-blind resident and to anyone in bright sun.
test('Badge can carry an icon, so state is never colour alone', () => {
  const src = read('Badge.tsx')
  assert.ok(src.includes('icon'), 'Badge dropped its icon slot')
})

test('Tabs is a real tab list, not a row of buttons that look like one', () => {
  const src = read('Tabs.tsx')
  for (const attr of ['role="tablist"', 'role="tab"', 'aria-selected', 'tabIndex', 'ArrowRight']) {
    assert.ok(src.includes(attr), `Tabs is missing ${attr}`)
  }
})

test('Field labels are real labels, not placeholders', () => {
  const src = read('Field.tsx')
  assert.ok(src.includes('htmlFor='), 'Field has no htmlFor — WCAG 3.3.2')
  assert.ok(src.includes('aria-invalid'), 'Field never marks itself invalid')
  assert.ok(src.includes('role="alert"'), 'a field error is never announced')
})

// The canary. If the checks above are looking at nothing — a renamed file, a
// bad path — this fails and says so, rather than the suite passing green on
// an empty directory.
test('CANARY: the component files are actually being read', () => {
  assert.ok(files.length >= 8, `only found ${files.length} components: ${files.join(', ')}`)
  assert.ok(read('Button.tsx').length > 500, 'Button.tsx read as near-empty')
})

// The elevation tokens were defined and unused for the whole overhaul. This
// is the check that would have caught it.
test('the elevation tokens are actually used by something', () => {
  const css = readFileSync(join(UI_DIR, '..', '..', 'app', 'globals.css'), 'utf8')
  const tokens = readFileSync(join(UI_DIR, '..', '..', 'styles', 'tokens.css'), 'utf8')
  const defined = [...tokens.matchAll(/--elevation-(\d):/g)].map(m => m[1])
  assert.ok(defined.length >= 4, 'the elevation scale disappeared')
  assert.ok(css.includes('var(--elevation-1)'),
    'the base card elevation is defined but nothing uses it — the exact rot this file exists to catch')
})
