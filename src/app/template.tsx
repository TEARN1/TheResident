'use client'
import { motion } from 'framer-motion'

// No `filter` in this transition, deliberately. Framer Motion's resting value
// after animating filter is 'blur(0px)', not 'none' — and per the CSS spec,
// ANY filter value other than none (including blur(0px)) creates a new
// containing block for descendants. Since this template wraps literally
// every page, that silently broke `position: fixed` for everything nested
// inside it app-wide — the dashboard's bottom nav bar included, which
// scrolled away with the page instead of staying pinned to the viewport.
export default function Template({ children }: { children: React.ReactNode }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ ease: 'easeInOut', duration: 0.75 }}
        >
            {children}
        </motion.div>
    )
}
