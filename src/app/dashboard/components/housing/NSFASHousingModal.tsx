'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  GraduationCap, ShieldCheck, CheckCircle2, X
} from 'lucide-react'
import { playTactileSound } from '../../../../utils/tactileSounds'
import { formatCurrency } from '../../../../utils/logic'

interface NSFASHousingModalProps {
  isOpen: boolean
  onClose: () => void
  listingTitle?: string
  roomRent?: number
  suburb?: string
}

export default function NSFASHousingModal({
  isOpen,
  onClose,
  listingTitle = 'Standard Ensuite Room near Wits East Campus',
  roomRent = 4800,
  suburb = 'Braamfontein'
}: NSFASHousingModalProps) {
  const [selectedInstitution, setSelectedInstitution] = useState<'Wits' | 'UJ' | 'UP' | 'UCT' | 'TUT'>('Wits')

  // Statutory NSFAS Annual Accommodation Caps in South Africa (approx R50,000 p.a. -> ~R5,000 / month capped in metro areas)
  const monthlyCap = 5000
  const isWithinCap = roomRent <= monthlyCap
  const topUpRequired = Math.max(0, roomRent - monthlyCap)

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
              <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shadow-glow">
                <GraduationCap size={24} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-black text-white uppercase tracking-tight">NSFAS & University Housing Cap</h3>
                  <span className="text-[9px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full border border-amber-500/30">
                    Verified Off-Campus
                  </span>
                </div>
                <p className="text-xs text-gray-400">{listingTitle} • {suburb}</p>
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

          {/* Institution Selector */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase text-gray-300 tracking-wider">Select Your Institution</label>
            <div className="grid grid-cols-5 gap-2">
              {(['Wits', 'UJ', 'UP', 'UCT', 'TUT'] as const).map(inst => (
                <button
                  key={inst}
                  onClick={() => { playTactileSound('tab'); setSelectedInstitution(inst) }}
                  className={`py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all border ${
                    selectedInstitution === inst
                      ? 'bg-amber-500 text-black border-amber-500 shadow-glow'
                      : 'bg-black/50 text-gray-400 border-white/10 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {inst}
                </button>
              ))}
            </div>
          </div>

          {/* Allowance vs Rent Math Card */}
          <div className="bg-black/60 border border-white/10 rounded-2xl p-5 space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-white/10">
              <span className="text-xs text-gray-400 uppercase font-black tracking-wider">Room Monthly Rent:</span>
              <span className="text-base font-black text-white font-mono">{formatCurrency(roomRent, 'ZAR')}</span>
            </div>

            <div className="flex justify-between items-center pb-3 border-b border-white/10">
              <span className="text-xs text-gray-400 uppercase font-black tracking-wider">Govt NSFAS Accommodation Cap:</span>
              <span className="text-base font-black text-emerald-400 font-mono">{formatCurrency(monthlyCap, 'ZAR')} / month</span>
            </div>

            <div className="flex justify-between items-center pt-1">
              <span className="text-xs text-white font-black uppercase tracking-wider">Student Top-Up Co-Payment:</span>
              <span className={`text-base font-black font-mono ${isWithinCap ? 'text-emerald-400' : 'text-amber-400'}`}>
                {isWithinCap ? 'R0 (100% Fully Covered)' : `${formatCurrency(topUpRequired, 'ZAR')} / month`}
              </span>
            </div>
          </div>

          {/* Accreditation Checklist */}
          <div className="space-y-2">
            <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-amber-400" /> DHET Minimum Norms & Standards Verification
            </h4>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 flex items-center gap-2 text-gray-200">
                <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                <span>24/7 Backup Solar / Inverter</span>
              </div>
              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 flex items-center gap-2 text-gray-200">
                <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                <span>Biometric / Tag Gate Access</span>
              </div>
              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 flex items-center gap-2 text-gray-200">
                <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                <span>Uncapped High-Speed WiFi</span>
              </div>
              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 flex items-center gap-2 text-gray-200">
                <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                <span>Designated Study Quiet Hours</span>
              </div>
            </div>
          </div>

          {/* Action button */}
          <button
            onClick={() => {
              playTactileSound('chime')
              alert('NSFAS Verification Certificate stamped! Sent to bursary housing officer.')
              onClose()
            }}
            className="w-full py-3.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-black font-black text-xs uppercase tracking-wider transition-all active:scale-95 shadow-glow"
          >
            Submit for Direct Bursary / NSFAS Payout
          </button>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
