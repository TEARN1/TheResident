// The literal, buildable version of "if one way fails, try another" — applied
// per network operation (where things actually fail), not per line of code.
// Three tiers: (1) the direct call, (2) one automatic retry with backoff on a
// transient failure, (3) the caller's own fallback (e.g. store/index.ts's
// existing offline queue) once both attempts are exhausted. This utility is
// tiers 1+2; tier 3 stays with the caller since only it knows what a
// reasonable fallback looks like for that operation.
import { getErrorMessage } from './errors'

export interface ResilientCallOptions {
  /** Delay (ms) before each retry attempt. One entry = one retry. */
  backoffMs?: number[]
  /** Return false to skip retrying — e.g. a permission failure that retrying can't fix. */
  isRetryable?: (err: unknown) => boolean
}

// A rejected write should stay rejected — retrying a permission failure just
// wastes a round trip on an outcome that can't change. Only network/timeout-
// shaped failures are worth a second attempt.
export function isRetryableError(err: unknown): boolean {
  const message = getErrorMessage(err).toLowerCase()
  const code = (err && typeof err === 'object' && 'code' in err) ? String((err as { code: unknown }).code) : ''

  const nonRetryable =
    message.includes('row-level security') ||
    message.includes('permission denied') ||
    message.includes('jwt') ||
    message.includes('rate_limited') ||
    // The shared res_check_rate_limit() RPC raises this exact string; without
    // it a throttled call was retried, which only drove the counter higher.
    message.includes('rate_limit_exceeded') ||
    message.includes('rate limit') ||
    message.includes('violates') ||
    message.includes('duplicate key') ||
    code === '42501' || // insufficient_privilege
    code === 'PGRST301' // JWT expired/invalid

  return !nonRetryable
}

/** Runs `fn`, retrying with backoff on transient failure. Never retries a non-retryable error. */
export async function resilientCall<T>(fn: () => Promise<T>, options: ResilientCallOptions = {}): Promise<T> {
  const backoffMs = options.backoffMs ?? [1000]
  const isRetryable = options.isRetryable ?? isRetryableError

  let lastError: unknown
  try {
    return await fn()
  } catch (err) {
    lastError = err
    if (!isRetryable(err)) throw err
  }

  for (const delay of backoffMs) {
    await new Promise(resolve => setTimeout(resolve, delay))
    try {
      return await fn()
    } catch (err) {
      lastError = err
      if (!isRetryable(err)) throw err
    }
  }

  throw lastError
}

/**
 * Reject if a promise has not settled within `ms`.
 *
 * WHY THIS EXISTS. `/dashboard/messages` showed "Loading conversations…"
 * forever — measured still spinning after four seconds, and it would have
 * stayed that way indefinitely. The cause was not an error being swallowed;
 * the request simply never settled, and nothing was watching the clock. A
 * fetch to an unreachable host can hang for minutes before the browser gives
 * up, and on a train or in a dead spot that is exactly what happens.
 *
 * An infinite spinner is the worst possible answer to a network failure. It
 * looks like the app is working, right up until the person closes it — so
 * they never see an error, never retry, and conclude the app is broken.
 *
 * Anything that awaits the network on behalf of a visible loading state
 * should go through this.
 */
export function withTimeout<T>(
  promise: PromiseLike<T>,
  ms = 15000,
  label = 'request'
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`The ${label} took too long to respond. Check your connection and try again.`))
    }, ms)
    Promise.resolve(promise).then(
      value => { clearTimeout(timer); resolve(value) },
      err => { clearTimeout(timer); reject(err) }
    )
  })
}
