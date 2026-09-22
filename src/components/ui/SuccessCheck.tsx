'use client'

import React, { useEffect } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { announce } from './LiveRegion'
import { haptic } from '../../utils/haptics'

// Item 161: a subtle success animation for the moment a core loop completes
// — a room request sent, a service report filed.
//
// The animation is the smallest part of this. The app already drew a green
// check next to those messages, so the thing genuinely missing was not
// motion: the banner they appear in carries no `aria-live`, so a
// screen-reader user filed a report and was told nothing at all. Motion that
// only reaches people who can see it is not confirmation, it is decoration.
//
// So this does three things at the moment of success, and the visual one is
// the one that degrades most gracefully:
//   - speaks the message through the app's existing polite live region,
//   - fires the `commit` haptic (a no-op on iOS and on desktop, by design),
//   - draws the check in, for anyone who has not asked for less motion.
//
// Item 153: transform and opacity only. Item 162: the keyframes live behind
// `prefers-reduced-motion: no-preference` in globals.css, so reduced motion
// means no animation at all rather than an animation JavaScript has to
// remember to skip — and the check is fully drawn either way.

export interface SuccessCheckProps {
  /** The message being confirmed. Spoken to assistive technology verbatim. */
  message: string
  /** Icon size in px. Matches the banner's other icons at the default. */
  size?: number
}

export default function SuccessCheck({ message, size = 18 }: SuccessCheckProps) {
  useEffect(() => {
    // Keyed on the message so a second success with different wording is
    // announced again, while a re-render of the same one is not.
    if (!message) return
    announce(message)
    haptic('commit')
  }, [message])

  return (
    <CheckCircle2
      size={size}
      color="var(--success)"
      className="success-check"
      aria-hidden="true"
    />
  )
}
