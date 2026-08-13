'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { Home, Users, Award, RotateCcw, CheckCircle2, Star, Shield, Info, DoorOpen } from 'lucide-react'
import { supabase } from '../../../utils/supabase'

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

interface ActiveTenancy {
  id: string
  tenantId: string
  landlordId: string
}

export default function HouseholdTab({
  householdListingId,
  householdName,
  members,
  chores,
  reputationScores,
  currentUserId,
  onComplete,
  onRotate
}: HouseholdTabProps) {
  const [rotating, setRotating] = useState(false)
  // "Rotate Chores" had no handler at all despite onRotate already existing
  // as a prop and store/actions.ts already having a real res_rotate_chores
  // RPC wired up (rotateChores) — nothing ever called either of them. Reuses
  // the current chore titles (or a sensible default set for a household with
  // none yet) rotated across a standard weekly cycle.
  const handleRotate = async () => {
    if (!onRotate) return
    const tasks = [...new Set(chores.map(c => c.title))]
    const taskList = tasks.length > 0 ? tasks : ['Kitchen', 'Bathroom', 'Trash', 'Common Area']
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].slice(0, taskList.length)
    setRotating(true)
    try {
      await onRotate(taskList, days)
    } finally {
      setRotating(false)
    }
  }
  // #9: one tenant, one landlord at a time — a tenancy has to have a real
  // way to end, or an approved tenant can never legitimately move again.
  const [activeTenancies, setActiveTenancies] = useState<ActiveTenancy[]>([])
  const [ending, setEnding] = useState<string | null>(null)
  const [endError, setEndError] = useState<string | null>(null)

  const loadActiveTenancies = useCallback(async () => {
    if (!supabase || !householdListingId || !currentUserId) return
    const { data } = await supabase
      .from('res_room_requests')
      .select('id, tenant_id, landlord_id')
      .eq('listing_id', householdListingId)
      .eq('status', 'approved')
      .or(`tenant_id.eq.${currentUserId},landlord_id.eq.${currentUserId}`)
    setActiveTenancies((data || []).map(r => ({ id: r.id, tenantId: r.tenant_id, landlordId: r.landlord_id })))
  }, [householdListingId, currentUserId])

  useEffect(() => {
    const id = setTimeout(() => { loadActiveTenancies() }, 0)
    return () => clearTimeout(id)
  }, [loadActiveTenancies])

  const endTenancy = async (requestId: string) => {
    if (!supabase) return
    setEnding(requestId)
    setEndError(null)
    const { error } = await supabase.rpc('res_end_tenancy', { p_request: requestId })
    setEnding(null)
    if (error) { setEndError(error.message); return }
    loadActiveTenancies()
  }

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
        <button
          onClick={handleRotate}
          disabled={rotating}
          className="flex items-center gap-2 bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10 px-4 py-2 rounded-lg text-sm transition-all disabled:opacity-50"
        >
           <RotateCcw size={16} className={rotating ? 'animate-spin' : ''} /> {rotating ? 'Rotating…' : 'Rotate Chores'}
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

            {activeTenancies.length > 0 && (
              <div className="glass-panel p-4 space-y-3">
                 <p className="text-xs font-bold text-white flex items-center gap-2">
                    <DoorOpen size={16} className="text-gold-primary" /> Tenancy
                 </p>
                 {activeTenancies.map(t => (
                   <div key={t.id} className="flex items-center justify-between gap-2">
                      <p className="text-[10px] text-gray-500">
                         {t.tenantId === currentUserId ? 'You are renting here.' : 'They rent from you here.'}
                      </p>
                      <button
                        onClick={() => endTenancy(t.id)}
                        disabled={ending === t.id}
                        className="text-[10px] font-bold text-red-400 hover:text-red-300 uppercase tracking-widest disabled:opacity-50 shrink-0"
                      >
                        {ending === t.id ? 'Ending…' : 'End Tenancy'}
                      </button>
                   </div>
                 ))}
                 {endError && <p className="text-[10px] text-red-400">{endError}</p>}
                 <p className="text-[9px] text-gray-600">Ending a tenancy frees the room and lets you apply elsewhere — you can only hold one active tenancy at a time.</p>
              </div>
            )}
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
