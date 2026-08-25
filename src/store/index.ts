import { configureStore, combineReducers, createSlice, PayloadAction, createAsyncThunk, createSelector } from '@reduxjs/toolkit'
import { supabase } from '../utils/supabase'
import { resilientCall } from '../utils/resilientCall'
import { getErrorMessage } from '../utils/errors'
import { safeGetJSON, safeSetJSON, safeRemove } from '../utils/safeStorage'

// Mappers between app models and the deployed schema live in dbMappers.ts;
// toUUID is re-exported from there so existing imports keep working.
import * as db from './dbMappers'
import { toUUID, NameMap } from './dbMappers'
export { toUUID }


// Types
export interface UserProfile {
  bio: string
  gender: 'men' | 'women' | 'any'
  childrenCount: number
  employmentStatus: string
  hasPets: boolean
  verificationDocUrl?: string // for secure file uploads
}

export interface LandlordPreferences {
  genderPreference: 'men' | 'women' | 'couple' | 'any'
  childrenAllowed: boolean
  maxChildren: number
  smokingAllowed: boolean
  petsAllowed: boolean
}

/**
 * The signed-out browsing account.
 *
 * MUST stay UUID-shaped: `loginUser` runs every id through `toUUID`, which
 * hashes anything that isn't already a UUID. The old sentinel `'visitor-guest'`
 * was silently rewritten to `e9d573ec…` the moment it hit the store, so every
 * `id === 'visitor-guest'` guard in the app compared against a value that could
 * never occur and quietly passed guests through as real users.
 */
export const GUEST_USER_ID = '00000000-0000-4000-8000-000000000001'

/**
 * "This person cannot perform authenticated writes." Checks the role rather
 * than only the id, so it also covers a session that resolved without a
 * res_profiles row (which bootstraps as 'visitor').
 */
export const isGuestUser = (user: { id: string; role: string } | null | undefined): boolean =>
  !user || user.id === GUEST_USER_ID || user.role === 'visitor'

export interface User {
  id: string
  name: string
  email: string
  role: 'tenant' | 'landlord' | 'visitor'
  passwordHash?: string // cryptographically secured
  profile?: UserProfile
  preferences?: LandlordPreferences
  /** res_profiles.created_at — drives the Next of Kin 6-month grace window. */
  createdAt?: string
  /**
   * res_profiles.legal_name — a Resident-only "formal name" field, separate
   * from the Gruvs-owned profiles.name (`name` above) shown elsewhere in the
   * app. This app never writes that shared column outside initial signup
   * (CONTRACT.md §2). Top-level rather than nested in UserProfile/
   * LandlordPreferences because it applies regardless of tenant/landlord
   * role, unlike either of those. Used wherever formality matters
   * (verification status, a landlord's view of an applicant); falls back to
   * the Gruvs display name (`name`) when unset.
   */
  legalName?: string
}

export interface Listing {
  id: string
  title: string
  description: string
  price: number
  currency: string
  location: string
  suburb: string
  safetyRating: 'high' | 'medium' | 'low'
  safetyNotes: string
  landlordId: string
  landlordName: string
  landlordLivesHere: boolean
  images: string[]
  amenities: {
    wifi: boolean
    parking: boolean
    bathroom: 'shared' | 'private' | 'ensuite'
  }
  requirements: LandlordPreferences
  lat?: number
  lon?: number
  approachPhotoUrl?: string
  microLandmark?: string
  lastVerifiedAt?: string
  verifiedByUserId?: string
  /** Set by a paid room-boost purchase; null/past = not currently featured. */
  featuredUntil?: string | null
  /** Owning res_properties row, if this room belongs to a multi-room property. */
  propertyId?: string
  createdAt?: string
  /**
   * A "post it in seconds" listing (minimal fields, no amenities/requirements
   * filled in) — was a wholly separate community-hub board with its own
   * fetch/create form, even though the row is the SAME res_listings table
   * with this one flag set. Merged into Housing: same list, same filters,
   * distinguished only by this badge, per res_listings.quick_post.
   */
  quickPost?: boolean
  /** 'rent' (default), 'sale', or 'guesthouse' — res_listings.listing_type.
   *  Same table, same filters/search, distinguished only by this field,
   *  same pattern as quickPost above. */
  listingType: 'rent' | 'sale' | 'guesthouse'
  /** Optional link to a Gruvs-owned `events` row (res_listings.event_id) —
   *  same convention as LiftClub.eventId. Used by guesthouse listings to
   *  say which event they're near; not used by rent/sale listings. */
  eventId?: string | null
  /** res_listings.visible_until — once past, the listing is a normal
   *  listing on paper but Housing hides it from search/browse the same way
   *  an expired notice hides itself. Built for guesthouse listings tied to
   *  a specific event season (e.g. only relevant through end of October),
   *  but not exclusive to that type. */
  visibleUntil?: string | null
}

export interface RoomRequest {
  id: string
  tenantId: string
  tenantName: string
  listingId: string
  listingTitle: string
  landlordId: string
  status: 'pending' | 'approved' | 'rejected' | 'waitlisted' | 'saved'
  message: string
  timestamp: string
}

export interface SecurityLog {
  id: string
  timestamp: string
  /**
   * Server-observed IP, when a route actually has one. Every call site used
   * to hardcode '127.0.0.1', which is worse than an empty field in an audit
   * log — it reads like real evidence. The browser cannot know its own
   * public IP, so this is left unset client-side and populated only where
   * the server genuinely sees it.
   */
  ip?: string
  action: string
  type: 'xss_blocked' | 'rate_limit_triggered' | 'idor_prevented' | 'auth_success' | 'auth_failed' | 'brute_force_blocked' | 'upload_malware_blocked' | 'sqli_blocked' | 'role_switched' | 'org_broadcast_sent'
  details: string
}

// B2B & P2P Networking Interfaces
export interface RoommateSeeker {
  id: string
  name: string
  gender: 'men' | 'women'
  childrenCount: number
  budget: number
  currency: string
  location: string
  suburb: string
  bio: string
}

export interface LiftClub {
  id: string
  /** The posting driver's user id. res_lift_clubs has always carried this
   *  (driver_id) — the client just never read it past resolving driverName,
   *  which meant there was no way to look up or show a driver's real trust
   *  info (TrustBadge) on a lift card. */
  driverId: string
  driverName: string
  origin: string
  destination: string
  departureTime: string
  days: string
  pricePerSeat: number
  currency: string
  availableSeats: number
  totalSeats: number
  /** Optional link to a Gruvs-owned `events` row — see CONTRACT.md. */
  eventId?: string | null
}

export interface HandymanService {
  id: string
  ownerId: string // user who owns the business
  businessName: string
  category: 'Plumbing' | 'Electrical' | 'Construction' | 'Cleaning' | 'Security' | 'Bakkie / Transport' | 'Moving Assistant' | 'Local Materials' | 'General Services'
  location: string
  suburb: string
  rating: number
  contactNumber: string
  websiteUrl?: string
  priceEstimate: string
  description: string
  image: string
  reviewsCount: number
}

export interface ServiceDispatch {
  id: string
  serviceId: string
  serviceName: string
  senderId: string
  senderName: string
  senderRole: 'tenant' | 'landlord' | 'visitor'
  message: string
  status: 'pending' | 'accepted' | 'completed'
  timestamp: string
  proofFileName?: string
  proofFileUrl?: string
}

export interface UtilityToken {
  id: string
  landlordId: string
  landlordName: string
  meterNumber: string
  price: number
  currency: string
  tokenCode: string
  status: 'available' | 'sold'
  purchasedBy?: string
  purchasedAt?: string
}

export interface ToolItem {
  id: string
  ownerId: string
  ownerName: string
  title: string
  description: string
  pricePerDay: number
  currency: string
  deposit: number
  location: string
  status: 'available' | 'rented' | 'pending_return'
  rentedBy?: string
  rentedByName?: string
  rentedUntil?: string
}

export interface CommunityDispute {
  id: string
  title: string
  description: string
  category: 'Noise' | 'Messiness' | 'Utility overuse' | 'Chore avoidance' | 'Security breach' | 'Other'
  reportedBy: string
  reportedById: string
  againstUser: string
  againstUserId: string
  mediatorId: string
  mediatorName: string
  status: 'pending' | 'mediating' | 'resolved'
  resolutionDetails?: string
  timestamp: string
  evidenceHash?: string
  votesForClaimant?: number
  votesForRespondent?: number
  juryStatus?: 'not_started' | 'voting' | 'completed'
}

export interface ChoreAssignment {
  id: string
  // Household listing this chore belongs to — required by the DB
  // (res_chore_schedule.listing_id NOT NULL + res_is_household_member RLS).
  listingId?: string
  roommateId: string
  roommateName: string
  taskName: string
  dayOfWeek: string
  status: 'pending' | 'completed'
  completedAt?: string
}

// Every notice/announcement gets an 8-hour free ride, on the theory that a
// genuinely urgent, community-relevant post (water outage, lost pet, street
// meeting) should never be gated behind payment while it's still fresh news.
// Past that window it either has a paid extension covering the current
// moment, or it drops out of every viewer's feed — see isNoticeCurrentlyVisible.
export const NOTICE_FREE_WINDOW_MS = 8 * 60 * 60 * 1000

export interface NoticeEvent {
  id: string
  title: string
  description: string
  type: 'notice' | 'event' | 'landlord_announcement'
  postedBy: string
  postedById: string
  timestamp: string
  eventDate?: string
  /**
   * Link to a Gruvs-owned `events` row (CONTRACT.md §8, same convention as
   * `LiftClub.eventId`) — a Community Event notice points at a real Gruvs
   * event rather than carrying its own free-text title/date, so the
   * community wall and The Gruvs never show two different stories about the
   * same event.
   */
  eventId?: string | null
  rsvps: string[]
  vibes?: string[]
  echos?: string[]
  /**
   * Who this is allowed to reach, on top of the base "everyone in the
   * community" rule — see selectVisibleNotices for the full resolution order:
   *  - 'everyone': every community member (default)
   *  - 'my_tenants': only viewers with an approved request against this
   *    landlord (type === 'landlord_announcement' only)
   *  - 'targeted': only viewers associated with one of targetSuburbs, via
   *    their own listings (landlord) or an approved/pending request on a
   *    listing in that suburb (tenant)
   */
  audience?: 'everyone' | 'my_tenants' | 'targeted'
  /** Suburbs this notice is targeted at — only read when audience === 'targeted'. */
  targetSuburbs?: string[]
  /**
   * Explicit blocklist, resolved AFTER audience targeting — lets a poster
   * say "everyone in Rosebank except these two people" without that being
   * expressible through audience/targetSuburbs alone.
   */
  excludedUserIds?: string[]
  /** Set by a paid notice-boost purchase; null/past = not currently featured. */
  featuredUntil?: string | null
  /**
   * Paid extension past the 8h free window (see NOTICE_FREE_WINDOW_MS).
   * null/past once the free window has also lapsed = the notice is expired
   * and invisible to everyone except its poster (who can renew it).
   * Doesn't apply to type === 'event' — an event's own eventDate already
   * bounds its relevance, it isn't rented by the hour like a notice.
   */
  paidVisibilityUntil?: string | null
}

/** True while `notice` is still inside its free 8h window. */
export function isNoticeInFreeWindow(notice: Pick<NoticeEvent, 'timestamp'>, now: number = Date.now()): boolean {
  return now - new Date(notice.timestamp).getTime() < NOTICE_FREE_WINDOW_MS
}

/**
 * A notice is visible to *anyone* (before audience/targeting is applied)
 * once it's still free, or its paid extension currently covers `now`.
 * Events and landlord announcements to a private audience are exempt from
 * the paywall entirely — the paywall only ever governs reach of a public
 * 'notice'/'landlord_announcement' post, never who's allowed to see it at all.
 */
export function isNoticeCurrentlyVisible(notice: NoticeEvent, now: number = Date.now()): boolean {
  if (notice.type === 'event') return true
  if (isNoticeInFreeWindow(notice, now)) return true
  return !!notice.paidVisibilityUntil && new Date(notice.paidVisibilityUntil).getTime() > now
}

// Example data so the app has something to show when browsing without a
// live Supabase connection (e.g. local demo / guest mode).
const initialListings: Listing[] = [
  {
    id: 'listing-demo-1',
    title: 'Sunny private room near Gautrain',
    description: 'Bright ensuite room in a secure townhouse complex, 5 min walk to the Gautrain station.',
    price: 6500,
    currency: 'ZAR',
    location: '12 Jacaranda Ave',
    suburb: 'Rosebank',
    safetyRating: 'high',
    safetyNotes: '24/7 estate security, biometric gate access.',
    landlordId: 'landlord-demo-1',
    landlordName: 'Naledi M.',
    landlordLivesHere: false,
    images: [],
    amenities: { wifi: true, parking: true, bathroom: 'ensuite' },
    requirements: { genderPreference: 'any', childrenAllowed: false, maxChildren: 0, smokingAllowed: false, petsAllowed: true },
    lat: -26.1476,
    lon: 28.0436,
    createdAt: new Date().toISOString(),
    listingType: 'rent'
  },
  {
    id: 'listing-demo-2',
    title: 'Shared house room, walk to campus',
    description: 'Cozy shared bathroom room in a student-friendly house, close to shops and taxis.',
    price: 3800,
    currency: 'ZAR',
    location: '4 Baker Street',
    suburb: 'Braamfontein',
    safetyRating: 'medium',
    safetyNotes: 'Well-lit street, some load-shedding related outages.',
    landlordId: 'landlord-demo-2',
    landlordName: 'Thabo K.',
    landlordLivesHere: true,
    images: [],
    amenities: { wifi: true, parking: false, bathroom: 'shared' },
    requirements: { genderPreference: 'any', childrenAllowed: false, maxChildren: 0, smokingAllowed: false, petsAllowed: false },
    lat: -26.1926,
    lon: 28.0305,
    createdAt: new Date().toISOString(),
    listingType: 'rent'
  },
  {
    id: 'listing-demo-3',
    title: 'Garden cottage, private entrance',
    description: 'Self-contained garden flat with its own kitchenette and entrance, very quiet family plot.',
    price: 8200,
    currency: 'ZAR',
    location: '88 Pine Road',
    suburb: 'Melville',
    safetyRating: 'high',
    safetyNotes: 'Alarm system with armed response.',
    landlordId: 'landlord-demo-1',
    landlordName: 'Naledi M.',
    landlordLivesHere: false,
    images: [],
    amenities: { wifi: true, parking: true, bathroom: 'private' },
    requirements: { genderPreference: 'any', childrenAllowed: true, maxChildren: 2, smokingAllowed: false, petsAllowed: true },
    lat: -26.1867,
    lon: 27.9799,
    featuredUntil: null,
    createdAt: new Date().toISOString(),
    listingType: 'rent'
  }
]

const initialRoommates: RoommateSeeker[] = [
  {
    id: 'roommate-demo-1',
    name: 'Lerato S.',
    gender: 'women',
    childrenCount: 0,
    budget: 5000,
    currency: 'ZAR',
    location: 'Near Sandton City',
    suburb: 'Sandton',
    bio: 'Quiet professional, work from home most days, looking for a clean and safe shared place.'
  },
  {
    id: 'roommate-demo-2',
    name: 'Sipho N.',
    gender: 'men',
    childrenCount: 1,
    budget: 4200,
    currency: 'ZAR',
    location: 'Close to schools',
    suburb: 'Randburg',
    bio: 'Single dad, easygoing, happy to split chores and share a lift club to town.'
  }
]

const initialLifts: LiftClub[] = [
  {
    id: 'lift-demo-1',
    driverId: 'landlord-demo-1',
    driverName: 'Mpho D.',
    origin: 'Rosebank',
    destination: 'Sandton CBD',
    departureTime: '07:00',
    days: 'Mon-Fri',
    pricePerSeat: 25,
    currency: 'ZAR',
    availableSeats: 2,
    totalSeats: 4
  },
  {
    id: 'lift-demo-2',
    driverId: 'landlord-demo-2',
    driverName: 'Zanele P.',
    origin: 'Braamfontein',
    destination: 'Wits Campus',
    departureTime: '07:30',
    days: 'Mon-Fri',
    pricePerSeat: 15,
    currency: 'ZAR',
    availableSeats: 3,
    totalSeats: 3
  }
]

const initialServices: HandymanService[] = [
  {
    id: 'service-demo-1',
    ownerId: 'owner-demo-1',
    businessName: 'Fix-It Plumbing',
    category: 'Plumbing',
    location: 'Rosebank & surrounds',
    suburb: 'Rosebank',
    rating: 4.6,
    contactNumber: '071 234 5678',
    priceEstimate: 'From R350 call-out',
    description: 'Leaks, geysers, blocked drains — same day response.',
    image: '',
    reviewsCount: 23
  },
  {
    id: 'service-demo-2',
    ownerId: 'owner-demo-2',
    businessName: 'SafeGate Security',
    category: 'Security',
    location: 'Melville & surrounds',
    suburb: 'Melville',
    rating: 4.9,
    contactNumber: '082 345 6789',
    priceEstimate: 'From R500/month',
    description: 'Armed response, alarm installation, and patrol services.',
    image: '',
    reviewsCount: 41
  },
  {
    id: 'service-demo-3',
    ownerId: 'owner-demo-3',
    businessName: 'Speedy Bakkie Transport',
    category: 'Bakkie / Transport',
    location: 'Braamfontein & surrounds',
    suburb: 'Braamfontein',
    rating: 4.3,
    contactNumber: '073 456 7890',
    priceEstimate: 'From R250 per trip',
    description: 'Furniture moves, deliveries, and student move-ins.',
    image: '',
    reviewsCount: 12
  }
]


// Phase 4 Community Interfaces
export interface Community {
  id: string
  name: string
  kind: 'street' | 'block' | 'complex' | 'estate' | 'suburb'
  description: string
  location: string
  suburb: string
  createdBy: string
  createdAt: string
}

export interface Alert {
  id: string
  title: string
  description: string
  // res_alerts.kind is the real column driving res_broadcast_alert's fan-out;
  // category is a coarser display bucket derived from it.
  kind: 'panic' | 'incident' | 'suspicious' | 'safe_walk'
  category: 'security' | 'fire' | 'medical' | 'utility' | 'other'
  severity: 'info' | 'warning' | 'critical' | 'panic'
  status: 'active' | 'resolved'
  suburb: string
  createdBy: string
  createdAt: string
  lat: number
  lon: number
}

export interface MarketItem {
  id: string
  title: string
  description: string
  price: number
  currency: string
  category: string
  suburb: string
  imageUrl?: string
  status: 'available' | 'sold'
  createdBy: string
  createdAt: string
  featuredUntil?: string | null
}

export interface Vendor {
  id: string
  name: string
  category: string
  description: string
  contactNumber: string
  status: 'active' | 'inactive' | 'pending'
  rating: number
  reviewsCount: number
  lat?: number
  lon?: number
  approachPhotoUrl?: string
  microLandmark?: string
  lastVerifiedAt?: string
  verifiedByUserId?: string
}

export interface GroupBuy {
  id: string
  title: string
  description: string
  targetAmount: number
  currentPledges: number
  status: 'open' | 'completed' | 'cancelled'
  createdBy: string
  endDate: string
}

export interface Skill {
  id: string
  userId: string
  title: string
  category: string
  description: string
  experienceLevel: string
  contactInfo: string
}

export interface LostFound {
  id: string
  title: string
  description: string
  type: 'lost' | 'found'
  location: string
  contactInfo: string
  imageUrl?: string
  status: 'active' | 'resolved'
}

export interface CareCircleCheck {
  id: string
  name: string
  status: 'ok' | 'needs_assistance' | 'pending'
  lastCheckedAt: string
  checkedByName?: string
}

export interface SharedResource {
  id: string
  name: string
  type: 'borehole' | 'hotspot' | 'other'
  status: string
  description: string
  location: string
  latitude: number
  longitude: number
  approachPhotoUrl?: string
  microLandmark?: string
  lastVerifiedAt?: string
  verifiedByUserId?: string
}

export interface TrafficReport {
  id: string
  reporterId: string
  suburb?: string
  city?: string
  lat: number
  lon: number
  reportType: 'congestion' | 'pothole' | 'roadblock' | 'accident' | 'dead_robots' | 'other'
  description?: string
  createdAt?: string
}

export interface NeighbourhoodStatus {
  id: string
  service: 'electricity' | 'water' | 'network' | 'fiber' | 'road'
  status: 'active' | 'restored' | 'outage'
  suburb: string
  updatedAt: string
  startsAt: string
  endsAt: string | null
  source: 'crowd' | 'official'
  providerId: string | null
}

// Slices
const authSlice = createSlice({
  name: 'auth',
  initialState: {
    currentUser: null as User | null,
    isLoaded: false,
    failedAttempts: {} as Record<string, number>, // Email => count
    lockedUntil: {} as Record<string, number>     // Email => timestamp
  },
  reducers: {
    loginUser: (state, action: PayloadAction<User>) => {
      const user = { ...action.payload }
      user.id = toUUID(user.id)
      state.currentUser = user
      state.isLoaded = true
      state.failedAttempts[user.email] = 0 // reset on success
    },
    logoutUser: (state) => {
      state.currentUser = null
      state.isLoaded = true
    },
    registerFailedAttempt: (state, action: PayloadAction<string>) => {
      const email = action.payload
      state.failedAttempts[email] = (state.failedAttempts[email] || 0) + 1
      if (state.failedAttempts[email] >= 5) {
        state.lockedUntil[email] = Date.now() + 60 * 1000 // lock for 1 minute
      }
    },
    resetFailedAttempts: (state, action: PayloadAction<string>) => {
      state.failedAttempts[action.payload] = 0
      state.lockedUntil[action.payload] = 0
    },
    updateProfile: (state, action: PayloadAction<{ profile: UserProfile }>) => {
      if (state.currentUser && state.currentUser.role === 'tenant') {
        state.currentUser.profile = action.payload.profile
      }
    },
    updatePreferences: (state, action: PayloadAction<{ preferences: LandlordPreferences }>) => {
      if (state.currentUser && state.currentUser.role === 'landlord') {
        state.currentUser.preferences = action.payload.preferences
      }
    },
    // Top-level, not nested in profile/preferences — legal_name applies
    // regardless of tenant/landlord role, unlike either of those.
    setLegalName: (state, action: PayloadAction<string | undefined>) => {
      if (state.currentUser) {
        state.currentUser.legalName = action.payload
      }
    },
    // Self-service fix for accounts that were silently defaulted to the
    // wrong role (e.g. a landlord's first-ever login left them as 'tenant'
    // because that's the login form's fallback option) — until this action
    // existed there was no way for a user to correct their own role at all.
    updateUserRole: (state, action: PayloadAction<'tenant' | 'landlord'>) => {
      if (state.currentUser) {
        state.currentUser.role = action.payload
      }
    }
  }
})

const listingsSlice = createSlice({
  name: 'listings',
  initialState: {
    items: initialListings
  },
  reducers: {
    setListings: (state, action: PayloadAction<Listing[]>) => {
      state.items = action.payload.map(item => ({
        ...item,
        id: toUUID(item.id),
        landlordId: toUUID(item.landlordId)
      }))
    },
    addListing: (state, action: PayloadAction<Listing>) => {
      const listing = { ...action.payload }
      listing.id = toUUID(listing.id)
      listing.landlordId = toUUID(listing.landlordId)
      state.items.push(listing)
    },
    deleteListing: (state, action: PayloadAction<string>) => {
      const id = toUUID(action.payload)
      state.items = state.items.filter(item => toUUID(item.id) !== id)
    },
    updateListingVerification: (state, action: PayloadAction<{ id: string; approachPhotoUrl?: string; lastVerifiedAt: string; verifiedByUserId: string }>) => {
      const item = state.items.find(l => toUUID(l.id) === toUUID(action.payload.id))
      if (item) {
        if (action.payload.approachPhotoUrl) item.approachPhotoUrl = action.payload.approachPhotoUrl
        item.lastVerifiedAt = action.payload.lastVerifiedAt
        item.verifiedByUserId = toUUID(action.payload.verifiedByUserId)
      }
    }
  }
})

// Deliberately EMPTY, unlike the other demo seeds. A demo listing only
// populates a browse view, but a seeded room request lands in a real
// landlord's action queue — they would try to answer an applicant who does
// not exist. Requests must only ever come from a real tenant action.
const initialRequests: RoomRequest[] = []

const requestsSlice = createSlice({
  name: 'requests',
  initialState: {
    items: initialRequests
  },
  reducers: {
    setRequests: (state, action: PayloadAction<RoomRequest[]>) => {
      state.items = action.payload.map(req => ({
        ...req,
        id: toUUID(req.id),
        tenantId: toUUID(req.tenantId),
        listingId: toUUID(req.listingId),
        landlordId: toUUID(req.landlordId)
      }))
    },
    addRequest: (state, action: PayloadAction<RoomRequest>) => {
      const req = { ...action.payload }
      req.id = toUUID(req.id)
      req.tenantId = toUUID(req.tenantId)
      req.listingId = toUUID(req.listingId)
      req.landlordId = toUUID(req.landlordId)
      state.items.push(req)
    },
    updateRequestStatus: (state, action: PayloadAction<{ requestId: string; status: 'approved' | 'rejected' | 'waitlisted' | 'saved' }>) => {
      const reqId = toUUID(action.payload.requestId)
      const req = state.items.find(r => toUUID(r.id) === reqId)
      if (req) {
        req.status = action.payload.status
      }
    }
  }
})

const securitySlice = createSlice({
  name: 'security',
  initialState: {
    logs: [] as SecurityLog[],
    apiCallCount: {} as Record<string, number>
  },
  reducers: {
    addLog: (state, action: PayloadAction<Omit<SecurityLog, 'id' | 'timestamp'>>) => {
      const newLog: SecurityLog = {
        ...action.payload,
        id: `sec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date().toISOString()
      }
      state.logs.unshift(newLog)
    },
    incrementApiCall: (state, action: PayloadAction<{ ip: string }>) => {
      const ip = action.payload.ip
      state.apiCallCount[ip] = (state.apiCallCount[ip] || 0) + 1
    },
    resetApiCounts: (state) => {
      state.apiCallCount = {}
    }
  }
})

const networkingSlice = createSlice({
  name: 'networking',
  initialState: {
    roommates: initialRoommates,
    lifts: initialLifts,
    services: initialServices,
    dispatches: [] as ServiceDispatch[],
    trafficReports: [] as TrafficReport[]
  },
  reducers: {
    setRoommates: (state, action: PayloadAction<RoommateSeeker[]>) => {
      state.roommates = action.payload.map(r => ({ ...r, id: toUUID(r.id) }))
    },
    setLifts: (state, action: PayloadAction<LiftClub[]>) => {
      state.lifts = action.payload.map(l => ({ ...l, id: toUUID(l.id), driverId: toUUID(l.driverId) }))
    },
    setServices: (state, action: PayloadAction<HandymanService[]>) => {
      state.services = action.payload.map(s => ({ ...s, id: toUUID(s.id), ownerId: toUUID(s.ownerId) }))
    },
    setDispatches: (state, action: PayloadAction<ServiceDispatch[]>) => {
      state.dispatches = action.payload.map(d => ({
        ...d,
        id: toUUID(d.id),
        serviceId: toUUID(d.serviceId),
        senderId: toUUID(d.senderId)
      }))
    },
    setTrafficReports: (state, action: PayloadAction<TrafficReport[]>) => {
      state.trafficReports = action.payload.map(tr => ({
        ...tr,
        id: toUUID(tr.id),
        reporterId: toUUID(tr.reporterId)
      }))
    },
    addRoommateSeeker: (state, action: PayloadAction<RoommateSeeker>) => {
      const seeker = { ...action.payload }
      seeker.id = toUUID(seeker.id)
      state.roommates.push(seeker)
    },
    addLiftClub: (state, action: PayloadAction<LiftClub>) => {
      const lift = { ...action.payload }
      lift.id = toUUID(lift.id)
      lift.driverId = toUUID(lift.driverId)
      state.lifts.push(lift)
    },
    addService: (state, action: PayloadAction<HandymanService>) => {
      const service = { ...action.payload }
      service.id = toUUID(service.id)
      service.ownerId = toUUID(service.ownerId)
      state.services.push(service)
    },
    deleteService: (state, action: PayloadAction<string>) => {
      const serviceId = toUUID(action.payload)
      state.services = state.services.filter(s => toUUID(s.id) !== serviceId)
    },
    bookSeat: (state, action: PayloadAction<string>) => {
      const liftId = toUUID(action.payload)
      const lift = state.lifts.find(l => toUUID(l.id) === liftId)
      if (lift && lift.availableSeats > 0) {
        lift.availableSeats -= 1
      }
    },
    // Reconciles the optimistic decrement with the seat count the database
    // actually settled on (res_book_seat returns it).
    setLiftSeats: (state, action: PayloadAction<{ liftId: string; availableSeats: number }>) => {
      const liftId = toUUID(action.payload.liftId)
      const lift = state.lifts.find(l => toUUID(l.id) === liftId)
      if (lift) {
        lift.availableSeats = action.payload.availableSeats
      }
    },
    bookSeatRollback: (state, action: PayloadAction<string>) => {
      const liftId = toUUID(action.payload)
      const lift = state.lifts.find(l => toUUID(l.id) === liftId)
      if (lift && lift.availableSeats < lift.totalSeats) {
        lift.availableSeats += 1
      }
    },
    addDispatch: (state, action: PayloadAction<ServiceDispatch>) => {
      const disp = { ...action.payload }
      disp.id = toUUID(disp.id)
      disp.serviceId = toUUID(disp.serviceId)
      disp.senderId = toUUID(disp.senderId)
      state.dispatches.push(disp)
    },
    updateDispatchStatus: (state, action: PayloadAction<{ dispatchId: string; status: 'accepted' | 'completed' }>) => {
      const dispatchId = toUUID(action.payload.dispatchId)
      const disp = state.dispatches.find(d => toUUID(d.id) === dispatchId)
      if (disp) {
        disp.status = action.payload.status
      }
    },
    addTrafficReport: (state, action: PayloadAction<TrafficReport>) => {
      const report = { ...action.payload }
      report.id = toUUID(report.id)
      report.reporterId = toUUID(report.reporterId)
      state.trafficReports.push(report)
    }
  }
})

const initialTokens: UtilityToken[] = [
  {
    id: 'token-demo-1',
    landlordId: 'landlord-demo-1',
    landlordName: 'Naledi M.',
    meterNumber: '04821193756',
    price: 200,
    currency: 'ZAR',
    tokenCode: '',
    status: 'available'
  },
  {
    id: 'token-demo-2',
    landlordId: 'landlord-demo-2',
    landlordName: 'Thabo K.',
    meterNumber: '04821194502',
    price: 100,
    currency: 'ZAR',
    tokenCode: '',
    status: 'available'
  }
]

const utilitiesSlice = createSlice({
  name: 'utilities',
  initialState: {
    tokens: initialTokens
  },
  reducers: {
    setTokens: (state, action: PayloadAction<UtilityToken[]>) => {
      state.tokens = action.payload.map(t => ({
        ...t,
        id: toUUID(t.id),
        landlordId: toUUID(t.landlordId),
        purchasedBy: t.purchasedBy ? toUUID(t.purchasedBy) : undefined
      }))
    },
    addToken: (state, action: PayloadAction<UtilityToken>) => {
      const token = { ...action.payload }
      token.id = toUUID(token.id)
      token.landlordId = toUUID(token.landlordId)
      state.tokens.push(token)
    },
    buyToken: (state, action: PayloadAction<{ tokenId: string; buyerId: string; timestamp: string }>) => {
      const tokenId = toUUID(action.payload.tokenId)
      const tok = state.tokens.find(t => toUUID(t.id) === tokenId)
      if (tok && tok.status === 'available') {
        tok.status = 'sold'
        tok.purchasedBy = toUUID(action.payload.buyerId)
        tok.purchasedAt = action.payload.timestamp
      }
    }
  }
})

// Community Hub Mock Data
const initialTools: ToolItem[] = [
  {
    id: 'tool-demo-1',
    ownerId: 'landlord-demo-1',
    ownerName: 'Naledi M.',
    title: 'Cordless drill set',
    description: 'Bosch 18V drill with two batteries and a bit set.',
    pricePerDay: 50,
    currency: 'ZAR',
    deposit: 300,
    location: 'Rosebank',
    status: 'available'
  },
  {
    id: 'tool-demo-2',
    ownerId: 'landlord-demo-2',
    ownerName: 'Thabo K.',
    title: 'Extension ladder (3m)',
    description: 'Sturdy aluminium ladder, good for gutter cleaning.',
    pricePerDay: 40,
    currency: 'ZAR',
    deposit: 200,
    location: 'Braamfontein',
    status: 'available'
  }
]

const initialChores: ChoreAssignment[] = [
  {
    id: 'chore-demo-1',
    listingId: 'listing-demo-2',
    roommateId: 'roommate-demo-1',
    roommateName: 'Lerato S.',
    taskName: 'Take out the bins',
    dayOfWeek: 'Monday',
    status: 'pending'
  },
  {
    id: 'chore-demo-2',
    listingId: 'listing-demo-2',
    roommateId: 'roommate-demo-2',
    roommateName: 'Sipho N.',
    taskName: 'Clean shared kitchen',
    dayOfWeek: 'Wednesday',
    status: 'completed',
    completedAt: new Date().toISOString()
  }
]

const initialNotices: NoticeEvent[] = [
  {
    id: 'notice-demo-1',
    title: 'Water outage scheduled Thursday',
    description: 'City maintenance on the main line — expect low pressure from 9am to 2pm.',
    type: 'notice',
    postedBy: 'Naledi M.',
    postedById: 'landlord-demo-1',
    timestamp: new Date().toISOString(),
    rsvps: [],
    vibes: [],
    echos: []
  },
  {
    id: 'notice-demo-2',
    title: 'Street braai this Saturday',
    description: 'Bring a side dish, meat is sorted. 4pm at the corner park.',
    type: 'event',
    postedBy: 'Thabo K.',
    postedById: 'landlord-demo-2',
    timestamp: new Date().toISOString(),
    eventDate: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString(),
    rsvps: ['roommate-demo-1'],
    vibes: [],
    echos: []
  }
]

const initialDisputes: CommunityDispute[] = [
  {
    id: 'dispute-demo-1',
    title: 'Noise after quiet hours',
    description: 'Loud music most nights past 11pm from the shared lounge.',
    category: 'Noise',
    reportedBy: 'Lerato S.',
    reportedById: 'roommate-demo-1',
    againstUser: 'Sipho N.',
    againstUserId: 'roommate-demo-2',
    mediatorId: '',
    mediatorName: '',
    status: 'pending',
    timestamp: new Date().toISOString()
  }
]

const initialCommunities: Community[] = [
  {
    id: 'community-demo-1',
    name: 'Rosebank Residents',
    kind: 'suburb',
    description: 'Neighbours in and around Rosebank looking out for each other.',
    location: 'Rosebank',
    suburb: 'Rosebank',
    createdBy: 'landlord-demo-1',
    createdAt: new Date().toISOString()
  },
  {
    id: 'community-demo-2',
    name: 'Baker Street Block',
    kind: 'block',
    description: 'The households on and around Baker Street, Braamfontein.',
    location: 'Braamfontein',
    suburb: 'Braamfontein',
    createdBy: 'landlord-demo-2',
    createdAt: new Date().toISOString()
  }
]

const initialAlerts: Alert[] = [
  {
    id: 'alert-demo-1',
    title: 'Suspicious vehicle reported',
    description: 'A white bakkie circling the block slowly for the past hour, no plates visible.',
    kind: 'suspicious',
    category: 'security',
    severity: 'warning',
    status: 'active',
    suburb: 'Rosebank',
    createdBy: 'landlord-demo-1',
    createdAt: new Date().toISOString(),
    lat: -26.1476,
    lon: 28.0436
  }
]

const initialMarketItems: MarketItem[] = [
  {
    id: 'market-demo-1',
    title: 'Bunk bed frame, good condition',
    description: 'Moving out — solid wood bunk bed, no mattress. Buyer collects.',
    price: 900,
    currency: 'ZAR',
    category: 'Furniture',
    suburb: 'Rosebank',
    status: 'available',
    createdBy: 'landlord-demo-1',
    createdAt: new Date().toISOString()
  },
  {
    id: 'market-demo-2',
    title: 'Microwave, barely used',
    description: 'Upgrading kitchens — this one still works perfectly.',
    price: 350,
    currency: 'ZAR',
    category: 'Appliances',
    suburb: 'Braamfontein',
    status: 'available',
    createdBy: 'landlord-demo-2',
    createdAt: new Date().toISOString()
  }
]

const initialVendors: Vendor[] = [
  {
    id: 'vendor-demo-1',
    name: 'Corner Spaza Shop',
    category: 'Grocery',
    description: 'Everyday essentials, airtime, and cold drinks.',
    contactNumber: '071 555 1234',
    status: 'active',
    rating: 4.4,
    reviewsCount: 18,
    lat: -26.1480,
    lon: 28.0440
  },
  {
    id: 'vendor-demo-2',
    name: 'Braam Fresh Produce',
    category: 'Fruit & Veg',
    description: 'Daily fresh produce delivered from local farms.',
    contactNumber: '073 555 6789',
    status: 'active',
    rating: 4.7,
    reviewsCount: 9
  }
]

const initialGroupBuys: GroupBuy[] = [
  {
    id: 'groupbuy-demo-1',
    title: 'Bulk order: bottled water crates',
    description: 'Splitting a pallet order to get the wholesale rate — need 20 pledges.',
    targetAmount: 20,
    currentPledges: 12,
    status: 'open',
    createdBy: 'landlord-demo-1',
    endDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString()
  }
]

const initialSkills: Skill[] = [
  {
    id: 'skill-demo-1',
    userId: 'roommate-demo-1',
    title: 'Basic bookkeeping',
    category: 'Admin',
    description: 'Can help small vendors set up simple spreadsheets and invoices.',
    experienceLevel: 'Intermediate',
    contactInfo: '082 111 2233'
  },
  {
    id: 'skill-demo-2',
    userId: 'roommate-demo-2',
    title: 'Guitar lessons',
    category: 'Music',
    description: 'Beginner-friendly guitar lessons, weekends only.',
    experienceLevel: 'Advanced',
    contactInfo: '083 222 3344'
  }
]

const initialLostFound: LostFound[] = [
  {
    id: 'lostfound-demo-1',
    title: 'Found: grey tabby cat',
    description: 'Friendly grey tabby found near the Baker Street corner, no collar.',
    type: 'found',
    location: 'Braamfontein',
    contactInfo: '084 333 4455',
    status: 'active'
  }
]

const initialCareCircle: CareCircleCheck[] = [
  {
    id: 'care-demo-1',
    name: 'Mrs. Dlamini (No. 14)',
    status: 'ok',
    lastCheckedAt: new Date().toISOString(),
    checkedByName: 'Naledi M.'
  },
  {
    id: 'care-demo-2',
    name: 'Mr. van Zyl (No. 7)',
    status: 'pending',
    lastCheckedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
  }
]

const initialSharedResources: SharedResource[] = [
  {
    id: 'resource-demo-1',
    name: 'Community WiFi hotspot',
    type: 'hotspot',
    status: 'active',
    description: 'Shared fibre hotspot for the block, ask an admin for the password.',
    location: 'Rosebank community hall',
    latitude: -26.1470,
    longitude: 28.0430
  }
]

const initialNeighbourhoodStatus: NeighbourhoodStatus[] = [
  {
    id: 'status-demo-1',
    service: 'electricity',
    status: 'outage',
    suburb: 'Rosebank',
    updatedAt: new Date().toISOString(),
    startsAt: new Date().toISOString(),
    endsAt: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
    source: 'official',
    providerId: null
  }
]

const communitySlice = createSlice({
  name: 'community',
  initialState: {
    tools: initialTools,
    chores: initialChores,
    notices: initialNotices,
    disputes: initialDisputes,
    reputationScores: {} as Record<string, number>,
    communities: initialCommunities,
    alerts: initialAlerts,
    marketItems: initialMarketItems,
    vendors: initialVendors,
    groupBuys: initialGroupBuys,
    skills: initialSkills,
    lostFound: initialLostFound,
    careCircle: initialCareCircle,
    sharedResources: initialSharedResources,
    neighbourhoodStatus: initialNeighbourhoodStatus,
    // Community ids the signed-in user actually belongs to, and a member count
    // per community — both derived from res_community_members, which nothing
    // previously read on the client (the "Communities" tab used to hardcode []).
    myCommunityIds: [] as string[],
    communityMemberCounts: {} as Record<string, number>
  },
  reducers: {
    setMyCommunityIds: (state, action: PayloadAction<string[]>) => {
      state.myCommunityIds = action.payload.map(toUUID)
    },
    setCommunityMemberCounts: (state, action: PayloadAction<Record<string, number>>) => {
      state.communityMemberCounts = action.payload
    },
    setTools: (state, action: PayloadAction<ToolItem[]>) => {
      state.tools = action.payload.map(t => ({
        ...t,
        id: toUUID(t.id),
        ownerId: toUUID(t.ownerId),
        rentedBy: t.rentedBy ? toUUID(t.rentedBy) : undefined
      }))
    },
    setChores: (state, action: PayloadAction<ChoreAssignment[]>) => {
      state.chores = action.payload.map(c => ({
        ...c,
        id: toUUID(c.id),
        roommateId: toUUID(c.roommateId)
      }))
    },
    setNotices: (state, action: PayloadAction<NoticeEvent[]>) => {
      state.notices = action.payload.map(n => ({
        ...n,
        id: toUUID(n.id),
        postedById: toUUID(n.postedById)
      }))
    },
    setDisputes: (state, action: PayloadAction<CommunityDispute[]>) => {
      state.disputes = action.payload.map(d => ({
        ...d,
        id: toUUID(d.id),
        reportedById: toUUID(d.reportedById),
        againstUserId: d.againstUserId ? toUUID(d.againstUserId) : '',
        mediatorId: d.mediatorId ? toUUID(d.mediatorId) : ''
      }))
    },
    setCommunities: (state, action: PayloadAction<Community[]>) => {
      state.communities = action.payload.map(c => ({ ...c, id: toUUID(c.id), createdBy: toUUID(c.createdBy) }))
    },
    setAlerts: (state, action: PayloadAction<Alert[]>) => {
      state.alerts = action.payload.map(a => ({ ...a, id: toUUID(a.id), createdBy: toUUID(a.createdBy) }))
    },
    setMarketItems: (state, action: PayloadAction<MarketItem[]>) => {
      state.marketItems = action.payload.map(m => ({ ...m, id: toUUID(m.id), createdBy: toUUID(m.createdBy) }))
    },
    setVendors: (state, action: PayloadAction<Vendor[]>) => {
      state.vendors = action.payload.map(v => ({ ...v, id: toUUID(v.id) }))
    },
    setGroupBuys: (state, action: PayloadAction<GroupBuy[]>) => {
      state.groupBuys = action.payload.map(g => ({ ...g, id: toUUID(g.id), createdBy: toUUID(g.createdBy) }))
    },
    setSkills: (state, action: PayloadAction<Skill[]>) => {
      state.skills = action.payload.map(s => ({ ...s, id: toUUID(s.id), userId: toUUID(s.userId) }))
    },
    setLostFound: (state, action: PayloadAction<LostFound[]>) => {
      state.lostFound = action.payload.map(l => ({ ...l, id: toUUID(l.id) }))
    },
    setCareCircle: (state, action: PayloadAction<CareCircleCheck[]>) => {
      state.careCircle = action.payload.map(c => ({ ...c, id: toUUID(c.id) }))
    },
    setSharedResources: (state, action: PayloadAction<SharedResource[]>) => {
      state.sharedResources = action.payload.map(r => ({ ...r, id: toUUID(r.id) }))
    },
    setNeighbourhoodStatus: (state, action: PayloadAction<NeighbourhoodStatus[]>) => {
      state.neighbourhoodStatus = action.payload.map(n => ({ ...n, id: toUUID(n.id) }))
    },
    addTool: (state, action: PayloadAction<ToolItem>) => {
      const tool = { ...action.payload }
      tool.id = toUUID(tool.id)
      tool.ownerId = toUUID(tool.ownerId)
      state.tools.push(tool)
    },
    rentTool: (state, action: PayloadAction<{ toolId: string; rentedBy: string; rentedByName: string; rentedUntil: string }>) => {
      const toolId = toUUID(action.payload.toolId)
      const tool = state.tools.find(t => toUUID(t.id) === toolId)
      if (tool && tool.status === 'available') {
        tool.status = 'rented'
        tool.rentedBy = toUUID(action.payload.rentedBy)
        tool.rentedByName = action.payload.rentedByName
        tool.rentedUntil = action.payload.rentedUntil
      }
    },
    returnTool: (state, action: PayloadAction<string>) => {
      const toolId = toUUID(action.payload)
      const tool = state.tools.find(t => toUUID(t.id) === toolId)
      if (tool && tool.status === 'rented') {
        tool.status = 'available'
        tool.rentedBy = undefined
        tool.rentedByName = undefined
        tool.rentedUntil = undefined
      }
    },
    addChore: (state, action: PayloadAction<ChoreAssignment>) => {
      const chore = { ...action.payload }
      chore.id = toUUID(chore.id)
      chore.roommateId = toUUID(chore.roommateId)
      state.chores.push(chore)
    },
    completeChore: (state, action: PayloadAction<{ choreId: string; completedAt: string }>) => {
      const choreId = toUUID(action.payload.choreId)
      const chore = state.chores.find(c => toUUID(c.id) === choreId)
      if (chore && chore.status === 'pending') {
        chore.status = 'completed'
        chore.completedAt = action.payload.completedAt
        const rId = toUUID(chore.roommateId)
        state.reputationScores[rId] = (state.reputationScores[rId] || 0) + 10
      }
    },
    resetChoreWeek: (state, action: PayloadAction<ChoreAssignment[]>) => {
      state.chores = action.payload.map(c => ({
        ...c,
        id: toUUID(c.id),
        roommateId: toUUID(c.roommateId)
      }))
    },
    addNoticeEvent: (state, action: PayloadAction<NoticeEvent>) => {
      const notice = { ...action.payload }
      notice.id = toUUID(notice.id)
      notice.postedById = toUUID(notice.postedById)
      state.notices.unshift(notice)
    },
    rsvpToEvent: (state, action: PayloadAction<{ noticeId: string; userName: string }>) => {
      const noticeId = toUUID(action.payload.noticeId)
      const notice = state.notices.find(n => toUUID(n.id) === noticeId)
      if (notice && notice.type === 'event') {
        if (!notice.rsvps.includes(action.payload.userName)) {
          notice.rsvps.push(action.payload.userName)
        } else {
          notice.rsvps = notice.rsvps.filter(u => u !== action.payload.userName)
        }
      }
    },
    vibeNotice: (state, action: PayloadAction<{ noticeId: string; userName: string }>) => {
      const noticeId = toUUID(action.payload.noticeId)
      const notice = state.notices.find(n => toUUID(n.id) === noticeId)
      if (notice) {
        if (!notice.vibes) notice.vibes = []
        if (!notice.vibes.includes(action.payload.userName)) {
          notice.vibes.push(action.payload.userName)
        } else {
          notice.vibes = notice.vibes.filter(u => u !== action.payload.userName)
        }
      }
    },
    echoNotice: (state, action: PayloadAction<{ noticeId: string; userName: string }>) => {
      const noticeId = toUUID(action.payload.noticeId)
      const notice = state.notices.find(n => toUUID(n.id) === noticeId)
      if (notice) {
        if (!notice.echos) notice.echos = []
        if (!notice.echos.includes(action.payload.userName)) {
          notice.echos.push(action.payload.userName)
        } else {
          notice.echos = notice.echos.filter(u => u !== action.payload.userName)
        }
      }
    },
    vibeNoticeRollback: (state, action: PayloadAction<{ noticeId: string; userName: string }>) => {
      const noticeId = toUUID(action.payload.noticeId)
      const notice = state.notices.find(n => toUUID(n.id) === noticeId)
      if (notice && notice.vibes) {
        if (notice.vibes.includes(action.payload.userName)) {
          notice.vibes = notice.vibes.filter(u => u !== action.payload.userName)
        } else {
          notice.vibes.push(action.payload.userName)
        }
      }
    },
    echoNoticeRollback: (state, action: PayloadAction<{ noticeId: string; userName: string }>) => {
      const noticeId = toUUID(action.payload.noticeId)
      const notice = state.notices.find(n => toUUID(n.id) === noticeId)
      if (notice && notice.echos) {
        if (notice.echos.includes(action.payload.userName)) {
          notice.echos = notice.echos.filter(u => u !== action.payload.userName)
        } else {
          notice.echos.push(action.payload.userName)
        }
      }
    },
    rsvpNoticeRollback: (state, action: PayloadAction<{ noticeId: string; userName: string }>) => {
      const noticeId = toUUID(action.payload.noticeId)
      const notice = state.notices.find(n => toUUID(n.id) === noticeId)
      if (notice && notice.type === 'event') {
        if (notice.rsvps.includes(action.payload.userName)) {
          notice.rsvps = notice.rsvps.filter(u => u !== action.payload.userName)
        } else {
          notice.rsvps.push(action.payload.userName)
        }
      }
    },
    addDispute: (state, action: PayloadAction<CommunityDispute>) => {
      const dispute = { ...action.payload }
      dispute.id = toUUID(dispute.id)
      dispute.reportedById = toUUID(dispute.reportedById)
      if (dispute.againstUserId) dispute.againstUserId = toUUID(dispute.againstUserId)
      if (dispute.mediatorId) dispute.mediatorId = toUUID(dispute.mediatorId)
      state.disputes.unshift(dispute)
    },
    updateDisputeStatus: (state, action: PayloadAction<{ 
      disputeId: string; 
      status: 'pending' | 'mediating' | 'resolved'; 
      resolutionDetails?: string;
      votesForClaimant?: number;
      votesForRespondent?: number;
      juryStatus?: 'not_started' | 'voting' | 'completed';
    }>) => {
      const disputeId = toUUID(action.payload.disputeId)
      const dispute = state.disputes.find(d => toUUID(d.id) === disputeId)
      if (dispute) {
        dispute.status = action.payload.status
        if (action.payload.resolutionDetails) {
          dispute.resolutionDetails = action.payload.resolutionDetails
        }
        if (action.payload.votesForClaimant !== undefined) dispute.votesForClaimant = action.payload.votesForClaimant
        if (action.payload.votesForRespondent !== undefined) dispute.votesForRespondent = action.payload.votesForRespondent
        if (action.payload.juryStatus !== undefined) dispute.juryStatus = action.payload.juryStatus
      }
    },
    addCommunity: (state, action: PayloadAction<Community>) => {
      state.communities.push({ ...action.payload, id: toUUID(action.payload.id), createdBy: toUUID(action.payload.createdBy) })
    },
    addAlert: (state, action: PayloadAction<Alert>) => {
      state.alerts.push({ ...action.payload, id: toUUID(action.payload.id), createdBy: toUUID(action.payload.createdBy) })
    },
    resolveAlert: (state, action: PayloadAction<string>) => {
      const alert = state.alerts.find(a => toUUID(a.id) === toUUID(action.payload))
      if (alert) alert.status = 'resolved'
    },
    addMarketItem: (state, action: PayloadAction<MarketItem>) => {
      state.marketItems.push({ ...action.payload, id: toUUID(action.payload.id), createdBy: toUUID(action.payload.createdBy) })
    },
    sellMarketItem: (state, action: PayloadAction<string>) => {
      const item = state.marketItems.find(m => toUUID(m.id) === toUUID(action.payload))
      if (item) item.status = 'sold'
    },
    addVendor: (state, action: PayloadAction<Vendor>) => {
      state.vendors.push({ ...action.payload, id: toUUID(action.payload.id) })
    },
    addGroupBuy: (state, action: PayloadAction<GroupBuy>) => {
      state.groupBuys.push({ ...action.payload, id: toUUID(action.payload.id), createdBy: toUUID(action.payload.createdBy) })
    },
    pledgeGroupBuy: (state, action: PayloadAction<{ groupBuyId: string; amount: number }>) => {
      const gb = state.groupBuys.find(g => toUUID(g.id) === toUUID(action.payload.groupBuyId))
      if (gb) gb.currentPledges += action.payload.amount
    },
    // Reconciles with the total res_pledge_group_buy recomputed from the
    // pledge rows (the pledge row, not the counter, is the source of truth).
    setGroupBuyProgress: (state, action: PayloadAction<{ groupBuyId: string; currentPledges: number }>) => {
      const gb = state.groupBuys.find(g => toUUID(g.id) === toUUID(action.payload.groupBuyId))
      if (gb) {
        gb.currentPledges = action.payload.currentPledges
        if (gb.currentPledges >= gb.targetAmount) gb.status = 'completed'
      }
    },
    pledgeGroupBuyRollback: (state, action: PayloadAction<{ groupBuyId: string; amount: number }>) => {
      const gb = state.groupBuys.find(g => toUUID(g.id) === toUUID(action.payload.groupBuyId))
      if (gb) gb.currentPledges = Math.max(0, gb.currentPledges - action.payload.amount)
    },
    addSkill: (state, action: PayloadAction<Skill>) => {
      state.skills.push({ ...action.payload, id: toUUID(action.payload.id), userId: toUUID(action.payload.userId) })
    },
    addLostFound: (state, action: PayloadAction<LostFound>) => {
      state.lostFound.push({ ...action.payload, id: toUUID(action.payload.id) })
    },
    resolveLostFound: (state, action: PayloadAction<string>) => {
      const lf = state.lostFound.find(l => toUUID(l.id) === toUUID(action.payload))
      if (lf) lf.status = 'resolved'
    },
    checkCareCircle: (state, action: PayloadAction<{ id: string; status: 'ok' | 'needs_assistance'; checkedByName: string }>) => {
      const c = state.careCircle.find(cc => toUUID(cc.id) === toUUID(action.payload.id))
      if (c) {
        c.status = action.payload.status
        c.lastCheckedAt = new Date().toISOString()
        c.checkedByName = action.payload.checkedByName
      }
    },
    addSharedResource: (state, action: PayloadAction<SharedResource>) => {
      state.sharedResources.push({ ...action.payload, id: toUUID(action.payload.id) })
    },
    updateSharedResourceStatus: (state, action: PayloadAction<{ id: string; status: string }>) => {
      const r = state.sharedResources.find(res => toUUID(res.id) === toUUID(action.payload.id))
      if (r) r.status = action.payload.status
    },
    updateNeighbourhoodStatus: (state, action: PayloadAction<NeighbourhoodStatus>) => {
      const idx = state.neighbourhoodStatus.findIndex(n => toUUID(n.id) === toUUID(action.payload.id))
      if (idx !== -1) {
        state.neighbourhoodStatus[idx] = action.payload
      } else {
        state.neighbourhoodStatus.push(action.payload)
      }
    },
    updateVendorVerification: (state, action: PayloadAction<{ id: string; approachPhotoUrl?: string; lastVerifiedAt: string; verifiedByUserId: string }>) => {
      const item = state.vendors.find(v => toUUID(v.id) === toUUID(action.payload.id))
      if (item) {
        if (action.payload.approachPhotoUrl) item.approachPhotoUrl = action.payload.approachPhotoUrl
        item.lastVerifiedAt = action.payload.lastVerifiedAt
        item.verifiedByUserId = toUUID(action.payload.verifiedByUserId)
      }
    },
    updateResourceVerification: (state, action: PayloadAction<{ id: string; approachPhotoUrl?: string; lastVerifiedAt: string; verifiedByUserId: string }>) => {
      const item = state.sharedResources.find(r => toUUID(r.id) === toUUID(action.payload.id))
      if (item) {
        if (action.payload.approachPhotoUrl) item.approachPhotoUrl = action.payload.approachPhotoUrl
        item.lastVerifiedAt = action.payload.lastVerifiedAt
        item.verifiedByUserId = toUUID(action.payload.verifiedByUserId)
      }
    }
  }
})

// Notifications Slice
export interface AppNotification {
  id: string
  title: string
  message: string
  read: boolean
  timestamp: string
  /**
   * The res_* notification type (see NotificationPrefsPanel's MUTABLE_TYPES
   * for the real taxonomy, plus PANIC_TYPE), used to pick which sound tone
   * plays (utils/notificationSounds.ts). Undefined for locally-generated,
   * synthetic notifications (offline-queue/sync-status messages) that never
   * came from the shared `notifications` table and have no real type.
   */
  type?: string
}

const notificationsSlice = createSlice({
  name: 'notifications',
  initialState: {
    items: [] as AppNotification[],
    virtualCount: 0
  },
  reducers: {
    // #45: notifications loaded from the shared `notifications` table, so they
    // survive a refresh instead of living only in Redux.
    setNotifications: (state, action: PayloadAction<AppNotification[]>) => {
      state.items = action.payload
      state.virtualCount = action.payload.filter(n => !n.read).length
    },
    addNotification: (state, action: PayloadAction<Omit<AppNotification, 'id' | 'timestamp'>>) => {
      state.items.unshift({
        ...action.payload,
        id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        timestamp: new Date().toISOString()
      })
      if (state.items.length > 50) {
        state.items.pop()
      }
    },
    markAllNotificationsRead: (state) => {
      state.virtualCount = 0
      state.items.forEach(item => {
        item.read = true
      })
    },
    // Bumps just the badge count, O(1) memory — `items` is deliberately left
    // untouched (still capped at 50 by addNotification above) rather than
    // ever trying to hold one Redux array entry per real notification. A
    // flood of unread counts (e.g. catching up after being offline) needs an
    // accurate number on the bell icon, not 500,000 array elements behind it.
    floodNotifications: (state, action: PayloadAction<number>) => {
      state.virtualCount = action.payload
    }
  }
})

// Action Exports
export const {
  loginUser,
  logoutUser,
  registerFailedAttempt,
  resetFailedAttempts,
  updateProfile,
  updatePreferences,
  updateUserRole,
  setLegalName
} = authSlice.actions

export const { setListings, addListing, deleteListing, updateListingVerification } = listingsSlice.actions
export const { setRequests, addRequest, updateRequestStatus } = requestsSlice.actions
export const { addLog, incrementApiCall, resetApiCounts } = securitySlice.actions
export const {
  setRoommates,
  setLifts,
  setServices,
  setDispatches,
  setTrafficReports,
  addRoommateSeeker,
  addLiftClub,
  addService,
  deleteService,
  bookSeat,
  setLiftSeats,
  bookSeatRollback,
  addDispatch,
  updateDispatchStatus,
  addTrafficReport
} = networkingSlice.actions
export const { setTokens, addToken, buyToken } = utilitiesSlice.actions
export const {
  setTools,
  setChores,
  setNotices,
  setDisputes,
  addTool,
  rentTool,
  returnTool,
  addChore,
  completeChore,
  resetChoreWeek,
  addNoticeEvent,
  rsvpToEvent,
  vibeNotice,
  echoNotice,
  vibeNoticeRollback,
  echoNoticeRollback,
  rsvpNoticeRollback,
  addDispute,
  updateDisputeStatus,
  setCommunities,
  setAlerts,
  setMarketItems,
  setVendors,
  setGroupBuys,
  setSkills,
  setLostFound,
  setCareCircle,
  setSharedResources,
  setNeighbourhoodStatus,
  addCommunity,
  addAlert,
  resolveAlert,
  addMarketItem,
  sellMarketItem,
  addVendor,
  addGroupBuy,
  pledgeGroupBuy,
  setGroupBuyProgress,
  pledgeGroupBuyRollback,
  addSkill,
  addLostFound,
  resolveLostFound,
  checkCareCircle,
  addSharedResource,
  updateSharedResourceStatus,
  updateNeighbourhoodStatus,
  updateVendorVerification,
  updateResourceVerification,
  setMyCommunityIds,
  setCommunityMemberCounts
} = communitySlice.actions

export const {
  setNotifications,
  addNotification,
  markAllNotificationsRead,
  floodNotifications
} = notificationsSlice.actions

// Async Thunk to fetch live data from Supabase.
// Column names follow resident_schema.sql; display names are resolved from the
// shared profiles trust columns (CONTRACT.md §3) since res_* tables store UUIDs.
export const fetchSupabaseData = createAsyncThunk(
  'data/fetchSupabaseData',
  async (_, { dispatch, getState }) => {
    if (!supabase) return
    dispatch(setDataStatus({ status: 'loading', failedTables: [] }))
    const failedTables: string[] = []
    const markFailed = (table: string, message: string) => {
      // Ignore missing optional tables (404/406/does not exist) to avoid user-facing error banners
      if (
        message.includes('Could not find the table') || 
        message.includes('does not exist') ||
        message.includes('404') ||
        message.includes('406')
      ) {
        console.warn(`Optional table ${table} not yet present in remote DB schema: ${message}`)
        return
      }
      failedTables.push(table)
      console.error(`Failed to fetch ${table}: ${message}`)
    }

    // 0. Display-name lookup (best-effort; blank when RLS hides a profile)
    const nameMap: NameMap = {}
    const { data: profileRows, error: profilesError } = await supabase
      .from('profiles')
      .select('id, display_name, username')
      .limit(2000)
    if (profilesError) {
      markFailed('profiles', profilesError.message)
    } else {
      for (const p of profileRows || []) {
        nameMap[String(p.id).toLowerCase()] = p.display_name || p.username || ''
      }
    }
    const nameOf = (id: string | null | undefined) => db.resolveName(nameMap, id ?? undefined)

    // Cross-reference maps filled by the listings/services fetches below
    const listingTitleById: Record<string, string> = {}
    const serviceNameById: Record<string, string> = {}

    // Every full-table select() below is capped at .limit(200) — this
    // function was doing unconditional, unbounded `select('*')` on ~22
    // tables on every login/reconcile, which only gets slower as each table
    // grows. 200 rows keeps this app's actual working set (recent listings,
    // open requests, live disputes, etc.) intact while putting a hard,
    // predictable ceiling on the worst case instead of an open-ended scan.
    // A follow-up (per-tab fetching, Batch 9 in the plan) is the deeper fix;
    // this is the safe, mechanical stopgap that ships today without risking
    // the cross-references between fetches (e.g. listingTitleById above).

    // 1. Listings
    const fetchListings = async () => {
      const { data, error } = await supabase!.from('res_listings').select('*').limit(200)
      if (error) return markFailed('res_listings', error.message)
      if (!data) return
      data.forEach(item => { listingTitleById[String(item.id)] = item.title })
      dispatch(setListings(data.map(item => ({
        id: item.id,
        title: item.title,
        description: item.description || '',
        price: Number(item.price),
        currency: item.currency || 'ZAR',
        location: item.location,
        suburb: item.suburb || '',
        safetyRating: (item.safety_rating || 'medium') as 'high' | 'medium' | 'low',
        safetyNotes: item.safety_notes || '',
        landlordId: item.landlord_id,
        landlordName: nameOf(item.landlord_id),
        landlordLivesHere: !!item.landlord_lives_here,
        images: item.images || [],
        amenities: {
          wifi: !!item.wifi,
          parking: !!item.parking,
          bathroom: (item.bathroom || 'shared') as 'shared' | 'private' | 'ensuite'
        },
        requirements: {
          genderPreference: (item.req_gender_pref || 'any') as 'men' | 'women' | 'couple' | 'any',
          childrenAllowed: !!item.req_children_allowed,
          maxChildren: item.req_max_children || 0,
          smokingAllowed: !!item.req_smoking_allowed,
          petsAllowed: !!item.req_pets_allowed
        },
        lat: item.lat ? Number(item.lat) : undefined,
        lon: item.lon ? Number(item.lon) : undefined,
        approachPhotoUrl: item.approach_photo_url || undefined,
        microLandmark: item.micro_landmark || undefined,
        lastVerifiedAt: item.last_verified_at || undefined,
        verifiedByUserId: item.verified_by_user_id || undefined,
        featuredUntil: item.featured_until || null,
        propertyId: item.property_id || undefined,
        createdAt: item.created_at || undefined,
        quickPost: !!item.quick_post,
        listingType: (item.listing_type === 'sale' || item.listing_type === 'guesthouse' ? item.listing_type : 'rent') as 'rent' | 'sale' | 'guesthouse',
        eventId: item.event_id || null,
        visibleUntil: item.visible_until || null
      }))))
    }

    // 5. Services (fetched early: dispatches resolve their names from it)
    const fetchServices = async () => {
      const { data, error } = await supabase!.from('res_handyman_services').select('*').limit(200)
      if (error) return markFailed('res_handyman_services', error.message)
      if (!data) return
      data.forEach(item => { serviceNameById[String(item.id)] = item.business_name })
      dispatch(setServices(data.map(item => ({
        id: item.id,
        ownerId: item.owner_id,
        businessName: item.business_name,
        category: item.category as HandymanService['category'],
        location: item.location,
        suburb: item.suburb || '',
        rating: Number(item.rating || 5.0),
        contactNumber: item.contact_number,
        websiteUrl: item.website_url || '',
        priceEstimate: item.price_estimate || '',
        description: item.description || '',
        image: item.image || '',
        reviewsCount: item.reviews_count || 0
      }))))
    }

    // 2. Requests
    const fetchRequests = async () => {
      const { data, error } = await supabase!.from('res_room_requests').select('*').limit(200)
      if (error) return markFailed('res_room_requests', error.message)
      if (!data) return
      dispatch(setRequests(data.map(item => ({
        id: item.id,
        tenantId: item.tenant_id,
        tenantName: nameOf(item.tenant_id),
        listingId: item.listing_id,
        listingTitle: listingTitleById[String(item.listing_id)] || '',
        landlordId: item.landlord_id,
        status: (item.status || 'pending') as 'pending' | 'approved' | 'rejected' | 'waitlisted' | 'saved',
        message: item.message || '',
        timestamp: item.created_at || new Date().toISOString()
      }))))
    }

    // 3. Lifts
    const fetchLifts = async () => {
      const { data, error } = await supabase!.from('res_lift_clubs').select('*').limit(200)
      if (error) return markFailed('res_lift_clubs', error.message)
      if (!data) return
      dispatch(setLifts(data.map(item => ({
        id: item.id,
        driverId: item.driver_id,
        driverName: nameOf(item.driver_id),
        origin: item.origin,
        destination: item.destination,
        departureTime: item.departure_time || '',
        days: item.days || '',
        pricePerSeat: Number(item.price_per_seat),
        currency: item.currency || 'ZAR',
        availableSeats: item.available_seats || 0,
        totalSeats: item.total_seats || 0,
        eventId: item.event_id || null
      }))))
    }

    // 4. Roommates
    const fetchRoommates = async () => {
      const { data, error } = await supabase!.from('res_roommate_seekers').select('*').limit(200)
      if (error) return markFailed('res_roommate_seekers', error.message)
      if (!data) return
      dispatch(setRoommates(data.map(item => ({
        id: item.id,
        name: nameOf(item.id),
        gender: (item.gender || 'men') as 'men' | 'women',
        childrenCount: item.children_count || 0,
        budget: Number(item.budget || 0),
        currency: item.currency || 'ZAR',
        location: item.location || '',
        suburb: item.suburb || '',
        bio: item.bio || ''
      }))))
    }

    // 6. Dispatches
    const fetchDispatches = async () => {
      const { data, error } = await supabase!.from('res_service_dispatches').select('*').limit(200)
      if (error) return markFailed('res_service_dispatches', error.message)
      if (!data) return
      dispatch(setDispatches(data.map(item => ({
        id: item.id,
        serviceId: item.service_id,
        serviceName: serviceNameById[String(item.service_id)] || '',
        senderId: item.sender_id,
        senderName: nameOf(item.sender_id),
        senderRole: 'tenant' as ServiceDispatch['senderRole'],
        message: item.message || '',
        status: (item.status || 'pending') as ServiceDispatch['status'],
        timestamp: item.created_at || new Date().toISOString(),
        proofFileName: undefined,
        proofFileUrl: item.proof_file_url || undefined
      }))))
    }

    // 7. Utility Vouchers (schema: meter_label / claimed_by / status 'claimed';
    // voucher codes are never stored — broker posture, CONTRACT.md §6)
    const fetchTokens = async () => {
      const { data, error } = await supabase!.from('res_utility_tokens').select('*').limit(200)
      if (error) return markFailed('res_utility_tokens', error.message)
      if (!data) return
      dispatch(setTokens(data.map(item => ({
        id: item.id,
        landlordId: item.landlord_id,
        landlordName: nameOf(item.landlord_id),
        meterNumber: item.meter_label || '',
        price: Number(item.price),
        currency: item.currency || 'ZAR',
        tokenCode: '',
        status: (item.status === 'claimed' ? 'sold' : 'available') as UtilityToken['status'],
        purchasedBy: item.claimed_by || undefined,
        purchasedAt: item.claimed_at || undefined
      }))))
    }

    // 8. Tools
    const fetchTools = async () => {
      const { data, error } = await supabase!.from('res_tool_library').select('*').limit(200)
      if (error) return markFailed('res_tool_library', error.message)
      if (!data) return
      dispatch(setTools(data.map(item => ({
        id: item.id,
        ownerId: item.owner_id,
        ownerName: nameOf(item.owner_id),
        title: item.title,
        description: item.description || '',
        pricePerDay: Number(item.price_per_day),
        currency: item.currency || 'ZAR',
        deposit: Number(item.deposit || 0),
        location: item.location || '',
        status: (item.status || 'available') as ToolItem['status'],
        rentedBy: item.rented_by || undefined,
        rentedByName: item.rented_by ? nameOf(item.rented_by) : undefined,
        rentedUntil: item.rented_until || undefined
      }))))
    }

    // 9. Chores
    const fetchChores = async () => {
      const { data, error } = await supabase!.from('res_chore_schedule').select('*').limit(200)
      if (error) return markFailed('res_chore_schedule', error.message)
      if (!data) return
      dispatch(setChores(data.map(item => ({
        id: item.id,
        listingId: item.listing_id,
        roommateId: item.roommate_id,
        roommateName: nameOf(item.roommate_id),
        taskName: item.task_name,
        dayOfWeek: item.day_of_week || '',
        status: (item.status || 'pending') as ChoreAssignment['status'],
        completedAt: item.completed_at || undefined
      }))))
    }

    // 10. Disputes
    const fetchDisputes = async () => {
      const { data, error } = await supabase!.from('res_community_disputes').select('*').limit(200)
      if (error) return markFailed('res_community_disputes', error.message)
      if (!data) return
      dispatch(setDisputes(data.map(item => ({
        id: item.id,
        title: item.title,
        description: item.description || '',
        category: (item.category || 'Other') as CommunityDispute['category'],
        reportedBy: nameOf(item.reported_by_id),
        reportedById: item.reported_by_id,
        againstUser: nameOf(item.against_user_id),
        againstUserId: item.against_user_id || '',
        mediatorId: item.mediator_id || '',
        mediatorName: nameOf(item.mediator_id),
        status: (item.status || 'pending') as CommunityDispute['status'],
        resolutionDetails: item.resolution_details || undefined,
        timestamp: item.created_at || new Date().toISOString()
      }))))
    }

    // 11. Notices (rsvps/vibes/echos are uuid[] in the DB; the UI tracks names)
    const fetchNotices = async () => {
      const { data, error } = await supabase!.from('res_notice_events').select('*').limit(200)
      if (error) return markFailed('res_notice_events', error.message)
      if (!data) return
      dispatch(setNotices(data.map(item => ({
        id: item.id,
        title: item.title,
        description: item.description || '',
        type: (item.type || 'notice') as NoticeEvent['type'],
        postedBy: nameOf(item.posted_by_id),
        postedById: item.posted_by_id,
        timestamp: item.created_at || new Date().toISOString(),
        eventDate: item.event_date || undefined,
        rsvps: db.uuidsToNames(item.rsvps, nameMap),
        vibes: db.uuidsToNames(item.vibes, nameMap),
        echos: db.uuidsToNames(item.echos, nameMap)
      }))))
    }

    // 12. Communities
    const fetchCommunities = async () => {
      const { data, error } = await supabase!.from('res_communities').select('*').limit(200)
      if (error) return markFailed('res_communities', error.message)
      if (!data) return
      dispatch(setCommunities(data.map(item => ({
        id: item.id,
        name: item.name,
        kind: (item.kind || 'suburb') as Community['kind'],
        description: '',
        location: item.suburb || '',
        suburb: item.suburb || '',
        createdBy: item.created_by,
        createdAt: item.created_at
      }))))
    }

    // Community membership: who am I in, and how many members does each have.
    // res_community_members select-RLS is `using (true)`, so any signed-in user
    // can read every row; the "Communities" tab used to hardcode both as empty.
    const fetchCommunityMembership = async () => {
      const { data, error } = await supabase!.from('res_community_members').select('community_id, user_id')
      if (error) return markFailed('res_community_members', error.message)
      if (!data) return

      const counts: Record<string, number> = {}
      const mine: string[] = []
      const myId = (getState() as RootState).auth.currentUser?.id
      for (const row of data) {
        const cid = String(row.community_id)
        counts[cid] = (counts[cid] || 0) + 1
        if (myId && toUUID(String(row.user_id)) === toUUID(myId)) mine.push(cid)
      }
      dispatch(setCommunityMemberCounts(counts))
      dispatch(setMyCommunityIds(mine))
    }

    // 13. Alerts
    const fetchAlerts = async () => {
      const { data, error } = await supabase!.from('res_alerts').select('*').limit(200)
      if (error) return markFailed('res_alerts', error.message)
      if (!data) return
      dispatch(setAlerts(data.map(item => ({
        id: item.id,
        title: item.title,
        description: item.description || '',
        kind: (item.kind || 'incident') as Alert['kind'],
        category: (item.kind === 'panic' || item.kind === 'suspicious' ? 'security' : 'other') as Alert['category'],
        severity: ({ low: 'info', medium: 'warning', high: 'critical', critical: 'panic' }[String(item.severity)] || 'warning') as Alert['severity'],
        status: (item.status === 'active' ? 'active' : 'resolved') as Alert['status'],
        suburb: item.suburb || '',
        createdBy: item.user_id,
        createdAt: item.created_at,
        lat: Number(item.lat || 0),
        lon: Number(item.lon || 0)
      }))))
    }

    // 14. Market Items
    const fetchMarketItems = async () => {
      const { data, error } = await supabase!.from('res_market_items').select('*').limit(200)
      if (error) return markFailed('res_market_items', error.message)
      if (!data) return
      dispatch(setMarketItems(data.map(item => ({
        id: item.id,
        title: item.title,
        description: item.description || '',
        price: Number(item.price || 0),
        currency: item.currency || 'ZAR',
        category: item.category || '',
        suburb: item.suburb || '',
        imageUrl: (item.images && item.images[0]) || undefined,
        status: (item.status === 'available' ? 'available' : 'sold') as MarketItem['status'],
        createdBy: item.user_id,
        createdAt: item.created_at,
        featuredUntil: item.featured_until || null
      }))))
    }

    // 15. Vendors
    const fetchVendors = async () => {
      const { data, error } = await supabase!.from('res_vendors').select('*').limit(200)
      if (error) return markFailed('res_vendors', error.message)
      if (!data) return
      dispatch(setVendors(data.map(item => ({
        id: item.id,
        name: item.name,
        category: item.kind || '',
        description: '',
        contactNumber: item.phone || '',
        status: 'active' as Vendor['status'],
        rating: 5.0,
        reviewsCount: 0,
        lat: item.lat ? Number(item.lat) : undefined,
        lon: item.lon ? Number(item.lon) : undefined,
        approachPhotoUrl: item.approach_photo_url || undefined,
        microLandmark: item.micro_landmark || undefined,
        lastVerifiedAt: item.last_verified_at || undefined,
        verifiedByUserId: item.verified_by_user_id || undefined
      }))))
    }

    // 16. Group Buys
    const fetchGroupBuys = async () => {
      const { data, error } = await supabase!.from('res_group_buys').select('*').limit(200)
      if (error) return markFailed('res_group_buys', error.message)
      if (!data) return
      dispatch(setGroupBuys(data.map(item => ({
        id: item.id,
        title: item.title,
        description: item.description || '',
        targetAmount: Number(item.target_quantity || 0),
        currentPledges: Number(item.current_quantity || 0),
        status: item.status as GroupBuy['status'],
        createdBy: item.organizer_id,
        endDate: item.deadline || ''
      }))))
    }

    // 17. Skills
    const fetchSkills = async () => {
      const { data, error } = await supabase!.from('res_skills').select('*').limit(200)
      if (error) return markFailed('res_skills', error.message)
      if (!data) return
      dispatch(setSkills(data.map(item => ({
        id: item.id,
        userId: item.user_id,
        title: item.title,
        category: item.category || '',
        description: item.description || '',
        experienceLevel: item.rate_note || '',
        contactInfo: ''
      }))))
    }

    // 18. Lost & Found
    const fetchLostFound = async () => {
      const { data, error } = await supabase!.from('res_lost_found').select('*').limit(200)
      if (error) return markFailed('res_lost_found', error.message)
      if (!data) return
      dispatch(setLostFound(data.map(item => ({
        id: item.id,
        title: item.title,
        description: item.description || '',
        type: item.kind as LostFound['type'],
        location: item.last_seen || '',
        contactInfo: '',
        imageUrl: (item.images && item.images[0]) || undefined,
        status: (item.status === 'reunited' ? 'resolved' : 'active') as LostFound['status']
      }))))
    }

    // 19. Care Circle
    const fetchCareCircle = async () => {
      const { data, error } = await supabase!.from('res_care_circle').select('*').limit(200)
      if (error) return markFailed('res_care_circle', error.message)
      if (!data) return
      dispatch(setCareCircle(data.map(item => ({
        id: item.id,
        name: nameOf(item.subject_id),
        status: (item.status === 'active' ? 'ok' : 'pending') as CareCircleCheck['status'],
        lastCheckedAt: item.last_ok_at || new Date().toISOString(),
        checkedByName: nameOf(item.carer_id) || undefined
      }))))
    }

    // 20. Shared Resources
    const fetchSharedResources = async () => {
      const { data, error } = await supabase!.from('res_shared_resources').select('*').limit(200)
      if (error) return markFailed('res_shared_resources', error.message)
      if (!data) return
      dispatch(setSharedResources(data.map(item => ({
        id: item.id,
        name: item.title,
        type: (item.kind === 'wifi_hotspot' ? 'hotspot' : item.kind === 'borehole' ? 'borehole' : 'other') as SharedResource['type'],
        status: item.availability || 'available',
        description: item.access_note || '',
        location: item.suburb || '',
        latitude: Number(item.lat || 0),
        longitude: Number(item.lon || 0),
        approachPhotoUrl: item.approach_photo_url || undefined,
        microLandmark: item.micro_landmark || undefined,
        lastVerifiedAt: item.last_verified_at || undefined,
        verifiedByUserId: item.verified_by_user_id || undefined
      }))))
    }

    // 21. Neighbourhood Statuses
    const fetchNeighbourhoodStatus = async () => {
      const { data, error } = await supabase!.from('res_neighbourhood_status').select('*').limit(200)
      if (error) return markFailed('res_neighbourhood_status', error.message)
      if (!data) return
      dispatch(setNeighbourhoodStatus(data.map(item => ({
        id: item.id,
        service: (item.kind === 'power' ? 'electricity' : item.kind) as NeighbourhoodStatus['service'],
        status: (item.status === 'up' ? 'active' : 'outage') as NeighbourhoodStatus['status'],
        suburb: item.suburb || '',
        updatedAt: item.created_at || new Date().toISOString(),
        startsAt: item.starts_at || item.created_at || new Date().toISOString(),
        endsAt: item.ends_at || null,
        source: (item.source === 'official' ? 'official' : 'crowd') as NeighbourhoodStatus['source'],
        providerId: item.provider_id || null
      }))))
    }

    // 22. Traffic Reports
    const fetchTrafficReports = async () => {
      const { data, error } = await supabase!.from('res_traffic_reports').select('*').limit(200)
      if (error) return markFailed('res_traffic_reports', error.message)
      if (!data) return
      dispatch(setTrafficReports(data.map(item => ({
        id: item.id,
        reporterId: item.reporter_id,
        suburb: item.suburb || '',
        city: item.city || '',
        lat: Number(item.lat),
        lon: Number(item.lon),
        reportType: item.report_type as TrafficReport['reportType'],
        description: item.description || '',
        createdAt: item.created_at
      }))))
    }

    // Listings + services first so requests/dispatches can resolve titles,
    // then everything else in parallel.
    await Promise.all([fetchListings(), fetchServices()])
    await Promise.all([
      fetchRequests(),
      fetchLifts(),
      fetchRoommates(),
      fetchDispatches(),
      fetchTokens(),
      fetchTools(),
      fetchChores(),
      fetchDisputes(),
      fetchNotices(),
      fetchCommunities(),
      fetchCommunityMembership(),
      fetchAlerts(),
      fetchMarketItems(),
      fetchVendors(),
      fetchGroupBuys(),
      fetchSkills(),
      fetchLostFound(),
      fetchCareCircle(),
      fetchSharedResources(),
      fetchNeighbourhoodStatus(),
      fetchTrafficReports()
    ])

    dispatch(setDataStatus({
      status: failedTables.length > 0 ? 'error' : 'ready',
      failedTables
    }))
  }
)

// Background synchronization middleware for Supabase mirror
import { Middleware } from 'redux'

// Throws when the Security Labs / scale-test "network kill" switch is active
const assertNetworkAlive = () => {
  const isKilled = (typeof window !== 'undefined' && (window as unknown as { __networkKilled?: boolean }).__networkKilled) ||
                   (typeof global !== 'undefined' && (global as unknown as { __networkKilled?: boolean }).__networkKilled);
  if (isKilled) {
    throw new Error("Network offline (simulated)");
  }
}

// Real connectivity loss, or the simulated kill switch used by Security Labs.
const isOffline = () => {
  const killed = (typeof globalThis !== 'undefined' && (globalThis as unknown as { __networkKilled?: boolean }).__networkKilled)
  const browserOffline = typeof navigator !== 'undefined' && navigator.onLine === false
  return !!killed || browserOffline
}

// Actions whose optimistic update is undone by a rollback reducer on failure.
// They must NOT be queued for replay: Redux has already reverted them, so
// replaying the write would put the DB out of step with the UI. Toggles would
// also flip twice.
const ROLLED_BACK_ACTIONS: string[] = [
  vibeNotice.type,
  echoNotice.type,
  rsvpToEvent.type,
  bookSeat.type,
  pledgeGroupBuy.type
]

const isReplayable = (actionType: string) => !ROLLED_BACK_ACTIONS.includes(actionType)

// Every write below this function funnels through it, which makes it the
// one place to apply the retry-with-backoff layer generally instead of
// re-solving it per call site — a transient failure gets one automatic
// retry; a permission failure (resilientCall's isRetryableError) does not,
// since retrying can't fix "you're not allowed." The 3rd tier — the offline
// queue — is the caller's (syncActionToSupabase's catch block).
const dbUpdate = async (table: string, payload: Record<string, unknown> | null, eqCol?: string, eqVal?: unknown) => {
  assertNetworkAlive();
  if (supabase) {
    const client = supabase;
    await resilientCall(async () => {
      if (eqCol && eqVal !== undefined) {
        if (payload === null) {
          const { error } = await client.from(table).delete().eq(eqCol, eqVal);
          if (error) throw error;
        } else {
          const { error } = await client.from(table).update(payload).eq(eqCol, eqVal);
          if (error) throw error;
        }
      } else {
        if (payload) {
          const { error } = await client.from(table).insert(payload);
          if (error) throw error;
        }
      }
    })
  } else {
    // Simulated DB latency
    await new Promise(resolve => setTimeout(resolve, 20));
  }
};

// Minimal store surface the sync needs — lets replayOfflineQueue drive the same
// code path as the middleware.
interface SyncStore {
  getState: () => RootState
  dispatch: (action: unknown) => unknown
}

/**
 * Mirrors one action to Supabase. Called by the middleware after the reducer
 * has run (optimistic), and by replayOfflineQueue for writes that were held
 * while offline — replay passes the action WITHOUT dispatching it, so the
 * reducer doesn't apply the same optimistic change twice.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const syncActionToSupabase = async (store: SyncStore, action: any, options: { replay?: boolean } = {}) => {
  const isSim = typeof global !== 'undefined' && (global as unknown as { __simulationMode?: boolean }).__simulationMode
  if (!supabase && !isSim) return

  const state = store.getState()
  const currentUser = state.auth.currentUser

  // Security log entries are handled before everything else and returned
  // early, deliberately OUTSIDE the shared try/catch below: they are
  // best-effort telemetry, so a failure to record one must never surface a
  // "Sync failed" notification, trigger a reconcile refetch, or land in the
  // offline queue for replay. This handler is what makes the audit trail
  // real — for its entire history addLog wrote only to in-memory Redux,
  // while SECURITY.md and MAINTENANCE.md both described it as something a
  // maintainer could review after the fact.
  if (addLog.match(action)) {
    if (!supabase) return
    // Never awaited by the caller: logging must not add latency to, or be
    // able to fail, the user action that produced it.
    void supabase.from('res_security_logs').insert({
      user_id: currentUser && !isGuestUser(currentUser) ? toUUID(currentUser.id) : null,
      event_type: action.payload.type,
      action: action.payload.action,
      details: action.payload.details ?? null,
      ip_address: action.payload.ip ?? null,
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 500) : null
    }).then(
      () => {},
      () => {}
    )
    return
  }

  // Human-readable label of what was being saved, for the failure notification
  let syncLabel = ''

  try {
    // 1. Sync Authentication & Profiles
    // NOTE: public.profiles is Gruvs-owned (CONTRACT.md §1) — The Resident
    // never writes it; the shared row is created by the Gruvs signup rails.
    if (loginUser.match(action)) {
      const user = action.payload
      const uuid = toUUID(user.id)

      if (supabase) {
        // Fetch or create their res_profiles configuration
        const { data: dbProfile } = await supabase
          .from('res_profiles')
          .select('*')
          .eq('id', uuid)
          .single()

        if (dbProfile) {
          if (dbProfile.role === 'tenant') {
            store.dispatch(updateProfile({
              profile: {
                bio: dbProfile.bio || '',
                gender: (dbProfile.gender || 'any') as UserProfile['gender'],
                childrenCount: dbProfile.children_count || 0,
                employmentStatus: dbProfile.employment_status || '',
                hasPets: !!dbProfile.has_pets,
                verificationDocUrl: dbProfile.verification_doc_url || undefined
              }
            }))
          } else if (dbProfile.role === 'landlord') {
            store.dispatch(updatePreferences({
              preferences: {
                genderPreference: (dbProfile.landlord_gender_pref || 'any') as LandlordPreferences['genderPreference'],
                childrenAllowed: !!dbProfile.landlord_children_allowed,
                maxChildren: dbProfile.landlord_max_children || 0,
                smokingAllowed: !!dbProfile.landlord_smoking_allowed,
                petsAllowed: !!dbProfile.landlord_pets_allowed
              }
            }))
          }
          store.dispatch(setLegalName(dbProfile.legal_name || undefined))
        } else {
          await supabase.from('res_profiles').insert({
            id: uuid,
            role: user.role,
            bio: user.profile?.bio || null,
            gender: user.profile?.gender || null,
            children_count: user.profile?.childrenCount || 0,
            employment_status: user.profile?.employmentStatus || null,
            has_pets: !!user.profile?.hasPets,
            verification_doc_url: user.profile?.verificationDocUrl || null,
            landlord_gender_pref: user.preferences?.genderPreference || null,
            landlord_children_allowed: user.preferences?.childrenAllowed !== false,
            landlord_max_children: user.preferences?.maxChildren || 0,
            landlord_smoking_allowed: !!user.preferences?.smokingAllowed,
            landlord_pets_allowed: !!user.preferences?.petsAllowed
          })
        }

        // Populate dashboard with all tables
        const dispatch = store.dispatch as AppDispatch
        dispatch(fetchSupabaseData())
      }
    }

    if (logoutUser.match(action)) {
      if (supabase) {
        await supabase.auth.signOut()
      }
    }

    if (updateProfile.match(action) && currentUser) {
      syncLabel = 'your profile'
      await dbUpdate('res_profiles', db.profileToRow(action.payload.profile), 'id', toUUID(currentUser.id))
    }

    if (updatePreferences.match(action) && currentUser) {
      syncLabel = 'your preferences'
      await dbUpdate('res_profiles', db.preferencesToRow(action.payload.preferences), 'id', toUUID(currentUser.id))
    }

    if (setLegalName.match(action) && currentUser) {
      syncLabel = 'your legal name'
      await dbUpdate('res_profiles', { legal_name: action.payload || null }, 'id', toUUID(currentUser.id))
    }

    // 2. Sync Room Listings
    if (addListing.match(action)) {
      syncLabel = 'your listing'
      await dbUpdate('res_listings', db.listingToRow(action.payload))
    }

    if (deleteListing.match(action)) {
      syncLabel = 'the listing removal'
      await dbUpdate('res_listings', null, 'id', toUUID(action.payload))
    }

    // 3. Sync Room Requests
    if (addRequest.match(action)) {
      syncLabel = 'your room request'
      await dbUpdate('res_room_requests', db.requestToRow(action.payload))
    }

    if (updateRequestStatus.match(action)) {
      const { requestId, status } = action.payload
      syncLabel = 'the request decision'
      await dbUpdate('res_room_requests', { status }, 'id', toUUID(requestId))
    }

    // 4. Sync Roommate Seekers
    if (addRoommateSeeker.match(action)) {
      syncLabel = 'your roommate ad'
      await dbUpdate('res_roommate_seekers', db.seekerToRow(action.payload))
    }

    // 5. Sync Lift Clubs
    if (addLiftClub.match(action) && currentUser) {
      syncLabel = 'your lift club'
      await dbUpdate('res_lift_clubs', db.liftToRow(action.payload, currentUser.id))
    }

    // The seat count is decremented by the database, not by us: two riders
    // racing for the last seat would otherwise both compute "1 - 1 = 0" from
    // the same stale value and both succeed.
    if (bookSeat.match(action)) {
      syncLabel = 'your seat booking'
      await Promise.resolve()
      assertNetworkAlive()
      if (supabase) {
        const { data, error } = await supabase.rpc('res_book_seat', { p_lift_id: toUUID(action.payload) })
        if (error) throw error
        if (typeof data === 'number') {
          store.dispatch(setLiftSeats({ liftId: action.payload, availableSeats: data }))
        }
      }
    }

    // 6. Sync Handyman Business Directory
    if (addService.match(action)) {
      syncLabel = 'your business listing'
      await dbUpdate('res_handyman_services', db.serviceToRow(action.payload))
    }

    if (deleteService.match(action)) {
      syncLabel = 'the business removal'
      await dbUpdate('res_handyman_services', null, 'id', toUUID(action.payload))
    }

    // 7. Sync Maintenance Callout Dispatches
    if (addDispatch.match(action)) {
      syncLabel = 'your callout'
      await dbUpdate('res_service_dispatches', db.dispatchToRow(action.payload))
    }

    if (updateDispatchStatus.match(action)) {
      const { dispatchId, status } = action.payload
      syncLabel = 'the callout status'
      await dbUpdate('res_service_dispatches', { status }, 'id', toUUID(dispatchId))
    }

    // 8. Sync Prepaid Utility Vouchers (schema stores no voucher codes)
    if (addToken.match(action)) {
      syncLabel = 'your voucher'
      await dbUpdate('res_utility_tokens', db.tokenToRow(action.payload))
    }

    if (buyToken.match(action)) {
      const { tokenId, buyerId, timestamp } = action.payload
      syncLabel = 'your voucher claim'
      await dbUpdate('res_utility_tokens', db.tokenClaimToRow(buyerId, timestamp), 'id', toUUID(tokenId))
    }

    // 9. Sync Tool Library Items
    if (addTool.match(action)) {
      syncLabel = 'your tool'
      await dbUpdate('res_tool_library', db.toolToRow(action.payload))
    }

    if (rentTool.match(action)) {
      const { toolId, rentedBy, rentedUntil } = action.payload
      syncLabel = 'the tool rental'
      await dbUpdate('res_tool_library', db.toolRentToRow(rentedBy, rentedUntil), 'id', toUUID(toolId))
    }

    if (returnTool.match(action)) {
      syncLabel = 'the tool return'
      await dbUpdate('res_tool_library', db.toolReturnToRow(), 'id', toUUID(action.payload))
    }

    // 10. Sync Chore Schedule (listing_id is required by schema + RLS)
    if (addChore.match(action)) {
      const row = db.choreToRow(action.payload)
      if (row) {
        syncLabel = 'the chore'
        await dbUpdate('res_chore_schedule', row)
      } else {
        console.warn('Chore not synced: no household listing attached')
      }
    }

    if (completeChore.match(action)) {
      const { choreId, completedAt } = action.payload
      syncLabel = 'the chore completion'
      await dbUpdate('res_chore_schedule', {
        status: 'completed',
        completed_at: completedAt
      }, 'id', toUUID(choreId))
    }

    if (resetChoreWeek.match(action)) {
      const chores = action.payload
      syncLabel = 'the chore reset'
      // Only clear the households being rescheduled — never the whole table
      const listingIds = [...new Set(chores.map(c => c.listingId).filter(Boolean).map(id => toUUID(id!)))]
      if (supabase && listingIds.length > 0) {
        assertNetworkAlive()
        const { error } = await supabase.from('res_chore_schedule').delete().in('listing_id', listingIds)
        if (error) throw error
      }
      for (const chore of chores) {
        const row = db.choreToRow(chore)
        if (row) await dbUpdate('res_chore_schedule', row)
      }
    }

    // 11. Sync Notice Bulletins & Event RSVPs
    if (addNoticeEvent.match(action)) {
      syncLabel = 'your notice'
      await dbUpdate('res_notice_events', db.noticeToRow(action.payload))
    }

    // rsvp/vibe/echo toggle rows owned by OTHER users, so they go through
    // security-definer RPCs (res_notice_events update-RLS is poster-only).
    if (rsvpToEvent.match(action)) {
      syncLabel = 'your RSVP'
      await Promise.resolve()
      assertNetworkAlive()
      if (supabase) {
        const { error } = await supabase.rpc('res_toggle_rsvp', { p_notice_id: toUUID(action.payload.noticeId) })
        if (error) throw error
      }
    }

    if (vibeNotice.match(action)) {
      syncLabel = 'your vibe'
      await Promise.resolve()
      assertNetworkAlive()
      if (supabase) {
        const { error } = await supabase.rpc('res_toggle_vibe', { p_notice_id: toUUID(action.payload.noticeId) })
        if (error) throw error
      }
    }

    if (echoNotice.match(action)) {
      syncLabel = 'your echo'
      await Promise.resolve()
      assertNetworkAlive()
      if (supabase) {
        const { error } = await supabase.rpc('res_toggle_echo', { p_notice_id: toUUID(action.payload.noticeId) })
        if (error) throw error
      }
    }

    // 12. Sync Community Disputes
    if (addDispute.match(action)) {
      syncLabel = 'your dispute'
      await dbUpdate('res_community_disputes', db.disputeToRow(action.payload))
    }

    if (updateDisputeStatus.match(action)) {
      const { disputeId, status, resolutionDetails } = action.payload
      syncLabel = 'the dispute update'
      await dbUpdate('res_community_disputes', db.disputeStatusToRow(status, resolutionDetails), 'id', toUUID(disputeId))
    }

    // 13. Sync Communities
    if (addCommunity.match(action)) {
      syncLabel = 'your community'
      await dbUpdate('res_communities', db.communityToRow(action.payload))
    }

    // 14. Sync Alerts
    if (addAlert.match(action)) {
      syncLabel = 'your alert'
      await dbUpdate('res_alerts', db.alertToRow(action.payload))
    }

    if (resolveAlert.match(action)) {
      syncLabel = 'the alert resolution'
      await dbUpdate('res_alerts', { status: 'resolved', resolved_at: new Date().toISOString() }, 'id', toUUID(action.payload))
    }

    // 15. Sync Market Items
    if (addMarketItem.match(action)) {
      syncLabel = 'your market item'
      await dbUpdate('res_market_items', db.marketItemToRow(action.payload))
    }

    if (sellMarketItem.match(action)) {
      syncLabel = 'the item sale'
      await dbUpdate('res_market_items', { status: 'gone' }, 'id', toUUID(action.payload))
    }

    // 16. Sync Vendors
    if (addVendor.match(action) && currentUser) {
      syncLabel = 'your vendor listing'
      await dbUpdate('res_vendors', db.vendorToRow(action.payload, currentUser.id))
    }

    // 17. Sync Group Buys
    if (addGroupBuy.match(action)) {
      syncLabel = 'your group buy'
      await dbUpdate('res_group_buys', db.groupBuyToRow(action.payload))
    }

    // One RPC writes the pledge row and recomputes current_quantity from the
    // sum of pledges, so the counter is self-healing and can't be clobbered.
    if (pledgeGroupBuy.match(action)) {
      const { groupBuyId, amount } = action.payload
      syncLabel = 'your pledge'
      await Promise.resolve()
      assertNetworkAlive()
      if (supabase) {
        const { data, error } = await supabase.rpc('res_pledge_group_buy', {
          p_group_buy_id: toUUID(groupBuyId),
          p_quantity: Math.max(1, Math.round(amount))
        })
        if (error) throw error
        if (typeof data === 'number') {
          store.dispatch(setGroupBuyProgress({ groupBuyId, currentPledges: data }))
        }
      }
    }

    // 18. Sync Skills
    if (addSkill.match(action)) {
      syncLabel = 'your skill listing'
      await dbUpdate('res_skills', db.skillToRow(action.payload))
    }

    // 19. Sync Lost & Found
    if (addLostFound.match(action) && currentUser) {
      syncLabel = 'your lost & found post'
      await dbUpdate('res_lost_found', db.lostFoundToRow(action.payload, currentUser.id))
    }

    if (resolveLostFound.match(action)) {
      syncLabel = 'the lost & found update'
      await dbUpdate('res_lost_found', { status: 'reunited' }, 'id', toUUID(action.payload))
    }

    // 20. Sync Care Circle Check (only an OK check-in maps to the schema)
    if (checkCareCircle.match(action)) {
      const { id, status } = action.payload
      if (status === 'ok') {
        syncLabel = 'the check-in'
        await dbUpdate('res_care_circle', {
          status: 'active',
          last_ok_at: new Date().toISOString()
        }, 'id', toUUID(id))
      }
    }

    // 21. Sync Shared Resources
    if (addSharedResource.match(action) && currentUser) {
      syncLabel = 'your shared resource'
      await dbUpdate('res_shared_resources', db.sharedResourceToRow(action.payload, currentUser.id))
    }

    if (updateSharedResourceStatus.match(action)) {
      const { id, status } = action.payload
      syncLabel = 'the resource status'
      await dbUpdate('res_shared_resources', { availability: status }, 'id', toUUID(id))
    }

    // 22. Sync Neighbourhood Status (crowd-signal log: each report is a new row)
    if (updateNeighbourhoodStatus.match(action) && currentUser) {
      syncLabel = 'the status report'
      await dbUpdate('res_neighbourhood_status', db.neighbourhoodStatusToRow(action.payload, currentUser.id))
    }

    // 23. VibeMap / Traffic and verification sync handlers
    if (addTrafficReport.match(action)) {
      syncLabel = 'your traffic report'
      await dbUpdate('res_traffic_reports', db.trafficToRow(action.payload))
    }

    if (updateListingVerification.match(action)) {
      const { id, approachPhotoUrl, lastVerifiedAt, verifiedByUserId } = action.payload
      syncLabel = 'the listing verification'
      await dbUpdate('res_listings', {
        approach_photo_url: approachPhotoUrl || null,
        last_verified_at: lastVerifiedAt,
        verified_by_user_id: toUUID(verifiedByUserId)
      }, 'id', toUUID(id))
    }

    if (updateVendorVerification.match(action)) {
      const { id, approachPhotoUrl, lastVerifiedAt, verifiedByUserId } = action.payload
      syncLabel = 'the vendor verification'
      await dbUpdate('res_vendors', {
        approach_photo_url: approachPhotoUrl || null,
        last_verified_at: lastVerifiedAt,
        verified_by_user_id: toUUID(verifiedByUserId)
      }, 'id', toUUID(id))
    }

    if (updateResourceVerification.match(action)) {
      const { id, approachPhotoUrl, lastVerifiedAt, verifiedByUserId } = action.payload
      syncLabel = 'the resource verification'
      await dbUpdate('res_shared_resources', {
        approach_photo_url: approachPhotoUrl || null,
        last_verified_at: lastVerifiedAt,
        verified_by_user_id: toUUID(verifiedByUserId)
      }, 'id', toUUID(id))
    }

  } catch (err) {
    // A Supabase PostgrestError is a plain object, not an Error instance —
    // `String(err)` on one used to produce the useless literal "[object
    // Object]" here instead of the real message.
    const message = getErrorMessage(err)
    console.error(`Error syncing with Supabase${syncLabel ? ` (${syncLabel})` : ''}:`, message)

    // Undo optimistic updates where a dedicated rollback reducer exists
    if (vibeNotice.match(action)) {
      store.dispatch(vibeNoticeRollback(action.payload))
    } else if (echoNotice.match(action)) {
      store.dispatch(echoNoticeRollback(action.payload))
    } else if (rsvpToEvent.match(action)) {
      store.dispatch(rsvpNoticeRollback(action.payload))
    } else if (bookSeat.match(action)) {
      store.dispatch(bookSeatRollback(action.payload))
    } else if (pledgeGroupBuy.match(action)) {
      store.dispatch(pledgeGroupBuyRollback(action.payload))
    }

    if (syncLabel) {
      const offline = isOffline()

      // Hold the write and replay it when connectivity returns, rather than
      // losing it silently. Never re-queue during a replay: that would grow
      // the queue without bound while the network stays down.
      if (offline && !options.replay && isReplayable(action.type)) {
        store.dispatch(queueOfflineAction({ action: action.type, payload: action.payload }))
        store.dispatch(addNotification({
          title: 'Saved offline',
          message: `You're offline — ${syncLabel} is queued and will sync when you reconnect.`,
          read: false
        }))
      } else {
        store.dispatch(addNotification({
          title: 'Sync failed',
          message: `Couldn't save ${syncLabel} — ${message}. The change may not persist.`,
          read: false
        }))
        // Reconcile optimistic Redux state with what the DB actually holds
        // (pointless while offline — the refetch would fail too, and a replay
        // reconciles once at the end).
        if (supabase && !offline && !options.replay) {
          const dispatch = store.dispatch as AppDispatch
          dispatch(fetchSupabaseData())
        }
      }
    }
  }
}

export const supabaseSyncMiddleware: Middleware<false, RootState> = store => next => async (action: unknown) => {
  const result = next(action)
  await syncActionToSupabase(store as SyncStore, action)
  return result
}

/**
 * Replays writes that failed while offline, in the order they were made.
 * Each queued action is sent straight to Supabase — NOT re-dispatched — because
 * its optimistic change is already in Redux from the first attempt.
 */
export const replayOfflineQueue = createAsyncThunk(
  'ui/replayOfflineQueue',
  async (_, { getState, dispatch }) => {
    const queued = (getState() as RootState).ui.offlineQueue
    if (queued.length === 0 || !supabase || isOffline()) return

    // Clear first so a second 'online' event can't replay the same writes twice.
    dispatch(clearOfflineQueue())

    const syncStore: SyncStore = {
      getState: () => getState() as RootState,
      dispatch: dispatch as unknown as (action: unknown) => unknown
    }

    for (const item of queued) {
      await syncActionToSupabase(syncStore, { type: item.action, payload: item.payload }, { replay: true })
    }

    dispatch(addNotification({
      title: 'Back online',
      message: `Synced ${queued.length} change${queued.length === 1 ? '' : 's'} made while you were offline.`,
      read: false
    }))

    // One reconcile at the end, rather than after every replayed write.
    dispatch(fetchSupabaseData())
  }
)

// Store Creation

const MAX_OFFLINE_QUEUE = 100

interface UIState {
  language: 'en' | 'zu' | 'xh' | 'af'
  offlineQueue: Array<{ action: string; payload: unknown }>
  dataStatus: 'idle' | 'loading' | 'ready' | 'error'
  failedTables: string[]
}

const initialUIState: UIState = {
  language: 'en',
  offlineQueue: [],
  dataStatus: 'idle',
  failedTables: []
}

const uiSlice = createSlice({
  name: 'ui',
  initialState: initialUIState,
  reducers: {
    setLanguage: (state, action: PayloadAction<'en' | 'zu' | 'xh' | 'af'>) => {
      state.language = action.payload
    },
    setDataStatus: (state, action: PayloadAction<{ status: UIState['dataStatus']; failedTables: string[] }>) => {
      state.dataStatus = action.payload.status
      state.failedTables = action.payload.failedTables
    },
    queueOfflineAction: (state, action: PayloadAction<{ action: string; payload: unknown }>) => {
      state.offlineQueue.push(action.payload)
      // Bound the queue: a long offline session must not grow memory forever.
      // The oldest writes are dropped first.
      if (state.offlineQueue.length > MAX_OFFLINE_QUEUE) {
        state.offlineQueue.splice(0, state.offlineQueue.length - MAX_OFFLINE_QUEUE)
      }
    },
    clearOfflineQueue: (state) => {
      state.offlineQueue = []
    },
    /**
     * Restores writes held over from a PREVIOUS browser session. Without
     * this the queue was memory-only: the app promised "queued and will
     * sync when you reconnect", then lost the write on any refresh, tab
     * close, or background tab-kill — the last being routine on the
     * low-end Android devices this app targets. Replacing rather than
     * merging is safe because rehydration happens once at boot, before
     * anything can have queued into this session.
     */
    rehydrateOfflineQueue: (state, action: PayloadAction<Array<{ action: string; payload: unknown }>>) => {
      state.offlineQueue = action.payload.slice(-MAX_OFFLINE_QUEUE)
    }
  }
})

export const { setLanguage, setDataStatus, queueOfflineAction, clearOfflineQueue, rehydrateOfflineQueue } = uiSlice.actions

export const selectFilteredListings = createSelector(
  [
    (state: RootState) => state.listings.items,
    (state: RootState, suburb: string) => suburb,
    (state: RootState, suburb: string, maxPrice: number) => maxPrice,
    (state: RootState, suburb: string, maxPrice: number, hasWifi: boolean) => hasWifi,
    (state: RootState, suburb: string, maxPrice: number, hasWifi: boolean, hasParking: boolean) => hasParking,
    (state: RootState, suburb: string, maxPrice: number, hasWifi: boolean, hasParking: boolean, bathroom: string) => bathroom,
    (state: RootState, suburb: string, maxPrice: number, hasWifi: boolean, hasParking: boolean, bathroom: string, reqGenderPref: string | boolean) => reqGenderPref,
    (state: RootState, suburb: string, maxPrice: number, hasWifi: boolean, hasParking: boolean, bathroom: string, reqGenderPref: string | boolean, childrenAllowed: boolean) => childrenAllowed
  ],
  (items, suburb, maxPrice, hasWifi, hasParking, bathroom, reqGenderPref, childrenAllowed) => {
    return items.filter(item => {
      if (suburb && !item.suburb.toLowerCase().includes(suburb.toLowerCase()) && !item.location.toLowerCase().includes(suburb.toLowerCase())) return false;
      if (maxPrice > 0 && item.price > maxPrice) return false;
      if (hasWifi && !item.amenities.wifi) return false;
      if (hasParking && !item.amenities.parking) return false;
      if (bathroom !== 'all' && item.amenities.bathroom !== bathroom) return false;
      if (reqGenderPref !== undefined) {
        if (typeof reqGenderPref === 'boolean') {
          if (reqGenderPref && !item.landlordLivesHere) return false;
        } else if (typeof reqGenderPref === 'string' && reqGenderPref !== 'all' && reqGenderPref !== 'any') {
          if (item.requirements.genderPreference !== 'any' && item.requirements.genderPreference !== reqGenderPref) return false;
        }
      }
      if (childrenAllowed && !item.requirements.childrenAllowed) return false;
      return true;
    });
  }
)

export const selectMatchedRoommates = createSelector(
  [
    (state: RootState) => state.networking.roommates,
    (state: RootState, gender: string) => gender,
    (state: RootState, gender: string, maxBudget: number) => maxBudget
  ],
  (roommates, gender, maxBudget) => {
    return roommates.filter(rm => {
      if (gender !== 'all' && rm.gender !== gender) return false;
      if (maxBudget > 0 && rm.budget > maxBudget) return false;
      return true;
    });
  }
)

// A viewer's "home suburbs" for area targeting: every suburb they're
// concretely tied to, derived from data that already exists rather than a
// separate location-preferences table —
//  - landlord: the suburbs of the rooms/properties they list
//  - tenant: the suburb of any listing they have a pending OR approved
//    request against (pending counts too — someone mid-application to a
//    Rosebank room should still see "Rosebank" notices while deciding)
const selectViewerSuburbs = createSelector(
  [
    (state: RootState) => state.listings.items,
    (state: RootState) => state.requests.items,
    (state: RootState, viewerId: string | undefined) => viewerId
  ],
  (listings, requests, viewerId) => {
    if (!viewerId) return new Set<string>()
    const suburbs = new Set<string>()
    for (const l of listings) {
      if (l.landlordId === viewerId) suburbs.add(l.suburb.toLowerCase())
    }
    for (const r of requests) {
      if (r.tenantId === viewerId && (r.status === 'approved' || r.status === 'pending')) {
        const listing = listings.find(l => l.id === r.listingId)
        if (listing) suburbs.add(listing.suburb.toLowerCase())
      }
    }
    return suburbs
  }
)

// Notice visibility resolves in three stages, each of which can hide a
// notice a prior stage let through:
//  1. Expiry (isNoticeCurrentlyVisible) — free window or paid extension
//  2. Explicit blocklist (excludedUserIds) — always wins, even over the
//     poster's own audience choice, so "everyone except these two" is
//     expressible without inverting the whole audience model
//  3. Audience targeting — 'my_tenants' (approved-request landlords only)
//     or 'targeted' (viewer's home suburb intersects targetSuburbs)
// The poster can always see their own notice regardless of 1-3, so they can
// check on / renew something that's expired or under-targeted.
// Boosted notices (featuredUntil) sort first, same convention as featured
// listings/market items.
export const selectVisibleNotices = createSelector(
  [
    (state: RootState) => state.community.notices,
    (state: RootState) => state.requests.items,
    (state: RootState, viewerId: string | undefined) => viewerId,
    (state: RootState, viewerId: string | undefined) => selectViewerSuburbs(state, viewerId)
  ],
  (notices, requests, viewerId, viewerSuburbs) => {
    const isFeatured = (n: NoticeEvent) => !!n.featuredUntil && new Date(n.featuredUntil).getTime() > Date.now()
    const visible = notices.filter(n => {
      const isOwner = !!viewerId && n.postedById === viewerId
      if (isOwner) return true

      if (!isNoticeCurrentlyVisible(n)) return false
      if (viewerId && n.excludedUserIds?.includes(viewerId)) return false

      if (n.audience === 'my_tenants') {
        if (!viewerId) return false
        return requests.some(r => r.landlordId === n.postedById && r.tenantId === viewerId && r.status === 'approved')
      }
      if (n.audience === 'targeted') {
        if (!n.targetSuburbs || n.targetSuburbs.length === 0) return true
        return n.targetSuburbs.some(s => viewerSuburbs.has(s.toLowerCase()))
      }
      return true
    })
    return [...visible].sort((a, b) => Number(isFeatured(b)) - Number(isFeatured(a)))
  }
)

const appReducer = combineReducers({
  auth: authSlice.reducer,
  listings: listingsSlice.reducer,
  requests: requestsSlice.reducer,
  security: securitySlice.reducer,
  networking: networkingSlice.reducer,
  utilities: utilitiesSlice.reducer,
  community: communitySlice.reducer,
  notifications: notificationsSlice.reducer,
  ui: uiSlice.reducer
})

// logoutUser's own reducer only clears auth.currentUser — every other slice
// (verification doc URLs, dispute details, chat messages, listings) stayed
// resident in memory, since logout is a client-side route push, not a full
// page reload. On a shared/public device a second person signing in right
// after would briefly see the first person's already-fetched data before
// fetchSupabaseData() overwrites it. Wiping the whole tree on logout (except
// the language preference, which isn't sensitive) closes that window.
// ── Offline queue durability ────────────────────────────────────────────────
// The queue is the one piece of Redux state representing work the user was
// PROMISED would happen ("queued and will sync when you reconnect").
// Everything else in the tree is re-fetchable from Supabase, so the queue is
// deliberately the ONLY thing persisted — this is not general Redux
// persistence, and nothing sensitive-but-refetchable is written to disk.
export const OFFLINE_QUEUE_STORAGE_KEY = 'residentOfflineQueue'

// The offline queue is deliberately NOT carried across a logout, and its
// persisted copy is dropped too: a queued write belongs to the session that
// made it, so replaying user A's pending writes after user B signs in on the
// same device would either attribute data to the wrong person or be rejected
// by RLS. Losing them is the correct trade against that.
const rootReducer = (state: ReturnType<typeof appReducer> | undefined, action: Parameters<typeof appReducer>[1]) => {
  if (logoutUser.match(action)) {
    const language = state?.ui.language
    safeRemove(OFFLINE_QUEUE_STORAGE_KEY)
    const next = appReducer(undefined, action)
    return { ...next, ui: { ...next.ui, language: language ?? next.ui.language } }
  }
  return appReducer(state, action)
}

export const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false
    }).concat(supabaseSyncMiddleware)
})

const isQueueShape = (parsed: unknown): boolean =>
  Array.isArray(parsed) && parsed.every(item =>
    !!item && typeof item === 'object' && typeof (item as { action?: unknown }).action === 'string'
  )

/** Reads any queue left over from a previous session. Exported for tests. */
export function loadPersistedQueue(): Array<{ action: string; payload: unknown }> {
  return safeGetJSON<Array<{ action: string; payload: unknown }>>(OFFLINE_QUEUE_STORAGE_KEY, [], isQueueShape)
}

export function persistQueue(queue: Array<{ action: string; payload: unknown }>): void {
  if (queue.length === 0) {
    safeRemove(OFFLINE_QUEUE_STORAGE_KEY)
    return
  }
  safeSetJSON(OFFLINE_QUEUE_STORAGE_KEY, queue)
}

if (typeof window !== 'undefined') {
  const persisted = loadPersistedQueue()
  if (persisted.length > 0) {
    store.dispatch(rehydrateOfflineQueue(persisted))
  }

  // Mirror the queue to storage on every change. Cheap: the comparison is a
  // reference check, and a write only happens when the queue actually moved.
  let lastQueue = store.getState().ui.offlineQueue
  store.subscribe(() => {
    const current = store.getState().ui.offlineQueue
    if (current === lastQueue) return
    lastQueue = current
    persistQueue(current)
  })
}

export interface RootState {
  auth: ReturnType<typeof authSlice.reducer>
  listings: ReturnType<typeof listingsSlice.reducer>
  requests: ReturnType<typeof requestsSlice.reducer>
  security: ReturnType<typeof securitySlice.reducer>
  networking: ReturnType<typeof networkingSlice.reducer>
  utilities: ReturnType<typeof utilitiesSlice.reducer>
  community: ReturnType<typeof communitySlice.reducer>
  notifications: ReturnType<typeof notificationsSlice.reducer>
  ui: ReturnType<typeof uiSlice.reducer>
}

export type AppDispatch = typeof store.dispatch
