// Where Google / Facebook send the browser back after sign-in.
//
// signInWithOAuth (src/utils/oauth.ts) does a full top-level navigation to the
// provider; this is the other half — the provider redirects here with a
// one-time ?code=, which is exchanged for a real session. That exchange has
// to happen server-side: it's the point where a session cookie actually gets
// written for middleware.ts to see on the very next request.
//
// A GET route handler, not a page, because a redirect target has to run
// before any component renders — there is nothing to show until the session
// exists or the exchange has failed.

import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const oauthError = searchParams.get('error_description') || searchParams.get('error')

  // The provider itself can redirect back with an error (the person declined
  // the consent screen, or cancelled) — that is not a broken app, so it is
  // reported through the same error banner /auth already knows how to render
  // rather than as a crash.
  if (oauthError) {
    return NextResponse.redirect(`${origin}/auth?error=${encodeURIComponent(oauthError)}`)
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/auth?error=${encodeURIComponent('No sign-in code was returned.')}`)
  }

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.redirect(`${origin}/auth?error=${encodeURIComponent('Database offline / not configured.')}`)
  }

  // The redirect target IS the response the cookies attach to — Supabase's
  // SSR client needs a response object to write the session cookie onto, and
  // this is the only response this handler ever returns.
  const response = NextResponse.redirect(`${origin}/dashboard`)

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        )
      },
    },
  })

  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) {
    return NextResponse.redirect(`${origin}/auth?error=${encodeURIComponent(error.message)}`)
  }

  // Mirrors performLogin's email/password path: a Google or Facebook sign-in
  // is still a brand-new person on the Resident side the first time, and this
  // is what gives them a res_profiles row instead of a dashboard that half
  // loads because it's missing. Best-effort — an existing user already has
  // one, and a transient failure here must not block them getting in.
  await supabase.rpc('ensure_res_profile').then(() => {}, () => {})

  return response
}
