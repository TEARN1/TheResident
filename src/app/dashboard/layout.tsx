'use client'

import React, { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useDispatch, useSelector } from 'react-redux'
import {
  Shield, LogOut, Home, Search, Plus, Check, X, AlertTriangle,
  Wifi, Car, FileText, Send, MapPin, Eye, Navigation,
  User as UserIcon, Users, CheckCircle2, Terminal, Info,
  Star, Calendar, Clock, Briefcase,
  ShieldCheck, Zap, Copy,
  MessageSquare, Gavel, Award, Megaphone, Wrench, Loader, Menu, Sun, Moon
} from 'lucide-react'
import {
  loginUser,
  logoutUser,
  setLanguage,
  RootState,
  AppDispatch,
  markAllNotificationsRead
} from '../../store'
import { supabase } from '../../utils/supabase'
import { subscribeToRealtime, loadNotifications, markNotificationsReadInDb } from '../../store/realtime'
import { t } from '../../utils/i18n'
import Link from 'next/link'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const dispatch = useDispatch()
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [theme, setTheme] = useState<'day' | 'night'>('day')
  const [showNotifMenu, setShowNotifMenu] = useState(false)
  const [alertNotification, setAlertNotification] = useState<string | null>(null)

  const currentUser = useSelector((state: RootState) => state.auth.currentUser)
  const notifications = useSelector((state: RootState) => state.notifications)
  const lang = useSelector((state: RootState) => state.ui.language)
  const dataStatus = useSelector((state: RootState) => state.ui.dataStatus)
  const failedTables = useSelector((state: RootState) => state.ui.failedTables)
  const pendingWrites = useSelector((state: RootState) => state.ui.offlineQueue.length)

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', theme)
    }
  }, [theme])

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
            role: (dbProfile?.role || 'visitor') as 'tenant' | 'landlord' | 'visitor',
            balance: 0
          }))
          return
        }
      }
      const isGuest = document.cookie.split(';').some(c => c.trim().startsWith('guest-mode=1'))
      if (isGuest) {
        dispatch(loginUser({
          id: 'visitor-guest',
          name: 'Guest Visitor',
          email: 'visitor@theresident.co.za',
          role: 'visitor' as const,
          balance: 0
        }))
        return
      }
      router.push('/auth')
    }
    bootstrapSession()
  }, [currentUser, router, dispatch])

  useEffect(() => {
    if (!currentUser || currentUser.id === 'visitor-guest') return
    const appDispatch = dispatch as AppDispatch
    loadNotifications(appDispatch)
    const unsubscribe = subscribeToRealtime(appDispatch, currentUser.id)
    return unsubscribe
  }, [currentUser, dispatch])

  const handleLogout = () => {
    document.cookie = 'guest-mode=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;'
    dispatch(logoutUser())
    router.push('/auth')
  }

  const formatCurrency = (amount: number, currencyCode: string = 'ZAR') => {
    if (currencyCode === 'ZAR') return `R ${amount}`
    return `${amount} ${currencyCode}`
  }

  if (!currentUser) return <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center' }}>Loading...</div>

  const navItems = currentUser.role === 'tenant' || currentUser.role === 'visitor' ? [
    { name: 'Housing', href: '/dashboard/housing', icon: Home },
    { name: 'Services', href: '/dashboard/services', icon: Briefcase },
    { name: 'Community', href: '/dashboard/community', icon: Users },
  ] : [
    { name: 'Portfolio', href: '/dashboard/housing', icon: Home },
    { name: 'Maintenance', href: '/dashboard/services', icon: Wrench },
    { name: 'Community', href: '/dashboard/community', icon: Users },
  ]

  return (
    <div className="dashboard-wrapper">
       {/* Alert Top Banner */}
       {alertNotification && (
        <div className="top-alert-banner">
          <CheckCircle2 size={18} color="#22c55e" />
          <span>{alertNotification}</span>
        </div>
      )}

      {/* Mobile Drawer Sidebar Backdrop */}
      {isSidebarOpen && (
        <div className="sidebar-backdrop" onClick={() => setIsSidebarOpen(false)} />
      )}

      <aside className={`sidebar-container ${isSidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-logo">
          <Shield size={24} color="#D4AF37" />
          <span className="sidebar-logo-text">THE RESIDENT</span>
          <button className="mobile-menu-btn" onClick={() => setIsSidebarOpen(false)}>
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
          <div className="sidebar-wallet">
            <span>Wallet</span>
            <strong>{formatCurrency(currentUser.balance || 0)}</strong>
          </div>
        </div>

        <nav className="sidebar-nav">
          {navItems.map(item => (
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
          <div style={{ display: 'flex', gap: '4px', padding: '0.5rem', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', marginBottom: '1rem', justifyContent: 'space-between' }}>
            {['en', 'zu', 'xh', 'af'].map(l => (
              <button
                key={l}
                onClick={() => dispatch(setLanguage(l as 'en' | 'zu' | 'xh' | 'af'))}
                style={{ flex: 1, padding: '0.3rem', background: lang === l ? 'var(--gold-primary)' : 'transparent', color: lang === l ? '#000' : '#888', border: 'none', borderRadius: '8px', fontSize: '0.65rem', fontWeight: '900', cursor: 'pointer', transition: 'all 0.2s' }}
              >
                {l.toUpperCase()}
              </button>
            ))}
          </div>
          <button className="sidebar-nav-item" onClick={() => setTheme(theme === 'day' ? 'night' : 'day')}>
            {theme === 'day' ? <Moon size={16} /> : <Sun size={16} />}
            <span>{theme === 'day' ? 'Night Theme' : 'Day Theme'}</span>
          </button>
          <Link href="/dashboard/admin" className={`sidebar-nav-item ${pathname === '/dashboard/admin' ? 'active' : ''}`}>
            <Terminal size={16} /> Security Labs
          </Link>
          <button className="sidebar-nav-item" onClick={handleLogout}>
            <LogOut size={16} /> Log Out
          </button>
        </div>
      </aside>

      <div className="dashboard-main-content">
        <header className="dashboard-top-bar">
          <button className="mobile-menu-btn" onClick={() => setIsSidebarOpen(true)}>
            <Menu size={24} />
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginLeft: 'auto' }}>
             <div style={{ position: 'relative' }}>
                <button onClick={() => setShowNotifMenu(!showNotifMenu)} style={{ background: 'transparent', border: 'none', color: '#D4AF37', position: 'relative', cursor: 'pointer' }}>
                   <Megaphone size={20} />
                   {notifications.items.filter(n => !n.read).length > 0 && <span className="notif-badge">!</span>}
                </button>
                {showNotifMenu && (
                   <div className="glass-panel" style={{ position: 'absolute', top: '100%', right: 0, width: '300px', maxHeight: '400px', overflowY: 'auto', zIndex: 100, marginTop: '1rem', padding: '1rem' }}>
                      <div className="flex justify-between items-center mb-4 border-b border-white/5 pb-2">
                         <span className="text-xs font-black text-white uppercase tracking-widest">Alerts</span>
                         <button onClick={() => { dispatch(markAllNotificationsRead()); markNotificationsReadInDb() }} className="text-[10px] text-gold-primary font-bold hover:underline">Mark all read</button>
                      </div>
                      <div className="space-y-3">
                         {notifications.items.length === 0 ? (
                            <p className="text-[10px] text-gray-600 italic text-center py-4">No recent alerts</p>
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
             <div className="wallet-pill">{formatCurrency(currentUser.balance || 0)}</div>
          </div>
        </header>

        <main className="dashboard-page-body">
          {children}
        </main>
      </div>
    </div>
  )
}
