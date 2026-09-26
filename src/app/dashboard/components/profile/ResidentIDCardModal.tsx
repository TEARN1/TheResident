'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ShieldCheck, QrCode, Download, Share2, Sparkles, Building, Award, CheckCircle2, Flame, ExternalLink } from 'lucide-react'
import { playTactileSound } from '../../../../utils/tactileSounds'

interface ResidentIDCardModalProps {
  isOpen: boolean
  onClose: () => void
  user: {
    name: string
    id: string
    role?: string
    address?: string
  } | null
  reputationScore?: number
}

export default function ResidentIDCardModal({
  isOpen,
  onClose,
  user,
  reputationScore = 480
}: ResidentIDCardModalProps) {
  const [copied, setCopied] = useState(false)
  const [rotateX, setRotateX] = useState(0)
  const [rotateY, setRotateY] = useState(0)

  if (!isOpen || !user) return null

  const citizenNumber = `RES-GLOB-${user.id.slice(0, 8).toUpperCase()}`
  const residentName = user.name || 'Citizen Resident'

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left - rect.width / 2
    const y = e.clientY - rect.top - rect.height / 2
    setRotateX(-y / 12)
    setRotateY(x / 12)
  }

  const handleMouseLeave = () => {
    setRotateX(0)
    setRotateY(0)
  }

  const handleShare = () => {
    playTactileSound('chime')
    const passUrl = `https://the-resident.app/verify/${user.id}`
    navigator.clipboard.writeText(passUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="relative w-full max-w-md bg-black/95 border border-gold-primary/40 rounded-3xl p-6 sm:p-8 shadow-[0_0_60px_rgba(212,175,55,0.25)] backdrop-blur-2xl overflow-hidden flex flex-col items-center text-center"
        >
          {/* Holographic Ambient Ray */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-gold-primary/15 rounded-full blur-3xl pointer-events-none" />

          {/* Close button */}
          <button
            onClick={() => { playTactileSound('pop'); onClose() }}
            className="absolute top-5 right-5 p-2 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all"
          >
            <X size={18} />
          </button>

          {/* Badge Tag */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gold-primary/10 border border-gold-primary/30 text-gold-primary text-[10px] font-black uppercase tracking-widest mb-5">
            <ShieldCheck size={12} />
            <span>Global Citizen Mobility Passport</span>
          </div>

          {/* Holographic 3D Interactive Luxury Card */}
          <div
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            style={{
              transform: `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`,
              transition: 'transform 0.15s ease-out'
            }}
            className="w-full relative rounded-3xl p-6 bg-gradient-to-br from-[#1c1917] via-[#0c0a09] to-black border-2 border-gold-primary/50 shadow-2xl overflow-hidden text-left group cursor-pointer"
          >
            {/* Holographic Sheen */}
            <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-gold-primary/[0.08] to-amber-200/[0.12] pointer-events-none group-hover:opacity-100 transition-opacity" />
            <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-gold-primary/10 rounded-full blur-2xl" />

            {/* Top row */}
            <div className="flex justify-between items-start mb-6 relative z-10">
              <div>
                <span className="text-[9px] font-black uppercase tracking-[0.25em] text-gray-400 block">
                  Global Civic Operating System
                </span>
                <h4 className="text-base font-black text-white tracking-tight flex items-center gap-1.5">
                  THE RESIDENT <span className="text-gold-primary font-serif">PASSPORT</span>
                </h4>
              </div>
              <div className="p-2.5 rounded-2xl bg-gold-primary/10 border border-gold-primary/30 text-gold-primary shadow-sm">
                <Building size={20} />
              </div>
            </div>

            {/* Resident Details */}
            <div className="flex items-center gap-4 mb-5 relative z-10">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-gold-primary via-amber-400 to-amber-600 flex items-center justify-center text-black font-black text-xl shadow-lg shadow-gold-primary/20 shrink-0">
                {residentName.charAt(0)}
              </div>
              <div className="min-w-0">
                <h5 className="text-lg font-black text-white truncate tracking-tight">{residentName}</h5>
                <p className="text-xs text-gold-primary font-mono font-bold tracking-wider">{citizenNumber}</p>
                <div className="flex items-center gap-1 text-[10px] text-gray-400 mt-0.5">
                  <CheckCircle2 size={11} className="text-emerald-400" />
                  <span>Verified Citizen Tenant</span>
                </div>
              </div>
            </div>

            {/* Reputation & QR Section */}
            <div className="pt-4 border-t border-white/10 flex items-center justify-between relative z-10">
              <div>
                <span className="text-[9px] font-black uppercase tracking-wider text-gray-500 block">
                  Citizen Reputation
                </span>
                <div className="flex items-center gap-1 text-sm font-black text-white">
                  <Award size={14} className="text-gold-primary" />
                  <span>{reputationScore} XP</span>
                  <span className="text-[10px] text-emerald-400 ml-1 font-semibold">Tier 1</span>
                </div>
              </div>

              {/* Verified QR Pill */}
              <div className="flex items-center gap-2 p-2 bg-white/5 border border-white/10 rounded-xl backdrop-blur-md">
                <QrCode size={28} className="text-gold-primary" />
                <div className="text-[9px] font-mono text-gray-300 leading-tight">
                  <span className="font-bold text-white block">SCAN PASS</span>
                  <span>Instant Verify</span>
                </div>
              </div>
            </div>
          </div>

          {/* Gruvs VIP Guestlist Cross-Promotion Banner */}
          <div className="w-full mt-4 p-3.5 rounded-2xl bg-purple-950/40 border border-purple-500/30 flex items-center justify-between gap-3 text-left">
            <div className="space-y-0.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-purple-300 flex items-center gap-1">
                <Sparkles size={11} /> The Gruvs VIP Access Linked
              </span>
              <p className="text-[11px] text-gray-400 leading-snug">
                Your verified resident status unlocks queue-jump and discounted guestlist access on The Gruvs nightlife network.
              </p>
            </div>
            <a
              href="https://thegruvs.com"
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white shrink-0 transition-all shadow-md active:scale-95"
              title="Open The Gruvs Guestlist"
            >
              <ExternalLink size={14} />
            </a>
          </div>

          {/* Action buttons */}
          <div className="w-full mt-5 flex flex-wrap gap-2">
            <button
              onClick={handleShare}
              className="flex-1 bg-gold-primary hover:bg-gold-secondary text-black font-black py-3 rounded-xl text-xs uppercase tracking-wider transition-all shadow-lg shadow-gold-primary/20 flex items-center justify-center gap-2 active:scale-95"
            >
              <Share2 size={14} />
              <span>{copied ? 'Pass Link Copied!' : 'Share Pass Link'}</span>
            </button>
            <button
              onClick={() => {
                playTactileSound('pop')
                const subject = encodeURIComponent(`Digital Resident ID Pass - ${residentName} (${citizenNumber})`)
                const body = encodeURIComponent(
                  `Hi Security / Host,\n\nPlease find my verified Digital Resident ID pass from The Resident platform:\n\nResident Name: ${residentName}\nCitizen ID: ${citizenNumber}\nVerification Link: https://the-resident.app/verify/${user.id}\nGruvs VIP Access: Active\n\nVerified Co-Living & Community Access.`
                )
                window.open(`mailto:?subject=${subject}&body=${body}`, '_blank')
              }}
              className="px-4 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs uppercase tracking-wider transition-all active:scale-95 flex items-center justify-center gap-1.5"
              title="Email digital keycard to building security or event host"
            >
              <span>Email Pass</span>
            </button>
            <button
              onClick={() => { playTactileSound('click'); onClose() }}
              className="px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white font-bold text-xs uppercase tracking-wider transition-all active:scale-95"
            >
              Done
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
