'use client'

import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Palette, X, Check, Sparkles } from 'lucide-react'
import { APP_THEMES, type ThemeId } from '../../../../utils/themes'
import { playTactileSound } from '../../../../utils/tactileSounds'

interface ThemeSwitcherModalProps {
  isOpen: boolean
  onClose: () => void
  currentTheme: string
  onSelectTheme: (themeId: ThemeId) => void
}

export default function ThemeSwitcherModal({
  isOpen,
  onClose,
  currentTheme,
  onSelectTheme
}: ThemeSwitcherModalProps) {
  if (!isOpen) return null

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="relative w-full max-w-xl bg-black/95 border border-white/15 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-2xl overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-5 border-b border-white/10 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gold-primary/10 border border-gold-primary/30 flex items-center justify-center text-gold-primary shadow-glow">
                <Palette size={20} />
              </div>
              <div>
                <h3 className="text-base font-black text-white uppercase tracking-tight flex items-center gap-2">
                  <span>Visual Theme Studio</span>
                  <span className="text-[9px] font-black uppercase tracking-wider bg-gold-primary/15 text-gold-primary px-2 py-0.5 rounded-full border border-gold-primary/30">
                    Live Engine
                  </span>
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Select your preferred liquid glass aesthetic &amp; color spectrum
                </p>
              </div>
            </div>
            <button
              onClick={() => { playTactileSound('pop'); onClose() }}
              className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all"
            >
              <X size={18} />
            </button>
          </div>

          {/* Palette Grid */}
          <div className="py-5 overflow-y-auto space-y-3.5 custom-scrollbar pr-1">
            {APP_THEMES.map(theme => {
              const isActive = currentTheme === theme.id || (theme.id === 'minimal-green' && currentTheme === 'night') || (theme.id === 'liquid-glass' && currentTheme === 'light')
              return (
                <div
                  key={theme.id}
                  onClick={() => {
                    playTactileSound('tab')
                    onSelectTheme(theme.id)
                  }}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer relative overflow-hidden group ${
                    isActive
                      ? 'border-gold-primary bg-white/[0.06] shadow-glow scale-[1.01]'
                      : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/20'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3.5">
                      {/* Swatch Pill with specular liquid sheen */}
                      <div
                        className="w-14 h-14 rounded-2xl border border-white/20 shadow-md flex items-center justify-center shrink-0 relative overflow-hidden"
                        style={{ background: theme.previewGradient }}
                      >
                        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-white/30 pointer-events-none" />
                        <Sparkles size={16} className="text-white drop-shadow-md relative z-10" />
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-white group-hover:text-gold-primary transition-colors">
                            {theme.name}
                          </h4>
                          <span
                            className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                            style={{
                              backgroundColor: `${theme.accentColor}20`,
                              color: theme.accentColor,
                              border: `1px solid ${theme.accentColor}40`
                            }}
                          >
                            {theme.accentName}
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-400 mt-0.5 leading-snug">
                          {theme.description}
                        </p>
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center">
                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                          isActive
                            ? 'bg-gold-primary text-black font-black shadow-glow'
                            : 'border border-white/20 text-transparent'
                        }`}
                      >
                        <Check size={14} />
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Footer */}
          <div className="pt-4 border-t border-white/10 flex items-center justify-between shrink-0">
            <span className="text-[11px] text-gray-500 font-medium">
              Changes apply instantly across all dashboard and mobile views
            </span>
            <button
              onClick={() => { playTactileSound('pop'); onClose() }}
              className="px-5 py-2.5 rounded-xl bg-gold-primary hover:bg-gold-secondary text-black font-black text-xs uppercase tracking-wider transition-all shadow-md"
            >
              Done
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
