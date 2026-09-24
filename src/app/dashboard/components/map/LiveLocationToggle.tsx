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
        title={sharing ? 'Live location active (tap to turn off)' : 'Share live location'}
        className={`backdrop-blur-2xl border rounded-2xl p-2.5 shadow-glass transition-all ${
          sharing
            ? 'bg-blue-500/20 text-blue-400 border-blue-500/40 shadow-glow'
            : 'bg-surface text-gray-400 border-glass-border hover:text-white hover:border-white/20'
        }`}
      >
        <Radio size={16} className={sharing ? 'animate-pulse text-blue-400' : ''} />
      </button>
    )
  }

  return (
    <div className="flex items-center justify-between p-3.5 bg-white/5 hover:bg-white/8 border border-white/10 rounded-2xl transition-all shadow-glass">
      <div className="flex items-start gap-3">
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
          sharing ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'bg-white/5 text-gray-500 border border-white/10'
        }`}>
          <Radio size={15} className={sharing ? 'animate-pulse' : ''} />
        </div>
        <div>
          <p className="text-xs text-white font-bold flex items-center gap-2">
            Share Live Location
            {sharing && <span className="text-[9px] bg-blue-500/20 text-blue-400 font-black px-1.5 py-0.2 rounded-full border border-blue-500/30 uppercase tracking-widest">Active</span>}
          </p>
          <p className="text-[10px] text-gray-400 mt-0.5 leading-relaxed">Broadcasts your live GPS coordinates with realistic accuracy bounds.</p>
        </div>
      </div>
      <button
        onClick={() => onSharingChange(!sharing)}
        className={`relative w-11 h-6 rounded-full transition-all shrink-0 cursor-pointer p-0.5 border ${
          sharing ? 'bg-gold-primary border-gold-primary' : 'bg-black/50 border-white/20'
        }`}
      >
        <span
          className={`block w-4.5 h-4.5 rounded-full transition-transform shadow-md ${
            sharing ? 'bg-black translate-x-5' : 'bg-gray-400 translate-x-0'
          }`}
          style={{ width: '18px', height: '18px' }}
        />
      </button>
    </div>
  )
}
