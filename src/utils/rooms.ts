// Pure helpers for the landlord Room Manager. Kept separate from the
// component so the money maths is unit tested.

export interface RoomIssue {
  id: string
  description: string
  severity: 'low' | 'medium' | 'high'
  reportedAt: string
  resolved: boolean
}

export interface RoomRow {
  id: string
  label: string
  price: number | null
  currency: string
  status: 'vacant' | 'occupied'
  listing_id: string | null
  photos?: string[]
  issues?: RoomIssue[]
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
  /** Total count of room photos across this property */
  totalPhotos: number
  /** Active unresolved room issues/defects */
  activeIssues: number
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
  let totalPhotos = 0
  let activeIssues = 0

  for (const room of rooms) {
    const people = live.get(room.id) ?? []
    if (room.photos && Array.isArray(room.photos)) {
      totalPhotos += room.photos.length
    }
    if (room.issues && Array.isArray(room.issues)) {
      activeIssues += room.issues.filter(i => !i.resolved).length
    }

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
    unadvertisedVacant,
    totalPhotos,
    activeIssues
  }
}

/** Pure helper to add a photo to a room (caps at 10 photos per room) */
export function addRoomPhoto(room: RoomRow, photoUrl: string): RoomRow {
  const existing = room.photos || []
  if (existing.includes(photoUrl) || existing.length >= 10) return room
  return {
    ...room,
    photos: [...existing, photoUrl]
  }
}

/** Pure helper to remove a photo from a room */
export function removeRoomPhoto(room: RoomRow, photoUrl: string): RoomRow {
  const existing = room.photos || []
  return {
    ...room,
    photos: existing.filter(p => p !== photoUrl)
  }
}

/** Pure helper to add an issue / defect to a room */
export function addRoomIssue(
  room: RoomRow,
  description: string,
  severity: 'low' | 'medium' | 'high' = 'medium'
): RoomRow {
  if (!description.trim()) return room
  const newIssue: RoomIssue = {
    id: `issue-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    description: description.trim(),
    severity,
    reportedAt: new Date().toISOString(),
    resolved: false
  }
  return {
    ...room,
    issues: [...(room.issues || []), newIssue]
  }
}

/** Pure helper to toggle resolved state of an issue */
export function toggleRoomIssueResolved(room: RoomRow, issueId: string): RoomRow {
  const existing = room.issues || []
  return {
    ...room,
    issues: existing.map(i => i.id === issueId ? { ...i, resolved: !i.resolved } : i)
  }
}
