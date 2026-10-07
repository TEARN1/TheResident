'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { BedDouble, DoorOpen, LogIn, LogOut, Megaphone, Plus, X } from 'lucide-react'
import { supabase } from '../../../../utils/supabase'
import { formatCurrency } from '../../../../utils/logic'
import { currentOccupants, summariseRooms, type OccupantRow, type RoomRow } from '../../../../utils/rooms'

/**
 * Room-by-room management for one property, on the res_rooms backend:
 * add rooms, move tenants in and out, and advertise an empty room as a
 * listing in one tap. Moving the last tenant out frees the room and
 * notifies everyone watching it (res_end_room_occupancy does both).
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

  const load = useCallback(async () => {
    if (!supabase) return
    const { data: roomRows, error: roomErr } = await supabase
      .from('res_rooms')
      .select('id, label, price, currency, status, listing_id')
      .eq('property_id', propertyId)
      .order('created_at')
    if (roomErr) { setError('Could not load rooms.'); setLoading(false); return }
    const ids = (roomRows ?? []).map(r => r.id)
    const { data: occRows } = ids.length
      ? await supabase
          .from('res_room_occupants')
          .select('id, room_id, occupant_name_raw, tenant_id, rent_amount, moved_in_at, moved_out_at')
          .in('room_id', ids)
          .is('moved_out_at', null)
      : { data: [] as OccupantRow[] }
    setRooms((roomRows ?? []) as RoomRow[])
    setOccupants((occRows ?? []) as OccupantRow[])
    setLoading(false)
  }, [propertyId])

  useEffect(() => {
    // Defer so the load's state updates land outside the effect body.
    const t = setTimeout(load, 0)
    return () => clearTimeout(t)
  }, [load])

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
    if (!supabase || !newLabel.trim()) return
    const price = newPrice ? Number(newPrice) : null
    const ok = await run('add', () => supabase!.rpc('res_create_room', {
      p_property: propertyId, p_label: newLabel.trim(), p_price: price, p_currency: 'ZAR',
      p_advantages: null, p_disadvantages: null, p_price_note: null, p_photos: []
    }), `${newLabel.trim()} added.`)
    if (ok) { setNewLabel(''); setNewPrice(''); setAdding(false) }
  }

  const moveIn = async (room: RoomRow) => {
    if (!supabase || !tenantName.trim()) return
    const ok = await run(`in-${room.id}`, () => supabase!.rpc('res_add_room_occupant', {
      p_room: room.id, p_tenant: null, p_occupant_name_raw: tenantName.trim(),
      p_rent_amount: tenantRent ? Number(tenantRent) : room.price, p_notes: null
    }), `${tenantName.trim()} moved into ${room.label}.`)
    if (ok) { setMovingInto(null); setTenantName(''); setTenantRent('') }
  }

  const moveOut = (room: RoomRow, occupant: OccupantRow) =>
    run(`out-${room.id}`, () => supabase!.rpc('res_end_room_occupancy', { p_occupant: occupant.id }),
      `${occupant.occupant_name_raw ?? 'Tenant'} moved out. ${room.label} is free, and anyone watching it has been notified.`)

  const advertise = (room: RoomRow) =>
    run(`ad-${room.id}`, () => supabase!.rpc('res_advertise_room', { p_room: room.id }),
      `${room.label} is now listed on Housing.`)

  const summary = summariseRooms(rooms, occupants)
  const live = currentOccupants(occupants)
  const currency = rooms[0]?.currency ?? 'ZAR'

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div onClick={onClose} className="absolute inset-0 bg-black/80 backdrop-blur-md" />
      <div className="glass-panel relative z-10 w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-black border border-white/10 p-5 sm:p-7 space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="m-0 text-lg font-black text-white">Rooms</h3>
            <p className="m-0 mt-0.5 text-xs text-gray-400">{address}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-full text-gray-400 hover:text-white hover:bg-white/5" aria-label="Close"><X size={18} /></button>
        </div>

        {/* At-a-glance numbers */}
        <div className="grid grid-cols-3 gap-2">
          <Stat label="Occupied" value={`${summary.occupied}/${summary.total}`} />
          <Stat label="Monthly rent" value={formatCurrency(summary.monthlyIncome, currency)} />
          <Stat
            label="Empty rooms cost"
            value={summary.vacantIncome > 0 ? `${formatCurrency(summary.vacantIncome, currency)}/mo` : 'Nothing'}
            tone={summary.vacantIncome > 0 ? 'text-amber-400' : 'text-emerald-400'}
          />
        </div>

        {summary.unadvertisedVacant > 0 && (
          <p className="m-0 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
            {summary.unadvertisedVacant} empty room{summary.unadvertisedVacant === 1 ? ' is' : 's are'} not advertised. Tap Advertise to list {summary.unadvertisedVacant === 1 ? 'it' : 'them'} in one step.
          </p>
        )}
        {error && <p className="m-0 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300">{error}</p>}
        {notice && <p className="m-0 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">{notice}</p>}

        {loading ? (
          <p className="m-0 text-sm text-gray-500">Loading rooms…</p>
        ) : rooms.length === 0 ? (
          <p className="m-0 text-sm text-gray-400">No rooms yet. Add your first room below.</p>
        ) : (
          <div className="space-y-2.5">
            {rooms.map(room => {
              const people = live.get(room.id) ?? []
              const vacant = room.status === 'vacant'
              return (
                <div key={room.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <BedDouble size={18} className="text-gold-primary shrink-0" />
                      <div className="min-w-0">
                        <p className="m-0 text-sm font-bold text-white truncate">{room.label}</p>
                        <p className="m-0 text-[11px] text-gray-400">
                          {room.price != null ? `${formatCurrency(room.price, room.currency)}/mo` : 'No price set'}
                        </p>
                      </div>
                    </div>
                    <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                      vacant ? 'border-amber-500/30 bg-amber-500/10 text-amber-400' : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                    }`}>
                      {vacant ? 'Empty' : 'Occupied'}
                    </span>
                  </div>

                  {people.map(p => (
                    <div key={p.id} className="flex items-center justify-between gap-2 text-xs">
                      <span className="text-gray-300">
                        {p.occupant_name_raw ?? 'Linked resident'} · since {new Date(p.moved_in_at).toLocaleDateString()}
                        {p.rent_amount != null && ` · ${formatCurrency(p.rent_amount, room.currency)}`}
                      </span>
                      <button
                        onClick={() => moveOut(room, p)}
                        disabled={busy === `out-${room.id}`}
                        className="flex items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1.5 text-[11px] font-bold text-gray-300 hover:text-white hover:border-white/30 disabled:opacity-50"
                      >
                        <LogOut size={12} /> Move out
                      </button>
                    </div>
                  ))}

                  {vacant && movingInto === room.id ? (
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input value={tenantName} onChange={e => setTenantName(e.target.value)} placeholder="Tenant name"
                        className="flex-1 box-border rounded-xl border border-white/10 bg-black px-3 py-2 text-xs text-white outline-none focus:border-gold-primary/50" />
                      <input value={tenantRent} onChange={e => setTenantRent(e.target.value.replace(/[^0-9.]/g, ''))} inputMode="decimal"
                        placeholder={room.price != null ? `Rent (${room.price})` : 'Monthly rent'}
                        className="sm:w-32 box-border rounded-xl border border-white/10 bg-black px-3 py-2 text-xs text-white outline-none focus:border-gold-primary/50" />
                      <button onClick={() => moveIn(room)} disabled={!tenantName.trim() || busy === `in-${room.id}`}
                        className="rounded-xl bg-gold-primary px-4 py-2 text-xs font-black text-black disabled:opacity-50">Save</button>
                      <button onClick={() => setMovingInto(null)} className="rounded-xl px-3 py-2 text-xs text-gray-400 hover:text-white">Cancel</button>
                    </div>
                  ) : vacant && (
                    <div className="flex flex-wrap gap-2">
                      <button onClick={() => { setMovingInto(room.id); setTenantName(''); setTenantRent('') }}
                        className="flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-2 text-[11px] font-bold text-gray-200 hover:border-gold-primary/40 hover:text-gold-primary">
                        <LogIn size={13} /> Move someone in
                      </button>
                      {room.listing_id ? (
                        <span className="flex items-center gap-1.5 rounded-xl border border-emerald-500/20 px-3 py-2 text-[11px] font-bold text-emerald-400">
                          <DoorOpen size={13} /> Listed on Housing
                        </span>
                      ) : (
                        <button onClick={() => advertise(room)} disabled={busy === `ad-${room.id}`}
                          className="flex items-center gap-1.5 rounded-xl bg-gold-primary/15 border border-gold-primary/30 px-3 py-2 text-[11px] font-bold text-gold-primary hover:bg-gold-primary hover:text-black disabled:opacity-50">
                          <Megaphone size={13} /> Advertise
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {adding ? (
          <form onSubmit={addRoom} className="flex flex-col sm:flex-row gap-2">
            <input autoFocus value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder="Room name, e.g. Room 3 (en-suite)"
              className="flex-1 box-border rounded-xl border border-white/10 bg-black px-3 py-2.5 text-xs text-white outline-none focus:border-gold-primary/50" />
            <input value={newPrice} onChange={e => setNewPrice(e.target.value.replace(/[^0-9.]/g, ''))} inputMode="decimal" placeholder="Rent / month"
              className="sm:w-32 box-border rounded-xl border border-white/10 bg-black px-3 py-2.5 text-xs text-white outline-none focus:border-gold-primary/50" />
            <button type="submit" disabled={!newLabel.trim() || busy === 'add'} className="rounded-xl bg-gold-primary px-4 py-2.5 text-xs font-black text-black disabled:opacity-50">Add</button>
            <button type="button" onClick={() => setAdding(false)} className="rounded-xl px-3 py-2.5 text-xs text-gray-400 hover:text-white">Cancel</button>
          </form>
        ) : (
          <button onClick={() => setAdding(true)}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-white/15 py-3 text-xs font-bold text-gray-300 hover:border-gold-primary/40 hover:text-gold-primary">
            <Plus size={14} /> Add a room
          </button>
        )}
      </div>
    </div>
  )
}

function Stat({ label, value, tone = 'text-white' }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
      <p className="m-0 text-[10px] font-bold uppercase tracking-wider text-gray-500">{label}</p>
      <p className={`m-0 mt-1 text-sm font-black ${tone}`}>{value}</p>
    </div>
  )
}
