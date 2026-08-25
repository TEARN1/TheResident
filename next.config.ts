import type { NextConfig } from "next";

// Bundle analysis: run `npx next experimental-analyze`.
// NOT @next/bundle-analyzer — it is a webpack plugin, and this project
// builds with Turbopack, against which it silently no-ops ("The Next Bundle
// Analyzer is not compatible with Turbopack builds, no report will be
// generated"). It was tried here and removed rather than left in as dead
// config that looks like working instrumentation.
const nextConfig: NextConfig = {
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
    return [
      {
        source: '/:path*',
        headers: [
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
