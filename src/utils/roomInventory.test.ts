import test from 'node:test'
import assert from 'node:assert'
import {
  isCurrentOccupant, occupantDisplayName, sortRoomsForLandlord,
  vacancySummary, tooManyPhotos, MAX_ROOM_PHOTOS,
  type Room, type RoomOccupant
} from './roomInventory'

const room = (over: Partial<Room> = {}): Room => ({
  id: 'r1', propertyId: 'p1', landlordId: 'l1', label: 'Back room',
  photos: [], price: 2500, currency: 'ZAR', advantages: null, disadvantages: null,
  priceNote: null, status: 'vacant', listingId: null, createdAt: '2026-01-01T00:00:00.000Z',
  ...over
})

const occupant = (over: Partial<RoomOccupant> = {}): RoomOccupant => ({
  id: 'o1', roomId: 'r1', tenantId: null, occupantNameRaw: null,
  movedInAt: '2026-01-01T00:00:00.000Z', movedOutAt: null,
  rentAmount: null, notes: null, visibility: 'landlord_only',
  ...over
})

test('isCurrentOccupant reads the DB fact directly — no clock math needed', () => {
  assert.strictEqual(isCurrentOccupant(occupant()), true)
  assert.strictEqual(isCurrentOccupant(occupant({ movedOutAt: '2026-02-01T00:00:00.000Z' })), false)
})

test('occupantDisplayName prefers the linked resident\'s real name over a typo-prone free-text field', () => {
  const nameOf = (id: string) => (id === 'u1' ? 'Thandi' : '')
  assert.strictEqual(occupantDisplayName(occupant({ tenantId: 'u1' }), nameOf), 'Thandi')
  // Linked but the name lookup came back empty (e.g. profile still loading).
  assert.strictEqual(occupantDisplayName(occupant({ tenantId: 'u2' }), nameOf), 'A resident')
  // Not on the app at all — whatever the landlord typed.
  assert.strictEqual(occupantDisplayName(occupant({ occupantNameRaw: 'Sipho' }), nameOf), 'Sipho')
  assert.strictEqual(occupantDisplayName(occupant(), nameOf), 'Unnamed occupant')
})

test('sortRoomsForLandlord puts vacant rooms first — those are the ones needing action', () => {
  const rooms = [
    room({ id: 'a', label: 'Zed room', status: 'occupied' }),
    room({ id: 'b', label: 'Back room', status: 'vacant' }),
    room({ id: 'c', label: 'Front room', status: 'vacant' }),
    room({ id: 'd', label: 'Attic', status: 'occupied' })
  ]
  const order = sortRoomsForLandlord(rooms).map(r => r.id)
  // Vacant rooms first (b, c — alphabetical by label), then occupied rooms
  // (d "Attic", a "Zed room" — also alphabetical).
  assert.deepStrictEqual(order, ['b', 'c', 'd', 'a'])
})

test('vacancySummary counts vacant rooms out of the total', () => {
  const rooms = [room({ status: 'vacant' }), room({ status: 'occupied' }), room({ status: 'vacant' })]
  assert.deepStrictEqual(vacancySummary(rooms), { vacant: 2, total: 3 })
  assert.deepStrictEqual(vacancySummary([]), { vacant: 0, total: 0 })
})

test('tooManyPhotos mirrors the DB cap so the UI can refuse before a round trip', () => {
  assert.strictEqual(MAX_ROOM_PHOTOS, 6)
  assert.strictEqual(tooManyPhotos(Array(6).fill('x')), false)
  assert.strictEqual(tooManyPhotos(Array(7).fill('x')), true)
  assert.strictEqual(tooManyPhotos([]), false)
})
