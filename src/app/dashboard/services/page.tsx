'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Car, Briefcase, Zap, MapPin, Clock, Calendar, Users, Star, Plus, ShieldCheck, Copy, X, Send, Check, Info, Truck, Lock, Link2, Image as ImageIcon
} from 'lucide-react'
import {
  RootState,
  AppDispatch,
  bookSeat,
  addService,
  addDispatch,
  addLiftClub,
  updateDispatchStatus,
  HandymanService,
  ServiceDispatch,
  LiftClub
} from '../../../store'
import { claimVoucher, joinWaitlist, cancelSeat } from '../../../store/actions'
import { formatCurrency } from '../../../utils/logic'
import FollowButton from '../components/social/FollowButton'
import TrustBadge from '../components/trust-safety/TrustBadge'
import OpenInMapsButton from '../components/map/OpenInMapsButton'
import MapSearchBox from '../components/map/MapSearchBox'
import type { GeocodeResult } from '../../../utils/geocode'
import UpgradeButton from '../components/shared/UpgradeButton'
import EmptyState from '../components/shared/EmptyState'
import { directionsUrlForAddress } from '../../../utils/navigation'
import { getPublicProviderTiersBulk, type ProviderTier } from '../../../utils/subscriptions'
import { supabase } from '../../../utils/supabase'
import { fetchUpcomingGruvsEvents } from '../../../utils/gruvsEvents'

// Categories where the server-side res_request_move_assist RPC accepts a dispatch.
const MOVE_ASSIST_CATEGORIES: HandymanService['category'][] = ['Bakkie / Transport', 'Moving Assistant']

interface UpcomingEvent {
  id: string
  title: string
}

interface TrustGate {
  status: 'new' | 'building' | 'established'
  unlocked: boolean
}

// Pay-for-priority ordering: Premium first, then Priority, then everyone
// else in existing order. A free provider is never excluded, only later
// in the list — the free floor is bookable, paying just buys placement.
const TIER_RANK: Record<'premium' | 'priority' | 'none', number> = { premium: 0, priority: 1, none: 2 }

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
  const [bizLocation, setBizLocation] = useState('')
  const [bizSuburb, setBizSuburb] = useState('')
  // res_handyman_services.lat/lon existed in the DB but nothing ever wrote
  // to it — "View on map" always fell back to re-geocoding free text, and
  // the map's own Handymen layer had nothing real to plot.
  const [bizLat, setBizLat] = useState<number | null>(null)
  const [bizLon, setBizLon] = useState<number | null>(null)

  // Hire Modal State
  const [selectedBiz, setSelectedBiz] = useState<HandymanService | null>(null)
  const [hireMessage, setHireMessage] = useState('')

  // Proof Modal State (Mock)
  const [showProofModal, setShowProofModal] = useState<ServiceDispatch | null>(null)

  // Lift Club Creation State
  const [showLiftModal, setShowLiftModal] = useState(false)
  const [liftOrigin, setLiftOrigin] = useState('')
  const [liftDestination, setLiftDestination] = useState('')
  const [liftDeparture, setLiftDeparture] = useState('')
  const [liftDays, setLiftDays] = useState('')
  const [liftPrice, setLiftPrice] = useState('')
  const [liftCurrency, setLiftCurrency] = useState('ZAR')
  const [liftSeats, setLiftSeats] = useState('4')
  const [liftEventId, setLiftEventId] = useState('')
  const [upcomingEvents, setUpcomingEvents] = useState<UpcomingEvent[]>([])
  const [eventTitles, setEventTitles] = useState<Record<string, string>>({})

  // Move-Assist State (gated by next-of-kin trust circle)
  const [trustGate, setTrustGate] = useState<TrustGate | null>(null)
  const [moveAssistTarget, setMoveAssistTarget] = useState<HandymanService | null>(null)
  const [moveAssistMessage, setMoveAssistMessage] = useState('')
  const [moveAssistSubmitting, setMoveAssistSubmitting] = useState(false)
  const [moveAssistError, setMoveAssistError] = useState<string | null>(null)

  const currentUser = useSelector((state: RootState) => state.auth.currentUser)
  const lifts = useSelector((state: RootState) => state.networking.lifts)
  const rawServices = useSelector((state: RootState) => state.networking.services)
  const [providerTiers, setProviderTiers] = useState<Record<string, ProviderTier>>({})

  const services = useMemo(() => [...rawServices].sort((a, b) =>
    TIER_RANK[(providerTiers[a.ownerId] || 'none') as 'premium' | 'priority' | 'none'] -
    TIER_RANK[(providerTiers[b.ownerId] || 'none') as 'premium' | 'priority' | 'none']
  ), [rawServices, providerTiers])
  const utilityTokens = useSelector((state: RootState) => state.utilities.tokens)
  const dispatches = useSelector((state: RootState) => state.networking.dispatches)

  // Show trust-circle progress proactively rather than only failing on click.
  useEffect(() => {
    let cancelled = false
    if (!supabase || !currentUser?.id) return
    supabase.rpc('res_trust_gate').then(({ data, error }: { data: TrustGate | null; error: unknown }) => {
      if (!cancelled && !error && data) setTrustGate(data)
    })
    return () => { cancelled = true }
  }, [currentUser?.id])

  // Batch-fetch provider tiers for every visible handyman card (no N+1).
  useEffect(() => {
    let cancelled = false
    const ownerIds = rawServices.map(s => s.ownerId)
    if (ownerIds.length === 0) return
    getPublicProviderTiersBulk(ownerIds).then(result => {
      if (!cancelled) setProviderTiers(result)
    })
    return () => { cancelled = true }
  }, [rawServices])

  // Batch-fetch titles for every event a lift is attached to (no N+1).
  useEffect(() => {
    let cancelled = false
    if (!supabase) return
    const ids = [...new Set(lifts.map(l => l.eventId).filter((id): id is string => !!id))]
    if (ids.length === 0) return
    supabase.from('events').select('id, title').in('id', ids).then(({ data }: { data: { id: string; title: string }[] | null }) => {
      if (cancelled || !data) return
      setEventTitles(prev => ({ ...prev, ...Object.fromEntries(data.map(e => [e.id, e.title])) }))
    })
    return () => { cancelled = true }
  }, [lifts])

  // Fetch upcoming events the moment the lift-creation form is opened.
  useEffect(() => {
    let cancelled = false
    if (!showLiftModal) return
    fetchUpcomingGruvsEvents().then(events => {
      if (!cancelled) setUpcomingEvents(events.map(e => ({ id: e.id, title: e.title })))
    })
    return () => { cancelled = true }
  }, [showLiftModal])

  const handleCreateLift = (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentUser) return
    const newLift: LiftClub = {
      id: `lift-${Date.now()}`,
      driverId: currentUser.id,
      driverName: currentUser.name || '',
      origin: liftOrigin,
      destination: liftDestination,
      departureTime: liftDeparture,
      days: liftDays,
      pricePerSeat: Number(liftPrice) || 0,
      currency: liftCurrency,
      availableSeats: Number(liftSeats) || 0,
      totalSeats: Number(liftSeats) || 0,
      eventId: liftEventId || null
    }
    dispatch(addLiftClub(newLift))
    setShowLiftModal(false)
    setLiftOrigin(''); setLiftDestination(''); setLiftDeparture(''); setLiftDays('')
    setLiftPrice(''); setLiftCurrency('ZAR'); setLiftSeats('4'); setLiftEventId('')
    setAlertNotification('Lift club posted!')
  }

  const openMoveAssist = (srv: HandymanService) => {
    setMoveAssistTarget(srv)
    setMoveAssistMessage('')
    setMoveAssistError(null)
  }

  const submitMoveAssist = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!moveAssistTarget || !supabase) return
    setMoveAssistSubmitting(true)
    setMoveAssistError(null)
    try {
      const { error } = await supabase.rpc('res_request_move_assist', {
        p_service_id: moveAssistTarget.id,
        p_message: moveAssistMessage || null
      })
      if (error) throw error
      setMoveAssistTarget(null)
      setAlertNotification('Move-assist request sent!')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('trust_gate_locked')) {
        setMoveAssistError('Build your next-of-kin trust circle (5+ confirmed connections) before requesting move help.')
      } else if (msg.includes('not a move-assist service')) {
        setMoveAssistError('This service is not eligible for move-assist requests.')
      } else {
        setMoveAssistError(msg || 'Could not send the request — try again.')
      }
    } finally {
      setMoveAssistSubmitting(false)
    }
  }

  const handleRegisterBusiness = (e: React.FormEvent) => {
    e.preventDefault()
    const newBiz: HandymanService = {
      id: `biz-${Date.now()}`,
      ownerId: currentUser?.id || '',
      businessName: bizName,
      category: bizCategory,
      location: bizLocation,
      suburb: bizSuburb,
      rating: 5.0,
      contactNumber: bizPhone,
      priceEstimate: bizPrice,
      description: bizDesc,
      image: 'https://images.unsplash.com/photo-1581092921461-eab62e97a780?auto=format&fit=crop&w=600&q=80',
      reviewsCount: 0,
      lat: bizLat ?? undefined,
      lon: bizLon ?? undefined
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
      {/* Duplicated what the top bar already shows (icon + "Services") —
          removed for the same reason as Housing's. */}
      <header className="flex justify-end">
        <div className="flex bg-surface-sunken/40 p-1.5 rounded-2xl border border-subtle shadow-2xl backdrop-blur-xl w-full md:w-auto overflow-x-auto no-scrollbar">
          {[
            { id: 'lifts', label: 'Lifts', icon: Car },
            { id: 'handymen', label: 'Skills', icon: Briefcase },
            { id: 'utilities', label: 'Utilities', icon: Zap },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as 'lifts' | 'handymen' | 'utilities')}
              className={`flex-1 md:flex-none px-6 py-2.5 rounded-xl transition-all text-xs font-black uppercase tracking-widest flex items-center gap-2 whitespace-nowrap ${activeTab === t.id ? 'bg-accent text-content-on-accent shadow-lg shadow-gold-primary/20' : 'text-content-muted hover:text-content'}`}
            >
              <t.icon size={14} /> {t.label}
            </button>
          ))}
        </div>
      </header>

      {activeTab === 'lifts' && (
        <div className="space-y-4">
           {/* Riding with a stranger is a real safety decision, not just a
               transaction — so posting/offering a lift is gated by the same
               next-of-kin trust circle that already gates Move Assist below,
               rather than open to anyone the moment they sign up. Browsing
               and booking an existing lift stays open to everyone; this only
               gates OFFERING one. */}
           {trustGate && !trustGate.unlocked ? (
              <a href="/dashboard/trust-circle" className="w-full flex items-center justify-between gap-3 bg-accent/5 border border-accent/20 rounded-2xl px-6 py-4 hover:border-accent/40 transition-all">
                 <span className="flex items-center gap-3 text-left">
                    <Lock size={18} className="text-accent shrink-0" />
                    <span>
                       <span className="block text-xs font-black text-content uppercase tracking-widest">Build trust to offer a lift</span>
                       <span className="block text-[11px] text-content-muted mt-0.5">
                          {trustGate.status === 'building' ? 'Your next-of-kin circle is growing — almost there.' : 'Add people to your next-of-kin circle first — offering a ride to strangers needs a real safety trail.'}
                       </span>
                    </span>
                 </span>
                 <span className="text-[10px] font-black text-accent uppercase tracking-widest shrink-0">Next of Kin →</span>
              </a>
           ) : (
              <div className="flex justify-end">
                 <button
                    onClick={() => setShowLiftModal(true)}
                    className="w-full md:w-auto bg-surface-raised/5 hover:bg-accent hover:text-content-on-accent border border-default hover:border-accent text-content font-black px-8 py-4 rounded-2xl transition-all active:scale-95 flex items-center justify-center gap-3 uppercase tracking-widest text-xs"
                 >
                    <Plus size={18} /> Post a Lift
                 </button>
              </div>
           )}
           {lifts.map(lift => (
             <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} key={lift.id} className="glass-panel p-6 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8 bg-surface-sunken/40 border-subtle group hover:border-accent/30 transition-all">
                <div className="flex-1 space-y-4">
                   <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2.5 flex-wrap">
                         <h3 className="text-xl font-black text-content tracking-tight uppercase group-hover:text-accent transition-colors italic">{lift.driverName}</h3>
                         {/* The one piece of real trust info riders had before getting
                             in this driver's car was a first name. TrustBadge pulls
                             their actual verification/reputation — driver_id was
                             already on this row, just never read past the display
                             name (see LiftClub.driverId). */}
                         <TrustBadge userId={lift.driverId} compact />
                      </div>
                      <div className="bg-accent/10 border border-accent/20 text-accent px-4 py-1 rounded-xl font-black text-sm tracking-tighter">
                         {formatCurrency(lift.pricePerSeat, lift.currency)} <span className="text-[10px] opacity-60 ml-1">PER SEAT</span>
                      </div>
                   </div>
                   {lift.eventId && eventTitles[lift.eventId] && (
                      <span className="inline-flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest bg-accent/10 text-accent border border-accent/20 px-3 py-1.5 rounded-lg">
                         🚗 For: {eventTitles[lift.eventId]}
                      </span>
                   )}
                   <div className="flex flex-col md:flex-row md:items-center text-sm gap-2 md:gap-4">
                      <div className="flex items-center gap-2 text-content font-bold bg-surface-raised/5 px-3 py-1.5 rounded-lg border border-subtle shadow-inner">
                         <MapPin size={16} className="text-accent" /> {lift.origin}
                      </div>
                      <div className="flex justify-center text-content-subtle font-black tracking-widest">➔</div>
                      <div className="flex items-center gap-2 text-content font-bold bg-surface-raised/5 px-3 py-1.5 rounded-lg border border-subtle shadow-inner">
                         <MapPin size={16} className="text-accent" /> {lift.destination}
                      </div>
                      <a
                        href={directionsUrlForAddress(lift.destination, lift.origin)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-[10px] font-black text-accent uppercase tracking-widest hover:underline"
                      >
                        Preview route
                      </a>
                   </div>
                   <div className="flex flex-wrap gap-3 pt-2">
                      <span className="text-[9px] font-black uppercase tracking-widest bg-surface-sunken/40 px-3 py-1.5 rounded-lg text-content-muted border border-subtle flex items-center gap-2"><Clock size={12} className="text-accent" /> {lift.departureTime}</span>
                      <span className="text-[9px] font-black uppercase tracking-widest bg-surface-sunken/40 px-3 py-1.5 rounded-lg text-content-muted border border-subtle flex items-center gap-2"><Calendar size={12} className="text-accent" /> {lift.days}</span>
                      <span className="text-[9px] font-black uppercase tracking-widest bg-surface-sunken/40 px-3 py-1.5 rounded-lg text-content-muted border border-subtle flex items-center gap-2"><Users size={12} className="text-accent" /> {lift.availableSeats} SEATS LEFT</span>
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
                    className="flex-1 lg:flex-none bg-accent hover:bg-accent text-content-on-accent font-black px-10 py-4 rounded-2xl transition-all active:scale-95 shadow-xl shadow-gold-primary/10 uppercase tracking-widest text-xs"
                  >
                    {lift.availableSeats > 0 ? 'Request Ride' : 'Join Waitlist'}
                  </button>
                  <button
                    onClick={() => { dispatch(cancelSeat(lift.id)); setAlertNotification('Seat cancelled.') }}
                    className="text-[10px] text-content-muted hover:text-danger uppercase font-bold tracking-widest px-3"
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
              <div className="glass-panel p-6 bg-info/5 border-info/10 flex-1 flex flex-col md:flex-row gap-6 items-center shadow-2xl">
                 <div className="p-4 bg-info/20 rounded-2xl shadow-xl shadow-info/10">
                    <Star size={32} className="text-info" />
                 </div>
                 <div className="text-center md:text-left">
                    <h3 className="text-lg font-black text-content uppercase tracking-widest italic">Local Verified <span className="text-info">Professionals</span></h3>
                    <p className="text-xs text-content-muted font-bold uppercase tracking-widest opacity-60">Verified skills helping to grow the local economy</p>
                 </div>
              </div>
              {trustGate && !trustGate.unlocked ? (
                 <a href="/dashboard/trust-circle" className="w-full lg:w-auto flex items-center gap-3 bg-accent/5 border border-accent/20 rounded-2xl px-6 py-4 hover:border-accent/40 transition-all">
                    <Lock size={16} className="text-accent shrink-0" />
                    <span className="text-left">
                       <span className="block text-[11px] font-black text-content uppercase tracking-widest">Build trust to list</span>
                       <span className="block text-[10px] text-content-muted mt-0.5">Grow your next-of-kin circle first →</span>
                    </span>
                 </a>
              ) : (
                 <button
                    onClick={() => setShowBusinessRegModal(true)}
                    className="w-full lg:w-auto bg-surface-raised/5 hover:bg-accent hover:text-content-on-accent border border-default hover:border-accent text-content font-black px-8 py-5 rounded-2xl transition-all active:scale-95 flex items-center justify-center gap-3 uppercase tracking-widest text-xs"
                 >
                    <Plus size={20} /> Advertise My Skills
                 </button>
              )}
           </div>

           {services.length === 0 ? (
             <div className="glass-panel">
               <EmptyState icon={Briefcase} title="No local pros listed yet" subtitle="Be the first to advertise your skills to the neighbourhood." />
             </div>
           ) : (
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
             {services.map(srv => (
               <motion.div key={srv.id} whileHover={{ y: -5 }} className="glass-panel overflow-hidden flex flex-col group bg-surface-sunken/40 hover:border-accent/40 transition-all duration-500 shadow-2xl">
                  <div className="h-44 bg-surface relative overflow-hidden">
                     {srv.image ? (
                       <img src={srv.image} alt={srv.businessName} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 opacity-60 group-hover:opacity-100" />
                     ) : (
                       <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-content-muted to-black">
                         <ImageIcon size={32} className="text-accent/20" />
                       </div>
                     )}
                     <div className="absolute top-4 right-4 bg-surface-sunken/60 backdrop-blur-xl border border-default px-3 py-1.5 rounded-xl flex items-center gap-2 shadow-2xl">
                        <Star size={14} className="text-accent fill-gold-primary" />
                        <span className="text-xs font-black text-content">{srv.rating}</span>
                        <span className="text-[10px] text-content-muted font-bold">({srv.reviewsCount})</span>
                     </div>
                     <div className="absolute bottom-4 left-4 flex gap-2">
                        <span className="bg-accent text-content-on-accent px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest shadow-xl">{srv.category}</span>
                        {providerTiers[srv.ownerId] && (
                           <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest shadow-xl ${providerTiers[srv.ownerId] === 'premium' ? 'bg-info text-content' : 'bg-info text-content'}`}>
                              {providerTiers[srv.ownerId] === 'premium' ? 'Premium' : 'Priority'}
                           </span>
                        )}
                     </div>
                  </div>
                  <div className="p-6 flex-1 flex flex-col gap-5">
                     <div className="space-y-1">
                        <h3 className="text-xl font-black text-content tracking-tight uppercase italic group-hover:text-accent transition-colors">{srv.businessName}</h3>
                        <div className="flex items-center justify-between gap-2">
                           <div className="flex items-center text-[10px] text-content-muted font-black uppercase tracking-widest gap-2">
                              <MapPin size={12} className="text-accent" /> {srv.suburb}
                           </div>
                           <OpenInMapsButton address={`${srv.location}, ${srv.suburb}`} lat={srv.lat} lon={srv.lon} label={srv.businessName} />
                        </div>
                     </div>
                     <p className="text-sm text-content-muted line-clamp-3 leading-relaxed opacity-80 font-medium italic">&quot;{srv.description}&quot;</p>

                     {srv.ownerId !== currentUser?.id && (
                       <div className="flex justify-end items-center gap-2 -mt-2">
                         <TrustBadge userId={srv.ownerId} compact />
                         <FollowButton targetUserId={srv.ownerId} currentUserId={currentUser?.id} />
                       </div>
                     )}

                     <div className="bg-surface-raised/[0.02] border border-subtle rounded-xl p-3 flex justify-between items-center">
                        <span className="text-[9px] font-black text-content-subtle uppercase tracking-widest">Rate Estimate</span>
                        <span className="text-sm font-black text-content tracking-tighter">{srv.priceEstimate}</span>
                     </div>

                     <div className="mt-auto pt-6 border-t border-subtle space-y-3">
                        {srv.ownerId !== currentUser?.id && MOVE_ASSIST_CATEGORIES.includes(srv.category) && (
                           <div className="space-y-1.5">
                              <button
                                 onClick={() => openMoveAssist(srv)}
                                 className="w-full bg-accent hover:bg-accent text-content-on-accent font-black py-4 rounded-xl transition-all active:scale-95 text-xs uppercase tracking-widest flex items-center justify-center gap-2 shadow-xl shadow-gold-primary/10"
                              >
                                 <Truck size={16} /> Request Move Assist
                              </button>
                              {trustGate && !trustGate.unlocked && (
                                 <p className="text-[9px] text-content-muted font-bold uppercase tracking-widest text-center flex items-center justify-center gap-1.5">
                                    <Lock size={10} className="text-accent" /> {trustGate.status === 'building' ? 'Building your next-of-kin circle' : 'Build your next-of-kin circle to unlock'}
                                 </p>
                              )}
                           </div>
                        )}
                        <button
                           onClick={() => setSelectedBiz(srv)}
                           className="w-full bg-surface-raised/5 hover:bg-accent hover:text-content-on-accent border border-default hover:border-accent text-content font-black py-4 rounded-xl transition-all active:scale-95 text-xs uppercase tracking-widest"
                        >
                           {srv.ownerId === currentUser?.id ? 'Manage My Card' : 'Hire Contractor'}
                        </button>
                        {srv.ownerId === currentUser?.id && !providerTiers[srv.ownerId] && (
                           <div className="space-y-2 pt-2 border-t border-subtle">
                              <p className="text-[9px] text-content-muted font-bold uppercase tracking-widest text-center">Free listing — get seen first</p>
                              <div className="grid grid-cols-2 gap-2">
                                 <UpgradeButton item="priority" className="w-full bg-info/10 hover:bg-info hover:text-content border border-info/30 text-info font-black py-2.5 rounded-xl text-[10px] uppercase tracking-widest transition-all active:scale-95" />
                                 <UpgradeButton item="premium" className="w-full bg-info/10 hover:bg-info hover:text-content border border-info/30 text-info font-black py-2.5 rounded-xl text-[10px] uppercase tracking-widest transition-all active:scale-95" />
                              </div>
                           </div>
                        )}
                     </div>
                  </div>
               </motion.div>
             ))}
           </div>
           )}

           {/* Service Logs Section */}
           {incomingOrders.length > 0 && (
              <div className="space-y-6 pt-10 border-t border-subtle">
                 <h3 className="text-xl font-black text-content uppercase italic tracking-tighter">My Incoming <span className="text-accent">Job Orders</span></h3>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {incomingOrders.map(order => (
                       <div key={order.id} className="glass-panel p-5 bg-surface-sunken/40 border-subtle flex flex-col gap-4">
                          <div className="flex justify-between items-start">
                             <div className="space-y-0.5">
                                <p className="text-[10px] text-content-muted font-black uppercase tracking-widest">From: {order.senderName}</p>
                                <p className="text-xs font-black text-content italic">{order.timestamp}</p>
                             </div>
                             <span className={`text-[9px] font-black px-2 py-1 rounded border uppercase tracking-widest ${order.status === 'pending' ? 'bg-warning/10 text-warning border-warning/20' : order.status === 'accepted' ? 'bg-info/10 text-info border-info/20' : 'bg-success/10 text-success border-success/20'}`}>{order.status}</span>
                          </div>
                          <p className="text-sm text-content-muted bg-surface-raised/[0.02] p-3 rounded-xl border border-subtle font-medium leading-relaxed">&quot;{order.message}&quot;</p>
                          <div className="flex gap-2 pt-2">
                             {order.status === 'pending' && <button onClick={() => dispatch(updateDispatchStatus({ dispatchId: order.id, status: 'accepted' }))} className="flex-1 bg-info text-content font-black py-2 rounded-lg text-[10px] uppercase tracking-widest shadow-xl shadow-info/20">Accept Job</button>}
                             {order.status === 'accepted' && <button onClick={() => setShowProofModal(order)} className="flex-1 bg-accent text-content-on-accent font-black py-2 rounded-lg text-[10px] uppercase tracking-widest shadow-xl shadow-gold-primary/20">Mark Complete</button>}
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
           <div className="bg-accent/5 border border-accent/20 p-8 rounded-[2rem] flex items-center gap-10 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-accent/5 rounded-full -mr-32 -mt-32 blur-3xl opacity-50" />
              <div className="flex items-center gap-6 relative z-10">
                 <div className="p-5 bg-accent rounded-3xl shadow-[0_0_30px_rgba(212,175,55,0.4)] animate-pulse">
                    <Zap size={40} className="text-content-on-accent" />
                 </div>
                 <div className="space-y-1">
                    <h3 className="text-2xl font-black text-content italic uppercase tracking-tighter">Energy <span className="text-accent">Marketplace</span></h3>
                    <p className="text-xs text-content-muted font-bold uppercase tracking-widest opacity-80">Claim a sub-meter voucher, then arrange payment directly with the landlord</p>
                 </div>
              </div>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {utilityTokens.filter(t => t.status === 'available').map(token => (
                <motion.div key={token.id} whileHover={{ scale: 1.02 }} className="glass-panel p-8 border-accent/10 bg-surface-sunken/40 space-y-8 group transition-all cursor-pointer hover:border-accent/50 shadow-2xl">
                   <div className="flex justify-between items-start">
                      <div className="p-4 bg-accent/10 rounded-2xl group-hover:bg-accent group-hover:text-content-on-accent transition-colors">
                         <Zap size={28} className="text-accent group-hover:text-inherit" />
                      </div>
                      <span className="text-3xl font-black text-content tracking-tighter group-hover:text-accent transition-colors italic">{formatCurrency(token.price, token.currency)}</span>
                   </div>
                   <div className="space-y-4">
                      <div className="space-y-1">
                         <h4 className="font-black text-content text-lg tracking-tight uppercase opacity-80 italic">Electricity <span className="text-accent">Top-Up</span></h4>
                         <p className="text-[10px] text-content-muted font-black uppercase tracking-widest">Prepaid Sub-Meter Unit</p>
                      </div>
                      <div className="bg-surface-sunken/60 p-4 rounded-xl border border-subtle shadow-inner">
                         <p className="text-[10px] text-content-subtle font-black uppercase tracking-widest mb-1">Target Meter</p>
                         <p className="text-sm font-mono text-content font-bold tracking-widest group-hover:text-accent transition-colors">{token.meterNumber}</p>
                      </div>
                   </div>
                   <button
                    onClick={() => { dispatch(claimVoucher(token.id)); setAlertNotification('Voucher Purchased!') }}
                    className="w-full bg-accent text-content-on-accent font-black py-4 rounded-2xl text-xs uppercase tracking-widest shadow-xl shadow-gold-primary/10 active:scale-95 transition-all"
                   >
                    Buy Voucher Now
                   </button>
                </motion.div>
              ))}
           </div>

           {/* Purchase History */}
           {utilityTokens.some(t => t.purchasedBy === currentUser?.id) && (
              <div className="space-y-6 pt-10 border-t border-subtle">
                 <h3 className="text-xl font-black text-content uppercase italic tracking-tighter">My Secure <span className="text-accent">Voucher Vault</span></h3>
                 <div className="space-y-3">
                    {utilityTokens.filter(t => t.purchasedBy === currentUser?.id).map(token => (
                      <div key={token.id} className="glass-panel p-6 flex flex-col md:flex-row justify-between items-center bg-surface-sunken/60 border-subtle hover:border-accent/20 transition-all gap-6 shadow-2xl">
                         <div className="flex-1 flex flex-col md:flex-row items-center gap-8 text-center md:text-left">
                            <div className="space-y-1">
                               <p className="text-[10px] text-content-muted font-black uppercase tracking-widest">Meter Label</p>
                               <p className="text-lg font-black text-content tracking-widest">{token.meterNumber}</p>
                            </div>
                            <div className="space-y-1 bg-surface-sunken/40 px-6 py-2 rounded-xl border border-subtle shadow-inner">
                               <p className="text-[10px] text-accent/50 font-black uppercase tracking-widest">Claimed — arrange handover</p>
                               <div className="flex items-center gap-4 text-lg font-mono text-accent font-black tracking-widest">
                                  {token.meterNumber}
                                  <button onClick={() => { navigator.clipboard.writeText(token.meterNumber); setAlertNotification('Copied to Clipboard!') }} className="text-content-subtle hover:text-content active:scale-90 transition-all"><Copy size={16}/></button>
                               </div>
                            </div>
                         </div>
                         <div className="text-center md:text-right space-y-1">
                            <p className="text-[10px] text-content-muted font-black uppercase tracking-widest">Cost: {formatCurrency(token.price, token.currency)}</p>
                            <span className="bg-success/10 text-success border border-success/20 px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">Secured</span>
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
               <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowBusinessRegModal(false)} className="absolute inset-0 bg-surface-sunken/90 backdrop-blur-md" />
               <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="glass-panel w-full max-w-2xl bg-surface border-accent/20 shadow-2xl relative z-10 overflow-hidden">
                  <div className="bg-accent/5 p-6 border-b border-subtle flex justify-between items-center">
                     <h3 className="text-xl font-black text-content italic uppercase tracking-tighter">Business <span className="text-accent">Onboarding</span></h3>
                     <button onClick={() => setShowBusinessRegModal(false)} className="text-content-muted hover:text-content"><X /></button>
                  </div>
                  <form onSubmit={handleRegisterBusiness} className="p-8 space-y-6">
                     <div className="space-y-4">
                        <div className="space-y-2">
                           <label className="text-[10px] text-content-muted font-black uppercase tracking-widest">Business or Skill Name</label>
                           <input value={bizName} onChange={e => setBizName(e.target.value)} required className="w-full bg-surface border border-default rounded-xl p-3 text-sm text-content font-bold outline-none focus:border-accent/40" placeholder="e.g. Sipho's Rapid Plumbing" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                           <div className="space-y-2">
                              <label className="text-[10px] text-content-muted font-black uppercase tracking-widest">Category</label>
                              <select value={bizCategory} onChange={e => setBizCategory(e.target.value as HandymanService['category'])} className="w-full bg-surface border border-default rounded-xl p-3 text-sm text-content font-bold outline-none focus:border-accent/40">
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
                              <label className="text-[10px] text-content-muted font-black uppercase tracking-widest">Contact Number</label>
                              <input value={bizPhone} onChange={e => setBizPhone(e.target.value)} required className="w-full bg-surface border border-default rounded-xl p-3 text-sm text-content font-bold outline-none focus:border-accent/40" placeholder="e.g. +1 555 010 1234" />
                           </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                           <div className="space-y-2">
                              <label className="text-[10px] text-content-muted font-black uppercase tracking-widest">Location / City</label>
                              <input value={bizLocation} onChange={e => setBizLocation(e.target.value)} required className="w-full bg-surface border border-default rounded-xl p-3 text-sm text-content font-bold outline-none focus:border-accent/40" placeholder="e.g. Berlin, Germany" />
                           </div>
                           <div className="space-y-2">
                              <label className="text-[10px] text-content-muted font-black uppercase tracking-widest">Suburb / Neighbourhood</label>
                              <input value={bizSuburb} onChange={e => setBizSuburb(e.target.value)} required className="w-full bg-surface border border-default rounded-xl p-3 text-sm text-content font-bold outline-none focus:border-accent/40" placeholder="e.g. Kreuzberg" />
                           </div>
                        </div>
                        <div className="space-y-2">
                           <label className="text-[10px] text-content-muted font-black uppercase tracking-widest">
                              Pin the exact spot on the map <span className="normal-case font-normal text-content-subtle">(optional, but makes &quot;View on map&quot; point here for real)</span>
                           </label>
                           <MapSearchBox onSelect={(result: GeocodeResult) => { setBizLat(result.lat); setBizLon(result.lon) }} />
                           {bizLat != null && bizLon != null && (
                              <p className="text-[10px] text-accent">Pinned — {bizLat.toFixed(4)}, {bizLon.toFixed(4)}</p>
                           )}
                        </div>
                        <div className="space-y-2">
                           <label className="text-[10px] text-content-muted font-black uppercase tracking-widest">Rate Estimate</label>
                           <input value={bizPrice} onChange={e => setBizPrice(e.target.value)} required className="w-full bg-surface border border-default rounded-xl p-3 text-sm text-content font-bold outline-none focus:border-accent/40" placeholder="e.g. From 25/hour" />
                        </div>
                        <div className="space-y-2">
                           <label className="text-[10px] text-content-muted font-black uppercase tracking-widest">Full Description</label>
                           <textarea value={bizDesc} onChange={e => setBizDesc(e.target.value)} required className="w-full bg-surface border border-default rounded-xl p-3 text-sm text-content font-medium h-24 resize-none outline-none focus:border-accent/40" placeholder="Describe your experience, tools, and availability..." />
                        </div>
                     </div>
                     <button type="submit" className="w-full bg-accent text-content-on-accent font-black py-4 rounded-2xl uppercase tracking-widest text-xs shadow-xl shadow-gold-primary/20 active:scale-95 transition-all">Publish Business Card</button>
                  </form>
               </motion.div>
            </div>
         )}
      </AnimatePresence>

      <AnimatePresence>
         {selectedBiz && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
               <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedBiz(null)} className="absolute inset-0 bg-surface-sunken/90 backdrop-blur-md" />
               <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="glass-panel w-full max-w-xl bg-surface border-accent/20 shadow-2xl relative z-10 p-8 space-y-8">
                  <div className="flex justify-between items-center">
                     <div className="space-y-1">
                        <h3 className="text-xl font-black text-content italic uppercase tracking-tighter">Hire <span className="text-accent">Contractor</span></h3>
                        <p className="text-[10px] text-content-muted font-black uppercase tracking-widest">Dispatch Request to: {selectedBiz.businessName}</p>
                     </div>
                     <button onClick={() => setSelectedBiz(null)} className="text-content-muted hover:text-content transition-colors"><X /></button>
                  </div>
                  <form onSubmit={handleDispatchContract} className="space-y-6">
                     <div className="space-y-2">
                        <label className="text-[10px] text-content-muted font-black uppercase tracking-widest">Job Details & Scope</label>
                        <textarea value={hireMessage} onChange={e => setHireMessage(e.target.value)} required className="w-full bg-surface border border-default rounded-xl p-4 text-sm text-content h-32 resize-none outline-none focus:border-accent/40" placeholder="Explain the problem or help you need, your address, and preferred date..." />
                     </div>
                     <div className="bg-accent/5 border border-accent/10 p-4 rounded-xl">
                        <p className="text-[10px] text-accent font-black uppercase tracking-widest mb-1 flex items-center gap-2"><Info size={12}/> Security Tip</p>
                        <p className="text-[10px] text-content-muted leading-relaxed font-bold">Payments are handled offline. Request a quote after the contractor inspects the site.</p>
                     </div>
                     <button type="submit" className="w-full bg-accent hover:bg-accent text-content-on-accent font-black py-4 rounded-2xl uppercase tracking-widest text-xs shadow-xl flex items-center justify-center gap-2 active:scale-95 transition-all">
                        Dispatch Callout <Send size={14} />
                     </button>
                  </form>
               </motion.div>
            </div>
         )}
      </AnimatePresence>

      {/* LIFT CLUB CREATION MODAL */}
      <AnimatePresence>
         {showLiftModal && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
               <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowLiftModal(false)} className="absolute inset-0 bg-surface-sunken/90 backdrop-blur-md" />
               <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="glass-panel w-full max-w-2xl bg-surface border-accent/20 shadow-2xl relative z-10 overflow-hidden max-h-[90vh] overflow-y-auto">
                  <div className="bg-accent/5 p-6 border-b border-subtle flex justify-between items-center">
                     <h3 className="text-xl font-black text-content italic uppercase tracking-tighter">Post a <span className="text-accent">Lift</span></h3>
                     <button onClick={() => setShowLiftModal(false)} className="text-content-muted hover:text-content"><X /></button>
                  </div>
                  <form onSubmit={handleCreateLift} className="p-8 space-y-6">
                     <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                           <label className="text-[10px] text-content-muted font-black uppercase tracking-widest">Origin</label>
                           <input value={liftOrigin} onChange={e => setLiftOrigin(e.target.value)} required className="w-full bg-surface border border-default rounded-xl p-3 text-sm text-content font-bold outline-none focus:border-accent/40" placeholder="e.g. Kreuzberg" />
                        </div>
                        <div className="space-y-2">
                           <label className="text-[10px] text-content-muted font-black uppercase tracking-widest">Destination</label>
                           <input value={liftDestination} onChange={e => setLiftDestination(e.target.value)} required className="w-full bg-surface border border-default rounded-xl p-3 text-sm text-content font-bold outline-none focus:border-accent/40" placeholder="e.g. City Centre" />
                        </div>
                     </div>
                     <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                           <label className="text-[10px] text-content-muted font-black uppercase tracking-widest">Departure Time</label>
                           <input value={liftDeparture} onChange={e => setLiftDeparture(e.target.value)} required className="w-full bg-surface border border-default rounded-xl p-3 text-sm text-content font-bold outline-none focus:border-accent/40" placeholder="e.g. 07:30" />
                        </div>
                        <div className="space-y-2">
                           <label className="text-[10px] text-content-muted font-black uppercase tracking-widest">Days</label>
                           <input value={liftDays} onChange={e => setLiftDays(e.target.value)} required className="w-full bg-surface border border-default rounded-xl p-3 text-sm text-content font-bold outline-none focus:border-accent/40" placeholder="e.g. Mon-Fri" />
                        </div>
                     </div>
                     <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2">
                           <label className="text-[10px] text-content-muted font-black uppercase tracking-widest">Price / Seat</label>
                           <input type="number" min="0" value={liftPrice} onChange={e => setLiftPrice(e.target.value)} required className="w-full bg-surface border border-default rounded-xl p-3 text-sm text-content font-bold outline-none focus:border-accent/40" placeholder="e.g. 20" />
                        </div>
                        <div className="space-y-2">
                           <label className="text-[10px] text-content-muted font-black uppercase tracking-widest">Currency</label>
                           <input value={liftCurrency} onChange={e => setLiftCurrency(e.target.value.toUpperCase())} maxLength={3} required className="w-full bg-surface border border-default rounded-xl p-3 text-sm text-content font-bold outline-none focus:border-accent/40" placeholder="ZAR" />
                        </div>
                        <div className="space-y-2">
                           <label className="text-[10px] text-content-muted font-black uppercase tracking-widest">Total Seats</label>
                           <input type="number" min="1" value={liftSeats} onChange={e => setLiftSeats(e.target.value)} required className="w-full bg-surface border border-default rounded-xl p-3 text-sm text-content font-bold outline-none focus:border-accent/40" placeholder="e.g. 4" />
                        </div>
                     </div>
                     <div className="space-y-2">
                        <label className="text-[10px] text-content-muted font-black uppercase tracking-widest flex items-center gap-2"><Link2 size={12} className="text-accent" /> Attach to an Event (optional)</label>
                        <select value={liftEventId} onChange={e => setLiftEventId(e.target.value)} className="w-full bg-surface border border-default rounded-xl p-3 text-sm text-content font-bold outline-none focus:border-accent/40">
                           <option value="">— No event —</option>
                           {upcomingEvents.map(ev => (
                              <option key={ev.id} value={ev.id}>{ev.title}</option>
                           ))}
                        </select>
                     </div>
                     <button type="submit" className="w-full bg-accent text-content-on-accent font-black py-4 rounded-2xl uppercase tracking-widest text-xs shadow-xl shadow-gold-primary/20 active:scale-95 transition-all">Post Lift Club</button>
                  </form>
               </motion.div>
            </div>
         )}
      </AnimatePresence>

      {/* MOVE-ASSIST REQUEST MODAL */}
      <AnimatePresence>
         {moveAssistTarget && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
               <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMoveAssistTarget(null)} className="absolute inset-0 bg-surface-sunken/90 backdrop-blur-md" />
               <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="glass-panel w-full max-w-xl bg-surface border-accent/20 shadow-2xl relative z-10 p-8 space-y-6">
                  <div className="flex justify-between items-center">
                     <div className="space-y-1">
                        <h3 className="text-xl font-black text-content italic uppercase tracking-tighter">Request <span className="text-accent">Move Assist</span></h3>
                        <p className="text-[10px] text-content-muted font-black uppercase tracking-widest">Dispatch Request to: {moveAssistTarget.businessName}</p>
                     </div>
                     <button onClick={() => setMoveAssistTarget(null)} className="text-content-muted hover:text-content transition-colors"><X /></button>
                  </div>

                  {trustGate && (
                     <div className={`p-4 rounded-xl border flex items-center gap-3 ${trustGate.unlocked ? 'bg-success/5 border-success/20' : 'bg-accent/5 border-accent/10'}`}>
                        {trustGate.unlocked ? <ShieldCheck size={20} className="text-success" /> : <Lock size={20} className="text-accent" />}
                        <p className="text-[10px] text-content-muted font-bold uppercase tracking-widest leading-relaxed">
                           {trustGate.unlocked
                              ? 'Your next-of-kin circle is established — you can request move help.'
                              : trustGate.status === 'building'
                              ? "You're building your next-of-kin circle. Keep confirming connections to unlock move help."
                              : 'Add next-of-kin connections before requesting move help — this keeps move-assist limited to people the community actually vouches for.'}
                        </p>
                     </div>
                  )}

                  <form onSubmit={submitMoveAssist} className="space-y-6">
                     <div className="space-y-2">
                        <label className="text-[10px] text-content-muted font-black uppercase tracking-widest">Message (optional)</label>
                        <textarea value={moveAssistMessage} onChange={e => setMoveAssistMessage(e.target.value)} className="w-full bg-surface border border-default rounded-xl p-4 text-sm text-content h-28 resize-none outline-none focus:border-accent/40" placeholder="Moving date, address, how much help you need..." />
                     </div>
                     {moveAssistError && (
                        <div className="bg-danger/5 border border-danger/20 p-4 rounded-xl">
                           <p className="text-[10px] text-danger leading-relaxed font-bold">{moveAssistError}</p>
                        </div>
                     )}
                     <button type="submit" disabled={moveAssistSubmitting} className="w-full bg-accent hover:bg-accent text-content-on-accent font-black py-4 rounded-2xl uppercase tracking-widest text-xs shadow-xl flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50">
                        {moveAssistSubmitting ? 'Sending…' : 'Send Move-Assist Request'} <Send size={14} />
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
               <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowProofModal(null)} className="absolute inset-0 bg-surface-sunken/90 backdrop-blur-md" />
               <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="glass-panel w-full max-w-md bg-surface border-accent/20 shadow-2xl relative z-10 p-8 text-center space-y-6">
                  <div className="w-20 h-20 bg-accent/10 rounded-full flex items-center justify-center mx-auto shadow-2xl">
                     <ShieldCheck size={40} className="text-accent" />
                  </div>
                  <div className="space-y-2">
                     <h3 className="text-2xl font-black text-content italic uppercase tracking-tighter">Finalize <span className="text-accent">Order</span></h3>
                     <p className="text-xs text-content-muted font-bold uppercase tracking-widest px-4 leading-relaxed">System is requesting proof of completion. Please confirm that the work for <strong>{showProofModal.serviceName}</strong> is finished to your satisfaction.</p>
                  </div>
                  <div className="pt-4 flex flex-col gap-3">
                     <button
                       onClick={() => { dispatch(updateDispatchStatus({ dispatchId: showProofModal.id, status: 'completed' })); setShowProofModal(null); setAlertNotification('Order marked as Completed!') }}
                       className="w-full bg-accent text-content-on-accent font-black py-4 rounded-2xl uppercase tracking-widest text-xs shadow-xl shadow-gold-primary/10 active:scale-95 transition-all"
                     >
                        Confirm & Complete
                     </button>
                     <button onClick={() => setShowProofModal(null)} className="text-[10px] text-content-subtle font-black uppercase tracking-widest hover:text-content transition-colors">Not Yet Finished</button>
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
               className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[300] bg-surface border border-accent px-8 py-4 rounded-2xl shadow-2xl flex items-center gap-4 min-w-[320px]"
            >
               <div className="p-2 bg-success/20 rounded-full text-success shadow-[0_0_15px_rgba(34,197,94,0.3)]"><Check size={24} /></div>
               <div className="space-y-0.5">
                  <p className="text-[10px] font-black text-content-subtle uppercase tracking-[0.2em]">Notification</p>
                  <p className="text-sm font-black text-content italic tracking-tight uppercase">{alertNotification}</p>
               </div>
               <button onClick={() => setAlertNotification(null)} className="ml-auto text-content-subtle hover:text-content transition-colors"><X size={16} /></button>
            </motion.div>
         )}
      </AnimatePresence>
    </div>
  )
}
