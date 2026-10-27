// Pure helpers for the landlord Room Manager. Kept separate from the
// component so the money maths is unit tested.

export interface RoomRow {
  id: string
  label: string
  price: number | null
  currency: string
  status: 'vacant' | 'occupied'
  listing_id: string | null
}

export interface OccupantRow {
  id: string
  room_id: string
  occupant_name_raw: string | null
  tenant_id: string | null
  rent_amount: number | null
  moved_in_at: string
  moved_out_at: string | null
}

export interface RoomSummary {
  total: number
  occupied: number
  vacant: number
  /** Rent actually being collected per month: each current occupant's
   *  agreed rent, falling back to the room's asking price. */
  monthlyIncome: number
  /** Asking rent of every vacant room: what the empty rooms are costing. */
  vacantIncome: number
  /** Vacant rooms that are not yet advertised as a listing. */
  unadvertisedVacant: number
}

export function currentOccupants(occupants: OccupantRow[]): Map<string, OccupantRow[]> {
  const byRoom = new Map<string, OccupantRow[]>()
  for (const o of occupants) {
    if (o.moved_out_at) continue
    const list = byRoom.get(o.room_id) ?? []
    list.push(o)
    byRoom.set(o.room_id, list)
  }
  return byRoom
}

export function summariseRooms(rooms: RoomRow[], occupants: OccupantRow[]): RoomSummary {
  const live = currentOccupants(occupants)
  let monthlyIncome = 0
  let vacantIncome = 0
  let occupied = 0
  let unadvertisedVacant = 0
  for (const room of rooms) {
    const people = live.get(room.id) ?? []
    if (room.status === 'occupied') {
      occupied++
      const agreed = people.reduce((sum, p) => sum + (p.rent_amount ?? 0), 0)
      monthlyIncome += agreed > 0 ? agreed : room.price ?? 0
    } else {
      vacantIncome += room.price ?? 0
      if (!room.listing_id) unadvertisedVacant++
    }
  }
  return {
    total: rooms.length,
    occupied,
    vacant: rooms.length - occupied,
    monthlyIncome,
    vacantIncome,
    unadvertisedVacant
  }
}
