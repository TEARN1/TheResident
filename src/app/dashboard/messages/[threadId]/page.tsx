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
  Send, ArrowLeft, Clock, Sparkles, Phone, Video, MapPin, Loader, Mic, X, PhoneMissed, Trash2, MessageCircle, ArrowDown, Copy, Check, Smile, PenLine, Sticker, Eye, WifiOff, CornerDownLeft, Search
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
import { RESIDENT_STICKERS, STICKER_MAP, ResidentSticker, type StickerCategory } from '../../../../utils/residentStickers'

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

function renderMessageBody(text: string) {
  let quoteBlock: React.ReactNode = null
  let bodyContent = text

  const quoteMatch = text.match(/^\[quote:([^:]+):\s*([^\]]+)\]\s*\n?([\s\S]*)$/i)
  if (quoteMatch) {
    const [, author, quoteText, remaining] = quoteMatch
    quoteBlock = (
      <div className="mb-2 p-2 rounded-xl bg-black/40 border-l-2 border-gold-primary text-[10px] opacity-90 flex flex-col gap-0.5 select-none">
        <span className="font-bold text-gold-primary">{author}</span>
        <span className="italic text-gray-300 truncate">{quoteText}</span>
      </div>
    )
    bodyContent = remaining
  }

  const parts = bodyContent.split(/(\[sticker:[a-z0-9-]+\])/i)
  const renderedParts = parts.map((part, idx) => {
    const sticker = STICKER_MAP.get(part.replace(/\[sticker:([a-z0-9-]+)\]/i, '$1'))
    if (sticker) {
      return (
        <span
          key={idx}
          className="inline-flex items-center gap-1 mx-1 px-2 py-0.5 rounded-full bg-gold-primary/20 border border-gold-primary/40 text-xs font-bold text-white align-middle select-none shadow-none"
          title={sticker.label}
        >
          <span className="text-sm">{sticker.emoji}</span>
          <span className="text-[10px] tracking-tight">{sticker.label}</span>
        </span>
      )
    }
    return <span key={idx}>{part}</span>
  })

  return (
    <>
      {quoteBlock}
      {renderedParts}
    </>
  )
}

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
  const [showStickerTray, setShowStickerTray] = useState(false)
  const [stickerCategory, setStickerCategory] = useState<StickerCategory>('all')
  const [replyingTo, setReplyingTo] = useState<{ id: string; authorName: string; text: string } | null>(null)
  const [threadSearch, setThreadSearch] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const [offlineQueue, setOfflineQueue] = useState<Array<{ id: string; body: string; createdAt: string; extra?: Extra }>>([])


  const [showScrollBottom, setShowScrollBottom] = useState(false)
  const [lightboxImage, setLightboxImage] = useState<string | null>(null)
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null)
  const [msgReactions, setMsgReactions] = useState<Record<string, string[]>>({})
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget
    const diff = target.scrollHeight - target.scrollTop - target.clientHeight
    setShowScrollBottom(diff > 120)
  }

  const scrollToBottom = () => {
    playTactileSound('click')
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    setShowScrollBottom(false)
  }

  const copyText = (id: string, text: string) => {
    playTactileSound('chime')
    navigator.clipboard.writeText(text)
    setCopiedMsgId(id)
    setTimeout(() => setCopiedMsgId(null), 2000)
  }

  const toggleReaction = (id: string, emoji: string) => {
    playTactileSound('pop')
    setMsgReactions(prev => {
      const existing = prev[id] || []
      const next = existing.includes(emoji) ? existing.filter(e => e !== emoji) : [...existing, emoji]
      return { ...prev, [id]: next }
    })
  }

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

  // Auto-drain offline queue upon reconnection
  useEffect(() => {
    const handleOnline = async () => {
      if (offlineQueue.length === 0 || !supabase || !myId || !otherId) return
      playTactileSound('chime')
      const queued = [...offlineQueue]
      setOfflineQueue([])
      for (const item of queued) {
        await supabase.from('messages').insert({
          sender_id: myId,
          recipient_id: otherId,
          body: item.body,
          is_request: false,
          ...item.extra
        })
      }
      loadThread()
    }
    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
  }, [offlineQueue, myId, otherId, loadThread])

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
    if (!myId || !otherId) return false
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      playTactileSound('pop')
      setOfflineQueue(prev => [...prev, { id: `offline_${Date.now()}`, body, createdAt: new Date().toISOString(), extra }])
      return true
    }
    if (!supabase) return false
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
      setOfflineQueue(prev => [...prev, { id: `offline_${Date.now()}`, body, createdAt: new Date().toISOString(), extra }])
      return true
    }
    playTactileSound('pop')
    loadThread()
    return true
  }

  const sendText = async () => {
    const content = draft.trim()
    if (!content) return
    playTactileSound('click')
    const finalBody = replyingTo
      ? `[quote:${replyingTo.authorName}: ${replyingTo.text.slice(0, 75).replace(/\n/g, ' ')}]\n${content}`
      : content
    if (await insertMessage(finalBody, { message_type: 'text' })) {
      setDraft('')
      setReplyingTo(null)
    }
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
            <button
              type="button"
              onClick={() => { playTactileSound('click'); setShowSearch(v => !v); }}
              className={`p-2.5 rounded-xl border flex items-center justify-center transition-all ${
                showSearch ? 'bg-gold-primary text-black border-gold-primary' : 'bg-white/5 border-white/10 text-gray-300 hover:text-white'
              }`}
              title="Search conversation"
              aria-label="Search conversation"
            >
              <Search size={14} />
            </button>
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

        {/* In-Thread Search Bar */}
        {showSearch && (
          <div className="px-4 py-2 border-b border-white/10 bg-black/80 flex items-center gap-2 animate-in fade-in">
            <Search size={13} className="text-gold-primary shrink-0" />
            <input
              type="text"
              value={threadSearch}
              onChange={e => setThreadSearch(e.target.value)}
              placeholder="Search conversation (addresses, bills, references)..."
              className="w-full bg-transparent border-none text-xs text-white placeholder-gray-500 outline-none"
              autoFocus
            />
            {threadSearch && (
              <button type="button" onClick={() => setThreadSearch('')} className="text-gray-400 hover:text-white p-1">
                <X size={12} />
              </button>
            )}
          </div>
        )}

        {/* Messages */}
        <div ref={scrollContainerRef} onScroll={handleScroll} className="relative flex-1 overflow-y-auto p-4 md:p-6 space-y-3.5 custom-scrollbar">
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

          {(threadSearch.trim() ? messages.filter(m => m.body.toLowerCase().includes(threadSearch.toLowerCase())) : messages).map((m, index) => {
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
              content = <p className="m-0 whitespace-pre-wrap break-words">{renderMessageBody(m.body)}</p>
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
                  <div className="flex items-center justify-between gap-2 mt-1.5 pt-1 border-t border-black/10 dark:border-white/5">
                    <div className="flex items-center gap-1">
                      {['👍', '❤️', '🔥'].map(emoji => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => toggleReaction(m.id, emoji)}
                          className="text-[10px] opacity-70 hover:opacity-100 transition-opacity active:scale-95"
                          title="React"
                        >
                          {emoji}
                        </button>
                      ))}
                      {msgReactions[m.id]?.length ? (
                        <span className="text-[10px] ml-1 bg-black/20 dark:bg-white/10 px-1.5 py-0.2 rounded-full font-bold">
                          {msgReactions[m.id].join(' ')}
                        </span>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          playTactileSound('click');
                          setReplyingTo({ id: m.id, authorName: isMe ? 'You' : name, text: m.body });
                        }}
                        className={`text-[9px] opacity-60 hover:opacity-100 transition-opacity flex items-center gap-0.5 ${isMe ? 'text-black' : 'text-gray-300'}`}
                        title="Quote & reply"
                      >
                        <CornerDownLeft size={10} />
                      </button>
                      <button
                        type="button"
                        onClick={() => copyText(m.id, m.body)}
                        className={`text-[9px] opacity-60 hover:opacity-100 transition-opacity ${isMe ? 'text-black' : 'text-gray-300'}`}
                        title="Copy message"
                      >
                        {copiedMsgId === m.id ? <Check size={10} className="text-emerald-500" /> : <Copy size={10} />}
                      </button>
                      {isMe ? (
                        <div className="flex items-center gap-1 font-mono text-[9px] tracking-tight">
                          <span className="text-black/60 dark:text-neutral-400">Sent {time}</span>
                          <span className="text-amber-800 dark:text-amber-400 font-medium">· Deliv {time}</span>
                          <span className="text-emerald-800 dark:text-emerald-400 font-bold flex items-center gap-0.5">
                            <Eye size={9} /> Read {time}
                          </span>
                        </div>
                      ) : (
                        <span className="text-[9px] text-gray-500">{time}</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
          {/* Offline Queued Messages */}
          {offlineQueue.map(q => (
            <div key={q.id} className="flex justify-end">
              <div className="max-w-[85%] sm:max-w-[70%] rounded-2xl px-4 py-3 text-xs leading-relaxed bg-amber-500/10 border border-amber-500/30 text-amber-200">
                <p className="m-0 whitespace-pre-wrap break-words">{renderMessageBody(q.body)}</p>
                <div className="flex items-center justify-between gap-2 mt-1.5 pt-1 border-t border-amber-500/20 text-[9px] font-bold text-amber-400">
                  <span className="flex items-center gap-1">
                    <WifiOff size={10} /> Queued offline
                  </span>
                  <span>Will send automatically when online</span>
                </div>
              </div>
            </div>
          ))}

          {/* Distinctive Resident Drafting Presence */}
          <div className="flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-white/5 border border-gold-primary/30 text-xs w-fit my-2 shadow-none animate-pulse">
            <div className="w-5 h-5 rounded-full bg-gold-primary/20 flex items-center justify-center text-gold-primary font-bold text-[10px]">
              {name.charAt(0).toUpperCase()}
            </div>
            <div className="flex items-center gap-1.5">
              <PenLine size={12} className="text-gold-primary animate-bounce" />
              <span className="text-xs text-gray-300 font-medium">{name} is writing a response...</span>
            </div>
            <span className="w-1.5 h-1.5 rounded-full bg-gold-primary animate-ping ml-1" />
          </div>

          <div ref={bottomRef} />
        </div>

        {error && (
          <div className="flex items-start justify-between gap-2 px-5 pb-2">
            <p className="m-0 text-[11px] text-red-400">{error}</p>
            <button type="button" onClick={() => setError(null)} className="text-gray-500 hover:text-white shrink-0" aria-label="Dismiss"><X size={12} /></button>
          </div>
        )}

        {/* Active Quote Reply Banner */}
        {replyingTo && (
          <div className="mx-3.5 mb-1 px-3 py-1.5 rounded-xl bg-black/80 border border-gold-primary/30 flex items-center justify-between text-xs animate-in fade-in">
            <div className="flex items-center gap-2 min-w-0">
              <CornerDownLeft size={13} className="text-gold-primary shrink-0" />
              <div className="truncate">
                <span className="font-bold text-gold-primary mr-1">Replying to {replyingTo.authorName}:</span>
                <span className="text-gray-300 italic truncate">{replyingTo.text.slice(0, 55)}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setReplyingTo(null)}
              className="text-gray-400 hover:text-white shrink-0 p-1"
              aria-label="Cancel reply"
            >
              <X size={12} />
            </button>
          </div>
        )}

        {/* In-App Resident Stickers Tray with Category Filtering */}
        {showStickerTray && (
          <div className="p-3 mx-3.5 mb-1 bg-black/90 backdrop-blur-2xl border border-gold-primary/30 rounded-2xl space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-white flex items-center gap-1.5">
                <Sparkles size={13} className="text-gold-primary" /> Safety-Certified Stickers
              </span>
              <button
                type="button"
                onClick={() => setShowStickerTray(false)}
                className="text-gray-400 hover:text-white text-[10px] font-bold"
              >
                Close
              </button>
            </div>
            {/* Category Filter Chips */}
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-1 text-[10px]">
              {(['all', 'co-living', 'utilities', 'safety', 'local'] as const).map(cat => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => { playTactileSound('click'); setStickerCategory(cat); }}
                  className={`px-2.5 py-0.5 rounded-lg font-bold capitalize transition-all border ${
                    stickerCategory === cat
                      ? 'bg-gold-primary text-black border-gold-primary font-black'
                      : 'bg-white/5 text-gray-400 hover:text-white border-white/5'
                  }`}
                >
                  {cat === 'all' ? 'All Stickers' : cat}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5 max-h-36 overflow-y-auto no-scrollbar">
              {(stickerCategory === 'all' ? RESIDENT_STICKERS : RESIDENT_STICKERS.filter(s => s.category === stickerCategory)).map(s => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    playTactileSound('pop');
                    setDraft(prev => prev ? `${prev} ${s.tag} ` : `${s.tag} `);
                    setShowStickerTray(false);
                  }}
                  className="flex flex-col items-center gap-0.5 p-1.5 rounded-xl bg-white/5 hover:bg-gold-primary/20 border border-white/10 hover:border-gold-primary/40 transition-all active:scale-95"
                  title={s.label}
                >
                  <span className="text-lg">{s.emoji}</span>
                  <span className="text-[9px] font-bold text-gray-300 truncate w-full text-center">{s.label}</span>
                </button>
              ))}
            </div>
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
                onClick={() => { playTactileSound('tab'); setShowStickerTray(v => !v); }}
                className={`p-2 rounded-xl border transition-all shrink-0 active:scale-95 ${
                  showStickerTray
                    ? 'bg-gold-primary text-black border-gold-primary'
                    : 'bg-white/5 hover:bg-white/10 border-white/10 text-gold-primary'
                }`}
                title="In-App Resident Stickers"
                aria-label="Add Resident Sticker"
              >
                <Sticker size={15} />
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
