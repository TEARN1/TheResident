'use client'

/**
 * LiveLocationToggle — the map-side foundation for live location sharing.
 *
 * Proves the mechanism: when enabled, watchPosition keeps this user's own
 * position updated (VibeMap renders it as a marker), and — when a signed-in
 * user + Supabase are available — the position is also broadcast on a
 * per-user Supabase Realtime presence channel (`live-loc-<userId>`), so a
 * second tab/device watching the same channel could pick it up. Actually
 * notifying a Care Circle is out of scope here — that's owned elsewhere.
 */
import React, { useEffect, useRef, useState } from 'react'
import { Radio } from 'lucide-react'
import { supabase } from '../../../utils/supabase'

interface Props {
  userId: string | null
  onPosition: (pos: { lat: number; lon: number } | null) => void
}

export default function LiveLocationToggle({ userId, onPosition }: Props) {
  const [sharing, setSharing] = useState(false)
  const watchIdRef = useRef<number | null>(null)
  const channelRef = useRef<ReturnType<NonNullable<typeof supabase>['channel']> | null>(null)

  useEffect(() => {
    if (!sharing) {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
        watchIdRef.current = null
      }
      if (channelRef.current) {
        supabase?.removeChannel(channelRef.current)
        channelRef.current = null
      }
      onPosition(null)
      return
    }

    if (supabase && userId) {
      const channel = supabase.channel(`live-loc-${userId}`)
      channel.subscribe()
      channelRef.current = channel
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      pos => {
        const point = { lat: pos.coords.latitude, lon: pos.coords.longitude }
        onPosition(point)
        channelRef.current?.track({ ...point, at: new Date().toISOString() })
      },
      () => { /* silently stop trying if permission is denied mid-session */ },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    )

    return () => {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
      if (channelRef.current) {
        supabase?.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sharing, userId])

  return (
    <div className="flex items-center justify-between p-3 bg-white/2 border border-white/5 rounded-xl">
      <div className="flex items-center gap-2">
        <Radio size={14} className={sharing ? 'text-gold-primary animate-pulse' : 'text-gray-500'} />
        <div>
          <p className="text-xs text-white font-medium">Share my live location</p>
          <p className="text-[10px] text-gray-500">Live sharing with your Care Circle — coming soon. This proves the mechanism on your own map for now.</p>
        </div>
      </div>
      <button
        onClick={() => setSharing(s => !s)}
        className={`relative w-10 h-5.5 rounded-full transition-colors shrink-0 ${sharing ? 'bg-gold-primary' : 'bg-white/10'}`}
        style={{ height: '22px' }}
      >
        <span
          className="absolute top-0.5 w-4.5 h-4.5 rounded-full bg-black transition-transform"
          style={{ width: '18px', height: '18px', transform: sharing ? 'translateX(20px)' : 'translateX(2px)' }}
        />
      </button>
    </div>
  )
}
