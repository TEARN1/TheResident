'use client'

import React, { useEffect, useState } from 'react'
import { BarChart3 } from 'lucide-react'
import { supabase } from '../../../../utils/supabase'

/**
 * Growth funnel for the platform admin only (res_funnel_summary returns no
 * rows for anyone else, so this renders nothing for them). Tracked counts
 * come from src/utils/track.ts; "actual" is the count in the app's own
 * tables where one exists, so a gap between the two is visible.
 */
interface FunnelRow {
  step: string
  tracked: number
  sessions: number
  actual: number | null
}

const LABELS: Record<string, string> = {
  visit: 'Visits',
  room_page_view: 'Shared room opened',
  signup: 'Sign-ups',
  listing_created: 'Rooms listed',
  apply_sent: 'Applications',
  share_whatsapp: 'WhatsApp shares',
  concierge_click: 'Concierge taps'
}

const RANGES = [7, 30, 90] as const

export default function AdminFunnelCard() {
  const [days, setDays] = useState<(typeof RANGES)[number]>(30)
  const [rows, setRows] = useState<FunnelRow[] | null>(null)

  useEffect(() => {
    if (!supabase) return
    let cancelled = false
    supabase.rpc('res_funnel_summary', { p_days: days }).then(({ data, error }) => {
      if (cancelled) return
      setRows(!error && Array.isArray(data) ? (data as FunnelRow[]) : [])
    })
    return () => { cancelled = true }
  }, [days])

  if (!rows || rows.length === 0) return null

  return (
    <div className="glass-panel p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="m-0 text-sm font-black text-gold-primary uppercase tracking-widest flex items-center gap-2">
          <BarChart3 size={16} /> Growth funnel <span className="text-[9px] text-gray-500 normal-case tracking-normal">admin only</span>
        </h2>
        <div className="flex gap-1">
          {RANGES.map(d => (
            <button
              key={d}
              type="button"
              onClick={() => setDays(d)}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-black ${days === d ? 'bg-gold-primary text-black' : 'bg-white/5 text-gray-400 hover:text-white'}`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-1.5">
        {rows.map(r => (
          <div key={r.step} className="flex items-center justify-between gap-3 text-xs border-b border-white/5 pb-1.5">
            <span className="text-gray-300">{LABELS[r.step] || r.step}</span>
            <span className="flex items-baseline gap-3 tabular-nums">
              <span className="font-black text-white">{Number(r.tracked)}</span>
              <span className="text-[10px] text-gray-500 w-20 text-right">{Number(r.sessions)} session{Number(r.sessions) === 1 ? '' : 's'}</span>
              <span className="text-[10px] text-gray-500 w-16 text-right">{r.actual === null ? '' : `${Number(r.actual)} real`}</span>
            </span>
          </div>
        ))}
      </div>
      <p className="m-0 text-[10px] text-gray-600">Tracked from today onwards. &quot;Real&quot; counts come straight from the tables, so they include activity from before tracking started.</p>
    </div>
  )
}
