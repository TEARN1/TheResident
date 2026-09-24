'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Sparkles, Check, HeartHandshake, ShieldCheck, Flame, Moon, Music, Coffee, PartyPopper } from 'lucide-react'
import { playTactileSound } from '../../../utils/tactileSounds'

interface RoommateCompatibilityModalProps {
  isOpen: boolean
  onClose: () => void
  roommateName: string
  roommateSuburb: string
}

interface Question {
  id: string
  label: string
  icon: React.ReactNode
  options: { label: string; score: number }[]
}

const QUESTIONS: Question[] = [
  {
    id: 'sleep',
    label: 'Sleep & Wake Rhythm',
    icon: <Moon size={16} className="text-indigo-400" />,
    options: [
      { label: 'Early Bird (Up before 7 AM)', score: 95 },
      { label: 'Night Owl (Active past 1 AM)', score: 70 },
      { label: 'Balanced (Standard 8-to-5)', score: 90 }
    ]
  },
  {
    id: 'social',
    label: 'Weekend Energy & Guests',
    icon: <PartyPopper size={16} className="text-amber-400" />,
    options: [
      { label: 'Quiet Sanctuary (Guests need notice)', score: 85 },
      { label: 'Social Hub (Friends always welcome)', score: 92 },
      { label: 'Gruvs Festival Attender (Out all night)', score: 100 }
    ]
  },
  {
    id: 'clean',
    label: 'Kitchen & Space Tidiness',
    icon: <Sparkles size={16} className="text-emerald-400" />,
    options: [
      { label: 'Spotless (Wash dishes immediately)', score: 98 },
      { label: 'Reasonable (Done by end of day)', score: 88 },
      { label: 'Relaxed (Rotate with chore rota)', score: 78 }
    ]
  },
  {
    id: 'noise',
    label: 'Noise & Focus Level',
    icon: <Music size={16} className="text-cyan-400" />,
    options: [
      { label: 'Silence when studying/working', score: 84 },
      { label: 'Headphones always on', score: 96 },
      { label: 'Ambient background music is fine', score: 90 }
    ]
  }
]

export default function RoommateCompatibilityModal({
  isOpen,
  onClose,
  roommateName,
  roommateSuburb
}: RoommateCompatibilityModalProps) {
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, number>>({})
  const [calculatedScore, setCalculatedScore] = useState<number | null>(null)

  const handleSelect = (questionId: string, score: number) => {
    playTactileSound('click')
    const updated = { ...selectedAnswers, [questionId]: score }
    setSelectedAnswers(updated)

    // If all questions are answered, calculate weighted compatibility score
    if (Object.keys(updated).length === QUESTIONS.length) {
      const total = Object.values(updated).reduce((acc, curr) => acc + curr, 0)
      const avg = Math.round(total / QUESTIONS.length)
      setCalculatedScore(avg)
      playTactileSound('chime')
    }
  }

  const handleReset = () => {
    playTactileSound('pop')
    setSelectedAnswers({})
    setCalculatedScore(null)
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="relative w-full max-w-lg bg-black/90 border border-gold-primary/30 rounded-3xl p-6 sm:p-8 shadow-[0_0_50px_rgba(212,175,55,0.15)] backdrop-blur-2xl overflow-hidden"
        >
          {/* Background Ambient Glow */}
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
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-gold-primary to-amber-400 flex items-center justify-center text-black shadow-lg">
              <HeartHandshake size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black text-white tracking-tight">Lifestyle Match Matrix</h3>
                <span className="text-[10px] font-black uppercase tracking-wider bg-gold-primary/15 text-gold-primary border border-gold-primary/30 px-2 py-0.5 rounded-full">
                  AI Vibe Check
                </span>
              </div>
              <p className="text-xs text-gray-400">
                Checking compatibility with <strong className="text-white">{roommateName}</strong> ({roommateSuburb})
              </p>
            </div>
          </div>

          {/* Compatibility Meter Banner */}
          {calculatedScore !== null ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mb-6 p-5 rounded-2xl bg-gradient-to-br from-gold-primary/20 via-black to-black border border-gold-primary/40 text-center relative overflow-hidden"
            >
              <div className="flex items-center justify-center gap-2 mb-1">
                <Flame size={20} className="text-gold-primary animate-bounce" />
                <span className="text-3xl font-black text-white tracking-tighter">{calculatedScore}%</span>
                <span className="text-xs font-black uppercase tracking-widest text-gold-primary">Match Affinity</span>
              </div>
              <p className="text-xs text-gray-300">
                {calculatedScore >= 90
                  ? '🌟 Exceptional synergy! You share synchronized living habits, guest preferences, and schedules.'
                  : calculatedScore >= 80
                  ? '⚡ High compatibility! Good balance of social habits with minimal conflict risk.'
                  : '🤝 Fair baseline compatibility. Setting clear ground rules on guest policies recommended.'}
              </p>
              <button
                onClick={handleReset}
                className="mt-3 text-[10px] text-gray-400 hover:text-white uppercase font-bold tracking-wider underline transition-colors"
              >
                Recalibrate answers
              </button>
            </motion.div>
          ) : (
            <div className="mb-6 p-3 rounded-2xl bg-white/[0.03] border border-white/5 text-center">
              <p className="text-xs text-gray-400">
                Answer the 4 lifestyle dimensions below to unlock your instant co-living compatibility score.
              </p>
            </div>
          )}

          {/* Questions List */}
          <div className="space-y-4 max-h-[340px] overflow-y-auto pr-1">
            {QUESTIONS.map((q) => (
              <div key={q.id} className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/5 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-gray-300">
                  {q.icon}
                  <span>{q.label}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {q.options.map((opt, i) => {
                    const isSelected = selectedAnswers[q.id] === opt.score
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => handleSelect(q.id, opt.score)}
                        className={`p-2.5 rounded-xl text-[11px] font-semibold text-left transition-all border leading-tight ${
                          isSelected
                            ? 'bg-gold-primary text-black border-gold-primary font-bold shadow-md shadow-gold-primary/20'
                            : 'bg-white/5 border-white/5 text-gray-300 hover:bg-white/10 hover:border-white/20'
                        }`}
                      >
                        {opt.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Footer Actions */}
          <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
              <ShieldCheck size={14} className="text-gold-primary" />
              <span>Private calculation</span>
            </div>
            <button
              onClick={() => { playTactileSound('pop'); onClose() }}
              className="px-5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs uppercase tracking-wider transition-all active:scale-95"
            >
              Done
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
