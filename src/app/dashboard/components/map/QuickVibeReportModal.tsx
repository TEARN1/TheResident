'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X, AlertTriangle, Flame, Coffee, Ban, Sparkles, CheckCircle2,
  Car, Flag, Home, Zap
} from 'lucide-react'
import { playTactileSound } from '../../../../utils/tactileSounds'
import {
  reportZone, formatZoneNote, type ReportableZoneKind,
  type TrafficDensity, type ZoneEventType, type PointsmanStatus
} from '../../../../utils/mapZones'

export interface QuickVibeReportModalProps {
  isOpen: boolean
  onClose: () => void
  currentCoords: { lat: number; lon: number } | null
  onReportSuccess: () => void
  tracedWaypoints?: [number, number][] | null
  onStartTracing?: (type: 'marathon' | 'detour') => void
  onClearWaypoints?: () => void
  initialCategory?: VibeCategory
}

export type VibeCategory =
  | 'funeral_closure'
  | 'road_closed'
  | 'heavy_traffic'
  | 'accident'
  | 'dead_robots'
  | 'marathon_route'
  | 'party'
  | 'chill'

export default function QuickVibeReportModal({
  isOpen,
  onClose,
  currentCoords,
  onReportSuccess,
  tracedWaypoints,
  onStartTracing,
  onClearWaypoints,
  initialCategory
}: QuickVibeReportModalProps) {
  const [category, setCategory] = useState<VibeCategory>(initialCategory || 'funeral_closure')
  React.useEffect(() => {
    if (initialCategory) setCategory(initialCategory)
  }, [initialCategory])
  const [title, setTitle] = useState('')
  const [note, setNote] = useState('')
  const [trafficDensity, setTrafficDensity] = useState<TrafficDensity>('gridlock')
  const [detourHint, setDetourHint] = useState('')
  const [corridor, setCorridor] = useState('')
  const [pointsmanStatus, setPointsmanStatus] = useState<PointsmanStatus | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  const vibeOptions: {
    id: VibeCategory
    label: string
    icon: React.ComponentType<{ size?: number; className?: string }>
    color: string
    border: string
    zoneKind: ReportableZoneKind
    eventType: ZoneEventType
    durationHours: number
    defaultTitle: string
    defaultTraffic: TrafficDensity
  }[] = [
    {
      id: 'funeral_closure',
      label: 'Funeral / Street Tent',
      icon: Home,
      color: 'text-purple-400',
      border: 'border-purple-500/40 bg-purple-500/10',
      zoneKind: 'road_closed',
      eventType: 'funeral',
      durationHours: 48,
      defaultTitle: 'Funeral Gathering / Street Tent Closure',
      defaultTraffic: 'gridlock'
    },
    {
      id: 'road_closed',
      label: 'Road Closed / Barricade',
      icon: Ban,
      color: 'text-red-400',
      border: 'border-red-500/40 bg-red-500/10',
      zoneKind: 'road_closed',
      eventType: 'roadwork',
      durationHours: 24,
      defaultTitle: 'Road Closed / Construction Block',
      defaultTraffic: 'gridlock'
    },
    {
      id: 'heavy_traffic',
      label: 'Traffic Jam / Congestion',
      icon: Car,
      color: 'text-amber-400',
      border: 'border-amber-500/40 bg-amber-500/10',
      zoneKind: 'heavy_traffic',
      eventType: 'general',
      durationHours: 4,
      defaultTitle: 'Heavy Traffic Congestion / Delays',
      defaultTraffic: 'heavy'
    },
    {
      id: 'accident',
      label: 'Accident / Collision',
      icon: AlertTriangle,
      color: 'text-rose-400',
      border: 'border-rose-500/40 bg-rose-500/10',
      zoneKind: 'alert',
      eventType: 'accident',
      durationHours: 4,
      defaultTitle: 'Traffic Accident / Collision Scene',
      defaultTraffic: 'heavy'
    },
    {
      id: 'dead_robots',
      label: 'Dead Robots (Lights Out)',
      icon: Zap,
      color: 'text-yellow-400',
      border: 'border-yellow-500/40 bg-yellow-500/10',
      zoneKind: 'alert',
      eventType: 'dead_robots',
      durationHours: 8,
      defaultTitle: 'Traffic Lights Dead / Power Outage',
      defaultTraffic: 'moderate'
    },
    {
      id: 'marathon_route',
      label: 'Marathon / Race Route',
      icon: Flag,
      color: 'text-orange-400',
      border: 'border-orange-500/40 bg-orange-500/10',
      zoneKind: 'route',
      eventType: 'marathon',
      durationHours: 12,
      defaultTitle: 'Marathon / Fun Run Route Closure',
      defaultTraffic: 'gridlock'
    },
    {
      id: 'party',
      label: 'Street Bash / Live Vibe',
      icon: Flame,
      color: 'text-pink-400',
      border: 'border-pink-500/40 bg-pink-500/10',
      zoneKind: 'zone',
      eventType: 'party',
      durationHours: 10,
      defaultTitle: 'Street Bash / Outdoor Music Gathering',
      defaultTraffic: 'moderate'
    },
    {
      id: 'chill',
      label: 'Chill Study / Wi-Fi Hub',
      icon: Coffee,
      color: 'text-blue-400',
      border: 'border-blue-500/40 bg-blue-500/10',
      zoneKind: 'zone',
      eventType: 'general',
      durationHours: 12,
      defaultTitle: 'Quiet Co-Working / Wi-Fi Study Hub',
      defaultTraffic: 'normal'
    }
  ]

  const selectedOpt = vibeOptions.find(o => o.id === category) || vibeOptions[0]

  const handleCategorySelect = (opt: typeof vibeOptions[0]) => {
    playTactileSound('click')
    setCategory(opt.id)
    setTrafficDensity(opt.defaultTraffic)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentCoords) {
      setError('Please tap a location on the map or enable GPS to drop a report.')
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      playTactileSound('success')

      const formattedNote = formatZoneNote({
        userNote: note.trim() || undefined,
        trafficDensity,
        detourHint: detourHint.trim() || undefined,
        eventType: selectedOpt.eventType,
        corridor: corridor.trim() || undefined,
        pointsmanStatus: category === 'dead_robots' ? pointsmanStatus : null,
        routeCoordinates: category === 'marathon_route' && tracedWaypoints && tracedWaypoints.length >= 2 ? tracedWaypoints : null,
        detourCoordinates: detourHint && tracedWaypoints && tracedWaypoints.length >= 2 ? tracedWaypoints : null
      })

      await reportZone({
        kind: selectedOpt.zoneKind,
        lat: currentCoords.lat,
        lon: currentCoords.lon,
        durationHours: selectedOpt.durationHours,
        label: title.trim() || selectedOpt.defaultTitle,
        note: formattedNote || undefined
      })

      onReportSuccess()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not broadcast report.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[1001] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/85 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          drag="y"
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={{ top: 0, bottom: 0.5 }}
          onDragEnd={(e, info) => {
            if (info.offset.y > 80 || info.velocity.y > 250) {
              playTactileSound('pop')
              onClose()
            }
          }}
          className="relative w-full max-w-lg max-h-[90dvh] overflow-y-auto custom-scrollbar bg-black/95 border border-gold-primary/30 rounded-t-3xl sm:rounded-3xl p-4 sm:p-6 backdrop-blur-2xl pb-[max(env(safe-area-inset-bottom),1.5rem)]"
        >
          {/* Mobile Drag Indicator */}
          <div className="sm:hidden w-12 h-1.5 bg-white/20 rounded-full mx-auto -mt-1 mb-2 shrink-0 cursor-grab active:cursor-grabbing" />
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-gold-primary to-amber-500 flex items-center justify-center text-black font-black">
                <Sparkles size={20} />
              </div>
              <div>
                <h3 className="text-base font-black text-white tracking-tight">Drop Living Map Report</h3>
                <p className="text-[11px] text-gray-400">Shared between The Resident & The Gruvs in real time</p>
              </div>
            </div>
            <button
              onClick={() => {
                playTactileSound('pop')
                onClose()
              }}
              className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-gray-400 hover:text-white transition-all"
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Category selection */}
            <div>
              <label className="text-[10px] text-gray-400 uppercase font-black tracking-wider block mb-2">
                Select Report / Closure Kind
              </label>
              <div className="grid grid-cols-2 gap-2">
                {vibeOptions.map(opt => {
                  const isSelected = category === opt.id
                  const Icon = opt.icon
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => handleCategorySelect(opt)}
                      className={`p-2.5 rounded-2xl border text-left flex items-center gap-2.5 transition-all ${
                        isSelected
                          ? `${opt.border} ring-1 ring-gold-primary/40`
                          : 'bg-white/5 border-white/5 text-gray-400 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      <div className="shrink-0">
                        <Icon size={18} className={opt.color} />
                      </div>
                      <div className="overflow-hidden">
                        <span className="text-xs font-bold text-white block truncate">{opt.label}</span>
                        <span className="text-[10px] text-gray-400 block">{opt.durationHours}h live</span>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Host Traffic & Crowd Prediction */}
            <div className="space-y-1.5 p-3 rounded-2xl bg-white/5 border border-white/10">
              <label className="text-[10px] text-gray-300 uppercase font-black tracking-wider flex items-center justify-between">
                <span>Predicted Traffic & Busyness</span>
                <span className="text-gold-primary">{trafficDensity.toUpperCase()}</span>
              </label>
              <div className="grid grid-cols-4 gap-1.5">
                {[
                  { key: 'normal' as TrafficDensity, label: '🟢 Normal' },
                  { key: 'moderate' as TrafficDensity, label: '🟡 +10m' },
                  { key: 'heavy' as TrafficDensity, label: '🟠 +25m' },
                  { key: 'gridlock' as TrafficDensity, label: '🔴 Blocked' }
                ].map(item => {
                  const active = trafficDensity === item.key
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => {
                        playTactileSound('click')
                        setTrafficDensity(item.key)
                      }}
                      className={`py-2 px-1 text-center rounded-xl border text-[11px] font-bold transition-all ${
                        active
                          ? 'border-gold-primary bg-gold-primary/20 text-gold-primary'
                          : 'border-white/10 bg-white/5 text-gray-400 hover:text-white'
                      }`}
                    >
                      {item.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Title / Label */}
            <div className="space-y-1">
              <label className="text-[10px] text-gray-400 uppercase font-black tracking-wider">
                Title / Location Tag
              </label>
              <input
                type="text"
                placeholder={selectedOpt.defaultTitle}
                value={title}
                onChange={e => setTitle(e.target.value)}
                maxLength={80}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-gold-primary/50"
              />
            </div>

            {/* Pointsman Status for Dead Robots */}
            {category === 'dead_robots' && (
              <div className="space-y-1.5 p-3 rounded-2xl bg-yellow-500/10 border border-yellow-500/30">
                <label className="text-[10px] text-yellow-300 uppercase font-black tracking-wider block">
                  Intersection Traffic Control (Pointsman Status)
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { key: 'police' as PointsmanStatus, label: '👮 Metro Police' },
                    { key: 'volunteer' as PointsmanStatus, label: '🦺 Volunteer Pointsman' },
                    { key: 'none' as PointsmanStatus, label: '⚠️ None (4-Way Stop)' },
                  ].map(p => {
                    const active = pointsmanStatus === p.key;
                    return (
                      <button
                        key={p.key}
                        type="button"
                        onClick={() => {
                          playTactileSound('click');
                          setPointsmanStatus(active ? null : p.key);
                        }}
                        className={`py-2 px-1 text-center rounded-xl border text-[10px] font-bold transition-all ${
                          active
                            ? 'border-yellow-400 bg-yellow-400/20 text-yellow-300'
                            : 'border-white/10 bg-white/5 text-gray-400 hover:text-white'
                        }`}
                      >
                        {p.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Detour Suggestion */}
            <div className="space-y-1">
              <label className="text-[10px] text-gray-400 uppercase font-black tracking-wider">
                Suggested Alternate Route / Bypass (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Avoid 4th Ave via 7th Ave bypass"
                value={detourHint}
                onChange={e => setDetourHint(e.target.value)}
                maxLength={100}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white outline-none focus:border-gold-primary/50"
              />
            </div>

            {/* Marathon Corridor & Interactive Map Tracing */}
            {category === 'marathon_route' && (
              <div className="space-y-2 p-3 rounded-2xl bg-orange-500/10 border border-orange-500/30">
                <label className="text-[10px] text-orange-300 uppercase font-black tracking-wider block">
                  Course Corridor & Route Plotting
                </label>
                <input
                  type="text"
                  placeholder="e.g. Start Main Gate → 3rd Ave Loop → Stadium Finish"
                  value={corridor}
                  onChange={e => setCorridor(e.target.value)}
                  maxLength={120}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white outline-none focus:border-gold-primary/50"
                />

                <div className="flex items-center justify-between gap-2 pt-1">
                  <span className="text-[11px] text-gray-300">
                    {tracedWaypoints && tracedWaypoints.length >= 2
                      ? `📍 ${tracedWaypoints.length} Course Waypoints Traced`
                      : 'Trace course corridor by tapping on map'}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {tracedWaypoints && tracedWaypoints.length >= 2 && onClearWaypoints && (
                      <button
                        type="button"
                        onClick={onClearWaypoints}
                        className="px-2.5 py-1 rounded-xl bg-white/10 text-gray-300 hover:text-white text-[10px] font-bold"
                      >
                        Clear
                      </button>
                    )}
                    {onStartTracing && (
                      <button
                        type="button"
                        onClick={() => {
                          playTactileSound('click');
                          onStartTracing('marathon');
                        }}
                        className="px-3 py-1.5 rounded-xl bg-orange-500 text-black font-black text-[11px] uppercase tracking-wider hover:bg-orange-400 transition-all"
                      >
                        {tracedWaypoints && tracedWaypoints.length >= 2 ? 'Edit Traced Course' : 'Trace On Map ↗'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Details Note */}
            <div className="space-y-1">
              <label className="text-[10px] text-gray-400 uppercase font-black tracking-wider">
                Additional Notes
              </label>
              <textarea
                rows={2}
                placeholder="e.g. Tents erected on street, marshals redirecting traffic, expect delays until 18:00..."
                value={note}
                onChange={e => setNote(e.target.value)}
                maxLength={200}
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
              className="w-full py-3.5 bg-gold-primary hover:bg-gold-secondary text-black font-black text-xs uppercase tracking-wider rounded-xl transition-all border border-gold-primary flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
            >
              <CheckCircle2 size={16} /> {submitting ? 'Broadcasting to Living Map...' : 'Broadcast to Map'}
            </button>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
