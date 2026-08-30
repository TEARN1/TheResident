import test from 'node:test'
import assert from 'node:assert'
import {
  defaultTargetHours, hoursBetween, targetDeadline, slaState, isSettled,
  hoursToAcknowledge, hoursToResolve, median, describeDuration, sortByUrgency,
  type ServiceReport
} from './serviceReports'

// These mirror res_default_target_hours() and the SLA arithmetic in
// theresident_service_desk_schema.sql. The DB is the authority; these exist so
// the UI can show a clock without a round trip, and are tested because a
// Postgres function cannot be exercised from `npm test`.

const HOUR = 3_600_000
const T0 = '2026-03-01T08:00:00.000Z'
const at = (hoursAfterT0: number) => new Date(Date.parse(T0) + hoursAfterT0 * HOUR).toISOString()

const report = (over: Partial<ServiceReport> = {}): ServiceReport => ({
  id: 'r1',
  reference: 'SR-2026-00001',
  reporterId: 'u1',
  providerId: null,
  providerNameRaw: null,
  category: 'sewerage',
  title: 'Sewer overflowing into the street',
  detail: null,
  severity: 'high',
  suburb: 'Ivory Park',
  city: 'Midrand',
  lat: null,
  lon: null,
  status: 'submitted',
  targetHours: 24,
  acknowledgedAt: null,
  firstResponseAt: null,
  resolvedAt: null,
  closedAt: null,
  createdAt: T0,
  ...over
})

test('response targets get stricter as severity rises, and vary by category', () => {
  // Sewerage and water are health issues — tighter than a street light.
  assert.strictEqual(defaultTargetHours('sewerage', 'critical'), 12)
  assert.strictEqual(defaultTargetHours('sewerage', 'low'), 72)
  assert.strictEqual(defaultTargetHours('power', 'critical'), 8)
  assert.strictEqual(defaultTargetHours('streetlight', 'low'), 336)

  // Within a category, more severe is never given more time.
  const cats = ['power', 'water', 'sewerage', 'road', 'other'] as const
  for (const c of cats) {
    assert.ok(defaultTargetHours(c, 'critical') <= defaultTargetHours(c, 'high'), `${c}: critical <= high`)
    assert.ok(defaultTargetHours(c, 'high') <= defaultTargetHours(c, 'medium'), `${c}: high <= medium`)
    assert.ok(defaultTargetHours(c, 'medium') <= defaultTargetHours(c, 'low'), `${c}: medium <= low`)
  }
})

test('hoursBetween measures forward time and tolerates rubbish input', () => {
  assert.strictEqual(hoursBetween(T0, at(24)), 24)
  assert.strictEqual(hoursBetween(T0, Date.parse(at(3))), 3)
  // A resolution stamped before the report was filed is nonsense but must not throw.
  assert.strictEqual(hoursBetween(at(5), T0), -5)
  assert.strictEqual(hoursBetween('not-a-date'), 0)
})

test('targetDeadline is the filing time plus the snapshotted target', () => {
  assert.strictEqual(targetDeadline({ createdAt: T0, targetHours: 24 }), at(24))
})

test('slaState walks on_time -> due_soon -> overdue, and stops once settled', () => {
  const r = report({ targetHours: 24 })
  assert.strictEqual(slaState(r, Date.parse(at(1))), 'on_time')
  // due_soon begins at 75% of the target elapsed — 18h of 24h.
  assert.strictEqual(slaState(r, Date.parse(at(17))), 'on_time')
  assert.strictEqual(slaState(r, Date.parse(at(18))), 'due_soon')
  assert.strictEqual(slaState(r, Date.parse(at(23.9))), 'due_soon')
  assert.strictEqual(slaState(r, Date.parse(at(24))), 'overdue')
  assert.strictEqual(slaState(r, Date.parse(at(500))), 'overdue')

  // The three-week sewer: unambiguously overdue.
  assert.strictEqual(slaState(report({ targetHours: 24 }), Date.parse(at(21 * 24))), 'overdue')

  // Once resolved or closed the clock stops, however late it was.
  assert.strictEqual(slaState(report({ status: 'resolved' }), Date.parse(at(999))), 'done')
  assert.strictEqual(slaState(report({ status: 'closed' }), Date.parse(at(999))), 'done')
  assert.strictEqual(slaState(report({ status: 'rejected' }), Date.parse(at(999))), 'done')
})

test('isSettled marks exactly the statuses where nobody still owes a fix', () => {
  assert.strictEqual(isSettled('resolved'), true)
  assert.strictEqual(isSettled('closed'), true)
  assert.strictEqual(isSettled('rejected'), true)
  assert.strictEqual(isSettled('submitted'), false)
  assert.strictEqual(isSettled('acknowledged'), false)
  assert.strictEqual(isSettled('in_progress'), false)
})

test('acknowledge and resolve durations are null until they actually happen', () => {
  assert.strictEqual(hoursToAcknowledge(report()), null)
  assert.strictEqual(hoursToResolve(report()), null)
  assert.strictEqual(hoursToAcknowledge(report({ acknowledgedAt: at(6) })), 6)
  assert.strictEqual(hoursToResolve(report({ resolvedAt: at(60) })), 60)
})

test('median handles odd, even and empty sets', () => {
  assert.strictEqual(median([4, 1, 3]), 3)
  assert.strictEqual(median([1, 2, 3, 4]), 2.5)
  assert.strictEqual(median([7]), 7)
  assert.strictEqual(median([]), null)
  // Non-finite values are dropped rather than poisoning the result.
  assert.strictEqual(median([1, NaN, 3]), 2)
})

test('describeDuration reads the way a resident would say it', () => {
  assert.strictEqual(describeDuration(0.5), 'under an hour')
  assert.strictEqual(describeDuration(1), '1 hour')
  assert.strictEqual(describeDuration(5), '5 hours')
  assert.strictEqual(describeDuration(24), '1 day')
  assert.strictEqual(describeDuration(21 * 24), '21 days')
  assert.strictEqual(describeDuration(null), '—')
})

test('sortByUrgency puts the most overdue first and settled reports last', () => {
  const now = Date.parse(at(30))
  const fresh = report({ id: 'fresh', createdAt: at(29), targetHours: 24 })       // on_time
  const soon = report({ id: 'soon', createdAt: at(11), targetHours: 24 })         // due_soon (19h of 24h)
  const late = report({ id: 'late', createdAt: T0, targetHours: 24 })             // overdue
  const older = report({ id: 'older', createdAt: at(-48), targetHours: 24 })      // overdue, older
  const done = report({ id: 'done', createdAt: at(-72), status: 'resolved' })     // settled

  const order = sortByUrgency([fresh, done, soon, late, older], now).map(r => r.id)
  assert.deepStrictEqual(order, ['older', 'late', 'soon', 'fresh', 'done'])
})
