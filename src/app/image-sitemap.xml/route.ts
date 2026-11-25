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
 * covering founder portraits, brand logos, social previews, and listing photos.
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
          title: 'The Resident Crew Logo',
          caption: 'Square emblem of The Resident Crew — Rooms, Safety Alerts & Local Services in South Africa.',
        },
        {
          loc: `${base}/opengraph-image`,
          title: 'The Resident Crew Platform Preview',
          caption: 'The Resident Crew — Find a room you can trust, know the street you live on.',
        },
        {
          loc: `${base}/screenshots/app-home-hero.png`,
          title: 'The Resident Crew Home & Ecosystem Preview',
          caption: 'Landing screen highlighting South African rooms, live safety alerts, and community tools.',
        },
        {
          loc: `${base}/screenshots/app-live-precinct-map.png`,
          title: 'The Resident Crew Live 3D Precinct Radar Map',
          caption: 'Interactive 3D map of Braamfontein and South African metros with live safety, housing, and nightlife layers.',
        },
        {
          loc: `${base}/screenshots/app-housing-rooms.png`,
          title: 'The Resident Crew Rooms & Student Housing Hub',
          caption: 'Search zero-broker rooms, roommates, and statutory Rental Housing Act tools.',
        },
        {
          loc: `${base}/screenshots/app-local-services.png`,
          title: 'The Resident Crew Express Bakkie & Local Services Dispatch',
          caption: 'Neighbour-rated moving bakkies, plumbers, electricians, and township trades across South Africa.',
        },
        {
          loc: `${base}/screenshots/app-taxi-ranks.png`,
          title: 'The Resident Crew Minibus Taxi Ranks, ZAR Fares & Hand Signals',
          caption: 'SANTACO taxi rank corridors, platform bays, ZAR fares, and commuter hand signals directory.',
        },
      ],
    },
    {
      loc: `${base}/founder`,
      images: [
        ...FOUNDER_IMAGES.map(img => ({
          loc: `${base}${img.path}`,
          title: img.title,
          caption: img.caption,
        })),
        {
          loc: `${base}/founder/portrait.png`,
          title: 'Asemahle TEARN Nkwali Editorial Portrait',
          caption: 'Editorial portrait generated for The Resident Crew & TEARN Ventures.',
        },
        {
          loc: `${base}/screenshots/app-founder-ceo.png`,
          title: 'The Resident Crew — Founder & CEO Profile View',
          caption: 'Production screenshot of /founder profile page.',
        },
      ],
    },
    {
      loc: `${base}/press`,
      images: [
        {
          loc: `${base}/flyer/the-resident-crew-official-flyer.png`,
          title: 'The Resident Crew Promotional Flyer (Obsidian Gold A4)',
          caption: 'High-resolution print and digital flyer with brand logo, Rental Housing Act deposit escrow, and 5-second panic SOS.',
        },
        {
          loc: `${base}/flyer/the-resident-crew-flyer-campus-cyber.png`,
          title: 'The Resident Crew Campus Cyber Edition Simulation Flyer',
          caption: 'Cyber Crimson student and campus room flyer with uncapped fiber WiFi, lockable rooms, and late-night campus walk SOS.',
        },
        {
          loc: `${base}/flyer/the-resident-crew-flyer-executive-glass.png`,
          title: 'The Resident Crew Executive Glass Edition Simulation Flyer',
          caption: 'Liquid Glass daylight executive flyer featuring statutory Rental Housing Act deposit escrow and walk-to-office hubs.',
        },
        {
          loc: `${base}/flyer/the-resident-crew-flyer-precinct-emerald.png`,
          title: 'The Resident Crew Precinct Radar Edition Simulation Flyer',
          caption: 'Emerald Mint transit flyer with minibus taxi rank directories, loadshedding blackout radar, and street panic SOS.',
        },
        {
          loc: `${base}/flyer/the-resident-crew-flyer-midnight-trust.png`,
          title: 'The Resident Crew Midnight Trust Edition Simulation Flyer',
          caption: 'Midnight Lavender property owner flyer featuring 0% listing fees, Next-of-Kin tenant vetting, and Section 5 leases.',
        },
        {
          loc: `${base}/logo.png`,
          title: 'The Resident Crew Brand Mark (512x512 PNG)',
          caption: 'Press logo for The Resident Crew and TEARN Ventures.',
        },
        {
          loc: `${base}/opengraph-image`,
          title: 'The Resident Crew Press Banner',
          caption: 'The Resident Crew product preview for journalists and media outlets.',
        },
        {
          loc: `${base}/screenshots/ad-the-gruvs-1200x630.png`,
          title: 'The Resident Crew x The Gruvs 1200x630 Cross-Promo Banner',
          caption: 'Promotional banner showcasing Live Precinct Map, Taxi Fares, and Zero-Broker Rooms for The Gruvs.',
        },
        {
          loc: `${base}/screenshots/ad-excellency-academy-1200x630.png`,
          title: 'The Resident Crew x Excellency Academy 1200x630 Cross-Promo Banner',
          caption: 'Promotional banner showcasing Student Rooms and Express Moving Bakkies for Excellency Academy.',
        },
        {
          loc: `${base}/screenshots/app-home-hero.png`,
          title: 'The Resident Crew App Screenshot — Home Hero',
          caption: 'Production screenshot of The Resident Crew landing page.',
        },
        {
          loc: `${base}/screenshots/app-live-precinct-map.png`,
          title: 'The Resident Crew App Screenshot — Live 3D Precinct Radar',
          caption: 'Production screenshot of The Resident Crew interactive 3D precinct radar in Braamfontein.',
        },
        {
          loc: `${base}/screenshots/app-housing-rooms.png`,
          title: 'The Resident Crew App Screenshot — Housing & Roommate Hub',
          caption: 'Production screenshot of The Resident Crew rooms and Rental Housing Act calculator.',
        },
        {
          loc: `${base}/screenshots/app-local-services.png`,
          title: 'The Resident Crew App Screenshot — Express Bakkie & Moving Dispatch',
          caption: 'Production screenshot of The Resident Crew community services and local trades.',
        },
        {
          loc: `${base}/screenshots/app-taxi-ranks.png`,
          title: 'The Resident Crew App Screenshot — Taxi Ranks & ZAR Fares',
          caption: 'Production screenshot of The Resident Crew minibus taxi interchange directory.',
        },
        {
          loc: `${base}/screenshots/app-founder-ceo.png`,
          title: 'The Resident Crew App Screenshot — Founder & CEO Profile',
          caption: 'Production screenshot of the Founder & CEO page for Asemahle TEARN Nkwali.',
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
          caption: 'The Resident Crew connects South African neighbours around housing, safety, and local trade.',
        },
        {
          loc: `${base}/screenshots/app-home-hero.png`,
          title: 'The Resident Crew Platform Overview',
          caption: 'Overview of The Resident Crew housing, safety, and local services marketplace.',
        },
      ],
    },
    {
      loc: `${base}/rooms`,
      images: [
        {
          loc: `${base}/screenshots/app-housing-rooms.png`,
          title: 'The Resident Crew Rooms & Student Housing',
          caption: 'Browse rooms to rent, roommates, and Rental Housing Act tools across South Africa.',
        },
        {
          loc: `${base}/screenshots/ad-excellency-academy-1200x630.png`,
          title: 'Student Rooms & Moving Bakkies Banner',
          caption: 'Zero-broker student accommodation near Wits, UJ, UP, and TVET campuses.',
        },
      ],
    },
    {
      loc: `${base}/campus`,
      images: [
        {
          loc: `${base}/screenshots/app-housing-rooms.png`,
          title: 'Student Accommodation Near South African Universities',
          caption: 'Digs near Wits Braamfontein, UJ Auckland Park, UP Hatfield, UCT Rondebosch, and Stellenbosch.',
        },
        {
          loc: `${base}/screenshots/ad-excellency-academy-1200x630.png`,
          title: 'The Resident Crew x Excellency Academy Student Housing Banner',
          caption: 'Cross-platform campaign banner helping university learners find rooms without broker scams.',
        },
      ],
    },
    {
      loc: `${base}/services`,
      images: [
        {
          loc: `${base}/screenshots/app-local-services.png`,
          title: 'The Resident Crew Local Services & Express Bakkie Dispatch',
          caption: 'Find neighbour-rated plumbers, electricians, movers, and cleaning services.',
        },
      ],
    },
    {
      loc: `${base}/taxi-ranks`,
      images: [
        {
          loc: `${base}/screenshots/app-taxi-ranks.png`,
          title: 'South African Minibus Taxi Ranks, ZAR Fares & Hand Signals',
          caption: 'SANTACO taxi interchange guide covering MTN Noord, Bree Street, Baragwanath, Bloed Street, and Cape Town Station Deck.',
        },
      ],
    },
    {
      loc: `${base}/area`,
      images: [
        {
          loc: `${base}/screenshots/app-live-precinct-map.png`,
          title: 'South African Suburbs & Live 3D Precinct Radar',
          caption: 'Explore Braamfontein, Soweto, Hatfield, Maboneng, Auckland Park, and major South African precincts.',
        },
        {
          loc: `${base}/screenshots/ad-the-gruvs-1200x630.png`,
          title: 'The Resident Crew Live Precinct Radar Banner',
          caption: 'Real-time neighbourhood radar, safety alerts, and rooms in South African metros.',
        },
      ],
    },
    {
      loc: `${base}/wards`,
      images: [
        {
          loc: `${base}/screenshots/app-live-precinct-map.png`,
          title: 'Municipal Wards & Infrastructure Fault SLA Map',
          caption: 'Ward substations, bulk reservoirs, and statutory repair windows across South Africa.',
        },
      ],
    },
    {
      loc: `${base}/how-it-works`,
      images: [
        {
          loc: `${base}/screenshots/app-home-hero.png`,
          title: 'How The Resident Crew Works',
          caption: 'Step-by-step guide to joining your South African suburb, finding rooms, and connecting with neighbours.',
        },
        {
          loc: `${base}/logo.png`,
          title: 'The Resident Crew Logo',
          caption: 'The Resident Crew civic community platform emblem.',
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
        caption: `Room listing in ${r.suburb || 'South Africa'} on The Resident Crew.`,
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
