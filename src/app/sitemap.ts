import type { MetadataRoute } from 'next'
import { siteUrl } from './site-url'

// Only public pages belong here. Everything under /dashboard needs a login,
// so search engines could not crawl it anyway.
export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl()
  return [
    { url: `${base}/`, changeFrequency: 'weekly', priority: 1 },
    { url: `${base}/auth`, changeFrequency: 'monthly', priority: 0.5 },
  ]
}
