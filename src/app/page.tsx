'use client'
import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, Download, Home, LogIn, ShieldCheck, Smartphone, Wrench } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'
import styles from './page.module.css'
import { infoLinks } from './info-links'
import { playTactileSound } from '../utils/tactileSounds'
import { LAUNCH_AREA } from '../utils/launch'

/**
 * The front door, kept simple: what the app is, two buttons, three reasons,
 * and how to get the app. It used to stack invented status chips ("Defense
 * Mesh: Armed"), a hidden second login form, five buttons and two rows of
 * cards; signing in lives on /auth only now.
 */
const FEATURES = [
  {
    icon: Home,
    title: 'Rooms you can trust',
    text: 'Real rooms from real landlords, with a fair-price check and tenant reviews before you pay anything.'
  },
  {
    icon: ShieldCheck,
    title: 'Neighbours who have your back',
    text: 'Safety alerts, a shared notice board and help from the people on your street.'
  },
  {
    icon: Wrench,
    title: 'Local services and trade',
    text: 'Find a plumber, a bakkie or a spaza nearby, rated by your neighbours.'
  }
]

export default function HomePage() {
  const router = useRouter()
  const [showIosHelp, setShowIosHelp] = useState(false)

  // Links from The Gruvs (?sso=gruvs) used to open a login box on this page;
  // send them to the one sign-in page instead.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('sso') === 'gruvs' || params.get('from') === 'gruvs' || params.get('mode') === 'gruvs') {
      router.replace('/auth?sso=gruvs')
    }
  }, [router])

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
        <Link
          href="/auth"
          onClick={() => playTactileSound('click')}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#fff', fontSize: '0.85rem', fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap' }}
        >
          <LogIn size={15} /> Log in
        </Link>
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

        <p className={styles.subtitle} style={{ marginBottom: '2rem' }}>
          Rooms, neighbours and local services in one free app.
        </p>

        <div className={styles.ctaGroup}>
          <Link
            href="/dashboard/housing"
            onClick={() => playTactileSound('click')}
            className="btn-primary"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '13px 28px', fontSize: '1rem', fontWeight: 800, textDecoration: 'none' }}
          >
            Find a room <ArrowRight size={17} />
          </Link>
          <Link
            href="/auth?role=landlord"
            onClick={() => playTactileSound('click')}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '13px 24px', borderRadius: '12px', fontSize: '0.95rem', fontWeight: 800, textDecoration: 'none', color: '#fff', border: '1px solid rgba(255,255,255,0.22)', background: 'rgba(255,255,255,0.06)' }}
          >
            List a room free
          </Link>
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

      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: '10px 20px', padding: '0 1rem 2.5rem', fontSize: '0.85rem', color: '#9ca3af', position: 'relative', zIndex: 5 }}>
        <span>Get the app:</span>
        <a href="/theresident.apk" download style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#fff', fontWeight: 700, textDecoration: 'none' }}>
          <Download size={15} /> Android
        </a>
        <button
          type="button"
          onClick={() => setShowIosHelp(true)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#fff', fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.85rem', padding: 0 }}
        >
          <Smartphone size={15} /> iPhone
        </button>
      </div>

      {showIosHelp && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setShowIosHelp(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}
        >
          <div onClick={e => e.stopPropagation()} style={{ background: '#111827', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '16px', padding: '22px', maxWidth: '360px', width: '100%', color: '#fff' }}>
            <h3 style={{ margin: '0 0 12px', fontSize: '1.1rem', fontWeight: 800 }}>Add to your iPhone</h3>
            <ol style={{ margin: '0 0 18px', paddingLeft: '1.2rem', fontSize: '0.9rem', lineHeight: 1.7, color: '#d1d5db' }}>
              <li>Open this page in Safari.</li>
              <li>Tap <strong>Share</strong> (the square with an arrow).</li>
              <li>Tap <strong>Add to Home Screen</strong>.</li>
            </ol>
            <button
              type="button"
              onClick={() => setShowIosHelp(false)}
              style={{ width: '100%', background: 'var(--gold-primary)', color: '#000', border: 'none', padding: '11px', borderRadius: '10px', fontWeight: 800, cursor: 'pointer' }}
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
