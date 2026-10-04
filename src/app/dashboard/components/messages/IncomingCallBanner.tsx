'use client'

import React, { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Phone, PhoneOff, Video, ShieldCheck } from 'lucide-react'
import { playTactileSound } from '../../../../utils/tactileSounds'

export interface IncomingCallData {
  callerId: string
  callerName: string
  callerAvatar?: string | null
  callerRole?: string
  callType: 'audio' | 'video'
}

interface IncomingCallBannerProps {
  incomingCall: IncomingCallData | null
  onAccept: (call: IncomingCallData) => void
  onDecline: () => void
}

export default function IncomingCallBanner({
  incomingCall,
  onAccept,
  onDecline
}: IncomingCallBannerProps) {
  // Ringtone chime interval
  useEffect(() => {
    if (!incomingCall) return

    playTactileSound('bell')
    const ringInterval = setInterval(() => {
      playTactileSound('chime')
    }, 2400)

    return () => clearInterval(ringInterval)
  }, [incomingCall])

  if (!incomingCall) return null

  return (
    <AnimatePresence>
      <div className="fixed top-4 inset-x-0 z-[10000] flex justify-center px-4 pointer-events-none">
        <motion.div
          initial={{ opacity: 0, y: -40, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -40, scale: 0.9 }}
          className="pointer-events-auto w-full max-w-md bg-black/90 backdrop-blur-2xl border border-[var(--gold-primary,#8EB69B)]/50 rounded-3xl p-4 sm:p-5 shadow-[0_10px_40px_rgba(0,0,0,0.8),0_0_30px_rgba(142,182,155,0.3)] flex items-center justify-between gap-4"
        >
          {/* Caller Avatar with Animated Pulse Rings */}
          <div className="relative shrink-0">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-gold-primary to-amber-500 flex items-center justify-center text-black font-black text-sm overflow-hidden shadow-md">
              {incomingCall.callerAvatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={incomingCall.callerAvatar} alt="" className="w-full h-full object-cover" />
              ) : (
                incomingCall.callerName.charAt(0).toUpperCase()
              )}
            </div>
            <div className="absolute inset-0 -m-1.5 rounded-2xl border-2 border-[var(--gold-primary,#8EB69B)]/50 animate-ping pointer-events-none" />
          </div>

          {/* Caller Details */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-black text-white truncate">{incomingCall.callerName}</span>
              <ShieldCheck size={12} className="text-[var(--gold-primary,#8EB69B)] shrink-0" />
            </div>
            <p className="text-[10px] text-gray-300 font-medium flex items-center gap-1 mt-0.5">
              {incomingCall.callType === 'video' ? (
                <>
                  <Video size={10} className="text-[var(--gold-primary,#8EB69B)]" />
                  <span>Incoming Resident Video Call...</span>
                </>
              ) : (
                <>
                  <Phone size={10} className="text-[var(--gold-primary,#8EB69B)]" />
                  <span>Incoming Resident Voice Call...</span>
                </>
              )}
            </p>
            <p className="text-[9px] text-gray-500 capitalize">{incomingCall.callerRole || 'Verified Resident'}</p>
          </div>

          {/* Action Call Buttons: Decline & Accept */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => {
                playTactileSound('alert')
                onDecline()
              }}
              className="p-3 rounded-2xl bg-red-600/20 hover:bg-red-600 border border-red-500/40 text-red-300 hover:text-white transition-all active:scale-95 shadow-md flex items-center justify-center"
              title="Decline Call"
              aria-label="Decline Call"
            >
              <PhoneOff size={16} />
            </button>
            <button
              onClick={() => {
                playTactileSound('success')
                onAccept(incomingCall)
              }}
              className="p-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-black font-black transition-all active:scale-95 shadow-glow flex items-center justify-center animate-bounce"
              title="Accept Call"
              aria-label="Accept Call"
            >
              {incomingCall.callType === 'video' ? <Video size={16} /> : <Phone size={16} />}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
