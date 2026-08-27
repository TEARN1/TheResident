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
  CareCircleCheck,
  UserProfile,
  LandlordPreferences,
  TrafficReport
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
  req_pets_allowed: listing.requirements.petsAllowed,
  lat: listing.lat || null,
  lon: listing.lon || null,
  approach_photo_url: listing.approachPhotoUrl || null,
  micro_landmark: listing.microLandmark || null,
  quick_post: !!listing.quickPost,
  listing_type: listing.listingType || 'rent',
  ...(listing.propertyId ? { property_id: toUUID(listing.propertyId) } : {}),
  ...(listing.eventId ? { event_id: toUUID(listing.eventId) } : {}),
  ...(listing.visibleUntil ? { visible_until: listing.visibleUntil } : {})
})

// Read-side counterpart of listingToRow, shared by fetchSupabaseData and
// fetchRealtimeTable so the row->Listing shape only exists in one place
// (previously duplicated between the two).
export const rowToListing = (item: DbRow, nameOf: (id: string | null | undefined) => string): Listing => ({
  id: item.id as string,
  title: item.title as string,
  description: (item.description as string) || '',
  price: Number(item.price),
  currency: (item.currency as string) || 'ZAR',
  location: item.location as string,
  suburb: (item.suburb as string) || '',
  safetyRating: ((item.safety_rating as string) || 'medium') as 'high' | 'medium' | 'low',
  safetyNotes: (item.safety_notes as string) || '',
  landlordId: item.landlord_id as string,
  landlordName: nameOf(item.landlord_id as string | null | undefined),
  landlordLivesHere: !!item.landlord_lives_here,
  images: (item.images as string[]) || [],
  amenities: {
    wifi: !!item.wifi,
    parking: !!item.parking,
    bathroom: ((item.bathroom as string) || 'shared') as 'shared' | 'private' | 'ensuite'
  },
  requirements: {
    genderPreference: ((item.req_gender_pref as string) || 'any') as 'men' | 'women' | 'couple' | 'any',
    childrenAllowed: !!item.req_children_allowed,
    maxChildren: (item.req_max_children as number) || 0,
    smokingAllowed: !!item.req_smoking_allowed,
    petsAllowed: !!item.req_pets_allowed
  },
  lat: item.lat ? Number(item.lat) : undefined,
  lon: item.lon ? Number(item.lon) : undefined,
  approachPhotoUrl: (item.approach_photo_url as string) || undefined,
  microLandmark: (item.micro_landmark as string) || undefined,
  lastVerifiedAt: (item.last_verified_at as string) || undefined,
  verifiedByUserId: (item.verified_by_user_id as string) || undefined,
  featuredUntil: (item.featured_until as string) || null,
  propertyId: (item.property_id as string) || undefined,
  createdAt: (item.created_at as string) || undefined,
  quickPost: !!item.quick_post,
  listingType: (item.listing_type === 'sale' || item.listing_type === 'guesthouse' ? item.listing_type : 'rent') as 'rent' | 'sale' | 'guesthouse',
  eventId: (item.event_id as string) || null,
  visibleUntil: (item.visible_until as string) || null
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

export const rowToRequest = (
  item: DbRow,
  nameOf: (id: string | null | undefined) => string,
  listingTitleOf: (listingId: string | null | undefined) => string
): RoomRequest => ({
  id: item.id as string,
  tenantId: item.tenant_id as string,
  tenantName: nameOf(item.tenant_id as string | null | undefined),
  listingId: item.listing_id as string,
  listingTitle: listingTitleOf(item.listing_id as string | null | undefined),
  landlordId: item.landlord_id as string,
  status: ((item.status as string) || 'pending') as RoomRequest['status'],
  message: (item.message as string) || '',
  timestamp: (item.created_at as string) || new Date().toISOString()
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

export const rowToRoommate = (item: DbRow, nameOf: (id: string | null | undefined) => string): RoommateSeeker => ({
  id: item.id as string,
  name: nameOf(item.id as string | null | undefined),
  gender: ((item.gender as string) || 'men') as 'men' | 'women',
  childrenCount: (item.children_count as number) || 0,
  budget: Number(item.budget || 0),
  currency: (item.currency as string) || 'ZAR',
  location: (item.location as string) || '',
  suburb: (item.suburb as string) || '',
  bio: (item.bio as string) || ''
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
  total_seats: lift.totalSeats,
  ...(lift.eventId ? { event_id: toUUID(lift.eventId) } : {})
})

export const rowToLift = (item: DbRow, nameOf: (id: string | null | undefined) => string): LiftClub => ({
  id: item.id as string,
  driverId: item.driver_id as string,
  driverName: nameOf(item.driver_id as string | null | undefined),
  origin: item.origin as string,
  destination: item.destination as string,
  departureTime: (item.departure_time as string) || '',
  days: (item.days as string) || '',
  pricePerSeat: Number(item.price_per_seat),
  currency: (item.currency as string) || 'ZAR',
  availableSeats: (item.available_seats as number) || 0,
  totalSeats: (item.total_seats as number) || 0,
  eventId: (item.event_id as string) || null
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
  reviews_count: service.reviewsCount,
  ...(service.lat != null ? { lat: service.lat } : {}),
  ...(service.lon != null ? { lon: service.lon } : {})
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

export const rowToDispatch = (
  item: DbRow,
  nameOf: (id: string | null | undefined) => string,
  serviceNameOf: (serviceId: string | null | undefined) => string
): ServiceDispatch => ({
  id: item.id as string,
  serviceId: item.service_id as string,
  serviceName: serviceNameOf(item.service_id as string | null | undefined),
  senderId: item.sender_id as string,
  senderName: nameOf(item.sender_id as string | null | undefined),
  senderRole: 'tenant' as ServiceDispatch['senderRole'],
  message: (item.message as string) || '',
  status: ((item.status as string) || 'pending') as ServiceDispatch['status'],
  timestamp: (item.created_at as string) || new Date().toISOString(),
  proofFileName: undefined,
  proofFileUrl: (item.proof_file_url as string) || undefined
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

export const rowToToken = (item: DbRow, nameOf: (id: string | null | undefined) => string): UtilityToken => ({
  id: item.id as string,
  landlordId: item.landlord_id as string,
  landlordName: nameOf(item.landlord_id as string | null | undefined),
  meterNumber: (item.meter_label as string) || '',
  price: Number(item.price),
  currency: (item.currency as string) || 'ZAR',
  tokenCode: '',
  status: (item.status === 'claimed' ? 'sold' : 'available') as UtilityToken['status'],
  purchasedBy: (item.claimed_by as string) || undefined,
  purchasedAt: (item.claimed_at as string) || undefined
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

export const rowToTool = (item: DbRow, nameOf: (id: string | null | undefined) => string): ToolItem => ({
  id: item.id as string,
  ownerId: item.owner_id as string,
  ownerName: nameOf(item.owner_id as string | null | undefined),
  title: item.title as string,
  description: (item.description as string) || '',
  pricePerDay: Number(item.price_per_day),
  currency: (item.currency as string) || 'ZAR',
  deposit: Number(item.deposit || 0),
  location: (item.location as string) || '',
  status: ((item.status as string) || 'available') as ToolItem['status'],
  rentedBy: (item.rented_by as string) || undefined,
  rentedByName: item.rented_by ? nameOf(item.rented_by as string) : undefined,
  rentedUntil: (item.rented_until as string) || undefined
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

export const rowToChore = (item: DbRow, nameOf: (id: string | null | undefined) => string): ChoreAssignment => ({
  id: item.id as string,
  listingId: item.listing_id as string,
  roommateId: item.roommate_id as string,
  roommateName: nameOf(item.roommate_id as string | null | undefined),
  taskName: item.task_name as string,
  dayOfWeek: (item.day_of_week as string) || '',
  status: ((item.status as string) || 'pending') as ChoreAssignment['status'],
  completedAt: (item.completed_at as string) || undefined
})

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

export const rowToDispute = (item: DbRow, nameOf: (id: string | null | undefined) => string): CommunityDispute => ({
  id: item.id as string,
  title: item.title as string,
  description: (item.description as string) || '',
  category: ((item.category as string) || 'Other') as CommunityDispute['category'],
  reportedBy: nameOf(item.reported_by_id as string | null | undefined),
  reportedById: item.reported_by_id as string,
  againstUser: nameOf(item.against_user_id as string | null | undefined),
  againstUserId: (item.against_user_id as string) || '',
  mediatorId: (item.mediator_id as string) || '',
  mediatorName: nameOf(item.mediator_id as string | null | undefined),
  status: ((item.status as string) || 'pending') as CommunityDispute['status'],
  resolutionDetails: (item.resolution_details as string) || undefined,
  timestamp: (item.created_at as string) || new Date().toISOString()
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

export const rowToNotice = (item: DbRow, nameOf: (id: string | null | undefined) => string, nameMap: NameMap): NoticeEvent => ({
  id: item.id as string,
  title: item.title as string,
  description: (item.description as string) || '',
  type: ((item.type as string) || 'notice') as NoticeEvent['type'],
  postedBy: nameOf(item.posted_by_id as string | null | undefined),
  postedById: item.posted_by_id as string,
  timestamp: (item.created_at as string) || new Date().toISOString(),
  eventDate: (item.event_date as string) || undefined,
  rsvps: uuidsToNames(item.rsvps, nameMap),
  vibes: uuidsToNames(item.vibes, nameMap),
  echos: uuidsToNames(item.echos, nameMap)
})

// ── Phase 4 community tables ─────────────────────────────────────────────────

export const communityToRow = (c: Community): DbRow => ({
  id: toUUID(c.id),
  name: c.name,
  kind: c.kind || 'suburb',
  suburb: c.suburb,
  created_by: toUUID(c.createdBy)
})

export const rowToCommunity = (item: DbRow): Community => ({
  id: item.id as string,
  name: item.name as string,
  kind: ((item.kind as string) || 'suburb') as Community['kind'],
  description: '',
  location: (item.suburb as string) || '',
  suburb: (item.suburb as string) || '',
  createdBy: item.created_by as string,
  createdAt: item.created_at as string
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
  kind: a.kind || (a.severity === 'panic' ? 'panic' : 'incident'),
  title: a.title,
  description: a.description,
  severity: ALERT_SEVERITY[a.severity] || 'medium',
  status: a.status === 'resolved' ? 'resolved' : 'active',
  suburb: a.suburb || null,
  lat: a.lat,
  lon: a.lon
})

const ALERT_SEVERITY_FROM_DB: Record<string, Alert['severity']> = {
  low: 'info', medium: 'warning', high: 'critical', critical: 'panic'
}

export const rowToAlert = (item: DbRow): Alert => ({
  id: item.id as string,
  title: item.title as string,
  description: (item.description as string) || '',
  kind: ((item.kind as string) || 'incident') as Alert['kind'],
  category: (item.kind === 'panic' || item.kind === 'suspicious' ? 'security' : 'other') as Alert['category'],
  severity: ALERT_SEVERITY_FROM_DB[String(item.severity)] || 'warning',
  status: (item.status === 'active' ? 'active' : 'resolved') as Alert['status'],
  suburb: (item.suburb as string) || '',
  createdBy: item.user_id as string,
  createdAt: item.created_at as string,
  lat: Number(item.lat || 0),
  lon: Number(item.lon || 0)
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
  status: m.status === 'sold' ? 'gone' : 'available',
  ...(m.lat != null ? { lat: m.lat } : {}),
  ...(m.lon != null ? { lon: m.lon } : {})
})

export const rowToMarketItem = (item: DbRow): MarketItem => ({
  id: item.id as string,
  title: item.title as string,
  description: (item.description as string) || '',
  price: Number(item.price || 0),
  currency: (item.currency as string) || 'ZAR',
  category: (item.category as string) || '',
  suburb: (item.suburb as string) || '',
  imageUrl: ((item.images as string[])?.[0]) || undefined,
  status: (item.status === 'available' ? 'available' : 'sold') as MarketItem['status'],
  createdBy: item.user_id as string,
  createdAt: item.created_at as string,
  featuredUntil: (item.featured_until as string) || null,
  lat: (item.lat as number) ?? undefined,
  lon: (item.lon as number) ?? undefined
})

const VENDOR_KINDS = ['spaza', 'airtime', 'gas', 'food', 'produce'] as const

export const vendorToRow = (v: Vendor, userId: string): DbRow => ({
  id: toUUID(v.id),
  user_id: toUUID(userId),
  name: v.name,
  kind: (VENDOR_KINDS as readonly string[]).includes(v.category.toLowerCase())
    ? v.category.toLowerCase()
    : 'other',
  phone: v.contactNumber || null,
  lat: v.lat || null,
  lon: v.lon || null,
  approach_photo_url: v.approachPhotoUrl || null,
  micro_landmark: v.microLandmark || null
})

export const rowToVendor = (item: DbRow): Vendor => ({
  id: item.id as string,
  name: item.name as string,
  category: (item.kind as string) || '',
  description: '',
  contactNumber: (item.phone as string) || '',
  status: 'active' as Vendor['status'],
  rating: 5.0,
  reviewsCount: 0,
  lat: item.lat ? Number(item.lat) : undefined,
  lon: item.lon ? Number(item.lon) : undefined,
  approachPhotoUrl: (item.approach_photo_url as string) || undefined,
  microLandmark: (item.micro_landmark as string) || undefined,
  lastVerifiedAt: (item.last_verified_at as string) || undefined,
  verifiedByUserId: (item.verified_by_user_id as string) || undefined
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

export const rowToGroupBuy = (item: DbRow): GroupBuy => ({
  id: item.id as string,
  title: item.title as string,
  description: (item.description as string) || '',
  targetAmount: Number(item.target_quantity || 0),
  currentPledges: Number(item.current_quantity || 0),
  status: item.status as GroupBuy['status'],
  createdBy: item.organizer_id as string,
  endDate: (item.deadline as string) || ''
})

// Pledges and seat bookings have no *ToRow mapper by design: they are counter
// mutations, and doing the arithmetic here (read → add → write) is exactly the
// race that let two riders book the same last seat. They go through the
// res_pledge_group_buy / res_book_seat RPCs, which mutate inside the database.

export const skillToRow = (s: Skill): DbRow => ({
  id: toUUID(s.id),
  user_id: toUUID(s.userId),
  title: s.title,
  category: s.category,
  description: s.description
})

export const rowToSkill = (item: DbRow): Skill => ({
  id: item.id as string,
  userId: item.user_id as string,
  title: item.title as string,
  category: (item.category as string) || '',
  description: (item.description as string) || '',
  experienceLevel: (item.rate_note as string) || '',
  contactInfo: ''
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

export const rowToLostFound = (item: DbRow): LostFound => ({
  id: item.id as string,
  title: item.title as string,
  description: (item.description as string) || '',
  type: item.kind as LostFound['type'],
  location: (item.last_seen as string) || '',
  contactInfo: '',
  imageUrl: ((item.images as string[])?.[0]) || undefined,
  status: (item.status === 'reunited' ? 'resolved' : 'active') as LostFound['status']
})

export const sharedResourceToRow = (sr: SharedResource, ownerId: string): DbRow => ({
  id: toUUID(sr.id),
  owner_id: toUUID(ownerId),
  kind: sr.type === 'hotspot' ? 'wifi_hotspot' : sr.type,
  title: sr.name,
  access_note: sr.description || null,
  availability: sr.status || null,
  lat: sr.latitude,
  lon: sr.longitude,
  approach_photo_url: sr.approachPhotoUrl || null,
  micro_landmark: sr.microLandmark || null
})

export const rowToSharedResource = (item: DbRow): SharedResource => ({
  id: item.id as string,
  name: item.title as string,
  type: (item.kind === 'wifi_hotspot' ? 'hotspot' : item.kind === 'borehole' ? 'borehole' : 'other') as SharedResource['type'],
  status: (item.availability as string) || 'available',
  description: (item.access_note as string) || '',
  location: (item.suburb as string) || '',
  latitude: Number(item.lat || 0),
  longitude: Number(item.lon || 0),
  approachPhotoUrl: (item.approach_photo_url as string) || undefined,
  microLandmark: (item.micro_landmark as string) || undefined,
  lastVerifiedAt: (item.last_verified_at as string) || undefined,
  verifiedByUserId: (item.verified_by_user_id as string) || undefined
})

// Not written through a mapper — the care-circle "checked in" write goes
// straight through dbUpdate with a small inline payload — but the read
// direction is still shared between fetchSupabaseData and any future
// realtime handler, so it lives here like the others.
export const rowToCareCircle = (item: DbRow, nameOf: (id: string | null | undefined) => string): CareCircleCheck => ({
  id: item.id as string,
  name: nameOf(item.subject_id as string | null | undefined),
  status: (item.status === 'active' ? 'ok' : 'pending') as CareCircleCheck['status'],
  lastCheckedAt: (item.last_ok_at as string) || new Date().toISOString(),
  checkedByName: nameOf(item.carer_id as string | null | undefined) || undefined
})

export const trafficToRow = (tr: TrafficReport): DbRow => ({
  id: toUUID(tr.id),
  reporter_id: toUUID(tr.reporterId),
  suburb: tr.suburb || null,
  city: tr.city || null,
  lat: tr.lat,
  lon: tr.lon,
  report_type: tr.reportType,
  description: tr.description || null
})

export const rowToTrafficReport = (item: DbRow): TrafficReport => ({
  id: item.id as string,
  reporterId: item.reporter_id as string,
  suburb: (item.suburb as string) || '',
  city: (item.city as string) || '',
  lat: Number(item.lat),
  lon: Number(item.lon),
  reportType: item.report_type as TrafficReport['reportType'],
  description: (item.description as string) || '',
  createdAt: item.created_at as string
})

const NS_KIND: Record<NeighbourhoodStatus['service'], string> = {
  electricity: 'power',
  water: 'water',
  network: 'network',
  fiber: 'fiber',
  road: 'road'
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
  suburb: ns.suburb,
  ends_at: ns.endsAt || null
})

const NS_KIND_FROM_DB: Record<string, NeighbourhoodStatus['service']> = { power: 'electricity', water: 'water', network: 'network' }
const NS_STATUS_FROM_DB: Record<string, NeighbourhoodStatus['status']> = { up: 'active', down: 'outage', stage: 'outage' }

export const rowToNeighbourhoodStatus = (item: DbRow): NeighbourhoodStatus => ({
  id: item.id as string,
  service: NS_KIND_FROM_DB[item.kind as string] || (item.kind as NeighbourhoodStatus['service']),
  status: NS_STATUS_FROM_DB[item.status as string] || 'outage',
  suburb: (item.suburb as string) || '',
  updatedAt: (item.created_at as string) || new Date().toISOString(),
  startsAt: (item.starts_at as string) || (item.created_at as string) || new Date().toISOString(),
  endsAt: (item.ends_at as string) || null,
  source: (item.source === 'official' ? 'official' : 'crowd') as NeighbourhoodStatus['source'],
  providerId: (item.provider_id as string) || null
})

// ── Schema column allowlist (from resident_schema.sql) — used by tests ────────

export const SCHEMA_COLUMNS: Record<string, string[]> = {
  res_profiles: ['id', 'role', 'bio', 'gender', 'children_count', 'employment_status', 'has_pets', 'verification_doc_url', 'legal_name', 'landlord_gender_pref', 'landlord_children_allowed', 'landlord_max_children', 'landlord_smoking_allowed', 'landlord_pets_allowed', 'created_at', 'updated_at'],
  res_listings: ['id', 'landlord_id', 'title', 'description', 'price', 'currency', 'location', 'suburb', 'city', 'lat', 'lon', 'safety_rating', 'safety_notes', 'landlord_lives_here', 'images', 'wifi', 'parking', 'bathroom', 'req_gender_pref', 'req_children_allowed', 'req_max_children', 'req_smoking_allowed', 'req_pets_allowed', 'status', 'created_at', 'updated_at', 'approach_photo_url', 'micro_landmark', 'last_verified_at', 'verified_by_user_id', 'property_id', 'quick_post', 'listing_type', 'event_id', 'visible_until'],
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
  res_vendors: ['id', 'user_id', 'name', 'kind', 'sells', 'hours', 'contact_via_dm', 'phone', 'community_id', 'suburb', 'city', 'lat', 'lon', 'created_at', 'updated_at', 'approach_photo_url', 'micro_landmark', 'last_verified_at', 'verified_by_user_id'],
  res_group_buys: ['id', 'organizer_id', 'title', 'description', 'target_quantity', 'current_quantity', 'display_price', 'currency', 'deadline', 'status', 'community_id', 'suburb', 'city', 'lat', 'lon', 'created_at', 'updated_at'],
  res_group_buy_pledges: ['id', 'group_buy_id', 'user_id', 'quantity', 'note', 'created_at'],
  res_skills: ['id', 'user_id', 'title', 'category', 'description', 'rate_note', 'availability', 'community_id', 'suburb', 'city', 'lat', 'lon', 'created_at', 'updated_at'],
  res_lost_found: ['id', 'user_id', 'kind', 'category', 'title', 'description', 'images', 'last_seen', 'status', 'community_id', 'suburb', 'city', 'lat', 'lon', 'created_at', 'updated_at'],
  res_care_circle: ['id', 'subject_id', 'carer_id', 'cadence', 'last_ok_at', 'status', 'note', 'created_at', 'updated_at'],
  res_shared_resources: ['id', 'owner_id', 'kind', 'title', 'access_note', 'availability', 'is_free', 'price_note', 'community_id', 'suburb', 'city', 'lat', 'lon', 'created_at', 'updated_at', 'approach_photo_url', 'micro_landmark', 'last_verified_at', 'verified_by_user_id'],
  res_neighbourhood_status: ['id', 'reporter_id', 'kind', 'status', 'detail', 'community_id', 'suburb', 'city', 'lat', 'lon', 'created_at', 'starts_at', 'ends_at', 'source', 'provider_id'],
  res_traffic_reports: ['id', 'reporter_id', 'suburb', 'city', 'lat', 'lon', 'report_type', 'description', 'created_at']
}
