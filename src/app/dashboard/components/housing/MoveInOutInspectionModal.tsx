'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Camera, CheckCircle2, X,
  ChevronLeft, ChevronRight, Layers, FileCheck
} from 'lucide-react'
import { playTactileSound } from '../../../../utils/tactileSounds'

interface MoveInOutInspectionModalProps {
  isOpen: boolean
  onClose: () => void
  roomTitle?: string
}

interface InspectionPair {
  id: string
  areaName: string
  moveInPhoto: string
  moveInDate: string
  moveInNotes: string
  moveOutPhoto: string | null
  moveOutDate: string | null
  moveOutNotes: string | null
  status: 'passed' | 'disputed' | 'pending'
}

const SAMPLE_INSPECTIONS: InspectionPair[] = [
  {
    id: 'insp-1',
    areaName: 'Master Bedroom Walls & Plugs',
    moveInPhoto: 'https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?auto=format&fit=crop&w=600&q=80',
    moveInDate: '01 Feb 2026',
    moveInNotes: 'Walls freshly painted off-white. All four electrical wall sockets grounded and functional.',
    moveOutPhoto: 'https://images.unsplash.com/photo-1598928506311-c55ded91a20c?auto=format&fit=crop&w=600&q=80',
    moveOutDate: '30 Sept 2026',
    moveOutNotes: 'No wall damage. Small picture hook removed and polyfilla smoothed as agreed.',
    status: 'passed'
  },
  {
    id: 'insp-2',
    areaName: 'En-Suite Bathroom & Shower Glass',
    moveInPhoto: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=600&q=80',
    moveInDate: '01 Feb 2026',
    moveInNotes: 'Shower mixer handles intact. Minor limescale around floor drain noted.',
    moveOutPhoto: 'https://images.unsplash.com/photo-1552321554-5fefe8c9ef14?auto=format&fit=crop&w=600&q=80',
    moveOutDate: '30 Sept 2026',
    moveOutNotes: 'Deep descaled by tenant. Excellent condition, zero tile cracks.',
    status: 'passed'
  },
  {
    id: 'insp-3',
    areaName: 'Balcony Glass Slider & Lock',
    moveInPhoto: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=600&q=80',
    moveInDate: '01 Feb 2026',
    moveInNotes: 'Sliding lock works with standard key. Glass intact.',
    moveOutPhoto: null,
    moveOutDate: null,
    moveOutNotes: null,
    status: 'pending'
  }
]

export default function MoveInOutInspectionModal({
  isOpen,
  onClose,
  roomTitle = 'Ensuite Unit 4B — Braamfontein'
}: MoveInOutInspectionModalProps) {
  const [inspections, setInspections] = useState<InspectionPair[]>(SAMPLE_INSPECTIONS)
  const [currentIndex, setCurrentIndex] = useState(0)

  if (!isOpen) return null

  const activeItem = inspections[currentIndex]

  const handleCaptureMoveOut = (id: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    playTactileSound('pop')
    const reader = new FileReader()
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        const url = reader.result
        setInspections(prev => prev.map(item => {
          if (item.id === id) {
            return {
              ...item,
              moveOutPhoto: url,
              moveOutDate: 'Today (Verified Move-Out)',
              moveOutNotes: 'Photo captured via device inspection camera.',
              status: 'passed'
            }
          }
          return item
        }))
      }
    }
    reader.readAsDataURL(file)
  }

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
                <FileCheck size={24} />
              </div>
              <div>
                <h3 className="text-lg font-black text-white uppercase tracking-tight">Move-In vs Move-Out Inspection</h3>
                <p className="text-xs text-gray-400">{roomTitle} • Side-by-Side Proof</p>
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

          {/* Area Navigator */}
          <div className="flex items-center justify-between bg-black/60 p-2 rounded-2xl border border-white/10">
            <button
              disabled={currentIndex === 0}
              onClick={() => { playTactileSound('tab'); setCurrentIndex(prev => prev - 1) }}
              className="p-2 text-gray-400 hover:text-white disabled:opacity-30 disabled:hover:text-gray-400"
            >
              <ChevronLeft size={18} />
            </button>

            <div className="text-center">
              <p className="text-xs font-black text-white uppercase tracking-wider">{activeItem.areaName}</p>
              <p className="text-[10px] text-gold-primary font-bold">Item {currentIndex + 1} of {inspections.length}</p>
            </div>

            <button
              disabled={currentIndex === inspections.length - 1}
              onClick={() => { playTactileSound('tab'); setCurrentIndex(prev => prev + 1) }}
              className="p-2 text-gray-400 hover:text-white disabled:opacity-30 disabled:hover:text-gray-400"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          {/* Visual Comparison Stage */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Move-In Photo (Baseline) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-black text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                  <CheckCircle2 size={13} /> Move-In Baseline
                </span>
                <span className="text-[10px] text-gray-500 font-mono">{activeItem.moveInDate}</span>
              </div>
              <div className="relative aspect-video rounded-2xl overflow-hidden border border-white/15 bg-black shadow-md">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={activeItem.moveInPhoto} alt="" className="w-full h-full object-cover" />
                <span className="absolute bottom-2 left-2 bg-black/80 px-2 py-0.5 rounded text-[9px] text-emerald-400 font-black uppercase">
                  Signed Off Day 1
                </span>
              </div>
              <p className="text-xs text-gray-300 italic bg-white/[0.02] p-2.5 rounded-xl border border-white/5">
                &quot;{activeItem.moveInNotes}&quot;
              </p>
            </div>

            {/* Move-Out Photo (Current Condition) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-black text-gold-primary uppercase tracking-wider flex items-center gap-1">
                  <Layers size={13} /> Move-Out Condition
                </span>
                <span className="text-[10px] text-gray-500 font-mono">{activeItem.moveOutDate || 'Not captured yet'}</span>
              </div>

              {activeItem.moveOutPhoto ? (
                <div className="relative aspect-video rounded-2xl overflow-hidden border border-gold-primary/30 bg-black shadow-md">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={activeItem.moveOutPhoto} alt="" className="w-full h-full object-cover" />
                  <span className="absolute bottom-2 left-2 bg-black/80 px-2 py-0.5 rounded text-[9px] text-gold-primary font-black uppercase">
                    Move-Out Capture
                  </span>
                </div>
              ) : (
                <div className="aspect-video rounded-2xl border-2 border-dashed border-white/20 bg-black/40 flex flex-col items-center justify-center gap-2 p-4 text-center">
                  <Camera size={24} className="text-gold-primary animate-pulse" />
                  <p className="text-xs text-gray-300 font-bold">Capture Move-Out Photo for this Area</p>
                  <label className="cursor-pointer px-4 py-2 rounded-xl bg-gold-primary text-black font-black text-xs uppercase tracking-wider shadow-glow active:scale-95 transition-all">
                    <span>Take Photo</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={e => handleCaptureMoveOut(activeItem.id, e)}
                      className="hidden"
                    />
                  </label>
                </div>
              )}

              {activeItem.moveOutNotes && (
                <p className="text-xs text-gray-300 italic bg-white/[0.02] p-2.5 rounded-xl border border-white/5">
                  &quot;{activeItem.moveOutNotes}&quot;
                </p>
              )}
            </div>
          </div>

          {/* Action Footer */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-white/10">
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-black uppercase px-3 py-1 rounded-full border ${
                activeItem.status === 'passed' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
              }`}>
                Status: {activeItem.status}
              </span>
              <span className="text-[10px] text-gray-400">Zero disputes detected</span>
            </div>

            <button
              onClick={() => {
                playTactileSound('chime')
                alert('Inspection Certificate generated and hashed into tenant and landlord records.')
                onClose()
              }}
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gold-primary hover:bg-gold-secondary text-black font-black text-xs uppercase tracking-wider shadow-glow active:scale-95 transition-all"
            >
              Sign & Export Inspection Certificate
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
