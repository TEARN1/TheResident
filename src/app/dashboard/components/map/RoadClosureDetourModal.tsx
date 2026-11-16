'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X,
  Ban,
  ShieldCheck,
  CheckCircle2
} from 'lucide-react'
import {
  type LatLon
} from '../../../../utils/futureMap'
import { reportZone, formatZoneNote, type ReportableZoneKind } from '../../../../utils/mapZones'
import { playTactileSound } from '../../../../utils/tactileSounds'

interface RoadClosureDetourModalProps {
  isOpen: boolean
  onClose: () => void
  currentCoords: LatLon | null
  onClosureBroadcasted: () => void
}

export type ClosureReasonType =
  | 'protest'
  | 'funeral'
  | 'marathon'
  | 'water_burst'
  | 'construction'
  | 'dead_robots'
  | 'roadblock'

export default function RoadClosureDetourModal({
  isOpen,
  onClose,
  currentCoords,
  onClosureBroadcasted
}: RoadClosureDetourModalProps) {
  const [streetName, setStreetName] = useState('Jan Smuts Ave')
  const [closureReason, setClosureReason] = useState<ClosureReasonType>('protest')
  const [detourHint, setDetourHint] = useState('Bypass via Oxford Rd / 7th Ave')
  const [closureDurationHours, setClosureDurationHours] = useState<number>(6)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [successNotice, setSuccessNotice] = useState<string | null>(null)


  if (!isOpen) return null

  const closureOptions: {
    id: ClosureReasonType
    label: string
    color: string
    border: string
    zoneKind: ReportableZoneKind
    defaultDuration: number
  }[] = [
    {
      id: 'protest',
      label: 'Civic / Service Delivery Strike',
      color: 'text-red-400',
      border: 'border-red-500/40 bg-red-500/10',
      zoneKind: 'road_closed',
      defaultDuration: 6,
    },
    {
      id: 'funeral',
      label: 'Funeral / Street Tent',
      color: 'text-purple-400',
      border: 'border-purple-500/40 bg-purple-500/10',
      zoneKind: 'road_closed',
      defaultDuration: 48,
    },
    {
      id: 'dead_robots',
      label: 'Dead Robots / Traffic Lights Out',
      color: 'text-amber-400',
      border: 'border-amber-500/40 bg-amber-500/10',
      zoneKind: 'heavy_traffic',
      defaultDuration: 4,
    },
    {
      id: 'water_burst',
      label: 'Burst Main Pipe / Sinkhole',
      color: 'text-cyan-400',
      border: 'border-cyan-500/40 bg-cyan-500/10',
      zoneKind: 'road_closed',
      defaultDuration: 24,
    },
    {
      id: 'marathon',
      label: 'Marathon / Race Route',
      color: 'text-orange-400',
      border: 'border-orange-500/40 bg-orange-500/10',
      zoneKind: 'road_closed',
      defaultDuration: 8,
    },
    {
      id: 'construction',
      label: 'Road Resurfacing / Construction',
      color: 'text-yellow-400',
      border: 'border-yellow-500/40 bg-yellow-500/10',
      zoneKind: 'road_closed',
      defaultDuration: 72,
    },
    {
      id: 'roadblock',
      label: 'JMPD / Metro Police Roadblock',
      color: 'text-blue-400',
      border: 'border-blue-500/40 bg-blue-500/10',
      zoneKind: 'heavy_traffic',
      defaultDuration: 4,
    },
  ]

  const handleBroadcastClosure = async () => {
    // Pin it where the person is (or tapped). It used to be dropped 780 m
    // north of them, and fell back to Braamfontein without a location.
    if (!currentCoords) {
      setSuccessNotice('Waiting for your location. Tap the map where the road is closed, then try again.')
      return
    }
    setIsSubmitting(true)
    playTactileSound('click')
    try {
      const selectedOpt = closureOptions.find(o => o.id === closureReason) || closureOptions[0]
      const note = formatZoneNote({
        userNote: `Road section closed: ${streetName}. Rerouting active.`,
        trafficDensity: 'gridlock',
        detourHint,
        eventType: closureReason === 'dead_robots' ? 'dead_robots' : 'roadwork',
        corridor: streetName,
        pointsmanStatus: 'none',
      })

      await reportZone({
        kind: selectedOpt.zoneKind,
        lat: currentCoords.lat,
        lon: currentCoords.lon,
        label: `${streetName} Closed (${selectedOpt.label})`,
        note,
        durationHours: closureDurationHours,
      })

      playTactileSound('success')
      setSuccessNotice('Closure added to the map for people near you.')
      setTimeout(() => {
        onClosureBroadcasted()
        onClose()
      }, 1800)
    } catch {
      // It used to say "Offline mesh cached" here and close as if it worked.
      setSuccessNotice("Couldn't save the closure. Check your connection and try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="relative w-full max-w-2xl max-h-[92vh] flex flex-col rounded-2xl bg-slate-900 border border-red-500/30 shadow-2xl overflow-hidden text-slate-100"
        >
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-900/90 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-400">
                <Ban size={22} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-white tracking-wide">Report a road closure</h2>
                </div>
                <p className="text-xs text-slate-400">
                  Tell neighbours which road is closed and how to get around it
                </p>
              </div>
            </div>
            <button
              onClick={() => { playTactileSound('pop'); onClose() }}
              className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Feedback banner */}
          {successNotice && (
            <div className="bg-emerald-950/70 border-b border-emerald-500/40 px-4 py-2.5 text-xs text-emerald-300 flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
              <span>{successNotice}</span>
            </div>
          )}

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
            {/* 1. Reason Selection */}
            <div>
              <label className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2 block">
                Select Closure Event Type
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {closureOptions.map(opt => (
                  <button
                    key={opt.id}
                    onClick={() => {
                      playTactileSound('click')
                      setClosureReason(opt.id)
                      setClosureDurationHours(opt.defaultDuration)
                    }}
                    className={`p-2.5 rounded-xl text-left border text-xs transition-all ${
                      closureReason === opt.id
                        ? `${opt.border} text-white font-semibold shadow-md`
                        : 'bg-slate-800/40 border-slate-700/60 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <div className={opt.color}>{opt.label}</div>
                    <div className="text-[10px] text-slate-500 mt-1">Est. {opt.defaultDuration} hours</div>
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Street Input & Detour Hint */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-400 font-medium block mb-1">
                  Closed Street / Section
                </label>
                <input
                  type="text"
                  value={streetName}
                  onChange={e => setStreetName(e.target.value)}
                  placeholder="e.g. Jan Smuts Ave between Empire & 7th"
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-white focus:border-red-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 font-medium block mb-1">
                  Way around it (optional)
                </label>
                <input
                  type="text"
                  value={detourHint}
                  onChange={e => setDetourHint(e.target.value)}
                  placeholder="e.g. Turn onto Oxford Rd / 7th Ave"
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-white focus:border-red-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Where the report goes. A "smart detour" card sat here: it routed
                everyone to a fixed Parktown address around an invented closed
                segment 700 m north of them and showed made-up time savings. */}
            <p className="text-xs text-slate-400">
              The closure is pinned {currentCoords ? 'where you tapped the map, or at your location' : 'once the map knows where you are'}, and shows for people near you. Use your maps app for directions.
            </p>
          </div>

          {/* Footer */}
          <div className="p-3 sm:p-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-red-400" />
              Reported by people near you
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => { playTactileSound('pop'); onClose() }}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleBroadcastClosure}
                disabled={isSubmitting}
                className="px-4 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold transition-colors disabled:opacity-50"
              >
                {isSubmitting ? 'Saving…' : 'Add to map'}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
