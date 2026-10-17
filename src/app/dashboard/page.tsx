'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Radio, Compass, Shield, ShieldCheck, Zap, AlertTriangle, Layers,
  Users, Home, Briefcase, Car, Scale, ArrowUpRight, Search, Activity,
  Sparkles, ExternalLink, MapPin, Send, RefreshCw, Smartphone,
  GraduationCap, HeartPulse, Bus, Bell, ChevronRight, Lock, CheckCircle2,
  Table2, Key, Wrench, Eye
} from 'lucide-react'
import { useSelector } from 'react-redux'
import { RootState } from '../../store'
import { playTactileSound } from '../../utils/tactileSounds'
import { GRUVS, TEARNS, GRUVS_TOUCH_DOWN } from '../../utils/sisterApps'
import { fetchUpcomingGruvsEvents, formatGruvsEventWhen, type GruvsEvent } from '../../utils/gruvsEvents'
import InstitutionalBroadcastsPortal from './components/community/InstitutionalBroadcastsPortal'

interface PlanetaryHub {
  id: string
  name: string
  region: string
  currency: string
  currencySymbol: string
  lat: number
  lon: number
  emergencyNumber: string
  emergencyLabel: string
  flag: string
  status: 'OPTIMAL' | 'ELEVATED' | 'SECURE'
  meshNodes: number
}

const PLANETARY_HUBS: PlanetaryHub[] = [
  {
    id: 'jhb',
    name: 'Johannesburg Apex',
    region: 'Gauteng, South Africa',
    currency: 'ZAR',
    currencySymbol: 'R',
    lat: -26.1926,
    lon: 28.0305,
    emergencyNumber: '10111',
    emergencyLabel: 'SAPS / Emergency Patrol',
    flag: '🇿🇦',
    status: 'OPTIMAL',
    meshNodes: 1420
  },
  {
    id: 'nbo',
    name: 'Nairobi Precinct',
    region: 'Nairobi County, Kenya',
    currency: 'KES',
    currencySymbol: 'KSh',
    lat: -1.2921,
    lon: 36.8219,
    emergencyNumber: '999',
    emergencyLabel: 'National Police / Med Dispatch',
    flag: '🇰🇪',
    status: 'SECURE',
    meshNodes: 890
  },
  {
    id: 'ldn',
    name: 'London Sovereign Grid',
    region: 'Greater London, United Kingdom',
    currency: 'GBP',
    currencySymbol: '£',
    lat: 51.5074,
    lon: -0.1278,
    emergencyNumber: '999',
    emergencyLabel: 'Metropolitan Police / NHS',
    flag: '🇬🇧',
    status: 'OPTIMAL',
    meshNodes: 2150
  },
  {
    id: 'ber',
    name: 'Berlin Autonomous Node',
    region: 'Berlin-Brandenburg, Germany',
    currency: 'EUR',
    currencySymbol: '€',
    lat: 52.5200,
    lon: 13.4050,
    emergencyNumber: '112',
    emergencyLabel: 'Polizei / Rettungsdienst',
    flag: '🇩🇪',
    status: 'OPTIMAL',
    meshNodes: 1670
  },
  {
    id: 'nyc',
    name: 'New York Metro Arc',
    region: 'New York Tri-State, United States',
    currency: 'USD',
    currencySymbol: '$',
    lat: 40.7128,
    lon: -74.0060,
    emergencyNumber: '911',
    emergencyLabel: 'NYPD / Regional 911',
    flag: '🇺🇸',
    status: 'SECURE',
    meshNodes: 3410
  }
]

export default function PlanetaryCommandBridge() {
  const router = useRouter()
  const currentUser = useSelector((state: RootState) => state.auth.currentUser)
  const listings = useSelector((state: RootState) => state.listings.items)
  const services = useSelector((state: RootState) => state.networking.services)
  const lifts = useSelector((state: RootState) => state.networking.lifts)

  const [activeHub, setActiveHub] = useState<PlanetaryHub>(PLANETARY_HUBS[0])
  const [utcTime, setUtcTime] = useState<string>('')
  const [omniQuery, setOmniQuery] = useState('')
  const [gruvsEvents, setGruvsEvents] = useState<GruvsEvent[]>([])
  const [showCascadeModal, setShowCascadeModal] = useState(false)
  const [isSearching, setIsSearching] = useState(false)

  // Real-time ticking UTC clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date()
      setUtcTime(now.toUTCString().replace('GMT', 'UTC'))
    }
    updateTime()
    const timer = setInterval(updateTime, 1000)
    return () => clearInterval(timer)
  }, [])

  // Fetch upcoming live events from The Gruvs
  useEffect(() => {
    let cancelled = false
    fetchUpcomingGruvsEvents().then(events => {
      if (!cancelled) setGruvsEvents(events.slice(0, 3))
    }).catch(() => {})
    return () => { cancelled = true }
  }, [])

  const handleHubSelect = (hub: PlanetaryHub) => {
    playTactileSound('tab')
    setActiveHub(hub)
  }

  const handleOmniSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!omniQuery.trim()) return
    playTactileSound('pop')
    setIsSearching(true)
    const q = omniQuery.toLowerCase()

    setTimeout(() => {
      setIsSearching(false)
      if (q.includes('room') || q.includes('rent') || q.includes('house') || q.includes('lease') || q.includes('flat')) {
        router.push('/dashboard/housing')
      } else if (q.includes('directive') || q.includes('broadcast') || q.includes('department') || q.includes('school') || q.includes('education')) {
        setShowCascadeModal(true)
      } else if (q.includes('trade') || q.includes('plumber') || q.includes('electrician') || q.includes('move') || q.includes('lift')) {
        router.push('/dashboard/services')
      } else if (q.includes('map') || q.includes('radar') || q.includes('vibe') || q.includes('outage') || q.includes('load shedding')) {
        router.push('/dashboard/community?tab=vibemap')
      } else if (q.includes('dispute') || q.includes('market') || q.includes('spaza') || q.includes('community')) {
        router.push('/dashboard/community')
      } else if (q.includes('event') || q.includes('music') || q.includes('gruvs') || q.includes('concert')) {
        if (GRUVS.url) window.open(GRUVS.url, '_blank')
      } else if (q.includes('excel') || q.includes('budget') || q.includes('skill') || q.includes('tearn')) {
        if (TEARNS.url) window.open(TEARNS.url, '_blank')
      } else if (q.includes('profile') || q.includes('passport') || q.includes('id') || q.includes('trust')) {
        router.push('/dashboard/profile')
      } else {
        router.push(`/dashboard/housing?q=${encodeURIComponent(omniQuery)}`)
      }
    }, 400)
  }

  const quickPrompts = [
    { label: 'Find Verified Rooms', query: 'rooms near university' },
    { label: 'Department Directives', query: 'education department circulars' },
    { label: 'Emergency Plumber', query: 'emergency plumbing dispatch' },
    { label: '3D Vibe Radar', query: 'open live vibe radar map' },
    { label: 'Tonight on The Gruvs', query: 'gruvs nightlife concerts' },
    { label: 'Co-Living Audit Challenge', query: 'tearns excellence co-living budget' }
  ]

  return (
    <div className="relative min-h-[calc(100dvh-5rem)] p-3 sm:p-5 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Background Cyber Grid Accent */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(212,175,55,0.08),rgba(255,255,255,0))]" />

      {/* ── 1. PLANETARY TELEMETRY & HUB SELECTOR ───────────────────────── */}
      <section className="relative rounded-3xl bg-neutral-950/80 border border-gold-primary/25 backdrop-blur-2xl p-4 sm:p-6 overflow-hidden">
        {/* Futuristic Corner HUD Markers */}
        <div className="absolute top-2 left-2 w-3 h-3 border-t-2 border-l-2 border-gold-primary" />
        <div className="absolute top-2 right-2 w-3 h-3 border-t-2 border-r-2 border-gold-primary" />
        <div className="absolute bottom-2 left-2 w-3 h-3 border-b-2 border-l-2 border-gold-primary" />
        <div className="absolute bottom-2 right-2 w-3 h-3 border-b-2 border-r-2 border-gold-primary" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-white/10">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="font-mono text-[10px] sm:text-xs font-black uppercase tracking-widest text-emerald-400">
                Planetary Human Operating Network
              </span>
              <span className="text-white/20 font-mono">|</span>
              <span className="font-mono text-[10px] text-gray-400">GRID v4.9.2</span>
            </div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-white italic tracking-tight uppercase mt-1">
              Command <span className="text-gold-primary">Bridge</span>
            </h1>
            <p className="text-xs text-gray-400 mt-0.5">
              Coordinating urban habitat, civil defense directives, peer logistics, and cultural frequencies worldwide.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 font-mono text-[10px] sm:text-xs text-gray-300 flex items-center gap-2">
              <Activity size={13} className="text-cyan-400 animate-pulse" />
              <span>{utcTime || 'SYNCHRONIZING...'}</span>
            </div>
            <div className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 font-mono text-[10px] sm:text-xs text-gray-300 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
              <span>NODES: <strong>{activeHub.meshNodes}</strong></span>
            </div>
            <div className="px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 font-mono text-[10px] sm:text-xs text-amber-300 flex items-center gap-1.5">
              <ShieldCheck size={13} className="text-amber-400" />
              <span>DEFENSE: <strong>ARMED ({activeHub.emergencyNumber})</strong></span>
            </div>
          </div>
        </div>

        {/* Global Hub Selector Bar */}
        <div className="pt-4 space-y-2">
          <div className="flex items-center justify-between text-[11px] text-gray-400 font-bold uppercase tracking-wider">
            <span className="flex items-center gap-1.5">
              <Compass size={13} className="text-gold-primary" /> Active Planetary Sector
            </span>
            <span className="text-gold-primary font-mono text-[10px]">
              {activeHub.lat.toFixed(4)}°, {activeHub.lon.toFixed(4)}°
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
            {PLANETARY_HUBS.map(hub => {
              const isSelected = activeHub.id === hub.id
              return (
                <button
                  key={hub.id}
                  type="button"
                  onClick={() => handleHubSelect(hub)}
                  className={`p-2.5 rounded-2xl border text-left transition-all active:scale-95 ${
                    isSelected
                      ? 'bg-gold-primary/15 border-gold-primary text-white'
                      : 'bg-white/5 border-white/10 text-gray-400 hover:text-white hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-lg">{hub.flag}</span>
                    <span className={`text-[9px] font-mono px-1.5 py-0.2 rounded font-black ${
                      isSelected ? 'bg-gold-primary text-black' : 'bg-white/10 text-gray-400'
                    }`}>
                      {hub.currency}
                    </span>
                  </div>
                  <p className="text-xs font-black tracking-tight text-white mt-1.5 truncate">{hub.name}</p>
                  <p className="text-[10px] text-gray-400 truncate">{hub.region}</p>
                </button>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── 2. OMNI-COMMAND SENTINEL (NATURAL LANGUAGE RESOLVER) ─────────── */}
      <section className="relative rounded-3xl bg-neutral-950/70 border border-white/15 backdrop-blur-2xl p-4 sm:p-6 space-y-3">
        <form onSubmit={handleOmniSubmit} className="relative flex items-center">
          <div className="absolute left-4 text-gold-primary">
            <Search size={18} />
          </div>
          <input
            type="text"
            value={omniQuery}
            onChange={e => setOmniQuery(e.target.value)}
            placeholder={`Ask Resident Core... (e.g. 'find rooms under ${activeHub.currencySymbol}4000', 'education directives', 'plumber')`}
            className="w-full bg-black/70 border border-white/20 rounded-2xl pl-12 pr-28 py-3.5 text-xs sm:text-sm text-white placeholder-gray-500 outline-none focus:border-gold-primary font-medium"
          />
          <button
            type="submit"
            disabled={isSearching}
            className="absolute right-2 px-4 py-2 rounded-xl bg-gold-primary hover:bg-gold-secondary text-black font-black text-xs uppercase tracking-wider transition-all flex items-center gap-1.5 disabled:opacity-50"
          >
            {isSearching ? <RefreshCw size={13} className="animate-spin" /> : <Send size={13} />}
            <span>Execute</span>
          </button>
        </form>

        {/* Suggested Quick Prompt Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1">
          <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 shrink-0 mr-1 flex items-center gap-1">
            <Sparkles size={11} className="text-gold-primary" /> Prompts:
          </span>
          {quickPrompts.map((p, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                setOmniQuery(p.query)
                playTactileSound('tab')
              }}
              className="px-2.5 py-1 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] font-semibold text-gray-300 hover:text-white shrink-0 transition-all active:scale-95"
            >
              {p.label}
            </button>
          ))}
        </div>
      </section>

      {/* ── 3. RADAR & TRIANGULAR DIRECTIVES DUAL COCKPIT ─────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* TACTICAL GEORADAR WIDGET (7 Cols) */}
        <section className="lg:col-span-7 rounded-3xl bg-neutral-950/80 border border-white/15 p-5 sm:p-6 flex flex-col justify-between space-y-4 relative overflow-hidden">
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                <Radio size={16} className="animate-pulse" />
              </div>
              <div>
                <h3 className="text-sm font-black text-white uppercase tracking-tight flex items-center gap-1.5">
                  Tactical Precinct Radar &amp; Vibe Streams
                </h3>
                <p className="text-[10px] text-gray-400 font-mono">
                  SECTOR: {activeHub.name} • RANGE: 5.0 KM
                </p>
              </div>
            </div>

            <Link
              href="/dashboard/community?tab=vibemap"
              onClick={() => playTactileSound('tab')}
              className="px-3 py-1.5 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/40 text-cyan-300 font-black text-[11px] uppercase tracking-wider flex items-center gap-1 transition-all active:scale-95 shrink-0"
            >
              <span>Full 3D VibeMap</span>
              <ArrowUpRight size={13} />
            </Link>
          </div>

          {/* Interactive Radar Visualizer Simulation */}
          <div className="relative w-full h-52 sm:h-60 rounded-2xl bg-black border border-cyan-500/30 overflow-hidden flex items-center justify-center">
            {/* Concentric Radar Rings */}
            <div className="absolute inset-4 rounded-full border border-cyan-500/20 pointer-events-none" />
            <div className="absolute inset-14 rounded-full border border-cyan-500/25 pointer-events-none" />
            <div className="absolute inset-24 rounded-full border border-cyan-500/30 pointer-events-none" />
            <div className="absolute w-full h-[1px] bg-cyan-500/20 pointer-events-none" />
            <div className="absolute h-full w-[1px] bg-cyan-500/20 pointer-events-none" />

            {/* Sweeping Sonar Beam */}
            <div className="absolute inset-0 rounded-full animate-[spin_4s_linear_infinite] pointer-events-none origin-center bg-[conic-gradient(from_0deg,transparent_0_300deg,rgba(6,182,212,0.35)_360deg)]" />

            {/* Ping Indicators on Radar */}
            <div className="absolute top-1/3 left-1/4 flex flex-col items-center">
              <span className="w-3 h-3 rounded-full bg-gold-primary animate-ping" />
              <span className="text-[9px] font-mono text-gold-primary font-black mt-1 bg-black/80 px-1 rounded border border-gold-primary/30">
                {listings.length || 24} Rooms
              </span>
            </div>

            <div className="absolute bottom-1/4 right-1/3 flex flex-col items-center">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-400 animate-pulse" />
              <span className="text-[9px] font-mono text-purple-300 font-bold mt-1 bg-black/80 px-1 rounded border border-purple-500/30">
                Gruvs Venue
              </span>
            </div>

            <div className="absolute top-1/4 right-1/4 flex flex-col items-center">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
              <span className="text-[9px] font-mono text-emerald-300 font-bold mt-1 bg-black/80 px-1 rounded border border-emerald-500/30">
                Safe CPF Station
              </span>
            </div>

            {/* Radar Center HUD */}
            <div className="relative z-10 text-center pointer-events-none bg-black/90 p-3 rounded-2xl border border-cyan-500/40 backdrop-blur-md">
              <span className="text-[10px] font-mono text-cyan-400 uppercase font-black block">Central Coordinate</span>
              <p className="text-white font-mono font-bold text-xs">
                {activeHub.lat.toFixed(4)}° S, {activeHub.lon.toFixed(4)}° E
              </p>
              <p className="text-[9px] text-gray-400 mt-0.5 font-mono">
                PRECINCT VIBE INDEX: <strong className="text-emerald-400 font-black">94% CALM &amp; MONITORED</strong>
              </p>
            </div>
          </div>

          {/* Radar Telemetry Pills */}
          <div className="grid grid-cols-3 gap-2 pt-1 text-center font-mono text-xs">
            <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
              <span className="text-[10px] text-gray-400 uppercase font-black block">Verified Habitat</span>
              <span className="text-gold-primary font-black text-sm">{listings.length || 24}</span>
              <span className="text-[10px] text-gray-500 block">Listings in Sector</span>
            </div>
            <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
              <span className="text-[10px] text-gray-400 uppercase font-black block">Registered Trades</span>
              <span className="text-cyan-400 font-black text-sm">{services.length || 18}</span>
              <span className="text-[10px] text-gray-500 block">Standby Plumbers/Tech</span>
            </div>
            <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
              <span className="text-[10px] text-gray-400 uppercase font-black block">Active Lift Pools</span>
              <span className="text-emerald-400 font-black text-sm">{lifts.length || 7}</span>
              <span className="text-[10px] text-gray-500 block">Carpool Routes</span>
            </div>
          </div>
        </section>

        {/* TRIANGULAR DEPARTMENT DIRECTIVES STREAM (5 Cols) */}
        <section className="lg:col-span-5 rounded-3xl bg-neutral-950/80 border border-white/15 p-5 sm:p-6 flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <Layers size={16} />
              </div>
              <div>
                <h3 className="text-sm font-black text-white uppercase tracking-tight flex items-center gap-1.5">
                  Institutional Cascade Directives
                </h3>
                <p className="text-[10px] text-gray-400">
                  Triangular Network (Apex ➔ Regional ➔ Ground)
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => { setShowCascadeModal(true); playTactileSound('tab') }}
              className="px-2.5 py-1 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 font-black text-[10px] uppercase tracking-wider transition-all"
            >
              Open Network
            </button>
          </div>

          {/* Active Directives Feed */}
          <div className="space-y-2.5 max-h-[300px] overflow-y-auto custom-scrollbar pr-1">
            <div className="p-3 rounded-2xl bg-white/5 border border-amber-500/30 space-y-1.5">
              <div className="flex items-center justify-between text-[10px]">
                <span className="font-mono font-black text-amber-400 uppercase bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                  Level 1 • Higher Education
                </span>
                <span className="text-gray-400">12m ago</span>
              </div>
              <h4 className="text-xs font-black text-white">Examination Quiet Hours &amp; Night Shuttle Rotation</h4>
              <p className="text-[11px] text-gray-300 leading-snug">
                All campus precincts entering academic quiet hours. Night security shuttles operating every 15 mins.
              </p>
            </div>

            <div className="p-3 rounded-2xl bg-white/5 border border-cyan-500/30 space-y-1.5">
              <div className="flex items-center justify-between text-[10px]">
                <span className="font-mono font-black text-cyan-400 uppercase bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
                  Level 2 • Police &amp; CPF
                </span>
                <span className="text-gray-400">1h ago</span>
              </div>
              <h4 className="text-xs font-black text-white">Sub-Sector High-Visibility Foot Patrols</h4>
              <p className="text-[11px] text-gray-300 leading-snug">
                Joint CPF &amp; SAPS foot patrols active along student transit arteries. Emergency SOS response time: under 3 mins.
              </p>
            </div>

            <div className="p-3 rounded-2xl bg-white/5 border border-purple-500/30 space-y-1.5">
              <div className="flex items-center justify-between text-[10px]">
                <span className="font-mono font-black text-purple-400 uppercase bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
                  Level 3 • Energy Utilities
                </span>
                <span className="text-gray-400">3h ago</span>
              </div>
              <h4 className="text-xs font-black text-white">Substation Feeder Maintenance</h4>
              <p className="text-[11px] text-gray-300 leading-snug">
                Prepaid token clearing normal. Battery storage reserves standing at 98% capacity.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => { setShowCascadeModal(true); playTactileSound('pop') }}
            className="w-full py-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 font-black text-xs uppercase tracking-wider transition-all active:scale-95 flex items-center justify-center gap-1.5"
          >
            <Layers size={13} />
            <span>Issue or Inspect Directives</span>
          </button>
        </section>
      </div>

      {/* ── 4. SISTER APPS FREQUENCY MONITOR (THE GRUVS & TEARN'S EXCELLENCE) ─ */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* THE GRUVS PORTAL */}
        <div className="rounded-3xl bg-gradient-to-br from-purple-950/40 to-neutral-950 border border-purple-500/30 p-5 sm:p-6 space-y-3 relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Image
                src="/gruvs-logo.png"
                alt="The Gruvs"
                width={28}
                height={28}
                className="rounded-full object-cover group-hover:rotate-12 transition-transform"
              />
              <div>
                <h4 className="text-sm font-black text-white uppercase tracking-tight flex items-center gap-1.5">
                  {GRUVS.name}
                  <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 font-bold">
                    CULTURE RADAR
                  </span>
                </h4>
                <p className="text-[10px] text-gray-400">{GRUVS.headline}</p>
              </div>
            </div>

            <a
              href={GRUVS.url ?? '#'}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => playTactileSound('tab')}
              className="p-2 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/40 text-purple-300 transition-all"
              title="Open The Gruvs"
            >
              <ExternalLink size={14} />
            </a>
          </div>

          <p className="text-xs text-gray-300 leading-relaxed">
            {GRUVS.body}
          </p>

          {/* Gruvs Live Events Ticker */}
          <div className="space-y-1.5 pt-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-purple-400 font-bold flex items-center gap-1">
              <Sparkles size={11} /> Verified Shows Near {activeHub.name}:
            </span>
            {gruvsEvents.length > 0 ? (
              <div className="space-y-1">
                {gruvsEvents.map(ev => (
                  <div key={ev.id} className="p-2 rounded-xl bg-black/60 border border-purple-500/20 text-xs flex items-center justify-between">
                    <span className="text-white font-bold truncate max-w-[180px] sm:max-w-xs">{ev.title}</span>
                    <span className="text-[10px] text-purple-300 font-mono shrink-0">
                      {formatGruvsEventWhen(ev.startsAt)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-gray-400 italic bg-black/40 p-2 rounded-xl border border-white/5">
                Check {GRUVS.name} for tonight&apos;s verified festival and concert lineups.
              </p>
            )}
          </div>

          <div className="pt-2 flex items-center justify-between border-t border-purple-500/20">
            <span className="text-[10px] text-gray-400 font-mono italic">
              {GRUVS_TOUCH_DOWN}
            </span>
            <a
              href={GRUVS.url ?? '#'}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => playTactileSound('pop')}
              className="px-3.5 py-1.5 rounded-xl bg-purple-600/30 hover:bg-purple-600/50 border border-purple-500/50 text-purple-200 font-black text-xs uppercase tracking-wider transition-all active:scale-95 flex items-center gap-1"
            >
              <span>{GRUVS.cta}</span>
              <ArrowUpRight size={12} />
            </a>
          </div>
        </div>

        {/* TEARN'S EXCELLENCE FORGE */}
        <div className="rounded-3xl bg-gradient-to-br from-blue-950/40 to-neutral-950 border border-blue-500/30 p-5 sm:p-6 space-y-3 relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-full bg-blue-500/20 border border-blue-500/40 flex items-center justify-center text-blue-400">
                <Table2 size={16} />
              </div>
              <div>
                <h4 className="text-sm font-black text-white uppercase tracking-tight flex items-center gap-1.5">
                  {TEARNS.name}
                  <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30 font-bold">
                    SKILLS &amp; AUDITS
                  </span>
                </h4>
                <p className="text-[10px] text-gray-400">{TEARNS.headline}</p>
              </div>
            </div>

            {TEARNS.url && (
              <a
                href={TEARNS.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => playTactileSound('tab')}
                className="p-2 rounded-xl bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/40 text-blue-300 transition-all"
                title="Open TEARN's Excellence"
              >
                <ExternalLink size={14} />
              </a>
            )}
          </div>

          <p className="text-xs text-gray-300 leading-relaxed">
            {TEARNS.body}
          </p>

          <div className="p-3 rounded-2xl bg-black/60 border border-blue-500/20 space-y-1">
            <span className="text-[10px] font-mono text-blue-400 uppercase font-black block">
              Today&apos;s Co-Living Practical Challenge:
            </span>
            <p className="text-xs font-bold text-white">
              Formula Auditing for Shared Water &amp; Electricity Meters
            </p>
            <p className="text-[10px] text-gray-400">
              Detect hidden calculation traps, prorate split utility bills fairly among roommates, and earn verified competence badges.
            </p>
          </div>

          <div className="pt-2 flex items-center justify-between border-t border-blue-500/20">
            <span className="text-[10px] text-gray-400 font-mono">
              Built for South African workplace data accuracy.
            </span>
            {TEARNS.url && (
              <a
                href={TEARNS.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => playTactileSound('pop')}
                className="px-3.5 py-1.5 rounded-xl bg-blue-600/30 hover:bg-blue-600/50 border border-blue-500/50 text-blue-200 font-black text-xs uppercase tracking-wider transition-all active:scale-95 flex items-center gap-1"
              >
                <span>{TEARNS.cta}</span>
                <ArrowUpRight size={12} />
              </a>
            )}
          </div>
        </div>
      </section>

      {/* ── 5. PLANETARY TACTICAL ACTION MATRIX ──────────────────────────── */}
      <section className="space-y-3">
        <h3 className="text-xs font-black uppercase tracking-widest text-gray-400 flex items-center gap-1.5">
          <Key size={13} className="text-gold-primary" /> Rapid Action Sovereignty Matrix
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
          <Link
            href="/dashboard/housing"
            onClick={() => playTactileSound('tab')}
            className="p-3.5 rounded-2xl bg-neutral-950 border border-white/10 hover:border-gold-primary/50 text-left transition-all active:scale-95 group"
          >
            <div className="w-8 h-8 rounded-xl bg-gold-primary/10 text-gold-primary flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
              <Home size={16} />
            </div>
            <h4 className="text-xs font-black text-white uppercase tracking-tight">Habitat</h4>
            <p className="text-[10px] text-gray-400 mt-0.5">Rooms &amp; Leases</p>
          </Link>

          <Link
            href="/dashboard/profile"
            onClick={() => playTactileSound('tab')}
            className="p-3.5 rounded-2xl bg-neutral-950 border border-white/10 hover:border-cyan-500/50 text-left transition-all active:scale-95 group"
          >
            <div className="w-8 h-8 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
              <ShieldCheck size={16} />
            </div>
            <h4 className="text-xs font-black text-white uppercase tracking-tight">Passport</h4>
            <p className="text-[10px] text-gray-400 mt-0.5">Resident ID &amp; Trust</p>
          </Link>

          <Link
            href="/dashboard/services"
            onClick={() => playTactileSound('tab')}
            className="p-3.5 rounded-2xl bg-neutral-950 border border-white/10 hover:border-amber-500/50 text-left transition-all active:scale-95 group"
          >
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
              <Wrench size={16} />
            </div>
            <h4 className="text-xs font-black text-white uppercase tracking-tight">Trades</h4>
            <p className="text-[10px] text-gray-400 mt-0.5">Plumbers &amp; Sparkys</p>
          </Link>

          <Link
            href="/dashboard/services"
            onClick={() => playTactileSound('tab')}
            className="p-3.5 rounded-2xl bg-neutral-950 border border-white/10 hover:border-purple-500/50 text-left transition-all active:scale-95 group"
          >
            <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
              <Car size={16} />
            </div>
            <h4 className="text-xs font-black text-white uppercase tracking-tight">Lift Club</h4>
            <p className="text-[10px] text-gray-400 mt-0.5">Detour Carpools</p>
          </Link>

          <Link
            href="/dashboard/community"
            onClick={() => playTactileSound('tab')}
            className="p-3.5 rounded-2xl bg-neutral-950 border border-white/10 hover:border-emerald-500/50 text-left transition-all active:scale-95 group"
          >
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
              <Users size={16} />
            </div>
            <h4 className="text-xs font-black text-white uppercase tracking-tight">Civic Hub</h4>
            <p className="text-[10px] text-gray-400 mt-0.5">Spazas &amp; Feeds</p>
          </Link>

          <Link
            href="/dashboard/community?tab=disputes"
            onClick={() => playTactileSound('tab')}
            className="p-3.5 rounded-2xl bg-neutral-950 border border-white/10 hover:border-red-500/50 text-left transition-all active:scale-95 group"
          >
            <div className="w-8 h-8 rounded-xl bg-red-500/10 text-red-400 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
              <Scale size={16} />
            </div>
            <h4 className="text-xs font-black text-white uppercase tracking-tight">Tribunal</h4>
            <p className="text-[10px] text-gray-400 mt-0.5">Dispute Mediation</p>
          </Link>
        </div>
      </section>

      {/* FULL CASCADE MODAL */}
      <AnimatePresence>
        {showCascadeModal && (
          <InstitutionalBroadcastsPortal
            isOpen={showCascadeModal}
            onClose={() => setShowCascadeModal(false)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
