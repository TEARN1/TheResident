'use client'

import React, { useEffect, useState } from 'react'
import Image from 'next/image'
import { Users, ShieldCheck, ChevronRight, ChevronLeft, EyeOff } from 'lucide-react'
import { getMutualConnections, type Connection } from '../../../../utils/social'

const HIDE_KEY = 'residentHideGruvsConnections'

/**
 * Surfaces people the user already mutually follows on The Gruvs — not a
 * follow suggestion (they're already connected), just making an existing
 * relationship visible and useful here. Deliberately has nothing to do with
 * the next-of-kin / trust-circle feature — see the app plan for why those
 * two must stay separate.
 *
 * Privacy: getMutualConnections() only ever reads the CALLER's own session
 * (utils/social.ts) — there is no code path where one user can see another
 * user's connections. This widget is still user-dismissible (persisted per
 * browser) since even a self-only cross-app link can feel exposing to see,
 * given Gruvs' nightlife/party framing — copy below is deliberately neutral
 * rather than party-specific.
 */
export default function GruvsConnectionsWidget() {
  const [connections, setConnections] = useState<Connection[] | null>(null)
  const [scrollIndex, setScrollIndex] = useState(0)
  const [hidden, setHidden] = useState(() => typeof window !== 'undefined' && localStorage.getItem(HIDE_KEY) === '1')

  useEffect(() => {
    let cancelled = false
    getMutualConnections().then(result => {
      if (!cancelled) setConnections(result)
    })
    return () => { cancelled = true }
  }, [])

  const hide = () => {
    localStorage.setItem(HIDE_KEY, '1')
    setHidden(true)
  }

  // Loading, hidden by choice, or nothing to show — stay out of the way
  // rather than take up space with an empty state on every single page load.
  if (hidden || connections === null || connections.length === 0) return null

  const visible = connections.slice(scrollIndex, scrollIndex + 4)

  return (
    <div className="glass-panel p-5 bg-gold-primary/5 border-gold-primary/10 flex flex-col md:flex-row items-start md:items-center gap-4">
      <div className="flex items-center gap-3 shrink-0">
        <div className="p-2 bg-gold-primary/10 rounded-xl">
          <Users size={18} className="text-gold-primary" />
        </div>
        <div>
          <p className="text-xs font-black text-white uppercase tracking-widest">
            {connections.length} cross-app connection{connections.length === 1 ? '' : 's'}
          </p>
          <p className="text-[10px] text-gray-500">People you already know are here too — visible only to you</p>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-1 min-w-0">
        {scrollIndex > 0 && (
          <button onClick={() => setScrollIndex(i => Math.max(0, i - 4))} className="text-gray-500 hover:text-white shrink-0" aria-label="Previous">
            <ChevronLeft size={16} />
          </button>
        )}
        <div className="flex gap-3 overflow-x-auto no-scrollbar">
          {visible.map(person => (
            <div key={person.id} className="flex items-center gap-2 bg-black/40 border border-white/5 rounded-xl px-3 py-2 shrink-0">
              {person.avatarUrl ? (
                <Image src={person.avatarUrl} alt={person.displayName} width={28} height={28} className="w-7 h-7 rounded-full object-cover" />
              ) : (
                <div className="w-7 h-7 rounded-full bg-gold-primary/20 flex items-center justify-center text-[10px] font-black text-gold-primary">
                  {person.displayName.charAt(0)}
                </div>
              )}
              <span className="text-xs font-bold text-white whitespace-nowrap">{person.displayName}</span>
              {person.isVerified && <ShieldCheck size={12} className="text-gold-primary shrink-0" />}
            </div>
          ))}
        </div>
        {scrollIndex + 4 < connections.length && (
          <button onClick={() => setScrollIndex(i => i + 4)} className="text-gray-500 hover:text-white shrink-0" aria-label="More">
            <ChevronRight size={16} />
          </button>
        )}
      </div>

      <button onClick={hide} className="text-gray-500 hover:text-white shrink-0" title="Hide this — you can always follow people directly instead" aria-label="Hide cross-app connections">
        <EyeOff size={16} />
      </button>
    </div>
  )
}
