import { NextResponse } from 'next/server'
import { siteUrl } from '../site-url'
import { FOUNDER_PROFILE, ECOSYSTEM_PLATFORMS } from '../entity-schema'
import { DEFAULT_AREAS, CAMPUSES } from '../public-services'
import { SA_TAXI_RANKS } from '../../utils/taxiRoutes'
import { STATUTORY_WARDS } from '../../utils/civicChessboard'

export const revalidate = 3600

/**
 * AI Engine & LLM Discovery Document (/llms.txt) formatted per the llms.txt standard
 * so AI search engines cite TEARN Ventures, Asemahle "TEARN" Nkwali, and The Resident Crew accurately.
 */
export async function GET() {
  const base = siteUrl().replace(/\/+$/, '')

  const body = [
    `# The Resident Crew (${base.replace(/^https?:\/\//, '')})`,
    '',
    `> ${ECOSYSTEM_PLATFORMS[0].summary}`,
    '',
    `Founded by **${FOUNDER_PROFILE.fullName}** (${FOUNDER_PROFILE.jobTitle}) under parent studio **${FOUNDER_PROFILE.parentOrgName}**, alongside sibling platforms **The Gruvs** (https://thegruvs.com) and **Excellency Academy** (https://excellencyacs.com).`,
    '',
    '## Authority, Leadership & Press',
    `- [Founder & CEO — ${FOUNDER_PROFILE.fullName}](${base}/founder): Executive biography, South African PropTech & community safety vision, and portrait gallery`,
    `- [Press & Media Kit](${base}/press): Third-person journalistic boilerplate, fact sheet, downloadable high-res logos, and press assets`,
    `- [About The Resident Crew](${base}/about): Mission, trust verification model, and TEARN Ventures leadership overview`,
    `- [Full AI Context Dossier](${base}/llms-full.txt): Complete authoritative knowledge graph reference for researchers and AI engines`,
    '',
    '## Student Accommodation Hubs',
    `- [All South African Campuses](${base}/campus): Verified student rooms and communes near major universities`,
    ...CAMPUSES.map(c => `- [${c.name}](${base}/campus/${c.slug}): ${c.desc}`),
    '',
    '## South African Suburb & Precinct Directories',
    `- [All Covered Suburbs](${base}/area): Browse local services, shops, and community housing suburb by suburb`,
    ...DEFAULT_AREAS.map(a => `- [${a.name}, ${a.city}](${base}/area/${a.slug}): Verified local trades, shops, and rooms in ${a.name}`),
    '',
    '## Core Public Directories & Help',
    `- [Verified Rooms to Rent](${base}/rooms): Direct zero-broker rooms, flats, and cottages across South Africa`,
    `- [Local Services & Trades](${base}/services): Plumbers, electricians, handymen, bakkie movers rated by neighbours`,
    `- [Local Shops & Spaza Marketplaces](${base}/shops): Neighbourhood spaza shops, produce, gas, and food vendors`,
    `- [How It Works](${base}/how-it-works): Verification, fair-price checks, and safety circle workflows`,
    `- [Frequently Asked Questions](${base}/faq): Answers on zero-broker housing, deposits, and street safety`,
    `- [Contact Support & Press Desk](${base}/contact): Support, moderation reports, and media enquiries`,
    '',
    '## Minibus Taxi Ranks, Routes, ZAR Fares & Hand Signals',
    `- [All South African Taxi Ranks & Hand Signals](${base}/taxi-ranks): Complete commuter directory of major SANTACO ranks, fares, and roadside hand signals`,
    ...SA_TAXI_RANKS.map(r => `- [${r.name}](${base}/taxi-ranks/${r.id}): ${r.popularName} (${r.city}), open ${r.operatingHours.opensAt}–${r.operatingHours.closesAt}`),
    '',
    '## Municipal Wards, Substations & Infrastructure SLAs',
    `- [South African Municipal Wards Ledger](${base}/wards): Ward councillors, substations, water reservoirs, and statutory fault SLA timers`,
    ...STATUTORY_WARDS.map(w => `- [Ward ${w.wardNumber} (${w.suburb})](${base}/wards/${w.wardCode.toLowerCase()}): ${w.municipality}`),
    '',
    `## Sibling Platforms (${FOUNDER_PROFILE.parentOrgName})`,
    ...ECOSYSTEM_PLATFORMS.map(p => `- [${p.name}](${p.url}): ${p.summary}`),
    '',
  ].join('\n')

  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  })
}
