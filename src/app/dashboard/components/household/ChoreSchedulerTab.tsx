'use client'

import React from 'react'
import { Award, Calendar, CheckCircle2, Star, User, Info, Zap } from 'lucide-react'

interface Chore {
  id: string
  title: string
  assignedTo: string
  status: 'pending' | 'completed'
  dueDate: string
  points: number
}

interface ChoreSchedulerTabProps {
  communityChores: Chore[]
  currentUser: { id: string; name: string } | null
  reputationScores: Record<string, number>
  handleCompleteChore?: (id: string, title: string) => void
}

export default function ChoreSchedulerTab({
  communityChores,
  currentUser,
  reputationScores,
  handleCompleteChore
}: ChoreSchedulerTabProps) {
  const myChores = communityChores.filter(c => c.assignedTo === currentUser?.id)
  const otherChores = communityChores.filter(c => c.assignedTo !== currentUser?.id)

  const renderChore = (chore: Chore) => (
    <div key={chore.id} className={`glass-panel p-6 border-l-4 transition-all motion-slow relative overflow-hidden group ${chore.status === 'completed' ? 'border-l-green-500/30 opacity-60 grayscale-[0.5]' : 'border-l-gold-primary hover:border-l-white hover:bg-surface-raised/[0.02] shadow-lg shadow-black/10'}`}>
       {chore.status === 'pending' && (
         <div className="absolute top-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <Zap size={16} className="text-accent animate-pulse" />
         </div>
       )}

       <div className="flex justify-between items-start mb-6">
          <div className="space-y-1">
             <h4 className={`font-black text-lg tracking-tight ${chore.status === 'completed' ? 'text-content-muted line-through' : 'text-content'}`}>{chore.title}</h4>
             <div className="flex items-center gap-2 text-xs text-content-muted font-black uppercase tracking-widest">
                <Calendar size={12} className="text-accent" /> DUE: <span className={chore.status === 'completed' ? 'text-content-subtle' : 'text-content'}>{chore.dueDate}</span>
             </div>
          </div>
          <div className={`px-2 py-1 rounded-lg border font-black text-xs tracking-tighter transition-colors ${chore.status === 'completed' ? 'bg-success/10 text-success border-success/20' : 'bg-accent/10 text-accent border-accent/20 group-hover:bg-accent group-hover:text-content-on-accent'}`}>
             +{chore.points} XP
          </div>
       </div>

       <div className="flex justify-between items-center mt-auto">
          <div className="flex items-center gap-3">
             <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black transition-all ${chore.assignedTo === currentUser?.id ? 'bg-accent text-content-on-accent' : 'bg-surface-raised text-content-muted'}`}>
                {chore.assignedTo === currentUser?.id ? 'ME' : 'HM'}
             </div>
             <div className="flex flex-col">
                <span className="text-xs text-content-muted font-bold uppercase tracking-widest">Assignee</span>
                <span className="text-xs text-content font-black">{chore.assignedTo === currentUser?.id ? 'You' : 'Housemate'}</span>
             </div>
          </div>

          {chore.status === 'pending' && chore.assignedTo === currentUser?.id && (
            <button
                onClick={() => handleCompleteChore?.(chore.id, chore.title)}
                className="bg-surface-raised/5 hover:bg-success hover:text-content border border-default hover:border-success text-content font-black px-5 py-2 rounded-xl text-xs uppercase tracking-widest transition-all active:scale-90 shadow-lg"
            >
                Confirm Completion
            </button>
          )}

          {chore.status === 'completed' && (
            <div className="flex items-center gap-2 text-success text-xs font-black uppercase tracking-widest bg-success/5 px-3 py-1.5 rounded-full border border-success/20">
               <CheckCircle2 size={14} /> Task Validated
            </div>
          )}
       </div>
    </div>
  )

  return (
    <div className="space-y-10">
      {/* XP Master Banner */}
      <div className="glass-panel p-8 bg-gradient-to-br from-accent/10 via-surface-sunken/40 to-surface-sunken/20 border-accent/30 flex flex-col md:flex-row justify-between items-center gap-8 shadow-2xl relative overflow-hidden group/banner">
         <div className="absolute top-0 right-0 w-64 h-64 bg-accent/5 rounded-full -mr-32 -mt-32 blur-3xl group-hover/banner:bg-accent/10 transition-all motion-slow" />

         <div className="flex items-center gap-6 relative z-10">
            <div className="p-5 bg-accent rounded-3xl shadow-[0_0_30px_rgba(212,175,55,0.3)] rotate-3 group-hover/banner:rotate-0 transition-transform motion-slow">
               <Award size={40} className="text-content-on-accent" />
            </div>
            <div className="space-y-1">
               <h3 className="text-2xl font-black text-content tracking-tighter">Citizen Reputation</h3>
               <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5 text-accent font-black text-lg">
                     <Star size={20} className="fill-gold-primary" /> {reputationScores[currentUser?.id || ''] || 0}
                  </div>
                  <span className="text-xs text-content-muted uppercase font-black tracking-[0.2em] border-l border-default pl-3">Total Earned XP</span>
               </div>
            </div>
         </div>

         <div className="text-center md:text-right relative z-10 bg-surface-sunken/40 backdrop-blur-md p-4 rounded-2xl border border-subtle px-8">
            <p className="text-xs text-content-muted uppercase tracking-[0.3em] font-black mb-1">Status Rank</p>
            <p className="text-2xl font-black text-content italic tracking-tighter">ELITE RESIDENT</p>
            <div className="h-1 bg-surface-raised rounded-full mt-2 overflow-hidden w-32 ml-auto">
               <div className="h-full bg-accent w-4/5 shadow-[0_0_10px_var(--accent)]" />
            </div>
         </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
         {/* My Tasks */}
         <div className="space-y-6">
            <div className="flex items-center justify-between">
               <h3 className="text-xl font-black text-content flex items-center gap-3 tracking-tight">
                  <User size={24} className="text-accent" /> My Active Chores
               </h3>
               <span className="text-xs font-black text-content-muted bg-surface-raised/5 px-2 py-1 rounded-lg uppercase tracking-widest">{myChores.filter(c => c.status === 'pending').length} PENDING</span>
            </div>

            {myChores.filter(c => c.status === 'pending').length === 0 ? (
               <div className="glass-panel p-16 text-center text-content-subtle bg-surface-raised/[0.02] border-dashed border-default rounded-3xl">
                  <CheckCircle2 size={48} className="mx-auto mb-4 text-success/20" />
                  <p className="text-sm font-black uppercase tracking-widest text-content-muted">Inventory Clear</p>
                  <p className="text-xs mt-1 opacity-60">All personal responsibilities are up to date.</p>
               </div>
            ) : (
               <div className="space-y-4">
                  {myChores.filter(c => c.status === 'pending').map(renderChore)}
               </div>
            )}
         </div>

         {/* Household Rota */}
         <div className="space-y-6">
            <h3 className="text-xl font-black text-content flex items-center gap-3 tracking-tight">
               <Calendar size={24} className="text-accent" /> Household Rota
            </h3>
            {otherChores.length === 0 && myChores.filter(c => c.status === 'completed').length === 0 ? (
               <div className="glass-panel p-16 text-center text-content-subtle bg-surface-raised/[0.02] border-dashed border-default rounded-3xl">
                  <Info size={48} className="mx-auto mb-4 opacity-10" />
                  <p className="text-sm font-black uppercase tracking-widest text-content-muted">History Empty</p>
                  <p className="text-xs mt-1 opacity-60">No community chore logs found for this cycle.</p>
               </div>
            ) : (
               <div className="space-y-4">
                  {[...otherChores, ...myChores.filter(c => c.status === 'completed')]
                    .sort((a, b) => (a.status === 'completed' ? 1 : 0) - (b.status === 'completed' ? 1 : 0))
                    .map(renderChore)}
               </div>
            )}
         </div>
      </div>
    </div>
  )
}
