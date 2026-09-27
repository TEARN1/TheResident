import type { MetadataRoute } from 'next'
import { siteUrl } from './site-url'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/dashboard', '/auth/onboarding'],
    },
    sitemap: `${siteUrl()}/sitemap.xml`,
  }
}
