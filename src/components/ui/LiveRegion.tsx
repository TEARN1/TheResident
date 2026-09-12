'use client'

import React, { useEffect, useState } from 'react'

// Item 184.
//
// This app changes content underneath the reader constantly — realtime brings
// in new gossip posts and new messages, an offline queue drains, a broadcast
// arrives. Sighted users see it happen. A screen-reader user is told nothing
// at all, because a list that grows by two rows produces no event anyone is
// listening for. They find out by chance, on their next pass through the page.
//
// One polite live region, mounted once in the dashboard shell, that anything
// can speak through. Polite rather than assertive on purpose: assertive
// interrupts whatever is currently being read, which is right for the panic
// banner (it uses role="alert") and wrong for "3 new posts".

type Listener = (message: string) => void
const listeners = new Set<Listener>()

/**
 * Say something to assistive technology. Safe to call from anywhere,
 * including from code that also runs on the server — it simply does nothing
 * when no region is mounted.
 */
export function announce(message: string): void {
  if (!message) return
  for (const l of listeners) l(message)
}

export default function LiveRegion() {
  const [message, setMessage] = useState('')

  useEffect(() => {
    const listener: Listener = next => {
      // Re-announcing identical text does nothing in most screen readers,
      // because the node did not change. Clearing first forces it to speak —
      // "1 new message" twice in a row is two real events.
      setMessage('')
      requestAnimationFrame(() => setMessage(next))
    }
    listeners.add(listener)
    return () => { listeners.delete(listener) }
  }, [])

  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      // Visually hidden, not display:none — a hidden element is not announced
      // at all, which is the mistake that left the dashboard <h1> silent on
      // every phone.
      style={{
        position: 'absolute', width: 1, height: 1, padding: 0, margin: -1,
        overflow: 'hidden', clipPath: 'inset(50%)', whiteSpace: 'nowrap', border: 0
      }}
    >
      {message}
    </div>
  )
}
