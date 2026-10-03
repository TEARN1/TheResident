'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  GraduationCap, Building2, BookOpen, Bell, BellOff, Plus, X, ShieldCheck
} from 'lucide-react'
import { playTactileSound } from '../../../../utils/tactileSounds'

export interface EducationalBroadcast {
  id: string
  institutionName: string
  institutionType: 'Department of Education' | 'University / TVET' | 'School / Teacher'
  title: string
  body: string
  category: 'Homework / Academic' | 'Exam Timetable' | 'Res & Safety' | 'Official Circular'
  targetAudience: 'Parents & Guardians' | 'Students & Residents' | 'All Community'
  publishedAt: string
  verified: boolean
  attachments?: string[]
}

const SAMPLE_BROADCASTS: EducationalBroadcast[] = [
  {
    id: 'edu-1',
    institutionName: 'Gauteng Department of Education (GDE)',
    institutionType: 'Department of Education',
    title: 'Term 4 Examination Schedule & Academic Calendar Directives',
    body: 'Official notice to all schools, parents, and student residences regarding the final matric examination protocol, quiet hours in student precincts, and 2027 admissions schedule.',
    category: 'Official Circular',
    targetAudience: 'All Community',
    publishedAt: '2 hours ago',
    verified: true
  },
  {
    id: 'edu-2',
    institutionName: 'University of the Witwatersrand (Wits)',
    institutionType: 'University / TVET',
    title: 'Braamfontein Student Residence Night Shuttle & Exam Hall Access',
    body: 'Campus security has extended the night shuttle rotation between Yale Road, Junction Res, and Southpoint until 02:00 AM daily throughout the study week.',
    category: 'Res & Safety',
    targetAudience: 'Students & Residents',
    publishedAt: 'Yesterday',
    verified: true
  },
  {
    id: 'edu-3',
    institutionName: 'Barnato Park High School — Grade 10 Math Dept',
    institutionType: 'School / Teacher',
    title: 'Weekly Homework Log & Parent-Teacher Progress Meetings',
    body: 'Dear Parents & Guardians: Chapter 6 Trigonometry revision worksheets are due this Thursday. Please review your learners homework diaries. Parent consultations are scheduled for Friday afternoon.',
    category: 'Homework / Academic',
    targetAudience: 'Parents & Guardians',
    publishedAt: '3 days ago',
    verified: true
  }
]

export default function InstitutionalBroadcastsPortal({
  isOpen,
  onClose
}: {
  isOpen: boolean
  onClose: () => void
}) {
  const [broadcasts, setBroadcasts] = useState<EducationalBroadcast[]>(SAMPLE_BROADCASTS)
  const [activeFilter, setActiveFilter] = useState<'all' | 'dbe' | 'university' | 'school'>('all')
  const [followedInstitutions, setFollowedInstitutions] = useState<string[]>([
    'Gauteng Department of Education (GDE)',
    'Barnato Park High School — Grade 10 Math Dept'
  ])
  const [showComposeModal, setShowComposeModal] = useState(false)

  // Compose Form
  const [compInstName, setCompInstName] = useState('')
  const [compType, setCompType] = useState<EducationalBroadcast['institutionType']>('School / Teacher')
  const [compTitle, setCompTitle] = useState('')
  const [compBody, setCompBody] = useState('')
  const [compCategory, setCompCategory] = useState<EducationalBroadcast['category']>('Homework / Academic')
  const [compAudience, setCompAudience] = useState<EducationalBroadcast['targetAudience']>('Parents & Guardians')

  if (!isOpen) return null

  const filtered = broadcasts.filter(b => {
    if (activeFilter === 'dbe') return b.institutionType === 'Department of Education'
    if (activeFilter === 'university') return b.institutionType === 'University / TVET'
    if (activeFilter === 'school') return b.institutionType === 'School / Teacher'
    return true
  })

  const toggleFollow = (name: string) => {
    playTactileSound('pop')
    setFollowedInstitutions(prev =>
      prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
    )
  }

  const handlePostCircular = (e: React.FormEvent) => {
    e.preventDefault()
    playTactileSound('success')
    const newBroadcast: EducationalBroadcast = {
      id: `edu-${Date.now()}`,
      institutionName: compInstName || 'Verified School / Educator',
      institutionType: compType,
      title: compTitle,
      body: compBody,
      category: compCategory,
      targetAudience: compAudience,
      publishedAt: 'Just now',
      verified: true
    }
    setBroadcasts([newBroadcast, ...broadcasts])
    setShowComposeModal(false)
    setCompTitle('')
    setCompBody('')
    setCompInstName('')
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[230] flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-4xl bg-[var(--card-bg,rgba(11,43,38,0.95))] border border-[var(--glass-border,rgba(142,182,155,0.3))] rounded-3xl p-5 sm:p-7 shadow-2xl backdrop-blur-2xl flex flex-col max-h-[90vh] overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-white/10 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center shadow-glow">
                <GraduationCap size={22} />
              </div>
              <div>
                <h3 className="text-base font-black text-white uppercase tracking-tight flex items-center gap-2">
                  Institutional & School Communication Network
                </h3>
                <p className="text-xs text-gray-400">
                  Department of Education, University res advisories, and Teacher-Parent homework bulletins.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowComposeModal(true)}
                className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-glow transition-all active:scale-95"
              >
                <Plus size={14} />
                <span>Post Circular</span>
              </button>
              <button
                onClick={onClose}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white"
                aria-label="Close dialog"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="flex items-center gap-2 pt-4 pb-2 overflow-x-auto no-scrollbar shrink-0">
            {[
              { id: 'all', label: 'All Broadcasts' },
              { id: 'dbe', label: 'Dept of Education (DBE/GDE)' },
              { id: 'university', label: 'Universities & Colleges' },
              { id: 'school', label: 'School Teachers & Parents' }
            ].map(f => (
              <button
                key={f.id}
                onClick={() => {
                  playTactileSound('tab')
                  setActiveFilter(f.id as 'all' | 'dbe' | 'university' | 'school')
                }}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider shrink-0 transition-all border ${
                  activeFilter === f.id
                    ? 'bg-amber-500 text-black border-amber-500 shadow-glow'
                    : 'bg-black/50 text-gray-400 border-white/10 hover:text-white hover:bg-white/5'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Broadcasts Feed */}
          <div className="flex-1 overflow-y-auto pt-3 space-y-4 pr-1 custom-scrollbar">
            {filtered.map(item => {
              const isFollowed = followedInstitutions.includes(item.institutionName)
              return (
                <div
                  key={item.id}
                  className="bg-black/50 border border-white/10 hover:border-amber-500/30 rounded-3xl p-5 shadow-glass transition-all space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-white/5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-amber-400 font-bold shrink-0">
                        {item.institutionType === 'Department of Education' ? <Building2 size={16} /> : item.institutionType === 'University / TVET' ? <GraduationCap size={16} /> : <BookOpen size={16} />}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-black text-white">{item.institutionName}</span>
                          {item.verified && <ShieldCheck size={13} className="text-amber-400" />}
                        </div>
                        <span className="text-[10px] text-gray-400 font-medium">
                          Target: <strong className="text-amber-300">{item.targetAudience}</strong> • {item.publishedAt}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-black uppercase px-2.5 py-0.5 rounded-full bg-white/5 text-gray-300 border border-white/10">
                        {item.category}
                      </span>
                      <button
                        onClick={() => toggleFollow(item.institutionName)}
                        className={`px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1 transition-all ${
                          isFollowed
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                            : 'bg-white/5 hover:bg-white/10 text-gray-400 border border-white/10'
                        }`}
                      >
                        {isFollowed ? <Bell size={11} className="fill-amber-400" /> : <BellOff size={11} />}
                        <span>{isFollowed ? 'Subscribed' : 'Subscribe'}</span>
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <h4 className="text-sm font-black text-white tracking-tight">{item.title}</h4>
                    <p className="text-xs text-gray-300 leading-relaxed bg-white/[0.02] p-3 rounded-2xl border border-white/5">
                      {item.body}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </motion.div>
      </div>

      {/* Compose Circular Modal */}
      {showComposeModal && (
        <div className="fixed inset-0 z-[270] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md bg-[var(--card-bg,rgba(11,43,38,0.95))] border border-[var(--glass-border,rgba(142,182,155,0.3))] rounded-3xl p-6 shadow-2xl space-y-4"
          >
            <div className="flex justify-between items-center pb-2 border-b border-white/10">
              <h4 className="text-sm font-black text-white uppercase tracking-tight">Post Educational Circular</h4>
              <button onClick={() => setShowComposeModal(false)} className="text-gray-400 hover:text-white">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handlePostCircular} className="space-y-3">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-gray-300">Institution / School / Department Name</label>
                <input
                  type="text"
                  required
                  value={compInstName}
                  onChange={e => setCompInstName(e.target.value)}
                  placeholder="e.g. Parktown Boys High / Wits Campus Health"
                  className="w-full bg-black/60 border border-white/15 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-amber-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-gray-300">Tier / Type</label>
                  <select
                    value={compType}
                    onChange={e => setCompType(e.target.value as EducationalBroadcast['institutionType'])}
                    className="w-full bg-black/60 border border-white/15 rounded-xl px-2.5 py-2 text-xs text-white outline-none focus:border-amber-400"
                  >
                    <option value="School / Teacher" className="bg-black">School / Teacher</option>
                    <option value="University / TVET" className="bg-black">University / College</option>
                    <option value="Department of Education" className="bg-black">Dept of Education</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-gray-300">Target Audience</label>
                  <select
                    value={compAudience}
                    onChange={e => setCompAudience(e.target.value as EducationalBroadcast['targetAudience'])}
                    className="w-full bg-black/60 border border-white/15 rounded-xl px-2.5 py-2 text-xs text-white outline-none focus:border-amber-400"
                  >
                    <option value="Parents & Guardians" className="bg-black">Parents & Guardians</option>
                    <option value="Students & Residents" className="bg-black">Students & Residents</option>
                    <option value="All Community" className="bg-black">All Community</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-gray-300">Notice Category</label>
                <select
                  value={compCategory}
                  onChange={e => setCompCategory(e.target.value as EducationalBroadcast['category'])}
                  className="w-full bg-black/60 border border-white/15 rounded-xl px-2.5 py-2 text-xs text-white outline-none focus:border-amber-400"
                >
                  <option value="Homework / Academic" className="bg-black">Homework / Academic</option>
                  <option value="Exam Timetable" className="bg-black">Exam Timetable</option>
                  <option value="Res & Safety" className="bg-black">Res & Safety</option>
                  <option value="Official Circular" className="bg-black">Official Circular</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-gray-300">Circular Title / Heading</label>
                <input
                  type="text"
                  required
                  value={compTitle}
                  onChange={e => setCompTitle(e.target.value)}
                  placeholder="e.g. Grade 11 Life Sciences Project Guidelines"
                  className="w-full bg-black/60 border border-white/15 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-amber-400"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-gray-300">Announcement / Details</label>
                <textarea
                  required
                  rows={4}
                  value={compBody}
                  onChange={e => setCompBody(e.target.value)}
                  placeholder="Type official homework directions, schedule changes, or safety guidelines..."
                  className="w-full bg-black/60 border border-white/15 rounded-xl p-3 text-xs text-white outline-none focus:border-amber-400 resize-none"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 text-black font-black text-xs uppercase tracking-wider shadow-glow active:scale-95 transition-all mt-2"
              >
                Broadcast to Registered Guardians & Students
              </button>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
