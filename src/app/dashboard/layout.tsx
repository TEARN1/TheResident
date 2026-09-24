'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useDispatch, useSelector } from 'react-redux'
import {
  Home, AlertTriangle,
  Wifi, Users, CheckCircle2,
  Briefcase,
  Megaphone, Wrench, Loader,
  ShieldCheck, MessageCircle, MessagesSquare, UserRound, X, Sparkles, ExternalLink, Github
} from 'lucide-react'
import Image from 'next/image'
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
import CommandPalette from './components/navigation/CommandPalette'
import FloatingEmergencySOS from './components/shared/FloatingEmergencySOS'
import PWAInstallBanner from './components/shared/PWAInstallBanner'
import { playTactileSound } from '../../utils/tactileSounds'
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

      {/* One onboarding slot, not two independently-rendered banners — same
          "only one at a time" principle as the alert-banner stack above.
          In practice these were already mutually exclusive (nokStatus is
          explicitly nulled for guest users, see the effect above), but
          expressing that as a single slot keeps it that way structurally
          rather than by coincidence, and matches the established pattern
          instead of being a third, ad hoc way of stacking banners. */}
      {currentUser && isGuestUser(currentUser) && !guestBannerDismissed ? (
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
      ) : nokStatus && !nokStatus.hasNextOfKin && !nokBannerDismissed ? (
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
      ) : null}

      {/* No hamburger / "More" panel anymore — Profile, Next of Kin, Business,
          language and Log Out all live on the Profile page now (see
          ProfilePage), reached via the bottom-bar Profile tab. A menu button
          that only ever opened a settings panel had nothing left to hold. */}

      <div className="dashboard-main-content">
        <header className="sticky top-0 z-40 h-16 bg-black/60 backdrop-blur-2xl border-b border-white/10 px-4 md:px-6 flex items-center justify-between transition-all">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gold-primary/10 border border-gold-primary/30 flex items-center justify-center text-gold-primary shadow-glow">
              <pageTitle.icon size={18} />
            </div>
            <div className="flex items-center gap-2">
              <span className="font-black text-sm tracking-wide text-white uppercase">{pageTitle.name}</span>
              {!isGuestUser(currentUser) && (
                <Link
                  href="/dashboard/profile"
                  className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-gold-primary/10 text-gold-primary border border-gold-primary/30 hover:bg-gold-primary/20 transition-all"
                  title={`Mode: ${currentUser.role}. Tap to switch.`}
                >
                  {currentUser.role === 'landlord' ? <Briefcase size={10} /> : <Home size={10} />}
                  <span>{currentUser.role}</span>
                </Link>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 md:gap-3">
            {/* Global Spotlight Palette Trigger (Ctrl+K) */}
            <CommandPalette />

            {/* Ecosystem Badges: The Gruvs & TEARNs Excellence */}
            <a
              href="https://thegruvs.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider bg-gold-primary/10 hover:bg-gold-primary/20 text-gold-primary border border-gold-primary/30 transition-all shadow-sm group/gruvs"
              title="Visit The Gruvs (our sister live events & student nightlife platform)"
            >
              <Image
                src="/gruvs-logo.png"
                alt="The Gruvs"
                width={14}
                height={14}
                className="rounded-full object-cover group-hover/gruvs:rotate-12 transition-transform"
              />
              <span className="hidden sm:inline">The Gruvs</span>
              <ExternalLink size={10} className="opacity-60" />
            </a>

            <a
              href="https://github.com/TEARN1/TEARNs-Excellence"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white border border-white/10 transition-all"
              title="Built with TEARNs Excellence Standards"
            >
              <Github size={12} className="text-gold-primary" />
              <span>TEARN&apos;s Excellence</span>
            </a>

            <div ref={notifMenuRef} className="relative">
              <button
                onClick={() => { setShowNotifMenu(!showNotifMenu); playTactileSound('click') }}
                className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-gray-300 hover:text-gold-primary transition-all relative"
                aria-label="Open notifications"
              >
                <Megaphone size={16} />
                {notifications.items.filter(n => !n.read).length > 0 && (
                  <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-black animate-pulse" />
                )}
              </button>

              <AnimatePresence>
                {showNotifMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute top-full right-0 mt-3 w-80 max-h-96 bg-black/90 backdrop-blur-3xl border border-white/15 rounded-2xl shadow-glass overflow-hidden z-50 p-4 space-y-3"
                  >
                    <div className="flex justify-between items-center pb-2 border-b border-white/10">
                      <span className="text-[10px] font-black text-white uppercase tracking-widest flex items-center gap-1.5">
                        <Megaphone size={12} className="text-gold-primary" /> {t('alerts', lang)}
                      </span>
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

                    <div className="space-y-2 overflow-y-auto max-h-64 custom-scrollbar pr-1">
                      {notifications.items.length === 0 ? (
                        <p className="text-xs text-gray-500 italic text-center py-6">{t('noRecentAlerts', lang)}</p>
                      ) : (
                        notifications.items.map(item => (
                          <div
                            key={item.id}
                            className={`p-2.5 rounded-xl border text-xs transition-all ${
                              item.read ? 'bg-white/2 border-white/5 opacity-50' : 'bg-gold-primary/5 border-gold-primary/20 text-white'
                            }`}
                          >
                            <p className="font-bold text-gray-200">{item.title}</p>
                            <p className="text-[11px] text-gray-400 mt-0.5 leading-relaxed">{item.message}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>

        <main className="dashboard-page-body pb-28">
          {children}
        </main>
      </div>

      <nav className="fixed bottom-3 left-3 right-3 max-w-lg mx-auto z-50 bg-black/70 backdrop-blur-3xl border border-white/15 rounded-3xl p-1.5 shadow-glass flex items-center justify-around">
        {navItems.map(item => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => playTactileSound('tab')}
              className={`flex flex-col items-center justify-center flex-1 py-1.5 px-1 rounded-2xl transition-all relative group ${
                isActive ? 'text-black' : 'text-gray-400 hover:text-white'
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId="activeTabIndicator"
                  className="absolute inset-0 bg-gold-primary rounded-2xl shadow-glow"
                  transition={{ type: 'spring', damping: 25, stiffness: 350 }}
                />
              )}
              <div className="relative z-10 flex flex-col items-center gap-0.5">
                <item.icon size={18} className="transition-transform group-hover:scale-110" />
                <span className="text-[9px] font-black uppercase tracking-wider">{item.name}</span>
              </div>
            </Link>
          )
        })}
      </nav>

      <AutomationControlPanel />
      <FloatingEmergencySOS />
      <PWAInstallBanner />
    </div>
  )
}
