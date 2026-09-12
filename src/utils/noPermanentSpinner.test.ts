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

/** How far past `setLoading(true)` to look for the thing that clears it. */
const LOOKAHEAD = 4200

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
      //
      // Widened from 2600 to 4200: adding a timeout to useGeolocation pushed
      // its finally past the old window and the check reported a file that
      // was correct. A heuristic window that shrinks as code grows produces
      // false positives, and a guardrail people learn to distrust is worse
      // than none.
      const tail = src.slice(m.index!, m.index! + LOOKAHEAD)
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

// ─────────────────────────────────────────────────────────────────────────
// THE OTHER HALF: a finally is not enough on its own.
//
// The check above requires `setLoading(false)` to sit in a finally, so a
// REJECTED request cannot strand the spinner. It cannot catch the other
// failure, and I measured that one in a browser: with the network hanging
// rather than refusing, the gossip feed sat on its skeleton indefinitely. A
// finally runs when the promise SETTLES. A promise that never settles never
// runs it.
//
// withTimeout() in resilientCall.ts exists precisely for this, and its own
// docblock says "anything that awaits the network on behalf of a visible
// loading state should go through this". At the time of writing, 23 sites
// across 20 files did not.
//
// This is a RATCHET, like schemaDrift.test.ts. The files below are the known
// gaps and are allowed. Anything NEW fails immediately, and the list may only
// ever get shorter — delete a line when you fix that file.

/**
 * Two ways to bound a network wait, and both count. withTimeout() is the
 * house helper; an AbortController with a timer is what you need when the
 * call is a raw fetch to someone else's API, since aborting actually stops
 * the request rather than just stopping the waiting.
 */
function isBounded(tail: string): boolean {
  if (/withTimeout/.test(tail)) return true
  return /AbortController/.test(tail) && /abort\(\)/.test(tail)
}

const KNOWN_UNTIMED_LOADERS = new Set([
  'src/app/dashboard/components/community/AreaNoticesPanel.tsx',
  'src/app/dashboard/components/community/CommunityAdminTab.tsx',
  'src/app/dashboard/components/community/RequestVerificationPanel.tsx',
  'src/app/dashboard/components/community/VerificationQueuePanel.tsx',
  'src/app/dashboard/components/household/SharedResourcesTab.tsx',
  'src/app/dashboard/components/housing/PropertiesPanel.tsx',
  'src/app/dashboard/components/housing/RoomInventoryPanel.tsx',
  'src/app/dashboard/components/map/VibeMap.tsx',
  'src/app/dashboard/components/profile/ClientErrorAdminPanel.tsx',
  'src/app/dashboard/components/profile/HomeAreaPanel.tsx',
  'src/app/dashboard/components/profile/PushAlertsPanel.tsx',
  'src/app/dashboard/components/profile/ReportQueueAdminPanel.tsx',
  'src/app/dashboard/components/shared/UpgradeButton.tsx',
  'src/app/dashboard/components/social/FollowButton.tsx',
  'src/app/dashboard/components/trust-safety/BlockUserButton.tsx',
  'src/app/dashboard/components/trust-safety/SafetyTab.tsx',
  // The gossip feed keeps ONE untimed loader (the composer's own submit); its
  // feed fetch is wrapped, which is what the browser measurement was about.
  'src/app/dashboard/gossip/page.tsx',
  'src/app/dashboard/profile/page.tsx',
  'src/app/dashboard/trust-circle/page.tsx',
  'src/app/page.tsx'
])

test('no NEW loading state awaits the network without a timeout', () => {
  const offences: string[] = []
  for (const file of files) {
    const rel = file.slice(ROOT.length + 1).replace(/\\/g, '/')
    if (KNOWN_UNTIMED_LOADERS.has(rel)) continue
    const src = readFileSync(file, 'utf8')
    for (const m of src.matchAll(/set(\w*[Ll]oading)\(true\)/g)) {
      const tail = src.slice(m.index!, m.index! + LOOKAHEAD)
      if (!/await/.test(tail)) continue
      if (isBounded(tail)) continue
      const line = src.slice(0, m.index).split('\n').length
      offences.push(`  ${rel}:${line}`)
    }
  }
  assert.deepStrictEqual(
    offences, [],
    '\n\nThese show a loading state and await the network with no timeout, so a\n' +
    'request that hangs rather than fails leaves the loader on screen forever.\n' +
    'Wrap the await in withTimeout() from utils/resilientCall.\n\n' +
    offences.join('\n') + '\n'
  )
})

test('the allowlist only names files that still have the problem', () => {
  // An allowlist entry that no longer matches anything is not harmless: it
  // silently stops protecting that file the moment someone adds a new
  // untimed loader to it. The colour guardrail learned this the hard way
  // when a path in its allowlist was renamed.
  const stale: string[] = []
  for (const rel of KNOWN_UNTIMED_LOADERS) {
    const full = join(ROOT, rel)
    let src: string
    try { src = readFileSync(full, 'utf8') } catch { stale.push(`${rel} (no such file)`); continue }
    const hasGap = [...src.matchAll(/set(\w*[Ll]oading)\(true\)/g)].some(m => {
      const tail = src.slice(m.index!, m.index! + LOOKAHEAD)
      return /await/.test(tail) && !isBounded(tail)
    })
    if (!hasGap) stale.push(`${rel} (fixed — delete this line)`)
  }
  assert.deepStrictEqual(stale, [], '\n\nStale allowlist entries:\n' + stale.join('\n') + '\n')
})
