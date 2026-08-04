'use client'

import React, { useState } from 'react'
import { Megaphone, Calendar, Info, Heart, Share2, Check, Plus, X } from 'lucide-react'

interface Notice {
  id: string
  title: string
  description: string
  type: 'notice' | 'event'
  postedBy: string
  postedById?: string
  timestamp: string
  eventDate?: string
  vibes?: string[]
  echos?: string[]
  rsvps: string[]
}

interface NoticeBoardTabProps {
  communityNotices: Notice[]
  currentUser: { name: string; id: string; role: string } | null
  handleVibeNotice?: (id: string) => void
  handleEchoNotice?: (id: string) => void
  handleRSVPToEvent?: (id: string) => void
  handlePostNotice?: (e: React.FormEvent) => void
}

export default function NoticeBoardTab({
  communityNotices,
  handleVibeNotice,
  handleEchoNotice,
  handleRSVPToEvent,
  handlePostNotice
}: NoticeBoardTabProps) {
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [desc, setDesc] = useState('')
  const [type, setType] = useState<'notice' | 'event'>('notice')

  const onPostSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !desc.trim()) return
    handlePostNotice?.(e)
    setShowForm(false)
    setTitle('')
    setDesc('')
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
                 <div className="space-y-2">
                    <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Notice Title</label>
                    <input
                       value={title} onChange={e => setTitle(e.target.value)}
                       placeholder="e.g. Street Meeting Saturday"
                       className="w-full bg-black border border-white/10 rounded-xl p-3 text-sm text-white outline-none focus:border-gold-primary/50 transition-all font-medium"
                    />
                 </div>
                 <div className="space-y-2">
                    <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Announcement Type</label>
                    <select
                       value={type} onChange={e => setType(e.target.value as 'notice' | 'event')}
                       className="w-full bg-black border border-white/10 rounded-xl p-3 text-sm text-white outline-none focus:border-gold-primary/50 transition-all font-medium cursor-pointer"
                    >
                       <option value="notice">General Notice</option>
                       <option value="event">Community Event</option>
                    </select>
                 </div>
              </div>
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
              <div key={notice.id} className="bg-black/40 border border-white/5 rounded-2xl p-6 flex flex-col gap-5 hover:border-gold-primary/20 transition-all group shadow-lg hover:shadow-gold-primary/5">
                <div className="flex justify-between items-start">
                  <span className={`text-[9px] font-black px-2 py-1 rounded-lg uppercase tracking-widest border transition-all ${notice.type === 'event' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20 group-hover:bg-purple-500/20' : 'bg-blue-500/10 text-blue-400 border-blue-500/20 group-hover:bg-blue-500/20'}`}>
                    {notice.type}
                  </span>
                  <span className="text-[10px] text-gray-600 font-mono tracking-tighter opacity-60 font-bold">{new Date(notice.timestamp).toLocaleDateString()}</span>
                </div>

                <div className="space-y-2">
                   <h4 className="text-lg font-black text-white leading-tight group-hover:text-gold-primary transition-colors tracking-tight">{notice.title}</h4>
                   <p className="text-sm text-gray-400 line-clamp-3 leading-relaxed opacity-80 font-medium">{notice.description}</p>
                </div>

                {notice.type === 'event' && notice.eventDate && (
                  <div className="flex items-center gap-3 text-[10px] font-black text-gold-primary bg-gold-primary/5 p-3 rounded-xl border border-gold-primary/10 uppercase tracking-widest shadow-inner">
                    <Calendar size={14} className="opacity-60" /> <span>Scheduled: <span className="text-white ml-1">{notice.eventDate}</span></span>
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
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
