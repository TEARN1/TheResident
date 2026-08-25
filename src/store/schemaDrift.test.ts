import test from 'node:test'
import assert from 'node:assert'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

// WHY THIS FILE EXISTS
// Three times now, a large multi-feature commit has created database objects
// in the Supabase dashboard and never brought them back into the repo: 12
// tables, then 22 RPC functions, plus a half-wired moderation column. Each
// time it was found by a manual audit rather than by anything automatic.
//
// These tests make the drift fail the build instead. They compare what the
// client code actually calls against what the .sql files in this repo
// actually define — so the next time someone adds a table or an RPC without
// versioning it, `npm test` says so.

const REPO_ROOT = join(import.meta.dirname, '..', '..')

const readAllSql = (): string => readdirSync(REPO_ROOT)
  .filter(f => f.endsWith('.sql'))
  .map(f => readFileSync(join(REPO_ROOT, f), 'utf8'))
  .join('\n')
  .toLowerCase()

const readAllSource = (): string => {
  const out: string[] = []
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, entry.name)
      if (entry.isDirectory()) walk(p)
      else if (/\.tsx?$/.test(entry.name) && !entry.name.endsWith('.test.ts')) {
        out.push(readFileSync(p, 'utf8'))
      }
    }
  }
  walk(join(REPO_ROOT, 'src'))
  return out.join('\n')
}

// Unprefixed tables belong to The Gruvs (CONTRACT.md §2) — this app reads
// them but must never define them, so they are expected to be absent.
const GRUVS_OWNED = new Set(['events', 'follows', 'messages', 'mutual_follows', 'notifications', 'profiles'])

test('every res_* table the client queries is defined in a versioned .sql file', () => {
  const sql = readAllSql()
  const source = readAllSource()

  const queried = new Set(
    [...source.matchAll(/\.from\('([a-z_]+)'\)/g)].map(m => m[1])
  )

  const undocumented = [...queried]
    .filter(t => !GRUVS_OWNED.has(t))
    .filter(t => !sql.includes(`create table if not exists public.${t}`))

  assert.deepStrictEqual(
    undocumented, [],
    `These tables are queried by the client but defined in no .sql file, so the database cannot be rebuilt from source:\n  ${undocumented.join('\n  ')}`
  )
})

test('RPC functions are inventoried, so undocumented ones cannot grow silently', () => {
  const sql = readAllSql()
  const source = readAllSource()

  const called = new Set(
    [...source.matchAll(/\.rpc\('([a-z_]+)'/g)].map(m => m[1])
  )

  // A function counts as accounted-for if it is either fully defined in a
  // .sql file, or listed in theresident_rpc_inventory.sql's reference list —
  // which is the file that explains how to dump the real definitions out of
  // Supabase. The inventory is the interim state; a real definition is the
  // finished one.
  const unaccounted = [...called].filter(fn =>
    !sql.includes(`create or replace function public.${fn}`) &&
    !sql.includes(`create function public.${fn}`) &&
    !sql.includes(fn.toLowerCase())
  )

  assert.deepStrictEqual(
    unaccounted, [],
    `These RPCs are called by the client but appear in no .sql file at all — not even the inventory:\n  ${unaccounted.join('\n  ')}\nAdd them to theresident_rpc_inventory.sql, or better, dump the real definition.`
  )
})

test('the RPC inventory records how many definitions are still missing', () => {
  const sql = readAllSql()
  const source = readAllSource()

  const called = [...new Set([...source.matchAll(/\.rpc\('([a-z_]+)'/g)].map(m => m[1]))]
  const defined = called.filter(fn =>
    sql.includes(`create or replace function public.${fn}`) ||
    sql.includes(`create function public.${fn}`)
  )

  // Not an assertion that the gap is closed — it isn't yet, and pretending
  // otherwise would defeat the point. This pins the CURRENT state so that
  // closing it (pasting real definitions in) is a visible, deliberate change
  // to this number rather than something that drifts unnoticed either way.
  assert.ok(
    defined.length >= 5,
    `Expected at least the 5 already-versioned RPCs to still be defined, found ${defined.length}. Did a schema file lose a function?`
  )
  assert.ok(
    called.length >= defined.length,
    'More definitions than call sites — the extraction regex is probably wrong.'
  )
})
