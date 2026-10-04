'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X, Car, ArrowRight
} from 'lucide-react'
import { playTactileSound } from '../../../../utils/tactileSounds'
import { formatCurrency } from '../../../../utils/logic'

interface QuantumPartyShuttleModalProps {
  isOpen: boolean
  onClose: () => void
  eventName?: string
  eventVenue?: string
}

export default function QuantumPartyShuttleModal({
  isOpen,
  onClose,
  eventName = 'Deep In The City • Spring Rooftop',
  eventVenue = 'Constitution Hill, Braamfontein'
}: QuantumPartyShuttleModalProps) {
  const [reservedSeats, setReservedSeats] = useState(1)
  const totalSeats = 14
  const [bookedCount, setBookedCount] = useState(9)
  const availableSeats = totalSeats - bookedCount
  const farePerSeat = 75

  if (!isOpen) return null

  const handleBookSeat = () => {
    if (reservedSeats > availableSeats) return
    playTactileSound('chime')
    setBookedCount(prev => prev + reservedSeats)
    alert(`Shuttle booked! ${reservedSeats} seat(s) reserved on Quantum Van #Q14 for ${eventName}. Return pickup locked for 02:30 AM.`)
    onClose()
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[280] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="w-full max-w-xl bg-[var(--card-bg,rgba(11,43,38,0.98))] border border-purple-500/30 rounded-3xl p-6 sm:p-7 shadow-2xl space-y-6 relative overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-300 shadow-glow">
                <Car size={24} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-black text-white uppercase tracking-tight">Quantum Event Party Shuttle</h3>
                  <span className="text-[9px] font-black uppercase tracking-wider bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded-full border border-purple-500/30">
                    The Gruvs VIP Pool
                  </span>
                </div>
                <p className="text-xs text-gray-400">{eventName} • {eventVenue} • 14-Seater HiAce</p>
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

          {/* Van Details & Live Seat Matrix */}
          <div className="bg-black/60 border border-white/10 rounded-2xl p-5 space-y-4">
            <div className="flex justify-between items-center text-xs">
              <span className="text-gray-400 uppercase font-black tracking-wider">Shuttle Capacity:</span>
              <span className="text-purple-300 font-mono font-bold">{bookedCount} / {totalSeats} Seats Taken ({availableSeats} Left)</span>
            </div>

            {/* Visual Seat Grid */}
            <div className="grid grid-cols-4 gap-2 pt-1">
              {Array.from({ length: totalSeats }).map((_, i) => {
                const isTaken = i < bookedCount
                return (
                  <div
                    key={i}
                    className={`py-2 rounded-xl text-center text-[10px] font-black uppercase tracking-wider border transition-all ${
                      isTaken
                        ? 'bg-purple-900/30 text-purple-400/60 border-purple-500/20'
                        : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm'
                    }`}
                  >
                    Seat {i + 1} {isTaken ? '(Taken)' : '(Open)'}
                  </div>
                )
              })}
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-white/10 text-xs">
              <span className="text-gray-400">Guaranteed Return Pickup:</span>
              <span className="text-white font-bold font-mono">02:30 AM Sharp at Main Gate</span>
            </div>

            <div className="flex justify-between items-center text-xs">
              <span className="text-gray-400">Fixed Rate:</span>
              <span className="text-gold-primary text-base font-black font-mono">{formatCurrency(farePerSeat, 'ZAR')} / seat</span>
            </div>
          </div>

          {/* Seat Picker */}
          <div className="flex items-center justify-between p-3.5 rounded-2xl bg-white/[0.03] border border-white/10">
            <span className="text-xs font-black uppercase text-gray-300">How Many Seats?</span>
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4].map(num => (
                <button
                  key={num}
                  disabled={num > availableSeats}
                  onClick={() => { playTactileSound('tab'); setReservedSeats(num) }}
                  className={`w-9 h-9 rounded-xl text-xs font-black transition-all border ${
                    reservedSeats === num
                      ? 'bg-purple-600 text-white border-purple-500 shadow-glow'
                      : 'bg-black/50 text-gray-400 border-white/10 hover:text-white'
                  }`}
                >
                  {num}
                </button>
              ))}
            </div>
          </div>

          {/* Action button */}
          <button
            onClick={handleBookSeat}
            disabled={availableSeats <= 0}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-purple-600 via-pink-600 to-amber-500 hover:brightness-110 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-purple-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            <span>Book {reservedSeats} Seat(s) • Total {formatCurrency(farePerSeat * reservedSeats, 'ZAR')}</span>
            <ArrowRight size={14} />
          </button>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
