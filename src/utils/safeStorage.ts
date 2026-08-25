// Defensive localStorage wrapper. Every access can throw for reasons that
// have nothing to do with our code: Safari private mode denies writes,
// storage can be disabled by policy, quota can be exhausted, and there is
// no `window` at all during SSR/build. A bare localStorage call in a
// component or a Redux subscriber therefore takes the whole app down for
// the users least able to work around it — which is exactly the audience
// this app targets. Everything here degrades to a no-op instead.

export function isStorageAvailable(): boolean {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return false
    const probe = '__resident_probe__'
    window.localStorage.setItem(probe, '1')
    window.localStorage.removeItem(probe)
    return true
  } catch {
    return false
  }
}

export function safeGet(key: string): string | null {
  try {
    if (typeof window === 'undefined') return null
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

/** Returns false when the write didn't happen (quota, private mode, SSR) — callers can degrade rather than assume success. */
export function safeSet(key: string, value: string): boolean {
  try {
    if (typeof window === 'undefined') return false
    window.localStorage.setItem(key, value)
    return true
  } catch {
    return false
  }
}

export function safeRemove(key: string): boolean {
  try {
    if (typeof window === 'undefined') return false
    window.localStorage.removeItem(key)
    return true
  } catch {
    return false
  }
}

/** Reads and JSON-parses a key, returning `fallback` on absence, malformed JSON, or a failed type guard. */
export function safeGetJSON<T>(key: string, fallback: T, isValid?: (parsed: unknown) => boolean): T {
  const raw = safeGet(key)
  if (raw === null) return fallback
  try {
    const parsed = JSON.parse(raw)
    if (isValid && !isValid(parsed)) return fallback
    return parsed as T
  } catch {
    // Corrupt/partial write (e.g. the tab was killed mid-write) — drop it
    // rather than letting a JSON.parse throw propagate on every boot.
    safeRemove(key)
    return fallback
  }
}

export function safeSetJSON(key: string, value: unknown): boolean {
  try {
    return safeSet(key, JSON.stringify(value))
  } catch {
    return false
  }
}
