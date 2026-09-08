import test from 'node:test'
import assert from 'node:assert'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, extname } from 'node:path'

// A LOADING FLAG MUST RESOLVE ON EVERY PATH.
//
// /dashboard/messages showed "Loading conversations…" forever — measured
// still spinning at 4 seconds, and it would have stayed that way for the rest
// of the session. The cause was structural, not a typo: `setLoading(false)`
// sat at the END of an async function, after two awaits, with no try/finally.
// When the request rejected, execution never reached it.
//
// An infinite spinner is the worst possible answer to a network failure,
// because it looks like the app is working right up until the person closes
// it — so they never see an error, never retry, and conclude the app is
// broken. Twelve more functions had the identical shape, on the main feed,
// the map, the trust circle and the upgrade button.
//
// This is what stops the thirteenth. See docs/DESIGN-OVERHAUL.md item 172.

const ROOT = join(import.meta.dirname, '..', '..')
const SRC = join(ROOT, 'src')

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const f = join(dir, e)
    if (statSync(f).isDirectory()) walk(f, out)
    else if (['.tsx', '.ts'].includes(extname(e)) && !e.includes('.test.')) out.push(f)
  }
  return out
}

const files = walk(SRC)

test('the scanner is looking at real files', () => {
  assert.ok(files.length > 30, `only ${files.length} files scanned — the walker has broken, not passed`)
})

test('every loading flag set before an await resolves in a finally', () => {
  const offences: string[] = []
  for (const file of files) {
    const src = readFileSync(file, 'utf8')
    const rel = file.slice(ROOT.length + 1).replace(/\\/g, '/')
    for (const m of src.matchAll(/set(\w*[Ll]oading|\w*[Uu]ploading|\w*[Ss]aving|\w*[Ss]ubmitting)\(true\)/g)) {
      // Look ahead across a generous window — long enough to contain the
      // function body, short enough not to reach the next one.
      const tail = src.slice(m.index!, m.index! + 2600)
      if (!/await/.test(tail)) continue          // nothing async, nothing to hang
      if (/finally\s*\{/.test(tail)) continue    // resolves on every path
      const line = src.slice(0, m.index).split('\n').length
      offences.push(`  ${rel}:${line}  set${m[1]}(true)`)
    }
  }

  assert.deepStrictEqual(
    offences, [],
    '\n\nThese set a loading flag, then await something, with no finally to\n' +
    'clear it. If the request rejects — or simply never settles — the\n' +
    'spinner stays on screen for the rest of the session and the user has\n' +
    'no way out and no error to act on.\n\n' +
    'Fix: wrap the body in try/catch/finally and clear the flag in the\n' +
    'finally. For requests that may never settle at all, also pass them\n' +
    'through withTimeout() from src/utils/resilientCall.ts.\n\n' +
    offences.join('\n') + '\n'
  )
})

test('the scanner would catch a planted regression', () => {
  // Without this, the test above passes just as happily when the regex is
  // broken as when the code is clean.
  const bad = `
    setLoading(true)
    const { data } = await supabase.from('x').select()
    setLoading(false)
  `
  const hasSetter = /set(\w*[Ll]oading)\(true\)/.test(bad)
  const hasAwait = /await/.test(bad)
  const hasFinally = /finally\s*\{/.test(bad)
  assert.ok(hasSetter && hasAwait && !hasFinally,
    'the scanner no longer recognises the permanent-spinner shape — it is broken')
})
