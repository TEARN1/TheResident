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
              <h3 className="text-xl font-bold text-gold-primary flex items-center gap-2">
                 <Wrench size={24} className="text-gold-primary" /> Community Tool Library
              </h3>
              <p className="text-xs text-gray-500 mt-1 uppercase tracking-widest font-black opacity-60">Rent expensive tools from your neighbors safely.</p>
           </div>
           <button
              onClick={() => setShowForm(!showForm)}
              className="bg-gold-primary text-black font-black px-4 py-2 rounded-lg text-xs uppercase tracking-widest transition-all hover:bg-gold-secondary shadow-lg shadow-gold-primary/10 flex items-center gap-2"
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
              className="bg-black/40 border border-gold-primary/20 rounded-xl p-8 mb-8 shadow-inner space-y-4"
           >
              <input value={title} onChange={e => setTitle(e.target.value)} required placeholder="e.g. Cordless drill" className="w-full bg-black border border-white/10 rounded-lg p-3 text-sm text-white outline-none focus:border-gold-primary/40" />
              <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Condition, accessories included" className="w-full bg-black border border-white/10 rounded-lg p-3 text-sm text-white h-20 resize-none outline-none focus:border-gold-primary/40" />
              <div className="grid grid-cols-3 gap-3">
                 <input type="number" min={0} value={pricePerDay} onChange={e => setPricePerDay(e.target.value)} placeholder="R / day" className="bg-black border border-white/10 rounded-lg p-3 text-sm text-white outline-none focus:border-gold-primary/40" />
                 <input type="number" min={0} value={deposit} onChange={e => setDeposit(e.target.value)} placeholder="Deposit" className="bg-black border border-white/10 rounded-lg p-3 text-sm text-white outline-none focus:border-gold-primary/40" />
                 <input value={location} onChange={e => setLocation(e.target.value)} placeholder="Where to collect" className="bg-black border border-white/10 rounded-lg p-3 text-sm text-white outline-none focus:border-gold-primary/40" />
              </div>
              <p className="text-[10px] text-gray-500 italic">Payments and condition checks happen directly between neighbors at collection — the app only lists it.</p>
              <button type="submit" className="w-full bg-gold-primary text-black font-black py-3 rounded-xl text-xs uppercase tracking-widest">List it</button>
           </form>
        )}

        <div className="bg-gold-primary/5 border border-gold-primary/10 p-5 rounded-2xl mb-8 flex gap-4 items-start">
           <Info size={20} className="text-gold-primary shrink-0 mt-0.5" />
           <p className="text-xs text-gray-400 leading-relaxed italic">
              All tool transactions are Peer-to-Peer. The app facilitates the listing and reputation tracking, but payments and condition verification happen directly between neighbors at the point of collection.
           </p>
        </div>

        {communityTools.length === 0 ? (
          <div className="py-20 text-center text-gray-500 bg-white/2 rounded-3xl border border-dashed border-white/5">
             <Wrench size={48} className="mx-auto mb-4 opacity-10" />
             <p className="text-sm uppercase tracking-widest font-bold">Your neighborhood tool shed is empty</p>
             <p className="text-xs text-gray-600 mt-1">Be the first to list a drill, mower, or ladder!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {communityTools.map(tool => (
              <div
                key={tool.id}
                className="glass-panel p-6 flex flex-col justify-between gap-5 border-white/10 hover:border-gold-primary/40 transition-all duration-300 group relative overflow-hidden shadow-xl hover:shadow-black/50"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-gold-primary/5 rounded-full blur-2xl pointer-events-none -mr-12 -mt-12 group-hover:bg-gold-primary/10 transition-colors" />

                <div className="space-y-3 relative z-10">
                  <div className="flex justify-between items-start gap-2">
                    <div className="space-y-1">
                      <h4 className="font-black text-white text-lg group-hover:text-gold-primary transition-colors tracking-tight leading-snug">
                        {tool.title}
                      </h4>
                      <div className="inline-flex items-center gap-1.5 text-xs text-gold-primary font-black uppercase tracking-wider bg-gold-primary/10 px-2.5 py-1 rounded-lg border border-gold-primary/20">
                        {formatCurrency(tool.pricePerDay)} <span className="text-[10px] text-gray-400 font-bold">/ DAY</span>
                      </div>
                    </div>
                    <span className={`text-[10px] font-black px-2.5 py-1 rounded-full border uppercase tracking-wider backdrop-blur-md ${
                      tool.status === 'available'
                        ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                        : tool.status === 'pending_return'
                        ? 'bg-gold-primary/15 text-gold-primary border-gold-primary/30'
                        : 'bg-white/5 text-gray-400 border-white/10'
                    }`}>
                      {tool.status === 'pending_return' ? 'return pending' : tool.status}
                    </span>
                  </div>

                  <p className="text-sm text-gray-300 line-clamp-3 leading-relaxed font-normal">{tool.description}</p>

                  <div className="space-y-2.5 bg-black/40 p-3.5 rounded-xl border border-white/5 backdrop-blur-md">
                    <div className="flex items-center gap-2.5 text-xs text-gray-300 font-semibold tracking-tight">
                      <MapPin size={14} className="text-gold-primary shrink-0" />
                      <span className="truncate">{tool.location}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs pt-1 border-t border-white/5">
                      <div className="flex items-center gap-2 text-gray-400 font-medium">
                        <ShieldCheck size={14} className="text-gold-primary" /> Refundable Deposit
                      </div>
                      <span className="text-white font-black">{formatCurrency(tool.deposit)}</span>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-white/10 flex flex-col gap-3.5 relative z-10">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-gold-primary/30 to-amber-200/30 border border-gold-primary/40 flex items-center justify-center text-[10px] font-black text-gold-primary shadow-inner">
                        {tool.ownerName.charAt(0)}
                      </div>
                      <span className="text-xs text-gray-300 font-bold tracking-tight">{tool.ownerName}</span>
                    </div>
                    <div className="flex gap-0.5">
                      {[1, 2, 3, 4, 5].map(s => (
                        <Star key={s} size={9} className="fill-gold-primary text-gold-primary" />
                      ))}
                    </div>
                  </div>

                  {tool.status === 'available' && tool.ownerId !== currentUser?.id && (
                    <button
                      onClick={() => handleRentTool?.(tool)}
                      className="w-full bg-gradient-to-r from-gold-primary via-amber-300 to-gold-secondary hover:brightness-110 text-black font-black py-2.5 rounded-xl text-xs uppercase tracking-wider transition-all active:scale-95 shadow-lg shadow-gold-primary/20"
                    >
                      Secure Rental Slot
                    </button>
                  )}
                  {tool.status === 'rented' && tool.rentedBy === currentUser?.id && (
                    <button
                      onClick={() => onRequestReturn?.(tool.id)}
                      className="w-full bg-white/10 hover:bg-white/20 border border-white/20 text-white font-black py-2.5 rounded-xl text-xs uppercase tracking-wider transition-all active:scale-95"
                    >
                      Mark as Returned
                    </button>
                  )}
                  {tool.status === 'pending_return' && tool.ownerId === currentUser?.id && (
                    <button
                      onClick={() => onConfirmReturn?.(tool.id)}
                      className="w-full bg-gold-primary text-black font-black py-2.5 rounded-xl text-xs uppercase tracking-wider transition-all active:scale-95 shadow-lg shadow-gold-primary/20"
                    >
                      Confirm Return
                    </button>
                  )}
                  {tool.status === 'pending_return' && tool.rentedBy === currentUser?.id && (
                    <p className="text-[10px] text-gray-400 text-center uppercase tracking-widest font-bold py-1">Waiting for owner confirmation</p>
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
