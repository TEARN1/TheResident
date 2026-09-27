import type { MetadataRoute } from 'next'
import { siteUrl } from './site-url'
import { infoLinks, INFO_PAGES_UPDATED } from './info-links'
import { listDirectory, distinct, latest, type DirectoryEntry } from './public-services'

export const revalidate = 3600 // must be a literal; matches REVALIDATE_SECONDS

// Only public pages belong here. Everything under /dashboard needs a login,
// so search engines could not crawl it anyway. Everything else comes from
// the database (only listings whose owners opted in to being shown), and a
// category or area page is listed only while it has at least one listing.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl()
  const entries = await listDirectory()
  const dynamicHubs = new Set(['/services', '/shops', '/area'])

  const hub = (path: string, group: DirectoryEntry[], priority: number): MetadataRoute.Sitemap[number] => ({
    url: `${base}${path}`,
    lastModified: latest(group),
    changeFrequency: 'weekly',
    priority,
  })

  // Category pages (/services/plumbing) and category-in-area pages
  // (/services/plumbing/soweto).
  const categoryPages: MetadataRoute.Sitemap = []
  for (const section of ['services', 'shops'] as const) {
    const inSection = entries.filter(e => e.section === section)
    for (const cat of distinct(inSection, e => e.categorySlug)) {
      const inCat = inSection.filter(e => e.categorySlug === cat)
      categoryPages.push(hub(`/${section}/${cat}`, inCat, 0.7))
      for (const area of distinct(inCat, e => e.areaSlug)) {
        categoryPages.push(hub(`/${section}/${cat}/${area}`, inCat.filter(e => e.areaSlug === area), 0.7))
      }
    }
  }

  const areaPages = distinct(entries, e => e.areaSlug).map(area =>
    hub(`/area/${area}`, entries.filter(e => e.areaSlug === area), 0.7))

  const listingPages: MetadataRoute.Sitemap = entries.map(e => ({
    url: `${base}${e.href}`,
    lastModified: e.updated_at ?? undefined,
    changeFrequency: 'weekly',
    priority: 0.8,
    ...(e.image ? { images: [e.image] } : {}),
  }))

  return [
    { url: `${base}/`, lastModified: latest(entries) ?? INFO_PAGES_UPDATED, changeFrequency: 'daily', priority: 1 },
    { url: `${base}/auth`, lastModified: INFO_PAGES_UPDATED, changeFrequency: 'monthly', priority: 0.5 },
    ...infoLinks.map(l =>
      dynamicHubs.has(l.href)
        ? { ...hub(l.href, entries, 0.8), lastModified: latest(entries) ?? INFO_PAGES_UPDATED, changeFrequency: 'daily' as const }
        : {
            url: `${base}${l.href}`,
            lastModified: INFO_PAGES_UPDATED,
            changeFrequency: 'monthly' as const,
            priority: l.href === '/privacy' || l.href === '/terms' ? 0.3 : 0.6,
          }),
    ...categoryPages,
    ...areaPages,
    ...listingPages,
  ]
}
