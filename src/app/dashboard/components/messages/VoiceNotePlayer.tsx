'use client'

import React, { useRef, useState } from 'react'
import { Loader, Pause, Play } from 'lucide-react'
import { supabase } from '../../../../utils/supabase'
import { VOICE_BUCKET, formatDuration } from '../../../../utils/dmMedia'

interface Props {
  path: string
  duration: string | null
  isMe: boolean
}

const PLAYBACK_RATES = [1, 1.5, 2]

export default function VoiceNotePlayer({ path, duration, isMe }: Props) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [loading, setLoading] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const [failed, setFailed] = useState(false)
  const [total, setTotal] = useState<number | null>(null)
  const [rateIndex, setRateIndex] = useState(0)

  const toggle = async () => {
    const audio = audioRef.current
    if (!audio || !supabase) return
    if (!audio.src) {
      setLoading(true)
      const { data, error } = await supabase.storage.from(VOICE_BUCKET).createSignedUrl(path, 3600)
      setLoading(false)
      if (error || !data?.signedUrl) {
        setFailed(true)
        return
      }
      audio.src = data.signedUrl
    }
    if (audio.paused) {
      try {
        await audio.play()
      } catch {
        setFailed(true)
      }
    } else {
      audio.pause()
    }
  }

  const cyclePlaybackRate = (e: React.MouseEvent) => {
    e.stopPropagation()
    const nextIndex = (rateIndex + 1) % PLAYBACK_RATES.length
    setRateIndex(nextIndex)
    if (audioRef.current) {
      audioRef.current.playbackRate = PLAYBACK_RATES[nextIndex]
    }
  }

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current
    if (!audio || !audio.duration) return
    const rect = e.currentTarget.getBoundingClientRect()
    const clickX = e.clientX - rect.left
    const fraction = Math.max(0, Math.min(1, clickX / rect.width))
    audio.currentTime = fraction * audio.duration
    setProgress(fraction)
  }

  return (
    <div className="flex items-center gap-2.5 min-w-[220px]">
      <button
        type="button"
        onClick={toggle}
        disabled={loading}
        className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-all touch-target-44 ${isMe ? 'bg-black text-gold-primary' : 'bg-gold-primary text-black'}`}
        aria-label={playing ? 'Pause voice note' : 'Play voice note'}
      >
        {loading ? <Loader size={15} className="animate-spin" /> : playing ? <Pause size={15} /> : <Play size={15} className="ml-0.5" />}
      </button>

      <div className="flex-1 space-y-1">
        <div
          role="progressbar"
          tabIndex={0}
          aria-valuenow={Math.round(progress * 100)}
          onClick={handleSeek}
          className={`h-2.5 rounded-full overflow-hidden cursor-pointer flex items-center ${isMe ? 'bg-black/20' : 'bg-white/15'}`}
        >
          <div className={`h-full rounded-full transition-all duration-100 ${isMe ? 'bg-black/70' : 'bg-gold-primary'}`} style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
        <div className={`flex justify-between text-[10px] font-mono font-bold ${isMe ? 'text-black/70' : 'text-gray-400'}`}>
          <span>{failed ? 'Could not play' : playing || elapsed > 0 ? formatDuration(elapsed) : 'Voice note'}</span>
          <span>{duration || (total ? formatDuration(total) : '')}</span>
        </div>
      </div>

      {/* 1x / 1.5x / 2x Speed Switcher */}
      <button
        type="button"
        onClick={cyclePlaybackRate}
        className={`px-2 py-1 rounded-lg text-[10px] font-mono font-black shrink-0 transition-all touch-target-44 ${
          isMe
            ? 'bg-black/10 hover:bg-black/20 text-black'
            : 'bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white'
        }`}
        title="Toggle playback speed (1x, 1.5x, 2x)"
      >
        {PLAYBACK_RATES[rateIndex]}x
      </button>

      <audio
        ref={audioRef}
        preload="none"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => { setPlaying(false); setProgress(0); setElapsed(0) }}
        onTimeUpdate={e => {
          const a = e.currentTarget
          setElapsed(a.currentTime)
          if (Number.isFinite(a.duration) && a.duration > 0) setProgress(a.currentTime / a.duration)
        }}
        onLoadedMetadata={e => {
          const d = e.currentTarget.duration
          if (Number.isFinite(d)) setTotal(d)
          if (audioRef.current) {
            audioRef.current.playbackRate = PLAYBACK_RATES[rateIndex]
          }
        }}
        onError={() => { if (audioRef.current?.src) setFailed(true) }}
      />
    </div>
  )
}
