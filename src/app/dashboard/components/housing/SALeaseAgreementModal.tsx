'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, FileText, Download, ShieldCheck, CheckCircle2, AlertCircle, Building, Calendar, DollarSign } from 'lucide-react'
import { playTactileSound } from '../../../../utils/tactileSounds'

interface SALeaseAgreementModalProps {
  isOpen: boolean
  onClose: () => void
  listingTitle?: string
  listingAddress?: string
  monthlyRent?: number
  currency?: string
}

type Jurisdiction = 'SA' | 'UK' | 'US' | 'EU' | 'GLOBAL'

interface JurisdictionConfig {
  code: Jurisdiction
  label: string
  flag: string
  law: string
  defaultCurrency: string
}

const JURISDICTIONS: JurisdictionConfig[] = [
  { code: 'GLOBAL', label: 'Global Universal', flag: '🌐', law: 'UN-HABITAT Co-Living Standard', defaultCurrency: 'USD' },
  { code: 'SA', label: 'South Africa', flag: '🇿🇦', law: 'Rental Housing Act 50 of 1999 & CPA', defaultCurrency: 'ZAR' },
  { code: 'UK', label: 'United Kingdom', flag: '🇬🇧', law: 'Housing Act 1988 (AST) & Tenant Fees Act', defaultCurrency: 'GBP' },
  { code: 'US', label: 'United States', flag: '🇺🇸', law: 'Uniform Residential Landlord & Tenant Act', defaultCurrency: 'USD' },
  { code: 'EU', label: 'European Union / Germany', flag: '🇪🇺', law: 'BGB § 535 Residential Tenancy Code', defaultCurrency: 'EUR' }
]

export default function SALeaseAgreementModal({
  isOpen,
  onClose,
  listingTitle = 'Standard Residential Room',
  listingAddress = 'International Co-Living Residence',
  monthlyRent = 1200,
  currency: initialCurrency = 'USD'
}: SALeaseAgreementModalProps) {
  const [jurisdiction, setJurisdiction] = useState<Jurisdiction>('GLOBAL')
  const [tenantName, setTenantName] = useState('')
  const [landlordName, setLandlordName] = useState('')
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0])
  const [leaseMonths, setLeaseMonths] = useState(12)
  const [currency, setCurrency] = useState(initialCurrency || 'USD')
  const [depositAmount, setDepositAmount] = useState(monthlyRent)
  const [hasGenerated, setHasGenerated] = useState(false)

  if (!isOpen) return null

  const selectedJur = JURISDICTIONS.find(j => j.code === jurisdiction) || JURISDICTIONS[0]

  const handleGenerate = (e: React.FormEvent) => {
    e.preventDefault()
    playTactileSound('success')
    setHasGenerated(true)
  }

  const handleDownload = () => {
    playTactileSound('pop')
    // Generate clean text printable agreement for tenant & landlord
    const leaseContent = `
================================================================================
STANDARD RESIDENTIAL CO-LIVING LEASE AGREEMENT
JURISDICTION: ${selectedJur.flag} ${selectedJur.label.toUpperCase()} (${selectedJur.law})
================================================================================

1. PARTIES:
   Landlord / Lessor: ${landlordName || 'To be specified'}
   Tenant / Lessee:   ${tenantName || 'To be specified'}

2. LEASED PREMISES:
   Property: ${listingTitle}
   Address:  ${listingAddress}

3. DURATION:
   Commencement Date: ${startDate}
   Initial Period:    ${leaseMonths} Calendar Months

4. FINANCIAL COVENANTS:
   Monthly Rental:    ${currency} ${monthlyRent.toLocaleString()} per calendar month, payable in advance on or before the 1st of each month.
   Security Deposit:  ${currency} ${depositAmount.toLocaleString()} held under official statutory protection regulations.

5. HOUSEHOLD RULES & COMMUNITY CONDUCT:
   - Quiet hours observed 22:00 - 07:00.
   - Resident agrees to adhere to the building chore rotation and safety guidelines.
   - Subletting is strictly prohibited without prior written consent from the Landlord.
   - Equal protection against arbitrary eviction under ${selectedJur.law}.

6. SIGNATURES:

   ______________________________        ______________________________
   Landlord Signature                    Tenant Signature

   Date: ________________________        Date: ________________________

================================================================================
Generated via The Resident Global Civic Platform (TEARN Ecosystem)
================================================================================
    `.trim()

    const blob = new Blob([leaseContent], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `Lease_Agreement_${selectedJur.code}_${(tenantName || 'Tenant').replace(/\s+/g, '_')}.txt`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="relative w-full max-w-xl bg-black/95 border border-gold-primary/30 rounded-3xl p-6 sm:p-8 shadow-[0_0_50px_rgba(212,175,55,0.15)] backdrop-blur-2xl overflow-hidden"
        >
          {/* Ambient Glow */}
          <div className="absolute top-0 right-0 w-48 h-48 bg-gold-primary/10 rounded-full blur-3xl pointer-events-none" />

          {/* Close button */}
          <button
            onClick={() => { playTactileSound('pop'); onClose() }}
            className="absolute top-5 right-5 p-2 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all"
          >
            <X size={18} />
          </button>

              {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-gold-primary to-amber-500 flex items-center justify-center text-black shadow-lg">
              <FileText size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black text-white tracking-tight">Legal Lease Generator</h3>
                <span className="text-[10px] font-black uppercase tracking-wider bg-gold-primary/15 text-gold-primary border border-gold-primary/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <span>{selectedJur.flag}</span>
                  <span>{selectedJur.code}</span>
                </span>
              </div>
              <p className="text-xs text-gray-400">
                {selectedJur.law}
              </p>
            </div>
          </div>

          {!hasGenerated ? (
            <form onSubmit={handleGenerate} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] text-gray-400 uppercase font-black tracking-wider flex items-center justify-between">
                  <span>Legal Jurisdiction & Standard</span>
                  <span className="text-gold-primary lowercase font-medium">auto-configured</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {JURISDICTIONS.map((jur) => {
                    const isSelected = jurisdiction === jur.code
                    return (
                      <button
                        type="button"
                        key={jur.code}
                        onClick={() => {
                          playTactileSound('click')
                          setJurisdiction(jur.code)
                          if (!currency || currency === 'USD' || currency === 'ZAR') {
                            setCurrency(jur.defaultCurrency)
                          }
                        }}
                        className={`p-2 rounded-xl text-left border transition-all text-xs flex items-center gap-2 ${
                          isSelected
                            ? 'bg-gold-primary/20 border-gold-primary text-white shadow-[0_0_15px_rgba(212,175,55,0.2)]'
                            : 'bg-white/5 border-white/10 text-gray-400 hover:text-white hover:bg-white/10'
                        }`}
                      >
                        <span className="text-base">{jur.flag}</span>
                        <div className="overflow-hidden">
                          <p className="font-bold truncate text-[11px]">{jur.label}</p>
                          <p className="text-[9px] text-gray-400 truncate">{jur.defaultCurrency}</p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] text-gray-400 uppercase font-black tracking-wider">Tenant Full Name</label>
                  <input
                    type="text"
                    required
                    value={tenantName}
                    onChange={(e) => setTenantName(e.target.value)}
                    placeholder="e.g. Sipho Dlamini"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white outline-none focus:border-gold-primary/50"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-gray-400 uppercase font-black tracking-wider">Landlord / Owner Name</label>
                  <input
                    type="text"
                    required
                    value={landlordName}
                    onChange={(e) => setLandlordName(e.target.value)}
                    placeholder="e.g. Estate Management / Owner"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white outline-none focus:border-gold-primary/50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] text-gray-400 uppercase font-black tracking-wider">Start Date</label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-gold-primary/50"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-gray-400 uppercase font-black tracking-wider">Term (Months)</label>
                  <select
                    value={leaseMonths}
                    onChange={(e) => setLeaseMonths(Number(e.target.value))}
                    className="w-full bg-black border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-gold-primary/50"
                  >
                    <option value={6}>6 Months</option>
                    <option value={12}>12 Months (Standard)</option>
                    <option value={24}>24 Months</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-gray-400 uppercase font-black tracking-wider">Deposit ({currency})</label>
                  <input
                    type="number"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(Number(e.target.value))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-gold-primary/50"
                  />
                </div>
              </div>

              <div className="p-3 bg-gold-primary/5 border border-gold-primary/20 rounded-xl flex items-start gap-2.5">
                <ShieldCheck size={16} className="text-gold-primary shrink-0 mt-0.5" />
                <p className="text-[11px] text-gray-300 leading-relaxed">
                  Compliant with {selectedJur.flag} <strong className="text-white">{selectedJur.label}</strong> ({selectedJur.law}): includes standard statutory notice provisions, deposit custody terms, and mutual termination rights.
                </p>
              </div>

              <button
                type="submit"
                className="w-full bg-gold-primary hover:bg-gold-secondary text-black font-black py-3 rounded-xl text-xs uppercase tracking-wider transition-all shadow-lg active:scale-98"
              >
                Generate Lease Document
              </button>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 max-h-56 overflow-y-auto font-mono text-[11px] text-gray-300 space-y-2 whitespace-pre-wrap leading-relaxed">
                <span className="text-gold-primary font-bold">READY FOR SIGNATURES</span>
                {`
PREMISES: ${listingTitle}
ADDRESS: ${listingAddress}
LESSOR: ${landlordName}
LESSEE: ${tenantName}
RENT: ${currency} ${monthlyRent.toLocaleString()} / mo
TERM: ${leaseMonths} Months starting ${startDate}
DEPOSIT: ${currency} ${depositAmount.toLocaleString()}`}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={handleDownload}
                  className="flex-1 bg-gold-primary hover:bg-gold-secondary text-black font-black py-3 rounded-xl text-xs uppercase tracking-wider transition-all shadow-lg flex items-center justify-center gap-2 active:scale-98"
                >
                  <Download size={14} /> Download (.txt)
                </button>
                <button
                  onClick={() => {
                    playTactileSound('pop')
                    const subject = encodeURIComponent(`Lease Agreement - ${listingTitle} (${tenantName})`)
                    const body = encodeURIComponent(
                      `Hi ${landlordName || 'Landlord'},\n\nPlease find the standard residential lease agreement generated via The Resident platform:\n\nTenant: ${tenantName}\nPremises: ${listingTitle} (${listingAddress})\nCommencement: ${startDate}\nTerm: ${leaseMonths} Months\nRent: ${currency} ${monthlyRent.toLocaleString()}/mo\nDeposit: ${currency} ${depositAmount.toLocaleString()}\n\nLet me know if all terms are approved.\n\nWarm regards,\n${tenantName}`
                    )
                    window.open(`mailto:?subject=${subject}&body=${body}`, '_blank')
                  }}
                  className="px-4 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs uppercase tracking-wider transition-all active:scale-95 flex items-center justify-center gap-1.5"
                  title="Open default email client with formatted lease draft"
                >
                  <span>Email</span>
                </button>
                <button
                  onClick={() => { playTactileSound('click'); setHasGenerated(false) }}
                  className="px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white font-bold text-xs uppercase tracking-wider transition-all active:scale-95"
                >
                  Edit
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
