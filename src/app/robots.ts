import type { MetadataRoute } from 'next'
import { siteUrl } from './site-url'

export default function robots(): MetadataRoute.Robots {
  const base = siteUrl()
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/dashboard/', '/auth/onboarding', '/api/'],
      },
      {
        userAgent: 'Googlebot-Image',
        allow: ['/logo.png', '/opengraph-image', '/favicon.ico'],
        disallow: ['/api/'],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  }
}
