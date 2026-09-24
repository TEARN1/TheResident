'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, Home, Briefcase, Users, MessageSquare, ShieldCheck,
  Sparkles, ExternalLink, Github, Zap, MapPin, X, ArrowRight, User
} from 'lucide-react'
import Image from 'next/image'
import { playTactileSound } from '../../../../utils/tactileSounds'

interface CommandItem {
  id: string
  title: string
  subtitle: string
  category: 'App Navigation' | 'The Gruvs Nightlife' | 'TEARN’s Excellence' | 'Quick Actions'
  icon: React.ElementType
  action: () => void
  isExternal?: boolean
  badge?: string
}

export default function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)

  // Listen for Cmd+K / Ctrl+K keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(prev => !prev)
        playTactileSound('pop')
      } else if (e.key === 'Escape') {
        setOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50)
      // eslint-disable-next-line react-hooks/set-state-in-effect -- resetting the palette to its opening state, driven by the `open` prop
      setSelectedIndex(0)
    } else {
      setQuery('')
    }
  }, [open])

  const commandItems: CommandItem[] = [
    // App Navigation
    {
      id: 'nav-map',
      title: 'VibeMap & Neighborhood Radars',
      subtitle: 'Explore incident zones, verified pins & street walkability',
      category: 'App Navigation',
      icon: MapPin,
      action: () => { router.push('/dashboard/housing'); setOpen(false) }
    },
    {
      id: 'nav-rooms',
      title: 'Find Rooms & Accommodations',
      subtitle: 'Browse student co-living, commune rooms and rentals',
      category: 'App Navigation',
      icon: Home,
      action: () => { router.push('/dashboard/housing'); setOpen(false) }
    },
    {
      id: 'nav-gossip',
      title: 'Suburb Gossip Wall',
      subtitle: 'Neighborhood chatter, community notices and tips',
      category: 'App Navigation',
      icon: MessageSquare,
      action: () => { router.push('/dashboard/gossip'); setOpen(false) }
    },
    {
      id: 'nav-profile',
      title: 'Citizen Profile & Verification',
      subtitle: 'Switch between Tenant & Landlord modes',
      category: 'App Navigation',
      icon: User,
      action: () => { router.push('/dashboard/profile'); setOpen(false) }
    },

    // The Gruvs Nightlife Ecosystem
    {
      id: 'gruvs-events',
      title: 'Explore Live Events on The Gruvs',
      subtitle: 'Student festivals, nightlife sets & weekend club parties',
      category: 'The Gruvs Nightlife',
      icon: Sparkles,
      action: () => { window.open('https://thegruvs.com', '_blank'); setOpen(false) },
      isExternal: true,
      badge: 'Sister App'
    },
    {
      id: 'gruvs-sso',
      title: 'Unified Cross-App Identity',
      subtitle: 'Your Resident login works seamlessly across The Gruvs',
      category: 'The Gruvs Nightlife',
      icon: Zap,
      action: () => { window.open('https://thegruvs.com', '_blank'); setOpen(false) },
      isExternal: true
    },

    // TEARN's Excellence
    {
      id: 'tearns-repo',
      title: 'TEARN’s Excellence Open Framework',
      subtitle: 'Inspect the architectural blueprint & security standards',
      category: 'TEARN’s Excellence',
      icon: Github,
      action: () => { window.open('https://github.com/TEARN1/TEARNs-Excellence', '_blank'); setOpen(false) },
      isExternal: true,
      badge: 'Benchmark'
    },
    {
      id: 'tearns-inspect',
      title: 'Sub-50ms Glass Architecture Specs',
      subtitle: 'RLS security, edge caching and offline queue design',
      category: 'TEARN’s Excellence',
      icon: ShieldCheck,
      action: () => { window.open('https://github.com/TEARN1/TEARNs-Excellence', '_blank'); setOpen(false) },
      isExternal: true
    }
  ]

  const filteredItems = commandItems.filter(item =>
    item.title.toLowerCase().includes(query.toLowerCase()) ||
    item.subtitle.toLowerCase().includes(query.toLowerCase()) ||
    item.category.toLowerCase().includes(query.toLowerCase())
  )

  const handleSelect = (item: CommandItem) => {
    playTactileSound('click')
    item.action()
  }

  return (
    <>
      {/* Floating launcher indicator in dashboard */}
      <button
        onClick={() => { setOpen(true); playTactileSound('pop') }}
        className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 hover:text-white transition-all text-xs font-semibold shadow-sm"
        title="Open Command Palette (Ctrl+K)"
      >
        <Search size={13} className="text-gold-primary" />
        <span>Search or jump to...</span>
        <kbd className="px-1.5 py-0.5 text-[9px] bg-black/60 rounded border border-white/15 text-gray-400 font-mono font-bold">
          Ctrl K
        </kbd>
      </button>

      {/* Spotlight Modal Overlay */}
      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-[9999] flex items-start justify-center pt-16 md:pt-24 px-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="relative w-full max-w-xl bg-neutral-950/95 border border-gold-primary/30 rounded-3xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9),0_0_35px_rgba(212,175,55,0.15)] overflow-hidden z-10 backdrop-blur-3xl flex flex-col"
            >
              {/* Input Header */}
              <div className="flex items-center gap-3 px-5 py-4 border-b border-white/10">
                <Search size={18} className="text-gold-primary shrink-0" />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={e => {
                    setQuery(e.target.value)
                    setSelectedIndex(0)
                  }}
                  placeholder="Type a command, jump to Gruvs, or search..."
                  className="w-full bg-transparent text-sm text-white placeholder-gray-500 outline-none font-medium"
                />
                {query && (
                  <button onClick={() => setQuery('')} className="text-gray-500 hover:text-white">
                    <X size={15} />
                  </button>
                )}
                <kbd className="px-2 py-0.5 text-[10px] bg-white/5 border border-white/10 rounded-lg text-gray-400 font-mono">
                  ESC
                </kbd>
              </div>

              {/* Ecosystem Quick Bar */}
              <div className="px-5 py-2.5 bg-gradient-to-r from-purple-950/30 via-black to-gold-primary/10 border-b border-white/5 flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-gray-400 font-medium">3-App Network:</span>
                </div>
                <div className="flex items-center gap-3">
                  <a
                    href="https://thegruvs.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-purple-300 hover:text-purple-200 font-bold transition-colors"
                  >
                    <span>The Gruvs</span>
                    <ExternalLink size={9} />
                  </a>
                  <span className="text-white/20">•</span>
                  <a
                    href="https://github.com/TEARN1/TEARNs-Excellence"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-gold-primary hover:text-amber-300 font-bold transition-colors"
                  >
                    <span>TEARN’s Excellence</span>
                    <ExternalLink size={9} />
                  </a>
                </div>
              </div>

              {/* Items List */}
              <div className="max-h-80 overflow-y-auto p-3 space-y-1 custom-scrollbar">
                {filteredItems.length === 0 ? (
                  <div className="py-12 text-center text-gray-500 text-xs font-medium">
                    No matching commands found.
                  </div>
                ) : (
                  filteredItems.map((item, idx) => {
                    const Icon = item.icon
                    const isSelected = idx === selectedIndex
                    return (
                      <button
                        key={item.id}
                        onClick={() => handleSelect(item)}
                        onMouseEnter={() => setSelectedIndex(idx)}
                        className={`w-full flex items-center justify-between p-3 rounded-2xl transition-all text-left ${
                          isSelected
                            ? 'bg-gradient-to-r from-gold-primary/20 to-white/5 border border-gold-primary/40 text-white'
                            : 'hover:bg-white/5 border border-transparent text-gray-300'
                        }`}
                      >
                        <div className="flex items-center gap-3.5 min-w-0">
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                            isSelected ? 'bg-gold-primary text-black' : 'bg-white/5 text-gold-primary border border-white/10'
                          }`}>
                            <Icon size={16} />
                          </div>
                          <div className="truncate">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-white truncate">{item.title}</span>
                              {item.badge && (
                                <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-gold-primary/20 text-gold-primary border border-gold-primary/30">
                                  {item.badge}
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-gray-400 truncate mt-0.5">{item.subtitle}</p>
                          </div>
                        </div>
                        <ArrowRight size={14} className={`shrink-0 ml-2 ${isSelected ? 'text-gold-primary opacity-100' : 'opacity-0'}`} />
                      </button>
                    )
                  })
                )}
              </div>

              {/* Footer */}
              <div className="px-5 py-3 border-t border-white/10 flex items-center justify-between text-[10px] text-gray-500 font-medium">
                <span>Navigate with <kbd className="px-1 py-0.5 bg-white/5 rounded border border-white/10 text-gray-400">↑</kbd> <kbd className="px-1 py-0.5 bg-white/5 rounded border border-white/10 text-gray-400">↓</kbd></span>
                <span>Select with <kbd className="px-1.5 py-0.5 bg-white/5 rounded border border-white/10 text-gray-400">Enter</kbd></span>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  )
}
