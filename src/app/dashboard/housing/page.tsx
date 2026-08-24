'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, MapPin, Home, Loader, Filter, X, Plus, Info, AlertTriangle, Check, Send, ShieldCheck, Building2, Trash2
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
      images: ['https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?auto=format&fit=crop&w=600&q=80'],
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
      tenantName: currentUser?.name || '',
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
      pending: 'bg-gold-primary/10 text-gold-primary border-gold-primary/20',
      waitlisted: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
      saved: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
      approved: 'bg-green-500/10 text-green-400 border-green-500/20',
      rejected: 'bg-red-500/10 text-red-400 border-red-500/20'
    }
    return (
      <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border ${styles[status] || styles.pending}`}>
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
        <div className="flex bg-black/40 p-1.5 rounded-2xl border border-white/5 shadow-2xl backdrop-blur-xl w-full md:w-auto">
          <button
            onClick={() => setActiveTab('rooms')}
            className={`flex-1 md:flex-none px-6 py-2.5 rounded-xl transition-all text-xs font-black uppercase tracking-widest ${activeTab === 'rooms' ? 'bg-gold-primary text-black shadow-lg shadow-gold-primary/20' : 'text-gray-500 hover:text-white'}`}
          >
            Rooms
          </button>
          <button
            onClick={() => setActiveTab('roommates')}
            className={`flex-1 md:flex-none px-6 py-2.5 rounded-xl transition-all text-xs font-black uppercase tracking-widest ${activeTab === 'roommates' ? 'bg-gold-primary text-black shadow-lg shadow-gold-primary/20' : 'text-gray-500 hover:text-white'}`}
          >
            Roommates
          </button>
          {currentUser?.role === 'landlord' && (
            <button
              onClick={() => setActiveTab('properties')}
              className={`flex-1 md:flex-none px-6 py-2.5 rounded-xl transition-all text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 ${activeTab === 'properties' ? 'bg-gold-primary text-black shadow-lg shadow-gold-primary/20' : 'text-gray-500 hover:text-white'}`}
            >
              <Building2 size={14} /> My Properties
            </button>
          )}
        </div>
      </header>

      {activeTab === 'rooms' && (
        <div className="flex bg-black/20 p-1 rounded-xl border border-white/5 w-full sm:w-fit">
          <button
            onClick={() => setFilterListingType('rent')}
            className={`flex-1 sm:flex-none px-5 py-2 rounded-lg transition-all text-xs font-black uppercase tracking-widest ${filterListingType === 'rent' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-white'}`}
          >
            Rent
          </button>
          <button
            onClick={() => setFilterListingType('sale')}
            className={`flex-1 sm:flex-none px-5 py-2 rounded-lg transition-all text-xs font-black uppercase tracking-widest ${filterListingType === 'sale' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-white'}`}
          >
            Buy
          </button>
          <button
            onClick={() => setFilterListingType('guesthouse')}
            title="Short-stay guest houses, listed only through the current event season"
            className={`flex-1 sm:flex-none px-5 py-2 rounded-lg transition-all text-xs font-black uppercase tracking-widest ${filterListingType === 'guesthouse' ? 'bg-gold-primary text-black' : 'text-gray-500 hover:text-white'}`}
          >
            Guest Houses
          </button>
        </div>
      )}

      {/* Landlord Notifications for Applications */}
      {currentUser?.role === 'landlord' && landlordTrackedRequests.length > 0 && (
         <div className="glass-panel p-6 border-gold-primary/30 bg-gold-primary/5 flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-4 text-gold-primary">
               <Info size={24} />
               <div>
                  <p className="font-black text-sm uppercase tracking-widest">Action Required</p>
                  <p className="text-xs text-white">You have <strong>{landlordRequests.length}</strong> pending room applications awaiting your audit.</p>
               </div>
            </div>
            <div className="flex flex-wrap gap-2 justify-end">
               {landlordTrackedRequests.map(req => (
                  <button
                    key={req.id}
                    onClick={() => setActiveAuditRequest(req)}
                    className="bg-gold-primary text-black px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-gold-secondary transition-all flex items-center gap-2"
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
             <div className="flex-1 glass-panel p-2 flex items-center gap-2 bg-black/60 shadow-inner relative">
                <div className="flex-1 flex items-center bg-black/40 rounded-xl px-4 py-1.5 border border-white/5 focus-within:border-gold-primary/40 transition-colors">
                   <Search size={18} className="text-gray-600" />
                   <input
                      type="text"
                      value={searchInputValue}
                      onChange={(e) => { setSearchInputValue(e.target.value); setShowSuburbSuggestions(true) }}
                      onFocus={() => setShowSuburbSuggestions(true)}
                      onBlur={() => setTimeout(() => setShowSuburbSuggestions(false), 150)}
                      placeholder="Enter Suburb, City or Complex..."
                      className="bg-transparent border-none text-white px-3 py-2 w-full outline-none text-sm font-bold placeholder:text-gray-700 placeholder:uppercase placeholder:tracking-widest"
                      autoComplete="off"
                   />
                   <button
                      onClick={() => handleGetLiveLocation(setSearchInputValue)}
                      className={`p-2 transition-all rounded-lg ${locationLoading ? 'text-gold-primary' : 'text-gray-600 hover:text-gold-primary hover:bg-gold-primary/10'}`}
                   >
                      {locationLoading ? <Loader size={18} className="animate-spin" /> : <MapPin size={18} />}
                   </button>
                </div>

                {/* Suggests suburbs that actually HAVE listings, with a live
                    count, instead of a free-text field where a typo just
                    silently returns nothing. Sourced from allListings — real
                    data, zero extra network calls. */}
                {showSuburbSuggestions && suburbSuggestions.length > 0 && (
                   <div className="absolute top-full left-0 right-24 mt-1 z-20 bg-black border border-white/10 rounded-xl shadow-2xl overflow-hidden">
                      {suburbSuggestions.map(s => (
                         <button
                            key={s.suburb}
                            type="button"
                            onMouseDown={() => { setSearchInputValue(s.suburb); setShowSuburbSuggestions(false) }}
                            className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-gray-200 hover:bg-gold-primary/10 hover:text-gold-primary transition-colors text-left"
                         >
                            <span className="flex items-center gap-2"><MapPin size={13} className="text-gray-600" /> {s.suburb}</span>
                            <span className="text-[10px] text-gray-500 font-bold">{s.count} room{s.count === 1 ? '' : 's'}</span>
                         </button>
                      ))}
                   </div>
                )}

                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`p-3 rounded-xl border transition-all ${showFilters ? 'bg-gold-primary border-gold-primary text-black' : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'}`}
                >
                  <Filter size={18} />
                </button>

                <SavedSearches currentFilters={currentSearchFilters} onApply={applySavedSearch} />
             </div>

             {currentUser?.role === 'landlord' ? (
                <button
                   onClick={() => setShowCreateModal(true)}
                   className="bg-gold-primary hover:bg-gold-secondary text-black font-black px-8 py-4 rounded-2xl flex items-center justify-center gap-3 transition-all active:scale-95 shadow-xl shadow-gold-primary/10 uppercase tracking-widest text-xs"
                >
                   <Plus size={20} /> List Your Property
                </button>
             ) : (
                <Link
                   href="/dashboard/profile"
                   className="bg-white/5 hover:bg-gold-primary/10 border border-white/10 hover:border-gold-primary/30 text-gray-300 hover:text-gold-primary font-bold px-4 py-4 rounded-2xl flex items-center justify-center gap-2 transition-all text-xs shrink-0"
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
                  <div className="glass-panel p-8 bg-black/40 border-gold-primary/10 grid grid-cols-1 md:grid-cols-3 gap-10">
                     <div className="space-y-4">
                        <div className="flex justify-between items-end gap-2">
                           <label className="text-[10px] uppercase font-black tracking-[0.2em] text-gray-500">Price Ceiling</label>
                           <input
                              type="number" min={0} step={250}
                              placeholder="Any"
                              value={filterPrice === 0 ? '' : filterPrice}
                              onChange={(e) => {
                                 const raw = e.target.value
                                 if (raw === '') { setFilterPrice(0); return }
                                 setFilterPrice(Math.max(0, Number(raw)))
                              }}
                              className="w-24 bg-black border border-white/10 rounded-lg px-2 py-1 text-right text-gold-primary font-black text-sm outline-none focus:border-gold-primary/50"
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
                           className="w-full h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-gold-primary"
                        />
                        <p className="text-[10px] text-gray-500">
                           {filterPrice === 0
                              ? 'Showing every room. Drag left to set a budget.'
                              : `Hiding rooms above ${formatCurrency(filterPrice)}.`}
                        </p>
                     </div>

                     <div className="space-y-4">
                        <label className="text-[10px] uppercase font-black tracking-[0.2em] text-gray-500 block mb-6">Preferred Amenities</label>
                        <div className="flex flex-wrap gap-4">
                           <label className="flex items-center gap-3 cursor-pointer group">
                              <div className={`w-10 h-6 rounded-full p-1 transition-all border ${filterWifi ? 'bg-gold-primary border-gold-primary' : 'bg-white/5 border-white/10'}`}>
                                 <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${filterWifi ? 'translate-x-4' : 'translate-x-0'}`} />
                              </div>
                              <input type="checkbox" className="hidden" checked={filterWifi} onChange={e => setFilterWifi(e.target.checked)} />
                              <span className={`text-xs font-bold uppercase tracking-widest transition-colors ${filterWifi ? 'text-white' : 'text-gray-600'}`}>WiFi</span>
                           </label>

                           <label className="flex items-center gap-3 cursor-pointer group">
                              <div className={`w-10 h-6 rounded-full p-1 transition-all border ${filterQuickPostOnly ? 'bg-gold-primary border-gold-primary' : 'bg-white/5 border-white/10'}`}>
                                 <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${filterQuickPostOnly ? 'translate-x-4' : 'translate-x-0'}`} />
                              </div>
                              <input type="checkbox" className="hidden" checked={filterQuickPostOnly} onChange={e => setFilterQuickPostOnly(e.target.checked)} />
                              <span className={`text-xs font-bold uppercase tracking-widest transition-colors ${filterQuickPostOnly ? 'text-white' : 'text-gray-600'}`}>Quick Posts Only</span>
                           </label>

                           <label className="flex items-center gap-3 cursor-pointer group">
                              <div className={`w-10 h-6 rounded-full p-1 transition-all border ${filterParking ? 'bg-gold-primary border-gold-primary' : 'bg-white/5 border-white/10'}`}>
                                 <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${filterParking ? 'translate-x-4' : 'translate-x-0'}`} />
                              </div>
                              <input type="checkbox" className="hidden" checked={filterParking} onChange={e => setFilterParking(e.target.checked)} />
                              <span className={`text-xs font-bold uppercase tracking-widest transition-colors ${filterParking ? 'text-white' : 'text-gray-600'}`}>Parking</span>
                           </label>
                        </div>
                     </div>

                     <div className="flex items-center justify-end">
                        <button
                           onClick={() => {
                              setFilterPrice(0); setFilterWifi(false); setFilterParking(false); setSearchInputValue('');
                           }}
                           className="text-[10px] font-black uppercase tracking-[0.3em] text-red-500/50 hover:text-red-500 transition-colors"
                        >
                           Reset All Filters
                        </button>
                     </div>
                  </div>
               </motion.div>
             )}
          </AnimatePresence>

          {/* Listings Grid — previously if filters excluded everything this
              area just rendered a blank grid with no explanation, reading as
              a broken page rather than "your filters are too narrow". */}
          {filteredListings.length === 0 ? (
            <div className="glass-panel">
              <EmptyState icon={Home} title="No rooms match your filters" subtitle="Try widening your price ceiling or clearing a filter." />
            </div>
          ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
            {filteredListings.map((item) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="glass-panel overflow-hidden flex flex-col hover:border-gold-primary/40 transition-all duration-500 group bg-black/40"
              >
                <div className="relative h-56 bg-gray-900 overflow-hidden">
                  {item.images[0] ? (
                    <img src={item.images[0]} alt={item.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 opacity-80 group-hover:opacity-100" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-900 to-black">
                      <Home size={40} className="text-gold-primary/20" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-60" />
                  <div className="absolute bottom-4 left-4 right-4 flex justify-between items-end">
                     <div className="flex items-center gap-1.5">
                        <div className="bg-black/60 backdrop-blur-md border border-white/10 px-3 py-1.5 rounded-xl">
                           <span className="text-xs font-black text-white tracking-tight uppercase">Verified</span>
                        </div>
                        {item.quickPost && (
                           <div className="bg-gold-primary/90 backdrop-blur-md px-3 py-1.5 rounded-xl" title="Posted fast with minimal details — same listing, just quicker to put up.">
                              <span className="text-xs font-black text-black tracking-tight uppercase">Quick Post</span>
                           </div>
                        )}
                        {item.listingType === 'guesthouse' && (
                           <div
                              className="bg-purple-500/90 backdrop-blur-md px-3 py-1.5 rounded-xl"
                              title={item.visibleUntil ? `Listed through ${new Date(item.visibleUntil).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}` : 'Guest house'}
                           >
                              <span className="text-xs font-black text-white tracking-tight uppercase">Guest House</span>
                           </div>
                        )}
                     </div>
                     <div className="bg-gold-primary text-black px-4 py-2 rounded-xl shadow-xl">
                        <span className="text-lg font-black tracking-tighter">{formatCurrency(item.price, item.currency)}</span>
                        <span className="text-[10px] font-black ml-1 opacity-60">/ {item.listingType === 'guesthouse' ? 'NIGHT' : 'MO'}</span>
                     </div>
                  </div>
                </div>

                <div className="p-6 flex-1 flex flex-col gap-5">
                  <div className="space-y-1">
                     <div className="flex items-center gap-2">
                        <h3 className="text-xl font-black text-white tracking-tight leading-tight group-hover:text-gold-primary transition-colors">{item.title}</h3>
                        {isFeatured(item) && (
                           <span className="bg-gold-primary text-black px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest shrink-0">Featured</span>
                        )}
                        {item.landlordId === currentUser?.id && item.propertyId && (() => {
                           const prop = myProperties.find(p => p.id === item.propertyId)
                           if (!prop) return null
                           const siblings = allListings
                              .filter(l => l.propertyId === item.propertyId)
                              .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''))
                           const ordinal = siblings.findIndex(l => l.id === item.id) + 1
                           return (
                              <span className="bg-white/5 border border-white/10 text-gray-400 px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest shrink-0">
                                 Room {ordinal} of {prop.total_rooms}
                              </span>
                           )
                        })()}
                     </div>
                     <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center text-[10px] text-gray-500 font-black uppercase tracking-widest gap-2">
                           <MapPin size={12} className="text-gold-primary" /> {item.suburb}, {item.location}
                        </div>
                        <OpenInMapsButton address={`${item.location}, ${item.suburb}`} />
                     </div>
                     {item.listingType === 'guesthouse' && item.eventId && gruvsEventInfo[item.eventId] && (
                        <div className="flex items-center gap-1.5 text-[10px] font-black text-purple-400 uppercase tracking-widest">
                           <Building2 size={11} /> Near {gruvsEventInfo[item.eventId].title}
                        </div>
                     )}
                  </div>

                  <p className="text-sm text-gray-400 line-clamp-3 leading-relaxed opacity-80">{item.description}</p>

                  <div className="flex items-center justify-between gap-2 -mt-1">
                     <button
                       onClick={() => setReviewsOpenFor(reviewsOpenFor === item.id ? null : item.id)}
                       className="text-[10px] text-gray-500 font-bold hover:text-gold-primary transition-colors text-left"
                     >
                        Posted by <span className="text-gray-300">{item.landlordName || 'Landlord'}</span>
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
                    {item.amenities.wifi && <span className="text-[9px] font-black bg-white/5 border border-white/10 px-2 py-1 rounded-lg text-gray-400 flex items-center gap-1.5">WiFi</span>}
                    {item.amenities.parking && <span className="text-[9px] font-black bg-white/5 border border-white/10 px-2 py-1 rounded-lg text-gray-400 flex items-center gap-1.5">Parking</span>}
                    <span className="text-[9px] font-black bg-white/5 border border-white/10 px-2 py-1 rounded-lg text-gray-400">Bath: {item.amenities.bathroom}</span>
                  </div>

                  <div className="mt-auto pt-6 border-t border-white/5 space-y-2">
                     {item.landlordId === currentUser?.id ? (
                        <>
                          <UpgradeButton item="room_boost" targetId={item.id} className="w-full bg-gold-primary/10 hover:bg-gold-primary hover:text-black border border-gold-primary/30 text-gold-primary font-black py-3 rounded-xl transition-all active:scale-95 text-xs uppercase tracking-widest" />
                          {confirmDeleteListingId === item.id ? (
                             <div className="flex items-center gap-2">
                                <button
                                   onClick={() => handleDeleteListing(item.id)}
                                   className="flex-1 bg-red-500/10 hover:bg-red-500 hover:text-white border border-red-500/30 text-red-400 font-black py-2.5 rounded-xl transition-all active:scale-95 text-[11px] uppercase tracking-widest"
                                >
                                   Confirm delete
                                </button>
                                <button
                                   onClick={() => setConfirmDeleteListingId(null)}
                                   className="px-4 bg-white/5 hover:bg-white/10 text-gray-400 font-black py-2.5 rounded-xl transition-all active:scale-95 text-[11px] uppercase tracking-widest"
                                >
                                   Cancel
                                </button>
                             </div>
                          ) : (
                             <button
                                onClick={() => setConfirmDeleteListingId(item.id)}
                                className="w-full flex items-center justify-center gap-2 bg-transparent hover:bg-red-500/5 border border-transparent hover:border-red-500/20 text-gray-600 hover:text-red-400 font-bold py-2 rounded-xl transition-all text-[10px] uppercase tracking-widest"
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
                           className="w-full bg-gold-primary hover:bg-gold-secondary text-black font-black py-3 rounded-xl transition-all active:scale-95 text-xs uppercase tracking-widest"
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
             <motion.div key={rm.id} whileHover={{ y: -5 }} className="glass-panel p-6 flex flex-col gap-6 bg-black/40">
                <div className="flex justify-between items-start">
                   <div className="space-y-1">
                      <h3 className="text-xl font-black text-white tracking-tighter uppercase italic">{rm.name}</h3>
                      <div className="flex items-center text-[9px] text-gray-600 font-black uppercase tracking-widest gap-1.5">
                         <MapPin size={10} className="text-gold-primary" /> {rm.suburb}
                      </div>
                   </div>
                   <div className="flex flex-col items-end gap-2">
                      <div className="bg-gold-primary/10 border border-gold-primary/20 text-gold-primary px-3 py-1 rounded-xl text-sm font-black tracking-tighter">
                         {formatCurrency(rm.budget, rm.currency)}
                      </div>
                      <TrustBadge userId={rm.id} compact />
                      <FollowButton targetUserId={rm.id} currentUserId={currentUser?.id} />
                   </div>
                </div>
                <p className="text-sm text-gray-400 italic leading-relaxed font-medium">&quot;{rm.bio}&quot;</p>
                <div className="grid grid-cols-2 gap-3">
                   <div className="bg-white/2 border border-white/5 rounded-xl p-2.5">
                      <span className="text-[8px] text-gray-600 font-black uppercase tracking-widest block">GENDER</span>
                      <span className="text-[10px] text-gray-300 font-black uppercase tracking-widest">{rm.gender}</span>
                   </div>
                   <div className="bg-white/2 border border-white/5 rounded-xl p-2.5">
                      <span className="text-[8px] text-gray-600 font-black uppercase tracking-widest block">DEPENDENTS</span>
                      <span className="text-[10px] text-gray-300 font-black uppercase tracking-widest">{rm.childrenCount}</span>
                   </div>
                </div>
                <Link
                  href={`/dashboard/messages?to=${rm.id}`}
                  className="w-full mt-4 bg-gold-primary text-black font-black py-3 rounded-xl transition-all text-xs uppercase tracking-widest active:scale-95 flex items-center justify-center"
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
               <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowCreateModal(false)} className="absolute inset-0 bg-black/90 backdrop-blur-md" />
               <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="glass-panel w-full max-w-3xl bg-black border-gold-primary/20 shadow-2xl relative z-10 overflow-hidden">
                  <div className="bg-gold-primary/5 p-6 border-b border-white/5 flex justify-between items-center">
                     <h3 className="text-xl font-black text-white italic uppercase tracking-tighter">List Your <span className="text-gold-primary">Property</span></h3>
                     <button onClick={() => setShowCreateModal(false)} className="p-2 text-gray-500 hover:text-white transition-colors"><X /></button>
                  </div>
                  <form onSubmit={handleCreateListing} className="p-6 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                           <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Listing Title</label>
                           <input value={newTitle} onChange={e => setNewTitle(e.target.value)} required className="w-full bg-black border border-white/10 rounded-xl p-3 text-sm text-white outline-none focus:border-gold-primary/40" placeholder="e.g. Sunny en-suite near the station" />
                        </div>
                        <div className="space-y-2">
                           <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Monthly Rent</label>
                           <div className="flex gap-2">
                              <input type="number" value={newPrice} onChange={e => setNewPrice(Number(e.target.value))} required className="w-full bg-black border border-white/10 rounded-xl p-3 text-sm text-white outline-none focus:border-gold-primary/40" />
                              <select value={newCurrency} onChange={e => setNewCurrency(e.target.value)} className="bg-black border border-white/10 rounded-xl p-3 text-sm text-white outline-none focus:border-gold-primary/40">
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
                             <p className="text-[10px] text-gray-500 mt-1.5">
                               Typical range in {newSuburb}: {formatCurrency(newListingPriceStats.low, newCurrency)}–{formatCurrency(newListingPriceStats.high, newCurrency)}
                               {' '}({newListingPriceStats.sample} listings)
                             </p>
                           )}
                           {newListingLooksSuspicious && (
                             <p className="text-[10px] text-red-400 mt-1.5 flex items-center gap-1">
                               <AlertTriangle size={11} /> That&apos;s far below the going rate nearby — tenants will see a caution flag on this listing.
                             </p>
                           )}
                        </div>
                     </div>
                     <div className="space-y-2">
                        <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Description</label>
                        <textarea value={newDesc} onChange={e => setNewDesc(e.target.value)} required className="w-full bg-black border border-white/10 rounded-xl p-3 text-sm text-white h-24 resize-none outline-none focus:border-gold-primary/40" placeholder="Describe the room, building rules, and environment..." />
                     </div>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                           <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest">City / Location</label>
                           <input value={newLocation} onChange={e => setNewLocation(e.target.value)} required className="w-full bg-black border border-white/10 rounded-xl p-3 text-sm text-white outline-none focus:border-gold-primary/40" placeholder="e.g. Berlin, Germany" />
                        </div>
                        <div className="space-y-2">
                           <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Suburb / Area</label>
                           <input value={newSuburb} onChange={e => setNewSuburb(e.target.value)} required className="w-full bg-black border border-white/10 rounded-xl p-3 text-sm text-white outline-none focus:border-gold-primary/40" placeholder="e.g. Kreuzberg" />
                        </div>
                     </div>
                     <div className="space-y-2">
                        <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Listing Type</label>
                        <div className="flex bg-black border border-white/10 rounded-xl p-1 w-fit">
                           <button type="button" onClick={() => setNewListingType('rent')} className={`px-5 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${newListingType === 'rent' ? 'bg-gold-primary text-black' : 'text-gray-500'}`}>Rent</button>
                           <button type="button" onClick={() => setNewListingType('sale')} className={`px-5 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${newListingType === 'sale' ? 'bg-gold-primary text-black' : 'text-gray-500'}`}>Sell</button>
                           <button type="button" onClick={() => setNewListingType('guesthouse')} className={`px-5 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${newListingType === 'guesthouse' ? 'bg-gold-primary text-black' : 'text-gray-500'}`}>Guest House</button>
                        </div>
                        {newListingType === 'guesthouse' && (
                           <div className="space-y-2 pt-1">
                              <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Near Which Gruvs Event (optional)</label>
                              {upcomingGruvsEvents.length === 0 ? (
                                 <p className="text-[11px] text-gray-500 bg-black/40 border border-white/10 rounded-xl p-3 leading-relaxed">No upcoming events found on The Gruvs — you can still list without one.</p>
                              ) : (
                                 <select value={newEventId} onChange={e => setNewEventId(e.target.value)} className="w-full bg-black border border-white/10 rounded-xl p-3 text-sm text-white outline-none focus:border-gold-primary/40 cursor-pointer">
                                    <option value="">No specific event</option>
                                    {upcomingGruvsEvents.map(ev => (
                                       <option key={ev.id} value={ev.id}>{ev.title} — {formatGruvsEventWhen(ev.startsAt)}</option>
                                    ))}
                                 </select>
                              )}
                              <p className="text-[10px] text-gray-500 leading-relaxed">
                                 Guest houses are seasonal — this listing automatically stops showing after {new Date(GUESTHOUSE_SEASON_END).toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}.
                              </p>
                           </div>
                        )}
                     </div>
                     {myProperties.length > 0 && (
                        <div className="space-y-2">
                           <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Which Property Is This Room In?</label>
                           <select value={newPropertyId} onChange={e => setNewPropertyId(e.target.value)} className="w-full bg-black border border-white/10 rounded-xl p-3 text-sm text-white outline-none focus:border-gold-primary/40">
                              <option value="">No property — standalone listing</option>
                              {myProperties.map(p => (
                                 <option key={p.id} value={p.id}>{p.address}, {p.suburb}</option>
                              ))}
                           </select>
                        </div>
                     )}
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                           <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Bathroom Style</label>
                           <select value={newBathroom} onChange={e => setNewBathroom(e.target.value as 'shared' | 'private' | 'ensuite')} className="w-full bg-black border border-white/10 rounded-xl p-3 text-sm text-white outline-none focus:border-gold-primary/40">
                              <option value="shared">Shared</option>
                              <option value="private">Private</option>
                              <option value="ensuite">En-suite</option>
                           </select>
                        </div>
                     </div>
                     <div className="flex flex-wrap gap-6 bg-white/5 p-4 rounded-2xl border border-white/5">
                        <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-gray-400 uppercase tracking-widest">
                           <input type="checkbox" checked={newWifi} onChange={e => setNewWifi(e.target.checked)} className="accent-gold-primary" /> WiFi Included
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-gray-400 uppercase tracking-widest">
                           <input type="checkbox" checked={newParking} onChange={e => setNewParking(e.target.checked)} className="accent-gold-primary" /> Parking Available
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-gray-400 uppercase tracking-widest">
                           <input type="checkbox" checked={newLivesHere} onChange={e => setNewLivesHere(e.target.checked)} className="accent-gold-primary" /> I Live On-Site
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-gold-primary uppercase tracking-widest" title="Marks this as a fast, low-friction post — shows a Quick Post badge and can be filtered separately, but it's the same listing as any other.">
                           <input type="checkbox" checked={newQuickPost} onChange={e => setNewQuickPost(e.target.checked)} className="accent-gold-primary" /> Quick Post
                        </label>
                     </div>
                     {/* Who this room suits — feeds roommateCompatibility's hard filters directly.
                         Every listing silently shared the same defaults until this existed. */}
                     <div className="space-y-3 bg-white/5 p-4 rounded-2xl border border-white/5">
                        <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Who This Room Suits</label>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                           <div className="space-y-2">
                              <label className="text-[10px] text-gray-600 uppercase font-bold tracking-widest">Gender Preference</label>
                              <select value={newGenderPref} onChange={e => setNewGenderPref(e.target.value as 'men' | 'women' | 'couple' | 'any')} className="w-full bg-black border border-white/10 rounded-xl p-3 text-sm text-white outline-none focus:border-gold-primary/40">
                                 <option value="any">No preference</option>
                                 <option value="men">Men only</option>
                                 <option value="women">Women only</option>
                                 <option value="couple">Couples welcome</option>
                              </select>
                           </div>
                           <div className="space-y-2">
                              <label className="text-[10px] text-gray-600 uppercase font-bold tracking-widest">Max Children</label>
                              <input
                                type="number" min={0} value={newMaxChildren}
                                onChange={e => setNewMaxChildren(Number(e.target.value))}
                                disabled={!newChildrenAllowed}
                                className="w-full bg-black border border-white/10 rounded-xl p-3 text-sm text-white outline-none focus:border-gold-primary/40 disabled:opacity-40"
                              />
                           </div>
                        </div>
                        <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-gray-400 uppercase tracking-widest">
                           <input type="checkbox" checked={newChildrenAllowed} onChange={e => setNewChildrenAllowed(e.target.checked)} className="accent-gold-primary" /> Children Allowed
                        </label>
                     </div>
                     <div className="pt-4 border-t border-white/5 flex gap-4">
                        <button type="button" onClick={() => setShowCreateModal(false)} className="flex-1 bg-white/5 text-white font-black py-4 rounded-2xl uppercase tracking-widest text-xs">Cancel</button>
                        <button type="submit" className="flex-1 bg-gold-primary text-black font-black py-4 rounded-2xl uppercase tracking-widest text-xs shadow-xl shadow-gold-primary/20">Publish Listing</button>
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
               <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setActiveListing(null)} className="absolute inset-0 bg-black/90 backdrop-blur-md" />
               <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="glass-panel w-full max-w-xl bg-black border-gold-primary/20 shadow-2xl relative z-10 p-8 space-y-8">
                  <div className="flex justify-between items-center">
                     <div className="space-y-1">
                        <h3 className="text-xl font-black text-white italic uppercase tracking-tighter">Apply for <span className="text-gold-primary">Room</span></h3>
                        <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest">{activeListing.title}</p>
                     </div>
                     <button onClick={() => setActiveListing(null)} className="text-gray-500 hover:text-white"><X /></button>
                  </div>
                  <form onSubmit={handleApply} className="space-y-6">
                     <div className="space-y-2">
                        <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Message to Landlord</label>
                        <textarea value={applyMessage} onChange={e => setApplyMessage(e.target.value)} required className="w-full bg-black border border-white/10 rounded-xl p-4 text-sm text-white h-32 resize-none outline-none focus:border-gold-primary/40" placeholder="Introduce yourself, mentioned your move-in date and any questions..." />
                     </div>
                     <button type="submit" className="w-full bg-gold-primary hover:bg-gold-secondary text-black font-black py-4 rounded-2xl uppercase tracking-widest text-xs shadow-xl flex items-center justify-center gap-2">
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
               <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setActiveAuditRequest(null)} className="absolute inset-0 bg-black/90 backdrop-blur-md" />
               <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="glass-panel w-full max-w-2xl bg-black border-gold-primary/20 shadow-2xl relative z-10 overflow-hidden">
                  <div className="bg-gold-primary/5 p-6 border-b border-white/5 flex justify-between items-center">
                     <h3 className="text-xl font-black text-white italic uppercase tracking-tighter">Tenant <span className="text-gold-primary">Audit</span></h3>
                     <button onClick={() => setActiveAuditRequest(null)} className="text-gray-500 hover:text-white"><X /></button>
                  </div>
                  <div className="p-8 space-y-8">
                     <div className="flex gap-6 items-start">
                        <div className="w-16 h-16 bg-gray-800 rounded-2xl flex items-center justify-center text-2xl font-black text-gold-primary border border-white/5 shadow-inner">{activeAuditRequest.tenantName.charAt(0)}</div>
                        <div className="space-y-1.5">
                           <h4 className="text-2xl font-black text-white">{activeAuditRequest.tenantName}</h4>
                           <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">Applicant for: {activeAuditRequest.listingTitle}</p>
                           <div className="flex items-center gap-2 pt-1">
                              <TrustBadge userId={activeAuditRequest.tenantId} />
                              {activeAuditRequest.status !== 'pending' && requestStatusBadge(activeAuditRequest.status)}
                           </div>
                        </div>
                     </div>
                     <div className="bg-black/40 border border-white/5 rounded-2xl p-4 italic text-sm text-gray-400 leading-relaxed font-medium">&quot;{activeAuditRequest.message}&quot;</div>

                     <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <button
                          onClick={() => runAuditAction('approved')}
                          disabled={!!auditActionLoading}
                          className="bg-green-500/10 hover:bg-green-500 text-green-500 hover:text-black border border-green-500/20 font-black py-4 rounded-2xl uppercase tracking-widest text-xs transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                           <Check size={16} /> Approve
                        </button>
                        <button
                          onClick={() => runAuditAction('rejected')}
                          disabled={!!auditActionLoading}
                          className="bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white border border-red-500/20 font-black py-4 rounded-2xl uppercase tracking-widest text-xs transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                           <X size={16} /> Reject
                        </button>
                        <button
                          onClick={() => runAuditAction('waitlisted')}
                          disabled={!!auditActionLoading}
                          className="bg-blue-500/10 hover:bg-blue-500 text-blue-400 hover:text-black border border-blue-500/20 font-black py-4 rounded-2xl uppercase tracking-widest text-xs transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                           Waitlist
                        </button>
                        <button
                          onClick={() => runAuditAction('saved')}
                          disabled={!!auditActionLoading}
                          className="bg-purple-500/10 hover:bg-purple-500 text-purple-400 hover:text-black border border-purple-500/20 font-black py-4 rounded-2xl uppercase tracking-widest text-xs transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                           Save for Later
                        </button>
                     </div>

                     {activeAuditRequest.status === 'approved' && (
                        <div className="space-y-4 pt-4 border-t border-white/5">
                           <h5 className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Review This Tenant</h5>
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
               className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[300] bg-black border border-gold-primary px-8 py-4 rounded-2xl shadow-2xl flex items-center gap-4 min-w-[320px]"
            >
               <div className="p-2 bg-green-500/20 rounded-full text-green-500 shadow-[0_0_15px_rgba(34,197,94,0.3)]"><ShieldCheck size={24} /></div>
               <div className="space-y-0.5">
                  <p className="text-[10px] font-black text-gray-600 uppercase tracking-[0.2em]">Success</p>
                  <p className="text-sm font-black text-white italic tracking-tight uppercase">{alertNotification}</p>
               </div>
               <button onClick={() => setAlertNotification(null)} className="ml-auto text-gray-700 hover:text-white transition-colors"><X size={16} /></button>
            </motion.div>
         )}
      </AnimatePresence>
    </div>
  )
}
