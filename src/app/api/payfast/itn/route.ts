import {
  extractClientIp,
  getPayFastConfig,
  getPayFastValidateUrl,
  isPayFastWhitelistedIp,
  validatePayFastSignature,
  type SelfServePaymentItem
} from '../../../../utils/payfast'
import { PRICING } from '../../../../utils/pricing'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
  try {
    const config = getPayFastConfig()

    // 0. Whitelist IP verification (AWS migration support)
    const clientIp = extractClientIp(request)
    const skipIpCheck = process.env.PAYFAST_SKIP_IP_CHECK === 'true'
    const enforceIpWhitelist = process.env.PAYFAST_ENFORCE_IP_WHITELIST === 'true' || !config.sandbox

    if (enforceIpWhitelist && !skipIpCheck) {
      if (!isPayFastWhitelistedIp(clientIp)) {
        console.warn(`PayFast ITN source IP ${clientIp} not in whitelist`)
        return new Response(`Forbidden: source IP ${clientIp} not whitelisted`, { status: 403 })
      }
    }

    const rawBody = await request.text()
    const searchParams = new URLSearchParams(rawBody)
    const params: Record<string, string> = {}
    searchParams.forEach((value, key) => {
      params[key] = value
    })

    // 1. Validate signature
    const isValidSignature = validatePayFastSignature(params, params.signature || '', config.passphrase)
    if (!isValidSignature) {
      console.warn('PayFast ITN signature mismatch')
      return new Response('Signature mismatch', { status: 400 })
    }

    // 2. Server-to-server validation check against PayFast
    try {
      const validateUrl = getPayFastValidateUrl(config.sandbox)
      const verifyRes = await fetch(validateUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: rawBody
      })
      const verifyText = await verifyRes.text()
      if (verifyText.trim() !== 'VALID') {
        console.warn('PayFast server returned non-VALID response:', verifyText)
        return new Response('PayFast validation rejected', { status: 400 })
      }
    } catch (verifyErr) {
      console.error('Error contacting PayFast validation host:', verifyErr)
      // If network glitch contacting validate endpoint, don't crash
    }

    // 3. Process completed payment
    const paymentStatus = params.payment_status
    const userId = params.custom_str1
    const item = params.custom_str2 as SelfServePaymentItem
    const targetId = params.custom_str3
    const amountGross = parseFloat(params.amount_gross || '0')
    const paymentId = params.m_payment_id || `pf_${Date.now()}`
    const pfPaymentId = params.pf_payment_id

    if (paymentStatus === 'COMPLETE' && userId && item && PRICING[item]) {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

      if (supabaseUrl && serviceRoleKey) {
        const adminSupabase = createClient(supabaseUrl, serviceRoleKey)

        // Try executing the dedicated RPC if migration applied
        const { error: rpcError } = await adminSupabase.rpc('res_apply_payfast_payment', {
          p_payment_id: paymentId,
          p_pf_payment_id: pfPaymentId || '',
          p_user_id: userId,
          p_item: item,
          p_target_id: targetId || null,
          p_status: paymentStatus,
          p_amount: amountGross,
          p_raw_data: params
        })

        if (rpcError) {
          // Fallback direct table updates if RPC function not created in database yet
          if (item === 'priority' || item === 'premium') {
            await adminSupabase.from('res_subscriptions').upsert({
              user_id: userId,
              product: 'provider',
              tier: item,
              status: 'active',
              current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
              updated_at: new Date().toISOString()
            }, { onConflict: 'user_id,product' })
          } else if (item === 'plus') {
            await adminSupabase.from('res_subscriptions').upsert({
              user_id: userId,
              product: 'household',
              status: 'active',
              current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
              updated_at: new Date().toISOString()
            }, { onConflict: 'user_id,product' })
          } else if (item === 'room_boost' && targetId) {
            await adminSupabase.from('res_listings').update({
              featured_until: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
            }).eq('id', targetId)
          } else if (item === 'verification_speedup') {
            await adminSupabase.from('res_profiles').update({
              verification_status: 'reviewed'
            }).eq('id', userId)
          }
        }
      }
    }

    // Acknowledge receipt to PayFast with 200 OK
    return new Response('OK', { status: 200 })
  } catch (err: unknown) {
    console.error('PayFast ITN Handler Error:', err)
    return new Response('Internal error', { status: 500 })
  }
}
