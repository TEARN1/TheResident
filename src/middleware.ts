import { NextResponse, NextRequest } from 'next/server'
import { scanInput } from './utils/security'

// In-memory rate limiting simulator (for edge runtime)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>()
const RATE_LIMIT_MAX = 60 // max requests per minute
const WINDOW_MS = 60 * 1000 // 1 minute

export function middleware(request: NextRequest) {
  const ip = (request as any).ip || request.headers.get('x-forwarded-for') || 'local-ip'
  const url = request.nextUrl.clone()

  // 1. Rate Limiting Check
  const now = Date.now()
  const limitInfo = rateLimitMap.get(ip)

  if (!limitInfo) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + WINDOW_MS })
  } else {
    if (now > limitInfo.resetTime) {
      rateLimitMap.set(ip, { count: 1, resetTime: now + WINDOW_MS })
    } else {
      limitInfo.count += 1
      if (limitInfo.count > RATE_LIMIT_MAX) {
        return new NextResponse(
          JSON.stringify({
            error: 'Too Many Requests',
            message: 'Rate limit exceeded. Security warning triggered.',
            ip
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
  // Simulate cookie-based session verification
  const sessionToken = request.cookies.get('session-token')

  if (url.pathname.startsWith('/dashboard')) {
    if (!sessionToken) {
      // User is not authenticated, redirect to /auth
      url.pathname = '/auth'
      return NextResponse.redirect(url)
    }
  }

  // 4. Inject Security Hardening Headers
  const response = NextResponse.next()
  
  // Prevent clickjacking
  response.headers.set('X-Frame-Options', 'DENY')
  
  // Prevent mime-sniffing
  response.headers.set('X-Content-Type-Options', 'nosniff')
  
  // Force XSS protection in legacy browsers
  response.headers.set('X-XSS-Protection', '1; mode=block')
  
  // Prevent referrer leakage
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  
  // Content Security Policy (CSP)
  response.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: https://images.unsplash.com https://avatars.githubusercontent.com; font-src 'self' https://fonts.gstatic.com; connect-src 'self';"
  )

  return response
}

// Config to specify matching paths
export const config = {
  matcher: ['/dashboard/:path*', '/api/:path*']
}
