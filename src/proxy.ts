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
const INSTANCE_THROTTLE_MAX = 60 // per instance, per minute — best effort only
const WINDOW_MS = 60 * 1000

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

export async function proxy(request: NextRequest) {
  const ip = (request as NextRequest & { ip?: string }).ip || request.headers.get('x-forwarded-for') || 'local-ip'
  const url = request.nextUrl.clone()

  // 1. Best-effort per-instance throttle (see the note on the Map above —
  //    this is not a control to depend on)
  const now = Date.now()
  const limitInfo = instanceThrottleMap.get(ip)

  if (!limitInfo) {
    instanceThrottleMap.set(ip, { count: 1, resetTime: now + WINDOW_MS })
  } else {
    if (now > limitInfo.resetTime) {
      instanceThrottleMap.set(ip, { count: 1, resetTime: now + WINDOW_MS })
    } else {
      limitInfo.count += 1
      if (limitInfo.count > INSTANCE_THROTTLE_MAX) {
        // Deliberately does not echo `ip` back: it is derived from the
        // client-supplied x-forwarded-for header, so reflecting it turns
        // this response into a small reflection primitive for no benefit.
        return new NextResponse(
          JSON.stringify({
            error: 'Too Many Requests',
            message: 'Too many requests. Please slow down and try again shortly.'
          }),
          {
            status: 429,
            headers: {
              'Content-Type': 'application/json',
              'Retry-After': '60'
            }
          }
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

  // Content Security Policy (CSP)
  // Supabase REST/auth/realtime/storage must be reachable from the dashboard.
  const supabaseOrigin = supabaseUrl ? new URL(supabaseUrl).origin : 'https://*.supabase.co'
  const supabaseWsOrigin = supabaseOrigin.replace(/^https:/, 'wss:')
  response.headers.set(
    'Content-Security-Policy',
    `default-src 'self'; script-src 'self' 'unsafe-inline' https://apis.google.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: blob: ${supabaseOrigin} https://images.unsplash.com https://avatars.githubusercontent.com https://*.tile.openstreetmap.org https://*.basemaps.cartocdn.com; font-src 'self' https://fonts.gstatic.com; connect-src 'self' ${supabaseOrigin} ${supabaseWsOrigin}; frame-ancestors 'none'; base-uri 'self'; form-action 'self';`
  )

  return response
}

// Config to specify matching paths
export const config = {
  matcher: ['/dashboard/:path*', '/api/:path*']
}
