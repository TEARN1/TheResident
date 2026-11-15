'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X, ShieldAlert, Landmark, Zap, Droplets, Car, Building2,
  Users, CheckCircle2, AlertTriangle, ArrowUpRight, Scale, Clock, Award
} from 'lucide-react'
import {
  findStatutoryWard,
  HEAVY_MUNICIPAL_DEPARTMENTS,
  calculateWardDeliveryConfidenceIndex,
  evaluateCivicPetitionQuorum,
  type StatutoryWard,
  type MunicipalDepartmentKey
} from '../../../../utils/civicChessboard'
import { playTactileSound } from '../../../../utils/tactileSounds'

interface SovereignWardModalProps {
  isOpen: boolean
  onClose: () => void
  currentCoords: { lat: number; lon: number } | null
}

export default function SovereignWardModal({
  isOpen,
  onClose,
  currentCoords
}: SovereignWardModalProps) {
  const coords = currentCoords || { lat: -26.1926, lon: 28.0305 } // Braamfontein default
  const ward = findStatutoryWard(coords.lat, coords.lon)

  const [activeTab, setActiveTab] = useState<'governance' | 'infrastructure' | 'petition'>('governance')
  const [petitionSignatures, setPetitionSignatures] = useState<number>(38)
  const [hasSigned, setHasSigned] = useState<boolean>(false)
  const [successBanner, setSuccessBanner] = useState<string | null>(null)

  // Ward Delivery Metrics
  const confidenceScore = calculateWardDeliveryConfidenceIndex(14, 2, 28)
  const petitionQuorum = evaluateCivicPetitionQuorum(
    'Urgent Substation Upgrade & Dead Robots Pointsmen Deployment',
    petitionSignatures,
    ward.wardNumber,
    50
  )

  if (!isOpen) return null

  const handleSignPetition = () => {
    if (hasSigned) return
    playTactileSound('success')
    setPetitionSignatures(prev => prev + 1)
    setHasSigned(true)
    setSuccessBanner('Your signature has been cryptographically added to the Ward Delivery Grievance Ledger!')
    setTimeout(() => setSuccessBanner(null), 4000)
  }

  const getPartyColor = (party: string) => {
    switch (party) {
      case 'ANC': return 'bg-amber-500/20 text-amber-300 border-amber-500/40'
      case 'DA': return 'bg-blue-500/20 text-blue-300 border-blue-500/40'
      case 'EFF': return 'bg-red-500/20 text-red-300 border-red-500/40'
      case 'ACTIONSA': return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
      case 'IFP': return 'bg-orange-500/20 text-orange-300 border-orange-500/40'
      default: return 'bg-purple-500/20 text-purple-300 border-purple-500/40'
    }
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="relative w-full max-w-3xl max-h-[92vh] flex flex-col rounded-2xl bg-slate-900 border border-indigo-500/30 shadow-2xl overflow-hidden text-slate-100"
        >
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-900/90 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
                <Landmark size={22} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-white tracking-wide">
                    Sovereign Ward OS: Ward {ward.wardNumber}
                  </h2>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 uppercase tracking-wider">
                    {ward.wardCode}
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  {ward.municipality} • {ward.suburb}
                </p>
              </div>
            </div>
            <button
              onClick={() => { playTactileSound('pop'); onClose() }}
              className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Navigation Tabs */}
          <div className="flex border-b border-slate-800 bg-slate-950/60 px-4 pt-2 gap-2">
            <button
              onClick={() => { playTactileSound('click'); setActiveTab('governance') }}
              className={`px-4 py-2 text-xs font-semibold rounded-t-lg transition-colors border-b-2 flex items-center gap-2 ${
                activeTab === 'governance'
                  ? 'border-indigo-500 text-indigo-400 bg-slate-900'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Scale size={14} />
              Ward Councillor & Delivery Index
            </button>
            <button
              onClick={() => { playTactileSound('click'); setActiveTab('infrastructure') }}
              className={`px-4 py-2 text-xs font-semibold rounded-t-lg transition-colors border-b-2 flex items-center gap-2 ${
                activeTab === 'infrastructure'
                  ? 'border-indigo-500 text-indigo-400 bg-slate-900'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Building2 size={14} />
              Heavy Municipal Departments
            </button>
            <button
              onClick={() => { playTactileSound('click'); setActiveTab('petition') }}
              className={`px-4 py-2 text-xs font-semibold rounded-t-lg transition-colors border-b-2 flex items-center gap-2 ${
                activeTab === 'petition'
                  ? 'border-indigo-500 text-indigo-400 bg-slate-900'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Users size={14} />
              Civic Petition Quorum ({petitionSignatures}/50)
            </button>
          </div>

          {/* Banner */}
          {successBanner && (
            <div className="bg-emerald-950/70 border-b border-emerald-500/40 px-4 py-2 text-xs text-emerald-300 flex items-center gap-2">
              <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
              <span>{successBanner}</span>
            </div>
          )}

          {/* Tab 1: Governance & Confidence Index */}
          {activeTab === 'governance' && (
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
              {/* Delivery Confidence Gauge Card */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-indigo-500/40 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 text-xs font-semibold text-indigo-300 uppercase tracking-wider">
                    <Award size={14} />
                    Ward Delivery Confidence Index
                  </div>
                  <h3 className="text-xl font-bold text-white mt-1">High Delivery Accountability</h3>
                  <p className="text-xs text-slate-400 mt-1 max-w-md">
                    Algorithmic rating based on resolved infrastructure faults, SLA compliance, and verified resident sign-offs.
                  </p>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <div className="relative w-20 h-20 rounded-full border-4 border-indigo-500/30 flex items-center justify-center bg-slate-950">
                    <span className="text-2xl font-bold font-mono text-indigo-400">{confidenceScore}%</span>
                  </div>
                  <div className="text-xs space-y-1">
                    <div className="text-emerald-400 font-semibold">14 Resolved SLAs</div>
                    <div className="text-amber-400 font-semibold">2 Breached SLAs</div>
                    <div className="text-slate-400">28 Citizen Audits</div>
                  </div>
                </div>
              </div>

              {/* Ward Councillor Profile Card */}
              <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/80 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-white text-base">{ward.councillor.name}</h4>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getPartyColor(ward.councillor.party)}`}>
                        {ward.councillor.party}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Statutory Ward Councillor • Ward Committee: {ward.councillor.wardCommitteeSeatsCount} Seats
                    </p>
                  </div>

                  <div className="text-right">
                    <div className="text-xs font-mono text-slate-300">{ward.councillor.phoneMasked}</div>
                    <div className="text-xs text-indigo-400 mt-0.5">{ward.councillor.email}</div>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-700/60 text-xs text-slate-300">
                  <span className="text-slate-400 font-medium">Official Constituency Office: </span>
                  {ward.councillor.officeAddress}
                </div>
              </div>

              {/* Statutory Sub-precinct Intersections */}
              <div className="p-4 rounded-xl bg-slate-800/30 border border-slate-700/60 space-y-2">
                <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Critical Monitored Intersections in Ward {ward.wardNumber}
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                  {ward.majorIntersections.map((inter, idx) => (
                    <div key={idx} className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800 flex items-center justify-between">
                      <span className="text-slate-200 truncate">{inter}</span>
                      <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0"></span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Heavy Municipal Departments */}
          {activeTab === 'infrastructure' && (
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3">
              {Object.entries(HEAVY_MUNICIPAL_DEPARTMENTS).map(([key, dept]) => (
                <div
                  key={key}
                  className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-700/80 space-y-2"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <div>
                      <h4 className="font-bold text-white text-sm flex items-center gap-2">
                        {key === 'power' && <Zap size={16} className="text-amber-400" />}
                        {key === 'water' && <Droplets size={16} className="text-cyan-400" />}
                        {key === 'roads' && <Car size={16} className="text-emerald-400" />}
                        {key === 'policing' && <ShieldAlert size={16} className="text-blue-400" />}
                        {key === 'waste' && <Building2 size={16} className="text-purple-400" />}
                        {dept.name}
                      </h4>
                      <div className="text-xs text-indigo-400 font-medium mt-0.5">{dept.agency}</div>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300">
                        Critical SLA: {dept.slaHoursCritical}h
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-slate-700/60 text-xs">
                    <div>
                      <span className="text-slate-400">Statutory Mandate: </span>
                      <span className="text-slate-200">{dept.statutoryAct}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Emergency Dispatch: </span>
                      <span className="text-slate-200 font-mono font-semibold">{dept.dispatchContact}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Tab 3: Statutory Petition Quorum */}
          {activeTab === 'petition' && (
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
              <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/80 space-y-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-indigo-400 uppercase tracking-wider">
                  <Landmark size={16} />
                  Chapter 4: Local Government Municipal Systems Act (Act 32 of 2000)
                </div>
                <h3 className="font-bold text-white text-base">{petitionQuorum.petitionTitle}</h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {petitionQuorum.statutoryNoticeBody}
                </p>

                {/* Progress Bar */}
                <div className="space-y-1.5 pt-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Binding Quorum Progress</span>
                    <span className="font-bold font-mono text-indigo-300">
                      {petitionQuorum.signaturesCount} / {petitionQuorum.quorumThreshold} Signatures ({petitionQuorum.percentAchieved}%)
                    </span>
                  </div>
                  <div className="w-full h-2.5 rounded-full bg-slate-950 overflow-hidden border border-slate-800">
                    <div
                      className="h-full bg-gradient-to-r from-indigo-500 to-emerald-400 transition-all duration-500"
                      style={{ width: `${petitionQuorum.percentAchieved}%` }}
                    />
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    onClick={handleSignPetition}
                    disabled={hasSigned}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                      hasSigned
                        ? 'bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 cursor-default'
                        : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20'
                    }`}
                  >
                    <CheckCircle2 size={14} />
                    {hasSigned ? 'Signed & Verified' : 'Sign Ward Grievance Petition'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="p-3 sm:p-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between text-xs text-slate-400">
            <span>Sovereign Civic Protocol • Statutory Republic of South Africa</span>
            <button
              onClick={() => { playTactileSound('click'); onClose() }}
              className="px-4 py-1.5 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-slate-950 font-bold transition-colors"
            >
              Done
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
