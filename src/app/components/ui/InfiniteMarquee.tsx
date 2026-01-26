'use client'
import { motion } from 'framer-motion'

export default function InfiniteMarquee({ items, speed = 20 }: { items: string[], speed?: number }) {
    return (
        <div className="relative w-full overflow-hidden py-8 bg-black/50 border-y border-[rgba(212,175,55,0.1)] backdrop-blur-md">
            <div className="flex">
                <motion.div
                    className="flex whitespace-nowrap"
                    animate={{ x: ["0%", "-50%"] }}
                    transition={{
                        repeat: Infinity,
                        duration: speed,
                        ease: "linear",
                    }}
                >
                    {[...items, ...items, ...items, ...items].map((item, i) => ( // Repeat 4x for smoothness
                        <div key={i} className="mx-8 text-xl font-light tracking-[0.2em] uppercase text-[#666]">
                            {item} <span className="mx-4 text-[var(--gold-primary)]">•</span>
                        </div>
                    ))}
                </motion.div>
            </div>
        </div>
    )
}
