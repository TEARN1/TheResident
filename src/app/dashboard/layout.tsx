'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useDispatch, useSelector } from 'react-redux'
import {
  Shield, LogOut, Home, X, AlertTriangle,
  Wifi, Users, CheckCircle2,
  Briefcase,
  Megaphone, Wrench, Loader, Menu,
  ShieldCheck, MessageCircle, MessagesSquare, Map as MapIcon
} from 'lucide-react'
import {
  loginUser,
  logoutUser,
  setLanguage,
  RootState,
  AppDispatch,
  markAllNotificationsRead,
  GUEST_USER_ID,
  isGuestUser
} from '../../store'
import { supabase } from '../../utils/supabase'
import { subscribeToRealtime, loadNotifications, markNotificationsReadInDb } from '../../store/realtime'
import { t } from '../../utils/i18n'
import { hasHouseholdPlus } from '../../utils/subscriptions'
import UpgradeButton from './components/UpgradeButton'
import Link from 'next/link'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const dispatch = useDispatch()
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [showNotifMenu, setShowNotifMenu] = useState(false)
  const [alertNotification, setAlertNotification] = useState<string | null>(null)
  const notifMenuRef = useRef<HTMLDivElement>(null)

  const currentUser = useSelector((state: RootState) => state.auth.currentUser)
  const notifications = useSelector((state: RootState) => state.notifications)
  const lang = useSelector((state: RootState) => state.ui.language)
  const dataStatus = useSelector((state: RootState) => state.ui.dataStatus)
  const failedTables = useSelector((state: RootState) => state.ui.failedTables)
  const pendingWrites = useSelector((state: RootState) => state.ui.offlineQueue.length)
  const [showPlusUpsell, setShowPlusUpsell] = useState(false)

  // Dark-only for now — see the removed toggle below for why. Pinned
  // explicitly so a stale data-theme left on the element by the auth page
  // (which kept its own separate theme state) can't leak into the dashboard.
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', 'day')
    }
  }, [])

  useEffect(() => {
    if (currentUser) return
    const bootstrapSession = async () => {
      if (supabase) {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const { data: dbProfile } = await supabase
            .from('res_profiles')
            .select('role')
            .eq('id', user.id)
            .single()
          dispatch(loginUser({
            id: user.id,
            name: user.user_metadata?.name || 'Resident User',
            email: user.email || '',
            role: (dbProfile?.role || 'visitor') as 'tenant' | 'landlord' | 'visitor'
          }))
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
    if (!currentUser || isGuestUser(currentUser)) return
    let cancelled = false
    hasHouseholdPlus().then(has => { if (!cancelled) setShowPlusUpsell(!has) })
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

  const handleLogout = () => {
    document.cookie = 'guest-mode=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;'
    dispatch(logoutUser())
    router.push('/auth')
  }

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
  const socialItems = [
    { name: 'Next of Kin', href: '/dashboard/trust-circle', icon: ShieldCheck },
    { name: 'Feed', href: '/dashboard/gossip', icon: MessagesSquare },
    { name: 'Messages', href: '/dashboard/messages', icon: MessageCircle },
  ]
  const navItems = [...coreItems, ...socialItems]

  // So the top bar can orient the user to which section they're in.
  const pageTitle = navItems.find(item => item.href === pathname) || navItems[0]

  return (
    <div className="dashboard-wrapper">
      <div className="top-alert-banner-stack">
        {alertNotification && (
          <div className="top-alert-banner">
            <CheckCircle2 size={18} color="#22c55e" />
            <span>{alertNotification}</span>
          </div>
        )}

        {/* Live-data status: these are real signals from the sync layer, not
            decoration — this banner went silent when the dashboard was split
            into routed pages, so failed fetches and queued offline writes were
            happening invisibly. */}
        {dataStatus === 'loading' && (
          <div className="top-alert-banner">
            <Loader size={18} color="#D4AF37" className="animate-spin" />
            <span>Loading your community data…</span>
          </div>
        )}
        {dataStatus === 'error' && failedTables.length > 0 && (
          <div className="top-alert-banner">
            <AlertTriangle size={18} color="#ef4444" />
            <span>Some data couldn&apos;t load ({failedTables.join(', ')}). Retrying automatically.</span>
          </div>
        )}
        {pendingWrites > 0 && (
          <div className="top-alert-banner">
            <Wifi size={18} color="#D4AF37" />
            <span>{pendingWrites} change{pendingWrites === 1 ? '' : 's'} waiting to sync — you&apos;re offline.</span>
          </div>
        )}
      </div>

      {/* Mobile Drawer Sidebar Backdrop */}
      {isSidebarOpen && (
        <div className="sidebar-backdrop" onClick={() => setIsSidebarOpen(false)} />
      )}

      <aside className={`sidebar-container ${isSidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-logo">
          <Shield size={24} color="#D4AF37" />
          <span className="sidebar-logo-text">THE RESIDENT</span>
          <button className="mobile-menu-btn" onClick={() => setIsSidebarOpen(false)} aria-label="Close menu">
            <X size={18} />
          </button>
        </div>

        <div className="sidebar-profile">
          <div className="sidebar-profile-info">
            <div className="sidebar-profile-avatar">{currentUser.name.charAt(0)}</div>
            <div className="sidebar-profile-details">
              <span className="sidebar-profile-name">{currentUser.name}</span>
              <span className="sidebar-profile-role">{currentUser.role}</span>
            </div>
          </div>
        </div>

        <nav className="sidebar-nav">
          <span className="sidebar-nav-section-label">{t('menuLabel', lang)}</span>
          {coreItems.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className={`sidebar-nav-item ${pathname === item.href ? 'active' : ''}`}
              onClick={() => setIsSidebarOpen(false)}
            >
              <item.icon size={16} /> {item.name}
            </Link>
          ))}
          <span className="sidebar-nav-section-label" style={{ marginTop: '0.75rem' }}>Social &amp; Safety</span>
          {socialItems.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className={`sidebar-nav-item ${pathname === item.href ? 'active' : ''}`}
              onClick={() => setIsSidebarOpen(false)}
            >
              <item.icon size={16} /> {item.name}
            </Link>
          ))}
        </nav>

        <div className="sidebar-footer">
          {showPlusUpsell && !isGuestUser(currentUser) && (
            <div className="bg-gold-primary/5 border border-gold-primary/15 rounded-xl p-3 mb-1">
              <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest mb-2">Household Plus</p>
              <p className="text-[10px] text-gray-500 mb-2 leading-relaxed">Priority mediation, extra feed storage, an ad-free view.</p>
              <UpgradeButton item="plus" className="w-full bg-gold-primary/10 hover:bg-gold-primary hover:text-black border border-gold-primary/30 text-gold-primary font-black py-2 rounded-lg text-[9px] uppercase tracking-widest transition-all active:scale-95" />
            </div>
          )}
          <div className="lang-switcher">
            {['en', 'zu', 'xh', 'af'].map(l => (
              <button
                key={l}
                onClick={() => dispatch(setLanguage(l as 'en' | 'zu' | 'xh' | 'af'))}
                className={`lang-switcher-btn ${lang === l ? 'active' : ''}`}
              >
                {l.toUpperCase()}
              </button>
            ))}
          </div>
          {/* The day/night toggle used to live here. It was a promise the app
              can't keep: "day" and "night" differ by 5/255 on the background
              and nothing else, because the UI hardcodes dark styling in ~1200
              places against 19 theme-aware variables. Rather than ship a
              control that visibly does nothing, The Resident is dark-only
              until that styling is consolidated onto the CSS variables. */}
          <button className="sidebar-nav-item" onClick={handleLogout}>
            <LogOut size={16} /> {t('logOut', lang)}
          </button>
        </div>
      </aside>

      <div className="dashboard-main-content">
        <header className="dashboard-top-bar">
          <button className="mobile-menu-btn" onClick={() => setIsSidebarOpen(true)} aria-label="Open menu">
            <Menu size={22} />
          </button>

          <div className="dashboard-page-title">
            <pageTitle.icon size={18} />
            <span>{pageTitle.name}</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginLeft: 'auto' }}>
             <Link
               href="/dashboard/community?tab=vibemap"
               title="Open the shared living map"
               style={{
                 display: 'flex', alignItems: 'center', gap: '6px',
                 background: pathname === '/dashboard/community' ? 'rgba(212, 175, 55, 0.12)' : 'transparent',
                 border: '1px solid ' + (pathname === '/dashboard/community' ? 'rgba(212, 175, 55, 0.3)' : 'transparent'),
                 color: '#D4AF37', padding: '0.4rem 0.7rem', borderRadius: '8px',
                 fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em'
               }}
             >
               <MapIcon size={16} /> <span className="hidden sm:inline">Map</span>
             </Link>
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
    </div>
  )
}
