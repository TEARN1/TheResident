import { configureStore, createSlice, PayloadAction, createAsyncThunk, createSelector } from '@reduxjs/toolkit'
import { supabase } from '../utils/supabase'

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

export interface User {
  id: string
  name: string
  email: string
  role: 'tenant' | 'landlord' | 'visitor'
  passwordHash?: string // cryptographically secured
  profile?: UserProfile
  preferences?: LandlordPreferences
  balance: number // mock currency wallet balance
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
}

export interface RoomRequest {
  id: string
  tenantId: string
  tenantName: string
  listingId: string
  listingTitle: string
  landlordId: string
  status: 'pending' | 'approved' | 'rejected'
  message: string
  timestamp: string
}

export interface SecurityLog {
  id: string
  timestamp: string
  ip: string
  action: string
  type: 'xss_blocked' | 'rate_limit_triggered' | 'idor_prevented' | 'auth_success' | 'auth_failed' | 'brute_force_blocked' | 'upload_malware_blocked' | 'sqli_blocked'
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
  driverName: string
  origin: string
  destination: string
  departureTime: string
  days: string
  pricePerSeat: number
  currency: string
  availableSeats: number
  totalSeats: number
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
  status: 'available' | 'rented'
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

export interface NoticeEvent {
  id: string
  title: string
  description: string
  type: 'notice' | 'event'
  postedBy: string
  postedById: string
  timestamp: string
  eventDate?: string
  rsvps: string[]
  vibes?: string[]
  echos?: string[]
}

// Mock listings, roommates, lifts, services
const initialListings: Listing[] = []

const initialRoommates: RoommateSeeker[] = []

const initialLifts: LiftClub[] = []

const initialServices: HandymanService[] = []


// Phase 4 Community Interfaces
export interface Community {
  id: string
  name: string
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
  category: 'security' | 'fire' | 'medical' | 'utility' | 'other'
  severity: 'info' | 'warning' | 'critical' | 'panic'
  status: 'active' | 'resolved'
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
  imageUrl?: string
  status: 'available' | 'sold'
  createdBy: string
  createdAt: string
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
}

export interface NeighbourhoodStatus {
  id: string
  service: 'electricity' | 'water' | 'other'
  status: 'active' | 'restored' | 'outage'
  suburb: string
  updatedAt: string
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
    deductBalance: (state, action: PayloadAction<number>) => {
      if (state.currentUser) {
        state.currentUser.balance = (state.currentUser.balance || 0) - action.payload
      }
    },
    addBalance: (state, action: PayloadAction<number>) => {
      if (state.currentUser) {
        state.currentUser.balance = (state.currentUser.balance || 0) + action.payload
      }
    },
    setBalance: (state, action: PayloadAction<number>) => {
      if (state.currentUser) {
        state.currentUser.balance = action.payload
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
    }
  }
})

const requestsSlice = createSlice({
  name: 'requests',
  initialState: {
    items: [] as RoomRequest[]
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
    updateRequestStatus: (state, action: PayloadAction<{ requestId: string; status: 'approved' | 'rejected' }>) => {
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
    dispatches: [] as ServiceDispatch[]
  },
  reducers: {
    setRoommates: (state, action: PayloadAction<RoommateSeeker[]>) => {
      state.roommates = action.payload.map(r => ({ ...r, id: toUUID(r.id) }))
    },
    setLifts: (state, action: PayloadAction<LiftClub[]>) => {
      state.lifts = action.payload.map(l => ({ ...l, id: toUUID(l.id) }))
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
    addRoommateSeeker: (state, action: PayloadAction<RoommateSeeker>) => {
      const seeker = { ...action.payload }
      seeker.id = toUUID(seeker.id)
      state.roommates.push(seeker)
    },
    addLiftClub: (state, action: PayloadAction<LiftClub>) => {
      const lift = { ...action.payload }
      lift.id = toUUID(lift.id)
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
    }
  }
})

const initialTokens: UtilityToken[] = []

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
const initialTools: ToolItem[] = []

const initialChores: ChoreAssignment[] = []

const initialNotices: NoticeEvent[] = []

const initialDisputes: CommunityDispute[] = []

const communitySlice = createSlice({
  name: 'community',
  initialState: {
    tools: initialTools,
    chores: initialChores,
    notices: initialNotices,
    disputes: initialDisputes,
    reputationScores: {} as Record<string, number>,
    communities: [] as Community[],
    alerts: [] as Alert[],
    marketItems: [] as MarketItem[],
    vendors: [] as Vendor[],
    groupBuys: [] as GroupBuy[],
    skills: [] as Skill[],
    lostFound: [] as LostFound[],
    careCircle: [] as CareCircleCheck[],
    sharedResources: [] as SharedResource[],
    neighbourhoodStatus: [] as NeighbourhoodStatus[]
  },
  reducers: {
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
    updateDisputeStatus: (state, action: PayloadAction<{ disputeId: string; status: 'pending' | 'mediating' | 'resolved'; resolutionDetails?: string }>) => {
      const disputeId = toUUID(action.payload.disputeId)
      const dispute = state.disputes.find(d => toUUID(d.id) === disputeId)
      if (dispute) {
        dispute.status = action.payload.status
        if (action.payload.resolutionDetails) {
          dispute.resolutionDetails = action.payload.resolutionDetails
        }
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
}

const notificationsSlice = createSlice({
  name: 'notifications',
  initialState: {
    items: [] as AppNotification[],
    virtualCount: 0
  },
  reducers: {
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
    floodNotifications: (state, action: PayloadAction<number>) => {
      state.virtualCount += action.payload
    },
    markAllNotificationsRead: (state) => {
      state.virtualCount = 0
      state.items.forEach(item => {
        item.read = true
      })
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
  deductBalance,
  addBalance,
  setBalance
} = authSlice.actions

export const { setListings, addListing, deleteListing } = listingsSlice.actions
export const { setRequests, addRequest, updateRequestStatus } = requestsSlice.actions
export const { addLog, incrementApiCall, resetApiCounts } = securitySlice.actions
export const {
  setRoommates,
  setLifts,
  setServices,
  setDispatches,
  addRoommateSeeker,
  addLiftClub,
  addService,
  deleteService,
  bookSeat,
  addDispatch,
  updateDispatchStatus
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
  addSkill,
  addLostFound,
  resolveLostFound,
  checkCareCircle,
  addSharedResource,
  updateSharedResourceStatus,
  updateNeighbourhoodStatus
} = communitySlice.actions

export const {
  addNotification,
  floodNotifications,
  markAllNotificationsRead
} = notificationsSlice.actions

// Async Thunk to fetch live data from Supabase.
// Column names follow resident_schema.sql; display names are resolved from the
// shared profiles trust columns (CONTRACT.md §3) since res_* tables store UUIDs.
export const fetchSupabaseData = createAsyncThunk(
  'data/fetchSupabaseData',
  async (_, { dispatch }) => {
    if (!supabase) return
    dispatch(setDataStatus({ status: 'loading', failedTables: [] }))
    const failedTables: string[] = []
    const markFailed = (table: string, message: string) => {
      failedTables.push(table)
      console.error(`Failed to fetch ${table}: ${message}`)
    }

    // 0. Display-name lookup (best-effort; blank when RLS hides a profile)
    const nameMap: NameMap = {}
    const { data: profileRows, error: profilesError } = await supabase
      .from('profiles')
      .select('id, display_name, username')
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

    // 1. Listings
    const fetchListings = async () => {
      const { data, error } = await supabase!.from('res_listings').select('*')
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
        }
      }))))
    }

    // 5. Services (fetched early: dispatches resolve their names from it)
    const fetchServices = async () => {
      const { data, error } = await supabase!.from('res_handyman_services').select('*')
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
      const { data, error } = await supabase!.from('res_room_requests').select('*')
      if (error) return markFailed('res_room_requests', error.message)
      if (!data) return
      dispatch(setRequests(data.map(item => ({
        id: item.id,
        tenantId: item.tenant_id,
        tenantName: nameOf(item.tenant_id),
        listingId: item.listing_id,
        listingTitle: listingTitleById[String(item.listing_id)] || '',
        landlordId: item.landlord_id,
        status: (item.status || 'pending') as 'pending' | 'approved' | 'rejected',
        message: item.message || '',
        timestamp: item.created_at || new Date().toISOString()
      }))))
    }

    // 3. Lifts
    const fetchLifts = async () => {
      const { data, error } = await supabase!.from('res_lift_clubs').select('*')
      if (error) return markFailed('res_lift_clubs', error.message)
      if (!data) return
      dispatch(setLifts(data.map(item => ({
        id: item.id,
        driverName: nameOf(item.driver_id),
        origin: item.origin,
        destination: item.destination,
        departureTime: item.departure_time || '',
        days: item.days || '',
        pricePerSeat: Number(item.price_per_seat),
        currency: item.currency || 'ZAR',
        availableSeats: item.available_seats || 0,
        totalSeats: item.total_seats || 0
      }))))
    }

    // 4. Roommates
    const fetchRoommates = async () => {
      const { data, error } = await supabase!.from('res_roommate_seekers').select('*')
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
      const { data, error } = await supabase!.from('res_service_dispatches').select('*')
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
      const { data, error } = await supabase!.from('res_utility_tokens').select('*')
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
      const { data, error } = await supabase!.from('res_tool_library').select('*')
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
      const { data, error } = await supabase!.from('res_chore_schedule').select('*')
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
      const { data, error } = await supabase!.from('res_community_disputes').select('*')
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
      const { data, error } = await supabase!.from('res_notice_events').select('*')
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
      const { data, error } = await supabase!.from('res_communities').select('*')
      if (error) return markFailed('res_communities', error.message)
      if (!data) return
      dispatch(setCommunities(data.map(item => ({
        id: item.id,
        name: item.name,
        description: '',
        location: item.suburb || '',
        suburb: item.suburb || '',
        createdBy: item.created_by,
        createdAt: item.created_at
      }))))
    }

    // 13. Alerts
    const fetchAlerts = async () => {
      const { data, error } = await supabase!.from('res_alerts').select('*')
      if (error) return markFailed('res_alerts', error.message)
      if (!data) return
      dispatch(setAlerts(data.map(item => ({
        id: item.id,
        title: item.title,
        description: item.description || '',
        category: (item.kind === 'panic' || item.kind === 'suspicious' ? 'security' : 'other') as Alert['category'],
        severity: ({ low: 'info', medium: 'warning', high: 'critical', critical: 'panic' }[String(item.severity)] || 'warning') as Alert['severity'],
        status: (item.status === 'active' ? 'active' : 'resolved') as Alert['status'],
        createdBy: item.user_id,
        createdAt: item.created_at,
        lat: Number(item.lat || 0),
        lon: Number(item.lon || 0)
      }))))
    }

    // 14. Market Items
    const fetchMarketItems = async () => {
      const { data, error } = await supabase!.from('res_market_items').select('*')
      if (error) return markFailed('res_market_items', error.message)
      if (!data) return
      dispatch(setMarketItems(data.map(item => ({
        id: item.id,
        title: item.title,
        description: item.description || '',
        price: Number(item.price || 0),
        currency: item.currency || 'ZAR',
        category: item.category || '',
        imageUrl: (item.images && item.images[0]) || undefined,
        status: (item.status === 'available' ? 'available' : 'sold') as MarketItem['status'],
        createdBy: item.user_id,
        createdAt: item.created_at
      }))))
    }

    // 15. Vendors
    const fetchVendors = async () => {
      const { data, error } = await supabase!.from('res_vendors').select('*')
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
        reviewsCount: 0
      }))))
    }

    // 16. Group Buys
    const fetchGroupBuys = async () => {
      const { data, error } = await supabase!.from('res_group_buys').select('*')
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
      const { data, error } = await supabase!.from('res_skills').select('*')
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
      const { data, error } = await supabase!.from('res_lost_found').select('*')
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
      const { data, error } = await supabase!.from('res_care_circle').select('*')
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
      const { data, error } = await supabase!.from('res_shared_resources').select('*')
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
        longitude: Number(item.lon || 0)
      }))))
    }

    // 21. Neighbourhood Statuses
    const fetchNeighbourhoodStatus = async () => {
      const { data, error } = await supabase!.from('res_neighbourhood_status').select('*')
      if (error) return markFailed('res_neighbourhood_status', error.message)
      if (!data) return
      dispatch(setNeighbourhoodStatus(data.map(item => ({
        id: item.id,
        service: (item.kind === 'power' ? 'electricity' : item.kind === 'water' ? 'water' : 'other') as NeighbourhoodStatus['service'],
        status: (item.status === 'up' ? 'active' : 'outage') as NeighbourhoodStatus['status'],
        suburb: item.suburb || '',
        updatedAt: item.created_at || new Date().toISOString()
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
      fetchAlerts(),
      fetchMarketItems(),
      fetchVendors(),
      fetchGroupBuys(),
      fetchSkills(),
      fetchLostFound(),
      fetchCareCircle(),
      fetchSharedResources(),
      fetchNeighbourhoodStatus()
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

const dbUpdate = async (table: string, payload: Record<string, unknown> | null, eqCol?: string, eqVal?: unknown) => {
  assertNetworkAlive();
  if (supabase) {
    if (eqCol && eqVal !== undefined) {
      if (payload === null) {
        const { error } = await supabase.from(table).delete().eq(eqCol, eqVal);
        if (error) throw error;
      } else {
        const { error } = await supabase.from(table).update(payload).eq(eqCol, eqVal);
        if (error) throw error;
      }
    } else {
      if (payload) {
        const { error } = await supabase.from(table).insert(payload);
        if (error) throw error;
      }
    }
  } else {
    // Simulated DB latency
    await new Promise(resolve => setTimeout(resolve, 20));
  }
};

export const supabaseSyncMiddleware: Middleware<false, RootState> = store => next => async (action: unknown) => {
  const result = next(action)

  const isSim = typeof global !== 'undefined' && (global as unknown as { __simulationMode?: boolean }).__simulationMode
  if (!supabase && !isSim) return result

  const state = store.getState()
  const currentUser = state.auth.currentUser

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

    // deductBalance/addBalance are intentionally NOT synced: the wallet is
    // display-only (CONTRACT.md §6 — broker posture, no balance columns).

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

    if (bookSeat.match(action)) {
      const liftId = action.payload
      const matchedLift = store.getState().networking.lifts.find(l => toUUID(l.id) === toUUID(liftId))
      if (matchedLift) {
        syncLabel = 'your seat booking'
        await dbUpdate('res_lift_clubs', {
          available_seats: matchedLift.availableSeats
        }, 'id', toUUID(liftId))
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
      assertNetworkAlive()
      if (supabase) {
        const { error } = await supabase.rpc('res_toggle_rsvp', { p_notice_id: toUUID(action.payload.noticeId) })
        if (error) throw error
      }
    }

    if (vibeNotice.match(action)) {
      syncLabel = 'your vibe'
      assertNetworkAlive()
      if (supabase) {
        const { error } = await supabase.rpc('res_toggle_vibe', { p_notice_id: toUUID(action.payload.noticeId) })
        if (error) throw error
      }
    }

    if (echoNotice.match(action)) {
      syncLabel = 'your echo'
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

    if (pledgeGroupBuy.match(action)) {
      const { groupBuyId, amount } = action.payload
      const gb = store.getState().community.groupBuys.find(g => toUUID(g.id) === toUUID(groupBuyId))
      if (gb) {
        syncLabel = 'your pledge'
        await dbUpdate('res_group_buys', db.groupBuyProgressToRow(gb.currentPledges), 'id', toUUID(groupBuyId))
        if (currentUser) {
          await dbUpdate('res_group_buy_pledges', db.pledgeToRow(groupBuyId, currentUser.id, amount))
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

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`Error syncing with Supabase${syncLabel ? ` (${syncLabel})` : ''}:`, message)

    // Undo optimistic toggles where a dedicated rollback reducer exists
    if (vibeNotice.match(action)) {
      store.dispatch(vibeNoticeRollback(action.payload))
    } else if (echoNotice.match(action)) {
      store.dispatch(echoNoticeRollback(action.payload))
    } else if (rsvpToEvent.match(action)) {
      store.dispatch(rsvpNoticeRollback(action.payload))
    }

    if (syncLabel) {
      store.dispatch(addNotification({
        title: 'Sync failed',
        message: `Couldn't save ${syncLabel} — ${message}. The change may not persist.`,
        read: false
      }))
      // Reconcile optimistic Redux state with what the DB actually holds
      // (skip while the network is down — the refetch would fail too).
      const offline = typeof navigator !== 'undefined' && navigator.onLine === false
      const killed = (typeof globalThis !== 'undefined' && (globalThis as unknown as { __networkKilled?: boolean }).__networkKilled)
      if (supabase && !offline && !killed) {
        const dispatch = store.dispatch as AppDispatch
        dispatch(fetchSupabaseData())
      }
    }
  }

  return result
}

// Store Creation

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
    },
    clearOfflineQueue: (state) => {
      state.offlineQueue = []
    }
  }
})

export const { setLanguage, setDataStatus, queueOfflineAction, clearOfflineQueue } = uiSlice.actions

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

export const store = configureStore({
  reducer: {
    auth: authSlice.reducer,
    listings: listingsSlice.reducer,
    requests: requestsSlice.reducer,
    security: securitySlice.reducer,
    networking: networkingSlice.reducer,
    utilities: utilitiesSlice.reducer,
    community: communitySlice.reducer,
    notifications: notificationsSlice.reducer,
    ui: uiSlice.reducer
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false
    }).concat(supabaseSyncMiddleware)
})

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
