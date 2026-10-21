import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { oauthFailureReason } from '../../../utils/oauth'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  // `next` is appended straight onto the origin, so it must be a plain
  // same-site path. Values like "@evil.com" or ".evil.com" would otherwise
  // turn `${origin}${next}` into a redirect to another host.
  const rawNext = searchParams.get('next') ?? '/dashboard'
  const next = /^\/(?![/\\])/.test(rawNext) ? rawNext : '/dashboard'

  if (code) {
    const cookieStore = await cookies()
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server Component cookie set fallback
          }
        },
      },
    })

    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      // Ensure res_profiles exists for the newly authenticated user
      await supabase.rpc('ensure_res_profile').then(() => {}, () => {})
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // Back to sign-in with a reason the page can explain (cancelled, no email
  // on the Facebook account, or anything else). It used to send
  // ?error=oauth_callback_failed, which the page never read, so people just
  // landed back on sign-in with no message.
  const reason = oauthFailureReason(searchParams.get('error'), searchParams.get('error_description'))
  return NextResponse.redirect(`${origin}/auth?oauth=${reason}`)
}
