'use client'

import React, { useEffect } from 'react'
import { Provider } from 'react-redux'
import { store, replayOfflineQueue } from './index'

/**
 * Flushes writes that were held while the device was offline.
 * Runs on the browser 'online' event, and once on mount in case connectivity
 * came back while the app was closed and the queue survived in memory.
 */
function OfflineQueueFlusher() {
  useEffect(() => {
    const flush = () => {
      store.dispatch(replayOfflineQueue())
    }

    if (navigator.onLine) flush()
    window.addEventListener('online', flush)
    return () => window.removeEventListener('online', flush)
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
