'use client'
import { animate, motion, useInView, useMotionValue, useTransform } from 'framer-motion'
import { useEffect, useRef } from 'react'

export default function AnimatedCounter({ from = 0, to, label }: { from?: number, to: number, label: string }) {
    const count = useMotionValue(from)
    const rounded = useTransform(count, latest => Math.round(latest))
    const ref = useRef(null)
    const isInView = useInView(ref)

    useEffect(() => {
        if (isInView) {
            const controls = animate(count, to, { duration: 2.5, ease: "easeOut" })
            return controls.stop
        }
    }, [isInView, to, from, count])

    return (
        <div ref={ref} className="flex flex-col items-center text-center p-4">
            <motion.span className="text-4xl md:text-5xl font-bold text-[var(--gold-primary)] font-[var(--font-heading)]">
                {rounded}
            </motion.span>
            <span className="text-sm uppercase tracking-widest mt-2 text-gray-400">{label}</span>
        </div>
    )
}
