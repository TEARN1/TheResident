'use client'

import React, { useEffect, useState } from 'react'
import { AlertTriangle, Bell, BellOff, ShieldCheck, Star } from 'lucide-react'
import { supabase } from '../../../../utils/supabase'
import { formatCurrency, type PriceStats, type PriceVerdict } from '../../../../utils/logic'

/**
 * "Before you pay" checks for one listing, built only from real data:
 *  - where the price sits against other open listings in the same suburb,
 *  - what tenants who reviewed this listing actually rated it
 *    (res_listing_safety),
 *  - a vacancy watch for occupied rooms (res_watch_room_vacancy), so a
 *    seeker is notified the moment the room frees up.
 * Nothing here is inferred or invented: a check with no data says so.
 */
interface Props {
  listingId: string
  price: number
  currency: string
  suburb: string
  stats: PriceStats | null
  verdict: PriceVerdict
}

interface SafetyRow {
  declared: string | null
  reviewed: number | null
  sample: number
}

const VERDICT_COPY: Record<PriceVerdict, { label: string; tone: string } | null> = {
  suspicious: { label: 'Far below the suburb median. Common in rental scams, so view it in person before paying anything.', tone: 'text-red-400' },
  below: { label: 'Cheaper than most listings in this suburb.', tone: 'text-emerald-400' },
  fair: { label: 'In the normal range for this suburb.', tone: 'text-emerald-400' },
  above: { label: 'Pricier than most listings in this suburb.', tone: 'text-amber-400' },
  unknown: null
}

export default function ListingTrustPanel({ listingId, price, currency, suburb, stats, verdict }: Props) {
  const [safety, setSafety] = useState<SafetyRow | null>(null)
  // null = not a room listing (no watch possible); undefined = still loading
  const [watching, setWatching] = useState<boolean | null | undefined>(undefined)
  const [watchBusy, setWatchBusy] = useState(false)
  const [watchNote, setWatchNote] = useState<string | null>(null)

  useEffect(() => {
    if (!supabase) return
    let cancelled = false
    supabase.rpc('res_listing_safety', { p_listing: listingId }).then(({ data }) => {
      if (cancelled) return
      const row = Array.isArray(data) ? data[0] : data
      if (row) setSafety({ declared: row.declared ?? null, reviewed: row.reviewed ?? null, sample: row.sample ?? 0 })
    })
    // Only an occupied room can be watched: res_room_listing_status returns
    // no row for a non-room listing, and a vacant room is open to apply now.
    Promise.all([
      supabase.rpc('res_room_listing_status', { p_listing_ids: [listingId] }),
      supabase.from('res_room_vacancy_watches').select('id').eq('listing_id', listingId).maybeSingle()
    ]).then(([status, watch]) => {
      if (cancelled) return
      const room = Array.isArray(status.data) ? status.data[0] : null
      setWatching(room && !room.is_vacant ? !!watch.data : null)
    })
    return () => { cancelled = true }
  }, [listingId])

  const toggleWatch = async () => {
    if (!supabase || watchBusy) return
    setWatchBusy(true)
    setWatchNote(null)
    const { error } = watching
      ? await supabase.rpc('res_unwatch_room_vacancy', { p_listing: listingId })
      : await supabase.rpc('res_watch_room_vacancy', { p_listing: listingId })
    setWatchBusy(false)
    if (!error) {
      setWatchNote(watching ? 'You will no longer be notified.' : 'We will notify you the moment this room is free.')
      setWatching(!watching)
    } else if (error.message.includes('not_a_room_listing')) {
      setWatching(null)
    } else if (error.message.includes('room_already_vacant')) {
      setWatchNote('This room is available right now, so apply below.')
    } else {
      setWatchNote('Could not update the alert. Please try again.')
    }
  }

  const priceCopy = VERDICT_COPY[verdict]

  return (
    <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <p className="m-0 text-[10px] font-black uppercase tracking-widest text-gray-500">Before you pay</p>

      <div className="flex items-start gap-2 text-xs">
        <ShieldCheck size={14} className="mt-0.5 shrink-0 text-gold-primary" />
        {priceCopy && stats ? (
          <p className="m-0 text-gray-300">
            <span className={`font-bold ${priceCopy.tone}`}>{priceCopy.label}</span>{' '}
            Typical rent in {suburb}: {formatCurrency(stats.low, currency)} to {formatCurrency(stats.high, currency)}
            {' '}(median {formatCurrency(stats.median, currency)}, {stats.sample} listings). This one: {formatCurrency(price, currency)}.
          </p>
        ) : (
          <p className="m-0 text-gray-500">Not enough listings in {suburb || 'this suburb'} yet to compare the price.</p>
        )}
      </div>

      <div className="flex items-start gap-2 text-xs">
        <Star size={14} className="mt-0.5 shrink-0 text-gold-primary" />
        {safety && safety.sample > 0 ? (
          <p className="m-0 text-gray-300">
            Tenants rated this place <span className="font-bold text-white">{safety.reviewed}/5</span> from {safety.sample} review{safety.sample === 1 ? '' : 's'}.
          </p>
        ) : (
          <p className="m-0 text-gray-500">No tenant reviews yet. Ask to speak to a current tenant.</p>
        )}
      </div>

      <div className="flex items-start gap-2 text-xs">
        <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-400" />
        <p className="m-0 text-gray-400">Never pay a deposit before viewing the room and meeting the landlord in person.</p>
      </div>

      {watching !== null && watching !== undefined && (
        <button
          type="button"
          onClick={toggleWatch}
          disabled={watchBusy}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-gold-primary/30 bg-gold-primary/10 py-2.5 text-[11px] font-black uppercase tracking-wider text-gold-primary transition-all hover:bg-gold-primary/20 disabled:opacity-50"
        >
          {watching ? <BellOff size={14} /> : <Bell size={14} />}
          {watching ? 'Stop vacancy alerts' : 'Notify me when this room is free'}
        </button>
      )}
      {watchNote && <p className="m-0 text-[11px] text-gray-400">{watchNote}</p>}
    </div>
  )
}
