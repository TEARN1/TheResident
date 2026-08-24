'use client'

import React, { useState } from 'react'
import { Megaphone, Calendar, Info, Heart, Share2, Check, Plus, X, EyeOff, Eye, Users, Sparkles, MapPin, Clock, UserX } from 'lucide-react'
import UpgradeButton from '../shared/UpgradeButton'
import { formatGruvsEventWhen } from '../../../../utils/gruvsEvents'

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
              <h3 className="text-xl font-bold text-gold-primary flex items-center gap-2">
                 <Megaphone size={20} className="text-gold-primary" /> Community Announcements
              </h3>
              <p className="text-xs text-gray-500 mt-1 uppercase tracking-widest font-black opacity-60">Stay updated with neighborhood events and official notices.</p>
           </div>
           <button
              onClick={() => setShowForm(!showForm)}
              className="bg-gold-primary text-black font-black px-4 py-2 rounded-lg text-xs uppercase tracking-widest transition-all active:scale-95 flex items-center gap-2 shadow-lg shadow-gold-primary/10 hover:bg-gold-secondary"
           >
              {showForm ? <X size={16} /> : <Plus size={16} />}
              {showForm ? 'Cancel' : 'Post Notice'}
           </button>
        </div>

        {showForm && (
           <form
              onSubmit={onPostSubmit}
              className="bg-black/40 border border-gold-primary/20 rounded-2xl p-6 mb-8 space-y-4 shadow-[0_0_20px_rgba(212,175,55,0.05)] animate-in fade-in slide-in-from-top-4 duration-300"
           >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 {type !== 'event' && (
                    <div className="space-y-2">
                       <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Notice Title</label>
                       <input
                          value={title} onChange={e => setTitle(e.target.value)}
                          placeholder="e.g. Street Meeting Saturday"
                          className="w-full bg-black border border-white/10 rounded-xl p-3 text-sm text-white outline-none focus:border-gold-primary/50 transition-all font-medium"
                       />
                    </div>
                 )}
                 <div className="space-y-2">
                    <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Announcement Type</label>
                    <select
                       value={type} onChange={e => setType(e.target.value as 'notice' | 'event' | 'landlord_announcement')}
                       className="w-full bg-black border border-white/10 rounded-xl p-3 text-sm text-white outline-none focus:border-gold-primary/50 transition-all font-medium cursor-pointer"
                    >
                       <option value="notice">General Notice</option>
                       <option value="event">Community Event</option>
                       {isLandlord && <option value="landlord_announcement">Landlord Announcement</option>}
                    </select>
                 </div>
              </div>
              {type === 'event' && (
                 <div className="space-y-2">
                    <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest flex items-center gap-1"><Calendar size={12} /> Which Gruvs Event</label>
                    {upcomingGruvsEvents.length === 0 ? (
                       <p className="text-[11px] text-gray-500 bg-black/40 border border-white/10 rounded-xl p-3 leading-relaxed">
                          No upcoming events found on The Gruvs. Community Events always link to a real Gruvs event — create one there first, then post it here.
                       </p>
                    ) : (
                       <select
                          value={selectedEventId} onChange={e => setSelectedEventId(e.target.value)}
                          className="w-full bg-black border border-white/10 rounded-xl p-3 text-sm text-white outline-none focus:border-gold-primary/50 transition-all font-medium cursor-pointer"
                       >
                          <option value="">Select an event…</option>
                          {upcomingGruvsEvents.map(ev => (
                             <option key={ev.id} value={ev.id}>
                                {ev.title} — {formatGruvsEventWhen(ev.startsAt, { long: true })}
                             </option>
                          ))}
                       </select>
                    )}
                    <p className="text-[10px] text-gray-500 leading-relaxed">Title and date come straight from The Gruvs, so the wall here never drifts from the real event.</p>
                 </div>
              )}
              {type !== 'event' && (
                 <div className="space-y-3">
                    <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Who Should See This</label>
                    <div className="flex flex-wrap gap-3">
                       <button
                          type="button"
                          onClick={() => setAudience('everyone')}
                          className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border text-xs font-black uppercase tracking-widest transition-all ${audience === 'everyone' ? 'bg-gold-primary text-black border-gold-primary' : 'bg-black border-white/10 text-gray-400'}`}
                       >
                          <Megaphone size={14} /> Whole Community
                       </button>
                       <button
                          type="button"
                          onClick={() => setAudience('targeted')}
                          className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border text-xs font-black uppercase tracking-widest transition-all ${audience === 'targeted' ? 'bg-gold-primary text-black border-gold-primary' : 'bg-black border-white/10 text-gray-400'}`}
                       >
                          <MapPin size={14} /> Specific Area
                       </button>
                       {type === 'landlord_announcement' && (
                          <button
                             type="button"
                             onClick={() => setAudience('my_tenants')}
                             className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border text-xs font-black uppercase tracking-widest transition-all ${audience === 'my_tenants' ? 'bg-gold-primary text-black border-gold-primary' : 'bg-black border-white/10 text-gray-400'}`}
                          >
                             <Users size={14} /> My Tenants Only
                          </button>
                       )}
                    </div>
                    {audience === 'my_tenants' && (
                       <p className="text-[10px] text-gray-500 leading-relaxed">Only visible to residents with an approved room request against one of your listings — not the general community wall.</p>
                    )}
                    {audience === 'targeted' && (
                       <div className="space-y-1">
                          <input
                             value={suburbsInput} onChange={e => setSuburbsInput(e.target.value)}
                             placeholder="e.g. Rosebank, Braamfontein"
                             className="w-full bg-black border border-white/10 rounded-xl p-3 text-sm text-white outline-none focus:border-gold-primary/50 transition-all font-medium"
                          />
                          <p className="text-[10px] text-gray-500 leading-relaxed">Comma-separated suburbs. Only reaches people with a listing, or an active room request, in one of these — leave blank to target nobody in particular (same as Whole Community).</p>
                       </div>
                    )}
                    <div className="space-y-1">
                       <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest flex items-center gap-1"><UserX size={12} /> Hide From (optional)</label>
                       <input
                          value={excludeInput} onChange={e => setExcludeInput(e.target.value)}
                          placeholder="Resident IDs, comma-separated"
                          className="w-full bg-black border border-white/10 rounded-xl p-3 text-sm text-white outline-none focus:border-gold-primary/50 transition-all font-medium"
                       />
                       <p className="text-[10px] text-gray-500 leading-relaxed">Applies on top of whatever audience you picked above — a way to exclude specific people even from a public post.</p>
                    </div>
                    <p className="text-[10px] text-gray-500 leading-relaxed flex items-center gap-1"><Clock size={12} /> Free for the first 8 hours — after that it needs a paid extension to stay visible to anyone but you.</p>
                 </div>
              )}
              <div className="space-y-2">
                 <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Message Body</label>
                 <textarea
                    value={desc} onChange={e => setDesc(e.target.value)}
                    placeholder="Provide important details for your neighbors..."
                    className="w-full bg-black border border-white/10 rounded-xl p-3 text-sm text-white h-24 resize-none outline-none focus:border-gold-primary/50 transition-all font-medium"
                 />
              </div>
              <button type="submit" className="w-full bg-gold-primary text-black font-black py-3 rounded-xl text-xs uppercase tracking-widest transition-all hover:bg-gold-secondary shadow-lg shadow-gold-primary/10 active:scale-95">Publish to Community Wall</button>
           </form>
        )}

        {communityNotices.length === 0 ? (
          <div className="py-20 text-center text-gray-500 bg-white/2 rounded-3xl border border-dashed border-white/5">
             <Info size={48} className="mx-auto mb-4 opacity-10" />
             <p className="text-sm uppercase tracking-widest font-bold">Your neighborhood wall is clear</p>
             <p className="text-xs text-gray-600 mt-1 font-medium">Be the first to post a notice or event!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {communityNotices.map(notice => (
              <div key={notice.id} className={`bg-black/40 border rounded-2xl p-6 flex flex-col gap-5 transition-all group shadow-lg hover:shadow-gold-primary/5 ${isFeatured(notice) ? 'border-gold-primary/40' : 'border-white/5 hover:border-gold-primary/20'}`}>
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[9px] font-black px-2 py-1 rounded-lg uppercase tracking-widest border transition-all ${notice.type === 'event' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20 group-hover:bg-purple-500/20' : notice.type === 'landlord_announcement' ? 'bg-gold-primary/10 text-gold-primary border-gold-primary/20' : 'bg-blue-500/10 text-blue-400 border-blue-500/20 group-hover:bg-blue-500/20'}`}>
                      {notice.type === 'landlord_announcement' ? 'landlord announcement' : notice.type}
                    </span>
                    {notice.audience === 'my_tenants' && (
                      <span className="flex items-center gap-1 text-[9px] font-black px-2 py-1 rounded-lg uppercase tracking-widest border bg-white/5 text-gray-400 border-white/10">
                        <Users size={10} /> Tenants only
                      </span>
                    )}
                    {notice.audience === 'targeted' && notice.targetSuburbs && notice.targetSuburbs.length > 0 && (
                      <span className="flex items-center gap-1 text-[9px] font-black px-2 py-1 rounded-lg uppercase tracking-widest border bg-white/5 text-gray-400 border-white/10" title={notice.targetSuburbs.join(', ')}>
                        <MapPin size={10} /> {notice.targetSuburbs.length === 1 ? notice.targetSuburbs[0] : `${notice.targetSuburbs.length} areas`}
                      </span>
                    )}
                    {isFeatured(notice) && (
                      <span className="flex items-center gap-1 text-[9px] font-black px-2 py-1 rounded-lg uppercase tracking-widest border bg-gold-primary text-black border-gold-primary">
                        <Sparkles size={10} /> Boosted
                      </span>
                    )}
                    {notice.type !== 'event' && (
                      isExpired(notice) ? (
                        <span className="flex items-center gap-1 text-[9px] font-black px-2 py-1 rounded-lg uppercase tracking-widest border bg-red-500/10 text-red-400 border-red-500/20" title="Only visible to you until it's renewed">
                          <Clock size={10} /> Expired
                        </span>
                      ) : isPastFreeWindow(notice) ? (
                        <span className="flex items-center gap-1 text-[9px] font-black px-2 py-1 rounded-lg uppercase tracking-widest border bg-green-500/10 text-green-400 border-green-500/20">
                          <Clock size={10} /> Paid visibility
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-[9px] font-black px-2 py-1 rounded-lg uppercase tracking-widest border bg-white/5 text-gray-400 border-white/10">
                          <Clock size={10} /> Free · {hoursLeftInFreeWindow(notice)}h left
                        </span>
                      )
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    {isModerator && (
                      <>
                        <button onClick={() => onModerate?.('notice', notice.id, 'hide')} title="Hide notice" className="text-gray-600 hover:text-red-400 transition-colors">
                          <EyeOff size={13} />
                        </button>
                        <button onClick={() => onModerate?.('notice', notice.id, 'unhide')} title="Unhide notice" className="text-gray-600 hover:text-green-400 transition-colors">
                          <Eye size={13} />
                        </button>
                      </>
                    )}
                    <span className="text-[10px] text-gray-600 font-mono tracking-tighter opacity-60 font-bold">{new Date(notice.timestamp).toLocaleDateString()}</span>
                  </div>
                </div>

                <div className="space-y-2">
                   <h4 className="text-lg font-black text-white leading-tight group-hover:text-gold-primary transition-colors tracking-tight">
                      {notice.eventId && gruvsEventInfo[notice.eventId] ? gruvsEventInfo[notice.eventId].title : notice.title}
                   </h4>
                   <p className="text-sm text-gray-400 line-clamp-3 leading-relaxed opacity-80 font-medium">{notice.description}</p>
                </div>

                {notice.type === 'event' && (
                  <div className="flex items-center gap-3 text-[10px] font-black text-gold-primary bg-gold-primary/5 p-3 rounded-xl border border-gold-primary/10 uppercase tracking-widest shadow-inner">
                    <Calendar size={14} className="opacity-60" />
                    {notice.eventId && gruvsEventInfo[notice.eventId] ? (
                      <span>On The Gruvs: <span className="text-white ml-1">{formatGruvsEventWhen(gruvsEventInfo[notice.eventId].startsAt, { long: true })}</span></span>
                    ) : notice.eventDate ? (
                      <span>Scheduled: <span className="text-white ml-1">{notice.eventDate}</span></span>
                    ) : (
                      <span className="opacity-60">Event details unavailable</span>
                    )}
                  </div>
                )}

                <div className="mt-auto pt-6 border-t border-white/5 flex justify-between items-center">
                  <div className="flex items-center gap-2">
                     <div className="w-7 h-7 bg-gray-800 rounded-xl flex items-center justify-center text-[10px] font-black text-gold-primary transition-colors group-hover:bg-gold-primary group-hover:text-black">
                        {notice.postedBy.charAt(0)}
                     </div>
                     <span className="text-[10px] text-gray-500 font-black uppercase tracking-widest opacity-80">{notice.postedBy}</span>
                  </div>
                  <div className="flex gap-4">
                     <button onClick={() => handleVibeNotice?.(notice.id)} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-pink-500 transition-colors font-black active:scale-90">
                        <Heart size={18} className="transition-transform group-hover:scale-110" /> <span>{notice.vibes?.length || 0}</span>
                     </button>
                     <button onClick={() => handleEchoNotice?.(notice.id)} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-blue-500 transition-colors font-black active:scale-90">
                        <Share2 size={18} className="transition-transform group-hover:scale-110" /> <span>{notice.echos?.length || 0}</span>
                     </button>
                     {notice.type === 'event' && (
                       <button onClick={() => handleRSVPToEvent?.(notice.id)} className="flex items-center gap-2 text-[10px] text-green-500 bg-green-500/10 px-3 py-1.5 rounded-xl border border-green-500/20 hover:bg-green-500 hover:text-black transition-all font-black uppercase tracking-widest shadow-lg active:scale-90 ml-1">
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
                        className="w-full flex items-center justify-center gap-2 bg-red-500/10 hover:bg-red-500 hover:text-white border border-red-500/30 text-red-400 font-black py-2 rounded-xl text-[10px] uppercase tracking-widest transition-all active:scale-95"
                      />
                    )}
                    {!isFeatured(notice) && (
                      <UpgradeButton
                        item="notice_boost"
                        targetId={notice.id}
                        className="w-full flex items-center justify-center gap-2 bg-gold-primary/10 hover:bg-gold-primary hover:text-black border border-gold-primary/30 text-gold-primary font-black py-2 rounded-xl text-[10px] uppercase tracking-widest transition-all active:scale-95"
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
