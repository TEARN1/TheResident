'use client'

import React from 'react'
import { Home, Users, Award, RotateCcw, CheckCircle2, Star, Shield, Info } from 'lucide-react'

interface Member {
  userId: string
  name: string
  role: string
}

interface Chore {
  id: string
  title: string
  assignedTo: string
  status: 'pending' | 'completed'
  dueDate: string
  points: number
}

interface HouseholdTabProps {
  householdListingId: string | null
  householdName: string
  members: Member[]
  chores: Chore[]
  reputationScores: Record<string, number>
  currentUserId: string
  onRotate?: (tasks: string[], days: string[]) => void
  onComplete?: (id: string) => void
  styles: Record<string, React.CSSProperties>
}

export default function HouseholdTab({
  householdListingId,
  householdName,
  members,
  chores,
  reputationScores,
  currentUserId,
  onComplete
}: HouseholdTabProps) {
  if (!householdListingId) {
    return (
      <div className="glass-panel p-12 text-center">
         <Home size={48} className="mx-auto mb-4 text-gray-700" />
         <h3 className="text-xl font-bold text-white mb-2">No Active Household</h3>
         <p className="text-gray-500 max-w-md mx-auto">
            Once you are verified and move into a room, your household roster, chore scheduler, and reputation tracking will appear here.
         </p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
           <h2 className="text-2xl font-bold text-white">{householdName}</h2>
           <p className="text-gray-500 text-sm">Household Management & Shared Responsibilities</p>
        </div>
        <button className="flex items-center gap-2 bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10 px-4 py-2 rounded-lg text-sm transition-all">
           <RotateCcw size={16} /> Rotate Chores
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
         {/* Roster & Reputation */}
         <div className="space-y-6">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
               <Users size={20} className="text-gold-primary" /> Housemates
            </h3>
            <div className="glass-panel p-4 space-y-4">
               {members.map(member => (
                 <div key={member.userId} className={`flex items-center justify-between p-3 rounded-xl border ${member.userId === currentUserId ? 'bg-gold-primary/5 border-gold-primary/20' : 'bg-black/20 border-white/5'}`}>
                    <div className="flex items-center gap-3">
                       <div className="w-8 h-8 bg-gray-800 rounded-full flex items-center justify-center text-xs font-bold text-gold-primary">
                          {member.name.charAt(0)}
                       </div>
                       <div>
                          <p className="text-sm font-bold text-white">{member.name} {member.userId === currentUserId && '(You)'}</p>
                          <p className="text-[10px] text-gray-500 capitalize">{member.role}</p>
                       </div>
                    </div>
                    <div className="flex flex-col items-end">
                       <span className="text-xs font-bold text-gold-primary flex items-center gap-1">
                          <Star size={10} className="fill-gold-primary" /> {reputationScores[member.userId] || 0} XP
                       </span>
                    </div>
                 </div>
               ))}
            </div>

            <div className="glass-panel p-4 bg-blue-500/5 border-blue-500/10">
               <div className="flex gap-3">
                  <Shield size={20} className="text-blue-500 shrink-0" />
                  <div className="space-y-1">
                     <p className="text-xs font-bold text-white">Trust Level: High</p>
                     <p className="text-[10px] text-gray-500">Your household has a perfect chore completion rate this month.</p>
                  </div>
               </div>
            </div>
         </div>

         {/* Chore Scheduler */}
         <div className="lg:col-span-2 space-y-6">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
               <Award size={20} className="text-gold-primary" /> Active Tasks & Chores
            </h3>

            {chores.length === 0 ? (
              <div className="glass-panel p-12 text-center text-gray-500">
                 <Info size={32} className="mx-auto mb-2 opacity-20" />
                 <p>No chores assigned for this period. Enjoy the break!</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 {chores.map(chore => (
                   <div key={chore.id} className={`glass-panel p-5 border-l-4 ${chore.status === 'completed' ? 'border-l-green-500 opacity-60' : 'border-l-gold-primary'}`}>
                      <div className="flex justify-between items-start mb-2">
                         <h4 className={`font-bold ${chore.status === 'completed' ? 'text-gray-500 line-through' : 'text-white'}`}>{chore.title}</h4>
                         <span className="text-[10px] bg-gold-primary/10 text-gold-primary px-1.5 py-0.5 rounded">+{chore.points} XP</span>
                      </div>
                      <div className="flex justify-between items-end mt-4">
                         <div className="space-y-1">
                            <p className="text-[10px] text-gray-500">Assigned to: <span className="text-gray-300 font-bold">{members.find(m => m.userId === chore.assignedTo)?.name || 'Housemate'}</span></p>
                            <p className="text-[10px] text-gray-500">Due: <span className="text-gray-300">{chore.dueDate}</span></p>
                         </div>
                         {chore.status !== 'completed' && chore.assignedTo === currentUserId && (
                           <button
                            onClick={() => onComplete?.(chore.id)}
                            className="bg-gold-primary text-black font-bold px-4 py-1.5 rounded-lg text-[10px] hover:scale-105 transition-transform"
                           >
                            Mark Done
                           </button>
                         )}
                         {chore.status === 'completed' && (
                           <span className="text-green-500 flex items-center gap-1 text-[10px] font-bold">
                              <CheckCircle2 size={12} /> COMPLETED
                           </span>
                         )}
                      </div>
                   </div>
                 ))}
              </div>
            )}
         </div>
      </div>
    </div>
  )
}
