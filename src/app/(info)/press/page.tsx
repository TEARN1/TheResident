import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import styles from '../info.module.css'
import { Breadcrumbs, JsonLd } from '../directory-views'
import { siteUrl } from '../../site-url'
import { FOUNDER_PROFILE, ECOSYSTEM_PLATFORMS, FOUNDER_IMAGES } from '../../entity-schema'

const base = siteUrl()
const contactEmail = process.env.NEXT_PUBLIC_CONTACT_EMAIL

export const metadata: Metadata = {
  title: 'Press & Media Kit | The Resident Crew & TEARN Ventures',
  description:
    'Official press boilerplate, founder biography for Asemahle "TEARN" Nkwali, downloadable high-resolution logos, platform fact sheet, and media resources for The Resident Crew.',
  alternates: { canonical: '/press' },
  openGraph: {
    type: 'website',
    title: 'Press & Media Kit | The Resident Crew & TEARN Ventures',
    description:
      'Official journalistic boilerplate, executive biography, brand assets, and fact sheet for The Resident Crew, founded by Asemahle "TEARN" Nkwali.',
    url: `${base}/press`,
    images: [
      {
        url: '/press/opengraph-image',
        width: 1200,
        height: 630,
        alt: 'The Resident Crew Press & Media Kit',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Press & Media Kit | The Resident Crew & TEARN Ventures',
    description:
      'Official journalistic boilerplate, executive biography, brand assets, and fact sheet for The Resident Crew, founded by Asemahle "TEARN" Nkwali.',
    images: ['/press/opengraph-image'],
  },
}

export default function PressPage() {
  const currentBase = siteUrl()
  const pressJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': `${currentBase}/press#webpage`,
    url: `${currentBase}/press`,
    name: 'Press & Media Kit — The Resident Crew & TEARN Ventures',
    description:
      'Official media kit, boilerplate descriptions, brand assets, and executive bio for journalists covering The Resident Crew and TEARN Ventures.',
    dateModified: '2026-11-15',
    isPartOf: { '@id': `${currentBase}/#website` },
    about: { '@id': `${currentBase}/#parent-org` },
    mainEntity: { '@id': `${currentBase}/#app` },
    speakable: {
      '@type': 'SpeakableSpecification',
      cssSelector: ['h1', 'h2', 'p'],
    },
  }

  return (
    <article>
      <Breadcrumbs
        trail={[
          { name: 'Home', href: '/' },
          { name: 'Press & Media', href: '/press' },
        ]}
      />
      <JsonLd data={pressJsonLd} />

      <header style={{ marginBottom: '2rem' }}>
        <p className={styles.updated} style={{ textTransform: 'uppercase', letterSpacing: '1.5px', fontWeight: 700, color: 'var(--gold-primary)', opacity: 0.85 }}>
          Official Media Resources · Johannesburg, South Africa
        </p>
        <h1>Press &amp; Media Kit</h1>
        <p className={styles.lede}>
          Official third-person boilerplate descriptions, executive background, downloadable logos, and visual assets for
          journalists, analysts, and partners covering <strong>The Resident Crew</strong> and{' '}
          <strong>{FOUNDER_PROFILE.parentOrgName}</strong>.
        </p>
      </header>

      <section aria-labelledby="about-resident-heading">
        <h2 id="about-resident-heading">About The Resident Crew (Official Boilerplate)</h2>
        <p>
          <strong>The Resident Crew</strong> (<a href="https://theresidentcrew.com">theresidentcrew.com</a>) is a free
          South African community platform built to connect neighbours around verified accommodation, real-time safety
          alerts, and trusted local services. Designed for high-density urban suburbs and university corridors such as
          Braamfontein, Auckland Park, Soweto, Hatfield, Pretoria CBD, and Cottesloe, the platform removes predatory
          rental middlemen by connecting tenants directly with landlords while providing fair-price rent checks,
          a live neighbourhood map, minibus taxi routes, and neighbour-rated artisans and spaza shops.
        </p>
      </section>

      <section aria-labelledby="about-founder-heading">
        <h2 id="about-founder-heading">About the Founder (Official Boilerplate)</h2>
        <p>
          <strong>{FOUNDER_PROFILE.fullName}</strong> is the Founder and Chief Executive Officer of{' '}
          <strong>{FOUNDER_PROFILE.parentOrgName}</strong>, a South African technology studio behind a connected
          ecosystem of consumer and community platforms. Prioritizing reliability in bandwidth-constrained environments,
          Nkwali architected <Link href="/">The Resident Crew</Link>, verified event discovery platform{' '}
          <a href="https://thegruvs.com" target="_blank" rel="noopener noreferrer">
            The Gruvs
          </a>
          , and workplace spreadsheet training platform{' '}
          <a href="https://excellencyacs.com" target="_blank" rel="noopener noreferrer">
            Excellency Academy
          </a>{' '}
          to operate together under one cohesive leadership and infrastructure strategy. Read the full{' '}
          <Link href="/founder">Founder &amp; CEO profile</Link>.
        </p>
      </section>

      <section aria-labelledby="factsheet-heading">
        <h2 id="factsheet-heading">Platform Fact Sheet</h2>
        <ul>
          <li><strong>Platform Name:</strong> The Resident Crew (also known as The Resident)</li>
          <li><strong>Parent Studio:</strong> {FOUNDER_PROFILE.parentOrgName}</li>
          <li><strong>Founder &amp; CEO:</strong> {FOUNDER_PROFILE.fullName}</li>
          <li><strong>Primary Markets:</strong> Johannesburg (Braamfontein, Auckland Park, Soweto, Cottesloe, Midrand, Sandton), Pretoria (Hatfield, Sunnyside, Pretoria CBD, Mamelodi), Cape Town (Rondebosch, Stellenbosch, Bellville), Durban, Gqeberha, Bloemfontein</li>
          <li><strong>Core Capabilities:</strong> Zero-broker rooms &amp; student accommodation, Rental Housing Act tools, 5-second grace panic beacon &amp; trust circles, live neighbourhood map &amp; minibus taxi rank routes, neighbour-rated tradespeople &amp; local spaza shops</li>
          <li><strong>Availability:</strong> Web, Progressive Web App (PWA), Android APK, and iOS Web App — free for residents</li>
          <li><strong>Sibling Platforms:</strong> {ECOSYSTEM_PLATFORMS.filter(p => p.key !== 'resident').map(p => `${p.name} (${p.url.replace('https://', '')})`).join(' · ')}</li>
        </ul>
      </section>

      <section aria-labelledby="assets-heading">
        <h2 id="assets-heading">Downloadable Brand Assets &amp; Press Visuals</h2>
        <p>Media outlets may reproduce the assets below when reporting on The Resident Crew, {FOUNDER_PROFILE.parentOrgName}, or {FOUNDER_PROFILE.fullName}:</p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginTop: '1rem' }}>
          <figure style={{ margin: 0, padding: '14px', borderRadius: '12px', border: '1px solid var(--glass-border)', background: 'var(--card-bg)' }}>
            <Image
              src="/logo.png"
              alt="The Resident Crew official square brand mark (512x512 PNG)"
              width={256}
              height={256}
              style={{ width: '96px', height: '96px', borderRadius: '12px', display: 'block' }}
            />
            <figcaption style={{ fontSize: '0.85rem', marginTop: '10px' }}>
              <strong>Official Brand Logo</strong><br />
              <a href="/logo.png" download="the-resident-crew-logo.png">Download High-Res PNG (512×512)</a>
            </figcaption>
          </figure>

          <figure style={{ margin: 0, padding: '14px', borderRadius: '12px', border: '1px solid var(--glass-border)', background: 'var(--card-bg)' }}>
            <Image
              src="/opengraph-image"
              alt="The Resident Crew social and product banner preview (1200x630)"
              width={1200}
              height={630}
              unoptimized
              style={{ width: '100%', height: 'auto', borderRadius: '8px', display: 'block' }}
            />
            <figcaption style={{ fontSize: '0.85rem', marginTop: '10px' }}>
              <strong>Official Product Banner</strong><br />
              <a href="/opengraph-image" download="the-resident-crew-banner.png">Download Social Banner (1200×630)</a>
            </figcaption>
          </figure>

          {FOUNDER_IMAGES.map(img => (
            <figure key={img.path} style={{ margin: 0, padding: '14px', borderRadius: '12px', border: '1px solid var(--glass-border)', background: 'var(--card-bg)' }}>
              <Image
                src={img.path}
                alt={img.alt}
                width={img.width}
                height={img.height}
                unoptimized={img.path.endsWith('.png')}
                style={{ width: '100%', height: 'auto', borderRadius: '8px', display: 'block' }}
              />
              <figcaption style={{ fontSize: '0.85rem', marginTop: '10px' }}>
                <strong>{img.title}</strong><br />
                <a href={img.path} download>Download Press Asset</a>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section aria-labelledby="screenshots-heading">
        <h2 id="screenshots-heading">App Screenshots &amp; Ecosystem Cross-Promo Ad Creatives</h2>
        <p>
          High-resolution product screenshots and ready-to-run 1200×630 campaign banners for editorial coverage and
          sibling platform promotions across <strong>The Gruvs</strong> and <strong>Excellency Academy</strong>:
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px', marginTop: '1rem' }}>
          {[
            {
              src: '/flyer/the-resident-crew-official-flyer.png',
              width: 1200,
              height: 1680,
              title: 'Official Print & Digital Flyer: Obsidian Gold Brand Edition (A4)',
              alt: 'Official high-resolution marketing flyer for The Resident Crew with logo, verified rooms, Rental Housing Act deposit tools, and 5-second panic SOS',
              download: 'the-resident-crew-official-flyer.png',
            },
            {
              src: '/flyer/the-resident-crew-flyer-campus-cyber.png',
              width: 1200,
              height: 1680,
              title: 'Simulation Flyer: Campus Cyber Edition (Student Rooms & Communes)',
              alt: 'Student and campus verified room flyer featuring uncapped fiber WiFi, lockable rooms, and late-night campus walk SOS',
              download: 'the-resident-crew-flyer-campus-cyber.png',
            },
            {
              src: '/flyer/the-resident-crew-flyer-executive-glass.png',
              width: 1200,
              height: 1680,
              title: 'Simulation Flyer: Executive Glass Edition (Urban Professionals)',
              alt: 'Daylight liquid glass executive flyer featuring statutory Rental Housing Act deposit escrow and walk-to-office hubs',
              download: 'the-resident-crew-flyer-executive-glass.png',
            },
            {
              src: '/flyer/the-resident-crew-flyer-precinct-emerald.png',
              width: 1200,
              height: 1680,
              title: 'Simulation Flyer: Precinct Radar Edition (Transit & Townships)',
              alt: 'Emerald mint transit flyer featuring minibus taxi rank directories, loadshedding blackout radar, and street panic SOS',
              download: 'the-resident-crew-flyer-precinct-emerald.png',
            },
            {
              src: '/flyer/the-resident-crew-flyer-midnight-trust.png',
              width: 1200,
              height: 1680,
              title: 'Simulation Flyer: Midnight Trust Edition (Landlords & Owners)',
              alt: 'Midnight lavender property owner flyer featuring 0% listing fees, Next-of-Kin tenant vetting, and Section 5 leases',
              download: 'the-resident-crew-flyer-midnight-trust.png',
            },
            {
              src: '/screenshots/ad-the-gruvs-1200x630.png',
              width: 1200,
              height: 630,
              title: 'Ad Banner: The Resident Crew × The Gruvs (1200×630)',
              alt: 'The Resident Crew cross-promo ad banner for The Gruvs showcasing the live 3D precinct map and minibus taxi fares',
              download: 'the-resident-crew-ad-the-gruvs-1200x630.png',
            },
            {
              src: '/screenshots/ad-excellency-academy-1200x630.png',
              width: 1200,
              height: 630,
              title: 'Ad Banner: The Resident Crew × Excellency Academy (1200×630)',
              alt: 'The Resident Crew cross-promo ad banner for Excellency Academy showcasing verified student rooms and moving bakkies',
              download: 'the-resident-crew-ad-excellency-academy-1200x630.png',
            },
            {
              src: '/screenshots/app-home-hero.png',
              width: 1024,
              height: 640,
              title: 'App Screenshot: Landing Experience',
              alt: 'The Resident Crew landing screen showing South African rooms, neighbourhood safety alerts, and local services',
              download: 'the-resident-crew-home-hero.png',
            },
            {
              src: '/screenshots/app-live-precinct-map.png',
              width: 873,
              height: 822,
              title: 'App Screenshot: Live 3D Precinct Radar (Braamfontein)',
              alt: 'Live 3D precinct radar map of Braamfontein displaying nightlife, rooms, and traffic layers',
              download: 'the-resident-crew-live-precinct-map.png',
            },
            {
              src: '/screenshots/app-housing-rooms.png',
              width: 873,
              height: 822,
              title: 'App Screenshot: Verified Rooms & Rental Tools',
              alt: 'The Resident Crew housing hub showing rooms, roommates, Rental Housing Act tools, and suburb search filters',
              download: 'the-resident-crew-housing-rooms.png',
            },
            {
              src: '/screenshots/app-local-services.png',
              width: 873,
              height: 822,
              title: 'App Screenshot: Express Bakkie & Moving Dispatch',
              alt: 'The Resident Crew community services view featuring express moving bakkies and local trades',
              download: 'the-resident-crew-local-services.png',
            },
            {
              src: '/screenshots/app-taxi-ranks.png',
              width: 873,
              height: 822,
              title: 'App Screenshot: Minibus Taxi Ranks, ZAR Fares & Hand Signals',
              alt: 'South African minibus taxi rank directory showing MTN Noord bays, ZAR fares, and commuter hand signals',
              download: 'the-resident-crew-taxi-ranks.png',
            },
            {
              src: '/screenshots/app-founder-ceo.png',
              width: 873,
              height: 822,
              title: 'App Screenshot: Founder & CEO Profile',
              alt: 'The Resident Crew Founder and CEO profile page for Asemahle TEARN Nkwali and TEARN Ventures',
              download: 'the-resident-crew-founder-profile.png',
            },
          ].map(asset => (
            <figure key={asset.src} style={{ margin: 0, padding: '14px', borderRadius: '12px', border: '1px solid var(--glass-border)', background: 'var(--card-bg)' }}>
              <Image
                src={asset.src}
                alt={asset.alt}
                width={asset.width}
                height={asset.height}
                unoptimized
                style={{ width: '100%', height: 'auto', borderRadius: '8px', display: 'block' }}
              />
              <figcaption style={{ fontSize: '0.85rem', marginTop: '10px' }}>
                <strong>{asset.title}</strong><br />
                <a href={asset.src} download={asset.download}>Download PNG ({asset.width}×{asset.height})</a>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section aria-labelledby="press-contact-heading" className={styles.cta}>
        <h2 id="press-contact-heading" style={{ marginTop: 0 }}>Media &amp; Press Enquiries</h2>
        <p>
          For interviews with <strong>{FOUNDER_PROFILE.fullName}</strong>, podcast appearances, PropTech commentary, or
          official statements regarding {FOUNDER_PROFILE.parentOrgName}:
        </p>
        {contactEmail ? (
          <p style={{ marginBottom: 0 }}>
            Press &amp; Support Desk: <a href={`mailto:${contactEmail}`}>{contactEmail}</a> · Or use the{' '}
            <Link href="/contact">Contact page</Link>.
          </p>
        ) : (
          <p style={{ marginBottom: 0 }}>
            Reach the team via our <Link href="/contact">Contact page</Link> or connect via our official X channel{' '}
            <a href="https://twitter.com/TheResidentCrew" target="_blank" rel="noopener noreferrer">
              @TheResidentCrew
            </a>
            .
          </p>
        )}
      </section>
    </article>
  )
}
