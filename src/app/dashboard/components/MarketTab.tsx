'use client'

import React, { useState } from 'react'
import { ShoppingBag, Store, Users, Search, Plus, Check, AlertTriangle, ShieldCheck, X, MapPin } from 'lucide-react'
import type { MarketItem, Vendor, GroupBuy, LostFound } from '../../../store'

interface MarketTabProps {
  marketItems: MarketItem[]
  vendors: Vendor[]
  groupBuys: GroupBuy[]
  lostFound: LostFound[]
  currentUserId: string
  formatCurrency: (amount: number, currency?: string) => string
  onPostItem?: (item: { title: string; description: string; price: number | null; category: string }) => void
  onPledge?: (groupBuyId: string, quantity: number) => void
  onReunite?: (id: string) => void
  onReport?: (subjectType: string, subjectId: string) => void
}

type Section = 'market' | 'vendors' | 'groupbuys' | 'lostfound'

export default function MarketTab({
  marketItems,
  vendors,
  groupBuys,
  lostFound,
  currentUserId,
  formatCurrency,
  onPostItem,
  onPledge,
  onReunite
}: MarketTabProps) {
  const [section, setSection] = useState<Section>('market')
  const [showForm, setShowForm] = useState(false)
  const [postTitle, setPostTitle] = useState('')
  const [postDesc, setPostDesc] = useState('')
  const [postPrice, setPostPrice] = useState('')
  const [postCategory, setPostCategory] = useState('Household')

  const tabClass = (id: Section) =>
    `px-4 py-2 rounded-lg text-sm font-medium transition-all ${section === id ? 'bg-gold-primary text-black' : 'text-gray-400 hover:text-white hover:bg-white/5'}`

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 mb-4 bg-gray-900/30 p-1 rounded-xl border border-white/5 inline-flex">
        <button onClick={() => setSection('market')} className={tabClass('market')}>Local Market</button>
        <button onClick={() => setSection('vendors')} className={tabClass('vendors')}>Vendors</button>
        <button onClick={() => setSection('groupbuys')} className={tabClass('groupbuys')}>Group Buys</button>
        <button onClick={() => setSection('lostfound')} className={tabClass('lostfound')}>Lost & Found</button>
      </div>

      {section === 'market' && (
        <div className="glass-panel p-6">
          <div className="flex justify-between items-center mb-6">
             <div>
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                   <ShoppingBag size={20} className="text-gold-primary" /> Spaza Marketplace
                </h3>
                <p className="text-xs text-gray-500 mt-1">Direct trading between neighbors. No platform fees.</p>
             </div>
             <button onClick={() => setShowForm(!showForm)} className="bg-white/5 hover:bg-white/10 text-gold-primary border border-gold-primary/20 px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2">
                {showForm ? <X size={14}/> : <Plus size={14}/>}
                {showForm ? 'Cancel' : 'Post Item'}
             </button>
          </div>

          {showForm && (
             <form
                onSubmit={e => {
                   e.preventDefault()
                   if (!postTitle.trim()) return
                   onPostItem?.({
                      title: postTitle,
                      description: postDesc,
                      price: postPrice.trim() === '' ? null : Number(postPrice),
                      category: postCategory
                   })
                   setPostTitle(''); setPostDesc(''); setPostPrice(''); setShowForm(false)
                }}
                className="bg-black/40 border border-gold-primary/20 rounded-xl p-6 mb-8 space-y-4"
             >
                <p className="text-xs text-gray-500">Leave the price blank to give it away. Payment happens between you and the buyer — never through the app.</p>
                <input value={postTitle} onChange={e => setPostTitle(e.target.value)} required placeholder="What is it?" className="w-full bg-black border border-white/10 rounded-lg p-3 text-sm text-white outline-none focus:border-gold-primary/40" />
                <textarea value={postDesc} onChange={e => setPostDesc(e.target.value)} placeholder="Condition, why you're selling" className="w-full bg-black border border-white/10 rounded-lg p-3 text-sm text-white h-20 resize-none outline-none focus:border-gold-primary/40" />
                <div className="flex gap-3">
                   <input type="number" min={0} value={postPrice} onChange={e => setPostPrice(e.target.value)} placeholder="Price (blank = free)" className="flex-1 bg-black border border-white/10 rounded-lg p-3 text-sm text-white outline-none focus:border-gold-primary/40" />
                   <select value={postCategory} onChange={e => setPostCategory(e.target.value)} className="flex-1 bg-black border border-white/10 rounded-lg p-3 text-sm text-white outline-none focus:border-gold-primary/40">
                      <option>Household</option>
                      <option>Furniture</option>
                      <option>Electronics</option>
                      <option>Clothing</option>
                      <option>Food</option>
                      <option>Other</option>
                   </select>
                </div>
                <button type="submit" className="w-full bg-gold-primary text-black font-black py-2.5 rounded-lg text-xs uppercase tracking-widest">Post it</button>
             </form>
          )}

          {marketItems.length === 0 ? (
            <div className="py-12 text-center text-gray-500">
               <ShoppingBag size={48} className="mx-auto mb-4 opacity-10" />
               <p>No items for sale in your area.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {marketItems.map(item => (
                <div key={item.id} className="bg-black/40 border border-white/5 rounded-xl p-4 flex flex-col gap-3 hover:border-white/10 transition-all group">
                   <div className="flex justify-between items-start">
                      <span className="text-xs font-black text-gold-primary group-hover:scale-110 transition-transform origin-left">{item.price ? formatCurrency(item.price) : 'FREE'}</span>
                      <span className="text-[9px] bg-white/5 text-gray-500 px-1.5 py-0.5 rounded uppercase font-bold">{item.category}</span>
                   </div>
                   <h4 className="font-bold text-white text-sm group-hover:text-gold-primary transition-colors">{item.title}</h4>
                   <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">{item.description}</p>
                   <div className="mt-auto pt-3 border-t border-white/5 flex justify-between items-center">
                      <span className="text-[10px] text-gray-600">In {item.suburb}</span>
                      <button className="text-gold-primary text-[10px] font-bold hover:underline">Chat Seller</button>
                   </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {section === 'vendors' && (
        <div className="glass-panel p-6 space-y-4">
           {vendors.length === 0 ? (
              <div className="py-12 text-center text-gray-500">
                <Store size={48} className="mx-auto mb-4 opacity-10" />
                <p>No registered vendors in this area.</p>
              </div>
           ) : (
             vendors.map(v => (
               <div key={v.id} className="flex items-center justify-between p-4 bg-black/40 border border-white/5 rounded-xl hover:border-gold-primary/20 transition-all group">
                  <div className="flex items-center gap-4">
                     <div className="p-3 bg-gold-primary/10 rounded-xl group-hover:bg-gold-primary group-hover:text-black transition-colors">
                        <Store size={24} className="text-gold-primary group-hover:text-inherit" />
                     </div>
                     <div>
                        <h4 className="font-bold text-white group-hover:text-gold-primary transition-colors">{v.name}</h4>
                        <p className="text-xs text-gray-500">{v.category}</p>
                     </div>
                  </div>
                  <button className="bg-white/5 text-gray-400 border border-white/10 px-4 py-2 rounded-lg text-xs hover:text-white hover:bg-white/10 transition-all font-bold">View Menu</button>
               </div>
             ))
           )}
        </div>
      )}

      {section === 'groupbuys' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
           {groupBuys.length === 0 ? (
              <div className="glass-panel col-span-full p-12 text-center text-gray-500">
                <Users size={48} className="mx-auto mb-4 opacity-10" />
                <p>No active group buys in your area.</p>
              </div>
           ) : (
             groupBuys.map(gb => {
               const pct = Math.min(100, (gb.currentPledges / gb.targetAmount) * 100)
               return (
                 <div key={gb.id} className="glass-panel p-6 space-y-4 hover:border-gold-primary/20 transition-all">
                    <div className="flex justify-between items-start">
                       <h4 className="text-lg font-bold text-white">{gb.title}</h4>
                       <span className="text-[10px] font-bold text-gold-primary bg-gold-primary/5 px-2 py-1 rounded border border-gold-primary/20 uppercase tracking-widest">Group Buy</span>
                    </div>
                    <p className="text-sm text-gray-400 leading-relaxed">{gb.description}</p>
                    <div className="space-y-2 pt-2">
                       <div className="flex justify-between text-[10px] uppercase font-bold">
                          <span className="text-gray-500">Progress: {gb.currentPledges} / {gb.targetAmount}</span>
                          <span className="text-gold-primary">{Math.round(pct)}%</span>
                       </div>
                       <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden border border-white/5">
                          <div className="h-full bg-gold-primary transition-all duration-1000 shadow-[0_0_10px_#D4AF37]" style={{ width: `${pct}%` }}></div>
                       </div>
                    </div>
                    <button
                      onClick={() => onPledge?.(gb.id, 1)}
                      className="w-full bg-gold-primary hover:bg-gold-secondary text-black font-bold py-2.5 rounded-lg text-xs active:scale-95 transition-all mt-4"
                    >
                      Pledge Support
                    </button>
                 </div>
               )
             })
           )}
        </div>
      )}

      {section === 'lostfound' && (
        <div className="glass-panel p-6 space-y-4">
           {lostFound.length === 0 ? (
              <div className="py-12 text-center text-gray-500">
                <Search size={48} className="mx-auto mb-4 opacity-10" />
                <p>Nothing lost, nothing found.</p>
              </div>
           ) : (
             lostFound.map(lf => (
               <div key={lf.id} className="flex items-center justify-between p-4 bg-black/40 border border-white/5 rounded-xl hover:border-white/10 transition-all group">
                  <div className="flex gap-4">
                     <div className={`p-3 rounded-xl transition-colors ${lf.type === 'lost' ? 'bg-red-500/10 text-red-500 group-hover:bg-red-500 group-hover:text-white' : 'bg-green-500/10 text-green-500 group-hover:bg-green-500 group-hover:text-white'}`}>
                        {lf.type === 'lost' ? <AlertTriangle size={24} /> : <Check size={24} />}
                     </div>
                     <div>
                        <div className="flex items-center gap-2">
                           <h4 className="font-bold text-white group-hover:text-gold-primary transition-colors">{lf.title}</h4>
                           <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded border ${lf.type === 'lost' ? 'bg-red-500/20 text-red-400 border-red-500/30' : 'bg-green-500/20 text-green-400 border-green-500/30'}`}>{lf.type.toUpperCase()}</span>
                        </div>
                        <p className="text-xs text-gray-500 flex items-center gap-1 mt-1"><MapPin size={10} className="text-gold-primary" /> {lf.location}</p>
                     </div>
                  </div>
                  {lf.status === 'active' && (
                     <button onClick={() => onReunite?.(lf.id)} className="bg-gold-primary/10 text-gold-primary border border-gold-primary/20 px-4 py-2 rounded-lg text-xs font-bold hover:bg-gold-primary hover:text-black transition-all">Mark Reunited</button>
                  )}
               </div>
             ))
           )}
        </div>
      )}
    </div>
  )
}
