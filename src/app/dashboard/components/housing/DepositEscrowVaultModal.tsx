'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ShieldCheck, Lock, Unlock, DollarSign, FileText, CheckCircle2, X, Info
} from 'lucide-react'
import { playTactileSound } from '../../../../utils/tactileSounds'
import { formatCurrency } from '../../../../utils/logic'

interface DepositEscrowVaultModalProps {
  isOpen: boolean
  onClose: () => void
  propertyTitle?: string
  depositAmount?: number
  tenantName?: string
  landlordName?: string
}

export default function DepositEscrowVaultModal({
  isOpen,
  onClose,
  propertyTitle = 'Sunny Ensuite in Braamfontein',
  depositAmount = 4500,
  tenantName = 'Sipho Ndlovu',
  landlordName = 'Mrs. Mokoena Properties'
}: DepositEscrowVaultModalProps) {
  const [monthsHeld, setMonthsHeld] = useState(6)
  const annualInterestRate = 0.0725 // 7.25% SA Prime-linked interest
  const interestEarned = Math.round(depositAmount * (annualInterestRate / 12) * monthsHeld)
  const totalBondVault = depositAmount + interestEarned

  const [tenantSigned, setTenantSigned] = useState(false)
  const [landlordSigned, setLandlordSigned] = useState(false)
  const [activeTab, setActiveTab] = useState<'vault' | 'interest' | 'release'>('vault')
  const [statusMessage, setStatusMessage] = useState<string | null>(null)

  if (!isOpen) return null

  const handleSignRelease = (signer: 'tenant' | 'landlord') => {
    playTactileSound('pop')
    if (signer === 'tenant') {
      setTenantSigned(!tenantSigned)
    } else {
      setLandlordSigned(!landlordSigned)
    }
  }

  const handleExecutePayout = () => {
    if (!tenantSigned || !landlordSigned) return
    playTactileSound('chime')
    setStatusMessage('Deposit Escrow Payout Executed! Funds returned to tenant bank account via instant PayShap.')
    setTimeout(() => {
      setStatusMessage(null)
      onClose()
    }, 3000)
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[280] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="w-full max-w-2xl bg-[var(--card-bg,rgba(11,43,38,0.98))] border border-gold-primary/30 rounded-3xl p-6 sm:p-7 shadow-2xl space-y-6 relative overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gold-primary/20 border border-gold-primary/40 flex items-center justify-center text-gold-primary shadow-glow">
                <ShieldCheck size={24} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-black text-white uppercase tracking-tight">Rental Deposit Escrow Vault</h3>
                  <span className="text-[9px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/30">
                    RHA Act 50 Protected
                  </span>
                </div>
                <p className="text-xs text-gray-400">{propertyTitle} • {tenantName}</p>
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

          {/* Navigation Tabs */}
          <div className="flex items-center gap-2 bg-black/50 p-1.5 rounded-2xl border border-white/10">
            {[
              { id: 'vault' as const, label: 'Vault Balance', icon: Lock },
              { id: 'interest' as const, label: 'RHA Interest Log', icon: DollarSign },
              { id: 'release' as const, label: 'Dual Release Sign-Off', icon: Unlock }
            ].map(t => (
              <button
                key={t.id}
                onClick={() => { playTactileSound('tab'); setActiveTab(t.id) }}
                className={`flex-1 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all ${
                  activeTab === t.id
                    ? 'bg-gold-primary text-black font-black shadow-glow'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <t.icon size={13} />
                <span>{t.label}</span>
              </button>
            ))}
          </div>

          {/* Tab 1: Vault Summary */}
          {activeTab === 'vault' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-4 rounded-2xl bg-black/60 border border-white/10 space-y-1">
                  <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Initial Bond</span>
                  <p className="text-xl font-black text-white font-mono">{formatCurrency(depositAmount, 'ZAR')}</p>
                  <span className="text-[10px] text-gray-500">Secured on move-in</span>
                </div>

                <div className="p-4 rounded-2xl bg-black/60 border border-emerald-500/20 space-y-1">
                  <span className="text-[10px] font-black uppercase text-emerald-400 tracking-wider">Accrued Interest</span>
                  <p className="text-xl font-black text-emerald-400 font-mono">+{formatCurrency(interestEarned, 'ZAR')}</p>
                  <span className="text-[10px] text-gray-500">{monthsHeld} months @ 7.25% p.a.</span>
                </div>

                <div className="p-4 rounded-2xl bg-gold-primary/10 border border-gold-primary/30 space-y-1">
                  <span className="text-[10px] font-black uppercase text-gold-primary tracking-wider">Total Vault Pool</span>
                  <p className="text-xl font-black text-gold-primary font-mono">{formatCurrency(totalBondVault, 'ZAR')}</p>
                  <span className="text-[10px] text-gray-400">Guaranteed payable to tenant</span>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/10 flex items-start gap-3">
                <Info size={18} className="text-gold-primary shrink-0 mt-0.5" />
                <p className="text-xs text-gray-300 leading-relaxed">
                  Under South Africa&apos;s Rental Housing Act 50 of 1999, residential deposits must be invested in an interest-bearing account. Funds are locked securely in escrow and cannot be unilaterally deducted without digital sign-off or an order from the Rental Housing Tribunal.
                </p>
              </div>
            </div>
          )}

          {/* Tab 2: Interest Calculator */}
          {activeTab === 'interest' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-black/60 border border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase text-gray-300">Tenancy Duration:</span>
                  <span className="text-xs font-black text-gold-primary font-mono">{monthsHeld} Months</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={36}
                  value={monthsHeld}
                  onChange={e => setMonthsHeld(Number(e.target.value))}
                  className="w-full accent-gold-primary cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-gray-500 font-mono">
                  <span>1 Month</span>
                  <span>12 Months (1 Year)</span>
                  <span>36 Months (3 Years)</span>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-black/40 border border-white/10 space-y-2">
                <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-1.5">
                  <FileText size={13} className="text-gold-primary" /> RHA Interest Audit Log
                </h4>
                <div className="text-xs text-gray-300 space-y-1.5 font-mono">
                  <div className="flex justify-between py-1 border-b border-white/5">
                    <span>Base Capital Deposit:</span>
                    <span>{formatCurrency(depositAmount, 'ZAR')}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-white/5">
                    <span>Statutory Rate (FNB / Standard Bank Call Rate):</span>
                    <span>7.25% Compound Monthly</span>
                  </div>
                  <div className="flex justify-between py-1 text-emerald-400 font-bold">
                    <span>Tenant Net Payable Return:</span>
                    <span>{formatCurrency(totalBondVault, 'ZAR')}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 3: Dual Release Sign-Off */}
          {activeTab === 'release' && (
            <div className="space-y-4">
              <p className="text-xs text-gray-300">
                To release the escrow vault upon move-out inspection, both parties must digitally sign. If there are disputed damage deductions, escalate directly to the built-in arbitration portal.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Tenant Key */}
                <div className={`p-4 rounded-2xl border transition-all ${
                  tenantSigned ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300' : 'bg-black/60 border-white/10 text-gray-400'
                }`}>
                  <div className="flex items-center justify-between pb-2">
                    <span className="text-xs font-black uppercase">Tenant Key</span>
                    {tenantSigned ? <CheckCircle2 size={16} className="text-emerald-400" /> : <Lock size={16} />}
                  </div>
                  <p className="text-xs text-white font-bold">{tenantName}</p>
                  <p className="text-[10px] text-gray-400 mb-3">Move-out inspection verified</p>
                  <button
                    onClick={() => handleSignRelease('tenant')}
                    className={`w-full py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                      tenantSigned ? 'bg-emerald-500 text-black shadow-glow' : 'bg-white/10 hover:bg-white/15 text-white'
                    }`}
                  >
                    {tenantSigned ? 'Signed & Authorized' : 'Sign as Tenant'}
                  </button>
                </div>

                {/* Landlord Key */}
                <div className={`p-4 rounded-2xl border transition-all ${
                  landlordSigned ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300' : 'bg-black/60 border-white/10 text-gray-400'
                }`}>
                  <div className="flex items-center justify-between pb-2">
                    <span className="text-xs font-black uppercase">Landlord Key</span>
                    {landlordSigned ? <CheckCircle2 size={16} className="text-emerald-400" /> : <Lock size={16} />}
                  </div>
                  <p className="text-xs text-white font-bold">{landlordName}</p>
                  <p className="text-[10px] text-gray-400 mb-3">Premises passed snag inspection</p>
                  <button
                    onClick={() => handleSignRelease('landlord')}
                    className={`w-full py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                      landlordSigned ? 'bg-emerald-500 text-black shadow-glow' : 'bg-white/10 hover:bg-white/15 text-white'
                    }`}
                  >
                    {landlordSigned ? 'Signed & Authorized' : 'Sign as Landlord'}
                  </button>
                </div>
              </div>

              <button
                disabled={!tenantSigned || !landlordSigned}
                onClick={handleExecutePayout}
                className="w-full py-3.5 rounded-2xl bg-gold-primary hover:bg-gold-secondary text-black font-black text-xs uppercase tracking-wider transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed shadow-glow flex items-center justify-center gap-2"
              >
                <Unlock size={14} />
                <span>Execute Vault Payout ({formatCurrency(totalBondVault, 'ZAR')})</span>
              </button>
            </div>
          )}

          {statusMessage && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-3.5 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center gap-2"
            >
              <CheckCircle2 size={16} className="shrink-0" />
              <span>{statusMessage}</span>
            </motion.div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
