'use client'

import React, { useState, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, MapPin, Wifi, Car, Star, Users, Home, Loader, Filter, X, Plus, Info, AlertTriangle, Check, Send, ShieldCheck, Eye, User as UserIcon
} from 'lucide-react'
import {
  RootState,
  Listing,
  RoomRequest,
  selectFilteredListings,
  selectMatchedRoommates,
  addRequest,
  addListing,
  updateRequestStatus
} from '../../../store'
import { useGeolocation } from '../../../hooks/useGeolocation'
import { formatCurrencyByLocation, suburbPriceStats, isSuspiciousPrice } from '../../../utils/logic'

export default function HousingPage() {
  const dispatch = useDispatch()
  const [activeTab, setActiveTab] = useState<'rooms' | 'roommates'>('rooms')
  const [alertNotification, setAlertNotification] = useState<string | null>(null)
  const { locationLoading, handleGetLiveLocation } = useGeolocation(setAlertNotification)

  // Filter States
  const [searchInputValue, setSearchInputValue] = useState('')
  const [searchLocation, setSearchLocation] = useState('')
  const [filterPrice, setFilterPrice] = useState<number>(3000)
  const [filterWifi, setFilterWifi] = useState(false)
  const [filterParking, setFilterParking] = useState(false)
  const [showFilters, setShowFilters] = useState(false)

  // Create Modal State
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newPrice, setNewPrice] = useState<number>(1500)
  const [newLocation, setNewLocation] = useState('Midrand, South Africa')
  const [newSuburb, setNewSuburb] = useState('Ivory Park')
  const [newLivesHere, setNewLivesHere] = useState(false)
  const [newWifi, setNewWifi] = useState(true)
  const [newParking, setNewParking] = useState(true)
  const [newBathroom, setNewBathroom] = useState<'shared' | 'private' | 'ensuite'>('shared')
  const [newGenderPref, setNewGenderPref] = useState<'men' | 'women' | 'couple' | 'any'>('any')
  const [newChildrenAllowed, setNewChildrenAllowed] = useState(true)
  const [newMaxChildren, setNewMaxChildren] = useState(2)

  // Application Drawer
  const [activeListing, setActiveListing] = useState<Listing | null>(null)
  const [applyMessage, setApplyMessage] = useState('')

  // Landlord Audit Modal
  const [activeAuditRequest, setActiveAuditRequest] = useState<RoomRequest | null>(null)

  const currentUser = useSelector((state: RootState) => state.auth.currentUser)
  const allListings = useSelector((state: RootState) => state.listings.items)
  const requests = useSelector((state: RootState) => state.requests.items)

  // Search Debouncer
  useEffect(() => {
    const handler = setTimeout(() => setSearchLocation(searchInputValue), 300)
    return () => clearTimeout(handler)
  }, [searchInputValue])

  const filteredListings = useSelector((state: RootState) => selectFilteredListings(
    state,
    searchLocation,
    filterPrice,
    filterWifi,
    filterParking,
    'all',
    false,
    false
  ))

  const filteredRoommates = useSelector((state: RootState) => selectMatchedRoommates(
    state,
    'all',
    2000
  ))

  const handleCreateListing = (e: React.FormEvent) => {
    e.preventDefault()
    const listing: Listing = {
      id: `list-${Date.now()}`,
      title: newTitle,
      description: newDesc,
      price: newPrice,
      currency: 'ZAR',
      location: newLocation,
      suburb: newSuburb,
      safetyRating: 'high',
      safetyNotes: 'Verified community watch area.',
      landlordId: currentUser?.id || '',
      landlordName: currentUser?.name || '',
      landlordLivesHere: newLivesHere,
      images: ['https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?auto=format&fit=crop&w=600&q=80'],
      amenities: { wifi: newWifi, parking: newParking, bathroom: newBathroom },
      requirements: {
        genderPreference: newGenderPref,
        childrenAllowed: newChildrenAllowed,
        maxChildren: newMaxChildren,
        smokingAllowed: false,
        petsAllowed: false
      }
    }
    dispatch(addListing(listing))
    setShowCreateModal(false)
    setAlertNotification('Property listed successfully!')
  }

  const handleApply = (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeListing) return
    const request: RoomRequest = {
      id: `req-${Date.now()}`,
      tenantId: currentUser?.id || '',
      tenantName: currentUser?.name || '',
      listingId: activeListing.id,
      listingTitle: activeListing.title,
      landlordId: activeListing.landlordId,
      status: 'pending',
      message: applyMessage,
      timestamp: new Date().toLocaleDateString()
    }
    dispatch(addRequest(request))
    setActiveListing(null)
    setApplyMessage('')
    setAlertNotification('Application sent to landlord.')
  }

  const landlordRequests = requests.filter(r => r.landlordId === currentUser?.id && r.status === 'pending')

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-10 pb-32">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
             <div className="p-2 bg-gold-primary/10 rounded-lg">
                <Home size={28} className="text-gold-primary" />
             </div>
             <h1 className="text-3xl md:text-4xl font-black text-white tracking-tighter uppercase italic">Housing <span className="text-gold-primary">Portal</span></h1>
          </div>
          <p className="text-gray-500 text-sm font-bold uppercase tracking-widest opacity-60 ml-1">Curated Living Spaces & Verified Resident Matches</p>
        </div>

        <div className="flex bg-black/40 p-1.5 rounded-2xl border border-white/5 shadow-2xl backdrop-blur-xl w-full md:w-auto">
          <button
            onClick={() => setActiveTab('rooms')}
            className={`flex-1 md:flex-none px-6 py-2.5 rounded-xl transition-all text-xs font-black uppercase tracking-widest ${activeTab === 'rooms' ? 'bg-gold-primary text-black shadow-lg shadow-gold-primary/20' : 'text-gray-500 hover:text-white'}`}
          >
            Rooms
          </button>
          <button
            onClick={() => setActiveTab('roommates')}
            className={`flex-1 md:flex-none px-6 py-2.5 rounded-xl transition-all text-xs font-black uppercase tracking-widest ${activeTab === 'roommates' ? 'bg-gold-primary text-black shadow-lg shadow-gold-primary/20' : 'text-gray-500 hover:text-white'}`}
          >
            Roommates
          </button>
        </div>
      </header>

      {/* Landlord Notifications for Applications */}
      {currentUser?.role === 'landlord' && landlordRequests.length > 0 && (
         <div className="glass-panel p-6 border-gold-primary/30 bg-gold-primary/5 flex flex-col md:flex-row justify-between items-center gap-4 animate-pulse">
            <div className="flex items-center gap-4 text-gold-primary">
               <Info size={24} />
               <div>
                  <p className="font-black text-sm uppercase tracking-widest">Action Required</p>
                  <p className="text-xs text-white">You have <strong>{landlordRequests.length}</strong> pending room applications awaiting your audit.</p>
               </div>
            </div>
            <div className="flex gap-2">
               {landlordRequests.map(req => (
                  <button
                    key={req.id}
                    onClick={() => setActiveAuditRequest(req)}
                    className="bg-gold-primary text-black px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-gold-secondary transition-all"
                  >
                     Audit {req.tenantName}
                  </button>
               ))}
            </div>
         </div>
      )}

      {activeTab === 'rooms' ? (
        <div className="space-y-8">
          {/* Search & Action Bar */}
          <div className="flex flex-col lg:flex-row gap-4">
             <div className="flex-1 glass-panel p-2 flex items-center gap-2 bg-black/60 shadow-inner">
                <div className="flex-1 flex items-center bg-black/40 rounded-xl px-4 py-1.5 border border-white/5 focus-within:border-gold-primary/40 transition-colors">
                   <Search size={18} className="text-gray-600" />
                   <input
                      type="text"
                      value={searchInputValue}
                      onChange={(e) => setSearchInputValue(e.target.value)}
                      placeholder="Enter Suburb, City or Complex..."
                      className="bg-transparent border-none text-white px-3 py-2 w-full outline-none text-sm font-bold placeholder:text-gray-700 placeholder:uppercase placeholder:tracking-widest"
                   />
                   <button
                      onClick={() => handleGetLiveLocation(setSearchInputValue)}
                      className={`p-2 transition-all rounded-lg ${locationLoading ? 'text-gold-primary' : 'text-gray-600 hover:text-gold-primary hover:bg-gold-primary/10'}`}
                   >
                      {locationLoading ? <Loader size={18} className="animate-spin" /> : <MapPin size={18} />}
                   </button>
                </div>

                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`p-3 rounded-xl border transition-all ${showFilters ? 'bg-gold-primary border-gold-primary text-black' : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'}`}
                >
                  <Filter size={18} />
                </button>
             </div>

             {currentUser?.role === 'landlord' && (
                <button
                   onClick={() => setShowCreateModal(true)}
                   className="bg-gold-primary hover:bg-gold-secondary text-black font-black px-8 py-4 rounded-2xl flex items-center justify-center gap-3 transition-all active:scale-95 shadow-xl shadow-gold-primary/10 uppercase tracking-widest text-xs"
                >
                   <Plus size={20} /> List Your Property
                </button>
             )}
          </div>

          <AnimatePresence>
             {showFilters && (
               <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
               >
                  <div className="glass-panel p-8 bg-black/40 border-gold-primary/10 grid grid-cols-1 md:grid-cols-3 gap-10">
                     <div className="space-y-4">
                        <div className="flex justify-between items-end">
                           <label className="text-[10px] uppercase font-black tracking-[0.2em] text-gray-500">Price Ceiling</label>
                           <span className="text-gold-primary font-black text-sm">{formatCurrencyByLocation(filterPrice)}</span>
                        </div>
                        <input
                           type="range" min={500} max={5000} step={50}
                           value={filterPrice} onChange={(e) => setFilterPrice(Number(e.target.value))}
                           className="w-full h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-gold-primary"
                        />
                     </div>

                     <div className="space-y-4">
                        <label className="text-[10px] uppercase font-black tracking-[0.2em] text-gray-500 block mb-6">Preferred Amenities</label>
                        <div className="flex flex-wrap gap-4">
                           <label className="flex items-center gap-3 cursor-pointer group">
                              <div className={`w-10 h-6 rounded-full p-1 transition-all border ${filterWifi ? 'bg-gold-primary border-gold-primary' : 'bg-white/5 border-white/10'}`}>
                                 <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${filterWifi ? 'translate-x-4' : 'translate-x-0'}`} />
                              </div>
                              <input type="checkbox" className="hidden" checked={filterWifi} onChange={e => setFilterWifi(e.target.checked)} />
                              <span className={`text-xs font-bold uppercase tracking-widest transition-colors ${filterWifi ? 'text-white' : 'text-gray-600'}`}>WiFi</span>
                           </label>

                           <label className="flex items-center gap-3 cursor-pointer group">
                              <div className={`w-10 h-6 rounded-full p-1 transition-all border ${filterParking ? 'bg-gold-primary border-gold-primary' : 'bg-white/5 border-white/10'}`}>
                                 <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${filterParking ? 'translate-x-4' : 'translate-x-0'}`} />
                              </div>
                              <input type="checkbox" className="hidden" checked={filterParking} onChange={e => setFilterParking(e.target.checked)} />
                              <span className={`text-xs font-bold uppercase tracking-widest transition-colors ${filterParking ? 'text-white' : 'text-gray-600'}`}>Parking</span>
                           </label>
                        </div>
                     </div>

                     <div className="flex items-center justify-end">
                        <button
                           onClick={() => {
                              setFilterPrice(3000); setFilterWifi(false); setFilterParking(false); setSearchInputValue('');
                           }}
                           className="text-[10px] font-black uppercase tracking-[0.3em] text-red-500/50 hover:text-red-500 transition-colors"
                        >
                           Reset All Filters
                        </button>
                     </div>
                  </div>
               </motion.div>
             )}
          </AnimatePresence>

          {/* Listings Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
            {filteredListings.map((item) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="glass-panel overflow-hidden flex flex-col hover:border-gold-primary/40 transition-all duration-500 group bg-black/40"
              >
                <div className="relative h-56 bg-gray-900 overflow-hidden">
                  <img src={item.images[0]} alt={item.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 opacity-80 group-hover:opacity-100" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-60" />
                  <div className="absolute bottom-4 left-4 right-4 flex justify-between items-end">
                     <div className="bg-black/60 backdrop-blur-md border border-white/10 px-3 py-1.5 rounded-xl">
                        <span className="text-xs font-black text-white tracking-tight uppercase">Verified</span>
                     </div>
                     <div className="bg-gold-primary text-black px-4 py-2 rounded-xl shadow-xl">
                        <span className="text-lg font-black tracking-tighter">{formatCurrencyByLocation(item.price)}</span>
                        <span className="text-[10px] font-black ml-1 opacity-60">/ MO</span>
                     </div>
                  </div>
                </div>

                <div className="p-6 flex-1 flex flex-col gap-5">
                  <div className="space-y-1">
                     <h3 className="text-xl font-black text-white tracking-tight leading-tight group-hover:text-gold-primary transition-colors">{item.title}</h3>
                     <div className="flex items-center text-[10px] text-gray-500 font-black uppercase tracking-widest gap-2">
                        <MapPin size={12} className="text-gold-primary" /> {item.suburb}, {item.location}
                     </div>
                  </div>

                  <p className="text-sm text-gray-400 line-clamp-3 leading-relaxed opacity-80">{item.description}</p>

                  <div className="flex flex-wrap gap-2 pt-2">
                    {item.amenities.wifi && <span className="text-[9px] font-black bg-white/5 border border-white/10 px-2 py-1 rounded-lg text-gray-400 flex items-center gap-1.5">WiFi</span>}
                    {item.amenities.parking && <span className="text-[9px] font-black bg-white/5 border border-white/10 px-2 py-1 rounded-lg text-gray-400 flex items-center gap-1.5">Parking</span>}
                    <span className="text-[9px] font-black bg-white/5 border border-white/10 px-2 py-1 rounded-lg text-gray-400">Bath: {item.amenities.bathroom}</span>
                  </div>

                  <div className="mt-auto pt-6 border-t border-white/5">
                     <button
                        onClick={() => setActiveListing(item)}
                        className="w-full bg-gold-primary hover:bg-gold-secondary text-black font-black py-3 rounded-xl transition-all active:scale-95 text-xs uppercase tracking-widest"
                     >
                        Request Room
                     </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
           {filteredRoommates.map(rm => (
             <motion.div key={rm.id} whileHover={{ y: -5 }} className="glass-panel p-6 flex flex-col gap-6 bg-black/40">
                <div className="flex justify-between items-start">
                   <div className="space-y-1">
                      <h3 className="text-xl font-black text-white tracking-tighter uppercase italic">{rm.name}</h3>
                      <div className="flex items-center text-[9px] text-gray-600 font-black uppercase tracking-widest gap-1.5">
                         <MapPin size={10} className="text-gold-primary" /> {rm.suburb}
                      </div>
                   </div>
                   <div className="bg-gold-primary/10 border border-gold-primary/20 text-gold-primary px-3 py-1 rounded-xl text-sm font-black tracking-tighter">
                      {formatCurrencyByLocation(rm.budget)}
                   </div>
                </div>
                <p className="text-sm text-gray-400 italic leading-relaxed font-medium">&quot;{rm.bio}&quot;</p>
                <div className="grid grid-cols-2 gap-3">
                   <div className="bg-white/2 border border-white/5 rounded-xl p-2.5">
                      <span className="text-[8px] text-gray-600 font-black uppercase tracking-widest block">GENDER</span>
                      <span className="text-[10px] text-gray-300 font-black uppercase tracking-widest">{rm.gender}</span>
                   </div>
                   <div className="bg-white/2 border border-white/5 rounded-xl p-2.5">
                      <span className="text-[8px] text-gray-600 font-black uppercase tracking-widest block">DEPENDENTS</span>
                      <span className="text-[10px] text-gray-300 font-black uppercase tracking-widest">{rm.childrenCount}</span>
                   </div>
                </div>
                <button className="w-full mt-4 bg-gold-primary text-black font-black py-3 rounded-xl transition-all text-xs uppercase tracking-widest active:scale-95">
                   Invite to Share
                </button>
             </motion.div>
           ))}
        </div>
      )}

      {/* CREATE LISTING MODAL */}
      <AnimatePresence>
         {showCreateModal && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
               <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowCreateModal(false)} className="absolute inset-0 bg-black/90 backdrop-blur-md" />
               <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="glass-panel w-full max-w-3xl bg-black border-gold-primary/20 shadow-2xl relative z-10 overflow-hidden">
                  <div className="bg-gold-primary/5 p-6 border-b border-white/5 flex justify-between items-center">
                     <h3 className="text-xl font-black text-white italic uppercase tracking-tighter">List Your <span className="text-gold-primary">Property</span></h3>
                     <button onClick={() => setShowCreateModal(false)} className="p-2 text-gray-500 hover:text-white transition-colors"><X /></button>
                  </div>
                  <form onSubmit={handleCreateListing} className="p-6 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                           <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Listing Title</label>
                           <input value={newTitle} onChange={e => setNewTitle(e.target.value)} required className="w-full bg-black border border-white/10 rounded-xl p-3 text-sm text-white outline-none focus:border-gold-primary/40" placeholder="e.g. Sunny En-suite near Midrand" />
                        </div>
                        <div className="space-y-2">
                           <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Monthly Rent (ZAR)</label>
                           <input type="number" value={newPrice} onChange={e => setNewPrice(Number(e.target.value))} required className="w-full bg-black border border-white/10 rounded-xl p-3 text-sm text-white outline-none focus:border-gold-primary/40" />
                        </div>
                     </div>
                     <div className="space-y-2">
                        <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Description</label>
                        <textarea value={newDesc} onChange={e => setNewDesc(e.target.value)} required className="w-full bg-black border border-white/10 rounded-xl p-3 text-sm text-white h-24 resize-none outline-none focus:border-gold-primary/40" placeholder="Describe the room, building rules, and environment..." />
                     </div>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                           <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Suburb / Area</label>
                           <input value={newSuburb} onChange={e => setNewSuburb(e.target.value)} required className="w-full bg-black border border-white/10 rounded-xl p-3 text-sm text-white outline-none focus:border-gold-primary/40" />
                        </div>
                        <div className="space-y-2">
                           <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Bathroom Style</label>
                           <select value={newBathroom} onChange={e => setNewBathroom(e.target.value as 'shared' | 'private' | 'ensuite')} className="w-full bg-black border border-white/10 rounded-xl p-3 text-sm text-white outline-none focus:border-gold-primary/40">
                              <option value="shared">Shared</option>
                              <option value="private">Private</option>
                              <option value="ensuite">En-suite</option>
                           </select>
                        </div>
                     </div>
                     <div className="flex flex-wrap gap-6 bg-white/5 p-4 rounded-2xl border border-white/5">
                        <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-gray-400 uppercase tracking-widest">
                           <input type="checkbox" checked={newWifi} onChange={e => setNewWifi(e.target.checked)} className="accent-gold-primary" /> WiFi Included
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-gray-400 uppercase tracking-widest">
                           <input type="checkbox" checked={newParking} onChange={e => setNewParking(e.target.checked)} className="accent-gold-primary" /> Parking Available
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-gray-400 uppercase tracking-widest">
                           <input type="checkbox" checked={newLivesHere} onChange={e => setNewLivesHere(e.target.checked)} className="accent-gold-primary" /> I Live On-Site
                        </label>
                     </div>
                     <div className="pt-4 border-t border-white/5 flex gap-4">
                        <button type="button" onClick={() => setShowCreateModal(false)} className="flex-1 bg-white/5 text-white font-black py-4 rounded-2xl uppercase tracking-widest text-xs">Cancel</button>
                        <button type="submit" className="flex-1 bg-gold-primary text-black font-black py-4 rounded-2xl uppercase tracking-widest text-xs shadow-xl shadow-gold-primary/20">Publish Listing</button>
                     </div>
                  </form>
               </motion.div>
            </div>
         )}
      </AnimatePresence>

      {/* APPLICATION MODAL */}
      <AnimatePresence>
         {activeListing && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
               <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setActiveListing(null)} className="absolute inset-0 bg-black/90 backdrop-blur-md" />
               <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="glass-panel w-full max-w-xl bg-black border-gold-primary/20 shadow-2xl relative z-10 p-8 space-y-8">
                  <div className="flex justify-between items-center">
                     <div className="space-y-1">
                        <h3 className="text-xl font-black text-white italic uppercase tracking-tighter">Apply for <span className="text-gold-primary">Room</span></h3>
                        <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest">{activeListing.title}</p>
                     </div>
                     <button onClick={() => setActiveListing(null)} className="text-gray-500 hover:text-white"><X /></button>
                  </div>
                  <form onSubmit={handleApply} className="space-y-6">
                     <div className="space-y-2">
                        <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Message to Landlord</label>
                        <textarea value={applyMessage} onChange={e => setApplyMessage(e.target.value)} required className="w-full bg-black border border-white/10 rounded-xl p-4 text-sm text-white h-32 resize-none outline-none focus:border-gold-primary/40" placeholder="Introduce yourself, mentioned your move-in date and any questions..." />
                     </div>
                     <button type="submit" className="w-full bg-gold-primary hover:bg-gold-secondary text-black font-black py-4 rounded-2xl uppercase tracking-widest text-xs shadow-xl flex items-center justify-center gap-2">
                        Send Request <Send size={14} />
                     </button>
                  </form>
               </motion.div>
            </div>
         )}
      </AnimatePresence>

      {/* LANDLORD AUDIT MODAL */}
      <AnimatePresence>
         {activeAuditRequest && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
               <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setActiveAuditRequest(null)} className="absolute inset-0 bg-black/90 backdrop-blur-md" />
               <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="glass-panel w-full max-w-2xl bg-black border-gold-primary/20 shadow-2xl relative z-10 overflow-hidden">
                  <div className="bg-gold-primary/5 p-6 border-b border-white/5 flex justify-between items-center">
                     <h3 className="text-xl font-black text-white italic uppercase tracking-tighter">Tenant <span className="text-gold-primary">Audit</span></h3>
                     <button onClick={() => setActiveAuditRequest(null)} className="text-gray-500 hover:text-white"><X /></button>
                  </div>
                  <div className="p-8 space-y-8">
                     <div className="flex gap-6">
                        <div className="w-16 h-16 bg-gray-800 rounded-2xl flex items-center justify-center text-2xl font-black text-gold-primary border border-white/5 shadow-inner">{activeAuditRequest.tenantName.charAt(0)}</div>
                        <div className="space-y-1">
                           <h4 className="text-2xl font-black text-white">{activeAuditRequest.tenantName}</h4>
                           <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">Applicant for: {activeAuditRequest.listingTitle}</p>
                        </div>
                     </div>
                     <div className="bg-black/40 border border-white/5 rounded-2xl p-4 italic text-sm text-gray-400 leading-relaxed font-medium">&quot;{activeAuditRequest.message}&quot;</div>

                     <div className="grid grid-cols-2 gap-4">
                        <button
                          onClick={() => { dispatch(updateRequestStatus({ requestId: activeAuditRequest.id, status: 'approved' })); setActiveAuditRequest(null); setAlertNotification('Tenant Approved!') }}
                          className="bg-green-500/10 hover:bg-green-500 text-green-500 hover:text-black border border-green-500/20 font-black py-4 rounded-2xl uppercase tracking-widest text-xs transition-all flex items-center justify-center gap-2"
                        >
                           <Check size={16} /> Approve
                        </button>
                        <button
                          onClick={() => { dispatch(updateRequestStatus({ requestId: activeAuditRequest.id, status: 'rejected' })); setActiveAuditRequest(null); setAlertNotification('Tenant Rejected.') }}
                          className="bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white border border-red-500/20 font-black py-4 rounded-2xl uppercase tracking-widest text-xs transition-all flex items-center justify-center gap-2"
                        >
                           <X size={16} /> Reject
                        </button>
                     </div>
                  </div>
               </motion.div>
            </div>
         )}
      </AnimatePresence>

      {/* GLOBAL TOAST */}
      <AnimatePresence>
         {alertNotification && (
            <motion.div
               initial={{ y: 100, opacity: 0 }}
               animate={{ y: 0, opacity: 1 }}
               exit={{ y: 100, opacity: 0 }}
               className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[300] bg-black border border-gold-primary px-8 py-4 rounded-2xl shadow-2xl flex items-center gap-4 min-w-[320px]"
            >
               <div className="p-2 bg-green-500/20 rounded-full text-green-500 shadow-[0_0_15px_rgba(34,197,94,0.3)]"><ShieldCheck size={24} /></div>
               <div className="space-y-0.5">
                  <p className="text-[10px] font-black text-gray-600 uppercase tracking-[0.2em]">Success</p>
                  <p className="text-sm font-black text-white italic tracking-tight uppercase">{alertNotification}</p>
               </div>
               <button onClick={() => setAlertNotification(null)} className="ml-auto text-gray-700 hover:text-white transition-colors"><X size={16} /></button>
            </motion.div>
         )}
      </AnimatePresence>
    </div>
  )
}
