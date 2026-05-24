import test from 'node:test'
import assert from 'node:assert'
import { store, loginUser, logoutUser, deductBalance, addBalance, addListing, deleteListing, addRequest, updateRequestStatus, addToken, buyToken, addDispatch, updateDispatchStatus } from './index.ts'

test('Redux Store - Authentication & Wallet Slices', () => {
  // Initial state should not have a current user
  let state = store.getState()
  assert.strictEqual(state.auth.currentUser, null)

  const mockUser = {
    id: 'tenant-test',
    name: 'Test Tenant',
    email: 'test@tenant.com',
    role: 'tenant' as const,
    balance: 500
  }

  // Test login action
  store.dispatch(loginUser(mockUser))
  state = store.getState()
  assert.strictEqual(state.auth.currentUser?.id, 'tenant-test')
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
    id: 'room-test-1',
    title: 'Sunny Backyard Room',
    description: 'Very neat and secure room',
    price: 1200,
    currency: 'ZAR',
    location: 'Midrand, SA',
    suburb: 'Ivory Park',
    safetyRating: 'high' as const,
    safetyNotes: 'Secure yard',
    landlordId: 'landlord-test',
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
  assert.ok(state.listings.items.find(l => l.id === 'room-test-1'))

  // Test request submission
  const newReq = {
    id: 'req-test-1',
    tenantId: 'tenant-test',
    tenantName: 'John Doe',
    listingId: 'room-test-1',
    listingTitle: 'Sunny Backyard Room',
    landlordId: 'landlord-test',
    status: 'pending' as const,
    message: 'I would like to apply.',
    timestamp: '2026-05-24'
  }

  store.dispatch(addRequest(newReq))
  state = store.getState()
  assert.strictEqual(state.requests.items.length, 1)
  assert.strictEqual(state.requests.items[0].status, 'pending')

  // Test request status update
  store.dispatch(updateRequestStatus({ requestId: 'req-test-1', status: 'approved' }))
  state = store.getState()
  assert.strictEqual(state.requests.items[0].status, 'approved')

  // Test listing deletion
  store.dispatch(deleteListing('room-test-1'))
  state = store.getState()
  assert.strictEqual(state.listings.items.length, initialListingCount)
})

test('Redux Store - Prepaid Utilities Sharing Slice', () => {
  let state = store.getState()
  const initialTokenCount = state.utilities.tokens.length

  const newToken = {
    id: 'tok-test-1',
    landlordId: 'landlord-test',
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
    tokenId: 'tok-test-1',
    buyerId: 'tenant-test',
    timestamp: '2026-05-24'
  }))
  state = store.getState()
  const purchasedToken = state.utilities.tokens.find(t => t.id === 'tok-test-1')
  assert.strictEqual(purchasedToken?.status, 'sold')
  assert.strictEqual(purchasedToken?.purchasedBy, 'tenant-test')
})

test('Redux Store - Service Dispatches & Handyman Orders Slice', () => {
  const newDispatch = {
    id: 'disp-test-1',
    serviceId: 'srv-1',
    serviceName: 'Sipho Plumbers',
    senderId: 'tenant-test',
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
  store.dispatch(updateDispatchStatus({ dispatchId: 'disp-test-1', status: 'accepted' }))
  state = store.getState()
  assert.strictEqual(state.networking.dispatches[0].status, 'accepted')
})
