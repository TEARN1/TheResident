'use client'

import React, { useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import { ShoppingBag, Store, Users, Search, Plus, Check, AlertTriangle, ShieldAlert, X, MapPin, EyeOff, Eye, ImagePlus } from 'lucide-react'
import type { MarketItem, Vendor, GroupBuy, LostFound } from '../../../../store'
import { supabase } from '../../../../utils/supabase'
import UpgradeButton from '../shared/UpgradeButton'
import OpenInMapsButton from '../map/OpenInMapsButton'
import MapSearchBox from '../map/MapSearchBox'
import type { GeocodeResult } from '../../../../utils/geocode'

const MAX_IMAGE_BYTES = 5 * 1024 * 1024

interface MarketTabProps {
  marketItems: MarketItem[]
  vendors: Vendor[]
  groupBuys: GroupBuy[]
  lostFound: LostFound[]
  currentUserId: string
  formatCurrency: (amount: number, currency?: string) => string
  onPostItem?: (item: { title: string; description: string; price: number | null; category: string; imageUrl: string | null; lat?: number | null; lon?: number | null }) => void
  onPledge?: (groupBuyId: string, quantity: number) => void
  onReunite?: (id: string) => void
  onReport?: (subjectType: string, subjectId: string) => void
  isModerator?: boolean
  onModerate?: (subjectType: string, subjectId: string, action: 'hide' | 'unhide') => void
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
  onReunite,
  onReport,
  isModerator,
  onModerate
}: MarketTabProps) {
  const [now] = useState(() => Date.now())
  const isFeatured = (item: MarketItem) => !!item.featuredUntil && new Date(item.featuredUntil).getTime() > now
  const [section, setSection] = useState<Section>('market')
  const [showForm, setShowForm] = useState(false)
  // "View Menu" had no onClick — and Vendor has no dedicated menu field
  // anyway, just description/contactNumber/rating, so this expands what's
  // actually there rather than pretending a real product menu exists.
  const [expandedVendor, setExpandedVendor] = useState<string | null>(null)
  const [postTitle, setPostTitle] = useState('')
  const [postDesc, setPostDesc] = useState('')
  const [postPrice, setPostPrice] = useState('')
  const [postCategory, setPostCategory] = useState('Household')
  const [postImage, setPostImage] = useState<File | null>(null)
  const [postImagePreview, setPostImagePreview] = useState<string | null>(null)
  const [imageError, setImageError] = useState<string | null>(null)
  // res_market_items.lat/lon existed in the DB but nothing ever wrote to it
  // — no "View on map" link on an item, and the map's own Marketplace
  // layer had nothing real to plot beyond whatever was already there.
  const [postLat, setPostLat] = useState<number | null>(null)
  const [postLon, setPostLon] = useState<number | null>(null)
  const [posting, setPosting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const tabClass = (id: Section) =>
    `px-4 py-2 rounded-lg text-sm font-medium transition-all ${section === id ? 'bg-accent text-content-on-accent' : 'text-content-muted hover:text-content hover:bg-surface-raised/5'}`

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImageError(null)
    if (!file.type.startsWith('image/')) {
      setImageError('Only images are supported.')
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setImageError('Image is too large — max 5MB.')
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }
    setPostImage(file)
    setPostImagePreview(URL.createObjectURL(file))
  }

  const clearPostImage = () => {
    if (postImagePreview) URL.revokeObjectURL(postImagePreview)
    setPostImage(null)
    setPostImagePreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const resetForm = () => {
    setPostTitle(''); setPostDesc(''); setPostPrice(''); setPostCategory('Household')
    clearPostImage()
    setImageError(null)
    setPostLat(null); setPostLon(null)
    setShowForm(false)
  }

  const handleSubmitItem = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!postTitle.trim()) return
    setPosting(true)
    setImageError(null)

    // Same Storage-upload pattern as gossip's media upload and the profile
    // photo field — size/type validated on select, uploaded on submit, the
    // public URL stored on the row. Single image, matching the simplicity
    // of the rest of this form rather than a full gallery.
    let imageUrl: string | null = null
    if (postImage && supabase && currentUserId) {
      const path = `${currentUserId}/${Date.now()}-${postImage.name}`
      const { error: uploadError } = await supabase.storage.from('gossip-media').upload(path, postImage)
      if (uploadError) {
        setImageError(uploadError.message)
        setPosting(false)
        return
      }
      const { data: publicUrlData } = supabase.storage.from('gossip-media').getPublicUrl(path)
      imageUrl = publicUrlData.publicUrl
    }

    onPostItem?.({
      title: postTitle,
      description: postDesc,
      price: postPrice.trim() === '' ? null : Number(postPrice),
      category: postCategory,
      imageUrl,
      lat: postLat,
      lon: postLon
    })
    setPosting(false)
    resetForm()
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 mb-4 bg-surface/30 p-1 rounded-xl border border-subtle inline-flex">
        <button onClick={() => setSection('market')} className={tabClass('market')}>Local Market</button>
        <button onClick={() => setSection('vendors')} className={tabClass('vendors')}>Vendors</button>
        <button onClick={() => setSection('groupbuys')} className={tabClass('groupbuys')}>Group Buys</button>
        <button onClick={() => setSection('lostfound')} className={tabClass('lostfound')}>Lost & Found</button>
      </div>

      {section === 'market' && (
        <div className="glass-panel p-6">
          <div className="flex justify-between items-center mb-6">
             <div>
                <h3 className="text-xl font-bold text-content flex items-center gap-2">
                   <ShoppingBag size={20} className="text-accent" /> Spaza Marketplace
                </h3>
                <p className="text-xs text-content-muted mt-1">Direct trading between neighbors. No platform fees.</p>
             </div>
             <button onClick={() => setShowForm(true)} className="bg-surface-raised/5 hover:bg-surface-raised/10 text-accent border border-accent/20 px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2">
                <Plus size={14}/> Post Item
             </button>
          </div>

          {marketItems.length === 0 ? (
            <div className="py-12 text-center text-content-muted">
               <ShoppingBag size={48} className="mx-auto mb-4 opacity-10" />
               <p>No items for sale in your area.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[...marketItems].sort((a, b) => Number(isFeatured(b)) - Number(isFeatured(a))).map(item => (
                <div key={item.id} className={`bg-surface-sunken/40 border rounded-xl p-4 flex flex-col gap-3 transition-all group ${isFeatured(item) ? 'border-accent/40' : 'border-subtle hover:border-default'}`}>
                   {item.imageUrl && (
                     <div className="relative w-full h-32 rounded-lg overflow-hidden -mt-1">
                       <Image src={item.imageUrl} alt={item.title} fill className="object-cover" sizes="(max-width: 768px) 100vw, 25vw" />
                     </div>
                   )}
                   <div className="flex justify-between items-start">
                      <span className="text-xs font-black text-accent group-hover:scale-110 transition-transform origin-left">{item.price ? formatCurrency(item.price, item.currency) : 'FREE'}</span>
                      <div className="flex items-center gap-1.5">
                         {isFeatured(item) && (
                            <span className="bg-accent text-content-on-accent px-1.5 py-0.5 rounded text-xs font-black uppercase tracking-widest">Featured</span>
                         )}
                         <span className="text-xs bg-surface-raised/5 text-content-muted px-1.5 py-0.5 rounded uppercase font-bold">{item.category}</span>
                      </div>
                   </div>
                   <h4 className="font-bold text-content text-sm group-hover:text-accent transition-colors">{item.title}</h4>
                   <p className="text-xs text-content-muted line-clamp-2 leading-relaxed">{item.description}</p>
                   <div className="mt-auto pt-3 border-t border-subtle flex justify-between items-center">
                      <span className="text-xs text-content-subtle">In {item.suburb}</span>
                      <div className="flex items-center gap-3">
                         <OpenInMapsButton
                           address={item.suburb}
                           lat={item.lat}
                           lon={item.lon}
                           label={item.title}
                           className="inline-flex items-center gap-1 text-accent text-xs font-bold hover:underline"
                         />
                         {item.createdBy === currentUserId && (
                           <UpgradeButton
                             item="market_boost"
                             targetId={item.id}
                             className="text-accent text-xs font-bold hover:underline"
                           />
                         )}
                         {item.createdBy !== currentUserId && (
                           <button
                             onClick={() => onReport?.('market_item', item.id)}
                             title="Report this listing"
                             className="text-content-subtle hover:text-danger transition-colors"
                           >
                             <ShieldAlert size={14} />
                           </button>
                         )}
                         {isModerator && (
                           <>
                             <button onClick={() => onModerate?.('market_item', item.id, 'hide')} title="Hide listing" className="text-content-subtle hover:text-danger transition-colors">
                               <EyeOff size={14} />
                             </button>
                             <button onClick={() => onModerate?.('market_item', item.id, 'unhide')} title="Unhide listing" className="text-content-subtle hover:text-success transition-colors">
                               <Eye size={14} />
                             </button>
                           </>
                         )}
                         {item.createdBy !== currentUserId && (
                           <Link href={`/dashboard/messages?to=${item.createdBy}`} className="text-accent text-xs font-bold hover:underline">Chat Seller</Link>
                         )}
                      </div>
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
              <div className="py-12 text-center text-content-muted">
                <Store size={48} className="mx-auto mb-4 opacity-10" />
                <p>No registered vendors in this area.</p>
              </div>
           ) : (
             vendors.map(v => (
               <div key={v.id} className="bg-surface-sunken/40 border border-subtle rounded-xl hover:border-accent/20 transition-all group overflow-hidden">
                  <div className="flex items-center justify-between p-4">
                     <div className="flex items-center gap-4">
                        <div className="p-3 bg-accent/10 rounded-xl group-hover:bg-accent group-hover:text-content-on-accent transition-colors">
                           <Store size={24} className="text-accent group-hover:text-inherit" />
                        </div>
                        <div>
                           <h4 className="font-bold text-content group-hover:text-accent transition-colors">{v.name}</h4>
                           <p className="text-xs text-content-muted">{v.category}</p>
                        </div>
                     </div>
                     <button
                       onClick={() => setExpandedVendor(expandedVendor === v.id ? null : v.id)}
                       className="bg-surface-raised/5 text-content-muted border border-default px-4 py-2 rounded-lg text-xs hover:text-content hover:bg-surface-raised/10 transition-all font-bold"
                     >
                       {expandedVendor === v.id ? 'Hide' : 'View Details'}
                     </button>
                  </div>
                  {expandedVendor === v.id && (
                    <div className="px-4 pb-4 pt-1 space-y-2 border-t border-subtle">
                       <p className="text-sm text-content-muted leading-relaxed">{v.description || 'No description added yet.'}</p>
                       <div className="flex items-center gap-4 text-xs text-content-muted">
                          {v.contactNumber && <span>📞 {v.contactNumber}</span>}
                          <span>⭐ {v.rating.toFixed(1)} ({v.reviewsCount} reviews)</span>
                       </div>
                    </div>
                  )}
               </div>
             ))
           )}
        </div>
      )}

      {section === 'groupbuys' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
           {groupBuys.length === 0 ? (
              <div className="glass-panel col-span-full p-12 text-center text-content-muted">
                <Users size={48} className="mx-auto mb-4 opacity-10" />
                <p>No active group buys in your area.</p>
              </div>
           ) : (
             groupBuys.map(gb => {
               const pct = Math.min(100, (gb.currentPledges / gb.targetAmount) * 100)
               return (
                 <div key={gb.id} className="glass-panel p-6 space-y-4 hover:border-accent/20 transition-all">
                    <div className="flex justify-between items-start">
                       <h4 className="text-lg font-bold text-content">{gb.title}</h4>
                       <span className="text-xs font-bold text-accent bg-accent/5 px-2 py-1 rounded border border-accent/20 uppercase tracking-widest">Group Buy</span>
                    </div>
                    <p className="text-sm text-content-muted leading-relaxed">{gb.description}</p>
                    <div className="space-y-2 pt-2">
                       <div className="flex justify-between text-xs uppercase font-bold">
                          <span className="text-content-muted">Progress: {gb.currentPledges} / {gb.targetAmount}</span>
                          <span className="text-accent">{Math.round(pct)}%</span>
                       </div>
                       <div className="h-1.5 bg-surface-raised rounded-full overflow-hidden border border-subtle">
                          <div className="h-full bg-accent transition-all duration-1000 shadow-[0_0_10px_var(--accent)]" style={{ width: `${pct}%` }}></div>
                       </div>
                    </div>
                    <button
                      onClick={() => onPledge?.(gb.id, 1)}
                      className="w-full bg-accent hover:bg-accent text-content-on-accent font-bold py-2.5 rounded-lg text-xs active:scale-95 transition-all mt-4"
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
              <div className="py-12 text-center text-content-muted">
                <Search size={48} className="mx-auto mb-4 opacity-10" />
                <p>Nothing lost, nothing found.</p>
              </div>
           ) : (
             lostFound.map(lf => (
               <div key={lf.id} className="flex items-center justify-between p-4 bg-surface-sunken/40 border border-subtle rounded-xl hover:border-default transition-all group">
                  <div className="flex gap-4">
                     <div className={`p-3 rounded-xl transition-colors ${lf.type === 'lost' ? 'bg-danger/10 text-danger group-hover:bg-danger group-hover:text-content' : 'bg-success/10 text-success group-hover:bg-success group-hover:text-content'}`}>
                        {lf.type === 'lost' ? <AlertTriangle size={24} /> : <Check size={24} />}
                     </div>
                     <div>
                        <div className="flex items-center gap-2">
                           <h4 className="font-bold text-content group-hover:text-accent transition-colors">{lf.title}</h4>
                           <span className={`text-xs font-bold px-1.5 py-0.5 rounded border ${lf.type === 'lost' ? 'bg-danger/20 text-danger border-danger/30' : 'bg-success/20 text-success border-success/30'}`}>{lf.type.toUpperCase()}</span>
                        </div>
                        <p className="text-xs text-content-muted flex items-center gap-1 mt-1"><MapPin size={10} className="text-accent" /> {lf.location}</p>
                     </div>
                  </div>
                  {lf.status === 'active' && (
                     <button onClick={() => onReunite?.(lf.id)} className="bg-accent/10 text-accent border border-accent/20 px-4 py-2 rounded-lg text-xs font-bold hover:bg-accent hover:text-content-on-accent transition-all">Mark Reunited</button>
                  )}
               </div>
             ))
           )}
        </div>
      )}

      {/* Previously an always-open form permanently pinned above the
          listings, conflating browsing and posting on the same screen and
          making every visitor scroll past a full form first. Matches
          Housing's own create-listing modal pattern instead of being a
          third, different approach to "create something" in this app. */}
      <AnimatePresence>
        {showForm && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={resetForm} className="absolute inset-0 bg-surface-sunken/90 backdrop-blur-md" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="glass-panel w-full max-w-lg bg-surface border-accent/20 shadow-2xl relative z-10 overflow-hidden">
              <div className="bg-accent/5 p-6 border-b border-subtle flex justify-between items-center">
                <h3 className="text-xl font-black text-content italic uppercase tracking-tighter">Post an <span className="text-accent">Item</span></h3>
                <button onClick={resetForm} className="p-2 text-content-muted hover:text-content transition-colors"><X /></button>
              </div>
              <form onSubmit={handleSubmitItem} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                <p className="text-xs text-content-muted">Leave the price blank to give it away. Payment happens between you and the buyer — never through the app.</p>

                <div>
                  <input accept="image/*" ref={fileInputRef} className="hidden" id="market-image-input" type="file" onChange={handleImageSelect} />
                  {postImagePreview ? (
                    <div className="relative w-full h-40 rounded-lg overflow-hidden border border-default">
                      {/* Local object URL preview — next/image can't optimize a blob:, a plain img is correct here. */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={postImagePreview} alt="Selected item" className="w-full h-full object-cover" />
                      <button type="button" onClick={clearPostImage} className="absolute top-2 right-2 bg-surface-sunken/80 text-content p-1.5 rounded-full hover:bg-danger/80 transition-colors"><X size={14} /></button>
                    </div>
                  ) : (
                    <label htmlFor="market-image-input" className="flex items-center justify-center gap-2 w-full h-24 border border-dashed border-default/15 rounded-lg text-xs text-content-muted hover:border-accent/40 hover:text-accent cursor-pointer transition-all">
                      <ImagePlus size={16} /> Add a photo (optional)
                    </label>
                  )}
                  {imageError && <p className="text-xs text-danger mt-1.5">{imageError}</p>}
                </div>

                <input value={postTitle} onChange={e => setPostTitle(e.target.value)} required placeholder="What is it?" className="w-full bg-surface border border-default rounded-lg p-3 text-sm text-content outline-none focus:border-accent/40" />
                <textarea value={postDesc} onChange={e => setPostDesc(e.target.value)} placeholder="Condition, why you're selling" className="w-full bg-surface border border-default rounded-lg p-3 text-sm text-content h-20 resize-none outline-none focus:border-accent/40" />
                <div className="flex gap-3">
                   <input type="number" min={0} value={postPrice} onChange={e => setPostPrice(e.target.value)} placeholder="Price (blank = free)" className="flex-1 bg-surface border border-default rounded-lg p-3 text-sm text-content outline-none focus:border-accent/40" />
                   <select value={postCategory} onChange={e => setPostCategory(e.target.value)} className="flex-1 bg-surface border border-default rounded-lg p-3 text-sm text-content outline-none focus:border-accent/40">
                      <option>Household</option>
                      <option>Furniture</option>
                      <option>Electronics</option>
                      <option>Clothing</option>
                      <option>Food</option>
                      <option>Other</option>
                   </select>
                </div>
                <div className="space-y-1.5">
                   <label className="text-xs text-content-muted uppercase font-bold">Pickup spot on the map <span className="normal-case font-normal text-content-subtle">(optional)</span></label>
                   <MapSearchBox onSelect={(result: GeocodeResult) => { setPostLat(result.lat); setPostLon(result.lon) }} />
                   {postLat != null && postLon != null && (
                      <p className="text-xs text-accent">Pinned — {postLat.toFixed(4)}, {postLon.toFixed(4)}</p>
                   )}
                </div>
                <button type="submit" disabled={posting} className="min-h-[44px] inline-flex items-center justify-center w-full bg-accent text-content-on-accent font-black py-2.5 rounded-lg text-xs uppercase tracking-widest disabled:opacity-50">
                  {posting ? 'Posting…' : 'Post it'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
