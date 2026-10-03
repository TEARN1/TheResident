'use client'

import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  PhoneOff, Mic, MicOff, Video, VideoOff,
  Minimize2, Maximize2, Volume2, VolumeX, ShieldCheck
} from 'lucide-react'
import { playTactileSound } from '../../../../utils/tactileSounds'

export type CallType = 'audio' | 'video'
export type CallStatus = 'connecting' | 'ringing' | 'connected' | 'ended'

export interface ActiveCallModalProps {
  isOpen: boolean
  onClose: () => void
  callType: CallType
  contact: {
    id: string
    name: string
    avatarUrl?: string | null
    role?: string
    phone?: string
  }
}

export default function ActiveCallModal({
  isOpen,
  onClose,
  callType,
  contact
}: ActiveCallModalProps) {
  const [status, setStatus] = useState<CallStatus>('connecting')
  const [duration, setDuration] = useState(0)
  const [isMuted, setIsMuted] = useState(false)
  const [isVideoOff, setIsVideoOff] = useState(callType === 'audio')
  const [isSpeakerOn, setIsSpeakerOn] = useState(true)
  const [isMinimized, setIsMinimized] = useState(false)
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)

  const localVideoRef = useRef<HTMLVideoElement>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  // Initialize MediaStream if video is requested
  useEffect(() => {
    if (!isOpen) return

    // eslint-disable-next-line react-hooks/set-state-in-effect -- resetting call state when modal opens
    setStatus('connecting')
    setIsMinimized(false)
    setDuration(0)
    setIsMuted(false)
    setIsVideoOff(callType === 'audio')

    let activeStream: MediaStream | null = null

    if (callType === 'video' && typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        .then(stream => {
          activeStream = stream
          setLocalStream(stream)
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = stream
          }
        })
        .catch(() => {
          // Camera permission denied or not available; fallback to audio/simulated stream
          setIsVideoOff(true)
        })
    }

    // Call ring progression simulation
    const ringTimeout = setTimeout(() => {
      playTactileSound('chime')
      setStatus('ringing')
    }, 1200)

    const connectTimeout = setTimeout(() => {
      playTactileSound('success')
      setStatus('connected')
    }, 3800)

    return () => {
      clearTimeout(ringTimeout)
      clearTimeout(connectTimeout)
      if (activeStream) {
        activeStream.getTracks().forEach(track => track.stop())
      }
    }
  }, [isOpen, callType])

  // Timer for connected call
  useEffect(() => {
    if (status === 'connected') {
      timerRef.current = setInterval(() => {
        setDuration(prev => prev + 1)
      }, 1000)
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [status])

  // Sync video ref when stream changes
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream
    }
  }, [localStream, isVideoOff, isMinimized])

  const handleEndCall = () => {
    playTactileSound('alert')
    setStatus('ended')
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop())
    }
    setTimeout(() => {
      onClose()
      setIsMinimized(false)
    }, 600)
  }

  const toggleMute = () => {
    playTactileSound('click')
    const next = !isMuted
    setIsMuted(next)
    if (localStream) {
      localStream.getAudioTracks().forEach(track => { track.enabled = !next })
    }
  }

  const toggleVideo = () => {
    playTactileSound('click')
    const next = !isVideoOff
    setIsVideoOff(next)
    if (localStream) {
      localStream.getVideoTracks().forEach(track => { track.enabled = !next })
    }
  }

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60)
    const rem = secs % 60
    return `${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`
  }

  if (!isOpen) return null

  // 1. Minimized Floating Phone Call Widget
  if (isMinimized) {
    return (
      <div className="fixed bottom-20 right-4 md:bottom-6 md:right-6 z-[9999] pointer-events-auto">
        <motion.div
          initial={{ scale: 0.8, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          className="bg-black/90 backdrop-blur-2xl border border-[var(--gold-primary,#8EB69B)]/50 rounded-2xl p-3 shadow-2xl flex items-center gap-3.5"
        >
          <div className="relative">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gold-primary to-amber-500 flex items-center justify-center text-black font-black text-xs overflow-hidden">
              {contact.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={contact.avatarUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                contact.name.charAt(0).toUpperCase()
              )}
            </div>
            {status === 'connected' && (
              <span className="absolute -bottom-1 -right-1 w-3 h-3 rounded-full bg-emerald-400 border-2 border-black animate-pulse" />
            )}
          </div>

          <div className="min-w-0 pr-1">
            <p className="text-xs font-black text-white truncate max-w-[120px]">{contact.name}</p>
            <div className="flex items-center gap-1.5 text-[10px] text-gray-400 font-bold">
              {status === 'connected' ? (
                <span className="text-emerald-400 font-mono">{formatTime(duration)}</span>
              ) : (
                <span className="capitalize">{status}...</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1 pl-1 border-l border-white/10">
            <button
              onClick={toggleMute}
              className={`p-2 rounded-xl transition-all ${isMuted ? 'bg-red-500/20 text-red-400' : 'bg-white/5 text-gray-300 hover:text-white'}`}
              aria-label={isMuted ? 'Unmute microphone' : 'Mute microphone'}
            >
              {isMuted ? <MicOff size={14} /> : <Mic size={14} />}
            </button>
            <button
              onClick={() => setIsMinimized(false)}
              className="p-2 rounded-xl bg-white/5 text-gray-300 hover:text-white hover:bg-white/10 transition-all"
              aria-label="Maximize call window"
            >
              <Maximize2 size={14} />
            </button>
            <button
              onClick={handleEndCall}
              className="p-2 rounded-xl bg-red-600 hover:bg-red-500 text-white transition-all active:scale-95"
              aria-label="End call"
            >
              <PhoneOff size={14} />
            </button>
          </div>
        </motion.div>
      </div>
    )
  }

  // 2. Fullscreen Active Call Modal Screen
  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[9990] flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-xl">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-lg bg-[var(--card-bg,rgba(11,43,38,0.85))] border border-[var(--glass-border,rgba(142,182,155,0.3))] rounded-3xl sm:rounded-[32px] overflow-hidden shadow-2xl backdrop-blur-3xl flex flex-col justify-between min-h-[520px] max-h-[90vh]"
        >
          {/* Top Bar with Status and Minimize */}
          <div className="flex items-center justify-between p-4 sm:p-6 border-b border-white/10 bg-white/[0.02]">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
              <span className="text-[10px] font-black uppercase tracking-widest text-[var(--gold-primary,#8EB69B)]">
                Resident Encrypted {callType === 'video' ? 'Video' : 'Voice'} Call
              </span>
            </div>
            <button
              onClick={() => setIsMinimized(true)}
              className="p-2.5 rounded-2xl bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white transition-all active:scale-95"
              title="Minimize to floating phone badge"
              aria-label="Minimize to floating phone badge"
            >
              <Minimize2 size={16} />
            </button>
          </div>

          {/* Central Call Stage */}
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-6">
            {callType === 'video' && !isVideoOff && localStream ? (
              <div className="relative w-full aspect-video rounded-3xl overflow-hidden bg-black/90 border border-white/15 shadow-inner">
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover mirror"
                />
                <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-xl px-2.5 py-1 rounded-xl text-[10px] text-white font-bold flex items-center gap-1.5 border border-white/10">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> You (Live HD)
                </div>
              </div>
            ) : (
              <div className="relative">
                <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-3xl bg-gradient-to-tr from-gold-primary via-amber-400 to-emerald-600 p-1 shadow-[0_0_40px_rgba(142,182,155,0.4)] relative">
                  <div className="w-full h-full rounded-[22px] bg-black/80 flex items-center justify-center overflow-hidden">
                    {contact.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={contact.avatarUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-3xl font-black text-white">{contact.name.charAt(0).toUpperCase()}</span>
                    )}
                  </div>
                </div>

                {/* Animated Voice Radar Rings */}
                {status === 'connected' && !isMuted && (
                  <div className="absolute inset-0 -m-3 rounded-3xl border-2 border-[var(--gold-primary,#8EB69B)]/40 animate-ping pointer-events-none" />
                )}
              </div>
            )}

            <div className="space-y-1.5">
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">{contact.name}</h2>
              <div className="flex items-center justify-center gap-2 text-xs text-gray-400 font-medium">
                <span className="flex items-center gap-1 text-[var(--gold-primary,#8EB69B)]">
                  <ShieldCheck size={14} /> Verified Resident
                </span>
                <span>•</span>
                <span className="capitalize">{contact.role || 'Member'}</span>
              </div>
            </div>

            {/* Live Call Duration / Status Pill */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-black/60 border border-white/10 text-xs font-mono font-bold text-gray-200 shadow-inner">
              {status === 'connected' ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span>{formatTime(duration)}</span>
                </>
              ) : status === 'ringing' ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                  <span>Ringing resident phone…</span>
                </>
              ) : (
                <>
                  <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                  <span>Establishing secure audio channel…</span>
                </>
              )}
            </div>

            {/* Audio Waveform Equalizer Display */}
            {status === 'connected' && !isMuted && (
              <div className="flex items-center justify-center gap-1 h-6 pt-2">
                {[12, 24, 18, 28, 14, 22, 10, 26, 16, 20].map((h, i) => (
                  <div
                    key={i}
                    style={{ height: `${h}px` }}
                    className="w-1 bg-[var(--gold-primary,#8EB69B)] rounded-full animate-pulse"
                  />
                ))}
              </div>
            )}
          </div>

          {/* Action Control Panel Footer */}
          <div className="p-6 bg-black/40 border-t border-white/10 flex items-center justify-center gap-4 sm:gap-6">
            {/* Mic Toggle */}
            <button
              onClick={toggleMute}
              className={`p-4 rounded-2xl transition-all shadow-lg active:scale-95 flex flex-col items-center gap-1 ${
                isMuted
                  ? 'bg-red-500/20 border border-red-500/40 text-red-400'
                  : 'bg-white/5 hover:bg-white/10 border border-white/10 text-white'
              }`}
              title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
              aria-label={isMuted ? 'Unmute microphone' : 'Mute microphone'}
            >
              {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
              <span className="text-[9px] font-black uppercase tracking-wider">{isMuted ? 'Muted' : 'Mic'}</span>
            </button>

            {/* Video Camera Toggle */}
            <button
              onClick={toggleVideo}
              className={`p-4 rounded-2xl transition-all shadow-lg active:scale-95 flex flex-col items-center gap-1 ${
                isVideoOff
                  ? 'bg-white/5 border border-white/10 text-gray-400'
                  : 'bg-gold-primary text-black font-black shadow-glow'
              }`}
              title={isVideoOff ? 'Enable camera' : 'Turn off camera'}
              aria-label={isVideoOff ? 'Enable camera' : 'Turn off camera'}
            >
              {isVideoOff ? <VideoOff size={20} /> : <Video size={20} />}
              <span className="text-[9px] font-black uppercase tracking-wider">{isVideoOff ? 'Cam Off' : 'Video'}</span>
            </button>

            {/* Speaker Toggle */}
            <button
              onClick={() => {
                playTactileSound('click')
                setIsSpeakerOn(!isSpeakerOn)
              }}
              className={`p-4 rounded-2xl transition-all shadow-lg active:scale-95 flex flex-col items-center gap-1 ${
                isSpeakerOn
                  ? 'bg-white/5 hover:bg-white/10 border border-white/10 text-white'
                  : 'bg-white/5 text-gray-500 border border-white/5'
              }`}
              title={isSpeakerOn ? 'Speaker mode' : 'Earpiece mode'}
              aria-label={isSpeakerOn ? 'Speaker mode' : 'Earpiece mode'}
            >
              {isSpeakerOn ? <Volume2 size={20} /> : <VolumeX size={20} />}
              <span className="text-[9px] font-black uppercase tracking-wider">{isSpeakerOn ? 'Speaker' : 'Ear'}</span>
            </button>

            {/* End Call Button */}
            <button
              onClick={handleEndCall}
              className="p-4 rounded-2xl bg-red-600 hover:bg-red-500 text-white shadow-xl shadow-red-900/40 active:scale-95 transition-all flex flex-col items-center gap-1"
              title="Hang up call"
              aria-label="Hang up call"
            >
              <PhoneOff size={20} />
              <span className="text-[9px] font-black uppercase tracking-wider">End</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
