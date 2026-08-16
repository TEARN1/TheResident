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
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                 <Users size={24} className="text-gold-primary" /> Community Groups
              </h3>
              <p className="text-xs text-gray-500 mt-1 uppercase tracking-widest font-black opacity-60">Organize and protect your immediate neighbors.</p>
           </div>
           <button
              onClick={() => onRegisterGroup?.()}
              className="bg-gold-primary text-black font-black px-4 py-2 rounded-lg text-xs uppercase tracking-widest transition-all hover:bg-gold-secondary shadow-lg shadow-gold-primary/10 flex items-center gap-2"
           >
              <Plus size={16}/> Register Group
           </button>
        </div>

        {communities.length === 0 ? (
          <div className="py-12 text-center text-gray-500">
             <Info size={32} className="mx-auto mb-2 opacity-20" />
             <p>No community groups found in your immediate area.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {communities.map(community => {
              const isMember = memberOf.includes(community.id)
              return (
                <div key={community.id} className={`glass-panel p-5 flex items-center justify-between group hover:border-gold-primary/30 transition-all ${isMember ? 'border-gold-primary/20 bg-gold-primary/5' : 'hover:bg-white/2'}`}>
                   <div className="flex items-center gap-4">
                      <div className={`p-4 rounded-2xl transition-all duration-300 ${isMember ? 'bg-gold-primary text-black scale-105 shadow-lg shadow-gold-primary/20' : 'bg-white/5 text-gray-400 group-hover:text-white group-hover:bg-white/10'}`}>
                         <MapPin size={24} />
                      </div>
                      <div className="space-y-1">
                         <h4 className="font-black text-white text-lg flex items-center gap-2 tracking-tight">
                            {community.name}
                            {isMember && <ShieldCheck size={16} className="text-gold-primary" />}
                         </h4>
                         <div className="flex items-center gap-3 text-[9px] text-gray-500 font-black uppercase tracking-widest">
                            <span className="bg-white/5 px-2 py-0.5 rounded text-gray-400">{community.kind}</span>
                            <span className="text-gold-primary/40">•</span>
                            <span>{community.suburb}</span>
                            <span className="text-gold-primary/40">•</span>
                            <span className="text-white/40">{community.memberCount} MEMBERS</span>
                         </div>
                      </div>
                   </div>

                   {isMember ? (
                     <span className="flex items-center gap-1 text-[10px] text-gold-primary font-black bg-gold-primary/10 px-3 py-1.5 rounded-full border border-gold-primary/20 uppercase tracking-widest">
                        <Check size={12} /> Active Member
                     </span>
                   ) : (
                     <button
                        onClick={() => onJoin?.(community.id)}
                        className="bg-white/5 hover:bg-gold-primary hover:text-black text-gray-300 p-2.5 rounded-xl border border-white/10 transition-all hover:border-gold-primary active:scale-90"
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

      <div className="glass-panel p-8 bg-blue-500/5 border-blue-500/10 flex flex-col md:flex-row gap-6 items-center md:items-start group/verified">
         <div className="p-4 bg-blue-500/20 rounded-2xl h-fit shadow-xl shadow-blue-900/10 group-hover/verified:bg-blue-500/30 transition-colors">
            <ShieldCheck size={32} className="text-blue-400" />
         </div>
         <div className="text-center md:text-left space-y-2">
            <h4 className="font-black text-white uppercase tracking-widest">Trust & Hierarchy Audit</h4>
            <p className="text-sm text-gray-400 leading-relaxed max-w-2xl">Verified groups have higher reputation limits and access to emergency dispatch features. Ensure your profile is verified to join premium complex groups or to apply for Street Captain status.</p>
            <Link href="/dashboard/profile" className="text-blue-400 text-xs font-black uppercase tracking-widest hover:underline pt-2 inline-block">View Verification Requirements →</Link>
         </div>
      </div>
    </div>
  )
}
