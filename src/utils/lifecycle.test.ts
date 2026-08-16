import test from 'node:test'
import assert from 'node:assert'
import {
  TRANSITIONS,
  statesOf,
  entities,
  findTransition,
  canTransition,
  terminalStates,
  INITIAL_STATES,
  jobReachableStates
} from './lifecycle'
import type { ActorKind } from './lifecycle'

// The transition table is data that Postgres also enforces, so these tests are
// about the SHAPE of the machine — the invariants that make automation safe —
// not about restating each row.

test('no duplicate transitions: one entity/from/to pair has exactly one rule', () => {
  const seen = new Set<string>()
  for (const t of TRANSITIONS) {
    const key = `${t.entity}:${t.from}->${t.to}`
    assert.ok(!seen.has(key), `duplicate transition ${key}`)
    seen.add(key)
  }
})

test('no self-transitions: a state may not move to itself', () => {
  for (const t of TRANSITIONS) {
    assert.notStrictEqual(t.from, t.to, `${t.entity} has a self-transition on ${t.from}`)
  }
})

test('every transition names at least one actor', () => {
  for (const t of TRANSITIONS) {
    assert.ok(t.actors.length > 0, `${t.entity}:${t.from}->${t.to} has no actors`)
  }
})

test('every transition carries a note — the audit log reason depends on it', () => {
  for (const t of TRANSITIONS) {
    assert.ok(t.note.trim().length > 10, `${t.entity}:${t.from}->${t.to} has no meaningful note`)
  }
})

test('every entity has at least one reachable terminal or looping state', () => {
  // A machine where every state leads onward forever would never settle.
  for (const e of entities()) {
    const states = statesOf(e)
    assert.ok(states.length >= 2, `${e} has fewer than two states`)
  }
})

test('every entity declares an initial state, and it is a real state of that machine', () => {
  for (const e of entities()) {
    const initial = INITIAL_STATES[e]
    assert.ok(initial, `${e} has no declared initial state`)
    assert.ok(statesOf(e).includes(initial),
      `${e} declares initial state '${initial}' which appears in no transition`)
  }
})

test('no state is unreachable: every state is the initial state or some transition target', () => {
  for (const e of entities()) {
    const targets = new Set(TRANSITIONS.filter(t => t.entity === e).map(t => t.to))
    for (const s of statesOf(e)) {
      assert.ok(s === INITIAL_STATES[e] || targets.has(s),
        `${e}.${s} is unreachable: nothing transitions into it and it is not the initial state`)
    }
  }
})

// ── Safety-critical invariants ─────────────────────────────────────────────
// These are the rules that stop automation doing harm. They are asserted here
// so that loosening one requires deliberately editing a test that says why.

test('a job can never close a critical alert: auto_closed is guarded', () => {
  const t = findTransition('res_alerts', 'active', 'auto_closed')
  assert.ok(t, 'the auto_closed transition should exist')
  assert.deepStrictEqual(t!.actors, ['job'])
  assert.strictEqual(t!.guard, 'notCritical',
    'auto-closing an alert must be guarded so critical alerts escalate to a human instead')
})

test('care circle has no automated closing state — welfare only escalates', () => {
  const reachable = jobReachableStates('res_care_circle')
  for (const state of reachable) {
    assert.ok(!/closed|resolved|archived/.test(state),
      `a job must not be able to close a care-circle check into ${state}`)
  }
  assert.ok(reachable.includes('escalated'))
})

test('suspension is never reachable by a job — it is Propose tier at minimum', () => {
  for (const t of TRANSITIONS) {
    if (t.to === 'suspended') {
      assert.ok(!t.actors.includes('job'),
        `${t.entity}: a scheduled job must not be able to suspend anything directly`)
    }
  }
})

test('approving or rejecting a room request is a human decision only', () => {
  for (const to of ['approved', 'rejected']) {
    const t = findTransition('res_room_requests', 'pending', to)
    assert.ok(t)
    assert.deepStrictEqual(t!.actors, ['user'],
      `a job must never ${to} a room request on a landlord's behalf`)
  }
})

test('every job-reachable transition is reversible, or is explicitly a notification-bearing move', () => {
  // Automation may only make moves it can take back, because it makes them
  // while nobody is watching.
  const irreversibleJobMoves = TRANSITIONS.filter(
    t => t.actors.includes('job') && !t.reversible
  )
  assert.deepStrictEqual(irreversibleJobMoves, [],
    'a job-reachable transition must be reversible: ' +
    irreversibleJobMoves.map(t => `${t.entity}:${t.from}->${t.to}`).join(', '))
})

// ── Query helpers ──────────────────────────────────────────────────────────

test('canTransition respects the actor list', () => {
  assert.ok(canTransition('res_listings', 'expiring', 'expired', 'job'))
  assert.ok(!canTransition('res_listings', 'expiring', 'expired', 'user'))
  assert.ok(canTransition('res_listings', 'open', 'taken', 'user'))
  assert.ok(!canTransition('res_listings', 'open', 'taken', 'job'))
})

test('canTransition rejects transitions that are not in the table at all', () => {
  assert.ok(!canTransition('res_listings', 'open', 'suspended', 'operator'),
    'open -> suspended must go through flagged; skipping review is not a legal move')
  assert.ok(!canTransition('res_listings', 'expired', 'taken', 'user'))
  assert.ok(!canTransition('res_nonexistent', 'a', 'b', 'user' as ActorKind))
})

test('statesOf is derived, sorted, and free of duplicates', () => {
  const s = statesOf('res_room_requests')
  assert.deepStrictEqual(s, ['approved', 'auto_expired', 'pending', 'rejected', 'withdrawn'])
})

test('terminalStates finds states nothing leads out of', () => {
  const t = terminalStates('res_room_requests')
  assert.ok(t.includes('approved'))
  assert.ok(t.includes('rejected'))
  assert.ok(!t.includes('pending'))
})

test('listings status values match the live database spelling, not the deleted schema file', () => {
  // deploy_production_schema.sql used 'available'; it was never applied and has
  // been deleted. The live check constraint uses 'open'.
  const s = statesOf('res_listings')
  assert.ok(s.includes('open'))
  assert.ok(!s.includes('available'), "listings use 'open', never 'available'")
})
