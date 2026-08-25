'use client'

import React, { useEffect, useState } from 'react'
import { Megaphone, Send, Plus, X, Bell, BellOff, Building2 } from 'lucide-react'
import { useSelector, useDispatch } from 'react-redux'
import { RootState, AppDispatch, isGuestUser, addLog, addNotification } from '../../../../store'
import {
  fetchAllUnits, fetchMySenderUnitIds, fetchMyFollowedUnitIds, fetchBroadcastFeed,
  followUnit, unfollowUnit, createUnit, postBroadcast, unitBreadcrumb, canPostAsUnit,
  type OrgUnit, type OrgBroadcast
} from '../../../../utils/orgBroadcasts'
import { getErrorMessage } from '../../../../utils/errors'
import { cleanScriptTags, encodeHTMLEntities } from '../../../../utils/security'
import { goldButtonClass } from '../../../../components/ui/GoldButton'
import EmptyState from '../shared/EmptyState'

const TIER_LABEL: Record<OrgUnit['tier'], string> = {
  department: 'Department', hod: 'HOD', school: 'School',
  teacher: 'Teacher', business: 'Business', branch: 'Branch'
}

const sanitize = (text: string) => encodeHTMLEntities(cleanScriptTags(text))

/**
 * Free, in-app broadcast messaging (Batch 10) — a Department/HOD/School/
 * Teacher or Business/Branch tree where a post at any level cascades down
 * to everyone who follows that unit or a unit beneath it. Audience is
 * strictly opt-in (res_org_follows) — never scraped or auto-subscribed.
 * See org_broadcast_schema.sql for the real access control; this component
 * only ever shows what the DB's RLS already allowed it to fetch.
 */
export default function OrgBroadcastsPanel() {
  const dispatch = useDispatch<AppDispatch>()
  const currentUser = useSelector((state: RootState) => state.auth.currentUser)
  const guest = currentUser ? isGuestUser(currentUser) : true

  const [units, setUnits] = useState<OrgUnit[]>([])
  const [senderUnitIds, setSenderUnitIds] = useState<string[]>([])
  const [followedUnitIds, setFollowedUnitIds] = useState<string[]>([])
  const [feed, setFeed] = useState<OrgBroadcast[]>([])
  const [loaded, setLoaded] = useState(false)

  const [showCompose, setShowCompose] = useState(false)
  const [showCreateUnit, setShowCreateUnit] = useState(false)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [targetUnitId, setTargetUnitId] = useState('')
  const [newUnitName, setNewUnitName] = useState('')
  const [newUnitTier, setNewUnitTier] = useState<OrgUnit['tier']>('business')
  const [newUnitParentId, setNewUnitParentId] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!currentUser || guest) return
    let cancelled = false
    Promise.all([
      fetchAllUnits(),
      fetchMySenderUnitIds(currentUser.id),
      fetchMyFollowedUnitIds(currentUser.id),
      fetchBroadcastFeed()
    ]).then(([u, s, f, b]) => {
      if (cancelled) return
      setUnits(u)
      setSenderUnitIds(s)
      setFollowedUnitIds(f)
      setFeed(b)
      setLoaded(true)
    })
    return () => { cancelled = true }
  }, [currentUser, guest])

  const refreshFeed = async () => {
    setFeed(await fetchBroadcastFeed())
  }

  const toggleFollow = async (unitId: string) => {
    if (!currentUser) return
    const following = followedUnitIds.includes(unitId)
    try {
      if (following) {
        await unfollowUnit(unitId, currentUser.id)
        setFollowedUnitIds(ids => ids.filter(id => id !== unitId))
      } else {
        await followUnit(unitId, currentUser.id, true)
        setFollowedUnitIds(ids => [...ids, unitId])
      }
      await refreshFeed()
    } catch (err) {
      setError(getErrorMessage(err))
    }
  }

  const handleCreateUnit = async () => {
    if (!currentUser || !newUnitName.trim()) return
    setSubmitting(true)
    setError(null)
    try {
      const unit = await createUnit({
        name: sanitize(newUnitName.trim()),
        tier: newUnitTier,
        parentId: newUnitParentId || null,
        ownerUserId: currentUser.id
      })
      setUnits(u => [...u, unit])
      setSenderUnitIds(ids => [...ids, unit.id])
      setNewUnitName('')
      setShowCreateUnit(false)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  const handlePost = async () => {
    if (!currentUser || !targetUnitId || !title.trim() || !body.trim()) return
    setSubmitting(true)
    setError(null)
    try {
      await postBroadcast(targetUnitId, currentUser.id, sanitize(title.trim()), sanitize(body.trim()))
      dispatch(addLog({
        ip: '127.0.0.1',
        action: `Org broadcast sent from unit ${targetUnitId}`,
        type: 'org_broadcast_sent',
        details: `Sender ${currentUser.id} posted "${title.trim().slice(0, 60)}" to unit ${targetUnitId}.`
      }))
      dispatch(addNotification({ title: 'Broadcast sent', message: 'Your announcement is live for everyone who follows this unit.', read: false }))
      setTitle('')
      setBody('')
      setShowCompose(false)
      await refreshFeed()
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  if (!currentUser || guest || !loaded) return null

  const canSendAnywhere = senderUnitIds.length > 0
  const postableUnits = units.filter(u => canPostAsUnit(units, senderUnitIds, u.id))

  return (
    <div className="glass-panel p-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-gold-primary/10 rounded-xl">
            <Megaphone size={18} className="text-gold-primary" />
          </div>
          <div>
            <p className="text-xs font-black text-white uppercase tracking-widest">Org & Business Broadcasts</p>
            <p className="text-[10px] text-gray-500">Free, in-app announcements — opt-in only, no spam</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowCreateUnit(v => !v)} className="text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-white px-3 py-2 rounded-lg bg-white/5 flex items-center gap-1">
            <Building2 size={12} /> New unit
          </button>
          {canSendAnywhere && (
            <button onClick={() => setShowCompose(v => !v)} className={`${goldButtonClass()} text-[10px] px-3 py-2 flex items-center gap-1`}>
              <Plus size={12} /> Compose
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-2">{error}</div>
      )}

      {showCreateUnit && (
        <div className="bg-black/40 border border-white/5 rounded-xl p-4 space-y-3">
          <p className="text-[10px] text-gray-500">Claim a unit to send from — a business, a school, or a department. Creating one makes you its first sender.</p>
          <input
            value={newUnitName}
            onChange={e => setNewUnitName(e.target.value)}
            placeholder="Unit name (e.g. Sunnyside Spaza Shop)"
            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
          />
          <div className="flex gap-2">
            <select value={newUnitTier} onChange={e => setNewUnitTier(e.target.value as OrgUnit['tier'])} className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white">
              {(Object.keys(TIER_LABEL) as OrgUnit['tier'][]).map(t => (
                <option key={t} value={t}>{TIER_LABEL[t]}</option>
              ))}
            </select>
            <select value={newUnitParentId} onChange={e => setNewUnitParentId(e.target.value)} className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white">
              <option value="">No parent (top-level)</option>
              {postableUnits.map(u => (
                <option key={u.id} value={u.id}>{unitBreadcrumb(units, u.id).map(b => b.name).join(' › ')}</option>
              ))}
            </select>
          </div>
          <button onClick={handleCreateUnit} disabled={submitting || !newUnitName.trim()} className={`${goldButtonClass()} text-[10px] px-4 py-2 disabled:opacity-50`}>
            {submitting ? 'Creating…' : 'Create unit'}
          </button>
        </div>
      )}

      {showCompose && canSendAnywhere && (
        <div className="bg-black/40 border border-white/5 rounded-xl p-4 space-y-3">
          <select value={targetUnitId} onChange={e => setTargetUnitId(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white">
            <option value="" disabled>Post as…</option>
            {postableUnits.map(u => (
              <option key={u.id} value={u.id}>{unitBreadcrumb(units, u.id).map(b => b.name).join(' › ')} ({TIER_LABEL[u.tier]})</option>
            ))}
          </select>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Title" className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white" />
          <textarea value={body} onChange={e => setBody(e.target.value)} rows={3} placeholder="Announcement…" className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white resize-none" />
          <div className="flex gap-2">
            <button onClick={handlePost} disabled={submitting || !targetUnitId || !title.trim() || !body.trim()} className={`${goldButtonClass()} text-[10px] px-4 py-2 flex items-center gap-1 disabled:opacity-50`}>
              <Send size={12} /> {submitting ? 'Sending…' : 'Send'}
            </button>
            <button onClick={() => setShowCompose(false)} className="text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-white px-3 py-2"><X size={12} /></button>
          </div>
        </div>
      )}

      {units.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {units.slice(0, 12).map(u => {
            const following = followedUnitIds.includes(u.id)
            return (
              <button
                key={u.id}
                onClick={() => toggleFollow(u.id)}
                className={`text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-full border flex items-center gap-1 transition-all ${
                  following ? 'bg-gold-primary/15 border-gold-primary/40 text-gold-primary' : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
                }`}
              >
                {following ? <Bell size={10} /> : <BellOff size={10} />} {u.name}
              </button>
            )
          })}
        </div>
      )}

      {feed.length === 0 ? (
        <EmptyState icon={Megaphone} title="No broadcasts yet" subtitle="Follow a school, department, or business above to hear from them here." compact />
      ) : (
        <div className="space-y-2">
          {feed.map(b => {
            const unit = units.find(u => u.id === b.unitId)
            return (
              <div key={b.id} className="bg-black/30 border border-white/5 rounded-xl p-3">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-[9px] font-black uppercase tracking-widest text-gold-primary">{unit ? unit.name : 'Unknown unit'}</span>
                  <span className="text-[9px] text-gray-600">{new Date(b.createdAt).toLocaleDateString()}</span>
                </div>
                <p className="text-sm font-bold text-white">{b.title}</p>
                <p className="text-xs text-gray-400 mt-1">{b.body}</p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
