'use client'

import React, { useCallback, useEffect, useRef } from 'react'
import { X } from 'lucide-react'

// Items 131, 92, 179 and 187 in one component.
//
// There are seven modal/sheet surfaces in this app and not one of them traps
// focus. A keyboard user who opens the "list your property" dialog and presses
// Tab walks straight out of it and into the page behind — which is still
// there, still focusable, and now covered by an overlay they cannot see past.
// They are tabbing through controls that are visually hidden from them. There
// is also no Escape handler and no focus restore, so closing a dialog drops
// them back at the top of the document rather than at the button they opened
// it with.
//
// Shape follows item 92: a full-height sheet on a phone, a centred dialog from
// tablet up. Same component, one breakpoint.

const FOCUSABLE = [
  'a[href]', 'button:not([disabled])', 'input:not([disabled])',
  'select:not([disabled])', 'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])'
].join(',')

/**
 * The wrap decision, extracted because it is where the off-by-one lives and
 * because the DOM half cannot be unit-tested without a renderer.
 *
 * Returns the index Tab should move focus to, or null to let the browser
 * handle it normally. The wrap IS the trap: Tab past the last control returns
 * to the first, and Shift+Tab before the first goes to the last. With only one
 * half, focus escapes in one direction — harder to notice, just as broken.
 */
export function wrapTarget(current: number, count: number, shiftKey: boolean): number | null {
  if (count === 0) return null
  if (!shiftKey && current === count - 1) return 0
  if (shiftKey && (current === 0 || current === -1)) return count - 1
  return null
}

export default function Modal({
  open, onClose, title, children, footer
}: {
  open: boolean
  onClose: () => void
  /** Required: a dialog with no accessible name is announced as just "dialog". */
  title: string
  children: React.ReactNode
  footer?: React.ReactNode
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  const returnTo = useRef<HTMLElement | null>(null)

  const focusables = useCallback((): HTMLElement[] => {
    if (!panelRef.current) return []
    return Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE))
      // A control inside a collapsed section is in the DOM but not reachable;
      // including it would send focus somewhere invisible.
      .filter(el => el.offsetParent !== null || el === document.activeElement)
  }, [])

  useEffect(() => {
    if (!open) return
    // Remember who opened it, so closing can put focus back rather than
    // dropping the user at the top of the document.
    returnTo.current = document.activeElement as HTMLElement | null
    const first = focusables()[0] || panelRef.current
    first?.focus()

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
      returnTo.current?.focus?.()
    }
  }, [open, onClose, focusables])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center"
      // The backdrop is not a button — a screen reader should not announce a
      // clickable region covering the whole page — but clicking it still
      // closes, which is what a pointer user expects.
      onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div aria-hidden="true" className="absolute inset-0 bg-surface-sunken/90 backdrop-blur-md" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="relative w-full sm:max-w-lg max-h-[90vh] overflow-y-auto
          glass-panel glass-panel-raised
          rounded-t-2xl sm:rounded-2xl p-6"
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <h2 className="text-lg font-bold text-content">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="min-w-[44px] min-h-[44px] -m-2 flex items-center justify-center text-content-muted hover:text-content"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        {children}
        {footer && <div className="mt-5 pt-4 border-t border-subtle">{footer}</div>}
      </div>
    </div>
  )
}
