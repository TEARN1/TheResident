import { NextResponse } from 'next/server'
import { siteUrl } from '../site-url'
import { FOUNDER_IMAGES } from '../entity-schema'
import { listPublicListings, roomImages } from '../public-listings'
import { listDirectory } from '../public-services'

export const revalidate = 3600

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/**
 * Dedicated Google Image Sitemap (/image-sitemap.xml) with <image:image> tags
 * covering founder portraits, brand logos, social previews, and verified listing photos.
 */
export async function GET() {
  const base = siteUrl().replace(/\/+$/, '')
  const [entries, roomListings] = await Promise.all([
    listDirectory(),
    listPublicListings(),
  ])

  interface UrlEntry {
    loc: string
    images: { loc: string; title: string; caption: string }[]
  }

  const urls: UrlEntry[] = [
    {
      loc: `${base}/`,
      images: [
        {
          loc: `${base}/logo.png`,
          title: 'The Resident Crew Official Logo',
          caption: 'Official square emblem of The Resident Crew — Verified Rooms, Safety Alerts & Local Services in South Africa.',
        },
        {
          loc: `${base}/opengraph-image`,
          title: 'The Resident Crew Platform Preview',
          caption: 'The Resident Crew — Find a room you can trust, know the street you live on.',
        },
      ],
    },
    {
      loc: `${base}/founder`,
      images: FOUNDER_IMAGES.map(img => ({
        loc: `${base}${img.path}`,
        title: img.title,
        caption: img.caption,
      })),
    },
    {
      loc: `${base}/press`,
      images: [
        {
          loc: `${base}/logo.png`,
          title: 'The Resident Crew Brand Mark (512x512 PNG)',
          caption: 'Official press logo for The Resident Crew and TEARN Ventures.',
        },
        {
          loc: `${base}/opengraph-image`,
          title: 'The Resident Crew Official Press Banner',
          caption: 'The Resident Crew product preview for journalists and media outlets.',
        },
        ...FOUNDER_IMAGES.map(img => ({
          loc: `${base}${img.path}`,
          title: img.title,
          caption: img.caption,
        })),
      ],
    },
    {
      loc: `${base}/about`,
      images: [
        {
          loc: `${base}/logo.png`,
          title: 'The Resident Crew Emblem',
          caption: 'The Resident Crew connects South African neighbours around verified housing, safety, and local trade.',
        },
      ],
    },
  ]

  for (const e of entries) {
    if (!e.image) continue
    urls.push({
      loc: `${base}${e.href}`,
      images: [
        {
          loc: e.image,
          title: `${e.name} — ${e.category}`,
          caption: `${e.name} listed on The Resident Crew${e.suburb ? ` in ${e.suburb}` : ''}.`,
        },
      ],
    })
  }

  for (const r of roomListings) {
    const imgs = roomImages(r)
    if (imgs.length === 0) continue
    urls.push({
      loc: `${base}/rooms/${r.id}`,
      images: imgs.map((imgUrl, idx) => ({
        loc: imgUrl,
        title: `${r.title} (${idx + 1})`,
        caption: `Verified room listing in ${r.suburb || 'South Africa'} on The Resident Crew.`,
      })),
    })
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urls
  .map(
    u => `  <url>
    <loc>${escapeXml(u.loc)}</loc>
${u.images
  .map(
    img => `    <image:image>
      <image:loc>${escapeXml(img.loc)}</image:loc>
      <image:title>${escapeXml(img.title)}</image:title>
      <image:caption>${escapeXml(img.caption)}</image:caption>
    </image:image>`
  )
  .join('\n')}
  </url>`
  )
  .join('\n')}
</urlset>`

  return new NextResponse(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  })
}
