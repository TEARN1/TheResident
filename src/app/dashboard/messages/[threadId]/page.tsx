'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { useSelector } from 'react-redux'
import { useParams, useRouter } from 'next/navigation'
import { Send, ArrowLeft, Clock } from 'lucide-react'
import { RootState } from '../../../../store'
import { supabase } from '../../../../utils/supabase'

// One conversation, at its own URL — see the comment at the top of
// ../page.tsx for why this used to be pure component state instead.

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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount, not a render-loop risk
    loadThread()
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
  }, [loadThread])

  // Realtime, per the dm_fast_<idA_idB> convention (ids sorted).
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

  const sendMessage = async () => {
    if (!supabase || !myId || !otherId || !draft.trim()) return
    setSending(true)
    setError(null)
    const alreadyTalked = messages.length > 0
    const { error: sendError } = await supabase
      .from('messages')
      .insert({
        sender_id: myId,
        recipient_id: otherId,
        body: draft.trim(),
        is_request: !alreadyTalked
      })
    setSending(false)
    if (sendError) {
      setError(sendError.message)
      return
    }
    setDraft('')
    loadThread()
  }

  return (
    <div className="glass-panel p-0 flex flex-col h-[70vh]">
      <div className="flex items-center gap-3 p-4 border-b border-white/5">
        <button onClick={() => router.push('/dashboard/messages')} className="text-gray-400 hover:text-white" aria-label="Back to messages">
          <ArrowLeft size={18} />
        </button>
        <div className="w-8 h-8 rounded-full bg-gold-primary/10 flex items-center justify-center text-gold-primary text-xs font-black overflow-hidden">
          {otherProfile?.avatar_url
            ? <Image src={otherProfile.avatar_url} alt="" width={32} height={32} className="w-full h-full object-cover" />
            : name.charAt(0).toUpperCase()}
        </div>
        <span className="text-sm font-bold text-white">{name}</span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map(m => (
          <div key={m.id} className={`flex ${m.sender_id === myId ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[70%] rounded-xl px-3.5 py-2.5 text-xs ${m.sender_id === myId ? 'bg-gold-primary text-black font-medium' : 'bg-black/40 border border-white/5 text-gray-300'}`}>
              {m.is_request && m.sender_id === myId && (
                <span className="flex items-center gap-1 text-[9px] opacity-70 mb-1 uppercase font-bold tracking-widest"><Clock size={9} /> Request</span>
              )}
              <p className="whitespace-pre-wrap">{m.body}</p>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {error && <p className="text-[11px] text-red-400 px-4">{error}</p>}

      <div className="flex gap-2 p-4 border-t border-white/5">
        <input
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') sendMessage() }}
          placeholder="Type a message…"
          className="flex-1 bg-black border border-white/10 rounded-lg p-3 text-sm text-white outline-none focus:border-gold-primary/40"
        />
        <button
          onClick={sendMessage}
          disabled={sending || !draft.trim()}
          className="bg-gold-primary hover:bg-gold-secondary text-black font-black px-4 rounded-lg text-xs uppercase tracking-widest transition-all disabled:opacity-50"
        >
          <Send size={14} />
        </button>
      </div>
    </div>
  )
}
