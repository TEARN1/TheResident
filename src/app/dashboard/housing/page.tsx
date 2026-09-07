'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, MapPin, Home, Loader, Filter, X, Plus, Info, AlertTriangle, Check, Send, ShieldCheck, Building2, Trash2, Camera
} from 'lucide-react'
import {
  RootState,
  AppDispatch,
  Listing,
  RoomRequest,
  selectFilteredListings,
  selectMatchedRoommates,
  addRequest,
  addListing,
  deleteListing,
  updateRequestStatus,
  isGuestUser
} from '../../../store'
import { approveRequest, rejectRequest, waitlistRequest, saveRequest } from '../../../store/actions'
import { useGeolocation } from '../../../hooks/useGeolocation'
import { formatCurrency, suburbPriceStats, isSuspiciousPrice, type SearchFilters } from '../../../utils/logic'
import { supabase } from '../../../utils/supabase'
import FollowButton from '../components/social/FollowButton'
import TrustBadge from '../components/trust-safety/TrustBadge'
import NextOfKinFlag from '../components/trust-safety/NextOfKinFlag'
import ReviewForm from '../components/social/ReviewForm'
import ReviewsList from '../components/social/ReviewsList'
import SavedSearches from '../components/housing/SavedSearches'
import OpenInMapsButton from '../components/map/OpenInMapsButton'
import Link from 'next/link'
import UpgradeButton from '../components/shared/UpgradeButton'
import PropertiesPanel, { type ResProperty } from '../components/housing/PropertiesPanel'
import EmptyState from '../components/shared/EmptyState'
import { goldButtonClass } from '../../../components/ui/GoldButton'
import { fetchUpcomingGruvsEvents, fetchGruvsEventsByIds, formatGruvsEventWhen } from '../../../utils/gruvsEvents'
import { fetchWatchedListingIds, watchRoomVacancy, unwatchRoomVacancy } from '../../../utils/roomInventory'
import { Bell, BellOff } from 'lucide-react'

// Top of the budget slider. Well above the real ceiling for a single room so
// the control can express any listing on the platform; the max position means
// "no limit" rather than this literal amount.
const PRICE_CEILING_MAX = 20000

// Guest houses are seasonal: listed to catch people in town for Gruvs
// events, gone once the season's over rather than lingering as stale
// inventory. res_listings.visible_until enforces this server-side too —
// this is just the default a new guesthouse listing is created with.
const GUESTHOUSE_SEASON_END = (() => {
  const d = new Date()
  d.setMonth(9, 31) // October is month index 9; day 31 rolls into November if short, October never is
  d.setHours(23, 59, 59, 999)
  if (d.getTime() < Date.now()) d.setFullYear(d.getFullYear() + 1)
  return d.toISOString()
})()

export default function HousingPage() {
  const dispatch = useDispatch<AppDispatch>()
  // Two audiences, two jobs: someone WITH an empty room lands on their own
  // properties (list it, see who applied), someone WHO NEEDS a room lands on
  // the search. Defaulting everyone to 'rooms' made a landlord's first screen
  // a feed of other people's listings — the one thing they didn't come for.
  const [activeTab, setActiveTab] = useState<'rooms' | 'roommates' | 'properties'>('rooms')
  const [alertNotification, setAlertNotification] = useState<string | null>(null)
  const { locationLoading, handleGetLiveLocation } = useGeolocation(setAlertNotification)

  // Filter States
  const [searchInputValue, setSearchInputValue] = useState('')
  const [showSuburbSuggestions, setShowSuburbSuggestions] = useState(false)
  const [searchLocation, setSearchLocation] = useState('')
  // 0 means "no ceiling" (selectFilteredListings only applies maxPrice when > 0).
  //
  // This defaulted to 3000 with a slider that capped at 5000, which quietly
  // broke the marketplace: every room above R3 000 was hidden from every
  // tenant on arrival, and a room above R5 000 could not be revealed at ALL —
  // no slider position existed that showed it. A landlord could list a R6 500
  // cottage, pay to boost it, and never be seen. Rooms in that band are
  // completely normal here, so the default is now "show me everything" and the
  // ceiling only applies once a tenant deliberately sets one.
  const [filterPrice, setFilterPrice] = useState<number>(0)
  const [filterWifi, setFilterWifi] = useState(false)
  const [filterQuickPostOnly, setFilterQuickPostOnly] = useState(false)
  // Rent / Buy / Guest House — same res_listings table and same filters,
  // distinguished by listing_type, same pattern as the quick-post merge above.
  const [filterListingType, setFilterListingType] = useState<'rent' | 'sale' | 'guesthouse'>('rent')
  const [filterParking, setFilterParking] = useState(false)
  const [showFilters, setShowFilters] = useState(false)

  // Create Modal State
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newPrice, setNewPrice] = useState<number>(1500)
  const [newCurrency, setNewCurrency] = useState('ZAR')
  const [newLocation, setNewLocation] = useState('')
  const [newSuburb, setNewSuburb] = useState('')
  const [newLivesHere, setNewLivesHere] = useState(false)
  const [newQuickPost, setNewQuickPost] = useState(false)
  const [newListingType, setNewListingType] = useState<'rent' | 'sale' | 'guesthouse'>('rent')
  const [newEventId, setNewEventId] = useState('')
  const [newWifi, setNewWifi] = useState(true)
  const [newParking, setNewParking] = useState(true)
  const [newBathroom, setNewBathroom] = useState<'shared' | 'private' | 'ensuite'>('shared')
  const [newGenderPref, setNewGenderPref] = useState<'men' | 'women' | 'couple' | 'any'>('any')
  const [newChildrenAllowed, setNewChildrenAllowed] = useState(true)
  const [newMaxChildren, setNewMaxChildren] = useState(2)
  const [newPropertyId, setNewPropertyId] = useState('')
  const [newPhotos, setNewPhotos] = useState<string[]>([])
  const [uploadingPhotos, setUploadingPhotos] = useState(false)

  // Landlord's Properties (the layer above listings — a property groups rooms
  // under one address so occupancy can be tracked instead of every listing
  // being its own island)
  const [myProperties, setMyProperties] = useState<ResProperty[]>([])

  // Application Drawer
  const [activeListing, setActiveListing] = useState<Listing | null>(null)
  const [applyMessage, setApplyMessage] = useState('')

  // Landlord Audit Modal
  const [activeAuditRequest, setActiveAuditRequest] = useState<RoomRequest | null>(null)
  const [auditActionLoading, setAuditActionLoading] = useState<string | null>(null)

  // Reviews toggle (per listing card)
  const [reviewsOpenFor, setReviewsOpenFor] = useState<string | null>(null)

  const [confirmDeleteListingId, setConfirmDeleteListingId] = useState<string | null>(null)
  const handleDeleteListing = (id: string) => {
    dispatch(deleteListing(id))
    setConfirmDeleteListingId(null)
    setAlertNotification('Listing removed.')
    setTimeout(() => setAlertNotification(null), 3000)
  }

  const currentUser = useSelector((state: RootState) => state.auth.currentUser)
  const allListings = useSelector((state: RootState) => state.listings.items)
  const requests = useSelector((state: RootState) => state.requests.items)

  // Search Debouncer
  useEffect(() => {
    const handler = setTimeout(() => setSearchLocation(searchInputValue), 300)
    return () => clearTimeout(handler)
  }, [searchInputValue])

  // Distinct suburbs that actually have listings, matched against what's
  // typed so far — the search field used to be a bare substring match with
  // no way to know which suburb names would return anything before hitting
  // enter. Capped at 6 so it never grows into its own scrollable list.
  const suburbSuggestions = useMemo(() => {
    const q = searchInputValue.trim().toLowerCase()
    const counts = new Map<string, number>()
    for (const l of allListings) {
      if (q && !l.suburb.toLowerCase().includes(q)) continue
      counts.set(l.suburb, (counts.get(l.suburb) || 0) + 1)
    }
    return [...counts.entries()]
      .map(([suburb, count]) => ({ suburb, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6)
  }, [allListings, searchInputValue])

  // Steers only the FIRST render once the role is known (it arrives async from
  // session bootstrap). Guarded by a ref so it never yanks the tab back while
  // a landlord is deliberately browsing Rooms.
  const hasSteeredTab = React.useRef(false)
  useEffect(() => {
    if (hasSteeredTab.current || !currentUser) return
    hasSteeredTab.current = true
    if (currentUser.role === 'landlord') setActiveTab('properties')
  }, [currentUser])

  const loadMyProperties = React.useCallback(async () => {
    if (!supabase || !currentUser?.id || currentUser.role !== 'landlord') return
    const { data } = await supabase.from('res_properties').select('*').eq('landlord_id', currentUser.id)
    if (data) setMyProperties(data as ResProperty[])
  }, [currentUser?.id, currentUser?.role])

  useEffect(() => { loadMyProperties() }, [loadMyProperties])

  // Guest houses link to a real Gruvs event (res_listings.event_id) rather
  // than a free-text "near what" — same convention as LiftClub.eventId and
  // NoticeEvent.eventId. Fetched once for the create-listing picker; and by
  // id for whichever events existing guesthouse listings already reference,
  // so a card can say "Near <real event name>" instead of just a date.
  const [upcomingGruvsEvents, setUpcomingGruvsEvents] = useState<{ id: string; title: string; startsAt: string }[]>([])
  const [gruvsEventInfo, setGruvsEventInfo] = useState<Record<string, { title: string; startsAt: string }>>({})

  useEffect(() => {
    let cancelled = false
    fetchUpcomingGruvsEvents().then(events => {
      if (!cancelled) setUpcomingGruvsEvents(events)
    })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let cancelled = false
    const ids = [...new Set(allListings.map(l => l.eventId).filter((id): id is string => !!id))]
    if (ids.length === 0) return
    fetchGruvsEventsByIds(ids).then(info => {
      if (!cancelled) setGruvsEventInfo(prev => ({ ...prev, ...info }))
    })
    return () => { cancelled = true }
  }, [allListings])

  // Which room-inventory listings the caller is currently occupied-and-
  // watchable on, and which of those they already have a watch on. Keyed by
  // listing id, since that's the only handle the browsing UI has — a room's
  // own id is never exposed to a tenant (res_rooms is landlord-private).
  const [roomOccupiedStatus, setRoomOccupiedStatus] = useState<Record<string, boolean>>({})
  const [watchedListingIds, setWatchedListingIds] = useState<Set<string>>(new Set())
  const [watchBusyId, setWatchBusyId] = useState<string | null>(null)

  useEffect(() => {
    if (!supabase || isGuestUser(currentUser)) return
    let cancelled = false
    const ids = [...new Set(allListings.map(l => l.id))]
    if (ids.length === 0) return
    supabase.rpc('res_room_listing_status', { p_listing_ids: ids }).then(({ data }) => {
      if (cancelled || !data) return
      const map: Record<string, boolean> = {}
      for (const row of data as { listing_id: string; is_vacant: boolean }[]) {
        map[row.listing_id] = !row.is_vacant
      }
      setRoomOccupiedStatus(map)
    })
    fetchWatchedListingIds(ids).then(set => { if (!cancelled) setWatchedListingIds(set) })
    return () => { cancelled = true }
  }, [allListings, currentUser])

  const handleToggleWatch = async (listingId: string) => {
    setWatchBusyId(listingId)
    try {
      if (watchedListingIds.has(listingId)) {
        await unwatchRoomVacancy(listingId)
        setWatchedListingIds(prev => { const next = new Set(prev); next.delete(listingId); return next })
        setAlertNotification('Notification cancelled.')
      } else {
        await watchRoomVacancy(listingId)
        setWatchedListingIds(prev => new Set(prev).add(listingId))
        setAlertNotification("You'll be notified the moment this room is vacant.")
      }
    } catch (err) {
      setAlertNotification(err instanceof Error ? err.message.replace(/^\w+:\s*/, '') : 'That did not work.')
    } finally {
      setWatchBusyId(null)
    }
  }

  const filteredListingsRaw = useSelector((state: RootState) => selectFilteredListings(
    state,
    searchLocation,
    filterPrice,
    filterWifi,
    filterParking,
    'all',
    false,
    false
  ))

  // A boosted listing sorts first while its purchase is still active.
  const isFeatured = (l: Listing) => !!l.featuredUntil && new Date(l.featuredUntil).getTime() > Date.now()
  // Past its visible_until (guesthouse listings default to end-of-October,
  // see GUESTHOUSE_SEASON_END) — hidden from browse/search the same way an
  // expired notice hides itself, without deleting the row.
  const isVisible = (l: Listing) => !l.visibleUntil || new Date(l.visibleUntil).getTime() > Date.now()
  const filteredListings = [...filteredListingsRaw]
    .filter(isVisible)
    .filter(l => !filterQuickPostOnly || l.quickPost)
    .filter(l => (l.listingType || 'rent') === filterListingType)
    .sort((a, b) => Number(isFeatured(b)) - Number(isFeatured(a)))

  const filteredRoommates = useSelector((state: RootState) => selectMatchedRoommates(
    state,
    'all',
    2000
  ))

  // What rooms actually go for near this listing, in the same currency —
  // comparing ZAR to EUR would produce a meaningless "median".
  const newListingPriceStats = newSuburb
    ? suburbPriceStats(
        allListings.filter(l => l.suburb === newSuburb && l.currency === newCurrency).map(l => l.price)
      )
    : null
  const newListingLooksSuspicious = isSuspiciousPrice(newPrice, newListingPriceStats)

  // Same validation/upload pattern as RoomInventoryPanel's photo picker: this
  // form had no image field at all before — every listing got the same
  // hardcoded stock photo regardless of what the room actually looked like.
  const MAX_LISTING_PHOTOS = 6
  const MAX_LISTING_IMAGE_BYTES = 5 * 1024 * 1024
  const handleListingPhotoSelect = async (files: FileList | null) => {
    if (!supabase || !files || files.length === 0 || !currentUser) return
    const incoming = Array.from(files)
    if (newPhotos.length + incoming.length > MAX_LISTING_PHOTOS) {
      setAlertNotification(`Up to ${MAX_LISTING_PHOTOS} photos per listing.`)
      setTimeout(() => setAlertNotification(null), 4000)
      return
    }
    setUploadingPhotos(true)
    try {
      const uploaded: string[] = []
      for (const file of incoming) {
        if (!file.type.startsWith('image/')) continue
        if (file.size > MAX_LISTING_IMAGE_BYTES) continue
        const path = `${currentUser.id}/listing-${Date.now()}-${file.name}`
        const { error } = await supabase.storage.from('gossip-media').upload(path, file)
        if (error) continue
        const { data } = supabase.storage.from('gossip-media').getPublicUrl(path)
        uploaded.push(data.publicUrl)
      }
      setNewPhotos(p => [...p, ...uploaded])
    } finally {
      setUploadingPhotos(false)
    }
  }

  const handleCreateListing = (e: React.FormEvent) => {
    e.preventDefault()
    const listing: Listing = {
      id: `list-${Date.now()}`,
      title: newTitle,
      description: newDesc,
      price: newPrice,
      currency: newCurrency,
      location: newLocation,
      suburb: newSuburb,
      safetyRating: 'high',
      safetyNotes: 'Verified community watch area.',
      landlordId: currentUser?.id || '',
      landlordName: currentUser?.name || '',
      landlordLivesHere: newLivesHere,
      images: newPhotos.length > 0
        ? newPhotos
        : ['https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?auto=format&fit=crop&w=600&q=80'],
      amenities: { wifi: newWifi, parking: newParking, bathroom: newBathroom },
      requirements: {
        genderPreference: newGenderPref,
        childrenAllowed: newChildrenAllowed,
        maxChildren: newMaxChildren,
        smokingAllowed: false,
        petsAllowed: false
      },
      propertyId: newPropertyId || undefined,
      createdAt: new Date().toISOString(),
      quickPost: newQuickPost,
      listingType: newListingType,
      eventId: newListingType === 'guesthouse' ? (newEventId || null) : undefined,
      // Not user-editable — guest houses are seasonal by design, always
      // through end of October, not whatever a poster might pick.
      visibleUntil: newListingType === 'guesthouse' ? GUESTHOUSE_SEASON_END : null
    }
    dispatch(addListing(listing))
    setShowCreateModal(false)
    setNewPropertyId('')
    setNewQuickPost(false)
    setNewListingType('rent')
    setNewEventId('')
    setNewPhotos([])
    setAlertNotification('Property listed successfully!')
  }

  // A signed-out guest has no id, so the request row it built was orphaned —
  // it never reached the landlord, yet the UI still said "Application sent".
  // Someone looking for a room would sit waiting on a reply that could never
  // come. Refuse the write and say so instead.
  const isGuest = isGuestUser(currentUser)

  const handleApply = (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeListing) return
    if (isGuest) {
      setActiveListing(null)
      setAlertNotification('Create an account to request this room — guests can browse, but a landlord needs to know who is asking.')
      return
    }
    const request: RoomRequest = {
      id: `req-${Date.now()}`,
      tenantId: currentUser?.id || '',
      // A room request is exactly the "landlord's view of an applicant"
      // formal context — prefer the Resident-only legal name over the
      // Gruvs display name when the applicant has set one.
      tenantName: currentUser?.legalName || currentUser?.name || '',
      listingId: activeListing.id,
      listingTitle: activeListing.title,
      landlordId: activeListing.landlordId,
      status: 'pending',
      message: applyMessage,
      timestamp: new Date().toLocaleDateString()
    }
    dispatch(addRequest(request))
    setActiveListing(null)
    setApplyMessage('')
    setAlertNotification('Application sent to landlord.')
  }

  const landlordRequests = requests.filter(r => r.landlordId === currentUser?.id && r.status === 'pending')
  const landlordTrackedRequests = requests.filter(r =>
    r.landlordId === currentUser?.id && ['pending', 'waitlisted', 'saved'].includes(r.status)
  )

  const currentSearchFilters: SearchFilters = {
    suburb: searchInputValue || undefined,
    maxPrice: filterPrice,
    wifi: filterWifi || undefined,
    parking: filterParking || undefined
  }

  const applySavedSearch = (filters: SearchFilters) => {
    setSearchInputValue(filters.suburb || '')
    setFilterPrice(typeof filters.maxPrice === 'number' ? filters.maxPrice : 0)
    setFilterWifi(!!filters.wifi)
    setFilterParking(!!filters.parking)
    setShowFilters(true)
  }

  const requestStatusBadge = (status: RoomRequest['status']) => {
    const styles: Record<string, string> = {
      pending: 'bg-accent/10 text-accent border-accent/20',
      waitlisted: 'bg-info/10 text-info border-info/20',
      saved: 'bg-info/10 text-info border-info/20',
      approved: 'bg-success/10 text-success border-success/20',
      rejected: 'bg-danger/10 text-danger border-danger/20'
    }
    return (
      <span className={`px-2.5 py-1 rounded-lg text-xs font-black uppercase tracking-widest border ${styles[status] || styles.pending}`}>
        {status}
      </span>
    )
  }

  const runAuditAction = async (action: 'approved' | 'rejected' | 'waitlisted' | 'saved') => {
    if (!activeAuditRequest) return
    setAuditActionLoading(action)
    try {
      if (action === 'approved') {
        await dispatch(approveRequest(activeAuditRequest.id)).unwrap()
        setAlertNotification('Tenant Approved!')
      } else if (action === 'rejected') {
        await dispatch(rejectRequest(activeAuditRequest.id)).unwrap()
        setAlertNotification('Tenant Rejected.')
      } else if (action === 'waitlisted') {
        await dispatch(waitlistRequest(activeAuditRequest.id)).unwrap()
        setAlertNotification('Applicant waitlisted.')
      } else {
        await dispatch(saveRequest(activeAuditRequest.id)).unwrap()
        setAlertNotification('Saved for later.')
      }
      dispatch(updateRequestStatus({ requestId: activeAuditRequest.id, status: action }))
      setActiveAuditRequest(null)
    } catch (err) {
      setAlertNotification(err instanceof Error ? err.message : 'That did not work.')
    } finally {
      setAuditActionLoading(null)
    }
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-10 pb-32">
      {/* The big icon+title+tagline block that used to live here duplicated
          what the top bar already shows (icon + "Housing") — pure vertical
          space with no new information. The tab switcher is the only part
          of this header that actually does something. */}
      <header className="flex justify-end">
        <div className="flex bg-surface-sunken/40 p-1.5 rounded-2xl border border-subtle shadow-2xl backdrop-blur-xl w-full md:w-auto">
          <button
            onClick={() => setActiveTab('rooms')}
            className={`flex-1 md:flex-none px-6 py-2.5 rounded-xl transition-all text-xs font-black uppercase tracking-widest ${activeTab === 'rooms' ? 'bg-accent text-content-on-accent shadow-lg shadow-gold-primary/20' : 'text-content-muted hover:text-content'}`}
          >
            Rooms
          </button>
          <button
            onClick={() => setActiveTab('roommates')}
            className={`flex-1 md:flex-none px-6 py-2.5 rounded-xl transition-all text-xs font-black uppercase tracking-widest ${activeTab === 'roommates' ? 'bg-accent text-content-on-accent shadow-lg shadow-gold-primary/20' : 'text-content-muted hover:text-content'}`}
          >
            Roommates
          </button>
          {currentUser?.role === 'landlord' && (
            <button
              onClick={() => setActiveTab('properties')}
              className={`flex-1 md:flex-none px-6 py-2.5 rounded-xl transition-all text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 ${activeTab === 'properties' ? 'bg-accent text-content-on-accent shadow-lg shadow-gold-primary/20' : 'text-content-muted hover:text-content'}`}
            >
              <Building2 size={14} /> My Properties
            </button>
          )}
        </div>
      </header>

      {activeTab === 'rooms' && (
        <div className="flex bg-surface-sunken/20 p-1 rounded-xl border border-subtle w-full sm:w-fit">
          <button
            onClick={() => setFilterListingType('rent')}
            className={`flex-1 sm:flex-none px-5 py-2 rounded-lg transition-all text-xs font-black uppercase tracking-widest ${filterListingType === 'rent' ? 'bg-surface-raised/10 text-content' : 'text-content-muted hover:text-content'}`}
          >
            Rent
          </button>
          <button
            onClick={() => setFilterListingType('sale')}
            className={`flex-1 sm:flex-none px-5 py-2 rounded-lg transition-all text-xs font-black uppercase tracking-widest ${filterListingType === 'sale' ? 'bg-surface-raised/10 text-content' : 'text-content-muted hover:text-content'}`}
          >
            Buy
          </button>
          <button
            onClick={() => setFilterListingType('guesthouse')}
            title="Short-stay guest houses, listed only through the current event season"
            className={`flex-1 sm:flex-none px-5 py-2 rounded-lg transition-all text-xs font-black uppercase tracking-widest ${filterListingType === 'guesthouse' ? 'bg-accent text-content-on-accent' : 'text-content-muted hover:text-content'}`}
          >
            Guest Houses
          </button>
        </div>
      )}

      {/* Landlord Notifications for Applications */}
      {currentUser?.role === 'landlord' && landlordTrackedRequests.length > 0 && (
         <div className="glass-panel p-6 border-accent/30 bg-accent/5 flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-4 text-accent">
               <Info size={24} />
               <div>
                  <p className="font-black text-sm uppercase tracking-widest">Action Required</p>
                  <p className="text-xs text-content">You have <strong>{landlordRequests.length}</strong> pending room applications awaiting your audit.</p>
               </div>
            </div>
            <div className="flex flex-wrap gap-2 justify-end">
               {landlordTrackedRequests.map(req => (
                  <button
                    key={req.id}
                    onClick={() => setActiveAuditRequest(req)}
                    className="bg-accent text-content-on-accent px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-accent transition-all flex items-center gap-2"
                  >
                     Audit {req.tenantName}
                     {req.status !== 'pending' && requestStatusBadge(req.status)}
                  </button>
               ))}
            </div>
         </div>
      )}

      {activeTab === 'properties' ? (
        currentUser?.id && (
          <PropertiesPanel
            properties={myProperties}
            listings={allListings.filter(l => l.landlordId === currentUser.id)}
            currentUserId={currentUser.id}
            onRefresh={loadMyProperties}
            onNotify={setAlertNotification}
          />
        )
      ) : activeTab === 'rooms' ? (
        <div className="space-y-8">
          {/* Search & Action Bar */}
          <div className="flex flex-col lg:flex-row gap-4">
             <div className="flex-1 glass-panel p-2 flex items-center gap-2 bg-surface-sunken/60 shadow-inner relative">
                <div className="flex-1 flex items-center bg-surface-sunken/40 rounded-xl px-4 py-1.5 border border-subtle focus-within:border-accent/40 transition-colors">
                   <Search size={18} className="text-content-subtle" />
                   <input
                      type="text"
                      value={searchInputValue}
                      onChange={(e) => { setSearchInputValue(e.target.value); setShowSuburbSuggestions(true) }}
                      onFocus={() => setShowSuburbSuggestions(true)}
                      onBlur={() => setTimeout(() => setShowSuburbSuggestions(false), 150)}
                      placeholder="Enter Suburb, City or Complex..."
                      className="bg-transparent border-none text-content px-3 py-2 w-full outline-none text-sm font-bold placeholder:text-content-subtle placeholder:uppercase placeholder:tracking-widest"
                      autoComplete="off"
                   />
                   <button
                      onClick={() => handleGetLiveLocation(setSearchInputValue)}
                      className={`p-2 transition-all rounded-lg ${locationLoading ? 'text-accent' : 'text-content-subtle hover:text-accent hover:bg-accent/10'}`}
                   >
                      {locationLoading ? <Loader size={18} className="animate-spin" /> : <MapPin size={18} />}
                   </button>
                </div>

                {/* Suggests suburbs that actually HAVE listings, with a live
                    count, instead of a free-text field where a typo just
                    silently returns nothing. Sourced from allListings — real
                    data, zero extra network calls. */}
                {showSuburbSuggestions && suburbSuggestions.length > 0 && (
                   <div className="absolute top-full left-0 right-24 mt-1 z-20 bg-surface border border-default rounded-xl shadow-2xl overflow-hidden">
                      {suburbSuggestions.map(s => (
                         <button
                            key={s.suburb}
                            type="button"
                            onMouseDown={() => { setSearchInputValue(s.suburb); setShowSuburbSuggestions(false) }}
                            className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-content hover:bg-accent/10 hover:text-accent transition-colors text-left"
                         >
                            <span className="flex items-center gap-2"><MapPin size={13} className="text-content-subtle" /> {s.suburb}</span>
                            <span className="text-xs text-content-muted font-bold">{s.count} room{s.count === 1 ? '' : 's'}</span>
                         </button>
                      ))}
                   </div>
                )}

                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`p-3 rounded-xl border transition-all ${showFilters ? 'bg-accent border-accent text-content-on-accent' : 'bg-surface-raised/5 border-default text-content-muted hover:bg-surface-raised/10'}`}
                >
                  <Filter size={18} />
                </button>

                <SavedSearches currentFilters={currentSearchFilters} onApply={applySavedSearch} />
             </div>

             {currentUser?.role === 'landlord' ? (
                <button
                   onClick={() => setShowCreateModal(true)}
                   className="bg-accent hover:bg-accent text-content-on-accent font-black px-8 py-4 rounded-2xl flex items-center justify-center gap-3 transition-all active:scale-95 shadow-xl shadow-gold-primary/10 uppercase tracking-widest text-xs"
                >
                   <Plus size={20} /> List Your Property
                </button>
             ) : (
                <Link
                   href="/dashboard/profile"
                   className="bg-surface-raised/5 hover:bg-accent/10 border border-default hover:border-accent/30 text-content hover:text-accent font-bold px-4 py-4 rounded-2xl flex items-center justify-center gap-2 transition-all text-xs shrink-0"
                   title="Want to list a room? Switch to Landlord mode in your profile."
                >
                   <Building2 size={16} /> Have a room to rent? Switch to Landlord Mode
                </Link>
             )}
          </div>

          <AnimatePresence>
             {showFilters && (
               <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
               >
                  <div className="glass-panel p-8 bg-surface-sunken/40 border-accent/10 grid grid-cols-1 md:grid-cols-3 gap-10">
                     <div className="space-y-4">
                        <div className="flex justify-between items-end gap-2">
                           <label className="text-xs uppercase font-black tracking-[0.2em] text-content-muted">Price Ceiling</label>
                           <input
                              type="number" min={0} step={250}
                              placeholder="Any"
                              value={filterPrice === 0 ? '' : filterPrice}
                              onChange={(e) => {
                                 const raw = e.target.value
                                 if (raw === '') { setFilterPrice(0); return }
                                 setFilterPrice(Math.max(0, Number(raw)))
                              }}
                              className="w-24 bg-surface border border-default rounded-lg px-2 py-1 text-right text-accent font-black text-sm outline-none focus:border-accent/50"
                           />
                        </div>
                        {/* Full-right is "no ceiling", not "R20 000 exactly" — otherwise the
                            top of the range silently becomes a hard cap again. Typing a value
                            above the slider's own max is honoured too, via filterPrice sitting
                            outside [0, PRICE_CEILING_MAX] until the slider is touched again. */}
                        <input
                           type="range" min={500} max={Math.max(PRICE_CEILING_MAX, filterPrice)} step={250}
                           value={filterPrice === 0 ? Math.max(PRICE_CEILING_MAX, filterPrice) : filterPrice}
                           onChange={(e) => {
                              const v = Number(e.target.value)
                              setFilterPrice(v >= PRICE_CEILING_MAX ? 0 : v)
                           }}
                           className="w-full h-1.5 bg-surface-raised rounded-lg appearance-none cursor-pointer accent-gold-primary"
                        />
                        <p className="text-xs text-content-muted">
                           {filterPrice === 0
                              ? 'Showing every room. Drag left to set a budget.'
                              : `Hiding rooms above ${formatCurrency(filterPrice)}.`}
                        </p>
                     </div>

                     <div className="space-y-4">
                        <label className="text-xs uppercase font-black tracking-[0.2em] text-content-muted block mb-6">Preferred Amenities</label>
                        <div className="flex flex-wrap gap-4">
                           <label className="flex items-center gap-3 cursor-pointer group">
                              <div className={`w-10 h-6 rounded-full p-1 transition-all border ${filterWifi ? 'bg-accent border-accent' : 'bg-surface-raised/5 border-default'}`}>
                                 <div className={`w-4 h-4 bg-surface-raised rounded-full shadow-sm transition-transform ${filterWifi ? 'translate-x-4' : 'translate-x-0'}`} />
                              </div>
                              <input type="checkbox" className="hidden" checked={filterWifi} onChange={e => setFilterWifi(e.target.checked)} />
                              <span className={`text-xs font-bold uppercase tracking-widest transition-colors ${filterWifi ? 'text-content' : 'text-content-subtle'}`}>WiFi</span>
                           </label>

                           <label className="flex items-center gap-3 cursor-pointer group">
                              <div className={`w-10 h-6 rounded-full p-1 transition-all border ${filterQuickPostOnly ? 'bg-accent border-accent' : 'bg-surface-raised/5 border-default'}`}>
                                 <div className={`w-4 h-4 bg-surface-raised rounded-full shadow-sm transition-transform ${filterQuickPostOnly ? 'translate-x-4' : 'translate-x-0'}`} />
                              </div>
                              <input type="checkbox" className="hidden" checked={filterQuickPostOnly} onChange={e => setFilterQuickPostOnly(e.target.checked)} />
                              <span className={`text-xs font-bold uppercase tracking-widest transition-colors ${filterQuickPostOnly ? 'text-content' : 'text-content-subtle'}`}>Quick Posts Only</span>
                           </label>

                           <label className="flex items-center gap-3 cursor-pointer group">
                              <div className={`w-10 h-6 rounded-full p-1 transition-all border ${filterParking ? 'bg-accent border-accent' : 'bg-surface-raised/5 border-default'}`}>
                                 <div className={`w-4 h-4 bg-surface-raised rounded-full shadow-sm transition-transform ${filterParking ? 'translate-x-4' : 'translate-x-0'}`} />
                              </div>
                              <input type="checkbox" className="hidden" checked={filterParking} onChange={e => setFilterParking(e.target.checked)} />
                              <span className={`text-xs font-bold uppercase tracking-widest transition-colors ${filterParking ? 'text-content' : 'text-content-subtle'}`}>Parking</span>
                           </label>
                        </div>
                     </div>

                     <div className="flex items-center justify-end">
                        <button
                           onClick={() => {
                              setFilterPrice(0); setFilterWifi(false); setFilterParking(false); setSearchInputValue('');
                           }}
                           className="text-xs font-black uppercase tracking-[0.3em] text-danger/50 hover:text-danger transition-colors"
                        >
                           Reset All Filters
                        </button>
                     </div>
                  </div>
               </motion.div>
             )}
          </AnimatePresence>

          {/* Listings Grid.
              Two different empty states, because they are two different
              situations and telling them apart matters most right at the
              start. With nothing listed anywhere yet, "no rooms match your
              filters — try widening your price ceiling" blames the person
              for a choice they didn't make and sends them to fiddle with
              controls that cannot possibly help. */}
          {filteredListings.length === 0 ? (
            <div className="glass-panel">
              {allListings.length === 0 ? (
                <EmptyState
                  icon={Home}
                  title="No rooms listed yet"
                  subtitle={
                    currentUser?.role === 'landlord'
                      ? 'Nothing has been listed in your area yet. If you have a room, yours would be the first — list it and tenants searching here will find it.'
                      : 'Nothing has been listed in your area yet. This fills up as landlords nearby post rooms — check back, or tell a landlord you know about it.'
                  }
                  action={
                    currentUser?.role === 'landlord' && !isGuest ? (
                      <button onClick={() => setShowCreateModal(true)} className={goldButtonClass()}>
                        List your property
                      </button>
                    ) : undefined
                  }
                />
              ) : (
                <EmptyState icon={Home} title="No rooms match your filters" subtitle="Try widening your price ceiling or clearing a filter." />
              )}
            </div>
          ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
            {filteredListings.map((item) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="glass-panel overflow-hidden flex flex-col hover:border-accent/40 transition-all duration-500 group bg-surface-sunken/40"
              >
                <div className="relative h-56 bg-surface overflow-hidden">
                  {item.images[0] ? (
                    <img src={item.images[0]} alt={item.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 opacity-80 group-hover:opacity-100" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-surface-sunken to-surface">
                      <Home size={40} className="text-accent/20" />
                    </div>
                  )}
                  <div className="absolute inset-0 opacity-70" style={{ background: 'linear-gradient(to top, var(--scrim), transparent 60%)' }} />
                  <div className="absolute bottom-4 left-4 right-4 flex justify-between items-end">
                     <div className="flex items-center gap-1.5">
                        <div className="bg-surface-sunken/60 backdrop-blur-md border border-default px-3 py-1.5 rounded-xl">
                           <span className="text-xs font-black text-content tracking-tight uppercase">Verified</span>
                        </div>
                        {item.quickPost && (
                           <div className="bg-accent/90 backdrop-blur-md px-3 py-1.5 rounded-xl" title="Posted fast with minimal details — same listing, just quicker to put up.">
                              <span className="text-xs font-black text-content-on-accent tracking-tight uppercase">Quick Post</span>
                           </div>
                        )}
                        {item.listingType === 'guesthouse' && (
                           <div
                              className="bg-info/90 backdrop-blur-md px-3 py-1.5 rounded-xl"
                              title={item.visibleUntil ? `Listed through ${new Date(item.visibleUntil).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}` : 'Guest house'}
                           >
                              <span className="text-xs font-black text-content tracking-tight uppercase">Guest House</span>
                           </div>
                        )}
                     </div>
                     <div className="bg-accent text-content-on-accent px-4 py-2 rounded-xl shadow-xl">
                        <span className="text-lg font-black tracking-tighter">{formatCurrency(item.price, item.currency)}</span>
                        <span className="text-xs font-black ml-1 opacity-60">/ {item.listingType === 'guesthouse' ? 'NIGHT' : 'MO'}</span>
                     </div>
                  </div>
                </div>

                <div className="p-6 flex-1 flex flex-col gap-5">
                  <div className="space-y-1">
                     <div className="flex items-center gap-2">
                        <h3 className="text-xl font-black text-content tracking-tight leading-tight group-hover:text-accent transition-colors">{item.title}</h3>
                        {isFeatured(item) && (
                           <span className="bg-accent text-content-on-accent px-2 py-0.5 rounded-lg text-xs font-black uppercase tracking-widest shrink-0">Featured</span>
                        )}
                        {item.landlordId === currentUser?.id && item.propertyId && (() => {
                           const prop = myProperties.find(p => p.id === item.propertyId)
                           if (!prop) return null
                           const siblings = allListings
                              .filter(l => l.propertyId === item.propertyId)
                              .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''))
                           const ordinal = siblings.findIndex(l => l.id === item.id) + 1
                           return (
                              <span className="bg-surface-raised/5 border border-default text-content-muted px-2 py-0.5 rounded-lg text-xs font-black uppercase tracking-widest shrink-0">
                                 Room {ordinal} of {prop.total_rooms}
                              </span>
                           )
                        })()}
                     </div>
                     <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center text-xs text-content-muted font-black uppercase tracking-widest gap-2">
                           <MapPin size={12} className="text-accent" /> {item.suburb}, {item.location}
                        </div>
                        <OpenInMapsButton address={`${item.location}, ${item.suburb}`} lat={item.lat} lon={item.lon} label={item.title} />
                     </div>
                     {item.listingType === 'guesthouse' && item.eventId && gruvsEventInfo[item.eventId] && (
                        <div className="flex items-center gap-1.5 text-xs font-black text-info uppercase tracking-widest">
                           <Building2 size={11} /> Near {gruvsEventInfo[item.eventId].title}
                        </div>
                     )}
                  </div>

                  <p className="text-sm text-content-muted line-clamp-3 leading-relaxed opacity-80">{item.description}</p>

                  {/* Only shown for a room-inventory listing that's currently occupied —
                      a plain listing (no linked res_rooms row) or an already-vacant
                      room has nothing to notify about. */}
                  {roomOccupiedStatus[item.id] && item.landlordId !== currentUser?.id && !isGuest && (
                     <button
                        onClick={() => handleToggleWatch(item.id)}
                        disabled={watchBusyId === item.id}
                        className={`flex items-center justify-center gap-2 text-xs font-black uppercase tracking-widest py-2 rounded-xl border transition-colors disabled:opacity-50 ${
                           watchedListingIds.has(item.id)
                              ? 'bg-accent/10 border-accent/40 text-accent'
                              : 'bg-surface-raised/5 border-default text-content-muted hover:text-content hover:border-strong'
                        }`}
                     >
                        {watchedListingIds.has(item.id) ? (
                           <><BellOff size={12} /> Watching for vacancy — tap to cancel</>
                        ) : (
                           <><Bell size={12} /> Notify me when this room is vacant</>
                        )}
                     </button>
                  )}

                  <div className="flex items-center justify-between gap-2 -mt-1">
                     <button
                       onClick={() => setReviewsOpenFor(reviewsOpenFor === item.id ? null : item.id)}
                       className="text-xs text-content-muted font-bold hover:text-accent transition-colors text-left"
                     >
                        Posted by <span className="text-content">{item.landlordName || 'Landlord'}</span>
                     </button>
                     <div className="flex items-center gap-2">
                        <TrustBadge userId={item.landlordId} compact />
                        <FollowButton targetUserId={item.landlordId} currentUserId={currentUser?.id} />
                     </div>
                  </div>

                  <AnimatePresence>
                     {reviewsOpenFor === item.id && (
                        <motion.div
                           initial={{ height: 0, opacity: 0 }}
                           animate={{ height: 'auto', opacity: 1 }}
                           exit={{ height: 0, opacity: 0 }}
                           className="overflow-hidden space-y-3"
                        >
                           <ReviewsList userId={item.landlordId} />
                           {currentUser?.id && currentUser.id !== item.landlordId && (
                              <ReviewForm subjectId={item.landlordId} />
                           )}
                        </motion.div>
                     )}
                  </AnimatePresence>

                  <div className="flex flex-wrap gap-2 pt-2">
                    {item.amenities.wifi && <span className="text-xs font-black bg-surface-raised/5 border border-default px-2 py-1 rounded-lg text-content-muted flex items-center gap-1.5">WiFi</span>}
                    {item.amenities.parking && <span className="text-xs font-black bg-surface-raised/5 border border-default px-2 py-1 rounded-lg text-content-muted flex items-center gap-1.5">Parking</span>}
                    <span className="text-xs font-black bg-surface-raised/5 border border-default px-2 py-1 rounded-lg text-content-muted">Bath: {item.amenities.bathroom}</span>
                  </div>

                  <div className="mt-auto pt-6 border-t border-subtle space-y-2">
                     {item.landlordId === currentUser?.id ? (
                        <>
                          <UpgradeButton item="room_boost" targetId={item.id} className="w-full bg-accent/10 hover:bg-accent hover:text-content-on-accent border border-accent/30 text-accent font-black py-3 rounded-xl transition-all active:scale-95 text-xs uppercase tracking-widest" />
                          {confirmDeleteListingId === item.id ? (
                             <div className="flex items-center gap-2">
                                <button
                                   onClick={() => handleDeleteListing(item.id)}
                                   className="flex-1 bg-danger/10 hover:bg-danger hover:text-content border border-danger/30 text-danger font-black py-2.5 rounded-xl transition-all active:scale-95 text-xs uppercase tracking-widest"
                                >
                                   Confirm delete
                                </button>
                                <button
                                   onClick={() => setConfirmDeleteListingId(null)}
                                   className="px-4 bg-surface-raised/5 hover:bg-surface-raised/10 text-content-muted font-black py-2.5 rounded-xl transition-all active:scale-95 text-xs uppercase tracking-widest"
                                >
                                   Cancel
                                </button>
                             </div>
                          ) : (
                             <button
                                onClick={() => setConfirmDeleteListingId(item.id)}
                                className="w-full flex items-center justify-center gap-2 bg-transparent hover:bg-danger/5 border border-transparent hover:border-danger/20 text-content-subtle hover:text-danger font-bold py-2 rounded-xl transition-all text-xs uppercase tracking-widest"
                             >
                                <Trash2 size={12} /> Delete listing
                             </button>
                          )}
                        </>
                     ) : isGuest ? (
                        <Link
                           href="/auth"
                           className={goldButtonClass({ fullWidth: true })}
                        >
                           Sign up to request
                        </Link>
                     ) : (
                        <button
                           onClick={() => setActiveListing(item)}
                           className="w-full bg-accent hover:bg-accent text-content-on-accent font-black py-3 rounded-xl transition-all active:scale-95 text-xs uppercase tracking-widest"
                        >
                           Request Room
                        </button>
                     )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
           {filteredRoommates.map(rm => (
             <motion.div key={rm.id} whileHover={{ y: -5 }} className="glass-panel p-6 flex flex-col gap-6 bg-surface-sunken/40">
                <div className="flex justify-between items-start">
                   <div className="space-y-1">
                      <h3 className="text-xl font-black text-content tracking-tighter uppercase italic">{rm.name}</h3>
                      <div className="flex items-center text-xs text-content-subtle font-black uppercase tracking-widest gap-1.5">
                         <MapPin size={10} className="text-accent" /> {rm.suburb}
                      </div>
                   </div>
                   <div className="flex flex-col items-end gap-2">
                      <div className="bg-accent/10 border border-accent/20 text-accent px-3 py-1 rounded-xl text-sm font-black tracking-tighter">
                         {formatCurrency(rm.budget, rm.currency)}
                      </div>
                      <TrustBadge userId={rm.id} compact />
                      <FollowButton targetUserId={rm.id} currentUserId={currentUser?.id} />
                   </div>
                </div>
                <p className="text-sm text-content-muted italic leading-relaxed font-medium">&quot;{rm.bio}&quot;</p>
                <div className="grid grid-cols-2 gap-3">
                   <div className="bg-surface-raised/[0.02] border border-subtle rounded-xl p-2.5">
                      <span className="text-xs text-content-subtle font-black uppercase tracking-widest block">GENDER</span>
                      <span className="text-xs text-content font-black uppercase tracking-widest">{rm.gender}</span>
                   </div>
                   <div className="bg-surface-raised/[0.02] border border-subtle rounded-xl p-2.5">
                      <span className="text-xs text-content-subtle font-black uppercase tracking-widest block">DEPENDENTS</span>
                      <span className="text-xs text-content font-black uppercase tracking-widest">{rm.childrenCount}</span>
                   </div>
                </div>
                <Link
                  href={`/dashboard/messages?to=${rm.id}`}
                  className="w-full mt-4 bg-accent text-content-on-accent font-black py-3 rounded-xl transition-all text-xs uppercase tracking-widest active:scale-95 flex items-center justify-center"
                >
                   Invite to Share
                </Link>
             </motion.div>
           ))}
        </div>
      )}

      {/* CREATE LISTING MODAL */}
      <AnimatePresence>
         {showCreateModal && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
               <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowCreateModal(false)} className="absolute inset-0 bg-surface-sunken/90 backdrop-blur-md" />
               <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="glass-panel w-full max-w-3xl bg-surface border-accent/20 shadow-2xl relative z-10 overflow-hidden">
                  <div className="bg-accent/5 p-6 border-b border-subtle flex justify-between items-center">
                     <h3 className="text-xl font-black text-content italic uppercase tracking-tighter">List Your <span className="text-accent">Property</span></h3>
                     <button onClick={() => setShowCreateModal(false)} className="p-2 text-content-muted hover:text-content transition-colors"><X /></button>
                  </div>
                  <form onSubmit={handleCreateListing} className="p-6 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                           <label className="text-xs text-content-muted uppercase font-black tracking-widest">Listing Title</label>
                           <input value={newTitle} onChange={e => setNewTitle(e.target.value)} required className="w-full bg-surface border border-default rounded-xl p-3 text-sm text-content outline-none focus:border-accent/40" placeholder="e.g. Sunny en-suite near the station" />
                        </div>
                        <div className="space-y-2">
                           <label className="text-xs text-content-muted uppercase font-black tracking-widest">Monthly Rent</label>
                           <div className="flex gap-2">
                              <input type="number" value={newPrice} onChange={e => setNewPrice(Number(e.target.value))} required className="w-full bg-surface border border-default rounded-xl p-3 text-sm text-content outline-none focus:border-accent/40" />
                              <select value={newCurrency} onChange={e => setNewCurrency(e.target.value)} className="bg-surface border border-default rounded-xl p-3 text-sm text-content outline-none focus:border-accent/40">
                                 <option value="ZAR">ZAR</option>
                                 <option value="USD">USD</option>
                                 <option value="EUR">EUR</option>
                                 <option value="GBP">GBP</option>
                                 <option value="KES">KES</option>
                                 <option value="NGN">NGN</option>
                                 <option value="GHS">GHS</option>
                              </select>
                           </div>
                           {/* What rooms actually go for nearby, in the same currency — suppressed
                               below a usable sample rather than quoting a median of two. */}
                           {newListingPriceStats && (
                             <p className="text-xs text-content-muted mt-1.5">
                               Typical range in {newSuburb}: {formatCurrency(newListingPriceStats.low, newCurrency)}–{formatCurrency(newListingPriceStats.high, newCurrency)}
                               {' '}({newListingPriceStats.sample} listings)
                             </p>
                           )}
                           {newListingLooksSuspicious && (
                             <p className="text-xs text-danger mt-1.5 flex items-center gap-1">
                               <AlertTriangle size={11} /> That&apos;s far below the going rate nearby — tenants will see a caution flag on this listing.
                             </p>
                           )}
                        </div>
                     </div>
                     <div className="space-y-2">
                        <label className="text-xs text-content-muted uppercase font-black tracking-widest">Description</label>
                        <textarea value={newDesc} onChange={e => setNewDesc(e.target.value)} required className="w-full bg-surface border border-default rounded-xl p-3 text-sm text-content h-24 resize-none outline-none focus:border-accent/40" placeholder="Describe the room, building rules, and environment..." />
                     </div>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                           <label className="text-xs text-content-muted uppercase font-black tracking-widest">City / Location</label>
                           <input value={newLocation} onChange={e => setNewLocation(e.target.value)} required className="w-full bg-surface border border-default rounded-xl p-3 text-sm text-content outline-none focus:border-accent/40" placeholder="e.g. Berlin, Germany" />
                        </div>
                        <div className="space-y-2">
                           <label className="text-xs text-content-muted uppercase font-black tracking-widest">Suburb / Area</label>
                           <input value={newSuburb} onChange={e => setNewSuburb(e.target.value)} required className="w-full bg-surface border border-default rounded-xl p-3 text-sm text-content outline-none focus:border-accent/40" placeholder="e.g. Kreuzberg" />
                        </div>
                     </div>
                     <div className="space-y-2">
                        <label className="text-xs text-content-muted uppercase font-black tracking-widest">Listing Type</label>
                        <div className="flex bg-surface border border-default rounded-xl p-1 w-fit">
                           <button type="button" onClick={() => setNewListingType('rent')} className={`px-5 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${newListingType === 'rent' ? 'bg-accent text-content-on-accent' : 'text-content-muted'}`}>Rent</button>
                           <button type="button" onClick={() => setNewListingType('sale')} className={`px-5 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${newListingType === 'sale' ? 'bg-accent text-content-on-accent' : 'text-content-muted'}`}>Sell</button>
                           <button type="button" onClick={() => setNewListingType('guesthouse')} className={`px-5 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${newListingType === 'guesthouse' ? 'bg-accent text-content-on-accent' : 'text-content-muted'}`}>Guest House</button>
                        </div>
                        {newListingType === 'guesthouse' && (
                           <div className="space-y-2 pt-1">
                              <label className="text-xs text-content-muted uppercase font-black tracking-widest">Near Which Gruvs Event (optional)</label>
                              {upcomingGruvsEvents.length === 0 ? (
                                 <p className="text-xs text-content-muted bg-surface-sunken/40 border border-default rounded-xl p-3 leading-relaxed">No upcoming events found on The Gruvs — you can still list without one.</p>
                              ) : (
                                 <select value={newEventId} onChange={e => setNewEventId(e.target.value)} className="w-full bg-surface border border-default rounded-xl p-3 text-sm text-content outline-none focus:border-accent/40 cursor-pointer">
                                    <option value="">No specific event</option>
                                    {upcomingGruvsEvents.map(ev => (
                                       <option key={ev.id} value={ev.id}>{ev.title} — {formatGruvsEventWhen(ev.startsAt)}</option>
                                    ))}
                                 </select>
                              )}
                              <p className="text-xs text-content-muted leading-relaxed">
                                 Guest houses are seasonal — this listing automatically stops showing after {new Date(GUESTHOUSE_SEASON_END).toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}.
                              </p>
                           </div>
                        )}
                     </div>
                     {myProperties.length > 0 && (
                        <div className="space-y-2">
                           <label className="text-xs text-content-muted uppercase font-black tracking-widest">Which Property Is This Room In?</label>
                           <select value={newPropertyId} onChange={e => setNewPropertyId(e.target.value)} className="w-full bg-surface border border-default rounded-xl p-3 text-sm text-content outline-none focus:border-accent/40">
                              <option value="">No property — standalone listing</option>
                              {myProperties.map(p => (
                                 <option key={p.id} value={p.id}>{p.address}, {p.suburb}</option>
                              ))}
                           </select>
                        </div>
                     )}
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                           <label className="text-xs text-content-muted uppercase font-black tracking-widest">Bathroom Style</label>
                           <select value={newBathroom} onChange={e => setNewBathroom(e.target.value as 'shared' | 'private' | 'ensuite')} className="w-full bg-surface border border-default rounded-xl p-3 text-sm text-content outline-none focus:border-accent/40">
                              <option value="shared">Shared</option>
                              <option value="private">Private</option>
                              <option value="ensuite">En-suite</option>
                           </select>
                        </div>
                     </div>
                     <div className="space-y-2">
                        <label className="text-xs text-content-muted uppercase font-black tracking-widest">Photos</label>
                        <div className="flex flex-wrap gap-2">
                           {newPhotos.map((url, i) => (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img key={i} src={url} alt="" className="w-16 h-16 rounded-lg object-cover border border-default" />
                           ))}
                           <label className="w-16 h-16 rounded-lg border border-dashed border-strong flex items-center justify-center cursor-pointer text-content-muted hover:text-accent hover:border-accent/40 transition-colors">
                              {uploadingPhotos ? <Loader size={16} className="animate-spin" /> : <Camera size={16} />}
                              <input
                                 type="file"
                                 accept="image/*"
                                 multiple
                                 hidden
                                 disabled={uploadingPhotos || newPhotos.length >= MAX_LISTING_PHOTOS}
                                 onChange={e => handleListingPhotoSelect(e.target.files)}
                              />
                           </label>
                        </div>
                        <p className="text-xs text-content-subtle">Up to {MAX_LISTING_PHOTOS} photos of the actual room — a real photo does more for an application than any description.</p>
                     </div>
                     <div className="flex flex-wrap gap-6 bg-surface-raised/5 p-4 rounded-2xl border border-subtle">
                        <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-content-muted uppercase tracking-widest">
                           <input type="checkbox" checked={newWifi} onChange={e => setNewWifi(e.target.checked)} className="accent-gold-primary" /> WiFi Included
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-content-muted uppercase tracking-widest">
                           <input type="checkbox" checked={newParking} onChange={e => setNewParking(e.target.checked)} className="accent-gold-primary" /> Parking Available
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-content-muted uppercase tracking-widest">
                           <input type="checkbox" checked={newLivesHere} onChange={e => setNewLivesHere(e.target.checked)} className="accent-gold-primary" /> I Live On-Site
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-accent uppercase tracking-widest" title="Marks this as a fast, low-friction post — shows a Quick Post badge and can be filtered separately, but it's the same listing as any other.">
                           <input type="checkbox" checked={newQuickPost} onChange={e => setNewQuickPost(e.target.checked)} className="accent-gold-primary" /> Quick Post
                        </label>
                     </div>
                     {/* Who this room suits — feeds roommateCompatibility's hard filters directly.
                         Every listing silently shared the same defaults until this existed. */}
                     <div className="space-y-3 bg-surface-raised/5 p-4 rounded-2xl border border-subtle">
                        <label className="text-xs text-content-muted uppercase font-black tracking-widest">Who This Room Suits</label>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                           <div className="space-y-2">
                              <label className="text-xs text-content-subtle uppercase font-bold tracking-widest">Gender Preference</label>
                              <select value={newGenderPref} onChange={e => setNewGenderPref(e.target.value as 'men' | 'women' | 'couple' | 'any')} className="w-full bg-surface border border-default rounded-xl p-3 text-sm text-content outline-none focus:border-accent/40">
                                 <option value="any">No preference</option>
                                 <option value="men">Men only</option>
                                 <option value="women">Women only</option>
                                 <option value="couple">Couples welcome</option>
                              </select>
                           </div>
                           <div className="space-y-2">
                              <label className="text-xs text-content-subtle uppercase font-bold tracking-widest">Max Children</label>
                              <input
                                type="number" min={0} value={newMaxChildren}
                                onChange={e => setNewMaxChildren(Number(e.target.value))}
                                disabled={!newChildrenAllowed}
                                className="w-full bg-surface border border-default rounded-xl p-3 text-sm text-content outline-none focus:border-accent/40 disabled:opacity-40"
                              />
                           </div>
                        </div>
                        <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-content-muted uppercase tracking-widest">
                           <input type="checkbox" checked={newChildrenAllowed} onChange={e => setNewChildrenAllowed(e.target.checked)} className="accent-gold-primary" /> Children Allowed
                        </label>
                     </div>
                     <div className="pt-4 border-t border-subtle flex gap-4">
                        <button type="button" onClick={() => setShowCreateModal(false)} className="flex-1 bg-surface-raised/5 text-content font-black py-4 rounded-2xl uppercase tracking-widest text-xs">Cancel</button>
                        <button type="submit" className="flex-1 bg-accent text-content-on-accent font-black py-4 rounded-2xl uppercase tracking-widest text-xs shadow-xl shadow-gold-primary/20">Publish Listing</button>
                     </div>
                  </form>
               </motion.div>
            </div>
         )}
      </AnimatePresence>

      {/* APPLICATION MODAL */}
      <AnimatePresence>
         {activeListing && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
               <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setActiveListing(null)} className="absolute inset-0 bg-surface-sunken/90 backdrop-blur-md" />
               <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="glass-panel w-full max-w-xl bg-surface border-accent/20 shadow-2xl relative z-10 p-8 space-y-8">
                  <div className="flex justify-between items-center">
                     <div className="space-y-1">
                        <h3 className="text-xl font-black text-content italic uppercase tracking-tighter">Apply for <span className="text-accent">Room</span></h3>
                        <p className="text-xs text-content-muted font-black uppercase tracking-widest">{activeListing.title}</p>
                     </div>
                     <button onClick={() => setActiveListing(null)} className="text-content-muted hover:text-content"><X /></button>
                  </div>
                  <form onSubmit={handleApply} className="space-y-6">
                     <div className="space-y-2">
                        <label className="text-xs text-content-muted uppercase font-black tracking-widest">Message to Landlord</label>
                        <textarea value={applyMessage} onChange={e => setApplyMessage(e.target.value)} required className="w-full bg-surface border border-default rounded-xl p-4 text-sm text-content h-32 resize-none outline-none focus:border-accent/40" placeholder="Introduce yourself, mentioned your move-in date and any questions..." />
                     </div>
                     <button type="submit" className="w-full bg-accent hover:bg-accent text-content-on-accent font-black py-4 rounded-2xl uppercase tracking-widest text-xs shadow-xl flex items-center justify-center gap-2">
                        Send Request <Send size={14} />
                     </button>
                  </form>
               </motion.div>
            </div>
         )}
      </AnimatePresence>

      {/* LANDLORD AUDIT MODAL */}
      <AnimatePresence>
         {activeAuditRequest && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
               <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setActiveAuditRequest(null)} className="absolute inset-0 bg-surface-sunken/90 backdrop-blur-md" />
               <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="glass-panel w-full max-w-2xl bg-surface border-accent/20 shadow-2xl relative z-10 overflow-hidden">
                  <div className="bg-accent/5 p-6 border-b border-subtle flex justify-between items-center">
                     <h3 className="text-xl font-black text-content italic uppercase tracking-tighter">Tenant <span className="text-accent">Audit</span></h3>
                     <button onClick={() => setActiveAuditRequest(null)} className="text-content-muted hover:text-content"><X /></button>
                  </div>
                  <div className="p-8 space-y-8">
                     <div className="flex gap-6 items-start">
                        <div className="w-16 h-16 bg-surface-raised rounded-2xl flex items-center justify-center text-2xl font-black text-accent border border-subtle shadow-inner">{activeAuditRequest.tenantName.charAt(0)}</div>
                        <div className="space-y-1.5">
                           <h4 className="text-2xl font-black text-content">{activeAuditRequest.tenantName}</h4>
                           <p className="text-xs text-content-muted font-bold uppercase tracking-widest">Applicant for: {activeAuditRequest.listingTitle}</p>
                           <div className="flex items-center gap-2 pt-1 flex-wrap">
                              <TrustBadge userId={activeAuditRequest.tenantId} />
                              <NextOfKinFlag userId={activeAuditRequest.tenantId} />
                              {activeAuditRequest.status !== 'pending' && requestStatusBadge(activeAuditRequest.status)}
                           </div>
                        </div>
                     </div>
                     <div className="bg-surface-sunken/40 border border-subtle rounded-2xl p-4 italic text-sm text-content-muted leading-relaxed font-medium">&quot;{activeAuditRequest.message}&quot;</div>

                     <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <button
                          onClick={() => runAuditAction('approved')}
                          disabled={!!auditActionLoading}
                          className="bg-success/10 hover:bg-success text-success hover:text-content border border-success/20 font-black py-4 rounded-2xl uppercase tracking-widest text-xs transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                           <Check size={16} /> Approve
                        </button>
                        <button
                          onClick={() => runAuditAction('rejected')}
                          disabled={!!auditActionLoading}
                          className="bg-danger/10 hover:bg-danger text-danger hover:text-content border border-danger/20 font-black py-4 rounded-2xl uppercase tracking-widest text-xs transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                           <X size={16} /> Reject
                        </button>
                        <button
                          onClick={() => runAuditAction('waitlisted')}
                          disabled={!!auditActionLoading}
                          className="bg-info/10 hover:bg-info text-info hover:text-content border border-info/20 font-black py-4 rounded-2xl uppercase tracking-widest text-xs transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                           Waitlist
                        </button>
                        <button
                          onClick={() => runAuditAction('saved')}
                          disabled={!!auditActionLoading}
                          className="bg-info/10 hover:bg-info text-info hover:text-content border border-info/20 font-black py-4 rounded-2xl uppercase tracking-widest text-xs transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                           Save for Later
                        </button>
                     </div>

                     {activeAuditRequest.status === 'approved' && (
                        <div className="space-y-4 pt-4 border-t border-subtle">
                           <h5 className="text-xs text-content-muted uppercase font-black tracking-widest">Review This Tenant</h5>
                           <ReviewForm subjectId={activeAuditRequest.tenantId} />
                           <ReviewsList userId={activeAuditRequest.tenantId} />
                        </div>
                     )}
                  </div>
               </motion.div>
            </div>
         )}
      </AnimatePresence>

      {/* GLOBAL TOAST */}
      <AnimatePresence>
         {alertNotification && (
            <motion.div
               initial={{ y: 100, opacity: 0 }}
               animate={{ y: 0, opacity: 1 }}
               exit={{ y: 100, opacity: 0 }}
               className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[300] bg-surface border border-accent px-8 py-4 rounded-2xl shadow-2xl flex items-center gap-4 min-w-[320px]"
            >
               <div className="p-2 bg-success/20 rounded-full text-success shadow-[0_0_15px_rgba(34,197,94,0.3)]"><ShieldCheck size={24} /></div>
               <div className="space-y-0.5">
                  <p className="text-xs font-black text-content-subtle uppercase tracking-[0.2em]">Success</p>
                  <p className="text-sm font-black text-content italic tracking-tight uppercase">{alertNotification}</p>
               </div>
               <button onClick={() => setAlertNotification(null)} className="ml-auto text-content-subtle hover:text-content transition-colors"><X size={16} /></button>
            </motion.div>
         )}
      </AnimatePresence>
    </div>
  )
}
