import test from 'node:test'
import assert from 'node:assert'
import {
  nameOf, placeOf, memberSinceLabel, roleLabel, hasScore, messageOf
} from './publicProfile'

test('nameOf prefers the display name', () => {
  assert.strictEqual(nameOf({ displayName: 'Thandi M', username: 'thandi' }), 'Thandi M')
})

test('nameOf falls back to the handle, marked as one', () => {
  assert.strictEqual(nameOf({ displayName: null, username: 'thandi' }), '@thandi')
  assert.strictEqual(nameOf({ displayName: '   ', username: 'thandi' }), '@thandi')
})

test('nameOf never renders an empty name or a raw id', () => {
  assert.strictEqual(nameOf({ displayName: null, username: null }), 'A resident')
  assert.strictEqual(nameOf({ displayName: '', username: '  ' }), 'A resident')
})

test('placeOf joins what exists and stays empty when nothing does', () => {
  assert.strictEqual(placeOf({ suburb: 'Sunnyside', city: 'Pretoria' }), 'Sunnyside, Pretoria')
  assert.strictEqual(placeOf({ suburb: null, city: 'Pretoria' }), 'Pretoria')
  assert.strictEqual(placeOf({ suburb: null, city: null }), '')
  assert.strictEqual(placeOf({ suburb: '  ', city: '' }), '')
})

test('memberSinceLabel is month-level, not to the day', () => {
  const label = memberSinceLabel('2026-03-14T09:00:00Z')
  assert.ok(label.startsWith('Neighbour since '), label)
  assert.ok(!label.includes('14'), 'the exact day must not appear: ' + label)
})

test('memberSinceLabel says nothing rather than "Invalid Date"', () => {
  assert.strictEqual(memberSinceLabel(null), '')
  assert.strictEqual(memberSinceLabel('not a date'), '')
})

test('roleLabel describes what someone does, and is silent on an unknown role', () => {
  assert.strictEqual(roleLabel('landlord'), 'Lists rooms')
  assert.strictEqual(roleLabel(null), '')
  assert.strictEqual(roleLabel('something_new'), '')
})

// The bug this guards is specific: a missing score rendered as 0 tells every
// neighbour that this person scored zero. Absent and zero are different
// claims, and only one of them is true.
test('hasScore separates a real zero from a missing score', () => {
  assert.strictEqual(hasScore(0), true)
  assert.strictEqual(hasScore(72), true)
  assert.strictEqual(hasScore(null), false)
  assert.strictEqual(hasScore(undefined), false)
  assert.strictEqual(hasScore(Number.NaN), false)
})

// This is the bug that shipped to the screenshot: Supabase errors are
// PostgrestError objects, not Error instances, so String(err) rendered the
// literal text "[object Object]" where the reason should have been.
test('messageOf reads a Supabase-shaped error, not [object Object]', () => {
  assert.strictEqual(
    messageOf({ message: 'not signed in', code: 'P0001', details: null }),
    'not signed in'
  )
  assert.ok(!messageOf({ message: 'boom' }).includes('[object'))
})

test('messageOf still handles the ordinary shapes', () => {
  assert.strictEqual(messageOf(new Error('plain')), 'plain')
  assert.strictEqual(messageOf('a string'), 'a string')
})

test('messageOf never returns an empty or object-stringified message', () => {
  assert.strictEqual(messageOf({}), 'Something went wrong.')
  assert.strictEqual(messageOf(null), 'Something went wrong.')
  assert.strictEqual(messageOf({ message: '' }), 'Something went wrong.')
})
