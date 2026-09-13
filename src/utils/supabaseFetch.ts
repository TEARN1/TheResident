// A fetch with a deadline, for the Supabase client.
//
// WHY THIS EXISTS RATHER THAN 53 SEPARATE FIXES.
//
// A loading flag cleared in a `finally` is only safe if the promise settles.
// A request that is accepted and then never answered — a stalled mobile
// connection, a proxy holding the socket, a rate-limited endpoint — never
// settles, so the finally never runs and the loader stays on screen for the
// rest of the session. It was measured on the gossip feed: the skeleton sat
// there indefinitely with the network hanging.
//
// Wrapping each call site in withTimeout() fixes the one you remember. 53
// call sites across the app awaited Supabase behind a visible loading state
// without one, and the 54th would be written next week. The transport is the
// one place that covers all of them, including the ones not written yet.
//
// This does NOT replace withTimeout(). That is still the right tool for a
// non-Supabase await — a third-party geocode, a storage upload, anything
// where the caller wants a different deadline or its own message.

/** Long enough for a slow 3G round trip, short enough that nobody waits it out. */
export const REQUEST_TIMEOUT_MS = 20000

/**
 * Realtime and auth-refresh traffic is long-lived by design; aborting it on a
 * timer would break the websocket handshake and silently log people out.
 * Only the data paths get a deadline.
 */
export function shouldTimeOut(url: string): boolean {
  return !/\/realtime\/|\/auth\/v1\//.test(url)
}

export function createTimeoutFetch(
  base: typeof fetch = fetch,
  timeoutMs: number = REQUEST_TIMEOUT_MS
): typeof fetch {
  return async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    if (!shouldTimeOut(url)) return base(input, init)

    const controller = new AbortController()
    // A caller that passed its own signal keeps it: aborting for their own
    // reason must still work, and the deadline is in addition to that, not
    // instead of it.
    const callerSignal = init?.signal
    if (callerSignal) {
      if (callerSignal.aborted) controller.abort()
      else callerSignal.addEventListener('abort', () => controller.abort(), { once: true })
    }

    // Abort AND race. The abort is what actually stops the request and frees
    // the socket; the race is what guarantees this promise settles.
    //
    // Relying on the abort alone was the first version, and writing the test
    // showed why it is not enough: it only works if the transport honours the
    // signal. A real browser fetch does, but that makes the guarantee someone
    // else's to keep — and the whole point here is that a promise which never
    // settles strands a loading flag forever. So the deadline rejects on its
    // own account.
    let timer: ReturnType<typeof setTimeout> | undefined
    const deadline = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => {
        controller.abort()
        reject(new Error('The server took too long to respond. Check your connection and try again.'))
      }, timeoutMs)
    })

    try {
      return await Promise.race([base(input, { ...init, signal: controller.signal }), deadline])
    } catch (err) {
      // A deliberate abort by the caller is not a timeout, and must not be
      // relabelled as one — they know why they cancelled.
      if (err instanceof DOMException && err.name === 'AbortError' && !callerSignal?.aborted) {
        throw new Error('The server took too long to respond. Check your connection and try again.')
      }
      throw err
    } finally {
      clearTimeout(timer)
    }
  }
}
