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
 *
 * `sharing`/`onSharingChange` are lifted to the parent (VibeMap) rather than
 * owned here, because VibeMap renders this twice — once as a compact toggle
 * in the floating control stack (the previous location was three taps deep
 * inside the Alerts drawer, where almost nobody found it) and once with its
 * full description inside that same drawer. Two independent instances would
 * mean two independent geolocation watches and two toggle states that could
 * disagree with each other.
 */
import React, { useEffect, useRef } from 'react'
import { Radio } from 'lucide-react'
import { supabase } from '../../../../utils/supabase'

interface Props {
  userId: string | null
  sharing: boolean
  onSharingChange: (sharing: boolean) => void
  // accuracy is the browser's own 1-sigma confidence radius in metres —
  // surfaced so the map can show it honestly instead of drawing a plain dot
  // that implies pinpoint precision the Geolocation API never actually gives.
  onPosition: (pos: { lat: number; lon: number; accuracy?: number } | null) => void
  // Icon-only variant for the map's floating control stack.
  compact?: boolean
}

export default function LiveLocationToggle({ userId, sharing, onSharingChange, onPosition, compact = false }: Props) {
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
        const point = { lat: pos.coords.latitude, lon: pos.coords.longitude, accuracy: pos.coords.accuracy }
        onPosition(point)
        channelRef.current?.track({ lat: point.lat, lon: point.lon, at: new Date().toISOString() })
      },
      () => { /* silently stop trying if permission is denied mid-session */ },
      // Deliberately NOT high-accuracy. `enableHighAccuracy: true` with a 5s
      // maximumAge pins the GPS radio on continuously — the most battery-hostile
      // geolocation config available, and this runs for as long as the toggle is
      // on. That cost is only justified by turn-by-turn navigation; this feature
      // is "roughly where I am, shared with people I trust", which coarse
      // network positioning answers well. A 30s cached fix is accepted rather
      // than forcing a fresh one, and precision is left to the platform.
      //
      // It is also the more honest privacy default: streaming metre-level
      // location continuously is a far bigger disclosure than the toggle's
      // label implies. Flip these two values back if a feature genuinely needs
      // navigation-grade precision — and say so in the UI when you do.
      { enableHighAccuracy: false, maximumAge: 30000, timeout: 15000 }
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

  if (compact) {
    return (
      <button
        onClick={() => onSharingChange(!sharing)}
        aria-label={sharing ? 'Stop sharing my live location' : 'Show my live location'}
        aria-pressed={sharing}
        title={sharing ? 'Live location on — tap to stop' : 'Show my live location'}
        className={`bg-black/80 backdrop-blur-xl border border-white/10 rounded-lg p-2.5 shadow-2xl transition-all ${sharing ? 'text-gold-primary' : 'text-gray-300 hover:text-white'}`}
      >
        <Radio size={16} className={sharing ? 'animate-pulse' : ''} />
      </button>
    )
  }

  return (
    <div className="flex items-center justify-between p-3 bg-white/2 border border-white/5 rounded-xl">
      <div className="flex items-center gap-2">
        <Radio size={14} className={sharing ? 'text-gold-primary animate-pulse' : 'text-gray-500'} />
        <div>
          <p className="text-xs text-white font-medium">Share my live location</p>
          <p className="text-[10px] text-gray-500">Live sharing with your Care Circle — coming soon. This proves the mechanism on your own map for now.</p>
          <p className="text-[10px] text-gray-600 mt-0.5">Shown with its real accuracy radius — a phone GPS is typically 5–20m outdoors, more indoors, never pinpoint.</p>
        </div>
      </div>
      <button
        onClick={() => onSharingChange(!sharing)}
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
