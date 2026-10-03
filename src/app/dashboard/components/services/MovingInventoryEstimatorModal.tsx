'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Truck, Plus, Minus, ArrowRight, X, Calculator
} from 'lucide-react'
import { playTactileSound } from '../../../../utils/tactileSounds'
import { formatCurrency } from '../../../../utils/logic'

interface InventoryItem {
  id: string
  name: string
  cbm: number // cubic metres
  category: 'furniture' | 'appliances' | 'boxes'
  icon: string
}

const INVENTORY_CATALOG: InventoryItem[] = [
  { id: 'single_bed', name: 'Single / 3/4 Bed & Base', cbm: 1.2, category: 'furniture', icon: '🛏️' },
  { id: 'double_bed', name: 'Double / Queen Bed & Base', cbm: 1.8, category: 'furniture', icon: '🛏️' },
  { id: 'desk', name: 'Study Desk & Office Chair', cbm: 0.8, category: 'furniture', icon: '🪑' },
  { id: 'couch', name: '2-Seater Living Room Couch', cbm: 1.5, category: 'furniture', icon: '🛋️' },
  { id: 'bar_fridge', name: 'Bar Fridge / Small Fridge', cbm: 0.5, category: 'appliances', icon: '🧊' },
  { id: 'large_fridge', name: 'Tall Kitchen Fridge Freezer', cbm: 1.4, category: 'appliances', icon: '🧊' },
  { id: 'washing_machine', name: 'Washing Machine / Dryer', cbm: 0.6, category: 'appliances', icon: '🧺' },
  { id: 'medium_box', name: 'Medium Moving Box (Clothes / Books)', cbm: 0.15, category: 'boxes', icon: '📦' },
  { id: 'large_box', name: 'Large Storage Box / Wardrobe Carton', cbm: 0.25, category: 'boxes', icon: '📦' },
  { id: 'tv_unit', name: 'Flat Screen TV & Media Stand', cbm: 0.4, category: 'appliances', icon: '📺' }
]

export default function MovingInventoryEstimatorModal({
  isOpen,
  onClose,
  onProceedToBooking
}: {
  isOpen: boolean
  onClose: () => void
  onProceedToBooking?: (recommendedVehicle: string, totalCbm: number) => void
}) {
  const [counts, setCounts] = useState<Record<string, number>>({
    double_bed: 1,
    desk: 1,
    bar_fridge: 1,
    medium_box: 4
  })

  if (!isOpen) return null

  const updateCount = (id: string, delta: number) => {
    playTactileSound('pop')
    setCounts(prev => ({
      ...prev,
      [id]: Math.max(0, (prev[id] || 0) + delta)
    }))
  }

  // Calculate total cubic metres
  const totalCbm = Number(
    INVENTORY_CATALOG.reduce((acc, item) => acc + (counts[item.id] || 0) * item.cbm, 0).toFixed(2)
  )

  // Recommend vehicle based on total CBM
  let recommendedVehicle = 'Half-Ton Bakkie (NP200)'
  let vehicleCapacityCbm = 2.5
  let estimatedBaseFare = 350

  if (totalCbm > 6.0) {
    recommendedVehicle = '4-Ton Enclosed Pantech Truck'
    vehicleCapacityCbm = 14.0
    estimatedBaseFare = 1100
  } else if (totalCbm > 3.0) {
    recommendedVehicle = '2-Ton Long-Wheelbase Van'
    vehicleCapacityCbm = 7.5
    estimatedBaseFare = 650
  } else if (totalCbm > 1.8) {
    recommendedVehicle = '1-Ton Single-Cab Bakkie (Hilux/Isuzu)'
    vehicleCapacityCbm = 3.8
    estimatedBaseFare = 450
  }

  const capacityPercentage = Math.min(100, Math.round((totalCbm / vehicleCapacityCbm) * 100))

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
                <Calculator size={24} />
              </div>
              <div>
                <h3 className="text-lg font-black text-white uppercase tracking-tight">Moving Inventory & Bakkie Sizer</h3>
                <p className="text-xs text-gray-400">Calculate total cubic volume to avoid multiple trips</p>
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

          {/* Real-time Vehicle Match Banner */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-gold-primary/15 via-black/60 to-emerald-500/10 border border-gold-primary/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg">
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase text-gold-primary tracking-widest block">RECOMMENDED TRUCK MATCH</span>
              <p className="text-base font-black text-white flex items-center gap-2">
                <Truck size={18} className="text-gold-primary" /> {recommendedVehicle}
              </p>
              <p className="text-xs text-gray-300">
                Total Volume: <strong className="text-white font-mono">{totalCbm} m³</strong> (Capacity: {vehicleCapacityCbm} m³)
              </p>
            </div>

            <div className="text-right sm:border-l sm:border-white/10 sm:pl-4">
              <span className="text-[10px] text-gray-400 block uppercase font-bold">Estimated Base</span>
              <span className="text-xl font-black text-gold-primary font-mono">{formatCurrency(estimatedBaseFare, 'ZAR')}</span>
            </div>
          </div>

          {/* Volume progress meter */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-[11px] font-mono">
              <span className="text-gray-400">Load Factor:</span>
              <span className="text-gold-primary font-bold">{capacityPercentage}% full</span>
            </div>
            <div className="w-full h-2.5 bg-black/60 rounded-full overflow-hidden border border-white/10 p-0.5">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 via-amber-400 to-gold-primary rounded-full transition-all duration-300"
                style={{ width: `${capacityPercentage}%` }}
              />
            </div>
          </div>

          {/* Inventory Items List */}
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1 custom-scrollbar">
            {INVENTORY_CATALOG.map(item => {
              const qty = counts[item.id] || 0
              return (
                <div
                  key={item.id}
                  className="p-3 rounded-2xl bg-black/40 border border-white/5 hover:border-gold-primary/30 flex items-center justify-between gap-3 transition-all"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-xl shrink-0">{item.icon}</span>
                    <div className="truncate">
                      <p className="text-xs font-bold text-white truncate">{item.name}</p>
                      <span className="text-[10px] text-gray-500 font-mono">~{item.cbm} m³ each</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => updateCount(item.id, -1)}
                      disabled={qty === 0}
                      className="w-7 h-7 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-white disabled:opacity-30 disabled:hover:bg-white/5 transition-all"
                    >
                      <Minus size={12} />
                    </button>
                    <span className="w-6 text-center text-xs font-black text-gold-primary font-mono">{qty}</span>
                    <button
                      onClick={() => updateCount(item.id, 1)}
                      className="w-7 h-7 rounded-xl bg-gold-primary/20 hover:bg-gold-primary/30 border border-gold-primary/40 flex items-center justify-center text-gold-primary transition-all active:scale-95"
                    >
                      <Plus size={12} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Action Button */}
          <button
            onClick={() => {
              playTactileSound('chime')
              if (onProceedToBooking) {
                onProceedToBooking(recommendedVehicle, totalCbm)
              } else {
                alert(`Vehicle matched: ${recommendedVehicle}! Proceeding to driver dispatch with pre-filled inventory.`)
              }
              onClose()
            }}
            className="w-full py-3.5 rounded-2xl bg-gold-primary hover:bg-gold-secondary text-black font-black text-xs uppercase tracking-wider shadow-glow active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            <span>Confirm Inventory & Dispatch {recommendedVehicle}</span>
            <ArrowRight size={14} />
          </button>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
