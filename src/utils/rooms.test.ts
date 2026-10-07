import { test } from 'node:test'
import assert from 'node:assert'
import { summariseRooms, currentOccupants, type RoomRow, type OccupantRow } from './rooms'

const room = (id: string, status: RoomRow['status'], price: number | null, listing_id: string | null = null): RoomRow =>
  ({ id, label: id, price, currency: 'ZAR', status, listing_id })
const occ = (id: string, room_id: string, rent: number | null, moved_out_at: string | null = null): OccupantRow =>
  ({ id, room_id, occupant_name_raw: 'A', tenant_id: null, rent_amount: rent, moved_in_at: '2026-01-01', moved_out_at })

test('summariseRooms counts income from agreed rent, falling back to asking price', () => {
  const s = summariseRooms(
    [room('a', 'occupied', 4000), room('b', 'occupied', 5000), room('c', 'vacant', 3000)],
    [occ('1', 'a', 3800)]
  )
  assert.deepStrictEqual(s, { total: 3, occupied: 2, vacant: 1, monthlyIncome: 8800, vacantIncome: 3000, unadvertisedVacant: 1 })
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
