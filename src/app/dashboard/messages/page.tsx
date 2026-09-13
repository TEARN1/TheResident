'use client'

import Avatar from '../../../components/ui/Avatar'
import { relativeTime } from '../../../utils/relativeTime'
import SkeletonList from '../../../components/ui/Skeleton'
import { useMinimumDuration } from '../../../utils/useMinimumDuration'
import React, { useCallback, useEffect, useState } from 'react'
import { withTimeout } from '@/utils/resilientCall'
import { useSelector } from 'react-redux'
import { useRouter, useSearchParams } from 'next/navigation'
import { MessageCircle, Clock } from 'lucide-react'
import { RootState, isGuestUser } from '../../../store'
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
  const isGuest = isGuestUser(currentUser)
  const router = useRouter()
  const searchParams = useSearchParams()

  const [threads, setThreads] = useState<Thread[]>([])
  const [profileMap, setProfileMap] = useState<Record<string, ProfileHit>>({})
  const [loading, setLoading] = useState(true)
  const showLoading = useMinimumDuration(loading)
  const [error, setError] = useState<string | null>(null)

  const loadThreads = useCallback(async () => {
    if (!supabase || !myId) { setLoading(false); return }
    setLoading(true)
    setError(null)
    // Everything below is inside try/finally because it was not, and the
    // consequence was a permanent spinner: if the request rejected — a
    // dropped connection, a DNS failure, anything that throws rather than
    // returning an error object — execution never reached setLoading(false)
    // at the end, and "Loading conversations…" stayed on screen forever with
    // no way out. Measured: still spinning after 4 seconds, and it would
    // have stayed that way indefinitely.
    //
    // This is the failure a resident on a bad connection actually gets, and
    // an infinite spinner is the worst possible answer to it — it looks like
    // the app is working right up until they close it.
    try {
    const { data, error: msgError } = await withTimeout(supabase
      .from('messages')
      .select('id, sender_id, recipient_id, body, is_request, created_at')
      .or(`sender_id.eq.${myId},recipient_id.eq.${myId}`)
      .order('created_at', { ascending: false })
      .limit(200), 15000, 'conversations')
    if (msgError) {
      setError(msgError.message)
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
      const { data: people } = await withTimeout(supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url')
        .in('id', otherIds), 15000, 'sender names')
      const map: Record<string, ProfileHit> = {}
      for (const p of people || []) map[String(p.id)] = p as ProfileHit
      setProfileMap(prev => ({ ...prev, ...map }))
    }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load your conversations.')
    } finally {
      setLoading(false)
    }
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

  // Item 141. Three things this row was missing, and the first is the one a
  // person notices:
  //
  //  * It showed a DATE — "13/09/2026" — for a message sent five minutes ago.
  //    A conversation list is read as a timeline, and a date destroys that.
  //  * It did not say who spoke last, so "Yes that works" read as though the
  //    other person had said it when you had.
  //  * It hand-rolled the avatar fallback, differently from every other screen.
  const ThreadRow = ({ t }: { t: Thread }) => {
    const mine = t.lastMessage.sender_id === myId
    const when = relativeTime(t.lastMessage.created_at)
    return (
      <button
        onClick={() => router.push(`/dashboard/messages/${t.otherId}`)}
        aria-label={`Conversation with ${nameOf(t.otherId)}, last message ${when}`}
        className="w-full min-h-[44px] flex items-center gap-3 p-3 bg-surface-sunken/40 border border-subtle rounded-xl hover:border-accent/20 motion-base transition-all text-left"
      >
        <Avatar src={profileMap[t.otherId]?.avatar_url as string | undefined} name={nameOf(t.otherId)} size="md" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-content truncate">{nameOf(t.otherId)}</p>
          <p className="text-xs text-content-muted truncate">
            {mine && <span className="text-content-subtle">You: </span>}
            {t.lastMessage.body}
          </p>
        </div>
        <span className="text-[10px] text-content-subtle flex-shrink-0 text-right">{when}</span>
      </button>
    )
  }

  return (
    <div className="glass-panel p-6">
      <div className="flex items-center gap-2 mb-6">
        <MessageCircle size={20} className="text-accent" />
        <h2 className="text-xl font-bold text-content">Messages</h2>
      </div>

      {showLoading ? (
        <SkeletonList rows={4} label="Loading conversations" />
      ) : error && threads.length === 0 ? (
        <div className="py-10 text-center space-y-3">
          <p className="text-sm font-bold text-content">Couldn&apos;t load your conversations</p>
          <p className="text-xs text-content-muted max-w-xs mx-auto">
            This is usually a connection problem rather than anything wrong with your account.
          </p>
          <button
            onClick={() => loadThreads()}
            className="min-h-tap inline-flex items-center gap-2 bg-accent text-content-on-accent font-bold px-5 rounded-xl text-xs uppercase tracking-widest"
          >
            Try again
          </button>
          <p className="text-xs text-content-subtle">{error}</p>
        </div>
      ) : isGuest ? (
        /* A guest cannot have conversations, so "No conversations yet" reads
           as though something is missing. Say what would change it. */
        <EmptyState
          icon={MessageCircle}
          title="Messaging needs an account"
          subtitle="Sign up free to message landlords, drivers and neighbours — and so they can reply to you."
        />
      ) : threads.length === 0 ? (
        <EmptyState icon={MessageCircle} title="No conversations yet" subtitle="Message a landlord, driver or neighbour to start one." />
      ) : (
        <div className="space-y-6">
          {/* A first DM is very often a stranger about a room or money —
              splitting requests from established chats makes deciding
              whether to engage a distinct step instead of something you'd
              only notice mid-scroll in one flat list. */}
          {requests.length > 0 && (
            <div className="space-y-2">
              <h3 className="flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-accent">
                <Clock size={11} /> Requests ({requests.length})
              </h3>
              {requests.map(t => <ThreadRow key={t.otherId} t={t} />)}
            </div>
          )}

          {chats.length > 0 && (
            <div className="space-y-2">
              {requests.length > 0 && (
                <h3 className="text-xs font-black uppercase tracking-widest text-content-muted">Chats</h3>
              )}
              {chats.map(t => <ThreadRow key={t.otherId} t={t} />)}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
