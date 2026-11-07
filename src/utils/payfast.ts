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
 * Defaults to PayFast official sandbox credentials if not explicitly configured in production.
 */
export function getPayFastConfig(): PayFastConfig {
  const merchantId = process.env.PAYFAST_MERCHANT_ID || '10000100'
  const merchantKey = process.env.PAYFAST_MERCHANT_KEY || '46f0cd694581a'
  const passphrase = process.env.PAYFAST_PASSPHRASE || 'jt7NOE43FZPn'
  
  // Explicit flag or default to sandbox when using test merchant credentials
  const sandboxEnv = process.env.PAYFAST_SANDBOX
  const isSandbox = sandboxEnv === 'true' || merchantId === '10000100' || sandboxEnv !== 'false'

  return {
    merchantId: merchantId.trim(),
    merchantKey: merchantKey.trim(),
    passphrase: passphrase.trim(),
    sandbox: isSandbox
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
 * Validates an incoming ITN signature against computed signature.
 */
export function validatePayFastSignature(
  data: Record<string, string | undefined>,
  receivedSignature: string,
  passphrase?: string
): boolean {
  if (!receivedSignature) return false
  const computed = generatePayFastSignature(data, passphrase)
  return computed.toLowerCase() === receivedSignature.trim().toLowerCase()
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
export function buildPayFastPaymentRequest(input: BuildPaymentInput): {
  processUrl: string
  redirectUrl: string
  fields: Record<string, string>
} {
  const config = getPayFastConfig()
  const pricing = PRICING[input.item]
  if (!pricing) {
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
