'use client'

import React, { useEffect, useState } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Megaphone, Wrench, Award, Gavel, ShieldCheck, Briefcase, Home, X, Shield, Users, Zap, Droplets, Lock,
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
  addMarketItem,
  addTool,
  pledgeGroupBuy,
  resolveLostFound,
  toUUID,
  fetchSupabaseData
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
  reportContent
} from '../../../store/actions'
import { supabase } from '../../../utils/supabase'
import NoticeBoardTab from '../components/NoticeBoardTab'
import ToolLibraryTab from '../components/ToolLibraryTab'
import ChoreSchedulerTab from '../components/ChoreSchedulerTab'
import DisputesTab from '../components/DisputesTab'
import SafetyTab from '../components/SafetyTab'
import MarketTab from '../components/MarketTab'
import HouseholdTab from '../components/HouseholdTab'
import CommunitiesTab from '../components/CommunitiesTab'
import EmptyRoomBoard from '../components/EmptyRoomBoard'
import SharedResourcesTab from '../components/SharedResourcesTab'
import CommunityAdminTab from '../components/CommunityAdminTab'
import GruvsConnectionsWidget from '../components/GruvsConnectionsWidget'
import dynamic from 'next/dynamic'
import { formatCurrency, type StatusReport } from '../../../utils/logic'

const VibeMap = dynamic(() => import('../components/VibeMap'), {
  ssr: false,
  loading: () => <div className="p-12 text-slate-400 font-bold text-center">Loading VibeMap client engine...</div>
})

export default function CommunityPage() {
  const dispatch = useDispatch() as AppDispatch
  const [subTab, setSubTab] = useState<'overview' | 'notices' | 'tools' | 'chores' | 'disputes' | 'safety' | 'market' | 'household' | 'communities' | 'vibemap' | 'rooms' | 'resources' | 'admin'>('overview')
  const [preMapTab, setPreMapTab] = useState<Exclude<typeof subTab, 'vibemap'>>('overview')
  const [alertNotification, setAlertNotification] = useState<string | null>(null)

  // Dispute Modal State
  const [showDisputeModal, setShowDisputeModal] = useState(false)
  const [disputeTitle, setDisputeTitle] = useState('')
  const [disputeDesc, setDisputeDesc] = useState('')
  const [disputeCategory, setDisputeCategory] = useState<'Noise' | 'Messiness' | 'Utility overuse' | 'Chore avoidance' | 'Security breach' | 'Other'>('Noise')

  // Create-community modal state (CommunitiesTab is presentation-only; the form lives here)
  const [showCreateCommunity, setShowCreateCommunity] = useState(false)

  const currentUser = useSelector((state: RootState) => state.auth.currentUser)
  const lang = useSelector((state: RootState) => state.ui.language)
  const listings = useSelector((state: RootState) => state.listings.items)
  const requests = useSelector((state: RootState) => state.requests.items)
  const roommates = useSelector((state: RootState) => state.networking.roommates)

  // Data from Redux
  const communityNotices = useSelector((state: RootState) => state.community.notices)
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
    if (!currentUser || currentUser.id === 'visitor-guest' || !supabase) return
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
    if (!currentUser || currentUser.id === 'visitor-guest' || !supabase || myCommunityIds.length === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
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

  const handlePostNotice = (data: { title: string; description: string; type: 'notice' | 'event' }) => {
    if (!currentUser) return
    dispatch(addNoticeEvent({
      id: `notice-${Date.now()}`,
      title: data.title,
      description: data.description,
      type: data.type,
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
  // one to the other so real data reaches real UI.
  const adaptedChores = communityChores.map(c => ({
    id: c.id,
    title: c.taskName,
    assignedTo: c.roommateId,
    status: c.status,
    dueDate: c.dayOfWeek,
    points: 10
  }))

  const adaptedDisputes = communityDisputes.map(d => ({
    id: d.id,
    title: d.title,
    description: d.description,
    category: d.category,
    reportedBy: d.reportedBy,
    againstUser: d.againstUser,
    status: (d.status === 'mediating' ? 'investigating' : d.status) as 'pending' | 'resolved' | 'investigating',
    timestamp: d.timestamp,
    resolutionDetails: d.resolutionDetails
  }))

  const adaptedCommunities = communities.map(c => ({
    id: c.id,
    name: c.name,
    kind: c.kind,
    suburb: c.suburb,
    memberCount: communityMemberCounts[toUUID(c.id)] || 0
  }))

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
        { id: 'rooms', label: 'Empty Rooms', icon: Zap },
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
    if (subTab === 'vibemap') { setSubTab(preMapTab) } else { setPreMapTab(subTab as Exclude<typeof subTab, 'vibemap'>); setSubTab('vibemap') }
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8 pb-32">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
             <div className="p-2 bg-gold-primary/10 rounded-lg">
                <Users size={28} className="text-gold-primary" />
             </div>
             <h1 className="text-3xl md:text-4xl font-black text-white tracking-tighter uppercase italic">Community <span className="text-gold-primary">Hub</span></h1>
          </div>
          <p className="text-gray-500 text-sm font-bold uppercase tracking-widest opacity-60 ml-1">Connect, Share Resources & Protect Your Neighborhood</p>
        </div>

        <button
          onClick={toggleVibeMap}
          title="VibeMap"
          aria-label="Toggle VibeMap"
          className={`hidden md:inline-flex items-center justify-center w-11 h-11 rounded-2xl border shrink-0 transition-all ${subTab === 'vibemap' ? 'bg-gold-primary text-black border-gold-primary shadow-lg shadow-gold-primary/20' : 'bg-black/40 text-gray-500 border-white/5 hover:text-gold-primary hover:border-gold-primary/30'}`}
        >
          <MapIcon size={18} />
        </button>
      </header>

      {/* CLUSTERED TAB BAR */}
      <div className="bg-black/40 p-3 md:p-4 rounded-2xl border border-white/5 shadow-2xl backdrop-blur-xl space-y-3">
        <div className="flex flex-wrap items-center gap-2 overflow-x-auto no-scrollbar">
          <button
            onClick={() => goToTab('overview')}
            className={`px-4 py-2 rounded-xl transition-all text-[10px] font-black uppercase tracking-widest flex items-center gap-2 whitespace-nowrap ${subTab === 'overview' ? 'bg-gold-primary text-black shadow-lg shadow-gold-primary/20' : 'text-gray-500 hover:text-white bg-white/5'}`}
          >
            <LayoutGrid size={12} /> Overview
          </button>
          <button
            onClick={toggleVibeMap}
            className={`md:hidden px-4 py-2 rounded-xl transition-all text-[10px] font-black uppercase tracking-widest flex items-center gap-2 whitespace-nowrap ${subTab === 'vibemap' ? 'bg-gold-primary text-black shadow-lg shadow-gold-primary/20' : 'text-gray-500 hover:text-white bg-white/5'}`}
          >
            <MapIcon size={12} /> VibeMap
          </button>
        </div>

        <div className="flex flex-wrap gap-x-8 gap-y-4 overflow-x-auto no-scrollbar">
          {clusters.map(cluster => (
            <div key={cluster.id} className="space-y-1.5 min-w-0">
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-600 ml-1">{cluster.label}</p>
              <div className="flex items-center gap-1.5">
                {cluster.tabs.map(t => (
                  <button
                    key={t.id}
                    onClick={() => goToTab(t.id as typeof subTab)}
                    className={`px-3.5 py-2 rounded-xl transition-all text-[10px] font-black uppercase tracking-widest flex items-center gap-2 whitespace-nowrap border ${
                      subTab === t.id
                        ? 'bg-gold-primary text-black border-gold-primary shadow-lg shadow-gold-primary/20'
                        : 'text-gray-400 border-white/5 hover:text-white hover:border-white/20'
                    }`}
                  >
                    <span className={`p-1 rounded-lg ${subTab === t.id ? 'bg-black/10' : cluster.accent}`}>
                      <t.icon size={11} />
                    </span>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
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
               <NoticeBoardTab
                  communityNotices={communityNotices}
                  currentUser={currentUser}
                  handleVibeNotice={(id) => dispatch(vibeNotice({ noticeId: id, userName: currentUser?.name || '' }))}
                  handleEchoNotice={(id) => dispatch(echoNotice({ noticeId: id, userName: currentUser?.name || '' }))}
                  handleRSVPToEvent={(id) => dispatch(rsvpToEvent({ noticeId: id, userName: currentUser?.name || '' }))}
                  handlePostNotice={handlePostNotice}
                  isModerator={isModerator}
                  onModerate={handleModerate}
               />
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
            {subTab === 'rooms' && (
              <EmptyRoomBoard currentUserId={currentUser?.id || ''} defaultCurrency={defaultCurrency} />
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
              />
            )}
            {subTab === 'chores' && (
              <ChoreSchedulerTab communityChores={adaptedChores} currentUser={currentUser} reputationScores={reputationScores} handleCompleteChore={handleCompleteChore} />
            )}
            {subTab === 'disputes' && (
              <DisputesTab communityDisputes={adaptedDisputes} currentUser={currentUser} onFileDispute={() => setShowDisputeModal(true)} />
            )}
            {subTab === 'household' && (
              <HouseholdTab
                householdListingId={householdListingId}
                householdName={householdName}
                members={householdMembers}
                chores={adaptedChores}
                reputationScores={reputationScores}
                currentUserId={currentUser?.id || ''}
                styles={{}}
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

      {lang === 'en' && null /* lang currently drives translations elsewhere; kept in scope for the sidebar language switch */}
    </div>
  )
}
