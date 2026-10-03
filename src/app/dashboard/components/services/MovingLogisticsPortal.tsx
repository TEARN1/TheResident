'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Truck, Users, MapPin, Calendar, ArrowRight, ShieldCheck,
  CheckCircle2, Package, Flame, Star, X
} from 'lucide-react'
import { playTactileSound } from '../../../../utils/tactileSounds'
import { fetchUpcomingGruvsEvents, type GruvsEvent } from '../../../../utils/gruvsEvents'

export interface MoverService {
  id: string
  providerName: string
  vehicleType: '1-Ton Bakkie' | '2-Ton Truck' | 'Enclosed Van' | 'Moving Helper (Hands Only)'
  capacityDesc: string
  baseRateZar: number
  perKmRateZar: number
  location: string
  suburb: string
  rating: number
  completedMoves: number
  verified: boolean
  providesHelpers: boolean
  interProvincial: boolean
  availableNow: boolean
  contactPhone: string
  avatarUrl?: string
}

export interface InterProvincialRoute {
  id: string
  fromProvince: string
  toProvince: string
  routeLabel: string
  departureDate: string
  truckType: string
  spaceAvailable: string
  priceZar: number
  driverName: string
  driverPhone: string
}

const SAMPLE_MOVERS: MoverService[] = [
  {
    id: 'mov-1',
    providerName: 'Sipho Bakkie & Towing Services',
    vehicleType: '1-Ton Bakkie',
    capacityDesc: 'Single room, bed, fridge, up to 15 boxes. Canopy covered.',
    baseRateZar: 450,
    perKmRateZar: 15,
    location: 'Johannesburg',
    suburb: 'Braamfontein',
    rating: 4.9,
    completedMoves: 142,
    verified: true,
    providesHelpers: true,
    interProvincial: true,
    availableNow: true,
    contactPhone: '+27 82 450 1192'
  },
  {
    id: 'mov-2',
    providerName: 'Mandla & Brothers Heavy Move',
    vehicleType: '2-Ton Truck',
    capacityDesc: '2-3 Bedroom apartment, heavy appliances, wardrobes.',
    baseRateZar: 850,
    perKmRateZar: 22,
    location: 'Johannesburg',
    suburb: 'Maboneng',
    rating: 4.8,
    completedMoves: 98,
    verified: true,
    providesHelpers: true,
    interProvincial: true,
    availableNow: false,
    contactPhone: '+27 71 882 4001'
  },
  {
    id: 'mov-3',
    providerName: 'Solo Mover Muscle Crew (Themba & Kevin)',
    vehicleType: 'Moving Helper (Hands Only)',
    capacityDesc: 'No truck needed? We help solo dwellers pack, lift, carry stairs, and unpack.',
    baseRateZar: 280,
    perKmRateZar: 0,
    location: 'Cape Town',
    suburb: 'Observatory',
    rating: 5.0,
    completedMoves: 67,
    verified: true,
    providesHelpers: true,
    interProvincial: false,
    availableNow: true,
    contactPhone: '+27 63 119 5532'
  },
  {
    id: 'mov-4',
    providerName: 'Cape To City Enclosed Relocations',
    vehicleType: 'Enclosed Van',
    capacityDesc: 'Weatherproof enclosed transit for fragile electronics and furniture.',
    baseRateZar: 600,
    perKmRateZar: 18,
    location: 'Cape Town',
    suburb: 'Cape Town CBD',
    rating: 4.7,
    completedMoves: 84,
    verified: true,
    providesHelpers: true,
    interProvincial: true,
    availableNow: true,
    contactPhone: '+27 79 332 9901'
  }
]

const SAMPLE_INTER_PROVINCIAL: InterProvincialRoute[] = [
  {
    id: 'ip-1',
    fromProvince: 'Gauteng (Joburg)',
    toProvince: 'Eastern Cape (Gqeberha / East London)',
    routeLabel: 'Gauteng ⇄ Eastern Cape Highway Express',
    departureDate: 'Every Friday & Tuesday',
    truckType: '4-Ton Enclosed Long-Haul',
    spaceAvailable: 'Half Truck Space Open',
    priceZar: 1850,
    driverName: 'Thabo Mthembu',
    driverPhone: '+27 83 550 4912'
  },
  {
    id: 'ip-2',
    fromProvince: 'Gauteng (Pretoria/Joburg)',
    toProvince: 'KwaZulu-Natal (Durban / Pietermaritzburg)',
    routeLabel: 'N3 Corridor Fast Freight & Relocation',
    departureDate: 'Weekly Wednesdays & Saturdays',
    truckType: '3-Ton Drop-side Bakkie & Trailer',
    spaceAvailable: 'Full Bed / Boxes Open',
    priceZar: 1400,
    driverName: 'Kagiso Dlamini',
    driverPhone: '+27 76 220 8911'
  },
  {
    id: 'ip-3',
    fromProvince: 'Western Cape (Cape Town)',
    toProvince: 'Eastern Cape (Mthatha / Butterworth)',
    routeLabel: 'N2 Coastal Relocation Shuttle',
    departureDate: 'Month-End Special & Bi-Weekly',
    truckType: '5-Ton Heavy Relocator',
    spaceAvailable: 'Shared Compartments Available',
    priceZar: 1950,
    driverName: 'Zola Xaba',
    driverPhone: '+27 61 771 9043'
  }
]

export default function MovingLogisticsPortal({
  onSelectProvider
}: {
  onSelectProvider?: (phone: string, providerName: string) => void
}) {
  const [subSection, setSubSection] = useState<'bakkies' | 'solo-helpers' | 'inter-provincial' | 'gruvs-events'>('bakkies')
  const [vehicleFilter, setVehicleFilter] = useState<'all' | '1-ton' | '2-ton' | 'helpers'>('all')
  const [gruvsEvents, setGruvsEvents] = useState<GruvsEvent[]>([])
  const [showBookModal, setShowBookModal] = useState<MoverService | InterProvincialRoute | null>(null)
  const [moveFrom, setMoveFrom] = useState('')
  const [moveTo, setMoveTo] = useState('')
  const [moveDate, setMoveDate] = useState('')
  const [soloHelperCount, setSoloHelperCount] = useState(1)
  const [bookedSuccess, setBookedSuccess] = useState(false)

  useEffect(() => {
    fetchUpcomingGruvsEvents(6).then(setGruvsEvents).catch(() => {})
  }, [])

  const filteredMovers = SAMPLE_MOVERS.filter(m => {
    if (subSection === 'solo-helpers') return m.vehicleType === 'Moving Helper (Hands Only)'
    if (vehicleFilter === '1-ton') return m.vehicleType === '1-Ton Bakkie'
    if (vehicleFilter === '2-ton') return m.vehicleType === '2-Ton Truck' || m.vehicleType === 'Enclosed Van'
    if (vehicleFilter === 'helpers') return m.providesHelpers
    return true
  })

  const handleOpenBooking = (item: MoverService | InterProvincialRoute) => {
    playTactileSound('click')
    setShowBookModal(item)
    setBookedSuccess(false)
  }

  const handleConfirmBooking = (e: React.FormEvent) => {
    e.preventDefault()
    playTactileSound('success')
    setBookedSuccess(true)
    setTimeout(() => {
      setShowBookModal(null)
      setBookedSuccess(false)
    }, 2200)
  }

  return (
    <div className="space-y-6">
      {/* Moving Portal Hero Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-950/70 via-black to-amber-950/40 border border-gold-primary/30 p-6 sm:p-8 shadow-glass">
        <div className="absolute top-0 right-0 w-80 h-80 bg-gold-primary/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 max-w-2xl space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gold-primary/20 border border-gold-primary/30 text-[10px] font-black uppercase tracking-wider text-gold-primary">
            <Truck size={13} />
            <span>South Africa Move Logistics & Job Engine</span>
          </div>
          <h2 className="text-xl sm:text-2xl md:text-3xl font-black text-white tracking-tight">
            Need a Bakkie, Truck, or Moving Muscle?
          </h2>
          <p className="text-xs sm:text-sm text-gray-300 leading-relaxed">
            Empowering local truck owners, bakkie drivers, and student helpers. Move easily across suburbs, between provinces, or hop on party event shuttles.
          </p>
        </div>

        {/* Section Navigation Tabs */}
        <div className="flex items-center gap-2 pt-6 overflow-x-auto no-scrollbar">
          {[
            { id: 'bakkies', label: 'Bakkies & Trucks', icon: Truck },
            { id: 'solo-helpers', label: 'Solo Mover Helpers', icon: Users },
            { id: 'inter-provincial', label: 'Inter-Provincial Travel', icon: MapPin },
            { id: 'gruvs-events', label: 'Gruvs Event Shuttles', icon: Flame }
          ].map(tab => {
            const Icon = tab.icon
            const active = subSection === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => {
                  playTactileSound('tab')
                  setSubSection(tab.id as 'bakkies' | 'solo-helpers' | 'inter-provincial' | 'gruvs-events')
                }}
                className={`px-4 py-2 rounded-2xl text-xs font-black uppercase tracking-wider shrink-0 transition-all flex items-center gap-2 border ${
                  active
                    ? 'bg-gold-primary text-black border-gold-primary shadow-glow'
                    : 'bg-black/60 text-gray-400 border-white/10 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon size={14} />
                <span>{tab.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* 1. Bakkies & Local Trucks Section */}
      {subSection === 'bakkies' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-black text-white uppercase tracking-tight flex items-center gap-2">
                <Truck size={18} className="text-gold-primary" /> Local Bakkies & Moving Trucks
              </h3>
              <p className="text-xs text-gray-400">Verified drivers ready for apartment moves, furniture, and heavy boxes.</p>
            </div>

            {/* Quick Filter */}
            <div className="flex items-center gap-1.5 overflow-x-auto">
              {[
                { id: 'all', label: 'All Vehicles' },
                { id: '1-ton', label: '1-Ton Bakkie' },
                { id: '2-ton', label: '2-Ton Truck' },
                { id: 'helpers', label: 'With Helpers' }
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => {
                    playTactileSound('tab')
                    setVehicleFilter(f.id as 'all' | '1-ton' | '2-ton' | 'helpers')
                  }}
                  className={`px-3 py-1 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all border ${
                    vehicleFilter === f.id
                      ? 'bg-white/20 text-white border-white/40'
                      : 'bg-white/5 text-gray-400 border-white/10 hover:text-white'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredMovers.map(mover => (
              <div
                key={mover.id}
                className="bg-black/60 backdrop-blur-2xl border border-white/10 hover:border-gold-primary/40 rounded-3xl p-5 shadow-glass transition-all flex flex-col justify-between group"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-black text-white group-hover:text-gold-primary transition-colors">
                          {mover.providerName}
                        </span>
                        {mover.verified && <ShieldCheck size={14} className="text-gold-primary shrink-0" />}
                      </div>
                      <p className="text-[11px] text-gray-400 flex items-center gap-1 mt-0.5">
                        <MapPin size={11} className="text-gold-primary" /> {mover.suburb}, {mover.location}
                      </p>
                    </div>

                    <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-xl bg-gold-primary/10 text-gold-primary border border-gold-primary/20 shrink-0">
                      {mover.vehicleType}
                    </span>
                  </div>

                  <p className="text-xs text-gray-300 leading-relaxed bg-white/[0.02] p-3 rounded-2xl border border-white/5">
                    {mover.capacityDesc}
                  </p>

                  <div className="flex flex-wrap items-center gap-2 text-[10px] text-gray-400 font-bold">
                    <span className="flex items-center gap-1 text-emerald-400">
                      <Star size={11} className="fill-emerald-400" /> {mover.rating} ({mover.completedMoves} moves)
                    </span>
                    <span>•</span>
                    {mover.providesHelpers && (
                      <span className="text-amber-400 flex items-center gap-1">
                        <Users size={11} /> Extra Hands Included
                      </span>
                    )}
                    {mover.availableNow && (
                      <span className="text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full border border-green-500/20">
                        Available Today
                      </span>
                    )}
                  </div>
                </div>

                <div className="pt-4 mt-3 border-t border-white/10 flex items-center justify-between gap-3">
                  <div>
                    <span className="text-[10px] text-gray-400 uppercase font-black block">Base Rate</span>
                    <span className="text-sm font-black text-white font-mono">
                      R{mover.baseRateZar} <span className="text-[10px] text-gray-400 font-normal">+ R{mover.perKmRateZar}/km</span>
                    </span>
                  </div>

                  <button
                    onClick={() => {
                      if (onSelectProvider) onSelectProvider(mover.contactPhone, mover.providerName)
                      handleOpenBooking(mover)
                    }}
                    className="px-4 py-2 rounded-xl bg-gold-primary hover:bg-gold-secondary text-black font-black text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-glow transition-all active:scale-95"
                  >
                    <span>Request Move</span>
                    <ArrowRight size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2. Solo Mover Helpers Section */}
      {subSection === 'solo-helpers' && (
        <div className="space-y-4">
          <div className="p-5 rounded-3xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3.5">
            <div className="p-2.5 rounded-2xl bg-amber-500/20 text-amber-400 shrink-0">
              <Users size={20} />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-black text-white uppercase tracking-tight">
                Moving Alone? Don&apos;t Break Your Back
              </h4>
              <p className="text-xs text-gray-300 leading-relaxed">
                Dedicated moving helpers for solo dwellers. We dispatch strong, vetted community assistants to help carry beds up stairs, pack dishes, lift refrigerators, and load trailers safely.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {SAMPLE_MOVERS.filter(m => m.providesHelpers).map(helper => (
              <div
                key={helper.id}
                className="bg-black/60 backdrop-blur-2xl border border-white/10 hover:border-gold-primary/40 rounded-3xl p-5 shadow-glass transition-all flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="text-sm font-black text-white">{helper.providerName}</h4>
                      <p className="text-[11px] text-gray-400 mt-0.5">{helper.suburb}, {helper.location}</p>
                    </div>
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      Vetted Hands
                    </span>
                  </div>

                  <p className="text-xs text-gray-300 leading-relaxed bg-white/[0.02] p-3 rounded-2xl border border-white/5">
                    {helper.capacityDesc}
                  </p>

                  <div className="text-[11px] text-gray-400 space-y-1">
                    <p className="flex items-center gap-1.5 text-white font-bold">
                      <CheckCircle2 size={12} className="text-emerald-400" /> Furniture Disassembly & Assembly
                    </p>
                    <p className="flex items-center gap-1.5 text-white font-bold">
                      <CheckCircle2 size={12} className="text-emerald-400" /> Multi-flight Staircase Carrying
                    </p>
                  </div>
                </div>

                <div className="pt-4 mt-4 border-t border-white/10 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-gray-400 uppercase font-black block">Standard Rate</span>
                    <span className="text-sm font-black text-white font-mono">R{helper.baseRateZar} <span className="text-[10px] text-gray-400 font-normal">/ 2 hours</span></span>
                  </div>

                  <button
                    onClick={() => handleOpenBooking(helper)}
                    className="px-4 py-2 rounded-xl bg-gold-primary hover:bg-gold-secondary text-black font-black text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-glow transition-all active:scale-95"
                  >
                    <span>Hire Helper</span>
                    <ArrowRight size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. Inter-Provincial Long-Distance Travel */}
      {subSection === 'inter-provincial' && (
        <div className="space-y-4">
          <div>
            <h3 className="text-base font-black text-white uppercase tracking-tight flex items-center gap-2">
              <MapPin size={18} className="text-gold-primary" /> Inter-Provincial Relocation & Travel
            </h3>
            <p className="text-xs text-gray-400">Scheduled long-haul cargo and apartment relocations between major SA provinces.</p>
          </div>

          <div className="space-y-3">
            {SAMPLE_INTER_PROVINCIAL.map(route => (
              <div
                key={route.id}
                className="bg-black/60 backdrop-blur-2xl border border-white/10 hover:border-gold-primary/40 rounded-3xl p-5 shadow-glass transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="space-y-2 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-white uppercase tracking-tight">
                      {route.routeLabel}
                    </span>
                    <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-gold-primary/20 text-gold-primary border border-gold-primary/30">
                      {route.truckType}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-xs text-gray-300">
                    <span className="flex items-center gap-1 text-gray-400">
                      <Calendar size={13} className="text-gold-primary" /> {route.departureDate}
                    </span>
                    <span>•</span>
                    <span className="text-emerald-400 font-bold">
                      {route.spaceAvailable}
                    </span>
                    <span>•</span>
                    <span className="text-gray-400">
                      Driver: <strong className="text-white">{route.driverName}</strong>
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between md:justify-end gap-4 shrink-0 pt-3 md:pt-0 border-t md:border-t-0 border-white/10">
                  <div>
                    <span className="text-[9px] text-gray-400 uppercase font-black block">From</span>
                    <span className="text-base font-black text-white font-mono">
                      R{route.priceZar}
                    </span>
                  </div>

                  <button
                    onClick={() => handleOpenBooking(route)}
                    className="px-4 py-2.5 rounded-2xl bg-gold-primary hover:bg-gold-secondary text-black font-black text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-glow transition-all active:scale-95"
                  >
                    <span>Reserve Load</span>
                    <ArrowRight size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. The Gruvs Event Shuttles */}
      {subSection === 'gruvs-events' && (
        <div className="space-y-4">
          <div className="p-5 rounded-3xl bg-purple-950/40 border border-purple-500/30 flex items-start gap-3.5">
            <div className="p-2.5 rounded-2xl bg-purple-500/20 text-purple-400 shrink-0">
              <Flame size={20} />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-black text-white uppercase tracking-tight">
                The Gruvs Nightlife & Concert Ride-Pools
              </h4>
              <p className="text-xs text-gray-300 leading-relaxed">
                Heading to a live festival or nightlife event on The Gruvs? Share a bakkie or shuttle with fellow residents heading to the same venue. Safe group travel and split fuel costs.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {gruvsEvents.length === 0 ? (
              <div className="col-span-2 py-10 text-center text-gray-400">
                <Flame size={28} className="mx-auto text-purple-400 mb-2 opacity-60" />
                <p className="text-xs font-bold text-gray-300">No active event rides scheduled right now</p>
                <p className="text-[10px] text-gray-500">Check back closer to upcoming weekend festival dates.</p>
              </div>
            ) : (
              gruvsEvents.map(event => (
                <div
                  key={event.id}
                  className="bg-black/60 backdrop-blur-2xl border border-white/10 hover:border-purple-500/40 rounded-3xl p-5 shadow-glass transition-all flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                      The Gruvs Official Event
                    </span>
                    <h4 className="text-sm font-black text-white">{event.title}</h4>
                    <p className="text-xs text-gray-400 flex items-center gap-1">
                      <MapPin size={11} className="text-purple-400" /> {event.venue || event.city || 'South Africa Venue'}
                    </p>
                  </div>

                  <div className="pt-4 mt-3 border-t border-white/10 flex items-center justify-between">
                    <span className="text-xs font-bold text-purple-300 font-mono">
                      Group Shuttle R80/seat
                    </span>
                    <button
                      onClick={() => {
                        playTactileSound('click')
                        alert(`Shuttle booked for ${event.title}! Driver details dispatched to your messages.`)
                      }}
                      className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-black text-xs uppercase tracking-wider shadow-md transition-all active:scale-95"
                    >
                      Book Seat
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Booking Drawer / Modal */}
      <AnimatePresence>
        {showBookModal && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-[var(--card-bg,rgba(11,43,38,0.95))] border border-[var(--glass-border,rgba(142,182,155,0.3))] rounded-3xl p-6 sm:p-7 shadow-2xl backdrop-blur-2xl space-y-4"
            >
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-gold-primary/20 text-gold-primary">
                    <Truck size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-white uppercase tracking-tight">
                      {'providerName' in showBookModal ? showBookModal.providerName : showBookModal.routeLabel}
                    </h3>
                    <p className="text-[11px] text-gray-400">Requesting move transport & helper assistance</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowBookModal(null)}
                  className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white"
                >
                  <X size={16} />
                </button>
              </div>

              {bookedSuccess ? (
                <div className="py-8 text-center space-y-2">
                  <CheckCircle2 size={40} className="mx-auto text-emerald-400 animate-bounce" />
                  <h4 className="text-base font-black text-white">Move Request Dispatched!</h4>
                  <p className="text-xs text-gray-300">
                    The driver and helpers have been notified. Check your Direct Messages for confirmation.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleConfirmBooking} className="space-y-3.5">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-wider text-gray-300">Moving From (Address / Suburb)</label>
                    <input
                      type="text"
                      required
                      value={moveFrom}
                      onChange={e => setMoveFrom(e.target.value)}
                      placeholder="e.g. 12 Jorissen St, Braamfontein"
                      className="w-full bg-black/60 border border-white/15 rounded-xl px-3.5 py-2 text-xs text-white outline-none focus:border-gold-primary"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-wider text-gray-300">Moving To (Address / Suburb)</label>
                    <input
                      type="text"
                      required
                      value={moveTo}
                      onChange={e => setMoveTo(e.target.value)}
                      placeholder="e.g. Rosebank / Hatfield, Pretoria"
                      className="w-full bg-black/60 border border-white/15 rounded-xl px-3.5 py-2 text-xs text-white outline-none focus:border-gold-primary"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-wider text-gray-300">Preferred Date</label>
                      <input
                        type="date"
                        required
                        value={moveDate}
                        onChange={e => setMoveDate(e.target.value)}
                        className="w-full bg-black/60 border border-white/15 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-gold-primary"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-wider text-gray-300">Number of Helpers</label>
                      <select
                        value={soloHelperCount}
                        onChange={e => setSoloHelperCount(Number(e.target.value))}
                        className="w-full bg-black/60 border border-white/15 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-gold-primary"
                      >
                        <option value={1} className="bg-black">1 Helper (Driver + You)</option>
                        <option value={2} className="bg-black">2 Helpers (Full Team)</option>
                        <option value={3} className="bg-black">3 Helpers (Heavy Lifting)</option>
                      </select>
                    </div>
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      className="w-full py-3 rounded-2xl bg-gold-primary hover:bg-gold-secondary text-black font-black text-xs uppercase tracking-wider shadow-glow transition-all active:scale-98 flex items-center justify-center gap-2"
                    >
                      <Package size={15} />
                      <span>Confirm & Dispatch Move Request</span>
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
