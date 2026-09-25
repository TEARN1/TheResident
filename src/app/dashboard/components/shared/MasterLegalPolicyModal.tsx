'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ShieldAlert, X, Scale, FileText, CheckCircle2, Lock, AlertTriangle, ChevronRight, Download } from 'lucide-react'
import { playTactileSound } from '../../../../utils/tactileSounds'

export interface LegalPolicyModalProps {
  isOpen: boolean
  onClose: () => void
  initialSection?: 'terms' | 'disclaimer' | 'privacy' | 'conduct'
}

export default function MasterLegalPolicyModal({
  isOpen,
  onClose,
  initialSection = 'disclaimer'
}: LegalPolicyModalProps) {
  const [activeTab, setActiveTab] = useState<'disclaimer' | 'terms' | 'privacy' | 'conduct'>(initialSection)
  const [hasAcknowledged, setHasAcknowledged] = useState(false)

  if (!isOpen) return null

  const handleDownload = () => {
    playTactileSound('pop')
    const fullLegalText = `
================================================================================
THE RESIDENT (TEARN ECOSYSTEM) - MASTER CIVIC LEGAL POLICIES & LIABILITY SHIELD
================================================================================
Last Updated: September 2026
Applies to: All Users, Tenants, Landlords, Visitors, Hosts & Third Parties Worldwide

1. STATUTORY DISCLAIMER OF LIABILITY (NO LANDLORD-TENANT RELATIONSHIP):
   - The Resident operates solely as a neutral technology platform, civic operating system,
     and peer-to-peer directory facilitating introductions between independent prospective
     tenants, verified roommates, and independent property owners/managers.
   - NEITHER THE RESIDENT, TEARN, NOR ITS OPERATORS, DIRECTORS, OR AFFILIATES ACT AS A REAL ESTATE
     BROKER, PROPERTY MANAGER, LANDLORD, TENANT, ESCROW AGENT, INSURER, OR LEGAL COUNSEL.
   - All agreements (including generated draft leases, snag lists, and expense splits) are
     advisory templates generated automatically based on user-supplied parameters. Users
     must exercise independent legal and financial due diligence before execution.

2. ZERO-TOLERANCE SCAM & FRAUD POLICY (SOVEREIGN GOVERNANCE):
   - Any resident or landlord attempting deposit extortion, off-platform advance fee fraud,
     identity misrepresentation, unlawful eviction, harassment, or violation of consumer
     protection statutes faces instant permanent IP & device hardware banning, forfeiture
     of reputation score, and immediate referral to domestic and international law enforcement.

3. INDEPENDENT TRANSACTIONS & ZERO HOLDING OF USER RENT:
   - The Resident does NOT custody, hold, or escrow security deposits or rent funds directly.
     All financial transfers occur directly between the respective parties or via licensed,
     statutory banking rails (Ozow, Capitec Pay, Stripe, SEPA, ACH).
   - Under no circumstances shall The Resident be held liable for rental defaults, property
     damage, deposit disputes, or personal injury occurring on leased premises.

4. USER VERIFICATION & SAFETY ASSUMPTION OF RISK:
   - While The Resident provides multi-factor verification, Trust Circles, and Next-of-Kin
     safety tools, users acknowledge that peer-to-peer co-living involves inherent personal risks.
   - Users agree to hold harmless and indemnify The Resident and TEARN from any disputes,
     claims, or damages arising out of roommate cohabitation, property condition, or landlord actions.

5. GLOBAL PRIVACY & DATA SOVEREIGNTY (POPIA / GDPR / CCPA COMPLIANCE):
   - Identification documents submitted for KYC are encrypted at rest with AES-256 and
     automatically purged post-verification according to statutory retention schedules.
   - No biometric or private personal data is ever sold or shared with unapproved third parties.

================================================================================
Generated and enforced by The Resident Civic Operating System | TEARN Engineering
================================================================================
    `.trim()

    const blob = new Blob([fullLegalText], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `TheResident_Master_Legal_Policies.txt`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="relative w-full max-w-2xl bg-black/95 border-2 border-gold-primary/40 rounded-3xl p-6 sm:p-8 shadow-[0_0_80px_rgba(212,175,55,0.2)] backdrop-blur-2xl overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Subtle Ambient Glow */}
          <div className="absolute top-0 right-0 w-60 h-60 bg-gold-primary/10 rounded-full blur-3xl pointer-events-none" />

          {/* Close button */}
          <button
            onClick={() => { playTactileSound('pop'); onClose() }}
            className="absolute top-5 right-5 p-2 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all z-20"
          >
            <X size={18} />
          </button>

          {/* Header */}
          <div className="flex items-center gap-3.5 mb-6 shrink-0 relative z-10">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-gold-primary flex items-center justify-center text-black shadow-lg shadow-gold-primary/20 shrink-0">
              <Scale size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black text-white tracking-tight">Master Civic Legal Policies</h3>
                <span className="text-[10px] font-black uppercase tracking-wider bg-gold-primary/15 text-gold-primary border border-gold-primary/30 px-2 py-0.5 rounded-full">
                  Liability Shield
                </span>
              </div>
              <p className="text-xs text-gray-400">
                Statutory protections, neutral platform disclaimers &amp; sovereign governance rules
              </p>
            </div>
          </div>

          {/* Policy Section Tabs */}
          <div className="flex bg-white/5 p-1 rounded-2xl border border-white/10 mb-4 shrink-0 gap-1 overflow-x-auto">
            <button
              onClick={() => { playTactileSound('tab'); setActiveTab('disclaimer') }}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap ${
                activeTab === 'disclaimer' ? 'bg-gold-primary text-black shadow-glow' : 'text-gray-400 hover:text-white'
              }`}
            >
              Platform Shield
            </button>
            <button
              onClick={() => { playTactileSound('tab'); setActiveTab('terms') }}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap ${
                activeTab === 'terms' ? 'bg-gold-primary text-black shadow-glow' : 'text-gray-400 hover:text-white'
              }`}
            >
              Terms of Service
            </button>
            <button
              onClick={() => { playTactileSound('tab'); setActiveTab('conduct') }}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap ${
                activeTab === 'conduct' ? 'bg-gold-primary text-black shadow-glow' : 'text-gray-400 hover:text-white'
              }`}
            >
              Zero Scam Policy
            </button>
            <button
              onClick={() => { playTactileSound('tab'); setActiveTab('privacy') }}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap ${
                activeTab === 'privacy' ? 'bg-gold-primary text-black shadow-glow' : 'text-gray-400 hover:text-white'
              }`}
            >
              POPIA &amp; GDPR
            </button>
          </div>

          {/* Policy Content Scroll View */}
          <div className="flex-1 overflow-y-auto pr-1 space-y-4 text-xs text-gray-300 leading-relaxed custom-scrollbar bg-black/40 border border-white/5 p-4 rounded-2xl">
            {activeTab === 'disclaimer' && (
              <div className="space-y-3">
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-start gap-2.5 text-amber-200">
                  <ShieldAlert size={18} className="shrink-0 mt-0.5 text-amber-400" />
                  <p className="text-[11px] leading-relaxed">
                    <strong>CRITICAL LEGAL NOTICE:</strong> The Resident is solely an independent neutral technological communications intermediary. Under no circumstances is the platform a party to any lease, property transaction, or living arrangement.
                  </p>
                </div>

                <h4 className="font-black text-white text-sm uppercase tracking-wide">1. Neutral Intermediary Status</h4>
                <p>
                  The platform provides algorithmic discovery tools, draft template generators, and peer communication software. The Resident does NOT own, operate, manage, inspect, or insure any residential properties listed by users.
                </p>

                <h4 className="font-black text-white text-sm uppercase tracking-wide">2. Comprehensive Limitation of Liability</h4>
                <p>
                  TO THE FULLEST EXTENT PERMITTED BY LAW, NEITHER THE RESIDENT, TEARN, NOR ITS FOUNDERS, DIRECTORS, OR DEVELOPERS SHALL BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES ARISING FROM:
                </p>
                <ul className="list-disc pl-5 space-y-1 text-gray-400">
                  <li>Any agreement, transaction, lease, or financial transfer conducted between tenants and landlords.</li>
                  <li>Any property defects, structural failures, health hazards, crime, or personal injury occurring on leased premises.</li>
                  <li>Any default on rent, theft, unauthorized subletting, or wrongful eviction by either party.</li>
                  <li>Any inaccuracies in user-submitted photos, amenities, or pricing information.</li>
                </ul>

                <h4 className="font-black text-white text-sm uppercase tracking-wide">3. Indemnification Covenant</h4>
                <p>
                  You agree to fully defend, indemnify, and hold harmless The Resident and TEARN from and against any claims, liabilities, damages, judgments, or legal fees arising out of your misuse of the platform or breach of residential agreements.
                </p>
              </div>
            )}

            {activeTab === 'terms' && (
              <div className="space-y-3">
                <h4 className="font-black text-white text-sm uppercase tracking-wide">1. Master User Agreement</h4>
                <p>
                  By accessing or registering on The Resident, you unconditionally agree to comply with all domestic and international tenancy regulations, consumer protection statutes, and building bylaws.
                </p>

                <h4 className="font-black text-white text-sm uppercase tracking-wide">2. Advisory Nature of Tools</h4>
                <p>
                  All automated contracts (such as the Universal Lease Generator, Expense Splitter, and Move-in Snag List) are educational advisory templates. Users are solely responsible for ensuring specific local municipal compliance before signing.
                </p>

                <h4 className="font-black text-white text-sm uppercase tracking-wide">3. Account Suspension &amp; Sovereign Control</h4>
                <p>
                  The Resident reserves the absolute, unfettered right to terminate, suspend, or permanently ban any account, listing, or device fingerprint without prior notice if fraudulent activity, harassment, or violation of community standards is suspected.
                </p>
              </div>
            )}

            {activeTab === 'conduct' && (
              <div className="space-y-3">
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start gap-2.5 text-red-200">
                  <AlertTriangle size={18} className="shrink-0 mt-0.5 text-red-400" />
                  <p className="text-[11px] leading-relaxed">
                    <strong>ZERO-TOLERANCE SCAM ENFORCEMENT:</strong> Advance-fee fraud, deposit skimming, or false advertising results in instant IP banning, forfeit of all resident credentials, and law enforcement escalation.
                  </p>
                </div>

                <h4 className="font-black text-white text-sm uppercase tracking-wide">1. Off-Platform Payment Skimming</h4>
                <p>
                  Users must never send untraceable cash, unverified cryptocurrency, or voucher payments to individuals before performing an in-person or verified virtual property inspection.
                </p>

                <h4 className="font-black text-white text-sm uppercase tracking-wide">2. Suburb Price Algorithmic Defense</h4>
                <p>
                  Listings with pricing drastically departing from verified municipal medians are quarantined automatically by the Layer-14 Scam Defense engine.
                </p>
              </div>
            )}

            {activeTab === 'privacy' && (
              <div className="space-y-3">
                <h4 className="font-black text-white text-sm uppercase tracking-wide">1. Privacy &amp; Data Sovereignty (POPIA / GDPR)</h4>
                <p>
                  The Resident strictly honors South Africa&apos;s Protection of Personal Information Act (POPIA Act 4 of 2013) and the EU General Data Protection Regulation (GDPR).
                </p>

                <h4 className="font-black text-white text-sm uppercase tracking-wide">2. Document Storage &amp; Cryptographic Hashing</h4>
                <p>
                  Identity documents uploaded for verification badges are stored in isolated encrypted cloud vaults and never shared with other tenants or unauthorized landlords.
                </p>

                <h4 className="font-black text-white text-sm uppercase tracking-wide">3. Right to Erasure</h4>
                <p>
                  Users maintain full sovereignty over their data. You may request complete account and biometric deletion at any time via your profile settings.
                </p>
              </div>
            )}
          </div>

          {/* Acknowledgement and Actions */}
          <div className="mt-5 pt-4 border-t border-white/10 shrink-0 space-y-3">
            <label className="flex items-center gap-2.5 text-xs text-gray-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={hasAcknowledged}
                onChange={(e) => {
                  playTactileSound('click')
                  setHasAcknowledged(e.target.checked)
                }}
                className="w-4 h-4 rounded bg-white/10 border-white/20 text-gold-primary focus:ring-gold-primary accent-gold-primary"
              />
              <span>
                I understand and agree to the <strong>Platform Liability Shield</strong> and <strong>Neutral Intermediary Terms</strong>.
              </span>
            </label>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => {
                  playTactileSound('success')
                  onClose()
                }}
                disabled={!hasAcknowledged}
                className="flex-1 bg-gold-primary hover:bg-gold-secondary disabled:opacity-40 disabled:pointer-events-none text-black font-black py-3 rounded-xl text-xs uppercase tracking-wider transition-all shadow-lg active:scale-98 flex items-center justify-center gap-2"
              >
                <CheckCircle2 size={16} /> Acknowledge &amp; Proceed
              </button>

              <button
                onClick={handleDownload}
                className="px-4 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs uppercase tracking-wider transition-all active:scale-95 flex items-center justify-center gap-1.5"
                title="Download complete legal policy statement"
              >
                <Download size={14} /> Download Policy (.txt)
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
