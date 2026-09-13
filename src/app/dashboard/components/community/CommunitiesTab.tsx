'use client'

import React from 'react'
import Link from 'next/link'
import { MapPin, Users, Plus, ShieldCheck, ArrowRight, Info, Check } from 'lucide-react'

interface Community {
  id: string
  name: string
  kind: 'street' | 'block' | 'complex' | 'estate' | 'suburb'
  suburb: string
  memberCount: number
}

interface CommunitiesTabProps {
  communities: Community[]
  memberOf: string[]
  currentUserId: string
  onJoin?: (id: string) => void
  onRegisterGroup?: () => void
}

export default function CommunitiesTab({
  communities,
  memberOf,
  onJoin,
  onRegisterGroup
}: CommunitiesTabProps) {
  return (
    <div className="space-y-6">
      <div className="glass-panel p-6">
        <div className="flex justify-between items-center mb-10">
           <div>
              <h3 className="text-xl font-bold text-content flex items-center gap-2">
                 <Users size={24} className="text-accent" /> Community Groups
              </h3>
              <p className="text-xs text-content-muted mt-1 uppercase tracking-widest font-black opacity-60">Organize and protect your immediate neighbors.</p>
           </div>
           <button
              onClick={() => onRegisterGroup?.()}
              className="bg-accent text-content-on-accent font-black px-4 py-2 rounded-lg text-xs uppercase tracking-widest transition-all hover:bg-accent shadow-lg shadow-gold-primary/10 flex items-center gap-2"
           >
              <Plus size={16}/> Register Group
           </button>
        </div>

        {communities.length === 0 ? (
          <div className="py-12 text-center text-content-muted">
             <Info size={32} className="mx-auto mb-2 opacity-20" />
             <p>No community groups found in your immediate area.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {communities.map(community => {
              const isMember = memberOf.includes(community.id)
              return (
                <div key={community.id} className={`glass-panel p-5 flex items-center justify-between group hover:border-accent/30 transition-all ${isMember ? 'border-accent/20 bg-accent/5' : 'hover:bg-surface-raised/[0.02]'}`}>
                   <div className="flex items-center gap-4">
                      <div className={`p-4 rounded-2xl transition-all motion-slow ${isMember ? 'bg-accent text-content-on-accent scale-105 shadow-lg shadow-gold-primary/20' : 'bg-surface-raised/5 text-content-muted group-hover:text-content group-hover:bg-surface-raised/10'}`}>
                         <MapPin size={24} />
                      </div>
                      <div className="space-y-1">
                         <h4 className="font-black text-content text-lg flex items-center gap-2 tracking-tight">
                            {community.name}
                            {isMember && <ShieldCheck size={16} className="text-accent" />}
                         </h4>
                         <div className="flex items-center gap-3 text-xs text-content-muted font-black uppercase tracking-widest">
                            <span className="bg-surface-raised/5 px-2 py-0.5 rounded text-content-muted">{community.kind}</span>
                            <span className="text-accent/40">•</span>
                            <span>{community.suburb}</span>
                            <span className="text-accent/40">•</span>
                            <span className="text-content/40">{community.memberCount} MEMBERS</span>
                         </div>
                      </div>
                   </div>

                   {isMember ? (
                     <span className="flex items-center gap-1 text-xs text-accent font-black bg-accent/10 px-3 py-1.5 rounded-full border border-accent/20 uppercase tracking-widest">
                        <Check size={12} /> Active Member
                     </span>
                   ) : (
                     <button
                        onClick={() => onJoin?.(community.id)}
                        className="bg-surface-raised/5 hover:bg-accent hover:text-content-on-accent text-content p-2.5 rounded-xl border border-default transition-all hover:border-accent active:scale-90"
                        title="Join Group"
                     >
                        <ArrowRight size={20} />
                     </button>
                   )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="glass-panel p-8 bg-info/5 border-info/10 flex flex-col md:flex-row gap-6 items-center md:items-start group/verified">
         <div className="p-4 bg-info/20 rounded-2xl h-fit shadow-xl shadow-info/10 group-hover/verified:bg-info/30 transition-colors">
            <ShieldCheck size={32} className="text-info" />
         </div>
         <div className="text-center md:text-left space-y-2">
            <h4 className="font-black text-content uppercase tracking-widest">Trust & Hierarchy Audit</h4>
            {/* This used to promise "higher reputation limits", "access to
                emergency dispatch features", "premium complex groups" and
                "Street Captain status". NONE of those exist — not in the
                code, not in the schema, nowhere. A resident reading it would
                go looking for features that were never built, and the
                emergency-dispatch line is the dangerous one: it implies
                verification unlocks something in a crisis. It does not. */}
            <p className="text-sm text-content-muted leading-relaxed max-w-2xl">Verifying your profile shows other residents that someone has checked who you are. It is how neighbours decide whether to trust you with a room, a lift or a key — and it is the same badge landlords look for on an application.</p>
            <Link href="/dashboard/profile" className="text-info text-xs font-black uppercase tracking-widest hover:underline pt-2 inline-block">View Verification Requirements →</Link>
         </div>
      </div>
    </div>
  )
}
