'use client'

import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter, usePathname } from 'next/navigation'
import { useDispatch, useSelector } from 'react-redux'
import {
  Home, AlertTriangle,
  Wifi, Users, CheckCircle2,
  Briefcase,
  Megaphone, Wrench, Loader,
  ShieldCheck, MessageCircle, UserRound, X, Sparkles, ExternalLink, Palette,
  MapPin, 
} from 'lucide-react'
import Image from 'next/image'
import {
  loginUser,
  RootState,
  AppDispatch,
  markAllNotificationsRead,
  GUEST_USER_ID,
  isGuestUser,
  fetchPublicListings
} from '../../store'
import { supabase } from '../../utils/supabase'
import { trackVisitOnce } from '../../utils/track'
import { subscribeToRealtime, loadNotifications, markNotificationsReadInDb } from '../../store/realtime'
import { unlockNotificationAudio } from '../../utils/notificationSounds'
import { t } from '../../utils/i18n'
import Link from 'next/link'
import CommandPalette from './components/navigation/CommandPalette'
import PointerSpotlight from './components/shared/PointerSpotlight'
import CallProvider from './components/messages/CallProvider'
import PWAInstallBanner from './components/shared/PWAInstallBanner'
import ThemeSwitcherModal from './components/shared/ThemeSwitcherModal'
import UrbanDynamicIsland from './components/navigation/UrbanDynamicIsland'
import ActionOrb from './components/navigation/ActionOrb'
import { DEFAULT_THEME } from '../../utils/themes'
import { playTactileSound } from '../../utils/tactileSounds'
import { getNextOfKinStatus, type NextOfKinStatus } from '../../utils/trust'
import { GRUVS } from '../../utils/sisterApps'
import { ReduxProvider } from '../../store/provider'

// The store is provided here rather than in the root layout (see
// app/layout.tsx), so the shell below sits inside its own provider.
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <ReduxProvider>
      <DashboardShell>{children}</DashboardShell>
    </ReduxProvider>
  )
}

function DashboardShell({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const dispatch = useDispatch()
  const [showNotifMenu, setShowNotifMenu] = useState(false)
  const [notifFilter, setNotifFilter] = useState<'all' | 'unread'>('all')
  const [showThemeModal, setShowThemeModal] = useState(false)
  const [currentTheme, setCurrentTheme] = useState<string>(DEFAULT_THEME)
  const [alertNotification, setAlertNotification] = useState<string | null>(null)
  const notifMenuRef = useRef<HTMLDivElement>(null)

  // Browser autoplay policy audio unlock on first user gesture
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

  // Guest banner dismissal
  const [guestBannerDismissed, setGuestBannerDismissed] = useState(true)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time sync from sessionStorage on mount
    setGuestBannerDismissed(typeof window !== 'undefined' && sessionStorage.getItem('guestBannerDismissed') === '1')
  }, [])
  const dismissGuestBanner = () => {
    sessionStorage.setItem('guestBannerDismissed', '1')
    setGuestBannerDismissed(true)
  }

  // Next of Kin onboarding requirement
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
  const roomsListed = useSelector((state: RootState) => state.listings.items.length)
  const activeAlerts = useSelector((state: RootState) => state.community.alerts.filter(a => a.status === 'active').length)
  const isGuest = isGuestUser(currentUser)

  // Theme setup
  useEffect(() => {
    if (typeof document !== 'undefined') {
      const stored = localStorage.getItem('residentTheme')
      const valid = ['minimal-green', 'crimson-cyber', 'liquid-glass', 'midnight-violet', 'light', 'night']
      if (stored && valid.includes(stored)) {
        document.documentElement.setAttribute('data-theme', stored)
        // eslint-disable-next-line react-hooks/set-state-in-effect -- apply stored theme
        setCurrentTheme(stored)
      } else {
        document.documentElement.setAttribute('data-theme', 'minimal-green')
        setCurrentTheme('minimal-green')
      }
    }
  }, [])

  // Session bootstrap: restore existing Supabase user or activate guest visitor
  useEffect(() => {
    if (currentUser) return
    let cancelled = false
    const bootstrapSession = async () => {
      try {
        if (supabase) {
          const { data: { user } } = await supabase.auth.getUser()
          if (user && !cancelled) {
            await supabase.rpc('ensure_res_profile').then(() => {}, () => {})
            const { data: dbProfile } = await supabase
              .from('res_profiles')
              .select('role, bio, created_at')
              .eq('id', user.id)
              .single()
            if (!cancelled) {
              dispatch(loginUser({
                id: user.id,
                name: user.user_metadata?.name || 'Resident User',
                email: user.email || '',
                role: (dbProfile?.role || 'visitor') as 'tenant' | 'landlord' | 'visitor',
                createdAt: dbProfile?.created_at || undefined
              }))
              if ((dbProfile?.role || 'visitor') === 'visitor' && !dbProfile?.bio) {
                router.push('/auth/onboarding')
              }
              return
            }
          }
        }
      } catch (err) {
        console.warn('Session bootstrap error:', err)
      }

      if (!cancelled) {
        if (typeof document !== 'undefined') {
          document.cookie = `guest-mode=1; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax`
        }
        dispatch(loginUser({
          id: GUEST_USER_ID,
          name: 'Guest Visitor',
          email: 'visitor@theresidentcrew.com',
          role: 'visitor' as const
        }))
      }
    }
    bootstrapSession()
    return () => { cancelled = true }
  }, [currentUser, dispatch, router])

  // Guests can read public listings:
  useEffect(() => {
    if (isGuest) {
      const appDispatch = dispatch as AppDispatch
      appDispatch(fetchPublicListings())
    }
  }, [isGuest, dispatch])

  useEffect(() => {
    if (currentUser) trackVisitOnce({ guest: isGuest })
  }, [currentUser, isGuest])

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
      Promise.resolve().then(() => { if (!cancelled) setNokStatus(null) })
      return () => { cancelled = true }
    }
    getNextOfKinStatus(currentUser.id, currentUser.createdAt).then(status => {
      if (!cancelled) setNokStatus(status)
    })
    return () => { cancelled = true }
  }, [currentUser])

  // Close notifications dropdown on outside click
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

  // Desktop Left Sidebar Navigation items (Full feature spectrum)
  const desktopNavItems = [
    { name: 'Home', href: '/dashboard', icon: Home, exact: true },
    { name: 'Vibe Map', href: '/dashboard/community?tab=vibemap', icon: MapPin },
    { name: 'Housing', href: '/dashboard/housing', icon: currentUser.role === 'landlord' ? Briefcase : Home },
    { name: 'Town Square', href: '/dashboard/community', icon: Users, isCommunity: true },
    { name: 'Services', href: '/dashboard/services', icon: Wrench },
    { name: 'Messages', href: '/dashboard/messages', icon: MessageCircle, unreadCount: notifications.items.filter(n => !n.read).length },
    { name: 'Profile', href: '/dashboard/profile', icon: UserRound },
  ]

  // Mobile Bottom Navigation Dock (Kinetic 5-Point Touch Layout)
  const mobileNavLeft = [
    { name: 'Home', href: '/dashboard', icon: Home, exact: true },
    { name: 'Map', href: '/dashboard/community?tab=vibemap', icon: MapPin },
  ]
  const mobileNavRight = [
    { name: 'Housing', href: '/dashboard/housing', icon: Home },
    { name: 'Messages', href: '/dashboard/messages', icon: MessageCircle, unreadCount: notifications.items.filter(n => !n.read).length },
  ]

  // Dynamic Header Title resolution
  const pageTitle =
    pathname === '/dashboard' ? { name: 'Home', icon: Home } :
    pathname === '/dashboard/trust-circle' ? { name: 'Next of Kin', icon: ShieldCheck } :
    pathname === '/dashboard/business' ? { name: 'My Business', icon: Briefcase } :
    pathname === '/dashboard/housing' ? { name: 'Housing', icon: Home } :
    pathname === '/dashboard/services' ? { name: 'Services', icon: Wrench } :
    pathname === '/dashboard/community' ? { name: 'Town Square', icon: Users } :
    pathname.startsWith('/dashboard/messages') ? { name: 'Messages', icon: MessageCircle } :
    pathname === '/dashboard/profile' ? { name: 'Profile', icon: UserRound } :
    { name: 'Home', icon: Home }

  return (
    <CallProvider
      myId={currentUser && !isGuestUser(currentUser) ? currentUser.id : null}
      myName={currentUser?.name}
    >
      <div className="dashboard-wrapper">
        <div className="ambient-backdrop" aria-hidden="true">
          <div className="ambient-orb ambient-orb--a" />
          <div className="ambient-orb ambient-orb--b" />
          <div className="ambient-orb ambient-orb--c" />
          <div className="ambient-grid" />
        </div>
        <PointerSpotlight />

        {/* ============================================================== */}
        {/* TABLET & DESKTOP PERMANENT NAVIGATION SIDEBAR                  */}
        {/* (Tablet md: 80px slim icon rail | Desktop lg: 256px full shell) */}
        {/* ============================================================== */}
        <aside className="hidden md:flex fixed left-0 top-0 bottom-0 w-20 lg:w-64 z-50 bg-black/85 backdrop-blur-3xl border-r border-white/10 flex-col justify-between p-2.5 lg:p-4 pointer-events-auto transition-all duration-200">
          <div className="space-y-4 lg:space-y-6">
            {/* Brand Logo & Urban OS Subtitle */}
            <Link
              href="/dashboard"
              onClick={() => playTactileSound('tab')}
              className="flex items-center justify-center lg:justify-start gap-3 px-1 lg:px-2 group"
              title="The Resident — Living Urban OS"
            >
              <div className="w-10 h-10 rounded-2xl bg-gold-primary/10 border border-gold-primary/30 flex items-center justify-center text-gold-primary group-hover:scale-105 transition-transform shrink-0">
                <Home size={20} />
              </div>
              <div className="hidden lg:flex flex-col">
                <span className="font-black text-sm text-white tracking-widest uppercase group-hover:text-gold-primary transition-colors">
                  The Resident
                </span>
                <span className="text-[10px] font-mono uppercase tracking-widest text-gold-primary/80">
                  Urban OS
                </span>
              </div>
            </Link>

            {/* Navigation Links */}
            <nav className="space-y-1.5" aria-label="Primary navigation rail">
              {desktopNavItems.map(item => {
                const isActive = item.exact
                  ? pathname === item.href
                  : item.isCommunity
                  ? pathname === item.href
                  : pathname === item.href || pathname.startsWith(item.href + '/')

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => playTactileSound('tab')}
                    className={`relative group flex items-center justify-center lg:justify-between px-2.5 lg:px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all ${
                      isActive
                        ? 'bg-gold-primary text-black font-black'
                        : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
                    }`}
                    title={item.name}
                  >
                    <div className="flex items-center gap-3">
                      <item.icon size={18} className={isActive ? 'text-black' : 'text-gray-400'} />
                      <span className="hidden lg:inline">{item.name}</span>
                    </div>

                    {/* Tablet hover tooltip */}
                    <span className="lg:hidden absolute left-full ml-2 px-2 py-1 rounded-lg bg-black/95 border border-white/20 text-[10px] font-bold text-white whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
                      {item.name}
                    </span>

                    {/* Notification badges */}
                    {item.unreadCount && item.unreadCount > 0 ? (
                      <>
                        <span className="lg:hidden absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                        <span className="hidden lg:inline-block px-1.5 py-0.5 rounded-full text-[9px] font-black bg-red-500 text-white animate-pulse">
                          {item.unreadCount}
                        </span>
                      </>
                    ) : null}
                  </Link>
                )
              })}
            </nav>
          </div>

          {/* Sidebar Footer: Trust Meter, Theme & User Role */}
          <div className="space-y-3 pt-3 border-t border-white/10">
            {/* Trust Meter status */}
            <Link
              href="/dashboard/trust-circle"
              onClick={() => playTactileSound('tab')}
              className="p-2 lg:p-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center lg:justify-between transition-all group"
              title="Trust Circle & Next of Kin Verification"
            >
              <div className="flex items-center gap-2">
                <ShieldCheck size={16} className={nokStatus?.hasNextOfKin ? 'text-emerald-400' : 'text-amber-400'} />
                <div className="hidden lg:flex flex-col text-left">
                  <span className="text-[10px] font-black uppercase text-gray-200">Trust Circle</span>
                  <span className="text-[9px] text-gray-400">
                    {nokStatus?.hasNextOfKin ? 'Verified' : nokStatus?.overdue ? 'Incomplete' : 'Next of Kin pending'}
                  </span>
                </div>
              </div>
              <span className={`hidden lg:inline-block text-[10px] font-black uppercase px-1.5 py-0.5 rounded border ${
                nokStatus?.hasNextOfKin ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300' : 'bg-amber-500/15 border-amber-500/30 text-amber-300'
              }`}>
                {nokStatus?.hasNextOfKin ? '100%' : '60%'}
              </span>
            </Link>

            {/* User profile quick glance & Theme toggle */}
            <div className="flex flex-col lg:flex-row items-center justify-between gap-2 px-1">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-xs font-black text-white uppercase border border-white/15 shrink-0">
                  {currentUser.name ? currentUser.name[0] : 'U'}
                </div>
                <div className="hidden lg:flex flex-col min-w-0 text-left">
                  <span className="text-xs font-bold text-gray-200 truncate max-w-[100px]">
                    {currentUser.name || 'Resident'}
                  </span>
                  <span className="text-[9px] font-mono uppercase text-gold-primary">
                    {currentUser.role}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => { setShowThemeModal(true); playTactileSound('tab') }}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors touch-target-44 flex items-center justify-center"
                title="Change theme"
                aria-label="Theme settings"
              >
                <Palette size={14} />
              </button>
            </div>
          </div>
        </aside>

        {/* Alert stack */}
        <div className="top-alert-banner-stack md:pl-20 lg:pl-64">
          {dataStatus === 'error' && failedTables.length > 0 ? (
            <div className="top-alert-banner">
              <AlertTriangle size={18} color="#ef4444" />
              <span>Some data couldn&apos;t load ({failedTables.join(', ')}). Retrying automatically.</span>
            </div>
          ) : dataStatus === 'loading' ? (
            <div className="top-alert-banner">
              <Loader size={18} className="text-gold-primary animate-spin" />
              <span>Loading your community data…</span>
            </div>
          ) : pendingWrites > 0 ? (
            <div className="top-alert-banner">
              <Wifi size={18} className="text-gold-primary" />
              <span>{pendingWrites} change{pendingWrites === 1 ? '' : 's'} waiting to sync — you&apos;re offline.</span>
            </div>
          ) : alertNotification ? (
            <div className="top-alert-banner">
              <CheckCircle2 size={18} color="#22c55e" />
              <span>{alertNotification}</span>
            </div>
          ) : null}
        </div>

        {/* Guest and Next of Kin Banners */}
        {currentUser && isGuestUser(currentUser) && !guestBannerDismissed ? (
          <div className="guest-summary-banner md:ml-20 lg:ml-64">
            <Sparkles size={16} className="shrink-0" style={{ color: 'var(--gold-primary)' }} />
            <span>
              <strong>Browsing as a guest.</strong> Sign up free to message, post and save rooms.
            </span>
            <Link href="/auth" className="guest-summary-banner-cta">Sign up</Link>
            <button onClick={dismissGuestBanner} aria-label="Dismiss" className="guest-summary-banner-dismiss">
              <X size={14} />
            </button>
          </div>
        ) : nokStatus && !nokStatus.hasNextOfKin && !nokBannerDismissed ? (
          <div className="guest-summary-banner md:ml-20 lg:ml-64">
            <ShieldCheck size={16} className="shrink-0" style={{ color: nokStatus.overdue ? '#ef4444' : 'var(--gold-primary)' }} />
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

        {/* ============================================================== */}
        {/* MAIN WORKSPACE WRAPPER (With md:pl-20 lg:pl-64)                */}
        {/* ============================================================== */}
        <div className="dashboard-main-content pl-[env(safe-area-inset-left,0px)] pr-[env(safe-area-inset-right,0px)] md:pl-20 lg:pl-64 min-h-screen min-h-dvh flex flex-col transition-all overflow-x-hidden">
          <header className="sticky top-0 z-40 h-16 bg-black/60 backdrop-blur-2xl border-b border-white/15 px-[max(0.75rem,env(safe-area-inset-left,0px))] pr-[max(0.75rem,env(safe-area-inset-right,0px))] sm:px-4 md:px-6 flex items-center justify-between transition-all">
            {/* Left Header Title / Mobile Logo */}
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <Link
                href="/dashboard"
                onClick={() => playTactileSound('tab')}
                className="flex items-center gap-2 group md:hidden shrink-0"
                title="Home"
              >
                <div className="w-8 h-8 rounded-xl bg-gold-primary/10 border border-gold-primary/30 flex items-center justify-center text-gold-primary shrink-0">
                  <pageTitle.icon size={16} />
                </div>
                <span className="font-black text-xs tracking-wide text-white uppercase truncate max-w-[90px] sm:max-w-none">
                  {pageTitle.name}
                </span>
              </Link>

              {/* Tablet and Desktop breadcrumb title */}
              <div className="hidden md:flex items-center gap-2 text-xs">
                <span className="text-gray-400 font-bold uppercase tracking-wider">Dashboard</span>
                <span className="text-white/20">/</span>
                <span className="text-white font-black uppercase tracking-wider">{pageTitle.name}</span>
              </div>

              {/* Urban Dynamic Island (Live precinct ticker & SOS) */}
              <div className="ml-1 sm:ml-3">
                <UrbanDynamicIsland nokStatus={nokStatus} />
              </div>
            </div>

            {/* Right Header Action Items */}
            <div className="flex items-center gap-1.5 sm:gap-2 md:gap-3">
              {/* Global Spotlight Palette Trigger (Ctrl+K) */}
              <CommandPalette />

              {/* Futuristic Planetary Telemetry Capsule */}
              <div className="hidden xl:inline-flex items-center gap-2 px-2.5 py-1 rounded-xl bg-white/5 border border-white/10 text-[10px] font-mono text-gray-300">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="font-bold text-gray-200">ROOMS: {roomsListed}</span>
                <span className="text-white/20">|</span>
                <span className={`font-bold ${activeAlerts > 0 ? 'text-red-400' : 'text-cyan-400'}`}>ALERTS: {activeAlerts}</span>
              </div>

              {/* Ecosystem Badges: The Gruvs */}
              <a
                href={GRUVS.url ?? undefined}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => playTactileSound('tab')}
                className="inline-flex items-center gap-1.5 p-2 sm:px-2.5 sm:py-1 rounded-xl text-[10px] font-black uppercase tracking-wider bg-gold-primary/10 hover:bg-gold-primary/20 text-gold-primary border border-gold-primary/30 transition-all group/gruvs"
                title={`${GRUVS.name}: ${GRUVS.short}`}
              >
                <Image
                  src="/gruvs-logo.png"
                  alt="The Gruvs"
                  width={14}
                  height={14}
                  className="rounded-full object-cover group-hover/gruvs:rotate-12 transition-transform"
                />
                <span className="hidden sm:inline">The Gruvs</span>
                <ExternalLink size={10} className="hidden sm:inline opacity-60" />
              </a>

              {/* Notification Megaphone Dropdown */}
              <div ref={notifMenuRef} className="relative">
                <button
                  onClick={() => { setShowNotifMenu(!showNotifMenu); playTactileSound('click') }}
                  className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-gray-300 hover:text-gold-primary transition-all relative touch-target-44"
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
                      className="absolute top-full right-0 mt-3 w-[calc(100vw-2rem)] sm:w-80 max-h-96 overflow-y-auto custom-scrollbar bg-black/95 backdrop-blur-3xl border border-white/15 rounded-2xl z-50 p-4 space-y-3"
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

                      <div className="flex gap-1.5 pb-1 border-b border-white/5">
                        <button
                          type="button"
                          onClick={() => setNotifFilter('all')}
                          className={`px-2.5 py-0.5 rounded-lg text-[10px] font-bold transition-all ${notifFilter === 'all' ? 'bg-gold-primary text-black' : 'bg-white/5 text-gray-400 hover:text-white'}`}
                        >
                          All
                        </button>
                        <button
                          type="button"
                          onClick={() => setNotifFilter('unread')}
                          className={`px-2.5 py-0.5 rounded-lg text-[10px] font-bold transition-all ${notifFilter === 'unread' ? 'bg-gold-primary text-black' : 'bg-white/5 text-gray-400 hover:text-white'}`}
                        >
                          Unread ({notifications.items.filter(n => !n.read).length})
                        </button>
                      </div>

                      <div className="space-y-2 overflow-y-auto max-h-64 custom-scrollbar pr-1">
                        {notifications.items.length === 0 ? (
                          <p className="text-xs text-gray-500 italic text-center py-6">{t('noRecentAlerts', lang)}</p>
                        ) : (
                          notifications.items.filter(item => notifFilter === 'all' || !item.read).map(item => (
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

          {/* Page content body */}
          <main className="dashboard-page-body pb-[calc(7rem+env(safe-area-inset-bottom,0px))] md:pb-8 lg:pb-8">
            {children}
          </main>
        </div>

        {/* ============================================================== */}
        {/* MOBILE 5-POINT KINETIC DOCK (Screen < 768px)                  */}
        {/* ============================================================== */}
        <nav
          className="md:hidden fixed bottom-[calc(0.75rem+env(safe-area-inset-bottom,0px))] left-3 right-3 max-w-md mx-auto z-50 bg-black/80 backdrop-blur-3xl border border-white/15 rounded-3xl p-1.5 flex items-center justify-between pointer-events-auto"
          aria-label="Mobile primary navigation"
        >
          {/* Left Wing (Home, Map) */}
          <div className="flex items-center flex-1 justify-around">
            {mobileNavLeft.map(item => {
              const isActive = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(item.href + '/')
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => playTactileSound('tab')}
                  className={`flex flex-col items-center justify-center py-1 px-2 rounded-2xl min-h-[48px] touch-target-48 transition-all relative ${
                    isActive ? 'text-gold-primary' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <item.icon size={18} className="transition-transform active:scale-95" />
                  <span className="text-[9px] font-black uppercase tracking-wider mt-0.5">{item.name}</span>
                </Link>
              )
            })}
          </div>

          {/* Center Kinetic Action Orb */}
          <ActionOrb />

          {/* Right Wing (Housing, Messages) */}
          <div className="flex items-center flex-1 justify-around">
            {mobileNavRight.map(item => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => playTactileSound('tab')}
                  className={`flex flex-col items-center justify-center py-1 px-2 rounded-2xl min-h-[48px] touch-target-48 transition-all relative ${
                    isActive ? 'text-gold-primary' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <div className="relative">
                    <item.icon size={18} className="transition-transform active:scale-95" />
                    {item.unreadCount && item.unreadCount > 0 ? (
                      <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    ) : null}
                  </div>
                  <span className="text-[9px] font-black uppercase tracking-wider mt-0.5">{item.name}</span>
                </Link>
              )
            })}
          </div>
        </nav>

        <PWAInstallBanner />
        <ThemeSwitcherModal
          isOpen={showThemeModal}
          onClose={() => setShowThemeModal(false)}
          currentTheme={currentTheme}
          onSelectTheme={(themeId) => {
            localStorage.setItem('residentTheme', themeId)
            document.documentElement.setAttribute('data-theme', themeId)
            setCurrentTheme(themeId)
            setAlertNotification(`Theme updated to ${themeId}`)
            setTimeout(() => setAlertNotification(null), 2500)
          }}
        />
      </div>
    </CallProvider>
  )
}
