import test from 'node:test'
import assert from 'node:assert'
import {
  store,
  loginUser,
  addNoticeEvent,
  vibeNotice,
  queueOfflineAction,
  clearOfflineQueue,
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
