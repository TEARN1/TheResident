'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSelector } from 'react-redux'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ShieldAlert,
  Zap,
  ChevronRight,
  ShieldCheck,
  CheckCircle2
} from 'lucide-react'
import { RootState } from '../../../../store'
import { playTactileSound } from '../../../../utils/tactileSounds'
import type { NextOfKinStatus } from '../../../../utils/trust'

interface UrbanDynamicIslandProps {
  nokStatus: NextOfKinStatus | null
  onOpenSOS?: () => void
}

interface CivicPulseItem {
  id: string
  kind: 'alert' | 'traffic' | 'outage' | 'nok' | 'calm'
  icon: React.ElementType
  iconColor: string
  badgeBg: string
  badgeBorder: string
  badgeText: string
  label: string
  actionLabel?: string
  href?: string
}

export default function UrbanDynamicIsland({ nokStatus, onOpenSOS }: UrbanDynamicIslandProps) {
  const router = useRouter()
  const alerts = useSelector((state: RootState) => state.community.alerts.filter(a => a.status === 'active'))
  const statusReports = useSelector((state: RootState) => state.community.neighbourhoodStatus)
  const [pulseIndex, setPulseIndex] = useState(0)

  // Construct dynamic civic pulse items based on real database state
  const pulseItems: CivicPulseItem[] = React.useMemo(() => {
    const items: CivicPulseItem[] = []

    // 1. High priority emergency alerts
    if (alerts.length > 0) {
      items.push({
        id: 'active-alerts',
        kind: 'alert',
        icon: ShieldAlert,
        iconColor: '#ef4444',
        badgeBg: 'rgba(239, 68, 68, 0.15)',
        badgeBorder: 'rgba(239, 68, 68, 0.4)',
        badgeText: `${alerts.length} Civic Alert${alerts.length === 1 ? '' : 's'} Active`,
        label: alerts[0].title || 'Neighbourhood incident reported',
        actionLabel: 'View Map',
        href: '/dashboard/community?tab=vibemap'
      })
    }

    // 2. Active power or water outage consensus
    const activeOutage = statusReports.find(s => s.status === 'outage')
    if (activeOutage) {
      items.push({
        id: 'outage-status',
        kind: 'outage',
        icon: Zap,
        iconColor: '#f59e0b',
        badgeBg: 'rgba(245, 158, 11, 0.15)',
        badgeBorder: 'rgba(245, 158, 11, 0.4)',
        badgeText: `${activeOutage.service.toUpperCase()} OUTAGE`,
        label: `${activeOutage.suburb || 'Precinct'} grid status disrupted`,
        actionLabel: 'Details',
        href: '/dashboard/community?tab=safety'
      })
    }

    // 3. Next of Kin trust completion reminder if overdue or pending
    if (nokStatus && !nokStatus.hasNextOfKin) {
      items.push({
        id: 'nok-reminder',
        kind: 'nok',
        icon: ShieldCheck,
        iconColor: nokStatus.overdue ? '#ef4444' : '#00f2ff',
        badgeBg: nokStatus.overdue ? 'rgba(239, 68, 68, 0.15)' : 'rgba(0, 242, 255, 0.15)',
        badgeBorder: nokStatus.overdue ? 'rgba(239, 68, 68, 0.4)' : 'rgba(0, 242, 255, 0.4)',
        badgeText: nokStatus.overdue ? 'TRUST INCOMPLETE' : 'ADD NEXT OF KIN',
        label: nokStatus.overdue ? 'Next of Kin required for full verification' : `${nokStatus.daysRemaining ?? 180} days left to verify safety circle`,
        actionLabel: 'Add',
        href: '/dashboard/trust-circle'
      })
    }

    // 4. Default calm status when everything in precinct is operational
    if (items.length === 0) {
      items.push({
        id: 'precinct-calm',
        kind: 'calm',
        icon: CheckCircle2,
        iconColor: '#10b981',
        badgeBg: 'rgba(16, 185, 129, 0.12)',
        badgeBorder: 'rgba(16, 185, 129, 0.3)',
        badgeText: 'PRECINCT CLEAR',
        label: 'Zero emergency disruptions in your walking radius',
        actionLabel: 'Radar',
        href: '/dashboard/community?tab=vibemap'
      })
    }

    return items
  }, [alerts, statusReports, nokStatus])

  // Cycle through items periodically if more than one item exists
  useEffect(() => {
    if (pulseItems.length <= 1) return
    const timer = setInterval(() => {
      setPulseIndex(prev => (prev + 1) % pulseItems.length)
    }, 6000)
    return () => clearInterval(timer)
  }, [pulseItems.length])

  const activeItem = pulseItems[pulseIndex] || pulseItems[0]
  if (!activeItem) return null

  const handleIslandClick = () => {
    playTactileSound('tab')
    if (activeItem.href) {
      router.push(activeItem.href)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleIslandClick}
        className="group relative flex items-center gap-1.5 sm:gap-2.5 px-2.5 sm:px-3 py-1.5 rounded-full bg-black/80 backdrop-blur-2xl border border-white/15 hover:border-gold-primary/40 transition-all touch-target-44 text-left max-w-[110px] xs:max-w-[170px] sm:max-w-xs md:max-w-md overflow-hidden"
        title="Urban Dynamic Island: Real-time precinct telemetry"
        aria-label="Urban Dynamic Island status"
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={activeItem.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.25 }}
            className="flex items-center gap-2 min-w-0"
          >
            <div
              className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 border"
              style={{
                backgroundColor: activeItem.badgeBg,
                borderColor: activeItem.badgeBorder
              }}
            >
              <activeItem.icon size={11} style={{ color: activeItem.iconColor }} />
            </div>

            <div className="flex items-center gap-1.5 min-w-0">
              <span
                className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border shrink-0 hidden sm:inline-block"
                style={{
                  backgroundColor: activeItem.badgeBg,
                  borderColor: activeItem.badgeBorder,
                  color: activeItem.iconColor
                }}
              >
                {activeItem.badgeText}
              </span>
              <span className="text-[11px] font-bold text-gray-200 truncate">
                {activeItem.label}
              </span>
            </div>

            <ChevronRight
              size={12}
              className="text-gray-500 group-hover:text-gold-primary transition-colors shrink-0 ml-auto hidden sm:block"
            />
          </motion.div>
        </AnimatePresence>
      </button>

      {/* Emergency SOS Quick Trigger */}
      <button
        type="button"
        onClick={() => {
          playTactileSound('pop')
          if (onOpenSOS) {
            onOpenSOS()
          } else {
            router.push('/dashboard/community?tab=safety')
          }
        }}
        className="px-2.5 py-1.5 rounded-full bg-red-500/15 hover:bg-red-500/25 border border-red-500/40 text-red-300 hover:text-white text-[10px] font-black uppercase tracking-wider flex items-center gap-1 transition-all touch-target-44 shrink-0"
        title="Emergency Civic Alert / Next-of-Kin Stand-down"
        aria-label="Emergency Civic Alert"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
        <span className="hidden xs:inline">SOS</span>
      </button>
    </div>
  )
}
