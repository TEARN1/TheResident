'use client'

import { useCallback, useEffect, useRef } from 'react'
import { wrapTarget } from '../components/ui/Modal'

// The focus trap, Escape handling, scroll lock and focus restore — extracted
// from Modal so an EXISTING overlay can adopt all four in two lines without
// being rewritten.
//
// WHY A HOOK RATHER THAN MIGRATING EVERY OVERLAY.
//
// There are 16 hand-rolled overlays in this app, each with its own markup,
// animation and layout. Rewriting all of them onto <Modal> is a large change
// with real regression risk, and it would hold the accessibility fix hostage
// to a refactor. The behaviour is the part that is missing; the markup mostly
// is not. So the behaviour moves and the markup stays.
//
// New surfaces should still use <Modal>, which uses this hook itself — there
// is one implementation, not two.

export function useDialogBehaviour(
  open: boolean,
  onClose: () => void,
  panelRef: React.RefObject<HTMLElement | null>
): void {
  const returnTo = useRef<HTMLElement | null>(null)

  const focusables = useCallback((): HTMLElement[] => {
    const panel = panelRef.current
    if (!panel) return []
    return Array.from(panel.querySelectorAll<HTMLElement>(
      'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),' +
      'textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'
    )).filter(el => el.offsetParent !== null || el === document.activeElement)
  }, [panelRef])

  useEffect(() => {
    if (!open) return
    returnTo.current = document.activeElement as HTMLElement | null
    const first = focusables()[0] || panelRef.current
    first?.focus?.()

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); return }
      if (e.key !== 'Tab') return
      const items = focusables()
      const target = wrapTarget(items.indexOf(document.activeElement as HTMLElement), items.length, e.shiftKey)
      if (target === null) return
      e.preventDefault()
      items[target]?.focus()
    }

    document.addEventListener('keydown', onKey)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previousOverflow
      // Put focus back where it came from, rather than dropping the user at
      // the top of the document.
      returnTo.current?.focus?.()
    }
  }, [open, onClose, focusables, panelRef])
}
