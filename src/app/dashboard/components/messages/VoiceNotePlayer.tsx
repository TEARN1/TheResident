'use client'

import React, { useRef, useState } from 'react'
import { Loader, Pause, Play } from 'lucide-react'
import { supabase } from '../../../../utils/supabase'
import { VOICE_BUCKET, formatDuration } from '../../../../utils/dmMedia'

/**
 * Plays a voice note from the private res-voice-notes bucket. The file is
 * only readable by the two people in the chat, so it is fetched through a
 * short-lived signed URL the first time it is played.
 */
interface Props {
  path: string
  duration: string | null
  isMe: boolean
}

export default function VoiceNotePlayer({ path, duration, isMe }: Props) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [loading, setLoading] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const [failed, setFailed] = useState(false)
  const [total, setTotal] = useState<number | null>(null)

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

  return (
    <div className="flex items-center gap-3 min-w-[200px]">
      <button
        type="button"
        onClick={toggle}
        disabled={loading}
        className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-all ${isMe ? 'bg-black text-gold-primary' : 'bg-gold-primary text-black'}`}
        aria-label={playing ? 'Pause voice note' : 'Play voice note'}
      >
        {loading ? <Loader size={14} className="animate-spin" /> : playing ? <Pause size={14} /> : <Play size={14} className="ml-0.5" />}
      </button>
      <div className="flex-1 space-y-1">
        <div className={`h-1.5 rounded-full overflow-hidden ${isMe ? 'bg-black/20' : 'bg-white/15'}`}>
          <div className={`h-full rounded-full ${isMe ? 'bg-black/70' : 'bg-gold-primary'}`} style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
        <div className={`flex justify-between text-[10px] font-mono font-bold ${isMe ? 'text-black/70' : 'text-gray-400'}`}>
          <span>{failed ? 'Could not play' : playing || elapsed > 0 ? formatDuration(elapsed) : 'Voice note'}</span>
          <span>{duration || (total ? formatDuration(total) : '')}</span>
        </div>
      </div>
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
        onLoadedMetadata={e => { const d = e.currentTarget.duration; if (Number.isFinite(d)) setTotal(d) }}
        onError={() => { if (audioRef.current?.src) setFailed(true) }}
      />
    </div>
  )
}
