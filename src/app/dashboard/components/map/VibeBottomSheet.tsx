'use client'

import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, MapPin, Navigation, ExternalLink, Calendar, ShieldAlert, Sparkles, Building, Flame, Share2, CheckCircle2 } from 'lucide-react'
import { playTactileSound } from '../../../../utils/tactileSounds'
import Link from 'next/link'

export type VibeType = 'nightlife' | 'housing' | 'safety' | 'chill' | 'poi'

export interface VibeItem {
  id: string
  type: VibeType
  title: string
  subtitle?: string
  description?: string
  lat: number
  lon: number
  vibeScore?: number // 1 to 100
  price?: number
  currency?: string
  badge?: string
  imageUrl?: string
  distanceLabel?: string
  walkTimeMins?: number
  tags?: string[]
  partnerLink?: string
  confirmCount?: number
  disputeCount?: number
  startsAt?: string
}

interface VibeBottomSheetProps {
  item: VibeItem | null
  onClose: () => void
  onDirections?: (item: VibeItem) => void
}

export default function VibeBottomSheet({ item, onClose, onDirections }: VibeBottomSheetProps) {
  if (!item) return null

  const getTheme = () => {
    switch (item.type) {
      case 'nightlife':
        return {
          glow: 'shadow-[0_0_50px_rgba(168,85,247,0.3)]',
          border: 'border-purple-500/40',
          badgeBg: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
          accent: 'text-purple-400',
          btnBg: 'bg-gradient-to-r from-purple-600 to-pink-600 text-white'
        }
      case 'housing':
        return {
          glow: 'shadow-[0_0_50px_rgba(212,175,55,0.3)]',
          border: 'border-gold-primary/40',
          badgeBg: 'bg-gold-primary/20 text-gold-primary border-gold-primary/40',
          accent: 'text-gold-primary',
          btnBg: 'bg-gradient-to-r from-gold-primary to-amber-500 text-black'
        }
      case 'safety':
        return {
          glow: 'shadow-[0_0_50px_rgba(239,68,68,0.3)]',
          border: 'border-red-500/40',
          badgeBg: 'bg-red-500/20 text-red-300 border-red-500/40',
          accent: 'text-red-400',
          btnBg: 'bg-gradient-to-r from-red-600 to-rose-600 text-white'
        }
      case 'chill':
      default:
        return {
          glow: 'shadow-[0_0_50px_rgba(59,130,246,0.3)]',
          border: 'border-blue-500/40',
          badgeBg: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
          accent: 'text-blue-400',
          btnBg: 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white'
        }
    }
  }

  const theme = getTheme()

  const handleShare = () => {
    playTactileSound('chime')
    if (navigator.share) {
      navigator.share({
        title: item.title,
        text: `Check out ${item.title} on The Resident VibeMap!`,
        url: window.location.href
      }).catch(() => {})
    } else {
      navigator.clipboard.writeText(window.location.href)
      alert('Link copied to clipboard!')
    }
  }

  const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${item.lat},${item.lon}`

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 150 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 150 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className={`fixed bottom-4 left-4 right-4 md:left-auto md:right-6 md:w-96 z-[1000] bg-black/90 backdrop-blur-2xl border ${theme.border} rounded-3xl p-5 ${theme.glow} text-white shadow-2xl flex flex-col gap-3.5`}
      >
        {/* Top Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${theme.badgeBg}`}>
                {item.badge || item.type}
              </span>
              {item.vibeScore && (
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 flex items-center gap-1 bg-amber-400/10 px-2 py-0.5 rounded-full border border-amber-400/20">
                  <Flame size={11} className="fill-amber-400" /> {item.vibeScore}% Vibe
                </span>
              )}
            </div>
            <h3 className="text-base font-black tracking-tight leading-snug line-clamp-1">{item.title}</h3>
            {item.subtitle && <p className="text-xs text-gray-400 line-clamp-1">{item.subtitle}</p>}
          </div>

          <button
            onClick={() => {
              playTactileSound('pop')
              onClose()
            }}
            className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-gray-400 hover:text-white transition-all shrink-0"
          >
            <X size={16} />
          </button>
        </div>

        {/* Dynamic Detail Body */}
        {item.description && (
          <p className="text-xs text-gray-300 leading-relaxed line-clamp-2 bg-white/5 p-3 rounded-2xl border border-white/5">
            {item.description}
          </p>
        )}

        {/* Quick Metrics Bar */}
        <div className="grid grid-cols-2 gap-2 bg-white/5 p-2.5 rounded-2xl border border-white/5">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-xl bg-white/10 flex items-center justify-center text-gray-300 shrink-0">
              <MapPin size={14} className={theme.accent} />
            </div>
            <div className="overflow-hidden">
              <span className="text-[9px] text-gray-400 uppercase font-black tracking-wider block">Distance</span>
              <span className="text-xs font-bold text-white truncate block">
                {item.distanceLabel || 'Nearby'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-xl bg-white/10 flex items-center justify-center text-gray-300 shrink-0">
              <Navigation size={14} className="text-emerald-400" />
            </div>
            <div className="overflow-hidden">
              <span className="text-[9px] text-gray-400 uppercase font-black tracking-wider block">Walking Time</span>
              <span className="text-xs font-bold text-emerald-400 truncate block">
                {item.walkTimeMins ? `~${item.walkTimeMins} min walk` : '5-10 min walk'}
              </span>
            </div>
          </div>
        </div>

        {/* Price tag or Party status */}
        {typeof item.price === 'number' && (
          <div className="flex items-center justify-between p-3 rounded-2xl bg-gold-primary/10 border border-gold-primary/30">
            <div>
              <span className="text-[9px] font-black uppercase tracking-wider text-gold-primary block">Monthly Rent</span>
              <span className="text-lg font-black text-white">{item.currency || 'R'} {item.price.toLocaleString()}</span>
            </div>
            <Link
              href="/dashboard/housing"
              className="px-4 py-2 rounded-xl bg-gold-primary text-black font-black text-xs uppercase tracking-wider hover:bg-gold-secondary transition-all active:scale-95"
            >
              View Room
            </Link>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 pt-1">
          <a
            href={googleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => playTactileSound('click')}
            className={`flex-1 py-3 px-4 rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 ${theme.btnBg} shadow-lg active:scale-95 transition-all`}
          >
            <Navigation size={14} /> Navigate Now
          </a>

          {item.partnerLink && (
            <a
              href={item.partnerLink}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => playTactileSound('click')}
              className="py-3 px-3.5 rounded-2xl bg-purple-950/60 hover:bg-purple-900 border border-purple-500/40 text-purple-200 font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 active:scale-95 transition-all"
              title="Open event on The Gruvs"
            >
              <Sparkles size={14} className="text-purple-400" />
              <span className="hidden sm:inline">The Gruvs</span>
            </a>
          )}

          <button
            onClick={handleShare}
            className="p-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-bold transition-all active:scale-95"
            title="Share POI"
          >
            <Share2 size={16} />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
