import test from 'node:test'
import assert from 'node:assert'
import {
  store,
  loginUser,
  addNoticeEvent,
  vibeNotice,
  queueOfflineAction,
  clearOfflineQueue,
  dequeueOfflineAction,
  failOfflineAction,
  NoticeEvent
} from './index'

// The offline queue used to be dead scaffolding: the reducers existed and
// nothing in the app ever dispatched them. These tests pin the behaviour that
// makes it real — bounded growth, and only queueing writes that are safe to
// replay.

const UID = '4e36eee4-5310-437c-a19e-2270a147e260'

const notice = (id: string): NoticeEvent => ({
  id,
  title: 'Braai',
  description: 'Saturday',
  type: 'event',
  postedBy: 'Thandi',
  postedById: UID,
  timestamp: new Date().toISOString(),
  eventDate: '2026-08-01',
  rsvps: []
})

test('offline queue holds writes and clears on replay', () => {
  store.dispatch(clearOfflineQueue())
  assert.strictEqual(store.getState().ui.offlineQueue.length, 0)

  store.dispatch(queueOfflineAction({ action: addNoticeEvent.type, payload: notice('n-1') }))
  store.dispatch(queueOfflineAction({ action: addNoticeEvent.type, payload: notice('n-2') }))

  const queue = store.getState().ui.offlineQueue
  assert.strictEqual(queue.length, 2)
  assert.strictEqual(queue[0].action, addNoticeEvent.type)
  // FIFO: the first write made offline is the first replayed
  assert.strictEqual((queue[0].payload as NoticeEvent).id, 'n-1')

  store.dispatch(clearOfflineQueue())
  assert.strictEqual(store.getState().ui.offlineQueue.length, 0)
})

test('offline queue is bounded — a long offline session cannot grow memory forever', () => {
  store.dispatch(clearOfflineQueue())

  for (let i = 0; i < 150; i++) {
    store.dispatch(queueOfflineAction({ action: addNoticeEvent.type, payload: notice(`n-${i}`) }))
  }

  const queue = store.getState().ui.offlineQueue
  assert.strictEqual(queue.length, 100, 'queue must be capped at MAX_OFFLINE_QUEUE')
  // Oldest entries are dropped first, so the most recent work survives
  assert.strictEqual((queue[0].payload as NoticeEvent).id, 'n-50')
  assert.strictEqual((queue[99].payload as NoticeEvent).id, 'n-149')

  store.dispatch(clearOfflineQueue())
})

test('a replayed write is not re-applied to Redux (no duplicate optimistic state)', () => {
  store.dispatch(clearOfflineQueue())
  store.dispatch(loginUser({
    id: UID, name: 'Thandi', email: 't@example.com', role: 'tenant'
  }))

  const before = store.getState().community.notices.length
  store.dispatch(addNoticeEvent(notice('n-replay')))
  const afterOptimistic = store.getState().community.notices.length
  assert.strictEqual(afterOptimistic, before + 1)

  // Replay sends the queued action straight to Supabase via
  // syncActionToSupabase — it must never be re-dispatched, or the reducer
  // would push the same notice a second time.
  store.dispatch(queueOfflineAction({ action: addNoticeEvent.type, payload: notice('n-replay') }))
  assert.strictEqual(
    store.getState().community.notices.length,
    afterOptimistic,
    'queueing a write must not touch the optimistic state'
  )

  store.dispatch(clearOfflineQueue())
})

test('vibe toggles are rolled back, not queued — replaying one would double-flip it', () => {
  // vibeNotice is in ROLLED_BACK_ACTIONS: on failure the optimistic toggle is
  // reverted, so queueing the write would leave the DB out of step with the UI.
  store.dispatch(clearOfflineQueue())
  store.dispatch(addNoticeEvent(notice('n-vibe')))

  store.dispatch(vibeNotice({ noticeId: 'n-vibe', userName: 'Thandi' }))
  const target = store.getState().community.notices.find(n => n.title === 'Braai')
  assert.ok(target, 'notice should exist')

  // Nothing was queued by the toggle itself; the queue only ever fills from a
  // failed sync, and toggles are excluded from that path.
  assert.strictEqual(store.getState().ui.offlineQueue.length, 0)
})

// ── Durability (F8) ────────────────────────────────────────────────────────
// The queue used to be cleared BEFORE replaying, and the replay path is barred
// from re-queueing — so any write whose replay failed was silently lost. These
// tests pin the rule that replaced that: a queued write leaves the queue only
// on confirmed success, or after repeated failure with the user told.

test('a queued write carries a stable id and an attempt count', () => {
  store.dispatch(clearOfflineQueue())
  store.dispatch(queueOfflineAction({ action: addNoticeEvent.type, payload: notice('n-id') }))

  const [item] = store.getState().ui.offlineQueue
  assert.ok(item.id, 'needs an id so a confirmed write can be removed precisely')
  assert.strictEqual(item.attempts, 0)
  store.dispatch(clearOfflineQueue())
})

test('ids are unique, so removing one confirmed write never removes another', () => {
  store.dispatch(clearOfflineQueue())
  for (let i = 0; i < 25; i++) {
    store.dispatch(queueOfflineAction({ action: addNoticeEvent.type, payload: notice(`n-${i}`) }))
  }
  const ids = store.getState().ui.offlineQueue.map(q => q.id)
  assert.strictEqual(new Set(ids).size, ids.length)
  store.dispatch(clearOfflineQueue())
})

test('only a confirmed write leaves the queue', () => {
  store.dispatch(clearOfflineQueue())
  store.dispatch(queueOfflineAction({ action: addNoticeEvent.type, payload: notice('n-keep') }))
  store.dispatch(queueOfflineAction({ action: addNoticeEvent.type, payload: notice('n-done') }))

  const [, done] = store.getState().ui.offlineQueue
  store.dispatch(dequeueOfflineAction(done.id))

  const rest = store.getState().ui.offlineQueue
  assert.strictEqual(rest.length, 1)
  assert.strictEqual((rest[0].payload as NoticeEvent).id, 'n-keep',
    'the unconfirmed write must survive')
  store.dispatch(clearOfflineQueue())
})

test('a failed replay keeps the write and counts the attempt — this is the bug that lost data', () => {
  store.dispatch(clearOfflineQueue())
  store.dispatch(queueOfflineAction({ action: addNoticeEvent.type, payload: notice('n-retry') }))
  const [item] = store.getState().ui.offlineQueue

  store.dispatch(failOfflineAction(item.id))

  const after = store.getState().ui.offlineQueue
  assert.strictEqual(after.length, 1, 'a failed replay must NOT discard the write')
  assert.strictEqual(after[0].attempts, 1)
  store.dispatch(clearOfflineQueue())
})

test('a write is abandoned only after repeated failure, never on the first', () => {
  store.dispatch(clearOfflineQueue())
  store.dispatch(queueOfflineAction({ action: addNoticeEvent.type, payload: notice('n-doomed') }))
  const [item] = store.getState().ui.offlineQueue

  for (let i = 0; i < 4; i++) {
    store.dispatch(failOfflineAction(item.id))
    assert.strictEqual(store.getState().ui.offlineQueue.length, 1,
      `still queued after ${i + 1} failure(s)`)
  }

  store.dispatch(failOfflineAction(item.id))
  assert.strictEqual(store.getState().ui.offlineQueue.length, 0,
    'dropped on the 5th failure — and replayOfflineQueue tells the user')
  store.dispatch(clearOfflineQueue())
})

test('failing an id that is no longer queued is a harmless no-op', () => {
  // Two replays racing, or a late failure for a write already confirmed.
  store.dispatch(clearOfflineQueue())
  store.dispatch(queueOfflineAction({ action: addNoticeEvent.type, payload: notice('n-solo') }))
  store.dispatch(failOfflineAction('q-does-not-exist'))
  assert.strictEqual(store.getState().ui.offlineQueue.length, 1)
  store.dispatch(clearOfflineQueue())
})
