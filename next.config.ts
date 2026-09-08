import type { NextConfig } from "next";
import { execSync } from "node:child_process";

// A value that changes on every deploy, so the service worker can name its
// cache after it.
//
// Why this exists: public/sw.js used a hard-coded CACHE_NAME that was never
// bumped, so its activate() cleanup ("delete every cache that isn't the
// current one") never deleted anything. An installed PWA therefore served
// the previous deploy's HTML and JS on first open, every time — which is
// exactly the "it works on the web but not on my app" gap. The cache name
// has to change when the code changes, and nothing else in a static file
// under public/ can know that it did.
//
// Vercel supplies the commit SHA at build time; git covers local builds; the
// timestamp is a last resort that is wrong only in that it makes every build
// look new (safe — it over-invalidates rather than under-invalidates).
function buildId(): string {
  // Host-agnostic on purpose. VERCEL_GIT_COMMIT_SHA only exists on Vercel;
  // APP_BUILD_SHA is passed as a build arg by the Dockerfile so the same
  // mechanism works on DigitalOcean, or anywhere else running the container.
  if (process.env.APP_BUILD_SHA) return process.env.APP_BUILD_SHA.slice(0, 12);
  if (process.env.VERCEL_GIT_COMMIT_SHA) return process.env.VERCEL_GIT_COMMIT_SHA.slice(0, 12);
  try {
    return execSync("git rev-parse --short=12 HEAD", { stdio: ["ignore", "pipe", "ignore"] })
      .toString().trim();
  } catch {
    return `t${Date.now()}`;
  }
}

const nextConfig: NextConfig = {
  // Emits .next/standalone: a self-contained server with only the node_modules
  // it actually needs, which is what the Dockerfile has always tried to copy.
  // Without this the directory is never produced, so `docker build` failed at
  // the COPY step — the container path off Vercel did not work at all.
  output: 'standalone',
  env: {
    NEXT_PUBLIC_BUILD_ID: buildId(),
  },
  experimental: {
    optimizePackageImports: ['lucide-react', 'framer-motion'],
  },
  // Pinned because an empty, orphaned package-lock.json sits in the user's
  // home directory (no package.json, no node_modules beside it — junk from a
  // stray `npm install` run there once). Next walked up, found it, and
  // inferred the wrong workspace root on every single build. Pinning here
  // rather than deleting a file outside the repo: this fix is version
  // controlled and survives on any machine.
  turbopack: {
    root: __dirname,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
      {
        protocol: 'https',
        hostname: 'cdnjs.cloudflare.com',
      }
    ],
  },
  async headers() {
    // The Content-Security-Policy used to live ONLY in src/proxy.ts, whose
    // matcher is ['/dashboard/:path*', '/api/:path*']. Every other route —
    // including /auth, where people type their password, and the landing page
    // that links to it — was served with no CSP at all. The sign-in page is
    // the highest-value XSS target on the site and it was the least
    // protected.
    //
    // It lives here now so it covers every route from one place. Two sources
    // of truth for a security header is how a policy silently ends up weaker
    // than anyone intended; worse, two DIFFERENT CSP headers on one response
    // are enforced as their intersection, which breaks pages in ways that are
    // very hard to trace.
    const supabaseOrigin = process.env.NEXT_PUBLIC_SUPABASE_URL
      ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin
      : 'https://*.supabase.co'
    const supabaseWsOrigin = supabaseOrigin.replace(/^https:/, 'wss:')

    const csp = [
      "default-src 'self'",
      // 'unsafe-inline' is required by Next's own inline bootstrap and by the
      // pre-hydration theme script. Removing it needs a nonce threaded
      // through the document, which is a real change rather than a config
      // tweak — tracked, not pretended away.
      "script-src 'self' 'unsafe-inline' https://apis.google.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      `img-src 'self' data: blob: ${supabaseOrigin} https://images.unsplash.com https://avatars.githubusercontent.com https://*.tile.openstreetmap.org https://*.basemaps.cartocdn.com`,
      "font-src 'self' https://fonts.gstatic.com",
      // nominatim is the map's geocoder: utils/geocode.ts fetches it directly
      // from the client for the search box and for resolving a dropped pin to
      // a real address. Omitting it silently breaks both.
      `connect-src 'self' ${supabaseOrigin} ${supabaseWsOrigin} https://nominatim.openstreetmap.org`,
      "worker-src 'self'",
      "manifest-src 'self'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      'upgrade-insecure-requests'
    ].join('; ')

    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: csp
          },
          {
            // Switches off browser features this app never uses, so a
            // compromised script cannot reach for them. Geolocation IS used
            // (the map, the home area), so it stays available to same-origin.
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), payment=(), usb=(), magnetometer=(), gyroscope=(), geolocation=(self)'
          },
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload'
          },
          // These two used to disagree with src/proxy.ts, which sets DENY and
          // strict-origin-when-cross-origin on /dashboard and /api. Two
          // sources of truth for security headers that contradict each other
          // is how a policy silently ends up weaker than anyone intended, so
          // both now state the stricter value. DENY is consistent with the
          // CSP's `frame-ancestors 'none'`, and nothing in this app is meant
          // to be embedded anywhere.
          {
            key: 'X-Frame-Options',
            value: 'DENY'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          }
        ]
      }
    ]
  }
};

export default nextConfig;
