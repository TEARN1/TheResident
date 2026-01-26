'use client'
import { motion } from 'framer-motion'
import { ArrowRight, Key, Shield, Star, Lock, Crown } from 'lucide-react'
import Link from 'next/link'
import styles from './page.module.css'

export default function Home() {
  return (
    <main className={styles.main}>
      {/* Background Effects */}
      <div className={styles.backgroundEffects}>
        <div className={`${styles.glowBlob} ${styles.glowTop}`} />
        <div className={`${styles.glowBlob} ${styles.glowBottom}`} />
      </div>

      {/* Navbar */}
      <nav className={styles.navbar}>
        <div className={styles.logo}>
          THE RESIDENT
        </div>
        <div className={styles.navLinks}>
          <Link href="/auth/login" className={styles.link}>
            Log In
          </Link>
          <Link href="/auth/signup" className="btn-gold">
            Join The Elite
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <div className={styles.hero}>
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: 'easeOut' }}
          className={styles.title}
        >
          Defined by <span className={styles.goldText}>Luxury</span>.<br />
          Secured by Trust.
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 1 }}
          className={styles.subtitle}
        >
          The exclusive marketplace connecting elite property owners with discerning residents.
          Experience a new standard of living where privacy meets prestige.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8, duration: 0.8 }}
          className={styles.ctaGroup}
        >
          <Link href="/auth/signup" className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            Begin Application <ArrowRight size={16} />
          </Link>
        </motion.div>
      </div>

      {/* Features */}
      <div className={styles.featuresGrid}>
        {[
          { icon: Shield, title: "Verified Identity", desc: "Rigorous vetting ensures you only interact with trusted individuals of equal standing." },
          { icon: Crown, title: "Premium Portfolio", desc: "Access the world's most exclusive properties, unavailable on the open market." },
          { icon: Lock, title: "Absolute Privacy", desc: "Your data is encrypted and your anonymity preserved until you choose otherwise." }
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
    </main>
  )
}
