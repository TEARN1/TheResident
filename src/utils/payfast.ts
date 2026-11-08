import crypto from 'crypto'
import { PRICING } from './pricing'
import { siteUrl } from '../app/site-url'

export interface PayFastConfig {
  merchantId: string
  merchantKey: string
  passphrase?: string
  sandbox: boolean
}

export type SelfServePaymentItem =
  | 'priority'
  | 'premium'
  | 'plus'
  | 'verification_speedup'
  | 'market_boost'
  | 'room_boost'
  | 'notice_boost'
  | 'notice_extend_visibility'
  | 'broadcast_blast_boost'

export const PAYFAST_SANDBOX_MERCHANT_ID = '10000100'
export const PAYFAST_SANDBOX_MERCHANT_KEY = '46f0cd694581a'
export const PAYFAST_SANDBOX_PASSPHRASE = 'jt7NOE43FZPn'

export const PAYFAST_FIELD_ORDER = [
  'merchant_id',
  'merchant_key',
  'return_url',
  'cancel_url',
  'notify_url',
  'name_first',
  'name_last',
  'email_address',
  'cell_number',
  'm_payment_id',
  'amount',
  'item_name',
  'item_description',
  'custom_int1',
  'custom_int2',
  'custom_int3',
  'custom_int4',
  'custom_int5',
  'custom_str1',
  'custom_str2',
  'custom_str3',
  'custom_str4',
  'custom_str5',
  'email_confirmation',
  'confirmation_address',
  'payment_method',
  'subscription_type',
  'billing_date',
  'recurring_amount',
  'frequency',
  'cycles'
] as const

/**
 * Reads PayFast configuration from environment variables.
 * Live mode activates ONLY when PAYFAST_SANDBOX is explicitly set to "false",
 * and strictly rejects missing or sandbox test credentials so sandbox defaults
 * can never leak into real customer transactions.
 */
export function getPayFastConfig(
  env: Record<string, string | undefined> = process.env
): PayFastConfig {
  const sandboxEnv = env.PAYFAST_SANDBOX?.trim().toLowerCase()
  const rawMerchantId = env.PAYFAST_MERCHANT_ID?.trim()
  const rawMerchantKey = env.PAYFAST_MERCHANT_KEY?.trim()
  const rawPassphrase = env.PAYFAST_PASSPHRASE?.trim()

  const isSandbox = sandboxEnv !== 'false'

  if (!isSandbox) {
    if (
      !rawMerchantId ||
      rawMerchantId === PAYFAST_SANDBOX_MERCHANT_ID ||
      !rawMerchantKey ||
      rawMerchantKey === PAYFAST_SANDBOX_MERCHANT_KEY
    ) {
      throw new Error(
        'PayFast live mode (PAYFAST_SANDBOX=false) requires real PAYFAST_MERCHANT_ID and PAYFAST_MERCHANT_KEY environment variables.'
      )
    }
    if (rawPassphrase === PAYFAST_SANDBOX_PASSPHRASE) {
      throw new Error(
        'PayFast live mode (PAYFAST_SANDBOX=false) cannot use the public sandbox passphrase.'
      )
    }

    return {
      merchantId: rawMerchantId,
      merchantKey: rawMerchantKey,
      passphrase: rawPassphrase || undefined,
      sandbox: false
    }
  }

  return {
    merchantId: rawMerchantId || PAYFAST_SANDBOX_MERCHANT_ID,
    merchantKey: rawMerchantKey || PAYFAST_SANDBOX_MERCHANT_KEY,
    passphrase:
      env.PAYFAST_PASSPHRASE !== undefined
        ? rawPassphrase || undefined
        : PAYFAST_SANDBOX_PASSPHRASE,
    sandbox: true
  }
}

export function getPayFastProcessUrl(sandbox: boolean): string {
  return sandbox
    ? 'https://sandbox.payfast.co.za/eng/process'
    : 'https://www.payfast.co.za/eng/process'
}

export function getPayFastValidateUrl(sandbox: boolean): string {
  return sandbox
    ? 'https://sandbox.payfast.co.za/eng/query/validate'
    : 'https://www.payfast.co.za/eng/query/validate'
}

/**
 * Generates MD5 signature from PayFast payload per official PayFast specification.
 * Concatenates all non-empty key=value pairs URL-encoded with spaces as '+',
 * appends passphrase if configured, and calculates MD5 digest.
 */
export function generatePayFastSignature(
  data: Record<string, string | undefined>,
  passphrase?: string
): string {
  let pfOutput = ''
  for (const key of Object.keys(data)) {
    const val = data[key]
    if (key !== 'signature' && val !== undefined && val !== '') {
      pfOutput += `${key}=${encodeURIComponent(val.trim()).replace(/%20/g, '+')}&`
    }
  }

  let getString = pfOutput.slice(0, -1)
  if (passphrase && passphrase.trim() !== '') {
    getString += `&passphrase=${encodeURIComponent(passphrase.trim()).replace(/%20/g, '+')}`
  }

  return crypto.createHash('md5').update(getString).digest('hex')
}

/**
 * Validates an incoming ITN signature against computed signature in constant time.
 */
export function validatePayFastSignature(
  data: Record<string, string | undefined>,
  receivedSignature: string,
  passphrase?: string
): boolean {
  if (!receivedSignature) return false
  const computed = generatePayFastSignature(data, passphrase).toLowerCase()
  const candidate = receivedSignature.trim().toLowerCase()
  if (computed.length !== candidate.length) return false
  return crypto.timingSafeEqual(
    Buffer.from(computed, 'utf8'),
    Buffer.from(candidate, 'utf8')
  )
}

export type VerifiedPayFastItn =
  | {
      valid: true
      paymentStatus: string
      userId: string
      item: SelfServePaymentItem
      targetId?: string
      amountGross: number
      paymentId: string
      pfPaymentId?: string
    }
  | {
      valid: false
      reason: string
    }

/**
 * Performs PayFast's payload-level security checks on an incoming ITN:
 * 1. Merchant ID matches configured merchant account.
 * 2. MD5 signature matches received parameters + passphrase.
 * 3. Item is a valid self-serve item defined in PRICING.
 * 4. Gross ZAR amount matches expected item price (to the cent) on COMPLETE payments.
 */
export function verifyPayFastItnPayload(
  params: Record<string, string>,
  config: PayFastConfig
): VerifiedPayFastItn {
  if (!params.merchant_id || params.merchant_id.trim() !== config.merchantId) {
    return { valid: false, reason: 'Merchant ID mismatch' }
  }

  if (!validatePayFastSignature(params, params.signature || '', config.passphrase)) {
    return { valid: false, reason: 'Signature mismatch' }
  }

  const rawItem = params.custom_str2 as SelfServePaymentItem | undefined
  const pricing = rawItem ? PRICING[rawItem] : undefined
  if (!rawItem || !pricing || pricing.billingType !== 'self_serve') {
    return { valid: false, reason: 'Invalid or non-self-serve payment item' }
  }

  const userId = (params.custom_str1 || '').trim()
  if (!userId) {
    return { valid: false, reason: 'Missing user identifier (custom_str1)' }
  }

  const paymentStatus = (params.payment_status || '').trim()
  const amountGross = Number.parseFloat(params.amount_gross || '')
  if (!Number.isFinite(amountGross) || amountGross < 0) {
    return { valid: false, reason: 'Invalid amount_gross' }
  }

  if (paymentStatus === 'COMPLETE') {
    const receivedCents = Math.round(amountGross * 100)
    if (receivedCents !== pricing.amountZarCents) {
      return {
        valid: false,
        reason: `Amount mismatch: expected ${(pricing.amountZarCents / 100).toFixed(2)} ZAR, received ${amountGross.toFixed(2)} ZAR`
      }
    }
  }

  return {
    valid: true,
    paymentStatus,
    userId,
    item: rawItem,
    targetId: params.custom_str3?.trim() || undefined,
    amountGross,
    paymentId: params.m_payment_id?.trim() || `pf_${Date.now()}`,
    pfPaymentId: params.pf_payment_id?.trim() || undefined
  }
}

export interface BuildPaymentInput {
  item: SelfServePaymentItem
  targetId?: string
  userId: string
  userEmail?: string
  userName?: string
  returnPath?: string
}

/**
 * Constructs a fully signed PayFast payment request with ordered parameters.
 */
export function buildPayFastPaymentRequest(
  input: BuildPaymentInput,
  env: Record<string, string | undefined> = process.env
): {
  processUrl: string
  redirectUrl: string
  fields: Record<string, string>
} {
  const config = getPayFastConfig(env)
  const pricing = PRICING[input.item]
  if (!pricing || pricing.billingType !== 'self_serve') {
    throw new Error(`Invalid pricing item: ${input.item}`)
  }

  const base = siteUrl()
  const randAmount = (pricing.amountZarCents / 100).toFixed(2)
  const isMonthly = pricing.cadence === 'monthly'

  // Tomorrow's date in YYYY-MM-DD format for recurring billing start
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  const rawFields: Record<string, string | undefined> = {
    merchant_id: config.merchantId,
    merchant_key: config.merchantKey,
    return_url: `${base}${input.returnPath || '/dashboard/business'}?payment=success&item=${encodeURIComponent(input.item)}`,
    cancel_url: `${base}${input.returnPath || '/dashboard/business'}?payment=cancelled`,
    notify_url: `${base}/api/payfast/itn`,
    name_first: input.userName ? input.userName.split(' ')[0] : 'Resident',
    name_last: input.userName && input.userName.includes(' ') ? input.userName.split(' ').slice(1).join(' ') : 'Member',
    email_address: input.userEmail || 'resident@theresidentcrew.com',
    m_payment_id: `res_${input.item}_${input.userId.slice(0, 8)}_${Date.now()}`,
    amount: randAmount,
    item_name: pricing.label.slice(0, 100),
    item_description: pricing.reasoning.slice(0, 255),
    custom_str1: input.userId,
    custom_str2: input.item,
    custom_str3: input.targetId || '',
  }

  // PayFast Subscriptions (Recurring billing for Priority, Premium, Plus)
  if (isMonthly) {
    rawFields.subscription_type = '1'
    rawFields.billing_date = tomorrow
    rawFields.recurring_amount = randAmount
    rawFields.frequency = '3' // 3 = Monthly
    rawFields.cycles = '0'    // 0 = Until cancelled
  }

  // Order parameters strictly according to PayFast specification
  const orderedFields: Record<string, string> = {}
  for (const key of PAYFAST_FIELD_ORDER) {
    const val = rawFields[key]
    if (val !== undefined && val !== '') {
      orderedFields[key] = val
    }
  }

  // Any custom or extra keys not in standard order
  for (const key of Object.keys(rawFields)) {
    const val = rawFields[key]
    if (!orderedFields[key] && val !== undefined && val !== '') {
      orderedFields[key] = val
    }
  }

  const signature = generatePayFastSignature(orderedFields, config.passphrase)
  orderedFields.signature = signature

  const processUrl = getPayFastProcessUrl(config.sandbox)

  // Construct query string for direct redirect
  const queryParts = Object.keys(orderedFields).map(
    k => `${k}=${encodeURIComponent(orderedFields[k]).replace(/%20/g, '+')}`
  )
  const redirectUrl = `${processUrl}?${queryParts.join('&')}`

  return {
    processUrl,
    redirectUrl,
    fields: orderedFields
  }
}

/**
 * Official PayFast AWS IP addresses for webhook (ITN) delivery and API whitelisting.
 * Notice: https://support.payfast.help/portal/en/kb/articles/whitelisting-ip-addresses-2-7-2025
 * PayFast migrated Payment API infrastructure to AWS (completed July 2025).
 */
export const PAYFAST_AWS_IPS = [
  '3.163.232.237',
  '3.163.233.237',
  '3.163.234.237',
  '3.163.235.237',
  '3.163.236.237',
  '3.163.237.237',
  '3.163.238.237',
  '3.163.239.237',
  '3.163.240.237',
  '3.163.241.237',
  '3.163.242.237',
  '3.163.243.237',
  '3.163.244.237',
  '3.163.245.237',
  '3.163.246.237',
  '3.163.247.237',
  '3.163.248.237',
  '3.163.249.237',
  '3.163.250.237',
  '3.163.251.237',
  '3.163.252.237'
] as const

/** Legacy on-premises IP addresses historically used by PayFast. */
export const PAYFAST_LEGACY_IPS = [
  '197.97.145.144',
  '197.97.145.145',
  '197.97.145.146',
  '197.97.145.147',
  '197.97.145.148',
  '197.97.145.149',
  '197.97.145.150',
  '197.97.145.151',
  '197.97.145.152',
  '197.97.145.153',
  '197.97.145.154',
  '197.97.145.155',
  '197.97.145.156',
  '197.97.145.157',
  '197.97.145.158',
  '41.74.179.194',
  '41.74.179.195',
  '41.74.179.196',
  '41.74.179.197',
  '41.74.179.198',
  '41.74.179.199',
  '41.74.179.200',
  '41.74.179.201',
  '41.74.179.202',
  '41.74.179.203',
  '41.74.179.204',
  '41.74.179.205',
  '41.74.179.206'
] as const

export const PAYFAST_WHITELISTED_IPS: readonly string[] = [
  ...PAYFAST_AWS_IPS,
  ...PAYFAST_LEGACY_IPS
]

export const PAYFAST_DOMAINS = [
  'payment.payfast.io',
  'adm.payfast.io',
  'api.payfast.io',
  'comms.payfast.io',
  'devdocs.payfast.io',
  'api.payfast.co.za',
  'www.payfast.co.za',
  'sandbox.payfast.co.za'
] as const

export function normalizeIp(ip: string): string {
  if (!ip) return ''
  let cleaned = ip.trim()
  if (cleaned.startsWith('::ffff:')) {
    cleaned = cleaned.slice(7)
  }
  if (cleaned.startsWith('[') && cleaned.includes(']:')) {
    cleaned = cleaned.slice(1, cleaned.indexOf(']:'))
  } else if (cleaned.includes(':') && cleaned.includes('.')) {
    cleaned = cleaned.split(':')[0]
  }
  return cleaned
}

export function isPayFastWhitelistedIp(ip: string): boolean {
  if (!ip) return false
  const normalized = normalizeIp(ip)
  return (PAYFAST_WHITELISTED_IPS as readonly string[]).includes(normalized)
}

export function extractClientIp(request: Request): string {
  const headers = request.headers
  const cfConnectingIp = headers.get('cf-connecting-ip')
  if (cfConnectingIp) return normalizeIp(cfConnectingIp)

  const xRealIp = headers.get('x-real-ip')
  if (xRealIp) return normalizeIp(xRealIp)

  const xForwardedFor = headers.get('x-forwarded-for')
  if (xForwardedFor) {
    const first = xForwardedFor.split(',')[0].trim()
    if (first) return normalizeIp(first)
  }

  return 'unknown'
}
