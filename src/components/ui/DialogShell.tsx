'use client'

import React, { useRef } from 'react'
import { useDialogBehaviour } from '../../utils/useDialogBehaviour'

// Adoption path for the 16 hand-rolled overlays.
//
// Each of them already renders `<div className="fixed inset-0 …">` with a
// backdrop and a panel inside, each with its own markup, animation and
// layout. Rewriting them all onto <Modal> is a large change with real
// regression risk, and it would hold an accessibility fix hostage to a
// refactor.
//
// This replaces only the outer div. The children — backdrop, panel,
// everything — stay exactly as they are, and gain the focus trap, Escape
// handling, scroll lock and focus restore that none of them had.
//
// `aria-label` is required rather than optional: a dialog with no accessible
// name is announced as just "dialog", which tells a screen-reader user that
// something has opened and nothing about what.
export default function DialogShell({
  onClose, label, className, children
}: {
  onClose: () => void
  label: string
  /** Defaults to the layout every existing overlay already uses. */
  className?: string
  children: React.ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  // Always true: these are rendered conditionally by their parent, so being
  // mounted IS being open. Passing a flag would add a second source of truth.
  useDialogBehaviour(true, onClose, ref)

  return (
    <div
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-label={label}
      tabIndex={-1}
      className={className ?? 'fixed inset-0 z-[200] flex items-center justify-center p-4'}
    >
      {children}
    </div>
  )
}
