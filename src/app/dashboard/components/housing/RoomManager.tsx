'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  BedDouble,
  Camera,
  Check,
  DoorOpen,
  Image as ImageIcon,
  LogIn,
  LogOut,
  Megaphone,
  Plus,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Upload,
  Wrench,
  X,
  AlertTriangle,
  ChevronDown,
  ChevronUp
} from 'lucide-react'
import { supabase } from '../../../../utils/supabase'
import { formatCurrency } from '../../../../utils/logic'
import {
  currentOccupants,
  summariseRooms,
  addRoomPhoto,
  removeRoomPhoto,
  addRoomIssue,
  toggleRoomIssueResolved,
  type OccupantRow,
  type RoomRow,
  type RoomIssue
} from '../../../../utils/rooms'
import { safeGetJSON, safeSetJSON } from '../../../../utils/safeStorage'

/**
 * RoomManager — granular room-by-room inventory & maintenance management.
 * Each room has its own photo gallery, Occupied vs. Empty status signs,
 * and a statutory defect & condition log ("what's wrong with Room X")
 * protecting landlords and tenants under the Rental Housing Act.
 */
interface Props {
  propertyId: string
  address: string
  onClose: () => void
}

type Busy = string | null

export default function RoomManager({ propertyId, address, onClose }: Props) {
  const [rooms, setRooms] = useState<RoomRow[]>([])
  const [occupants, setOccupants] = useState<OccupantRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<Busy>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const [adding, setAdding] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [newPrice, setNewPrice] = useState('')

  const [movingInto, setMovingInto] = useState<string | null>(null)
  const [tenantName, setTenantName] = useState('')
  const [tenantRent, setTenantRent] = useState('')

  // Expanded issue panels & add issue inputs: roomId => boolean / string
  const [expandedIssues, setExpandedIssues] = useState<Record<string, boolean>>({})
  const [expandedGalleries, setExpandedGalleries] = useState<Record<string, boolean>>({})
  const [newIssueTexts, setNewIssueTexts] = useState<Record<string, string>>({})
  const [newIssueSeverities, setNewIssueSeverities] = useState<Record<string, 'low' | 'medium' | 'high'>>({})
  const [photoUploadingRoom, setPhotoUploadingRoom] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const targetUploadRoomIdRef = useRef<string | null>(null)

  const storageKey = `resident_rooms_cache_${propertyId}`

  const load = useCallback(async () => {
    // Check local fallback first
    const localRooms = safeGetJSON<RoomRow[]>(storageKey, [])

    if (!supabase) {
      if (localRooms.length > 0) {
        setRooms(localRooms)
      } else {
        // Initialize default sample rooms for demonstration
        const initialRooms: RoomRow[] = [
          {
            id: `room-${propertyId}-1`,
            label: 'Room 1 (En-Suite)',
            price: 3500,
            currency: 'ZAR',
            status: 'vacant',
            listing_id: null,
            photos: [
              'https://images.unsplash.com/photo-1598928506311-c55ded91a20c?auto=format&fit=crop&w=600&q=80'
            ],
            issues: [
              {
                id: 'iss-1',
                description: 'Prepaid electrical meter meter box latch loose',
                severity: 'low',
                reportedAt: new Date().toISOString(),
                resolved: false
              }
            ]
          },
          {
            id: `room-${propertyId}-2`,
            label: 'Room 2 (Back Bedroom)',
            price: 2800,
            currency: 'ZAR',
            status: 'occupied',
            listing_id: null,
            photos: [],
            issues: []
          }
        ]
        setRooms(initialRooms)
        safeSetJSON(storageKey, initialRooms)
      }
      setOccupants([
        {
          id: 'occ-1',
          room_id: `room-${propertyId}-2`,
          occupant_name_raw: 'Sipho Ndlovu',
          tenant_id: null,
          rent_amount: 2800,
          moved_in_at: '2026-02-01',
          moved_out_at: null
        }
      ])
      setLoading(false)
      return
    }

    const { data: roomRows, error: roomErr } = await supabase
      .from('res_rooms')
      .select('id, label, price, currency, status, listing_id')
      .eq('property_id', propertyId)
      .order('created_at')

    if (roomErr) {
      if (localRooms.length > 0) {
        setRooms(localRooms)
      } else {
        setError('Could not load rooms.')
      }
      setLoading(false)
      return
    }

    const ids = (roomRows ?? []).map(r => r.id)
    const { data: occRows } = ids.length
      ? await supabase
          .from('res_room_occupants')
          .select('id, room_id, occupant_name_raw, tenant_id, rent_amount, moved_in_at, moved_out_at')
          .in('room_id', ids)
          .is('moved_out_at', null)
      : { data: [] as OccupantRow[] }

    // Merge Supabase rows with any locally attached photos & issues
    const mergedRooms = (roomRows ?? []).map(r => {
      const match = localRooms.find(lr => lr.id === r.id)
      return {
        ...(r as RoomRow),
        photos: match?.photos || [],
        issues: match?.issues || []
      }
    })

    setRooms(mergedRooms)
    setOccupants((occRows ?? []) as OccupantRow[])
    setLoading(false)
  }, [propertyId, storageKey])

  useEffect(() => {
    const t = setTimeout(load, 0)
    return () => clearTimeout(t)
  }, [load])

  // Sync rooms state changes to safe storage
  const syncLocalRooms = (updatedRooms: RoomRow[]) => {
    setRooms(updatedRooms)
    safeSetJSON(storageKey, updatedRooms)
  }

  const run = async (key: string, fn: () => PromiseLike<{ error: { message: string } | null }>, ok: string) => {
    setBusy(key)
    setError(null)
    setNotice(null)
    const { error: err } = await fn()
    setBusy(null)
    if (err) {
      setError(err.message.replace(/^[a-z_]+: /, ''))
      return false
    }
    setNotice(ok)
    await load()
    return true
  }

  const addRoom = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newLabel.trim()) return
    const price = newPrice ? Number(newPrice) : null

    if (!supabase) {
      const newRoomObj: RoomRow = {
        id: `room-${Date.now()}`,
        label: newLabel.trim(),
        price,
        currency: 'ZAR',
        status: 'vacant',
        listing_id: null,
        photos: [],
        issues: []
      }
      syncLocalRooms([...rooms, newRoomObj])
      setNewLabel('')
      setNewPrice('')
      setAdding(false)
      setNotice(`${newLabel.trim()} added.`)
      return
    }

    const ok = await run('add', () => supabase!.rpc('res_create_room', {
      p_property: propertyId, p_label: newLabel.trim(), p_price: price, p_currency: 'ZAR',
      p_advantages: null, p_disadvantages: null, p_price_note: null, p_photos: []
    }), `${newLabel.trim()} added.`)
    if (ok) { setNewLabel(''); setNewPrice(''); setAdding(false) }
  }

  const moveIn = async (room: RoomRow) => {
    if (!tenantName.trim()) return

    if (!supabase) {
      const updatedRooms = rooms.map(r => r.id === room.id ? { ...r, status: 'occupied' as const } : r)
      const newOcc: OccupantRow = {
        id: `occ-${Date.now()}`,
        room_id: room.id,
        occupant_name_raw: tenantName.trim(),
        tenant_id: null,
        rent_amount: tenantRent ? Number(tenantRent) : room.price,
        moved_in_at: new Date().toISOString(),
        moved_out_at: null
      }
      syncLocalRooms(updatedRooms)
      setOccupants(prev => [...prev, newOcc])
      setMovingInto(null)
      setTenantName('')
      setTenantRent('')
      setNotice(`${tenantName.trim()} moved into ${room.label}.`)
      return
    }

    const ok = await run(`in-${room.id}`, () => supabase!.rpc('res_add_room_occupant', {
      p_room: room.id, p_tenant: null, p_occupant_name_raw: tenantName.trim(),
      p_rent_amount: tenantRent ? Number(tenantRent) : room.price, p_notes: null
    }), `${tenantName.trim()} moved into ${room.label}.`)
    if (ok) { setMovingInto(null); setTenantName(''); setTenantRent('') }
  }

  const moveOut = async (room: RoomRow, occupant: OccupantRow) => {
    if (!supabase) {
      const updatedRooms = rooms.map(r => r.id === room.id ? { ...r, status: 'vacant' as const } : r)
      syncLocalRooms(updatedRooms)
      setOccupants(prev => prev.filter(o => o.id !== occupant.id))
      setNotice(`${occupant.occupant_name_raw ?? 'Tenant'} moved out. ${room.label} is marked empty.`)
      return
    }

    run(`out-${room.id}`, () => supabase!.rpc('res_end_room_occupancy', { p_occupant: occupant.id }),
      `${occupant.occupant_name_raw ?? 'Tenant'} moved out. ${room.label} is free, and anyone watching it has been notified.`)
  }

  const toggleRoomStatus = (room: RoomRow) => {
    const nextStatus = room.status === 'vacant' ? 'occupied' : 'vacant'
    const updated = rooms.map(r => r.id === room.id ? { ...r, status: nextStatus as 'vacant' | 'occupied' } : r)
    syncLocalRooms(updated)
    setNotice(`${room.label} status changed to ${nextStatus.toUpperCase()}.`)
  }

  const advertise = (room: RoomRow) => {
    if (!supabase) {
      const updated = rooms.map(r => r.id === room.id ? { ...r, listing_id: `list-${Date.now()}` } : r)
      syncLocalRooms(updated)
      setNotice(`${room.label} is now published on Housing feed with its photos and details.`)
      return
    }
    run(`ad-${room.id}`, () => supabase!.rpc('res_advertise_room', { p_room: room.id }),
      `${room.label} is now listed on Housing.`)
  }

  // Handle Photo Upload per Room
  const triggerPhotoUpload = (roomId: string) => {
    targetUploadRoomIdRef.current = roomId
    fileInputRef.current?.click()
  }

  const handlePhotoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    const roomId = targetUploadRoomIdRef.current
    if (!files || files.length === 0 || !roomId) return

    const targetRoom = rooms.find(r => r.id === roomId)
    if (!targetRoom) return

    const file = files[0]
    e.target.value = ''

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Please select a JPG, PNG or WebP image.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Photo exceeds 5MB size limit.')
      return
    }

    setPhotoUploadingRoom(roomId)
    setError(null)

    try {
      let finalUrl = ''
      if (supabase) {
        const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
        const path = `rooms/${propertyId}/${roomId}/${Date.now()}.${ext}`
        const { error: upErr } = await supabase.storage.from('gossip-media').upload(path, file, { contentType: file.type })
        if (upErr) throw upErr
        const { data } = supabase.storage.from('gossip-media').getPublicUrl(path)
        finalUrl = data.publicUrl
      } else {
        // Local offline / preview URL fallback
        finalUrl = URL.createObjectURL(file)
      }

      const updated = rooms.map(r => r.id === roomId ? addRoomPhoto(r, finalUrl) : r)
      syncLocalRooms(updated)
      setNotice(`New photo attached to ${targetRoom.label}.`)
    } catch {
      // Degrade gracefully to local data URL on upload error
      const reader = new FileReader()
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          const updated = rooms.map(r => r.id === roomId ? addRoomPhoto(r, reader.result as string) : r)
          syncLocalRooms(updated)
          setNotice(`Photo saved locally to ${targetRoom.label}.`)
        }
      }
      reader.readAsDataURL(file)
    } finally {
      setPhotoUploadingRoom(null)
      targetUploadRoomIdRef.current = null
    }
  }

  const handleDeletePhoto = (roomId: string, photoUrl: string) => {
    const updated = rooms.map(r => r.id === roomId ? removeRoomPhoto(r, photoUrl) : r)
    syncLocalRooms(updated)
    setNotice('Room photo removed.')
  }

  // Handle Issues / Defects per Room
  const handleAddIssue = (roomId: string) => {
    const text = newIssueTexts[roomId]?.trim()
    if (!text) return
    const severity = newIssueSeverities[roomId] || 'medium'
    const updated = rooms.map(r => r.id === roomId ? addRoomIssue(r, text, severity) : r)
    syncLocalRooms(updated)
    setNewIssueTexts(prev => ({ ...prev, [roomId]: '' }))
    setNotice('Room condition note logged.')
  }

  const handleToggleIssue = (roomId: string, issueId: string) => {
    const updated = rooms.map(r => r.id === roomId ? toggleRoomIssueResolved(r, issueId) : r)
    syncLocalRooms(updated)
  }

  const summary = summariseRooms(rooms, occupants)
  const live = currentOccupants(occupants)
  const currency = rooms[0]?.currency ?? 'ZAR'

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div onClick={onClose} className="absolute inset-0 bg-black/80 backdrop-blur-md" />
      <div className="glass-panel relative z-10 w-full max-w-2xl max-h-[90dvh] overflow-y-auto custom-scrollbar rounded-t-3xl sm:rounded-3xl bg-black border border-white/10 p-5 sm:p-7 space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="m-0 text-lg font-black text-white">Room Inventory &amp; Unit Studio</h3>
              <span className="px-2 py-0.5 rounded-full bg-gold-primary/20 border border-gold-primary/30 text-gold-primary text-[10px] font-black uppercase tracking-wider">
                RHA Compliant
              </span>
            </div>
            <p className="m-0 mt-0.5 text-xs text-gray-400">{address}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-full text-gray-400 hover:text-white hover:bg-white/5" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {/* Hidden File Input for per-room photo upload */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={handlePhotoFileChange}
        />

        {/* At-a-glance numbers */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Stat label="Occupied" value={`${summary.occupied}/${summary.total}`} tone="text-emerald-400" />
          <Stat label="Empty Rooms" value={`${summary.vacant}`} tone={summary.vacant > 0 ? 'text-amber-400' : 'text-gray-400'} />
          <Stat label="Room Photos" value={`${summary.totalPhotos}`} tone="text-gold-primary" />
          <Stat
            label="Active Defects"
            value={`${summary.activeIssues}`}
            tone={summary.activeIssues > 0 ? 'text-red-400' : 'text-gray-400'}
          />
        </div>

        {summary.unadvertisedVacant > 0 && (
          <p className="m-0 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
            {summary.unadvertisedVacant} empty room{summary.unadvertisedVacant === 1 ? ' is' : 's are'} ready with no public listing. Tap &quot;Advertise&quot; on any empty room to broadcast it instantly with its photos.
          </p>
        )}
        {error && <p className="m-0 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300">{error}</p>}
        {notice && <p className="m-0 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">{notice}</p>}

        {loading ? (
          <p className="m-0 text-sm text-gray-500">Loading room inventory…</p>
        ) : rooms.length === 0 ? (
          <p className="m-0 text-sm text-gray-400">No rooms configured yet. Add your first room below.</p>
        ) : (
          <div className="space-y-4">
            {rooms.map(room => {
              const people = live.get(room.id) ?? []
              const vacant = room.status === 'vacant'
              const roomPhotos = room.photos || []
              const roomIssues = room.issues || []
              const activeIssues = roomIssues.filter(i => !i.resolved)
              const isGalleriesOpen = expandedGalleries[room.id] !== false // default expanded if has photos or vacant
              const isIssuesOpen = expandedIssues[room.id] === true

              return (
                <div
                  key={room.id}
                  className={`rounded-2xl border transition-all p-4 sm:p-5 space-y-4 ${
                    vacant
                      ? 'border-gold-primary/30 bg-gold-primary/[0.02] shadow-sm'
                      : 'border-white/10 bg-white/[0.03]'
                  }`}
                >
                  {/* Top Bar: Room Name, Price & Prominent Status Sign */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-white/5">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`p-2.5 rounded-xl shrink-0 ${vacant ? 'bg-amber-500/15 text-amber-400' : 'bg-emerald-500/15 text-emerald-400'}`}>
                        <BedDouble size={20} />
                      </div>
                      <div className="min-w-0">
                        <p className="m-0 text-base font-black text-white truncate">{room.label}</p>
                        <p className="m-0 text-xs text-gray-400">
                          {room.price != null ? `${formatCurrency(room.price, room.currency)} / month` : 'No rent set'}
                        </p>
                      </div>
                    </div>

                    {/* Status Pill & Manual Toggle */}
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => toggleRoomStatus(room)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border shadow-sm transition-all active:scale-95 ${
                          vacant
                            ? 'bg-amber-500/15 border-amber-500/40 text-amber-400 hover:bg-amber-500/25'
                            : 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/25'
                        }`}
                        title="Click to toggle Occupied vs. Empty status"
                      >
                        <span className={`w-2 h-2 rounded-full ${vacant ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`} />
                        {vacant ? '🟢 EMPTY / READY' : '🔴 OCCUPIED'}
                      </button>
                    </div>
                  </div>

                  {/* Room Photos Section */}
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
                        <Camera size={14} className="text-gold-primary" /> Room Photos ({roomPhotos.length})
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => triggerPhotoUpload(room.id)}
                          disabled={photoUploadingRoom === room.id}
                          className="px-2.5 py-1 rounded-lg bg-gold-primary/10 hover:bg-gold-primary/20 border border-gold-primary/30 text-gold-primary text-[11px] font-bold flex items-center gap-1 transition-all active:scale-95"
                        >
                          <Upload size={12} />
                          {photoUploadingRoom === room.id ? 'Uploading…' : 'Add Photo'}
                        </button>
                        {roomPhotos.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setExpandedGalleries(prev => ({ ...prev, [room.id]: !isGalleriesOpen }))}
                            className="p-1 text-gray-400 hover:text-white"
                          >
                            {isGalleriesOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Photo Thumbnails Grid */}
                    {isGalleriesOpen && (
                      <div className="pt-1">
                        {roomPhotos.length === 0 ? (
                          <div
                            onClick={() => triggerPhotoUpload(room.id)}
                            className="border border-dashed border-white/10 hover:border-gold-primary/40 rounded-xl p-3 text-center cursor-pointer transition-colors group"
                          >
                            <ImageIcon size={20} className="mx-auto text-gray-600 group-hover:text-gold-primary mb-1 transition-colors" />
                            <p className="text-[11px] text-gray-400 m-0">No photos uploaded for this empty room yet. <span className="text-gold-primary font-bold">Tap to upload bedroom, window, or en-suite pictures.</span></p>
                          </div>
                        ) : (
                          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                            {roomPhotos.map((photo, pIdx) => (
                              <div key={pIdx} className="relative aspect-video rounded-xl overflow-hidden border border-white/10 bg-black group shadow-sm">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={photo} alt={`${room.label} photo ${pIdx + 1}`} className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                  <button
                                    type="button"
                                    onClick={() => handleDeletePhoto(room.id, photo)}
                                    className="p-1.5 rounded-full bg-red-500/80 hover:bg-red-500 text-white shadow-md transition-transform hover:scale-110"
                                    title="Delete photo"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                                <span className="absolute bottom-1 left-1.5 bg-black/80 px-1 rounded text-[8px] font-black uppercase text-gold-primary">
                                  {pIdx === 0 ? 'Cover' : `#${pIdx + 1}`}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Room Health & Defect Log (Statutory RHA Compliance) */}
                  <div className="space-y-2 pt-1 border-t border-white/5">
                    <button
                      type="button"
                      onClick={() => setExpandedIssues(prev => ({ ...prev, [room.id]: !isIssuesOpen }))}
                      className="w-full flex items-center justify-between text-xs font-bold text-gray-300 hover:text-white transition-colors"
                    >
                      <span className="flex items-center gap-1.5">
                        <Wrench size={13} className={activeIssues.length > 0 ? 'text-amber-400' : 'text-emerald-400'} />
                        <span>Condition &amp; Known Issues Log</span>
                        <span className={`text-[10px] px-1.5 py-0.2 rounded font-black ${activeIssues.length > 0 ? 'bg-amber-500/20 text-amber-300' : 'bg-emerald-500/20 text-emerald-300'}`}>
                          {activeIssues.length === 0 ? 'Zero Defects' : `${activeIssues.length} active`}
                        </span>
                      </span>
                      {isIssuesOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>

                    {isIssuesOpen && (
                      <div className="space-y-2.5 pt-1.5 bg-black/40 p-3 rounded-xl border border-white/5">
                        {roomIssues.length > 0 && (
                          <div className="space-y-1.5">
                            {roomIssues.map(issue => (
                              <div
                                key={issue.id}
                                className={`flex items-center justify-between gap-2 p-2 rounded-lg text-xs border ${
                                  issue.resolved
                                    ? 'bg-white/[0.02] border-white/5 text-gray-500 line-through'
                                    : issue.severity === 'high'
                                    ? 'bg-red-500/10 border-red-500/30 text-red-200'
                                    : 'bg-white/5 border-white/10 text-gray-300'
                                }`}
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <button
                                    type="button"
                                    onClick={() => handleToggleIssue(room.id, issue.id)}
                                    className={`w-4 h-4 rounded flex items-center justify-center border shrink-0 ${
                                      issue.resolved
                                        ? 'bg-emerald-500 border-emerald-500 text-black'
                                        : 'border-gray-500 hover:border-gold-primary'
                                    }`}
                                    title={issue.resolved ? 'Mark active' : 'Mark fixed'}
                                  >
                                    {issue.resolved && <Check size={11} />}
                                  </button>
                                  <span className="truncate">{issue.description}</span>
                                </div>
                                <span className="text-[9px] uppercase font-black px-1.5 py-0.5 rounded bg-black/60 text-gray-400 shrink-0">
                                  {issue.resolved ? 'Fixed' : issue.severity}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Add Issue Form */}
                        <div className="flex gap-1.5 pt-1">
                          <input
                            type="text"
                            value={newIssueTexts[room.id] || ''}
                            onChange={e => setNewIssueTexts(prev => ({ ...prev, [room.id]: e.target.value }))}
                            placeholder="Log issue (e.g. Window latch loose, damp on corner...)"
                            className="flex-1 bg-black border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:border-gold-primary/50"
                          />
                          <select
                            value={newIssueSeverities[room.id] || 'medium'}
                            onChange={e => setNewIssueSeverities(prev => ({ ...prev, [room.id]: e.target.value as 'low' | 'medium' | 'high' }))}
                            className="bg-black border border-white/10 rounded-lg px-2 text-[10px] text-gray-300 outline-none"
                          >
                            <option value="low">Low</option>
                            <option value="medium">Medium</option>
                            <option value="high">High</option>
                          </select>
                          <button
                            type="button"
                            onClick={() => handleAddIssue(room.id)}
                            className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-gold-primary hover:text-black text-xs font-bold transition-colors"
                          >
                            Log
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Occupant Details & Actions */}
                  {people.map(p => (
                    <div key={p.id} className="flex items-center justify-between gap-2 text-xs p-2.5 rounded-xl bg-white/5 border border-white/5">
                      <span className="text-gray-300">
                        <strong className="text-white">{p.occupant_name_raw ?? 'Linked resident'}</strong> · since {new Date(p.moved_in_at).toLocaleDateString()}
                        {p.rent_amount != null && ` · ${formatCurrency(p.rent_amount, room.currency)}/mo`}
                      </span>
                      <button
                        onClick={() => moveOut(room, p)}
                        disabled={busy === `out-${room.id}`}
                        className="flex items-center gap-1 rounded-lg border border-red-500/20 bg-red-500/10 px-2.5 py-1 text-[11px] font-bold text-red-300 hover:bg-red-500 hover:text-white transition-all disabled:opacity-50"
                      >
                        <LogOut size={12} /> Move out
                      </button>
                    </div>
                  ))}

                  {vacant && movingInto === room.id ? (
                    <div className="flex flex-col sm:flex-row gap-2 pt-1">
                      <input
                        value={tenantName}
                        onChange={e => setTenantName(e.target.value)}
                        placeholder="Tenant legal name"
                        className="flex-1 box-border rounded-xl border border-white/10 bg-black px-3 py-2 text-xs text-white outline-none focus:border-gold-primary/50"
                      />
                      <input
                        value={tenantRent}
                        onChange={e => setTenantRent(e.target.value.replace(/[^0-9.]/g, ''))}
                        inputMode="decimal"
                        placeholder={room.price != null ? `Agreed rent (${room.price})` : 'Monthly rent'}
                        className="sm:w-32 box-border rounded-xl border border-white/10 bg-black px-3 py-2 text-xs text-white outline-none focus:border-gold-primary/50"
                      />
                      <button
                        onClick={() => moveIn(room)}
                        disabled={!tenantName.trim() || busy === `in-${room.id}`}
                        className="rounded-xl bg-gold-primary px-4 py-2 text-xs font-black text-black disabled:opacity-50"
                      >
                        Save
                      </button>
                      <button onClick={() => setMovingInto(null)} className="rounded-xl px-3 py-2 text-xs text-gray-400 hover:text-white">
                        Cancel
                      </button>
                    </div>
                  ) : vacant && (
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <button
                        onClick={() => { setMovingInto(room.id); setTenantName(''); setTenantRent('') }}
                        className="flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-2 text-[11px] font-bold text-gray-200 hover:border-gold-primary/40 hover:text-gold-primary transition-all"
                      >
                        <LogIn size={13} /> Move tenant in
                      </button>

                      {room.listing_id ? (
                        <span className="flex items-center gap-1.5 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-[11px] font-bold text-emerald-400">
                          <DoorOpen size={13} /> Advertised on Housing
                        </span>
                      ) : (
                        <button
                          onClick={() => advertise(room)}
                          disabled={busy === `ad-${room.id}`}
                          className="flex items-center gap-1.5 rounded-xl bg-gold-primary text-black font-black px-3.5 py-2 text-[11px] uppercase tracking-wider hover:bg-gold-secondary shadow-sm active:scale-95 transition-all disabled:opacity-50"
                        >
                          <Megaphone size={13} /> 1-Tap Advertise Empty Room
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Add New Room Form */}
        {adding ? (
          <form onSubmit={addRoom} className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-white/10">
            <input
              autoFocus
              value={newLabel}
              onChange={e => setNewLabel(e.target.value)}
              placeholder="e.g. Room 4 (Garden view) or Room 5"
              className="flex-1 box-border rounded-xl border border-white/10 bg-black px-3 py-2.5 text-xs text-white outline-none focus:border-gold-primary/50"
            />
            <input
              value={newPrice}
              onChange={e => setNewPrice(e.target.value.replace(/[^0-9.]/g, ''))}
              inputMode="decimal"
              placeholder="Rent / month (ZAR)"
              className="sm:w-36 box-border rounded-xl border border-white/10 bg-black px-3 py-2.5 text-xs text-white outline-none focus:border-gold-primary/50"
            />
            <button
              type="submit"
              disabled={!newLabel.trim() || busy === 'add'}
              className="rounded-xl bg-gold-primary px-4 py-2.5 text-xs font-black text-black disabled:opacity-50 transition-all active:scale-95"
            >
              Add Room
            </button>
            <button
              type="button"
              onClick={() => setAdding(false)}
              className="rounded-xl px-3 py-2.5 text-xs text-gray-400 hover:text-white"
            >
              Cancel
            </button>
          </form>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-white/15 py-3.5 text-xs font-black uppercase tracking-wider text-gray-300 hover:border-gold-primary/40 hover:text-gold-primary transition-all active:scale-98"
          >
            <Plus size={15} /> Add Another Room (Room 1, 2, 3...)
          </button>
        )}
      </div>
    </div>
  )
}

function Stat({ label, value, tone = 'text-white' }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-center">
      <p className="m-0 text-[10px] font-bold uppercase tracking-wider text-gray-500">{label}</p>
      <p className={`m-0 mt-1 text-sm font-black ${tone}`}>{value}</p>
    </div>
  )
}
