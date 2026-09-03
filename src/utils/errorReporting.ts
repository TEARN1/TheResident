// Crash reporting — somewhere for a production error to land.
//
// Until this existed, a React error in a resident's browser was invisible:
// no Sentry, no logging, and the only way to hear about a broken screen was
// for someone to say so. This is the small version of that: label the failure,
// redact it, send it, and never let the reporting itself break anything.
//
// THREE RULES, in order of importance.
//
//   1. Reporting must never throw. Every path here swallows. An error reporter
//      that fails during a crash turns one broken screen into two.
//   2. Nothing identifying goes in. Error text is written by the browser and
//      can contain whatever was on screen, and paths can contain secrets —
//      /verify-kin/<token> is a working no-login link. Both are redacted here,
//      before the network call, not in the database.
//   3. A crash loop must not become a flood. Repeats of the same failure are
//      dropped client-side; the RPC is rate limited server-side as well.
import { supabase } from './supabase'

/** Grouping key, not free text — the same bug should group, not scatter. */
export type ErrorLabel = 'render' | 'unhandled_rejection' | 'window_error' | 'network'

const MAX_MESSAGE = 500
const REPEAT_WINDOW_MS = 60_000
const seen = new Map<string, number>()

/**
 * Strips anything that could be a secret or a person.
 *
 * The path matters most: /verify-kin/<token> is a live no-login link, so a
 * crash report containing one would be a crash report containing a working
 * credential. UUIDs and long tokens are replaced wholesale rather than
 * pattern-matched per route, because the next route with a secret in it will
 * not be added to a list here.
 */
export function redact(text: string): string {
  return text
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '<id>')
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, '<email>')
    // Bearer tokens, JWTs and anything else long and opaque in a query string.
    .replace(/([?&](?:token|key|access_token|refresh_token|code)=)[^&\s]+/gi, '$1<redacted>')
    .replace(/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '<jwt>')
    // A bare path segment that is a long opaque string is probably a token.
    .replace(/\/[A-Za-z0-9_-]{24,}(?=\/|$)/g, '/<token>')
}

/** Current page, redacted — the single most useful field for reproducing. */
export function currentPath(): string {
  if (typeof window === 'undefined') return ''
  return redact(window.location.pathname + window.location.search)
}

/**
 * True the first time a given failure is seen in the window, false after.
 * Exported so the dedupe rule is testable rather than an implementation
 * detail buried in a listener.
 */
export function shouldReport(key: string, now = Date.now()): boolean {
  const last = seen.get(key)
  if (last !== undefined && now - last < REPEAT_WINDOW_MS) return false
  seen.set(key, now)
  // Bounded: a long session with many distinct errors must not grow this
  // map without limit.
  if (seen.size > 50) {
    for (const [k, t] of seen) {
      if (now - t >= REPEAT_WINDOW_MS) seen.delete(k)
    }
  }
  return true
}

export function describeError(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`
  if (typeof error === 'string') return error
  try {
    return JSON.stringify(error).slice(0, MAX_MESSAGE)
  } catch {
    return 'Unserialisable error'
  }
}

/** Fire-and-forget. Never throws, never returns a rejected promise. */
export async function reportError(
  label: ErrorLabel,
  error: unknown,
  context?: Record<string, unknown>
): Promise<void> {
  try {
    if (!supabase) return
    const message = redact(describeError(error)).slice(0, MAX_MESSAGE)
    if (!shouldReport(`${label}:${message}`)) return

    await supabase.rpc('res_log_client_error', {
      p_label: label,
      p_message: message,
      p_context: context ? JSON.parse(redact(JSON.stringify(context))) : null,
      p_path: currentPath(),
      p_app_version: process.env.NEXT_PUBLIC_APP_VERSION || null
    })
  } catch {
    // Rule 1. There is nowhere useful for this to go.
  }
}

let installed = false

/**
 * Catches what React's error boundaries do not: errors thrown outside render
 * and promise rejections nobody handled. Safe to call more than once.
 */
export function installErrorReporting(): void {
  if (installed || typeof window === 'undefined') return
  installed = true

  window.addEventListener('error', event => {
    reportError('window_error', event.error ?? event.message, {
      source: event.filename ? redact(event.filename) : undefined,
      line: event.lineno
    })
  })

  window.addEventListener('unhandledrejection', event => {
    reportError('unhandled_rejection', event.reason)
  })
}
