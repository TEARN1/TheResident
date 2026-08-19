import test from 'node:test'
import assert from 'node:assert'
import { readEnum } from './safeStorage'
import type { KeyValueStore } from './safeStorage'

// The point of this module is that nothing it does can throw. These tests are
// mostly about the ways storage fails on real devices — blocked site data, a
// full disk, and values written by an older version of the app.

/** A store that throws on every operation, like storage blocked by policy. */
const hostileStore: KeyValueStore = {
  getItem() { throw new Error('SecurityError: access is denied') },
  setItem() { throw new Error('QuotaExceededError') },
  removeItem() { throw new Error('SecurityError') },
  keys() { throw new Error('SecurityError') },
}

const memoryStore = (initial: Record<string, string> = {}): KeyValueStore => {
  const data = new Map(Object.entries(initial))
  return {
    getItem: k => data.get(k) ?? null,
    setItem: (k, v) => { data.set(k, v) },
    removeItem: k => { data.delete(k) },
    keys: () => [...data.keys()],
  }
}

test('readEnum returns the stored value when it is one we know', () => {
  const store = memoryStore({ theme: 'light' })
  assert.strictEqual(readEnum(store, 'theme', ['light', 'night'] as const, 'night'), 'light')
})

test('readEnum falls back when storage holds something unexpected', () => {
  // Storage is user-editable and survives deploys: a value written by an older
  // version, or by hand, can be anything at all.
  for (const junk of ['solarized', '', 'null', '{}', 'LIGHT']) {
    const store = memoryStore({ theme: junk })
    assert.strictEqual(
      readEnum(store, 'theme', ['light', 'night'] as const, 'night'), 'night',
      `"${junk}" should not have been accepted`)
  }
})

test('readEnum falls back when the key is absent', () => {
  assert.strictEqual(readEnum(memoryStore(), 'theme', ['light', 'night'] as const, 'night'), 'night')
})

test('readEnum survives a store that throws on every read', () => {
  // Blocked site data makes the property access itself throw. A theme
  // preference is never worth a white screen.
  assert.doesNotThrow(() => readEnum(hostileStore, 'theme', ['light'] as const, 'light'))
})

test('a hostile store degrades to the fallback rather than propagating', () => {
  const safeRead = () => {
    try {
      return readEnum(hostileStore, 'theme', ['light', 'night'] as const, 'night')
    } catch {
      return 'THREW'
    }
  }
  assert.strictEqual(safeRead(), 'night')
})
