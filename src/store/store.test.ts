import test from 'node:test'
import assert from 'node:assert'
import { store, loginUser, logoutUser, deductBalance, addBalance, addListing, deleteListing, addRequest, updateRequestStatus, addToken, buyToken, addDispatch, updateDispatchStatus } from './index'

test('Redux Store - Authentication & Wallet Slices', () => {
  // Initial state should not have a current user
  let state = store.getState()
  assert.strictEqual(state.auth.currentUser, null)

  const mockUser = {
    id: '4e36eee4-5310-437c-a19e-2270a147e260',
    name: 'Test Tenant',
    email: 'test@tenant.com',
    role: 'tenant' as const,
    balance: 500
  }

  // Test login action
  store.dispatch(loginUser(mockUser))
  state = store.getState()
  assert.strictEqual(state.auth.currentUser?.id, '4e36eee4-5310-437c-a19e-2270a147e260')
  assert.strictEqual(state.auth.currentUser?.balance, 500)

  // Test wallet balance deduction
  store.dispatch(deductBalance(150))
  state = store.getState()
  assert.strictEqual(state.auth.currentUser?.balance, 350)

  // Test wallet balance addition
  store.dispatch(addBalance(200))
  state = store.getState()
  assert.strictEqual(state.auth.currentUser?.balance, 550)

  // Test logout action
  store.dispatch(logoutUser())
  state = store.getState()
  assert.strictEqual(state.auth.currentUser, null)
})

test('Redux Store - Room Listings & Requests Workflow', () => {
  let state = store.getState()
  const initialListingCount = state.listings.items.length

  const newRoom = {
    id: '42f8c545-efba-460d-85fa-71fa84a3c10a',
    title: 'Sunny Backyard Room',
    description: 'Very neat and secure room',
    price: 1200,
    currency: 'ZAR',
    location: 'Midrand, SA',
    suburb: 'Ivory Park',
    safetyRating: 'high' as const,
    safetyNotes: 'Secure yard',
    landlordId: 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d',
    landlordName: 'Test Landlord',
    landlordLivesHere: true,
    images: [],
    amenities: { wifi: true, parking: false, bathroom: 'shared' as const },
    requirements: {
      genderPreference: 'any' as const,
      childrenAllowed: true,
      maxChildren: 1,
      smokingAllowed: false,
      petsAllowed: false
    }
  }

  // Test listing creation
  store.dispatch(addListing(newRoom))
  state = store.getState()
  assert.strictEqual(state.listings.items.length, initialListingCount + 1)
  assert.ok(state.listings.items.find(l => l.id === '42f8c545-efba-460d-85fa-71fa84a3c10a'))

  // Test request submission
  const newReq = {
    id: 'e1234567-89ab-cdef-0123-456789abcdef',
    tenantId: '4e36eee4-5310-437c-a19e-2270a147e260',
    tenantName: 'John Doe',
    listingId: '42f8c545-efba-460d-85fa-71fa84a3c10a',
    listingTitle: 'Sunny Backyard Room',
    landlordId: 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d',
    status: 'pending' as const,
    message: 'I would like to apply.',
    timestamp: '2026-05-24'
  }

  store.dispatch(addRequest(newReq))
  state = store.getState()
  assert.strictEqual(state.requests.items.length, 1)
  assert.strictEqual(state.requests.items[0].status, 'pending')

  // Test request status update
  store.dispatch(updateRequestStatus({ requestId: 'e1234567-89ab-cdef-0123-456789abcdef', status: 'approved' }))
  state = store.getState()
  assert.strictEqual(state.requests.items[0].status, 'approved')

  // Test listing deletion
  store.dispatch(deleteListing('42f8c545-efba-460d-85fa-71fa84a3c10a'))
  state = store.getState()
  assert.strictEqual(state.listings.items.length, initialListingCount)
})

test('Redux Store - Prepaid Utilities Sharing Slice', () => {
  let state = store.getState()
  const initialTokenCount = state.utilities.tokens.length

  const newToken = {
    id: 'b7a9f6d1-8c43-4e3b-9a8c-7f5b1d9c8e2b',
    landlordId: 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d',
    landlordName: 'Test Landlord',
    meterNumber: 'MTR-9900-11',
    price: 100,
    currency: 'ZAR',
    tokenCode: '1111-2222-3333-4444-5555',
    status: 'available' as const
  }

  // Test publishing new sub-meter token
  store.dispatch(addToken(newToken))
  state = store.getState()
  assert.strictEqual(state.utilities.tokens.length, initialTokenCount + 1)

  // Test token purchase transaction
  store.dispatch(buyToken({
    tokenId: 'b7a9f6d1-8c43-4e3b-9a8c-7f5b1d9c8e2b',
    buyerId: '4e36eee4-5310-437c-a19e-2270a147e260',
    timestamp: '2026-05-24'
  }))
  state = store.getState()
  const purchasedToken = state.utilities.tokens.find(t => t.id === 'b7a9f6d1-8c43-4e3b-9a8c-7f5b1d9c8e2b')
  assert.strictEqual(purchasedToken?.status, 'sold')
  assert.strictEqual(purchasedToken?.purchasedBy, '4e36eee4-5310-437c-a19e-2270a147e260')
})

test('Redux Store - Service Dispatches & Handyman Orders Slice', () => {
  const newDispatch = {
    id: 'd8c7b6a5-9e8d-7c6b-5a4b-3c2d1e0f9a8b',
    serviceId: 'c1d2e3f4-5678-90ab-cdef-1234567890ab',
    serviceName: 'Sipho Plumbers',
    senderId: '4e36eee4-5310-437c-a19e-2270a147e260',
    senderName: 'John Tenant',
    senderRole: 'tenant' as const,
    message: 'Leak repair',
    status: 'pending' as const,
    timestamp: '2026-05-24'
  }

  // Test contract dispatch
  store.dispatch(addDispatch(newDispatch))
  let state = store.getState()
  assert.strictEqual(state.networking.dispatches.length, 1)

  // Test service provider accepting contract order
  store.dispatch(updateDispatchStatus({ dispatchId: 'd8c7b6a5-9e8d-7c6b-5a4b-3c2d1e0f9a8b', status: 'accepted' }))
  state = store.getState()
  assert.strictEqual(state.networking.dispatches[0].status, 'accepted')
})
