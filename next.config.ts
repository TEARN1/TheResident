import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  // This repo is worked on in git worktrees, and there are package-lock.json
  // files in parent directories (including the user home directory). Next
  // infers the workspace root from lockfiles and was picking home, which
  // matters with output: 'standalone' - file tracing would walk the wrong
  // tree and either bloat or miss the standalone bundle. Pin it to this
  // project, which is also where next dev and next build are invoked from.
  outputFileTracingRoot: process.cwd(),
  // Turbopack resolves its own root separately from file tracing, and
  // without this it walks up to a parent lockfile and then cannot resolve
  // next/package.json from the project directory.
  turbopack: {
    root: process.cwd(),
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
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin'
          }
        ]
      }
    ]
  }
};

export default nextConfig;
