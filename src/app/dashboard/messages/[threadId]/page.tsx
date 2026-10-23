'use client'

function formatMessageDate(iso: string): string {
  const d = new Date(iso)
  const today = new Date()
  if (d.toDateString() === today.toDateString()) return 'Today'
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useSelector } from 'react-redux'
import { useParams, useRouter } from 'next/navigation'
import {
  Send, ArrowLeft, Clock, Sparkles, Phone, Video, MapPin, Loader, Mic, X, PhoneMissed, Trash2, MessageCircle
} from 'lucide-react'
import { RootState, isGuestUser } from '../../../../store'
import Link from 'next/link'
import EmptyState from '../../components/shared/EmptyState'
import { supabase } from '../../../../utils/supabase'
import { playTactileSound } from '../../../../utils/tactileSounds'
import {
  VOICE_BUCKET, formatDuration, voiceNoteBody, voiceNoteDuration, voiceNotePath, uploadTypeFor,
  locationBody, parseLegacyBeacon, isLegacyVoiceNote
} from '../../../../utils/dmMedia'
import { useCall } from '../../components/messages/CallProvider'
import VoiceNotePlayer from '../../components/messages/VoiceNotePlayer'
import LocationCard from '../../components/messages/LocationCard'
import { useVoiceRecorder, type Recording } from '../../components/messages/useVoiceRecorder'

interface DbMessage {
  id: string
  sender_id: string
  recipient_id: string
  body: string
  is_request: boolean | null
  created_at: string
  message_type: string | null
  media_url: string | null
  media_type: string | null
  latitude: number | null
  longitude: number | null
}

interface ProfileHit {
  id: string
  username: string | null
  display_name: string | null
  avatar_url: string | null
}

type Extra = Partial<Pick<DbMessage, 'message_type' | 'media_url' | 'media_type' | 'latitude' | 'longitude'>>

export default function ThreadPage() {
  const currentUser = useSelector((state: RootState) => state.auth.currentUser)
  const guest = isGuestUser(currentUser)
  const myId = guest ? undefined : currentUser?.id
  const router = useRouter()
  const params = useParams<{ threadId: string }>()
  const otherId = params.threadId
  const { available: callsAvailable, inCall, startCall } = useCall()

  const [otherProfile, setOtherProfile] = useState<ProfileHit | null>(null)
  const [messages, setMessages] = useState<DbMessage[]>([])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmLocation, setConfirmLocation] = useState(false)
  const [locating, setLocating] = useState(false)
  const [uploadingVoice, setUploadingVoice] = useState(false)

  const bottomRef = useRef<HTMLDivElement>(null)

  const name = otherProfile?.display_name || otherProfile?.username || 'Resident'

  useEffect(() => {
    if (!supabase || !otherId) return
    supabase.from('profiles').select('id, username, display_name, avatar_url').eq('id', otherId).maybeSingle()
      .then(({ data }) => { if (data) setOtherProfile(data as ProfileHit) })
  }, [otherId])

  const loadThread = useCallback(async () => {
    if (!supabase || !myId || !otherId) return
    const { data } = await supabase
      .from('messages')
      .select('id, sender_id, recipient_id, body, is_request, created_at, message_type, media_url, media_type, latitude, longitude')
      .or(`and(sender_id.eq.${myId},recipient_id.eq.${otherId}),and(sender_id.eq.${otherId},recipient_id.eq.${myId})`)
      .order('created_at', { ascending: true })
    setMessages((data || []) as DbMessage[])
  }, [myId, otherId])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount
    loadThread()
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
  }, [loadThread])

  // New messages from them (and call summaries written by either side).
  useEffect(() => {
    if (!supabase || !myId || !otherId) return
    const sorted = [myId, otherId].sort()
    const channel = supabase
      .channel(`dm_fast_${sorted[0]}_${sorted[1]}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `sender_id=eq.${otherId}` }, () => { loadThread() })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `recipient_id=eq.${otherId}` }, () => { loadThread() })
      .subscribe()
    return () => { supabase!.removeChannel(channel) }
  }, [myId, otherId, loadThread])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const insertMessage = async (body: string, extra: Extra = {}) => {
    if (!supabase || !myId || !otherId) return false
    setSending(true)
    setError(null)
    const { error: sendError } = await supabase.from('messages').insert({
      sender_id: myId,
      recipient_id: otherId,
      body,
      is_request: messages.length === 0,
      ...extra
    })
    setSending(false)
    if (sendError) {
      setError(sendError.message)
      return false
    }
    playTactileSound('pop')
    loadThread()
    return true
  }

  const sendText = async () => {
    const content = draft.trim()
    if (!content) return
    playTactileSound('click')
    if (await insertMessage(content, { message_type: 'text' })) setDraft('')
  }

  // ── Voice notes: really recorded, stored privately for the two of you ──
  const sendRecording = async (r: Recording) => {
    if (!supabase || !myId || !otherId) return
    if (r.seconds < 1 || r.blob.size === 0) {
      setError('That was too short to send.')
      return
    }
    setUploadingVoice(true)
    const { contentType, ext } = uploadTypeFor(r.mime)
    const path = voiceNotePath(myId, otherId, ext)
    const { error: upErr } = await supabase.storage.from(VOICE_BUCKET).upload(path, r.blob, { contentType })
    setUploadingVoice(false)
    if (upErr) {
      setError('The voice note could not be uploaded. Check your connection and try again.')
      return
    }
    playTactileSound('success')
    await insertMessage(voiceNoteBody(r.seconds), { message_type: 'voice', media_url: path, media_type: contentType })
  }
  const recorder = useVoiceRecorder(setError, r => { void sendRecording(r) })

  const finishRecording = async () => {
    const r = await recorder.stop()
    if (r) await sendRecording(r)
  }

  // ── Location: asked first, real GPS only, never a made-up position ──
  const shareLocation = () => {
    setConfirmLocation(false)
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      setError('This device cannot share its location.')
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      pos => {
        setLocating(false)
        const { latitude, longitude } = pos.coords
        void insertMessage(locationBody(latitude, longitude), { message_type: 'location', latitude, longitude })
      },
      err => {
        setLocating(false)
        setError(err.code === err.PERMISSION_DENIED
          ? 'Location is blocked. Allow location access for this site, then try again.'
          : 'Could not find your location right now. Try again outside or with Wi-Fi on.')
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }
    )
  }

  const call = (type: 'audio' | 'video') => {
    playTactileSound('click')
    startCall({ id: otherId, name, avatarUrl: otherProfile?.avatar_url }, type)
  }

  const QUICK_PROMPTS = [
    { label: 'Room inquiry', text: `Hi ${name}! Is the room still available?` },
    { label: 'Arrange a viewing', text: 'Hi! When would be a good time to come and view the place?' },
    { label: 'Chores this week', text: 'Hi! Checking in on our chore rota for this week.' }
  ]

  const callButton = 'p-2 sm:px-3 py-2 rounded-xl bg-white/5 hover:bg-gold-primary/20 border border-white/10 hover:border-gold-primary/40 text-gray-300 hover:text-white transition-all active:scale-95 flex items-center gap-1.5 disabled:opacity-40'

  // Guests can't send: say so instead of an empty chat whose send fails.
  if (guest) {
    return (
      <div className="p-4 md:p-8 max-w-4xl mx-auto pb-32">
        <EmptyState
          icon={MessageCircle}
          title="Sign up to send a message"
          subtitle="It's free. You can message landlords, roommates and neighbours once you have an account."
          action={
            <Link href="/auth?signup=1" className="no-underline inline-flex px-5 py-2.5 rounded-2xl bg-gold-primary text-black font-black text-xs uppercase tracking-wider">
              Sign up
            </Link>
          }
        />
      </div>
    )
  }

  return (
    <div className="p-3 sm:p-4 md:p-8 max-w-4xl mx-auto pb-24 md:pb-12">
      <div className="bg-black/60 backdrop-blur-3xl border border-white/10 rounded-2xl sm:rounded-3xl overflow-hidden shadow-glass flex flex-col h-[calc(100dvh-180px)] md:h-[75vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10 bg-white/2">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => router.push('/dashboard/messages')}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white transition-all shrink-0"
              aria-label="Back to conversations"
            >
              <ArrowLeft size={16} />
            </button>
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-gold-primary to-amber-600 flex items-center justify-center text-black font-black text-sm overflow-hidden shadow-sm shrink-0">
              {otherProfile?.avatar_url
                ? // eslint-disable-next-line @next/next/no-img-element
                  <img src={otherProfile.avatar_url} alt="" className="w-full h-full object-cover" />
                : name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <span className="block text-sm font-black text-white tracking-tight truncate">{name}</span>
              <p className="m-0 text-[10px] text-gray-500 font-bold">On The Resident</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button onClick={() => call('audio')} disabled={!callsAvailable || inCall} className={callButton} title="Voice call" aria-label="Start voice call">
              <Phone size={15} className="text-gold-primary" />
              <span className="hidden sm:inline text-xs font-bold">Call</span>
            </button>
            <button onClick={() => call('video')} disabled={!callsAvailable || inCall} className={callButton} title="Video call" aria-label="Start video call">
              <Video size={15} className="text-gold-primary" />
              <span className="hidden sm:inline text-xs font-bold">Video</span>
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-3.5 custom-scrollbar">
          {messages.length === 0 && (
            <div className="text-center py-12 px-4 space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-gold-primary/10 border border-gold-primary/20 text-gold-primary mx-auto flex items-center justify-center">
                <Sparkles size={22} />
              </div>
              <div>
                <p className="text-sm font-bold text-white tracking-tight">Say hi to {name}</p>
                <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
                  Send a message, a voice note or your location. Once you have messaged each other you can also call.
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-2 max-w-md mx-auto pt-2">
                {QUICK_PROMPTS.map(prompt => (
                  <button
                    key={prompt.label}
                    type="button"
                    onClick={() => { playTactileSound('tab'); setDraft(prompt.text) }}
                    className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-gold-primary/20 border border-white/10 hover:border-gold-primary/40 text-[11px] font-semibold text-gray-300 hover:text-white transition-all active:scale-95"
                  >
                    {prompt.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, index) => {
            const prevMsg = messages[index - 1]
            const showDateHeader = !prevMsg || formatMessageDate(prevMsg.created_at) !== formatMessageDate(m.created_at)
            const isMe = m.sender_id === myId
            const time = new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

            if (m.message_type === 'call') {
              return (
                <div key={m.id} className="flex justify-center">
                  <span className="inline-flex items-center gap-1.5 text-[11px] text-gray-400 bg-white/5 border border-white/10 rounded-full px-3 py-1">
                    {m.body.includes('Missed') ? <PhoneMissed size={12} className="text-red-400" /> : <Phone size={12} className="text-gold-primary" />}
                    {m.body.replace('📞 ', '')}{isMe && m.body.includes('Missed') ? ` (to ${name})` : ''} · {time}
                  </span>
                </div>
              )
            }

            const legacyBeacon = parseLegacyBeacon(m.body)
            const location = m.message_type === 'location' && m.latitude != null && m.longitude != null
              ? { lat: m.latitude, lon: m.longitude, placeholder: false }
              : legacyBeacon

            let content: React.ReactNode
            if (m.message_type === 'voice' && m.media_url) {
              content = <VoiceNotePlayer path={m.media_url} duration={voiceNoteDuration(m.body)} isMe={isMe} />
            } else if (isLegacyVoiceNote(m.body)) {
              content = <p className="m-0 italic opacity-80">Voice note ({voiceNoteDuration(m.body) || '?'}) from before recording worked, so there is no audio.</p>
            } else if (location && !location.placeholder) {
              content = <LocationCard lat={location.lat} lon={location.lon} isMe={isMe} />
            } else if (location?.placeholder) {
              content = <p className="m-0 italic opacity-80">Location from an older version of the app. It was a placeholder, not a real position.</p>
            } else {
              content = <p className="m-0 whitespace-pre-wrap break-words">{m.body}</p>
            }

            return (
              <div key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] sm:max-w-[70%] rounded-2xl px-4 py-3 text-xs leading-relaxed shadow-sm ${
                    isMe
                      ? 'bg-gradient-to-br from-gold-primary to-amber-500 text-black font-semibold rounded-br-xs'
                      : 'bg-white/5 backdrop-blur-xl border border-white/10 text-gray-100 rounded-bl-xs'
                  }`}
                >
                  {m.is_request && isMe && (
                    <span className="flex items-center gap-1 text-[9px] opacity-80 mb-1 uppercase font-black tracking-wider">
                      <Clock size={10} /> First message
                    </span>
                  )}
                  {content}
                  <span className={`block text-[9px] mt-1 text-right font-medium ${isMe ? 'text-black/60' : 'text-gray-500'}`}>{time}</span>
                </div>
              </div>
            )
          })}
          <div ref={bottomRef} />
        </div>

        {error && (
          <div className="flex items-start justify-between gap-2 px-5 pb-2">
            <p className="m-0 text-[11px] text-red-400">{error}</p>
            <button type="button" onClick={() => setError(null)} className="text-gray-500 hover:text-white shrink-0" aria-label="Dismiss"><X size={12} /></button>
          </div>
        )}

        {/* Composer */}
        <div className="p-3.5 border-t border-white/10 bg-white/2">
          {recorder.recording ? (
            <div className="flex items-center justify-between gap-3 bg-red-950/40 border border-red-500/40 rounded-2xl px-3 py-2">
              <button type="button" onClick={recorder.cancel} className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white" aria-label="Discard recording">
                <Trash2 size={15} />
              </button>
              <div className="flex items-center gap-2 text-xs font-mono font-black text-red-300">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                <span>{formatDuration(recorder.seconds)}</span>
                <span className="text-[10px] text-red-300/60 font-sans font-bold">/ 2:00</span>
              </div>
              <button
                type="button"
                onClick={() => { void finishRecording() }}
                className="px-3 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-black text-xs uppercase tracking-wider flex items-center gap-1.5 active:scale-95"
              >
                <Send size={13} /> Send
              </button>
            </div>
          ) : confirmLocation ? (
            <div className="flex items-center justify-between gap-3 bg-white/5 border border-gold-primary/30 rounded-2xl px-4 py-2.5">
              <p className="m-0 text-xs text-gray-200">Send your current location to <span className="font-bold text-white">{name}</span>?</p>
              <div className="flex items-center gap-2 shrink-0">
                <button type="button" onClick={() => setConfirmLocation(false)} className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-gray-200 text-xs font-bold">Cancel</button>
                <button type="button" onClick={shareLocation} className="px-3 py-1.5 rounded-xl bg-gold-primary text-black text-xs font-black">Share</button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 bg-black/60 backdrop-blur-2xl border border-white/15 focus-within:border-gold-primary/60 rounded-2xl px-2.5 py-1.5 transition-all">
              <button
                type="button"
                onClick={() => setConfirmLocation(true)}
                disabled={locating || sending}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gold-primary transition-all shrink-0 active:scale-95 disabled:opacity-50"
                title="Share your location"
                aria-label="Share your location"
              >
                {locating ? <Loader size={15} className="animate-spin" /> : <MapPin size={15} />}
              </button>
              <button
                type="button"
                onClick={() => { void recorder.start() }}
                disabled={uploadingVoice || sending}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-rose-400 transition-all shrink-0 active:scale-95 disabled:opacity-50"
                title="Record a voice note"
                aria-label="Record a voice note"
              >
                {uploadingVoice ? <Loader size={15} className="animate-spin" /> : <Mic size={15} />}
              </button>
              <input
                value={draft}
                onChange={e => setDraft(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') void sendText() }}
                placeholder="Write a message…"
                className="flex-1 min-w-0 bg-transparent border-0 text-xs text-white placeholder:text-gray-500 outline-none p-2 font-medium"
              />
              <button
                onClick={() => { void sendText() }}
                disabled={sending || !draft.trim()}
                className="bg-gold-primary hover:bg-gold-secondary text-black p-2.5 rounded-xl transition-all disabled:opacity-40 shrink-0 active:scale-95"
                aria-label="Send message"
              >
                <Send size={14} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
