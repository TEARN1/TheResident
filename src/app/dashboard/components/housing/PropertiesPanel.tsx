'use client'

/**
 * PropertiesPanel — a landlord's "My Properties" view sitting above their
 * room listings. res_properties is the new layer that lets a landlord say
 * "I have 5 rooms in this house"; occupancy is always derived live from
 * res_listings.status via the res_property_occupancy RPC, never typed in.
 */
import React, { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, X, MapPin, ShieldCheck, ShieldAlert, ShieldQuestion, Upload, AlertTriangle, Home, Info, Trash2 } from 'lucide-react'
import { supabase } from '../../../../utils/supabase'
import type { GeocodeResult } from '../../../../utils/geocode'
import MapSearchBox from '../map/MapSearchBox'
import RoomInventoryPanel from './RoomInventoryPanel'
import type { Listing } from '../../../../store'

export interface ResProperty {
  id: string
  landlord_id: string
  address: string
  suburb: string
  city: string
  lat: number | null
  lon: number | null
  total_rooms: number
  doc_review_status: 'none' | 'pending' | 'reviewed'
  doc_review_note: string | null
  verification_doc_url: string | null
  address_geocode_mismatch: boolean
  created_at: string
  updated_at: string
}

interface Occupancy {
  total_rooms: number
  occupied_rooms: number
  listed_rooms: number
}

interface Props {
  properties: ResProperty[]
  listings: Listing[]
  currentUserId: string
  onRefresh: () => void
  onNotify: (msg: string) => void
}

export default function PropertiesPanel({ properties, listings, currentUserId, onRefresh, onNotify }: Props) {
  const [occupancyByProperty, setOccupancyByProperty] = useState<Record<string, Occupancy>>({})

  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newAddress, setNewAddress] = useState('')
  const [newSuburb, setNewSuburb] = useState('')
  const [newCity, setNewCity] = useState('')
  const [newLat, setNewLat] = useState<number | null>(null)
  const [newLon, setNewLon] = useState<number | null>(null)
  const [newTotalRooms, setNewTotalRooms] = useState<number>(2)

  const [verifyingFor, setVerifyingFor] = useState<ResProperty | null>(null)
  const [docUrl, setDocUrl] = useState('')
  const [uploading, setUploading] = useState(false)
  const [mismatchChecking, setMismatchChecking] = useState(false)
  const [mismatch, setMismatch] = useState(false)
  const [submittingVerification, setSubmittingVerification] = useState(false)
  const [verifyInfoOpenId, setVerifyInfoOpenId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const loadOccupancy = useCallback(async () => {
    if (!supabase || properties.length === 0) return
    const client = supabase
    const entries = await Promise.all(properties.map(async p => {
      const { data } = await client.rpc('res_property_occupancy', { p_property: p.id })
      return [p.id, data as Occupancy] as const
    }))
    const map: Record<string, Occupancy> = {}
    entries.forEach(([id, occ]) => { if (occ) map[id] = occ })
    setOccupancyByProperty(map)
  }, [properties])

  useEffect(() => { loadOccupancy() }, [loadOccupancy])

  const handleSelectPlace = (result: GeocodeResult) => {
    setNewLat(result.lat)
    setNewLon(result.lon)
    if (!newAddress) setNewAddress(result.label)
  }

  const handleCreateProperty = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!supabase) return
    setCreating(true)
    try {
      const { error } = await supabase.rpc('res_create_property', {
        p_address: newAddress,
        p_suburb: newSuburb,
        p_city: newCity,
        p_lat: newLat,
        p_lon: newLon,
        p_total_rooms: newTotalRooms
      })
      if (error) throw error
      onNotify('Property created — you can now add rooms to it.')
      setShowCreate(false)
      setNewAddress(''); setNewSuburb(''); setNewCity(''); setNewLat(null); setNewLon(null); setNewTotalRooms(2)
      onRefresh()
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Could not create property.')
    } finally {
      setCreating(false)
    }
  }

  const openVerify = (p: ResProperty) => {
    setVerifyingFor(p)
    setDocUrl(p.verification_doc_url || '')
    setMismatch(false)
  }

  // Loose reverse-geocode heuristic: does Nominatim's suburb/city for this pin
  // show up (case-insensitive substring) in what the landlord typed? Good
  // enough to flag "worth a human glance", not a precision address matcher.
  const checkMismatch = useCallback(async (p: ResProperty) => {
    if (p.lat == null || p.lon == null) return
    setMismatchChecking(true)
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${p.lat}&lon=${p.lon}`
      const res = await fetch(url, { headers: { Accept: 'application/json' } })
      if (!res.ok) return
      const data = await res.json()
      const addr = data?.address || {}
      const candidates: string[] = [addr.suburb, addr.city, addr.town, addr.village, addr.county].filter(Boolean)
      const typed = `${p.address} ${p.suburb} ${p.city}`.toLowerCase()
      const anyMatch = candidates.some(c => typed.includes(String(c).toLowerCase()))
      setMismatch(candidates.length > 0 && !anyMatch)
    } catch {
      // Network hiccup — don't block the landlord over it, just skip the flag.
    } finally {
      setMismatchChecking(false)
    }
  }, [])

  useEffect(() => {
    if (verifyingFor) {
      const t = setTimeout(() => checkMismatch(verifyingFor), 400)
      return () => clearTimeout(t)
    }
  }, [verifyingFor, checkMismatch])

  // The accept attr on the file input allows image/*,application/pdf — this
  // was the one uploader in the app with no size/type check at all before an
  // upload was attempted.
  const MAX_DOC_BYTES = 10 * 1024 * 1024
  const handleUploadDoc = async (file: File) => {
    if (!supabase || !verifyingFor) return
    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
      onNotify('Please upload an image or a PDF.')
      return
    }
    if (file.size > MAX_DOC_BYTES) {
      onNotify('That file is over 10MB — please upload a smaller copy.')
      return
    }
    setUploading(true)
    try {
      const path = `${currentUserId}/${verifyingFor.id}-${Date.now()}-${file.name}`
      const { error: uploadError } = await supabase.storage.from('gossip-media').upload(path, file)
      if (uploadError) throw uploadError
      const { data } = supabase.storage.from('gossip-media').getPublicUrl(path)
      setDocUrl(data.publicUrl)
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Upload failed.')
    } finally {
      setUploading(false)
    }
  }

  const submitVerification = async () => {
    if (!supabase || !verifyingFor || !docUrl) return
    setSubmittingVerification(true)
    try {
      const { error } = await supabase.rpc('res_submit_property_verification', {
        p_property: verifyingFor.id,
        p_doc_url: docUrl,
        p_geocode_mismatch: mismatch
      })
      if (error) throw error
      onNotify('Verification submitted for review.')
      setVerifyingFor(null)
      onRefresh()
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Could not submit verification.')
    } finally {
      setSubmittingVerification(false)
    }
  }

  // Two-tap confirm: the first click arms it, the second (within the same
  // render, on the same property) actually deletes — no modal needed for a
  // destructive action this scoped, but no accidental single-click delete
  // either.
  const handleDeleteProperty = async (p: ResProperty) => {
    if (confirmDeleteId !== p.id) {
      setConfirmDeleteId(p.id)
      return
    }
    if (!supabase) return
    setDeleting(true)
    try {
      const { error } = await supabase.rpc('res_delete_property', { p_property: p.id })
      if (error) throw error
      onNotify('Property and everything under it deleted.')
      setConfirmDeleteId(null)
      onRefresh()
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Could not delete property.')
    } finally {
      setDeleting(false)
    }
  }

  const badgeFor = (status: ResProperty['doc_review_status']) => {
    if (status === 'reviewed') {
      return (
        <span className="flex items-center gap-1.5 bg-gold-primary/10 border border-gold-primary/30 text-gold-primary px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest">
          <ShieldCheck size={12} /> Verified
        </span>
      )
    }
    if (status === 'pending') {
      return (
        <span className="flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/30 text-amber-400 px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest">
          <ShieldQuestion size={12} /> Under Review
        </span>
      )
    }
    return (
      <span className="flex items-center gap-1.5 bg-white/5 border border-white/10 text-gray-500 px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest">
        <ShieldAlert size={12} /> Unverified
      </span>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div className="space-y-1">
          <h2 className="text-xl font-black text-white uppercase tracking-tighter italic">My <span className="text-gold-primary">Properties</span></h2>
          <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest opacity-60">Group rooms under one address, track real occupancy</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="bg-gold-primary hover:bg-gold-secondary text-black font-black px-6 py-3 rounded-2xl flex items-center gap-2 transition-all active:scale-95 shadow-xl shadow-gold-primary/10 uppercase tracking-widest text-xs"
        >
          <Plus size={16} /> New Property
        </button>
      </div>

      {properties.length === 0 ? (
        <div className="glass-panel p-10 text-center bg-black/40 space-y-3">
          <Home size={32} className="mx-auto text-gray-700" />
          <p className="text-sm text-gray-500 font-bold">You haven&apos;t added a property yet.</p>
          <p className="text-[10px] text-gray-600 uppercase tracking-widest font-black">Create one to start grouping rooms by address</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {properties.map(p => {
            const occ = occupancyByProperty[p.id]
            const totalRooms = occ?.total_rooms ?? p.total_rooms
            const occupied = occ?.occupied_rooms ?? 0
            const pct = totalRooms > 0 ? Math.min(100, Math.round((occupied / totalRooms) * 100)) : 0
            const rooms = listings
              .filter(l => l.propertyId === p.id)
              .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''))

            return (
              <motion.div key={p.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass-panel p-6 bg-black/40 space-y-5">
                <div className="flex justify-between items-start gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-white font-black text-sm">
                      <MapPin size={14} className="text-gold-primary shrink-0" /> {p.address}
                    </div>
                    <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest">{p.suburb}, {p.city}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {badgeFor(p.doc_review_status)}
                    <button
                      onClick={() => setVerifyInfoOpenId(v => v === p.id ? null : p.id)}
                      title="What does this badge mean?"
                      aria-label="What does this verification badge mean?"
                      className="text-gray-600 hover:text-gray-300 transition-colors"
                    >
                      <Info size={14} />
                    </button>
                  </div>
                </div>

                {verifyInfoOpenId === p.id && (
                  <p className="text-[10px] text-gray-500 bg-white/5 border border-white/10 rounded-lg p-3 leading-relaxed">
                    <strong className="text-gray-300">Unverified</strong> means nobody has checked this address yet — anyone can list a property. <strong className="text-gray-300">Under review</strong> means a proof document (lease, utility bill, or title deed) was submitted and is waiting to be checked. <strong className="text-gold-primary">Verified</strong> means that document was reviewed and the address matched. It&apos;s a check on the landlord&apos;s claim to the address, not a guarantee about the room itself.
                  </p>
                )}

                <div className="space-y-2">
                  <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-gray-500">
                    <span>{occupied} of {totalRooms} rooms occupied</span>
                    <span className="text-gold-primary">{occ?.listed_rooms ?? rooms.length} listed</span>
                  </div>
                  <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden border border-white/5">
                    <div className="h-full bg-gold-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>

                {rooms.length > 0 && (
                  <div className="space-y-1.5 pt-2 border-t border-white/5">
                    {rooms.map((r, i) => (
                      <div key={r.id} className="flex justify-between items-center text-xs">
                        <span className="text-gray-300 font-bold truncate">{r.title}</span>
                        <span className="text-[9px] text-gray-600 font-black uppercase tracking-widest shrink-0 ml-2">Room {i + 1} of {totalRooms}</span>
                      </div>
                    ))}
                  </div>
                )}

                <RoomInventoryPanel
                  propertyId={p.id}
                  currentUserId={currentUserId}
                  onNotify={onNotify}
                  onAdvertised={onRefresh}
                />

                {p.doc_review_status === 'none' && (
                  <button
                    onClick={() => openVerify(p)}
                    className="w-full bg-white/5 hover:bg-gold-primary/10 border border-white/10 hover:border-gold-primary/30 text-gray-300 hover:text-gold-primary font-black py-3 rounded-xl transition-all text-[10px] uppercase tracking-widest"
                  >
                    Verify This Address
                  </button>
                )}
                {p.doc_review_status === 'pending' && p.doc_review_note && (
                  <p className="text-[10px] text-amber-400/80">{p.doc_review_note}</p>
                )}

                <button
                  onClick={() => handleDeleteProperty(p)}
                  disabled={deleting && confirmDeleteId === p.id}
                  className={`w-full flex items-center justify-center gap-2 font-black py-3 rounded-xl transition-all text-[10px] uppercase tracking-widest border ${
                    confirmDeleteId === p.id
                      ? 'bg-red-500/20 border-red-500/40 text-red-300'
                      : 'bg-white/5 border-white/10 text-gray-500 hover:text-red-400 hover:border-red-500/30'
                  } disabled:opacity-50`}
                >
                  <Trash2 size={12} />
                  {confirmDeleteId === p.id
                    ? (deleting ? 'Deleting…' : 'Tap again to permanently delete')
                    : 'Delete property'}
                </button>
              </motion.div>
            )
          })}
        </div>
      )}

      {/* CREATE PROPERTY MODAL */}
      <AnimatePresence>
        {showCreate && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowCreate(false)} className="absolute inset-0 bg-black/90 backdrop-blur-md" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="glass-panel w-full max-w-2xl bg-black border-gold-primary/20 shadow-2xl relative z-10 overflow-hidden">
              <div className="bg-gold-primary/5 p-6 border-b border-white/5 flex justify-between items-center">
                <h3 className="text-xl font-black text-white italic uppercase tracking-tighter">New <span className="text-gold-primary">Property</span></h3>
                <button onClick={() => setShowCreate(false)} className="p-2 text-gray-500 hover:text-white transition-colors"><X /></button>
              </div>
              <form onSubmit={handleCreateProperty} className="p-6 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
                <div className="space-y-2">
                  <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Search Address (drops the pin)</label>
                  <MapSearchBox onSelect={handleSelectPlace} />
                  {newLat != null && newLon != null && (
                    <p className="text-[10px] text-gold-primary font-bold">Pinned at {newLat.toFixed(5)}, {newLon.toFixed(5)}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Street Address</label>
                  <input value={newAddress} onChange={e => setNewAddress(e.target.value)} required className="w-full bg-black border border-white/10 rounded-xl p-3 text-sm text-white outline-none focus:border-gold-primary/40" placeholder="e.g. 12 Vine Street" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Suburb</label>
                    <input value={newSuburb} onChange={e => setNewSuburb(e.target.value)} required className="w-full bg-black border border-white/10 rounded-xl p-3 text-sm text-white outline-none focus:border-gold-primary/40" placeholder="e.g. Kreuzberg" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest">City</label>
                    <input value={newCity} onChange={e => setNewCity(e.target.value)} required className="w-full bg-black border border-white/10 rounded-xl p-3 text-sm text-white outline-none focus:border-gold-primary/40" placeholder="e.g. Berlin" />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Total Rooms</label>
                    <input type="number" min={1} max={50} value={newTotalRooms} onChange={e => setNewTotalRooms(Number(e.target.value))} required className="w-full bg-black border border-white/10 rounded-xl p-3 text-sm text-white outline-none focus:border-gold-primary/40" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Lat / Lon (fallback if search fails)</label>
                    <div className="flex gap-2">
                      <input type="number" step="any" value={newLat ?? ''} onChange={e => setNewLat(e.target.value ? Number(e.target.value) : null)} className="w-full bg-black border border-white/10 rounded-xl p-3 text-sm text-white outline-none focus:border-gold-primary/40" placeholder="Lat" />
                      <input type="number" step="any" value={newLon ?? ''} onChange={e => setNewLon(e.target.value ? Number(e.target.value) : null)} className="w-full bg-black border border-white/10 rounded-xl p-3 text-sm text-white outline-none focus:border-gold-primary/40" placeholder="Lon" />
                    </div>
                  </div>
                </div>
                <div className="pt-4 border-t border-white/5 flex gap-4">
                  <button type="button" onClick={() => setShowCreate(false)} className="flex-1 bg-white/5 text-white font-black py-4 rounded-2xl uppercase tracking-widest text-xs">Cancel</button>
                  <button type="submit" disabled={creating} className="flex-1 bg-gold-primary text-black font-black py-4 rounded-2xl uppercase tracking-widest text-xs shadow-xl shadow-gold-primary/20 disabled:opacity-50">
                    {creating ? 'Creating...' : 'Create Property'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* VERIFY ADDRESS MODAL */}
      <AnimatePresence>
        {verifyingFor && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setVerifyingFor(null)} className="absolute inset-0 bg-black/90 backdrop-blur-md" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="glass-panel w-full max-w-xl bg-black border-gold-primary/20 shadow-2xl relative z-10 p-8 space-y-6">
              <div className="flex justify-between items-center">
                <div className="space-y-1">
                  <h3 className="text-xl font-black text-white italic uppercase tracking-tighter">Verify <span className="text-gold-primary">Address</span></h3>
                  <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest">{verifyingFor.address}</p>
                </div>
                <button onClick={() => setVerifyingFor(null)} className="text-gray-500 hover:text-white"><X /></button>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Proof Document URL</label>
                <input value={docUrl} onChange={e => setDocUrl(e.target.value)} required className="w-full bg-black border border-white/10 rounded-xl p-3 text-sm text-white outline-none focus:border-gold-primary/40" placeholder="https://... (lease, utility bill, title deed)" />
                <label className="flex items-center gap-2 text-[10px] text-gray-500 font-black uppercase tracking-widest cursor-pointer hover:text-gold-primary transition-colors w-fit">
                  <Upload size={12} />
                  {uploading ? 'Uploading...' : 'Or upload a file'}
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleUploadDoc(f) }}
                  />
                </label>
              </div>

              {mismatchChecking && (
                <p className="text-[10px] text-gray-500">Checking the pinned location against your typed address...</p>
              )}
              {!mismatchChecking && mismatch && (
                <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-amber-400 text-xs">
                  <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                  Heads up: the address you typed doesn&apos;t quite match the pinned location — this will flag your submission for extra review.
                </div>
              )}

              <button
                onClick={submitVerification}
                disabled={!docUrl || submittingVerification}
                className="w-full bg-gold-primary hover:bg-gold-secondary text-black font-black py-4 rounded-2xl uppercase tracking-widest text-xs shadow-xl disabled:opacity-50"
              >
                {submittingVerification ? 'Submitting...' : 'Submit for Review'}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
