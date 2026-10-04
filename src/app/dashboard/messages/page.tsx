'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { useSelector } from 'react-redux'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  MessageCircle, Loader, Plus, Search,
  Phone, Video, ShieldCheck, X
} from 'lucide-react'
import { RootState } from '../../../store'
import { supabase } from '../../../utils/supabase'
import { playTactileSound } from '../../../utils/tactileSounds'
import EmptyState from '../components/shared/EmptyState'
import StartNewChatModal from '../components/messages/StartNewChatModal'
import ActiveCallModal, { type CallType } from '../components/messages/ActiveCallModal'

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

  // Modals and Search filters
  const [showNewChatModal, setShowNewChatModal] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState<'all' | 'requests' | 'chats'>('all')

  // Calling state
  const [showCallModal, setShowCallModal] = useState(false)
  const [callType, setCallType] = useState<CallType>('audio')
  const [callTarget, setCallTarget] = useState<{
    id: string
    name: string
    avatarUrl?: string | null
    role?: string
  } | null>(null)

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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount
    loadThreads()
  }, [loadThreads])

  const nameOf = (id: string) => {
    const p = profileMap[id]
    return p?.display_name || p?.username || 'Resident'
  }

  // Deep-link support (/dashboard/messages?to=<userId>)
  useEffect(() => {
    const to = searchParams.get('to')
    if (!to || !myId || to === myId) return
    router.replace(`/dashboard/messages/${to}`)
  }, [searchParams, myId, router])

  const isPendingRequest = (t: Thread) => t.lastMessage.recipient_id === myId && !!t.lastMessage.is_request

  const sorted = [...threads].sort(
    (a, b) => new Date(b.lastMessage.created_at).getTime() - new Date(a.lastMessage.created_at).getTime()
  )

  const filteredThreads = sorted.filter(t => {
    const contactName = nameOf(t.otherId).toLowerCase()
    const msgText = t.lastMessage.body.toLowerCase()
    const query = searchQuery.toLowerCase().trim()
    const matchesQuery = !query || contactName.includes(query) || msgText.includes(query)

    if (!matchesQuery) return false
    if (activeTab === 'requests') return isPendingRequest(t)
    if (activeTab === 'chats') return !isPendingRequest(t)
    return true
  })

  const requestsCount = sorted.filter(isPendingRequest).length
  const chatsCount = sorted.length - requestsCount

  const handleStartCall = (
    e: React.MouseEvent,
    target: { id: string; name: string; avatarUrl?: string | null; role?: string },
    type: CallType
  ) => {
    e.stopPropagation()
    playTactileSound('click')
    setCallTarget(target)
    setCallType(type)
    setShowCallModal(true)
  }

  const ThreadRow = ({ t }: { t: Thread }) => {
    const contactName = nameOf(t.otherId)
    const isRequest = isPendingRequest(t)
    const avatarUrl = profileMap[t.otherId]?.avatar_url

    return (
      <div
        role="button"
        tabIndex={0}
        onClick={() => {
          playTactileSound('click')
          router.push(`/dashboard/messages/${t.otherId}`)
        }}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            playTactileSound('click')
            router.push(`/dashboard/messages/${t.otherId}`)
          }
        }}
        className="w-full flex items-center justify-between gap-3 p-3.5 bg-black/60 backdrop-blur-2xl border border-white/10 hover:border-gold-primary/30 rounded-2xl transition-all text-left shadow-glass hover:shadow-glow group cursor-pointer"
      >
        <div className="flex items-center gap-3.5 min-w-0 flex-1">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-gold-primary/20 to-amber-500/10 border border-gold-primary/30 flex items-center justify-center text-gold-primary text-sm font-black overflow-hidden flex-shrink-0 group-hover:scale-105 transition-transform shadow-sm">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              contactName.charAt(0).toUpperCase()
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="text-sm font-bold text-white group-hover:text-gold-primary transition-colors truncate">
                {contactName}
              </p>
              <ShieldCheck size={13} className="text-gold-primary shrink-0 opacity-80" />
              {isRequest && (
                <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-gold-primary/20 text-gold-primary border border-gold-primary/30">
                  Inquiry
                </span>
              )}
            </div>
            <p className="text-xs text-gray-400 truncate mt-0.5 leading-relaxed">
              {t.lastMessage.body}
            </p>
          </div>
        </div>

        {/* Quick Call Action Buttons & Timestamp */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="hidden sm:flex items-center gap-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
            <button
              onClick={e =>
                handleStartCall(
                  e,
                  { id: t.otherId, name: contactName, avatarUrl, role: 'Verified Resident' },
                  'audio'
                )
              }
              className="p-2 rounded-xl bg-white/5 hover:bg-gold-primary/20 text-gray-300 hover:text-white border border-white/10 hover:border-gold-primary/40 transition-all active:scale-95"
              title="Quick Voice Call"
              aria-label={`Voice call ${contactName}`}
            >
              <Phone size={14} className="text-gold-primary" />
            </button>
            <button
              onClick={e =>
                handleStartCall(
                  e,
                  { id: t.otherId, name: contactName, avatarUrl, role: 'Verified Resident' },
                  'video'
                )
              }
              className="p-2 rounded-xl bg-white/5 hover:bg-gold-primary/20 text-gray-300 hover:text-white border border-white/10 hover:border-gold-primary/40 transition-all active:scale-95"
              title="Quick Video Call"
              aria-label={`Video call ${contactName}`}
            >
              <Video size={14} className="text-gold-primary" />
            </button>
          </div>
          <span className="text-[10px] text-gray-500 font-medium pl-1">
            {new Date(t.lastMessage.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6 pb-32">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-white/10">
        <div>
          <h2 className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-2.5">
            <MessageCircle size={22} className="text-gold-primary" /> Direct <span className="text-gold-primary">Messages</span>
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Encrypted resident-to-resident private communications, calls, and location radar.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              playTactileSound('click')
              setShowNewChatModal(true)
            }}
            className="px-4 py-2 rounded-2xl bg-gold-primary hover:bg-gold-secondary text-black font-black text-xs uppercase tracking-wider flex items-center gap-2 shadow-glow active:scale-95 transition-all"
          >
            <Plus size={16} />
            <span>Start New Chat</span>
          </button>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-center gap-3 justify-between">
        <div className="w-full sm:max-w-md flex items-center gap-2 bg-black/60 border border-white/15 focus-within:border-gold-primary/60 rounded-2xl px-3.5 py-2 transition-all shadow-inner">
          <Search size={15} className="text-gray-400 shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search conversations by name or message..."
            className="w-full bg-transparent text-xs text-white placeholder:text-gray-500 outline-none font-medium"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="text-gray-400 hover:text-white"
              aria-label="Clear search query"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Tab Filters */}
        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto no-scrollbar">
          {[
            { id: 'all', label: `All (${threads.length})` },
            { id: 'requests', label: `Inquiries (${requestsCount})` },
            { id: 'chats', label: `Chats (${chatsCount})` }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => {
                playTactileSound('tab')
                setActiveTab(tab.id as 'all' | 'requests' | 'chats')
              }}
              className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider shrink-0 transition-all border ${
                activeTab === tab.id
                  ? 'bg-gold-primary text-black border-gold-primary shadow-glow'
                  : 'bg-white/5 text-gray-400 border-white/10 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Conversation Thread List Stage */}
      {loading ? (
        <div className="py-16 text-center text-gray-400 flex flex-col items-center justify-center gap-3">
          <Loader size={20} className="animate-spin text-gold-primary" />
          <span className="text-xs font-semibold">Retrieving conversations…</span>
        </div>
      ) : error && threads.length === 0 ? (
        <p className="text-xs text-red-400 bg-red-500/10 p-3 rounded-2xl border border-red-500/20">{error}</p>
      ) : threads.length === 0 ? (
        <div className="space-y-4">
          <EmptyState
            icon={MessageCircle}
            title="No conversations yet"
            subtitle="Message a landlord, roommate or service pro to start communicating."
          />
          <div className="flex justify-center">
            <button
              onClick={() => {
                playTactileSound('click')
                setShowNewChatModal(true)
              }}
              className="px-5 py-2.5 rounded-2xl bg-gold-primary hover:bg-gold-secondary text-black font-black text-xs uppercase tracking-wider flex items-center gap-2 shadow-glow active:scale-95 transition-all"
            >
              <Plus size={16} />
              <span>Start Resident Chat</span>
            </button>
          </div>
        </div>
      ) : filteredThreads.length === 0 ? (
        <div className="py-12 text-center text-gray-400 space-y-2">
          <Search size={24} className="mx-auto text-gray-600" />
          <p className="text-xs font-bold text-gray-300">No conversations found</p>
          <p className="text-[10px] text-gray-500">Try changing your search terms or filter selection.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredThreads.map(t => (
            <ThreadRow key={t.otherId} t={t} />
          ))}
        </div>
      )}

      {/* Start New Resident Chat Directory Modal */}
      <StartNewChatModal
        isOpen={showNewChatModal}
        onClose={() => setShowNewChatModal(false)}
        currentUserId={myId}
      />

      {/* Active Voice & Video Calling Screen / Floating Phone Badge */}
      {callTarget && (
        <ActiveCallModal
          isOpen={showCallModal}
          onClose={() => {
            setShowCallModal(false)
            setCallTarget(null)
          }}
          callType={callType}
          contact={callTarget}
        />
      )}
    </div>
  )
}
