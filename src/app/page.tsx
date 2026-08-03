'use client'
import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, Shield, Lock, Crown, Download, Smartphone } from 'lucide-react'
import Link from 'next/link'
import styles from './page.module.css'

export default function Home() {
  const [showIosModal, setShowIosModal] = useState(false)
  return (
    <main className={styles.main}>
      {/* Background Effects */}
      <div className={styles.backgroundEffects}>
        <div className={`${styles.glowBlob} ${styles.glowTop}`} />
        <div className={`${styles.glowBlob} ${styles.glowBottom}`} />
      </div>

      {/* Navbar */}
      <nav className={styles.navbar}>
        <div className={styles.logo} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <img src="/logo.png" alt="The Resident Logo" style={{ height: '32px', width: '32px', borderRadius: '4px' }} />
          THE RESIDENT
        </div>
        <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
          <Link href="/auth" style={{ color: '#fff', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '1px' }}>
            Log In
          </Link>
          <Link href="/auth" className="btn-gold">
            Join Your Suburb
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', textAlign: 'center', padding: '0 1rem' }}>
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: 'easeOut' }}
          className={styles.title}
        >
          Defined by <span className={styles.goldText}>Community</span>.<br />
          Secured by Trust.
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 1 }}
          className={styles.subtitle}
        >
          The community-powered ecosystem connecting neighbors. 
          Coordinate lift clubs, access spaza marketplaces, share tools, and keep your street safe.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8, duration: 0.8 }}
          className={styles.ctaGroup}
          style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}
        >
          <Link href="/auth" className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            Enter Portal <ArrowRight size={16} />
          </Link>
          <a href="/theresident.apk" download className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.08)', padding: '12px 24px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', fontSize: '0.95rem', fontWeight: 'bold', cursor: 'pointer' }}>
            <Download size={16} /> Download Android APK
          </a>
          <button 
            onClick={() => setShowIosModal(true)} 
            className="btn-secondary" 
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px', 
              background: 'rgba(255,255,255,0.08)', 
              padding: '12px 24px', 
              borderRadius: '8px', 
              border: '1px solid rgba(255,255,255,0.2)', 
              color: '#fff', 
              fontSize: '0.95rem', 
              fontWeight: 'bold', 
              cursor: 'pointer' 
            }}
          >
            <Smartphone size={16} /> Install on iPhone
          </button>
        </motion.div>
      </div>

      {/* Features */}
      <div className={styles.featuresGrid}>
        {[
          { icon: Shield, title: "Trusted Neighbors", desc: "Vibe check ratings and reputation scores ensure you only transact with verified local residents." },
          { icon: Crown, title: "Local Listings", desc: "Find spaza shops, handyman services, secure rooms, and bakkie transport directly in your suburb." },
          { icon: Lock, title: "Safety Net", desc: "Keep your street secure with coordinated mutual aid checks and real-time community panic alerts." }
        ].map((feature, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1 + (i * 0.2), duration: 0.8 }}
            className={`glass-panel ${styles.featureCard}`}
          >
            <div className={styles.iconWrapper}>
              <feature.icon className={styles.icon} size={24} />
            </div>
            <h3 className={styles.featureTitle}>{feature.title}</h3>
            <p className={styles.featureDesc}>{feature.desc}</p>
          </motion.div>
        ))}
      </div>

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
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '12px',
            padding: '24px',
            maxWidth: '400px',
            width: '100%',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
            color: '#fff'
          }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '12px', color: '#fbbf24' }}>
              Install on iPhone
            </h3>
            <p style={{ fontSize: '0.85rem', color: '#9ca3af', marginBottom: '16px', lineHeight: '1.4' }}>
              To run The Resident on your iPhone like a native mobile app, follow these simple Safari steps:
            </p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', gap: '10px' }}>
                <span style={{ background: '#312e81', color: '#c7d2fe', width: '20px', height: '20px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 'bold' }}>1</span>
                <p style={{ fontSize: '0.85rem', color: '#d1d5db', margin: 0 }}>Open Safari and visit this website.</p>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <span style={{ background: '#312e81', color: '#c7d2fe', width: '20px', height: '20px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 'bold' }}>2</span>
                <p style={{ fontSize: '0.85rem', color: '#d1d5db', margin: 0 }}>Tap the <strong>Share</strong> button (the square icon with an arrow pointing up at the bottom screen menu).</p>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <span style={{ background: '#312e81', color: '#c7d2fe', width: '20px', height: '20px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 'bold' }}>3</span>
                <p style={{ fontSize: '0.85rem', color: '#d1d5db', margin: 0 }}>Scroll down and select <strong>&quot;Add to Home Screen&quot;</strong>.</p>
              </div>
            </div>

            <button 
              onClick={() => setShowIosModal(false)}
              style={{
                width: '100%',
                background: '#fbbf24',
                color: '#000',
                border: 'none',
                padding: '10px',
                borderRadius: '6px',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              Got it!
            </button>
          </div>
        </div>
      )}
    </main>
  )
}
