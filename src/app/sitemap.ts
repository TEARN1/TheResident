import type { MetadataRoute } from 'next'
import { siteUrl } from './site-url'
import { infoLinks, INFO_PAGES_UPDATED } from './info-links'
import { listDirectory, distinct, latest, DEFAULT_AREAS, CAMPUSES, type DirectoryEntry } from './public-services'
import { listPublicListings, roomImages } from './public-listings'

export const revalidate = 3600 // must be a literal; matches REVALIDATE_SECONDS

// Only public pages belong here. Everything under /dashboard needs a login,
// so search engines could not crawl it anyway. Everything else comes from
// the database (only listings whose owners opted in to being shown), plus
// South African community area hubs.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl()
  const [entries, roomListings] = await Promise.all([
    listDirectory(),
    listPublicListings()
  ])
  const dynamicHubs = new Set(['/services', '/shops', '/area'])

  const hub = (path: string, group: DirectoryEntry[], priority: number): MetadataRoute.Sitemap[number] => ({
    url: `${base}${path}`,
    lastModified: latest(group) ?? INFO_PAGES_UPDATED,
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

  const allAreaSlugs = Array.from(new Set([
    ...distinct(entries, e => e.areaSlug),
    ...DEFAULT_AREAS.map(a => a.slug)
  ])).filter((s): s is string => !!s)

  const areaPages = allAreaSlugs.map(area =>
    hub(`/area/${area}`, entries.filter(e => e.areaSlug === area), 0.7))

  const listingPages: MetadataRoute.Sitemap = entries.map(e => ({
    url: `${base}${e.href}`,
    lastModified: e.updated_at ?? undefined,
    changeFrequency: 'weekly',
    priority: 0.8,
    ...(e.image ? { images: [e.image] } : {}),
  }))

  const roomPages: MetadataRoute.Sitemap = roomListings.map(r => {
    const imgs = roomImages(r)
    return {
      url: `${base}/rooms/${r.id}`,
      lastModified: r.created_at ?? undefined,
      changeFrequency: 'daily',
      priority: 0.8,
      ...(imgs.length > 0 ? { images: imgs } : {}),
    }
  })

  const campusPages: MetadataRoute.Sitemap = [
    { url: `${base}/campus`, lastModified: INFO_PAGES_UPDATED, changeFrequency: 'weekly', priority: 0.85 },
    ...CAMPUSES.map(c => ({
      url: `${base}/campus/${c.slug}`,
      lastModified: INFO_PAGES_UPDATED,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),
  ]

  return [
    { url: `${base}/`, lastModified: latest(entries) ?? INFO_PAGES_UPDATED, changeFrequency: 'daily', priority: 1 },
    { url: `${base}/auth`, lastModified: INFO_PAGES_UPDATED, changeFrequency: 'monthly', priority: 0.5 },
    ...infoLinks
      .filter(l => l.href !== '/campus')
      .map(l =>
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
    ...campusPages,
    ...listingPages,
    ...roomPages,
  ]
}
