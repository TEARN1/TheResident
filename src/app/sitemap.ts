import type { MetadataRoute } from 'next'
import { siteUrl } from './site-url'
import { infoLinks } from './info-links'
import { listPublicServices, listPublicVendors, serviceSlug, vendorSlug } from './public-services'

export const revalidate = 3600 // must be a literal; matches REVALIDATE_SECONDS

// Only public pages belong here. Everything under /dashboard needs a login,
// so search engines could not crawl it anyway. Service pages come from the
// database (services and shops): only listings whose owners opted in to
// being shown publicly.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl()
  const [services, vendors] = await Promise.all([listPublicServices(), listPublicVendors()])
  return [
    { url: `${base}/`, changeFrequency: 'weekly', priority: 1 },
    { url: `${base}/auth`, changeFrequency: 'monthly', priority: 0.5 },
    ...infoLinks.map(l => ({
      url: `${base}${l.href}`,
      changeFrequency: l.href === '/services' || l.href === '/shops' ? ('daily' as const) : ('monthly' as const),
      priority: l.href === '/privacy' || l.href === '/terms' ? 0.3 : 0.7,
    })),
    ...services.map(s => ({
      url: `${base}/services/${serviceSlug(s)}`,
      lastModified: s.updated_at ?? undefined,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),
    ...vendors.map(v => ({
      url: `${base}/shops/${vendorSlug(v)}`,
      lastModified: v.updated_at ?? undefined,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),
  ]
}
