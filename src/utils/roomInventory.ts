// A landlord's private room inventory: how many rooms, which are vacant,
// photos, advantages/disadvantages, who lives there, and why it costs what it
// does.
//
// See theresident_room_inventory_schema.sql for the real access control — a
// room is private to its landlord (res_rooms_all mirrors res_properties_all
// exactly), and an occupant's visibility to housemates is set ONLY by that
// occupant themselves (res_set_occupant_visibility checks auth.uid() =
// tenant_id, not landlord_id). The pure functions below mirror that for
// client-side UX and are NOT the security boundary; the DB is.
import { supabase } from './supabase'
import { resilientCall } from './resilientCall'

export type RoomStatus = 'vacant' | 'occupied'
export type OccupantVisibility = 'landlord_only' | 'shared_with_housemates'

export const MAX_ROOM_PHOTOS = 6

export interface Room {
  id: string
  propertyId: string
  landlordId: string
  label: string
  photos: string[]
  price: number | null
  currency: string
  advantages: string | null
  disadvantages: string | null
  priceNote: string | null
  status: RoomStatus
  listingId: string | null
  createdAt: string
}

export interface RoomOccupant {
  id: string
  roomId: string
  tenantId: string | null
  occupantNameRaw: string | null
  movedInAt: string
  movedOutAt: string | null
  rentAmount: number | null
  notes: string | null
  visibility: OccupantVisibility
}

/** True while someone is actually living there. */
export const isCurrentOccupant = (o: Pick<RoomOccupant, 'movedOutAt'>): boolean => o.movedOutAt === null

/** What to call them on screen — their own name if linked, else what the landlord typed. */
export function occupantDisplayName(o: Pick<RoomOccupant, 'tenantId' | 'occupantNameRaw'>, nameOf: (id: string) => string): string {
  if (o.tenantId) {
    const name = nameOf(o.tenantId)
    return name || 'A resident'
  }
  return o.occupantNameRaw || 'Unnamed occupant'
}

/** Vacant rooms first (there's something to do about those), then by label. */
export function sortRoomsForLandlord(rooms: Room[]): Room[] {
  return [...rooms].sort((a, b) => {
    if (a.status !== b.status) return a.status === 'vacant' ? -1 : 1
    return a.label.localeCompare(b.label)
  })
}

/** How many of a property's rooms are vacant right now, out of the total. */
export function vacancySummary(rooms: Room[]): { vacant: number; total: number } {
  return { vacant: rooms.filter(r => r.status === 'vacant').length, total: rooms.length }
}

/** Photo count validation mirrors the DB's own cap, so the UI can refuse before a round trip. */
export function tooManyPhotos(photos: string[]): boolean {
  return photos.length > MAX_ROOM_PHOTOS
}

// ── Network layer ──────────────────────────────────────────────────────────

interface DbRow { [key: string]: unknown }

function mapRoom(row: DbRow): Room {
  return {
    id: row.id as string,
    propertyId: row.property_id as string,
    landlordId: row.landlord_id as string,
    label: row.label as string,
    photos: (row.photos as string[]) || [],
    price: row.price === null || row.price === undefined ? null : Number(row.price),
    currency: (row.currency as string) || 'ZAR',
    advantages: (row.advantages as string | null) ?? null,
    disadvantages: (row.disadvantages as string | null) ?? null,
    priceNote: (row.price_note as string | null) ?? null,
    status: row.status as RoomStatus,
    listingId: (row.listing_id as string | null) ?? null,
    createdAt: row.created_at as string
  }
}

function mapOccupant(row: DbRow): RoomOccupant {
  return {
    id: row.id as string,
    roomId: row.room_id as string,
    tenantId: (row.tenant_id as string | null) ?? null,
    occupantNameRaw: (row.occupant_name_raw as string | null) ?? null,
    movedInAt: row.moved_in_at as string,
    movedOutAt: (row.moved_out_at as string | null) ?? null,
    rentAmount: row.rent_amount === null || row.rent_amount === undefined ? null : Number(row.rent_amount),
    notes: (row.notes as string | null) ?? null,
    visibility: row.visibility as OccupantVisibility
  }
}

/** Rooms the caller is allowed to see — RLS scopes this to their own properties. */
export async function fetchRooms(propertyId?: string): Promise<Room[]> {
  if (!supabase) return []
  let query = supabase.from('res_rooms').select('*').order('label')
  if (propertyId) query = query.eq('property_id', propertyId)
  const { data, error } = await query.limit(200)
  if (error || !data) return []
  return data.map(mapRoom)
}

/** Occupant rows the caller is allowed to see for a set of rooms. */
export async function fetchOccupants(roomIds: string[]): Promise<RoomOccupant[]> {
  if (!supabase || roomIds.length === 0) return []
  const { data, error } = await supabase
    .from('res_room_occupants')
    .select('*')
    .in('room_id', roomIds)
    .order('moved_in_at', { ascending: false })
  if (error || !data) return []
  return data.map(mapOccupant)
}

export interface NewRoom {
  propertyId: string
  label: string
  price?: number | null
  currency?: string
  advantages?: string
  disadvantages?: string
  priceNote?: string
  photos?: string[]
}

export async function createRoom(input: NewRoom): Promise<Room> {
  if (!supabase) throw new Error('Not connected')
  const client = supabase
  return resilientCall(async () => {
    const { data, error } = await client.rpc('res_create_room', {
      p_property: input.propertyId,
      p_label: input.label,
      p_price: input.price ?? null,
      p_currency: input.currency ?? 'ZAR',
      p_advantages: input.advantages ?? null,
      p_disadvantages: input.disadvantages ?? null,
      p_price_note: input.priceNote ?? null,
      p_photos: input.photos ?? []
    })
    if (error) throw error
    return mapRoom((Array.isArray(data) ? data[0] : data) as DbRow)
  })
}

export async function updateRoom(roomId: string, input: NewRoom): Promise<Room> {
  if (!supabase) throw new Error('Not connected')
  const { data, error } = await supabase.rpc('res_update_room', {
    p_room: roomId,
    p_label: input.label,
    p_price: input.price ?? null,
    p_currency: input.currency ?? 'ZAR',
    p_advantages: input.advantages ?? null,
    p_disadvantages: input.disadvantages ?? null,
    p_price_note: input.priceNote ?? null,
    p_photos: input.photos ?? []
  })
  if (error) throw error
  return mapRoom((Array.isArray(data) ? data[0] : data) as DbRow)
}

export async function addRoomOccupant(
  roomId: string,
  input: { tenantId?: string | null; occupantNameRaw?: string; rentAmount?: number | null; notes?: string }
): Promise<RoomOccupant> {
  if (!supabase) throw new Error('Not connected')
  const { data, error } = await supabase.rpc('res_add_room_occupant', {
    p_room: roomId,
    p_tenant: input.tenantId ?? null,
    p_occupant_name_raw: input.occupantNameRaw ?? null,
    p_rent_amount: input.rentAmount ?? null,
    p_notes: input.notes ?? null
  })
  if (error) throw error
  return mapOccupant((Array.isArray(data) ? data[0] : data) as DbRow)
}

export async function endRoomOccupancy(occupantId: string): Promise<void> {
  if (!supabase) throw new Error('Not connected')
  const { error } = await supabase.rpc('res_end_room_occupancy', { p_occupant: occupantId })
  if (error) throw error
}

/** Callable only by the occupant themselves — the DB enforces this, not the client. */
export async function setOccupantVisibility(occupantId: string, visibility: OccupantVisibility): Promise<void> {
  if (!supabase) throw new Error('Not connected')
  const { error } = await supabase.rpc('res_set_occupant_visibility', {
    p_occupant: occupantId,
    p_visibility: visibility
  })
  if (error) throw error
}

/** Publishes a room as a real listing. Returns the new listing's id. */
export async function advertiseRoom(roomId: string): Promise<string> {
  if (!supabase) throw new Error('Not connected')
  const { data, error } = await supabase.rpc('res_advertise_room', { p_room: roomId })
  if (error) throw error
  const row = (Array.isArray(data) ? data[0] : data) as DbRow
  return row.id as string
}
