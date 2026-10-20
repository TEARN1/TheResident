'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Briefcase, Car, ExternalLink, Home, MessageCircle, ShieldCheck, Sparkles, User, Users
} from 'lucide-react'
import { useSelector } from 'react-redux'
import { RootState, isGuestUser } from '../../store'
import { playTactileSound } from '../../utils/tactileSounds'
import { GRUVS } from '../../utils/sisterApps'
import { fetchUpcomingGruvsEvents, formatGruvsEventWhen, type GruvsEvent } from '../../utils/gruvsEvents'
import { LAUNCH_AREA } from '../../utils/launch'

/**
 * Home: a greeting, what is really on the app right now, shortcuts, and
 * real events from The Gruvs. (An "Ask anything" box sat here; it was
 * removed because people would take it for an AI chatbot, which it isn't.)
 *
 * This replaced the "Command Bridge", which showed invented figures (it
 * fell back to "24 rooms / 18 plumbers / 7 lift clubs" whenever the real
 * count was zero), a "94% calm" vibe index, made-up government directives
 * and five fictional "planetary hubs". Every number here is a real count.
 */
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

  const [hour, setHour] = useState<number | null>(null)
  const [events, setEvents] = useState<GruvsEvent[]>([])

  useEffect(() => {
    // Local time is only known in the browser; set once after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time read of the device clock
    setHour(new Date().getHours())
    let cancelled = false
    fetchUpcomingGruvsEvents().then(list => { if (!cancelled) setEvents(list.slice(0, 3)) }).catch(() => {})
    return () => { cancelled = true }
  }, [])

  const guest = isGuestUser(currentUser)
  const firstName = !guest && currentUser?.name ? currentUser.name.split(' ')[0] : null

  const stats = [
    { label: 'Rooms listed', value: listings.length, href: '/dashboard/housing', icon: Home },
    { label: 'Local services', value: services.length, href: '/dashboard/services', icon: Briefcase },
    { label: 'Lift clubs', value: lifts.length, href: '/dashboard/services?tab=lifts', icon: Car },
    { label: 'Active alerts', value: activeAlerts, href: '/dashboard/community?tab=safety', icon: ShieldCheck }
  ]

  const shortcuts = [
    { label: 'Find a room', href: '/dashboard/housing', icon: Home },
    { label: 'Services', href: '/dashboard/services', icon: Briefcase },
    { label: 'Community', href: '/dashboard/community', icon: Users },
    { label: 'Messages', href: '/dashboard/messages', icon: MessageCircle },
    { label: 'Safety', href: '/dashboard/community?tab=safety', icon: ShieldCheck },
    { label: 'Profile', href: '/dashboard/profile', icon: User }
  ]

  return (
    <div className="p-4 sm:p-6 md:p-8 space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="m-0 text-2xl sm:text-3xl font-black text-white tracking-tight">
          {hour === null ? 'Welcome' : greeting(hour)}{firstName ? `, ${firstName}` : ''}
        </h1>
        <p className="m-0 mt-1 text-sm text-gray-400">
          {LAUNCH_AREA ? `What do you need in ${LAUNCH_AREA} today?` : 'What do you need today?'}
        </p>
      </div>

      {/* Real counts from the data the app has loaded; zero means zero. */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {stats.map(s => (
          <Link key={s.label} href={s.href} className="no-underline glass-panel p-4 hover:border-gold-primary/40 transition-all">
            <s.icon size={16} className="text-gold-primary" />
            <p className="m-0 mt-2 text-2xl font-black text-white">{s.value}</p>
            <p className="m-0 text-[10px] font-bold uppercase tracking-widest text-gray-500">{s.label}</p>
          </Link>
        ))}
      </section>

      <section className="grid grid-cols-3 gap-3">
        {shortcuts.map(s => (
          <Link
            key={s.label}
            href={s.href}
            onClick={() => playTactileSound('tab')}
            className="no-underline glass-panel p-4 flex flex-col items-center gap-2 text-center hover:border-gold-primary/40 transition-all"
          >
            <span className="p-2 rounded-xl bg-gold-primary/10 text-gold-primary"><s.icon size={18} /></span>
            <span className="text-xs font-bold text-white">{s.label}</span>
          </Link>
        ))}
      </section>

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
                className="no-underline flex items-center justify-between gap-3 p-3 rounded-xl bg-black/40 border border-white/10 hover:border-purple-500/40"
              >
                <span className="min-w-0">
                  <span className="block text-sm font-bold text-white truncate">{ev.title}</span>
                  <span className="block text-[11px] text-gray-400">{formatGruvsEventWhen(ev.startsAt)}</span>
                </span>
                <span className="text-[11px] font-bold text-purple-300 shrink-0">Stay nearby</span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
