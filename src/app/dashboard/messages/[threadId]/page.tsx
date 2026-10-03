'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useSelector } from 'react-redux'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Send, ArrowLeft, Clock, Sparkles, Phone, Video,
  MapPin, Radar, ExternalLink, Loader
} from 'lucide-react'
import { RootState } from '../../../../store'
import { supabase } from '../../../../utils/supabase'
import { playTactileSound } from '../../../../utils/tactileSounds'
import ActiveCallModal, { type CallType } from '../../components/messages/ActiveCallModal'

interface DbMessage {
  id: string
  sender_id: string
  recipient_id: string
  body: string
  is_request: boolean | null
  created_at: string
}

interface ProfileHit {
  id: string
  username: string | null
  display_name: string | null
  avatar_url: string | null
}

export default function ThreadPage() {
  const currentUser = useSelector((state: RootState) => state.auth.currentUser)
  const myId = currentUser?.id
  const router = useRouter()
  const params = useParams<{ threadId: string }>()
  const otherId = params.threadId

  const [otherProfile, setOtherProfile] = useState<ProfileHit | null>(null)
  const [messages, setMessages] = useState<DbMessage[]>([])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showCallModal, setShowCallModal] = useState(false)
  const [callType, setCallType] = useState<CallType>('audio')
  const [sendingLocation, setSendingLocation] = useState(false)
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
      .select('id, sender_id, recipient_id, body, is_request, created_at')
      .or(`and(sender_id.eq.${myId},recipient_id.eq.${otherId}),and(sender_id.eq.${otherId},recipient_id.eq.${myId})`)
      .order('created_at', { ascending: true })
    setMessages((data || []) as DbMessage[])
  }, [myId, otherId])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount
    loadThread()
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
  }, [loadThread])

  // Realtime subscription
  useEffect(() => {
    if (!supabase || !myId || !otherId) return
    const sorted = [myId, otherId].sort()
    const channelName = `dm_fast_${sorted[0]}_${sorted[1]}`
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `sender_id=eq.${otherId}` },
        () => { loadThread() }
      )
      .subscribe()
    return () => { supabase!.removeChannel(channel) }
  }, [myId, otherId, loadThread])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async (textToSend?: string) => {
    const content = textToSend || draft.trim()
    if (!supabase || !myId || !otherId || !content) return
    playTactileSound('click')
    setSending(true)
    setError(null)
    const alreadyTalked = messages.length > 0
    const { error: sendError } = await supabase
      .from('messages')
      .insert({
        sender_id: myId,
        recipient_id: otherId,
        body: content,
        is_request: !alreadyTalked
      })
    setSending(false)
    if (sendError) {
      setError(sendError.message)
      return
    }
    playTactileSound('pop')
    if (!textToSend) setDraft('')
    loadThread()
  }

  // 1-Tap "Find Me" GPS Radar Beacon
  const handleSendFindMeBeacon = () => {
    playTactileSound('tab')
    setSendingLocation(true)
    if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        pos => {
          const lat = pos.coords.latitude.toFixed(4)
          const lon = pos.coords.longitude.toFixed(4)
          const beaconMsg = `📍 [Find Me Beacon] Lat: ${lat}, Lon: ${lon} — Shared live resident location coordinates.`
          sendMessage(beaconMsg)
          setSendingLocation(false)
        },
        () => {
          const fallbackMsg = `📍 [Find Me Beacon] Lat: -26.1926, Lon: 28.0305 — Braamfontein Co-Living Zone.`
          sendMessage(fallbackMsg)
          setSendingLocation(false)
        },
        { timeout: 5000 }
      )
    } else {
      const fallbackMsg = `📍 [Find Me Beacon] Lat: -26.1926, Lon: 28.0305 — Braamfontein Co-Living Zone.`
      sendMessage(fallbackMsg)
      setSendingLocation(false)
    }
  }

  const QUICK_PROMPTS = [
    { label: 'Room Inquiry', text: `Hi ${name}! Inquiring about apartment sharing and availability.` },
    { label: 'Vibe Check Call', text: `Saw your profile on Roommate Match! Would love to hop on a quick voice or video call.` },
    { label: 'Find Me Beacon', text: `Sending you my live building location coordinates.` },
    { label: 'Chore Rota', text: `Hi! Checking in on our household rotation schedule for this week.` }
  ]

  return (
    <div className="p-3 sm:p-4 md:p-8 max-w-4xl mx-auto pb-24 md:pb-12">
      <div className="bg-black/60 backdrop-blur-3xl border border-white/10 rounded-2xl sm:rounded-3xl overflow-hidden shadow-glass flex flex-col h-[calc(100dvh-180px)] md:h-[75vh]">
        {/* Header with Call & Video Controls */}
        <div className="flex items-center justify-between p-4 border-b border-white/10 bg-white/2">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/dashboard/messages')}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white transition-all"
              aria-label="Back to conversations"
            >
              <ArrowLeft size={16} />
            </button>
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-gold-primary to-amber-600 flex items-center justify-center text-black font-black text-sm overflow-hidden shadow-sm">
              {otherProfile?.avatar_url
                ? // eslint-disable-next-line @next/next/no-img-element
                  <img src={otherProfile.avatar_url} alt="" className="w-full h-full object-cover" />
                : name.charAt(0).toUpperCase()}
            </div>
            <div>
              <span className="text-sm font-black text-white tracking-tight">{name}</span>
              <p className="text-[10px] text-green-400 font-bold flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" /> Resident Member
              </p>
            </div>
          </div>

          {/* Audio & Video Calling Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                playTactileSound('click')
                setCallType('audio')
                setShowCallModal(true)
              }}
              className="p-2 sm:px-3 py-2 rounded-xl bg-white/5 hover:bg-gold-primary/20 border border-white/10 hover:border-gold-primary/40 text-gray-300 hover:text-white transition-all active:scale-95 flex items-center gap-1.5"
              title="Start Voice Call"
              aria-label="Start Voice Call"
            >
              <Phone size={15} className="text-gold-primary" />
              <span className="hidden sm:inline text-xs font-bold">Call</span>
            </button>

            <button
              onClick={() => {
                playTactileSound('click')
                setCallType('video')
                setShowCallModal(true)
              }}
              className="p-2 sm:px-3 py-2 rounded-xl bg-white/5 hover:bg-gold-primary/20 border border-white/10 hover:border-gold-primary/40 text-gray-300 hover:text-white transition-all active:scale-95 flex items-center gap-1.5"
              title="Start Video Call"
              aria-label="Start Video Call"
            >
              <Video size={15} className="text-gold-primary" />
              <span className="hidden sm:inline text-xs font-bold">Video</span>
            </button>
          </div>
        </div>

        {/* Message Log */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-3.5 custom-scrollbar">
          {messages.length === 0 && (
            <div className="text-center py-12 px-4 space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-gold-primary/10 border border-gold-primary/20 text-gold-primary mx-auto flex items-center justify-center shadow-lg shadow-gold-primary/10">
                <Sparkles size={22} />
              </div>
              <div>
                <p className="text-sm font-bold text-white tracking-tight">Direct Conversation with {name}</p>
                <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
                  Encrypted resident communications with voice, video, and live location sharing.
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-2 max-w-md mx-auto pt-2">
                {QUICK_PROMPTS.map((prompt, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      playTactileSound('tab')
                      setDraft(prompt.text)
                    }}
                    className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-gold-primary/20 border border-white/10 hover:border-gold-primary/40 text-[11px] font-semibold text-gray-300 hover:text-white transition-all active:scale-95 text-left"
                  >
                    <span>💬 {prompt.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map(m => {
            const isMe = m.sender_id === myId
            const isFindMeBeacon = m.body.startsWith('📍 [Find Me Beacon]')

            return (
              <div key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[75%] rounded-2xl px-4 py-3 text-xs leading-relaxed shadow-sm transition-all ${
                    isMe
                      ? 'bg-gradient-to-br from-gold-primary to-amber-500 text-black font-semibold rounded-br-xs shadow-glow'
                      : 'bg-white/5 backdrop-blur-xl border border-white/10 text-gray-100 rounded-bl-xs'
                  }`}
                >
                  {m.is_request && isMe && (
                    <span className="flex items-center gap-1 text-[9px] opacity-80 mb-1 uppercase font-black tracking-wider">
                      <Clock size={10} /> First Inquiry
                    </span>
                  )}

                  {isFindMeBeacon ? (
                    <div className="space-y-2.5">
                      <div className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider">
                        <Radar size={14} className={isMe ? 'text-black' : 'text-gold-primary'} />
                        <span>Find Me Radar Beacon</span>
                      </div>
                      <p className="text-xs opacity-90 leading-snug">
                        {m.body.replace('📍 [Find Me Beacon]', '').trim()}
                      </p>
                      <Link
                        href="/dashboard/community?tab=vibemap"
                        className={`inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider px-3 py-1.5 rounded-xl transition-all shadow-sm ${
                          isMe
                            ? 'bg-black/25 text-black hover:bg-black/35 border border-black/20'
                            : 'bg-black/70 hover:bg-black text-white border border-white/20 hover:border-gold-primary/50'
                        }`}
                      >
                        <MapPin size={11} className={isMe ? 'text-black' : 'text-gold-primary'} />
                        <span>Locate on VibeMap</span>
                        <ExternalLink size={10} />
                      </Link>
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap">{m.body}</p>
                  )}

                  <span className={`block text-[9px] mt-1 text-right font-medium ${isMe ? 'text-black/60' : 'text-gray-500'}`}>
                    {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            )
          })}
          <div ref={bottomRef} />
        </div>

        {error && <p className="text-[11px] text-red-400 px-5 pb-2">{error}</p>}

        {/* Message Composer with "Find Me" Location Button */}
        <div className="p-3.5 border-t border-white/10 bg-white/2">
          <div className="flex items-center gap-2 bg-black/60 backdrop-blur-2xl border border-white/15 focus-within:border-gold-primary/60 rounded-2xl px-3 py-1.5 transition-all shadow-inner">
            {/* 1-Tap Find Me Beacon */}
            <button
              type="button"
              onClick={handleSendFindMeBeacon}
              disabled={sendingLocation}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 hover:text-gold-primary transition-all shrink-0 active:scale-95 flex items-center gap-1"
              title="Share Live Location Beacon"
              aria-label="Share Live Location Beacon"
            >
              {sendingLocation ? (
                <Loader size={15} className="animate-spin text-gold-primary" />
              ) : (
                <MapPin size={15} className="text-gold-primary" />
              )}
              <span className="hidden sm:inline text-[10px] font-black uppercase text-gold-primary tracking-wider">
                Find Me
              </span>
            </button>

            <input
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') sendMessage() }}
              placeholder="Write a resident message..."
              className="flex-1 bg-transparent text-xs text-white placeholder:text-gray-500 outline-none p-2 font-medium"
            />
            <button
              onClick={() => sendMessage()}
              disabled={sending || !draft.trim()}
              className="bg-gold-primary hover:bg-gold-secondary text-black p-2.5 rounded-xl transition-all shadow-md disabled:opacity-40 shrink-0 active:scale-95"
              aria-label="Send message"
            >
              <Send size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Live Voice & Video Calling Screen / Floating Phone Widget */}
      <ActiveCallModal
        isOpen={showCallModal}
        onClose={() => setShowCallModal(false)}
        callType={callType}
        contact={{
          id: otherId,
          name,
          avatarUrl: otherProfile?.avatar_url,
          role: 'Verified Resident'
        }}
      />
    </div>
  )
}
