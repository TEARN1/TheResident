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
    requirements: { genderPreference: 'any', childrenAllowed: true, maxChildren: 0, smokingAllowed: false, petsAllowed: false },
    listingType: 'rent'
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
    id: 'lift-1', driverId: 'u1', driverName: 'x', origin: 'a', destination: 'b', departureTime: '07:00',
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
    id: 'com-1', name: 'n', kind: 'street', description: 'd', location: 'l', suburb: 's', createdBy: UID, createdAt: '2026-01-01'
  }))
  const alert = db.alertToRow({
    id: 'al-1', title: 't', description: 'd', kind: 'panic', category: 'security', severity: 'panic',
    status: 'active', suburb: 'Ivory Park', createdBy: UID, createdAt: '2026-01-01', lat: 0, lon: 0
  })
  assertKeysInSchema('res_alerts', alert)
  assert.strictEqual(alert.kind, 'panic')
  assert.strictEqual(alert.severity, 'critical')

  const market = db.marketItemToRow({
    id: 'mk-1', title: 't', description: 'd', price: 10, currency: 'ZAR', category: 'c', suburb: 'Ivory Park',
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
    id: 'ns-1', service: 'electricity', status: 'outage', suburb: 's', updatedAt: '2026-01-01',
    startsAt: '2026-01-01', endsAt: null, source: 'crowd', providerId: null
  }, UID)
  assertKeysInSchema('res_neighbourhood_status', ns)
  assert.strictEqual(ns.kind, 'power')
  assert.strictEqual(ns.status, 'down')

  const tr = db.trafficToRow({
    id: 'tr-1', reporterId: UID, suburb: 's', city: 'c', lat: 1, lon: 2,
    reportType: 'congestion', description: 'd'
  })
  assertKeysInSchema('res_traffic_reports', tr)
  assert.strictEqual(tr.report_type, 'congestion')
})

test('name helpers resolve via the profiles map', () => {
  const nameMap: db.NameMap = { [UID]: 'Thandi' }
  assert.strictEqual(db.resolveName(nameMap, UID), 'Thandi')
  assert.strictEqual(db.resolveName(nameMap, UID2), '')
  assert.strictEqual(db.resolveName(nameMap, undefined), '')
  assert.deepStrictEqual(db.uuidsToNames([UID, UID2], nameMap), ['Thandi', UID2])
  assert.deepStrictEqual(db.uuidsToNames(null, nameMap), [])
})

test('rowToListing maps a res_listings row the same way for both the full sync and a realtime refetch', () => {
  const nameOf = (id: string | null | undefined) => (id === UID ? 'Thandi Landlord' : '')
  const row: db.DbRow = {
    id: 'listing-1', landlord_id: UID, title: 'Sunny room', description: null,
    price: '1500', currency: 'ZAR', location: 'Midrand', suburb: 'Ivory Park',
    safety_rating: 'high', safety_notes: null, landlord_lives_here: true,
    images: ['a.jpg'], wifi: true, parking: false, bathroom: 'shared',
    req_gender_pref: 'any', req_children_allowed: true, req_max_children: 1,
    req_smoking_allowed: false, req_pets_allowed: false,
    lat: '-25.98', lon: '28.13', listing_type: 'sale', quick_post: true,
    created_at: '2026-01-01T00:00:00.000Z'
  }

  const listing = db.rowToListing(row, nameOf)

  assert.strictEqual(listing.id, 'listing-1')
  assert.strictEqual(listing.landlordName, 'Thandi Landlord')
  assert.strictEqual(listing.price, 1500)
  assert.strictEqual(listing.lat, -25.98)
  assert.strictEqual(listing.listingType, 'sale')
  assert.strictEqual(listing.amenities.wifi, true)
  assert.strictEqual(listing.requirements.maxChildren, 1)
  assert.strictEqual(listing.quickPost, true)

  // Round-tripping through listingToRow must stay a subset of the real schema
  // columns — guards against the read mapper drifting from what dbUpdate can write.
  assertKeysInSchema('res_listings', db.listingToRow(listing))
})

test('rowToLift / rowToToken / rowToTool resolve names and status codes from a row', () => {
  const nameOf = (id: string | null | undefined) => (id === UID ? 'Thandi' : '')

  const lift = db.rowToLift({
    id: 'lift-1', driver_id: UID, origin: 'A', destination: 'B',
    price_per_seat: '25', available_seats: 2, total_seats: 4
  }, nameOf)
  assert.strictEqual(lift.driverName, 'Thandi')
  assert.strictEqual(lift.pricePerSeat, 25)
  assertKeysInSchema('res_lift_clubs', db.liftToRow(lift, UID))

  const token = db.rowToToken({
    id: 'tok-1', landlord_id: UID, meter_label: 'MTR-1', price: '100', status: 'claimed', claimed_by: UID2
  }, nameOf)
  assert.strictEqual(token.status, 'sold')
  assert.strictEqual(token.landlordName, 'Thandi')
  assertKeysInSchema('res_utility_tokens', db.tokenToRow(token))

  const tool = db.rowToTool({
    id: 'tool-1', owner_id: UID, title: 'Drill', price_per_day: '50', status: 'rented', rented_by: UID2
  }, nameOf)
  assert.strictEqual(tool.status, 'rented')
  assert.strictEqual(tool.ownerName, 'Thandi')
  assertKeysInSchema('res_tool_library', db.toolToRow(tool))
})

test('rowToNotice resolves postedBy and reaction uuid arrays via the name map', () => {
  const nameMap: db.NameMap = { [UID]: 'Thandi', [UID2]: 'Sipho' }
  const nameOf = (id: string | null | undefined) => db.resolveName(nameMap, id)
  const notice = db.rowToNotice({
    id: 'notice-1', title: 'Braai', type: 'event', posted_by_id: UID,
    rsvps: [UID, UID2], vibes: [UID], echos: []
  }, nameOf, nameMap)
  assert.strictEqual(notice.postedBy, 'Thandi')
  assert.deepStrictEqual(notice.rsvps, ['Thandi', 'Sipho'])
  assert.deepStrictEqual(notice.vibes, ['Thandi'])
  assertKeysInSchema('res_notice_events', db.noticeToRow(notice))
})

test('rowToAlert / rowToMarketItem / rowToNeighbourhoodStatus translate DB codes to app enums', () => {
  const alert = db.rowToAlert({
    id: 'alert-1', title: 'Break-in', kind: 'panic', severity: 'critical', status: 'active', user_id: UID
  })
  assert.strictEqual(alert.severity, 'panic')
  assert.strictEqual(alert.category, 'security')
  assertKeysInSchema('res_alerts', db.alertToRow(alert))

  const item = db.rowToMarketItem({
    id: 'mi-1', title: 'Bicycle', status: 'available', user_id: UID, images: ['bike.jpg']
  })
  assert.strictEqual(item.status, 'available')
  assert.strictEqual(item.imageUrl, 'bike.jpg')
  assertKeysInSchema('res_market_items', db.marketItemToRow(item))

  const ns = db.rowToNeighbourhoodStatus({
    id: 'ns-1', kind: 'power', status: 'down', suburb: 'Ivory Park'
  })
  assert.strictEqual(ns.service, 'electricity')
  assert.strictEqual(ns.status, 'outage')
  assertKeysInSchema('res_neighbourhood_status', db.neighbourhoodStatusToRow(ns, UID))
})

test('rowToRequest and rowToDispatch resolve cross-referenced titles/names via injected lookups', () => {
  const nameOf = (id: string | null | undefined) => (id === UID ? 'Thandi' : '')

  const req = db.rowToRequest(
    { id: 'req-1', tenant_id: UID, listing_id: 'listing-1', landlord_id: UID2, status: 'approved' },
    nameOf,
    id => (id === 'listing-1' ? 'Sunny Room' : '')
  )
  assert.strictEqual(req.tenantName, 'Thandi')
  assert.strictEqual(req.listingTitle, 'Sunny Room')
  assertKeysInSchema('res_room_requests', db.requestToRow(req))

  const disp = db.rowToDispatch(
    { id: 'disp-1', service_id: 'svc-1', sender_id: UID, status: 'accepted' },
    nameOf,
    id => (id === 'svc-1' ? 'Sipho Plumbers' : '')
  )
  assert.strictEqual(disp.senderName, 'Thandi')
  assert.strictEqual(disp.serviceName, 'Sipho Plumbers')
  assertKeysInSchema('res_service_dispatches', db.dispatchToRow(disp))
})

test('rowToRoommate / rowToChore / rowToDispute resolve names from a row', () => {
  const nameOf = (id: string | null | undefined) => (id === UID ? 'Thandi' : '')

  const roommate = db.rowToRoommate({ id: UID, gender: 'women', budget: '2000', suburb: 'Ivory Park' }, nameOf)
  assert.strictEqual(roommate.name, 'Thandi')
  assertKeysInSchema('res_roommate_seekers', db.seekerToRow(roommate))

  const chore = db.rowToChore({ id: 'chore-1', listing_id: 'listing-1', roommate_id: UID, task_name: 'Dishes', status: 'pending' }, nameOf)
  assert.strictEqual(chore.roommateName, 'Thandi')
  assertKeysInSchema('res_chore_schedule', db.choreToRow(chore))

  const dispute = db.rowToDispute({ id: 'dispute-1', title: 'Noise', reported_by_id: UID, status: 'pending' }, nameOf)
  assert.strictEqual(dispute.reportedBy, 'Thandi')
  assertKeysInSchema('res_community_disputes', db.disputeToRow(dispute))
})

test('rowToCommunity / rowToVendor / rowToGroupBuy / rowToSkill / rowToLostFound map without a name lookup', () => {
  const community = db.rowToCommunity({ id: 'c-1', name: 'Ivory Park', kind: 'suburb', suburb: 'Ivory Park', created_by: UID })
  assert.strictEqual(community.name, 'Ivory Park')
  assertKeysInSchema('res_communities', db.communityToRow(community))

  const vendor = db.rowToVendor({ id: 'v-1', name: 'Spaza Shop', kind: 'spaza' })
  assert.strictEqual(vendor.category, 'spaza')
  assertKeysInSchema('res_vendors', db.vendorToRow(vendor, UID))

  const gb = db.rowToGroupBuy({ id: 'gb-1', title: 'Bulk rice', organizer_id: UID, status: 'open', target_quantity: 10, current_quantity: 2 })
  assert.strictEqual(gb.targetAmount, 10)
  assertKeysInSchema('res_group_buys', db.groupBuyToRow(gb))

  const skill = db.rowToSkill({ id: 's-1', user_id: UID, title: 'Tutoring', category: 'education' })
  assert.strictEqual(skill.category, 'education')
  assertKeysInSchema('res_skills', db.skillToRow(skill))

  const lf = db.rowToLostFound({ id: 'lf-1', title: 'Lost cat', kind: 'lost', status: 'reunited', images: ['cat.jpg'] })
  assert.strictEqual(lf.status, 'resolved')
  assert.strictEqual(lf.imageUrl, 'cat.jpg')
  assertKeysInSchema('res_lost_found', db.lostFoundToRow(lf, UID))
})

test('rowToCareCircle / rowToSharedResource / rowToTrafficReport map DB rows into app models', () => {
  const nameOf = (id: string | null | undefined) => (id === UID ? 'Thandi' : '')
  const care = db.rowToCareCircle({ id: 'care-1', subject_id: UID, carer_id: UID2, status: 'active' }, nameOf)
  assert.strictEqual(care.name, 'Thandi')
  assert.strictEqual(care.status, 'ok')

  const sr = db.rowToSharedResource({ id: 'sr-1', title: 'Borehole', kind: 'borehole', lat: '1', lon: '2' })
  assert.strictEqual(sr.type, 'borehole')
  assertKeysInSchema('res_shared_resources', db.sharedResourceToRow(sr, UID))

  const tr = db.rowToTrafficReport({ id: 'tr-1', reporter_id: UID, lat: '1', lon: '2', report_type: 'congestion' })
  assert.strictEqual(tr.reportType, 'congestion')
  assertKeysInSchema('res_traffic_reports', db.trafficToRow(tr))
})
