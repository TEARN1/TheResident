import test from 'node:test'
import assert from 'node:assert'
import { describeSubject, severityOf } from './contentReports'

test('subject types read as something a person would say', () => {
  assert.strictEqual(describeSubject('gossip_post'), 'Feed post')
  assert.strictEqual(describeSubject('market_item'), 'Marketplace item')
  // An unknown type falls back to itself rather than to "undefined": a
  // reviewer seeing a raw key still knows what they are looking at.
  assert.strictEqual(describeSubject('something_new'), 'something_new')
})

test('several independent complaints outrank one', () => {
  assert.strictEqual(severityOf({ reportCount: 1, reasons: ['spam'] }), 'low')
  assert.strictEqual(severityOf({ reportCount: 2, reasons: ['spam'] }), 'medium')
  assert.strictEqual(severityOf({ reportCount: 3, reasons: ['spam'] }), 'high')
})

test('a safety complaint is high on its own', () => {
  // Waiting for a second reporter before looking at "unsafe" or "scam" is the
  // wrong trade — those are the two where being slow costs someone something.
  assert.strictEqual(severityOf({ reportCount: 1, reasons: ['unsafe'] }), 'high')
  assert.strictEqual(severityOf({ reportCount: 1, reasons: ['scam'] }), 'high')
})
