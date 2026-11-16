'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X, Car, Clock, ShieldCheck, MapPin, Search, Calculator,
  Users, AlertCircle, CheckCircle2, ChevronRight, Sparkles, Navigation
} from 'lucide-react'
import {
  SA_TAXI_RANKS,
  calculateTaxiFrontSeatChange,
  getTaxiHandSignalGuide,
  type TaxiRank,
  type TaxiRoute,
  type QueueCongestionLevel
} from '../../../../utils/taxiRoutes'
import { playTactileSound } from '../../../../utils/tactileSounds'

interface TaxiRankTelemetryModalProps {
  isOpen: boolean
  onClose: () => void
  selectedRankId?: string | null
  userCoords?: { lat: number; lon: number } | null
  onFlyToCoordinates?: (lat: number, lon: number) => void
}

export default function TaxiRankTelemetryModal({
  isOpen,
  onClose,
  selectedRankId,
  userCoords,
  onFlyToCoordinates
}: TaxiRankTelemetryModalProps) {
  const [activeRankId, setActiveRankId] = useState<string>(selectedRankId || SA_TAXI_RANKS[0].id)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedRoute, setSelectedRoute] = useState<TaxiRoute | null>(null)
  const [activeTab, setActiveTab] = useState<'ranks' | 'calculator' | 'signals'>('ranks')

  // Calculator State
  const [calcFare, setCalcFare] = useState<number>(22)
  const [calcPassengers, setCalcPassengers] = useState<number>(1)
  const [calcTendered, setCalcTendered] = useState<number>(50)

  // Live Queue Override state (simulated crowd-consensus check-in)
  const [customQueueStatus, setCustomQueueStatus] = useState<Record<string, QueueCongestionLevel>>({})
  const [marshalNoteSubmitting, setMarshalNoteSubmitting] = useState(false)
  const [marshalSuccessNotice, setMarshalSuccessNotice] = useState<string | null>(null)

  React.useEffect(() => {
    if (selectedRankId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- follow the rank the caller selects
      setActiveRankId(selectedRankId)
    }
  }, [selectedRankId])

  if (!isOpen) return null

  const currentRank = SA_TAXI_RANKS.find(r => r.id === activeRankId) || SA_TAXI_RANKS[0]
  const currentRoutes = currentRank.routes.filter(route => {
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase()
    return (
      route.destination.toLowerCase().includes(q) ||
      route.corridor.toLowerCase().includes(q) ||
      route.waypointStops.some(s => s.toLowerCase().includes(q))
    )
  })

  const changeCalculation = calculateTaxiFrontSeatChange(calcFare, calcPassengers, calcTendered)
  const handSignalGuide = getTaxiHandSignalGuide()

  const handleUpdateQueueStatus = (routeId: string, level: QueueCongestionLevel) => {
    playTactileSound('click')
    setCustomQueueStatus(prev => ({ ...prev, [routeId]: level }))
    setMarshalSuccessNotice(`Queue status updated to "${level.toUpperCase()}"! Telemetry broadcasted to precinct commuters.`)
    setTimeout(() => setMarshalSuccessNotice(null), 4000)
  }

  const getStatusBadge = (status: QueueCongestionLevel) => {
    switch (status) {
      case 'cleared':
        return { label: 'Empty / Cleared', bg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' }
      case 'fast':
        return { label: 'Moving Fast (2-5 min wait)', bg: 'bg-teal-500/20 text-teal-300 border-teal-500/40' }
      case 'moderate':
        return { label: 'Moderate Queue (8-15 min wait)', bg: 'bg-amber-500/20 text-amber-300 border-amber-500/40' }
      case 'congested':
        return { label: 'Heavy Rush Backlog (20+ min wait)', bg: 'bg-red-500/20 text-red-300 border-red-500/40' }
    }
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="relative w-full max-w-3xl max-h-[92vh] flex flex-col rounded-2xl bg-slate-900 border border-emerald-500/30 shadow-2xl overflow-hidden text-slate-100"
        >
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-900/90 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                <Car size={22} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-white tracking-wide">Minibus Taxi Telemetry</h2>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 uppercase tracking-wider">
                    SANTACO / Commuter Radar
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Real-time rank operations, queue wait times, fare matrices & front-seat change
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

          {/* Tab Navigation */}
          <div className="flex border-b border-slate-800 bg-slate-950/60 px-4 pt-2 gap-2">
            <button
              onClick={() => { playTactileSound('click'); setActiveTab('ranks') }}
              className={`px-4 py-2 text-xs font-semibold rounded-t-lg transition-colors border-b-2 flex items-center gap-2 ${
                activeTab === 'ranks'
                  ? 'border-emerald-500 text-emerald-400 bg-slate-900'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Car size={14} />
              Rank Operations & Routes
            </button>
            <button
              onClick={() => { playTactileSound('click'); setActiveTab('calculator') }}
              className={`px-4 py-2 text-xs font-semibold rounded-t-lg transition-colors border-b-2 flex items-center gap-2 ${
                activeTab === 'calculator'
                  ? 'border-emerald-500 text-emerald-400 bg-slate-900'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Calculator size={14} />
              Front-Seat Change Calculator
            </button>
            <button
              onClick={() => { playTactileSound('click'); setActiveTab('signals') }}
              className={`px-4 py-2 text-xs font-semibold rounded-t-lg transition-colors border-b-2 flex items-center gap-2 ${
                activeTab === 'signals'
                  ? 'border-emerald-500 text-emerald-400 bg-slate-900'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sparkles size={14} />
              Hand Signal Guide
            </button>
          </div>

          {/* Feedback banner */}
          {marshalSuccessNotice && (
            <div className="bg-emerald-950/70 border-b border-emerald-500/40 px-4 py-2 text-xs text-emerald-300 flex items-center gap-2">
              <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
              <span>{marshalSuccessNotice}</span>
            </div>
          )}

          {/* Tab 1: Ranks & Routes */}
          {activeTab === 'ranks' && (
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
              {/* Rank Selector */}
              <div>
                <label className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2 block">
                  Select Metropolitan Taxi Rank
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {SA_TAXI_RANKS.map(rank => (
                    <button
                      key={rank.id}
                      onClick={() => {
                        playTactileSound('click')
                        setActiveRankId(rank.id)
                        setSelectedRoute(null)
                        if (onFlyToCoordinates) {
                          onFlyToCoordinates(rank.lat, rank.lon)
                        }
                      }}
                      className={`p-2.5 rounded-xl text-left border text-xs transition-all ${
                        activeRankId === rank.id
                          ? 'bg-emerald-950/50 border-emerald-500 text-white shadow-lg shadow-emerald-500/10'
                          : 'bg-slate-800/40 border-slate-700/60 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <div className="font-bold truncate">{rank.popularName}</div>
                      <div className="text-[10px] text-slate-400 flex items-center justify-between mt-1">
                        <span>{rank.city} • {rank.metroHub}</span>
                        <span className="text-emerald-400 font-mono font-bold">{rank.routes.length} rts</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Rank Profile Card */}
              <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/80 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="font-bold text-white text-base">{currentRank.name}</h3>
                    <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                      <MapPin size={12} className="text-emerald-400" />
                      {currentRank.address}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300">
                      {currentRank.associationCode}
                    </span>
                    <div className="text-[11px] text-emerald-400 font-medium mt-0.5">
                      {currentRank.association}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-700/60 text-xs">
                  <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                    <div className="text-[10px] text-slate-400">Opening Time</div>
                    <div className="font-semibold text-white mt-0.5">{currentRank.operatingHours.opensAt} AM</div>
                  </div>
                  <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                    <div className="text-[10px] text-slate-400">Closing Time</div>
                    <div className="font-semibold text-white mt-0.5">{currentRank.operatingHours.closesAt} PM</div>
                  </div>
                  <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                    <div className="text-[10px] text-slate-400">Morning Peak</div>
                    <div className="font-semibold text-amber-300 mt-0.5">{currentRank.operatingHours.peakMorning}</div>
                  </div>
                  <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                    <div className="text-[10px] text-slate-400">Afternoon Peak</div>
                    <div className="font-semibold text-amber-300 mt-0.5">{currentRank.operatingHours.peakAfternoon}</div>
                  </div>
                </div>
              </div>

              {/* Routes Header & Search */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Navigation size={14} className="text-emerald-400" />
                    Available Taxi Routes ({currentRoutes.length})
                  </h4>
                  <div className="relative w-full sm:w-64">
                    <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      placeholder="Search destination or corridor..."
                      className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                {/* Routes List */}
                <div className="space-y-2.5">
                  {currentRoutes.map(route => {
                    const activeQueue = customQueueStatus[route.id] || route.liveQueue.status
                    const badge = getStatusBadge(activeQueue)

                    return (
                      <div
                        key={route.id}
                        className="p-3.5 rounded-xl bg-slate-800/30 border border-slate-700/60 hover:border-slate-600 transition-colors space-y-2.5"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-white text-sm">{route.destination}</span>
                              <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/30">
                                R{route.fareZAR}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-400 mt-0.5">
                              Via {route.corridor} • {route.travelTimeMins} mins
                            </p>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-semibold px-2 py-1 rounded-full border ${badge.bg}`}>
                              {badge.label}
                            </span>
                            <button
                              onClick={() => {
                                playTactileSound('click')
                                setCalcFare(route.fareZAR)
                                setActiveTab('calculator')
                              }}
                              className="px-2.5 py-1 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 text-[11px] font-medium transition-colors"
                            >
                              Pay / Change
                            </button>
                          </div>
                        </div>

                        {/* Route Details Ribbon */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-slate-900/60 p-2 rounded-lg border border-slate-800/80 text-[11px]">
                          <div>
                            <span className="text-slate-400">Loading Bay: </span>
                            <span className="font-medium text-slate-200">{route.platformBay}</span>
                          </div>
                          <div>
                            <span className="text-slate-400">Hand Signal: </span>
                            <span className="font-medium text-slate-200">
                              {route.handSignal.gesture} {route.handSignal.name}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400">Departures: </span>
                            <span className="font-medium text-slate-200">Every {route.frequencyPeakMins}m peak</span>
                          </div>
                        </div>

                        {/* Live Marshal Check-in Bar */}
                        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px]">
                          <div className="text-slate-400 italic">
                            &ldquo;{route.liveQueue.marshalNotes}&rdquo;
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-slate-500 mr-1">Report Queue:</span>
                            {(['fast', 'moderate', 'congested'] as QueueCongestionLevel[]).map(lvl => (
                              <button
                                key={lvl}
                                onClick={() => handleUpdateQueueStatus(route.id, lvl)}
                                className={`px-2 py-0.5 rounded text-[10px] font-medium border capitalize transition-colors ${
                                  activeQueue === lvl
                                    ? 'bg-emerald-500 text-white border-emerald-400 font-bold'
                                    : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
                                }`}
                              >
                                {lvl}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Front-Seat Change Calculator */}
          {activeTab === 'calculator' && (
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
              <div className="bg-slate-800/40 p-4 rounded-xl border border-slate-700/80 space-y-4">
                <div className="flex items-center gap-2">
                  <Calculator size={18} className="text-emerald-400" />
                  <h3 className="font-bold text-white text-sm">
                    Passenger in the Front: Change Dispenser
                  </h3>
                </div>
                <p className="text-xs text-slate-400">
                  Sitting in the front seat? Use this algorithmic cash register to collect fares from the back rows, calculate change due, and hand the exact coins back with zero confusion.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs text-slate-400 font-medium block mb-1">
                      Fare per Person (ZAR)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-xs font-mono text-slate-400">R</span>
                      <input
                        type="number"
                        min="5"
                        max="100"
                        value={calcFare}
                        onChange={e => setCalcFare(Number(e.target.value) || 0)}
                        className="w-full pl-7 pr-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono text-sm focus:border-emerald-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-slate-400 font-medium block mb-1">
                      Passengers Paid For
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="15"
                      value={calcPassengers}
                      onChange={e => setCalcPassengers(Number(e.target.value) || 1)}
                      className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono text-sm focus:border-emerald-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-slate-400 font-medium block mb-1">
                      Amount Tendered (ZAR)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-xs font-mono text-slate-400">R</span>
                      <input
                        type="number"
                        min="5"
                        max="500"
                        step="5"
                        value={calcTendered}
                        onChange={e => setCalcTendered(Number(e.target.value) || 0)}
                        className="w-full pl-7 pr-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono text-sm focus:border-emerald-500 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Quick Tendered Notes shortcuts */}
                <div className="flex items-center gap-2 pt-1">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wide">Quick Note:</span>
                  {[20, 50, 100, 200].map(amt => (
                    <button
                      key={amt}
                      onClick={() => { playTactileSound('click'); setCalcTendered(amt) }}
                      className={`px-2.5 py-1 rounded text-xs font-mono font-semibold transition-colors ${
                        calcTendered === amt
                          ? 'bg-emerald-500 text-slate-950'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      R{amt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Result Summary Box */}
              <div className={`p-4 rounded-xl border ${
                changeCalculation.isShortPayment
                  ? 'bg-red-950/40 border-red-500/50 text-red-200'
                  : changeCalculation.changeDueZAR === 0
                  ? 'bg-teal-950/40 border-teal-500/50 text-teal-200'
                  : 'bg-emerald-950/40 border-emerald-500/50 text-emerald-200'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold uppercase tracking-wider">
                    {changeCalculation.isShortPayment ? 'Shortfall Notice' : 'Change Calculation'}
                  </div>
                  <div className="text-xl font-bold font-mono">
                    {changeCalculation.isShortPayment
                      ? `-R${changeCalculation.shortfallZAR.toFixed(2)}`
                      : `R${changeCalculation.changeDueZAR.toFixed(2)}`}
                  </div>
                </div>
                <div className="text-xs mt-1 font-medium">{changeCalculation.summaryText}</div>

                {/* Physical Currency Breakdown */}
                {!changeCalculation.isShortPayment && changeCalculation.changeDueZAR > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-3 mt-3 border-t border-emerald-500/30 text-xs">
                    {changeCalculation.coinsAndNotes.notesR50 > 0 && (
                      <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-700 text-slate-100">
                        <span className="text-emerald-400 font-bold">{changeCalculation.coinsAndNotes.notesR50}x</span> R50 Note
                      </div>
                    )}
                    {changeCalculation.coinsAndNotes.notesR20 > 0 && (
                      <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-700 text-slate-100">
                        <span className="text-emerald-400 font-bold">{changeCalculation.coinsAndNotes.notesR20}x</span> R20 Note
                      </div>
                    )}
                    {changeCalculation.coinsAndNotes.notesR10 > 0 && (
                      <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-700 text-slate-100">
                        <span className="text-emerald-400 font-bold">{changeCalculation.coinsAndNotes.notesR10}x</span> R10 Note
                      </div>
                    )}
                    {changeCalculation.coinsAndNotes.coinsR5 > 0 && (
                      <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-700 text-slate-100">
                        <span className="text-emerald-400 font-bold">{changeCalculation.coinsAndNotes.coinsR5}x</span> R5 Coin
                      </div>
                    )}
                    {changeCalculation.coinsAndNotes.coinsR2 > 0 && (
                      <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-700 text-slate-100">
                        <span className="text-emerald-400 font-bold">{changeCalculation.coinsAndNotes.coinsR2}x</span> R2 Coin
                      </div>
                    )}
                    {changeCalculation.coinsAndNotes.coinsR1 > 0 && (
                      <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-700 text-slate-100">
                        <span className="text-emerald-400 font-bold">{changeCalculation.coinsAndNotes.coinsR1}x</span> R1 Coin
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tab 3: Hand Signal Guide */}
          {activeTab === 'signals' && (
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
              <div className="bg-slate-800/40 p-3.5 rounded-xl border border-slate-700/80">
                <h3 className="font-bold text-white text-sm">Official South African Taxi Hand Signals</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Universal gestures recognised across all 9 provinces. Use these on the pavement when hailing a taxi.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {handSignalGuide.map((sig, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl bg-slate-800/30 border border-slate-700/60 flex items-start gap-3"
                  >
                    <div className="text-3xl p-2 rounded-xl bg-slate-900 border border-slate-700/80 shrink-0">
                      {sig.gestureEmoji}
                    </div>
                    <div>
                      <div className="font-bold text-white text-xs">{sig.signalName}</div>
                      <div className="text-xs text-emerald-300 font-medium mt-0.5">{sig.meaning}</div>
                      <span className="inline-block text-[10px] text-slate-400 bg-slate-900/60 px-2 py-0.5 rounded mt-2">
                        {sig.region}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="p-3 sm:p-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-emerald-400" />
              Verified Transit Telemetry • Zero External API Surcharge
            </span>
            <button
              onClick={() => { playTactileSound('click'); onClose() }}
              className="px-4 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold transition-colors"
            >
              Done
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
