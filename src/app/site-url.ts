// The public origin used in sitemap.xml and robots.txt. Set
// NEXT_PUBLIC_SITE_URL to the production domain; on Vercel it falls back to
// the project's production URL.
export function siteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL
  if (explicit) return explicit.replace(/\/+$/, '')
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL
  if (vercel) return `https://${vercel}`
  return 'http://localhost:3000'
}
