'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Car, X, Users, MapPin, Calendar, Clock, DollarSign, Share2, Check, Sparkles, AlertCircle } from 'lucide-react'
import { playTactileSound } from '../../../utils/tactileSounds'
import { GruvsEvent } from '../../../utils/gruvsEvents'

interface EventRidePoolerModalProps {
  isOpen: boolean
  onClose: () => void
  upcomingEvents: GruvsEvent[]
}

interface RideOffer {
  id: string
  eventTitle: string
  departureLocation: string
  seatsTotal: number
  seatsBooked: number
  driverName: string
  costPerSeat: number
  vehicleType: string
  contactPhone: string
}

export default function EventRidePoolerModal({
  isOpen,
  onClose,
  upcomingEvents
}: EventRidePoolerModalProps) {
  const [rides, setRides] = useState<RideOffer[]>([
    {
      id: '1',
      eventTitle: upcomingEvents[0]?.title || 'Campus Neon Night @ The Gruvs',
      departureLocation: 'Rosebank Central (Main Mall)',
      seatsTotal: 4,
      seatsBooked: 2,
      driverName: 'Sipho (Apt 4B)',
      costPerSeat: 45,
      vehicleType: 'Uber XL Shared Split',
      contactPhone: '071 234 5678'
    },
    {
      id: '2',
      eventTitle: upcomingEvents[1]?.title || 'Amapiano Sunset Rooftop',
      departureLocation: 'Braamfontein Student Hub',
      seatsTotal: 3,
      seatsBooked: 1,
      driverName: 'Lindiwe (Block C)',
      costPerSeat: 35,
      vehicleType: 'VW Polo (Personal Car)',
      contactPhone: '082 987 6543'
    }
  ])

  const [showCreateForm, setShowCreateForm] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState(upcomingEvents[0]?.title || '')
  const [pickup, setPickup] = useState('')
  const [seats, setSeats] = useState(3)
  const [price, setPrice] = useState(40)
  const [vehicle, setVehicle] = useState('Uber / Bolt Shared')
  const [bookingSuccess, setBookingSuccess] = useState<string | null>(null)

  if (!isOpen) return null

  const handleCreateRide = (e: React.FormEvent) => {
    e.preventDefault()
    playTactileSound('success')
    setRides(prev => [
      {
        id: Date.now().toString(),
        eventTitle: selectedEvent || 'The Gruvs Campus Gathering',
        departureLocation: pickup || 'Building Reception',
        seatsTotal: seats,
        seatsBooked: 0,
        driverName: 'You (Organizer)',
        costPerSeat: price,
        vehicleType: vehicle,
        contactPhone: 'Via Resident DMs'
      },
      ...prev
    ])
    setShowCreateForm(false)
    setPickup('')
  }

  const handleBookSeat = (rideId: string) => {
    playTactileSound('pop')
    setRides(prev =>
      prev.map(r => {
        if (r.id === rideId && r.seatsBooked < r.seatsTotal) {
          return { ...r, seatsBooked: r.seatsBooked + 1 }
        }
        return r
      })
    )
    setBookingSuccess(rideId)
    setTimeout(() => setBookingSuccess(null), 3000)
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="relative w-full max-w-xl bg-black/95 border border-purple-500/40 rounded-3xl p-6 sm:p-8 shadow-[0_0_50px_rgba(168,85,247,0.2)] backdrop-blur-2xl overflow-hidden max-h-[90vh] flex flex-col"
        >
          {/* Neon Purple Ambient Glow */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-purple-600/15 rounded-full blur-3xl pointer-events-none" />

          {/* Close button */}
          <button
            onClick={() => { playTactileSound('pop'); onClose() }}
            className="absolute top-5 right-5 p-2 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all"
          >
            <X size={18} />
          </button>

          {/* Header */}
          <div className="flex items-center gap-3 mb-6 shrink-0">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-600 to-pink-500 flex items-center justify-center text-white shadow-lg shadow-purple-500/20">
              <Car size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black text-white tracking-tight">The Gruvs Event Ride Pooler</h3>
                <span className="text-[10px] font-black uppercase tracking-wider bg-purple-500/20 text-purple-300 border border-purple-500/40 px-2 py-0.5 rounded-full">
                  Shuttle &amp; Uber Pool
                </span>
              </div>
              <p className="text-xs text-gray-400">
                Team up with neighbors for safe travel and split fares to weekend festivals
              </p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto space-y-4 pr-1 custom-scrollbar">
            {/* Create Ride Toggle */}
            <div className="flex justify-between items-center bg-white/[0.02] border border-white/5 p-3 rounded-2xl">
              <div>
                <span className="text-xs font-bold text-white block">Heading out to a party?</span>
                <span className="text-[10px] text-gray-400">Offer empty car seats or start an Uber XL split.</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  playTactileSound('tab')
                  setShowCreateForm(v => !v)
                }}
                className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs uppercase tracking-wider transition-all active:scale-95"
              >
                {showCreateForm ? 'Cancel' : '+ Offer Ride'}
              </button>
            </div>

            {/* Create Form */}
            {showCreateForm && (
              <form onSubmit={handleCreateRide} className="p-4 rounded-2xl bg-purple-950/30 border border-purple-500/30 space-y-3">
                <div className="space-y-1">
                  <label className="text-[10px] text-gray-400 uppercase font-black tracking-wider">Destination Event</label>
                  <select
                    value={selectedEvent}
                    onChange={e => setSelectedEvent(e.target.value)}
                    className="w-full bg-black border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-purple-500"
                  >
                    {upcomingEvents.map(e => (
                      <option key={e.id} value={e.title}>{e.title}</option>
                    ))}
                    <option value="General Nightlife Outing">General Weekend Party Outing</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-gray-400 uppercase font-black tracking-wider">Pickup Spot</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Building Main Gate / Lobby"
                    value={pickup}
                    onChange={e => setPickup(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-purple-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[10px] text-gray-400 uppercase font-black tracking-wider">Seats Available</label>
                    <input
                      type="number"
                      min={1}
                      max={6}
                      value={seats}
                      onChange={e => setSeats(Number(e.target.value))}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-purple-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-gray-400 uppercase font-black tracking-wider">Fare / Seat (ZAR)</label>
                    <input
                      type="number"
                      value={price}
                      onChange={e => setPrice(Number(e.target.value))}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-purple-500"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:brightness-110 text-white font-black py-2.5 rounded-xl text-xs uppercase tracking-wider transition-all shadow-md active:scale-95"
                >
                  Publish Ride Offer
                </button>
              </form>
            )}

            {/* Active Rides Pool */}
            <div className="space-y-3">
              <span className="text-[10px] text-gray-400 uppercase font-black tracking-widest block">Available Event Carpools</span>
              {rides.map(ride => {
                const seatsLeft = ride.seatsTotal - ride.seatsBooked
                const isFull = seatsLeft <= 0
                return (
                  <div
                    key={ride.id}
                    className="p-4 rounded-2xl bg-white/[0.03] hover:bg-white/[0.05] border border-white/5 hover:border-purple-500/30 transition-all space-y-2.5"
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-black text-white">{ride.eventTitle}</span>
                          <span className="text-[9px] uppercase font-bold text-pink-400 bg-pink-500/10 px-2 py-0.5 rounded-full border border-pink-500/20">
                            On The Gruvs
                          </span>
                        </div>
                        <div className="flex items-center gap-1 text-[11px] text-gray-400 mt-0.5">
                          <MapPin size={11} className="text-purple-400" />
                          <span>Pickup: {ride.departureLocation}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-black text-purple-400">R {ride.costPerSeat}</span>
                        <span className="text-[9px] text-gray-500 block uppercase">/ seat</span>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-white/5 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-[11px] text-gray-400">
                        <Users size={12} className="text-purple-400" />
                        <span>Driver: <strong className="text-white">{ride.driverName}</strong> ({ride.vehicleType})</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${isFull ? 'bg-red-500/10 text-red-400 border-red-500/30' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'}`}>
                          {isFull ? 'Full' : `${seatsLeft} seats left`}
                        </span>
                        {!isFull && (
                          <button
                            onClick={() => handleBookSeat(ride.id)}
                            className="px-3 py-1 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-black text-[10px] uppercase tracking-wider transition-all active:scale-95 shadow-md"
                          >
                            {bookingSuccess === ride.id ? 'Seat Reserved!' : 'Claim Seat'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Footer */}
          <div className="mt-5 pt-3 border-t border-white/10 flex items-center justify-between text-[11px] text-gray-400 shrink-0">
            <span className="flex items-center gap-1">
              <Sparkles size={12} className="text-purple-400" /> Always confirm driver verification
            </span>
            <button
              onClick={() => { playTactileSound('pop'); onClose() }}
              className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs uppercase tracking-wider transition-all active:scale-95"
            >
              Done
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
