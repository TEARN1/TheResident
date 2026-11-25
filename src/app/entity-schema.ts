export interface EcosystemPlatform {
  key: 'resident' | 'gruvs' | 'excellency'
  name: string
  url: string
  category: string
  summary: string
  highlights: string[]
}

export interface FounderImageAsset {
  path: string
  title: string
  alt: string
  caption: string
  width: number
  height: number
}

export const FOUNDER_PROFILE = {
  fullName: 'Asemahle "TEARN" Nkwali',
  legalName: 'Asemahle Nkwali',
  alias: 'TEARN',
  givenName: 'Asemahle',
  familyName: 'Nkwali',
  jobTitle: 'Founder & CEO',
  parentOrgName: 'TEARN Ventures',
  parentOrgAlternates: ['The Resident Crew', 'TEARN Studio'],
  bioShort:
    'Asemahle "TEARN" Nkwali is a South African technology entrepreneur and the Founder & CEO of TEARN Ventures, leading a connected ecosystem of platforms including The Resident Crew, The Gruvs, and Excellency Academy.',
  knowsAbout: [
    'PropTech',
    'Community Safety',
    'South African Real Estate',
    'Local Services Marketplace',
    'Enterprise Software',
  ],
  sameAs: [
    'https://theresidentcrew.com/founder',
    'https://thegruvs.com',
    'https://excellencyacs.com',
    'https://twitter.com/TheResidentCrew',
    'https://facebook.com/TheResidentCrew',
  ],
} as const

export const ECOSYSTEM_PLATFORMS: readonly EcosystemPlatform[] = [
  {
    key: 'resident',
    name: 'The Resident Crew',
    url: 'https://theresidentcrew.com',
    category: 'PropTech, Neighbourhood Safety & Local Commerce',
    summary:
      "South Africa's free community platform for rooms to rent, student housing, real-time neighbourhood safety alerts, a live neighbourhood map, and neighbour-rated local services.",
    highlights: [
      'Direct zero-broker room and student accommodation discovery with fair-price checks',
      '5-second grace panic beacon, trust circles, and ward-level Community Police Forum integration',
      'Live neighbourhood map with minibus taxi rank routes and road closure reports',
      'Neighbour-rated artisans, plumbers, electricians, bakkie transport, and local spaza shops',
    ],
  },
  {
    key: 'gruvs',
    name: 'The Gruvs',
    url: 'https://thegruvs.com',
    category: 'Live Events & Cultural Discovery',
    summary:
      'Real events near you — big names and local shows with authentic posters and sources, opening straight in the browser with zero install friction.',
    highlights: [
      'Live event discovery anchored by real venue coordinates across South Africa',
      'Touch Down attendance verification connecting real-world crowds with the resident ecosystem',
    ],
  },
  {
    key: 'excellency',
    name: 'Excellency Academy',
    url: 'https://excellencyacs.com',
    category: 'Practical Workplace Spreadsheet Training',
    summary:
      'Hands-on spreadsheet practice on messy workplace data built specifically for South African workplaces, including rand formatting, day-first dates, and local public holidays.',
    highlights: [
      'Instant automated grading on realistic workplace traps and formula challenges',
      'Accessible directly in the browser with zero setup required for South African job seekers and teams',
    ],
  },
] as const

export const FOUNDER_IMAGES: readonly FounderImageAsset[] = [
  {
    path: '/founder/asemahle-tearn-nkwali-ceo-portrait.jpg',
    title: 'Asemahle "TEARN" Nkwali — Founder & CEO of The Resident Crew & TEARN Ventures',
    alt: 'Asemahle TEARN Nkwali, Founder and CEO of The Resident Crew and TEARN Ventures in South Africa',
    caption: 'Asemahle "TEARN" Nkwali — Founder & Chief Executive Officer of TEARN Ventures (The Resident Crew, The Gruvs, Excellency Academy).',
    width: 768,
    height: 1024,
  },
  {
    path: '/founder/asemahle-nkwali-field-operations-johannesburg.jpg',
    title: 'Asemahle "TEARN" Nkwali — Community Safety & Field Operations in Johannesburg',
    alt: 'Asemahle TEARN Nkwali leading field operations for The Resident Crew in Johannesburg, South Africa',
    caption: 'Asemahle "TEARN" Nkwali on-site during field verification and community safety operations in Johannesburg.',
    width: 766,
    height: 1024,
  },
  {
    path: '/founder/asemahle-tearn-nkwali-monochrome-portrait.jpg',
    title: 'Asemahle "TEARN" Nkwali — Executive Monochrome Portrait',
    alt: 'Monochrome portrait of South African software entrepreneur Asemahle TEARN Nkwali, CEO of TEARN Ventures',
    caption: 'Asemahle "TEARN" Nkwali — Software Architect and Founder building connected civic and property infrastructure for South Africa.',
    width: 1024,
    height: 768,
  },
  {
    path: '/founder/asemahle-tearn-nkwali-tembisa-roots.jpg',
    title: 'Asemahle "TEARN" Nkwali — Tembisa Roots & Community Portrait Series',
    alt: 'Portrait series of Asemahle TEARN Nkwali celebrating Tembisa community roots and The Resident Crew origin story',
    caption: 'Tembisa roots portrait collection of Asemahle "TEARN" Nkwali — where The Resident Crew mission began.',
    width: 472,
    height: 792,
  },
  {
    path: '/founder/portrait.png',
    title: 'Asemahle "TEARN" Nkwali — Executive Profile Card (PNG)',
    alt: 'Executive profile card for Asemahle TEARN Nkwali featuring TEARN Ventures ecosystem platforms',
    caption: 'Profile card for Asemahle "TEARN" Nkwali and TEARN Ventures.',
    width: 1200,
    height: 1200,
  },
] as const

/**
 * Builds the root enterprise multi-entity Knowledge Graph (@graph) linking the Founder (#founder),
 * Parent Studio (#parent-org), Application (#app), and WebSite (#website) across the TEARN Ventures ecosystem.
 */
export function buildGlobalKnowledgeGraph(base: string) {
  const cleanBase = base.replace(/\/+$/, '')

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Person',
        '@id': `${cleanBase}/#founder`,
        name: FOUNDER_PROFILE.fullName,
        alternateName: [FOUNDER_PROFILE.legalName, FOUNDER_PROFILE.alias],
        givenName: FOUNDER_PROFILE.givenName,
        familyName: FOUNDER_PROFILE.familyName,
        additionalName: FOUNDER_PROFILE.alias,
        jobTitle: FOUNDER_PROFILE.jobTitle,
        url: `${cleanBase}/founder`,
        image: FOUNDER_IMAGES.map(img => ({
          '@type': 'ImageObject',
          url: `${cleanBase}${img.path}`,
          caption: img.caption,
          width: img.width,
          height: img.height,
        })),
        description: FOUNDER_PROFILE.bioShort,
        mainEntityOfPage: {
          '@id': `${cleanBase}/founder#webpage`,
        },
        knowsAbout: [...FOUNDER_PROFILE.knowsAbout],
        knowsLanguage: ['en-ZA', 'zu-ZA', 'xh-ZA', 'st-ZA'],
        worksFor: {
          '@id': `${cleanBase}/#parent-org`,
        },
        workLocation: {
          '@type': 'Place',
          name: 'Johannesburg, Gauteng, South Africa',
        },
        nationality: {
          '@type': 'Country',
          name: 'South Africa',
        },
        sameAs: [...FOUNDER_PROFILE.sameAs],
      },
      {
        '@type': 'Organization',
        '@id': `${cleanBase}/#parent-org`,
        name: FOUNDER_PROFILE.parentOrgName,
        alternateName: [...FOUNDER_PROFILE.parentOrgAlternates],
        url: cleanBase,
        foundingDate: '2024',
        foundingLocation: {
          '@type': 'Place',
          name: 'Johannesburg, Gauteng, South Africa',
        },
        areaServed: [
          { '@type': 'City', name: 'Johannesburg' },
          { '@type': 'City', name: 'Pretoria' },
          { '@type': 'City', name: 'Cape Town' },
          { '@type': 'City', name: 'Durban' },
          { '@type': 'City', name: 'Gqeberha' },
          { '@type': 'City', name: 'Bloemfontein' },
          { '@type': 'Country', name: 'South Africa' },
        ],
        logo: {
          '@type': 'ImageObject',
          '@id': `${cleanBase}/#logo`,
          url: `${cleanBase}/logo.png`,
          width: 512,
          height: 512,
          caption: 'The Resident Crew Logo',
        },
        founder: {
          '@id': `${cleanBase}/#founder`,
        },
        subOrganization: [
          {
            '@type': 'Organization',
            '@id': `${cleanBase}/#organization`,
            name: 'The Resident Crew',
            url: 'https://theresidentcrew.com',
            founder: {
              '@id': `${cleanBase}/#founder`,
            },
          },
          {
            '@type': 'Organization',
            name: 'The Gruvs',
            url: 'https://thegruvs.com',
            description: "South African event discovery platform.",
            founder: {
              '@id': `${cleanBase}/#founder`,
            },
          },
          {
            '@type': 'EducationalOrganization',
            name: 'Excellency Academy',
            url: 'https://excellencyacs.com',
            description: 'Hands-on spreadsheet practice and workplace digital skills training built for South Africa.',
            founder: {
              '@id': `${cleanBase}/#founder`,
            },
          },
        ],
        owns: [
          {
            '@id': `${cleanBase}/#app`,
          },
          {
            '@type': 'WebApplication',
            name: 'The Gruvs',
            url: 'https://thegruvs.com',
          },
          {
            '@type': 'WebApplication',
            name: 'Excellency Academy',
            url: 'https://excellencyacs.com',
          },
        ],
        contactPoint: {
          '@type': 'ContactPoint',
          contactType: 'customer support',
          url: `${cleanBase}/contact`,
          areaServed: 'ZA',
          availableLanguage: ['English', 'isiZulu', 'Sesotho', 'Afrikaans'],
        },
        sameAs: [
          'https://twitter.com/TheResidentCrew',
          'https://facebook.com/TheResidentCrew',
          'https://thegruvs.com',
          'https://excellencyacs.com',
        ],
      },
      {
        '@type': ['WebApplication', 'SoftwareApplication'],
        '@id': `${cleanBase}/#app`,
        name: 'The Resident Crew',
        alternateName: ['The Resident', 'Resident Crew'],
        url: cleanBase,
        applicationCategory: 'LifestyleApplication',
        operatingSystem: 'Web, Android, iOS',
        screenshot: [
          `${cleanBase}/screenshots/app-home-hero.png`,
          `${cleanBase}/screenshots/app-live-precinct-map.png`,
          `${cleanBase}/screenshots/app-housing-rooms.png`,
          `${cleanBase}/screenshots/app-local-services.png`,
          `${cleanBase}/opengraph-image`,
        ],
        inLanguage: ['en-ZA', 'zu-ZA', 'st-ZA', 'af-ZA'],
        countriesSupported: 'ZA',
        description:
          "South Africa's free community platform for rooms to rent, student housing, real-time neighbourhood safety alerts, a live neighbourhood map, and neighbour-rated local services.",
        featureList: [
          'Zero-broker rooms to rent and student accommodation',
          'Statutory Rental Housing Act deposit calculator and lease tools',
          '5-second grace panic beacon, next-of-kin trust circles, and ward safety alerts',
          'Live neighbourhood map, minibus taxi rank routes, and road closure reports',
          'Neighbour-rated local artisans, handymen, bakkie transport, and spaza shops',
        ],
        creator: {
          '@id': `${cleanBase}/#founder`,
        },
        founder: {
          '@id': `${cleanBase}/#founder`,
        },
        publisher: {
          '@id': `${cleanBase}/#parent-org`,
        },
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'ZAR',
        },
      },
      {
        '@type': 'WebSite',
        '@id': `${cleanBase}/#website`,
        url: cleanBase,
        name: 'The Resident Crew',
        alternateName: ['The Resident', 'Resident Crew', 'The Resident South Africa'],
        description:
          'Rooms to rent, student accommodation, real-time neighbourhood safety alerts, a live neighbourhood map, and local services across South African neighbourhoods.',
        inLanguage: 'en-ZA',
        creator: {
          '@id': `${cleanBase}/#founder`,
        },
        publisher: {
          '@id': `${cleanBase}/#parent-org`,
        },
        copyrightHolder: {
          '@id': `${cleanBase}/#parent-org`,
        },
        hasPart: [
          { '@type': 'CollectionPage', name: 'Rooms to Rent in South Africa', url: `${cleanBase}/rooms` },
          { '@type': 'CollectionPage', name: 'Student Accommodation near Universities', url: `${cleanBase}/campus` },
          { '@type': 'CollectionPage', name: 'South African Suburbs Directory', url: `${cleanBase}/area` },
          { '@type': 'CollectionPage', name: 'Local Services & Trades', url: `${cleanBase}/services` },
          { '@type': 'CollectionPage', name: 'Local Shops & Spaza Marketplaces', url: `${cleanBase}/shops` },
          { '@type': 'CollectionPage', name: 'South African Minibus Taxi Ranks, Fares & Hand Signals', url: `${cleanBase}/taxi-ranks` },
          { '@type': 'ProfilePage', name: 'Asemahle "TEARN" Nkwali — Founder & CEO', url: `${cleanBase}/founder` },
          { '@type': 'WebPage', name: 'Press & Media Kit', url: `${cleanBase}/press` },
        ],
        potentialAction: {
          '@type': 'SearchAction',
          target: {
            '@type': 'EntryPoint',
            urlTemplate: `${cleanBase}/dashboard/housing?q={search_term_string}`,
          },
          'query-input': 'required name=search_term_string',
        },
      },
    ],
  }
}
