// Storage that cannot crash the app.
//
// Web Storage throws in more situations than most code expects, and every one
// of them is real on the devices this app targets:
//
//   * Accessing `window.localStorage` AT ALL throws a SecurityError when the
//     browser is set to block site data — the exception happens on the property
//     read, before any guard like `!window.localStorage` can return false.
//   * setItem throws QuotaExceededError when the device is full, and on a
//     cheap phone with a nearly-full disk that is not an edge case.
//   * Both are unavailable during server rendering.
//
// None of that is worth crashing over. A dismissed banner that forgets itself
// is a small annoyance; a white screen because a theme preference could not be
// read is not. So every operation here fails quietly and returns a fallback.
//
// Zero imports, so the edge runtime and tests can use it too.

export interface KeyValueStore {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
  keys(): string[]
}

type Kind = 'local' | 'session'

/**
 * Returns the underlying Storage, or null when it is unusable.
 *
 * The whole body is inside a try because the property access itself is what
 * throws — this is not defensive habit, it is the actual failure.
 */
function rawStorage(kind: Kind): Storage | null {
  try {
    if (typeof window === 'undefined') return null
    const store = kind === 'local' ? window.localStorage : window.sessionStorage
    if (!store) return null

    // Some browsers expose the object and then refuse to use it, so a
    // round-trip is the only honest availability check.
    const probe = '__res_probe__'
    store.setItem(probe, '1')
    store.removeItem(probe)
    return store
  } catch {
    return null
  }
}

function wrap(kind: Kind): KeyValueStore {
  return {
    getItem(key) {
      try {
        return rawStorage(kind)?.getItem(key) ?? null
      } catch {
        return null
      }
    },
    setItem(key, value) {
      try {
        rawStorage(kind)?.setItem(key, value)
      } catch {
        // Quota exceeded, or storage disabled mid-session. The caller asked to
        // remember something and we could not — which is never worth an
        // exception the UI has to handle.
      }
    },
    removeItem(key) {
      try {
        rawStorage(kind)?.removeItem(key)
      } catch {
        /* nothing to clean up if it was never readable */
      }
    },
    keys() {
      try {
        const store = rawStorage(kind)
        return store ? Object.keys(store) : []
      } catch {
        return []
      }
    },
  }
}

export const safeLocal: KeyValueStore = wrap('local')
export const safeSession: KeyValueStore = wrap('session')

/** True when storage actually works right now. For deciding what to offer. */
export function storageAvailable(kind: Kind = 'local'): boolean {
  return rawStorage(kind) !== null
}

/**
 * Reads a value constrained to a known set.
 *
 * Storage is user-editable and survives across deploys, so a value written by
 * an older version — or by hand — can be anything at all. Validating on read
 * keeps that from reaching code that assumed a union type.
 */
export function readEnum<T extends string>(
  store: KeyValueStore, key: string, allowed: readonly T[], fallback: T
): T {
  // Guarded even though safeLocal/safeSession never throw: this takes any
  // KeyValueStore, so a caller can pass a raw Storage — and a raw Storage
  // throwing here would defeat the entire purpose of this module.
  try {
    const raw = store.getItem(key)
    return (allowed as readonly string[]).includes(raw ?? '') ? (raw as T) : fallback
  } catch {
    return fallback
  }
}
