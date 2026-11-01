// The public origin used in sitemap.xml, robots.txt and canonical links.
// NEXT_PUBLIC_SITE_URL overrides it (e.g. for a staging domain).
const PRODUCTION_URL = 'https://theresidentcrew.com'

export function siteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL
  if (explicit) return explicit.replace(/\/+$/, '')
  return PRODUCTION_URL
}
