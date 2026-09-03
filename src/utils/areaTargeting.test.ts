import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  clampRadius, describeRadius, describeAudience, canSend, describeSendResult,
  MIN_RADIUS_M, MAX_RADIUS_M, type AudiencePreview
} from './areaTargeting'

const preview = (over: Partial<AudiencePreview> = {}): AudiencePreview => ({
  pinnedCount: 0, textMatchedCount: 0, totalCount: 0, blockReason: null, ...over
})

test('clampRadius mirrors the clamp inside res_radius_target', () => {
  assert.equal(clampRadius(3000), 3000)
  assert.equal(clampRadius(1), MIN_RADIUS_M)
  assert.equal(clampRadius(999999), MAX_RADIUS_M)
  assert.equal(clampRadius(NaN), MIN_RADIUS_M)
})

test('describeRadius reads the way a person would say it', () => {
  assert.equal(describeRadius(500), '500m')
  assert.equal(describeRadius(3000), '3km')
  assert.equal(describeRadius(2500), '2.5km')
})

test('describeAudience never blends confident and fuzzy matches into one number', () => {
  // Pins only: one clean number.
  assert.match(describeAudience(preview({ pinnedCount: 4200, totalCount: 4200 })), /4,200 residents/)

  // Mixed: both are stated, and the fuzzy half is labelled as such.
  const mixed = describeAudience(preview({ pinnedCount: 1240, textMatchedCount: 380, totalCount: 1620 }))
  assert.match(mixed, /1,240 residents with a home area/)
  assert.match(mixed, /380 more matched on the suburb/)
  // The overstated single total must not appear.
  assert.ok(!mixed.includes('1,620'))
})

test('describeAudience is honest when there is nobody, or no permission', () => {
  assert.match(describeAudience(null), /Choose an area/)
  assert.match(describeAudience(preview()), /nobody here has set a home area/)
  assert.match(describeAudience(preview({ blockReason: 'outside_jurisdiction' })), /cannot be sent to/)
})

test('canSend refuses until a real, permitted audience has been seen', () => {
  assert.ok(!canSend(null))
  assert.ok(!canSend(preview()))
  assert.ok(!canSend(preview({ totalCount: 10, blockReason: 'not_verified' })))
  assert.ok(canSend(preview({ pinnedCount: 10, totalCount: 10 })))
})

const sent = (over: Partial<Parameters<typeof describeSendResult>[0]> = {}) => ({
  id: 'b1', targetLabel: 'Ward 12', priority: 'urgent',
  recipientCount: 0, pinnedCount: 0, textMatchedCount: 0,
  sentAt: '2026-09-02T10:00:00Z', ...over
})

test('describeSendResult reports the same two populations the preview promised', () => {
  // The number quoted after the fact is the number that lands on the public
  // record, so it must not be inflated relative to what was previewed.
  const mixed = describeSendResult(sent({ recipientCount: 1620, pinnedCount: 1240, textMatchedCount: 380 }))
  assert.match(mixed, /1,620 residents/)
  assert.match(mixed, /1,240 with a home area/)
  assert.match(mixed, /380 matched on their suburb/)

  const clean = describeSendResult(sent({ recipientCount: 900, pinnedCount: 900 }))
  assert.match(clean, /Sent to 900 residents in Ward 12\./)
  assert.doesNotMatch(clean, /suburb/)
})

test('describeSendResult does not claim a delivery that reached nobody', () => {
  assert.match(describeSendResult(sent()), /Nothing to deliver/)
})

test('describeSendResult says "resident" for exactly one person', () => {
  assert.match(describeSendResult(sent({ recipientCount: 1, pinnedCount: 1 })), /1 resident in/)
})
