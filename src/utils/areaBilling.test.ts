import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  describeLicence, canSendAtPriority, shouldOfferCheckout, planOffer,
  type AreaLicence
} from './areaBilling'

const lic = (over: Partial<AreaLicence> = {}): AreaLicence => ({
  state: 'probation', plan: 'area_ward', daysRemaining: 120, allowsRoutine: true, ...over
})

test('an emergency is never gated by billing', () => {
  // The single most important behaviour in Phase F. If this regresses, the
  // app is charging for the ability to warn people their street is on fire.
  const lapsed = lic({ state: 'lapsed', allowsRoutine: false, daysRemaining: null })
  assert.equal(canSendAtPriority(lapsed, 'critical'), true)
  assert.equal(canSendAtPriority(null, 'critical'), true)

  // Everything below critical does need a licence.
  assert.equal(canSendAtPriority(lapsed, 'urgent'), false)
  assert.equal(canSendAtPriority(lapsed, 'important'), false)
  assert.equal(canSendAtPriority(lapsed, 'normal'), false)
})

test('a live licence allows routine notices at every priority', () => {
  for (const state of ['probation', 'active', 'exempt'] as const) {
    const l = lic({ state, allowsRoutine: true })
    assert.equal(canSendAtPriority(l, 'urgent'), true, state)
    assert.equal(canSendAtPriority(l, 'normal'), true, state)
  }
})

test('a lapsed office is told emergencies still work', () => {
  // Otherwise an official concludes they have no way to reach anyone at all,
  // which is both false and dangerous.
  const text = describeLicence(lic({ state: 'lapsed', allowsRoutine: false, daysRemaining: null }))
  assert.match(text, /Emergencies still send/)
  assert.match(text, /never charged/)
})

test('a trial warns before it ends rather than going quiet', () => {
  const soon = describeLicence(lic({ daysRemaining: 12 }))
  assert.match(soon, /12 days/)
  assert.match(soon, /still send emergencies/)

  // Far from expiry it stays out of the way.
  const later = describeLicence(lic({ daysRemaining: 120 }))
  assert.match(later, /another 120 days/)
  assert.doesNotMatch(later, /Free period ends/)
})

test('day counts read naturally at one', () => {
  assert.match(describeLicence(lic({ daysRemaining: 1 })), /ends in 1 day\./)
  assert.match(
    describeLicence(lic({ state: 'active', daysRemaining: 1 })),
    /renews in 1 day\./
  )
})

test('an exempt office is never nagged to pay', () => {
  const exempt = lic({ state: 'exempt' })
  assert.equal(shouldOfferCheckout(exempt), false)
  assert.match(describeLicence(exempt), /not billed/)
})

test('checkout is offered when it is actually useful', () => {
  assert.equal(shouldOfferCheckout(lic({ state: 'lapsed', allowsRoutine: false })), true)
  assert.equal(shouldOfferCheckout(lic({ state: 'none', allowsRoutine: false })), true)
  assert.equal(shouldOfferCheckout(lic({ daysRemaining: 20 })), true)
  // Not five months early — that is just nagging.
  assert.equal(shouldOfferCheckout(lic({ daysRemaining: 150 })), false)
  assert.equal(shouldOfferCheckout(lic({ state: 'active', daysRemaining: 20 })), false)
})

test('planOffer separates what can be clicked from what must be negotiated', () => {
  const ward = planOffer('area_ward')
  assert.ok(ward)
  assert.equal(ward.selfServe, true)
  assert.match(ward.price, /R\s?199/)

  // A metro deal goes through procurement; showing a Pay button would be a lie.
  const metro = planOffer('area_municipal')
  assert.ok(metro)
  assert.equal(metro.selfServe, false)

  assert.equal(planOffer(null), null)
  assert.equal(planOffer('not_a_plan'), null)
})
