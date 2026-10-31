import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { oauthFailureReason } from '../../../utils/oauth'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const provider = searchParams.get('provider') || ''

  // Determine public origin correctly behind reverse proxies (Nginx on VPS)
  const forwardedHost = request.headers.get('x-forwarded-host') || request.headers.get('host')
  const forwardedProto = request.headers.get('x-forwarded-proto') || (request.url.startsWith('https') ? 'https' : 'http')
  const isLocalEnv = process.env.NODE_ENV === 'development' && (!forwardedHost || forwardedHost.includes('localhost') || forwardedHost.includes('127.0.0.1'))
  const publicOrigin = isLocalEnv ? origin : `${forwardedProto}://${forwardedHost}`

  // `next` is appended straight onto the origin, so it must be a plain
  // same-site path. Values like "@evil.com" or ".evil.com" would otherwise
  // turn `${origin}${next}` into a redirect to another host.
  const rawNext = searchParams.get('next') ?? '/dashboard'
  const next = /^\/(?![/\\])/.test(rawNext) ? rawNext : '/dashboard'
  const roleParam = searchParams.get('role')
  const role = (roleParam === 'tenant' || roleParam === 'landlord') ? roleParam : null

  if (code) {
    const cookieStore = await cookies()
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

    const redirectUrl = `${publicOrigin}${next}`
    const response = NextResponse.redirect(redirectUrl)

    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
              response.cookies.set(name, value, options)
            })
          } catch {
            // Server Component cookie set fallback
          }
        },
      },
    })

    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && data?.session?.user) {
      const user = data.session.user

      // 1. Ensure res_profiles exists for the newly authenticated user
      await supabase.rpc('ensure_res_profile').then(() => {}, () => {})

      // 2. If a specific role was chosen (e.g. from signup form), set it
      if (role) {
        await supabase
          .from('res_profiles')
          .update({ role })
          .eq('id', user.id)
      }

      // 3. Check if user needs onboarding (first time cross-app login with no bio and role === 'visitor')
      const { data: dbProfile } = await supabase
        .from('res_profiles')
        .select('role, bio')
        .eq('id', user.id)
        .maybeSingle()

      const userRole = dbProfile?.role || role || 'visitor'
      const needsOnboarding = userRole === 'visitor' && !dbProfile?.bio

      if (needsOnboarding && !next.startsWith('/auth/onboarding')) {
        const onboardingUrl = `${publicOrigin}/auth/onboarding${next !== '/dashboard' ? `?next=${encodeURIComponent(next)}` : ''}`
        return NextResponse.redirect(onboardingUrl, {
          headers: response.headers
        })
      }

      return response
    }

    if (error) {
      const reason = oauthFailureReason('exchange_error', error.message)
      const providerQuery = provider ? `&provider=${encodeURIComponent(provider)}` : ''
      return NextResponse.redirect(`${publicOrigin}/auth?oauth=${reason}${providerQuery}`)
    }
  }

  // Back to sign-in with a reason the page can explain (cancelled, no email
  // on the Facebook/Google account, or anything else).
  const reason = oauthFailureReason(searchParams.get('error'), searchParams.get('error_description'))
  const providerQuery = provider ? `&provider=${encodeURIComponent(provider)}` : ''
  return NextResponse.redirect(`${publicOrigin}/auth?oauth=${reason}${providerQuery}`)
}
