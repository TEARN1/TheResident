import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { buildPayFastPaymentRequest, type SelfServePaymentItem } from '../../../../utils/payfast'
import { PRICING } from '../../../../utils/pricing'

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const item = body.item as SelfServePaymentItem
    const targetId = typeof body.targetId === 'string' ? body.targetId : undefined
    const returnPath = typeof body.returnPath === 'string' ? body.returnPath : undefined

    if (!item || !PRICING[item]) {
      return NextResponse.json({ error: 'Invalid or missing payment item.' }, { status: 400 })
    }

    const cookieStore = await cookies()
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    let userId: string | null = null
    let userEmail: string | undefined = undefined
    let userName: string | undefined = undefined

    if (supabaseUrl && supabaseAnonKey) {
      const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll() {}
        }
      })

      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        userId = user.id
        userEmail = user.email
        userName = user.user_metadata?.full_name || user.user_metadata?.name
      }
    }

    // Must be logged in to purchase subscriptions or boosts
    if (!userId) {
      return NextResponse.json({ error: 'You must be signed in to upgrade or purchase.' }, { status: 401 })
    }

    const { redirectUrl, processUrl, fields } = buildPayFastPaymentRequest({
      item,
      targetId,
      userId,
      userEmail,
      userName,
      returnPath
    })

    return NextResponse.json({
      url: redirectUrl,
      processUrl,
      fields
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Checkout initiation failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
