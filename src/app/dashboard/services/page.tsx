'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { motion, AnimatePresence } from 'framer-motion'
import Image from 'next/image'
import {
  Car, Briefcase, Zap, MapPin, AlertTriangle, Clock, Calendar, Users, Star, Plus, ShieldCheck, Copy, X, Send, Check, Info, Truck, Lock, Link2, Image as ImageIcon, Calculator, MessageSquare, Package
} from 'lucide-react'
import {
  RootState,
  AppDispatch,
  bookSeat,
  addService,
  updateService,
  addDispatch,
  addLiftClub,
  updateDispatchStatus,
  HandymanService,
  ServiceDispatch,
  LiftClub
} from '../../../store'
import { claimVoucher, joinWaitlist, cancelSeat } from '../../../store/actions'
import { formatCurrency, estimateRemainingBatteryHours, loadsheddingStageToOutageHours, peakTariffCostPerHour } from '../../../utils/logic'
import FollowButton from '../components/social/FollowButton'
import TrustBadge from '../components/trust-safety/TrustBadge'
import OpenInMapsButton from '../components/map/OpenInMapsButton'
import UpgradeButton from '../components/shared/UpgradeButton'
import { realImage } from '../../public-services'
import EmptyState from '../components/shared/EmptyState'
import { directionsUrlForAddress } from '../../../utils/navigation'
import { getPublicProviderTiersBulk, type ProviderTier } from '../../../utils/subscriptions'
import { supabase } from '../../../utils/supabase'
import { fetchUpcomingGruvsEvents } from '../../../utils/gruvsEvents'
import Link from 'next/link'
import { playTactileSound } from '../../../utils/tactileSounds'

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

const VEHICLE_PRESETS = [
  { id: 'single_cab', label: 'Single-Cab Bakkie', sub: 'Up to 750kg (beds, fridges, couches)', basePrice: 350, icon: '🛻' },
  { id: 'double_cab', label: 'Double-Cab Bakkie', sub: '1-Ton load bed + crew seats', basePrice: 420, icon: '🛻' },
  { id: 'truck', label: '1.5-Ton / 2-Ton Flatbed', sub: 'Full room/flat moves & cargo', basePrice: 650, icon: '🚛' },
  { id: 'trailer', label: 'Bakkie + Trailer', sub: 'Bulky loads, rubble & clearout', basePrice: 400, icon: '🚜' }
] as const

const CARGO_PRESETS = [
  { id: 'furniture', label: 'Furniture & Appliances', icon: '🛋️' },
  { id: 'relocation', label: 'Room / Flat Relocation', icon: '📦' },
  { id: 'building', label: 'Building Materials / Hardware', icon: '🧱' },
  { id: 'garden', label: 'Garden Waste & Rubble', icon: '🌿' },
  { id: 'general', label: 'Store Delivery / Cargo', icon: '🛍️' }
] as const

const TIMING_PRESETS = [
  { id: 'asap', label: 'Today ASAP', sub: 'Urgent dispatch' },
  { id: 'tomorrow_am', label: 'Tomorrow Morning', sub: '08:00 - 12:00' },
  { id: 'tomorrow_pm', label: 'Tomorrow Afternoon', sub: '12:00 - 17:00' },
  { id: 'weekend', label: 'This Weekend', sub: 'Saturday or Sunday' }
] as const

function parseBakkieMessage(msg: string) {
  const parts = msg.split('|').map(s => s.trim())
  let vehicle = 'Bakkie Dispatch'
  let cargo = 'Cargo'
  let route = ''
  let timing = 'ASAP'
  let fare = ''
  let note = ''

  for (const p of parts) {
    if (p.includes('BAKKIE REQUEST:')) {
      vehicle = p.replace('🛻 BAKKIE REQUEST:', '').trim()
    } else if (p.startsWith('From:')) {
      route = p
    } else if (p.startsWith('When:')) {
      timing = p.replace('When:', '').trim()
    } else if (p.startsWith('Est. Fare:') || p.startsWith('Est:')) {
      fare = p
    } else if (p.startsWith('Note:')) {
      note = p.replace('Note:', '').trim()
    } else if (!route && !fare && !note && p.length > 0 && !p.includes('Helpers:')) {
      cargo = p
    }
  }

  return { vehicle, cargo, route, timing, fare, note }
}

function generateDispatchId(): string {
  return `disp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

function generateMeshBizId(): string {
  return `biz-bakkie-${Date.now()}`
}

export default function ServicesPage() {
  const dispatch = useDispatch() as AppDispatch
  const [activeTab, setActiveTab] = useState<'moving' | 'handymen' | 'lifts' | 'utilities'>(() => {
    if (typeof window === 'undefined') return 'moving'
    const params = new URLSearchParams(window.location.search)
    const tab = params.get('tab')
    if (tab === 'moving' || tab === 'handymen' || tab === 'lifts' || tab === 'utilities') return tab
    if (tab === 'trades' || params.get('type')) return 'handymen'
    return 'moving'
  })
  const [selectedTradeCategory, setSelectedTradeCategory] = useState<string>('All')
  const [filterEmergency247, setFilterEmergency247] = useState(false)
  const [alertNotification, setAlertNotification] = useState<string | null>(null)

  // Business Registration State
  const [showBusinessRegModal, setShowBusinessRegModal] = useState(false)
  const [bizName, setBizName] = useState('')
  const [bizCategory, setBizCategory] = useState<HandymanService['category']>('General Services')
  const [bizPhone, setBizPhone] = useState('')
  const [bizPrice, setBizPrice] = useState('')
  const [bizPublic, setBizPublic] = useState(false)
  // Set while the business form is editing an existing listing.
  const [editingBiz, setEditingBiz] = useState<HandymanService | null>(null)
  const [bizDesc, setBizDesc] = useState('')
  const [bizLocation, setBizLocation] = useState('')
  const [bizSuburb, setBizSuburb] = useState('')

  // Hire Modal State
  const [selectedBiz, setSelectedBiz] = useState<HandymanService | null>(null)
  const [hireMessage, setHireMessage] = useState('')

  // Proof Modal State (Mock)
  const [showProofModal, setShowProofModal] = useState<ServiceDispatch | null>(null)

  // Utilities Calculator State
  const [calcKwh, setCalcKwh] = useState<number>(350)
  const [calcStage, setCalcStage] = useState<number>(2)

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

  // Bakkie Request Modal State
  const [showBakkieModal, setShowBakkieModal] = useState(false)
  const [bakkieTargetService, setBakkieTargetService] = useState<HandymanService | null>(null)
  const [bakkieLoadCategory, setBakkieLoadCategory] = useState<string>('furniture')
  const [bakkieVehicleType, setBakkieVehicleType] = useState<string>('single_cab')
  const [bakkiePickupAddress, setBakkiePickupAddress] = useState('')
  const [bakkieDropoffAddress, setBakkieDropoffAddress] = useState('')
  const [bakkieSchedule, setBakkieSchedule] = useState<string>('asap')
  const [bakkieHelpers, setBakkieHelpers] = useState<number>(0)
  const [bakkieNotes, setBakkieNotes] = useState('')
  const [bakkieSubmitting, setBakkieSubmitting] = useState(false)

  // Ride Request Modal State (in Lifts tab)
  const [showRideRequestModal, setShowRideRequestModal] = useState(false)
  const [rideOrigin, setRideOrigin] = useState('')
  const [rideDestination, setRideDestination] = useState('')
  const [rideDeparture, setRideDeparture] = useState('07:00')
  const [rideDays, setRideDays] = useState('Mon - Fri')
  const [rideTargetPrice, setRideTargetPrice] = useState('35')
  const [rideSeatsNeeded, setRideSeatsNeeded] = useState('1')
  const [rideNotes, setRideNotes] = useState('')

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
    openBakkieRequestModal(srv)
  }

  const openBakkieRequestModal = (service: HandymanService | null) => {
    setBakkieTargetService(service)
    setShowBakkieModal(true)
  }

  const handleBakkieSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!bakkiePickupAddress.trim() || !bakkieDropoffAddress.trim()) {
      setAlertNotification('Please enter both pickup and drop-off locations.')
      return
    }

    setBakkieSubmitting(true)
    const vehicle = VEHICLE_PRESETS.find(v => v.id === bakkieVehicleType) || VEHICLE_PRESETS[0]
    const cargo = CARGO_PRESETS.find(c => c.id === bakkieLoadCategory) || CARGO_PRESETS[0]
    const timing = TIMING_PRESETS.find(t => t.id === bakkieSchedule) || TIMING_PRESETS[0]

    const target = bakkieTargetService || bakkieServices[0] || {
      id: generateMeshBizId(),
      businessName: 'Community Bakkie Network',
      ownerId: ''
    }

    const structuredMessage = `🛻 BAKKIE REQUEST: ${vehicle.label} | ${cargo.label} | From: ${bakkiePickupAddress.trim()} ➔ To: ${bakkieDropoffAddress.trim()} | When: ${timing.label} | Helpers: ${bakkieHelpers} | Est. Fare: R${calculatedFare}${bakkieNotes.trim() ? ' | Note: ' + bakkieNotes.trim() : ''}`

    const newDispatch: ServiceDispatch = {
      id: generateDispatchId(),
      serviceId: target.id,
      serviceName: target.businessName,
      senderId: currentUser?.id || '',
      senderName: currentUser?.name || 'Resident',
      senderRole: currentUser?.role || 'visitor',
      message: structuredMessage,
      status: 'pending',
      timestamp: new Date().toISOString()
    }

    dispatch(addDispatch(newDispatch))
    playTactileSound('success')

    if (supabase && target.id && !target.id.startsWith('biz-bakkie-')) {
      try {
        await supabase.rpc('res_request_move_assist', {
          p_service_id: target.id,
          p_message: structuredMessage
        })
      } catch {
        // Fallback if RPC not applied in Supabase
      }
    }

    setBakkieSubmitting(false)
    setShowBakkieModal(false)
    setAlertNotification('Bakkie request dispatched! Track your driver below.')
  }

  const handleRideRequestSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!rideOrigin.trim() || !rideDestination.trim()) {
      setAlertNotification('Please enter origin and destination.')
      return
    }

    const newRide: LiftClub = {
      id: `lift-req-${Date.now()}`,
      driverId: currentUser?.id || '',
      driverName: `${currentUser?.name || 'Resident'} (Rider Request)`,
      origin: rideOrigin.trim(),
      destination: rideDestination.trim(),
      departureTime: rideDeparture.trim(),
      days: rideDays.trim(),
      pricePerSeat: parseFloat(rideTargetPrice) || 35,
      currency: 'ZAR',
      availableSeats: parseInt(rideSeatsNeeded) || 1,
      totalSeats: parseInt(rideSeatsNeeded) || 1,
      eventId: null
    }

    dispatch(addLiftClub(newRide))
    playTactileSound('success')
    setShowRideRequestModal(false)
    setAlertNotification('Ride request posted to the community!')
  }

  const openBusinessForm = (biz: HandymanService | null) => {
    setEditingBiz(biz)
    setBizName(biz?.businessName ?? '')
    setBizCategory(biz?.category ?? 'General Services')
    setBizPhone(biz?.contactNumber ?? '')
    setBizLocation(biz?.location ?? '')
    setBizSuburb(biz?.suburb ?? '')
    setBizPrice(biz?.priceEstimate ?? '')
    setBizDesc(biz?.description ?? '')
    setBizPublic(biz?.showPublicly === true)
    setShowBusinessRegModal(true)
  }

  const handleRegisterBusiness = (e: React.FormEvent) => {
    e.preventDefault()
    if (editingBiz) {
      dispatch(updateService({
        ...editingBiz,
        businessName: bizName,
        category: bizCategory,
        location: bizLocation,
        suburb: bizSuburb,
        contactNumber: bizPhone,
        priceEstimate: bizPrice,
        description: bizDesc,
        showPublicly: bizPublic
      }))
      setEditingBiz(null)
      setShowBusinessRegModal(false)
      setAlertNotification('Business card updated!')
      return
    }
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
      // No stock photo: a picture that isn't the business misleads people.
      image: '',
      reviewsCount: 0,
      showPublicly: bizPublic
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

  const filteredByCategory = services.filter(s => {
    if (activeTab === 'moving') return MOVE_ASSIST_CATEGORIES.includes(s.category);
    if (selectedTradeCategory !== 'All' && s.category !== selectedTradeCategory) return false;
    if (filterEmergency247) {
      const text = (s.description + ' ' + s.businessName).toLowerCase();
      return text.includes('24/7') || text.includes('emergency') || text.includes('urgent') || text.includes('locksmith') || text.includes('plumb');
    }
    return true;
  });
  const visibleServices = filteredByCategory
  const myBiz = services.find(s => s.ownerId === currentUser?.id)
  const incomingOrders = myBiz ? dispatches.filter(d => d.serviceId === myBiz.id) : []

  const bakkieServices = services.filter(s => MOVE_ASSIST_CATEGORIES.includes(s.category))
  const selectedVehicle = VEHICLE_PRESETS.find(v => v.id === bakkieVehicleType) || VEHICLE_PRESETS[0]
  const calculatedFare = selectedVehicle.basePrice + (bakkieHelpers * 100)

  const myBakkieDispatches = currentUser ? dispatches.filter(d => {
    const isSender = d.senderId === currentUser.id
    const isMyBiz = myBiz && d.serviceId === myBiz.id
    const isBakkie = d.message?.includes('BAKKIE') || d.serviceName?.toLowerCase().includes('bakkie') || d.serviceName?.toLowerCase().includes('moving')
    return (isSender || isMyBiz) && isBakkie
  }) : []

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8 pb-32">
      <header className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h2 className="text-xl font-black text-white uppercase tracking-tight">Community <span className="text-gold-primary">Services</span></h2>
          <p className="text-xs text-gray-400 font-medium mt-0.5">Moving, repairs, lifts and utilities near you.</p>
        </div>

        <div className="flex bg-black/60 p-1.5 rounded-2xl border border-white/10 shadow-glass backdrop-blur-2xl w-full md:w-auto overflow-x-auto no-scrollbar gap-1">
          {[
            { id: 'moving', label: 'Moving & Bakkies', icon: Truck },
            { id: 'handymen', label: 'Trades & Plumbing', icon: Briefcase },
            { id: 'lifts', label: 'Lifts', icon: Car },
            { id: 'utilities', label: 'Utilities', icon: Zap },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as 'moving' | 'handymen' | 'lifts' | 'utilities')}
              className={`flex-1 md:flex-none px-5 py-2 rounded-xl transition-all text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 whitespace-nowrap ${
                activeTab === t.id ? 'bg-gold-primary text-black shadow-glow' : 'text-gray-400 hover:text-white'
              }`}
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
              <a href="/dashboard/trust-circle" className="w-full flex items-center justify-between gap-3 bg-gold-primary/5 border border-gold-primary/20 rounded-2xl px-6 py-4 hover:border-gold-primary/40 transition-all">
                 <span className="flex items-center gap-3 text-left">
                    <Lock size={18} className="text-gold-primary shrink-0" />
                    <span>
                       <span className="block text-xs font-black text-white uppercase tracking-widest">Build trust to offer a lift</span>
                       <span className="block text-[11px] text-gray-500 mt-0.5">
                          {trustGate.status === 'building' ? 'Your next-of-kin circle is growing — almost there.' : 'Add people to your next-of-kin circle first — offering a ride to strangers needs a real safety trail.'}
                       </span>
                    </span>
                 </span>
                 <span className="text-[10px] font-black text-gold-primary uppercase tracking-widest shrink-0">Next of Kin →</span>
              </a>
           ) : (
              <div className="flex flex-wrap sm:flex-nowrap justify-between items-center gap-3">
                 <p className="text-xs text-gray-400">Share or find a ride for work, school, or weekend events with verified neighbours.</p>
                 <div className="flex items-center gap-2 w-full sm:w-auto">
                    <button
                       onClick={() => { playTactileSound('click'); setShowRideRequestModal(true) }}
                       className="flex-1 sm:flex-none bg-gold-primary hover:bg-gold-secondary text-black font-black px-6 py-3.5 rounded-2xl transition-all active:scale-95 flex items-center justify-center gap-2 uppercase tracking-widest text-xs"
                    >
                       <Car size={16} /> Request a Ride
                    </button>
                    <button
                       onClick={() => { playTactileSound('click'); setShowLiftModal(true) }}
                       className="flex-1 sm:flex-none bg-white/5 hover:bg-white/10 border border-white/10 hover:border-gold-primary text-white font-black px-5 py-3.5 rounded-2xl transition-all active:scale-95 flex items-center justify-center gap-2 uppercase tracking-widest text-xs"
                    >
                       <Plus size={16} /> Offer a Lift
                    </button>
                 </div>
              </div>
           )}
           {lifts.map(lift => (
             <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} key={lift.id} className="glass-panel p-6 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8 bg-black/40 border-white/5 group hover:border-gold-primary/30 transition-all">
                <div className="flex-1 space-y-4">
                   <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2.5 flex-wrap">
                         <h3 className="text-xl font-black text-white tracking-tight uppercase group-hover:text-gold-primary transition-colors italic">{lift.driverName}</h3>
                         {/* The one piece of real trust info riders had before getting
                             in this driver's car was a first name. TrustBadge pulls
                             their actual verification/reputation — driver_id was
                             already on this row, just never read past the display
                             name (see LiftClub.driverId). */}
                         <TrustBadge userId={lift.driverId} compact />
                      </div>
                      <div className="bg-gold-primary/10 border border-gold-primary/20 text-gold-primary px-4 py-1 rounded-xl font-black text-sm tracking-tighter">
                         {formatCurrency(lift.pricePerSeat, lift.currency)} <span className="text-[10px] opacity-60 ml-1">PER SEAT</span>
                      </div>
                   </div>
                   {lift.eventId && eventTitles[lift.eventId] && (
                      <span className="inline-flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest bg-gold-primary/10 text-gold-primary border border-gold-primary/20 px-3 py-1.5 rounded-lg">
                         🚗 For: {eventTitles[lift.eventId]}
                      </span>
                   )}
                   <div className="flex flex-col md:flex-row md:items-center text-sm gap-2 md:gap-4">
                      <div className="flex items-center gap-2 text-gray-300 font-bold bg-white/5 px-3 py-1.5 rounded-lg border border-white/5 shadow-inner">
                         <MapPin size={16} className="text-gold-primary" /> {lift.origin}
                      </div>
                      <div className="flex justify-center text-gray-700 font-black tracking-widest">➔</div>
                      <div className="flex items-center gap-2 text-gray-300 font-bold bg-white/5 px-3 py-1.5 rounded-lg border border-white/5 shadow-inner">
                         <MapPin size={16} className="text-gold-primary" /> {lift.destination}
                      </div>
                      <a
                        href={directionsUrlForAddress(lift.destination, lift.origin)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-[10px] font-black text-gold-primary uppercase tracking-widest hover:underline"
                      >
                        Preview route
                      </a>
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
                    className="flex-1 lg:flex-none bg-gold-primary hover:bg-gold-secondary text-black font-black px-10 py-4 rounded-2xl transition-all active:scale-95 uppercase tracking-widest text-xs min-h-[44px] touch-target-44"
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

      {/* Moving and Trades both list REAL services (res_services); Moving is
          the bakkie/transport categories. Moving used to show invented
          movers with real-looking phone numbers, and Trades a "dispatched in
          30 mins" emergency button that sent nothing to anyone. */}
      {(activeTab === 'handymen' || activeTab === 'moving') && (
        <div className="space-y-8">
          {/* One line plus the button; this was a large decorative card with
              a star icon that pushed the actual list below the fold. */}
          {activeTab === 'moving' ? (
            <div className="space-y-6">
              <div className="glass-panel p-6 sm:p-8 bg-gradient-to-br from-black/80 via-black/50 to-gold-primary/5 border border-gold-primary/20 space-y-5">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div className="flex items-start gap-4">
                    <div className="p-3.5 bg-gold-primary/10 rounded-2xl border border-gold-primary/20 text-gold-primary shrink-0">
                      <Truck size={28} />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-xl sm:text-2xl font-black text-white italic uppercase tracking-tight">
                          Express Bakkie &amp; Moving Dispatch
                        </h2>
                        <span className="bg-gold-primary/20 text-gold-primary border border-gold-primary/30 text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest">
                          Live Local Mesh
                        </span>
                      </div>
                      <p className="text-xs sm:text-sm text-gray-400 max-w-xl leading-relaxed">
                        Need furniture moved, appliances delivered, or building rubble cleared? Post an instant dispatch to verified local bakkie operators with transparent upfront fare estimates.
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 shrink-0">
                    <button
                      onClick={() => { playTactileSound('click'); openBakkieRequestModal(null) }}
                      className="w-full sm:w-auto bg-gold-primary hover:bg-gold-secondary text-black font-black px-6 py-3.5 rounded-xl text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-95 shadow-glow"
                    >
                      <Truck size={16} /> Request a Bakkie
                    </button>
                    {trustGate && !trustGate.unlocked ? (
                      <a href="/dashboard/trust-circle" className="w-full sm:w-auto bg-white/5 border border-white/10 hover:border-gold-primary/40 text-gray-300 font-black px-4 py-3.5 rounded-xl text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all">
                        <Lock size={14} className="text-gold-primary" /> List My Bakkie
                      </a>
                    ) : (
                      <button
                        onClick={() => { playTactileSound('click'); openBusinessForm(null) }}
                        className="w-full sm:w-auto bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 font-black px-4 py-3.5 rounded-xl text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-95"
                      >
                        <Plus size={14} /> List My Bakkie
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Active Bakkie Dispatches for Current User */}
              {myBakkieDispatches.length > 0 && (
                <div className="space-y-4 pt-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-black text-gold-primary uppercase tracking-widest flex items-center gap-2">
                      <Clock size={15} /> Active Bakkie Dispatches ({myBakkieDispatches.length})
                    </h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {myBakkieDispatches.map(disp => {
                      const parsed = parseBakkieMessage(disp.message)
                      const isSender = disp.senderId === currentUser?.id
                      const isDriver = myBiz && disp.serviceId === myBiz.id

                      return (
                        <div key={disp.id} className="glass-panel p-5 bg-black/60 border border-gold-primary/20 flex flex-col gap-4 shadow-xl">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2.5">
                              <div className="p-2 bg-gold-primary/10 rounded-xl text-gold-primary">
                                <Truck size={18} />
                              </div>
                              <div>
                                <h4 className="text-sm font-black text-white italic uppercase tracking-tight">{parsed.vehicle}</h4>
                                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">
                                  {isSender ? `Service: ${disp.serviceName}` : `Requested by: ${disp.senderName}`}
                                </p>
                              </div>
                            </div>
                            <span className={`text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-widest border ${
                              disp.status === 'pending'
                                ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                                : disp.status === 'accepted'
                                ? 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                                : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                            }`}>
                              {disp.status === 'pending' ? '⏳ Awaiting Driver' : disp.status === 'accepted' ? '🚗 In Transit' : '✅ Delivered'}
                            </span>
                          </div>

                          {/* Stepper Progress */}
                          <div className="grid grid-cols-3 gap-1.5 py-1">
                            <div className={`h-1.5 rounded-full ${disp.status ? 'bg-gold-primary' : 'bg-white/10'}`} />
                            <div className={`h-1.5 rounded-full ${disp.status === 'accepted' || disp.status === 'completed' ? 'bg-gold-primary' : 'bg-white/10'}`} />
                            <div className={`h-1.5 rounded-full ${disp.status === 'completed' ? 'bg-gold-primary' : 'bg-white/10'}`} />
                          </div>

                          {/* Details */}
                          <div className="bg-white/[0.03] p-3 rounded-xl border border-white/5 space-y-2 text-xs">
                            <div className="flex items-center gap-2 text-gray-300 font-bold">
                              <MapPin size={13} className="text-gold-primary shrink-0" />
                              <span className="truncate">{parsed.route || disp.message}</span>
                            </div>
                            <div className="flex items-center justify-between text-[11px] text-gray-400 pt-1 border-t border-white/5">
                              <span>{parsed.cargo} • {parsed.timing}</span>
                              <span className="font-black text-white">{parsed.fare || 'Standard rate'}</span>
                            </div>
                            {parsed.note && (
                              <p className="text-[10px] text-gray-500 italic">&quot;{parsed.note}&quot;</p>
                            )}
                          </div>

                          {/* Action buttons */}
                          <div className="flex items-center gap-2 pt-1">
                            <Link
                              href="/dashboard/messages"
                              className="flex-1 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-black py-2.5 rounded-xl text-[10px] uppercase tracking-widest flex items-center justify-center gap-1.5 transition-all"
                            >
                              <MessageSquare size={13} /> In-App Chat
                            </Link>

                            {isDriver && disp.status === 'pending' && (
                              <button
                                onClick={() => {
                                  playTactileSound('click')
                                  dispatch(updateDispatchStatus({ dispatchId: disp.id, status: 'accepted' }))
                                  setAlertNotification('Bakkie job accepted! Contact the resident in messages.')
                                }}
                                className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-black py-2.5 rounded-xl text-[10px] uppercase tracking-widest border border-blue-400/30 transition-all active:scale-95"
                              >
                                Accept Job
                              </button>
                            )}

                            {isDriver && disp.status === 'accepted' && (
                              <button
                                onClick={() => {
                                  playTactileSound('click')
                                  setShowProofModal(disp)
                                }}
                                className="flex-1 bg-gold-primary hover:bg-gold-secondary text-black font-black py-2.5 rounded-xl text-[10px] uppercase tracking-widest transition-all active:scale-95"
                              >
                                Mark Delivered
                              </button>
                            )}

                            {isSender && disp.status === 'accepted' && (
                              <button
                                onClick={() => {
                                  playTactileSound('success')
                                  dispatch(updateDispatchStatus({ dispatchId: disp.id, status: 'completed' }))
                                  setAlertNotification('Delivery confirmed! Thank you.')
                                }}
                                className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-black py-2.5 rounded-xl text-[10px] uppercase tracking-widest border border-emerald-400/30 transition-all active:scale-95"
                              >
                                Confirm Delivery
                              </button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
              <p className="m-0 text-xs text-gray-400">
                Local pros listed by people near you, rated by your neighbours.
              </p>
              {trustGate && !trustGate.unlocked ? (
                 <a href="/dashboard/trust-circle" className="w-full sm:w-auto flex items-center gap-3 bg-gold-primary/5 border border-gold-primary/20 rounded-2xl px-4 py-3 hover:border-gold-primary/40 transition-all shrink-0">
                    <Lock size={16} className="text-gold-primary shrink-0" />
                    <span className="text-left">
                       <span className="block text-[11px] font-black text-white uppercase tracking-widest">Build trust to list</span>
                       <span className="block text-[10px] text-gray-500 mt-0.5">Grow your next-of-kin circle first →</span>
                    </span>
                 </a>
              ) : (
                 <button
                    onClick={() => openBusinessForm(null)}
                    className="w-full sm:w-auto shrink-0 bg-white/5 hover:bg-gold-primary hover:text-black border border-white/10 hover:border-gold-primary text-white font-black px-5 py-3 rounded-2xl transition-all active:scale-95 flex items-center justify-center gap-2 uppercase tracking-widest text-xs"
                 >
                    <Plus size={16} /> List my service
                 </button>
              )}
           </div>
          )}

           
           {activeTab === 'handymen' && (
             <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
               <button
                 type="button"
                 onClick={() => { playTactileSound('click'); setFilterEmergency247(v => !v) }}
                 className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all shrink-0 min-h-[36px] flex items-center gap-1.5 ${
                   filterEmergency247
                     ? 'bg-red-600 text-white border-red-400'
                     : 'bg-white/5 text-red-300 border-red-500/20 hover:border-red-500/40'
                 }`}
               >
                 <AlertTriangle size={12} /> 24/7 Urgent
               </button>
               {['All', 'Bakkie / Transport', 'Plumbing', 'Electrical', 'Cleaning', 'Security', 'Tech & Phone Repairs', 'Solar & Gas', 'Auto & Detailing', 'Locksmith', 'General Services'].map(cat => (
                 <button
                   key={cat}
                   type="button"
                   onClick={() => setSelectedTradeCategory(cat)}
                   className={`px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-all shrink-0 min-h-[36px] ${
                     selectedTradeCategory === cat
                       ? 'bg-gold-primary text-black border-gold-primary'
                       : 'bg-white/5 text-gray-300 border-white/10 hover:border-white/20'
                   }`}
                 >
                   {cat}
                 </button>
               ))}
             </div>
           )}

           {visibleServices.length === 0 ? (
             <div className="glass-panel">
               {activeTab === 'moving' ? (
                 <EmptyState icon={Truck} title="No bakkies or movers listed yet" subtitle="Have a bakkie? List it and get booked by your neighbours." />
               ) : (
                 <EmptyState icon={Briefcase} title="No local pros listed yet" subtitle="Be the first to advertise your skills to the neighbourhood." />
               )}
             </div>
           ) : (
           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
             {visibleServices.map(srv => (
               <motion.div key={srv.id} whileHover={{ y: -5 }} className="glass-panel overflow-hidden flex flex-col group bg-black/40 hover:border-gold-primary/40 transition-all duration-500 shadow-2xl">
                  <div className="h-44 bg-gray-900 relative overflow-hidden">
                     {/* realImage() drops the stock photo every new service used to get: it isn't the business. */}
                     {realImage(srv.image) ? (
                       <Image src={realImage(srv.image)!} alt={srv.businessName} fill className="object-cover group-hover:scale-110 transition-transform duration-700 opacity-60 group-hover:opacity-100" sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw" />
                     ) : (
                       <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-900 to-black">
                         <ImageIcon size={32} className="text-gold-primary/20" />
                       </div>
                     )}
                     <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-xl border border-white/10 px-3 py-1.5 rounded-xl flex items-center gap-2 shadow-2xl">
                        {/* A new service is stored with rating 5.0 and no reviews; show "New" until someone reviews it. */}
                        {srv.reviewsCount > 0 ? (<>
                          <Star size={14} className="text-gold-primary fill-gold-primary" />
                          <span className="text-xs font-black text-white">{Number(srv.rating).toFixed(1)}</span>
                          <span className="text-[10px] text-gray-500 font-bold">({srv.reviewsCount})</span>
                        </>) : (
                          <span className="text-[10px] font-black uppercase tracking-widest text-gray-300">New</span>
                        )}
                     </div>
                     <div className="absolute bottom-4 left-4 flex gap-2">
                        <span className="bg-gold-primary text-black px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest shadow-xl">{srv.category}</span>
                        {providerTiers[srv.ownerId] && (
                           <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest shadow-xl ${providerTiers[srv.ownerId] === 'premium' ? 'bg-purple-500 text-white' : 'bg-blue-500 text-white'}`}>
                              {providerTiers[srv.ownerId] === 'premium' ? 'Premium' : 'Priority'}
                           </span>
                        )}
                     </div>
                  </div>
                  <div className="p-6 flex-1 flex flex-col gap-5">
                     <div className="space-y-1">
                        <h3 className="text-xl font-black text-white tracking-tight uppercase italic group-hover:text-gold-primary transition-colors">{srv.businessName}</h3>
                        <div className="flex items-center justify-between gap-2">
                           <div className="flex items-center text-[10px] text-gray-500 font-black uppercase tracking-widest gap-2">
                              <MapPin size={12} className="text-gold-primary" /> {srv.suburb}
                           </div>
                           <OpenInMapsButton address={`${srv.location}, ${srv.suburb}`} />
                        </div>
                     </div>
                     <p className="text-sm text-gray-400 line-clamp-3 leading-relaxed opacity-80 font-medium italic">&quot;{srv.description}&quot;</p>

                     {srv.ownerId !== currentUser?.id && (
                       <div className="flex justify-end items-center gap-2 -mt-2">
                         <TrustBadge userId={srv.ownerId} compact />
                         <FollowButton targetUserId={srv.ownerId} currentUserId={currentUser?.id} />
                       </div>
                     )}

                     <div className="bg-white/2 border border-white/5 rounded-xl p-3 flex justify-between items-center">
                        <span className="text-[9px] font-black text-gray-600 uppercase tracking-widest">Rate Estimate</span>
                        <span className="text-sm font-black text-white tracking-tighter">{srv.priceEstimate}</span>
                     </div>

                     <div className="mt-auto pt-6 border-t border-white/5 space-y-3">
                        {srv.ownerId !== currentUser?.id && MOVE_ASSIST_CATEGORIES.includes(srv.category) && (
                           <div className="space-y-1.5">
                              <button
                                 onClick={() => openMoveAssist(srv)}
                                 className="w-full bg-gold-primary hover:bg-gold-secondary text-black font-black py-4 rounded-xl transition-all active:scale-95 text-xs uppercase tracking-widest flex items-center justify-center gap-2 "
                              >
                                 <Truck size={16} /> Request Move Assist
                              </button>
                              {trustGate && !trustGate.unlocked && (
                                 <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest text-center flex items-center justify-center gap-1.5">
                                    <Lock size={10} className="text-gold-primary" /> {trustGate.status === 'building' ? 'Building your next-of-kin circle' : 'Build your next-of-kin circle to unlock'}
                                 </p>
                              )}
                           </div>
                        )}
                        <button
                           onClick={() => srv.ownerId === currentUser?.id ? openBusinessForm(srv) : setSelectedBiz(srv)}
                           className="w-full bg-white/5 hover:bg-gold-primary hover:text-black border border-white/10 hover:border-gold-primary text-white font-black py-3.5 rounded-xl transition-all active:scale-95 text-xs uppercase tracking-widest min-h-[44px]"
                        >
                           {srv.ownerId === currentUser?.id ? 'Manage My Card' : 'Hire Contractor'}
                        </button>
                        {srv.ownerId !== currentUser?.id && (
                           <div className="grid grid-cols-2 gap-2">
                              <button
                                 type="button"
                                 onClick={() => {
                                    playTactileSound('click')
                                    setSelectedBiz(srv)
                                    setHireMessage(`Hi ${srv.businessName}, please provide an in-app price estimate for services in ${srv.suburb}.`)
                                 }}
                                 className="w-full bg-gold-primary/10 hover:bg-gold-primary/20 border border-gold-primary/30 text-gold-primary font-black py-3 rounded-xl transition-all flex items-center justify-center gap-1.5 text-xs uppercase tracking-widest min-h-[44px] active:scale-95"
                              >
                                 <Calculator size={13} />
                                 <span>In-App Quote</span>
                              </button>
                              <Link
                                 href={`/dashboard/messages?to=${srv.ownerId || srv.id}`}
                                 className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-white font-black py-3 rounded-xl transition-all flex items-center justify-center gap-1.5 text-xs uppercase tracking-widest no-underline min-h-[44px] active:scale-95 text-center"
                              >
                                 <MessageSquare size={13} />
                                 <span>Message</span>
                              </Link>
                           </div>
                        )}
                        {srv.ownerId === currentUser?.id && !providerTiers[srv.ownerId] && (
                           <div className="space-y-2 pt-2 border-t border-white/5">
                              <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest text-center">Free listing — get seen first</p>
                              <div className="grid grid-cols-2 gap-2">
                                 <UpgradeButton item="priority" className="w-full bg-blue-500/10 hover:bg-blue-500 hover:text-white border border-blue-500/30 text-blue-400 font-black py-2.5 rounded-xl text-[10px] uppercase tracking-widest transition-all active:scale-95" />
                                 <UpgradeButton item="premium" className="w-full bg-purple-500/10 hover:bg-purple-500 hover:text-white border border-purple-500/30 text-purple-400 font-black py-2.5 rounded-xl text-[10px] uppercase tracking-widest transition-all active:scale-95" />
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
                             {order.status === 'pending' && <button onClick={() => dispatch(updateDispatchStatus({ dispatchId: order.id, status: 'accepted' }))} className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-black py-2 rounded-lg text-[10px] uppercase tracking-widest border border-blue-400/30 transition-all active:scale-95 min-h-[44px]">Accept Job</button>}
                             {order.status === 'accepted' && <button onClick={() => setShowProofModal(order)} className="flex-1 bg-gold-primary hover:bg-gold-secondary text-black font-black py-2 rounded-lg text-[10px] uppercase tracking-widest border border-gold-primary/40 transition-all active:scale-95 min-h-[44px]">Mark Complete</button>}
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
                 <div className="p-5 bg-gold-primary rounded-3xl shadow-[0_0_30px_rgb(var(--accent)/0.4)] animate-pulse">
                    <Zap size={40} className="text-black" />
                 </div>
                 <div className="space-y-1">
                    <h3 className="text-2xl font-black text-white italic uppercase tracking-tighter">Energy <span className="text-gold-primary">Marketplace</span></h3>
                    <p className="text-xs text-gray-500 font-bold uppercase tracking-widest opacity-80">Claim a sub-meter voucher, then arrange payment directly with the landlord</p>
                 </div>
              </div>
           </div>

           {/* Deterministic Utility & Resilience Calculator */}
           {(() => {
             const block1Kwh = Math.min(calcKwh, 350)
             const block2Kwh = Math.max(0, calcKwh - 350)
             const block1Cost = block1Kwh * 2.25
             const block2Cost = block2Kwh * 3.15
             const totalCost = block1Cost + block2Cost
             const effectiveRate = calcKwh > 0 ? totalCost / calcKwh : 0
             const ls = loadsheddingStageToOutageHours(calcStage)
             const backupHours = estimateRemainingBatteryHours(5, 450, 0.85)
             const geyserCostPerHour = peakTariffCostPerHour(3.15, 2000)

             return (
               <div className="glass-panel p-6 sm:p-8 bg-black/60 border border-white/10 rounded-3xl space-y-6 shadow-2xl">
                 <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
                   <div>
                     <h4 className="text-base font-black text-white uppercase italic tracking-wider flex items-center gap-2">
                       <Zap size={18} className="text-gold-primary" /> Eskom Tariff &amp; Grid Resilience Calculator
                     </h4>
                     <p className="text-xs text-gray-400 mt-0.5">
                       Incline Block Tariff (IBT) estimation &amp; load-shedding battery endurance calculations.
                     </p>
                   </div>
                   <span className="text-[10px] font-mono px-3 py-1 rounded-full bg-white/5 border border-white/10 text-gray-300 shrink-0">
                     Standard SA Domestic Tariffs
                   </span>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   {/* kWh Consumption Slider & IBT Breakdown */}
                   <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 space-y-4">
                     <div className="flex justify-between items-center text-xs">
                       <span className="font-bold text-gray-300">Monthly Usage</span>
                       <span className="font-mono text-gold-primary font-black text-sm">{calcKwh} kWh</span>
                     </div>
                     <input
                       type="range"
                       min={50}
                       max={1000}
                       step={25}
                       value={calcKwh}
                       onChange={(e) => setCalcKwh(Number(e.target.value))}
                       className="w-full accent-gold-primary cursor-pointer"
                     />
                     <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/5 text-[11px]">
                       <div>
                         <span className="text-[10px] text-gray-500 uppercase block font-bold">Block 1 (&le;350)</span>
                         <span className="font-mono text-gray-200 font-bold">R{block1Cost.toFixed(2)}</span>
                       </div>
                       <div>
                         <span className="text-[10px] text-gray-500 uppercase block font-bold">Block 2 (&gt;350)</span>
                         <span className="font-mono text-gray-200 font-bold">R{block2Cost.toFixed(2)}</span>
                       </div>
                       <div>
                         <span className="text-[10px] text-gray-500 uppercase block font-bold">Est. Total</span>
                         <span className="font-mono text-gold-primary font-black">R{totalCost.toFixed(2)}</span>
                       </div>
                     </div>
                     <p className="text-[10px] text-gray-500">
                       Effective rate: R{effectiveRate.toFixed(2)}/kWh &bull; 2kW Geyser: R{geyserCostPerHour.toFixed(2)}/hr run cost.
                     </p>
                   </div>

                   {/* Load Shedding Stage & Inverter Runtime */}
                   <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 space-y-4">
                     <div className="flex justify-between items-center text-xs">
                       <span className="font-bold text-gray-300">Load-Shedding Level</span>
                       <span className={`font-mono font-black text-sm ${calcStage >= 4 ? 'text-red-400' : 'text-amber-400'}`}>
                         Stage {calcStage}
                       </span>
                     </div>
                     <input
                       type="range"
                       min={0}
                       max={8}
                       step={1}
                       value={calcStage}
                       onChange={(e) => setCalcStage(Number(e.target.value))}
                       className="w-full accent-gold-primary cursor-pointer"
                     />
                     <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/5 text-[11px]">
                       <div>
                         <span className="text-[10px] text-gray-500 uppercase block font-bold">Power Cut Duration</span>
                         <span className="font-mono text-red-400 font-bold">~{ls.dailyHours} hrs/day ({ls.slotsCount} slots)</span>
                       </div>
                       <div>
                         <span className="text-[10px] text-gray-500 uppercase block font-bold">5kWh Battery Backup</span>
                         <span className="font-mono text-emerald-400 font-bold">~{backupHours.toFixed(1)} hrs run-time</span>
                       </div>
                     </div>
                     <p className="text-[10px] text-gray-500">
                       Based on standard 450W household Wi-Fi, refrigeration &amp; lighting baseline load.
                     </p>
                   </div>
                 </div>
               </div>
             )
           })()}

           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
              {utilityTokens.filter(t => t.status === 'available').map(token => (
                <motion.div key={token.id} whileHover={{ scale: 1.02 }} className="glass-panel p-8 border-gold-primary/10 bg-black/40 space-y-8 group transition-all cursor-pointer hover:border-gold-primary/50 shadow-2xl">
                   <div className="flex justify-between items-start">
                      <div className="p-4 bg-gold-primary/10 rounded-2xl group-hover:bg-gold-primary group-hover:text-black transition-colors">
                         <Zap size={28} className="text-gold-primary group-hover:text-inherit" />
                      </div>
                      <span className="text-3xl font-black text-white tracking-tighter group-hover:text-gold-primary transition-colors italic">{formatCurrency(token.price, token.currency)}</span>
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
                    className="w-full bg-gold-primary text-black font-black py-4 rounded-2xl text-xs uppercase tracking-widest  active:scale-95 transition-all"
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
                            <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Cost: {formatCurrency(token.price, token.currency)}</p>
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
               <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="glass-panel w-full max-w-2xl max-h-[88dvh] overflow-y-auto custom-scrollbar bg-black border-gold-primary/20 relative z-10">
                  <div className="bg-gold-primary/5 p-6 border-b border-white/5 flex justify-between items-center">
                     <h3 className="text-xl font-black text-white italic uppercase tracking-tighter">{editingBiz ? <>Edit <span className="text-gold-primary">Business</span></> : <>Business <span className="text-gold-primary">Onboarding</span></>}</h3>
                     <button onClick={() => setShowBusinessRegModal(false)} className="text-gray-500 hover:text-white"><X /></button>
                  </div>
                  <form onSubmit={handleRegisterBusiness} className="p-6 sm:p-8 space-y-6">
                     <div className="space-y-4">
                        <div className="space-y-2">
                           <label className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Business or Skill Name</label>
                           <input value={bizName} onChange={e => setBizName(e.target.value)} required className="w-full bg-black border border-white/10 rounded-xl p-3 text-sm text-white font-bold outline-none focus:border-gold-primary/40" placeholder="e.g. Sipho's Rapid Plumbing" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                           <div className="space-y-2">
                              <label className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Category</label>
                              <select value={bizCategory} onChange={e => setBizCategory(e.target.value as HandymanService['category'])} className="w-full bg-black border border-white/10 rounded-xl p-3 text-sm text-white font-bold outline-none focus:border-gold-primary/40">
                                 <option>Bakkie / Transport</option>
                                 <option>Plumbing</option>
                                 <option>Electrical</option>
                                 <option>Construction</option>
                                 <option>Cleaning</option>
                                 <option>Security</option>
                                 <option>Tech & Phone Repairs</option>
                                 <option>Solar & Gas</option>
                                 <option>Auto & Detailing</option>
                                 <option>Locksmith</option>
                                 <option>Tutoring & Academics</option>
                                 <option>Personal Care</option>
                                 <option>General Services</option>
                              </select>
                           </div>
                           <div className="space-y-2">
                              <label className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Contact Number</label>
                              <input value={bizPhone} onChange={e => setBizPhone(e.target.value)} required className="w-full bg-black border border-white/10 rounded-xl p-3 text-sm text-white font-bold outline-none focus:border-gold-primary/40" placeholder="e.g. +1 555 010 1234" />
                           </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                           <div className="space-y-2">
                              <label className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Location / City</label>
                              <input value={bizLocation} onChange={e => setBizLocation(e.target.value)} required className="w-full bg-black border border-white/10 rounded-xl p-3 text-sm text-white font-bold outline-none focus:border-gold-primary/40" placeholder="e.g. Berlin, Germany" />
                           </div>
                           <div className="space-y-2">
                              <label className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Suburb / Neighbourhood</label>
                              <input value={bizSuburb} onChange={e => setBizSuburb(e.target.value)} required className="w-full bg-black border border-white/10 rounded-xl p-3 text-sm text-white font-bold outline-none focus:border-gold-primary/40" placeholder="e.g. Kreuzberg" />
                           </div>
                        </div>
                        <div className="space-y-2">
                           <label className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Rate Estimate</label>
                           <input value={bizPrice} onChange={e => setBizPrice(e.target.value)} required className="w-full bg-black border border-white/10 rounded-xl p-3 text-sm text-white font-bold outline-none focus:border-gold-primary/40" placeholder="e.g. From 25/hour" />
                        </div>
                        <div className="space-y-2">
                           <label className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Full Description</label>
                           <textarea value={bizDesc} onChange={e => setBizDesc(e.target.value)} required className="w-full bg-black border border-white/10 rounded-xl p-3 text-sm text-white font-medium h-24 resize-none outline-none focus:border-gold-primary/40" placeholder="Describe your experience, tools, and availability..." />
                        </div>
                        <label className="flex items-start gap-3 cursor-pointer">
                           <input type="checkbox" checked={bizPublic} onChange={e => setBizPublic(e.target.checked)} className="mt-1 accent-[var(--gold-primary)]" />
                           <span className="text-xs text-gray-400 leading-relaxed">
                              <span className="text-white font-bold">Show my business on Google.</span> Your business name, category, suburb, description, rate and photo appear on a public page anyone can find. Your phone number and exact location stay private.
                           </span>
                        </label>
                     </div>
                     <button type="submit" className="w-full bg-gold-primary text-black font-black py-4 rounded-2xl uppercase tracking-widest text-xs active:scale-95 transition-all">{editingBiz ? 'Save Changes' : 'Publish Business Card'}</button>
                  </form>
               </motion.div>
            </div>
         )}
      </AnimatePresence>

      <AnimatePresence>
         {selectedBiz && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
               <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedBiz(null)} className="absolute inset-0 bg-black/90 backdrop-blur-md" />
               <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="glass-panel w-full max-w-xl max-h-[85dvh] overflow-y-auto custom-scrollbar bg-black border-gold-primary/20 relative z-10 p-6 sm:p-8 space-y-6 sm:space-y-8">
                  <div className="flex justify-between items-center">
                     <div className="space-y-1">
                        <h3 className="text-xl font-black text-white italic uppercase tracking-tighter">Hire <span className="text-gold-primary">Contractor</span></h3>
                        <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Dispatch Request to: {selectedBiz.businessName}</p>
                     </div>
                     <button onClick={() => setSelectedBiz(null)} className="text-gray-500 hover:text-white transition-colors"><X /></button>
                  </div>
                  <form onSubmit={handleDispatchContract} className="space-y-6">
                     {/* Quick Scope Starters */}
                     <div className="space-y-1.5">
                        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Quick Scope Starters</span>
                        <div className="flex flex-wrap gap-1.5">
                           {[
                              { label: 'Diagnostic Callout', text: `Hi ${selectedBiz.businessName}, requesting a diagnostic inspection and price estimate in ${selectedBiz.suburb || 'my area'}.` },
                              { label: 'Bakkie / Moving Job', text: `Hi ${selectedBiz.businessName}, need assistance with moving furniture / household items with a bakkie in ${selectedBiz.suburb || 'my area'}.` },
                              { label: 'Urgent Repair', text: `Hi ${selectedBiz.businessName}, emergency repair needed for geyser / electricity / plumbing fault at residence.` }
                           ].map(q => (
                              <button
                                 key={q.label}
                                 type="button"
                                 onClick={() => {
                                    playTactileSound('click')
                                    setHireMessage(q.text)
                                 }}
                                 className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-gold-primary/20 border border-white/10 hover:border-gold-primary/30 text-[10px] font-bold text-gray-300 hover:text-white transition-all active:scale-95"
                              >
                                 {q.label}
                              </button>
                           ))}
                        </div>
                     </div>

                     {/* Moving Vehicle / Payload Selector if Moving Assist */}
                     {MOVE_ASSIST_CATEGORIES.includes(selectedBiz.category) && (
                        <div className="space-y-1.5">
                           <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Moving Payload Size</span>
                           <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                              {[
                                 { label: 'Single-Cab Bakkie', icon: '🛻' },
                                 { label: 'Double-Cab Bakkie', icon: '🛻' },
                                 { label: '1-Ton Enclosed Van', icon: '🚐' },
                                 { label: 'Helpers Only', icon: '💪' }
                              ].map(v => (
                                 <button
                                    key={v.label}
                                    type="button"
                                    onClick={() => {
                                       playTactileSound('pop')
                                       setHireMessage(prev => prev ? `${prev} [Payload: ${v.label}]` : `[Payload: ${v.label}] `)
                                    }}
                                    className="p-2 rounded-xl bg-white/5 hover:bg-gold-primary/20 border border-white/10 hover:border-gold-primary/30 text-[10px] font-bold text-gray-300 hover:text-white flex items-center justify-center gap-1.5 transition-all active:scale-95 text-center"
                                 >
                                    <span>{v.icon}</span>
                                    <span className="truncate">{v.label}</span>
                                 </button>
                              ))}
                           </div>
                        </div>
                     )}

                     <div className="space-y-2">
                        <label className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Job Details & Scope</label>
                        <textarea value={hireMessage} onChange={e => setHireMessage(e.target.value)} required className="w-full bg-black border border-white/10 rounded-xl p-4 text-sm text-white h-32 resize-none outline-none focus:border-gold-primary/40" placeholder="Explain the problem or help you need, your address, and preferred date..." />
                     </div>
                     <div className="bg-gold-primary/5 border border-gold-primary/10 p-4 rounded-xl">
                        <p className="text-[10px] text-gold-primary font-black uppercase tracking-widest mb-1 flex items-center gap-2"><Info size={12}/> Security Tip</p>
                        <p className="text-[10px] text-gray-500 leading-relaxed font-bold">Payments are handled offline. Request a quote after the contractor inspects the site.</p>
                     </div>
                     <button type="submit" className="w-full bg-gold-primary hover:bg-gold-secondary text-black font-black py-4 rounded-2xl uppercase tracking-widest text-xs flex items-center justify-center gap-2 active:scale-95 transition-all">
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
               <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowLiftModal(false)} className="absolute inset-0 bg-black/90 backdrop-blur-md" />
               <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="glass-panel w-full max-w-2xl max-h-[88dvh] overflow-y-auto custom-scrollbar bg-black border-gold-primary/20 relative z-10">
                  <div className="bg-gold-primary/5 p-6 border-b border-white/5 flex justify-between items-center">
                     <h3 className="text-xl font-black text-white italic uppercase tracking-tighter">Post a <span className="text-gold-primary">Lift</span></h3>
                     <button onClick={() => setShowLiftModal(false)} className="text-gray-500 hover:text-white"><X /></button>
                  </div>
                  <form onSubmit={handleCreateLift} className="p-6 sm:p-8 space-y-6">
                     <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                           <label className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Origin</label>
                           <input value={liftOrigin} onChange={e => setLiftOrigin(e.target.value)} required className="w-full bg-black border border-white/10 rounded-xl p-3 text-sm text-white font-bold outline-none focus:border-gold-primary/40" placeholder="e.g. Kreuzberg" />
                        </div>
                        <div className="space-y-2">
                           <label className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Destination</label>
                           <input value={liftDestination} onChange={e => setLiftDestination(e.target.value)} required className="w-full bg-black border border-white/10 rounded-xl p-3 text-sm text-white font-bold outline-none focus:border-gold-primary/40" placeholder="e.g. City Centre" />
                        </div>
                     </div>
                     <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                           <label className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Departure Time</label>
                           <input value={liftDeparture} onChange={e => setLiftDeparture(e.target.value)} required className="w-full bg-black border border-white/10 rounded-xl p-3 text-sm text-white font-bold outline-none focus:border-gold-primary/40" placeholder="e.g. 07:30" />
                        </div>
                        <div className="space-y-2">
                           <label className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Days</label>
                           <input value={liftDays} onChange={e => setLiftDays(e.target.value)} required className="w-full bg-black border border-white/10 rounded-xl p-3 text-sm text-white font-bold outline-none focus:border-gold-primary/40" placeholder="e.g. Mon-Fri" />
                        </div>
                     </div>
                     <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                        <div className="space-y-2">
                           <label className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Price / Seat</label>
                           <input type="number" min="0" value={liftPrice} onChange={e => setLiftPrice(e.target.value)} required className="w-full bg-black border border-white/10 rounded-xl p-3 text-sm text-white font-bold outline-none focus:border-gold-primary/40" placeholder="e.g. 20" />
                        </div>
                        <div className="space-y-2">
                           <label className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Currency</label>
                           <input value={liftCurrency} onChange={e => setLiftCurrency(e.target.value.toUpperCase())} maxLength={3} required className="w-full bg-black border border-white/10 rounded-xl p-3 text-sm text-white font-bold outline-none focus:border-gold-primary/40" placeholder="ZAR" />
                        </div>
                        <div className="space-y-2">
                           <label className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Total Seats</label>
                           <input type="number" min="1" value={liftSeats} onChange={e => setLiftSeats(e.target.value)} required className="w-full bg-black border border-white/10 rounded-xl p-3 text-sm text-white font-bold outline-none focus:border-gold-primary/40" placeholder="e.g. 4" />
                        </div>
                     </div>
                     <div className="space-y-2">
                        <label className="text-[10px] text-gray-500 font-black uppercase tracking-widest flex items-center gap-2"><Link2 size={12} className="text-gold-primary" /> Attach to an Event (optional)</label>
                        <select value={liftEventId} onChange={e => setLiftEventId(e.target.value)} className="w-full bg-black border border-white/10 rounded-xl p-3 text-sm text-white font-bold outline-none focus:border-gold-primary/40">
                           <option value="">— No event —</option>
                           {upcomingEvents.map(ev => (
                              <option key={ev.id} value={ev.id}>{ev.title}</option>
                           ))}
                        </select>
                     </div>
                     <button type="submit" className="w-full bg-gold-primary text-black font-black py-4 rounded-2xl uppercase tracking-widest text-xs active:scale-95 transition-all">Post Lift Club</button>
                  </form>
               </motion.div>
            </div>
         )}
      </AnimatePresence>

      {/* BAKKIE & MOVING DISPATCH MODAL */}
      <AnimatePresence>
         {showBakkieModal && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
               <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowBakkieModal(false)} className="absolute inset-0 bg-black/90 backdrop-blur-md" />
               <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="glass-panel w-full max-w-xl max-h-[90dvh] overflow-y-auto custom-scrollbar bg-black/95 border-gold-primary/30 relative z-10 p-6 sm:p-8 space-y-6 shadow-2xl">
                  <div className="flex justify-between items-start">
                     <div className="space-y-1">
                        <div className="flex items-center gap-2">
                           <span className="p-1.5 bg-gold-primary/10 rounded-lg text-gold-primary"><Truck size={18} /></span>
                           <h3 className="text-xl font-black text-white italic uppercase tracking-tighter">
                              Request a <span className="text-gold-primary">Bakkie / Moving Assist</span>
                           </h3>
                        </div>
                        <p className="text-[11px] text-gray-400 font-medium">
                           {bakkieTargetService ? `Dispatching to: ${bakkieTargetService.businessName}` : 'Broadcasting to all verified bakkie operators in your area'}
                        </p>
                     </div>
                     <button onClick={() => setShowBakkieModal(false)} className="text-gray-500 hover:text-white transition-colors p-1"><X size={20} /></button>
                  </div>

                  <form onSubmit={handleBakkieSubmit} className="space-y-5">
                     {/* 1. Load / Cargo Type */}
                     <div className="space-y-2">
                        <label className="text-[10px] text-gray-400 font-black uppercase tracking-widest flex items-center gap-1.5">
                           <Package size={12} className="text-gold-primary" /> What are you moving?
                        </label>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                           {CARGO_PRESETS.map(c => (
                              <button
                                 key={c.id}
                                 type="button"
                                 onClick={() => { playTactileSound('click'); setBakkieLoadCategory(c.id) }}
                                 className={`p-2.5 rounded-xl border text-left text-xs font-bold transition-all flex items-center gap-2 ${
                                    bakkieLoadCategory === c.id
                                       ? 'bg-gold-primary/20 border-gold-primary text-white shadow-glow'
                                       : 'bg-white/[0.03] border-white/10 text-gray-400 hover:border-white/20'
                                 }`}
                              >
                                 <span className="text-base">{c.icon}</span>
                                 <span className="text-[11px] leading-tight">{c.label}</span>
                              </button>
                           ))}
                        </div>
                     </div>

                     {/* 2. Vehicle Needed */}
                     <div className="space-y-2">
                        <label className="text-[10px] text-gray-400 font-black uppercase tracking-widest flex items-center gap-1.5">
                           <Truck size={12} className="text-gold-primary" /> Vehicle Type Needed
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                           {VEHICLE_PRESETS.map(v => (
                              <button
                                 key={v.id}
                                 type="button"
                                 onClick={() => { playTactileSound('click'); setBakkieVehicleType(v.id) }}
                                 className={`p-3 rounded-xl border text-left transition-all ${
                                    bakkieVehicleType === v.id
                                       ? 'bg-gold-primary/20 border-gold-primary text-white shadow-glow'
                                       : 'bg-white/[0.03] border-white/10 text-gray-400 hover:border-white/20'
                                 }`}
                              >
                                 <div className="flex items-center justify-between">
                                    <span className="text-xs font-black text-white">{v.icon} {v.label}</span>
                                    <span className="text-xs font-black text-gold-primary">From R{v.basePrice}</span>
                                 </div>
                                 <p className="text-[10px] text-gray-500 mt-1">{v.sub}</p>
                              </button>
                           ))}
                        </div>
                     </div>

                     {/* 3. Pickup and Drop-off */}
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                           <label className="text-[10px] text-gray-400 font-black uppercase tracking-widest flex items-center gap-1">
                              <MapPin size={11} className="text-gold-primary" /> Pickup Address / Suburb
                           </label>
                           <input
                              type="text"
                              required
                              value={bakkiePickupAddress}
                              onChange={e => setBakkiePickupAddress(e.target.value)}
                              placeholder="e.g. 14 Vilakazi St, Orlando West"
                              className="w-full bg-black/60 border border-white/10 focus:border-gold-primary rounded-xl px-3.5 py-2.5 text-xs text-white outline-none"
                           />
                        </div>
                        <div className="space-y-1.5">
                           <label className="text-[10px] text-gray-400 font-black uppercase tracking-widest flex items-center gap-1">
                              <MapPin size={11} className="text-gold-primary" /> Drop-off Address / Suburb
                           </label>
                           <input
                              type="text"
                              required
                              value={bakkieDropoffAddress}
                              onChange={e => setBakkieDropoffAddress(e.target.value)}
                              placeholder="e.g. 42 Main St, Diepkloof"
                              className="w-full bg-black/60 border border-white/10 focus:border-gold-primary rounded-xl px-3.5 py-2.5 text-xs text-white outline-none"
                           />
                        </div>
                     </div>

                     {/* 4. Timing & Schedule */}
                     <div className="space-y-2">
                        <label className="text-[10px] text-gray-400 font-black uppercase tracking-widest flex items-center gap-1.5">
                           <Clock size={12} className="text-gold-primary" /> When do you need it?
                        </label>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                           {TIMING_PRESETS.map(t => (
                              <button
                                 key={t.id}
                                 type="button"
                                 onClick={() => { playTactileSound('click'); setBakkieSchedule(t.id) }}
                                 className={`p-2.5 rounded-xl border text-center transition-all ${
                                    bakkieSchedule === t.id
                                       ? 'bg-gold-primary text-black font-black border-gold-primary'
                                       : 'bg-white/[0.03] border-white/10 text-gray-300 hover:border-white/20'
                                 }`}
                              >
                                 <p className="text-[11px] font-bold">{t.label}</p>
                                 <p className="text-[9px] opacity-70">{t.sub}</p>
                              </button>
                           ))}
                        </div>
                     </div>

                     {/* 5. Extra Helpers */}
                     <div className="space-y-2">
                        <label className="text-[10px] text-gray-400 font-black uppercase tracking-widest flex items-center gap-1.5">
                           <Users size={12} className="text-gold-primary" /> Helpers Needed for Heavy Lifting
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                           {[
                              { count: 0, label: 'Driver Only', sub: 'I will load/offload' },
                              { count: 1, label: '+1 Helper', sub: '+R100 extra' },
                              { count: 2, label: '+2 Helpers', sub: '+R200 (Stairs/heavy)' },
                           ].map(h => (
                              <button
                                 key={h.count}
                                 type="button"
                                 onClick={() => { playTactileSound('click'); setBakkieHelpers(h.count) }}
                                 className={`p-2.5 rounded-xl border text-center transition-all ${
                                    bakkieHelpers === h.count
                                       ? 'bg-gold-primary/20 border-gold-primary text-white font-bold'
                                       : 'bg-white/[0.03] border-white/10 text-gray-400 hover:border-white/20'
                                 }`}
                              >
                                 <p className="text-xs font-bold">{h.label}</p>
                                 <p className="text-[10px] text-gray-500">{h.sub}</p>
                              </button>
                           ))}
                        </div>
                     </div>

                     {/* Notes */}
                     <div className="space-y-1.5">
                        <label className="text-[10px] text-gray-400 font-black uppercase tracking-widest">
                           Additional Notes / Stairs / Access
                        </label>
                        <input
                           type="text"
                           value={bakkieNotes}
                           onChange={e => setBakkieNotes(e.target.value)}
                           placeholder="e.g. 2nd floor stairs, double-door fridge, narrow gate"
                           className="w-full bg-black/60 border border-white/10 focus:border-gold-primary rounded-xl px-3.5 py-2.5 text-xs text-white outline-none"
                        />
                     </div>

                     {/* Live Estimated Fare Transparency Card */}
                     <div className="p-4 rounded-xl bg-gold-primary/10 border border-gold-primary/30 flex items-center justify-between">
                        <div>
                           <p className="text-[10px] text-gray-400 uppercase font-black tracking-widest">Estimated Trip Fare</p>
                           <p className="text-xl font-black text-white italic">
                              R{calculatedFare} <span className="text-[10px] text-gold-primary font-bold uppercase not-italic">ZAR</span>
                           </p>
                           <p className="text-[9px] text-gray-500">Standard local rate based on vehicle and helper count</p>
                        </div>
                        <span className="p-2 bg-gold-primary/20 rounded-xl text-gold-primary"><Truck size={24} /></span>
                     </div>

                     <button
                        type="submit"
                        disabled={bakkieSubmitting}
                        className="w-full bg-gold-primary hover:bg-gold-secondary text-black font-black py-4 rounded-xl uppercase tracking-widest text-xs flex items-center justify-center gap-2 active:scale-95 transition-all shadow-glow disabled:opacity-50"
                     >
                        {bakkieSubmitting ? 'Dispatching…' : 'Dispatch Bakkie Request'} <Send size={14} />
                     </button>
                  </form>
               </motion.div>
            </div>
         )}
      </AnimatePresence>

      {/* RIDE / LIFT REQUEST MODAL */}
      <AnimatePresence>
         {showRideRequestModal && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
               <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowRideRequestModal(false)} className="absolute inset-0 bg-black/90 backdrop-blur-md" />
               <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="glass-panel w-full max-w-lg max-h-[85dvh] overflow-y-auto custom-scrollbar bg-black/95 border-gold-primary/30 relative z-10 p-6 sm:p-8 space-y-6 shadow-2xl">
                  <div className="flex justify-between items-start">
                     <div className="space-y-1">
                        <div className="flex items-center gap-2">
                           <span className="p-1.5 bg-gold-primary/10 rounded-lg text-gold-primary"><Car size={18} /></span>
                           <h3 className="text-xl font-black text-white italic uppercase tracking-tighter">
                              Request a <span className="text-gold-primary">Ride / Lift</span>
                           </h3>
                        </div>
                        <p className="text-[11px] text-gray-400 font-medium">Post your commute or trip so local drivers heading your way can offer a seat</p>
                     </div>
                     <button onClick={() => setShowRideRequestModal(false)} className="text-gray-500 hover:text-white transition-colors p-1"><X size={20} /></button>
                  </div>

                  <form onSubmit={handleRideRequestSubmit} className="space-y-4">
                     <div className="space-y-1.5">
                        <label className="text-[10px] text-gray-400 font-black uppercase tracking-widest flex items-center gap-1">
                           <MapPin size={11} className="text-gold-primary" /> Departure Location (From)
                        </label>
                        <input
                           type="text"
                           required
                           value={rideOrigin}
                           onChange={e => setRideOrigin(e.target.value)}
                           placeholder="e.g. Soweto, Meadowlands Zone 2"
                           className="w-full bg-black/60 border border-white/10 focus:border-gold-primary rounded-xl px-3.5 py-2.5 text-xs text-white outline-none"
                        />
                     </div>

                     <div className="space-y-1.5">
                        <label className="text-[10px] text-gray-400 font-black uppercase tracking-widest flex items-center gap-1">
                           <MapPin size={11} className="text-gold-primary" /> Destination (To)
                        </label>
                        <input
                           type="text"
                           required
                           value={rideDestination}
                           onChange={e => setRideDestination(e.target.value)}
                           placeholder="e.g. Rosebank / Sandton / Joburg CBD"
                           className="w-full bg-black/60 border border-white/10 focus:border-gold-primary rounded-xl px-3.5 py-2.5 text-xs text-white outline-none"
                        />
                     </div>

                     <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                           <label className="text-[10px] text-gray-400 font-black uppercase tracking-widest flex items-center gap-1">
                              <Clock size={11} className="text-gold-primary" /> Preferred Time
                           </label>
                           <input
                              type="text"
                              value={rideDeparture}
                              onChange={e => setRideDeparture(e.target.value)}
                              placeholder="07:00 AM"
                              className="w-full bg-black/60 border border-white/10 focus:border-gold-primary rounded-xl px-3.5 py-2.5 text-xs text-white outline-none"
                           />
                        </div>
                        <div className="space-y-1.5">
                           <label className="text-[10px] text-gray-400 font-black uppercase tracking-widest flex items-center gap-1">
                              <Calendar size={11} className="text-gold-primary" /> Days / Schedule
                           </label>
                           <input
                              type="text"
                              value={rideDays}
                              onChange={e => setRideDays(e.target.value)}
                              placeholder="Mon - Fri"
                              className="w-full bg-black/60 border border-white/10 focus:border-gold-primary rounded-xl px-3.5 py-2.5 text-xs text-white outline-none"
                           />
                        </div>
                     </div>

                     <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                           <label className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Seats Needed</label>
                           <input
                              type="number"
                              min="1"
                              max="4"
                              value={rideSeatsNeeded}
                              onChange={e => setRideSeatsNeeded(e.target.value)}
                              className="w-full bg-black/60 border border-white/10 focus:border-gold-primary rounded-xl px-3.5 py-2.5 text-xs text-white outline-none"
                           />
                        </div>
                        <div className="space-y-1.5">
                           <label className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Target Price (ZAR)</label>
                           <input
                              type="number"
                              value={rideTargetPrice}
                              onChange={e => setRideTargetPrice(e.target.value)}
                              placeholder="35"
                              className="w-full bg-black/60 border border-white/10 focus:border-gold-primary rounded-xl px-3.5 py-2.5 text-xs text-white outline-none"
                           />
                        </div>
                     </div>

                     <div className="space-y-1.5">
                        <label className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Notes (Optional)</label>
                        <input
                           type="text"
                           value={rideNotes}
                           onChange={e => setRideNotes(e.target.value)}
                           placeholder="e.g. Daily work commute, non-smoker, reliable rider"
                           className="w-full bg-black/60 border border-white/10 focus:border-gold-primary rounded-xl px-3.5 py-2.5 text-xs text-white outline-none"
                        />
                     </div>

                     <button
                        type="submit"
                        className="w-full bg-gold-primary hover:bg-gold-secondary text-black font-black py-4 rounded-xl uppercase tracking-widest text-xs flex items-center justify-center gap-2 active:scale-95 transition-all shadow-glow"
                     >
                        Post Ride Request <Send size={14} />
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
               <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="glass-panel w-full max-w-md max-h-[85dvh] overflow-y-auto custom-scrollbar bg-black border-gold-primary/20 relative z-10 p-6 sm:p-8 text-center space-y-6">
                  <div className="w-20 h-20 bg-gold-primary/10 rounded-full flex items-center justify-center mx-auto">
                     <ShieldCheck size={40} className="text-gold-primary" />
                  </div>
                  <div className="space-y-2">
                     <h3 className="text-2xl font-black text-white italic uppercase tracking-tighter">Finalize <span className="text-gold-primary">Order</span></h3>
                     <p className="text-xs text-gray-500 font-bold uppercase tracking-widest px-4 leading-relaxed">System is requesting proof of completion. Please confirm that the work for <strong>{showProofModal.serviceName}</strong> is finished to your satisfaction.</p>
                  </div>
                  <div className="pt-4 flex flex-col gap-3">
                     <button
                       onClick={() => { dispatch(updateDispatchStatus({ dispatchId: showProofModal.id, status: 'completed' })); setShowProofModal(null); setAlertNotification('Order marked as Completed!') }}
                       className="w-full bg-gold-primary text-black font-black py-4 rounded-2xl uppercase tracking-widest text-xs active:scale-95 transition-all"
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
               className="fixed bottom-[calc(6rem+env(safe-area-inset-bottom,0px))] md:bottom-20 left-1/2 -translate-x-1/2 z-[300] bg-black border border-gold-primary px-5 sm:px-8 py-3.5 sm:py-4 rounded-2xl flex items-center gap-3 sm:gap-4 max-w-[calc(100vw-2rem)] w-auto min-w-[280px] sm:min-w-[320px]"
            >
               <div className="p-2 bg-green-500/20 rounded-full text-green-500"><Check size={24} /></div>
               <div className="space-y-0.5 min-w-0">
                  <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Notification</p>
                  <p className="text-sm font-black text-white italic tracking-tight uppercase truncate">{alertNotification}</p>
               </div>
               <button onClick={() => setAlertNotification(null)} className="ml-auto text-gray-500 hover:text-white transition-colors shrink-0"><X size={16} /></button>
            </motion.div>
         )}
      </AnimatePresence>

    </div>
  )
}
