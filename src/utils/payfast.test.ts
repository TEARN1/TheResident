import { test } from 'node:test'
import assert from 'node:assert'
import {
  generatePayFastSignature,
  validatePayFastSignature,
  getPayFastConfig,
  getPayFastProcessUrl,
  getPayFastValidateUrl,
  buildPayFastPaymentRequest
} from './payfast'

test('PayFast signature matches MD5 specification', () => {
  const sample = {
    merchant_id: '10000100',
    merchant_key: '46f0cd694581a',
    return_url: 'https://www.example.com/return',
    cancel_url: 'https://www.example.com/cancel',
    notify_url: 'https://www.example.com/notify',
    name_first: 'First',
    name_last: 'Last',
    email_address: 'test@example.com',
    m_payment_id: '01',
    amount: '100.00',
    item_name: 'Test Item'
  }
  const sig = generatePayFastSignature(sample, 'jt7NOE43FZPn')
  assert.strictEqual(sig, 'c64f905806262c31b10621d722dd65c4')
  assert.ok(validatePayFastSignature(sample, sig, 'jt7NOE43FZPn'))
})

test('PayFast signature validation rejects invalid signature or tampered data', () => {
  const sample = {
    merchant_id: '10000100',
    amount: '100.00'
  }
  const sig = generatePayFastSignature(sample, 'test_pass')
  assert.ok(validatePayFastSignature(sample, sig, 'test_pass'))
  assert.ok(!validatePayFastSignature(sample, 'invalid_sig', 'test_pass'))
  assert.ok(!validatePayFastSignature({ ...sample, amount: '200.00' }, sig, 'test_pass'))
})

test('PayFast environment config correctly sets URLs', () => {
  const config = getPayFastConfig()
  assert.ok(config.merchantId)
  assert.strictEqual(getPayFastProcessUrl(true), 'https://sandbox.payfast.co.za/eng/process')
  assert.strictEqual(getPayFastProcessUrl(false), 'https://www.payfast.co.za/eng/process')
  assert.strictEqual(getPayFastValidateUrl(true), 'https://sandbox.payfast.co.za/eng/query/validate')
  assert.strictEqual(getPayFastValidateUrl(false), 'https://www.payfast.co.za/eng/query/validate')
})

test('buildPayFastPaymentRequest constructs valid payload and sets recurring fields for monthly subscriptions', () => {
  const res = buildPayFastPaymentRequest({
    item: 'priority',
    userId: '11111111-2222-3333-4444-555555555555',
    userEmail: 'provider@example.com',
    userName: 'John Builder'
  })

  assert.strictEqual(res.fields.amount, '50.00')
  assert.strictEqual(res.fields.subscription_type, '1')
  assert.strictEqual(res.fields.frequency, '3')
  assert.strictEqual(res.fields.cycles, '0')
  assert.strictEqual(res.fields.recurring_amount, '50.00')
  assert.strictEqual(res.fields.custom_str1, '11111111-2222-3333-4444-555555555555')
  assert.strictEqual(res.fields.custom_str2, 'priority')
  assert.ok(res.fields.signature.length === 32)
  assert.ok(res.redirectUrl.includes('https://sandbox.payfast.co.za/eng/process?'))
})

test('buildPayFastPaymentRequest handles one-time boosts without recurring fields', () => {
  const res = buildPayFastPaymentRequest({
    item: 'room_boost',
    targetId: 'room-123',
    userId: '11111111-2222-3333-4444-555555555555',
    userEmail: 'landlord@example.com',
    userName: 'Thabo M'
  })

  assert.strictEqual(res.fields.amount, '30.00')
  assert.strictEqual(res.fields.custom_str2, 'room_boost')
  assert.strictEqual(res.fields.custom_str3, 'room-123')
  assert.strictEqual(res.fields.subscription_type, undefined)
  assert.strictEqual(res.fields.frequency, undefined)
  assert.ok(res.fields.signature.length === 32)
})
