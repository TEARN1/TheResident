import { NextResponse, NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { scanInput } from './utils/security'

// Opportunistic per-instance throttle — NOT a rate limit you can rely on.
//
// This Map lives in one serverless instance's memory. Requests are spread
// across instances that are created and discarded at the platform's
// discretion, so an attacker distributing requests (or simply arriving on a
// cold start) is not counted against any shared total. It blunts a naive
// single-connection flood on a warm instance and nothing more.
//
// The controls that actually hold are server-side and stateful: the
// DB-backed login brute-force lockout (registerFailedAttempt/lockedUntil),
// the per-table Postgres triggers (res_check_broadcast_rate_limit,
// res_check_security_log_rate_limit), and Supabase's own platform limits.
// Named and commented this way deliberately — the previous "rate limiting
// simulator" wording read as a real control in SECURITY.md.
const instanceThrottleMap = new Map<string, { count: number; resetTime: number }>()
// Per instance, per minute, and counting ONLY requests a person actually
// made. It used to be 60 counting everything, which measured the browser
// rather than the user: Next prefetches every visible nav link, so a single
// dashboard page view fired 14 requests through here of which exactly ONE
// was a real navigation. That put the real ceiling at roughly four page
// views a minute before a 429 — normal tapping between tabs.
//
// The IP is the key, which makes it worse than it sounds for this app's
// actual users: South African mobile carriers put large numbers of
// subscribers behind one CGNAT address, as does any shared WiFi. A whole
// street on the same carrier NAT shares one bucket, so people who have never
// met can lock each other out.
const INSTANCE_THROTTLE_MAX = 300
const WINDOW_MS = 60 * 1000

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

export async function proxy(request: NextRequest) {
  const ip = (request as NextRequest & { ip?: string }).ip || request.headers.get('x-forwarded-for') || 'local-ip'
  const url = request.nextUrl.clone()

  // 1. Best-effort per-instance throttle (see the note on the Map above —
  //    this is not a control to depend on)
  //
  // Speculative prefetches are not counted. Next.js issues them on its own
  // for links it thinks the user might follow; the user did not ask for them
  // and cannot slow them down, so charging them against a human's budget
  // measures the framework, not a flood. They are also the overwhelming
  // majority of traffic through here — 13 of every 14 requests on a plain
  // page view.
  const isPrefetch = request.headers.get('next-router-prefetch') === '1' ||
    request.headers.get('purpose') === 'prefetch' ||
    request.headers.get('x-purpose') === 'preview'

  const now = Date.now()

  if (!isPrefetch) {
    const limitInfo = instanceThrottleMap.get(ip)

    if (!limitInfo || now > limitInfo.resetTime) {
      instanceThrottleMap.set(ip, { count: 1, resetTime: now + WINDOW_MS })
    } else {
      limitInfo.count += 1
      if (limitInfo.count > INSTANCE_THROTTLE_MAX) {
        // Deliberately does not echo `ip` back: it is derived from the
        // client-supplied x-forwarded-for header, so reflecting it turns
        // this response into a small reflection primitive for no benefit.
        // A person who taps too fast gets a page, not a raw JSON blob.
        // Only genuine API callers get JSON — anyone else is looking at
        // this in a browser and deserves a sentence they can read.
        const wantsJson = url.pathname.startsWith('/api/') ||
          (request.headers.get('accept') || '').includes('application/json')

        if (wantsJson) {
          return new NextResponse(
            JSON.stringify({
              error: 'Too Many Requests',
              message: 'Too many requests. Please slow down and try again shortly.'
            }),
            { status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': '60' } }
          )
        }

        return new NextResponse(
          `<!doctype html><meta charset="utf-8">` +
          `<meta name="viewport" content="width=device-width,initial-scale=1">` +
          `<title>One moment</title>` +
          `<body style="margin:0;background:var(--surface);color:var(--surface-raised);font-family:system-ui,sans-serif;` +
          `display:flex;align-items:center;justify-content:center;min-height:100vh;padding:24px">` +
          `<div style="max-width:22rem;text-align:center">` +
          `<h1 style="color:var(--accent);font-size:1.1rem;margin:0 0 .75rem">Just a moment</h1>` +
          `<p style="color:var(--text-muted);font-size:.85rem;line-height:1.6;margin:0 0 1.25rem">` +
          `That was a lot of requests at once. Give it a minute and try again — ` +
          `nothing is wrong with your account.</p>` +
          `<a href="/dashboard" style="color:var(--accent);font-size:.8rem;font-weight:700">Back to the app</a>` +
          `</div></body>`,
          { status: 429, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Retry-After': '60' } }
        )
      }
    }
  }

  // 2. URL-based attack scanning (using core security library)
  const searchParams = decodeURIComponent(url.searchParams.toString())
  const scanResult = scanInput(searchParams)

  if (!scanResult.safe) {
    // Return error response blocking the hacking attempt
    return new NextResponse(
      JSON.stringify({
        error: 'Security Exception',
        message: `Malicious payload detected in URL query parameters. Blocked threat types: ${scanResult.threats.join(', ')}`,
        incidentId: `inc-${Math.random().toString(36).substr(2, 9)}`
      }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }

  // 3. Authenticated Route Protection
  // Response is created up-front so Supabase can attach refreshed session
  // cookies to it during getUser().
  const response = NextResponse.next()

  if (url.pathname.startsWith('/dashboard')) {
    const isGuest = request.cookies.get('guest-mode')?.value === '1'
    let hasValidSession = false

    if (supabaseUrl && supabaseAnonKey) {
      const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options)
            )
          }
        }
      })
      const { data: { user } } = await supabase.auth.getUser()
      hasValidSession = !!user
    }

    if (!hasValidSession && !isGuest) {
      url.pathname = '/auth'
      return NextResponse.redirect(url)
    }
  }

  // 4. Inject Security Hardening Headers

  // Prevent clickjacking
  response.headers.set('X-Frame-Options', 'DENY')

  // Prevent mime-sniffing
  response.headers.set('X-Content-Type-Options', 'nosniff')

  // X-XSS-Protection is deliberately NOT set. The header is deprecated and
  // removed from modern browsers, and its legacy auditor could itself be
  // abused to introduce vulnerabilities in pages that were otherwise safe.
  // The Content-Security-Policy below is the real control.

  // Prevent referrer leakage
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')

  // The Content-Security-Policy is set in next.config.ts, not here.
  //
  // It used to be set here only, and this middleware's matcher is
  // ['/dashboard/:path*', '/api/:path*'] — so /auth, the landing page and the
  // policy pages were served with no CSP at all. The sign-in page was the
  // least protected page on the site.
  //
  // Setting it in both places would be worse than either: two different CSP
  // headers on one response are enforced as their INTERSECTION, so a
  // directive relaxed in one and tightened in the other silently breaks the
  // page, and the reason is very hard to find.

  return response
}

// Config to specify matching paths
export const config = {
  matcher: ['/dashboard/:path*', '/api/:path*']
}
