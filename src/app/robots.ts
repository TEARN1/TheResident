import type { MetadataRoute } from 'next'
import { siteUrl } from './site-url'

const DISALLOWED = ['/dashboard/', '/auth/onboarding', '/api/']

const CRAWLER_AGENTS = [
  'Googlebot',
  'Google-Extended',
  'Bingbot',
  'GPTBot',
  'OAI-SearchBot',
  'ChatGPT-User',
  'PerplexityBot',
  'ClaudeBot',
  'Twitterbot',
  'facebookexternalhit',
  'LinkedInBot',
  'Applebot',
]

export default function robots(): MetadataRoute.Robots {
  const base = siteUrl()
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: DISALLOWED,
      },
      ...CRAWLER_AGENTS.map(userAgent => ({
        userAgent,
        allow: '/',
        disallow: DISALLOWED,
      })),
      {
        userAgent: 'Googlebot-Image',
        allow: ['/logo.png', '/opengraph-image', '/favicon.ico', '/founder/'],
        disallow: ['/api/'],
      },
    ],
    sitemap: [`${base}/sitemap.xml`, `${base}/image-sitemap.xml`],
    host: base,
  }
}
