'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Download, X, Smartphone, Share, PlusSquare, Sparkles, CheckCircle2 } from 'lucide-react'
import { playTactileSound } from '../../../../utils/tactileSounds'
/**
 * The `beforeinstallprompt` event, which is Chromium-only and therefore not in
 * the DOM lib. Typed here rather than as `any` so the two things this file
 * actually uses — prompt() and userChoice — are checked.
 */
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[]
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
  prompt(): Promise<void>
}

/** iOS Safari's non-standard standalone flag; absent everywhere else. */
type IOSNavigator = Navigator & { standalone?: boolean }

export default function PWAInstallBanner() {
  const [showBanner, setShowBanner] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    // Check if user dismissed earlier in this session
    const dismissed = sessionStorage.getItem('res_pwa_dismissed')
    if (dismissed) return

    // Detect standalone PWA mode
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as IOSNavigator).standalone
    if (isStandalone) return

    // Detect iOS
    const userAgent = window.navigator.userAgent.toLowerCase()
    const iosDevice = /iphone|ipad|ipod/.test(userAgent)
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time sync from the user agent on mount
    setIsIOS(iosDevice)

    // Capture Chrome/Android beforeinstallprompt
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      setShowBanner(true)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstall)

    // On iOS, trigger prompt after brief delay for natural onboarding
    if (iosDevice) {
      const timer = setTimeout(() => setShowBanner(true), 4000)
      return () => clearTimeout(timer)
    }

    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall)
  }, [])

  const handleInstallClick = async () => {
    playTactileSound('pop')
    if (deferredPrompt) {
      deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      if (outcome === 'accepted') {
        playTactileSound('success')
        setShowBanner(false)
      }
      setDeferredPrompt(null)
    }
  }

  const handleDismiss = () => {
    playTactileSound('click')
    setShowBanner(false)
    sessionStorage.setItem('res_pwa_dismissed', 'true')
  }

  if (!showBanner) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 80, opacity: 0 }}
        className="fixed bottom-20 left-4 right-4 sm:left-auto sm:right-6 sm:w-96 z-40 bg-black/90 backdrop-blur-2xl border border-gold-primary/30 p-4 rounded-3xl shadow-[0_0_40px_rgba(212,175,55,0.2)]"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-gold-primary to-amber-500 flex items-center justify-center text-black font-black text-sm shadow-md shrink-0">
              <Smartphone size={20} />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h4 className="text-xs font-black uppercase tracking-wider text-white">Install The Resident</h4>
                <span className="text-[9px] font-bold bg-gold-primary/20 text-gold-primary border border-gold-primary/30 px-1.5 py-0.2 rounded-md">
                  PWA
                </span>
              </div>
              <p className="text-[11px] text-gray-300 mt-0.5 leading-snug">
                Zero download time. Instant access to roommates, keys, and SAPS SOS off your home screen.
              </p>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="text-gray-500 hover:text-white p-1 transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        {isIOS ? (
          <div className="mt-3 p-2.5 rounded-2xl bg-white/5 border border-white/10 text-[11px] text-gray-300 space-y-1">
            <p className="flex items-center gap-1.5 font-semibold text-white">
              <span>Tap</span> <Share size={12} className="text-gold-primary" /> <span>Share below, then select</span>
            </p>
            <p className="flex items-center gap-1.5 text-gold-primary font-bold">
              <PlusSquare size={13} /> &quot;Add to Home Screen&quot;
            </p>
          </div>
        ) : (
          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={handleInstallClick}
              className="flex-1 bg-gold-primary hover:bg-gold-secondary text-black font-black py-2 rounded-xl text-xs uppercase tracking-wider transition-all shadow-md active:scale-95 flex items-center justify-center gap-1.5"
            >
              <Download size={13} /> Add to Home Screen
            </button>
            <button
              onClick={handleDismiss}
              className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 font-bold text-xs transition-all active:scale-95"
            >
              Later
            </button>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  )
}
