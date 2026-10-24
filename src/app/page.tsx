'use client'
import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, CheckCircle2, Compass, Download, Home, LogIn, MapPin, Search, ShieldCheck, Smartphone, Sparkles, Wrench } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'
import styles from './page.module.css'
import { infoLinks } from './info-links'
import { playTactileSound } from '../utils/tactileSounds'
import { LAUNCH_AREA } from '../utils/launch'

const POPULAR_AREAS = [
  'Braamfontein',
  'Auckland Park',
  'Soweto',
  'Hatfield',
  'Pretoria CBD',
  'Cottesloe'
]

const TRUST_PILLARS = [
  'Zero Broker Fees',
  'Verified Landlords',
  'Neighbourhood Safety'
]

const FEATURES = [
  {
    icon: Home,
    title: 'Rooms you can trust',
    text: 'Real rooms from real landlords, with fair-price checks and tenant reviews before you pay a cent.'
  },
  {
    icon: ShieldCheck,
    title: 'Neighbours who have your back',
    text: 'Real-time safety alerts, verified crime reports and help from verified people on your street.'
  },
  {
    icon: Wrench,
    title: 'Local services and trade',
    text: 'Find a reliable plumber, electrician, bakkie or spaza nearby, vetted and rated by neighbours.'
  }
]

export default function HomePage() {
  const router = useRouter()
  const [showIosHelp, setShowIosHelp] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // Links from The Gruvs (?sso=gruvs) used to open a login box on this page;
  // send them to the one sign-in page instead.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('sso') === 'gruvs' || params.get('from') === 'gruvs' || params.get('mode') === 'gruvs') {
      router.replace('/auth?sso=gruvs')
    }
  }, [router])

  const enterApp = (href: string) => {
    playTactileSound('click')
    if (typeof document !== 'undefined') {
      document.cookie = `guest-mode=1; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax`
    }
    router.push(href)
  }

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const q = searchQuery.trim()
    enterApp(q ? `/dashboard/housing?q=${encodeURIComponent(q)}` : '/dashboard/housing')
  }

  return (
    <main className={styles.main}>
      <div className={styles.backgroundEffects}>
        <div className={`${styles.glowBlob} ${styles.glowTop}`} />
        <div className={`${styles.glowBlob} ${styles.glowMid}`} />
      </div>

      <nav className={styles.navbar} style={{ flexWrap: 'nowrap' }}>
        <div className={styles.logo} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: 'clamp(1rem, 4.5vw, 1.35rem)' }}>
          <Image src="/logo.png" alt="" width={32} height={32} style={{ borderRadius: '6px' }} />
          <span>THE RESIDENT</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            onClick={() => enterApp('/dashboard/community?tab=vibemap')}
            className="touch-target-44"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              color: '#000',
              background: 'var(--gold-primary)',
              borderRadius: '999px',
              padding: '6px 14px',
              fontSize: '0.8rem',
              fontWeight: 800,
              border: 'none',
              cursor: 'pointer'
            }}
          >
            <Compass size={14} /> Open Live Map
          </button>
          <Link
            href="/auth"
            onClick={() => playTactileSound('click')}
            className="touch-target-44"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#fff', fontSize: '0.85rem', fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap', padding: '0 10px' }}
          >
            <LogIn size={15} /> Log in
          </Link>
        </div>
      </nav>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '2.5rem 1.25rem 1rem', position: 'relative', zIndex: 5 }}>
        {LAUNCH_AREA && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem', fontWeight: 700, color: '#fde68a', border: '1px solid rgba(253, 230, 138, 0.35)', background: 'rgba(253, 230, 138, 0.08)', borderRadius: '999px', padding: '6px 14px', marginBottom: '1.25rem' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#f59e0b' }} /> Now live in {LAUNCH_AREA}
          </span>
        )}

        <h1 className={styles.title}>
          Find a room you can trust.<br />
          <span className={styles.goldText}>Know the street you live on.</span>
        </h1>

        <p className={styles.subtitle} style={{ marginBottom: '1.25rem' }}>
          Rooms, neighbours and local services in one free community app.
        </p>

        {/* Living Civic Pulse & Vibe Map Hero Portal */}
        <div
          onClick={() => enterApp('/dashboard/community?tab=vibemap')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') enterApp('/dashboard/community?tab=vibemap') }}
          style={{
            cursor: 'pointer',
            maxWidth: '520px',
            width: '100%',
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.14) 0%, rgba(5, 31, 32, 0.85) 100%)',
            border: '1px solid rgba(16, 185, 129, 0.4)',
            borderRadius: '16px',
            padding: '14px 18px',
            marginBottom: '1.25rem',
            textAlign: 'left',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#34d399' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
              Live Precinct Radar Active
            </span>
            <span style={{ fontSize: '0.75rem', color: '#fbbf24', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              The Grooves &times; The Resident <ArrowRight size={13} />
            </span>
          </div>

          <p style={{ margin: 0, fontSize: '0.85rem', color: '#e5e7eb', lineHeight: 1.45, fontWeight: 500 }}>
            Unified live radar: street closures, weekend vibes, funerals, marathon routes, volunteer pointsmen, and grid telemetry.
          </p>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', paddingTop: '2px' }}>
            <span style={{ fontSize: '0.7rem', padding: '3px 8px', borderRadius: '6px', background: 'rgba(255,255,255,0.08)', color: '#d1d5db' }}>🚦 Traffic & Detours</span>
            <span style={{ fontSize: '0.7rem', padding: '3px 8px', borderRadius: '6px', background: 'rgba(255,255,255,0.08)', color: '#d1d5db' }}>🎉 Event Vibes</span>
            <span style={{ fontSize: '0.7rem', padding: '3px 8px', borderRadius: '6px', background: 'rgba(255,255,255,0.08)', color: '#d1d5db' }}>🏃 Marathon Corridors</span>
          </div>
        </div>

        {/* Quick Search Bar */}
        <form
          onSubmit={handleSearchSubmit}
          style={{
            display: 'flex',
            alignItems: 'center',
            width: '100%',
            maxWidth: '460px',
            background: 'rgba(255, 255, 255, 0.06)',
            border: '1px solid rgba(255, 255, 255, 0.16)',
            borderRadius: '14px',
            padding: '4px 6px 4px 14px',
            marginBottom: '1.25rem'
          }}
        >
          <Search size={18} style={{ color: '#9ca3af', marginRight: '8px', flexShrink: 0 }} />
          <input
            type="search"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search suburb (e.g. Braamfontein, Hatfield)..."
            aria-label="Search suburb"
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              color: '#fff',
              fontSize: '0.9rem',
              outline: 'none',
              padding: '8px 0'
            }}
          />
          <button
            type="submit"
            className="touch-target-44"
            style={{
              background: 'var(--gold-primary)',
              color: '#000',
              border: 'none',
              borderRadius: '10px',
              padding: '0 16px',
              fontWeight: 700,
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            Explore
          </button>
        </form>

        {/* Popular area pills */}
        <div
          className="no-scrollbar"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            maxWidth: '100%',
            overflowX: 'auto',
            padding: '2px 4px 1rem',
            marginBottom: '0.5rem'
          }}
        >
          <span style={{ fontSize: '0.75rem', color: '#9ca3af', whiteSpace: 'nowrap' }}>Popular:</span>
          {POPULAR_AREAS.map(area => (
            <button
              key={area}
              type="button"
              onClick={() => enterApp(`/dashboard/housing?q=${encodeURIComponent(area)}`)}
              style={{
                fontSize: '0.75rem',
                color: '#e5e7eb',
                background: 'rgba(255, 255, 255, 0.07)',
                border: '1px solid rgba(255, 255, 255, 0.14)',
                borderRadius: '999px',
                padding: '4px 10px',
                textDecoration: 'none',
                whiteSpace: 'nowrap',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                cursor: 'pointer'
              }}
            >
              <MapPin size={11} style={{ color: 'var(--gold-primary)' }} />
              {area}
            </button>
          ))}
        </div>

        {/* Main CTA buttons */}
        <div className={styles.ctaGroup}>
          <button
            type="button"
            onClick={() => enterApp('/dashboard/housing')}
            className="btn-primary touch-target-48"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '13px 28px', fontSize: '1rem', fontWeight: 800, border: 'none', cursor: 'pointer' }}
          >
            Find a room <ArrowRight size={17} />
          </button>
          <button
            type="button"
            onClick={() => enterApp('/dashboard/community?tab=vibemap')}
            className="touch-target-48"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '13px 24px', borderRadius: '12px', fontSize: '0.95rem', fontWeight: 800, color: '#fff', border: '1px solid rgba(255,255,255,0.22)', background: 'rgba(255,255,255,0.06)', cursor: 'pointer' }}
          >
            <Compass size={16} style={{ color: 'var(--gold-primary)' }} /> Explore Live Map
          </button>
        </div>

        {/* Instant guest browse shortcut */}
        <button
          type="button"
          onClick={() => enterApp('/dashboard')}
          style={{
            marginTop: '1.25rem',
            fontSize: '0.85rem',
            color: '#a0a0a0',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 12px'
          }}
        >
          <Sparkles size={14} style={{ color: 'var(--gold-primary)' }} />
          Browse neighbourhood as guest &rarr;
        </button>

        {/* Micro-trust indicators strip */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: '12px 20px',
            marginTop: '1.5rem',
            padding: '8px 16px',
            background: 'rgba(255, 255, 255, 0.03)',
            borderRadius: '999px',
            border: '1px solid rgba(255, 255, 255, 0.08)'
          }}
        >
          {TRUST_PILLARS.map(pill => (
            <span
              key={pill}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.75rem',
                color: '#d1d5db',
                fontWeight: 600
              }}
            >
              <CheckCircle2 size={13} style={{ color: '#10b981' }} />
              {pill}
            </span>
          ))}
        </div>
      </div>

      <div className={styles.featuresGrid} style={{ maxWidth: '1100px', paddingBottom: '2rem' }}>
        {FEATURES.map(f => (
          <div key={f.title} className={`glass-panel ${styles.featureCard}`}>
            <div style={{ padding: '10px', borderRadius: '12px', background: 'rgb(var(--accent) / 0.12)', color: 'var(--gold-primary)', marginBottom: '0.9rem' }}>
              <f.icon size={22} />
            </div>
            <h3 style={{ margin: '0 0 0.4rem', fontSize: '1.05rem', fontWeight: 800, color: '#fff' }}>{f.title}</h3>
            <p style={{ margin: 0, fontSize: '0.9rem', lineHeight: 1.55, color: '#a0a0a0' }}>{f.text}</p>
          </div>
        ))}
      </div>

      {/* App Download Strip */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: '12px 24px', padding: '0 1rem 2.5rem', fontSize: '0.85rem', color: '#9ca3af', position: 'relative', zIndex: 5 }}>
        <span>Get the app:</span>
        <a
          href="/theresident.apk"
          download
          className="touch-target-44"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#fff', fontWeight: 700, textDecoration: 'none', padding: '4px 8px' }}
        >
          <Download size={15} /> Android APK
        </a>
        <button
          type="button"
          onClick={() => setShowIosHelp(true)}
          className="touch-target-44"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#fff', fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.85rem', padding: '4px 8px' }}
        >
          <Smartphone size={15} /> iPhone Guide
        </button>
      </div>

      {showIosHelp && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setShowIosHelp(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}
        >
          <div onClick={e => e.stopPropagation()} style={{ background: '#111827', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '16px', padding: '24px', maxWidth: '380px', width: '100%', color: '#fff' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: '1.15rem', fontWeight: 800 }}>Add to your iPhone</h3>
            <p style={{ margin: '0 0 16px', fontSize: '0.85rem', color: '#9ca3af' }}>No App Store download needed — install in 3 quick taps:</p>
            <ol style={{ margin: '0 0 20px', paddingLeft: '1.2rem', fontSize: '0.9rem', lineHeight: 1.8, color: '#d1d5db' }}>
              <li>Open this page in <strong>Safari</strong>.</li>
              <li>Tap the <strong>Share</strong> button (box with upward arrow at bottom).</li>
              <li>Scroll down and tap <strong>Add to Home Screen</strong>.</li>
            </ol>
            <button
              type="button"
              onClick={() => setShowIosHelp(false)}
              className="touch-target-44"
              style={{ width: '100%', background: 'var(--gold-primary)', color: '#000', border: 'none', padding: '12px', borderRadius: '10px', fontWeight: 800, cursor: 'pointer', fontSize: '0.95rem' }}
            >
              Got it
            </button>
          </div>
        </div>
      )}

      <footer style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '8px 24px', padding: '24px 16px 32px', fontSize: '0.85rem', borderTop: '1px solid rgba(255,255,255,0.08)', marginTop: 'auto' }}>
        {infoLinks.map(l => (
          <Link key={l.href} href={l.href} style={{ color: '#9ca3af', textDecoration: 'none' }}>
            {l.label}
          </Link>
        ))}
      </footer>
    </main>
  )
}
