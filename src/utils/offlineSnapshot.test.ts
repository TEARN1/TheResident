import test from 'node:test'
import assert from 'node:assert'
import {
  saveSnapshot,
  loadSnapshot,
  clearSnapshots,
  freshnessLabel,
  MAX_SNAPSHOT_AGE_MS
} from './offlineSnapshot'
import type { SnapshotStore } from './offlineSnapshot'

const NOW = Date.parse('2026-08-18T14:20:00Z')
const ago = (ms: number) => NOW - ms
const MIN = 60_000
const HOUR = 60 * MIN

function memoryStore(): SnapshotStore & { raw: Map<string, string> } {
  const raw = new Map<string, string>()
  return {
    raw,
    getItem: k => raw.get(k) ?? null,
    setItem: (k, v) => { raw.set(k, v) },
    removeItem: k => { raw.delete(k) },
    keys: () => [...raw.keys()],
  }
}

/** Writes a snapshot with a chosen timestamp, to test ageing. */
function saveAt(store: SnapshotStore, name: string, userId: string, data: unknown, savedAt: number) {
  saveSnapshot(name, userId, data, store)
  const k = `res:snapshot:${userId}:${name}`
  const parsed = JSON.parse(store.getItem(k) as string)
  parsed.savedAt = new Date(savedAt).toISOString()
  store.setItem(k, JSON.stringify(parsed))
}

test('a snapshot survives and comes back', () => {
  const store = memoryStore()
  saveSnapshot('faults', 'u-1', [{ id: 'f-1', kind: 'power_outage' }], store)

  const back = loadSnapshot<Array<{ id: string }>>('faults', 'u-1', store, NOW)
  assert.ok(back)
  assert.strictEqual(back!.data[0].id, 'f-1')
  assert.ok(back!.savedAt)
})

test('one person on a shared phone never sees another person snapshot', () => {
  // A shared phone is the normal case here, not the edge case.
  const store = memoryStore()
  saveSnapshot('faults', 'u-1', ['thandi data'], store)
  assert.strictEqual(loadSnapshot('faults', 'u-2', store, NOW), null)
})

test('sign-out clears every snapshot on the device, for every user', () => {
  const store = memoryStore()
  saveSnapshot('faults', 'u-1', ['a'], store)
  saveSnapshot('outages', 'u-2', ['b'], store)
  store.setItem('unrelated-key', 'keep me')

  clearSnapshots(store)

  assert.strictEqual(loadSnapshot('faults', 'u-1', store, NOW), null)
  assert.strictEqual(loadSnapshot('outages', 'u-2', store, NOW), null)
  assert.strictEqual(store.getItem('unrelated-key'), 'keep me',
    'clearing must not touch anything that is not ours')
})

test('data too old is discarded, not shown', () => {
  // A day-old outage report is not slightly stale, it is wrong: the power
  // almost certainly came back and nobody was online to record it.
  const store = memoryStore()
  saveAt(store, 'faults', 'u-1', ['old'], ago(MAX_SNAPSHOT_AGE_MS + MIN))

  assert.strictEqual(loadSnapshot('faults', 'u-1', store, NOW), null)
  assert.strictEqual(store.getItem('res:snapshot:u-1:faults'), null,
    'expired snapshots are removed, not left to rot')
})

test('data just inside the window is still shown', () => {
  const store = memoryStore()
  saveAt(store, 'faults', 'u-1', ['recent'], ago(MAX_SNAPSHOT_AGE_MS - MIN))
  assert.ok(loadSnapshot('faults', 'u-1', store, NOW))
})

test('corrupt storage returns nothing rather than throwing', () => {
  const store = memoryStore()
  store.setItem('res:snapshot:u-1:faults', '{not json')
  assert.strictEqual(loadSnapshot('faults', 'u-1', store, NOW), null)
})

test('a missing store is survivable — private mode, SSR, disabled storage', () => {
  assert.doesNotThrow(() => saveSnapshot('faults', 'u-1', ['x'], null))
  assert.strictEqual(loadSnapshot('faults', 'u-1', null, NOW), null)
  assert.doesNotThrow(() => clearSnapshots(null))
})

test('an empty user id is never written or read', () => {
  const store = memoryStore()
  saveSnapshot('faults', '', ['x'], store)
  assert.strictEqual(store.keys().length, 0)
  assert.strictEqual(loadSnapshot('faults', '', store, NOW), null)
})

// ── The label ──────────────────────────────────────────────────────────────
// Stale data is shown, never hidden — but always with its age attached.

test('freshness is stated plainly, never vaguely', () => {
  assert.strictEqual(freshnessLabel(new Date(ago(30_000)).toISOString(), NOW), 'Just now')
  assert.strictEqual(freshnessLabel(new Date(ago(20 * MIN)).toISOString(), NOW), 'As of 20 min ago')
  assert.strictEqual(freshnessLabel(new Date(ago(1 * HOUR)).toISOString(), NOW), 'As of 1 hour ago')
  assert.strictEqual(freshnessLabel(new Date(ago(5 * HOUR)).toISOString(), NOW), 'As of 5 hours ago')
  assert.strictEqual(freshnessLabel(new Date(ago(30 * HOUR)).toISOString(), NOW), 'Saved over a day ago')
})

test('a nonsense timestamp degrades to something honest', () => {
  assert.strictEqual(freshnessLabel('not-a-date', NOW), 'Saved earlier')
  assert.strictEqual(freshnessLabel(new Date(NOW + HOUR).toISOString(), NOW), 'Saved earlier',
    'a future timestamp must not claim to be fresh')
})
