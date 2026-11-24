import { test } from 'node:test'
import assert from 'node:assert'
import {
  summariseRooms,
  currentOccupants,
  addRoomPhoto,
  removeRoomPhoto,
  addRoomIssue,
  toggleRoomIssueResolved,
  type RoomRow,
  type OccupantRow
} from './rooms'

const room = (id: string, status: RoomRow['status'], price: number | null, listing_id: string | null = null, photos?: string[]): RoomRow =>
  ({ id, label: id, price, currency: 'ZAR', status, listing_id, photos, issues: [] })
const occ = (id: string, room_id: string, rent: number | null, moved_out_at: string | null = null): OccupantRow =>
  ({ id, room_id, occupant_name_raw: 'A', tenant_id: null, rent_amount: rent, moved_in_at: '2026-01-01', moved_out_at })

test('summariseRooms counts income from agreed rent, falling back to asking price', () => {
  const s = summariseRooms(
    [room('a', 'occupied', 4000), room('b', 'occupied', 5000), room('c', 'vacant', 3000)],
    [occ('1', 'a', 3800)]
  )
  assert.deepStrictEqual(s, {
    total: 3,
    occupied: 2,
    vacant: 1,
    monthlyIncome: 8800,
    vacantIncome: 3000,
    unadvertisedVacant: 1,
    totalPhotos: 0,
    activeIssues: 0
  })
})

test('summariseRooms ignores tenants who moved out and counts advertised vacancies separately', () => {
  const s = summariseRooms(
    [room('a', 'vacant', 4000, 'listing-1'), room('b', 'vacant', null)],
    [occ('1', 'a', 3800, '2026-05-01')]
  )
  assert.strictEqual(s.monthlyIncome, 0)
  assert.strictEqual(s.vacantIncome, 4000)
  assert.strictEqual(s.unadvertisedVacant, 1)
})

test('currentOccupants groups only people still living in each room', () => {
  const live = currentOccupants([occ('1', 'a', 1), occ('2', 'a', 1, '2026-02-01'), occ('3', 'b', 1)])
  assert.strictEqual(live.get('a')?.length, 1)
  assert.strictEqual(live.get('b')?.length, 1)
})

test('addRoomPhoto and removeRoomPhoto manage per-room picture galleries correctly', () => {
  let r = room('room-1', 'vacant', 2500)
  assert.strictEqual(r.photos?.length ?? 0, 0)

  r = addRoomPhoto(r, 'https://cdn.example.com/room1_bed.jpg')
  r = addRoomPhoto(r, 'https://cdn.example.com/room1_window.jpg')
  // duplicate photo URL ignored
  r = addRoomPhoto(r, 'https://cdn.example.com/room1_bed.jpg')

  assert.strictEqual(r.photos?.length, 2)
  assert.strictEqual(r.photos?.[0], 'https://cdn.example.com/room1_bed.jpg')

  r = removeRoomPhoto(r, 'https://cdn.example.com/room1_bed.jpg')
  assert.strictEqual(r.photos?.length, 1)
  assert.strictEqual(r.photos?.[0], 'https://cdn.example.com/room1_window.jpg')
})

test('addRoomIssue and toggleRoomIssueResolved track known room issues and defects', () => {
  let r = room('room-2', 'vacant', 3200)
  r = addRoomIssue(r, 'Window latch loose on north wall', 'medium')
  r = addRoomIssue(r, 'Damp stain near skirting board', 'high')

  assert.strictEqual(r.issues?.length, 2)
  assert.strictEqual(r.issues?.[0].description, 'Window latch loose on north wall')
  assert.strictEqual(r.issues?.[0].resolved, false)

  const issueId = r.issues![0].id
  r = toggleRoomIssueResolved(r, issueId)
  assert.strictEqual(r.issues?.[0].resolved, true)

  const s = summariseRooms([r], [])
  assert.strictEqual(s.activeIssues, 1) // only 1 unresolved issue remains
})
