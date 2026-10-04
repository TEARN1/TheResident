'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Wrench, Droplets, Zap, ShieldCheck, X, Camera,
  AlertTriangle, CheckCircle2, Send
} from 'lucide-react'
import { playTactileSound } from '../../../../utils/tactileSounds'

export interface PlumbingDispatchPayload {
  category: string
  urgency: string
  issueTitle: string
  description: string
  location: string
}

export interface PlumbingTradesModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: (dispatchData: PlumbingDispatchPayload) => void
}

export default function PlumbingTradesModal({
  isOpen,
  onClose,
  onSuccess
}: PlumbingTradesModalProps) {
  const [tradeCategory, setTradeCategory] = useState<'Plumbing' | 'Electrical' | 'Locksmith' | 'Geyser' | 'Handyman'>('Plumbing')
  const [urgency, setUrgency] = useState<'emergency' | 'standard'>('emergency')
  const [issueTitle, setIssueTitle] = useState('')
  const [description, setDescription] = useState('')
  const [locationAddress, setLocationAddress] = useState('')
  const [suburb, setSuburb] = useState('Braamfontein')
  const [hasPhoto, setHasPhoto] = useState(false)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [isDispatched, setIsDispatched] = useState(false)

  if (!isOpen) return null

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      setPhotoPreview(ev.target?.result as string)
      setHasPhoto(true)
    }
    reader.readAsDataURL(file)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    playTactileSound('alert')
    setSubmitting(true)

    setTimeout(() => {
      setSubmitting(false)
      setIsDispatched(true)
      playTactileSound('success')
      if (onSuccess) {
        onSuccess({
          category: tradeCategory,
          urgency,
          issueTitle,
          description,
          location: `${locationAddress}, ${suburb}`
        })
      }
    }, 1200)
  }

  const resetAndClose = () => {
    playTactileSound('pop')
    setIsDispatched(false)
    setIssueTitle('')
    setDescription('')
    setPhotoPreview(null)
    setHasPhoto(false)
    onClose()
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[250] flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-lg bg-[var(--card-bg,rgba(11,43,38,0.95))] border border-[var(--glass-border,rgba(142,182,155,0.3))] rounded-3xl p-6 sm:p-7 shadow-2xl backdrop-blur-2xl max-h-[90vh] overflow-y-auto custom-scrollbar"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center justify-center shadow-glow">
                <Droplets size={20} />
              </div>
              <div>
                <h3 className="text-base font-black text-white uppercase tracking-tight flex items-center gap-2">
                  Emergency Plumbing & Trades Dispatch
                </h3>
                <p className="text-[11px] text-gray-400">
                  Connect with certified South African local plumbers and technicians.
                </p>
              </div>
            </div>
            <button
              onClick={resetAndClose}
              className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white"
            >
              <X size={16} />
            </button>
          </div>

          {isDispatched ? (
            <div className="py-8 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 mx-auto flex items-center justify-center animate-bounce">
                <CheckCircle2 size={32} />
              </div>
              <div className="space-y-1">
                <h4 className="text-lg font-black text-white">Emergency Dispatch Broadcasted!</h4>
                <p className="text-xs text-gray-300 max-w-sm mx-auto">
                  Local certified {tradeCategory} pros in {suburb} have been alerted. Expect an in-app quote or phone call within 10-15 minutes.
                </p>
              </div>
              <div className="p-4 rounded-2xl bg-black/60 border border-white/10 text-left text-xs space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-400">Category:</span>
                  <span className="font-bold text-white">{tradeCategory}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Priority:</span>
                  <span className="font-mono font-bold text-amber-400 uppercase">{urgency}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Expected Callout Fee:</span>
                  <span className="font-mono font-bold text-white">R350 - R550 (ZAR)</span>
                </div>
              </div>
              <button
                onClick={resetAndClose}
                className="w-full py-3 rounded-2xl bg-gold-primary hover:bg-gold-secondary text-black font-black text-xs uppercase tracking-wider shadow-glow transition-all"
              >
                Close & View Active Dispatches
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4 pt-3">
              {/* Category Pills */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-wider text-gray-300">
                  Select Trade / Problem Area
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'Plumbing', label: 'Plumbing', icon: Droplets },
                    { id: 'Geyser', label: 'Geyser Repair', icon: AlertTriangle },
                    { id: 'Electrical', label: 'Electrical', icon: Zap },
                    { id: 'Locksmith', label: 'Locksmith', icon: ShieldCheck },
                    { id: 'Handyman', label: 'General Snags', icon: Wrench }
                  ].map(t => {
                    const Icon = t.icon
                    const active = tradeCategory === t.id
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => {
                          playTactileSound('tab')
                          setTradeCategory(t.id as 'Plumbing' | 'Electrical' | 'Locksmith' | 'Geyser' | 'Handyman')
                        }}
                        className={`p-2.5 rounded-2xl text-xs font-bold transition-all border flex flex-col items-center gap-1.5 ${
                          active
                            ? 'bg-blue-500/20 text-white border-blue-400 shadow-glow'
                            : 'bg-black/60 text-gray-400 border-white/10 hover:text-white'
                        }`}
                      >
                        <Icon size={16} className={active ? 'text-blue-400' : 'text-gray-500'} />
                        <span className="text-[10px]">{t.label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Urgency Pill Switcher */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-wider text-gray-300">
                  Urgency Level
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      playTactileSound('tab')
                      setUrgency('emergency')
                    }}
                    className={`p-2.5 rounded-2xl border text-xs font-black uppercase flex items-center justify-center gap-1.5 transition-all ${
                      urgency === 'emergency'
                        ? 'bg-red-500/20 text-red-300 border-red-500/60 shadow-[0_0_15px_rgba(239,68,68,0.3)]'
                        : 'bg-black/60 text-gray-400 border-white/10'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                    <span>Emergency (Under 1 Hour)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      playTactileSound('tab')
                      setUrgency('standard')
                    }}
                    className={`p-2.5 rounded-2xl border text-xs font-black uppercase flex items-center justify-center gap-1.5 transition-all ${
                      urgency === 'standard'
                        ? 'bg-gold-primary text-black border-gold-primary shadow-glow'
                        : 'bg-black/60 text-gray-400 border-white/10'
                    }`}
                  >
                    <span>Scheduled / Quote</span>
                  </button>
                </div>
              </div>

              {/* Title & Description */}
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-wider text-gray-300">
                  Problem Summary
                </label>
                <input
                  type="text"
                  required
                  value={issueTitle}
                  onChange={e => setIssueTitle(e.target.value)}
                  placeholder="e.g. Burst pipe under kitchen sink, water leaking onto floor"
                  className="w-full bg-black/60 border border-white/15 rounded-xl px-3.5 py-2 text-xs text-white outline-none focus:border-blue-400"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-wider text-gray-300">
                  Location & Unit / Room Number
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    required
                    value={locationAddress}
                    onChange={e => setLocationAddress(e.target.value)}
                    placeholder="Building name / Flat 4B"
                    className="w-full bg-black/60 border border-white/15 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-blue-400"
                  />
                  <input
                    type="text"
                    required
                    value={suburb}
                    onChange={e => setSuburb(e.target.value)}
                    placeholder="Suburb (e.g. Braamfontein)"
                    className="w-full bg-black/60 border border-white/15 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-blue-400"
                  />
                </div>
              </div>

              {/* Photo Upload Attachment */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-wider text-gray-300">
                  Attach Photo of Issue (Recommended for Accurate Quote)
                </label>
                <div className="flex items-center gap-3">
                  <label className="cursor-pointer px-4 py-2.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/15 text-xs text-gray-300 font-bold flex items-center gap-2 transition-all">
                    <Camera size={14} className="text-blue-400" />
                    <span>{hasPhoto ? 'Change Photo' : 'Upload / Snap Fault'}</span>
                    <input type="file" accept="image/*" onChange={handlePhotoSelect} className="hidden" />
                  </label>
                  {photoPreview && (
                    <div className="w-10 h-10 rounded-xl overflow-hidden border border-white/20">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={photoPreview} alt="Fault preview" className="w-full h-full object-cover" />
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-blue-900/40 transition-all active:scale-98 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Send size={14} />
                  <span>{submitting ? 'Broadcasting to Local Pros...' : 'Broadcast Emergency Dispatch'}</span>
                </button>
              </div>
            </form>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
