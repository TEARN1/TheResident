'use client'
import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useDispatch, useSelector } from 'react-redux'
import { useRouter } from 'next/navigation'
import {
  ArrowRight, Shield, Lock, Crown, Download, Smartphone, X, LogIn, Loader,
  Sparkles, ExternalLink, Zap, Activity, Radio, Table2, Home, Truck, Wrench, Scale
} from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'
import styles from './page.module.css'
import { AppDispatch, RootState } from '../store'
import { performLogin } from '../utils/authLogin'
import { supabase } from '../utils/supabase'
import { infoLinks } from './info-links'
import { GRUVS, GRUVS_TOUCH_DOWN, TEARNS } from '../utils/sisterApps'
import { playTactileSound } from '../utils/tactileSounds'

export default function HomePage() {
  const [showIosModal, setShowIosModal] = useState(false)
  const [showLogin, setShowLogin] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState<string | null>(null)
  const [loginLoading, setLoginLoading] = useState(false)
  const [oauthLoading, setOauthLoading] = useState<'google' | 'facebook' | null>(null)
  const [gruvsMode, setGruvsMode] = useState(false)

  const dispatch = useDispatch<AppDispatch>()
  const router = useRouter()
  const failedAttempts = useSelector((state: RootState) => state.auth.failedAttempts)
  const lockedUntil = useSelector((state: RootState) => state.auth.lockedUntil)

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      if (params.get('sso') === 'gruvs' || params.get('from') === 'gruvs' || params.get('mode') === 'gruvs') {
        setShowLogin(true)
        setGruvsMode(true)
      }
    }
  }, [])

  const handleInlineLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) return
    playTactileSound('click')
    setLoginLoading(true)
    setLoginError(null)
    const result = await performLogin({ email, password, dispatch, failedAttempts, lockedUntil })
    setLoginLoading(false)
    if (!result.ok) {
      setLoginError(result.error)
      playTactileSound('alert')
      return
    }
    playTactileSound('pop')
    router.push(result.needsOnboarding ? '/auth/onboarding' : '/dashboard')
  }

  const handleOAuth = async (provider: 'google' | 'facebook') => {
    if (!supabase) {
      setLoginError('Database offline / not configured.')
      playTactileSound('alert')
      return
    }
    playTactileSound('click')
    setLoginError(null)
    setOauthLoading(provider)
    const redirectTo = typeof window !== 'undefined' ? `${window.location.origin}/dashboard` : undefined
    const { error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo } })
    if (error) {
      setLoginError(error.message)
      playTactileSound('alert')
      setOauthLoading(null)
    }
  }

  return (
    <main className={styles.main}>
      {/* Ambient Cybernetic Visual Effects */}
      <div className={styles.backgroundEffects}>
        <div className={`${styles.glowBlob} ${styles.glowTop}`} />
        <div className={`${styles.glowBlob} ${styles.glowMid}`} />
        <div className={`${styles.glowBlob} ${styles.glowBottom}`} />
      </div>

      {/* Cybernetic Navigation Bar */}
      <nav className={styles.navbar}>
        <div className={styles.logo} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Image src="/logo.png" alt="The Resident Logo" width={32} height={32} style={{ borderRadius: '6px' }} />
          <span>THE RESIDENT</span>
        </div>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => { setShowLogin(v => !v); playTactileSound('tab') }}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'transparent', border: 'none', color: '#fff', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '1px', cursor: 'pointer', fontWeight: 700 }}
          >
            <LogIn size={15} /> Log In
          </button>
          <Link
            href="/auth"
            onClick={() => playTactileSound('click')}
            className="btn-gold"
            style={{ padding: '8px 18px', fontSize: '0.85rem', fontWeight: 800 }}
          >
            Join Suburb
          </Link>
        </div>

        <AnimatePresence>
          {showLogin && (
            <motion.form
              onSubmit={handleInlineLogin}
              initial={{ opacity: 0, y: -8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.98 }}
              transition={{ duration: 0.2 }}
              className={`glass-panel ${styles.loginPopover}`}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#fff', margin: 0 }}>
                  {gruvsMode ? 'Log In with The Gruvs' : 'Civic Pass Log In'}
                </h3>
                <button
                  type="button"
                  onClick={() => { setShowLogin(false); playTactileSound('pop') }}
                  style={{ background: 'transparent', border: 'none', color: '#888', cursor: 'pointer' }}
                >
                  <X size={16} />
                </button>
              </div>

              {gruvsMode && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0.5rem 0.75rem', background: 'rgba(168, 85, 247, 0.15)', border: '1px solid rgba(168, 85, 247, 0.35)', borderRadius: '10px', marginBottom: '0.75rem', fontSize: '0.72rem', color: '#e9d5ff' }}>
                  <Image src="/gruvs-logo.png" alt="The Gruvs" width={18} height={18} style={{ borderRadius: '50%', flexShrink: 0 }} />
                  <span><strong>One account:</strong> Sign in with your The Gruvs email &amp; password.</span>
                </div>
              )}

              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder={gruvsMode ? "your-gruvs-email@domain.com" : "name@domain.com"}
                required
                style={{ width: '100%', boxSizing: 'border-box', background: 'var(--input-bg)', border: '1px solid var(--glass-border)', borderRadius: '8px', padding: '0.65rem 0.8rem', color: '#fff', fontSize: '0.85rem', marginBottom: '0.6rem', outline: 'none' }}
              />
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder={gruvsMode ? "The Gruvs password..." : "secure key..."}
                required
                style={{ width: '100%', boxSizing: 'border-box', background: 'var(--input-bg)', border: '1px solid var(--glass-border)', borderRadius: '8px', padding: '0.65rem 0.8rem', color: '#fff', fontSize: '0.85rem', marginBottom: '0.8rem', outline: 'none' }}
              />
              {loginError && (
                <p style={{ fontSize: '0.72rem', color: '#f87171', marginBottom: '0.6rem', lineHeight: 1.4 }}>{loginError}</p>
              )}
              <button
                type="submit"
                disabled={loginLoading}
                className="btn-primary"
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              >
                {loginLoading ? <Loader size={14} className="animate-spin" /> : (
                  gruvsMode ? <Image src="/gruvs-logo.png" alt="The Gruvs" width={14} height={14} style={{ borderRadius: '50%' }} /> : <LogIn size={14} />
                )}
                {loginLoading ? 'Logging in…' : (gruvsMode ? 'Log In with The Gruvs' : 'Log In')}
              </button>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '0.7rem 0' }}>
                <span style={{ flex: 1, height: '1px', background: 'var(--glass-border)' }} />
                <span style={{ fontSize: '0.65rem', color: '#666', letterSpacing: '1px' }}>OR</span>
                <span style={{ flex: 1, height: '1px', background: 'var(--glass-border)' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <button
                  type="button"
                  onClick={() => { setGruvsMode(v => !v); playTactileSound('tab') }}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    background: gruvsMode ? 'rgba(168, 85, 247, 0.25)' : 'rgba(168, 85, 247, 0.12)',
                    border: gruvsMode ? '1px solid #a855f7' : '1px solid rgba(168, 85, 247, 0.35)',
                    borderRadius: '8px',
                    padding: '0.55rem',
                    color: '#fff',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  <Image src="/gruvs-logo.png" alt="The Gruvs" width={16} height={16} style={{ borderRadius: '50%' }} />
                  {gruvsMode ? 'Switch to Standard Login' : 'Sign in with The Gruvs'}
                </button>
                <button
                  type="button"
                  onClick={() => handleOAuth('google')}
                  disabled={oauthLoading !== null}
                  style={{ width: '100%', background: 'var(--input-bg)', border: '1px solid var(--glass-border)', borderRadius: '8px', padding: '0.55rem', color: '#fff', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer' }}
                >
                  {oauthLoading === 'google' ? '…' : 'Continue with Google'}
                </button>
                <button
                  type="button"
                  onClick={() => handleOAuth('facebook')}
                  disabled={oauthLoading !== null}
                  style={{ width: '100%', background: 'var(--input-bg)', border: '1px solid var(--glass-border)', borderRadius: '8px', padding: '0.55rem', color: '#fff', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer' }}
                >
                  {oauthLoading === 'facebook' ? '…' : 'Continue with Facebook'}
                </button>
              </div>
              <p style={{ fontSize: '0.7rem', color: '#888', marginTop: '0.8rem', textAlign: 'center' }}>
                New here? <Link href="/auth" style={{ color: 'var(--gold-primary)', fontWeight: 700 }}>Create an account</Link>
                {' '}•{' '}
                <Link href="/auth?mode=gruvs" style={{ color: '#c084fc', fontWeight: 700 }}>Join via Gruvs</Link>
              </p>
            </motion.form>
          )}
        </AnimatePresence>
      </nav>

      {/* Cybernetic Hero & Planetary Telemetry Capsule */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '62vh', textAlign: 'center', padding: '1rem', position: 'relative', zIndex: 5 }}>
        
        {/* Planetary Telemetry Capsule */}
        <div className={styles.telemetryBar}>
          <div className={styles.telemetryChip}>
            <span className={styles.telemetryPulse} style={{ background: '#22c55e' }} />
            <span>Civic Grid: Online</span>
          </div>
          <div className={styles.telemetryChip}>
            <Radio size={12} className="text-cyan-400" />
            <span>Defense Mesh: Armed</span>
          </div>
          <div className={styles.telemetryChip}>
            <Zap size={12} className="text-amber-400" />
            <span>Outage Watch: Live</span>
          </div>
          <a
            href={GRUVS.url ?? undefined}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => playTactileSound('tab')}
            className={styles.telemetryChip}
            style={{ color: '#d8b4fe', textDecoration: 'none' }}
          >
            <Sparkles size={12} className="text-purple-400" />
            <span>Gruvs Radar: Synced</span>
          </a>
        </div>

        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: 'easeOut' }}
          className={styles.title}
        >
          The Planetary Operating System<br />
          <span className={styles.goldText}>for Physical Life</span>.
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.9 }}
          className={styles.subtitle}
        >
          Shelter without scams. Mutual aid and emergency defense.
          Vetted neighborhood trade artisans. Interlocked with <strong>The Gruvs</strong> nightlife and <strong>TEARN&apos;s Excellence</strong> workplace mastery.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.8 }}
          className={styles.ctaGroup}
        >
          <Link
            href="/auth"
            onClick={() => playTactileSound('click')}
            className="btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 28px', fontSize: '0.98rem', fontWeight: 800 }}
          >
            Enter Civic Portal <ArrowRight size={17} />
          </Link>
          <Link
            href="/auth?mode=gruvs"
            onClick={() => playTactileSound('tab')}
            className="btn-secondary"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'rgba(168, 85, 247, 0.15)',
              border: '1px solid rgba(168, 85, 247, 0.45)',
              color: '#f3e8ff',
              padding: '12px 24px',
              borderRadius: '12px',
              fontSize: '0.95rem',
              fontWeight: 800,
              cursor: 'pointer'
            }}
          >
            <Image src="/gruvs-logo.png" alt="The Gruvs" width={18} height={18} style={{ borderRadius: '50%' }} />
            One-Tap Gruvs Access
          </Link>
          <a
            href="/theresident.apk"
            download
            onClick={() => playTactileSound('pop')}
            className="btn-secondary"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'rgba(255,255,255,0.06)',
              padding: '12px 22px',
              borderRadius: '12px',
              border: '1px solid rgba(255,255,255,0.18)',
              color: '#fff',
              fontSize: '0.92rem',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            <Download size={16} /> Download APK
          </a>
          <button
            type="button"
            onClick={() => { setShowIosModal(true); playTactileSound('pop') }}
            className="btn-secondary"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'rgba(255,255,255,0.06)',
              padding: '12px 22px',
              borderRadius: '12px',
              border: '1px solid rgba(255,255,255,0.18)',
              color: '#fff',
              fontSize: '0.92rem',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            <Smartphone size={16} /> Install on iPhone
          </button>
        </motion.div>
      </div>

      {/* Planetary Problem-Solving Engine (6 Telemetry Grid Cards) */}
      <div className={styles.featuresGrid}>
        {[
          {
            icon: Home,
            title: "Verified Shelter & Rooms",
            desc: "Real room vacancy watchers, neighborhood price quartile analysis, scam warning filters, and certified co-living lease agreements.",
            accent: 'var(--gold-primary)',
            glow: 'radial-gradient(circle at 20% 0%, rgb(var(--accent) / 0.12), transparent 60%)',
            iconBg: 'rgb(var(--accent) / 0.12)'
          },
          {
            icon: Zap,
            title: "Grid & Outage Resilience",
            desc: "Crowdsourced municipal outage verification, prepaid utility token exchanges, and community power sharing when the main grid fails.",
            accent: '#f59e0b',
            glow: 'radial-gradient(circle at 20% 0%, rgba(245, 158, 11, 0.12), transparent 60%)',
            iconBg: 'rgba(245, 158, 11, 0.12)'
          },
          {
            icon: Shield,
            title: "Autonomous Defense SOS",
            desc: "Direct neighborhood panic broadcast with reach preview, virtual night walking companions, and mutual aid checks across your street.",
            accent: '#ef4444',
            glow: 'radial-gradient(circle at 20% 0%, rgba(239, 68, 68, 0.12), transparent 60%)',
            iconBg: 'rgba(239, 68, 68, 0.12)'
          },
          {
            icon: Truck,
            title: "P2P Moving & Hauling",
            desc: "Coordinate bakkies and local cargo transport without middleman fees. Direct dispatches with live route telemetry.",
            accent: '#06b6d4',
            glow: 'radial-gradient(circle at 20% 0%, rgba(6, 182, 212, 0.12), transparent 60%)',
            iconBg: 'rgba(6, 182, 212, 0.12)'
          },
          {
            icon: Wrench,
            title: "Verified Artisan Guilds",
            desc: "Community-vetted plumbers, electricians, and tradesmen backed by verified peer reviews, good-neighbour reputation, and tier priority.",
            accent: '#10b981',
            glow: 'radial-gradient(circle at 20% 0%, rgba(16, 185, 129, 0.12), transparent 60%)',
            iconBg: 'rgba(16, 185, 129, 0.12)'
          },
          {
            icon: Scale,
            title: "Civic Dispute Tribunal",
            desc: "Peer mediation, transparent deposit snag lists, and POPIA-compliant platform neutrality protecting both tenants and property owners.",
            accent: '#8b5cf6',
            glow: 'radial-gradient(circle at 20% 0%, rgba(139, 92, 246, 0.12), transparent 60%)',
            iconBg: 'rgba(139, 92, 246, 0.12)'
          }
        ].map((feature, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 + (i * 0.1), duration: 0.7 }}
            className={`glass-panel ${styles.featureCard}`}
            style={{
              '--feature-accent': feature.accent,
              '--feature-glow': feature.glow,
              '--feature-icon-bg': feature.iconBg
            } as React.CSSProperties}
          >
            <div className={styles.iconWrapper}>
              <feature.icon className={styles.icon} size={24} />
            </div>
            <h3 className={styles.featureTitle}>{feature.title}</h3>
            <p className={styles.featureDesc}>{feature.desc}</p>
          </motion.div>
        ))}
      </div>

      {/* The Holy Trinity Ecosystem Showcase: Live, Work, Celebrate */}
      <section className={styles.trinityContainer}>
        <div className={styles.trinityHeader}>
          <span style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--gold-primary)' }}>
            Ecosystem Synthesis
          </span>
          <h2 style={{ fontSize: 'clamp(1.75rem, 4vw, 2.75rem)', fontWeight: 800, color: '#fff', marginTop: '0.5rem', marginBottom: '0.75rem' }}>
            Live. Work. Celebrate.
          </h2>
          <p style={{ color: '#9ca3af', maxWidth: '640px', margin: '0 auto', fontSize: '0.95rem' }}>
            Three interconnected applications powering the full human lifecycle: domestic shelter, productive skill, and nocturnal culture.
          </p>
        </div>

        <div className={styles.trinityGrid}>
          {/* Card 1: The Resident */}
          <div className={styles.trinityCard}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.25rem' }}>
                <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'rgba(212, 175, 55, 0.15)', border: '1px solid rgba(212, 175, 55, 0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--gold-primary)' }}>
                  <Home size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#fff', margin: 0 }}>The Resident</h3>
                  <span style={{ fontSize: '0.7rem', color: 'var(--gold-primary)', fontWeight: 700, textTransform: 'uppercase' }}>Shelter &amp; Living Grid</span>
                </div>
              </div>
              <p style={{ color: '#9ca3af', fontSize: '0.88rem', lineHeight: 1.6, marginBottom: '1.5rem' }}>
                The physical living operating system. Verified student and worker co-living, room manager, outage coordination, and peer-to-peer neighborhood protection.
              </p>
            </div>
            <Link
              href="/auth"
              onClick={() => playTactileSound('click')}
              className="btn-gold"
              style={{ textAlign: 'center', padding: '10px', fontSize: '0.88rem', fontWeight: 800, textDecoration: 'none' }}
            >
              Enter Living Grid
            </Link>
          </div>

          {/* Card 2: The Gruvs */}
          <div className={styles.trinityCard} style={{ borderColor: 'rgba(168, 85, 247, 0.3)' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.25rem' }}>
                <div style={{ width: '38px', height: '38px', borderRadius: '50%', overflow: 'hidden', border: '1px solid rgba(168, 85, 247, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Image src="/gruvs-logo.png" alt="The Gruvs" width={38} height={38} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#fff', margin: 0 }}>{GRUVS.name}</h3>
                  <span style={{ fontSize: '0.7rem', color: '#c084fc', fontWeight: 700, textTransform: 'uppercase' }}>Nightlife &amp; Culture</span>
                </div>
              </div>
              <p style={{ color: '#9ca3af', fontSize: '0.88rem', lineHeight: 1.6, marginBottom: '0.75rem' }}>
                {GRUVS.body}
              </p>
              <p style={{ color: '#d8b4fe', fontSize: '0.8rem', fontStyle: 'italic', marginBottom: '1.5rem' }}>
                {GRUVS_TOUCH_DOWN}
              </p>
            </div>
            <a
              href={GRUVS.url ?? undefined}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => playTactileSound('tab')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.25), rgba(126, 34, 206, 0.15))',
                border: '1.5px solid rgba(168, 85, 247, 0.6)',
                borderRadius: '12px',
                padding: '10px',
                color: '#f3e8ff',
                fontSize: '0.88rem',
                fontWeight: 800,
                textDecoration: 'none',
                cursor: 'pointer'
              }}
            >
              <span>{GRUVS.cta}</span>
              <ExternalLink size={14} />
            </a>
          </div>

          {/* Card 3: TEARN's Excellence */}
          <div className={styles.trinityCard} style={{ borderColor: 'rgba(59, 130, 246, 0.3)' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.25rem' }}>
                <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'rgba(59, 130, 246, 0.15)', border: '1px solid rgba(59, 130, 246, 0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#60a5fa' }}>
                  <Table2 size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#fff', margin: 0 }}>{TEARNS.name}</h3>
                  <span style={{ fontSize: '0.7rem', color: '#60a5fa', fontWeight: 700, textTransform: 'uppercase' }}>Workplace Competence</span>
                </div>
              </div>
              <p style={{ color: '#9ca3af', fontSize: '0.88rem', lineHeight: 1.6, marginBottom: '1.5rem' }}>
                {TEARNS.body}
              </p>
            </div>
            {TEARNS.url ? (
              <a
                href={TEARNS.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => playTactileSound('tab')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  background: 'rgba(59, 130, 246, 0.2)',
                  border: '1.5px solid rgba(59, 130, 246, 0.5)',
                  borderRadius: '12px',
                  padding: '10px',
                  color: '#bfdbfe',
                  fontSize: '0.88rem',
                  fontWeight: 800,
                  textDecoration: 'none',
                  cursor: 'pointer'
                }}
              >
                <span>{TEARNS.cta}</span>
                <ExternalLink size={14} />
              </a>
            ) : (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '10px',
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '12px',
                  color: '#9ca3af',
                  fontSize: '0.82rem',
                  fontWeight: 600
                }}
              >
                <span>Integrated Skill Drills</span>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Safari iOS PWA Modal */}
      {showIosModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.85)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 99999,
          padding: '16px'
        }}>
          <div style={{
            backgroundColor: '#111827',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: '16px',
            padding: '24px',
            maxWidth: '400px',
            width: '100%',
            color: '#fff'
          }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '12px', color: 'var(--gold-primary)' }}>
              Install on iPhone
            </h3>
            <p style={{ fontSize: '0.85rem', color: '#9ca3af', marginBottom: '16px', lineHeight: 1.5 }}>
              Run The Resident like a native iOS application:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', gap: '10px' }}>
                <span style={{ background: 'rgba(212, 175, 55, 0.2)', color: 'var(--gold-primary)', width: '22px', height: '22px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 'bold' }}>1</span>
                <p style={{ fontSize: '0.85rem', color: '#d1d5db', margin: 0 }}>Open Safari on your iPhone.</p>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <span style={{ background: 'rgba(212, 175, 55, 0.2)', color: 'var(--gold-primary)', width: '22px', height: '22px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 'bold' }}>2</span>
                <p style={{ fontSize: '0.85rem', color: '#d1d5db', margin: 0 }}>Tap <strong>Share</strong> (the square icon with arrow pointing up).</p>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <span style={{ background: 'rgba(212, 175, 55, 0.2)', color: 'var(--gold-primary)', width: '22px', height: '22px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 'bold' }}>3</span>
                <p style={{ fontSize: '0.85rem', color: '#d1d5db', margin: 0 }}>Select <strong>&quot;Add to Home Screen&quot;</strong>.</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => { setShowIosModal(false); playTactileSound('pop') }}
              style={{
                width: '100%',
                background: 'var(--gold-primary)',
                color: '#000',
                border: 'none',
                padding: '12px',
                borderRadius: '10px',
                fontWeight: 800,
                fontSize: '0.9rem',
                cursor: 'pointer'
              }}
            >
              Understood
            </button>
          </div>
        </div>
      )}

      {/* Footer Links */}
      <footer style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '8px 24px', padding: '32px 16px', fontSize: '0.85rem', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        {infoLinks.map(l => (
          <Link
            key={l.href}
            href={l.href}
            onClick={() => playTactileSound('click')}
            style={{ color: '#9ca3af', textDecoration: 'none', transition: 'color 0.2s' }}
          >
            {l.label}
          </Link>
        ))}
      </footer>
    </main>
  )
}
