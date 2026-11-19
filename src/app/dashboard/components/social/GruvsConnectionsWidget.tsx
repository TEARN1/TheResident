'use client'

import React, { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Users, ShieldCheck, ChevronRight, ChevronLeft, EyeOff, MessageSquare } from 'lucide-react'
import { supabase } from '../../../../utils/supabase'
import { playTactileSound } from '../../../../utils/tactileSounds'

const HIDE_KEY = 'residentHideNeighboursWidget'

interface NeighbourContact {
  id: string
  displayName: string
  avatarUrl: string | null
  role: string
  isVerified: boolean
}

export default function GruvsConnectionsWidget() {
  const [neighbours, setNeighbours] = useState<NeighbourContact[] | null>(null)
  const [scrollIndex, setScrollIndex] = useState(0)
  const [hidden, setHidden] = useState(() => typeof window !== 'undefined' && localStorage.getItem(HIDE_KEY) === '1')

  useEffect(() => {
    let cancelled = false
    if (!supabase) return

    Promise.all([
      supabase.from('profiles').select('id, username, display_name, avatar_url').limit(15),
      supabase.from('res_profiles').select('id, legal_name, role').limit(15)
    ]).then(([profilesRes, resProfilesRes]) => {
      if (cancelled) return
      const profiles = profilesRes.data || []
      const resMap = new Map((resProfilesRes.data || []).map((r: { id: string; legal_name: string | null; role: string | null }) => [r.id, r]))

      const list: NeighbourContact[] = profiles.map((p: { id: string; username: string | null; display_name: string | null; avatar_url: string | null }, idx: number) => {
        const resInfo = resMap.get(p.id)
        return {
          id: p.id,
          displayName: resInfo?.legal_name || p.display_name || p.username || `Neighbour #${idx + 1}`,
          avatarUrl: p.avatar_url,
          role: resInfo?.role ? (resInfo.role.charAt(0).toUpperCase() + resInfo.role.slice(1)) : 'Resident',
          isVerified: Boolean(resInfo?.legal_name)
        }
      })
      setNeighbours(list)
    })

    return () => { cancelled = true }
  }, [])

  const hide = () => {
    localStorage.setItem(HIDE_KEY, '1')
    setHidden(true)
  }

  if (hidden || neighbours === null || neighbours.length === 0) return null

  const visible = neighbours.slice(scrollIndex, scrollIndex + 4)

  return (
    <div className="glass-panel p-5 bg-gold-primary/5 border-gold-primary/10 flex flex-col md:flex-row items-start md:items-center gap-4 min-w-0 overflow-hidden">
      <div className="flex items-center gap-3 shrink-0">
        <div className="p-2 bg-gold-primary/10 rounded-xl">
          <Users size={18} className="text-gold-primary" />
        </div>
        <div>
          <p className="text-xs font-black text-white uppercase tracking-widest">
            {neighbours.length} Verified Neighbour{neighbours.length === 1 ? '' : 's'}
          </p>
          <p className="text-[10px] text-gray-400">Formal Resident Directory · Safe &amp; Isolated Chats</p>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-1 min-w-0 w-full md:w-auto">
        {scrollIndex > 0 && (
          <button onClick={() => setScrollIndex(i => Math.max(0, i - 4))} className="text-gray-500 hover:text-white shrink-0" aria-label="Previous">
            <ChevronLeft size={16} />
          </button>
        )}
        <div className="flex flex-wrap md:flex-nowrap gap-2 md:gap-3 min-w-0 md:overflow-x-auto no-scrollbar">
          {visible.map(person => (
            <Link
              key={person.id}
              href={`/dashboard/messages/${person.id}`}
              onClick={() => playTactileSound('click')}
              className="flex items-center gap-2 bg-black/40 hover:bg-black/70 border border-white/5 hover:border-gold-primary/40 rounded-xl px-3 py-2 shrink-0 transition-all group"
              title={`Message ${person.displayName}`}
            >
              {person.avatarUrl ? (
                <Image src={person.avatarUrl} alt={person.displayName} width={28} height={28} className="w-7 h-7 rounded-full object-cover" />
              ) : (
                <div className="w-7 h-7 rounded-full bg-gold-primary/20 flex items-center justify-center text-[10px] font-black text-gold-primary">
                  {person.displayName.charAt(0)}
                </div>
              )}
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-bold text-white group-hover:text-gold-primary transition-colors whitespace-nowrap truncate max-w-[110px]">
                  {person.displayName}
                </span>
                <span className="text-[9px] text-gray-500 uppercase font-mono">{person.role}</span>
              </div>
              {person.isVerified && <ShieldCheck size={12} className="text-emerald-400 shrink-0" />}
              <MessageSquare size={11} className="text-gray-500 group-hover:text-gold-primary transition-colors shrink-0" />
            </Link>
          ))}
        </div>
        {scrollIndex + 4 < neighbours.length && (
          <button onClick={() => setScrollIndex(i => i + 4)} className="text-gray-500 hover:text-white shrink-0" aria-label="More">
            <ChevronRight size={16} />
          </button>
        )}
      </div>

      <button onClick={hide} className="text-gray-500 hover:text-white shrink-0" title="Hide this suggestion list" aria-label="Hide neighbour suggestions">
        <EyeOff size={16} />
      </button>
    </div>
  )
}
