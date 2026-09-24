'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertCircle, PhoneCall, ShieldAlert, X, Radio, MapPin, CheckCircle2, ChevronRight } from 'lucide-react'
import { playTactileSound } from '../../utils/tactileSounds'

interface EmergencyContact {
  label: string
  number: string
  description: string
  iconColor: string
}

const EMERGENCY_SERVICES: EmergencyContact[] = [
  {
    label: 'South African Police Service (SAPS)',
    number: '10111',
    description: 'National emergency crime response hotline',
    iconColor: 'text-blue-400'
  },
  {
    label: 'National Ambulance & Paramedics',
    number: '10177',
    description: 'Medical emergencies & fire department dispatch',
    iconColor: 'text-red-400'
  },
  {
    label: 'Cellular Emergency (All Networks)',
    number: '112',
    description: 'Free emergency call from any mobile network in SA',
    iconColor: 'text-amber-400'
  },
  {
    label: 'Campus / Building Security Desk',
    number: '0800000000',
    description: 'Immediate resident concierge & gatehouse assistance',
    iconColor: 'text-emerald-400'
  }
]

export default function FloatingEmergencySOS() {
  const [isOpen, setIsOpen] = useState(false)
  const [isBeaconActive, setIsBeaconActive] = useState(false)
  const [beaconCountdown, setBeaconCountdown] = useState(5)

  useEffect(() => {
    let timer: NodeJS.Timeout
    if (isBeaconActive && beaconCountdown > 0) {
      timer = setTimeout(() => setBeaconCountdown(prev => prev - 1), 1000)
    }
    return () => clearTimeout(timer)
  }, [isBeaconActive, beaconCountdown])

  const triggerDistressBeacon = () => {
    playTactileSound('alert')
    setIsBeaconActive(true)
    setBeaconCountdown(5)
  }

  const cancelDistressBeacon = () => {
    playTactileSound('pop')
    setIsBeaconActive(false)
    setBeaconCountdown(5)
  }

  return (
    <>
      {/* Floating SOS Trigger Pill */}
      <div className="fixed bottom-20 right-4 z-40">
        <button
          type="button"
          onClick={() => {
            playTactileSound('alert')
            setIsOpen(true)
          }}
          className="group flex items-center gap-2 px-3.5 py-2.5 rounded-full bg-red-600/90 hover:bg-red-600 text-white font-black text-xs uppercase tracking-wider shadow-[0_0_25px_rgba(239,68,68,0.4)] backdrop-blur-md border border-red-500/40 transition-all hover:scale-105 active:scale-95"
          title="Emergency Help & South African Distress SOS"
        >
          <div className="w-2 h-2 rounded-full bg-white animate-ping" />
          <ShieldAlert size={16} />
          <span className="hidden sm:inline font-mono tracking-tight font-black">SOS HELP</span>
        </button>
      </div>

      {/* Emergency Drawer / Modal */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-[250] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/85 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, y: 50, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 50, scale: 0.95 }}
              className="relative w-full max-w-lg bg-black/95 border border-red-500/40 rounded-t-3xl sm:rounded-3xl p-6 sm:p-8 shadow-[0_0_60px_rgba(239,68,68,0.25)] backdrop-blur-2xl overflow-hidden"
            >
              {/* Emergency Ambient Ray */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-red-600/10 rounded-full blur-3xl pointer-events-none" />

              {/* Close Button */}
              <button
                onClick={() => {
                  playTactileSound('pop')
                  setIsOpen(false)
                  setIsBeaconActive(false)
                }}
                className="absolute top-5 right-5 p-2 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all"
              >
                <X size={18} />
              </button>

              {/* Header */}
              <div className="flex items-center gap-3.5 mb-6">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-red-600 to-rose-400 flex items-center justify-center text-white shadow-lg shadow-red-600/30">
                  <ShieldAlert size={26} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-black text-white tracking-tight">Rapid Response SOS</h3>
                    <span className="text-[10px] font-mono font-bold uppercase tracking-widest bg-red-500/20 text-red-400 border border-red-500/40 px-2 py-0.5 rounded-full">
                      24/7 SA DIRECT
                    </span>
                  </div>
                  <p className="text-xs text-gray-400">
                    Instant emergency dispatch, building safety, and silent distress signal
                  </p>
                </div>
              </div>

              {/* Silent Beacon Trigger */}
              <div className="mb-6 p-4 rounded-2xl bg-gradient-to-br from-red-950/40 to-black border border-red-500/30">
                {!isBeaconActive ? (
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <h4 className="text-xs font-black uppercase tracking-wider text-red-300 flex items-center gap-1.5">
                        <Radio size={14} className="animate-pulse" /> Silent Distress Ping
                      </h4>
                      <p className="text-[11px] text-gray-400 leading-snug">
                        Broadcasts your GPS coords to registered next-of-kin & building security.
                      </p>
                    </div>
                    <button
                      onClick={triggerDistressBeacon}
                      className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-black text-xs uppercase tracking-wider transition-all shadow-md active:scale-95 shrink-0"
                    >
                      Broadcast Beacon
                    </button>
                  </div>
                ) : (
                  <div className="text-center py-2 space-y-3">
                    <div className="flex items-center justify-center gap-2 text-red-400 font-mono text-sm font-black animate-pulse">
                      <Radio size={18} /> BROADCASTING DISTRESS BEACON IN {beaconCountdown}s...
                    </div>
                    <p className="text-xs text-gray-400">
                      Transmitting building coordinates and resident profile to designated guardians.
                    </p>
                    <button
                      onClick={cancelDistressBeacon}
                      className="px-6 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs uppercase tracking-wider border border-white/20 transition-all active:scale-95"
                    >
                      Cancel Beacon
                    </button>
                  </div>
                )}
              </div>

              {/* Direct Hotlines List */}
              <div className="space-y-2.5">
                <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest">
                  South African National Direct Hotlines
                </p>
                {EMERGENCY_SERVICES.map((serv, i) => (
                  <a
                    key={i}
                    href={`tel:${serv.number}`}
                    onClick={() => playTactileSound('click')}
                    className="p-3.5 rounded-2xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/5 hover:border-red-500/30 flex items-center justify-between transition-all group active:scale-98"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <PhoneCall size={14} className={serv.iconColor} />
                        <span className="text-xs font-bold text-white group-hover:text-red-400 transition-colors">
                          {serv.label}
                        </span>
                      </div>
                      <p className="text-[10px] text-gray-500 leading-snug">{serv.description}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-3 py-1 rounded-xl bg-white/5 text-white font-mono font-black text-xs group-hover:bg-red-500 group-hover:text-white transition-colors">
                        {serv.number}
                      </span>
                      <ChevronRight size={14} className="text-gray-600 group-hover:text-white transition-colors" />
                    </div>
                  </a>
                ))}
              </div>

              {/* Footer */}
              <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between text-[11px] text-gray-500">
                <span className="flex items-center gap-1.5 font-medium">
                  <CheckCircle2 size={13} className="text-emerald-400" /> End-to-end encrypted
                </span>
                <span className="font-mono text-[10px] uppercase">Act 50 Safety Standard</span>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  )
}
