'use client'

import React, { useEffect } from 'react'
import { Provider } from 'react-redux'
import { store, replayOfflineQueue } from './index'

/**
 * Flushes writes that were held while the device was offline.
 *
 * The queue now survives a tab close (persisted to localStorage — see
 * OFFLINE_QUEUE_STORAGE_KEY), so unlike before it is frequently NON-EMPTY
 * at boot. That makes the timing here load-bearing: replayOfflineQueue()
 * drains the queue up front so a second 'online' event can't double-send,
 * so replaying before the Supabase session is restored would push those
 * writes through sync handlers that skip when `currentUser` is null —
 * silently destroying exactly the data this persistence exists to save.
 *
 * So: only flush once a session is actually present, plus on every later
 * 'online' event.
 */
function OfflineQueueFlusher() {
  useEffect(() => {
    const flush = () => {
      if (!navigator.onLine) return
      if (!store.getState().auth.currentUser) return
      if (store.getState().ui.offlineQueue.length === 0) return
      store.dispatch(replayOfflineQueue())
    }

    // A session restored after mount (the normal path — the dashboard
    // bootstraps it asynchronously) should still trigger the flush.
    const unsubscribe = store.subscribe(flush)
    flush()
    window.addEventListener('online', flush)

    return () => {
      unsubscribe()
      window.removeEventListener('online', flush)
    }
  }, [])

  return null
}

export function ReduxProvider({ children }: { children: React.ReactNode }) {
  return (
    <Provider store={store}>
      <OfflineQueueFlusher />
      {children}
    </Provider>
  )
}
