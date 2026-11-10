import crypto from 'crypto'
import { test } from 'node:test'
import assert from 'node:assert'
import {
  generatePayFastSignature,
  validatePayFastSignature,
  verifyPayFastItnPayload,
  getPayFastConfig,
  getPayFastProcessUrl,
  getPayFastValidateUrl,
  buildPayFastPaymentRequest,
  PAYFAST_AWS_IPS,
  PAYFAST_DOMAINS,
  isPayFastWhitelistedIp,
  normalizeIp
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

test('PayFast notice signature is accepted with empty fields kept or left out, never without the passphrase', () => {
  const notice: Record<string, string> = {
    m_payment_id: 'RES-1',
    payment_status: 'COMPLETE',
    item_name: "Priority review (O'Brien)",
    custom_str3: '',
    amount_gross: '99.00',
    merchant_id: '23456789'
  }
  const enc = (v: string) => encodeURIComponent(v).replace(/%20/g, '+')
  const php = (v: string) => enc(v).replace(/[!'()*~]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase())
  const sign = (keepEmpty: boolean, e: (v: string) => string, pass: string) =>
    crypto
      .createHash('md5')
      .update([...Object.entries(notice).filter(([, v]) => keepEmpty || v).map(([k, v]) => `${k}=${e(v)}`), `passphrase=${e(pass)}`].join('&'))
      .digest('hex')
  for (const keep of [true, false]) {
    for (const e of [enc, php]) assert.ok(validatePayFastSignature(notice, sign(keep, e, 'secret'), 'secret'))
  }
  assert.ok(!validatePayFastSignature(notice, sign(true, enc, 'guessed'), 'secret'))
  assert.ok(!validatePayFastSignature({ ...notice, amount_gross: '1.00' }, sign(true, enc, 'secret'), 'secret'))
})

test('PayFast environment config separates sandbox defaults from live credentials', () => {
  // Test mode only when asked for: a live server that forgot the setting
  // refuses payments instead of accepting PayFast's test money.
  assert.throws(() => getPayFastConfig({}), /requires real PAYFAST_MERCHANT_ID/)
  assert.throws(() => getPayFastConfig({ PAYFAST_SANDBOX: 'yes' }), /requires real PAYFAST_MERCHANT_ID/)
  const testConfig = getPayFastConfig({ PAYFAST_SANDBOX: 'true' })
  assert.strictEqual(testConfig.sandbox, true)
  assert.strictEqual(testConfig.merchantId, '10000100')
  assert.strictEqual(testConfig.passphrase, 'jt7NOE43FZPn')

  // Live mode without real credentials must fail closed
  assert.throws(
    () => getPayFastConfig({ PAYFAST_SANDBOX: 'false' }),
    /requires real PAYFAST_MERCHANT_ID and PAYFAST_MERCHANT_KEY/
  )
  assert.throws(
    () =>
      getPayFastConfig({
        PAYFAST_SANDBOX: 'false',
        PAYFAST_MERCHANT_ID: '10000100',
        PAYFAST_MERCHANT_KEY: 'live_key'
      }),
    /requires real PAYFAST_MERCHANT_ID/
  )
  assert.throws(
    () =>
      getPayFastConfig({
        PAYFAST_SANDBOX: 'false',
        PAYFAST_MERCHANT_ID: '23456789',
        PAYFAST_MERCHANT_KEY: 'live_key_abc',
        PAYFAST_PASSPHRASE: 'jt7NOE43FZPn'
      }),
    /needs its own PAYFAST_PASSPHRASE/
  )

  // Live mode needs a passphrase of its own: without one anyone could sign a notice
  assert.throws(
    () =>
      getPayFastConfig({
        PAYFAST_SANDBOX: 'false',
        PAYFAST_MERCHANT_ID: '23456789',
        PAYFAST_MERCHANT_KEY: 'live_key_abc'
      }),
    /PAYFAST_PASSPHRASE/
  )

  // Live mode with real passphrase
  const liveWithPass = getPayFastConfig({
    PAYFAST_SANDBOX: 'false',
    PAYFAST_MERCHANT_ID: '23456789',
    PAYFAST_MERCHANT_KEY: 'live_key_abc',
    PAYFAST_PASSPHRASE: 'real_secret_passphrase'
  })
  assert.strictEqual(liveWithPass.sandbox, false)
  assert.strictEqual(liveWithPass.passphrase, 'real_secret_passphrase')

  assert.strictEqual(getPayFastProcessUrl(true), 'https://sandbox.payfast.co.za/eng/process')
  assert.strictEqual(getPayFastProcessUrl(false), 'https://www.payfast.co.za/eng/process')
  assert.strictEqual(getPayFastValidateUrl(true), 'https://sandbox.payfast.co.za/eng/query/validate')
  assert.strictEqual(getPayFastValidateUrl(false), 'https://www.payfast.co.za/eng/query/validate')
})

test('verifyPayFastItnPayload enforces merchant_id, signature, self-serve item, and exact ZAR amount', () => {
  const config = getPayFastConfig({
    PAYFAST_SANDBOX: 'false',
    PAYFAST_MERCHANT_ID: '23456789',
    PAYFAST_MERCHANT_KEY: 'live_key_abc',
    PAYFAST_PASSPHRASE: 'live_passphrase_secret'
  })

  const validBase: Record<string, string> = {
    m_payment_id: 'res_premium_11111111_1700000000',
    pf_payment_id: '99887766',
    payment_status: 'COMPLETE',
    item_name: 'Premium',
    amount_gross: '100.00',
    custom_str1: '11111111-2222-3333-4444-555555555555',
    custom_str2: 'premium',
    merchant_id: '23456789'
  }
  const validPayload = {
    ...validBase,
    signature: generatePayFastSignature(validBase, config.passphrase)
  }

  const ok = verifyPayFastItnPayload(validPayload, config)
  assert.strictEqual(ok.valid, true)
  if (ok.valid) {
    assert.strictEqual(ok.item, 'premium')
    assert.strictEqual(ok.amountGross, 100)
    assert.strictEqual(ok.userId, '11111111-2222-3333-4444-555555555555')
  }

  // Underpayment (e.g. R5.00 signed for a R100.00 tier) must be rejected
  const underpaidBase = { ...validBase, amount_gross: '5.00' }
  const underpaid = verifyPayFastItnPayload(
    { ...underpaidBase, signature: generatePayFastSignature(underpaidBase, config.passphrase) },
    config
  )
  assert.strictEqual(underpaid.valid, false)
  if (!underpaid.valid) {
    assert.match(underpaid.reason, /Amount mismatch/)
  }

  // Wrong merchant ID must be rejected
  const wrongMerchantBase = { ...validBase, merchant_id: '10000100' }
  const wrongMerchant = verifyPayFastItnPayload(
    { ...wrongMerchantBase, signature: generatePayFastSignature(wrongMerchantBase, config.passphrase) },
    config
  )
  assert.strictEqual(wrongMerchant.valid, false)
  if (!wrongMerchant.valid) {
    assert.match(wrongMerchant.reason, /Merchant ID mismatch/)
  }

  // Non-self-serve B2B tier must be rejected
  const b2bBase = { ...validBase, custom_str2: 'political_party_hq', amount_gross: '2499.00' }
  const b2b = verifyPayFastItnPayload(
    { ...b2bBase, signature: generatePayFastSignature(b2bBase, config.passphrase) },
    config
  )
  assert.strictEqual(b2b.valid, false)
})

test('buildPayFastPaymentRequest constructs valid payload and sets recurring fields for monthly subscriptions', () => {
  // Builds a request in test mode, which must now be asked for explicitly.
  process.env.PAYFAST_SANDBOX = 'true'
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
  // Builds a request in test mode, which must now be asked for explicitly.
  process.env.PAYFAST_SANDBOX = 'true'
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

test('PayFast AWS migration IP whitelisting validates all 21 IPs', () => {
  assert.strictEqual(PAYFAST_AWS_IPS.length, 21)
  for (let i = 232; i <= 252; i++) {
    const ip = `3.163.${i}.237`
    assert.ok((PAYFAST_AWS_IPS as readonly string[]).includes(ip))
    assert.ok(isPayFastWhitelistedIp(ip))
  }
  assert.ok(isPayFastWhitelistedIp('::ffff:3.163.236.237'))
  assert.strictEqual(normalizeIp('3.163.238.237:443'), '3.163.238.237')
  assert.ok(!isPayFastWhitelistedIp('192.168.1.1'))
  assert.ok(PAYFAST_DOMAINS.includes('payment.payfast.io'))
})
