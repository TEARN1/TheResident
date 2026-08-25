import test from 'node:test'
import assert from 'node:assert'
import {
  store,
  addNoticeEvent,
  queueOfflineAction,
  clearOfflineQueue,
  rehydrateOfflineQueue,
  persistQueue,
  loadPersistedQueue,
  OFFLINE_QUEUE_STORAGE_KEY
} from './index'

// WHY THIS FILE EXISTS
// offlineQueue.test.ts asserts against one long-lived `store` object and
// never restarts the process, so it structurally COULD NOT catch that the
// queue was memory-only — it passed while the app silently lost every
// queued write on refresh, tab close, or a background tab-kill (routine on
// the low-end Android devices this app targets), after explicitly telling
// the user "queued and will sync when you reconnect".
//
// These tests simulate the session boundary the old suite couldn't: write
// through one "session", then read back through a fresh one.

// safeStorage checks `typeof window` at CALL time, not import time, so a
// shim installed here is picked up by the real code path under test.
function installStorageShim() {
  const data = new Map<string, string>()
  ;(globalThis as unknown as { window: unknown }).window = {
    localStorage: {
      getItem: (k: string) => (data.has(k) ? data.get(k)! : null),
      setItem: (k: string, v: string) => { data.set(k, String(v)) },
      removeItem: (k: string) => { data.delete(k) }
    }
  }
  return data
}

function removeStorageShim() {
  delete (globalThis as unknown as { window?: unknown }).window
}

test('a queued write SURVIVES a session restart (the regression this file exists for)', () => {
  const disk = installStorageShim()
  try {
    // ── Session 1: user is offline, makes a write, closes the tab ──
    store.dispatch(clearOfflineQueue())
    store.dispatch(queueOfflineAction({ action: addNoticeEvent.type, payload: { id: 'n-1' } }))
    persistQueue(store.getState().ui.offlineQueue)

    assert.ok(disk.has(OFFLINE_QUEUE_STORAGE_KEY), 'the queue must actually reach storage')

    // ── Session 2: fresh boot. Redux starts empty; rehydration restores. ──
    store.dispatch(clearOfflineQueue())
    assert.strictEqual(store.getState().ui.offlineQueue.length, 0, 'a fresh session starts empty')

    const recovered = loadPersistedQueue()
    store.dispatch(rehydrateOfflineQueue(recovered))

    const queue = store.getState().ui.offlineQueue
    assert.strictEqual(queue.length, 1, 'the write made in session 1 is still there in session 2')
    assert.strictEqual((queue[0].payload as { id: string }).id, 'n-1')
  } finally {
    store.dispatch(clearOfflineQueue())
    removeStorageShim()
  }
})

test('an empty queue clears storage rather than leaving a stale entry behind', () => {
  const disk = installStorageShim()
  try {
    persistQueue([{ action: addNoticeEvent.type, payload: { id: 'n-1' } }])
    assert.ok(disk.has(OFFLINE_QUEUE_STORAGE_KEY))

    persistQueue([])
    assert.ok(!disk.has(OFFLINE_QUEUE_STORAGE_KEY), 'a drained queue must not resurrect on the next boot')
  } finally {
    removeStorageShim()
  }
})

test('corrupt stored data degrades to an empty queue instead of throwing on boot', () => {
  const disk = installStorageShim()
  try {
    // A tab killed mid-write leaves truncated JSON. Every boot must survive it.
    disk.set(OFFLINE_QUEUE_STORAGE_KEY, '[{"action":"add')
    assert.deepStrictEqual(loadPersistedQueue(), [])

    // Right JSON, wrong shape — must be rejected by the type guard, not trusted.
    disk.set(OFFLINE_QUEUE_STORAGE_KEY, '{"not":"an array"}')
    assert.deepStrictEqual(loadPersistedQueue(), [])

    disk.set(OFFLINE_QUEUE_STORAGE_KEY, '[{"payload":{}}]')
    assert.deepStrictEqual(loadPersistedQueue(), [], 'entries without an action string are not replayable')
  } finally {
    removeStorageShim()
  }
})

test('persistence degrades silently when storage is unavailable (private mode / quota)', () => {
  ;(globalThis as unknown as { window: unknown }).window = {
    localStorage: {
      getItem: () => { throw new Error('SecurityError: storage disabled') },
      setItem: () => { throw new Error('QuotaExceededError') },
      removeItem: () => { throw new Error('SecurityError: storage disabled') }
    }
  }
  try {
    // Must not throw — a storage failure cannot be allowed to break the app
    // for the users least able to work around it.
    assert.doesNotThrow(() => persistQueue([{ action: 'x', payload: {} }]))
    assert.deepStrictEqual(loadPersistedQueue(), [])
  } finally {
    removeStorageShim()
  }
})

test('rehydration respects the queue bound — a huge stored queue cannot blow past the cap', () => {
  store.dispatch(clearOfflineQueue())
  const oversized = Array.from({ length: 250 }, (_, i) => ({ action: addNoticeEvent.type, payload: { id: `n-${i}` } }))
  store.dispatch(rehydrateOfflineQueue(oversized))

  const queue = store.getState().ui.offlineQueue
  assert.strictEqual(queue.length, 100, 'MAX_OFFLINE_QUEUE still applies to restored queues')
  // Keeps the NEWEST writes — the tail — matching queueOfflineAction's own
  // oldest-first eviction.
  assert.strictEqual((queue[queue.length - 1].payload as { id: string }).id, 'n-249')
  store.dispatch(clearOfflineQueue())
})
