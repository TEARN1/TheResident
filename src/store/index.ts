import { configureStore, createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit'
import { supabase } from '../utils/supabase'

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
const initialListings: Listing[] = [
  {
    id: 'list-1',
    title: 'Cozy Room in Ivory Park, Midrand',
    description: 'Beautiful secure backroom in Ivory Park Ext 2. Close to taxi ranks and local supermarket. Fenced yard with lockable gate.',
    price: 1500,
    currency: 'ZAR',
    location: 'Midrand, South Africa',
    suburb: 'Ivory Park',
    safetyRating: 'high',
    safetyNotes: 'High-security boundary wall, active community watch street association.',
    landlordId: 'landlord-1',
    landlordName: 'Amahle Nkwali',
    landlordLivesHere: true,
    images: ['https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?auto=format&fit=crop&w=600&q=80'],
    amenities: {
      wifi: true,
      parking: true,
      bathroom: 'shared'
    },
    requirements: {
      genderPreference: 'any',
      childrenAllowed: true,
      maxChildren: 1,
      smokingAllowed: false,
      petsAllowed: false
    }
  },
  {
    id: 'list-2',
    title: 'Modern Apartment Room near London Hub',
    description: 'Clean room inside a quiet flat. Perfect for young professional workers commuting into central London.',
    price: 650,
    currency: 'GBP',
    location: 'London, United Kingdom',
    suburb: 'Hackney',
    safetyRating: 'high',
    safetyNotes: 'Located in a secure residential block with CCTV and fob access controls.',
    landlordId: 'landlord-2',
    landlordName: 'John Smith',
    landlordLivesHere: false,
    images: ['https://images.unsplash.com/photo-1598928506311-c55ded91a20c?auto=format&fit=crop&w=600&q=80'],
    amenities: {
      wifi: true,
      parking: false,
      bathroom: 'ensuite'
    },
    requirements: {
      genderPreference: 'women',
      childrenAllowed: false,
      maxChildren: 0,
      smokingAllowed: false,
      petsAllowed: true
    }
  }
]

const initialRoommates: RoommateSeeker[] = [
  {
    id: 'rm-1',
    name: 'Lerato Modise',
    gender: 'women',
    childrenCount: 0,
    budget: 900,
    currency: 'ZAR',
    location: 'Midrand, South Africa',
    suburb: 'Ivory Park',
    bio: 'Looking for a clean female roommate to split a room in Ivory Park Ext 3.'
  }
]

const initialLifts: LiftClub[] = [
  {
    id: 'lift-1',
    driverName: 'Themba Zulu',
    origin: 'Ivory Park Ext 2',
    destination: 'Mall of Africa / Waterfall City',
    departureTime: '06:30 AM',
    days: 'Mon - Fri',
    pricePerSeat: 15,
    currency: 'ZAR',
    availableSeats: 3,
    totalSeats: 4
  }
]

const initialServices: HandymanService[] = [
  {
    id: 'srv-1',
    ownerId: 'landlord-1',
    businessName: 'Sipho Plumbers & Maintenance',
    category: 'Plumbing',
    location: 'Midrand, South Africa',
    suburb: 'Ivory Park',
    rating: 4.8,
    contactNumber: '+27 72 456 7890',
    websiteUrl: 'https://sipho-plumbing.co.za',
    priceEstimate: 'From R 250 / hour',
    description: 'Expert backroom leak repairs, geyser installations, and prepaid tap fittings.',
    image: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=600&q=80',
    reviewsCount: 14
  },
  {
    id: 'srv-2',
    ownerId: 'landlord-2',
    businessName: 'Ivory Park Bakkie & Moving Services',
    category: 'Bakkie / Transport',
    location: 'Midrand, South Africa',
    suburb: 'Ivory Park',
    rating: 4.9,
    contactNumber: '+27 82 999 1234',
    websiteUrl: '',
    priceEstimate: 'From R 400 / Trip',
    description: 'Reliable bakkie hire for moving furniture, room luggage, and building supplies. Help with loading included.',
    image: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=600&q=80',
    reviewsCount: 28
  },
  {
    id: 'srv-3',
    ownerId: 'tenant-100',
    businessName: 'Lerato Quick Movers & Helpers',
    category: 'Moving Assistant',
    location: 'Midrand, South Africa',
    suburb: 'Ivory Park',
    rating: 4.7,
    contactNumber: '+27 61 777 8888',
    websiteUrl: 'https://social.com/lerato-movers',
    priceEstimate: 'R 150 / Day assistance',
    description: 'Local student helpers to assist you pack, unpack, load, and clean during your room relocations.',
    image: 'https://images.unsplash.com/photo-1595246140625-573b715d11dc?auto=format&fit=crop&w=600&q=80',
    reviewsCount: 9
  }
]

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

const initialTokens: UtilityToken[] = [
  {
    id: 'tok-1',
    landlordId: 'landlord-1',
    landlordName: 'Amahle Nkwali',
    meterNumber: 'MTR-4592-1102',
    price: 150,
    currency: 'ZAR',
    tokenCode: '4820-2910-3849-5029-1123',
    status: 'available'
  },
  {
    id: 'tok-2',
    landlordId: 'landlord-2',
    landlordName: 'John Smith',
    meterNumber: 'MTR-7781-9920',
    price: 50,
    currency: 'GBP',
    tokenCode: '7789-2910-4820-1129-9948',
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
    id: 'tool-1',
    ownerId: 'landlord-1',
    ownerName: 'Amahle Nkwali',
    title: 'Heavy Duty Power Drill',
    description: '18V cordless drill with full masonry drill bit set. Great for putting up shelves.',
    pricePerDay: 50,
    currency: 'ZAR',
    deposit: 100,
    location: 'Ivory Park Ext 2',
    status: 'available'
  },
  {
    id: 'tool-2',
    ownerId: 'tenant-100',
    ownerName: 'Global Tenant',
    title: 'Aluminium Extension Ladder',
    description: '3.8m telescoping ladder, lightweight and easy to transport.',
    pricePerDay: 30,
    currency: 'ZAR',
    deposit: 150,
    location: 'Ivory Park Ext 2',
    status: 'available'
  }
]

const initialChores: ChoreAssignment[] = [
  {
    id: 'chore-1',
    roommateId: 'tenant-100',
    roommateName: 'Global Tenant',
    taskName: 'Take out trash bins & recycling',
    dayOfWeek: 'Monday',
    status: 'pending'
  },
  {
    id: 'chore-2',
    roommateId: 'rm-1',
    roommateName: 'Lerato Modise',
    taskName: 'Clean kitchen counters & stove',
    dayOfWeek: 'Wednesday',
    status: 'pending'
  },
  {
    id: 'chore-3',
    roommateId: 'tenant-100',
    roommateName: 'Global Tenant',
    taskName: 'Sweep and mop shared passage',
    dayOfWeek: 'Friday',
    status: 'completed',
    completedAt: '2026-05-24T18:00:00Z'
  }
]

const initialNotices: NoticeEvent[] = [
  {
    id: 'not-1',
    title: 'Ivory Park Loadshedding Update',
    description: 'Eskom announced Stage 2 loadshedding. Our block will be off from 18:00 to 20:30 tonight. Charge your devices.',
    type: 'notice',
    postedBy: 'Amahle Nkwali',
    postedById: 'landlord-1',
    timestamp: '2026-05-25T10:00:00Z',
    rsvps: [],
    vibes: [],
    echos: []
  },
  {
    id: 'not-2',
    title: 'Weekend Social Braai / Potluck',
    description: 'Let us meet at the communal courtyard on Saturday at 14:00. Bring your own meat and drinks. Salad will be provided!',
    type: 'event',
    postedBy: 'Amahle Nkwali',
    postedById: 'landlord-1',
    timestamp: '2026-05-25T12:00:00Z',
    eventDate: 'Saturday, 30 May 2026',
    rsvps: ['Lerato Modise'],
    vibes: [],
    echos: []
  }
]

const initialDisputes: CommunityDispute[] = [
  {
    id: 'disp-1',
    title: 'Unwashed pots left overnight',
    description: 'Pots and dishes were left in the kitchen sink for two days. Attracts pests and blocks others.',
    category: 'Messiness',
    reportedBy: 'Lerato Modise',
    reportedById: 'rm-1',
    againstUser: 'Global Tenant',
    againstUserId: 'tenant-100',
    mediatorId: 'landlord-1',
    mediatorName: 'Amahle Nkwali',
    status: 'pending',
    timestamp: '2026-05-25T15:30:00Z'
  }
]

const communitySlice = createSlice({
  name: 'community',
  initialState: {
    tools: initialTools,
    chores: initialChores,
    notices: initialNotices,
    disputes: initialDisputes,
    reputationScores: {
      'tenant-100': 40,
      'rm-1': 50
    } as Record<string, number>
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
  updateDisputeStatus
} = communitySlice.actions

export const {
  addNotification,
  floodNotifications,
  markAllNotificationsRead
} = notificationsSlice.actions

// Async Thunk to fetch live data from Supabase
export const fetchSupabaseData = createAsyncThunk(
  'data/fetchSupabaseData',
  async (_, { dispatch }) => {
    if (!supabase) return
    try {
      // 1. Fetch listings
      const { data: listingsData } = await supabase.from('listings').select('*')
      if (listingsData) {
        const mappedListings = listingsData.map(item => ({
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
          landlordName: item.landlord_name || '',
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
        }))
        dispatch(setListings(mappedListings))
      }

      // 2. Fetch Requests
      const { data: requestsData } = await supabase.from('room_requests').select('*')
      if (requestsData) {
        const mappedRequests = requestsData.map(item => ({
          id: item.id,
          tenantId: item.tenant_id,
          tenantName: item.tenant_name || '',
          listingId: item.listing_id,
          listingTitle: item.listing_title || '',
          landlordId: item.landlord_id,
          status: (item.status || 'pending') as 'pending' | 'approved' | 'rejected',
          message: item.message || '',
          timestamp: item.created_at || new Date().toISOString()
        }))
        dispatch(setRequests(mappedRequests))
      }

      // 3. Fetch Lifts
      const { data: liftsData } = await supabase.from('lift_clubs').select('*')
      if (liftsData) {
        const mappedLifts = liftsData.map(item => ({
          id: item.id,
          driverName: item.driver_name || '',
          origin: item.origin,
          destination: item.destination,
          departureTime: item.departure_time || '',
          days: item.days || '',
          pricePerSeat: Number(item.price_per_seat),
          currency: item.currency || 'ZAR',
          availableSeats: item.available_seats || 0,
          totalSeats: item.total_seats || 0
        }))
        dispatch(setLifts(mappedLifts))
      }

      // 4. Fetch Roommates
      const { data: seekersData } = await supabase.from('roommate_seekers').select('*')
      if (seekersData) {
        const mappedRoommates = seekersData.map(item => ({
          id: item.id,
          name: item.name || '',
          gender: (item.gender || 'men') as 'men' | 'women',
          childrenCount: item.children_count || 0,
          budget: Number(item.budget || 0),
          currency: item.currency || 'ZAR',
          location: item.location || '',
          suburb: item.suburb || '',
          bio: item.bio || ''
        }))
        dispatch(setRoommates(mappedRoommates))
      }

      // 5. Fetch Services
      const { data: servicesData } = await supabase.from('handyman_services').select('*')
      if (servicesData) {
        const mappedServices = servicesData.map(item => ({
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
        }))
        dispatch(setServices(mappedServices))
      }

      // 6. Fetch Dispatches
      const { data: dispatchesData } = await supabase.from('service_dispatches').select('*')
      if (dispatchesData) {
        const mappedDispatches = dispatchesData.map(item => ({
          id: item.id,
          serviceId: item.service_id,
          serviceName: item.service_name || '',
          senderId: item.sender_id,
          senderName: item.sender_name || '',
          senderRole: (item.sender_role || 'visitor') as ServiceDispatch['senderRole'],
          message: item.message || '',
          status: (item.status || 'pending') as ServiceDispatch['status'],
          timestamp: item.created_at || new Date().toISOString(),
          proofFileName: item.proof_file_name || undefined,
          proofFileUrl: item.proof_file_url || undefined
        }))
        dispatch(setDispatches(mappedDispatches))
      }

      // 7. Fetch Utility Tokens
      const { data: tokensData } = await supabase.from('utility_tokens').select('*')
      if (tokensData) {
        const mappedTokens = tokensData.map(item => ({
          id: item.id,
          landlordId: item.landlord_id,
          landlordName: item.landlord_name || '',
          meterNumber: item.meter_number,
          price: Number(item.price),
          currency: item.currency || 'ZAR',
          tokenCode: item.token_code,
          status: (item.status || 'available') as UtilityToken['status'],
          purchasedBy: item.purchased_by || undefined,
          purchasedAt: item.purchased_at || undefined
        }))
        dispatch(setTokens(mappedTokens))
      }

      // 8. Fetch Tools
      const { data: toolsData } = await supabase.from('tool_library').select('*')
      if (toolsData) {
        const mappedTools = toolsData.map(item => ({
          id: item.id,
          ownerId: item.owner_id,
          ownerName: item.owner_name || '',
          title: item.title,
          description: item.description || '',
          pricePerDay: Number(item.price_per_day),
          currency: item.currency || 'ZAR',
          deposit: Number(item.deposit || 0),
          location: item.location || '',
          status: (item.status || 'available') as ToolItem['status'],
          rentedBy: item.rented_by || undefined,
          rentedByName: item.rented_by_name || undefined,
          rentedUntil: item.rented_until || undefined
        }))
        dispatch(setTools(mappedTools))
      }

      // 9. Fetch Chores
      const { data: choresData } = await supabase.from('chore_schedule').select('*')
      if (choresData) {
        const mappedChores = choresData.map(item => ({
          id: item.id,
          roommateId: item.roommate_id,
          roommateName: item.roommate_name || '',
          taskName: item.task_name,
          dayOfWeek: item.day_of_week || '',
          status: (item.status || 'pending') as ChoreAssignment['status'],
          completedAt: item.completed_at || undefined
        }))
        dispatch(setChores(mappedChores))
      }

      // 10. Fetch Disputes
      const { data: disputesData } = await supabase.from('community_disputes').select('*')
      if (disputesData) {
        const mappedDisputes = disputesData.map(item => ({
          id: item.id,
          title: item.title,
          description: item.description || '',
          category: (item.category || 'Other') as CommunityDispute['category'],
          reportedBy: item.reported_by || '',
          reportedById: item.reported_by_id,
          againstUser: item.against_user || '',
          againstUserId: item.against_user_id || '',
          mediatorId: item.mediator_id || '',
          mediatorName: item.mediator_name || '',
          status: (item.status || 'pending') as CommunityDispute['status'],
          resolutionDetails: item.resolution_details || undefined,
          timestamp: item.created_at || new Date().toISOString()
        }))
        dispatch(setDisputes(mappedDisputes))
      }

      // 11. Fetch Notices
      const { data: noticesData } = await supabase.from('notice_events').select('*')
      if (noticesData) {
        const mappedNotices = noticesData.map(item => ({
          id: item.id,
          title: item.title,
          description: item.description || '',
          type: (item.type || 'notice') as NoticeEvent['type'],
          postedBy: item.posted_by || '',
          postedById: item.posted_by_id,
          timestamp: item.created_at || new Date().toISOString(),
          eventDate: item.event_date || undefined,
          rsvps: item.rsvps || [],
          vibes: item.vibes || [],
          echos: item.echos || []
        }))
        dispatch(setNotices(mappedNotices))
      }

    } catch (err) {
      console.error('Error fetching Supabase data:', err)
    }
  }
)

// Background synchronization middleware for Supabase mirror
import { Middleware } from 'redux'

const dbUpdate = async (table: string, payload: Record<string, unknown>, eqCol?: string, eqVal?: unknown) => {
  const isKilled = (typeof window !== 'undefined' && (window as unknown as { __networkKilled?: boolean }).__networkKilled) || 
                   (typeof global !== 'undefined' && (global as unknown as { __networkKilled?: boolean }).__networkKilled);
  if (isKilled) {
    throw new Error("Network offline (simulated)");
  }
  if (supabase) {
    if (eqCol && eqVal !== undefined) {
      const { error } = await supabase.from(table).update(payload).eq(eqCol, eqVal);
      if (error) throw error;
    } else {
      const { error } = await supabase.from(table).insert(payload);
      if (error) throw error;
    }
  } else {
    // Simulated DB latency
    await new Promise(resolve => setTimeout(resolve, 20));
  }
};

export const supabaseSyncMiddleware: Middleware<false, RootState> = store => next => async action => {
  const result = next(action)
  
  const isSim = typeof global !== 'undefined' && (global as unknown as { __simulationMode?: boolean }).__simulationMode
  if (!supabase && !isSim) return result

  const state = store.getState()
  const currentUser = state.auth.currentUser

  try {
    // 1. Sync Authentication & Profiles
    if (loginUser.match(action)) {
      const user = action.payload
      const uuid = toUUID(user.id)

      if (supabase) {
        // Ensure user exists in shared public.profiles
        await supabase.from('profiles').upsert({
          id: uuid,
          name: user.name,
          email: user.email
        })

        // Fetch or create their resident_profile configuration
        const { data: dbProfile } = await supabase
          .from('resident_profiles')
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
          if (dbProfile.balance !== undefined && dbProfile.balance !== null) {
            store.dispatch(setBalance(Number(dbProfile.balance)))
          }
        } else {
          await supabase.from('resident_profiles').insert({
            id: uuid,
            role: user.role,
            balance: user.balance,
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

    if (updateProfile.match(action) && currentUser) {
      const { profile } = action.payload
      await dbUpdate('resident_profiles', {
        bio: profile.bio,
        gender: profile.gender,
        children_count: profile.childrenCount,
        employment_status: profile.employmentStatus,
        has_pets: profile.hasPets,
        verification_doc_url: profile.verificationDocUrl || null,
        updated_at: new Date().toISOString()
      }, 'id', toUUID(currentUser.id))
    }

    if (updatePreferences.match(action) && currentUser) {
      const { preferences } = action.payload
      await dbUpdate('resident_profiles', {
        landlord_gender_pref: preferences.genderPreference,
        landlord_children_allowed: preferences.childrenAllowed,
        landlord_max_children: preferences.maxChildren,
        landlord_smoking_allowed: preferences.smokingAllowed,
        landlord_pets_allowed: preferences.petsAllowed,
        updated_at: new Date().toISOString()
      }, 'id', toUUID(currentUser.id))
    }

    if ((deductBalance.match(action) || addBalance.match(action)) && currentUser) {
      const updatedBalance = store.getState().auth.currentUser?.balance
      if (updatedBalance !== undefined) {
        await dbUpdate('resident_profiles', {
          balance: updatedBalance,
          updated_at: new Date().toISOString()
        }, 'id', toUUID(currentUser.id))
      }
    }

    // 2. Sync Room Listings
    if (addListing.match(action)) {
      const listing = action.payload
      await dbUpdate('listings', {
        id: toUUID(listing.id),
        title: listing.title,
        description: listing.description,
        price: listing.price,
        currency: listing.currency,
        location: listing.location,
        suburb: listing.suburb,
        safety_rating: listing.safetyRating,
        safety_notes: listing.safetyNotes,
        landlord_id: toUUID(listing.landlordId),
        landlord_name: listing.landlordName,
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
    }

    if (deleteListing.match(action)) {
      const listingId = action.payload
      await dbUpdate('listings', null, 'id', toUUID(listingId))
    }

    // 3. Sync Room Requests
    if (addRequest.match(action)) {
      const req = action.payload
      await dbUpdate('room_requests', {
        id: toUUID(req.id),
        tenant_id: toUUID(req.tenantId),
        tenant_name: req.tenantName,
        listing_id: toUUID(req.listingId),
        listing_title: req.listingTitle,
        landlord_id: toUUID(req.landlordId),
        status: req.status,
        message: req.message,
        created_at: req.timestamp
      })
    }

    if (updateRequestStatus.match(action)) {
      const { requestId, status } = action.payload
      await dbUpdate('room_requests', { status }, 'id', toUUID(requestId))
    }

    // 4. Sync Roommate Seekers
    if (addRoommateSeeker.match(action)) {
      const seeker = action.payload
      await dbUpdate('roommate_seekers', {
        id: toUUID(seeker.id),
        name: seeker.name,
        gender: seeker.gender,
        children_count: seeker.childrenCount,
        budget: seeker.budget,
        currency: seeker.currency,
        location: seeker.location,
        suburb: seeker.suburb,
        bio: seeker.bio
      })
    }

    // 5. Sync Lift Clubs
    if (addLiftClub.match(action) && currentUser) {
      const lift = action.payload
      await dbUpdate('lift_clubs', {
        id: toUUID(lift.id),
        driver_id: toUUID(currentUser.id),
        driver_name: lift.driverName,
        origin: lift.origin,
        destination: lift.destination,
        departure_time: lift.departureTime,
        days: lift.days,
        price_per_seat: lift.pricePerSeat,
        currency: lift.currency,
        available_seats: lift.availableSeats,
        total_seats: lift.totalSeats
      })
    }

    if (bookSeat.match(action)) {
      const liftId = action.payload
      const matchedLift = store.getState().networking.lifts.find(l => toUUID(l.id) === toUUID(liftId))
      if (matchedLift) {
        await dbUpdate('lift_clubs', {
          available_seats: matchedLift.availableSeats
        }, 'id', toUUID(liftId))
      }
    }

    // 6. Sync Handyman Business Directory
    if (addService.match(action)) {
      const service = action.payload
      await dbUpdate('handyman_services', {
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
    }

    if (deleteService.match(action)) {
      const serviceId = action.payload
      await dbUpdate('handyman_services', null, 'id', toUUID(serviceId))
    }

    // 7. Sync Maintenance Callout Dispatches
    if (addDispatch.match(action)) {
      const disp = action.payload
      await dbUpdate('service_dispatches', {
        id: toUUID(disp.id),
        service_id: toUUID(disp.serviceId),
        service_name: disp.serviceName,
        sender_id: toUUID(disp.senderId),
        sender_name: disp.senderName,
        sender_role: disp.senderRole,
        message: disp.message,
        status: disp.status,
        proof_file_name: disp.proofFileName || null,
        proof_file_url: disp.proofFileUrl || null,
        created_at: disp.timestamp
      })
    }

    if (updateDispatchStatus.match(action)) {
      const { dispatchId, status } = action.payload
      await dbUpdate('service_dispatches', { status }, 'id', toUUID(dispatchId))
    }

    // 8. Sync Prepaid Utility Vouchers
    if (addToken.match(action)) {
      const token = action.payload
      await dbUpdate('utility_tokens', {
        id: toUUID(token.id),
        landlord_id: toUUID(token.landlordId),
        landlord_name: token.landlordName,
        meter_number: token.meterNumber,
        price: token.price,
        currency: token.currency,
        token_code: token.tokenCode,
        status: token.status
      })
    }

    if (buyToken.match(action)) {
      const { tokenId, buyerId, timestamp } = action.payload
      await dbUpdate('utility_tokens', {
        status: 'sold',
        purchased_by: toUUID(buyerId),
        purchased_at: timestamp
      }, 'id', toUUID(tokenId))
    }

    // 9. Sync Tool Library Items
    if (addTool.match(action)) {
      const tool = action.payload
      await dbUpdate('tool_library', {
        id: toUUID(tool.id),
        owner_id: toUUID(tool.ownerId),
        owner_name: tool.ownerName,
        title: tool.title,
        description: tool.description,
        price_per_day: tool.pricePerDay,
        currency: tool.currency,
        deposit: tool.deposit,
        location: tool.location,
        status: tool.status
      })
    }

    if (rentTool.match(action)) {
      const { toolId, rentedBy, rentedByName, rentedUntil } = action.payload
      await dbUpdate('tool_library', {
        status: 'rented',
        rented_by: toUUID(rentedBy),
        rented_by_name: rentedByName,
        rented_until: rentedUntil
      }, 'id', toUUID(toolId))
    }

    if (returnTool.match(action)) {
      const toolId = action.payload
      await dbUpdate('tool_library', {
        status: 'available',
        rented_by: null,
        rented_by_name: null,
        rented_until: null
      }, 'id', toUUID(toolId))
    }

    // 10. Sync Chore Schedule
    if (addChore.match(action)) {
      const chore = action.payload
      await dbUpdate('chore_schedule', {
        id: toUUID(chore.id),
        roommate_id: toUUID(chore.roommateId),
        roommate_name: chore.roommateName,
        task_name: chore.taskName,
        day_of_week: chore.dayOfWeek,
        status: chore.status
      })
    }

    if (completeChore.match(action)) {
      const { choreId, completedAt } = action.payload
      await dbUpdate('chore_schedule', {
        status: 'completed',
        completed_at: completedAt
      }, 'id', toUUID(choreId))
    }

    if (resetChoreWeek.match(action)) {
      const chores = action.payload
      if (supabase) {
        await supabase.from('chore_schedule').delete().filter('id', 'not.is', null)
      }
      for (const chore of chores) {
        await dbUpdate('chore_schedule', {
          id: toUUID(chore.id),
          roommate_id: toUUID(chore.roommateId),
          roommate_name: chore.roommateName,
          task_name: chore.taskName,
          day_of_week: chore.dayOfWeek,
          status: chore.status
        })
      }
    }

    // 11. Sync Notice Bulletins & Event RSVPs
    if (addNoticeEvent.match(action)) {
      const notice = action.payload
      await dbUpdate('notice_events', {
        id: toUUID(notice.id),
        title: notice.title,
        description: notice.description,
        type: notice.type,
        posted_by: notice.postedBy,
        posted_by_id: toUUID(notice.postedById),
        event_date: notice.eventDate || null,
        rsvps: notice.rsvps.map(r => toUUID(r)),
        created_at: notice.timestamp
      })
    }

    if (rsvpToEvent.match(action)) {
      const { noticeId, userName } = action.payload
      try {
        const notice = store.getState().community.notices.find(n => toUUID(n.id) === toUUID(noticeId))
        if (notice) {
          await dbUpdate('notice_events', {
            rsvps: notice.rsvps.map(r => toUUID(r))
          }, 'id', toUUID(noticeId))
        }
      } catch (err) {
        console.error("Supabase RSVP sync failed:", err)
        store.dispatch(rsvpNoticeRollback({ noticeId, userName }))
      }
    }

    if (vibeNotice.match(action)) {
      const { noticeId, userName } = action.payload
      try {
        const notice = store.getState().community.notices.find(n => toUUID(n.id) === toUUID(noticeId))
        if (notice) {
          await dbUpdate('notice_events', {
            vibes: notice.vibes || []
          }, 'id', toUUID(noticeId))
        }
      } catch (err) {
        console.error("Supabase Vibe sync failed:", err)
        store.dispatch(vibeNoticeRollback({ noticeId, userName }))
      }
    }

    if (echoNotice.match(action)) {
      const { noticeId, userName } = action.payload
      try {
        const notice = store.getState().community.notices.find(n => toUUID(n.id) === toUUID(noticeId))
        if (notice) {
          await dbUpdate('notice_events', {
            echos: notice.echos || []
          }, 'id', toUUID(noticeId))
        }
      } catch (err) {
        console.error("Supabase Echo sync failed:", err)
        store.dispatch(echoNoticeRollback({ noticeId, userName }))
      }
    }

    // 12. Sync Community Disputes & Mediation Board
    if (addDispute.match(action)) {
      const dispute = action.payload
      await dbUpdate('community_disputes', {
        id: toUUID(dispute.id),
        title: dispute.title,
        description: dispute.description,
        category: dispute.category,
        reported_by: dispute.reportedBy,
        reported_by_id: toUUID(dispute.reportedById),
        against_user: dispute.againstUser,
        against_user_id: dispute.againstUserId ? toUUID(dispute.againstUserId) : null,
        mediator_id: dispute.mediatorId ? toUUID(dispute.mediatorId) : null,
        mediator_name: dispute.mediatorName || null,
        status: dispute.status,
        created_at: dispute.timestamp
      })
    }

    if (updateDisputeStatus.match(action)) {
      const { disputeId, status, resolutionDetails } = action.payload
      await dbUpdate('community_disputes', {
        status,
        resolution_details: resolutionDetails || null
      }, 'id', toUUID(disputeId))
    }

  } catch (err) {
    console.error("Supabase Sync Err: ", err)
  }

  return result
}

// Store Creation
export const store = configureStore({
  reducer: {
    auth: authSlice.reducer,
    listings: listingsSlice.reducer,
    requests: requestsSlice.reducer,
    security: securitySlice.reducer,
    networking: networkingSlice.reducer,
    utilities: utilitiesSlice.reducer,
    community: communitySlice.reducer,
    notifications: notificationsSlice.reducer
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
}

export type AppDispatch = typeof store.dispatch
