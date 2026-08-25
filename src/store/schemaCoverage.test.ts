import test from 'node:test'
import assert from 'node:assert'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, extname } from 'node:path'

// WHY THIS FILE EXISTS
// Twelve Resident-owned tables (gossip, trust connections, saved pins and
// searches, reviews, reputation, subscriptions, notification prefs,
// properties, moderation, infra providers) were shipped against tables
// created ad-hoc in the Supabase dashboard, with no schema ever added to
// this repo. The database could not be rebuilt from source and their RLS
// could not be audited from here — while SECURITY.md claimed full coverage.
//
// Nothing detected it, because nothing was looking. This test looks: every
// `res_`-prefixed table the client queries must have a `create table` in a
// versioned .sql file. It fails on the NEXT one instead of the twelfth.

const REPO_ROOT = join(import.meta.dirname, '..', '..')
const SRC = join(REPO_ROOT, 'src')

// Unprefixed tables are Gruvs-owned (CONTRACT.md §2). The Resident reads
// them but must never define or migrate them, so they are correctly absent
// from this repo's schema files.
const GRUVS_OWNED = new Set([
  'profiles', 'events', 'messages', 'notifications', 'follows', 'mutual_follows'
])

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (['.ts', '.tsx'].includes(extname(entry)) && !entry.endsWith('.test.ts')) out.push(full)
  }
  return out
}

function tablesQueriedInCode(): Map<string, string[]> {
  const found = new Map<string, string[]>()
  for (const file of walk(SRC)) {
    const source = readFileSync(file, 'utf8')
    for (const match of source.matchAll(/\.from\(\s*['"]([a-z0-9_]+)['"]\s*\)/g)) {
      const table = match[1]
      const rel = file.slice(REPO_ROOT.length + 1).replace(/\\/g, '/')
      found.set(table, [...(found.get(table) || []), rel])
    }
  }
  return found
}

function tablesDefinedInSchema(): Set<string> {
  const defined = new Set<string>()
  for (const entry of readdirSync(REPO_ROOT)) {
    if (extname(entry) !== '.sql') continue
    const sql = readFileSync(join(REPO_ROOT, entry), 'utf8')
    for (const match of sql.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?public\.([a-z0-9_]+)/gi)) {
      defined.add(match[1].toLowerCase())
    }
  }
  return defined
}

test('every Resident-owned table the client queries is versioned in a .sql file', () => {
  const queried = tablesQueriedInCode()
  const defined = tablesDefinedInSchema()

  assert.ok(queried.size > 0, 'the scanner found no .from() calls at all — it has broken, not passed')
  assert.ok(defined.size > 0, 'the scanner found no create table statements — it has broken, not passed')

  const undocumented: string[] = []
  for (const [table, files] of queried) {
    if (GRUVS_OWNED.has(table)) continue
    if (!table.startsWith('res_')) continue
    if (defined.has(table)) continue
    undocumented.push(`  ${table}  ← queried in ${[...new Set(files)].join(', ')}`)
  }

  assert.deepStrictEqual(
    undocumented,
    [],
    '\n\nThese tables are queried by the app but have no `create table` in any .sql file.\n' +
    'That means the database cannot be rebuilt from this repo and their RLS\n' +
    'cannot be audited from here. Add them to a schema file.\n\n' +
    undocumented.join('\n') + '\n'
  )
})

test('the app does not define Gruvs-owned tables (CONTRACT.md boundary)', () => {
  const defined = tablesDefinedInSchema()
  const violations = [...GRUVS_OWNED].filter(t => defined.has(t))

  assert.deepStrictEqual(
    violations,
    [],
    `\n\nThis repo defines ${violations.join(', ')}, which CONTRACT.md reserves to\n` +
    'The Gruvs. The Resident extends profiles via res_profiles and must never\n' +
    'create or migrate the shared tables. (A previous schema file did exactly\n' +
    'this and was deleted for it.)\n'
  )
})
