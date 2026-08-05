'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { useSelector } from 'react-redux'
import { ShieldCheck, Search, UserPlus, Check, Users, Info, Loader } from 'lucide-react'
import { RootState } from '../../../store'
import { supabase } from '../../../utils/supabase'
import BlockUserButton from '../components/BlockUserButton'

// The next-of-kin trust circle — a SEPARATE, safety-oriented graph from
// "Follow" (src/utils/social.ts). It is built entirely on res_trust_connections
// via explicit request+confirm RPCs and must never read/write follows or
// mutual_follows: blending the two would let mutual-follow-farming fake a
// trust circle, undermining its whole anti-scam purpose.

interface TrustGate {
  direct_connections: number
  qualified_connections: number
  unlocked: boolean
}

interface ProfileHit {
  id: string
  username: string | null
  display_name: string | null
  avatar_url: string | null
  is_verified: boolean | null
}

interface ConnectionRow {
  id: string
  requester_id: string
  connection_id: string
  status: 'pending' | 'confirmed'
  created_at: string
  confirmed_at: string | null
}

export default function TrustCirclePage() {
  const currentUser = useSelector((state: RootState) => state.auth.currentUser)
  const myId = currentUser?.id

  const [gate, setGate] = useState<TrustGate | null>(null)
  const [gateLoading, setGateLoading] = useState(true)

  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ProfileHit[]>([])
  const [searching, setSearching] = useState(false)
  const [sentTo, setSentTo] = useState<Record<string, boolean>>({})

  const [incoming, setIncoming] = useState<ConnectionRow[]>([])
  const [confirmed, setConfirmed] = useState<ConnectionRow[]>([])
  const [profileMap, setProfileMap] = useState<Record<string, ProfileHit>>({})
  const [rowsLoading, setRowsLoading] = useState(true)
  const [confirming, setConfirming] = useState<Record<string, boolean>>({})
  const [error, setError] = useState<string | null>(null)

  const loadGate = useCallback(async () => {
    if (!supabase || !myId) return
    setGateLoading(true)
    const { data, error: rpcError } = await supabase.rpc('res_trust_gate')
    if (!rpcError && data) {
      setGate(data as TrustGate)
    }
    setGateLoading(false)
  }, [myId])

  const loadConnections = useCallback(async () => {
    if (!supabase || !myId) return
    setRowsLoading(true)
    const { data, error: rowsError } = await supabase
      .from('res_trust_connections')
      .select('id, requester_id, connection_id, status, created_at, confirmed_at')
      .or(`requester_id.eq.${myId},connection_id.eq.${myId}`)
    if (rowsError) {
      setRowsLoading(false)
      return
    }
    const rows = (data || []) as ConnectionRow[]
    const incomingPending = rows.filter(r => r.status === 'pending' && r.connection_id === myId)
    const confirmedRows = rows.filter(r => r.status === 'confirmed')
    setIncoming(incomingPending)
    setConfirmed(confirmedRows)

    const otherIds = [...new Set(
      [...incomingPending, ...confirmedRows].map(r => (r.requester_id === myId ? r.connection_id : r.requester_id))
    )]
    if (otherIds.length > 0) {
      const { data: people } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url, is_verified')
        .in('id', otherIds)
      const map: Record<string, ProfileHit> = {}
      for (const p of people || []) map[String(p.id)] = p as ProfileHit
      setProfileMap(prev => ({ ...prev, ...map }))
    }
    setRowsLoading(false)
  }, [myId])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadGate()
  }, [loadGate])
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadConnections()
  }, [loadConnections])

  const runSearch = async (q: string) => {
    setQuery(q)
    if (!supabase || q.trim().length < 2) {
      setResults([])
      return
    }
    setSearching(true)
    const { data } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, is_verified')
      .or(`username.ilike.%${q.trim()}%,display_name.ilike.%${q.trim()}%`)
      .limit(10)
    setResults(((data || []) as ProfileHit[]).filter(p => p.id !== myId))
    setSearching(false)
  }

  const sendRequest = async (targetId: string) => {
    if (!supabase) return
    setError(null)
    const { error: rpcError } = await supabase.rpc('res_request_trust_connection', { p_connection: targetId })
    if (rpcError) {
      setError(rpcError.message)
      return
    }
    setSentTo(prev => ({ ...prev, [targetId]: true }))
  }

  const confirmRequest = async (requesterId: string) => {
    if (!supabase) return
    setConfirming(prev => ({ ...prev, [requesterId]: true }))
    setError(null)
    const { error: rpcError } = await supabase.rpc('res_confirm_trust_connection', { p_requester: requesterId })
    if (rpcError) {
      setError(rpcError.message)
    } else {
      await Promise.all([loadConnections(), loadGate()])
    }
    setConfirming(prev => ({ ...prev, [requesterId]: false }))
  }

  const nameOf = (id: string) => {
    const p = profileMap[id]
    return p?.display_name || p?.username || 'Resident'
  }

  const direct = gate?.direct_connections ?? 0
  const qualified = gate?.qualified_connections ?? 0
  const unlocked = gate?.unlocked ?? false
  const connectionsNeeded = Math.max(0, 5 - direct)

  return (
    <div className="space-y-6">
      <div className="glass-panel p-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="p-2.5 bg-gold-primary/10 rounded-xl">
            <ShieldCheck size={22} className="text-gold-primary" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Next-of-Kin Trust Circle</h2>
            <p className="text-xs text-gray-500 mt-1 leading-relaxed">
              This is a separate, safety-oriented circle — not the same as
              &quot;Follow&quot;. It only grows when someone you trust explicitly
              requests and confirms a connection with you, so it can&apos;t be
              gamed by mutual-follow farming.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-2 bg-blue-500/5 border border-blue-500/20 rounded-lg p-3 mb-6">
          <Info size={14} className="text-blue-400 mt-0.5 flex-shrink-0" />
          <p className="text-[11px] text-gray-400 leading-relaxed">
            Connections here are used only to unlock trusted marketplace features
            (like one-click move-assist). They never draw from or feed into your
            Gruvs follows.
          </p>
        </div>

        {gateLoading ? (
          <div className="flex items-center gap-2 text-gray-500 text-xs">
            <Loader size={14} className="animate-spin" /> Loading your status…
          </div>
        ) : (
          <div className="bg-black/40 border border-white/5 rounded-xl p-5 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-white uppercase tracking-widest">
                {unlocked ? 'Trusted marketplace unlocked' : `${direct} of 5 connections`}
              </span>
              <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded ${unlocked ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-gold-primary/10 text-gold-primary border border-gold-primary/20'}`}>
                {unlocked ? 'Unlocked' : 'Locked'}
              </span>
            </div>
            <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden border border-white/5">
              <div
                className="h-full bg-gold-primary transition-all duration-700"
                style={{ width: `${Math.min(100, (direct / 5) * 100)}%` }}
              />
            </div>
            <p className="text-[11px] text-gray-500">
              {unlocked
                ? `You have ${direct} confirmed connections, ${qualified} of them well-connected themselves — trusted features like one-click move-assist are unlocked.`
                : connectionsNeeded > 0
                  ? `Build ${connectionsNeeded} more confirmed connection${connectionsNeeded === 1 ? '' : 's'} to unlock trusted marketplace features like one-click move-assist.`
                  : `You have 5+ connections — need ${Math.max(0, 3 - qualified)} more of them to be well-connected themselves (5+ connections each).`}
            </p>
          </div>
        )}

        {error && (
          <p className="text-[11px] text-red-400 mt-3">{error}</p>
        )}
      </div>

      <div className="glass-panel p-6">
        <h3 className="text-sm font-bold text-white uppercase tracking-widest mb-4 flex items-center gap-2">
          <Search size={16} className="text-gold-primary" /> Find a resident
        </h3>
        <input
          value={query}
          onChange={e => runSearch(e.target.value)}
          placeholder="Search by username or display name…"
          className="w-full bg-black border border-white/10 rounded-lg p-3 text-sm text-white outline-none focus:border-gold-primary/40"
        />
        {searching && <p className="text-[11px] text-gray-500 mt-2">Searching…</p>}
        {results.length > 0 && (
          <div className="mt-4 space-y-2">
            {results.map(p => (
              <div key={p.id} className="flex items-center justify-between p-3 bg-black/40 border border-white/5 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gold-primary/10 flex items-center justify-center text-gold-primary text-xs font-black overflow-hidden">
                    {p.avatar_url ? <img src={p.avatar_url} alt="" className="w-full h-full object-cover" /> : (p.display_name || p.username || '?').charAt(0).toUpperCase()}
                  </div>
                  <span className="text-sm text-white font-medium">{p.display_name || p.username}</span>
                  {p.is_verified && <ShieldCheck size={12} className="text-gold-primary" />}
                </div>
                <button
                  onClick={() => sendRequest(p.id)}
                  disabled={!!sentTo[p.id]}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest bg-gold-primary/10 text-gold-primary border border-gold-primary/20 hover:bg-gold-primary hover:text-black transition-all disabled:opacity-50"
                >
                  {sentTo[p.id] ? <><Check size={12} /> Sent</> : <><UserPlus size={12} /> Request</>}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="glass-panel p-6">
        <h3 className="text-sm font-bold text-white uppercase tracking-widest mb-4 flex items-center gap-2">
          <Users size={16} className="text-gold-primary" /> Pending requests
        </h3>
        {rowsLoading ? (
          <p className="text-[11px] text-gray-500">Loading…</p>
        ) : incoming.length === 0 ? (
          <p className="text-[11px] text-gray-500 italic">No pending requests.</p>
        ) : (
          <div className="space-y-2">
            {incoming.map(row => (
              <div key={row.id} className="flex items-center justify-between p-3 bg-black/40 border border-white/5 rounded-lg">
                <span className="text-sm text-white font-medium">{nameOf(row.requester_id)}</span>
                <button
                  onClick={() => confirmRequest(row.requester_id)}
                  disabled={!!confirming[row.requester_id]}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest bg-gold-primary text-black hover:bg-gold-secondary transition-all disabled:opacity-50"
                >
                  <Check size={12} /> Confirm
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="glass-panel p-6">
        <h3 className="text-sm font-bold text-white uppercase tracking-widest mb-4 flex items-center gap-2">
          <ShieldCheck size={16} className="text-gold-primary" /> Confirmed connections
        </h3>
        {rowsLoading ? (
          <p className="text-[11px] text-gray-500">Loading…</p>
        ) : confirmed.length === 0 ? (
          <p className="text-[11px] text-gray-500 italic">No confirmed connections yet.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {confirmed.map(row => {
              const otherId = row.requester_id === myId ? row.connection_id : row.requester_id
              return (
                <div key={row.id} className="flex items-center justify-between p-3 bg-black/40 border border-white/5 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gold-primary/10 flex items-center justify-center text-gold-primary text-xs font-black">
                      {nameOf(otherId).charAt(0).toUpperCase()}
                    </div>
                    <span className="text-sm text-white font-medium">{nameOf(otherId)}</span>
                  </div>
                  <BlockUserButton targetUserId={otherId} />
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
