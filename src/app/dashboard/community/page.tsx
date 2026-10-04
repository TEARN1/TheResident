'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useSelector, useDispatch } from 'react-redux'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Megaphone, Wrench, Award, Gavel, ShieldCheck, Briefcase, Home, X, Shield, Users, Droplets, Lock,
  LayoutGrid, AlertTriangle, ListChecks, Sparkles, DoorOpen, Map as MapIcon
} from 'lucide-react'
import {
  RootState,
  AppDispatch,
  addNoticeEvent,
  rsvpToEvent,
  vibeNotice,
  echoNotice,
  addDispute,
  updateDisputeStatus,
  addMarketItem,
  addVendor,
  updateVendor,
  addTool,
  pledgeGroupBuy,
  resolveLostFound,
  toUUID,
  fetchSupabaseData,
  isGuestUser,
  selectVisibleNotices
} from '../../../store'
import {
  joinCommunity,
  leaveCommunity,
  createCommunity,
  completeChore as completeChoreRpc,
  borrowTool,
  raiseAlert,
  respondToAlert,
  resolveAlertRpc,
  reportStatus,
  reportContent,
  rotateChores,
  requestToolReturn,
  confirmToolReturn
} from '../../../store/actions'
import { supabase } from '../../../utils/supabase'
import { fetchUpcomingGruvsEvents, fetchGruvsEventsByIds } from '../../../utils/gruvsEvents'
import NoticeBoardTab from '../components/community/NoticeBoardTab'
import ToolLibraryTab from '../components/household/ToolLibraryTab'
import ChoreSchedulerTab from '../components/household/ChoreSchedulerTab'
import DisputesTab from '../components/trust-safety/DisputesTab'
import SafetyTab from '../components/trust-safety/SafetyTab'
import MarketTab from '../components/community/MarketTab'
import HouseholdTab from '../components/household/HouseholdTab'
import CommunitiesTab from '../components/community/CommunitiesTab'
import SharedResourcesTab from '../components/household/SharedResourcesTab'
import CommunityAdminTab from '../components/community/CommunityAdminTab'
import GruvsConnectionsWidget from '../components/social/GruvsConnectionsWidget'
import OrgBroadcastsPanel from '../components/community/OrgBroadcastsPanel'
import dynamic from 'next/dynamic'
import { formatCurrency, type StatusReport } from '../../../utils/logic'

const VibeMap = dynamic(() => import('../components/map/VibeMap'), {
  ssr: false,
  loading: () => <div className="p-12 text-slate-400 font-bold text-center">Loading VibeMap client engine...</div>
})
const TextbookScannerExchangeModal = dynamic(() => import('../components/community/TextbookScannerExchangeModal'), { ssr: false })
const GuardianLensModal = dynamic(() => import('../components/community/GuardianLensModal'), { ssr: false })
const MidnightTuckshopModal = dynamic(() => import('../components/residence/MidnightTuckshopModal'), { ssr: false })
const LaundryMachineQueueModal = dynamic(() => import('../components/residence/LaundryMachineQueueModal'), { ssr: false })
const LaundryUVPredictorModal = dynamic(() => import('../components/residence/LaundryUVPredictorModal'), { ssr: false })
const CommunalFridgeGuardModal = dynamic(() => import('../components/residence/CommunalFridgeGuardModal'), { ssr: false })
const PastPapersVaultModal = dynamic(() => import('../components/residence/PastPapersVaultModal'), { ssr: false })
const NoiseSentinelDecibelModal = dynamic(() => import('../components/residence/NoiseSentinelDecibelModal'), { ssr: false })
const CoLivingChoreWheelModal = dynamic(() => import('../components/residence/CoLivingChoreWheelModal'), { ssr: false })
const MoveInSurvivalQuestModal = dynamic(() => import('../components/residence/MoveInSurvivalQuestModal'), { ssr: false })
const JoJoWaterPurityModal = dynamic(() => import('../components/residence/JoJoWaterPurityModal'), { ssr: false })
const USSDOfflineFallbackModal = dynamic(() => import('../components/social-dynamics/USSDOfflineFallbackModal'), { ssr: false })

export default function CommunityPage() {
  const dispatch = useDispatch() as AppDispatch
  const searchParams = useSearchParams()
  const [subTab, setSubTab] = useState<'overview' | 'notices' | 'tools' | 'chores' | 'disputes' | 'safety' | 'market' | 'household' | 'communities' | 'vibemap' | 'resources' | 'admin'>(
    searchParams.get('tab') === 'vibemap' ? 'vibemap' : 'overview'
  )
  const [preMapTab, setPreMapTab] = useState<Exclude<typeof subTab, 'vibemap'>>('overview')
  // Arriving via the top bar's "Map" quick-link (?tab=vibemap) means the
  // user wants the map, not the Community Hub chrome around it — so that
  // entry point drops straight into fullscreen instead of a page with a
  // header and tab bar still eating screen space above the map.
  const [mapFullscreen, setMapFullscreen] = useState(searchParams.get('tab') === 'vibemap')

  // Lets a "Map" quick-link elsewhere in the app (e.g. the top bar) land
  // straight on VibeMap via /dashboard/community?tab=vibemap even when this
  // page was already mounted — the useState initializer above only fires on
  // first mount, so a repeat visit needs this effect to still catch the param.
  useEffect(() => {
    if (searchParams.get('tab') === 'vibemap') { setSubTab('vibemap'); setMapFullscreen(true) }
  }, [searchParams])
  const [alertNotification, setAlertNotification] = useState<string | null>(null)

  // Dispute Modal State
  const [showDisputeModal, setShowDisputeModal] = useState(false)
  const [disputeTitle, setDisputeTitle] = useState('')
  const [disputeDesc, setDisputeDesc] = useState('')
  const [disputeCategory, setDisputeCategory] = useState<'Noise' | 'Messiness' | 'Utility overuse' | 'Chore avoidance' | 'Security breach' | 'Other'>('Noise')

  // Create-community modal state (CommunitiesTab is presentation-only; the form lives here)
  const [showCreateCommunity, setShowCreateCommunity] = useState(false)

  // Advanced Campus & Safety Modals
  const [showTextbookModal, setShowTextbookModal] = useState(false)
  const [showGuardianModal, setShowGuardianModal] = useState(false)
  const [showTuckshopModal, setShowTuckshopModal] = useState(false)
  const [showLaundryQueueModal, setShowLaundryQueueModal] = useState(false)
  const [showLaundryUVModal, setShowLaundryUVModal] = useState(false)
  const [showFridgeGuardModal, setShowFridgeGuardModal] = useState(false)
  const [showPastPapersModal, setShowPastPapersModal] = useState(false)
  const [showNoiseSentinelModal, setShowNoiseSentinelModal] = useState(false)
  const [showChoreWheelModal, setShowChoreWheelModal] = useState(false)
  const [showSurvivalQuestModal, setShowSurvivalQuestModal] = useState(false)
  const [showJoJoPurityModal, setShowJoJoPurityModal] = useState(false)
  const [showUSSDModal, setShowUSSDModal] = useState(false)

  const currentUser = useSelector((state: RootState) => state.auth.currentUser)
  const lang = useSelector((state: RootState) => state.ui.language)
  const listings = useSelector((state: RootState) => state.listings.items)
  const requests = useSelector((state: RootState) => state.requests.items)
  const roommates = useSelector((state: RootState) => state.networking.roommates)

  // Data from Redux
  const communityNotices = useSelector((state: RootState) => selectVisibleNotices(state, currentUser?.id))
  const communityTools = useSelector((state: RootState) => state.community.tools)
  const communityChores = useSelector((state: RootState) => state.community.chores)
  const communityDisputes = useSelector((state: RootState) => state.community.disputes)
  const reputationScores = useSelector((state: RootState) => state.community.reputationScores)
  const alerts = useSelector((state: RootState) => state.community.alerts)
  const neighbourhoodStatus = useSelector((state: RootState) => state.community.neighbourhoodStatus)
  const marketItems = useSelector((state: RootState) => state.community.marketItems)
  const vendors = useSelector((state: RootState) => state.community.vendors)
  const groupBuys = useSelector((state: RootState) => state.community.groupBuys)
  const lostFound = useSelector((state: RootState) => state.community.lostFound)
  const communities = useSelector((state: RootState) => state.community.communities)
  const myCommunityIds = useSelector((state: RootState) => state.community.myCommunityIds)
  const communityMemberCounts = useSelector((state: RootState) => state.community.communityMemberCounts)

  // Community Events always point at a real Gruvs-owned `events` row
  // (CONTRACT.md §8) rather than carrying their own free-text title/date —
  // same convention already used for res_lift_clubs.event_id. These two
  // effects mirror the fetch pattern in services/page.tsx exactly.
  const [upcomingGruvsEvents, setUpcomingGruvsEvents] = useState<{ id: string; title: string; startsAt: string }[]>([])
  const [gruvsEventInfo, setGruvsEventInfo] = useState<Record<string, { title: string; startsAt: string }>>({})

  useEffect(() => {
    let cancelled = false
    if (subTab !== 'notices') return
    fetchUpcomingGruvsEvents().then(events => {
      if (!cancelled) setUpcomingGruvsEvents(events)
    })
    return () => { cancelled = true }
  }, [subTab])

  useEffect(() => {
    let cancelled = false
    const ids = [...new Set(communityNotices.map(n => n.eventId).filter((id): id is string => !!id))]
    if (ids.length === 0) return
    fetchGruvsEventsByIds(ids).then(info => {
      if (!cancelled) setGruvsEventInfo(prev => ({ ...prev, ...info }))
    })
    return () => { cancelled = true }
  }, [communityNotices])

  // Server-held facts a client must not invent: verification + household.
  const [isVerified, setIsVerified] = useState(false)
  // Communities where the current user is admin/founder — drives the small
  // hide/unhide moderation controls surfaced inside Market/Notices, and gates
  // the Admin tab's member-management panel. Server-side res_moderate does
  // its own role check regardless; this only controls what the UI offers.
  const [adminCommunities, setAdminCommunities] = useState<Array<{ id: string; name: string }>>([])
  const [householdListingId, setHouseholdListingId] = useState<string | null>(null)
  const [householdName, setHouseholdName] = useState('')
  const [householdMembers, setHouseholdMembers] = useState<Array<{ userId: string; name: string; role: string }>>([])

  useEffect(() => {
    if (!currentUser || isGuestUser(currentUser) || !supabase) return
    let cancelled = false

    const load = async () => {
      const { data: profile } = await supabase!.from('profiles').select('is_verified').eq('id', currentUser.id).single()
      if (cancelled) return
      setIsVerified(!!profile?.is_verified)

      // A household is a listing you own, or one whose application was approved.
      const owned = listings.find(l => l.landlordId === currentUser.id)
      const approved = requests.find(r => r.tenantId === currentUser.id && r.status === 'approved')
      const listingId = owned?.id || approved?.listingId || null
      setHouseholdListingId(listingId)
      setHouseholdName(owned?.title || listings.find(l => l.id === approved?.listingId)?.title || '')

      if (listingId) {
        const { data: roster } = await supabase!.rpc('res_household_members', { p_listing: toUUID(listingId) })
        if (cancelled) return
        setHouseholdMembers((roster || []).map((m: { user_id: string; role: string }) => ({
          userId: m.user_id,
          name: m.user_id === currentUser.id ? currentUser.name : roommates.find(r => r.id === m.user_id)?.name || 'Housemate',
          role: m.role
        })))
      } else {
        setHouseholdMembers([])
      }
    }

    load()
    return () => { cancelled = true }
  }, [currentUser, listings, requests, roommates])

  useEffect(() => {
    if (!currentUser || isGuestUser(currentUser) || !supabase || myCommunityIds.length === 0) {
      setAdminCommunities([])
      return
    }
    let cancelled = false

    const loadAdminCommunities = async () => {
      const ids = myCommunityIds.map(toUUID)
      const { data } = await supabase!
        .from('res_community_members')
        .select('community_id, role')
        .eq('user_id', currentUser.id)
        .in('community_id', ids)
        .in('role', ['admin', 'founder'])
      if (cancelled || !data) return
      setAdminCommunities(data.map(row => ({
        id: row.community_id,
        name: communities.find(c => toUUID(c.id) === toUUID(row.community_id))?.name || 'Community'
      })))
    }

    loadAdminCommunities()
    return () => { cancelled = true }
  }, [currentUser, myCommunityIds, communities])

  const isModerator = adminCommunities.length > 0
  const moderationCommunityId = adminCommunities[0]?.id || null

  const handleModerate = async (subjectType: string, subjectId: string, action: 'hide' | 'unhide') => {
    if (!supabase || !moderationCommunityId) return
    const { error } = await supabase.rpc('res_moderate', {
      p_community: moderationCommunityId,
      p_action: action,
      p_subject_type: subjectType,
      p_subject_id: subjectId,
      p_reason: null
    })
    if (!error) {
      setAlertNotification(action === 'hide' ? 'Hidden.' : 'Unhidden.')
      setTimeout(() => setAlertNotification(null), 3000)
      dispatch(fetchSupabaseData())
    }
  }

  // No fallback suburb: defaulting a new user in, say, Lagos into a South
  // African suburb would silently scope their whole safety/market feed to the
  // wrong place. Empty means "not set yet" — the UI shows an honest empty
  // state instead of someone else's neighbourhood.
  const suburb = listings.find(l => l.landlordId === currentUser?.id)?.suburb
    || roommates.find(r => r.id === currentUser?.id)?.suburb
    || ''

  // Same reasoning for currency: derive it from the user's own listing when
  // one exists, otherwise leave it unset rather than assuming ZAR.
  const defaultCurrency = listings.find(l => l.landlordId === currentUser?.id)?.currency

  // Crowd-signal reports for the safety tab's outage consensus, kinded per utility.
  const statusReports: StatusReport[] = neighbourhoodStatus
    .filter(n => n.suburb === suburb)
    .map(n => ({
      reporterId: n.id,
      kind: (n.service === 'electricity' ? 'power' : n.service) as StatusReport['kind'],
      status: n.status,
      createdAt: n.updatedAt
    }))

  const handlePostNotice = (data: {
    title: string
    description: string
    type: 'notice' | 'event' | 'landlord_announcement'
    audience?: 'everyone' | 'my_tenants' | 'targeted'
    targetSuburbs?: string[]
    excludedUserIds?: string[]
    eventId?: string
  }) => {
    if (!currentUser) return
    if (data.audience === 'my_tenants' && (data.type !== 'landlord_announcement' || currentUser.role !== 'landlord')) return
    if (data.type === 'event' && !data.eventId) return
    dispatch(addNoticeEvent({
      id: `notice-${Date.now()}`,
      title: data.title,
      description: data.description,
      type: data.type,
      eventId: data.type === 'event' ? data.eventId : undefined,
      audience: data.type !== 'event' ? (data.audience || 'everyone') : undefined,
      targetSuburbs: data.audience === 'targeted' ? data.targetSuburbs : undefined,
      excludedUserIds: data.excludedUserIds,
      postedBy: currentUser.name,
      postedById: currentUser.id,
      timestamp: new Date().toISOString(),
      rsvps: []
    }))
    setAlertNotification('Notice Published Successfully!')
    setTimeout(() => setAlertNotification(null), 3000)
  }

  // Borrowing goes through res_borrow_tool: an atomic status='available' guard
  // plus a notification to the owner, rather than the raw optimistic reducer.
  const handleRentTool = (tool: { id: string; title: string }) => {
    const until = new Date(Date.now() + 86400000).toISOString().slice(0, 10)
    dispatch(borrowTool({ toolId: tool.id, until }))
    setAlertNotification(`Borrow request sent for ${tool.title}.`)
    setTimeout(() => setAlertNotification(null), 3000)
  }

  const handleCompleteChore = (id: string) => {
    dispatch(completeChoreRpc(id))
    setAlertNotification('Chore marked as done! Reputation awarded.')
    setTimeout(() => setAlertNotification(null), 3000)
  }

  const handleCreateDispute = () => {
    if (!currentUser || !disputeTitle.trim()) return
    dispatch(addDispute({
      id: `disp-${Date.now()}`,
      title: disputeTitle,
      description: disputeDesc,
      category: disputeCategory,
      reportedBy: currentUser.name,
      reportedById: currentUser.id,
      againstUser: '',
      againstUserId: '',
      mediatorId: '',
      mediatorName: '',
      status: 'pending',
      timestamp: new Date().toISOString()
    }))
    setShowDisputeModal(false)
    setDisputeTitle('')
    setDisputeDesc('')
    setAlertNotification('Dispute logged. A mediator will review it.')
    setTimeout(() => setAlertNotification(null), 4000)
  }

  const handleCreateCommunity = (name: string, kind: 'street' | 'block' | 'complex' | 'estate' | 'suburb') => {
    if (!name.trim()) return
    dispatch(createCommunity({ name, kind, suburb }))
    setShowCreateCommunity(false)
    setAlertNotification('Community created — you are its founder.')
    setTimeout(() => setAlertNotification(null), 4000)
  }

  // ── Adapters: the redesigned tab components use their own simplified local
  // types (a visual mock layer) rather than the store's real shapes. These map
  // one to the other so real data reaches real UI. Memoized — these ran on
  // every render regardless of whether their source data changed, producing
  // a brand-new array of brand-new objects each time (this page has 15+
  // useSelector calls, any one of which re-renders the component), which
  // defeats reference-equality checks in any child that receives them.
  const adaptedChores = useMemo(() => communityChores.map(c => ({
    id: c.id,
    title: c.taskName,
    assignedTo: c.roommateId,
    status: c.status,
    dueDate: c.dayOfWeek,
    points: 10
  })), [communityChores])

  const adaptedDisputes = useMemo(() => communityDisputes.map(d => ({
    id: d.id,
    title: d.title,
    description: d.description,
    category: d.category,
    reportedBy: d.reportedBy,
    reportedById: d.reportedById,
    againstUser: d.againstUser,
    againstUserId: d.againstUserId,
    status: (d.status === 'mediating' ? 'investigating' : d.status) as 'pending' | 'resolved' | 'investigating',
    timestamp: d.timestamp,
    resolutionDetails: d.resolutionDetails
  })), [communityDisputes])

  const adaptedCommunities = useMemo(() => communities.map(c => ({
    id: c.id,
    name: c.name,
    kind: c.kind,
    suburb: c.suburb,
    memberCount: communityMemberCounts[toUUID(c.id)] || 0
  })), [communities, communityMemberCounts])

  // Four clusters, each carrying one secondary accent layered on top of the
  // base gold palette (used only as a subtle icon-badge tint, never replacing
  // gold as the primary active-state color). Admin cluster is appended below
  // only when the user actually moderates a community.
  const clusters = [
    {
      id: 'feed',
      label: 'Feed & Social',
      accent: 'text-sky-400 bg-sky-400/10',
      tabs: [
        { id: 'notices', label: 'Notices', icon: Megaphone },
        { id: 'communities', label: 'Groups', icon: Users },
      ],
    },
    {
      id: 'trade',
      label: 'Trade & Resources',
      accent: 'text-emerald-400 bg-emerald-400/10',
      tabs: [
        { id: 'market', label: 'Market', icon: Briefcase },
        { id: 'resources', label: 'Resources', icon: Droplets },
        { id: 'tools', label: 'Tools', icon: Wrench },
      ],
    },
    {
      id: 'safety',
      label: 'Safety & Household',
      accent: 'text-rose-400 bg-rose-400/10',
      tabs: [
        { id: 'safety', label: 'Safety', icon: ShieldCheck },
        { id: 'disputes', label: 'Disputes', icon: Gavel },
        { id: 'household', label: 'Household', icon: Home },
        { id: 'chores', label: 'Chores', icon: Award },
      ],
    },
    ...(isModerator ? [{
      id: 'admin',
      label: 'Admin',
      accent: 'text-violet-400 bg-violet-400/10',
      tabs: [
        { id: 'admin', label: 'Admin', icon: Lock },
      ],
    }] : []),
  ] as const

  // Which cluster (if any) the current tab lives in — derived from subTab
  // rather than tracked as its own state, so there's no separate value that
  // can drift out of sync when a tab is reached some other way (e.g. an
  // Overview stat card jumping straight to Disputes).
  const activeCluster = clusters.find(c => c.tabs.some(t => t.id === subTab)) ?? null

  // ── Overview stat cards ────────────────────────────────────────────────
  const activeAlertsCount = alerts.filter(a => a.status === 'active').length
  const myPendingChoresCount = communityChores.filter(c => c.roommateId === currentUser?.id && c.status !== 'completed').length
  // eslint-disable-next-line react-hooks/purity -- 48h freshness window is a display heuristic, not render output that must stay stable
  const now = Date.now()
  const newMarketItemsCount = marketItems.filter(m => now - new Date(m.createdAt).getTime() < 48 * 60 * 60 * 1000).length
  const isLandlord = listings.some(l => l.landlordId === currentUser?.id)
  const openRoomRequestsCount = isLandlord
    ? requests.filter(r => r.landlordId === currentUser?.id && r.status === 'pending').length
    : 0

  const goToTab = (id: typeof subTab) => { setPreMapTab(id as Exclude<typeof subTab, 'vibemap'>); setSubTab(id) }
  const toggleVibeMap = () => {
    if (subTab === 'vibemap') { setSubTab(preMapTab); setMapFullscreen(false) } else { setPreMapTab(subTab as Exclude<typeof subTab, 'vibemap'>); setSubTab('vibemap'); setMapFullscreen(true) }
  }
  const exitFullscreenMap = () => { setMapFullscreen(false); setSubTab(preMapTab) }

  // The map's own value is the map — Community Hub's header, tab bar and
  // page padding around it just eat screen space a mobile user needs for
  // actually reading streets. Fullscreen skips all of that and renders
  // VibeMap alone, with its own exit control to get back.
  if (subTab === 'vibemap' && mapFullscreen) {
    return (
      <div className="fixed inset-0 z-[1000] bg-black">
        <button
          onClick={exitFullscreenMap}
          aria-label="Exit fullscreen map"
          title="Exit map"
          className="absolute top-3 left-3 z-[1001] flex items-center gap-2 bg-black/80 backdrop-blur-xl border border-white/10 rounded-xl px-3 py-2.5 text-gray-200 hover:text-white shadow-2xl"
        >
          <X size={16} /> <span className="text-[10px] font-black uppercase tracking-widest">Exit</span>
        </button>
        <VibeMap fullscreen />
      </div>
    )
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8 pb-32">
      {/* Duplicated what the top bar already shows (icon + "Community") —
          removed for the same reason as Housing's and Services'. Kept the
          VibeMap toggle, since that's the one thing here that actually does
          something. */}
      <header className="flex justify-end">
        <button
          onClick={toggleVibeMap}
          title="VibeMap"
          aria-label="Toggle VibeMap"
          className={`hidden md:inline-flex items-center justify-center w-11 h-11 rounded-2xl border shrink-0 transition-all ${subTab === 'vibemap' ? 'bg-gold-primary text-black border-gold-primary' : 'bg-black/40 text-gray-500 border-white/5 hover:text-gold-primary hover:border-gold-primary/30'}`}
        >
          <MapIcon size={18} />
        </button>
      </header>

      {/* TWO-STEP DRILL-DOWN NAVIGATION */}
      <div className="bg-black/60 p-3 md:p-4 rounded-3xl border border-white/10 shadow-glass backdrop-blur-2xl space-y-3">
        <div className="flex flex-wrap items-center gap-2 overflow-x-auto no-scrollbar">
          <button
            onClick={() => goToTab('overview')}
            className={`px-4 py-2 rounded-2xl transition-all text-xs font-black uppercase tracking-wider flex items-center gap-2 whitespace-nowrap ${
              subTab === 'overview' ? 'bg-gold-primary text-black' : 'text-gray-400 hover:text-white bg-white/5 border border-white/5'
            }`}
          >
            <LayoutGrid size={13} /> Overview
          </button>
          {clusters.map(cluster => {
            const ClusterIcon = cluster.tabs[0].icon
            const active = activeCluster?.id === cluster.id
            return (
              <button
                key={cluster.id}
                onClick={() => goToTab(cluster.tabs[0].id as typeof subTab)}
                className={`px-4 py-2 rounded-2xl transition-all text-xs font-black uppercase tracking-wider flex items-center gap-2 whitespace-nowrap ${
                  active ? 'bg-gold-primary text-black' : 'text-gray-400 hover:text-white bg-white/5 border border-white/5'
                }`}
              >
                <span className={`p-0.5 rounded ${active ? '' : cluster.accent}`}>
                  <ClusterIcon size={13} />
                </span>
                {cluster.label}
              </button>
            )
          })}
          <button
            onClick={toggleVibeMap}
            className={`px-4 py-2 rounded-2xl transition-all text-xs font-black uppercase tracking-wider flex items-center gap-1.5 whitespace-nowrap border ${
              subTab === 'vibemap'
                ? 'bg-gradient-to-r from-gold-primary to-amber-500 text-black border-gold-primary'
                : 'text-amber-300 hover:text-white bg-gold-primary/10 border-gold-primary/30 hover:bg-gold-primary/20'
            }`}
          >
            <Sparkles size={13} className="text-gold-primary animate-pulse" />
            <span>Vibe Radar</span>
          </button>

          <button
            type="button"
            onClick={() => setShowTextbookModal(true)}
            className="px-4 py-2 rounded-2xl transition-all text-xs font-black uppercase tracking-wider flex items-center gap-1.5 whitespace-nowrap bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 border border-sky-500/30"
          >
            <span>📚 Textbook Swap</span>
          </button>

          <button
            type="button"
            onClick={() => setShowGuardianModal(true)}
            className="px-4 py-2 rounded-2xl transition-all text-xs font-black uppercase tracking-wider flex items-center gap-1.5 whitespace-nowrap bg-teal-500/10 hover:bg-teal-500/20 text-teal-300 border border-teal-500/30"
          >
            <span>🛡️ GuardianLens</span>
          </button>

          <button
            type="button"
            onClick={() => setShowTuckshopModal(true)}
            className="px-4 py-2 rounded-2xl transition-all text-xs font-black uppercase tracking-wider flex items-center gap-1.5 whitespace-nowrap bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30"
            title="Peer Midnight Tuckshop & Study Snack Pool"
          >
            <span>🍜 Tuckshop</span>
          </button>

          <button
            type="button"
            onClick={() => setShowLaundryQueueModal(true)}
            className="px-4 py-2 rounded-2xl transition-all text-xs font-black uppercase tracking-wider flex items-center gap-1.5 whitespace-nowrap bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 border border-blue-500/30"
            title="Communal Laundry Machine Queue & Cycle Buzzer"
          >
            <span>🧺 Laundry Queue</span>
          </button>

          <button
            type="button"
            onClick={() => setShowLaundryUVModal(true)}
            className="px-4 py-2 rounded-2xl transition-all text-xs font-black uppercase tracking-wider flex items-center gap-1.5 whitespace-nowrap bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-300 border border-yellow-500/30"
            title="Highveld UV Index & Drying Window Radar"
          >
            <span>☀️ Laundry UV Radar</span>
          </button>

          <button
            type="button"
            onClick={() => setShowFridgeGuardModal(true)}
            className="px-4 py-2 rounded-2xl transition-all text-xs font-black uppercase tracking-wider flex items-center gap-1.5 whitespace-nowrap bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
            title="Communal Fridge Guard - Expiry & Free Food Claims"
          >
            <span>🧊 Fridge Guard</span>
          </button>

          <button
            type="button"
            onClick={() => setShowPastPapersModal(true)}
            className="px-4 py-2 rounded-2xl transition-all text-xs font-black uppercase tracking-wider flex items-center gap-1.5 whitespace-nowrap bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/30"
            title="Past Exam Papers Vault & Quiet Study Bookings"
          >
            <span>📑 Past Papers Vault</span>
          </button>

          <button
            type="button"
            onClick={() => setShowNoiseSentinelModal(true)}
            className="px-4 py-2 rounded-2xl transition-all text-xs font-black uppercase tracking-wider flex items-center gap-1.5 whitespace-nowrap bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30"
            title="Noise Sentinel Corridor Decibel Meter & Quiet Beacons"
          >
            <span>🔊 Noise Sentinel</span>
          </button>

          <button
            type="button"
            onClick={() => setShowChoreWheelModal(true)}
            className="px-4 py-2 rounded-2xl transition-all text-xs font-black uppercase tracking-wider flex items-center gap-1.5 whitespace-nowrap bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
            title="Co-Living Inertia Chore Wheel Spinner"
          >
            <span>🎡 Chore Wheel</span>
          </button>

          <button
            type="button"
            onClick={() => setShowSurvivalQuestModal(true)}
            className="px-4 py-2 rounded-2xl transition-all text-xs font-black uppercase tracking-wider flex items-center gap-1.5 whitespace-nowrap bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
            title="Move-In Survival Quest - 7-Day Res Onboarding"
          >
            <span>🎒 Survival Quest</span>
          </button>

          <button
            type="button"
            onClick={() => setShowJoJoPurityModal(true)}
            className="px-4 py-2 rounded-2xl transition-all text-xs font-black uppercase tracking-wider flex items-center gap-1.5 whitespace-nowrap bg-teal-500/10 hover:bg-teal-500/20 text-teal-300 border border-teal-500/30"
            title="JoJo Water Tank Sensor Monitor - pH & TDS Purity"
          >
            <span>💧 JoJo Water Purity</span>
          </button>

          <button
            type="button"
            onClick={() => setShowUSSDModal(true)}
            className="px-4 py-2 rounded-2xl transition-all text-xs font-black uppercase tracking-wider flex items-center gap-1.5 whitespace-nowrap bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30"
            title="Offline Zero-Rated USSD / SMS Mode (*120*737#)"
          >
            <span>📱 USSD Offline</span>
          </button>
        </div>

        {/* Second-level tabs for active cluster */}
        {activeCluster && (
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1 border-t border-white/10">
            {activeCluster.tabs.map(t => (
              <button
                key={t.id}
                onClick={() => goToTab(t.id as typeof subTab)}
                className={`px-3 py-1.5 rounded-xl transition-all text-[11px] font-bold tracking-wide flex items-center gap-1.5 whitespace-nowrap border ${
                  subTab === t.id
                    ? 'bg-white/15 text-white border-white/20'
                    : 'text-gray-400 border-transparent hover:text-gray-200 hover:bg-white/5'
                }`}
              >
                <span className={`p-1 rounded-lg ${subTab === t.id ? 'bg-white/10 text-gold-primary' : activeCluster.accent}`}>
                  <t.icon size={12} />
                </span>
                {t.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mt-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={subTab}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            {subTab === 'overview' && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="glass-panel p-5 bg-rose-400/5 border-rose-400/10 space-y-3">
                    <div className="p-2 bg-rose-400/10 rounded-xl w-fit text-rose-400"><AlertTriangle size={18} /></div>
                    <div>
                      <p className="text-2xl font-black text-white italic">{activeAlertsCount}</p>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Active Alerts</p>
                    </div>
                  </div>
                  <div className="glass-panel p-5 bg-gold-primary/5 border-gold-primary/10 space-y-3">
                    <div className="p-2 bg-gold-primary/10 rounded-xl w-fit text-gold-primary"><ListChecks size={18} /></div>
                    <div>
                      <p className="text-2xl font-black text-white italic">{myPendingChoresCount}</p>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Chores Assigned To You</p>
                    </div>
                  </div>
                  <div className="glass-panel p-5 bg-emerald-400/5 border-emerald-400/10 space-y-3">
                    <div className="p-2 bg-emerald-400/10 rounded-xl w-fit text-emerald-400"><Sparkles size={18} /></div>
                    <div>
                      <p className="text-2xl font-black text-white italic">{newMarketItemsCount}</p>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">New Market Items (48h)</p>
                    </div>
                  </div>
                  {isLandlord && (
                    <div className="glass-panel p-5 bg-sky-400/5 border-sky-400/10 space-y-3">
                      <div className="p-2 bg-sky-400/10 rounded-xl w-fit text-sky-400"><DoorOpen size={18} /></div>
                      <div>
                        <p className="text-2xl font-black text-white italic">{openRoomRequestsCount}</p>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Open Room Requests</p>
                      </div>
                    </div>
                  )}
                </div>
                <GruvsConnectionsWidget />
              </div>
            )}
            {subTab === 'notices' && (
              <div className="space-y-6">
                <NoticeBoardTab
                    communityNotices={communityNotices}
                    currentUser={currentUser}
                    upcomingGruvsEvents={upcomingGruvsEvents}
                    gruvsEventInfo={gruvsEventInfo}
                    handleVibeNotice={(id) => dispatch(vibeNotice({ noticeId: id, userName: currentUser?.name || '' }))}
                    handleEchoNotice={(id) => dispatch(echoNotice({ noticeId: id, userName: currentUser?.name || '' }))}
                    handleRSVPToEvent={(id) => dispatch(rsvpToEvent({ noticeId: id, userName: currentUser?.name || '' }))}
                    handlePostNotice={handlePostNotice}
                    isModerator={isModerator}
                    onModerate={handleModerate}
                 />
                <OrgBroadcastsPanel />
              </div>
            )}
            {subTab === 'market' && (
              <MarketTab
                marketItems={marketItems}
                vendors={vendors}
                groupBuys={groupBuys}
                lostFound={lostFound}
                currentUserId={currentUser?.id || ''}
                formatCurrency={(a: number, c?: string) => formatCurrency(a, c || defaultCurrency)}
                onReport={(subjectType, subjectId) => dispatch(reportContent({ subjectType, subjectId, reason: 'other' }))}
                defaultSuburb={suburb}
                onSaveVendor={(values, id) => {
                  if (!currentUser) return
                  const existing = id ? vendors.find(v => v.id === id) : undefined
                  if (existing) {
                    dispatch(updateVendor({ ...existing, ...values }))
                  } else {
                    dispatch(addVendor({
                      id: `vendor-${Date.now()}`,
                      ...values,
                      ownerId: currentUser.id,
                      status: 'active',
                      rating: 5.0,
                      reviewsCount: 0
                    }))
                  }
                }}
                onPostItem={(item) => {
                  if (!currentUser) return
                  dispatch(addMarketItem({
                    id: `mk-${Date.now()}`,
                    title: item.title,
                    description: item.description,
                    price: item.price ?? 0,
                    currency: defaultCurrency || '',
                    category: item.category,
                    suburb,
                    imageUrl: item.imageUrl || undefined,
                    status: 'available',
                    createdBy: currentUser.id,
                    createdAt: new Date().toISOString()
                  }))
                  setAlertNotification('Posted to the local market.')
                  setTimeout(() => setAlertNotification(null), 3000)
                }}
                onPledge={(groupBuyId, quantity) => {
                  dispatch(pledgeGroupBuy({ groupBuyId, amount: quantity }))
                  setAlertNotification('Pledge recorded — reach the target to unlock collection.')
                  setTimeout(() => setAlertNotification(null), 3000)
                }}
                onReunite={(id) => {
                  dispatch(resolveLostFound(id))
                  setAlertNotification('Marked reunited — thank you!')
                  setTimeout(() => setAlertNotification(null), 3000)
                }}
                isModerator={isModerator}
                onModerate={handleModerate}
              />
            )}
            {subTab === 'resources' && (
              <SharedResourcesTab currentUserId={currentUser?.id || ''} communityId={myCommunityIds[0] || null} />
            )}
            {subTab === 'admin' && (
              <CommunityAdminTab
                currentUserId={currentUser?.id || ''}
                myCommunities={communities.filter(c => myCommunityIds.some(id => toUUID(id) === toUUID(c.id))).map(c => ({ id: c.id, name: c.name }))}
              />
            )}
            {subTab === 'safety' && (
              <SafetyTab
                alerts={alerts}
                neighbourhoodStatus={neighbourhoodStatus}
                statusReports={statusReports}
                currentUserId={currentUser?.id || ''}
                isVerified={isVerified}
                suburb={suburb}
                onRaiseAlert={(args) => dispatch(raiseAlert({ ...args, suburb }))}
                onRespond={(id, status) => dispatch(respondToAlert({ alertId: id, status }))}
                onResolve={(id) => dispatch(resolveAlertRpc({ alertId: id }))}
                onReportStatus={(kind, status, endsAt) => dispatch(reportStatus({ kind, status, suburb, endsAt }))}
              />
            )}
            {subTab === 'tools' && (
              <ToolLibraryTab
                communityTools={communityTools}
                currentUser={currentUser}
                formatCurrency={(a: number, c?: string) => formatCurrency(a, c || defaultCurrency)}
                handleRentTool={handleRentTool}
                handleAddTool={(tool) => {
                  if (!currentUser) return
                  dispatch(addTool({
                    id: `tool-${Date.now()}`,
                    ownerId: currentUser.id,
                    ownerName: currentUser.name,
                    title: tool.title,
                    description: tool.description,
                    pricePerDay: tool.pricePerDay,
                    currency: defaultCurrency || '',
                    deposit: tool.deposit,
                    location: tool.location,
                    status: 'available'
                  }))
                  setAlertNotification('Tool listed for your neighbours to borrow.')
                  setTimeout(() => setAlertNotification(null), 3000)
                }}
                onRequestReturn={(toolId) => dispatch(requestToolReturn(toolId))}
                onConfirmReturn={(toolId) => dispatch(confirmToolReturn(toolId))}
              />
            )}
            {subTab === 'chores' && (
              <ChoreSchedulerTab communityChores={adaptedChores} currentUser={currentUser} reputationScores={reputationScores} handleCompleteChore={handleCompleteChore} />
            )}
            {subTab === 'disputes' && (
              <DisputesTab
                communityDisputes={adaptedDisputes}
                currentUser={currentUser}
                onFileDispute={() => setShowDisputeModal(true)}
                onModerate={(disputeId, status, resolutionDetails) => dispatch(updateDisputeStatus({ disputeId, status, resolutionDetails }))}
              />
            )}
            {subTab === 'household' && (
              <HouseholdTab
                householdListingId={householdListingId}
                householdName={householdName}
                members={householdMembers}
                chores={adaptedChores}
                reputationScores={reputationScores}
                currentUserId={currentUser?.id || ''}
                onRotate={(tasks, days) => {
                  if (!householdListingId) return
                  dispatch(rotateChores({ listingId: householdListingId, tasks, days }))
                }}
              />
            )}
            {subTab === 'communities' && (
              <CommunitiesTab
                communities={adaptedCommunities}
                memberOf={myCommunityIds}
                currentUserId={currentUser?.id || ''}
                onJoin={(id) => { dispatch(joinCommunity(id)); setAlertNotification('Joined community!'); setTimeout(() => setAlertNotification(null), 3000) }}
                onRegisterGroup={() => setShowCreateCommunity(true)}
              />
            )}
            {subTab === 'vibemap' && <VibeMap />}
          </motion.div>
        </AnimatePresence>

        {subTab === 'communities' && myCommunityIds.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {myCommunityIds.map(id => (
              <button
                key={id}
                onClick={() => dispatch(leaveCommunity(id))}
                className="text-[10px] text-gray-500 hover:text-red-400 uppercase font-bold tracking-widest bg-white/5 border border-white/10 px-3 py-1.5 rounded-lg"
              >
                Leave {communities.find(c => toUUID(c.id) === toUUID(id))?.name || 'community'}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* CREATE COMMUNITY (CommunitiesTab is presentation-only; the form lives here) */}
      <AnimatePresence>
        {showCreateCommunity && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowCreateCommunity(false)} className="absolute inset-0 bg-black/90 backdrop-blur-md" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="glass-panel w-full max-w-lg bg-black border-gold-primary/20 shadow-2xl relative z-10 p-8 space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-black text-white italic uppercase tracking-tighter">New <span className="text-gold-primary">Community</span></h3>
                <button onClick={() => setShowCreateCommunity(false)} className="text-gray-500 hover:text-white"><X /></button>
              </div>
              <form
                onSubmit={e => {
                  e.preventDefault()
                  const form = e.target as HTMLFormElement
                  const name = (form.elements.namedItem('name') as HTMLInputElement).value
                  const kind = (form.elements.namedItem('kind') as HTMLSelectElement).value as 'street' | 'block' | 'complex' | 'estate' | 'suburb'
                  handleCreateCommunity(name, kind)
                }}
                className="space-y-4"
              >
                <input name="name" required placeholder="e.g. Maple Street Block" className="w-full bg-black border border-white/10 rounded-xl p-3 text-sm text-white outline-none focus:border-gold-primary/40" />
                <select name="kind" className="w-full bg-black border border-white/10 rounded-xl p-3 text-sm text-white outline-none focus:border-gold-primary/40">
                  <option value="street">Street</option>
                  <option value="block">Block</option>
                  <option value="complex">Complex</option>
                  <option value="estate">Estate</option>
                  <option value="suburb">Suburb</option>
                </select>
                <button type="submit" className="w-full bg-gold-primary text-black font-black py-3 rounded-xl uppercase tracking-widest text-xs">Create</button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* FILE DISPUTE MODAL */}
      <AnimatePresence>
        {showDisputeModal && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowDisputeModal(false)} className="absolute inset-0 bg-black/90 backdrop-blur-md" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="glass-panel w-full max-w-lg bg-black border-gold-primary/20 shadow-2xl relative z-10 p-8 space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-black text-white italic uppercase tracking-tighter">File a <span className="text-gold-primary">Dispute</span></h3>
                <button onClick={() => setShowDisputeModal(false)} className="text-gray-500 hover:text-white"><X /></button>
              </div>
              <form onSubmit={e => { e.preventDefault(); handleCreateDispute() }} className="space-y-4">
                <input value={disputeTitle} onChange={e => setDisputeTitle(e.target.value)} required placeholder="Short summary" className="w-full bg-black border border-white/10 rounded-xl p-3 text-sm text-white outline-none focus:border-gold-primary/40" />
                <select value={disputeCategory} onChange={e => setDisputeCategory(e.target.value as typeof disputeCategory)} className="w-full bg-black border border-white/10 rounded-xl p-3 text-sm text-white outline-none focus:border-gold-primary/40">
                  <option>Noise</option>
                  <option>Messiness</option>
                  <option>Utility overuse</option>
                  <option>Chore avoidance</option>
                  <option>Security breach</option>
                  <option>Other</option>
                </select>
                <textarea value={disputeDesc} onChange={e => setDisputeDesc(e.target.value)} required placeholder="What happened?" className="w-full bg-black border border-white/10 rounded-xl p-3 text-sm text-white h-24 resize-none outline-none focus:border-gold-primary/40" />
                <button type="submit" className="w-full bg-gold-primary text-black font-black py-3 rounded-xl uppercase tracking-widest text-xs">File dispute</button>
              </form>
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
               <div className="p-2 bg-green-500/20 rounded-full text-green-500 shadow-[0_0_15px_rgba(34,197,94,0.3)]"><Shield size={24} /></div>
               <div className="space-y-0.5">
                  <p className="text-[10px] font-black text-gray-600 uppercase tracking-[0.2em]">Update</p>
                  <p className="text-sm font-black text-white italic tracking-tight uppercase">{alertNotification}</p>
               </div>
               <button onClick={() => setAlertNotification(null)} className="ml-auto text-gray-700 hover:text-white transition-colors"><X size={16} /></button>
            </motion.div>
         )}
      </AnimatePresence>

      {/* TEXTBOOK SCANNER & EXCHANGE MODAL */}
      <TextbookScannerExchangeModal
        isOpen={showTextbookModal}
        onClose={() => setShowTextbookModal(false)}
      />

      {/* GUARDIAN LENS MODAL */}
      <GuardianLensModal
        isOpen={showGuardianModal}
        onClose={() => setShowGuardianModal(false)}
      />

      {/* MIDNIGHT TUCKSHOP MODAL */}
      <MidnightTuckshopModal
        isOpen={showTuckshopModal}
        onClose={() => setShowTuckshopModal(false)}
      />

      {/* LAUNDRY MACHINE QUEUE MODAL */}
      <LaundryMachineQueueModal
        isOpen={showLaundryQueueModal}
        onClose={() => setShowLaundryQueueModal(false)}
      />

      {/* LAUNDRY UV PREDICTOR MODAL */}
      <LaundryUVPredictorModal
        isOpen={showLaundryUVModal}
        onClose={() => setShowLaundryUVModal(false)}
      />

      {/* COMMUNAL FRIDGE GUARD MODAL */}
      <CommunalFridgeGuardModal
        isOpen={showFridgeGuardModal}
        onClose={() => setShowFridgeGuardModal(false)}
      />

      {/* PAST EXAM PAPERS VAULT MODAL */}
      <PastPapersVaultModal
        isOpen={showPastPapersModal}
        onClose={() => setShowPastPapersModal(false)}
      />

      {/* NOISE SENTINEL DECIBEL METER MODAL */}
      <NoiseSentinelDecibelModal
        isOpen={showNoiseSentinelModal}
        onClose={() => setShowNoiseSentinelModal(false)}
      />

      {/* CO-LIVING CHORE WHEEL MODAL */}
      <CoLivingChoreWheelModal
        isOpen={showChoreWheelModal}
        onClose={() => setShowChoreWheelModal(false)}
      />

      {/* MOVE-IN SURVIVAL QUEST ONBOARDING MODAL */}
      <MoveInSurvivalQuestModal
        isOpen={showSurvivalQuestModal}
        onClose={() => setShowSurvivalQuestModal(false)}
      />

      {/* JOJO WATER TANK PURITY SENSOR MODAL */}
      <JoJoWaterPurityModal
        isOpen={showJoJoPurityModal}
        onClose={() => setShowJoJoPurityModal(false)}
      />

      {/* ZERO-RATED USSD OFFLINE FALLBACK MODAL */}
      <USSDOfflineFallbackModal
        isOpen={showUSSDModal}
        onClose={() => setShowUSSDModal(false)}
      />

      {lang === 'en' && null /* lang currently drives translations elsewhere; kept in scope for the sidebar language switch */}
    </div>
  )
}

