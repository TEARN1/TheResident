import test from 'node:test'
import assert from 'node:assert'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, extname } from 'node:path'

// WHY THIS FILE EXISTS (again)
//
// A test with this job existed once, was deleted, and the drift it prevented
// came straight back: 25 RPCs the client calls today are defined in no .sql
// file in this repo, and 75 of the database's 163 functions exist only in
// production.
//
// schemaCoverage.test.ts already guards TABLES. Nothing guarded FUNCTIONS,
// which is the more dangerous half: almost every one of these is SECURITY
// DEFINER, meaning it runs as its owner and the RLS on the tables it touches
// does not constrain it. The function body is the only thing deciding who
// gets what. An unreviewed one is the easiest way to hand out data the
// policies were written to withhold — and one that lives nowhere in the repo
// cannot be reviewed at all, or rebuilt from source after a disaster.
//
// THIS IS A RATCHET, NOT A CLEAN BILL OF HEALTH. The functions already
// missing are listed below and allowed, so this does not turn the build red
// for debt that predates it. Anything NEW fails immediately. Empty the list
// by running scripts/sync-functions.sh — that dumps the real definitions out
// of the live database rather than anyone retyping security-critical code.

const REPO_ROOT = join(import.meta.dirname, '..', '..')
const SRC = join(REPO_ROOT, 'src')

/**
 * RPCs called by the client that are, as of this commit, defined nowhere in
 * this repo. They exist in production only.
 *
 * This list must only ever get SHORTER. Adding to it means shipping another
 * function nobody can review or rebuild; the test below is what makes that a
 * deliberate act rather than an accident.
 */
const KNOWN_UNVERSIONED_RPCS = new Set<string>([
  // EMPTY, and that is the point of it.
  //
  // This list held 25 RPCs the client called that were defined in no .sql
  // file here. Four came off it when section 40 captured them during the
  // SECURITY DEFINER authorisation review — reviewing a function requires it
  // to be in the repo first, which is the whole argument for this test. The
  // remaining 20 came off together when theresident_functions.sql was
  // generated from the live catalogs: all 168 Resident-owned functions are
  // now versioned, and scripts/restore-drill.sh applies them from zero.
  //
  // Adding a name back here is a deliberate admission of debt, not a
  // formality. The test below fails on any NEW unversioned RPC, so the
  // normal fix is to run scripts/sync-functions.sh and commit, never to
  // extend this set.
])

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (['.ts', '.tsx'].includes(extname(entry)) && !entry.endsWith('.test.ts')) out.push(full)
  }
  return out
}

function rpcsCalledInCode(): Map<string, string[]> {
  const found = new Map<string, string[]>()
  for (const file of walk(SRC)) {
    const source = readFileSync(file, 'utf8')
    for (const match of source.matchAll(/\.rpc\(\s*['"]([a-z0-9_]+)['"]/g)) {
      const fn = match[1]
      const rel = file.slice(REPO_ROOT.length + 1).replace(/\\/g, '/')
      found.set(fn, [...(found.get(fn) || []), rel])
    }
  }
  return found
}

function functionsDefinedInSchema(): Set<string> {
  const defined = new Set<string>()
  for (const entry of readdirSync(REPO_ROOT)) {
    if (extname(entry) !== '.sql') continue
    const sql = readFileSync(join(REPO_ROOT, entry), 'utf8')
    for (const m of sql.matchAll(/create\s+(?:or\s+replace\s+)?function\s+public\.([a-z0-9_]+)/gi)) {
      defined.add(m[1].toLowerCase())
    }
  }
  return defined
}

test('no NEW client-called RPC is missing from the versioned schema', () => {
  const called = rpcsCalledInCode()
  const defined = functionsDefinedInSchema()

  assert.ok(called.size > 0, 'the scanner found no .rpc() calls at all — it has broken, not passed')
  assert.ok(defined.size > 0, 'the scanner found no function definitions — it has broken, not passed')

  const newDrift: string[] = []
  for (const [fn, files] of called) {
    if (defined.has(fn)) continue
    if (KNOWN_UNVERSIONED_RPCS.has(fn)) continue
    newDrift.push(`  ${fn}  ← called in ${[...new Set(files)].join(', ')}`)
  }

  assert.deepStrictEqual(
    newDrift,
    [],
    '\n\nThese RPCs are called by the app but defined in no .sql file, and are\n' +
    'not on the known-debt list.\n\n' +
    'Most RPCs here are SECURITY DEFINER: they run as their owner, so RLS on\n' +
    'the tables they touch does not constrain them and the body is the only\n' +
    'thing deciding who gets what. One that exists nowhere in this repo can\n' +
    'neither be reviewed nor rebuilt after a disaster.\n\n' +
    'Fix: run scripts/sync-functions.sh and commit the result.\n\n' +
    newDrift.join('\n') + '\n'
  )
})

test('the known-debt list only shrinks', () => {
  const defined = functionsDefinedInSchema()
  // Anything on the debt list that IS now versioned should be removed from
  // the list, so the list keeps telling the truth about what is outstanding.
  const nowFixed = [...KNOWN_UNVERSIONED_RPCS].filter(fn => defined.has(fn))

  assert.deepStrictEqual(
    nowFixed,
    [],
    '\n\nThese are now properly versioned — good. Delete them from\n' +
    'KNOWN_UNVERSIONED_RPCS in this file so the list stays honest about what\n' +
    'is actually outstanding:\n\n  ' + nowFixed.join('\n  ') + '\n'
  )
})
