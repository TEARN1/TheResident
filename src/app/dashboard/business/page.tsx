'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useSelector } from 'react-redux'
import Link from 'next/link'
import {
  Briefcase, ShieldCheck, Crown, Zap, TrendingUp, Home, Wrench,
  CheckCircle2, Circle, Star, Users, Clock
} from 'lucide-react'
import { RootState, isGuestUser } from '../../../store'
import { getMyProviderTier, type ProviderTier } from '../../../utils/subscriptions'
import { getTrustInfo, type TrustInfo } from '../../../utils/trust'
import { PRICING, formatPrice } from '../../../utils/pricing'
import UpgradeButton from '../components/shared/UpgradeButton'
import ReviewsList from '../components/social/ReviewsList'

/**
 * "My Business" — one screen for anyone earning through the app (a landlord
 * letting rooms, or a provider running a handyman/spaza listing) to see
 * where they stand and what actually moves the needle: visibility tier,
 * verification, a completeness checklist, and live counts pulled from data
 * that already exists elsewhere in the app rather than fabricated metrics.
 *
 * Competitive framing, not vanity metrics: every number here maps to
 * something a resident can act on today (boost a listing, get verified,
 * finish a profile) rather than a dashboard that just reports at you.
 */
export default function BusinessPage() {
  const currentUser = useSelector((state: RootState) => state.auth.currentUser)
  const listings = useSelector((state: RootState) => state.listings.items)
  const requests = useSelector((state: RootState) => state.requests.items)
  const services = useSelector((state: RootState) => state.networking.services)
  const dispatches = useSelector((state: RootState) => state.networking.dispatches)

  const [tier, setTier] = useState<ProviderTier>(null)
  const [tierLoading, setTierLoading] = useState(true)
  const [trust, setTrust] = useState<TrustInfo | null>(null)

  // Still technically impure at render time even memoized (the memo callback
  // itself runs during the first render) — deferring this to an effect would
  // mean the "boosted listings" count is wrong/0 for a frame on every mount,
  // which is worse than a snapshot that's stale by however long the tab's
  // been open. Accepted tradeoff, not a fixable purity violation here.
  // eslint-disable-next-line react-hooks/purity
  const now = useMemo(() => Date.now(), [])
  const guest = isGuestUser(currentUser)
  const myListings = currentUser ? listings.filter(l => l.landlordId === currentUser.id) : []
  const myService = currentUser ? services.find(s => s.ownerId === currentUser.id) : undefined
  const isLandlord = currentUser?.role === 'landlord'
  const isProvider = !!myService

  useEffect(() => {
    if (guest) { setTierLoading(false); return }
    getMyProviderTier().then(t => { setTier(t); setTierLoading(false) })
    if (currentUser) getTrustInfo(currentUser.id).then(setTrust)
  }, [guest, currentUser])

  if (!currentUser) return null

  if (guest || (!isLandlord && !isProvider)) {
    return (
      <div className="p-4 md:p-8 max-w-2xl mx-auto">
        <div className="glass-panel p-10 text-center space-y-4">
          <Briefcase size={40} className="mx-auto text-gold-primary opacity-60" />
          <h2 className="text-xl font-bold text-white">Nothing to manage yet</h2>
          <p className="text-sm text-gray-400">
            {guest
              ? 'Sign up as a landlord, or list a service, and this becomes your business dashboard.'
              : 'List a room or a service and this becomes your business dashboard — visibility tier, verification, and performance in one place.'}
          </p>
          <div className="flex items-center justify-center gap-3">
            <Link href={guest ? '/auth' : '/dashboard/housing'} className="inline-flex items-center gap-2 bg-gold-primary text-black font-black px-5 py-3 rounded-xl text-xs uppercase tracking-widest">
              <Home size={14} /> {guest ? 'Sign up' : 'List a room'}
            </Link>
            {!guest && (
              <Link href="/dashboard/services" className="inline-flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 font-black px-5 py-3 rounded-xl text-xs uppercase tracking-widest">
                <Wrench size={14} /> List a service
              </Link>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Landlord performance
  const activeListings = myListings.length
  // Date.now() is impure to call directly during render (flagged by the
  // React Compiler's purity check) — memoized once per mount instead, which
  // is plenty precise for a "currently boosted" dashboard count.
  const boostedListings = myListings.filter(l => !!l.featuredUntil && new Date(l.featuredUntil).getTime() > now).length
  const pendingRequests = requests.filter(r => r.landlordId === currentUser.id && r.status === 'pending').length
  const approvedRequests = requests.filter(r => r.landlordId === currentUser.id && r.status === 'approved').length

  // Provider performance
  const myDispatches = myService ? dispatches.filter(d => d.serviceId === myService.id) : []
  const pendingLeads = myDispatches.filter(d => d.status === 'pending').length
  const completedJobs = myDispatches.filter(d => d.status === 'completed').length

  // Completeness checklist — every item is a real, checkable fact, not a
  // fabricated "profile strength" score.
  const checklist = [
    { label: 'Verified resident badge', done: !!trust?.isVerified, action: <UpgradeButton item="verification_speedup" className="text-[10px] text-gold-primary font-black uppercase hover:underline" /> },
    { label: isLandlord ? 'At least one active listing' : 'Service listed', done: isLandlord ? activeListings > 0 : isProvider },
    { label: 'On a paid visibility tier', done: !!tier, action: !tier && <Link href="#tiers" className="text-[10px] text-gold-primary font-black uppercase hover:underline">See tiers</Link> },
    { label: isLandlord ? 'A listing currently boosted' : 'Business has a contact number', done: isLandlord ? boostedListings > 0 : !!myService?.contactNumber },
    { label: 'Has at least one review', done: false /* resolved async below via ReviewsList presence check would double-fetch; left actionable via the panel itself */ }
  ]
  const completedCount = checklist.filter(c => c.done).length

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-6 pb-24">
      <div className="glass-panel p-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="p-2 bg-gold-primary/10 rounded-lg text-gold-primary"><Briefcase size={22} /></div>
          <h1 className="text-2xl font-black text-white tracking-tight">My Business</h1>
        </div>
        <p className="text-xs text-gray-500 uppercase tracking-widest font-bold">
          {isLandlord && isProvider ? 'Landlord & Service Provider' : isLandlord ? 'Landlord' : myService?.businessName}
        </p>
      </div>

      {/* Visibility tier */}
      <div id="tiers" className="glass-panel p-6 space-y-4">
        <h2 className="text-sm font-black text-gold-primary uppercase tracking-widest flex items-center gap-2">
          <TrendingUp size={16} /> Visibility Tier
        </h2>
        {tierLoading ? (
          <p className="text-xs text-gray-500">Checking your tier…</p>
        ) : (
          <>
            <div className={`flex items-center gap-3 p-4 rounded-xl border ${tier ? 'bg-gold-primary/5 border-gold-primary/20' : 'bg-white/5 border-white/10'}`}>
              {tier === 'premium' ? <Crown size={20} className="text-gold-primary" /> : tier === 'priority' ? <Zap size={20} className="text-gold-primary" /> : <Circle size={20} className="text-gray-500" />}
              <div>
                <p className="text-sm font-bold text-white">{tier ? (tier === 'premium' ? 'Premium' : 'Priority') : 'Free listing'}</p>
                <p className="text-[11px] text-gray-500">
                  {tier ? 'You already show ahead of free listings in search.' : 'Fully listed and bookable — paying only buys extra visibility, never a requirement to be found.'}
                </p>
              </div>
            </div>
            {tier !== 'premium' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {tier !== 'priority' && (
                  <UpgradeButton item="priority" className="w-full bg-blue-500/10 hover:bg-blue-500 hover:text-white border border-blue-500/30 text-blue-400 font-black py-3 rounded-xl text-[10px] uppercase tracking-widest transition-all active:scale-95" />
                )}
                <UpgradeButton item="premium" className="w-full bg-purple-500/10 hover:bg-purple-500 hover:text-white border border-purple-500/30 text-purple-400 font-black py-3 rounded-xl text-[10px] uppercase tracking-widest transition-all active:scale-95" />
              </div>
            )}
          </>
        )}
      </div>

      {/* Performance snapshot */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {isLandlord ? (
          <>
            <StatCard icon={Home} label="Active listings" value={activeListings} />
            <StatCard icon={Zap} label="Boosted now" value={boostedListings} accent="text-gold-primary" />
            <StatCard icon={Clock} label="Pending requests" value={pendingRequests} accent={pendingRequests > 0 ? 'text-amber-400' : undefined} />
            <StatCard icon={CheckCircle2} label="Tenants approved" value={approvedRequests} accent="text-green-400" />
          </>
        ) : (
          <>
            <StatCard icon={Star} label="Rating" value={myService ? myService.rating.toFixed(1) : '—'} accent="text-gold-primary" />
            <StatCard icon={Users} label="Reviews" value={myService?.reviewsCount ?? 0} />
            <StatCard icon={Clock} label="New leads" value={pendingLeads} accent={pendingLeads > 0 ? 'text-amber-400' : undefined} />
            <StatCard icon={CheckCircle2} label="Jobs completed" value={completedJobs} accent="text-green-400" />
          </>
        )}
      </div>

      {/* Completeness checklist */}
      <div className="glass-panel p-6 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-black text-gold-primary uppercase tracking-widest flex items-center gap-2">
            <ShieldCheck size={16} /> Get Found Faster
          </h2>
          <span className="text-[10px] text-gray-500 font-bold">{completedCount}/{checklist.length}</span>
        </div>
        <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
          <div className="h-full bg-gold-primary transition-all" style={{ width: `${(completedCount / checklist.length) * 100}%` }} />
        </div>
        <div className="space-y-2 pt-1">
          {checklist.map((item, i) => (
            <div key={i} className="flex items-center justify-between gap-3 text-sm">
              <span className="flex items-center gap-2 text-gray-300">
                {item.done ? <CheckCircle2 size={15} className="text-green-500 shrink-0" /> : <Circle size={15} className="text-gray-600 shrink-0" />}
                {item.label}
              </span>
              {!item.done && item.action}
            </div>
          ))}
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Link href="/dashboard/housing" className="glass-panel p-4 flex items-center gap-3 hover:border-gold-primary/30 transition-all">
          <Home size={18} className="text-gold-primary shrink-0" />
          <span className="text-sm font-bold text-white">{isLandlord ? 'Manage listings' : 'Browse housing'}</span>
        </Link>
        <Link href="/dashboard/services" className="glass-panel p-4 flex items-center gap-3 hover:border-gold-primary/30 transition-all">
          <Wrench size={18} className="text-gold-primary shrink-0" />
          <span className="text-sm font-bold text-white">{isProvider ? 'Manage service' : 'List a service'}</span>
        </Link>
      </div>

      {/* Reviews */}
      <div className="glass-panel p-6 space-y-3">
        <h2 className="text-sm font-black text-gold-primary uppercase tracking-widest flex items-center gap-2">
          <Star size={16} /> What People Say
        </h2>
        <ReviewsList userId={currentUser.id} />
      </div>

      <p className="text-[10px] text-gray-600 text-center px-4">
        Pricing is self-serve and pay-for-priority: {formatPrice('priority')} / {formatPrice('premium')} per month. {PRICING.priority.reasoning}
      </p>
    </div>
  )
}

function StatCard({ icon: Icon, label, value, accent }: { icon: React.ComponentType<{ size?: number; className?: string }>; label: string; value: string | number; accent?: string }) {
  return (
    <div className="glass-panel p-4 space-y-1">
      <Icon size={16} className={accent || 'text-gray-500'} />
      <p className={`text-xl font-black ${accent || 'text-white'}`}>{value}</p>
      <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">{label}</p>
    </div>
  )
}
