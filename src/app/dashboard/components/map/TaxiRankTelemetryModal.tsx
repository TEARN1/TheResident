'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X,
  Car,
  ShieldCheck,
  MapPin,
  Search,
  Calculator,
  Sparkles,
  Navigation
} from 'lucide-react'
import {
  SA_TAXI_RANKS,
  calculateTaxiFrontSeatChange,
  getTaxiHandSignalGuide
} from '../../../../utils/taxiRoutes'
import { playTactileSound } from '../../../../utils/tactileSounds'
import Link from 'next/link'
import { vibeMapUrlForCoords, vibeMapUrlForPlace } from '../../../../utils/navigation'

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
  onFlyToCoordinates
}: TaxiRankTelemetryModalProps) {
  const [activeRankId, setActiveRankId] = useState<string>(selectedRankId || SA_TAXI_RANKS[0].id)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState<'ranks' | 'calculator' | 'signals'>('ranks')

  // Calculator State
  const [calcFare, setCalcFare] = useState<number>(22)
  const [calcPassengers, setCalcPassengers] = useState<number>(1)
  const [calcTendered, setCalcTendered] = useState<number>(50)

  React.useEffect(() => {
    if (selectedRankId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- follow the rank tapped on the map
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
                  <h2 className="text-lg font-bold text-white tracking-wide">Taxi ranks</h2>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 uppercase tracking-wider">
                    SANTACO / Commuter Radar
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Routes, rough fares, hand signals and a front-seat change calculator
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
                  <div className="flex items-center gap-2.5 sm:justify-end">
                    <Link
                      href={vibeMapUrlForCoords(currentRank.lat, currentRank.lon)}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 transition-colors"
                    >
                      <Navigation size={13} /> Show on the Vibe Map
                    </Link>
                    <div className="text-right">
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300">
                        {currentRank.associationCode}
                      </span>
                      <div className="text-[11px] text-emerald-400 font-medium mt-0.5">
                        {currentRank.association}
                      </div>
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
                            <Link
                              href={vibeMapUrlForPlace(route.destination)}
                              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-[11px] font-medium transition-colors flex items-center gap-1"
                            >
                              <Navigation size={11} className="text-emerald-400" /> Destination
                            </Link>
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

                        {/* Waypoints */}
                        {route.waypointStops.length > 0 && (
                          <div className="text-[11px] text-slate-400 pt-1 flex flex-wrap gap-1 items-center">
                            <span className="text-slate-500">Stops:</span>
                            {route.waypointStops.map((stop, sIdx) => (
                              <span key={sIdx} className="bg-slate-900/60 border border-slate-800 px-2 py-0.5 rounded text-[10px] text-slate-300">
                                {stop}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Change Calculator */}
          {activeTab === 'calculator' && (
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
              <div className="bg-slate-800/40 p-4 rounded-xl border border-slate-700/80">
                <h3 className="font-bold text-white text-sm">Front-Seat Taxi Change Dispenser</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Sitting in the front row? Calculate total fares and exact change breakdown for each note tendered.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-300 font-medium">Fare per Person (ZAR)</label>
                  <input
                    type="number"
                    value={calcFare}
                    onChange={e => setCalcFare(Number(e.target.value) || 0)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-sm text-white font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-300 font-medium">Passengers Paying</label>
                  <input
                    type="number"
                    value={calcPassengers}
                    onChange={e => setCalcPassengers(Number(e.target.value) || 1)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-sm text-white font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-300 font-medium">Amount Tendered (ZAR)</label>
                  <input
                    type="number"
                    value={calcTendered}
                    onChange={e => setCalcTendered(Number(e.target.value) || 0)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-sm text-white font-mono"
                  />
                </div>
              </div>

              {/* Calculation Output Card */}
              <div className={`p-4 rounded-xl border ${
                changeCalculation.isShortPayment
                  ? 'bg-red-950/40 border-red-500/40 text-red-200'
                  : 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
              }`}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider">
                    Total Due: R{changeCalculation.totalFareDueZAR.toFixed(2)}
                  </span>
                  <span className="text-sm font-bold font-mono">
                    {changeCalculation.isShortPayment ? '⚠️ Short Payment' : `Change Due: R${changeCalculation.changeDueZAR.toFixed(2)}`}
                  </span>
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
              A rough guide: fares and bays change, so confirm at the rank.
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
