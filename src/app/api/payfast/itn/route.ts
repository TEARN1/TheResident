import {
  extractClientIp,
  getPayFastConfig,
  getPayFastValidateUrl,
  isPayFastWhitelistedIp,
  verifyPayFastItnPayload
} from '../../../../utils/payfast'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
  try {
    const config = getPayFastConfig()

    // 1. Source IP whitelist check (enforced automatically in live mode)
    const clientIp = extractClientIp(request)
    const skipIpCheck = process.env.PAYFAST_SKIP_IP_CHECK === 'true'
    const enforceIpWhitelist =
      process.env.PAYFAST_ENFORCE_IP_WHITELIST === 'true' || !config.sandbox

    if (enforceIpWhitelist && !skipIpCheck) {
      if (!isPayFastWhitelistedIp(clientIp)) {
        console.warn(`PayFast ITN source IP ${clientIp} not in whitelist`)
        return new Response('Forbidden: source IP not whitelisted', { status: 403 })
      }
    }

    const rawBody = await request.text()
    const searchParams = new URLSearchParams(rawBody)
    const params: Record<string, string> = {}
    searchParams.forEach((value, key) => {
      params[key] = value
    })

    // 2. Verify merchant_id, MD5 signature, valid self-serve item, and exact ZAR amount
    const verified = verifyPayFastItnPayload(params, config)
    if (!verified.valid) {
      console.warn('PayFast ITN payload rejected:', verified.reason)
      return new Response(verified.reason, { status: 400 })
    }

    // 3. Server-to-server validation check against PayFast (fail closed so PayFast retries on outage)
    try {
      const validateUrl = getPayFastValidateUrl(config.sandbox)
      const verifyRes = await fetch(validateUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: rawBody
      })
      if (!verifyRes.ok) {
        console.error(`PayFast validation host HTTP ${verifyRes.status}`)
        return new Response('PayFast validation host unavailable', { status: 503 })
      }
      const verifyText = await verifyRes.text()
      if (verifyText.trim() !== 'VALID') {
        console.warn('PayFast server returned non-VALID response:', verifyText)
        return new Response('PayFast validation rejected', { status: 400 })
      }
    } catch (verifyErr) {
      console.error('Error contacting PayFast validation host:', verifyErr)
      return new Response('PayFast validation unreachable', { status: 503 })
    }

    // 4. Record transaction & fulfill upgrade strictly via server-only service_role key
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceRoleKey) {
      console.error(
        'PayFast ITN cannot persist payment: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing'
      )
      return new Response('Server database credentials not configured', { status: 500 })
    }

    const adminSupabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    })

    const { error: rpcError } = await adminSupabase.rpc('res_apply_payfast_payment', {
      p_payment_id: verified.paymentId,
      p_pf_payment_id: verified.pfPaymentId || '',
      p_user_id: verified.userId,
      p_item: verified.item,
      p_target_id: verified.targetId || null,
      p_status: verified.paymentStatus,
      p_amount: verified.amountGross,
      p_raw_data: params
    })

    if (rpcError) {
      console.error('res_apply_payfast_payment RPC failed:', rpcError.message)
      return new Response('Database fulfillment failed', { status: 500 })
    }

    // Acknowledge receipt to PayFast with 200 OK
    return new Response('OK', { status: 200 })
  } catch (err: unknown) {
    console.error('PayFast ITN Handler Error:', err)
    return new Response('Internal error', { status: 500 })
  }
}
