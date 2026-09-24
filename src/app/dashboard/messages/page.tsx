'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { useSelector } from 'react-redux'
import { useRouter, useSearchParams } from 'next/navigation'
import { MessageCircle, Loader, Clock } from 'lucide-react'
import { RootState } from '../../../store'
import { supabase } from '../../../utils/supabase'
import EmptyState from '../components/shared/EmptyState'

// DMs route through Gruvs' EXISTING shared `messages` table (CONTRACT.md §4):
// sender_id, recipient_id, body, message_type, is_request, created_at.
// This is deliberately NOT a Resident-owned table — a message sent here is
// the same message on The Gruvs. Realtime channel convention: dm_fast_<idA_idB>
// (ids sorted), per CONTRACT.md.
//
// The thread view itself lives at its own route (./[threadId]/page.tsx) —
// it used to be pure component state here (conditionally rendering the
// thread in place of the list, no URL change), which meant browser back/
// forward, refresh, and deep-linking into a specific conversation didn't
// work the way they do everywhere else in the app.

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
  const router = useRouter()
  const searchParams = useSearchParams()

  const [threads, setThreads] = useState<Thread[]>([])
  const [profileMap, setProfileMap] = useState<Record<string, ProfileHit>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount, not a render-loop risk
    loadThreads()
  }, [loadThreads])

  const nameOf = (id: string) => {
    const p = profileMap[id]
    return p?.display_name || p?.username || 'Resident'
  }

  // Deep-link support (/dashboard/messages?to=<userId>) — used by "Chat
  // Seller"-style buttons elsewhere in the app. Redirects straight into the
  // thread's own route rather than opening it as local state, so the
  // deep-link lands on a real, shareable/refreshable URL.
  useEffect(() => {
    const to = searchParams.get('to')
    if (!to || !myId || to === myId) return
    router.replace(`/dashboard/messages/${to}`)
  }, [searchParams, myId, router])

  // A thread counts as a pending request when the OTHER person messaged
  // first and I haven't replied yet — the last message is addressed to me
  // and is still flagged is_request. Once I reply, my own message becomes
  // the last one and the thread moves to Chats on its own, no separate
  // "mark as replied" state needed.
  const isPendingRequest = (t: Thread) => t.lastMessage.recipient_id === myId && !!t.lastMessage.is_request

  const sorted = [...threads].sort((a, b) => new Date(b.lastMessage.created_at).getTime() - new Date(a.lastMessage.created_at).getTime())
  const requests = sorted.filter(isPendingRequest)
  const chats = sorted.filter(t => !isPendingRequest(t))

  const ThreadRow = ({ t }: { t: Thread }) => (
    <button
      onClick={() => router.push(`/dashboard/messages/${t.otherId}`)}
      className="w-full flex items-center gap-3.5 p-3.5 bg-black/60 backdrop-blur-2xl border border-white/10 hover:border-gold-primary/30 rounded-2xl transition-all text-left shadow-glass hover:shadow-glow group"
    >
      <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-gold-primary/20 to-amber-500/10 border border-gold-primary/30 flex items-center justify-center text-gold-primary text-sm font-black overflow-hidden flex-shrink-0 group-hover:scale-105 transition-transform shadow-sm">
        {profileMap[t.otherId]?.avatar_url
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={profileMap[t.otherId].avatar_url as string} alt="" className="w-full h-full object-cover" />
          : nameOf(t.otherId).charAt(0).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-bold text-white group-hover:text-gold-primary transition-colors truncate">{nameOf(t.otherId)}</p>
          <span className="text-[10px] text-gray-500 flex-shrink-0 font-medium">{new Date(t.lastMessage.created_at).toLocaleDateString()}</span>
        </div>
        <p className="text-xs text-gray-400 truncate mt-0.5 leading-relaxed">{t.lastMessage.body}</p>
      </div>
    </button>
  )

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6 pb-32">
      <div className="flex items-center justify-between pb-2 border-b border-white/10">
        <div>
          <h2 className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-2.5">
            <MessageCircle size={22} className="text-gold-primary" /> Direct <span className="text-gold-primary">Messages</span>
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">Secure, resident-to-resident private communications.</p>
        </div>
        <span className="text-[10px] font-bold text-gray-400 bg-white/5 border border-white/10 px-2.5 py-1 rounded-full">
          {threads.length} conversations
        </span>
      </div>

      {loading ? (
        <div className="py-16 text-center text-gray-400 flex flex-col items-center justify-center gap-3">
          <Loader size={20} className="animate-spin text-gold-primary" />
          <span className="text-xs font-semibold">Retrieving conversations…</span>
        </div>
      ) : error && threads.length === 0 ? (
        <p className="text-xs text-red-400 bg-red-500/10 p-3 rounded-2xl border border-red-500/20">{error}</p>
      ) : threads.length === 0 ? (
        <EmptyState icon={MessageCircle} title="No conversations yet" subtitle="Message a landlord, driver or neighbour to start one." />
      ) : (
        <div className="space-y-6">
          {requests.length > 0 && (
            <div className="space-y-2.5">
              <h3 className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-gold-primary px-1">
                <Clock size={12} /> Pending Inquiries ({requests.length})
              </h3>
              {requests.map(t => <ThreadRow key={t.otherId} t={t} />)}
            </div>
          )}

          {chats.length > 0 && (
            <div className="space-y-2.5">
              {requests.length > 0 && (
                <h3 className="text-[10px] font-black uppercase tracking-wider text-gray-400 px-1">Active Chats</h3>
              )}
              {chats.map(t => <ThreadRow key={t.otherId} t={t} />)}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
