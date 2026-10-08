'use client'

import { useEffect } from 'react'

/**
 * One delegated pointer listener for the whole dashboard: it sets --mx/--my
 * on the glass panel (or [data-spotlight] card) under the pointer, which the
 * CSS turns into a soft accent glow that follows the cursor or finger.
 * Throttled to one write per frame; renders nothing.
 */
const SELECTOR = '.glass-panel, [data-spotlight]'

export default function PointerSpotlight() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let frame = 0
    let last: HTMLElement | null = null
    let x = 0
    let y = 0
    let target: HTMLElement | null = null

    const paint = () => {
      frame = 0
      if (last && last !== target) {
        last.style.removeProperty('--mx')
        last.style.removeProperty('--my')
      }
      last = target
      if (!target) return
      const rect = target.getBoundingClientRect()
      target.style.setProperty('--mx', `${x - rect.left}px`)
      target.style.setProperty('--my', `${y - rect.top}px`)
    }

    const onMove = (e: PointerEvent) => {
      x = e.clientX
      y = e.clientY
      target = (e.target as Element | null)?.closest<HTMLElement>(SELECTOR) ?? null
      if (!frame) frame = requestAnimationFrame(paint)
    }

    document.addEventListener('pointermove', onMove, { passive: true })
    return () => {
      document.removeEventListener('pointermove', onMove)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [])

  return null
}
