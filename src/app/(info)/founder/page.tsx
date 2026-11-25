import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import styles from '../info.module.css'
import { Breadcrumbs, JsonLd } from '../directory-views'
import { siteUrl } from '../../site-url'
import { FOUNDER_PROFILE, ECOSYSTEM_PLATFORMS, FOUNDER_IMAGES } from '../../entity-schema'

const base = siteUrl()

export const metadata: Metadata = {
  title: 'Asemahle "TEARN" Nkwali — Founder & CEO of The Resident Crew & TEARN Ventures',
  description:
    'Executive biography and vision of Asemahle "TEARN" Nkwali, Founder & CEO of TEARN Ventures, The Resident Crew, The Gruvs, and Excellency Academy.',
  alternates: { canonical: '/founder' },
  openGraph: {
    type: 'profile',
    firstName: FOUNDER_PROFILE.givenName,
    lastName: FOUNDER_PROFILE.familyName,
    username: FOUNDER_PROFILE.alias,
    title: 'Asemahle "TEARN" Nkwali — Founder & CEO of The Resident Crew & TEARN Ventures',
    description: FOUNDER_PROFILE.bioShort,
    url: `${base}/founder`,
    images: [
      {
        url: '/founder/opengraph-image',
        width: 1200,
        height: 630,
        alt: FOUNDER_IMAGES[0].alt,
      },
      {
        url: FOUNDER_IMAGES[0].path,
        width: FOUNDER_IMAGES[0].width,
        height: FOUNDER_IMAGES[0].height,
        alt: FOUNDER_IMAGES[0].alt,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Asemahle "TEARN" Nkwali — Founder & CEO | TEARN Ventures',
    description: FOUNDER_PROFILE.bioShort,
    images: ['/founder/opengraph-image', FOUNDER_IMAGES[0].path],
  },
}

export default function FounderPage() {
  const currentBase = siteUrl()
  const profileJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ProfilePage',
    '@id': `${currentBase}/founder#webpage`,
    url: `${currentBase}/founder`,
    name: `Founder & CEO — ${FOUNDER_PROFILE.fullName}`,
    description: FOUNDER_PROFILE.bioShort,
    dateModified: '2026-11-15',
    isPartOf: { '@id': `${currentBase}/#website` },
    mainEntity: { '@id': `${currentBase}/#founder` },
    about: { '@id': `${currentBase}/#parent-org` },
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
          { name: 'Founder & CEO', href: '/founder' },
        ]}
      />
      <JsonLd data={profileJsonLd} />

      <header style={{ marginBottom: '2rem', display: 'flex', flexWrap: 'wrap', gap: '24px', alignItems: 'center' }}>
        <div style={{ flex: '1 1 320px' }}>
          <p className={styles.updated} style={{ textTransform: 'uppercase', letterSpacing: '1.5px', fontWeight: 700, opacity: 0.85, color: 'var(--gold-primary)' }}>
            {FOUNDER_PROFILE.jobTitle} · {FOUNDER_PROFILE.parentOrgName}
          </p>
          <h1>{FOUNDER_PROFILE.fullName}</h1>
          <p className={styles.lede} style={{ marginBottom: 0 }}>{FOUNDER_PROFILE.bioShort}</p>
        </div>
        <figure style={{ margin: 0, width: '180px', flexShrink: 0 }}>
          <Image
            src={FOUNDER_IMAGES[0].path}
            alt={FOUNDER_IMAGES[0].alt}
            width={FOUNDER_IMAGES[0].width}
            height={FOUNDER_IMAGES[0].height}
            priority
            style={{
              width: '180px',
              height: '240px',
              objectFit: 'cover',
              borderRadius: '16px',
              border: '2px solid var(--gold-primary)',
              display: 'block',
            }}
          />
        </figure>
      </header>

      <section aria-labelledby="bio-heading">
        <h2 id="bio-heading">Executive Biography</h2>
        <p>
          <strong>{FOUNDER_PROFILE.fullName}</strong> is a South African software architect and entrepreneur focused on
          building practical civic, property, cultural, and workplace platforms tailored to South African daily life.
          As the Founder and Chief Executive Officer of <strong>{FOUNDER_PROFILE.parentOrgName}</strong>, Nkwali directs
          product architecture and engineering across three interconnected web and mobile platforms:{' '}
          <Link href="/">The Resident Crew</Link>,{' '}
          <a href="https://thegruvs.com" target="_blank" rel="noopener noreferrer">
            The Gruvs
          </a>
          , and{' '}
          <a href="https://excellencyacs.com" target="_blank" rel="noopener noreferrer">
            Excellency Academy
          </a>
          .
        </p>
        <p>
          Rather than building isolated consumer utilities, Nkwali designed the {FOUNDER_PROFILE.parentOrgName}{' '}
          ecosystem so neighbourhood housing, street-level safety, local commerce, live events, and workplace
          upskilling reinforce one another through shared trust and real-world accountability.
        </p>
      </section>

      <section aria-labelledby="vision-heading">
        <h2 id="vision-heading">Vision for Safer South African Neighbourhoods &amp; Transparent Housing</h2>
        <p>
          Across Johannesburg, Pretoria, Cape Town, and Durban, students and young professionals searching for a room to
          rent frequently face opaque rental pricing, unverified listings, and middleman fees, while vital street-level
          information—trusted artisans, local spaza shops, taxi rank schedules, and safety warnings—remains fragmented
          across private chat groups.
        </p>
        <p>
          Nkwali built <Link href="/">The Resident Crew</Link> to unify those daily realities into one high-trust public
          layer: direct landlord-to-tenant communication with zero broker fees, statutory protections aligned with South
          Africa&apos;s Rental Housing Act, 5-second grace panic beacons backed by trusted neighbours, and a live
          neighbourhood map built to work on low data.
        </p>
      </section>

      <section aria-labelledby="portfolio-heading">
        <h2 id="portfolio-heading">Connected Ecosystem — {FOUNDER_PROFILE.parentOrgName}</h2>
        <p>
          Under <strong>{FOUNDER_PROFILE.parentOrgName}</strong>, three specialized platforms operate together to serve
          South African residents, venues, and workplaces:
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '1rem' }}>
          {ECOSYSTEM_PLATFORMS.map(platform => (
            <section
              key={platform.key}
              style={{
                padding: '20px',
                borderRadius: '12px',
                border: '1px solid var(--glass-border)',
                background: 'var(--card-bg)',
              }}
            >
              <h3 style={{ marginTop: 0 }}>
                <a href={platform.url} target="_blank" rel="noopener noreferrer">
                  {platform.name}
                </a>{' '}
                <span style={{ fontSize: '0.85rem', fontWeight: 500, opacity: 0.7 }}>({platform.category})</span>
              </h3>
              <p style={{ marginBottom: '0.6rem' }}>{platform.summary}</p>
              <ul style={{ marginBottom: 0 }}>
                {platform.highlights.map(item => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </section>

      <section aria-labelledby="expertise-heading">
        <h2 id="expertise-heading">Core Focus Areas</h2>
        <ul>
          {FOUNDER_PROFILE.knowsAbout.map(topic => (
            <li key={topic}>{topic}</li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="gallery-heading">
        <h2 id="gallery-heading">Portraits &amp; Platform Visuals</h2>
        <p>
          Media assets representing {FOUNDER_PROFILE.fullName}, {FOUNDER_PROFILE.parentOrgName}, and The
          Resident Crew platform in South Africa:
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginTop: '1rem' }}>
          {FOUNDER_IMAGES.map(img => (
            <figure
              key={img.path}
              style={{
                margin: 0,
                padding: '12px',
                borderRadius: '12px',
                border: '1px solid var(--glass-border)',
                background: 'var(--card-bg)',
              }}
            >
              <Image
                src={img.path}
                alt={img.alt}
                width={img.width}
                height={img.height}
                unoptimized={img.path.endsWith('.png')}
                style={{ width: '100%', height: 'auto', borderRadius: '8px', display: 'block' }}
              />
              <figcaption style={{ fontSize: '0.85rem', marginTop: '10px', opacity: 0.85 }}>
                {img.caption}
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      <div className={styles.cta}>
        <p>
          <strong>Journalists, researchers &amp; partners:</strong> Access third-person boilerplate, downloadable
          brand logos, and fact sheets on our <Link href="/press">Press &amp; Media Kit</Link>.
        </p>
        <p style={{ marginBottom: 0 }}>
          Explore <Link href="/about">About The Resident Crew</Link>, browse{' '}
          <Link href="/campus">Student Accommodation</Link>, or <Link href="/contact">Contact our team</Link>.
        </p>
      </div>
    </article>
  )
}
