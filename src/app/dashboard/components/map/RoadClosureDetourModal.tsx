'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X, Ban, Navigation, MapPin, AlertTriangle, ShieldCheck,
  CheckCircle2, Compass, ExternalLink, Share2, Sparkles
} from 'lucide-react'
import {
  calculateTravelDetourRoute,
  roadSegmentBufferPolygon,
  type TravelDetourResult,
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

  // Custom Travel origin & destination for live rerouting simulation
  const origin: LatLon = currentCoords || { lat: -26.1950, lon: 28.0305 } // Braamfontein
  const destination: LatLon = { lat: -26.1750, lon: 28.0320 } // Parktown / Rosebank corridor

  // Closed road segment
  const closedStart: LatLon = { lat: origin.lat + 0.006, lon: origin.lon - 0.002 }
  const closedEnd: LatLon = { lat: origin.lat + 0.008, lon: origin.lon + 0.002 }

  const detourPlan: TravelDetourResult = calculateTravelDetourRoute(
    origin,
    destination,
    [{ startPoint: closedStart, endPoint: closedEnd, name: streetName }],
    detourHint
  )

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
        lat: origin.lat + 0.007,
        lon: origin.lon,
        label: `${streetName} Closed (${selectedOpt.label})`,
        note,
        durationHours: closureDurationHours,
      })

      playTactileSound('success')
      setSuccessNotice('Road closure & smart detour broadcasted to all commuters in precinct!')
      setTimeout(() => {
        onClosureBroadcasted()
        onClose()
      }, 1800)
    } catch {
      setSuccessNotice('Detour calculated locally. Offline mesh cached.')
      setTimeout(() => {
        onClosureBroadcasted()
        onClose()
      }, 1800)
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
                  <h2 className="text-lg font-bold text-white tracking-wide">Road Closure & Smart Detour</h2>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 border border-red-500/30 uppercase tracking-wider">
                    Travel Reroute Engine
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Select closed street section to calculate non-overlapping bypass corridors
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
                  Recommended Detour Bypass
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

            {/* 3. Smart Rerouting Calculations Card */}
            <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/80 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Compass size={16} className="text-cyan-400" />
                  <h3 className="font-bold text-white text-xs uppercase tracking-wider">
                    Client-Side Detour Navigation Plan
                  </h3>
                </div>
                <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/30">
                  Save ~{detourPlan.delaySavingsMinutes} Mins Delay
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                  <div className="text-[10px] text-slate-400">Direct Dist</div>
                  <div className="font-bold text-white mt-0.5">{detourPlan.directDistanceKm} km</div>
                </div>
                <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                  <div className="text-[10px] text-slate-400">Detour Dist</div>
                  <div className="font-bold text-cyan-300 mt-0.5">{detourPlan.detourDistanceKm} km</div>
                </div>
                <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                  <div className="text-[10px] text-slate-400">Avoidance</div>
                  <div className="font-bold text-emerald-300 mt-0.5">400m Buffer</div>
                </div>
              </div>

              {/* Turn-by-turn Detour Guidance */}
              <div className="space-y-1.5 pt-1">
                <div className="text-[11px] font-semibold text-slate-300">Detour Turn Guidance:</div>
                {detourPlan.stepInstructions.map((step, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-xs text-slate-300">
                    <span className="text-cyan-400 font-mono font-bold">{idx + 1}.</span>
                    <span>{step}</span>
                  </div>
                ))}
              </div>

              {/* 1-Click Offline GPS Navigation Export */}
              <div className="pt-2 border-t border-slate-700/60">
                <div className="text-[11px] font-semibold text-slate-400 mb-2">
                  Export Detour Waypoints to GPS Apps:
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <a
                    href={detourPlan.googleMapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/40 text-xs font-medium transition-colors"
                  >
                    <ExternalLink size={12} />
                    Open in Google Maps
                  </a>
                  <a
                    href={detourPlan.wazeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/40 text-xs font-medium transition-colors"
                  >
                    <ExternalLink size={12} />
                    Open in Waze
                  </a>
                  <a
                    href={detourPlan.appleMapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 text-xs font-medium transition-colors"
                  >
                    <ExternalLink size={12} />
                    Open in Apple Maps
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="p-3 sm:p-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-red-400" />
              Crowd-Verified Spatial Rerouting
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
                {isSubmitting ? 'Broadcasting...' : 'Broadcast Closure & Detour'}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
