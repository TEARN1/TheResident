'use client'

import React, { useState } from 'react'
import { Wrench, ShieldCheck, MapPin, Info, Plus, X, Star } from 'lucide-react'

interface Tool {
  id: string
  title: string
  description: string
  pricePerDay: number
  deposit: number
  location: string
  status: 'available' | 'rented' | 'maintenance' | 'pending_return'
  ownerName: string
  ownerId: string
  rentedBy?: string
}

interface ToolLibraryTabProps {
  communityTools: Tool[]
  currentUser: { id: string } | null
  handleRentTool?: (tool: Tool) => void
  handleAddTool?: (tool: { title: string; description: string; pricePerDay: number; deposit: number; location: string }) => void
  formatCurrency: (amount: number) => string
  // The borrow half of this feature (handleRentTool, above) was fully
  // wired; the return half — res_request_tool_return /
  // res_confirm_tool_return — had no UI calling it anywhere, so a borrowed
  // tool had no way to ever come back to "available" through the app.
  onRequestReturn?: (toolId: string) => void
  onConfirmReturn?: (toolId: string) => void
}

export default function ToolLibraryTab({
  communityTools,
  currentUser,
  handleRentTool,
  handleAddTool,
  formatCurrency,
  onRequestReturn,
  onConfirmReturn
}: ToolLibraryTabProps) {
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [pricePerDay, setPricePerDay] = useState('')
  const [deposit, setDeposit] = useState('')
  const [location, setLocation] = useState('')

  return (
    <div className="space-y-6">
      <div className="glass-panel p-6">
        <div className="flex justify-between items-center mb-8">
           <div>
              <h3 className="text-xl font-bold text-accent flex items-center gap-2">
                 <Wrench size={24} className="text-accent" /> Community Tool Library
              </h3>
              <p className="text-xs text-content-muted mt-1 uppercase tracking-widest font-black opacity-60">Rent expensive tools from your neighbors safely.</p>
           </div>
           <button
              onClick={() => setShowForm(!showForm)}
              className="bg-accent text-content-on-accent font-black px-4 py-2 rounded-lg text-xs uppercase tracking-widest transition-all hover:bg-accent shadow-lg shadow-gold-primary/10 flex items-center gap-2"
           >
              {showForm ? <X size={16}/> : <Plus size={16}/>}
              {showForm ? 'Cancel' : 'List a Tool'}
           </button>
        </div>

        {showForm && (
           <form
              onSubmit={e => {
                 e.preventDefault()
                 if (!title.trim()) return
                 handleAddTool?.({
                    title,
                    description,
                    pricePerDay: Number(pricePerDay) || 0,
                    deposit: Number(deposit) || 0,
                    location
                 })
                 setTitle(''); setDescription(''); setPricePerDay(''); setDeposit(''); setLocation(''); setShowForm(false)
              }}
              className="bg-surface-sunken/40 border border-accent/20 rounded-xl p-8 mb-8 shadow-inner space-y-4"
           >
              <input value={title} onChange={e => setTitle(e.target.value)} required placeholder="e.g. Cordless drill" className="w-full bg-surface border border-default rounded-lg p-3 text-sm text-content outline-none focus:border-accent/40" />
              <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Condition, accessories included" className="w-full bg-surface border border-default rounded-lg p-3 text-sm text-content h-20 resize-none outline-none focus:border-accent/40" />
              <div className="grid grid-cols-3 gap-3">
                 <input type="number" min={0} value={pricePerDay} onChange={e => setPricePerDay(e.target.value)} placeholder="R / day" className="bg-surface border border-default rounded-lg p-3 text-sm text-content outline-none focus:border-accent/40" />
                 <input type="number" min={0} value={deposit} onChange={e => setDeposit(e.target.value)} placeholder="Deposit" className="bg-surface border border-default rounded-lg p-3 text-sm text-content outline-none focus:border-accent/40" />
                 <input value={location} onChange={e => setLocation(e.target.value)} placeholder="Where to collect" className="bg-surface border border-default rounded-lg p-3 text-sm text-content outline-none focus:border-accent/40" />
              </div>
              <p className="text-xs text-content-muted italic">Payments and condition checks happen directly between neighbors at collection — the app only lists it.</p>
              <button type="submit" className="w-full bg-accent text-content-on-accent font-black py-3 rounded-xl text-xs uppercase tracking-widest">List it</button>
           </form>
        )}

        <div className="bg-accent/5 border border-accent/10 p-5 rounded-2xl mb-8 flex gap-4 items-start">
           <Info size={20} className="text-accent shrink-0 mt-0.5" />
           <p className="text-xs text-content-muted leading-relaxed italic">
              All tool transactions are Peer-to-Peer. The app facilitates the listing and reputation tracking, but payments and condition verification happen directly between neighbors at the point of collection.
           </p>
        </div>

        {communityTools.length === 0 ? (
          <div className="py-20 text-center text-content-muted bg-surface-raised/[0.02] rounded-3xl border border-dashed border-subtle">
             <Wrench size={48} className="mx-auto mb-4 opacity-10" />
             <p className="text-sm uppercase tracking-widest font-bold">Your neighborhood tool shed is empty</p>
             <p className="text-xs text-content-subtle mt-1">Be the first to list a drill, mower, or ladder!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {communityTools.map(tool => (
              <div key={tool.id} className="bg-surface-sunken/40 border border-subtle rounded-2xl p-6 flex flex-col gap-5 hover:border-accent/30 transition-all group relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-accent/5 rounded-full -mr-12 -mt-12 group-hover:bg-accent/10 transition-colors" />

                <div className="flex justify-between items-start relative z-10">
                   <div className="space-y-1">
                      <h4 className="font-black text-content text-lg group-hover:text-accent transition-colors tracking-tight leading-tight">{tool.title}</h4>
                      <div className="flex items-center gap-1.5 text-xs text-accent font-black uppercase tracking-wider">
                         {formatCurrency(tool.pricePerDay)} <span className="text-xs text-content-muted font-bold">/ DAY</span>
                      </div>
                   </div>
                   <span className={`text-xs font-black px-2 py-1 rounded-lg border uppercase tracking-widest ${tool.status === 'available' ? 'bg-success/10 text-success border-success/20' : tool.status === 'pending_return' ? 'bg-accent/10 text-accent border-accent/20' : 'bg-surface-sunken/10 text-content-muted border-default'}`}>
                      {tool.status === 'pending_return' ? 'return pending' : tool.status}
                   </span>
                </div>

                <p className="text-sm text-content-muted line-clamp-3 leading-relaxed opacity-80">{tool.description}</p>

                <div className="space-y-3 bg-surface-sunken/40 p-4 rounded-xl border border-subtle">
                   <div className="flex items-center gap-3 text-xs text-content-muted font-bold uppercase tracking-tighter">
                      <MapPin size={14} className="text-accent" /> {tool.location}
                   </div>
                   <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 text-xs text-content-muted font-bold uppercase tracking-tighter">
                         <ShieldCheck size={14} className="text-accent" /> Deposit
                      </div>
                      <span className="text-content font-black text-sm">{formatCurrency(tool.deposit)}</span>
                   </div>
                </div>

                <div className="mt-auto pt-4 border-t border-subtle flex flex-col gap-4 relative z-10">
                   <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                         <div className="w-6 h-6 bg-surface-raised rounded-full flex items-center justify-center text-xs font-black text-accent">
                            {tool.ownerName.charAt(0)}
                         </div>
                         <span className="text-xs text-content-muted font-bold uppercase tracking-widest">{tool.ownerName}</span>
                      </div>
                      <div className="flex gap-0.5">
                         {[1,2,3,4,5].map(s => <Star key={s} size={8} className="fill-gold-primary text-accent" />)}
                      </div>
                   </div>

                   {tool.status === 'available' && tool.ownerId !== currentUser?.id && (
                     <button
                        onClick={() => handleRentTool?.(tool)}
                        className="w-full bg-surface-raised/5 hover:bg-accent hover:text-content-on-accent border border-accent/30 text-accent font-black py-3 rounded-xl text-xs uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-black/20"
                     >
                        Secure Rental Slot
                     </button>
                   )}
                   {tool.status === 'rented' && tool.rentedBy === currentUser?.id && (
                     <button
                        onClick={() => onRequestReturn?.(tool.id)}
                        className="w-full bg-surface-raised/5 hover:bg-surface-raised/10 border border-default text-content hover:text-content font-black py-3 rounded-xl text-xs uppercase tracking-widest transition-all active:scale-95"
                     >
                        Mark as Returned
                     </button>
                   )}
                   {tool.status === 'pending_return' && tool.ownerId === currentUser?.id && (
                     <button
                        onClick={() => onConfirmReturn?.(tool.id)}
                        className="w-full bg-accent text-content-on-accent font-black py-3 rounded-xl text-xs uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-gold-primary/10"
                     >
                        Confirm Return
                     </button>
                   )}
                   {tool.status === 'pending_return' && tool.rentedBy === currentUser?.id && (
                     <p className="text-xs text-content-muted text-center uppercase tracking-widest font-bold">Waiting for owner to confirm</p>
                   )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
