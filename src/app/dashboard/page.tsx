'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  AlertCircle,
  Briefcase,
  Calendar,
  Car,
  CheckCircle2,
  ExternalLink,
  Home,
  MapPin,
  MessageCircle,
  PlusCircle,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  User,
  Users
} from 'lucide-react'
import { useSelector } from 'react-redux'
import { RootState, isGuestUser } from '../../store'
import { playTactileSound } from '../../utils/tactileSounds'
import { GRUVS } from '../../utils/sisterApps'
import {
  DECEMBER_HIGHLIGHT_EVENTS,
  fetchDecemberGruvsEvents,
  fetchUpcomingGruvsEvents,
  formatGruvsEventWhen,
  type GruvsEvent
} from '../../utils/gruvsEvents'
import { LAUNCH_AREA } from '../../utils/launch'

function greeting(hour: number): string {
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

export default function HomeDashboard() {
  const currentUser = useSelector((state: RootState) => state.auth.currentUser)
  const listings = useSelector((state: RootState) => state.listings.items)
  const services = useSelector((state: RootState) => state.networking.services)
  const lifts = useSelector((state: RootState) => state.networking.lifts)
  const activeAlerts = useSelector((state: RootState) => state.community.alerts.filter(a => a.status === 'active').length)
  const unreadNotifications = useSelector((state: RootState) => state.notifications.items.filter(n => !n.read).length)

  const [hour, setHour] = useState<number | null>(null)
  const [events, setEvents] = useState<GruvsEvent[]>([])
  const [decemberEvents, setDecemberEvents] = useState<GruvsEvent[]>(DECEMBER_HIGHLIGHT_EVENTS.slice(0, 12))
  const [decemberArea, setDecemberArea] = useState<string>('All')
  const [showAllDecember, setShowAllDecember] = useState(false)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time read of the device clock
    setHour(new Date().getHours())
    let cancelled = false
    fetchUpcomingGruvsEvents().then(list => { if (!cancelled) setEvents(list.slice(0, 3)) }).catch(() => {})
    fetchDecemberGruvsEvents(24).then(list => { if (!cancelled && list.length > 0) setDecemberEvents(list) }).catch(() => {})
    return () => { cancelled = true }
  }, [])

  const decemberAreas = ['All', 'Midrand', 'Tembisa', 'Ivory Park', 'Centurion', 'Kempton Park', 'Soweto', 'Rosebank', 'Braamfontein', 'Pretoria']
  const filteredDecember = decemberArea === 'All'
    ? decemberEvents
    : decemberEvents.filter(e => (e.city || '').toLowerCase() === decemberArea.toLowerCase())
  const visibleDecember = showAllDecember ? filteredDecember : filteredDecember.slice(0, 6)

  const guest = isGuestUser(currentUser)
  const firstName = !guest && currentUser?.name ? currentUser.name.split(' ')[0] : null

  const stats = [
    { label: 'Rooms listed', value: listings.length, href: '/dashboard/housing', icon: Home, zeroPrompt: 'List first room' },
    { label: 'Local services', value: services.length, href: '/dashboard/services', icon: Briefcase, zeroPrompt: 'Register trade' },
    { label: 'Lift clubs', value: lifts.length, href: '/dashboard/services?tab=lifts', icon: Car, zeroPrompt: 'Offer ride' },
    { label: 'Active alerts', value: activeAlerts, href: '/dashboard/community?tab=safety', icon: ShieldCheck, zeroPrompt: 'All quiet' }
  ]

  const shortcuts = [
    { label: 'Find a room', href: '/dashboard/housing', icon: Home, badge: null },
    { label: 'Services', href: '/dashboard/services', icon: Briefcase, badge: null },
    { label: 'Community', href: '/dashboard/community', icon: Users, badge: null },
    { label: 'Messages', href: '/dashboard/messages', icon: MessageCircle, badge: unreadNotifications > 0 ? `${unreadNotifications}` : null },
    { label: 'Safety', href: '/dashboard/community?tab=safety', icon: ShieldCheck, badge: activeAlerts > 0 ? `${activeAlerts} alert${activeAlerts === 1 ? '' : 's'}` : null, alert: activeAlerts > 0 },
    { label: 'Profile', href: '/dashboard/profile', icon: User, badge: null }
  ]

  return (
    <div className="p-3 sm:p-6 md:p-8 space-y-6 max-w-5xl 2xl:max-w-7xl mx-auto">
      {/* Header Greeting */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="m-0 text-2xl sm:text-3xl font-black text-white tracking-tight">
            {hour === null ? 'Welcome' : greeting(hour)}{firstName ? `, ${firstName}` : ''}
          </h1>
          <p className="m-0 mt-1 text-sm text-gray-400">
            {LAUNCH_AREA ? `What do you need in ${LAUNCH_AREA} today?` : 'What do you need today?'}
          </p>
        </div>

        {/* Quick action buttons */}
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/housing?tab=create"
            onClick={() => playTactileSound('click')}
            className="touch-target-44 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-gold-primary/10 hover:bg-gold-primary/20 text-gold-primary border border-gold-primary/30 no-underline transition-all"
          >
            <PlusCircle size={14} />
            <span>List Room</span>
          </Link>
          <Link
            href="/dashboard/community?tab=safety"
            onClick={() => playTactileSound('click')}
            className="touch-target-44 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-white/5 hover:bg-white/10 text-gray-200 border border-white/10 no-underline transition-all"
          >
            <ShieldAlert size={14} className={activeAlerts > 0 ? 'text-red-400' : 'text-gray-400'} />
            <span>Safety</span>
          </Link>
        </div>
      </div>

      {/* Proactive Neighbourhood Health Banner */}
      {activeAlerts > 0 ? (
        <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-200">
          <AlertCircle size={20} className="text-red-400 shrink-0" />
          <div className="flex-1 text-xs sm:text-sm">
            <span className="font-bold">{activeAlerts} active safety alert{activeAlerts === 1 ? '' : 's'} reported in your neighbourhood.</span>
            <span className="block text-[11px] text-red-300/80 mt-0.5">Stay aware and check safe transit corridors.</span>
          </div>
          <Link
            href="/dashboard/community?tab=safety"
            onClick={() => playTactileSound('click')}
            className="px-3 py-1.5 rounded-xl bg-red-500 text-white font-bold text-xs no-underline shrink-0"
          >
            View Map
          </Link>
        </div>
      ) : (
        <div className="flex items-center gap-3 p-3 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 text-emerald-300 text-xs">
          <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
          <span>Neighbourhood is quiet — no active emergency alerts in your immediate radius today.</span>
        </div>
      )}

      {/* Real counts with friendly subtext */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {stats.map(s => (
          <Link
            key={s.label}
            href={s.href}
            onClick={() => playTactileSound('tab')}
            className="no-underline glass-panel p-4 hover:border-gold-primary/40 transition-all flex flex-col justify-between"
          >
            <div>
              <s.icon size={16} className="text-gold-primary" />
              <p className="m-0 mt-2 text-2xl font-black text-white">{s.value}</p>
            </div>
            <div>
              <p className="m-0 text-[10px] font-bold uppercase tracking-widest text-gray-400">{s.label}</p>
              {s.value === 0 && (
                <span className="text-[10px] text-gold-primary/80 block mt-1 font-semibold">{s.zeroPrompt} &rarr;</span>
              )}
            </div>
          </Link>
        ))}
      </section>

      {/* Main Feature Shortcuts with dynamic badge notifications */}
      <section className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5 sm:gap-3">
        {shortcuts.map(s => (
          <Link
            key={s.label}
            href={s.href}
            onClick={() => playTactileSound('tab')}
            className="no-underline glass-panel p-4 flex flex-col items-center gap-2 text-center hover:border-gold-primary/40 transition-all relative"
          >
            {s.badge && (
              <span className={`absolute top-2 right-2 px-1.5 py-0.5 rounded-full text-[9px] font-bold ${
                s.alert ? 'bg-red-500 text-white animate-pulse' : 'bg-gold-primary text-black'
              }`}>
                {s.badge}
              </span>
            )}
            <span className="p-2.5 rounded-xl bg-gold-primary/10 text-gold-primary"><s.icon size={20} /></span>
            <span className="text-xs font-bold text-white">{s.label}</span>
          </Link>
        ))}
      </section>

      {/* Live Gruvs Events near you */}
      {events.length > 0 && (
        <section className="glass-panel p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="m-0 text-sm font-black text-white flex items-center gap-2">
              <Sparkles size={15} className="text-purple-400" /> Coming up on {GRUVS.name}
            </h2>
            {GRUVS.url && (
              <a href={GRUVS.url} target="_blank" rel="noopener noreferrer" className="no-underline text-xs font-bold text-purple-300 flex items-center gap-1">
                Open <ExternalLink size={12} />
              </a>
            )}
          </div>
          <div className="space-y-2">
            {events.map(ev => (
              <Link
                key={ev.id}
                href={`/dashboard/housing?event=${ev.id}`}
                onClick={() => playTactileSound('tab')}
                className="no-underline flex items-center justify-between gap-3 p-3 rounded-xl bg-black/40 border border-white/10 hover:border-purple-500/40 transition-all"
              >
                <span className="min-w-0">
                  <span className="block text-sm font-bold text-white truncate">{ev.title}</span>
                  <span className="block text-[11px] text-gray-400 flex items-center gap-2 mt-0.5">
                    <span>{formatGruvsEventWhen(ev.startsAt)}</span>
                    {ev.venue && (
                      <span className="inline-flex items-center gap-1 text-gray-500 truncate">
                        <MapPin size={10} />
                        {ev.venue}
                      </span>
                    )}
                  </span>
                </span>
                <span className="text-[11px] font-bold text-purple-300 shrink-0">Stay nearby</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* December ("Ke Dezemba") Events Showcase */}
      {decemberEvents.length > 0 && (
        <section className="glass-panel p-4 sm:p-5 space-y-3.5 border border-gold-primary/30">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h2 className="m-0 text-sm sm:text-base font-black text-gold-primary flex items-center gap-2">
                <Calendar size={16} className="text-gold-primary" /> December Events &amp; Ke Dezemba Lineup
              </h2>
              <p className="m-0 mt-0.5 text-xs text-gray-400">
                Planning your festive season? Find verified rooms, short stays, or lift clubs near December&apos;s biggest events.
              </p>
            </div>
            <Link
              href="/dashboard/community?tab=vibemap"
              onClick={() => playTactileSound('tab')}
              className="no-underline text-xs font-bold text-gold-primary hover:underline shrink-0"
            >
              View all on Live Map &rarr;
            </Link>
          </div>

          {/* Suburb / Hub Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {decemberAreas.map(area => (
              <button
                key={area}
                type="button"
                onClick={() => { setDecemberArea(area); playTactileSound('tab') }}
                className={`px-3 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap transition-all cursor-pointer border ${
                  decemberArea === area
                    ? 'bg-gold-primary text-black border-gold-primary'
                    : 'bg-black/40 text-gray-300 border-white/10 hover:border-gold-primary/40'
                }`}
              >
                {area}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {visibleDecember.map(ev => (
              <Link
                key={ev.id}
                href={`/dashboard/housing?event=${ev.id}`}
                onClick={() => playTactileSound('tab')}
                className="no-underline flex flex-col justify-between gap-2 p-3.5 rounded-xl bg-black/50 border border-white/10 hover:border-gold-primary/50 transition-all"
              >
                <div className="min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-gold-primary/15 text-gold-primary">
                      {ev.city || 'Gauteng'}
                    </span>
                    <span className="text-[11px] font-semibold text-gray-300">
                      {formatGruvsEventWhen(ev.startsAt)}
                    </span>
                  </div>
                  <span className="block text-sm font-bold text-white leading-snug">{ev.title}</span>
                </div>
                <div className="flex items-center justify-between gap-2 pt-1 border-t border-white/5">
                  <span className="inline-flex items-center gap-1 text-[11px] text-gray-400 truncate">
                    <MapPin size={11} className="text-gold-primary shrink-0" />
                    <span className="truncate">{ev.venue || ev.city || 'Gauteng'}</span>
                  </span>
                  <span className="text-[11px] font-bold text-gold-primary shrink-0">Find stay &rarr;</span>
                </div>
              </Link>
            ))}
          </div>

          {filteredDecember.length > 6 && (
            <button
              type="button"
              onClick={() => setShowAllDecember(v => !v)}
              className="w-full py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-gray-200 cursor-pointer transition-all"
            >
              {showAllDecember ? 'Show fewer December events' : `Show all ${filteredDecember.length} December events`}
            </button>
          )}
        </section>
      )}
    </div>
  )
}
