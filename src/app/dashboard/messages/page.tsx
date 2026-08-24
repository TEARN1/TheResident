'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useSelector } from 'react-redux'
import { useSearchParams } from 'next/navigation'
import { Send, MessageCircle, ArrowLeft, Loader, Clock } from 'lucide-react'
import { RootState } from '../../../store'
import { supabase } from '../../../utils/supabase'
import EmptyState from '../components/shared/EmptyState'

// DMs route through Gruvs' EXISTING shared `messages` table (CONTRACT.md §4):
// sender_id, recipient_id, body, message_type, is_request, created_at.
// This is deliberately NOT a Resident-owned table — a message sent here is
// the same message on The Gruvs. Realtime channel convention: dm_fast_<idA_idB>
// (ids sorted), per CONTRACT.md.

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

interface Thread {
  otherId: string
  lastMessage: DbMessage
}

export default function MessagesPage() {
  const currentUser = useSelector((state: RootState) => state.auth.currentUser)
  const myId = currentUser?.id
  const searchParams = useSearchParams()

  const [threads, setThreads] = useState<Thread[]>([])
  const [profileMap, setProfileMap] = useState<Record<string, ProfileHit>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [activeThread, setActiveThread] = useState<string | null>(null)
  const [threadMessages, setThreadMessages] = useState<DbMessage[]>([])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const loadThreads = useCallback(async () => {
    if (!supabase || !myId) { setLoading(false); return }
    setLoading(true)
    const { data, error: msgError } = await supabase
      .from('messages')
      .select('id, sender_id, recipient_id, body, is_request, created_at')
      .or(`sender_id.eq.${myId},recipient_id.eq.${myId}`)
      .order('created_at', { ascending: false })
      .limit(200)
    if (msgError) {
      setError(msgError.message)
      setLoading(false)
      return
    }
    const rows = (data || []) as DbMessage[]
    const byOther = new Map<string, DbMessage>()
    for (const m of rows) {
      const otherId = m.sender_id === myId ? m.recipient_id : m.sender_id
      if (!byOther.has(otherId)) byOther.set(otherId, m)
    }
    const threadList = [...byOther.entries()].map(([otherId, lastMessage]) => ({ otherId, lastMessage }))
    setThreads(threadList)

    const otherIds = threadList.map(t => t.otherId)
    if (otherIds.length > 0) {
      const { data: people } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url')
        .in('id', otherIds)
      const map: Record<string, ProfileHit> = {}
      for (const p of people || []) map[String(p.id)] = p as ProfileHit
      setProfileMap(prev => ({ ...prev, ...map }))
    }
    setLoading(false)
  }, [myId])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadThreads()
  }, [loadThreads])

  const nameOf = (id: string) => {
    const p = profileMap[id]
    return p?.display_name || p?.username || 'Resident'
  }

  // Deep-link support (/dashboard/messages?to=<userId>) — used by "Chat
  // Seller"-style buttons elsewhere in the app that previously had nowhere
  // to send someone, since there was no way to open a specific person's
  // thread without it already existing in the list.
  useEffect(() => {
    const to = searchParams.get('to')
    if (!to || !supabase || !myId || to === myId) return
    setActiveThread(to)
    if (!profileMap[to]) {
      supabase.from('profiles').select('id, username, display_name, avatar_url').eq('id', to).maybeSingle()
        .then(({ data }) => { if (data) setProfileMap(prev => ({ ...prev, [to]: data as ProfileHit })) })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, myId])

  const loadThread = useCallback(async (otherId: string) => {
    if (!supabase || !myId) return
    const { data } = await supabase
      .from('messages')
      .select('id, sender_id, recipient_id, body, is_request, created_at')
      .or(`and(sender_id.eq.${myId},recipient_id.eq.${otherId}),and(sender_id.eq.${otherId},recipient_id.eq.${myId})`)
      .order('created_at', { ascending: true })
    setThreadMessages((data || []) as DbMessage[])
  }, [myId])

  useEffect(() => {
    if (!activeThread) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadThread(activeThread)
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
  }, [activeThread, loadThread])

  // Realtime, per the dm_fast_<idA_idB> convention (ids sorted).
  useEffect(() => {
    if (!supabase || !myId || !activeThread) return
    const sorted = [myId, activeThread].sort()
    const channelName = `dm_fast_${sorted[0]}_${sorted[1]}`
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `sender_id=eq.${activeThread}` },
        () => { loadThread(activeThread); loadThreads() }
      )
      .subscribe()
    return () => { supabase!.removeChannel(channel) }
  }, [myId, activeThread, loadThread, loadThreads])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [threadMessages])

  const sendMessage = async () => {
    if (!supabase || !myId || !activeThread || !draft.trim()) return
    setSending(true)
    setError(null)
    const alreadyTalked = threadMessages.length > 0
    const { error: sendError } = await supabase
      .from('messages')
      .insert({
        sender_id: myId,
        recipient_id: activeThread,
        body: draft.trim(),
        is_request: !alreadyTalked
      })
    setSending(false)
    if (sendError) {
      setError(sendError.message)
      return
    }
    setDraft('')
    loadThread(activeThread)
    loadThreads()
  }

  if (activeThread) {
    return (
      <div className="glass-panel p-0 flex flex-col h-[70vh]">
        <div className="flex items-center gap-3 p-4 border-b border-white/5">
          <button onClick={() => setActiveThread(null)} className="text-gray-400 hover:text-white">
            <ArrowLeft size={18} />
          </button>
          <div className="w-8 h-8 rounded-full bg-gold-primary/10 flex items-center justify-center text-gold-primary text-xs font-black">
            {nameOf(activeThread).charAt(0).toUpperCase()}
          </div>
          <span className="text-sm font-bold text-white">{nameOf(activeThread)}</span>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {threadMessages.map(m => (
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

  return (
    <div className="glass-panel p-6">
      <div className="flex items-center gap-2 mb-6">
        <MessageCircle size={20} className="text-gold-primary" />
        <h2 className="text-xl font-bold text-white">Messages</h2>
      </div>

      {loading ? (
        <div className="py-12 text-center text-gray-500 flex items-center justify-center gap-2">
          <Loader size={16} className="animate-spin" /> Loading conversations…
        </div>
      ) : error && threads.length === 0 ? (
        <p className="text-[11px] text-red-400">{error}</p>
      ) : threads.length === 0 ? (
        <EmptyState icon={MessageCircle} title="No conversations yet" subtitle="Message a landlord, driver or neighbour to start one." />
      ) : (
        <div className="space-y-2">
          {threads
            .sort((a, b) => new Date(b.lastMessage.created_at).getTime() - new Date(a.lastMessage.created_at).getTime())
            .map(t => (
              <button
                key={t.otherId}
                onClick={() => setActiveThread(t.otherId)}
                className="w-full flex items-center gap-3 p-3 bg-black/40 border border-white/5 rounded-xl hover:border-gold-primary/20 transition-all text-left"
              >
                <div className="w-9 h-9 rounded-full bg-gold-primary/10 flex items-center justify-center text-gold-primary text-xs font-black overflow-hidden flex-shrink-0">
                  {profileMap[t.otherId]?.avatar_url
                    ? <img src={profileMap[t.otherId].avatar_url as string} alt="" className="w-full h-full object-cover" />
                    : nameOf(t.otherId).charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-white">{nameOf(t.otherId)}</p>
                  <p className="text-xs text-gray-500 truncate">{t.lastMessage.body}</p>
                </div>
                <span className="text-[10px] text-gray-600 flex-shrink-0">{new Date(t.lastMessage.created_at).toLocaleDateString()}</span>
              </button>
            ))}
        </div>
      )}
    </div>
  )
}
