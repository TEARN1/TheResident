'use client'
import { motion } from 'framer-motion'

export default function TextShimmer({ text, className = '' }: { text: string, className?: string }) {
    return (
        <div className={`relative inline-block overflow-hidden ${className}`} style={{ color: 'rgba(255, 255, 255, 0.3)' }}>
            <span className="relative z-10">{text}</span>
            <motion.div
                className="absolute top-0 left-0 w-full h-full z-20"
                style={{
                    background: 'linear-gradient(90deg, transparent 0%, var(--gold-primary) 50%, transparent 100%)',
                    backgroundClip: 'text',
                    WebkitBackgroundClip: 'text',
                    color: 'transparent',
                    filter: 'drop-shadow(0 0 10px rgba(212, 175, 55, 0.5))'
                }}
                initial={{ x: '-100%' }}
                animate={{ x: '100%' }}
                transition={{
                    repeat: Infinity,
                    duration: 2.5,
                    ease: 'linear',
                    repeatDelay: 1
                }}
            >
                {text}
            </motion.div>
        </div>
    )
}
