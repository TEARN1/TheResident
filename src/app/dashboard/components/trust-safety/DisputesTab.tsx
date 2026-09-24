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
    setSaving(true)
    onModerate?.(disputeId, 'mediating')
    setSaving(false)
  }

  const resolveCase = (disputeId: string) => {
    if (!resolutionDraft.trim()) return
    setSaving(true)
    onModerate?.(disputeId, 'resolved', resolutionDraft.trim())
    setSaving(false)
    setModerating(null)
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
              <div
                key={dispute.id}
                className="glass-panel p-6 border-white/10 hover:border-gold-primary/30 transition-all duration-300 group shadow-lg"
              >
                <div className="flex flex-col md:flex-row justify-between gap-6">
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-3">
                      <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase border tracking-wider backdrop-blur-md ${
                        dispute.status === 'resolved'
                          ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                          : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                      }`}>
                        {dispute.status}
                      </span>
                      <span className="text-[11px] text-gray-400 font-mono flex items-center gap-1.5">
                        <Clock size={12} className="text-gray-500" /> {dispute.timestamp}
                      </span>
                    </div>

                    <h4 className="font-black text-white text-lg group-hover:text-gold-primary transition-colors tracking-tight leading-snug">
                      {dispute.title}
                    </h4>
                    <p className="text-sm text-gray-300 leading-relaxed font-normal">{dispute.description}</p>

                    <div className="flex flex-wrap gap-4 pt-2">
                      <div className="flex items-center gap-2 text-xs text-gray-400 font-medium">
                        <User size={13} className="text-gold-primary" />
                        <span>Reported by: <strong className="text-white ml-0.5">{dispute.reportedBy}</strong></span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-400 font-medium">
                        <AlertTriangle size={13} className="text-amber-400" />
                        <span>Against: <strong className="text-white ml-0.5">{dispute.againstUser}</strong></span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col md:items-end justify-center gap-3 shrink-0">
                    {dispute.status !== 'resolved' && currentUser?.role === 'landlord' && (
                      <button
                        onClick={() => setModerating(moderating === dispute.id ? null : dispute.id)}
                        className="bg-gold-primary text-black font-black px-5 py-2.5 rounded-xl text-xs uppercase tracking-wider hover:bg-gold-secondary transition-all shadow-lg shadow-gold-primary/20 active:scale-95"
                      >
                        {moderating === dispute.id ? 'Cancel' : 'Moderate Case'}
                      </button>
                    )}
                    {currentUser && (dispute.reportedById === currentUser.id || dispute.againstUserId === currentUser.id) && (
                      <Link
                        href={`/dashboard/messages?to=${dispute.reportedById === currentUser.id ? dispute.againstUserId : dispute.reportedById}`}
                        className="inline-flex items-center gap-2 text-xs text-gray-400 hover:text-gold-primary bg-white/5 hover:bg-white/10 px-3.5 py-2 rounded-xl border border-white/10 transition-all font-semibold"
                      >
                        <MessageSquare size={14} className="text-gold-primary" /> Message the other party
                      </Link>
                    )}
                  </div>
                </div>

                {moderating === dispute.id && (
                  <div className="bg-black/50 border border-white/10 rounded-2xl p-5 mt-4 space-y-3.5 backdrop-blur-md">
                    {dispute.status === 'pending' && (
                      <button
                        onClick={() => startMediation(dispute.id)}
                        disabled={saving}
                        className="text-xs font-bold text-gold-primary hover:underline disabled:opacity-50 block"
                      >
                        Start mediation →
                      </button>
                    )}
                    <label className="text-[10px] text-gray-400 uppercase font-black tracking-widest block">Resolution Notes</label>
                    <textarea
                      value={resolutionDraft}
                      onChange={e => setResolutionDraft(e.target.value)}
                      placeholder="How was this case resolved?"
                      className="w-full bg-black/60 border border-white/10 rounded-xl p-3 text-sm text-white h-20 resize-none outline-none focus:border-gold-primary/50"
                    />
                    <button
                      onClick={() => resolveCase(dispute.id)}
                      disabled={saving || !resolutionDraft.trim()}
                      className="flex items-center gap-2 bg-gradient-to-r from-gold-primary to-amber-300 text-black font-black px-5 py-2.5 rounded-xl text-xs uppercase tracking-wider disabled:opacity-50 shadow-md shadow-gold-primary/20 active:scale-95"
                    >
                      {saving ? <Loader size={13} className="animate-spin" /> : null} Mark Resolved
                    </button>
                  </div>
                )}

                {dispute.status === 'resolved' && dispute.resolutionDetails && (
                  <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 mt-4 flex gap-3.5 backdrop-blur-md">
                    <CheckCircle2 size={18} className="text-emerald-400 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="text-[10px] text-emerald-400 font-black uppercase tracking-wider">Resolution Outcome</p>
                      <p className="text-sm text-gray-200 italic leading-relaxed">&quot;{dispute.resolutionDetails}&quot;</p>
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
