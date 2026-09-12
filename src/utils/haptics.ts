// Item 160.
//
// A short vibration on the actions that commit something — a report filed, a
// room request sent, an alert acknowledged. Not on navigation, not on
// scrolling, and never on anything that happens without the user asking: a
// phone that buzzes at its owner unprompted gets its permissions revoked.
//
// Support is genuinely partial. Chrome on Android has it; iOS Safari does
// not, at any version. So this is a silent no-op on a large share of real
// devices by design — it is a reinforcement of feedback that already exists
// visually, never the only signal that something happened.

/** Milliseconds. Short enough to read as a tick rather than an alert. */
const PATTERNS = {
  /** A choice registered — a toggle, a selection. */
  tap: 10,
  /** Something was committed and cannot be un-done by looking away. */
  commit: [12, 40, 12],
  /** Something failed. Deliberately the longest, and the only double-beat. */
  error: [30, 60, 30]
} as const

export type HapticKind = keyof typeof PATTERNS

export function canVibrate(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function'
}

/**
 * Honours prefers-reduced-motion. That setting is usually read as being about
 * animation, but it is set by people who find movement unpleasant or
 * disorienting, and an unexpected vibration is movement they are holding.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function haptic(kind: HapticKind = 'tap'): void {
  if (!canVibrate() || prefersReducedMotion()) return
  try {
    navigator.vibrate(PATTERNS[kind] as number | number[])
  } catch {
    // Some browsers throw when the page is not visible or the gesture
    // requirement is unmet. There is nothing useful to do about it and
    // nothing the user needs told.
  }
}
