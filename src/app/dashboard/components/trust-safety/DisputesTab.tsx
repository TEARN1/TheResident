'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { Gavel, Clock, CheckCircle2, AlertTriangle, User, MessageSquare, Plus, Loader } from 'lucide-react'

interface Dispute {
  id: string
  title: string
  description: string
  category: string
  reportedBy: string
  reportedById: string
  againstUser: string
  againstUserId: string
  status: 'pending' | 'resolved' | 'investigating'
  timestamp: string
  resolutionDetails?: string
}

interface DisputesTabProps {
  communityDisputes: Dispute[]
  currentUser: { id: string; role: string } | null
  onFileDispute?: () => void
  onModerate?: (disputeId: string, status: 'pending' | 'mediating' | 'resolved', resolutionDetails?: string) => void
}

export default function DisputesTab({
  communityDisputes,
  currentUser,
  onFileDispute,
  onModerate
}: DisputesTabProps) {
  // "Moderate Case" had no handler despite a real updateDisputeStatus
  // action (and DB sync via res_community_disputes) already existing —
  // nothing in the UI ever dispatched it. Inline panel rather than a modal:
  // a landlord moving a case to mediation, or resolving it with a note.
  const [moderating, setModerating] = useState<string | null>(null)
  const [resolutionDraft, setResolutionDraft] = useState('')
  const [saving, setSaving] = useState(false)

  const startMediation = (disputeId: string) => {
    // onModerate is a synchronous, optimistic Redux dispatch (the real DB
    // write happens later, untracked here) — resetting `saving` right after
    // calling it made the disabled state a no-op against a double-click in
    // the same tick. Left true instead: the dispute's status flips to
    // 'mediating' on the very next render, which unmounts this button
    // itself (see the `dispute.status === 'pending'` guard around it), so
    // there's nothing left to double-submit into. Reset happens when a
    // moderation panel is (re)opened, in toggleModerating below.
    setSaving(true)
    onModerate?.(disputeId, 'mediating')
  }

  const resolveCase = (disputeId: string) => {
    if (!resolutionDraft.trim()) return
    setSaving(true)
    onModerate?.(disputeId, 'resolved', resolutionDraft.trim())
    setSaving(false)
    setModerating(null)
    setResolutionDraft('')
  }

  const toggleModerating = (disputeId: string) => {
    setModerating(prev => (prev === disputeId ? null : disputeId))
    setSaving(false)
    setResolutionDraft('')
  }
  return (
    <div className="space-y-6">
      <div className="glass-panel p-6">
        <div className="flex justify-between items-center mb-6">
           <div>
              <h3 className="text-xl font-bold text-gold-primary flex items-center gap-2">
                 <Gavel size={20} /> Mediation & Disputes
              </h3>
              <p className="text-xs text-gray-500 mt-1">Resolve household or community issues through formal mediation.</p>
           </div>
           <button
            onClick={() => onFileDispute?.()}
            className="bg-gold-primary text-black font-bold px-4 py-2 rounded-lg text-sm transition-all flex items-center gap-2"
           >
              <Plus size={16}/> File Dispute
           </button>
        </div>

        <p className="text-xs text-gray-500 mb-8 border-l-2 border-gold-primary/30 pl-4 italic">
           Landlords and street captains act as moderators to ensure fair outcomes. All discussions are logged for accountability and neighbor protection.
        </p>

        {communityDisputes.length === 0 ? (
          <div className="py-12 text-center text-gray-500">
             <CheckCircle2 size={32} className="mx-auto mb-2 opacity-20" />
             <p>No active disputes in your household or community.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {communityDisputes.map(dispute => (
              <div key={dispute.id} className="bg-black/40 border border-white/5 rounded-xl overflow-hidden hover:border-white/10 transition-colors group">
                <div className="p-5 flex flex-col md:flex-row justify-between gap-6">
                   <div className="flex-1 space-y-3">
                      <div className="flex items-center gap-3">
                         <span className={`text-[9px] font-black px-2 py-0.5 rounded uppercase border tracking-widest ${dispute.status === 'resolved' ? 'bg-green-500/10 text-green-500 border-green-500/20' : 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'}`}>
                            {dispute.status}
                         </span>
                         <span className="text-[10px] text-gray-600 font-mono flex items-center gap-1"><Clock size={10} /> {dispute.timestamp}</span>
                      </div>
                      <h4 className="font-bold text-white text-lg group-hover:text-gold-primary transition-colors">{dispute.title}</h4>
                      <p className="text-sm text-gray-400 leading-relaxed">{dispute.description}</p>

                      <div className="flex flex-wrap gap-4 pt-2">
                         <div className="flex items-center gap-2 text-[10px] text-gray-500 font-bold uppercase tracking-tighter">
                            <User size={12} className="text-gold-primary" /> Reported by: <span className="text-gray-300 ml-1">{dispute.reportedBy}</span>
                         </div>
                         <div className="flex items-center gap-2 text-[10px] text-gray-500 font-bold uppercase tracking-tighter">
                            <AlertTriangle size={12} className="text-gold-primary" /> Against: <span className="text-gray-300 ml-1">{dispute.againstUser}</span>
                         </div>
                      </div>
                   </div>

                   <div className="flex flex-col md:items-end justify-center gap-3">
                      {dispute.status !== 'resolved' && currentUser?.role === 'landlord' && (
                        <button
                          onClick={() => toggleModerating(dispute.id)}
                          className="bg-gold-primary text-black font-black px-6 py-2 rounded-lg text-[10px] uppercase tracking-widest hover:bg-gold-secondary transition-all shadow-lg shadow-gold-primary/10"
                        >
                          {moderating === dispute.id ? 'Cancel' : 'Moderate Case'}
                        </button>
                      )}
                      {currentUser && (dispute.reportedById === currentUser.id || dispute.againstUserId === currentUser.id) && (
                        <Link
                          href={`/dashboard/messages?to=${dispute.reportedById === currentUser.id ? dispute.againstUserId : dispute.reportedById}`}
                          className="flex items-center gap-2 text-xs text-gray-500 hover:text-white transition-colors font-bold group/btn"
                        >
                           <MessageSquare size={14} className="group-hover/btn:text-gold-primary transition-colors" /> Message the other party
                        </Link>
                      )}
                   </div>
                </div>

                {moderating === dispute.id && (
                  <div className="bg-black/60 border-t border-white/5 p-5 space-y-3">
                     {dispute.status === 'pending' && (
                       <button
                         onClick={() => startMediation(dispute.id)}
                         disabled={saving}
                         className="text-xs font-bold text-gold-primary hover:underline disabled:opacity-50"
                       >
                         Start mediation →
                       </button>
                     )}
                     <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest block">Resolution notes</label>
                     <textarea
                       value={resolutionDraft}
                       onChange={e => setResolutionDraft(e.target.value)}
                       placeholder="How was this resolved?"
                       className="w-full bg-black border border-white/10 rounded-lg p-3 text-sm text-white h-20 resize-none outline-none focus:border-gold-primary/40"
                     />
                     <button
                       onClick={() => resolveCase(dispute.id)}
                       disabled={saving || !resolutionDraft.trim()}
                       className="flex items-center gap-2 bg-gold-primary text-black font-black px-4 py-2 rounded-lg text-[10px] uppercase tracking-widest disabled:opacity-50"
                     >
                       {saving ? <Loader size={12} className="animate-spin" /> : null} Mark Resolved
                     </button>
                  </div>
                )}

                {dispute.status === 'resolved' && dispute.resolutionDetails && (
                  <div className="bg-green-500/5 border-t border-white/5 p-5 flex gap-4">
                     <CheckCircle2 size={18} className="text-green-500 shrink-0 mt-0.5" />
                     <div className="space-y-1">
                        <p className="text-[10px] text-green-500 font-black uppercase tracking-widest">Resolution Outcome</p>
                        <p className="text-sm text-gray-400 italic leading-relaxed">&quot;{dispute.resolutionDetails}&quot;</p>
                     </div>
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
