'use client'

import React, { useEffect, useState } from 'react'
import { Plus, X, Camera, UserPlus, LogOut, Megaphone, Lock, Users2, ChevronDown, ChevronUp } from 'lucide-react'
import { supabase } from '../../../../utils/supabase'
import {
  // setOccupantVisibility is deliberately not called from here — it's
  // self-service only (res_set_occupant_visibility checks auth.uid() =
  // tenant_id), and this pass doesn't yet link an occupant to a real profile
  // for them to act as. It's exported from roomInventory.ts for whenever an
  // occupant-facing "my tenancy" screen picks it up.
  fetchRooms, fetchOccupants, createRoom, addRoomOccupant, endRoomOccupancy,
  advertiseRoom,
  sortRoomsForLandlord, isCurrentOccupant, occupantDisplayName, MAX_ROOM_PHOTOS,
  type Room, type RoomOccupant
} from '../../../../utils/roomInventory'
import { getErrorMessage } from '../../../../utils/errors'
import { cleanScriptTags } from '../../../../utils/security'
import { goldButtonClass } from '../../../../components/ui/GoldButton'

// Same validation MarketTab applies to its own image uploads — this file
// previously had none at all on its document upload.
const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const clean = (text: string) => cleanScriptTags(text).trim()

interface Props {
  propertyId: string
  currentUserId: string
  onNotify: (msg: string) => void
  onAdvertised: () => void
}

/**
 * A landlord's private room-by-room record for one property: photos,
 * pros/cons, why it costs what it does, and who lives there. Nothing here is
 * a public listing — res_rooms is private to the landlord by RLS — until
 * "Advertise" is pressed, which publishes via res_advertise_room into the
 * normal res_listings flow.
 *
 * Occupant visibility to housemates is set by the occupant themselves
 * (res_set_occupant_visibility only accepts auth.uid() = tenant_id) — this
 * panel can show that state but can never change it for someone else.
 */
export default function RoomInventoryPanel({ propertyId, currentUserId, onNotify, onAdvertised }: Props) {
  const [rooms, setRooms] = useState<Room[]>([])
  const [occupants, setOccupants] = useState<Record<string, RoomOccupant[]>>({})
  const [loaded, setLoaded] = useState(false)
  const [expanded, setExpanded] = useState(false)

  const [showAdd, setShowAdd] = useState(false)
  const [label, setLabel] = useState('')
  const [price, setPrice] = useState('')
  const [advantages, setAdvantages] = useState('')
  const [disadvantages, setDisadvantages] = useState('')
  const [priceNote, setPriceNote] = useState('')
  const [photos, setPhotos] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)

  const [occupantFormFor, setOccupantFormFor] = useState<string | null>(null)
  const [occupantName, setOccupantName] = useState('')
  const [occupantRent, setOccupantRent] = useState('')
  const [busyRoomId, setBusyRoomId] = useState<string | null>(null)

  const load = async () => {
    const roomRows = await fetchRooms(propertyId)
    setRooms(roomRows)
    const occRows = await fetchOccupants(roomRows.map(r => r.id))
    const byRoom: Record<string, RoomOccupant[]> = {}
    for (const o of occRows) byRoom[o.roomId] = [...(byRoom[o.roomId] || []), o]
    setOccupants(byRoom)
    setLoaded(true)
  }

  useEffect(() => {
    if (expanded && !loaded) load().catch(err => onNotify(getErrorMessage(err)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded])

  const handlePhotoSelect = async (files: FileList | null) => {
    if (!supabase || !files || files.length === 0) return
    const incoming = Array.from(files)
    if (photos.length + incoming.length > MAX_ROOM_PHOTOS) {
      onNotify(`Up to ${MAX_ROOM_PHOTOS} photos per room.`)
      return
    }
    setUploading(true)
    try {
      const uploaded: string[] = []
      for (const file of incoming) {
        if (!file.type.startsWith('image/')) { onNotify(`${file.name} isn't an image.`); continue }
        if (file.size > MAX_IMAGE_BYTES) { onNotify(`${file.name} is over 5MB.`); continue }
        const path = `${currentUserId}/room-${propertyId}-${Date.now()}-${file.name}`
        const { error } = await supabase.storage.from('gossip-media').upload(path, file)
        if (error) { onNotify(error.message); continue }
        const { data } = supabase.storage.from('gossip-media').getPublicUrl(path)
        uploaded.push(data.publicUrl)
      }
      setPhotos(p => [...p, ...uploaded])
    } finally {
      setUploading(false)
    }
  }

  const handleCreateRoom = async () => {
    if (!clean(label)) return
    setSaving(true)
    try {
      await createRoom({
        propertyId,
        label: clean(label),
        price: price ? Number(price) : null,
        advantages: clean(advantages) || undefined,
        disadvantages: clean(disadvantages) || undefined,
        priceNote: clean(priceNote) || undefined,
        photos
      })
      setLabel(''); setPrice(''); setAdvantages(''); setDisadvantages(''); setPriceNote(''); setPhotos([])
      setShowAdd(false)
      await load()
    } catch (err) {
      onNotify(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const handleAddOccupant = async (roomId: string) => {
    if (!clean(occupantName)) return
    setBusyRoomId(roomId)
    try {
      await addRoomOccupant(roomId, {
        occupantNameRaw: clean(occupantName),
        rentAmount: occupantRent ? Number(occupantRent) : null
      })
      setOccupantName(''); setOccupantRent(''); setOccupantFormFor(null)
      await load()
    } catch (err) {
      onNotify(getErrorMessage(err))
    } finally {
      setBusyRoomId(null)
    }
  }

  const handleEndOccupancy = async (occupantId: string, roomId: string) => {
    setBusyRoomId(roomId)
    try {
      await endRoomOccupancy(occupantId)
      await load()
    } catch (err) {
      onNotify(getErrorMessage(err))
    } finally {
      setBusyRoomId(null)
    }
  }

  const handleAdvertise = async (roomId: string) => {
    setBusyRoomId(roomId)
    try {
      await advertiseRoom(roomId)
      onNotify('Room advertised — it now appears in your listings.')
      await load()
      onAdvertised()
    } catch (err) {
      onNotify(getErrorMessage(err))
    } finally {
      setBusyRoomId(null)
    }
  }

  return (
    <div className="pt-2 border-t border-white/5">
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-white py-2"
      >
        <span>Room inventory (private to you)</span>
        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {expanded && (
        <div className="space-y-3 pt-1">
          <p className="text-[10px] text-gray-600 flex items-center gap-1">
            <Lock size={10} /> Only you can see this — a room only becomes a public listing once you advertise it.
          </p>

          {loaded && sortRoomsForLandlord(rooms).map(room => {
            const roomOccupants = (occupants[room.id] || []).filter(isCurrentOccupant)
            return (
              <div key={room.id} className="bg-black/30 border border-white/5 rounded-xl p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-white truncate">{room.label}</p>
                    <p className="text-[10px] text-gray-500">
                      {room.status === 'vacant' ? 'Vacant' : 'Occupied'}
                      {room.price ? ` · ${room.currency} ${room.price}` : ''}
                      {room.listingId ? ' · advertised' : ''}
                    </p>
                  </div>
                  {room.status === 'vacant' && !room.listingId && (
                    <button
                      onClick={() => handleAdvertise(room.id)}
                      disabled={busyRoomId === room.id}
                      className="text-[9px] font-black uppercase tracking-widest text-gold-primary hover:underline shrink-0 flex items-center gap-1 disabled:opacity-50"
                    >
                      <Megaphone size={10} /> Advertise
                    </button>
                  )}
                </div>

                {room.priceNote && <p className="text-[10px] text-gray-500 italic">&quot;{room.priceNote}&quot;</p>}
                {(room.advantages || room.disadvantages) && (
                  <div className="text-[10px] space-y-0.5">
                    {room.advantages && <p className="text-emerald-400/80">+ {room.advantages}</p>}
                    {room.disadvantages && <p className="text-red-400/70">− {room.disadvantages}</p>}
                  </div>
                )}
                {room.photos.length > 0 && (
                  <div className="flex gap-1.5 overflow-x-auto">
                    {room.photos.map((url, i) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={i} src={url} alt="" className="w-14 h-14 rounded-lg object-cover shrink-0 border border-white/10" />
                    ))}
                  </div>
                )}

                <div className="pt-1 space-y-1">
                  {roomOccupants.map(o => (
                    <div key={o.id} className="flex items-center justify-between text-[10px] bg-white/5 rounded-lg px-2 py-1.5">
                      <span className="text-gray-300 flex items-center gap-1">
                        {o.visibility === 'shared_with_housemates' ? <Users2 size={10} className="text-gold-primary" /> : <Lock size={10} className="text-gray-600" />}
                        {occupantDisplayName(o, () => '')}
                        {o.rentAmount ? ` · R${o.rentAmount}/mo` : ''}
                      </span>
                      <button
                        onClick={() => handleEndOccupancy(o.id, room.id)}
                        disabled={busyRoomId === room.id}
                        aria-label={`End ${occupantDisplayName(o, () => '')}'s tenancy`}
                        className="text-gray-500 hover:text-red-400 disabled:opacity-50"
                      >
                        <LogOut size={11} />
                      </button>
                    </div>
                  ))}

                  {occupantFormFor === room.id ? (
                    <div className="flex gap-1.5">
                      <input
                        value={occupantName}
                        onChange={e => setOccupantName(e.target.value)}
                        placeholder="Name"
                        className="flex-1 bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-[10px] text-white"
                      />
                      <input
                        value={occupantRent}
                        onChange={e => setOccupantRent(e.target.value)}
                        placeholder="Rent"
                        type="number"
                        className="w-16 bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-[10px] text-white"
                      />
                      <button
                        onClick={() => handleAddOccupant(room.id)}
                        disabled={busyRoomId === room.id || !occupantName.trim()}
                        className="text-gold-primary disabled:opacity-40"
                        aria-label="Save occupant"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setOccupantFormFor(room.id)}
                      className="text-[9px] font-black uppercase tracking-widest text-gray-500 hover:text-white flex items-center gap-1"
                    >
                      <UserPlus size={10} /> Record who&apos;s living here
                    </button>
                  )}
                </div>
              </div>
            )
          })}

          {showAdd ? (
            <div className="bg-black/40 border border-white/5 rounded-xl p-3 space-y-2">
              <input
                value={label}
                onChange={e => setLabel(e.target.value)}
                placeholder="Room name (e.g. Back room)"
                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white"
              />
              <input
                value={price}
                onChange={e => setPrice(e.target.value)}
                type="number"
                placeholder="Price (ZAR/month)"
                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white"
              />
              <textarea
                value={priceNote}
                onChange={e => setPriceNote(e.target.value)}
                placeholder="Why it costs this (e.g. own bathroom, north-facing)"
                rows={2}
                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white resize-none"
              />
              <input
                value={advantages}
                onChange={e => setAdvantages(e.target.value)}
                placeholder="Advantages"
                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white"
              />
              <input
                value={disadvantages}
                onChange={e => setDisadvantages(e.target.value)}
                placeholder="Disadvantages"
                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white"
              />
              <label className="flex items-center gap-2 text-[10px] text-gray-500 cursor-pointer">
                <Camera size={12} />
                {uploading ? 'Uploading…' : `Add photos (${photos.length}/${MAX_ROOM_PHOTOS})`}
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  hidden
                  disabled={uploading || photos.length >= MAX_ROOM_PHOTOS}
                  onChange={e => handlePhotoSelect(e.target.files)}
                />
              </label>
              <div className="flex gap-2">
                <button
                  onClick={handleCreateRoom}
                  disabled={saving || !label.trim()}
                  className={`${goldButtonClass({ size: 'sm' })} text-[10px] px-4 py-2 disabled:opacity-50`}
                >
                  {saving ? 'Saving…' : 'Save room'}
                </button>
                <button onClick={() => setShowAdd(false)} aria-label="Cancel" className="text-gray-500 hover:text-white px-3 py-2">
                  <X size={14} />
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowAdd(true)}
              className="w-full text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg py-2 flex items-center justify-center gap-1"
            >
              <Plus size={12} /> Add a room
            </button>
          )}
        </div>
      )}
    </div>
  )
}
