'use client'

import { useEffect } from 'react'

/**
 * One delegated pointer listener for the whole dashboard: it sets --mx/--my
 * on the glass panel (or [data-spotlight] card) under the pointer, which the
 * CSS turns into a soft accent glow that follows the cursor. Mouse only,
 * throttled to one write per frame; renders nothing.
 */
const SELECTOR = '.glass-panel, [data-spotlight]'

export default function PointerSpotlight() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    // Mouse and trackpad only. On a phone a finger hides the glow anyway, and
    // the per-frame style write (plus a layout read) ran while you scrolled.
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return
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
      if (e.pointerType !== 'mouse') return
      x = e.clientX
      y = e.clientY
      const el = e.target as Element | null
      // Never on the map: a style write per frame on the map's panel made
      // the browser recalculate styles under the canvas during every drag.
      if (el?.closest('.fm-map')) {
        target = null
      } else {
        target = el?.closest<HTMLElement>(SELECTOR) ?? null
      }
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
