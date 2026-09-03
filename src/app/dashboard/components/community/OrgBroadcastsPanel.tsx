'use client'

import React, { useEffect, useState } from 'react'
import { Megaphone, Send, Plus, X, Bell, BellOff, Building2, BadgeCheck, Search } from 'lucide-react'
import { useSelector, useDispatch } from 'react-redux'
import { RootState, AppDispatch, isGuestUser, addLog, addNotification } from '../../../../store'
import {
  fetchAllUnits, fetchMySenderUnitIds, fetchMyFollowedUnitIds, fetchBroadcastFeed,
  followUnit, unfollowUnit, createUnit, postBroadcast, unitBreadcrumb, canPostAsUnit,
  TIER_LABEL, searchUnits, type OrgUnit, type OrgBroadcast, type BroadcastPriority
} from '../../../../utils/orgBroadcasts'
import { getErrorMessage } from '../../../../utils/errors'
import { cleanScriptTags, encodeHTMLEntities } from '../../../../utils/security'
import { goldButtonClass } from '../../../../components/ui/GoldButton'
import EmptyState from '../shared/EmptyState'
import AreaTargetPicker, { type AreaTarget } from './AreaTargetPicker'
import { sendAreaBroadcast, canSend, describeSendResult, type AudiencePreview } from '../../../../utils/areaTargeting'
import AreaLicenceNotice from './AreaLicenceNotice'
import RequestVerificationPanel from './RequestVerificationPanel'
import VerificationQueuePanel from './VerificationQueuePanel'
import { isPlatformAdmin } from '../../../../utils/officialVerification'
import { fetchAreaLicence, canSendAtPriority, type AreaLicence } from '../../../../utils/areaBilling'
import { AREA_CATEGORIES } from '../../../../utils/areaCategories'

const sanitize = (text: string) => encodeHTMLEntities(cleanScriptTags(text))

/**
 * Free, in-app broadcast messaging (Batch 10) — a Department/HOD/School/
 * Teacher or Business/Branch tree where a post at any level cascades down
 * to everyone who follows that unit or a unit beneath it. Audience is
 * strictly opt-in (res_org_follows) — never scraped or auto-subscribed.
 * See theresident_org_broadcast_schema.sql for the real access control; this component
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
  const [priority, setPriority] = useState<BroadcastPriority>('normal')
  const [directoryQuery, setDirectoryQuery] = useState('')
  const [submitting, setSubmitting] = useState(false)
  // Area targeting (Phase D). Null target = this post goes to followers, the
  // way it always has; a chosen area switches it to location-based reach.
  const [areaTarget, setAreaTarget] = useState<AreaTarget | null>(null)
  const [areaPreview, setAreaPreview] = useState<AudiencePreview | null>(null)
  const [sendToArea, setSendToArea] = useState(false)
  // Without a category every notice arrives uncategorised, and the per-topic
  // muting the resolver already supports can never be used by a resident.
  const [category, setCategory] = useState('')
  const [licence, setLicence] = useState<AreaLicence | null>(null)
  // Drives the admin queue. Presentation only — every decision function checks
  // res_is_platform_admin() server-side as well.
  const [admin, setAdmin] = useState(false)
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

  useEffect(() => {
    if (!currentUser || guest) return
    isPlatformAdmin().then(setAdmin)
  }, [currentUser, guest])

  // The licence belongs to the unit, so it is re-read whenever the sender
  // switches which office they are posting as.
  useEffect(() => {
    if (!sendToArea || !targetUnitId) { setLicence(null); return }
    let cancelled = false
    fetchAreaLicence(targetUnitId)
      .then(l => { if (!cancelled) setLicence(l) })
      .catch(() => { if (!cancelled) setLicence(null) })
    return () => { cancelled = true }
  }, [sendToArea, targetUnitId])

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
      if (sendToArea && areaTarget) {
        const sent = await sendAreaBroadcast({
          unitId: targetUnitId,
          title: sanitize(title.trim()),
          body: sanitize(body.trim()),
          priority,
          category: category || null,
          mode: areaTarget.mode,
          jurisdictionId: areaTarget.jurisdictionId,
          lat: areaTarget.lat,
          lon: areaTarget.lon,
          radiusMetres: areaTarget.radiusMetres
        })
        dispatch(addLog({
          action: `Area broadcast sent from unit ${targetUnitId}`,
          type: 'area_broadcast_sent',
          details: `Sender ${currentUser.id} sent "${title.trim().slice(0, 60)}" to ${sent.targetLabel}, reaching ${sent.recipientCount}.`
        }))
        dispatch(addNotification({ title: 'Area notice sent', message: describeSendResult(sent), read: false }))
      } else {
        await postBroadcast(targetUnitId, currentUser.id, sanitize(title.trim()), sanitize(body.trim()), priority)
        dispatch(addLog({
          action: `Org broadcast sent from unit ${targetUnitId}`,
          type: 'org_broadcast_sent',
          details: `Sender ${currentUser.id} posted "${title.trim().slice(0, 60)}" to unit ${targetUnitId}.`
        }))
        dispatch(addNotification({ title: 'Broadcast sent', message: 'Your announcement is live for everyone who follows this unit.', read: false }))
      }
      setTitle('')
      setBody('')
      setPriority('normal')
      setSendToArea(false)
      setCategory('')
      setAreaTarget(null)
      setLicence(null)
      setAreaPreview(null)
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

      {admin && <VerificationQueuePanel />}

      {/* An office cannot reach an area until somebody outside it says so.
          This is where its owner asks. */}
      {postableUnits.filter(u => !u.verified).map(u => (
        <RequestVerificationPanel
          key={u.id}
          unitId={u.id}
          unitName={u.name}
          unitVerified={u.verified}
          onChanged={() => { fetchAllUnits().then(setUnits) }}
        />
      ))}

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
          <div>
            <select
              value={priority}
              onChange={e => setPriority(e.target.value as BroadcastPriority)}
              className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
            >
              <option value="normal">Normal — appears in the feed</option>
              <option value="important">Important — appears in the feed, highlighted</option>
              <option
                value="urgent"
                disabled={!units.find(u => u.id === targetUnitId)?.verified}
              >
                Urgent — reaches the bell{units.find(u => u.id === targetUnitId)?.verified ? '' : ' (unit must be verified)'}
              </option>
              <option
                value="critical"
                disabled={!units.find(u => u.id === targetUnitId)?.verified}
              >
                Critical — stays until acknowledged{units.find(u => u.id === targetUnitId)?.verified ? '' : ' (unit must be verified)'}
              </option>
            </select>
            {(priority === 'urgent' || priority === 'critical') && (
              <p className="text-[10px] text-yellow-500 mt-1">
                This interrupts everyone who follows this unit — use it only for something they need to act on now.
              </p>
            )}
          </div>
          {units.find(u => u.id === targetUnitId)?.verified && (
            <div className="space-y-2">
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={sendToArea}
                  onChange={e => setSendToArea(e.target.checked)}
                  className="accent-gold-primary mt-0.5"
                />
                <span className="text-[11px] text-gray-300 leading-relaxed">
                  <strong className="text-white">Send to an area instead</strong> — reaches everyone
                  who lives there, not only people who follow this account.
                  <span className="text-gray-500"> This is recorded publicly.</span>
                </span>
              </label>
              {sendToArea && <AreaLicenceNotice unitId={targetUnitId} licence={licence} />}
              {sendToArea && (
                <div className="space-y-1">
                  <select
                    value={category}
                    onChange={e => setCategory(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
                  >
                    <option value="">Choose a topic…</option>
                    {AREA_CATEGORIES.map(c => (
                      <option key={c.value} value={c.value}>{c.label} — {c.hint}</option>
                    ))}
                  </select>
                  <p className="text-[10px] text-gray-600 leading-relaxed">
                    Residents can mute a topic without muting your office. Emergencies always
                    reach them whatever they have muted.
                  </p>
                </div>
              )}
              {sendToArea && (
                <AreaTargetPicker
                  unitId={targetUnitId}
                  priority={priority}
                  category={category || null}
                  onChange={(t, p) => { setAreaTarget(t); setAreaPreview(p) }}
                />
              )}
            </div>
          )}
          <div className="flex gap-2">
            <button onClick={handlePost} disabled={submitting || !targetUnitId || !title.trim() || !body.trim() || (sendToArea && (!category || !canSend(areaPreview) || !canSendAtPriority(licence, priority)))} className={`${goldButtonClass()} text-[10px] px-4 py-2 flex items-center gap-1 disabled:opacity-50`}>
              <Send size={12} /> {submitting ? 'Sending…' : sendToArea ? 'Send to this area' : 'Send'}
            </button>
            <button onClick={() => setShowCompose(false)} className="text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-white px-3 py-2"><X size={12} /></button>
          </div>
        </div>
      )}

      {units.length > 0 && (
        <div className="space-y-2">
          <div className="relative">
            <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
            <input
              value={directoryQuery}
              onChange={e => setDirectoryQuery(e.target.value)}
              placeholder="Search the directory — a school, a utility, a class…"
              className="w-full bg-black/40 border border-white/10 rounded-lg pl-8 pr-3 py-2 text-xs text-white"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {searchUnits(units, directoryQuery).slice(0, 12).map(u => {
              const following = followedUnitIds.includes(u.id)
              return (
                <button
                  key={u.id}
                  onClick={() => toggleFollow(u.id)}
                  title={unitBreadcrumb(units, u.id).map(b => b.name).join(' › ')}
                  className={`text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-full border flex items-center gap-1 transition-all ${
                    following ? 'bg-gold-primary/15 border-gold-primary/40 text-gold-primary' : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
                  }`}
                >
                  {following ? <Bell size={10} /> : <BellOff size={10} />} {u.name}
                  {u.verified && <BadgeCheck size={10} className="text-sky-400" aria-label="Verified" />}
                </button>
              )
            })}
            {searchUnits(units, directoryQuery).length === 0 && (
              <p className="text-[10px] text-gray-600">Nothing matches — try a different name, or add a new unit above.</p>
            )}
          </div>
        </div>
      )}

      {feed.length === 0 ? (
        <EmptyState icon={Megaphone} title="No broadcasts yet" subtitle="Follow a school, department, or business above to hear from them here." compact />
      ) : (
        <div className="space-y-2">
          {feed.map(b => {
            const unit = units.find(u => u.id === b.unitId)
            return (
              <div
                key={b.id}
                className={`bg-black/30 border rounded-xl p-3 ${
                  b.priority === 'critical' ? 'border-red-500/30'
                    : b.priority === 'urgent' ? 'border-yellow-500/30'
                    : 'border-white/5'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-[9px] font-black uppercase tracking-widest text-gold-primary flex items-center gap-1">
                    {unit ? unit.name : 'Unknown unit'}
                    {unit?.verified && <BadgeCheck size={10} className="text-sky-400" aria-label="Verified" />}
                  </span>
                  <span className="text-[9px] text-gray-600">{new Date(b.createdAt).toLocaleDateString()}</span>
                </div>
                {(b.priority === 'urgent' || b.priority === 'critical') && (
                  <span className={`inline-block text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded mb-1 ${
                    b.priority === 'critical' ? 'bg-red-500/15 text-red-400' : 'bg-yellow-500/15 text-yellow-400'
                  }`}>
                    {b.priority}
                  </span>
                )}
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
