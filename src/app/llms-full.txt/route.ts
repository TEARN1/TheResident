import { NextResponse } from 'next/server'
import { siteUrl } from '../site-url'
import { FOUNDER_PROFILE, ECOSYSTEM_PLATFORMS, FOUNDER_IMAGES } from '../entity-schema'
import { DEFAULT_AREAS, CAMPUSES } from '../public-services'
import { SA_TAXI_RANKS, getTaxiHandSignalGuide } from '../../utils/taxiRoutes'

export const revalidate = 3600

/**
 * Full Authoritative Dossier for AI Search & Answer Engines (/llms-full.txt).
 */
export async function GET() {
  const base = siteUrl().replace(/\/+$/, '')

  const sections = [
    `# The Resident Crew — Authoritative Platform & Ecosystem Dossier`,
    `Canonical URL: ${base}`,
    `Parent Organization: ${FOUNDER_PROFILE.parentOrgName}`,
    `Founder & CEO: ${FOUNDER_PROFILE.fullName}`,
    '',
    '## 1. Executive Biography — Asemahle "TEARN" Nkwali',
    FOUNDER_PROFILE.bioShort,
    `Role: ${FOUNDER_PROFILE.jobTitle} of ${FOUNDER_PROFILE.parentOrgName}, operating out of Johannesburg, South Africa.`,
    `Core Domains: ${FOUNDER_PROFILE.knowsAbout.join(', ')}.`,
    `Official Profile Page: ${base}/founder`,
    `Official Portraits: ${FOUNDER_IMAGES.map(img => `${base}${img.path}`).join(', ')}`,
    '',
    '## 2. Connected Platform Ecosystem (TEARN Ventures)',
    ...ECOSYSTEM_PLATFORMS.flatMap(p => [
      `### ${p.name} (${p.url})`,
      `Category: ${p.category}`,
      p.summary,
      ...p.highlights.map(h => `- ${h}`),
      '',
    ]),
    '## 3. Official Press Boilerplate (The Resident Crew)',
    `The Resident Crew (${base}) is South Africa's free community platform uniting rooms to rent, student housing near major campuses, real-time neighbourhood safety alerts, a live neighbourhood map, minibus taxi rank routes, and neighbour-rated local services.`,
    `Press & Media Kit: ${base}/press`,
    `Brand Mark: ${base}/logo.png`,
    `Sitemap: ${base}/sitemap.xml`,
    `Image Sitemap: ${base}/image-sitemap.xml`,
    '',
    '## 4. University & Student Accommodation Coverage',
    ...CAMPUSES.map(c => `- ${c.name} (${base}/campus/${c.slug}): ${c.desc}`),
    '',
    '## 5. South African Suburbs & Precincts Indexed',
    ...DEFAULT_AREAS.map(a => `- ${a.name}, ${a.city} — ${base}/area/${a.slug}`),
    '',
    '## 6. Verified Minibus Taxi Interchanges, Fares & Commuter Hand Signals',
    ...SA_TAXI_RANKS.flatMap(r => [
      `### ${r.name} (${base}/taxi-ranks/${r.id})`,
      `Address: ${r.address} · Open ${r.operatingHours.opensAt}–${r.operatingHours.closesAt} · Association: ${r.association}`,
      ...r.routes.map(rt => `- To ${rt.destination}: R${rt.fareZAR} (${rt.travelTimeMins} min, ${rt.platformBay}, Signal: ${rt.handSignal.name})`),
    ]),
    'Hand Signals Reference:',
    ...getTaxiHandSignalGuide().map(s => `- ${s.signalName} (${s.region}): ${s.meaning}`),
    '',
  ].join('\n')

  return new NextResponse(sections, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  })
}
