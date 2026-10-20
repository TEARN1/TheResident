'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowRight, Briefcase, Car, ExternalLink, Home, MessageCircle, Search, Send, ShieldCheck, Sparkles, User, Users, X
} from 'lucide-react'
import { useSelector } from 'react-redux'
import { RootState, isGuestUser } from '../../store'
import { playTactileSound } from '../../utils/tactileSounds'
import { GRUVS } from '../../utils/sisterApps'
import { fetchUpcomingGruvsEvents, formatGruvsEventWhen, type GruvsEvent } from '../../utils/gruvsEvents'
import { analyzeMunicipalQuery, type ConciergeAnalysis } from '../../utils/conciergeEngine'
import { LAUNCH_AREA } from '../../utils/launch'

/**
 * Home: a greeting, "ask anything", what is really on the app right now,
 * shortcuts, and real events from The Gruvs.
 *
 * This replaced the "Command Bridge", which showed invented figures (it
 * fell back to "24 rooms / 18 plumbers / 7 lift clubs" whenever the real
 * count was zero), a "94% calm" vibe index, made-up government directives
 * and five fictional "planetary hubs". Every number here is a real count.
 */
const QUICK_ASKS = [
  { label: 'Locked out by my landlord', query: 'landlord changed the lock and locked me out' },
  { label: 'Room under R3 000', query: 'single room under 3000' },
  { label: 'I need a bakkie', query: 'I need a bakkie to move' },
  { label: 'Power is out', query: 'power outage on my street' }
]

function greeting(hour: number): string {
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

export default function HomeDashboard() {
  const router = useRouter()
  const currentUser = useSelector((state: RootState) => state.auth.currentUser)
  const listings = useSelector((state: RootState) => state.listings.items)
  const services = useSelector((state: RootState) => state.networking.services)
  const lifts = useSelector((state: RootState) => state.networking.lifts)
  const activeAlerts = useSelector((state: RootState) => state.community.alerts.filter(a => a.status === 'active').length)

  const [hour, setHour] = useState<number | null>(null)
  const [query, setQuery] = useState('')
  const [answer, setAnswer] = useState<ConciergeAnalysis | null>(null)
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

  const ask = (text: string) => {
    if (!text.trim()) return
    playTactileSound('click')
    const result = analyzeMunicipalQuery(text, LAUNCH_AREA || 'your area')
    setAnswer(result)
    playTactileSound(result.tactileSound)
  }

  const runAction = (action: ConciergeAnalysis['actions'][number]) => {
    playTactileSound('pop')
    if (action.externalUrl?.startsWith('tel:')) window.location.assign(action.externalUrl)
    else if (action.externalUrl) window.open(action.externalUrl, '_blank', 'noopener,noreferrer')
    else if (action.path) router.push(action.path)
  }

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

      {/* Ask anything: matches the question to the right part of the app,
          entirely on the device (utils/conciergeEngine). */}
      <section className="glass-panel p-4 sm:p-5 space-y-3">
        <form onSubmit={e => { e.preventDefault(); ask(query) }} className="relative flex items-center">
          <Search size={17} className="absolute left-4 text-gold-primary" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Ask anything, e.g. “room under R3 000”"
            className="w-full bg-black/60 border border-white/15 rounded-2xl pl-11 pr-14 py-3.5 text-sm text-white placeholder:text-gray-500 outline-none focus:border-gold-primary"
          />
          <button type="submit" className="absolute right-2 p-2.5 rounded-xl bg-gold-primary text-black" aria-label="Ask">
            <Send size={15} />
          </button>
        </form>
        <div className="flex flex-wrap gap-2">
          {QUICK_ASKS.map(q => (
            <button
              key={q.label}
              type="button"
              onClick={() => { setQuery(q.query); ask(q.query) }}
              className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-gray-300 hover:text-white"
            >
              {q.label}
            </button>
          ))}
        </div>

        <AnimatePresence>
          {answer && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className={`rounded-2xl p-4 space-y-3 border ${answer.category === 'EMERGENCY_DEFENSE' ? 'bg-red-950/40 border-red-500/40' : 'bg-white/[0.04] border-white/10'}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="m-0 text-[10px] font-black uppercase tracking-widest text-gold-primary">{answer.categoryLabel}</p>
                  <h2 className="m-0 mt-0.5 text-base font-black text-white">{answer.headline}</h2>
                </div>
                <button type="button" onClick={() => setAnswer(null)} className="p-1 text-gray-400 hover:text-white shrink-0" aria-label="Close">
                  <X size={16} />
                </button>
              </div>
              <p className="m-0 text-sm text-gray-300 leading-relaxed">{answer.diagnosis}</p>
              <ol className="m-0 pl-5 space-y-1 text-sm text-gray-300">
                {answer.actionPlan.map(step => <li key={step}>{step}</li>)}
              </ol>
              <div className="flex flex-wrap gap-2">
                {answer.actions.map(action => (
                  <button
                    key={action.label}
                    type="button"
                    onClick={() => runAction(action)}
                    className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 ${action.primary ? 'bg-gold-primary text-black' : 'bg-white/10 border border-white/15 text-white'}`}
                  >
                    {action.label}
                    {action.externalUrl && !action.externalUrl.startsWith('tel:') ? <ExternalLink size={13} /> : <ArrowRight size={13} />}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

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
