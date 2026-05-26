import { configureStore, createSlice, PayloadAction } from '@reduxjs/toolkit'

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
    priceEstimate: 'From 250 ZAR / hour',
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
    priceEstimate: 'From 400 ZAR / Trip',
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
    priceEstimate: '150 ZAR / Day assistance',
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
      state.currentUser = action.payload
      state.isLoaded = true
      state.failedAttempts[action.payload.email] = 0 // reset on success
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
    }
  }
})

const listingsSlice = createSlice({
  name: 'listings',
  initialState: {
    items: initialListings
  },
  reducers: {
    addListing: (state, action: PayloadAction<Listing>) => {
      state.items.push(action.payload)
    },
    deleteListing: (state, action: PayloadAction<string>) => {
      state.items = state.items.filter(item => item.id !== action.payload)
    }
  }
})

const requestsSlice = createSlice({
  name: 'requests',
  initialState: {
    items: [] as RoomRequest[]
  },
  reducers: {
    addRequest: (state, action: PayloadAction<RoomRequest>) => {
      state.items.push(action.payload)
    },
    updateRequestStatus: (state, action: PayloadAction<{ requestId: string; status: 'approved' | 'rejected' }>) => {
      const req = state.items.find(r => r.id === action.payload.requestId)
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
    addRoommateSeeker: (state, action: PayloadAction<RoommateSeeker>) => {
      state.roommates.push(action.payload)
    },
    addLiftClub: (state, action: PayloadAction<LiftClub>) => {
      state.lifts.push(action.payload)
    },
    addService: (state, action: PayloadAction<HandymanService>) => {
      state.services.push(action.payload)
    },
    deleteService: (state, action: PayloadAction<string>) => {
      state.services = state.services.filter(s => s.id !== action.payload)
    },
    bookSeat: (state, action: PayloadAction<string>) => {
      const lift = state.lifts.find(l => l.id === action.payload)
      if (lift && lift.availableSeats > 0) {
        lift.availableSeats -= 1
      }
    },
    addDispatch: (state, action: PayloadAction<ServiceDispatch>) => {
      state.dispatches.push(action.payload)
    },
    updateDispatchStatus: (state, action: PayloadAction<{ dispatchId: string; status: 'accepted' | 'completed' }>) => {
      const disp = state.dispatches.find(d => d.id === action.payload.dispatchId)
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
    addToken: (state, action: PayloadAction<UtilityToken>) => {
      state.tokens.push(action.payload)
    },
    buyToken: (state, action: PayloadAction<{ tokenId: string; buyerId: string; timestamp: string }>) => {
      const tok = state.tokens.find(t => t.id === action.payload.tokenId)
      if (tok && tok.status === 'available') {
        tok.status = 'sold'
        tok.purchasedBy = action.payload.buyerId
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
    rsvps: []
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
    rsvps: ['Lerato Modise']
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
    addTool: (state, action: PayloadAction<ToolItem>) => {
      state.tools.push(action.payload)
    },
    rentTool: (state, action: PayloadAction<{ toolId: string; rentedBy: string; rentedByName: string; rentedUntil: string }>) => {
      const tool = state.tools.find(t => t.id === action.payload.toolId)
      if (tool && tool.status === 'available') {
        tool.status = 'rented'
        tool.rentedBy = action.payload.rentedBy
        tool.rentedByName = action.payload.rentedByName
        tool.rentedUntil = action.payload.rentedUntil
      }
    },
    returnTool: (state, action: PayloadAction<string>) => {
      const tool = state.tools.find(t => t.id === action.payload)
      if (tool && tool.status === 'rented') {
        tool.status = 'available'
        tool.rentedBy = undefined
        tool.rentedByName = undefined
        tool.rentedUntil = undefined
      }
    },
    addChore: (state, action: PayloadAction<ChoreAssignment>) => {
      state.chores.push(action.payload)
    },
    completeChore: (state, action: PayloadAction<{ choreId: string; completedAt: string }>) => {
      const chore = state.chores.find(c => c.id === action.payload.choreId)
      if (chore && chore.status === 'pending') {
        chore.status = 'completed'
        chore.completedAt = action.payload.completedAt
        const rId = chore.roommateId
        state.reputationScores[rId] = (state.reputationScores[rId] || 0) + 10
      }
    },
    resetChoreWeek: (state, action: PayloadAction<ChoreAssignment[]>) => {
      state.chores = action.payload
    },
    addNoticeEvent: (state, action: PayloadAction<NoticeEvent>) => {
      state.notices.unshift(action.payload)
    },
    rsvpToEvent: (state, action: PayloadAction<{ noticeId: string; userName: string }>) => {
      const notice = state.notices.find(n => n.id === action.payload.noticeId)
      if (notice && notice.type === 'event') {
        if (!notice.rsvps.includes(action.payload.userName)) {
          notice.rsvps.push(action.payload.userName)
        } else {
          notice.rsvps = notice.rsvps.filter(u => u !== action.payload.userName)
        }
      }
    },
    addDispute: (state, action: PayloadAction<CommunityDispute>) => {
      state.disputes.unshift(action.payload)
    },
    updateDisputeStatus: (state, action: PayloadAction<{ disputeId: string; status: 'pending' | 'mediating' | 'resolved'; resolutionDetails?: string }>) => {
      const dispute = state.disputes.find(d => d.id === action.payload.disputeId)
      if (dispute) {
        dispute.status = action.payload.status
        if (action.payload.resolutionDetails) {
          dispute.resolutionDetails = action.payload.resolutionDetails
        }
      }
    }
  }
})

// Action Exports
export const { loginUser, logoutUser, registerFailedAttempt, resetFailedAttempts, updateProfile, updatePreferences, deductBalance, addBalance } = authSlice.actions
export const { addListing, deleteListing } = listingsSlice.actions
export const { addRequest, updateRequestStatus } = requestsSlice.actions
export const { addLog, incrementApiCall, resetApiCounts } = securitySlice.actions
export const { addRoommateSeeker, addLiftClub, addService, deleteService, bookSeat, addDispatch, updateDispatchStatus } = networkingSlice.actions
export const { addToken, buyToken } = utilitiesSlice.actions
export const {
  addTool,
  rentTool,
  returnTool,
  addChore,
  completeChore,
  resetChoreWeek,
  addNoticeEvent,
  rsvpToEvent,
  addDispute,
  updateDisputeStatus
} = communitySlice.actions

// Store Creation
export const store = configureStore({
  reducer: {
    auth: authSlice.reducer,
    listings: listingsSlice.reducer,
    requests: requestsSlice.reducer,
    security: securitySlice.reducer,
    networking: networkingSlice.reducer,
    utilities: utilitiesSlice.reducer,
    community: communitySlice.reducer
  }
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
