// Write-side mappers between the app's Redux models and the deployed Supabase
// schema (resident_schema.sql — the source of truth; RLS policies are written
// against it, and CONTRACT.md shares the project with The Gruvs).
//
// Every payload sent through dbUpdate MUST be produced here so its keys stay a
// subset of the table's real columns (dbMappers.test.ts asserts this against
// SCHEMA_COLUMNS). Denormalized display names (landlordName, tenantName, …)
// live only in Redux — the DB stores UUIDs and reads resolve names via the
// shared profiles trust columns (display_name / username, per CONTRACT.md §3).

import type {
  Listing,
  RoomRequest,
  RoommateSeeker,
  LiftClub,
  HandymanService,
  ServiceDispatch,
  UtilityToken,
  ToolItem,
  ChoreAssignment,
  CommunityDispute,
  NoticeEvent,
  Community,
  Alert,
  MarketItem,
  Vendor,
  GroupBuy,
  Skill,
  LostFound,
  SharedResource,
  NeighbourhoodStatus,
  UserProfile,
  LandlordPreferences
} from './index'

// Helper function to convert any string ID to a deterministic valid UUID format
export function toUUID(str: string): string {
  if (!str) return '00000000-0000-4000-8000-000000000000'
  const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/
  if (uuidRegex.test(str)) {
    return str.toLowerCase()
  }

  let h1 = 1540483477
  let h2 = 2246822507
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    h1 = Math.imul(h1 ^ char, 597399067)
    h2 = Math.imul(h2 ^ char, 2869860233)
  }

  const hex1 = (h1 >>> 0).toString(16).padStart(8, '0')
  const hex2 = (h2 >>> 0).toString(16).padStart(8, '0')
  const hex3 = (Math.imul(h1, h2) >>> 0).toString(16).padStart(8, '0')
  const hex4 = ((h1 + h2) >>> 0).toString(16).padStart(8, '0')

  const fullHex = (hex1 + hex2 + hex3 + hex4).substring(0, 32)

  const part1 = fullHex.substring(0, 8)
  const part2 = fullHex.substring(8, 12)
  const part3 = '4' + fullHex.substring(13, 16)
  const part4 = ((parseInt(fullHex.substring(16, 18), 16) & 0x3f) | 0x80).toString(16).padStart(2, '0') + fullHex.substring(18, 20)
  const part5 = fullHex.substring(20, 32)

  return `${part1}-${part2}-${part3}-${part4}-${part5}`.toLowerCase()
}

// UUID → display name lookup built from public.profiles trust columns.
export type NameMap = Record<string, string>

export const resolveName = (nameMap: NameMap, id: string | null | undefined): string =>
  (id && nameMap[toUUID(id)]) || ''

export const uuidsToNames = (ids: unknown, nameMap: NameMap): string[] =>
  Array.isArray(ids) ? ids.map(id => nameMap[String(id)] || String(id)) : []

export type DbRow = Record<string, unknown>

// Some UI handlers stamp rows with toLocaleDateString() ("7/13/2026"), which is
// locale-dependent for a timestamptz column. Normalise to ISO, or let the DB
// default to now() when the value can't be parsed.
const toISO = (value: string | undefined): string => {
  const parsed = value ? new Date(value) : new Date()
  return isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString()
}

// ── Base tables ───────────────────────────────────────────────────────────────

export const profileToRow = (profile: UserProfile): DbRow => ({
  bio: profile.bio,
  gender: profile.gender,
  children_count: profile.childrenCount,
  employment_status: profile.employmentStatus,
  has_pets: profile.hasPets,
  verification_doc_url: profile.verificationDocUrl || null,
  updated_at: new Date().toISOString()
})

export const preferencesToRow = (preferences: LandlordPreferences): DbRow => ({
  landlord_gender_pref: preferences.genderPreference,
  landlord_children_allowed: preferences.childrenAllowed,
  landlord_max_children: preferences.maxChildren,
  landlord_smoking_allowed: preferences.smokingAllowed,
  landlord_pets_allowed: preferences.petsAllowed,
  updated_at: new Date().toISOString()
})

export const listingToRow = (listing: Listing): DbRow => ({
  id: toUUID(listing.id),
  landlord_id: toUUID(listing.landlordId),
  title: listing.title,
  description: listing.description,
  price: listing.price,
  currency: listing.currency,
  location: listing.location,
  suburb: listing.suburb,
  safety_rating: listing.safetyRating,
  safety_notes: listing.safetyNotes,
  landlord_lives_here: listing.landlordLivesHere,
  images: listing.images,
  wifi: listing.amenities.wifi,
  parking: listing.amenities.parking,
  bathroom: listing.amenities.bathroom,
  req_gender_pref: listing.requirements.genderPreference,
  req_children_allowed: listing.requirements.childrenAllowed,
  req_max_children: listing.requirements.maxChildren,
  req_smoking_allowed: listing.requirements.smokingAllowed,
  req_pets_allowed: listing.requirements.petsAllowed
})

export const requestToRow = (req: RoomRequest): DbRow => ({
  id: toUUID(req.id),
  tenant_id: toUUID(req.tenantId),
  listing_id: toUUID(req.listingId),
  landlord_id: toUUID(req.landlordId),
  status: req.status,
  message: req.message,
  created_at: toISO(req.timestamp)
})

export const seekerToRow = (seeker: RoommateSeeker): DbRow => ({
  id: toUUID(seeker.id),
  gender: seeker.gender,
  children_count: seeker.childrenCount,
  budget: seeker.budget,
  currency: seeker.currency,
  location: seeker.location,
  suburb: seeker.suburb,
  bio: seeker.bio
})

export const liftToRow = (lift: LiftClub, driverId: string): DbRow => ({
  id: toUUID(lift.id),
  driver_id: toUUID(driverId),
  origin: lift.origin,
  destination: lift.destination,
  departure_time: lift.departureTime,
  days: lift.days,
  price_per_seat: lift.pricePerSeat,
  currency: lift.currency,
  available_seats: lift.availableSeats,
  total_seats: lift.totalSeats
})

export const serviceToRow = (service: HandymanService): DbRow => ({
  id: toUUID(service.id),
  owner_id: toUUID(service.ownerId),
  business_name: service.businessName,
  category: service.category,
  location: service.location,
  suburb: service.suburb,
  rating: service.rating,
  contact_number: service.contactNumber,
  website_url: service.websiteUrl || null,
  price_estimate: service.priceEstimate,
  description: service.description,
  image: service.image,
  reviews_count: service.reviewsCount
})

export const dispatchToRow = (disp: ServiceDispatch): DbRow => ({
  id: toUUID(disp.id),
  service_id: toUUID(disp.serviceId),
  sender_id: toUUID(disp.senderId),
  message: disp.message,
  status: disp.status,
  proof_file_url: disp.proofFileUrl || null,
  created_at: toISO(disp.timestamp)
})

// App status 'sold' maps to schema status 'claimed' (broker posture: vouchers
// are trade advertisements — no token codes are ever stored, see CONTRACT.md §6).
export const tokenToRow = (token: UtilityToken): DbRow => ({
  id: toUUID(token.id),
  landlord_id: toUUID(token.landlordId),
  meter_label: token.meterNumber,
  price: token.price,
  currency: token.currency,
  status: token.status === 'sold' ? 'claimed' : 'available'
})

export const tokenClaimToRow = (buyerId: string, timestamp: string): DbRow => ({
  status: 'claimed',
  claimed_by: toUUID(buyerId),
  claimed_at: timestamp
})

export const toolToRow = (tool: ToolItem): DbRow => ({
  id: toUUID(tool.id),
  owner_id: toUUID(tool.ownerId),
  title: tool.title,
  description: tool.description,
  price_per_day: tool.pricePerDay,
  currency: tool.currency,
  deposit: tool.deposit,
  location: tool.location,
  status: tool.status
})

export const toolRentToRow = (rentedBy: string, rentedUntil: string): DbRow => ({
  status: 'rented',
  rented_by: toUUID(rentedBy),
  rented_until: rentedUntil
})

export const toolReturnToRow = (): DbRow => ({
  status: 'available',
  rented_by: null,
  rented_until: null
})

// listing_id is NOT NULL and drives the res_is_household_member RLS check —
// chores without a household listing cannot be persisted.
export const choreToRow = (chore: ChoreAssignment): DbRow | null => {
  if (!chore.listingId) return null
  return {
    id: toUUID(chore.id),
    listing_id: toUUID(chore.listingId),
    roommate_id: toUUID(chore.roommateId),
    task_name: chore.taskName,
    day_of_week: chore.dayOfWeek,
    status: chore.status
  }
}

// against_user_id / mediator_id are FKs to profiles(id), but the dispute form
// collects the accused as free text and assigns a placeholder mediator — those
// are not real accounts, so sending them would violate the FK. They stay null;
// the typed-in names remain Redux-only. (A real user-picker plus a wider
// res_disputes RLS policy would be needed for cross-user mediation.)
export const disputeToRow = (dispute: CommunityDispute): DbRow => ({
  id: toUUID(dispute.id),
  title: dispute.title,
  description: dispute.description,
  category: dispute.category,
  reported_by_id: toUUID(dispute.reportedById),
  against_user_id: null,
  mediator_id: null,
  status: dispute.status,
  created_at: toISO(dispute.timestamp)
})

export const disputeStatusToRow = (status: string, resolutionDetails?: string): DbRow => ({
  status,
  resolution_details: resolutionDetails || null
})

export const noticeToRow = (notice: NoticeEvent): DbRow => ({
  id: toUUID(notice.id),
  title: notice.title,
  description: notice.description,
  type: notice.type,
  posted_by_id: toUUID(notice.postedById),
  event_date: notice.eventDate || null,
  created_at: toISO(notice.timestamp)
})

// ── Phase 4 community tables ─────────────────────────────────────────────────

export const communityToRow = (c: Community): DbRow => ({
  id: toUUID(c.id),
  name: c.name,
  kind: 'suburb',
  suburb: c.suburb,
  created_by: toUUID(c.createdBy)
})

const ALERT_SEVERITY: Record<Alert['severity'], string> = {
  info: 'low',
  warning: 'medium',
  critical: 'high',
  panic: 'critical'
}

export const alertToRow = (a: Alert): DbRow => ({
  id: toUUID(a.id),
  user_id: toUUID(a.createdBy),
  kind: a.severity === 'panic' ? 'panic' : 'incident',
  title: a.title,
  description: a.description,
  severity: ALERT_SEVERITY[a.severity] || 'medium',
  status: a.status === 'resolved' ? 'resolved' : 'active',
  lat: a.lat,
  lon: a.lon
})

export const marketItemToRow = (m: MarketItem): DbRow => ({
  id: toUUID(m.id),
  user_id: toUUID(m.createdBy),
  title: m.title,
  description: m.description,
  category: m.category,
  price: m.price,
  currency: m.currency,
  images: m.imageUrl ? [m.imageUrl] : [],
  status: m.status === 'sold' ? 'gone' : 'available'
})

const VENDOR_KINDS = ['spaza', 'airtime', 'gas', 'food', 'produce'] as const

export const vendorToRow = (v: Vendor, userId: string): DbRow => ({
  id: toUUID(v.id),
  user_id: toUUID(userId),
  name: v.name,
  kind: (VENDOR_KINDS as readonly string[]).includes(v.category.toLowerCase())
    ? v.category.toLowerCase()
    : 'other',
  phone: v.contactNumber || null
})

export const groupBuyToRow = (g: GroupBuy): DbRow => ({
  id: toUUID(g.id),
  organizer_id: toUUID(g.createdBy),
  title: g.title,
  description: g.description,
  target_quantity: Math.max(1, Math.round(g.targetAmount)),
  current_quantity: Math.max(0, Math.round(g.currentPledges)),
  display_price: 0,
  status: g.status,
  deadline: g.endDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
})

export const groupBuyProgressToRow = (currentPledges: number): DbRow => ({
  current_quantity: Math.max(0, Math.round(currentPledges))
})

export const pledgeToRow = (groupBuyId: string, userId: string, amount: number): DbRow => ({
  id: toUUID(`pledge-${groupBuyId}-${userId}-${Date.now()}`),
  group_buy_id: toUUID(groupBuyId),
  user_id: toUUID(userId),
  quantity: Math.max(1, Math.round(amount))
})

export const skillToRow = (s: Skill): DbRow => ({
  id: toUUID(s.id),
  user_id: toUUID(s.userId),
  title: s.title,
  category: s.category,
  description: s.description
})

export const lostFoundToRow = (lf: LostFound, userId: string): DbRow => ({
  id: toUUID(lf.id),
  user_id: toUUID(userId),
  kind: lf.type,
  category: 'item',
  title: lf.title,
  description: lf.description,
  last_seen: lf.location || null,
  images: lf.imageUrl ? [lf.imageUrl] : [],
  status: lf.status === 'resolved' ? 'reunited' : 'open'
})

export const sharedResourceToRow = (sr: SharedResource, ownerId: string): DbRow => ({
  id: toUUID(sr.id),
  owner_id: toUUID(ownerId),
  kind: sr.type === 'hotspot' ? 'wifi_hotspot' : sr.type,
  title: sr.name,
  access_note: sr.description || null,
  availability: sr.status || null,
  lat: sr.latitude,
  lon: sr.longitude
})

const NS_KIND: Record<NeighbourhoodStatus['service'], string> = {
  electricity: 'power',
  water: 'water',
  other: 'network'
}

const NS_STATUS: Record<NeighbourhoodStatus['status'], string> = {
  active: 'up',
  restored: 'up',
  outage: 'down'
}

// Neighbourhood status is a crowd-signal log: every report inserts a new row.
export const neighbourhoodStatusToRow = (ns: NeighbourhoodStatus, reporterId: string): DbRow => ({
  id: toUUID(ns.id),
  reporter_id: toUUID(reporterId),
  kind: NS_KIND[ns.service] || 'network',
  status: NS_STATUS[ns.status] || 'up',
  suburb: ns.suburb
})

// ── Schema column allowlist (from resident_schema.sql) — used by tests ────────

export const SCHEMA_COLUMNS: Record<string, string[]> = {
  res_profiles: ['id', 'role', 'bio', 'gender', 'children_count', 'employment_status', 'has_pets', 'verification_doc_url', 'landlord_gender_pref', 'landlord_children_allowed', 'landlord_max_children', 'landlord_smoking_allowed', 'landlord_pets_allowed', 'created_at', 'updated_at'],
  res_listings: ['id', 'landlord_id', 'title', 'description', 'price', 'currency', 'location', 'suburb', 'city', 'lat', 'lon', 'safety_rating', 'safety_notes', 'landlord_lives_here', 'images', 'wifi', 'parking', 'bathroom', 'req_gender_pref', 'req_children_allowed', 'req_max_children', 'req_smoking_allowed', 'req_pets_allowed', 'status', 'created_at', 'updated_at'],
  res_room_requests: ['id', 'tenant_id', 'listing_id', 'landlord_id', 'status', 'message', 'created_at'],
  res_lift_clubs: ['id', 'driver_id', 'origin', 'destination', 'origin_lat', 'origin_lon', 'dest_lat', 'dest_lon', 'departure_time', 'days', 'price_per_seat', 'currency', 'available_seats', 'total_seats', 'event_id', 'purpose', 'carries_parcels', 'created_at', 'updated_at'],
  res_handyman_services: ['id', 'owner_id', 'business_name', 'category', 'location', 'suburb', 'city', 'lat', 'lon', 'rating', 'contact_number', 'website_url', 'price_estimate', 'description', 'image', 'reviews_count', 'created_at', 'updated_at'],
  res_service_dispatches: ['id', 'service_id', 'sender_id', 'message', 'status', 'proof_file_url', 'created_at'],
  res_utility_tokens: ['id', 'landlord_id', 'meter_label', 'price', 'currency', 'status', 'claimed_by', 'claimed_at', 'created_at'],
  res_tool_library: ['id', 'owner_id', 'title', 'description', 'price_per_day', 'currency', 'deposit', 'location', 'suburb', 'status', 'rented_by', 'rented_until', 'created_at', 'updated_at'],
  res_chore_schedule: ['id', 'listing_id', 'roommate_id', 'task_name', 'day_of_week', 'status', 'completed_at', 'created_at'],
  res_community_disputes: ['id', 'title', 'description', 'category', 'reported_by_id', 'against_user_id', 'mediator_id', 'status', 'resolution_details', 'created_at'],
  res_roommate_seekers: ['id', 'gender', 'children_count', 'budget', 'currency', 'location', 'suburb', 'bio', 'created_at', 'updated_at'],
  res_notice_events: ['id', 'title', 'description', 'type', 'posted_by_id', 'event_date', 'rsvps', 'vibes', 'echos', 'created_at'],
  res_communities: ['id', 'name', 'kind', 'suburb', 'city', 'lat', 'lon', 'radius_m', 'is_private', 'created_by', 'created_at'],
  res_alerts: ['id', 'user_id', 'kind', 'title', 'description', 'lat', 'lon', 'community_id', 'suburb', 'city', 'severity', 'status', 'created_at', 'resolved_at'],
  res_market_items: ['id', 'user_id', 'title', 'description', 'category', 'price', 'currency', 'condition', 'images', 'status', 'community_id', 'suburb', 'city', 'lat', 'lon', 'created_at', 'updated_at'],
  res_vendors: ['id', 'user_id', 'name', 'kind', 'sells', 'hours', 'contact_via_dm', 'phone', 'community_id', 'suburb', 'city', 'lat', 'lon', 'created_at', 'updated_at'],
  res_group_buys: ['id', 'organizer_id', 'title', 'description', 'target_quantity', 'current_quantity', 'display_price', 'currency', 'deadline', 'status', 'community_id', 'suburb', 'city', 'lat', 'lon', 'created_at', 'updated_at'],
  res_group_buy_pledges: ['id', 'group_buy_id', 'user_id', 'quantity', 'note', 'created_at'],
  res_skills: ['id', 'user_id', 'title', 'category', 'description', 'rate_note', 'availability', 'community_id', 'suburb', 'city', 'lat', 'lon', 'created_at', 'updated_at'],
  res_lost_found: ['id', 'user_id', 'kind', 'category', 'title', 'description', 'images', 'last_seen', 'status', 'community_id', 'suburb', 'city', 'lat', 'lon', 'created_at', 'updated_at'],
  res_care_circle: ['id', 'subject_id', 'carer_id', 'cadence', 'last_ok_at', 'status', 'note', 'created_at', 'updated_at'],
  res_shared_resources: ['id', 'owner_id', 'kind', 'title', 'access_note', 'availability', 'is_free', 'price_note', 'community_id', 'suburb', 'city', 'lat', 'lon', 'created_at', 'updated_at'],
  res_neighbourhood_status: ['id', 'reporter_id', 'kind', 'status', 'detail', 'community_id', 'suburb', 'city', 'lat', 'lon', 'created_at']
}
