'use client'

import React, { useState, useEffect } from 'react'
import { useSelector } from 'react-redux'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Cpu, ShieldCheck, Zap, Activity, CheckCircle2, AlertTriangle, MessageSquare, CreditCard, X
} from 'lucide-react'
import { RootState } from '../../../../store'
import { automationEngine, type AutomationLog } from '../../../../utils/automationEngine'

export default function AutomationControlPanel() {
  const [open, setOpen] = useState(false)
  const [logs, setLogs] = useState<AutomationLog[]>([])
  const [runningAction, setRunningAction] = useState<string | null>(null)
  const [paySuccessMsg, setPaySuccessMsg] = useState<string | null>(null)

  const listings = useSelector((state: RootState) => state.listings.items)
  const currentUser = useSelector((state: RootState) => state.auth.currentUser)

  useEffect(() => {
    const unsubscribe = automationEngine.subscribe(updatedLogs => {
      setLogs(updatedLogs)
    })
    // Seed initial startup logs
    automationEngine.addLog('Layer 1: Infrastructure', 'Next.js App Router Edge Engine Online', 'info', 'Environment ready.')
    automationEngine.addLog('Layer 15: Resilience', 'Offline Queue Engine Initialized', 'info', 'Bounded queue active.')
    return unsubscribe
  }, [])

  const handleRunScamScan = () => {
    setRunningAction('scam')
    const flagged = automationEngine.scanListingsForScams(listings)
    setTimeout(() => {
      setRunningAction(null)
      if (flagged.length === 0) {
        automationEngine.addLog('Layer 14: Scam Defense', 'Scan Completed', 'success', `Scanned ${listings.length} listings. All prices aligned with suburb medians.`)
      }
    }, 600)
  }

  const handleRunPOPIAAudit = () => {
    setRunningAction('popia')
    setTimeout(() => {
      automationEngine.checkPOPIACompliance(42)
      setRunningAction(null)
    }, 500)
  }

  const handleTestInstantEFT = async (provider: 'Ozow' | 'Capitec Pay') => {
    setRunningAction(`pay-${provider}`)
    const res = await automationEngine.processSAInstantEFT(350, provider, 'ROOM-RENT-DEPOSIT')
    setRunningAction(null)
    setPaySuccessMsg(`R350 cleared via ${res.provider}! TX: ${res.transactionId}`)
    setTimeout(() => setPaySuccessMsg(null), 4000)
  }

  const handleTestWhatsAppAlert = () => {
    automationEngine.sendWhatsAppAlert(
      currentUser?.email ? `+27 (0)82 555 0192` : '+27 (0)82 000 0000',
      'load_shedding',
      'Stage 2 load shedding starts in Rosebank at 20:00. Charged power bank reminder!'
    )
  }

  return (
    <>
      {/* Floating Automation Telemetry Launcher — bottom bar pill */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-20 right-4 z-[400] bg-black/90 hover:bg-black backdrop-blur-xl border border-gold-primary/30 text-gold-primary font-black px-3.5 py-2 rounded-2xl shadow-2xl flex items-center gap-2 text-[10px] uppercase tracking-widest transition-all active:scale-95 group"
        title="View 15-Layer Automation Engine Telemetry"
      >
        <Cpu size={15} className="text-gold-primary group-hover:rotate-90 transition-transform duration-500" />
        <span className="hidden sm:inline">Automation Hub</span>
        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
      </button>

      {/* Slide-out Automation Control Panel */}
      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-[600] flex justify-end">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="relative w-full max-w-md bg-black border-l border-white/10 h-full overflow-y-auto p-6 space-y-6 z-10"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div>
                  <h2 className="text-base font-black text-white uppercase tracking-wider flex items-center gap-2">
                    <Zap size={18} className="text-gold-primary" /> 15-Layer Automation Hub
                  </h2>
                  <p className="text-[10px] text-gray-400 mt-0.5">Real-time system telemetry & operational connectors</p>
                </div>
                <button onClick={() => setOpen(false)} className="text-gray-500 hover:text-white p-1">
                  <X size={18} />
                </button>
              </div>

              {/* Status Chips */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-white/2 border border-white/5 rounded-xl space-y-1">
                  <span className="text-[9px] text-gray-500 font-bold uppercase tracking-widest block">SECURITY & SCAM DEFENSE</span>
                  <span className="text-xs font-black text-green-400 flex items-center gap-1">
                    <ShieldCheck size={14} /> Active & Scanning
                  </span>
                </div>
                <div className="p-3 bg-white/2 border border-white/5 rounded-xl space-y-1">
                  <span className="text-[9px] text-gray-500 font-bold uppercase tracking-widest block">POPIA PRIVACY GUARD</span>
                  <span className="text-xs font-black text-gold-primary flex items-center gap-1">
                    <CheckCircle2 size={14} /> Compliant (Act 4)
                  </span>
                </div>
              </div>

              {/* Trigger Actions */}
              <div className="space-y-3">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Manual Automation Triggers</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    onClick={handleRunScamScan}
                    disabled={runningAction === 'scam'}
                    className="p-2.5 bg-white/5 hover:bg-gold-primary/10 border border-white/10 hover:border-gold-primary/30 rounded-xl text-left transition-all active:scale-95 disabled:opacity-50"
                  >
                    <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                      <AlertTriangle size={13} className="text-gold-primary" /> Scan Scams
                    </div>
                    <p className="text-[9px] text-gray-500 mt-0.5">Check pricing anomalies</p>
                  </button>

                  <button
                    onClick={handleRunPOPIAAudit}
                    disabled={runningAction === 'popia'}
                    className="p-2.5 bg-white/5 hover:bg-gold-primary/10 border border-white/10 hover:border-gold-primary/30 rounded-xl text-left transition-all active:scale-95 disabled:opacity-50"
                  >
                    <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                      <ShieldCheck size={13} className="text-gold-primary" /> POPIA Audit
                    </div>
                    <p className="text-[9px] text-gray-500 mt-0.5">Purge aged KYC docs</p>
                  </button>

                  <button
                    onClick={() => handleTestInstantEFT('Ozow')}
                    disabled={!!runningAction}
                    className="p-2.5 bg-white/5 hover:bg-gold-primary/10 border border-white/10 hover:border-gold-primary/30 rounded-xl text-left transition-all active:scale-95 disabled:opacity-50"
                  >
                    <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                      <CreditCard size={13} className="text-green-400" /> Ozow EFT
                    </div>
                    <p className="text-[9px] text-gray-500 mt-0.5">Test Instant EFT (R350)</p>
                  </button>

                  <button
                    onClick={handleTestWhatsAppAlert}
                    className="p-2.5 bg-white/5 hover:bg-gold-primary/10 border border-white/10 hover:border-gold-primary/30 rounded-xl text-left transition-all active:scale-95"
                  >
                    <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                      <MessageSquare size={13} className="text-blue-400" /> WhatsApp
                    </div>
                    <p className="text-[9px] text-gray-500 mt-0.5">Send test load-shedding SMS</p>
                  </button>
                </div>

                {paySuccessMsg && (
                  <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-xl text-xs text-green-300 font-bold flex items-center gap-2">
                    <CheckCircle2 size={16} className="shrink-0" /> {paySuccessMsg}
                  </div>
                )}
              </div>

              {/* Real-time Telemetry Stream */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                    <Activity size={12} className="text-gold-primary" /> System Telemetry Log
                  </p>
                  <span className="text-[9px] text-gray-600 font-mono">{logs.length} events</span>
                </div>

                <div className="bg-black border border-white/10 rounded-xl p-3 h-64 overflow-y-auto space-y-2 font-mono text-[11px] custom-scrollbar">
                  {logs.length === 0 ? (
                    <p className="text-gray-600 text-[10px] italic">Awaiting automation events...</p>
                  ) : (
                    logs.map(log => (
                      <div key={log.id} className="p-2 rounded-lg bg-white/2 border border-white/5 space-y-0.5">
                        <div className="flex items-center justify-between text-[9px]">
                          <span className="text-gold-primary font-bold">{log.layer}</span>
                          <span className="text-gray-600">{log.timestamp}</span>
                        </div>
                        <p className="text-white font-bold text-[10px]">{log.action}</p>
                        <p className="text-gray-400 text-[9px] leading-relaxed">{log.details}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  )
}
