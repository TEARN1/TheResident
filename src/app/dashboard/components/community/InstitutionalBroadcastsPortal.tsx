'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  GraduationCap, Building2, BookOpen, Bell, BellOff, Plus, X, ShieldCheck,
  Shield, Zap, Droplets, HeartPulse, Bus, ExternalLink, Table2, Layers
} from 'lucide-react'
import Image from 'next/image'
import { playTactileSound } from '../../../../utils/tactileSounds'
import { GRUVS, TEARNS } from '../../../../utils/sisterApps'

export type DepartmentDomain = 'education' | 'defense' | 'utilities' | 'health' | 'transport'

export type PyramidTier = 'national' | 'regional_hod' | 'institution' | 'local_unit'

export interface DepartmentBroadcast {
  id: string
  departmentDomain: DepartmentDomain
  departmentName: string
  pyramidTier: PyramidTier
  tierLabel: string
  title: string
  body: string
  targetAudience: string
  publishedAt: string
  verified: boolean
  gruvsEventLink?: {
    eventName: string
    venue: string
    date: string
  }
  tearnsExcellenceSkillTopic?: string
}

const SAMPLE_PYRAMID_BROADCASTS: DepartmentBroadcast[] = [
  {
    id: 'dept-edu-1',
    departmentDomain: 'education',
    departmentName: 'Department of Higher Education & Training (DHET)',
    pyramidTier: 'national',
    tierLabel: 'Level 1: National Apex Directive',
    title: 'University Co-Living Standards & NSFAS Student Living Guidelines',
    body: 'National directive issued to all university councils, vice-chancellors, and private student residence landlords. All approved accommodations must comply with verified fire safety, solar backup, and zero illegal deposit withholdings.',
    targetAudience: 'All Universities, Landlords & Students',
    publishedAt: '2 hours ago',
    verified: true,
    tearnsExcellenceSkillTopic: 'Student Accommodation Budgeting & Cashflow Audit'
  },
  {
    id: 'dept-edu-2',
    departmentDomain: 'education',
    departmentName: 'University of Cape Town — Student Affairs & SRC Directorate',
    pyramidTier: 'institution',
    tierLabel: 'Level 3: University Campus Command',
    title: 'Official O-Week & Campus Derby Shuttle Schedule',
    body: 'Campus protective services announce safe transport corridors between Upper Campus, Tugwell, and Observatory. Verified campus event lineups are synced to The Gruvs with live Touch Down check-ins for student security.',
    targetAudience: 'Registered Undergraduates & Faculty',
    publishedAt: '5 hours ago',
    verified: true,
    gruvsEventLink: {
      eventName: 'Varsity Welcome Festival & Sunset Session',
      venue: 'Jamieson Plaza, Upper Campus',
      date: 'Friday, 18:00'
    }
  },
  {
    id: 'dept-def-1',
    departmentDomain: 'defense',
    departmentName: 'National Department of Police & Community Safety',
    pyramidTier: 'national',
    tierLabel: 'Level 1: National Apex Directive',
    title: 'Sector Policing & Night Transit Protection Framework',
    body: 'Mandatory synchronization between municipal police clusters and Community Policing Forums (CPF). All neighborhood night patrols and student transit zones are designated priority visibility grids.',
    targetAudience: 'All Provincial Commissioners & CPFs',
    publishedAt: '1 day ago',
    verified: true
  },
  {
    id: 'dept-def-2',
    departmentDomain: 'defense',
    departmentName: 'Gauteng Central Cluster Command — Sector 3 CPF',
    pyramidTier: 'regional_hod',
    tierLabel: 'Level 2: Regional Command / HOD',
    title: 'Braamfontein Student District Night Patrol Deployment',
    body: 'Joint station command directive: Active foot patrols stationed at Jorissen, Bertha, and de Korte streets during exam study shifts and weekend social evenings. Report anomalies immediately via The Resident alert beacon.',
    targetAudience: 'Braamfontein Residents & Students',
    publishedAt: '1 day ago',
    verified: true
  },
  {
    id: 'dept-util-1',
    departmentDomain: 'utilities',
    departmentName: 'City Power & National Grid Directorate',
    pyramidTier: 'institution',
    tierLabel: 'Level 3: Infrastructure Station Command',
    title: 'Emergency Substation Maintenance & Water Tanker Rotation',
    body: 'Substation transformer upgrade scheduled for Thursday 08:00 to 14:00. Backup water tankers stationed at Central Campus Gate 4 and Civic Park.',
    targetAudience: 'Ward 60 & Ward 61 Residents',
    publishedAt: '2 days ago',
    verified: true
  },
  {
    id: 'dept-edu-3',
    departmentDomain: 'education',
    departmentName: 'Highveld Academic Cluster — Grade 10-12 Accounting Department',
    pyramidTier: 'local_unit',
    tierLabel: 'Level 4: Teacher & Subject HOD',
    title: 'Term Financial Ledger Practice & Data Verification Homework',
    body: 'Learners and parents: Chapter 8 Trial Balance exercises must be completed before Friday. Review workbook adjustments and practice real data reconciliation on Excel-compatible spreadsheets.',
    targetAudience: 'Learners & Guardians',
    publishedAt: '3 days ago',
    verified: true,
    tearnsExcellenceSkillTopic: 'Workplace Spreadsheet Calculations & Sum Audit'
  }
]

export default function InstitutionalBroadcastsPortal({
  isOpen = true,
  onClose,
  inline = false
}: {
  isOpen?: boolean
  onClose?: () => void
  inline?: boolean
}) {
  const [broadcasts, setBroadcasts] = useState<DepartmentBroadcast[]>(SAMPLE_PYRAMID_BROADCASTS)
  const [activeDomain, setActiveDomain] = useState<DepartmentDomain | 'all'>('all')
  const [activeTier, setActiveTier] = useState<PyramidTier | 'all'>('all')
  const [followedDepartments, setFollowedDepartments] = useState<string[]>([
    'Department of Higher Education & Training (DHET)',
    'Gauteng Central Cluster Command — Sector 3 CPF'
  ])
  const [showComposeModal, setShowComposeModal] = useState(false)

  // Compose State
  const [compDomain, setCompDomain] = useState<DepartmentDomain>('education')
  const [compDeptName, setCompDeptName] = useState('')
  const [compTier, setCompTier] = useState<PyramidTier>('institution')
  const [compTitle, setCompTitle] = useState('')
  const [compBody, setCompBody] = useState('')
  const [compAudience, setCompAudience] = useState('')
  const [compGruvsEvent, setCompGruvsEvent] = useState('')
  const [compTearnsSkill, setCompTearnsSkill] = useState('')

  if (!isOpen) return null

  const filtered = broadcasts.filter(b => {
    if (activeDomain !== 'all' && b.departmentDomain !== activeDomain) return false
    if (activeTier !== 'all' && b.pyramidTier !== activeTier) return false
    return true
  })

  const toggleFollow = (deptName: string) => {
    playTactileSound('pop')
    setFollowedDepartments(prev =>
      prev.includes(deptName) ? prev.filter(n => n !== deptName) : [...prev, deptName]
    )
  }

  const handlePostCircular = (e: React.FormEvent) => {
    e.preventDefault()
    playTactileSound('tab')
    const tierMap: Record<PyramidTier, string> = {
      national: 'Level 1: National Apex Directive',
      regional_hod: 'Level 2: Regional Command / HOD',
      institution: 'Level 3: Institutional Campus Command',
      local_unit: 'Level 4: Local Station & Field Unit'
    }
    const newBroadcast: DepartmentBroadcast = {
      id: `dept-${Date.now()}`,
      departmentDomain: compDomain,
      departmentName: compDeptName || 'Verified Department Unit',
      pyramidTier: compTier,
      tierLabel: tierMap[compTier],
      title: compTitle,
      body: compBody,
      targetAudience: compAudience || 'Community & Citizens',
      publishedAt: 'Just now',
      verified: true,
      gruvsEventLink: compGruvsEvent ? {
        eventName: compGruvsEvent,
        venue: 'Campus Grounds',
        date: 'Upcoming'
      } : undefined,
      tearnsExcellenceSkillTopic: compTearnsSkill || undefined
    }
    setBroadcasts([newBroadcast, ...broadcasts])
    setShowComposeModal(false)
    setCompDeptName('')
    setCompTitle('')
    setCompBody('')
    setCompAudience('')
    setCompGruvsEvent('')
    setCompTearnsSkill('')
  }

  const domainIcons: Record<DepartmentDomain, React.ElementType> = {
    education: GraduationCap,
    defense: Shield,
    utilities: Zap,
    health: HeartPulse,
    transport: Bus
  }

  const mainBody = (
    <div className={`relative w-full ${inline ? 'bg-black/60 border border-white/10 rounded-3xl p-4 sm:p-6' : 'max-w-5xl max-h-[92dvh] overflow-y-auto custom-scrollbar bg-neutral-950 border border-white/15 rounded-t-3xl sm:rounded-3xl p-5 sm:p-7'} flex flex-col space-y-4`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-white/10 gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0">
            <Layers size={22} />
          </div>
          <div>
            <h3 className="text-base font-black text-white uppercase tracking-tight flex items-center gap-2">
              Triangular Department Communication Network
            </h3>
            <p className="text-xs text-gray-400">
              Cascading directives from National Apex to Regional HODs, Local Institutions, and Ground Citizens.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            type="button"
            onClick={() => { setShowComposeModal(true); playTactileSound('tab') }}
            className="px-3.5 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 font-black text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all active:scale-95"
          >
            <Plus size={14} />
            <span>Issue Directive</span>
          </button>
          {onClose && (
            <button
              type="button"
              onClick={() => { playTactileSound('pop'); onClose() }}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all"
              aria-label="Close dialog"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Triangular Pyramid Cascade Visualizer Bar */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5 grid grid-cols-2 md:grid-cols-4 gap-2 text-center text-xs">
        <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex flex-col items-center">
          <span className="font-mono text-[10px] text-amber-400 uppercase font-black block">Level 1: Apex</span>
          <span className="text-white font-bold text-xs mt-0.5">National Ministry</span>
          <p className="text-[10px] text-gray-400 mt-0.5">Education / Defense</p>
        </div>
        <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/30 flex flex-col items-center">
          <span className="font-mono text-[10px] text-purple-400 uppercase font-black block">Level 2: Directorate</span>
          <span className="text-white font-bold text-xs mt-0.5">Regional HODs</span>
          <p className="text-[10px] text-gray-400 mt-0.5">Cluster Commanders</p>
        </div>
        <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex flex-col items-center">
          <span className="font-mono text-[10px] text-cyan-400 uppercase font-black block">Level 3: Institution</span>
          <span className="text-white font-bold text-xs mt-0.5">Universities &amp; Stations</span>
          <p className="text-[10px] text-gray-400 mt-0.5">Colleges &amp; Bases</p>
        </div>
        <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex flex-col items-center">
          <span className="font-mono text-[10px] text-emerald-400 uppercase font-black block">Level 4: Local Unit</span>
          <span className="text-white font-bold text-xs mt-0.5">Teachers &amp; Patrols</span>
          <p className="text-[10px] text-gray-400 mt-0.5">To Students &amp; Citizens</p>
        </div>
      </div>

      {/* Tier Filter Buttons */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar shrink-0">
        {[
          { id: 'all', label: 'All Levels' },
          { id: 'national', label: 'Level 1: National Apex' },
          { id: 'regional_hod', label: 'Level 2: Regional HOD' },
          { id: 'institution', label: 'Level 3: Campus / Station' },
          { id: 'local_unit', label: 'Level 4: Teacher / Field Unit' }
        ].map(tier => (
          <button
            key={tier.id}
            type="button"
            onClick={() => {
              playTactileSound('tab')
              setActiveTier(tier.id as PyramidTier | 'all')
            }}
            className={`px-3 py-1 rounded-xl text-[11px] font-bold tracking-tight shrink-0 transition-all border ${
              activeTier === tier.id
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                : 'bg-white/5 text-gray-400 border-white/10 hover:text-white'
            }`}
          >
            {tier.label}
          </button>
        ))}
      </div>

      {/* Department Domain Filter Pills */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar shrink-0 pt-1">
        {[
          { id: 'all', label: 'All Departments' },
          { id: 'education', label: '🎓 Education & Universities' },
          { id: 'defense', label: '🛡️ Defense, Police & CPF' },
          { id: 'utilities', label: '⚡ Energy & Water Utilities' },
          { id: 'health', label: '🏥 Health & Medical Care' },
          { id: 'transport', label: '🚌 Transport & Shuttles' }
        ].map(d => (
          <button
            key={d.id}
            type="button"
            onClick={() => {
              playTactileSound('tab')
              setActiveDomain(d.id as DepartmentDomain | 'all')
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider shrink-0 transition-all border ${
              activeDomain === d.id
                ? 'bg-gold-primary/20 text-gold-primary border-gold-primary/40'
                : 'bg-white/5 text-gray-400 border-white/10 hover:text-white'
            }`}
          >
            {d.label}
          </button>
        ))}
      </div>

      {/* Broadcasts Feed */}
      <div className="flex-1 overflow-y-auto space-y-3.5 pr-1 custom-scrollbar">
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-500 text-xs">
            No directives found for the selected filter combination.
          </div>
        ) : (
          filtered.map(item => {
            const isFollowed = followedDepartments.includes(item.departmentName)
            const DomainIcon = domainIcons[item.departmentDomain] || Building2
            return (
              <div
                key={item.id}
                className="bg-black/60 border border-white/10 hover:border-gold-primary/30 rounded-2xl p-4 sm:p-5 transition-all space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2 border-b border-white/5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-gold-primary font-bold shrink-0">
                      <DomainIcon size={16} />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-black text-white">{item.departmentName}</span>
                        {item.verified && <ShieldCheck size={13} className="text-gold-primary" />}
                        <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-white/5 text-gold-primary border border-gold-primary/20 font-bold">
                          {item.tierLabel}
                        </span>
                      </div>
                      <span className="text-[10px] text-gray-400 font-medium">
                        Audience: <strong className="text-gray-200">{item.targetAudience}</strong> • {item.publishedAt}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => toggleFollow(item.departmentName)}
                    className={`px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1 transition-all self-start sm:self-auto ${
                      isFollowed
                        ? 'bg-gold-primary/20 text-gold-primary border border-gold-primary/40'
                        : 'bg-white/5 hover:bg-white/10 text-gray-400 border border-white/10'
                    }`}
                  >
                    {isFollowed ? <Bell size={11} className="fill-gold-primary text-gold-primary" /> : <BellOff size={11} />}
                    <span>{isFollowed ? 'Subscribed' : 'Subscribe'}</span>
                  </button>
                </div>

                <div className="space-y-1.5">
                  <h4 className="text-sm font-black text-white tracking-tight">{item.title}</h4>
                  <p className="text-xs text-gray-300 leading-relaxed bg-white/[0.02] p-3 rounded-xl border border-white/5">
                    {item.body}
                  </p>
                </div>

                {/* Connected Bridges: The Gruvs & TEARN's Excellence */}
                <div className="flex flex-wrap gap-2 pt-1">
                  {item.gruvsEventLink && (
                    <a
                      href={GRUVS.url ?? undefined}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => playTactileSound('tab')}
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 text-purple-300 text-[11px] font-bold transition-all"
                    >
                      <Image src="/gruvs-logo.png" alt="The Gruvs" width={14} height={14} className="rounded-full" />
                      <span>Gruvs Campus Event: <strong>{item.gruvsEventLink.eventName}</strong> ({item.gruvsEventLink.venue})</span>
                      <ExternalLink size={12} className="opacity-70" />
                    </a>
                  )}

                  {item.tearnsExcellenceSkillTopic && (
                    TEARNS.url ? (
                      <a
                        href={TEARNS.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => playTactileSound('tab')}
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-blue-300 text-[11px] font-bold transition-all"
                      >
                        <Table2 size={13} className="text-blue-400" />
                        <span>Excellence Skill Task: <strong>{item.tearnsExcellenceSkillTopic}</strong></span>
                        <ExternalLink size={12} className="opacity-70" />
                      </a>
                    ) : (
                      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-gray-300 text-[11px] font-bold">
                        <Table2 size={13} className="text-gold-primary" />
                        <span>Excellence Skill Task: <strong>{item.tearnsExcellenceSkillTopic}</strong></span>
                      </div>
                    )
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )

  const composeModal = showComposeModal && (
    <div className="fixed inset-0 z-[290] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-lg bg-neutral-950 border border-white/20 rounded-3xl p-5 sm:p-6 space-y-4"
      >
        <div className="flex justify-between items-center pb-2 border-b border-white/10">
          <h4 className="text-sm font-black text-white uppercase tracking-tight">Issue Official Department Directive</h4>
          <button
            type="button"
            onClick={() => setShowComposeModal(false)}
            className="text-gray-400 hover:text-white"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handlePostCircular} className="space-y-3">
          <div className="grid grid-cols-2 gap-2.5">
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-gray-400">Department Domain</label>
              <select
                value={compDomain}
                onChange={e => setCompDomain(e.target.value as DepartmentDomain)}
                className="w-full bg-black/60 border border-white/15 rounded-xl px-2.5 py-2 text-xs text-white outline-none focus:border-gold-primary"
              >
                <option value="education" className="bg-black">Education &amp; Universities</option>
                <option value="defense" className="bg-black">Defense, Police &amp; CPF</option>
                <option value="utilities" className="bg-black">Energy &amp; Water Utilities</option>
                <option value="health" className="bg-black">Health &amp; Medical Care</option>
                <option value="transport" className="bg-black">Transport &amp; Shuttles</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-gray-400">Pyramid Level</label>
              <select
                value={compTier}
                onChange={e => setCompTier(e.target.value as PyramidTier)}
                className="w-full bg-black/60 border border-white/15 rounded-xl px-2.5 py-2 text-xs text-white outline-none focus:border-gold-primary"
              >
                <option value="national" className="bg-black">Level 1: National Apex</option>
                <option value="regional_hod" className="bg-black">Level 2: Regional HOD</option>
                <option value="institution" className="bg-black">Level 3: University / Base</option>
                <option value="local_unit" className="bg-black">Level 4: Teacher / Patrol Unit</option>
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-gray-400">Department / Institution Name</label>
            <input
              type="text"
              required
              value={compDeptName}
              onChange={e => setCompDeptName(e.target.value)}
              placeholder="e.g. University Student Affairs or Station CPF"
              className="w-full bg-black/60 border border-white/15 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-gold-primary"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-gray-400">Directive Title</label>
            <input
              type="text"
              required
              value={compTitle}
              onChange={e => setCompTitle(e.target.value)}
              placeholder="e.g. Examination Quiet Hours & Night Shuttle Rotation"
              className="w-full bg-black/60 border border-white/15 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-gold-primary"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-gray-400">Announcement / Details</label>
            <textarea
              required
              rows={3}
              value={compBody}
              onChange={e => setCompBody(e.target.value)}
              placeholder="Type official directive, curfew hours, or safety instructions..."
              className="w-full bg-black/60 border border-white/15 rounded-xl p-3 text-xs text-white outline-none focus:border-gold-primary resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-purple-300">Gruvs Campus Event (Optional)</label>
              <input
                type="text"
                value={compGruvsEvent}
                onChange={e => setCompGruvsEvent(e.target.value)}
                placeholder="e.g. O-Week Festival 2026"
                className="w-full bg-black/60 border border-purple-500/30 rounded-xl px-3 py-1.5 text-xs text-white outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-blue-300">Excellence Skill Task (Optional)</label>
              <input
                type="text"
                value={compTearnsSkill}
                onChange={e => setCompTearnsSkill(e.target.value)}
                placeholder="e.g. Co-Living Expense Audit"
                className="w-full bg-black/60 border border-blue-500/30 rounded-xl px-3 py-1.5 text-xs text-white outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 font-black text-xs uppercase tracking-wider transition-all mt-2 active:scale-95"
          >
            Broadcast Downward Through Pyramid Hierarchy
          </button>
        </form>
      </motion.div>
    </div>
  )

  if (inline) {
    return (
      <div className="w-full">
        {mainBody}
        {composeModal}
      </div>
    )
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[280] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="w-full max-w-5xl"
        >
          {mainBody}
        </motion.div>
        {composeModal}
      </div>
    </AnimatePresence>
  )
}
