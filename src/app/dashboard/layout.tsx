'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useDispatch, useSelector } from 'react-redux'
import {
  Home, AlertTriangle,
  Wifi, Users, CheckCircle2,
  Briefcase,
  Megaphone, Wrench, Loader,
  ShieldCheck, MessageCircle, MessagesSquare, UserRound, X, Sparkles
} from 'lucide-react'
import {
  loginUser,
  RootState,
  AppDispatch,
  markAllNotificationsRead,
  GUEST_USER_ID,
  isGuestUser
} from '../../store'
import { supabase } from '../../utils/supabase'
import { subscribeToRealtime, loadNotifications, markNotificationsReadInDb } from '../../store/realtime'
import { unlockNotificationAudio } from '../../utils/notificationSounds'
import { t } from '../../utils/i18n'
import Link from 'next/link'
import AutomationControlPanel from './components/shared/AutomationControlPanel'
import { getNextOfKinStatus, type NextOfKinStatus } from '../../utils/trust'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const dispatch = useDispatch()
  const [showNotifMenu, setShowNotifMenu] = useState(false)
  const [alertNotification, setAlertNotification] = useState<string | null>(null)
  const notifMenuRef = useRef<HTMLDivElement>(null)
  // Browser autoplay policy blocks audio until a real user gesture — this
  // creates/resumes the shared AudioContext on the FIRST click or keypress
  // anywhere in the dashboard, so it's already running by the time a
  // realtime notification arrives and tries to play a tone.
  useEffect(() => {
    const unlock = () => {
      unlockNotificationAudio()
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
    window.addEventListener('pointerdown', unlock)
    window.addEventListener('keydown', unlock)
    return () => {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
  }, [])

  // Guests previously got the "you should sign up" pitch as five separate
  // small nudges scattered across Housing, Services and Profile, each only
  // seen if that specific screen happened to render it. One banner, said
  // once, dismissible — rather than the same pitch repeating on every tab.
  const [guestBannerDismissed, setGuestBannerDismissed] = useState(true)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time sync from sessionStorage on mount
    setGuestBannerDismissed(typeof window !== 'undefined' && sessionStorage.getItem('guestBannerDismissed') === '1')
  }, [])
  const dismissGuestBanner = () => {
    sessionStorage.setItem('guestBannerDismissed', '1')
    setGuestBannerDismissed(true)
  }

  // Next of Kin onboarding requirement — every tenant gets 6 months from
  // signup to add at least one confirmed trust connection (see
  // src/utils/trust.ts). Dismissible per session like the guest banner
  // above, but reappears next session until it's actually done — this is a
  // requirement, not a one-time tip.
  const [nokStatus, setNokStatus] = useState<NextOfKinStatus | null>(null)
  const [nokBannerDismissed, setNokBannerDismissed] = useState(true)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time sync from sessionStorage on mount
    setNokBannerDismissed(typeof window !== 'undefined' && sessionStorage.getItem('nokBannerDismissed') === '1')
  }, [])
  const dismissNokBanner = () => {
    sessionStorage.setItem('nokBannerDismissed', '1')
    setNokBannerDismissed(true)
  }

  const currentUser = useSelector((state: RootState) => state.auth.currentUser)
  const notifications = useSelector((state: RootState) => state.notifications)
  const lang = useSelector((state: RootState) => state.ui.language)
  const dataStatus = useSelector((state: RootState) => state.ui.dataStatus)
  const failedTables = useSelector((state: RootState) => state.ui.failedTables)
  const pendingWrites = useSelector((state: RootState) => state.ui.offlineQueue.length)

  // A real light mode left active by the auth/landing pages' own toggle
  // used to leak in here and render a half-styled mess, because the
  // dashboard is built from hardcoded dark Tailwind utilities rather than
  // the CSS variables those pages read. globals.css now carries a scoped
  // [data-theme='light'] .dashboard-wrapper override layer for the common
  // utility classes, so a real (if not 100% exhaustive) light dashboard is
  // possible — this reads the same localStorage key Profile's toggle
  // writes to, defaulting to dark for anyone who hasn't chosen yet.
  useEffect(() => {
    if (typeof document !== 'undefined') {
      const stored = localStorage.getItem('residentTheme')
      document.documentElement.setAttribute('data-theme', stored === 'light' ? 'light' : 'night')
    }
  }, [])

  useEffect(() => {
    if (currentUser) return
    const bootstrapSession = async () => {
      if (supabase) {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          // A session can land here straight off an OAuth redirect (Google/
          // Facebook), which never goes through performLogin — so this is the
          // only place that call happens for those users. Idempotent and
          // caller-only; a returning email/password user already has both
          // rows, so this is a no-op for them.
          await supabase.rpc('ensure_res_profile').then(() => {}, () => {})
          const { data: dbProfile } = await supabase
            .from('res_profiles')
            .select('role, bio, created_at')
            .eq('id', user.id)
            .single()
          dispatch(loginUser({
            id: user.id,
            name: user.user_metadata?.name || 'Resident User',
            email: user.email || '',
            role: (dbProfile?.role || 'visitor') as 'tenant' | 'landlord' | 'visitor',
            createdAt: dbProfile?.created_at || undefined
          }))
          // A bare ensure_res_profile() default (role never chosen, bio never
          // set) means this is this user's first-ever landing here via a
          // Gruvs/Google/Facebook session — a direct signup always sets both.
          // Route them to the one-time completion form instead of leaving
          // them in the dashboard with silent defaults.
          if ((dbProfile?.role || 'visitor') === 'visitor' && !dbProfile?.bio) {
            router.push('/auth/onboarding')
          }
          return
        }
      }
      const isGuest = document.cookie.split(';').some(c => c.trim().startsWith('guest-mode=1'))
      if (isGuest) {
        dispatch(loginUser({
          id: GUEST_USER_ID,
          name: 'Guest Visitor',
          email: 'visitor@theresidentcrew.com',
          role: 'visitor' as const
        }))
        return
      }
      router.push('/auth')
    }
    bootstrapSession()
  }, [currentUser, router, dispatch])

  useEffect(() => {
    if (!currentUser || isGuestUser(currentUser)) return
    const appDispatch = dispatch as AppDispatch
    loadNotifications(appDispatch)
    const unsubscribe = subscribeToRealtime(appDispatch, currentUser.id)
    return unsubscribe
  }, [currentUser, dispatch])

  useEffect(() => {
    let cancelled = false
    if (!currentUser || isGuestUser(currentUser) || currentUser.role !== 'tenant') {
      // Resolves on a microtask rather than synchronously in the effect body
      // (flagged by the React Compiler's set-state-in-effect check) — still
      // clears stale status from a previous tenant session right away, just
      // not mid-render.
      Promise.resolve().then(() => { if (!cancelled) setNokStatus(null) })
      return () => { cancelled = true }
    }
    getNextOfKinStatus(currentUser.id, currentUser.createdAt).then(status => {
      if (!cancelled) setNokStatus(status)
    })
    return () => { cancelled = true }
  }, [currentUser])

  // Close the notifications dropdown on an outside click — previously the
  // only way to close it was clicking the bell a second time.
  useEffect(() => {
    if (!showNotifMenu) return
    const handleClickOutside = (e: MouseEvent) => {
      if (notifMenuRef.current && !notifMenuRef.current.contains(e.target as Node)) {
        setShowNotifMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showNotifMenu])

  if (!currentUser) {
    return (
      <div className="dashboard-loading">
        <div className="dashboard-loading-spinner" />
        <span>{t('loadingDashboard', lang)}</span>
      </div>
    )
  }

  const coreItems = currentUser.role === 'tenant' || currentUser.role === 'visitor' ? [
    { name: t('navHousing', lang), href: '/dashboard/housing', icon: Home },
    { name: t('navServices', lang), href: '/dashboard/services', icon: Briefcase },
    { name: t('navCommunity', lang), href: '/dashboard/community', icon: Users },
  ] : [
    { name: t('navPortfolio', lang), href: '/dashboard/housing', icon: Home },
    { name: t('navMaintenance', lang), href: '/dashboard/services', icon: Wrench },
    { name: t('navCommunity', lang), href: '/dashboard/community', icon: Users },
  ]
  // Next of Kin lives inside Profile now (it's your safety/trust info, the
  // same category as everything else there) rather than being its own
  // primary destination — freeing a bottom-bar slot for Profile itself,
  // which used to be buried in the hamburger panel despite being a page
  // people actually need to reach often (edit info, check verification).
  // Net: still six items, just a more coherent set of six.
  const socialItems = [
    { name: 'Profile', href: '/dashboard/profile', icon: UserRound },
    { name: 'Feed', href: '/dashboard/gossip', icon: MessagesSquare },
    { name: 'Messages', href: '/dashboard/messages', icon: MessageCircle },
  ]
  const navItems = [...coreItems, ...socialItems]

  // Next of Kin and Business aren't in the bottom bar but are still real
  // routes — without this, visiting either would show the wrong tab (or
  // none) highlighted as "current" in the top bar title.
  const pageTitle =
    pathname === '/dashboard/trust-circle' ? { name: 'Next of Kin', href: pathname, icon: ShieldCheck } :
    pathname === '/dashboard/business' ? { name: 'My Business', href: pathname, icon: Briefcase } :
    navItems.find(item => item.href === pathname) || navItems[0]

  return (
    <div className="dashboard-wrapper">
      {/* These four could previously all be true at once — a loading spinner,
          a failed-table warning, an offline-queue count, and a one-off toast
          stacked three-deep above every page. Only one is ever the MOST
          urgent thing to tell someone, so show just that one, worst-first:
          a failed fetch beats "still loading", which beats routine offline
          queuing, which beats a transient success toast. */}
      <div className="top-alert-banner-stack">
        {dataStatus === 'error' && failedTables.length > 0 ? (
          <div className="top-alert-banner">
            <AlertTriangle size={18} color="#ef4444" />
            <span>Some data couldn&apos;t load ({failedTables.join(', ')}). Retrying automatically.</span>
          </div>
        ) : dataStatus === 'loading' ? (
          <div className="top-alert-banner">
            <Loader size={18} color="#D4AF37" className="animate-spin" />
            <span>Loading your community data…</span>
          </div>
        ) : pendingWrites > 0 ? (
          <div className="top-alert-banner">
            <Wifi size={18} color="#D4AF37" />
            <span>{pendingWrites} change{pendingWrites === 1 ? '' : 's'} waiting to sync — you&apos;re offline.</span>
          </div>
        ) : alertNotification ? (
          <div className="top-alert-banner">
            <CheckCircle2 size={18} color="#22c55e" />
            <span>{alertNotification}</span>
          </div>
        ) : null}
      </div>

      {currentUser && isGuestUser(currentUser) && !guestBannerDismissed && (
        <div className="guest-summary-banner">
          <Sparkles size={16} className="shrink-0" style={{ color: '#D4AF37' }} />
          <span>
            <strong>You&apos;re browsing as a guest.</strong> Sign up free to save listings, message neighbours, post to the feed, and build the trust circle other residents can see.
          </span>
          <Link href="/auth" className="guest-summary-banner-cta">Sign up</Link>
          <button onClick={dismissGuestBanner} aria-label="Dismiss" className="guest-summary-banner-dismiss">
            <X size={14} />
          </button>
        </div>
      )}

      {nokStatus && !nokStatus.hasNextOfKin && !nokBannerDismissed && (
        <div className="guest-summary-banner">
          <ShieldCheck size={16} className="shrink-0" style={{ color: nokStatus.overdue ? '#ef4444' : '#D4AF37' }} />
          <span>
            {nokStatus.overdue ? (
              <><strong>Your trust profile is incomplete.</strong> You haven&apos;t added a Next of Kin yet — your landlord can see this.</>
            ) : nokStatus.daysRemaining !== null ? (
              <><strong>Add a Next of Kin.</strong> You have {nokStatus.daysRemaining} day{nokStatus.daysRemaining === 1 ? '' : 's'} left to complete your trust profile.</>
            ) : (
              <><strong>Add a Next of Kin.</strong> People to notify if something happens to you — required to build full trust on The Resident.</>
            )}
          </span>
          <Link href="/dashboard/trust-circle" className="guest-summary-banner-cta">Add now</Link>
          <button onClick={dismissNokBanner} aria-label="Dismiss" className="guest-summary-banner-dismiss">
            <X size={14} />
          </button>
        </div>
      )}

      {/* No hamburger / "More" panel anymore — Profile, Next of Kin, Business,
          language and Log Out all live on the Profile page now (see
          ProfilePage), reached via the bottom-bar Profile tab. A menu button
          that only ever opened a settings panel had nothing left to hold. */}

      <div className="dashboard-main-content">
        <header className="dashboard-top-bar">
          <div className="dashboard-page-title">
            <pageTitle.icon size={18} />
            <span>{pageTitle.name}</span>
          </div>

          {/* Persistent role indicator — a landlord who got mis-assigned as a
              tenant (or vice versa) previously had no way to even notice
              their current mode short of digging into Profile. Visible on
              every dashboard page now, and doubles as a shortcut to the
              role switcher there. */}
          {!isGuestUser(currentUser) && (
            <Link
              href="/dashboard/profile"
              className="dashboard-role-chip"
              title={`Account mode: ${currentUser.role}. Tap to switch.`}
            >
              {currentUser.role === 'landlord' ? <Briefcase size={12} /> : <Home size={12} />}
              <span>{currentUser.role}</span>
            </Link>
          )}

          {/* The "Map" shortcut used to live here on every single page — dead
              weight on the 5 of 6 tabs that have nothing to do with the map.
              VibeMap is one tap away from Community's own tab bar (and its
              fullscreen entry), so this bar now only carries what's actually
              page-agnostic: notifications. */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginLeft: 'auto' }}>
             <div ref={notifMenuRef} style={{ position: 'relative' }}>
                <button onClick={() => setShowNotifMenu(!showNotifMenu)} style={{ background: 'transparent', border: 'none', color: '#D4AF37', position: 'relative', cursor: 'pointer' }}>
                   <Megaphone size={20} />
                   {notifications.items.filter(n => !n.read).length > 0 && <span className="notif-badge">!</span>}
                </button>
                {showNotifMenu && (
                   <div className="glass-panel" style={{ position: 'absolute', top: '100%', right: 0, width: '300px', maxHeight: '400px', overflowY: 'auto', zIndex: 100, marginTop: '1rem', padding: '1rem' }}>
                      <div className="flex justify-between items-center mb-4 border-b border-white/5 pb-2">
                         <span className="text-xs font-black text-white uppercase tracking-widest">{t('alerts', lang)}</span>
                         <button
                           onClick={() => {
                             dispatch(markAllNotificationsRead())
                             markNotificationsReadInDb()
                             setAlertNotification('All notifications marked as read')
                             setTimeout(() => setAlertNotification(null), 3000)
                           }}
                           className="text-[10px] text-gold-primary font-bold hover:underline"
                         >
                           {t('markAllRead', lang)}
                         </button>
                      </div>
                      <div className="space-y-3">
                         {notifications.items.length === 0 ? (
                            <p className="text-[10px] text-gray-600 italic text-center py-4">{t('noRecentAlerts', lang)}</p>
                         ) : (
                            notifications.items.map(item => (
                               <div key={item.id} className={`p-3 rounded-lg border ${item.read ? 'bg-black/20 border-white/5 opacity-60' : 'bg-gold-primary/5 border-gold-primary/20'}`}>
                                  <p className="text-[10px] font-black text-white uppercase tracking-tight">{item.title}</p>
                                  <p className="text-[10px] text-gray-400 mt-1">{item.message}</p>
                               </div>
                            ))
                         )}
                      </div>
                   </div>
                )}
             </div>
          </div>
        </header>

        <main className="dashboard-page-body">
          {children}
        </main>
      </div>

      <nav className="bottom-nav-bar">
        {navItems.map(item => (
          <Link
            key={item.href}
            href={item.href}
            className={`bottom-nav-item ${pathname === item.href ? 'active' : ''}`}
          >
            <item.icon size={20} />
            <span>{item.name}</span>
          </Link>
        ))}
      </nav>

      <AutomationControlPanel />
    </div>
  )
}
