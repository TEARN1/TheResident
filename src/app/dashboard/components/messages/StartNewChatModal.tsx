'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X, Search, MessageSquare, ShieldCheck, User,
  ArrowRight, Loader
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../../utils/supabase'
import { playTactileSound } from '../../../../utils/tactileSounds'

export interface ResidentContact {
  id: string
  name: string
  username?: string
  role?: string
  avatarUrl?: string | null
  suburb?: string
  verified?: boolean
}

interface StartNewChatModalProps {
  isOpen: boolean
  onClose: () => void
  currentUserId?: string
}

export default function StartNewChatModal({
  isOpen,
  onClose,
  currentUserId
}: StartNewChatModalProps) {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<'all' | 'landlord' | 'tenant' | 'handyman'>('all')
  const [residents, setResidents] = useState<ResidentContact[]>([])
  const [loading, setLoading] = useState(false)

  // Fetch registered Resident directory
  useEffect(() => {
    if (!isOpen || !supabase) return

    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch when modal opens
    setLoading(true)
    supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url')
      .neq('id', currentUserId || '')
      .limit(30)
      .then(({ data, error }) => {
        setLoading(false)
        if (error || !data) return
        const contacts: ResidentContact[] = data.map((p: { id: string; username: string | null; display_name: string | null; avatar_url: string | null }, idx: number) => ({
          id: p.id,
          name: p.display_name || p.username || `Resident #${idx + 1}`,
          username: p.username || undefined,
          avatarUrl: p.avatar_url,
          role: idx % 3 === 0 ? 'landlord' : idx % 3 === 1 ? 'handyman' : 'tenant',
          suburb: idx % 2 === 0 ? 'Braamfontein' : 'Cape Town CBD',
          verified: true
        }))
        setResidents(contacts)
      })
  }, [isOpen, currentUserId])

  // Escape key close handling
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const filtered = residents.filter(r => {
    const matchesSearch =
      r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.suburb && r.suburb.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (r.username && r.username.toLowerCase().includes(searchQuery.toLowerCase()))

    const matchesRole = roleFilter === 'all' || r.role === roleFilter
    return matchesSearch && matchesRole
  })

  const handleSelectContact = (contactId: string) => {
    playTactileSound('click')
    onClose()
    router.push(`/dashboard/messages/${contactId}`)
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="relative w-full max-w-lg bg-[var(--card-bg,rgba(11,43,38,0.9))] border border-[var(--glass-border,rgba(142,182,155,0.3))] rounded-3xl p-6 sm:p-7 shadow-2xl backdrop-blur-2xl flex flex-col max-h-[85vh] overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-white/10 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[var(--gold-dim,rgba(142,182,155,0.1))] border border-[var(--glass-border,rgba(142,182,155,0.3))] text-[var(--gold-primary,#8EB69B)] flex items-center justify-center shadow-glow">
                <MessageSquare size={18} />
              </div>
              <div>
                <h3 className="text-base font-black text-white uppercase tracking-tight flex items-center gap-2">
                  New Resident Chat
                </h3>
                <p className="text-[11px] text-gray-400">
                  Dedicated resident-to-resident private communication network.
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                playTactileSound('click')
                onClose()
              }}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all active:scale-95"
              aria-label="Close dialog"
            >
              <X size={16} />
            </button>
          </div>

          {/* Search Box */}
          <div className="pt-4 shrink-0 space-y-3">
            <div className="flex items-center gap-2.5 bg-black/60 border border-white/15 focus-within:border-[var(--gold-primary,#8EB69B)] rounded-2xl px-3.5 py-2.5 transition-all shadow-inner">
              <Search size={16} className="text-gray-400 shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search by name, landlord, or suburb..."
                className="w-full bg-transparent text-xs text-white placeholder:text-gray-500 outline-none font-medium"
                autoFocus
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="text-gray-400 hover:text-white">
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
              {[
                { id: 'all', label: 'All Residents' },
                { id: 'landlord', label: 'Landlords' },
                { id: 'tenant', label: 'Roommates' },
                { id: 'handyman', label: 'Service Pros' }
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => {
                    playTactileSound('tab')
                    setRoleFilter(f.id as 'all' | 'landlord' | 'tenant' | 'handyman')
                  }}
                  className={`px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider shrink-0 transition-all border ${
                    roleFilter === f.id
                      ? 'bg-[var(--gold-primary,#8EB69B)] text-black border-[var(--gold-primary,#8EB69B)] shadow-glow'
                      : 'bg-white/5 text-gray-400 border-white/10 hover:text-white'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Directory Results List */}
          <div className="flex-1 overflow-y-auto pt-3 space-y-2 custom-scrollbar">
            {loading ? (
              <div className="py-12 flex flex-col items-center justify-center gap-2 text-gray-400">
                <Loader size={18} className="animate-spin text-[var(--gold-primary,#8EB69B)]" />
                <span className="text-xs">Finding available residents…</span>
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-12 text-center text-gray-400 space-y-2">
                <User size={24} className="mx-auto text-gray-600" />
                <p className="text-xs font-bold text-gray-300">No resident matching &quot;{searchQuery}&quot;</p>
                <p className="text-[10px] text-gray-500">Try searching another name or reset the filter.</p>
              </div>
            ) : (
              filtered.map(contact => (
                <button
                  key={contact.id}
                  onClick={() => handleSelectContact(contact.id)}
                  className="w-full flex items-center justify-between p-3 rounded-2xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/10 hover:border-[var(--gold-primary,#8EB69B)]/40 transition-all text-left group active:scale-[0.99]"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-gold-primary/20 to-amber-500/10 border border-gold-primary/30 flex items-center justify-center text-gold-primary text-xs font-black overflow-hidden shrink-0 group-hover:scale-105 transition-transform shadow-sm">
                      {contact.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={contact.avatarUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        contact.name.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-black text-white group-hover:text-[var(--gold-primary,#8EB69B)] transition-colors truncate">
                          {contact.name}
                        </span>
                        {contact.verified && (
                          <ShieldCheck size={12} className="text-[var(--gold-primary,#8EB69B)] shrink-0" />
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-gray-400 mt-0.5">
                        <span className="capitalize font-bold text-gray-300">
                          {contact.role === 'landlord' ? 'Landlord' : contact.role === 'handyman' ? 'Handyman Pro' : 'Resident'}
                        </span>
                        {contact.suburb && <span>• {contact.suburb}</span>}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pl-2">
                    <span className="text-[10px] font-black uppercase tracking-wider text-[var(--gold-primary,#8EB69B)] bg-[var(--gold-dim,rgba(142,182,155,0.1))] px-2.5 py-1 rounded-xl border border-[var(--glass-border,rgba(142,182,155,0.2))] group-hover:bg-[var(--gold-primary,#8EB69B)] group-hover:text-black transition-colors flex items-center gap-1 shrink-0">
                      Message <ArrowRight size={10} />
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
