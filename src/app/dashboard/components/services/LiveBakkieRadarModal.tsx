'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Truck, MapPin, Phone, ShieldCheck, Navigation, Clock, X
} from 'lucide-react'
import { playTactileSound } from '../../../../utils/tactileSounds'

interface LiveBakkieRadarModalProps {
  isOpen: boolean
  onClose: () => void
  driverName?: string
  vehicleModel?: string
  licensePlate?: string
  pickupAddress?: string
  destinationAddress?: string
}

export default function LiveBakkieRadarModal({
  isOpen,
  onClose,
  driverName = 'Tshepo Dlamini',
  vehicleModel = 'Toyota Hilux 2.4 GD-6 (1-Ton Flatbed)',
  licensePlate = 'GP 88 YZ • ZAF',
  pickupAddress = 'Junction Res, Braamfontein',
  destinationAddress = 'The Exchange, Hatfield, Pretoria'
}: LiveBakkieRadarModalProps) {
  const [etaMinutes, setEtaMinutes] = useState(14)
  const [progressPercent, setProgressPercent] = useState(35)
  const [driverStatus, setDriverStatus] = useState<'En Route to Pickup' | 'Arrived at Pickup' | 'In Transit to Destination'>('En Route to Pickup')

  useEffect(() => {
    if (!isOpen) return
    const interval = setInterval(() => {
      setProgressPercent(prev => {
        const next = prev < 90 ? prev + 3 : prev
        if (next > 70) setDriverStatus('In Transit to Destination')
        else if (next > 45) setDriverStatus('Arrived at Pickup')
        return next
      })
      setEtaMinutes(prev => (prev > 1 ? prev - 1 : 1))
    }, 4000)
    return () => clearInterval(interval)
  }, [isOpen])

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[280] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="w-full max-w-2xl bg-[var(--card-bg,rgba(11,43,38,0.98))] border border-gold-primary/30 rounded-3xl p-6 sm:p-7 shadow-2xl space-y-6 relative overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gold-primary/20 border border-gold-primary/40 flex items-center justify-center text-gold-primary shadow-glow">
                <Navigation size={24} className="animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-black text-white uppercase tracking-tight">Live Bakkie Dispatch Radar</h3>
                  <span className="text-[9px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/30">
                    Live GPS Stream
                  </span>
                </div>
                <p className="text-xs text-gray-400">Driver {driverName} • <span className="text-gold-primary font-bold">{driverStatus}</span></p>
              </div>
            </div>

            <button
              onClick={() => { playTactileSound('pop'); onClose() }}
              className="p-2 text-gray-400 hover:text-white transition-colors"
              aria-label="Close modal"
            >
              <X size={18} />
            </button>
          </div>

          {/* Map Simulation Canvas */}
          <div className="relative aspect-video rounded-3xl overflow-hidden border border-white/15 bg-black flex items-center justify-center">
            {/* Dark Map Vector Styling */}
            <div
              className="absolute inset-0 opacity-40"
              style={{
                backgroundImage: 'radial-gradient(circle at 50% 50%, rgba(212,175,55,0.15) 0%, transparent 80%), linear-gradient(0deg, #091a16 0%, #000000 100%)'
              }}
            />

            {/* Simulated Route Line */}
            <div className="absolute w-3/4 h-1 bg-white/20 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-emerald-400 to-gold-primary"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            {/* Pickup Node */}
            <div className="absolute left-[12%] flex flex-col items-center gap-1">
              <div className="w-6 h-6 rounded-full bg-emerald-500 text-black flex items-center justify-center shadow-lg">
                <MapPin size={12} />
              </div>
              <span className="text-[9px] font-black uppercase bg-black/80 px-2 py-0.5 rounded text-gray-300">Pickup</span>
            </div>

            {/* Live Moving Truck Icon */}
            <motion.div
              className="absolute flex flex-col items-center gap-1 z-10"
              style={{ left: `${12 + (progressPercent * 0.76)}%` }}
            >
              <div className="w-9 h-9 rounded-2xl bg-gold-primary text-black flex items-center justify-center shadow-glow">
                <Truck size={18} />
              </div>
              <span className="text-[9px] font-black uppercase bg-gold-primary text-black px-2 py-0.5 rounded shadow">
                {etaMinutes} min
              </span>
            </motion.div>

            {/* Destination Node */}
            <div className="absolute right-[12%] flex flex-col items-center gap-1">
              <div className="w-6 h-6 rounded-full bg-gold-primary text-black flex items-center justify-center shadow-lg">
                <MapPin size={12} />
              </div>
              <span className="text-[9px] font-black uppercase bg-black/80 px-2 py-0.5 rounded text-gray-300">Drop-off</span>
            </div>

            <div className="absolute top-3 right-3 bg-black/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10 text-xs font-mono text-gold-primary flex items-center gap-1.5">
              <Clock size={13} />
              <span>ETA: {etaMinutes} Minutes</span>
            </div>
          </div>

          {/* Driver & Vehicle Information Card */}
          <div className="p-4 rounded-2xl bg-black/50 border border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-gold-primary to-amber-600 text-black font-black flex items-center justify-center text-lg shadow-md shrink-0">
                {driverName.charAt(0)}
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h4 className="text-sm font-black text-white">{driverName}</h4>
                  <ShieldCheck size={14} className="text-emerald-400" />
                  <span className="text-[9px] font-black uppercase bg-emerald-500/20 text-emerald-300 px-1.5 py-0.2 rounded">Verified PDP</span>
                </div>
                <p className="text-xs text-gray-300 font-bold">{vehicleModel}</p>
                <span className="text-[10px] text-gold-primary font-mono font-bold tracking-wider">{licensePlate}</span>
              </div>
            </div>

            <button
              onClick={() => {
                playTactileSound('chime')
                alert(`Connecting secure voice call with driver ${driverName}...`)
              }}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gold-primary hover:bg-gold-secondary text-black font-black text-xs uppercase tracking-wider shadow-glow active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <Phone size={14} />
              <span>Call Driver (In-App)</span>
            </button>
          </div>

          {/* Route details */}
          <div className="space-y-1.5 text-xs text-gray-300 font-mono bg-white/[0.02] p-3 rounded-xl border border-white/5">
            <div className="flex items-center gap-2">
              <span className="text-gray-500 uppercase text-[9px] w-14">From:</span>
              <span className="text-white truncate">{pickupAddress}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-500 uppercase text-[9px] w-14">To:</span>
              <span className="text-white truncate">{destinationAddress}</span>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
