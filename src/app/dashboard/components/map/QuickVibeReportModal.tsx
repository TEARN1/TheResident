'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, AlertTriangle, Flame, ShieldCheck, Coffee, Ban, Navigation, Sparkles, CheckCircle2 } from 'lucide-react'
import { playTactileSound } from '../../../../utils/tactileSounds'
import { reportZone, type ReportableZoneKind } from '../../../../utils/mapZones'

interface QuickVibeReportModalProps {
  isOpen: boolean
  onClose: () => void
  currentCoords: { lat: number; lon: number } | null
  onReportSuccess: () => void
}

type VibeCategory = 'party' | 'hazard' | 'chill' | 'caution'

export default function QuickVibeReportModal({
  isOpen,
  onClose,
  currentCoords,
  onReportSuccess
}: QuickVibeReportModalProps) {
  const [category, setCategory] = useState<VibeCategory>('party')
  const [title, setTitle] = useState('')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  const vibeOptions = [
    {
      id: 'party' as VibeCategory,
      label: 'Live Party / Vibe',
      icon: Flame,
      color: 'text-purple-400',
      border: 'border-purple-500/40 bg-purple-500/10',
      zoneKind: 'zone' as ReportableZoneKind,
      defaultTitle: 'Live Music / Nightlife Hotspot'
    },
    {
      id: 'hazard' as VibeCategory,
      label: 'Road Hazard / Block',
      icon: Ban,
      color: 'text-red-400',
      border: 'border-red-500/40 bg-red-500/10',
      zoneKind: 'road_closed' as ReportableZoneKind,
      defaultTitle: 'Road Closed / Construction Block'
    },
    {
      id: 'caution' as VibeCategory,
      label: 'Safety Caution',
      icon: AlertTriangle,
      color: 'text-amber-400',
      border: 'border-amber-500/40 bg-amber-500/10',
      zoneKind: 'detour' as ReportableZoneKind,
      defaultTitle: 'Dark Street / Poor Lighting Caution'
    },
    {
      id: 'chill' as VibeCategory,
      label: 'Chill Study / Coffee',
      icon: Coffee,
      color: 'text-blue-400',
      border: 'border-blue-500/40 bg-blue-500/10',
      zoneKind: 'zone' as ReportableZoneKind,
      defaultTitle: 'Quiet Co-Working / Wi-Fi Hub'
    }
  ]

  const selectedOpt = vibeOptions.find(o => o.id === category) || vibeOptions[0]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentCoords) {
      setError('Please tap a location on the map or enable GPS to drop a vibe.')
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      playTactileSound('success')
      await reportZone({
        kind: selectedOpt.zoneKind,
        lat: currentCoords.lat,
        lon: currentCoords.lon,
        durationHours: category === 'party' ? 6 : category === 'hazard' ? 8 : 12,
        label: title.trim() || selectedOpt.defaultTitle,
        note: note.trim() || undefined
      })

      onReportSuccess()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not drop vibe.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[1001] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-md bg-black/95 border border-gold-primary/30 rounded-3xl p-6 shadow-[0_0_50px_rgba(212,175,55,0.2)] backdrop-blur-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-gold-primary to-amber-500 flex items-center justify-center text-black font-black">
                <Sparkles size={20} />
              </div>
              <div>
                <h3 className="text-base font-black text-white tracking-tight">Drop A Pulse</h3>
                <p className="text-[11px] text-gray-400">Share live vibes, safety alerts or hangouts with residents</p>
              </div>
            </div>
            <button
              onClick={() => {
                playTactileSound('pop')
                onClose()
              }}
              className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-gray-400 hover:text-white transition-all"
            >
              <X size={16} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Category selection */}
            <div className="grid grid-cols-2 gap-2">
              {vibeOptions.map(opt => {
                const isSelected = category === opt.id
                const Icon = opt.icon
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      playTactileSound('click')
                      setCategory(opt.id)
                    }}
                    className={`p-3 rounded-2xl border text-left flex flex-col gap-1.5 transition-all ${
                      isSelected
                        ? `${opt.border} shadow-lg shadow-black/50`
                        : 'bg-white/5 border-white/5 text-gray-400 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <Icon size={18} className={opt.color} />
                    <span className="text-xs font-bold text-white">{opt.label}</span>
                  </button>
                )
              })}
            </div>

            {/* Title / Label */}
            <div className="space-y-1">
              <label className="text-[10px] text-gray-400 uppercase font-black tracking-wider">Spot Name / Alert Title</label>
              <input
                type="text"
                placeholder={selectedOpt.defaultTitle}
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-gold-primary/50"
              />
            </div>

            {/* Details Note */}
            <div className="space-y-1">
              <label className="text-[10px] text-gray-400 uppercase font-black tracking-wider">Helpful details (optional)</label>
              <textarea
                rows={2}
                placeholder="e.g. Great afrobeat DJ playing, safe walk home, road blocked by fallen branch..."
                value={note}
                onChange={e => setNote(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white outline-none focus:border-gold-primary/50 resize-none"
              />
            </div>

            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-300 font-bold flex items-center gap-2">
                <AlertTriangle size={14} className="shrink-0" /> {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 bg-gold-primary hover:bg-gold-secondary text-black font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-gold-primary/20 flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
            >
              <CheckCircle2 size={16} /> {submitting ? 'Broadcasting...' : 'Broadcast Pulse'}
            </button>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
