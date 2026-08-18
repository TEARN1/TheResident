// Last-known-state, kept for when there is no connection.
//
// The reason this exists, plainly: load shedding means no power, degraded
// towers and a dying phone. The moment a resident most needs to know what is
// broken and whether the water is coming back is exactly the moment they
// cannot fetch it. A civic app that shows a spinner then is worse than
// useless — it teaches people not to rely on it.
//
// Why not the service worker: public/sw.js deliberately refuses to cache API
// responses, so that authenticated data never lands in a browser cache shared
// with whoever else uses the phone. That is the right call, so offline data
// lives here instead — per user, in the app, cleared on sign-out.
//
// Two rules:
//   1. Stale data is shown, never hidden — but ALWAYS labelled with its age.
//      "As of 14:20, you are offline" is honest and useful. Silently showing
//      three-hour-old outage data as if it were live is neither.
//   2. Nothing sensitive. Snapshots hold what is already public to the
//      neighbourhood — faults and outages — never messages, never profiles.

export interface Snapshot<T> {
  data: T
  savedAt: string
  userId: string
}

/** Storage seam, so this is testable without a browser. */
export interface SnapshotStore {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
  keys(): string[]
}

function browserStore(): SnapshotStore | null {
  if (typeof window === 'undefined' || !window.localStorage) return null
  const ls = window.localStorage
  return {
    getItem: k => ls.getItem(k),
    setItem: (k, v) => ls.setItem(k, v),
    removeItem: k => ls.removeItem(k),
    keys: () => Object.keys(ls),
  }
}

const PREFIX = 'res:snapshot:'
const key = (name: string, userId: string) => `${PREFIX}${userId}:${name}`

/**
 * Anything older than this is not shown at all.
 *
 * A day-old outage report is not "slightly stale", it is wrong — the power
 * almost certainly came back and nobody was online to record it. Better to
 * show nothing than to show something confidently false.
 */
export const MAX_SNAPSHOT_AGE_MS = 12 * 60 * 60 * 1000

export function saveSnapshot<T>(
  name: string, userId: string, data: T, store: SnapshotStore | null = browserStore()
): void {
  if (!store || !userId) return
  try {
    const snapshot: Snapshot<T> = { data, savedAt: new Date().toISOString(), userId }
    store.setItem(key(name, userId), JSON.stringify(snapshot))
  } catch {
    // Quota exceeded, private mode, or a disabled store. Losing a cache is
    // never worth breaking the page over.
  }
}

export function loadSnapshot<T>(
  name: string, userId: string,
  store: SnapshotStore | null = browserStore(),
  now: number = Date.now()
): Snapshot<T> | null {
  if (!store || !userId) return null
  try {
    const raw = store.getItem(key(name, userId))
    if (!raw) return null

    const snapshot = JSON.parse(raw) as Snapshot<T>
    if (!snapshot?.savedAt || snapshot.userId !== userId) return null

    if (now - new Date(snapshot.savedAt).getTime() > MAX_SNAPSHOT_AGE_MS) {
      store.removeItem(key(name, userId))
      return null
    }
    return snapshot
  } catch {
    return null
  }
}

/**
 * Clears every snapshot for every user on this device.
 *
 * Called on sign-out. A shared phone is the normal case, not the edge case, so
 * one person's last-known state must not survive into the next person's
 * session.
 */
export function clearSnapshots(store: SnapshotStore | null = browserStore()): void {
  if (!store) return
  try {
    for (const k of store.keys()) {
      if (k.startsWith(PREFIX)) store.removeItem(k)
    }
  } catch {
    // Nothing useful to do.
  }
}

/**
 * How to describe the age of what is on screen.
 *
 * Deliberately blunt. Vagueness here would be the app pretending to know
 * something it does not.
 */
export function freshnessLabel(savedAt: string, now: number = Date.now()): string {
  const ms = now - new Date(savedAt).getTime()
  if (!Number.isFinite(ms) || ms < 0) return 'Saved earlier'

  const mins = Math.floor(ms / 60_000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `As of ${mins} min ago`

  const hours = Math.floor(mins / 60)
  if (hours < 24) return `As of ${hours} hour${hours === 1 ? '' : 's'} ago`
  return 'Saved over a day ago'
}

/** True when the browser believes it is offline. */
export function isOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false
}
