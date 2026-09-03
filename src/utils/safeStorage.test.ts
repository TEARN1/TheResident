import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import {
  isStorageAvailable, safeGet, safeSet, safeRemove, safeGetJSON, safeSetJSON
} from './safeStorage'

// A minimal localStorage, plus the ability to make it behave like the browsers
// this wrapper exists for: Safari private mode (writes throw), storage
// disabled by policy, and a full quota.
function installStorage(behaviour: 'normal' | 'throw-on-write' | 'throw-on-everything' = 'normal') {
  const data = new Map<string, string>()
  const boom = () => { throw new DOMException('QuotaExceededError') }
  const store = {
    getItem: (k: string) => behaviour === 'throw-on-everything' ? boom() : (data.get(k) ?? null),
    setItem: (k: string, v: string) => {
      if (behaviour !== 'normal') boom()
      data.set(k, v)
    },
    removeItem: (k: string) => {
      if (behaviour === 'throw-on-everything') boom()
      data.delete(k)
    }
  }
  ;(globalThis as unknown as { window: unknown }).window = { localStorage: store }
  return data
}

afterEach(() => { delete (globalThis as unknown as { window?: unknown }).window })

test('during SSR every call is a no-op instead of a crash', () => {
  // There is no `window` at build time. A bare localStorage call here takes
  // down the whole render.
  delete (globalThis as unknown as { window?: unknown }).window
  assert.equal(isStorageAvailable(), false)
  assert.equal(safeGet('k'), null)
  assert.equal(safeSet('k', 'v'), false)
  assert.equal(safeRemove('k'), false)
  assert.equal(safeGetJSON('k', { fallback: true }).fallback, true)
})

test('a normal browser round-trips values', () => {
  installStorage()
  assert.equal(isStorageAvailable(), true)
  assert.equal(safeSet('k', 'v'), true)
  assert.equal(safeGet('k'), 'v')
  assert.equal(safeRemove('k'), true)
  assert.equal(safeGet('k'), null)
})

test('Safari private mode degrades instead of throwing', () => {
  // Writes throw, reads work. The app must keep running for the users least
  // able to work around a broken page.
  installStorage('throw-on-write')
  assert.equal(isStorageAvailable(), false)
  assert.equal(safeSet('k', 'v'), false, 'a failed write must report false, not pretend success')
  assert.doesNotThrow(() => safeSetJSON('k', { a: 1 }))
})

test('storage disabled entirely still degrades', () => {
  installStorage('throw-on-everything')
  assert.equal(safeGet('k'), null)
  assert.equal(safeSet('k', 'v'), false)
  assert.equal(safeRemove('k'), false)
})

test('a half-written value is dropped rather than crashing every boot', () => {
  // A tab killed mid-write leaves malformed JSON. Without this, JSON.parse
  // throws on every subsequent load and the app never starts.
  const data = installStorage()
  data.set('prefs', '{"muted":[')
  assert.deepEqual(safeGetJSON('prefs', { muted: [] }), { muted: [] })
  assert.equal(data.has('prefs'), false, 'the corrupt value should be cleared, not re-read forever')
})

test('a type guard rejects data that parsed but is the wrong shape', () => {
  const data = installStorage()
  data.set('prefs', '"a string, not the object we saved"')
  const out = safeGetJSON('prefs', { muted: [] }, p => typeof p === 'object' && p !== null)
  assert.deepEqual(out, { muted: [] })
})

test('safeSetJSON reports failure when the value cannot be serialised', () => {
  installStorage()
  const circular: Record<string, unknown> = {}
  circular.self = circular
  assert.equal(safeSetJSON('k', circular), false)
})
