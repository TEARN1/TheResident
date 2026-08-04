'use client'

import React, { useState } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Car, Briefcase, Zap, MapPin, Clock, Calendar, Users, Star, Plus, ShieldCheck, Copy, X, Send, Check, Eye, Loader, Info
} from 'lucide-react'
import {
  RootState,
  AppDispatch,
  bookSeat,
  addService,
  addDispatch,
  updateDispatchStatus,
  HandymanService,
  ServiceDispatch
} from '../../../store'
import { claimVoucher, joinWaitlist, cancelSeat } from '../../../store/actions'
import { formatCurrencyByLocation } from '../../../utils/logic'

export default function ServicesPage() {
  const dispatch = useDispatch() as AppDispatch
  const [activeTab, setActiveTab] = useState<'lifts' | 'handymen' | 'utilities'>('lifts')
  const [alertNotification, setAlertNotification] = useState<string | null>(null)

  // Business Registration State
  const [showBusinessRegModal, setShowBusinessRegModal] = useState(false)
  const [bizName, setBizName] = useState('')
  const [bizCategory, setBizCategory] = useState<HandymanService['category']>('General Services')
  const [bizPhone, setBizPhone] = useState('')
  const [bizPrice, setBizPrice] = useState('')
  const [bizDesc, setBizDesc] = useState('')

  // Hire Modal State
  const [selectedBiz, setSelectedBiz] = useState<HandymanService | null>(null)
  const [hireMessage, setHireMessage] = useState('')

  // Proof Modal State (Mock)
  const [showProofModal, setShowProofModal] = useState<ServiceDispatch | null>(null)

  const currentUser = useSelector((state: RootState) => state.auth.currentUser)
  const lifts = useSelector((state: RootState) => state.networking.lifts)
  const services = useSelector((state: RootState) => state.networking.services)
  const utilityTokens = useSelector((state: RootState) => state.utilities.tokens)
  const dispatches = useSelector((state: RootState) => state.networking.dispatches)

  const handleRegisterBusiness = (e: React.FormEvent) => {
    e.preventDefault()
    const newBiz: HandymanService = {
      id: `biz-${Date.now()}`,
      ownerId: currentUser?.id || '',
      businessName: bizName,
      category: bizCategory,
      location: 'Midrand',
      suburb: 'Ivory Park',
      rating: 5.0,
      contactNumber: bizPhone,
      priceEstimate: bizPrice,
      description: bizDesc,
      image: 'https://images.unsplash.com/photo-1581092921461-eab62e97a780?auto=format&fit=crop&w=600&q=80',
      reviewsCount: 0
    }
    dispatch(addService(newBiz))
    setShowBusinessRegModal(false)
    setAlertNotification('Business card published!')
  }

  const handleDispatchContract = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedBiz) return
    const dispatchObj: ServiceDispatch = {
      id: `disp-${Date.now()}`,
      serviceId: selectedBiz.id,
      serviceName: selectedBiz.businessName,
      senderId: currentUser?.id || '',
      senderName: currentUser?.name || '',
      senderRole: currentUser?.role || 'visitor',
      message: hireMessage,
      status: 'pending',
      timestamp: new Date().toLocaleDateString()
    }
    dispatch(addDispatch(dispatchObj))
    setSelectedBiz(null)
    setHireMessage('')
    setAlertNotification('Contract dispatched successfully!')
  }

  const myBiz = services.find(s => s.ownerId === currentUser?.id)
  const incomingOrders = myBiz ? dispatches.filter(d => d.serviceId === myBiz.id) : []

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-10 pb-32">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
             <div className="p-2 bg-gold-primary/10 rounded-lg">
                <Briefcase size={28} className="text-gold-primary" />
             </div>
             <h1 className="text-3xl md:text-4xl font-black text-white tracking-tighter uppercase italic">Services <span className="text-gold-primary">& Utils</span></h1>
          </div>
          <p className="text-gray-500 text-sm font-bold uppercase tracking-widest opacity-60 ml-1">P2P Logistics, Local Skills & Prepaid Energy Marketplace</p>
        </div>

        <div className="flex bg-black/40 p-1.5 rounded-2xl border border-white/5 shadow-2xl backdrop-blur-xl w-full md:w-auto overflow-x-auto no-scrollbar">
          {[
            { id: 'lifts', label: 'Lifts', icon: Car },
            { id: 'handymen', label: 'Skills', icon: Briefcase },
            { id: 'utilities', label: 'Utilities', icon: Zap },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as 'lifts' | 'handymen' | 'utilities')}
              className={`flex-1 md:flex-none px-6 py-2.5 rounded-xl transition-all text-xs font-black uppercase tracking-widest flex items-center gap-2 whitespace-nowrap ${activeTab === t.id ? 'bg-gold-primary text-black shadow-lg shadow-gold-primary/20' : 'text-gray-500 hover:text-white'}`}
            >
              <t.icon size={14} /> {t.label}
            </button>
          ))}
        </div>
      </header>

      {activeTab === 'lifts' && (
        <div className="space-y-4">
           {lifts.map(lift => (
             <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} key={lift.id} className="glass-panel p-6 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8 bg-black/40 border-white/5 group hover:border-gold-primary/30 transition-all">
                <div className="flex-1 space-y-4">
                   <div className="flex justify-between items-center">
                      <h3 className="text-xl font-black text-white tracking-tight uppercase group-hover:text-gold-primary transition-colors italic">{lift.driverName}</h3>
                      <div className="bg-gold-primary/10 border border-gold-primary/20 text-gold-primary px-4 py-1 rounded-xl font-black text-sm tracking-tighter">
                         {formatCurrencyByLocation(lift.pricePerSeat)} <span className="text-[10px] opacity-60 ml-1">PER SEAT</span>
                      </div>
                   </div>
                   <div className="flex flex-col md:flex-row md:items-center text-sm gap-2 md:gap-4">
                      <div className="flex items-center gap-2 text-gray-300 font-bold bg-white/5 px-3 py-1.5 rounded-lg border border-white/5 shadow-inner">
                         <MapPin size={16} className="text-gold-primary" /> {lift.origin}
                      </div>
                      <div className="flex justify-center text-gray-700 font-black tracking-widest">➔</div>
                      <div className="flex items-center gap-2 text-gray-300 font-bold bg-white/5 px-3 py-1.5 rounded-lg border border-white/5 shadow-inner">
                         <MapPin size={16} className="text-gold-primary" /> {lift.destination}
                      </div>
                   </div>
                   <div className="flex flex-wrap gap-3 pt-2">
                      <span className="text-[9px] font-black uppercase tracking-widest bg-black/40 px-3 py-1.5 rounded-lg text-gray-400 border border-white/5 flex items-center gap-2"><Clock size={12} className="text-gold-primary" /> {lift.departureTime}</span>
                      <span className="text-[9px] font-black uppercase tracking-widest bg-black/40 px-3 py-1.5 rounded-lg text-gray-400 border border-white/5 flex items-center gap-2"><Calendar size={12} className="text-gold-primary" /> {lift.days}</span>
                      <span className="text-[9px] font-black uppercase tracking-widest bg-black/40 px-3 py-1.5 rounded-lg text-gray-400 border border-white/5 flex items-center gap-2"><Users size={12} className="text-gold-primary" /> {lift.availableSeats} SEATS LEFT</span>
                   </div>
                </div>
                <div className="flex gap-2 w-full lg:w-auto">
                  <button
                    onClick={() => {
                      if (lift.availableSeats > 0) {
                        dispatch(bookSeat(lift.id))
                        setAlertNotification('Seat booked — coordinate pickup with the driver directly.')
                      } else {
                        dispatch(joinWaitlist(lift.id))
                        setAlertNotification('Added to the waitlist — you get the next seat that opens up.')
                      }
                    }}
                    className="flex-1 lg:flex-none bg-gold-primary hover:bg-gold-secondary text-black font-black px-10 py-4 rounded-2xl transition-all active:scale-95 shadow-xl shadow-gold-primary/10 uppercase tracking-widest text-xs"
                  >
                    {lift.availableSeats > 0 ? 'Request Ride' : 'Join Waitlist'}
                  </button>
                  <button
                    onClick={() => { dispatch(cancelSeat(lift.id)); setAlertNotification('Seat cancelled.') }}
                    className="text-[10px] text-gray-500 hover:text-red-400 uppercase font-bold tracking-widest px-3"
                  >
                    Cancel
                  </button>
                </div>
             </motion.div>
           ))}
        </div>
      )}

      {activeTab === 'handymen' && (
        <div className="space-y-12">
           <div className="flex flex-col lg:flex-row justify-between items-center gap-6">
              <div className="glass-panel p-6 bg-blue-500/5 border-blue-500/10 flex-1 flex flex-col md:flex-row gap-6 items-center shadow-2xl">
                 <div className="p-4 bg-blue-500/20 rounded-2xl shadow-xl shadow-blue-900/10">
                    <Star size={32} className="text-blue-400" />
                 </div>
                 <div className="text-center md:text-left">
                    <h3 className="text-lg font-black text-white uppercase tracking-widest italic">Local Verified <span className="text-blue-400">Professionals</span></h3>
                    <p className="text-xs text-gray-500 font-bold uppercase tracking-widest opacity-60">Verified skills helping to grow the local economy</p>
                 </div>
              </div>
              <button
                 onClick={() => setShowBusinessRegModal(true)}
                 className="w-full lg:w-auto bg-white/5 hover:bg-gold-primary hover:text-black border border-white/10 hover:border-gold-primary text-white font-black px-8 py-5 rounded-2xl transition-all active:scale-95 flex items-center justify-center gap-3 uppercase tracking-widest text-xs"
              >
                 <Plus size={20} /> Advertise My Skills
              </button>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
             {services.map(srv => (
               <motion.div key={srv.id} whileHover={{ y: -5 }} className="glass-panel overflow-hidden flex flex-col group bg-black/40 hover:border-gold-primary/40 transition-all duration-500 shadow-2xl">
                  <div className="h-44 bg-gray-900 relative overflow-hidden">
                     <img src={srv.image} alt={srv.businessName} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 opacity-60 group-hover:opacity-100" />
                     <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-xl border border-white/10 px-3 py-1.5 rounded-xl flex items-center gap-2 shadow-2xl">
                        <Star size={14} className="text-gold-primary fill-gold-primary" />
                        <span className="text-xs font-black text-white">{srv.rating}</span>
                        <span className="text-[10px] text-gray-500 font-bold">({srv.reviewsCount})</span>
                     </div>
                     <div className="absolute bottom-4 left-4">
                        <span className="bg-gold-primary text-black px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest shadow-xl">{srv.category}</span>
                     </div>
                  </div>
                  <div className="p-6 flex-1 flex flex-col gap-5">
                     <div className="space-y-1">
                        <h3 className="text-xl font-black text-white tracking-tight uppercase italic group-hover:text-gold-primary transition-colors">{srv.businessName}</h3>
                        <div className="flex items-center text-[10px] text-gray-500 font-black uppercase tracking-widest gap-2">
                           <MapPin size={12} className="text-gold-primary" /> {srv.suburb}
                        </div>
                     </div>
                     <p className="text-sm text-gray-400 line-clamp-3 leading-relaxed opacity-80 font-medium italic">&quot;{srv.description}&quot;</p>

                     <div className="bg-white/2 border border-white/5 rounded-xl p-3 flex justify-between items-center">
                        <span className="text-[9px] font-black text-gray-600 uppercase tracking-widest">Rate Estimate</span>
                        <span className="text-sm font-black text-white tracking-tighter">{srv.priceEstimate}</span>
                     </div>

                     <div className="mt-auto pt-6 border-t border-white/5">
                        <button
                           onClick={() => setSelectedBiz(srv)}
                           className="w-full bg-white/5 hover:bg-gold-primary hover:text-black border border-white/10 hover:border-gold-primary text-white font-black py-4 rounded-xl transition-all active:scale-95 text-xs uppercase tracking-widest"
                        >
                           {srv.ownerId === currentUser?.id ? 'Manage My Card' : 'Hire Contractor'}
                        </button>
                     </div>
                  </div>
               </motion.div>
             ))}
           </div>

           {/* Service Logs Section */}
           {incomingOrders.length > 0 && (
              <div className="space-y-6 pt-10 border-t border-white/5">
                 <h3 className="text-xl font-black text-white uppercase italic tracking-tighter">My Incoming <span className="text-gold-primary">Job Orders</span></h3>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {incomingOrders.map(order => (
                       <div key={order.id} className="glass-panel p-5 bg-black/40 border-white/5 flex flex-col gap-4">
                          <div className="flex justify-between items-start">
                             <div className="space-y-0.5">
                                <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest">From: {order.senderName}</p>
                                <p className="text-xs font-black text-white italic">{order.timestamp}</p>
                             </div>
                             <span className={`text-[9px] font-black px-2 py-1 rounded border uppercase tracking-widest ${order.status === 'pending' ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' : order.status === 'accepted' ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' : 'bg-green-500/10 text-green-500 border-green-500/20'}`}>{order.status}</span>
                          </div>
                          <p className="text-sm text-gray-400 bg-white/2 p-3 rounded-xl border border-white/5 font-medium leading-relaxed">&quot;{order.message}&quot;</p>
                          <div className="flex gap-2 pt-2">
                             {order.status === 'pending' && <button onClick={() => dispatch(updateDispatchStatus({ dispatchId: order.id, status: 'accepted' }))} className="flex-1 bg-blue-500 text-white font-black py-2 rounded-lg text-[10px] uppercase tracking-widest shadow-xl shadow-blue-900/20">Accept Job</button>}
                             {order.status === 'accepted' && <button onClick={() => setShowProofModal(order)} className="flex-1 bg-gold-primary text-black font-black py-2 rounded-lg text-[10px] uppercase tracking-widest shadow-xl shadow-gold-primary/20">Mark Complete</button>}
                          </div>
                       </div>
                    ))}
                 </div>
              </div>
           )}
        </div>
      )}

      {activeTab === 'utilities' && (
        <div className="space-y-12">
           <div className="bg-gold-primary/5 border border-gold-primary/20 p-8 rounded-[2rem] flex items-center gap-10 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-gold-primary/5 rounded-full -mr-32 -mt-32 blur-3xl opacity-50" />
              <div className="flex items-center gap-6 relative z-10">
                 <div className="p-5 bg-gold-primary rounded-3xl shadow-[0_0_30px_rgba(212,175,55,0.4)] animate-pulse">
                    <Zap size={40} className="text-black" />
                 </div>
                 <div className="space-y-1">
                    <h3 className="text-2xl font-black text-white italic uppercase tracking-tighter">Energy <span className="text-gold-primary">Marketplace</span></h3>
                    <p className="text-xs text-gray-500 font-bold uppercase tracking-widest opacity-80">Claim a sub-meter voucher, then arrange payment directly with the landlord</p>
                 </div>
              </div>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {utilityTokens.filter(t => t.status === 'available').map(token => (
                <motion.div key={token.id} whileHover={{ scale: 1.02 }} className="glass-panel p-8 border-gold-primary/10 bg-black/40 space-y-8 group transition-all cursor-pointer hover:border-gold-primary/50 shadow-2xl">
                   <div className="flex justify-between items-start">
                      <div className="p-4 bg-gold-primary/10 rounded-2xl group-hover:bg-gold-primary group-hover:text-black transition-colors">
                         <Zap size={28} className="text-gold-primary group-hover:text-inherit" />
                      </div>
                      <span className="text-3xl font-black text-white tracking-tighter group-hover:text-gold-primary transition-colors italic">{formatCurrencyByLocation(token.price)}</span>
                   </div>
                   <div className="space-y-4">
                      <div className="space-y-1">
                         <h4 className="font-black text-white text-lg tracking-tight uppercase opacity-80 italic">Electricity <span className="text-gold-primary">Top-Up</span></h4>
                         <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Prepaid Sub-Meter Unit</p>
                      </div>
                      <div className="bg-black/60 p-4 rounded-xl border border-white/5 shadow-inner">
                         <p className="text-[10px] text-gray-600 font-black uppercase tracking-widest mb-1">Target Meter</p>
                         <p className="text-sm font-mono text-gray-300 font-bold tracking-widest group-hover:text-gold-primary transition-colors">{token.meterNumber}</p>
                      </div>
                   </div>
                   <button
                    onClick={() => { dispatch(claimVoucher(token.id)); setAlertNotification('Voucher Purchased!') }}
                    className="w-full bg-gold-primary text-black font-black py-4 rounded-2xl text-xs uppercase tracking-widest shadow-xl shadow-gold-primary/10 active:scale-95 transition-all"
                   >
                    Buy Voucher Now
                   </button>
                </motion.div>
              ))}
           </div>

           {/* Purchase History */}
           {utilityTokens.some(t => t.purchasedBy === currentUser?.id) && (
              <div className="space-y-6 pt-10 border-t border-white/5">
                 <h3 className="text-xl font-black text-white uppercase italic tracking-tighter">My Secure <span className="text-gold-primary">Voucher Vault</span></h3>
                 <div className="space-y-3">
                    {utilityTokens.filter(t => t.purchasedBy === currentUser?.id).map(token => (
                      <div key={token.id} className="glass-panel p-6 flex flex-col md:flex-row justify-between items-center bg-black/60 border-white/5 hover:border-gold-primary/20 transition-all gap-6 shadow-2xl">
                         <div className="flex-1 flex flex-col md:flex-row items-center gap-8 text-center md:text-left">
                            <div className="space-y-1">
                               <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Meter Label</p>
                               <p className="text-lg font-black text-white tracking-widest">{token.meterNumber}</p>
                            </div>
                            <div className="space-y-1 bg-black/40 px-6 py-2 rounded-xl border border-white/5 shadow-inner">
                               <p className="text-[10px] text-gold-primary/50 font-black uppercase tracking-widest">Claimed — arrange handover</p>
                               <div className="flex items-center gap-4 text-lg font-mono text-gold-primary font-black tracking-widest">
                                  {token.meterNumber}
                                  <button onClick={() => { navigator.clipboard.writeText(token.meterNumber); setAlertNotification('Copied to Clipboard!') }} className="text-gray-700 hover:text-white active:scale-90 transition-all"><Copy size={16}/></button>
                               </div>
                            </div>
                         </div>
                         <div className="text-center md:text-right space-y-1">
                            <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Cost: {formatCurrencyByLocation(token.price)}</p>
                            <span className="bg-green-500/10 text-green-500 border border-green-500/20 px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">Secured</span>
                         </div>
                      </div>
                    ))}
                 </div>
              </div>
           )}
        </div>
      )}

      {/* MODALS SECTION */}
      <AnimatePresence>
         {showBusinessRegModal && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
               <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowBusinessRegModal(false)} className="absolute inset-0 bg-black/90 backdrop-blur-md" />
               <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="glass-panel w-full max-w-2xl bg-black border-gold-primary/20 shadow-2xl relative z-10 overflow-hidden">
                  <div className="bg-gold-primary/5 p-6 border-b border-white/5 flex justify-between items-center">
                     <h3 className="text-xl font-black text-white italic uppercase tracking-tighter">Business <span className="text-gold-primary">Onboarding</span></h3>
                     <button onClick={() => setShowBusinessRegModal(false)} className="text-gray-500 hover:text-white"><X /></button>
                  </div>
                  <form onSubmit={handleRegisterBusiness} className="p-8 space-y-6">
                     <div className="space-y-4">
                        <div className="space-y-2">
                           <label className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Business or Skill Name</label>
                           <input value={bizName} onChange={e => setBizName(e.target.value)} required className="w-full bg-black border border-white/10 rounded-xl p-3 text-sm text-white font-bold outline-none focus:border-gold-primary/40" placeholder="e.g. Sipho's Rapid Plumbing" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                           <div className="space-y-2">
                              <label className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Category</label>
                              <select value={bizCategory} onChange={e => setBizCategory(e.target.value as HandymanService['category'])} className="w-full bg-black border border-white/10 rounded-xl p-3 text-sm text-white font-bold outline-none focus:border-gold-primary/40">
                                 <option>Plumbing</option>
                                 <option>Electrical</option>
                                 <option>Construction</option>
                                 <option>Cleaning</option>
                                 <option>Security</option>
                                 <option>Bakkie / Transport</option>
                                 <option>General Services</option>
                              </select>
                           </div>
                           <div className="space-y-2">
                              <label className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Contact Number</label>
                              <input value={bizPhone} onChange={e => setBizPhone(e.target.value)} required className="w-full bg-black border border-white/10 rounded-xl p-3 text-sm text-white font-bold outline-none focus:border-gold-primary/40" placeholder="e.g. +27 72..." />
                           </div>
                        </div>
                        <div className="space-y-2">
                           <label className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Rate Estimate</label>
                           <input value={bizPrice} onChange={e => setBizPrice(e.target.value)} required className="w-full bg-black border border-white/10 rounded-xl p-3 text-sm text-white font-bold outline-none focus:border-gold-primary/40" placeholder="e.g. From R250 / hour" />
                        </div>
                        <div className="space-y-2">
                           <label className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Full Description</label>
                           <textarea value={bizDesc} onChange={e => setBizDesc(e.target.value)} required className="w-full bg-black border border-white/10 rounded-xl p-3 text-sm text-white font-medium h-24 resize-none outline-none focus:border-gold-primary/40" placeholder="Describe your experience, tools, and availability..." />
                        </div>
                     </div>
                     <button type="submit" className="w-full bg-gold-primary text-black font-black py-4 rounded-2xl uppercase tracking-widest text-xs shadow-xl shadow-gold-primary/20 active:scale-95 transition-all">Publish Business Card</button>
                  </form>
               </motion.div>
            </div>
         )}
      </AnimatePresence>

      <AnimatePresence>
         {selectedBiz && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
               <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedBiz(null)} className="absolute inset-0 bg-black/90 backdrop-blur-md" />
               <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="glass-panel w-full max-w-xl bg-black border-gold-primary/20 shadow-2xl relative z-10 p-8 space-y-8">
                  <div className="flex justify-between items-center">
                     <div className="space-y-1">
                        <h3 className="text-xl font-black text-white italic uppercase tracking-tighter">Hire <span className="text-gold-primary">Contractor</span></h3>
                        <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Dispatch Request to: {selectedBiz.businessName}</p>
                     </div>
                     <button onClick={() => setSelectedBiz(null)} className="text-gray-500 hover:text-white transition-colors"><X /></button>
                  </div>
                  <form onSubmit={handleDispatchContract} className="space-y-6">
                     <div className="space-y-2">
                        <label className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Job Details & Scope</label>
                        <textarea value={hireMessage} onChange={e => setHireMessage(e.target.value)} required className="w-full bg-black border border-white/10 rounded-xl p-4 text-sm text-white h-32 resize-none outline-none focus:border-gold-primary/40" placeholder="Explain the problem or help you need, your address, and preferred date..." />
                     </div>
                     <div className="bg-gold-primary/5 border border-gold-primary/10 p-4 rounded-xl">
                        <p className="text-[10px] text-gold-primary font-black uppercase tracking-widest mb-1 flex items-center gap-2"><Info size={12}/> Security Tip</p>
                        <p className="text-[10px] text-gray-500 leading-relaxed font-bold">Payments are handled offline. Request a quote after the contractor inspects the site.</p>
                     </div>
                     <button type="submit" className="w-full bg-gold-primary hover:bg-gold-secondary text-black font-black py-4 rounded-2xl uppercase tracking-widest text-xs shadow-xl flex items-center justify-center gap-2 active:scale-95 transition-all">
                        Dispatch Callout <Send size={14} />
                     </button>
                  </form>
               </motion.div>
            </div>
         )}
      </AnimatePresence>

      {/* PROOF OF WORK MODAL (MOCK) */}
      <AnimatePresence>
         {showProofModal && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
               <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowProofModal(null)} className="absolute inset-0 bg-black/90 backdrop-blur-md" />
               <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="glass-panel w-full max-w-md bg-black border-gold-primary/20 shadow-2xl relative z-10 p-8 text-center space-y-6">
                  <div className="w-20 h-20 bg-gold-primary/10 rounded-full flex items-center justify-center mx-auto shadow-2xl">
                     <ShieldCheck size={40} className="text-gold-primary" />
                  </div>
                  <div className="space-y-2">
                     <h3 className="text-2xl font-black text-white italic uppercase tracking-tighter">Finalize <span className="text-gold-primary">Order</span></h3>
                     <p className="text-xs text-gray-500 font-bold uppercase tracking-widest px-4 leading-relaxed">System is requesting proof of completion. Please confirm that the work for <strong>{showProofModal.serviceName}</strong> is finished to your satisfaction.</p>
                  </div>
                  <div className="pt-4 flex flex-col gap-3">
                     <button
                       onClick={() => { dispatch(updateDispatchStatus({ dispatchId: showProofModal.id, status: 'completed' })); setShowProofModal(null); setAlertNotification('Order marked as Completed!') }}
                       className="w-full bg-gold-primary text-black font-black py-4 rounded-2xl uppercase tracking-widest text-xs shadow-xl shadow-gold-primary/10 active:scale-95 transition-all"
                     >
                        Confirm & Complete
                     </button>
                     <button onClick={() => setShowProofModal(null)} className="text-[10px] text-gray-700 font-black uppercase tracking-widest hover:text-white transition-colors">Not Yet Finished</button>
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
               <div className="p-2 bg-green-500/20 rounded-full text-green-500 shadow-[0_0_15px_rgba(34,197,94,0.3)]"><Check size={24} /></div>
               <div className="space-y-0.5">
                  <p className="text-[10px] font-black text-gray-600 uppercase tracking-[0.2em]">Notification</p>
                  <p className="text-sm font-black text-white italic tracking-tight uppercase">{alertNotification}</p>
               </div>
               <button onClick={() => setAlertNotification(null)} className="ml-auto text-gray-700 hover:text-white transition-colors"><X size={16} /></button>
            </motion.div>
         )}
      </AnimatePresence>
    </div>
  )
}
