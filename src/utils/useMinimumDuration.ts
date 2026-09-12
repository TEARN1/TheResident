'use client'

import { useEffect, useRef, useState } from 'react'

// Item 170.
//
// A loader that appears and disappears inside 100ms reads as a flicker or a
// glitch, not as progress — and on a fast connection that is most loads in
// this app. Once a loading state has been shown at all, it stays up for a
// minimum period so the transition is legible.
//
// The asymmetry matters and is deliberate: going TRUE is immediate (never
// delay telling someone you are working), going FALSE is what gets held.
export const DEFAULT_MINIMUM_MS = 400

export function useMinimumDuration(active: boolean, minimumMs = DEFAULT_MINIMUM_MS): boolean {
  const [held, setHeld] = useState(active)
  // Initialised to null rather than Date.now(): reading the clock during
  // render is impure, and React may render a component more than once per
  // commit — the stamp would then be whichever render happened to win. The
  // effect below sets it on the first pass where `active` is true.
  const shownAt = useRef<number | null>(null)

  useEffect(() => {
    if (active) {
      if (shownAt.current === null) shownAt.current = Date.now()
      // eslint-disable-next-line react-hooks/set-state-in-effect -- synchronising with the clock, which is the external system this hook exists to wrap
      setHeld(true)
      return
    }
    if (shownAt.current === null) {
      setHeld(false)
      return
    }
    const elapsed = Date.now() - shownAt.current
    const remaining = minimumMs - elapsed
    if (remaining <= 0) {
      shownAt.current = null
      setHeld(false)
      return
    }
    const t = setTimeout(() => {
      shownAt.current = null
      setHeld(false)
    }, remaining)
    return () => clearTimeout(t)
  }, [active, minimumMs])

  return held
}

/**
 * The pure part, extracted so it can be tested without a renderer: given when
 * the loader first appeared and the time now, how much longer must it stay?
 */
export function remainingHoldMs(
  shownAt: number | null,
  now: number,
  minimumMs = DEFAULT_MINIMUM_MS
): number {
  if (shownAt === null) return 0
  return Math.max(0, minimumMs - (now - shownAt))
}
