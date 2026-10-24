'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X, MapPin, Navigation, Sparkles, Flame, Share2, CornerUpRight,
  ThumbsUp, CheckCircle, AlertTriangle, Car, Flag, Home, Zap
} from 'lucide-react'
import { playTactileSound } from '../../../../utils/tactileSounds'
import { verifyZone, type TrafficDensity, type ZoneEventType } from '../../../../utils/mapZones'
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
  trafficDensity?: TrafficDensity | null
  detourHint?: string | null
  eventType?: ZoneEventType
  corridor?: string | null
}

interface VibeBottomSheetProps {
  item: VibeItem | null
  onClose: () => void
  onDirections?: (item: VibeItem) => void
}

export default function VibeBottomSheet({ item, onClose, onDirections }: VibeBottomSheetProps) {
  const [voted, setVoted] = useState<'confirm' | 'dispute' | null>(null)
  const [confirms, setConfirms] = useState<number>(item?.confirmCount || 0)
  const [disputes, setDisputes] = useState<number>(item?.disputeCount || 0)
  const [voting, setVoting] = useState(false)

  // Sync counts when item changes
  React.useEffect(() => {
    if (item) {
      setConfirms(item.confirmCount || 0)
      setDisputes(item.disputeCount || 0)
      setVoted(null)
    }
  }, [item?.id])

  if (!item) return null

  const getTheme = () => {
    switch (item.type) {
      case 'nightlife':
        return {
          border: 'border-purple-500/40',
          badgeBg: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
          accent: 'text-purple-400',
          btnBg: 'bg-gradient-to-r from-purple-600 to-pink-600 text-white'
        }
      case 'housing':
        return {
          border: 'border-gold-primary/40',
          badgeBg: 'bg-gold-primary/20 text-gold-primary border-gold-primary/40',
          accent: 'text-gold-primary',
          btnBg: 'bg-gradient-to-r from-gold-primary to-amber-500 text-black'
        }
      case 'safety':
        return {
          border: 'border-red-500/40',
          badgeBg: 'bg-red-500/20 text-red-300 border-red-500/40',
          accent: 'text-red-400',
          btnBg: 'bg-gradient-to-r from-red-600 to-rose-600 text-white'
        }
      case 'chill':
      default:
        return {
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

  const handleVerify = async (vote: 'confirm' | 'dispute') => {
    if (voted || voting) return
    setVoting(true)
    playTactileSound(vote === 'confirm' ? 'pop' : 'tab')

    // Optimistic update
    if (vote === 'confirm') setConfirms(prev => prev + 1)
    else setDisputes(prev => prev + 1)
    setVoted(vote)

    try {
      await verifyZone(item.id, vote)
    } catch {
      // Revert if network error
      if (vote === 'confirm') setConfirms(prev => Math.max(0, prev - 1))
      else setDisputes(prev => Math.max(0, prev - 1))
      setVoted(null)
    } finally {
      setVoting(false)
    }
  }

  const cleanDirectionsUrl = `https://maps.google.com/?q=${item.lat},${item.lon}`
  const detourDirectionsUrl = item.detourHint
    ? `https://maps.google.com/?q=${encodeURIComponent(item.detourHint)}`
    : cleanDirectionsUrl

  const getTrafficBadge = (density: TrafficDensity) => {
    switch (density) {
      case 'gridlock':
        return { label: 'Complete Street Closure', color: 'text-red-400 bg-red-500/10 border-red-500/30' }
      case 'heavy':
        return { label: 'Heavy Delays (+25m)', color: 'text-amber-400 bg-amber-500/10 border-amber-500/30' }
      case 'moderate':
        return { label: 'Moderate Delays (+10m)', color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30' }
      case 'normal':
      default:
        return { label: 'Normal Traffic Flow', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' }
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 150 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 150 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className={`fixed bottom-20 md:bottom-6 left-3 right-3 md:left-auto md:right-6 md:w-96 z-[1000] bg-black/95 backdrop-blur-2xl border ${theme.border} rounded-3xl p-5 text-white flex flex-col gap-3.5`}
      >
        {/* Top Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${theme.badgeBg}`}>
                {item.badge || item.type}
              </span>
              {item.vibeScore && (
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 flex items-center gap-1 bg-amber-400/10 px-2 py-0.5 rounded-full border border-amber-400/20">
                  <Flame size={11} className="fill-amber-400" /> {item.vibeScore}% Vibe
                </span>
              )}
              {item.trafficDensity && (
                <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${getTrafficBadge(item.trafficDensity).color}`}>
                  {getTrafficBadge(item.trafficDensity).label}
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
            aria-label="Close"
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

        {/* Suggested Detour Bypass Card */}
        {item.detourHint && (
          <div className="p-3 rounded-2xl bg-cyan-950/40 border border-cyan-500/30 flex items-start justify-between gap-3">
            <div className="space-y-0.5">
              <span className="text-[9px] font-black uppercase tracking-wider text-cyan-400 flex items-center gap-1">
                <CornerUpRight size={11} /> Suggested Detour Bypass
              </span>
              <p className="text-xs font-bold text-white">{item.detourHint}</p>
            </div>
            <a
              href={detourDirectionsUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => playTactileSound('click')}
              className="px-2.5 py-1.5 rounded-xl bg-cyan-500 text-black font-black text-[10px] uppercase tracking-wider hover:bg-cyan-400 transition-all shrink-0"
            >
              Route Bypass
            </a>
          </div>
        )}

        {/* Marathon Race Corridor Card */}
        {item.corridor && (
          <div className="p-3 rounded-2xl bg-orange-950/40 border border-orange-500/30 flex items-center gap-2">
            <Flag size={14} className="text-orange-400 shrink-0" />
            <div className="overflow-hidden">
              <span className="text-[9px] font-black uppercase tracking-wider text-orange-400 block">
                Active Race Corridor
              </span>
              <p className="text-xs font-bold text-white truncate">{item.corridor}</p>
            </div>
          </div>
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
                {item.distanceLabel || 'Unknown'}
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
                {item.walkTimeMins === undefined ? 'Too far to walk' : item.walkTimeMins < 1 ? 'Under a minute' : `~${item.walkTimeMins} min walk`}
              </span>
            </div>
          </div>
        </div>

        {/* Truth Protocol Community Verification */}
        {(item.confirmCount !== undefined || item.disputeCount !== undefined) && (
          <div className="flex items-center justify-between gap-2 p-2 rounded-2xl bg-white/5 border border-white/10">
            <span className="text-[10px] font-bold text-gray-400 pl-1">Status Check:</span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => handleVerify('confirm')}
                disabled={voting || voted !== null}
                className={`py-1.5 px-3 rounded-xl border text-[11px] font-black flex items-center gap-1.5 transition-all ${
                  voted === 'confirm'
                    ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300'
                    : 'border-white/10 bg-white/5 text-gray-300 hover:text-white hover:bg-white/10'
                }`}
              >
                <ThumbsUp size={12} /> Still Blocked ({confirms})
              </button>
              <button
                type="button"
                onClick={() => handleVerify('dispute')}
                disabled={voting || voted !== null}
                className={`py-1.5 px-3 rounded-xl border text-[11px] font-black flex items-center gap-1.5 transition-all ${
                  voted === 'dispute'
                    ? 'border-blue-500 bg-blue-500/20 text-blue-300'
                    : 'border-white/10 bg-white/5 text-gray-300 hover:text-white hover:bg-white/10'
                }`}
              >
                <CheckCircle size={12} /> Road Clear ({disputes})
              </button>
            </div>
          </div>
        )}

        {/* Price tag or Housing status */}
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
            href={cleanDirectionsUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => {
              playTactileSound('click')
              onDirections?.(item)
            }}
            className={`flex-1 py-3 px-4 rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 ${theme.btnBg} active:scale-95 transition-all`}
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
