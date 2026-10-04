'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Ruler, Box, CheckCircle2, AlertTriangle, X, Compass
} from 'lucide-react'
import { playTactileSound } from '../../../../utils/tactileSounds'

interface RoomSpatialRulerModalProps {
  isOpen: boolean
  onClose: () => void
  roomTitle?: string
  roomPhoto?: string
}

interface FurniturePreset {
  id: string
  name: string
  widthCm: number
  lengthCm: number
  category: 'bed' | 'desk' | 'wardrobe'
}

const SA_BED_PRESETS: FurniturePreset[] = [
  { id: 'single', name: 'Single Bed (91 × 188 cm)', widthCm: 91, lengthCm: 188, category: 'bed' },
  { id: 'three-quarter', name: 'Three-Quarter Bed (107 × 188 cm)', widthCm: 107, lengthCm: 188, category: 'bed' },
  { id: 'double', name: 'Double Bed (137 × 188 cm)', widthCm: 137, lengthCm: 188, category: 'bed' },
  { id: 'queen', name: 'Queen Bed (152 × 188 cm)', widthCm: 152, lengthCm: 188, category: 'bed' },
  { id: 'desk', name: 'Study Desk & Chair (120 × 60 cm)', widthCm: 120, lengthCm: 60, category: 'desk' }
]

export default function RoomSpatialRulerModal({
  isOpen,
  onClose,
  roomTitle = 'Bedroom Spatial Preview',
  roomPhoto = 'https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?auto=format&fit=crop&w=800&q=80'
}: RoomSpatialRulerModalProps) {
  const [selectedFurniture, setSelectedFurniture] = useState<FurniturePreset>(SA_BED_PRESETS[2]) // Default Double Bed
  const [rotation, setRotation] = useState<0 | 90>(0)
  const roomLengthM = 3.8
  const roomWidthM = 3.2

  if (!isOpen) return null

  const roomAreaM2 = (roomLengthM * roomWidthM).toFixed(1)
  const furnitureAreaM2 = ((selectedFurniture.widthCm * selectedFurniture.lengthCm) / 10000).toFixed(2)
  const remainingFloorSpace = (Number(roomAreaM2) - Number(furnitureAreaM2)).toFixed(1)

  const willFit = (selectedFurniture.widthCm / 100 <= roomWidthM) && (selectedFurniture.lengthCm / 100 <= roomLengthM)

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[280] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="w-full max-w-3xl bg-[var(--card-bg,rgba(11,43,38,0.98))] border border-gold-primary/30 rounded-3xl p-6 sm:p-7 shadow-2xl space-y-6 relative overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gold-primary/20 border border-gold-primary/40 flex items-center justify-center text-gold-primary shadow-glow">
                <Ruler size={24} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-black text-white uppercase tracking-tight">AR Room Ruler & Bed Sizer</h3>
                  <span className="text-[9px] font-black uppercase tracking-wider bg-gold-primary/20 text-gold-primary px-2 py-0.5 rounded-full border border-gold-primary/30">
                    Spatial AI
                  </span>
                </div>
                <p className="text-xs text-gray-400">{roomTitle} • {roomAreaM2} m² Floor Area</p>
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

          {/* Preset Selector */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase text-gray-300 tracking-wider">Select Standard SA Furniture Size</label>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {SA_BED_PRESETS.map(preset => (
                <button
                  key={preset.id}
                  onClick={() => { playTactileSound('tab'); setSelectedFurniture(preset) }}
                  className={`p-2.5 rounded-xl text-[11px] font-black uppercase tracking-wider text-left transition-all border ${
                    selectedFurniture.id === preset.id
                      ? 'bg-gold-primary text-black border-gold-primary shadow-glow'
                      : 'bg-black/50 text-gray-300 border-white/10 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <p className="truncate">{preset.name.split(' (')[0]}</p>
                  <span className={`text-[9px] block ${selectedFurniture.id === preset.id ? 'text-black/80' : 'text-gray-500'}`}>
                    {preset.widthCm}×{preset.lengthCm}cm
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Interactive AR Canvas Stage */}
          <div className="relative aspect-video rounded-3xl overflow-hidden border border-gold-primary/30 bg-black flex items-center justify-center">
            {/* Background Room Photo */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={roomPhoto} alt="" className="w-full h-full object-cover opacity-50" />

            {/* Simulated 3D Bounding Box Overlay */}
            <motion.div
              animate={{ rotate: rotation, scale: willFit ? 1 : 0.95 }}
              transition={{ type: 'spring', damping: 20 }}
              className={`absolute border-2 rounded-2xl flex flex-col items-center justify-center p-4 backdrop-blur-md shadow-2xl cursor-pointer ${
                willFit ? 'border-emerald-400 bg-emerald-500/20 text-white' : 'border-red-400 bg-red-500/30 text-white'
              }`}
              style={{
                width: rotation === 0 ? `${(selectedFurniture.widthCm / 152) * 45}%` : `${(selectedFurniture.lengthCm / 188) * 45}%`,
                height: rotation === 0 ? `${(selectedFurniture.lengthCm / 188) * 55}%` : `${(selectedFurniture.widthCm / 152) * 55}%`
              }}
              onClick={() => { playTactileSound('pop'); setRotation(rotation === 0 ? 90 : 0) }}
            >
              <Box size={24} className="mb-1 text-gold-primary animate-pulse" />
              <p className="text-xs font-black uppercase tracking-wider text-center">{selectedFurniture.name.split(' (')[0]}</p>
              <span className="text-[10px] font-mono text-gold-primary">{selectedFurniture.widthCm} × {selectedFurniture.lengthCm} cm</span>
              <span className="text-[9px] text-gray-300 mt-1">Tap to rotate 90°</span>
            </motion.div>

            {/* Measurement Badges */}
            <div className="absolute bottom-3 left-3 bg-black/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10 text-xs font-mono">
              Room: <span className="text-white font-bold">{roomLengthM}m × {roomWidthM}m</span> ({roomAreaM2} m²)
            </div>

            <div className="absolute bottom-3 right-3 bg-black/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10 text-xs font-mono">
              Free Walking Space: <span className="text-emerald-400 font-bold">{remainingFloorSpace} m²</span>
            </div>
          </div>

          {/* Validation Notice & Rotation Button */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
            <div className="flex items-center gap-2">
              {willFit ? (
                <div className="flex items-center gap-1.5 text-xs text-emerald-300 font-bold">
                  <CheckCircle2 size={16} className="text-emerald-400" />
                  <span>Fits comfortably with ample space for study desk and cupboards.</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-xs text-amber-300 font-bold">
                  <AlertTriangle size={16} className="text-amber-400" />
                  <span>Tight clearance: consider a Single or 3/4 bed for optimal walkway.</span>
                </div>
              )}
            </div>

            <button
              onClick={() => { playTactileSound('pop'); setRotation(rotation === 0 ? 90 : 0) }}
              className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white font-black text-xs uppercase tracking-wider transition-all flex items-center gap-1.5 shrink-0"
            >
              <Compass size={14} className="text-gold-primary" />
              <span>Rotate Layout ({rotation}°)</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
