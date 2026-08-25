import test from 'node:test'
import assert from 'node:assert'
import { toneFamilyFor } from './notificationSounds'
import { PANIC_TYPE } from './logic'

test('the panic type is always urgent, matching shouldDeliver()\'s mute-bypass exemption', () => {
  assert.strictEqual(toneFamilyFor(PANIC_TYPE), 'urgent')
})

test('safety-adjacent response types map to the safety family', () => {
  for (const type of ['res_alert_response', 'res_status', 'res_lostfound', 'res_care_missed']) {
    assert.strictEqual(toneFamilyFor(type), 'safety', type)
  }
})

test('money/housing types map to the money family', () => {
  for (const type of ['res_room_request', 'res_request_approved', 'res_token_claim', 'res_dispatch', 'res_groupbuy_pledge']) {
    assert.strictEqual(toneFamilyFor(type), 'money', type)
  }
})

test('social/relationship types map to the social family', () => {
  for (const type of ['res_lift_join', 'res_market_reply', 'res_trust_request', 'res_gossip_comment']) {
    assert.strictEqual(toneFamilyFor(type), 'social', type)
  }
})

test('an unmapped or missing type plays nothing rather than throwing', () => {
  assert.strictEqual(toneFamilyFor('some_future_type_nobody_added_yet'), null)
  assert.strictEqual(toneFamilyFor(undefined), null)
})
