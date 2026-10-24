'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus,
  X,
  MapPin,
  AlertTriangle,
  Flag,
  ShieldAlert,
  Home,
  Wrench,
  Car,
  Sparkles,
  Zap
} from 'lucide-react'
import { playTactileSound } from '../../../../utils/tactileSounds'

interface ActionOrbProps {
  onOpenReportModal?: (category?: string) => void
}

interface ActionOrbItem {
  id: string
  title: string
  description: string
  icon: React.ElementType
  color: string
  badge?: string
  action: () => void
}

export default function ActionOrb({ onOpenReportModal }: ActionOrbProps) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)

  const toggleOpen = () => {
    playTactileSound(isOpen ? 'click' : 'pop')
    setIsOpen(prev => !prev)
  }

  const handleAction = (cb: () => void) => {
    playTactileSound('tab')
    setIsOpen(false)
    cb()
  }

  const actions: ActionOrbItem[] = [
    {
      id: 'vibe-drop',
      title: 'Drop Live Vibe Pulse',
      description: 'Report crowd busyness, vibe, or street status',
      icon: MapPin,
      color: '#00f2ff',
      badge: 'LIVE',
      action: () => {
        if (onOpenReportModal) {
          onOpenReportModal('chill')
        } else {
          router.push('/dashboard/community?tab=vibemap&action=drop')
        }
      }
    },
    {
      id: 'road-closure',
      title: 'Street Closure / Funeral / Party',
      description: 'Report street tent, bash, or road obstruction',
      icon: AlertTriangle,
      color: '#f59e0b',
      badge: 'CIVIC',
      action: () => {
        if (onOpenReportModal) {
          onOpenReportModal('funeral_closure')
        } else {
          router.push('/dashboard/community?tab=vibemap&action=closure')
        }
      }
    },
    {
      id: 'marathon-route',
      title: 'Marathon / Race Route',
      description: 'Plot 10k/21k run or cycle course corridor',
      icon: Flag,
      color: '#10b981',
      badge: 'ROUTE',
      action: () => {
        if (onOpenReportModal) {
          onOpenReportModal('marathon_route')
        } else {
          router.push('/dashboard/community?tab=vibemap&action=marathon')
        }
      }
    },
    {
      id: 'dead-robots',
      title: 'Dead Robots / Pointsman',
      description: 'Flag offline traffic signal & volunteer pointsman',
      icon: Zap,
      color: '#fbbf24',
      badge: 'TRAFFIC',
      action: () => {
        if (onOpenReportModal) {
          onOpenReportModal('dead_robots')
        } else {
          router.push('/dashboard/community?tab=vibemap&action=pointsman')
        }
      }
    },
    {
      id: 'list-room',
      title: 'List a Room / Vacancy',
      description: 'Advertise room or bed with zero broker fees',
      icon: Home,
      color: '#d4af37',
      action: () => router.push('/dashboard/housing?tab=create')
    },
    {
      id: 'emergency-trade',
      title: 'Emergency Trade Callout',
      description: 'Find verified local plumber, electrician, locksmith',
      icon: Wrench,
      color: '#3b82f6',
      action: () => router.push('/dashboard/services?tab=trades')
    },
    {
      id: 'lift-club',
      title: 'Offer / Find a Lift',
      description: 'Neighbourhood commute carpooling & rides',
      icon: Car,
      color: '#a855f7',
      action: () => router.push('/dashboard/services?tab=lifts')
    }
  ]

  return (
    <>
      {/* The Kinetic Elevated Action Orb Trigger */}
      <button
        type="button"
        onClick={toggleOpen}
        aria-label="Universal Quick Actions Orb"
        aria-expanded={isOpen}
        className="relative -translate-y-4 w-12 h-12 sm:w-13 sm:h-13 rounded-full bg-black border-2 border-gold-primary flex items-center justify-center text-gold-primary hover:bg-gold-primary/10 transition-transform active:scale-95 touch-target-48 group shrink-0"
      >
        <span className="absolute -inset-1 rounded-full border border-gold-primary/40 animate-ping opacity-30 pointer-events-none" />
        <span className="relative z-10">
          <motion.div
            animate={{ rotate: isOpen ? 45 : 0 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
          >
            <Plus size={24} className="group-hover:scale-110 transition-transform text-gold-primary" />
          </motion.div>
        </span>
      </button>

      {/* Radial Action Modal / Action Matrix Drawer */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-[1200] flex items-end sm:items-center justify-center p-0 sm:p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={toggleOpen}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />

            {/* Modal Card */}
            <motion.div
              initial={{ opacity: 0, y: 40, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 40, scale: 0.96 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="relative w-full max-w-lg bg-black/95 backdrop-blur-3xl border border-white/15 rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 space-y-4 max-h-[85vh] overflow-y-auto no-scrollbar z-10"
            >
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-gold-primary/10 border border-gold-primary/30 flex items-center justify-center text-gold-primary">
                    <Sparkles size={16} />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-white uppercase tracking-wide m-0">
                      Civic Action Matrix
                    </h3>
                    <p className="text-xs text-gray-400 m-0">
                      Instant coordination pulse across The Resident & The Gruvs
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={toggleOpen}
                  className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
                  aria-label="Close action menu"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Grid of Actions */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                {actions.map(act => (
                  <button
                    key={act.id}
                    type="button"
                    onClick={() => handleAction(act.action)}
                    className="p-3.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-gold-primary/40 transition-all text-left flex items-start gap-3 group/item touch-target-44"
                  >
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border mt-0.5"
                      style={{
                        backgroundColor: `${act.color}15`,
                        borderColor: `${act.color}40`,
                        color: act.color
                      }}
                    >
                      <act.icon size={17} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-bold text-white group-hover/item:text-gold-primary transition-colors truncate">
                          {act.title}
                        </span>
                        {act.badge && (
                          <span
                            className="text-[9px] font-black uppercase px-1.5 py-0.2 rounded border shrink-0"
                            style={{
                              backgroundColor: `${act.color}20`,
                              borderColor: act.color,
                              color: act.color
                            }}
                          >
                            {act.badge}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-gray-400 mt-0.5 line-clamp-1 leading-snug">
                        {act.description}
                      </p>
                    </div>
                  </button>
                ))}
              </div>

              <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[11px] text-gray-500">
                <span>Truth Protocol Verified</span>
                <span>Zero Broker Fees</span>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  )
}
