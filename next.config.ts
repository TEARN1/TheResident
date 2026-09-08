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
