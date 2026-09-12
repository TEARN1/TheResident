import test from 'node:test'
import assert from 'node:assert'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { goldButtonClass } from './GoldButton'
import { buttonClass } from './Button'

// Item 55, made permanent.
//
// The browser smoke suite already measures rendered tap targets — but only on
// what a GUEST can see. Every control behind sign-in was unmeasured, and that
// is where they were hiding: 23 buttons under 44px, including the community
// page's whole sub-tab row at roughly 30px, which is the row a resident taps
// most often on that screen.
//
// This is a static check, so it sees every file whether or not a guest can
// reach the screen. The two are complementary: the browser measures truth on
// the pages it can open, this one covers the rest.

const SRC = join(import.meta.dirname, '..', '..')

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap(entry => {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) return walk(full)
    return full.endsWith('.tsx') ? [full] : []
  })
}

/** A control whose only height comes from small vertical padding. */
function offenders(): { file: string; snippet: string }[] {
  const found: { file: string; snippet: string }[] = []
  for (const file of walk(SRC)) {
    const src = readFileSync(file, 'utf8')
    const re = /<(button|Link)\b[^>]*?className=\{?[`"'][^`"']*[`"']/g
    for (const m of src.matchAll(re)) {
      const blob = m[0]
      if (!/\bpy-(0|0\.5|1|1\.5|2)\b/.test(blob)) continue
      // An explicit minimum height settles it.
      if (blob.includes('min-h-') || blob.includes('h-[')) continue
      // These helpers carry min-h-[44px] themselves; asserted separately below
      // so this exemption can never become a hole.
      if (blob.includes('goldButtonClass') || blob.includes('buttonClass')) continue
      found.push({ file: file.replace(SRC, 'src'), snippet: blob.slice(0, 80).replace(/\s+/g, ' ') })
    }
  }
  return found
}

test('no button or link relies on small padding for its tap target', () => {
  const bad = offenders()
  assert.deepStrictEqual(
    bad, [],
    'controls under 44px:\n' + bad.map(b => `  ${b.file}  ${b.snippet}`).join('\n')
  )
})

// The exemption above is only safe while these actually carry the minimum.
test('the shared button helpers carry the 44px minimum themselves', () => {
  for (const size of ['sm', 'md'] as const) {
    assert.ok(goldButtonClass({ size }).includes('min-h-[44px]'),
      `goldButtonClass size ${size} lost its minimum, and the scan exempts it`)
  }
  for (const size of ['sm', 'md', 'lg'] as const) {
    assert.ok(/min-h-\[(4[4-9]|[5-9][0-9])px\]/.test(buttonClass({ size })),
      `buttonClass size ${size} lost its minimum`)
  }
})

// CANARY. A scan that silently matches nothing passes forever. This proves the
// regex still finds real controls in this codebase.
test('CANARY: the scan is actually reading components', () => {
  const files = walk(SRC)
  assert.ok(files.length > 50, `only walked ${files.length} .tsx files`)
  const anyControls = files.some(f =>
    /<(button|Link)\b[^>]*?className/.test(readFileSync(f, 'utf8')))
  assert.ok(anyControls, 'the control regex matched nothing anywhere — it is broken')
})
