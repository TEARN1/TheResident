import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  directionsUrlForAddress, directionsUrlForCoords, wazeUrlForAddress
} from './navigation'

test('an address with spaces and punctuation survives the round trip', () => {
  // South African addresses routinely carry commas, ampersands and slashes;
  // an unencoded one silently truncates the destination.
  const url = directionsUrlForAddress('12 Church St & Main Rd, Sunnyside, Pretoria')
  const parsed = new URL(url)
  assert.equal(
    parsed.searchParams.get('destination'),
    '12 Church St & Main Rd, Sunnyside, Pretoria'
  )
  assert.equal(parsed.searchParams.get('api'), '1')
})

test('origin is included only when there is one', () => {
  assert.equal(new URL(directionsUrlForAddress('X')).searchParams.has('origin'), false)
  assert.equal(
    new URL(directionsUrlForAddress('X', 'Y')).searchParams.get('origin'),
    'Y'
  )
})

test('coordinates are formatted the way Google expects', () => {
  const parsed = new URL(directionsUrlForCoords(-25.7479, 28.2293))
  assert.equal(parsed.searchParams.get('destination'), '-25.7479,28.2293')
})

test('the Waze link encodes the query and asks to navigate', () => {
  const url = wazeUrlForAddress('12 Church St, Sunnyside')
  assert.match(url, /navigate=yes/)
  const q = new URL(url).searchParams.get('q')
  assert.equal(q, '12 Church St, Sunnyside')
})

test('every link is https and points at the expected host', () => {
  // These open a native app by deep link; a wrong host is a dead tap.
  for (const url of [
    directionsUrlForAddress('X'),
    directionsUrlForCoords(1, 2),
    wazeUrlForAddress('X')
  ]) {
    const parsed = new URL(url)
    assert.equal(parsed.protocol, 'https:')
    assert.ok(['www.google.com', 'waze.com'].includes(parsed.host), parsed.host)
  }
})
