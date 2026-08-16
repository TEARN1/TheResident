import test from 'node:test'
import assert from 'node:assert'
import {
  assertTableWritable,
  assertColumnsWritable,
  assertAllowlistLegal,
  assertWithinBudget,
  GuardViolation,
  FORBIDDEN_TABLES,
  FORBIDDEN_COLUMNS
} from './rules'

// Adversarial tests for the Guard. Scheduled jobs run as service_role and
// bypass RLS entirely, so these rules — not the database's policies — are what
// protects automated write paths. Each test below is a thing the system must
// refuse to do even when a job explicitly asks.

const throwsGuard = (fn: () => void, match: RegExp) => {
  assert.throws(fn, (err: unknown) => {
    assert.ok(err instanceof GuardViolation, `expected GuardViolation, got ${err}`)
    assert.match((err as Error).message, match)
    return true
  })
}

// ── The Gruvs boundary (CONTRACT.md §2/§3) ─────────────────────────────────

test('a job cannot write profiles, even if it allowlists it', () => {
  throwsGuard(
    () => assertTableWritable('rogue', 'profiles', ['profiles']),
    /forbidden table 'profiles'/)
})

test('a job cannot even DECLARE profiles in its allowlist', () => {
  // Caught at construction, before the job can attempt a single write.
  throwsGuard(
    () => assertAllowlistLegal('rogue', ['res_listings', 'profiles']),
    /declares forbidden table 'profiles'/)
})

test('auth.users and users are equally unreachable', () => {
  for (const t of ['auth.users', 'users']) {
    throwsGuard(() => assertTableWritable('rogue', t, [t]), /forbidden table/)
  }
})

// ── The money boundary (CONTRACT.md §6) ────────────────────────────────────

test('a job cannot change what anything costs', () => {
  for (const col of ['price', 'price_per_seat', 'price_per_day', 'deposit', 'display_price']) {
    throwsGuard(
      () => assertColumnsWritable('rogue', { [col]: 999 }),
      /forbidden column/)
  }
})

test('a job cannot touch payment or subscription records', () => {
  for (const t of ['res_purchases', 'res_subscriptions']) {
    throwsGuard(() => assertTableWritable('rogue', t, [t]), /forbidden table/)
  }
})

test('a legal patch alongside an illegal one is still refused', () => {
  // The whole patch fails; there is no partial application.
  throwsGuard(
    () => assertColumnsWritable('expire_listings', { status: 'expired', price: 0 }),
    /forbidden column 'price'/)
})

// ── The trust boundary (CONTRACT.md §3) ────────────────────────────────────

test('a job cannot grant verification or edit reputation', () => {
  for (const col of ['is_verified', 'vibe_score', 'reputation_score', 'badges', 'xp']) {
    throwsGuard(
      () => assertColumnsWritable('rogue', { [col]: 100 }),
      /forbidden column/)
  }
})

// ── Provenance ─────────────────────────────────────────────────────────────

test('a job cannot reassign ownership of a row', () => {
  for (const col of ['user_id', 'owner_id', 'landlord_id', 'tenant_id', 'reporter_id']) {
    throwsGuard(
      () => assertColumnsWritable('rogue', { [col]: 'some-other-user' }),
      /forbidden column/)
  }
})

test('a job cannot rewrite an id or a creation time', () => {
  throwsGuard(() => assertColumnsWritable('rogue', { id: 'x' }), /forbidden column 'id'/)
  throwsGuard(() => assertColumnsWritable('rogue', { created_at: 'x' }), /forbidden column 'created_at'/)
})

// ── Allowlist scoping ──────────────────────────────────────────────────────

test('a job cannot write a table it did not declare, even a permitted one', () => {
  throwsGuard(
    () => assertTableWritable('expire_traffic_reports', 'res_listings', ['res_traffic_reports']),
    /not in its allowlist/)
})

test('a job with an empty allowlist can write nothing at all', () => {
  throwsGuard(
    () => assertTableWritable('heartbeat', 'res_listings', []),
    /not in its allowlist/)
})

test('a declared, permitted table is allowed', () => {
  assert.doesNotThrow(() =>
    assertTableWritable('expire_traffic_reports', 'res_traffic_reports', ['res_traffic_reports']))
  assert.doesNotThrow(() =>
    assertColumnsWritable('expire_traffic_reports', { archived_at: 'now', status: 'expired' }))
  assert.doesNotThrow(() => assertAllowlistLegal('ok', ['res_listings', 'res_market_items']))
})

// ── Blast radius ───────────────────────────────────────────────────────────

test('a run aborts rather than exceeding its row cap', () => {
  throwsGuard(
    () => assertWithinBudget('expire_listings', 999, 2, 1000),
    /exceeded its blast radius/)
})

test('the cap is inclusive: writing exactly up to it is allowed', () => {
  assert.doesNotThrow(() => assertWithinBudget('expire_listings', 999, 1, 1000))
})

test('a single oversized write is caught, not just an accumulating one', () => {
  throwsGuard(
    () => assertWithinBudget('bulk', 0, 5000, 1000),
    /exceeded its blast radius/)
})

// ── The lists themselves ───────────────────────────────────────────────────

test('the forbidden lists still contain the boundaries the contract requires', () => {
  // Guards against a well-meaning cleanup quietly shrinking these.
  for (const t of ['profiles', 'res_purchases', 'res_subscriptions']) {
    assert.ok(FORBIDDEN_TABLES.includes(t), `${t} must stay forbidden (CONTRACT.md §2/§6)`)
  }
  for (const c of ['price', 'deposit', 'is_verified', 'reputation_score']) {
    assert.ok(FORBIDDEN_COLUMNS.includes(c), `${c} must stay forbidden (CONTRACT.md §3/§6)`)
  }
})
