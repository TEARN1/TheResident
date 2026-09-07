'use client'

import React, { useState } from 'react'
import { Megaphone, Calendar, Info, Heart, Share2, Check, Plus, X, EyeOff, Eye, Users, Sparkles, MapPin, Clock, UserX } from 'lucide-react'
import UpgradeButton from '../shared/UpgradeButton'
import { formatGruvsEventWhen } from '../../../../utils/gruvsEvents'
import { goldButtonClass } from '../../../../components/ui/GoldButton'

const NOTICE_FREE_WINDOW_MS = 8 * 60 * 60 * 1000

interface Notice {
  id: string
  title: string
  description: string
  type: 'notice' | 'event' | 'landlord_announcement'
  postedBy: string
  postedById?: string
  timestamp: string
  eventDate?: string
  eventId?: string | null
  vibes?: string[]
  echos?: string[]
  rsvps: string[]
  audience?: 'everyone' | 'my_tenants' | 'targeted'
  targetSuburbs?: string[]
  excludedUserIds?: string[]
  featuredUntil?: string | null
  paidVisibilityUntil?: string | null
}

interface GruvsEventOption {
  id: string
  title: string
  startsAt: string
}

interface NoticeBoardTabProps {
  communityNotices: Notice[]
  currentUser: { name: string; id: string; role: string } | null
  /** Upcoming events fetched live from the Gruvs-owned `events` table (CONTRACT.md §8) — the picker for a Community Event notice. */
  upcomingGruvsEvents?: GruvsEventOption[]
  /** id → live Gruvs event details, for notices that already reference one. */
  gruvsEventInfo?: Record<string, { title: string; startsAt: string }>
  handleVibeNotice?: (id: string) => void
  handleEchoNotice?: (id: string) => void
  handleRSVPToEvent?: (id: string) => void
  handlePostNotice?: (data: {
    title: string
    description: string
    type: 'notice' | 'event' | 'landlord_announcement'
    audience?: 'everyone' | 'my_tenants' | 'targeted'
    targetSuburbs?: string[]
    excludedUserIds?: string[]
    eventId?: string
  }) => void
  isModerator?: boolean
  onModerate?: (subjectType: string, subjectId: string, action: 'hide' | 'unhide') => void
}

const isFeatured = (n: Notice) => !!n.featuredUntil && new Date(n.featuredUntil).getTime() > Date.now()
const freeWindowEndsAt = (n: Notice) => new Date(n.timestamp).getTime() + NOTICE_FREE_WINDOW_MS
const isPastFreeWindow = (n: Notice) => n.type !== 'event' && Date.now() >= freeWindowEndsAt(n)
const isPaidCoverageActive = (n: Notice) => !!n.paidVisibilityUntil && new Date(n.paidVisibilityUntil).getTime() > Date.now()
const isExpired = (n: Notice) => isPastFreeWindow(n) && !isPaidCoverageActive(n)
const hoursLeftInFreeWindow = (n: Notice) => Math.max(0, Math.ceil((freeWindowEndsAt(n) - Date.now()) / (60 * 60 * 1000)))

export default function NoticeBoardTab({
  communityNotices,
  currentUser,
  upcomingGruvsEvents = [],
  gruvsEventInfo = {},
  handleVibeNotice,
  handleEchoNotice,
  handleRSVPToEvent,
  handlePostNotice,
  isModerator,
  onModerate
}: NoticeBoardTabProps) {
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [desc, setDesc] = useState('')
  const [type, setType] = useState<'notice' | 'event' | 'landlord_announcement'>('notice')
  const [selectedEventId, setSelectedEventId] = useState('')
  const [audience, setAudience] = useState<'everyone' | 'my_tenants' | 'targeted'>('everyone')
  const [suburbsInput, setSuburbsInput] = useState('')
  const [excludeInput, setExcludeInput] = useState('')
  const isLandlord = currentUser?.role === 'landlord'

  const onPostSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (type === 'event') {
      if (!selectedEventId || !desc.trim()) return
      const picked = upcomingGruvsEvents.find(ev => ev.id === selectedEventId)
      handlePostNotice?.({
        title: picked?.title || 'Community event',
        description: desc,
        type: 'event',
        eventId: selectedEventId
      })
    } else {
      if (!title.trim() || !desc.trim()) return
      const targetSuburbs = suburbsInput.split(',').map(s => s.trim()).filter(Boolean)
      const excludedUserIds = excludeInput.split(',').map(s => s.trim()).filter(Boolean)
      handlePostNotice?.({
        title,
        description: desc,
        type,
        audience,
        targetSuburbs: audience === 'targeted' && targetSuburbs.length > 0 ? targetSuburbs : undefined,
        excludedUserIds: excludedUserIds.length > 0 ? excludedUserIds : undefined
      })
    }
    setShowForm(false)
    setTitle('')
    setDesc('')
    setType('notice')
    setSelectedEventId('')
    setAudience('everyone')
    setSuburbsInput('')
    setExcludeInput('')
  }

  return (
    <div className="space-y-6">
      <div className="glass-panel p-6">
        <div className="flex justify-between items-center mb-8">
           <div>
              <h3 className="text-xl font-bold text-accent flex items-center gap-2">
                 <Megaphone size={20} className="text-accent" /> Community Announcements
              </h3>
              <p className="text-xs text-content-muted mt-1 uppercase tracking-widest font-black opacity-60">Stay updated with neighborhood events and official notices.</p>
           </div>
           <button
              onClick={() => setShowForm(!showForm)}
              className="bg-accent text-content-on-accent font-black px-4 py-2 rounded-lg text-xs uppercase tracking-widest transition-all active:scale-95 flex items-center gap-2 shadow-lg shadow-gold-primary/10 hover:bg-accent"
           >
              {showForm ? <X size={16} /> : <Plus size={16} />}
              {showForm ? 'Cancel' : 'Post Notice'}
           </button>
        </div>

        {showForm && (
           <form
              onSubmit={onPostSubmit}
              className="bg-surface-sunken/40 border border-accent/20 rounded-2xl p-6 mb-8 space-y-4 shadow-[0_0_20px_rgba(212,175,55,0.05)] animate-in fade-in slide-in-from-top-4 duration-300"
           >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 {type !== 'event' && (
                    <div className="space-y-2">
                       <label className="text-xs text-content-muted uppercase font-black tracking-widest">Notice Title</label>
                       <input
                          value={title} onChange={e => setTitle(e.target.value)}
                          placeholder="e.g. Street Meeting Saturday"
                          className="w-full bg-surface border border-default rounded-xl p-3 text-sm text-content outline-none focus:border-accent/50 transition-all font-medium"
                       />
                    </div>
                 )}
                 <div className="space-y-2">
                    <label className="text-xs text-content-muted uppercase font-black tracking-widest">Announcement Type</label>
                    <select
                       value={type} onChange={e => setType(e.target.value as 'notice' | 'event' | 'landlord_announcement')}
                       className="w-full bg-surface border border-default rounded-xl p-3 text-sm text-content outline-none focus:border-accent/50 transition-all font-medium cursor-pointer"
                    >
                       <option value="notice">General Notice</option>
                       <option value="event">Community Event</option>
                       {isLandlord && <option value="landlord_announcement">Landlord Announcement</option>}
                    </select>
                 </div>
              </div>
              {type === 'event' && (
                 <div className="space-y-2">
                    <label className="text-xs text-content-muted uppercase font-black tracking-widest flex items-center gap-1"><Calendar size={12} /> Which Gruvs Event</label>
                    {upcomingGruvsEvents.length === 0 ? (
                       <p className="text-xs text-content-muted bg-surface-sunken/40 border border-default rounded-xl p-3 leading-relaxed">
                          No upcoming events found on The Gruvs. Community Events always link to a real Gruvs event — create one there first, then post it here.
                       </p>
                    ) : (
                       <select
                          value={selectedEventId} onChange={e => setSelectedEventId(e.target.value)}
                          className="w-full bg-surface border border-default rounded-xl p-3 text-sm text-content outline-none focus:border-accent/50 transition-all font-medium cursor-pointer"
                       >
                          <option value="">Select an event…</option>
                          {upcomingGruvsEvents.map(ev => (
                             <option key={ev.id} value={ev.id}>
                                {ev.title} — {formatGruvsEventWhen(ev.startsAt, { long: true })}
                             </option>
                          ))}
                       </select>
                    )}
                    <p className="text-xs text-content-muted leading-relaxed">Title and date come straight from The Gruvs, so the wall here never drifts from the real event.</p>
                 </div>
              )}
              {type !== 'event' && (
                 <div className="space-y-3">
                    <label className="text-xs text-content-muted uppercase font-black tracking-widest">Who Should See This</label>
                    <div className="flex flex-wrap gap-3">
                       <button
                          type="button"
                          onClick={() => setAudience('everyone')}
                          className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border text-xs font-black uppercase tracking-widest transition-all ${audience === 'everyone' ? 'bg-accent text-content-on-accent border-accent' : 'bg-surface border-default text-content-muted'}`}
                       >
                          <Megaphone size={14} /> Whole Community
                       </button>
                       <button
                          type="button"
                          onClick={() => setAudience('targeted')}
                          className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border text-xs font-black uppercase tracking-widest transition-all ${audience === 'targeted' ? 'bg-accent text-content-on-accent border-accent' : 'bg-surface border-default text-content-muted'}`}
                       >
                          <MapPin size={14} /> Specific Area
                       </button>
                       {type === 'landlord_announcement' && (
                          <button
                             type="button"
                             onClick={() => setAudience('my_tenants')}
                             className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border text-xs font-black uppercase tracking-widest transition-all ${audience === 'my_tenants' ? 'bg-accent text-content-on-accent border-accent' : 'bg-surface border-default text-content-muted'}`}
                          >
                             <Users size={14} /> My Tenants Only
                          </button>
                       )}
                    </div>
                    {audience === 'my_tenants' && (
                       <p className="text-xs text-content-muted leading-relaxed">Only visible to residents with an approved room request against one of your listings — not the general community wall.</p>
                    )}
                    {audience === 'targeted' && (
                       <div className="space-y-1">
                          <input
                             value={suburbsInput} onChange={e => setSuburbsInput(e.target.value)}
                             placeholder="e.g. Rosebank, Braamfontein"
                             className="w-full bg-surface border border-default rounded-xl p-3 text-sm text-content outline-none focus:border-accent/50 transition-all font-medium"
                          />
                          <p className="text-xs text-content-muted leading-relaxed">Comma-separated suburbs. Only reaches people with a listing, or an active room request, in one of these — leave blank to target nobody in particular (same as Whole Community).</p>
                       </div>
                    )}
                    <div className="space-y-1">
                       <label className="text-xs text-content-muted uppercase font-black tracking-widest flex items-center gap-1"><UserX size={12} /> Hide From (optional)</label>
                       <input
                          value={excludeInput} onChange={e => setExcludeInput(e.target.value)}
                          placeholder="Resident IDs, comma-separated"
                          className="w-full bg-surface border border-default rounded-xl p-3 text-sm text-content outline-none focus:border-accent/50 transition-all font-medium"
                       />
                       <p className="text-xs text-content-muted leading-relaxed">Applies on top of whatever audience you picked above — a way to exclude specific people even from a public post.</p>
                    </div>
                    <p className="text-xs text-content-muted leading-relaxed flex items-center gap-1"><Clock size={12} /> Free for the first 8 hours — after that it needs a paid extension to stay visible to anyone but you.</p>
                 </div>
              )}
              <div className="space-y-2">
                 <label className="text-xs text-content-muted uppercase font-black tracking-widest">Message Body</label>
                 <textarea
                    value={desc} onChange={e => setDesc(e.target.value)}
                    placeholder="Provide important details for your neighbors..."
                    className="w-full bg-surface border border-default rounded-xl p-3 text-sm text-content h-24 resize-none outline-none focus:border-accent/50 transition-all font-medium"
                 />
              </div>
              <button type="submit" className="w-full bg-accent text-content-on-accent font-black py-3 rounded-xl text-xs uppercase tracking-widest transition-all hover:bg-accent shadow-lg shadow-gold-primary/10 active:scale-95">Publish to Community Wall</button>
           </form>
        )}

        {communityNotices.length === 0 ? (
          <div className="py-20 text-center text-content-muted bg-surface-raised/[0.02] rounded-3xl border border-dashed border-subtle">
             <Info size={48} className="mx-auto mb-4 opacity-10" />
             <p className="text-sm uppercase tracking-widest font-bold">Your neighborhood wall is clear</p>
             <p className="text-xs text-content-subtle mt-1 font-medium">Be the first to post a notice or event!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {communityNotices.map(notice => (
              <div key={notice.id} className={`bg-surface-sunken/40 border rounded-2xl p-6 flex flex-col gap-5 transition-all group shadow-lg hover:shadow-gold-primary/5 ${isFeatured(notice) ? 'border-accent/40' : 'border-subtle hover:border-accent/20'}`}>
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs font-black px-2 py-1 rounded-lg uppercase tracking-widest border transition-all ${notice.type === 'event' ? 'bg-info/10 text-info border-info/20 group-hover:bg-info/20' : notice.type === 'landlord_announcement' ? 'bg-accent/10 text-accent border-accent/20' : 'bg-info/10 text-info border-info/20 group-hover:bg-info/20'}`}>
                      {notice.type === 'landlord_announcement' ? 'landlord announcement' : notice.type}
                    </span>
                    {notice.audience === 'my_tenants' && (
                      <span className="flex items-center gap-1 text-xs font-black px-2 py-1 rounded-lg uppercase tracking-widest border bg-surface-raised/5 text-content-muted border-default">
                        <Users size={10} /> Tenants only
                      </span>
                    )}
                    {notice.audience === 'targeted' && notice.targetSuburbs && notice.targetSuburbs.length > 0 && (
                      <span className="flex items-center gap-1 text-xs font-black px-2 py-1 rounded-lg uppercase tracking-widest border bg-surface-raised/5 text-content-muted border-default" title={notice.targetSuburbs.join(', ')}>
                        <MapPin size={10} /> {notice.targetSuburbs.length === 1 ? notice.targetSuburbs[0] : `${notice.targetSuburbs.length} areas`}
                      </span>
                    )}
                    {isFeatured(notice) && (
                      <span className="flex items-center gap-1 text-xs font-black px-2 py-1 rounded-lg uppercase tracking-widest border bg-accent text-content-on-accent border-accent">
                        <Sparkles size={10} /> Boosted
                      </span>
                    )}
                    {notice.type !== 'event' && (
                      isExpired(notice) ? (
                        <span className="flex items-center gap-1 text-xs font-black px-2 py-1 rounded-lg uppercase tracking-widest border bg-danger/10 text-danger border-danger/20" title="Only visible to you until it's renewed">
                          <Clock size={10} /> Expired
                        </span>
                      ) : isPastFreeWindow(notice) ? (
                        <span className="flex items-center gap-1 text-xs font-black px-2 py-1 rounded-lg uppercase tracking-widest border bg-success/10 text-success border-success/20">
                          <Clock size={10} /> Paid visibility
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs font-black px-2 py-1 rounded-lg uppercase tracking-widest border bg-surface-raised/5 text-content-muted border-default">
                          <Clock size={10} /> Free · {hoursLeftInFreeWindow(notice)}h left
                        </span>
                      )
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    {isModerator && (
                      <>
                        <button onClick={() => onModerate?.('notice', notice.id, 'hide')} title="Hide notice" className="text-content-subtle hover:text-danger transition-colors">
                          <EyeOff size={13} />
                        </button>
                        <button onClick={() => onModerate?.('notice', notice.id, 'unhide')} title="Unhide notice" className="text-content-subtle hover:text-success transition-colors">
                          <Eye size={13} />
                        </button>
                      </>
                    )}
                    <span className="text-xs text-content-subtle font-mono tracking-tighter opacity-60 font-bold">{new Date(notice.timestamp).toLocaleDateString()}</span>
                  </div>
                </div>

                <div className="space-y-2">
                   <h4 className="text-lg font-black text-content leading-tight group-hover:text-accent transition-colors tracking-tight">
                      {notice.eventId && gruvsEventInfo[notice.eventId] ? gruvsEventInfo[notice.eventId].title : notice.title}
                   </h4>
                   <p className="text-sm text-content-muted line-clamp-3 leading-relaxed opacity-80 font-medium">{notice.description}</p>
                </div>

                {notice.type === 'event' && (
                  <div className="flex items-center gap-3 text-xs font-black text-accent bg-accent/5 p-3 rounded-xl border border-accent/10 uppercase tracking-widest shadow-inner">
                    <Calendar size={14} className="opacity-60" />
                    {notice.eventId && gruvsEventInfo[notice.eventId] ? (
                      <span>On The Gruvs: <span className="text-content ml-1">{formatGruvsEventWhen(gruvsEventInfo[notice.eventId].startsAt, { long: true })}</span></span>
                    ) : notice.eventDate ? (
                      <span>Scheduled: <span className="text-content ml-1">{notice.eventDate}</span></span>
                    ) : (
                      <span className="opacity-60">Event details unavailable</span>
                    )}
                  </div>
                )}

                <div className="mt-auto pt-6 border-t border-subtle flex justify-between items-center">
                  <div className="flex items-center gap-2">
                     <div className="w-7 h-7 bg-surface-raised rounded-xl flex items-center justify-center text-xs font-black text-accent transition-colors group-hover:bg-accent group-hover:text-content-on-accent">
                        {notice.postedBy.charAt(0)}
                     </div>
                     <span className="text-xs text-content-muted font-black uppercase tracking-widest opacity-80">{notice.postedBy}</span>
                  </div>
                  <div className="flex gap-4">
                     <button onClick={() => handleVibeNotice?.(notice.id)} className="flex items-center gap-1.5 text-xs text-content-muted hover:text-danger transition-colors font-black active:scale-90">
                        <Heart size={18} className="transition-transform group-hover:scale-110" /> <span>{notice.vibes?.length || 0}</span>
                     </button>
                     <button onClick={() => handleEchoNotice?.(notice.id)} className="flex items-center gap-1.5 text-xs text-content-muted hover:text-info transition-colors font-black active:scale-90">
                        <Share2 size={18} className="transition-transform group-hover:scale-110" /> <span>{notice.echos?.length || 0}</span>
                     </button>
                     {notice.type === 'event' && (
                       <button onClick={() => handleRSVPToEvent?.(notice.id)} className="flex items-center gap-2 text-xs text-success bg-success/10 px-3 py-1.5 rounded-xl border border-success/20 hover:bg-success hover:text-content transition-all font-black uppercase tracking-widest shadow-lg active:scale-90 ml-1">
                          <Check size={14} /> RSVP <span className="opacity-40">({notice.rsvps.length})</span>
                       </button>
                     )}
                  </div>
                </div>

                {notice.postedById === currentUser?.id && (
                  <div className="space-y-2">
                    {notice.type !== 'event' && isPastFreeWindow(notice) && (
                      <UpgradeButton
                        item="notice_extend_visibility"
                        targetId={notice.id}
                        className="w-full flex items-center justify-center gap-2 bg-danger/10 hover:bg-danger hover:text-content border border-danger/30 text-danger font-black py-2 rounded-xl text-xs uppercase tracking-widest transition-all active:scale-95"
                      />
                    )}
                    {!isFeatured(notice) && (
                      <UpgradeButton
                        item="notice_boost"
                        targetId={notice.id}
                        className={goldButtonClass({ size: 'sm', fullWidth: true })}
                      />
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
