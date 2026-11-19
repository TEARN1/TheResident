import type { MetadataRoute } from 'next'
import { siteUrl } from './site-url'
import { infoLinks, INFO_PAGES_UPDATED } from './info-links'
import { FOUNDER_IMAGES } from './entity-schema'
import {
  listDirectory, distinct, latest, DEFAULT_AREAS, DEFAULT_SERVICE_CATEGORIES, VENDOR_KIND_LABELS, CAMPUSES,
  type DirectoryEntry,
} from './public-services'
import { listPublicListings, roomImages } from './public-listings'
import { SA_TAXI_RANKS } from '../utils/taxiRoutes'
import { STATUTORY_WARDS } from '../utils/civicChessboard'

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

  const hub = (
    path: string,
    group: DirectoryEntry[],
    priority: number,
    images?: string[]
  ): MetadataRoute.Sitemap[number] => ({
    url: `${base}${path}`,
    lastModified: latest(group) ?? INFO_PAGES_UPDATED,
    changeFrequency: 'weekly',
    priority,
    ...(images && images.length > 0 ? { images } : {}),
  })

  // Category pages (/services/plumbing) and category-in-area pages
  // (/services/plumbing/soweto), combining default categories & suburbs with DB entries.
  const defaultCats = {
    services: Object.keys(DEFAULT_SERVICE_CATEGORIES),
    shops: Object.keys(VENDOR_KIND_LABELS),
  } as const
  const defaultAreaSlugs = DEFAULT_AREAS.map(a => a.slug)

  const categoryPages: MetadataRoute.Sitemap = []
  for (const section of ['services', 'shops'] as const) {
    const inSection = entries.filter(e => e.section === section)
    const catSlugs = Array.from(new Set([...defaultCats[section], ...distinct(inSection, e => e.categorySlug)]))
    for (const cat of catSlugs) {
      const inCat = inSection.filter(e => e.categorySlug === cat)
      categoryPages.push(hub(`/${section}/${cat}`, inCat, 0.7))
      const catAreas = Array.from(new Set([...defaultAreaSlugs, ...distinct(inCat, e => e.areaSlug)]))
      for (const area of catAreas) {
        categoryPages.push(hub(`/${section}/${cat}/${area}`, inCat.filter(e => e.areaSlug === area), 0.65))
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
    {
      url: `${base}/campus`,
      lastModified: INFO_PAGES_UPDATED,
      changeFrequency: 'weekly',
      priority: 0.85,
      images: [
        `${base}/screenshots/app-housing-rooms.png`,
        `${base}/screenshots/ad-excellency-academy-1200x630.png`,
      ],
    },
    ...CAMPUSES.map(c => ({
      url: `${base}/campus/${c.slug}`,
      lastModified: INFO_PAGES_UPDATED,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),
  ]

  const pageImages: Record<string, string[]> = {
    '/founder': [
      ...FOUNDER_IMAGES.map(img => `${base}${img.path}`),
      `${base}/founder/opengraph-image`,
      `${base}/founder/portrait.png`,
      `${base}/screenshots/app-founder-ceo.png`,
    ],
    '/press': [
      `${base}/press/opengraph-image`,
      `${base}/logo.png`,
      `${base}/opengraph-image`,
      `${base}/screenshots/ad-the-gruvs-1200x630.png`,
      `${base}/screenshots/ad-excellency-academy-1200x630.png`,
      `${base}/screenshots/app-home-hero.png`,
      `${base}/screenshots/app-live-precinct-map.png`,
      `${base}/screenshots/app-housing-rooms.png`,
      `${base}/screenshots/app-local-services.png`,
      `${base}/screenshots/app-taxi-ranks.png`,
      `${base}/screenshots/app-founder-ceo.png`,
      ...FOUNDER_IMAGES.map(img => `${base}${img.path}`),
    ],
    '/rooms': [
      `${base}/screenshots/app-housing-rooms.png`,
      `${base}/screenshots/ad-excellency-academy-1200x630.png`,
    ],
    '/services': [`${base}/screenshots/app-local-services.png`],
    '/taxi-ranks': [`${base}/screenshots/app-taxi-ranks.png`],
    '/area': [
      `${base}/screenshots/app-live-precinct-map.png`,
      `${base}/screenshots/ad-the-gruvs-1200x630.png`,
    ],
    '/wards': [`${base}/screenshots/app-live-precinct-map.png`],
    '/about': [`${base}/logo.png`, `${base}/screenshots/app-home-hero.png`],
    '/how-it-works': [`${base}/logo.png`, `${base}/screenshots/app-home-hero.png`],
  }

  const pagePriority = (href: string): number => {
    if (href === '/founder' || href === '/rooms') return 0.9
    if (href === '/press' || href === '/taxi-ranks' || href === '/wards') return 0.85
    if (href === '/sitemap') return 0.75
    if (href === '/privacy' || href === '/terms') return 0.3
    return 0.6
  }

  const taxiRankPages: MetadataRoute.Sitemap = SA_TAXI_RANKS.map(rank => ({
    url: `${base}/taxi-ranks/${rank.id}`,
    lastModified: INFO_PAGES_UPDATED,
    changeFrequency: 'weekly',
    priority: 0.8,
  }))

  const wardPages: MetadataRoute.Sitemap = STATUTORY_WARDS.map(w => ({
    url: `${base}/wards/${w.wardCode.toLowerCase()}`,
    lastModified: INFO_PAGES_UPDATED,
    changeFrequency: 'weekly',
    priority: 0.8,
  }))

  const rawEntries: MetadataRoute.Sitemap = [
    {
      url: `${base}/`,
      lastModified: latest(entries) ?? INFO_PAGES_UPDATED,
      changeFrequency: 'daily',
      priority: 1,
      images: [
        `${base}/logo.png`,
        `${base}/opengraph-image`,
        `${base}/screenshots/app-home-hero.png`,
        `${base}/screenshots/app-live-precinct-map.png`,
        `${base}/screenshots/app-housing-rooms.png`,
        `${base}/screenshots/app-local-services.png`,
        `${base}/screenshots/app-taxi-ranks.png`,
      ],
    },
    { url: `${base}/auth`, lastModified: INFO_PAGES_UPDATED, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${base}/llms.txt`, lastModified: INFO_PAGES_UPDATED, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${base}/llms-full.txt`, lastModified: INFO_PAGES_UPDATED, changeFrequency: 'weekly', priority: 0.7 },
    ...infoLinks
      .filter(l => l.href !== '/campus')
      .map(l =>
        dynamicHubs.has(l.href)
          ? {
              ...hub(l.href, entries, 0.8, pageImages[l.href]),
              lastModified: latest(entries) ?? INFO_PAGES_UPDATED,
              changeFrequency: 'daily' as const,
            }
          : {
              url: `${base}${l.href}`,
              lastModified: INFO_PAGES_UPDATED,
              changeFrequency:
                l.href === '/rooms' || l.href === '/taxi-ranks' || l.href === '/wards'
                  ? ('daily' as const)
                  : l.href === '/sitemap'
                    ? ('weekly' as const)
                    : ('monthly' as const),
              priority: pagePriority(l.href),
              ...(pageImages[l.href] ? { images: pageImages[l.href] } : {}),
            }),
    ...categoryPages,
    ...areaPages,
    ...campusPages,
    ...taxiRankPages,
    ...wardPages,
    ...listingPages,
    ...roomPages,
  ]

  const deduped = new Map<string, MetadataRoute.Sitemap[number]>()
  for (const item of rawEntries) {
    if (!deduped.has(item.url)) deduped.set(item.url, item)
  }
  return Array.from(deduped.values())
}
