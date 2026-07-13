import test from 'node:test'
import assert from 'node:assert'
import * as db from './dbMappers'

// Every write payload must only contain columns that exist in
// resident_schema.sql — unknown keys make PostgREST reject the whole write
// (the original cause of "the UI says saved but nothing persists").
const assertKeysInSchema = (table: string, row: db.DbRow | null) => {
  assert.ok(row, `${table}: mapper returned null for a valid input`)
  const allowed = db.SCHEMA_COLUMNS[table]
  assert.ok(allowed, `${table}: missing from SCHEMA_COLUMNS`)
  for (const key of Object.keys(row)) {
    assert.ok(allowed.includes(key), `${table}: column "${key}" does not exist in the schema`)
  }
}

const UID = '4e36eee4-5310-437c-a19e-2270a147e260'
const UID2 = 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d'

test('toUUID passes real UUIDs through and hashes app ids deterministically', () => {
  assert.strictEqual(db.toUUID(UID.toUpperCase()), UID)
  const hashed = db.toUUID('listing-123')
  assert.match(hashed, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  assert.strictEqual(db.toUUID('listing-123'), hashed)
})

test('base table payloads only use real schema columns', () => {
  assertKeysInSchema('res_profiles', db.profileToRow({
    bio: 'b', gender: 'any', childrenCount: 0, employmentStatus: 'e', hasPets: false
  }))
  assertKeysInSchema('res_profiles', db.preferencesToRow({
    genderPreference: 'any', childrenAllowed: true, maxChildren: 1, smokingAllowed: false, petsAllowed: false
  }))
  assertKeysInSchema('res_listings', db.listingToRow({
    id: 'listing-1', title: 't', description: 'd', price: 100, currency: 'ZAR',
    location: 'l', suburb: 's', safetyRating: 'high', safetyNotes: '',
    landlordId: UID, landlordName: 'NAME MUST NOT LEAK', landlordLivesHere: true, images: [],
    amenities: { wifi: true, parking: false, bathroom: 'shared' },
    requirements: { genderPreference: 'any', childrenAllowed: true, maxChildren: 0, smokingAllowed: false, petsAllowed: false }
  }))
  assertKeysInSchema('res_room_requests', db.requestToRow({
    id: 'req-1', tenantId: UID, tenantName: 'x', listingId: 'listing-1', listingTitle: 'x',
    landlordId: UID2, status: 'pending', message: 'm', timestamp: '2026-01-01'
  }))
  assertKeysInSchema('res_roommate_seekers', db.seekerToRow({
    id: UID, name: 'x', gender: 'men', childrenCount: 0, budget: 100, currency: 'ZAR',
    location: 'l', suburb: 's', bio: 'b'
  }))
  assertKeysInSchema('res_lift_clubs', db.liftToRow({
    id: 'lift-1', driverName: 'x', origin: 'a', destination: 'b', departureTime: '07:00',
    days: 'Mon', pricePerSeat: 20, currency: 'ZAR', availableSeats: 3, totalSeats: 4
  }, UID))
  assertKeysInSchema('res_handyman_services', db.serviceToRow({
    id: 'svc-1', ownerId: UID, businessName: 'b', category: 'Plumbing', location: 'l', suburb: 's',
    rating: 5, contactNumber: '0', priceEstimate: 'R100', description: 'd', image: '', reviewsCount: 0
  }))
  assertKeysInSchema('res_service_dispatches', db.dispatchToRow({
    id: 'disp-1', serviceId: 'svc-1', serviceName: 'x', senderId: UID, senderName: 'x',
    senderRole: 'tenant', message: 'm', status: 'pending', timestamp: '2026-01-01'
  }))
  assertKeysInSchema('res_tool_library', db.toolToRow({
    id: 'tool-1', ownerId: UID, ownerName: 'x', title: 't', description: 'd', pricePerDay: 10,
    currency: 'ZAR', deposit: 0, location: 'l', status: 'available'
  }))
  assertKeysInSchema('res_tool_library', db.toolRentToRow(UID, '2026-02-01'))
  assertKeysInSchema('res_tool_library', db.toolReturnToRow())
  assertKeysInSchema('res_notice_events', db.noticeToRow({
    id: 'not-1', title: 't', description: 'd', type: 'event', postedBy: 'x', postedById: UID,
    timestamp: '2026-01-01', eventDate: '2026-02-01', rsvps: []
  }))
})

test('utility voucher payloads translate status and never store codes', () => {
  const row = db.tokenToRow({
    id: 'tok-1', landlordId: UID, landlordName: 'x', meterNumber: 'MTR-1', price: 100,
    currency: 'ZAR', tokenCode: 'SECRET-CODE', status: 'sold'
  })
  assertKeysInSchema('res_utility_tokens', row)
  assert.strictEqual(row.status, 'claimed')
  assert.strictEqual(row.meter_label, 'MTR-1')
  assert.ok(!JSON.stringify(row).includes('SECRET-CODE'), 'voucher code must never reach the DB')

  const claim = db.tokenClaimToRow(UID, '2026-01-01')
  assertKeysInSchema('res_utility_tokens', claim)
  assert.strictEqual(claim.status, 'claimed')
  assert.strictEqual(claim.claimed_by, UID)
})

test('chores require a household listing_id', () => {
  const withListing = db.choreToRow({
    id: 'chore-1', listingId: 'listing-1', roommateId: UID, roommateName: 'x',
    taskName: 'Dishes', dayOfWeek: 'Mon', status: 'pending'
  })
  assertKeysInSchema('res_chore_schedule', withListing)

  const withoutListing = db.choreToRow({
    id: 'chore-2', roommateId: UID, roommateName: 'x',
    taskName: 'Dishes', dayOfWeek: 'Mon', status: 'pending'
  })
  assert.strictEqual(withoutListing, null)
})

test('dispute payloads never send placeholder ids to profiles FK columns', () => {
  // The dispute form types the accused as free text and hardcodes a mediator;
  // hashing those to UUIDs would violate res_community_disputes' FKs.
  const row = db.disputeToRow({
    id: 'disp-1', title: 't', description: 'd', category: 'Noise',
    reportedBy: 'x', reportedById: UID,
    againstUser: 'Free Text Name', againstUserId: 'against-1783952342',
    mediatorId: 'landlord-1', mediatorName: 'Amahle', status: 'pending',
    timestamp: '7/13/2026'
  })
  assertKeysInSchema('res_community_disputes', row)
  assert.strictEqual(row.against_user_id, null)
  assert.strictEqual(row.mediator_id, null)
  assert.strictEqual(row.reported_by_id, UID)
  // locale date strings must be normalised for the timestamptz column
  assert.match(String(row.created_at), /^\d{4}-\d{2}-\d{2}T/)
  assertKeysInSchema('res_community_disputes', db.disputeStatusToRow('resolved', 'sorted'))
})

test('phase 4 community payloads only use real schema columns', () => {
  assertKeysInSchema('res_communities', db.communityToRow({
    id: 'com-1', name: 'n', description: 'd', location: 'l', suburb: 's', createdBy: UID, createdAt: '2026-01-01'
  }))
  const alert = db.alertToRow({
    id: 'al-1', title: 't', description: 'd', category: 'security', severity: 'panic',
    status: 'active', createdBy: UID, createdAt: '2026-01-01', lat: 0, lon: 0
  })
  assertKeysInSchema('res_alerts', alert)
  assert.strictEqual(alert.kind, 'panic')
  assert.strictEqual(alert.severity, 'critical')

  const market = db.marketItemToRow({
    id: 'mk-1', title: 't', description: 'd', price: 10, currency: 'ZAR', category: 'c',
    imageUrl: 'http://x/img.png', status: 'sold', createdBy: UID, createdAt: '2026-01-01'
  })
  assertKeysInSchema('res_market_items', market)
  assert.strictEqual(market.status, 'gone')
  assert.deepStrictEqual(market.images, ['http://x/img.png'])

  const vendor = db.vendorToRow({
    id: 'v-1', name: 'n', category: 'Spaza', description: 'd', contactNumber: '0',
    status: 'active', rating: 5, reviewsCount: 0
  }, UID)
  assertKeysInSchema('res_vendors', vendor)
  assert.strictEqual(vendor.kind, 'spaza')

  const gb = db.groupBuyToRow({
    id: 'gb-1', title: 't', description: 'd', targetAmount: 10, currentPledges: 2,
    status: 'open', createdBy: UID, endDate: '2026-03-01'
  })
  assertKeysInSchema('res_group_buys', gb)
  assert.strictEqual(gb.target_quantity, 10)
  assert.strictEqual(gb.deadline, '2026-03-01')
  assertKeysInSchema('res_group_buys', db.groupBuyProgressToRow(5))
  assertKeysInSchema('res_group_buy_pledges', db.pledgeToRow('gb-1', UID, 3))

  assertKeysInSchema('res_skills', db.skillToRow({
    id: 'sk-1', userId: UID, title: 't', category: 'c', description: 'd', experienceLevel: 'x', contactInfo: 'x'
  }))

  const lf = db.lostFoundToRow({
    id: 'lf-1', title: 't', description: 'd', type: 'lost', location: 'Park',
    contactInfo: 'x', status: 'resolved'
  }, UID)
  assertKeysInSchema('res_lost_found', lf)
  assert.strictEqual(lf.kind, 'lost')
  assert.strictEqual(lf.status, 'reunited')
  assert.strictEqual(lf.last_seen, 'Park')

  const sr = db.sharedResourceToRow({
    id: 'sr-1', name: 'n', type: 'hotspot', status: 'open', description: 'd',
    location: 'l', latitude: 1, longitude: 2
  }, UID)
  assertKeysInSchema('res_shared_resources', sr)
  assert.strictEqual(sr.kind, 'wifi_hotspot')

  const ns = db.neighbourhoodStatusToRow({
    id: 'ns-1', service: 'electricity', status: 'outage', suburb: 's', updatedAt: '2026-01-01'
  }, UID)
  assertKeysInSchema('res_neighbourhood_status', ns)
  assert.strictEqual(ns.kind, 'power')
  assert.strictEqual(ns.status, 'down')
})

test('name helpers resolve via the profiles map', () => {
  const nameMap: db.NameMap = { [UID]: 'Thandi' }
  assert.strictEqual(db.resolveName(nameMap, UID), 'Thandi')
  assert.strictEqual(db.resolveName(nameMap, UID2), '')
  assert.strictEqual(db.resolveName(nameMap, undefined), '')
  assert.deepStrictEqual(db.uuidsToNames([UID, UID2], nameMap), ['Thandi', UID2])
  assert.deepStrictEqual(db.uuidsToNames(null, nameMap), [])
})
