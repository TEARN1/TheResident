'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Home, Plus, X, Upload, Camera, AlertTriangle,
  CheckCircle2, ShieldCheck, Image as ImageIcon
} from 'lucide-react'
import { playTactileSound } from '../../../../utils/tactileSounds'

export interface RoomDetail {
  id: string
  roomNumber: string
  roomName: string
  priceZar: number
  status: 'available' | 'occupied' | 'maintenance'
  photos: string[]
  snagsAndIssues: string[]
  tenantReviews: {
    id: string
    tenantName: string
    date: string
    landlordRating: number
    maintenanceRating: number
    depositFairness: number
    comment: string
    verifiedTenant: boolean
  }[]
}

interface LandlordRoomManagerModalProps {
  isOpen: boolean
  onClose: () => void
  propertyName?: string
  propertyAddress?: string
  currentRooms?: RoomDetail[]
  onUpdateRooms?: (rooms: RoomDetail[]) => void
}

const DEFAULT_ROOMS: RoomDetail[] = [
  {
    id: 'rm-1',
    roomNumber: 'Room 1',
    roomName: 'Master Ensuite (Balcony Facing)',
    priceZar: 4200,
    status: 'occupied',
    photos: [
      'https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1598928506311-c55ded91a20c?auto=format&fit=crop&w=600&q=80'
    ],
    snagsAndIssues: [
      'Shower door rubber seal replaced in August 2026',
      'Wall plug near desk needs grounding check'
    ],
    tenantReviews: [
      {
        id: 'rev-1',
        tenantName: 'Naledi M.',
        date: 'Sept 2026',
        landlordRating: 5,
        maintenanceRating: 4,
        depositFairness: 5,
        comment: 'Landlord is respectful, gives 24h notice before visiting. Room has great sunlight and fast wifi.',
        verifiedTenant: true
      }
    ]
  },
  {
    id: 'rm-2',
    roomNumber: 'Room 2',
    roomName: 'Single Room (Quiet Courtyard)',
    priceZar: 3200,
    status: 'available',
    photos: [
      'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=600&q=80'
    ],
    snagsAndIssues: [
      'Fresh coat of white paint completed',
      'Window latch lubricated and working smoothly'
    ],
    tenantReviews: [
      {
        id: 'rev-2',
        tenantName: 'Kagiso T.',
        date: 'July 2026',
        landlordRating: 4,
        maintenanceRating: 5,
        depositFairness: 5,
        comment: 'Moved out because I graduated. Deposit was refunded in full within 5 business days without hassle.',
        verifiedTenant: true
      }
    ]
  }
]

export default function LandlordRoomManagerModal({
  isOpen,
  onClose,
  propertyName = 'Braamfontein Student & Resident House',
  propertyAddress = '44 De Korte St, Braamfontein',
  currentRooms,
  onUpdateRooms
}: LandlordRoomManagerModalProps) {
  const [rooms, setRooms] = useState<RoomDetail[]>(currentRooms || DEFAULT_ROOMS)
  const [selectedRoomId, setSelectedRoomId] = useState<string>(rooms[0]?.id || '')
  const [showAddRoomModal, setShowAddRoomModal] = useState(false)
  const [showAddReviewModal, setShowAddReviewModal] = useState(false)

  // New Room Form
  const [newRoomNumber, setNewRoomNumber] = useState('')
  const [newRoomName, setNewRoomName] = useState('')
  const [newRoomPrice, setNewRoomPrice] = useState(3500)
  const [newRoomStatus, setNewRoomStatus] = useState<'available' | 'occupied' | 'maintenance'>('available')
  const [uploadedPhotos, setUploadedPhotos] = useState<string[]>([])
  const [newSnagText, setNewSnagText] = useState('')

  // New Review Form
  const [reviewTenantName, setReviewTenantName] = useState('')
  const [reviewLandlordRating, setReviewLandlordRating] = useState(5)
  const [reviewMaintRating, setReviewMaintRating] = useState(5)
  const [reviewDepositFairness, setReviewDepositFairness] = useState(5)
  const [reviewComment, setReviewComment] = useState('')

  if (!isOpen) return null

  const activeRoom = rooms.find(r => r.id === selectedRoomId) || rooms[0]

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    Array.from(files).forEach(file => {
      const reader = new FileReader()
      reader.onload = ev => {
        if (ev.target?.result) {
          setUploadedPhotos(prev => [...prev, ev.target!.result as string])
        }
      }
      reader.readAsDataURL(file)
    })
  }

  const handleCreateRoom = (e: React.FormEvent) => {
    e.preventDefault()
    playTactileSound('success')
    const newRoom: RoomDetail = {
      id: `rm-${Date.now()}`,
      roomNumber: newRoomNumber || `Room ${rooms.length + 1}`,
      roomName: newRoomName || 'Standard Bedroom',
      priceZar: newRoomPrice,
      status: newRoomStatus,
      photos: uploadedPhotos.length > 0 ? uploadedPhotos : [
        'https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?auto=format&fit=crop&w=600&q=80'
      ],
      snagsAndIssues: newSnagText ? [newSnagText] : [],
      tenantReviews: []
    }
    const updated = [...rooms, newRoom]
    setRooms(updated)
    if (onUpdateRooms) onUpdateRooms(updated)
    setSelectedRoomId(newRoom.id)
    setShowAddRoomModal(false)
    setNewRoomNumber('')
    setNewRoomName('')
    setUploadedPhotos([])
    setNewSnagText('')
  }

  const handleAddReview = (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeRoom) return
    playTactileSound('success')
    const review = {
      id: `rev-${Date.now()}`,
      tenantName: reviewTenantName || 'Resident Tenant',
      date: 'Just now',
      landlordRating: reviewLandlordRating,
      maintenanceRating: reviewMaintRating,
      depositFairness: reviewDepositFairness,
      comment: reviewComment,
      verifiedTenant: true
    }
    const updated = rooms.map(r => {
      if (r.id === activeRoom.id) {
        return { ...r, tenantReviews: [review, ...r.tenantReviews] }
      }
      return r
    })
    setRooms(updated)
    if (onUpdateRooms) onUpdateRooms(updated)
    setShowAddReviewModal(false)
    setReviewComment('')
    setReviewTenantName('')
  }

  const handleAddSnagToActiveRoom = (text: string) => {
    if (!activeRoom || !text.trim()) return
    playTactileSound('pop')
    const updated = rooms.map(r => {
      if (r.id === activeRoom.id) {
        return { ...r, snagsAndIssues: [...r.snagsAndIssues, text.trim()] }
      }
      return r
    })
    setRooms(updated)
    if (onUpdateRooms) onUpdateRooms(updated)
  }

  const handleUpdateStatus = (roomId: string, status: 'available' | 'occupied' | 'maintenance') => {
    playTactileSound('click')
    const updated = rooms.map(r => r.id === roomId ? { ...r, status } : r)
    setRooms(updated)
    if (onUpdateRooms) onUpdateRooms(updated)
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[220] flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-4xl bg-[var(--card-bg,rgba(11,43,38,0.95))] border border-[var(--glass-border,rgba(142,182,155,0.3))] rounded-3xl p-5 sm:p-7 shadow-2xl backdrop-blur-2xl flex flex-col max-h-[90vh] overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-white/10 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gold-primary/20 text-gold-primary border border-gold-primary/30 flex items-center justify-center shadow-glow">
                <Home size={20} />
              </div>
              <div>
                <h3 className="text-base font-black text-white uppercase tracking-tight flex items-center gap-2">
                  {propertyName}
                </h3>
                <p className="text-xs text-gray-400">{propertyAddress} • Multi-Room Suite</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowAddRoomModal(true)}
                className="px-3.5 py-1.5 rounded-xl bg-gold-primary hover:bg-gold-secondary text-black font-black text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-glow transition-all active:scale-95"
              >
                <Plus size={14} />
                <span>Add Room</span>
              </button>
              <button
                onClick={onClose}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white"
                aria-label="Close dialog"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Main Stage: Room Sidebar + Room Workspace */}
          <div className="flex-1 flex flex-col md:flex-row gap-5 pt-4 overflow-hidden">
            {/* Left Column: Room Tabs List */}
            <div className="w-full md:w-64 space-y-2 overflow-y-auto shrink-0 pr-1 custom-scrollbar">
              <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 block px-1">
                Property Rooms ({rooms.length})
              </span>
              {rooms.map(room => {
                const isSelected = room.id === selectedRoomId
                return (
                  <button
                    key={room.id}
                    onClick={() => {
                      playTactileSound('tab')
                      setSelectedRoomId(room.id)
                    }}
                    className={`w-full p-3 rounded-2xl text-left transition-all border flex items-center justify-between ${
                      isSelected
                        ? 'bg-gold-primary text-black border-gold-primary shadow-glow font-bold'
                        : 'bg-black/40 text-gray-300 border-white/10 hover:border-gold-primary/30 hover:bg-white/5'
                    }`}
                  >
                    <div className="min-w-0 pr-2">
                      <p className="text-xs font-black truncate">{room.roomNumber}</p>
                      <p className={`text-[10px] truncate ${isSelected ? 'text-black/80' : 'text-gray-400'}`}>
                        {room.roomName}
                      </p>
                    </div>
                    <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md ${
                      room.status === 'available'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : room.status === 'occupied'
                        ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                        : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    }`}>
                      {room.status}
                    </span>
                  </button>
                )
              })}
            </div>

            {/* Right Column: Active Room Workspace */}
            {activeRoom && (
              <div className="flex-1 overflow-y-auto space-y-5 pr-1 custom-scrollbar">
                {/* Room Top Card */}
                <div className="bg-black/50 border border-white/10 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="text-lg font-black text-white">{activeRoom.roomNumber}: {activeRoom.roomName}</h4>
                    </div>
                    <p className="text-sm font-black text-gold-primary font-mono">
                      R{activeRoom.priceZar.toLocaleString()} <span className="text-xs text-gray-400 font-normal">/ month</span>
                    </p>
                  </div>

                  {/* Status Switcher */}
                  <div className="flex items-center gap-1.5 bg-black/60 p-1.5 rounded-2xl border border-white/10">
                    {(['available', 'occupied', 'maintenance'] as const).map(st => (
                      <button
                        key={st}
                        onClick={() => handleUpdateStatus(activeRoom.id, st)}
                        className={`px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider capitalize transition-all ${
                          activeRoom.status === st
                            ? 'bg-white/20 text-white font-bold shadow-sm'
                            : 'text-gray-400 hover:text-white'
                        }`}
                      >
                        {st}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 1. Room Photo Gallery */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-wider text-white flex items-center gap-1.5">
                      <ImageIcon size={14} className="text-gold-primary" /> Room Pictures & Condition
                    </span>
                    <label className="cursor-pointer text-[10px] font-black uppercase tracking-wider text-gold-primary hover:underline flex items-center gap-1">
                      <Upload size={12} /> Add Photos
                      <input type="file" multiple accept="image/*" onChange={handlePhotoUpload} className="hidden" />
                    </label>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {activeRoom.photos.map((photo, i) => (
                      <div key={i} className="relative aspect-video rounded-2xl overflow-hidden border border-white/15 bg-black group shadow-sm">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={photo} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                        <span className="absolute bottom-1.5 left-2 bg-black/70 px-2 py-0.5 rounded text-[9px] text-white font-bold">
                          {i === 0 ? 'Primary Photo' : `Angle ${i + 1}`}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 2. Room Problems, Snag & Repair Log */}
                <div className="space-y-2">
                  <span className="text-xs font-black uppercase tracking-wider text-white flex items-center gap-1.5">
                    <AlertTriangle size={14} className="text-amber-400" /> Room Problems & Snag List
                  </span>

                  <div className="bg-black/40 border border-white/10 rounded-2xl p-4 space-y-2.5">
                    {activeRoom.snagsAndIssues.length === 0 ? (
                      <p className="text-xs text-gray-500 italic">No open snags or problems reported for this room.</p>
                    ) : (
                      activeRoom.snagsAndIssues.map((snag, idx) => (
                        <div key={idx} className="flex items-start gap-2 text-xs text-gray-300">
                          <CheckCircle2 size={13} className="text-emerald-400 mt-0.5 shrink-0" />
                          <span>{snag}</span>
                        </div>
                      ))
                    )}

                    <div className="flex gap-2 pt-1 border-t border-white/10">
                      <input
                        type="text"
                        placeholder="Log new snag or repair (e.g. leaking faucet, paint touch-up)..."
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            handleAddSnagToActiveRoom((e.target as HTMLInputElement).value)
                            ;(e.target as HTMLInputElement).value = ''
                          }
                        }}
                        className="flex-1 bg-black/60 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white outline-none focus:border-gold-primary"
                      />
                    </div>
                  </div>
                </div>

                {/* 3. Verified Tenant Reviews & Landlord Accountability */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-wider text-white flex items-center gap-1.5">
                      <ShieldCheck size={14} className="text-emerald-400" /> Tenant Reviews & Landlord Feedback
                    </span>
                    <button
                      onClick={() => setShowAddReviewModal(true)}
                      className="text-[10px] font-black uppercase tracking-wider text-emerald-400 hover:underline flex items-center gap-1"
                    >
                      <Plus size={12} /> Add Tenant Review
                    </button>
                  </div>

                  <div className="space-y-2.5">
                    {activeRoom.tenantReviews.length === 0 ? (
                      <div className="bg-black/30 border border-white/10 rounded-2xl p-4 text-center text-xs text-gray-500">
                        No reviews yet for this room. Current and past tenants can leave feedback on landlord behavior and room comfort.
                      </div>
                    ) : (
                      activeRoom.tenantReviews.map(rev => (
                        <div key={rev.id} className="bg-black/40 border border-white/10 rounded-2xl p-4 space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-white">{rev.tenantName}</span>
                              {rev.verifiedTenant && (
                                <span className="text-[9px] font-black uppercase bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/30">
                                  Verified Tenant
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-gray-500">{rev.date}</span>
                          </div>

                          <div className="flex flex-wrap gap-3 text-[10px] text-gray-400">
                            <span className="flex items-center gap-1">
                              Landlord Behavior: <strong className="text-gold-primary">{rev.landlordRating}/5 ★</strong>
                            </span>
                            <span className="flex items-center gap-1">
                              Repairs Speed: <strong className="text-gold-primary">{rev.maintenanceRating}/5 ★</strong>
                            </span>
                            <span className="flex items-center gap-1">
                              Deposit Return: <strong className="text-gold-primary">{rev.depositFairness}/5 ★</strong>
                            </span>
                          </div>

                          <p className="text-xs text-gray-300 leading-relaxed bg-white/[0.02] p-2.5 rounded-xl border border-white/5">
                            &ldquo;{rev.comment}&rdquo;
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Add New Room Form Modal */}
      {showAddRoomModal && (
        <div className="fixed inset-0 z-[260] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md bg-[var(--card-bg,rgba(11,43,38,0.95))] border border-[var(--glass-border,rgba(142,182,155,0.3))] rounded-3xl p-6 shadow-2xl space-y-4"
          >
            <div className="flex justify-between items-center pb-2 border-b border-white/10">
              <h4 className="text-sm font-black text-white uppercase tracking-tight">Add New Room to Property</h4>
              <button onClick={() => setShowAddRoomModal(false)} className="text-gray-400 hover:text-white">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateRoom} className="space-y-3">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-gray-300">Room Number / Identifier</label>
                <input
                  type="text"
                  required
                  value={newRoomNumber}
                  onChange={e => setNewRoomNumber(e.target.value)}
                  placeholder="e.g. Room 3, Cottage B, Studio 1"
                  className="w-full bg-black/60 border border-white/15 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-gold-primary"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-gray-300">Room Label / Description</label>
                <input
                  type="text"
                  required
                  value={newRoomName}
                  onChange={e => setNewRoomName(e.target.value)}
                  placeholder="e.g. Sunny Balcony Ensuite"
                  className="w-full bg-black/60 border border-white/15 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-gold-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-gray-300">Monthly Rent (ZAR)</label>
                  <input
                    type="number"
                    required
                    value={newRoomPrice}
                    onChange={e => setNewRoomPrice(Number(e.target.value))}
                    className="w-full bg-black/60 border border-white/15 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-gold-primary font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-gray-300">Initial Status</label>
                  <select
                    value={newRoomStatus}
                    onChange={e => setNewRoomStatus(e.target.value as 'available' | 'occupied' | 'maintenance')}
                    className="w-full bg-black/60 border border-white/15 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-gold-primary"
                  >
                    <option value="available" className="bg-black">Available</option>
                    <option value="occupied" className="bg-black">Occupied</option>
                    <option value="maintenance" className="bg-black">Maintenance</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-gray-300">Upload Room Photos</label>
                <label className="cursor-pointer w-full py-2.5 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 flex items-center justify-center gap-2 text-xs text-gray-300">
                  <Camera size={14} className="text-gold-primary" />
                  <span>{uploadedPhotos.length > 0 ? `${uploadedPhotos.length} photo(s) selected` : 'Select Photos'}</span>
                  <input type="file" multiple accept="image/*" onChange={handlePhotoUpload} className="hidden" />
                </label>
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-2xl bg-gold-primary text-black font-black text-xs uppercase tracking-wider shadow-glow active:scale-95 transition-all mt-2"
              >
                Save & Add Room
              </button>
            </form>
          </motion.div>
        </div>
      )}

      {/* Add Tenant Review Modal */}
      {showAddReviewModal && (
        <div className="fixed inset-0 z-[260] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md bg-[var(--card-bg,rgba(11,43,38,0.95))] border border-[var(--glass-border,rgba(142,182,155,0.3))] rounded-3xl p-6 shadow-2xl space-y-4"
          >
            <div className="flex justify-between items-center pb-2 border-b border-white/10">
              <h4 className="text-sm font-black text-white uppercase tracking-tight">Review Landlord & Room</h4>
              <button onClick={() => setShowAddReviewModal(false)} className="text-gray-400 hover:text-white">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleAddReview} className="space-y-3">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-gray-300">Your Name (or alias)</label>
                <input
                  type="text"
                  required
                  value={reviewTenantName}
                  onChange={e => setReviewTenantName(e.target.value)}
                  placeholder="e.g. Sipho M."
                  className="w-full bg-black/60 border border-white/15 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-emerald-400"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase text-gray-300">Landlord Behavior</label>
                  <select
                    value={reviewLandlordRating}
                    onChange={e => setReviewLandlordRating(Number(e.target.value))}
                    className="w-full bg-black/60 border border-white/15 rounded-xl p-2 text-xs text-white"
                  >
                    {[5, 4, 3, 2, 1].map(n => <option key={n} value={n} className="bg-black">{n} Stars</option>)}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase text-gray-300">Repairs Speed</label>
                  <select
                    value={reviewMaintRating}
                    onChange={e => setReviewMaintRating(Number(e.target.value))}
                    className="w-full bg-black/60 border border-white/15 rounded-xl p-2 text-xs text-white"
                  >
                    {[5, 4, 3, 2, 1].map(n => <option key={n} value={n} className="bg-black">{n} Stars</option>)}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase text-gray-300">Deposit Fairness</label>
                  <select
                    value={reviewDepositFairness}
                    onChange={e => setReviewDepositFairness(Number(e.target.value))}
                    className="w-full bg-black/60 border border-white/15 rounded-xl p-2 text-xs text-white"
                  >
                    {[5, 4, 3, 2, 1].map(n => <option key={n} value={n} className="bg-black">{n} Stars</option>)}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-gray-300">Review & Experience</label>
                <textarea
                  required
                  rows={3}
                  value={reviewComment}
                  onChange={e => setReviewComment(e.target.value)}
                  placeholder="Share details about the landlord's responsiveness, deposit return, and room liveability..."
                  className="w-full bg-black/60 border border-white/15 rounded-xl p-3 text-xs text-white outline-none focus:border-emerald-400 resize-none"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs uppercase tracking-wider shadow-glow active:scale-95 transition-all mt-2"
              >
                Submit Verified Review
              </button>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
