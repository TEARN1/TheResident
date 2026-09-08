'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { useSelector } from 'react-redux'
import { ShieldCheck, Search, UserPlus, Check, Users, Info, Loader, Link2, Copy } from 'lucide-react'
import { RootState } from '../../../store'
import { supabase } from '../../../utils/supabase'
import BlockUserButton from '../components/trust-safety/BlockUserButton'
import {
  COMMON_RELATIONSHIPS, createKinVerificationLink, fetchMyKinLinks, kinLinkStatusLabel,
  verifyKinLinkUrl, type KinVerificationLink
} from '../../../utils/kinVerification'

// Next of Kin — a SEPARATE, safety-oriented graph from "Follow"
// (src/utils/social.ts). Built entirely on res_trust_connections via explicit
// request+confirm RPCs; must never read/write follows or mutual_follows —
// blending the two would let mutual-follow-farming fake a circle.
//
// Deliberately framed as pure safety, not a marketplace gate: res_trust_gate
// now returns only a coarse status ('new'|'building'|'established') and
// 'unlocked', never the raw connection counts. Showing an exact "3 of 5"
// scoreboard would hand a scammer a visible target to farm (five people
// ring-confirming each other satisfies a raw count without any real
// vouching). The real 2-hop graph check still runs server-side — this is
// hardening on top of that, not a replacement for it.

interface TrustGate {
  status: 'new' | 'building' | 'established'
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

  // Kin verification links — for the person who isn't a Resident user at
  // all, so the in-app request/confirm flow above can't reach them.
  const [kinLinks, setKinLinks] = useState<KinVerificationLink[]>([])
  const [kinLinksLoading, setKinLinksLoading] = useState(true)
  const [claimedName, setClaimedName] = useState('')
  const [relationship, setRelationship] = useState<string>(COMMON_RELATIONSHIPS[0])
  const [creatingLink, setCreatingLink] = useState(false)
  const [kinError, setKinError] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const loadKinLinks = useCallback(async () => {
    setKinLinksLoading(true)
    const links = await fetchMyKinLinks()
    setKinLinks(links)
    setKinLinksLoading(false)
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadKinLinks()
  }, [loadKinLinks])

  const handleCreateKinLink = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!claimedName.trim()) return
    setCreatingLink(true)
    setKinError(null)
    try {
      await createKinVerificationLink(claimedName.trim(), relationship)
      setClaimedName('')
      await loadKinLinks()
    } catch (err) {
      setKinError(err instanceof Error ? err.message : 'Could not create the link.')
    } finally {
      setCreatingLink(false)
    }
  }

  const copyLink = async (link: KinVerificationLink) => {
    const url = verifyKinLinkUrl(link.token, window.location.origin)
    try {
      await navigator.clipboard.writeText(url)
      setCopiedId(link.id)
      setTimeout(() => setCopiedId(null), 2000)
    } catch {
      setKinError('Could not copy — long-press the link to copy it manually.')
    }
  }

  const loadGate = useCallback(async () => {
    if (!supabase || !myId) { setGateLoading(false); return }
    setGateLoading(true)
    // try/finally so the loading flag resolves on EVERY path. Without it a
    // rejected request skipped the setter at the end of the function and the
    // spinner stayed on screen for the rest of the session — see the Messages
    // page, where that was measured.
    try {
      const { data, error: rpcError } = await supabase.rpc('res_trust_gate')
      if (!rpcError && data) {
        setGate(data as TrustGate)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setGateLoading(false)
    }
  }, [myId])

  const loadConnections = useCallback(async () => {
    if (!supabase || !myId) { setRowsLoading(false); return }
    setRowsLoading(true)
    // try/finally so the loading flag resolves on EVERY path. Without it a
    // rejected request skipped the setter at the end of the function and the
    // spinner stayed on screen for the rest of the session — see the Messages
    // page, where that was measured.
    try {
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
    } catch (err) {
      console.error(err)
    } finally {
      setRowsLoading(false)
    }
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

  const status = gate?.status ?? 'new'
  const unlocked = gate?.unlocked ?? false
  const STAGE_INDEX: Record<TrustGate['status'], number> = { new: 0, building: 1, established: 2 }
  const STAGE_LABEL: Record<TrustGate['status'], string> = {
    new: 'Just getting started',
    building: 'Building your circle',
    established: 'Established'
  }

  return (
    <div className="space-y-6">
      <div className="glass-panel p-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="p-2.5 bg-accent/10 rounded-xl">
            <ShieldCheck size={22} className="text-accent" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-content">Next of Kin</h2>
            <p className="text-xs text-content-muted mt-1 leading-relaxed">
              People to notify if something happens to you. It only grows when
              someone you trust explicitly requests and confirms a connection
              with you — separate from &quot;Follow&quot;, and never built from
              your Gruvs follows or mutual connections.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-2 bg-info/5 border border-info/20 rounded-lg p-3 mb-6">
          <Info size={14} className="text-info mt-0.5 flex-shrink-0" />
          <p className="text-xs text-content-muted leading-relaxed">
            A real, established circle also quietly strengthens your standing
            in trusted community features — no need to track exact numbers,
            just keep confirming people who&apos;d genuinely vouch for you.
          </p>
        </div>

        {gateLoading ? (
          <div className="flex items-center gap-2 text-content-muted text-xs">
            <Loader size={14} className="animate-spin" /> Loading your status…
          </div>
        ) : (
          <div className="bg-surface-sunken/40 border border-subtle rounded-xl p-5 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-content uppercase tracking-widest">
                {STAGE_LABEL[status]}
              </span>
              <span className={`text-xs font-black uppercase tracking-widest px-2 py-1 rounded ${unlocked ? 'bg-success/10 text-success border border-success/20' : 'bg-accent/10 text-accent border border-accent/20'}`}>
                {unlocked ? 'Established' : 'Growing'}
              </span>
            </div>
            <div className="flex gap-1.5">
              {(['new', 'building', 'established'] as const).map((stage, i) => (
                <div
                  key={stage}
                  className={`h-1.5 flex-1 rounded-full border border-subtle transition-all duration-700 ${i <= STAGE_INDEX[status] ? 'bg-accent' : 'bg-surface-raised'}`}
                />
              ))}
            </div>
            <p className="text-xs text-content-muted">
              {unlocked
                ? 'Your circle is established — trusted features like one-click move-assist are unlocked.'
                : 'Keep confirming people who would genuinely vouch for you — your circle grows quietly in the background.'}
            </p>
          </div>
        )}

        {error && (
          <p className="text-xs text-danger mt-3">{error}</p>
        )}
      </div>

      <div className="glass-panel p-6">
        <h3 className="text-sm font-bold text-content uppercase tracking-widest mb-4 flex items-center gap-2">
          <Search size={16} className="text-accent" /> Find a resident
        </h3>
        <input
          value={query}
          onChange={e => runSearch(e.target.value)}
          placeholder="Search by username or display name…"
          className="w-full bg-surface border border-default rounded-lg p-3 text-sm text-content outline-none focus:border-accent/40"
        />
        {searching && <p className="text-xs text-content-muted mt-2">Searching…</p>}
        {results.length > 0 && (
          <div className="mt-4 space-y-2">
            {results.map(p => (
              <div key={p.id} className="flex items-center justify-between p-3 bg-surface-sunken/40 border border-subtle rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center text-accent text-xs font-black overflow-hidden">
                    {p.avatar_url ? <img src={p.avatar_url} alt="" className="w-full h-full object-cover" /> : (p.display_name || p.username || '?').charAt(0).toUpperCase()}
                  </div>
                  <span className="text-sm text-content font-medium">{p.display_name || p.username}</span>
                  {p.is_verified && <ShieldCheck size={12} className="text-accent" />}
                </div>
                <button
                  onClick={() => sendRequest(p.id)}
                  disabled={!!sentTo[p.id]}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest bg-accent/10 text-accent border border-accent/20 hover:bg-accent hover:text-content-on-accent transition-all disabled:opacity-50"
                >
                  {sentTo[p.id] ? <><Check size={12} /> Sent</> : <><UserPlus size={12} /> Request</>}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="glass-panel p-6">
        <h3 className="text-sm font-bold text-content uppercase tracking-widest mb-1 flex items-center gap-2">
          <Link2 size={16} className="text-accent" /> Verify someone who isn&apos;t on the app
        </h3>
        <p className="text-xs text-content-muted mb-4 leading-relaxed">
          Not everyone you&apos;d list as next of kin has Resident — a parent, a sibling. Create a link, send it to them yourself (WhatsApp, SMS, however), and they answer one question with no account needed: is this really your {relationship.toLowerCase()}?
        </p>

        <form onSubmit={handleCreateKinLink} className="flex flex-col sm:flex-row gap-2 mb-4">
          <input
            value={claimedName}
            onChange={e => setClaimedName(e.target.value)}
            placeholder="Their name, e.g. Sipho Dlamini"
            required
            className="flex-1 bg-surface border border-default rounded-lg p-3 text-sm text-content outline-none focus:border-accent/40"
          />
          <select
            value={relationship}
            onChange={e => setRelationship(e.target.value)}
            className="bg-surface border border-default rounded-lg p-3 text-sm text-content outline-none focus:border-accent/40"
          >
            {COMMON_RELATIONSHIPS.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <button
            type="submit"
            disabled={creatingLink || !claimedName.trim()}
            className="flex items-center justify-center gap-1.5 px-4 py-3 rounded-lg text-xs font-black uppercase tracking-widest bg-accent text-content-on-accent hover:bg-accent transition-all disabled:opacity-50"
          >
            {creatingLink ? 'Creating…' : 'Create link'}
          </button>
        </form>
        {kinError && <p className="text-xs text-danger mb-3">{kinError}</p>}

        {kinLinksLoading ? (
          <p className="text-xs text-content-muted">Loading…</p>
        ) : kinLinks.length === 0 ? (
          <p className="text-xs text-content-muted italic">No verification links yet.</p>
        ) : (
          <div className="space-y-2">
            {kinLinks.map(link => (
              <div key={link.id} className="flex items-center justify-between gap-3 p-3 bg-surface-sunken/40 border border-subtle rounded-lg">
                <div className="min-w-0">
                  <p className="text-sm text-content font-medium truncate">{link.claimedName} <span className="text-content-muted">· {link.claimedRelationship}</span></p>
                  <p className={`text-xs font-bold uppercase tracking-widest ${link.status === 'confirmed' ? 'text-success' : link.status === 'denied' ? 'text-danger' : 'text-content-muted'}`}>
                    {kinLinkStatusLabel(link.status)}
                  </p>
                </div>
                {link.status === 'pending' && (
                  <button
                    onClick={() => copyLink(link)}
                    className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest bg-surface-raised/5 text-content border border-default hover:bg-surface-raised/10 transition-all"
                  >
                    {copiedId === link.id ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy link</>}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="glass-panel p-6">
        <h3 className="text-sm font-bold text-content uppercase tracking-widest mb-4 flex items-center gap-2">
          <Users size={16} className="text-accent" /> Pending requests
        </h3>
        {rowsLoading ? (
          <p className="text-xs text-content-muted">Loading…</p>
        ) : incoming.length === 0 ? (
          <p className="text-xs text-content-muted italic">No pending requests.</p>
        ) : (
          <div className="space-y-2">
            {incoming.map(row => (
              <div key={row.id} className="flex items-center justify-between p-3 bg-surface-sunken/40 border border-subtle rounded-lg">
                <span className="text-sm text-content font-medium">{nameOf(row.requester_id)}</span>
                <button
                  onClick={() => confirmRequest(row.requester_id)}
                  disabled={!!confirming[row.requester_id]}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest bg-accent text-content-on-accent hover:bg-accent transition-all disabled:opacity-50"
                >
                  <Check size={12} /> Confirm
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="glass-panel p-6">
        <h3 className="text-sm font-bold text-content uppercase tracking-widest mb-4 flex items-center gap-2">
          <ShieldCheck size={16} className="text-accent" /> Confirmed connections
        </h3>
        {rowsLoading ? (
          <p className="text-xs text-content-muted">Loading…</p>
        ) : confirmed.length === 0 ? (
          <p className="text-xs text-content-muted italic">No confirmed connections yet.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {confirmed.map(row => {
              const otherId = row.requester_id === myId ? row.connection_id : row.requester_id
              return (
                <div key={row.id} className="flex items-center justify-between p-3 bg-surface-sunken/40 border border-subtle rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center text-accent text-xs font-black">
                      {nameOf(otherId).charAt(0).toUpperCase()}
                    </div>
                    <span className="text-sm text-content font-medium">{nameOf(otherId)}</span>
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
