import type { MetadataRoute } from 'next'
import { siteUrl } from './site-url'
import { infoLinks } from './info-links'

// Only public pages belong here. Everything under /dashboard needs a login,
// so search engines could not crawl it anyway.
export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl()
  return [
    { url: `${base}/`, changeFrequency: 'weekly', priority: 1 },
    { url: `${base}/auth`, changeFrequency: 'monthly', priority: 0.5 },
    ...infoLinks.map(l => ({
      url: `${base}${l.href}`,
      changeFrequency: 'monthly' as const,
      priority: l.href === '/privacy' || l.href === '/terms' ? 0.3 : 0.7,
    })),
  ]
}
