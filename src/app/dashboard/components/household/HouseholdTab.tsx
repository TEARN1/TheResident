'use client'

import React, { useCallback, useEffect, useState } from 'react'
import {
  Home, Users, Award, RotateCcw, CheckCircle2, Star, Shield, Info, DoorOpen,
  ShoppingCart, Calendar, Moon, Scale, Package, Plus, Trash2, Camera, Check
} from 'lucide-react'
import { supabase } from '../../../../utils/supabase'

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

  // Batch A: Grocery Checklist State
  const [groceryItems, setGroceryItems] = useState<Array<{ id: string; name: string; estPrice: number; bought: boolean; addedBy: string }>>([
    { id: 'g1', name: 'Dish Soap (750ml)', estPrice: 35, bought: false, addedBy: 'Housemate' },
    { id: 'g2', name: 'Trash Bags (20 pack)', estPrice: 45, bought: true, addedBy: 'You' },
    { id: 'g3', name: 'Toilet Paper (18 roll)', estPrice: 120, bought: false, addedBy: 'Housemate' }
  ])
  const [newGroceryName, setNewGroceryName] = useState('')
  const [newGroceryPrice, setNewGroceryPrice] = useState<number>(30)

  const handleAddGrocery = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newGroceryName.trim()) return
    setGroceryItems(prev => [
      ...prev,
      { id: `g-${Date.now()}`, name: newGroceryName.trim(), estPrice: Math.max(1, newGroceryPrice), bought: false, addedBy: 'You' }
    ])
    setNewGroceryName('')
    setNewGroceryPrice(30)
  }

  const toggleGroceryBought = (id: string) => {
    setGroceryItems(prev => prev.map(item => item.id === id ? { ...item, bought: !item.bought } : item))
  }

  const deleteGroceryItem = (id: string) => {
    setGroceryItems(prev => prev.filter(item => item.id !== id))
  }

  // Batch A: Supplies Low-Stock Counter State
  const [supplies, setSupplies] = useState<Record<string, 'ok' | 'low'>>({
    'Dish Soap': 'ok',
    'Toilet Paper': 'low',
    'Trash Bags': 'ok',
    'All-Purpose Cleaner': 'ok'
  })

  const toggleSupplyStatus = (item: string) => {
    setSupplies(prev => ({ ...prev, [item]: prev[item] === 'ok' ? 'low' : 'ok' }))
  }

  // Batch A: Guest Overnight Stay Tracker State
  const [guestLogs, setGuestLogs] = useState<Array<{ id: string; guestName: string; nights: number; month: string }>>([
    { id: 'gst-1', guestName: 'Sizwe (Brother)', nights: 2, month: 'Current Month' }
  ])
  const [newGuestName, setNewGuestName] = useState('')
  const [newGuestNights, setNewGuestNights] = useState<number>(1)

  const handleAddGuestLog = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newGuestName.trim()) return
    setGuestLogs(prev => [
      ...prev,
      { id: `gst-${Date.now()}`, guestName: newGuestName.trim(), nights: Math.max(1, newGuestNights), month: 'Current Month' }
    ])
    setNewGuestName('')
    setNewGuestNights(1)
  }

  // Batch A: Quiet Hours Toggle State
  const [quietHoursActive, setQuietHoursActive] = useState(true)

  // Batch A: Expense Fairness Tally
  const totalBoughtCost = groceryItems.filter(g => g.bought).reduce((acc, g) => acc + g.estPrice, 0)
  const totalUnboughtCost = groceryItems.filter(g => !g.bought).reduce((acc, g) => acc + g.estPrice, 0)

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

            {/* Batch A #103 & #108: Shared Grocery List & Expense Fairness Tally */}
            <div className="glass-panel p-6 space-y-4">
               <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-white/10 pb-3">
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                     <ShoppingCart size={18} className="text-gold-primary" /> Shared Grocery & Supplies Checklist
                  </h3>
                  <div className="flex items-center gap-3 text-xs">
                     <span className="text-gray-400">Bought: <strong className="text-green-400">R{totalBoughtCost}</strong></span>
                     <span className="text-gray-600">·</span>
                     <span className="text-gray-400">Pending: <strong className="text-gold-primary">R{totalUnboughtCost}</strong></span>
                  </div>
               </div>

               <form onSubmit={handleAddGrocery} className="flex gap-2">
                  <input
                     value={newGroceryName}
                     onChange={e => setNewGroceryName(e.target.value)}
                     placeholder="Add item (e.g. Dish soap, foil...)"
                     className="flex-1 bg-black border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-gold-primary/50"
                  />
                  <input
                     type="number"
                     min={1}
                     value={newGroceryPrice}
                     onChange={e => setNewGroceryPrice(Number(e.target.value))}
                     className="w-20 bg-black border border-white/10 rounded-xl px-2 py-2 text-xs text-gold-primary font-bold outline-none text-right"
                  />
                  <button type="submit" className="bg-gold-primary text-black font-bold px-4 py-2 rounded-xl text-xs uppercase tracking-wider flex items-center gap-1">
                     <Plus size={14} /> Add
                  </button>
               </form>

               <div className="space-y-2">
                  {groceryItems.map(item => (
                     <div key={item.id} className="flex items-center justify-between p-2.5 rounded-xl bg-black/40 border border-white/5 text-xs">
                        <label className="flex items-center gap-3 cursor-pointer flex-1">
                           <input type="checkbox" checked={item.bought} onChange={() => toggleGroceryBought(item.id)} className="accent-gold-primary w-4 h-4" />
                           <span className={item.bought ? 'line-through text-gray-500 font-bold' : 'text-gray-200 font-medium'}>{item.name}</span>
                        </label>
                        <div className="flex items-center gap-3">
                           <span className="font-mono text-gold-primary font-bold">R{item.estPrice}</span>
                           <button onClick={() => deleteGroceryItem(item.id)} className="text-gray-600 hover:text-red-400 p-1"><Trash2 size={13} /></button>
                        </div>
                     </div>
                  ))}
               </div>
            </div>

            {/* Batch A #109: Cleaning Supplies Low-Stock Counter */}
            <div className="glass-panel p-6 space-y-3">
               <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Package size={18} className="text-gold-primary" /> Communal Cleaning Supplies Counter
               </h3>
               <p className="text-[11px] text-gray-500">Tap a supply to toggle between OK and Low Stock so roommates know what to buy next.</p>
               <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {Object.entries(supplies).map(([name, status]) => (
                     <button
                        key={name}
                        onClick={() => toggleSupplyStatus(name)}
                        className={`p-3 rounded-xl border text-xs font-bold transition-all text-left flex flex-col gap-1 ${
                           status === 'low'
                              ? 'bg-red-500/10 border-red-500/30 text-red-300'
                              : 'bg-black/40 border-white/10 text-gray-300 hover:border-gold-primary/30'
                        }`}
                     >
                        <span className="truncate">{name}</span>
                        <span className={`text-[9px] font-black uppercase tracking-widest ${status === 'low' ? 'text-red-400' : 'text-green-400'}`}>
                           {status === 'low' ? '⚠️ Low Stock' : '✓ Stock OK'}
                        </span>
                     </button>
                  ))}
               </div>
            </div>

            {/* Batch A #104: Guest Overnight Stay Tracker & #105 Quiet Hours */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               <div className="glass-panel p-5 space-y-3">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                     <Calendar size={16} className="text-gold-primary" /> Guest Stay Tracker
                  </h4>
                  <p className="text-[10px] text-gray-500">Log guest nights to maintain house rule compliance (Max 5 nights/month per guest).</p>
                  <form onSubmit={handleAddGuestLog} className="flex gap-2">
                     <input
                        value={newGuestName}
                        onChange={e => setNewGuestName(e.target.value)}
                        placeholder="Guest name..."
                        className="flex-1 bg-black border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none"
                     />
                     <input
                        type="number" min={1} max={30}
                        value={newGuestNights}
                        onChange={e => setNewGuestNights(Number(e.target.value))}
                        className="w-14 bg-black border border-white/10 rounded-lg px-2 py-1.5 text-xs text-gold-primary text-center font-bold"
                     />
                     <button type="submit" className="bg-gold-primary text-black font-bold px-3 py-1.5 rounded-lg text-xs uppercase tracking-wider">Log</button>
                  </form>
                  <div className="space-y-1.5">
                     {guestLogs.map(g => (
                        <div key={g.id} className="flex items-center justify-between text-xs p-2 bg-black/40 rounded-lg border border-white/5">
                           <span className="text-gray-300 font-medium">{g.guestName}</span>
                           <span className="text-gold-primary font-bold">{g.nights} night(s)</span>
                        </div>
                     ))}
                  </div>
               </div>

               <div className="glass-panel p-5 space-y-3">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                     <Moon size={16} className="text-gold-primary" /> House Quiet Hours
                  </h4>
                  <p className="text-[10px] text-gray-500">Standard quiet window is active between 22:00 – 07:00 daily.</p>
                  <button
                     onClick={() => setQuietHoursActive(!quietHoursActive)}
                     className={`w-full p-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-between ${
                        quietHoursActive
                           ? 'bg-gold-primary/10 border-gold-primary/30 text-gold-primary'
                           : 'bg-black/40 border-white/10 text-gray-500'
                     }`}
                  >
                     <span>Quiet Hours Auto-Mute</span>
                     <span className="text-[10px] uppercase font-black tracking-widest">{quietHoursActive ? 'Active (22:00-07:00)' : 'Disabled'}</span>
                  </button>
               </div>
            </div>
         </div>
      </div>
    </div>
  )
}
