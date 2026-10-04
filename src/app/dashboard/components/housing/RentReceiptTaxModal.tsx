'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FileText, Download, X, ShieldCheck
} from 'lucide-react'
import { playTactileSound } from '../../../../utils/tactileSounds'
import { formatCurrency } from '../../../../utils/logic'

interface RentReceiptTaxModalProps {
  isOpen: boolean
  onClose: () => void
  tenantName?: string
  landlordName?: string
  propertyAddress?: string
  monthlyRent?: number
}

export default function RentReceiptTaxModal({
  isOpen,
  onClose,
  tenantName = 'Sipho Ndlovu',
  landlordName = 'Mrs. Mokoena Properties',
  propertyAddress = '145 Jorissen Street, Braamfontein, Johannesburg',
  monthlyRent = 4500
}: RentReceiptTaxModalProps) {
  const [selectedMonth, setSelectedMonth] = useState('September 2026')
  const [taxYear] = useState('2026 / 2027')
  const [receiptNumber] = useState(() => 'RES-TAX-2026-09-8492')

  if (!isOpen) return null

  const handleDownload = () => {
    playTactileSound('chime')
    alert(`SARS Tax Rental Certificate ${receiptNumber} generated and downloaded as PDF!`)
  }

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
                <FileText size={24} />
              </div>
              <div>
                <h3 className="text-lg font-black text-white uppercase tracking-tight">SARS Rent Receipt & Tax Certificate</h3>
                <p className="text-xs text-gray-400">Official proof of residential payment</p>
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

          {/* Certificate View */}
          <div className="bg-black/60 border border-white/10 rounded-2xl p-5 sm:p-6 space-y-4 font-mono text-xs text-gray-200">
            <div className="flex justify-between items-start border-b border-white/10 pb-3">
              <div>
                <span className="text-[10px] text-gold-primary font-black uppercase tracking-widest block">THE RESIDENT RESIDENTIAL PLATFORM</span>
                <p className="text-white font-bold text-sm">OFFICIAL RENT PAYMENT RECEIPT</p>
                <p className="text-gray-400 text-[10px]">Republic of South Africa • Income Tax Act 58</p>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-gray-400 block">Receipt No:</span>
                <span className="text-gold-primary font-bold">{receiptNumber}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 py-2 border-b border-white/10 text-[11px]">
              <div>
                <span className="text-gray-500 block uppercase text-[9px] font-bold">Tenant Details:</span>
                <p className="text-white font-bold">{tenantName}</p>
                <p className="text-gray-400">ID / Ref: 980412••••085</p>
              </div>
              <div>
                <span className="text-gray-500 block uppercase text-[9px] font-bold">Landlord / Lessor:</span>
                <p className="text-white font-bold">{landlordName}</p>
                <p className="text-gray-400">Verified Property Owner</p>
              </div>
            </div>

            <div className="space-y-2 py-2 border-b border-white/10 text-[11px]">
              <span className="text-gray-500 block uppercase text-[9px] font-bold">Demised Rental Premises:</span>
              <p className="text-white">{propertyAddress}</p>
              <div className="flex gap-4 text-gray-400 text-[10px]">
                <span>Rental Period: <strong>{selectedMonth}</strong></span>
                <span>Tax Assessment Year: <strong>{taxYear}</strong></span>
              </div>
            </div>

            <div className="flex justify-between items-center pt-2 text-sm font-bold">
              <span className="text-gray-300">Total Amount Paid (EFT / PayShap):</span>
              <span className="text-gold-primary text-base font-black">{formatCurrency(monthlyRent, 'ZAR')}</span>
            </div>

            <div className="flex items-center gap-2 text-[10px] text-emerald-400 pt-2">
              <ShieldCheck size={14} />
              <span>Status: Paid in full & verified via platform clearing ledger</span>
            </div>
          </div>

          {/* Month selector & actions */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
            <select
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
              className="bg-black/50 border border-white/15 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-gold-primary"
            >
              <option value="September 2026">September 2026</option>
              <option value="August 2026">August 2026</option>
              <option value="July 2026">July 2026</option>
              <option value="June 2026">June 2026</option>
              <option value="Annual Tax Certificate (2025/2026)">Annual Tax Statement (12 Months)</option>
            </select>

            <button
              onClick={handleDownload}
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gold-primary hover:bg-gold-secondary text-black font-black text-xs uppercase tracking-wider shadow-glow active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <Download size={14} />
              <span>Download Official SARS PDF</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
