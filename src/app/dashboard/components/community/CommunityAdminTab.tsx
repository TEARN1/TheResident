'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { ShieldCheck, KeyRound, Copy, Check, Users, ArrowUp, ArrowDown, UserMinus, ScrollText } from 'lucide-react'
import { supabase } from '../../../../utils/supabase'
import { humanizeDbError } from '../../../../store/actions'

interface AdminCommunity {
  id: string
  name: string
}

interface Member {
  userId: string
  name: string
  role: string
}

interface ModerationEntry {
  id: string
  action: string
  subjectType: string
  actorName: string
  reason: string | null
  createdAt: string
}

interface CommunityAdminTabProps {
  currentUserId: string
  myCommunities: AdminCommunity[]
}

/**
 * Private invites + moderation, scoped to one community at a time. Anyone in
 * myCommunities can redeem-invite-for-others via the code box; admin/founder
 * controls (generate invite, member moderation) only render once role is
 * confirmed for the selected community, matching res_moderate's own gate.
 */
export default function CommunityAdminTab({ currentUserId, myCommunities }: CommunityAdminTabProps) {
  const [selectedId, setSelectedId] = useState<string>(myCommunities[0]?.id || '')
  const [role, setRole] = useState<string | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [actions, setActions] = useState<ModerationEntry[]>([])
  const [loading, setLoading] = useState(false)

  const [inviteCode, setInviteCode] = useState<string | null>(null)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [generating, setGenerating] = useState(false)

  const [redeemInput, setRedeemInput] = useState('')
  const [redeemStatus, setRedeemStatus] = useState<string | null>(null)
  const [redeeming, setRedeeming] = useState(false)
  const [moderateError, setModerateError] = useState<string | null>(null)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!selectedId && myCommunities[0]) setSelectedId(myCommunities[0].id)
  }, [myCommunities, selectedId])

  const isAdmin = role === 'admin' || role === 'founder'

  const load = useCallback(async () => {
    if (!supabase || !selectedId || !currentUserId) return
    setLoading(true)

    const { data: myRow } = await supabase
      .from('res_community_members')
      .select('role')
      .eq('community_id', selectedId)
      .eq('user_id', currentUserId)
      .maybeSingle()
    const myRole = myRow?.role || null
    setRole(myRole)

    const { data: memberRows } = await supabase
      .from('res_community_members')
      .select('user_id, role')
      .eq('community_id', selectedId)
    const ids = (memberRows || []).map(m => m.user_id)
    const { data: profileRows } = ids.length
      ? await supabase.from('profiles').select('id, display_name, username').in('id', ids)
      : { data: [] as { id: string; display_name?: string; username?: string }[] }
    const nameOf = (id: string) => {
      const p = (profileRows || []).find(pr => pr.id === id)
      return p?.display_name || p?.username || 'Neighbour'
    }
    setMembers((memberRows || []).map(m => ({ userId: m.user_id, name: nameOf(m.user_id), role: m.role })))

    if (myRole === 'admin' || myRole === 'founder') {
      const { data: actionRows } = await supabase
        .from('res_moderation_actions')
        .select('id, action, subject_type, actor_id, reason, created_at')
        .eq('community_id', selectedId)
        .order('created_at', { ascending: false })
        .limit(20)
      const actorIds = [...new Set((actionRows || []).map(a => a.actor_id))]
      const { data: actorProfiles } = actorIds.length
        ? await supabase.from('profiles').select('id, display_name, username').in('id', actorIds)
        : { data: [] as { id: string; display_name?: string; username?: string }[] }
      const actorName = (id: string) => {
        const p = (actorProfiles || []).find(pr => pr.id === id)
        return p?.display_name || p?.username || 'Neighbour'
      }
      setActions((actionRows || []).map(a => ({
        id: a.id,
        action: a.action,
        subjectType: a.subject_type,
        actorName: actorName(a.actor_id),
        reason: a.reason,
        createdAt: a.created_at
      })))
    } else {
      setActions([])
    }

    setLoading(false)
  }, [selectedId, currentUserId])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load() }, [load])

  const handleGenerateInvite = async () => {
    if (!supabase || !selectedId) return
    setGenerating(true)
    setInviteError(null)
    setInviteCode(null)
    const { data, error } = await supabase.rpc('res_create_invite', { p_community: selectedId, p_max_uses: 1, p_expires_at: null })
    setGenerating(false)
    if (error) {
      setInviteError(humanizeDbError(error.message))
      return
    }
    setInviteCode(data as string)
  }

  const copyCode = () => {
    if (!inviteCode) return
    navigator.clipboard?.writeText(inviteCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleRedeem = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!supabase || !redeemInput.trim()) return
    setRedeeming(true)
    setRedeemStatus(null)
    const { error } = await supabase.rpc('res_redeem_invite', { p_code: redeemInput.trim().toUpperCase() })
    setRedeeming(false)
    if (error) {
      setRedeemStatus(humanizeDbError(error.message))
      return
    }
    setRedeemStatus('Invite accepted — you have joined the community.')
    setRedeemInput('')
    load()
  }

  const handleModerate = async (action: 'remove_member' | 'promote' | 'demote', subjectId: string) => {
    if (!supabase || !selectedId) return
    setModerateError(null)
    const { error } = await supabase.rpc('res_moderate', {
      p_community: selectedId,
      p_action: action,
      p_subject_type: 'member',
      p_subject_id: subjectId,
      p_reason: null
    })
    if (error) {
      setModerateError(humanizeDbError(error.message))
      return
    }
    load()
  }

  if (myCommunities.length === 0) {
    return (
      <div className="glass-panel p-12 text-center text-content-muted">
        <Users size={48} className="mx-auto mb-4 opacity-10" />
        <p>Join a community to manage invites and moderation.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {myCommunities.length > 1 && (
        <select
          value={selectedId}
          onChange={e => setSelectedId(e.target.value)}
          className="bg-surface border border-default rounded-xl p-3 text-sm text-content outline-none focus:border-accent/50"
        >
          {myCommunities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      )}

      {/* INVITES */}
      <div className="glass-panel p-6 space-y-5">
        <h3 className="text-xl font-bold text-content flex items-center gap-2">
          <KeyRound size={20} className="text-accent" /> Private Invites
        </h3>

        {isAdmin && (
          <div className="bg-surface-sunken/40 border border-subtle rounded-xl p-4 space-y-3">
            <p className="text-xs text-content-muted">Generate a one-time invite code for this community.</p>
            <button
              onClick={handleGenerateInvite}
              disabled={generating}
              className="bg-accent text-content-on-accent font-black px-4 py-2 rounded-lg text-xs uppercase tracking-widest hover:bg-accent transition-all disabled:opacity-50"
            >
              {generating ? 'Generating...' : 'Generate invite code'}
            </button>
            {inviteError && <p className="text-xs text-danger">{inviteError}</p>}
            {inviteCode && (
              <div className="flex items-center gap-3 bg-surface border border-accent/30 rounded-lg p-3">
                <span className="font-mono text-accent text-sm tracking-widest flex-1">{inviteCode}</span>
                <button onClick={copyCode} className="text-content-muted hover:text-content">
                  {copied ? <Check size={16} className="text-success" /> : <Copy size={16} />}
                </button>
              </div>
            )}
          </div>
        )}

        <form onSubmit={handleRedeem} className="flex flex-col md:flex-row gap-3">
          <input
            value={redeemInput}
            onChange={e => setRedeemInput(e.target.value)}
            placeholder="Have an invite code?"
            className="flex-1 bg-surface border border-default rounded-xl p-3 text-sm text-content outline-none focus:border-accent/50"
          />
          <button type="submit" disabled={redeeming} className="bg-surface-raised/5 hover:bg-surface-raised/10 text-accent border border-accent/20 px-4 py-2 rounded-lg text-xs font-bold transition-all disabled:opacity-50">
            {redeeming ? 'Redeeming...' : 'Redeem'}
          </button>
        </form>
        {redeemStatus && <p className="text-xs text-content-muted">{redeemStatus}</p>}
      </div>

      {/* MODERATION */}
      {isAdmin && (
        <>
          <div className="glass-panel p-6 space-y-4">
            <h3 className="text-xl font-bold text-content flex items-center gap-2">
              <ShieldCheck size={20} className="text-accent" /> Members
            </h3>
            {moderateError && <p className="text-xs text-danger">{moderateError}</p>}
            {loading ? (
              <p className="text-xs text-content-muted uppercase tracking-widest font-bold">Loading...</p>
            ) : (
              <div className="space-y-2">
                {members.map(m => (
                  <div key={m.userId} className="flex items-center justify-between bg-surface-sunken/40 border border-subtle rounded-xl p-3">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-content">{m.name}</span>
                      <span className="text-xs bg-surface-raised/5 text-content-muted px-2 py-0.5 rounded uppercase font-bold">{m.role}</span>
                    </div>
                    {m.userId !== currentUserId && (
                      <div className="flex items-center gap-2">
                        {m.role !== 'admin' && m.role !== 'founder' && (
                          <button onClick={() => handleModerate('promote', m.userId)} title="Promote to admin" className="text-content-muted hover:text-accent transition-colors"><ArrowUp size={16} /></button>
                        )}
                        {role === 'founder' && m.role === 'admin' && (
                          <button onClick={() => handleModerate('demote', m.userId)} title="Demote to member" className="text-content-muted hover:text-accent transition-colors"><ArrowDown size={16} /></button>
                        )}
                        {/* A plain admin may only remove ordinary members — removing another
                            admin or the founder is a founder-only action, same gating as demote. */}
                        {(role === 'founder' || (m.role !== 'admin' && m.role !== 'founder')) && (
                          <button onClick={() => handleModerate('remove_member', m.userId)} title="Remove from community" className="text-content-muted hover:text-danger transition-colors"><UserMinus size={16} /></button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="glass-panel p-6 space-y-4">
            <h3 className="text-xl font-bold text-content flex items-center gap-2">
              <ScrollText size={20} className="text-accent" /> Recent Moderation Actions
            </h3>
            {actions.length === 0 ? (
              <p className="text-xs text-content-muted">No moderation actions logged yet.</p>
            ) : (
              <div className="space-y-2">
                {actions.map(a => (
                  <div key={a.id} className="flex items-center justify-between text-xs bg-surface-sunken/40 border border-subtle rounded-lg p-3">
                    <span className="text-content-muted">
                      <span className="text-content font-bold">{a.actorName}</span> {a.action.replace('_', ' ')} a {a.subjectType.replace('_', ' ')}
                      {a.reason ? ` — ${a.reason}` : ''}
                    </span>
                    <span className="text-content-subtle font-mono text-xs">{new Date(a.createdAt).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
