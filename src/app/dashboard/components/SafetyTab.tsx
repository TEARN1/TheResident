'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { Shield, Activity, Bell, MapPin, CheckCircle2, Info, Zap, Wifi, Check, HeartHandshake, Search, AlertTriangle, Signal, Construction } from 'lucide-react'
import { outageConsensus, type StatusReport } from '../../../utils/logic'
import type { Alert, NeighbourhoodStatus } from '../../../store'
import { supabase } from '../../../utils/supabase'

interface CareProfile {
  id: string
  username: string | null
  display_name: string | null
  avatar_url: string | null
  bio: string | null
  city: string | null
  vibe_score: number | null
  is_verified: boolean | null
}

interface CareCircleRow {
  id: string
  subject_id: string
  carer_id: string
  cadence: string
  last_ok_at: string | null
  status: string
  note: string | null
  created_at: string
  subject?: CareProfile | null
  carer?: CareProfile | null
}

const CADENCE_WINDOW_MS: Record<string, number> = {
  daily: 24 * 60 * 60 * 1000,
  weekly: 7 * 24 * 60 * 60 * 1000
}

interface SafetyTabProps {
  alerts: Alert[]
  neighbourhoodStatus: NeighbourhoodStatus[]
  statusReports: StatusReport[]
  currentUserId: string
  isVerified: boolean
  suburb: string
  onRaiseAlert?: (args: { kind: 'panic' | 'incident' | 'suspicious'; title: string; description: string; severity: 'low' | 'medium' | 'high' | 'critical' }) => void
  onRespond?: (alertId: string, status: 'coming' | 'arrived' | 'stood_down') => void
  onResolve?: (alertId: string) => void
  onReportStatus?: (kind: 'power' | 'water' | 'network' | 'fiber' | 'road', status: 'up' | 'down', endsAt?: string | null) => void
  styles?: Record<string, React.CSSProperties>
}

const SERVICES: Array<{ key: 'power' | 'water' | 'network' | 'fiber' | 'road'; label: string; Icon: typeof Zap }> = [
  { key: 'power', label: 'Electricity', Icon: Zap },
  { key: 'water', label: 'Water', Icon: Info },
  { key: 'network', label: 'Network', Icon: Wifi },
  { key: 'fiber', label: 'Fiber', Icon: Signal },
  { key: 'road', label: 'Road / Traffic', Icon: Construction }
]

// "How long" options for a crowd report's optional end time. The DB trigger
// rejects crowd windows shorter than 8 hours, so nothing below that is offered.
const DURATION_OPTIONS: Array<{ key: string; label: string; hours: number | null }> = [
  { key: '8h', label: '8 hours', hours: 8 },
  { key: '24h', label: '24 hours', hours: 24 },
  { key: '3d', label: '3 days', hours: 72 },
  { key: 'ufn', label: 'Until further notice', hours: null }
]

const formatExpiry = (endsAt: string | null | undefined): string | null => {
  if (!endsAt) return null
  const end = new Date(endsAt)
  const diffMs = end.getTime() - Date.now()
  if (diffMs <= 0) return null
  const diffHours = diffMs / (60 * 60 * 1000)
  if (diffHours < 36) return `until ${end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
  const days = Math.round(diffHours / 24)
  return `for the next ${days} day${days === 1 ? '' : 's'}`
}

export default function SafetyTab({
  alerts,
  neighbourhoodStatus,
  statusReports,
  currentUserId,
  isVerified,
  suburb,
  onRaiseAlert,
  onRespond,
  onResolve,
  onReportStatus
}: SafetyTabProps) {
  const [confirmPanic, setConfirmPanic] = useState(false)
  const [showIncidentForm, setShowIncidentForm] = useState(false)
  const [incidentTitle, setIncidentTitle] = useState('')
  const [incidentDesc, setIncidentDesc] = useState('')

  // The consensus window is time-based; recompute on a tick rather than
  // reading Date.now() during render (impure, and would never re-evaluate as
  // reports age out of the 30-minute window). Seed via useState's lazy
  // initializer so the effect only needs to set up the recurring tick.
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(id)
  }, [])

  const activeAlerts = alerts.filter(a => a.status === 'active')

  // Duration picked per-service before submitting an outage report.
  const [durationByKey, setDurationByKey] = useState<Record<string, string>>({})

  // Official reports carry a provider_id — batch-fetch the provider names
  // rather than issuing one lookup per row.
  const [providerNames, setProviderNames] = useState<Record<string, string>>({})
  useEffect(() => {
    const providerIds = [...new Set(
      neighbourhoodStatus.filter(s => s.source === 'official' && s.providerId).map(s => s.providerId as string)
    )]
    if (providerIds.length === 0 || !supabase) return
    let cancelled = false
    supabase.from('res_infra_providers').select('id, name').in('id', providerIds).then(({ data }) => {
      if (cancelled || !data) return
      setProviderNames(Object.fromEntries(data.map((p: { id: string; name: string }) => [p.id, p.name])))
    })
    return () => { cancelled = true }
  }, [neighbourhoodStatus])

  // Care Circle — watch over a neighbour and get checked on yourself.
  // Note: res_care_circle's insert RLS check is `carer_id = auth.uid()`, so a
  // user can only register a row where THEY are the carer (i.e. "I'll watch
  // over this person"), not one where they pick someone else to watch them.
  const [careRows, setCareRows] = useState<CareCircleRow[]>([])
  const [careLoading, setCareLoading] = useState(false)
  const [careQuery, setCareQuery] = useState('')
  const [careResults, setCareResults] = useState<CareProfile[]>([])
  const [searching, setSearching] = useState(false)
  const [selectedSubject, setSelectedSubject] = useState<CareProfile | null>(null)
  const [cadence, setCadence] = useState<'daily' | 'weekly'>('daily')
  const [registering, setRegistering] = useState(false)
  const [careError, setCareError] = useState<string | null>(null)
  const [checkingInId, setCheckingInId] = useState<string | null>(null)

  const loadCareCircle = useCallback(async () => {
    if (!supabase || !currentUserId) return
    setCareLoading(true)
    const { data, error } = await supabase
      .from('res_care_circle')
      .select('id, subject_id, carer_id, cadence, last_ok_at, status, note, created_at')
      .or(`subject_id.eq.${currentUserId},carer_id.eq.${currentUserId}`)
      .order('created_at', { ascending: false })

    if (error || !data) { setCareLoading(false); return }

    const otherIds = [...new Set(
      data.map(r => (r.subject_id === currentUserId ? r.carer_id : r.subject_id))
    )]

    let profileMap = new Map<string, CareProfile>()
    if (otherIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url, bio, city, vibe_score, is_verified')
        .in('id', otherIds)
      profileMap = new Map((profiles || []).map(p => [p.id, p as CareProfile]))
    }

    setCareRows(data.map(r => ({
      ...r,
      subject: profileMap.get(r.subject_id),
      carer: profileMap.get(r.carer_id)
    })))
    setCareLoading(false)
  }, [currentUserId])

  useEffect(() => {
    const id = setTimeout(() => { loadCareCircle() }, 0)
    return () => clearTimeout(id)
  }, [loadCareCircle])

  useEffect(() => {
    if (!supabase || careQuery.trim().length < 2) {
      const id = setTimeout(() => setCareResults([]), 0)
      return () => clearTimeout(id)
    }
    let cancelled = false
    const searchTimer = setTimeout(() => setSearching(true), 0)
    const id = setTimeout(async () => {
      const { data } = await supabase!
        .from('profiles')
        .select('id, username, display_name, avatar_url, bio, city, vibe_score, is_verified')
        .or(`username.ilike.%${careQuery}%,display_name.ilike.%${careQuery}%`)
        .neq('id', currentUserId)
        .limit(8)
      if (!cancelled) { setCareResults((data as CareProfile[]) || []); setSearching(false) }
    }, 300)
    return () => { cancelled = true; clearTimeout(id); clearTimeout(searchTimer) }
  }, [careQuery, currentUserId])

  const registerCareCircle = async () => {
    if (!supabase || !selectedSubject || !currentUserId) return
    setRegistering(true)
    setCareError(null)
    const { error } = await supabase.from('res_care_circle').insert({
      subject_id: selectedSubject.id,
      carer_id: currentUserId,
      cadence
    })
    setRegistering(false)
    if (error) { setCareError(error.message); return }
    setSelectedSubject(null)
    setCareQuery('')
    setCareResults([])
    loadCareCircle()
  }

  const checkIn = async (careId: string) => {
    if (!supabase) return
    setCheckingInId(careId)
    const { error } = await supabase.rpc('res_care_check_in', { p_care_id: careId })
    setCheckingInId(null)
    if (!error) loadCareCircle()
  }

  const isOverdue = (row: CareCircleRow) => {
    if (!row.last_ok_at) return true
    const window = CADENCE_WINDOW_MS[row.cadence] ?? CADENCE_WINDOW_MS.daily
    return now - new Date(row.last_ok_at).getTime() > window
  }

  const watchingOverMe = careRows.filter(r => r.subject_id === currentUserId)
  const iAmWatching = careRows.filter(r => r.carer_id === currentUserId)

  return (
    <div className="space-y-8">
      {/* Panic Section — deliberately two-step so a mis-tap can't page the neighbourhood */}
      <div className="glass-panel p-6 border-red-500/20 bg-red-500/5">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-red-500/20 rounded-full animate-pulse">
              <Shield size={32} className="text-red-500" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-red-500">Emergency & Panic</h3>
              <p className="text-gray-400 text-sm">Raise an immediate alert to verified neighbors and community watch.</p>
            </div>
          </div>

          {!confirmPanic ? (
            <button
              onClick={() => setConfirmPanic(true)}
              className="w-full md:w-auto bg-red-600 hover:bg-red-700 text-white font-bold px-8 py-3 rounded-xl shadow-lg shadow-red-900/20 transition-all active:scale-95"
            >
              RAISE PANIC ALERT
            </button>
          ) : (
            <div className="flex gap-2 w-full md:w-auto">
              <button
                onClick={() => {
                  onRaiseAlert?.({ kind: 'panic', title: 'Panic alert', description: 'Immediate help needed.', severity: 'critical' })
                  setConfirmPanic(false)
                }}
                className="flex-1 md:flex-none bg-red-600 text-white font-bold px-6 py-3 rounded-xl active:scale-95 transition-all"
              >
                Yes — send it now
              </button>
              <button
                onClick={() => setConfirmPanic(false)}
                className="flex-1 md:flex-none bg-white/5 text-gray-300 border border-white/10 px-6 py-3 rounded-xl"
              >
                Cancel
              </button>
            </div>
          )}
        </div>

        <button
          onClick={() => setShowIncidentForm(v => !v)}
          className="mt-4 text-xs text-gray-500 hover:text-white uppercase tracking-widest font-bold"
        >
          {showIncidentForm ? 'Cancel' : 'Report a non-emergency incident'}
        </button>

        {showIncidentForm && (
          <form
            onSubmit={e => {
              e.preventDefault()
              if (!incidentTitle.trim()) return
              onRaiseAlert?.({ kind: 'incident', title: incidentTitle, description: incidentDesc, severity: 'medium' })
              setIncidentTitle(''); setIncidentDesc(''); setShowIncidentForm(false)
            }}
            className="mt-4 space-y-3 bg-black/40 border border-white/5 rounded-xl p-4"
          >
            <input
              value={incidentTitle}
              onChange={e => setIncidentTitle(e.target.value)}
              placeholder="What happened?"
              required
              className="w-full bg-black border border-white/10 rounded-lg p-3 text-sm text-white outline-none focus:border-red-500/40"
            />
            <textarea
              value={incidentDesc}
              onChange={e => setIncidentDesc(e.target.value)}
              placeholder="Any detail that would help a neighbour"
              className="w-full bg-black border border-white/10 rounded-lg p-3 text-sm text-white h-20 resize-none outline-none focus:border-red-500/40"
            />
            <button type="submit" className="bg-red-500/10 border border-red-500/30 text-red-400 font-bold px-5 py-2 rounded-lg text-xs uppercase tracking-widest">
              Report it
            </button>
          </form>
        )}
      </div>

      {/* Care Circle — check on someone, or let someone check on you */}
      <div className="glass-panel p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-gold-primary/10 rounded-lg">
            <HeartHandshake size={20} className="text-gold-primary" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Care Circle</h3>
            <p className="text-gray-400 text-xs">Watch over a neighbour, or let them watch over you.</p>
          </div>
        </div>

        {/* Register: watch over someone */}
        <div className="bg-black/40 border border-white/5 rounded-xl p-4 mb-6 space-y-3">
          <p className="text-xs text-gray-400 uppercase font-bold tracking-widest">Start watching over someone</p>
          {!selectedSubject ? (
            <div className="relative">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  value={careQuery}
                  onChange={e => setCareQuery(e.target.value)}
                  placeholder="Search by username or name"
                  className="w-full bg-black border border-white/10 rounded-lg pl-9 pr-3 py-2.5 text-sm text-white outline-none focus:border-gold-primary/40"
                />
              </div>
              {careQuery.trim().length >= 2 && (
                <div className="mt-2 space-y-1 max-h-56 overflow-y-auto">
                  {searching && <p className="text-xs text-gray-500 px-1">Searching…</p>}
                  {!searching && careResults.length === 0 && (
                    <p className="text-xs text-gray-500 px-1">No neighbours found.</p>
                  )}
                  {careResults.map(p => (
                    <button
                      key={p.id}
                      onClick={() => { setSelectedSubject(p); setCareQuery(''); setCareResults([]) }}
                      className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 text-left"
                    >
                      {p.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-white/10" />
                      )}
                      <div className="min-w-0">
                        <p className="text-sm text-white font-medium truncate">{p.display_name || p.username || 'Neighbour'}</p>
                        {p.city && <p className="text-[10px] text-gray-500 truncate">{p.city}</p>}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
              <div className="flex items-center gap-3">
                {selectedSubject.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={selectedSubject.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover" />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-white/10" />
                )}
                <div>
                  <p className="text-sm text-white font-medium">{selectedSubject.display_name || selectedSubject.username}</p>
                  <p className="text-[10px] text-gray-500">You&apos;ll be their carer</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={cadence}
                  onChange={e => setCadence(e.target.value as 'daily' | 'weekly')}
                  className="bg-black border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-gold-primary/40"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                </select>
                <button
                  onClick={registerCareCircle}
                  disabled={registering}
                  className="bg-gold-primary text-black font-bold px-4 py-2 rounded-lg text-xs uppercase tracking-widest disabled:opacity-50"
                >
                  {registering ? 'Adding…' : 'Add'}
                </button>
                <button
                  onClick={() => setSelectedSubject(null)}
                  className="text-gray-400 text-xs px-2"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
          {careError && <p className="text-xs text-red-400">{careError}</p>}
        </div>

        {careLoading ? (
          <p className="text-xs text-gray-500">Loading care circle…</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Rows where I'm the subject: someone is checking on me */}
            <div className="space-y-3">
              <p className="text-xs text-gray-400 uppercase font-bold tracking-widest">Watching over you</p>
              {watchingOverMe.length === 0 ? (
                <p className="text-xs text-gray-600">No one is watching over you yet.</p>
              ) : (
                watchingOverMe.map(row => (
                  <div key={row.id} className="bg-black/40 border border-white/5 rounded-xl p-4 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm text-white font-medium">
                        {row.carer?.display_name || row.carer?.username || 'A neighbour'} is checking on you
                      </p>
                      <p className="text-[10px] text-gray-500">{row.cadence} · last OK {row.last_ok_at ? new Date(row.last_ok_at).toLocaleString() : 'never'}</p>
                    </div>
                    <button
                      onClick={() => checkIn(row.id)}
                      disabled={checkingInId === row.id}
                      className="bg-green-500/10 text-green-400 border border-green-500/20 font-bold px-4 py-2 rounded-xl text-xs uppercase tracking-widest disabled:opacity-50 hover:bg-green-500 hover:text-black transition-all"
                    >
                      {checkingInId === row.id ? '…' : "I'm OK — Check In"}
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Rows where I'm the carer: I'm watching someone */}
            <div className="space-y-3">
              <p className="text-xs text-gray-400 uppercase font-bold tracking-widest">You&apos;re watching</p>
              {iAmWatching.length === 0 ? (
                <p className="text-xs text-gray-600">You&apos;re not watching over anyone yet.</p>
              ) : (
                iAmWatching.map(row => {
                  const overdue = isOverdue(row)
                  return (
                    <div key={row.id} className="bg-black/40 border border-white/5 rounded-xl p-4 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${overdue ? 'bg-red-500' : 'bg-green-500'}`} />
                        <div>
                          <p className="text-sm text-white font-medium">
                            You&apos;re checking on {row.subject?.display_name || row.subject?.username || 'a neighbour'}
                          </p>
                          <p className="text-[10px] text-gray-500">{row.cadence} · last OK {row.last_ok_at ? new Date(row.last_ok_at).toLocaleString() : 'never'}</p>
                        </div>
                      </div>
                      {overdue && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-500 uppercase tracking-widest">
                          <AlertTriangle size={12} /> Overdue
                        </span>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Alerts Feed */}
        <div className="lg:col-span-2 space-y-6">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Bell size={20} className="text-gold-primary" /> Active Safety Incidents
          </h3>

          {!isVerified && (
            <div className="text-xs text-gold-primary bg-gold-primary/10 border border-gold-primary/20 rounded-xl p-3">
              Only verified neighbours can respond to alerts. Get verified on The Gruvs to help out.
            </div>
          )}

          {activeAlerts.length === 0 ? (
            <div className="glass-panel p-12 text-center text-gray-500">
               <CheckCircle2 size={32} className="mx-auto mb-2 text-green-500/50" />
               <p>No active incidents reported in {suburb || 'your area'}. Stay safe!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {activeAlerts.map(alert => (
                <div key={alert.id} className="glass-panel p-5 border-l-4 border-l-red-500">
                  <div className="flex justify-between mb-2">
                    <span className="text-[10px] font-bold text-red-500 uppercase tracking-widest">{alert.severity} SEVERITY</span>
                    <span className="text-[10px] text-gray-500">{new Date(alert.createdAt).toLocaleTimeString()}</span>
                  </div>
                  <h4 className="text-lg font-bold text-white">{alert.title}</h4>
                  <p className="text-sm text-gray-400 my-2">{alert.description}</p>
                  <div className="flex items-center gap-2 text-xs text-gray-500 mb-3">
                     <MapPin size={12} /> {alert.suburb || suburb}
                  </div>

                  <div className="flex gap-2">
                    {alert.createdBy === currentUserId ? (
                      <button
                        onClick={() => onResolve?.(alert.id)}
                        className="bg-gold-primary/10 text-gold-primary border border-gold-primary/20 px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-gold-primary hover:text-black transition-all"
                      >
                        <Check size={12} className="inline mr-1" /> Mark resolved
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => onRespond?.(alert.id, 'coming')}
                          disabled={!isVerified}
                          className="bg-green-500/10 text-green-500 border border-green-500/20 px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest disabled:opacity-40 disabled:cursor-not-allowed hover:bg-green-500 hover:text-black transition-all"
                        >
                          I&apos;m coming
                        </button>
                        <button
                          onClick={() => onRespond?.(alert.id, 'arrived')}
                          disabled={!isVerified}
                          className="bg-white/5 text-gray-300 border border-white/10 px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          I&apos;ve arrived
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Utility Status — crowd-signal consensus: one report is noise, three is a fact */}
        <div className="space-y-6">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Activity size={20} className="text-gold-primary" /> Local Infrastructure
          </h3>
          <div className="glass-panel p-6 space-y-6">
             {SERVICES.map(({ key, label, Icon }) => {
               const rowsForService = neighbourhoodStatus.filter(s => s.service === (key === 'power' ? 'electricity' : key))
               // Official reports are authoritative on their own and bypass crowd consensus;
               // the newest one wins.
               const officialRow = [...rowsForService]
                 .filter(s => s.source === 'official')
                 .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0]
               const consensus = outageConsensus(statusReports.filter(r => r.kind === key), now)
               const crowdRow = rowsForService.find(s => s.source === 'crowd')
               const isDown = officialRow ? officialRow.status === 'outage' : (consensus.confirmed || crowdRow?.status === 'outage')
               const expiry = formatExpiry(officialRow ? officialRow.endsAt : crowdRow?.endsAt)
               const providerName = officialRow?.providerId ? providerNames[officialRow.providerId] : null
               const selectedDuration = durationByKey[key] || '8h'

               return (
                 <div key={key} className="flex items-center justify-between group">
                    <div className="flex items-center gap-3">
                       <div className={`p-2 rounded-lg ${isDown ? 'bg-red-500/10' : 'bg-green-500/10'}`}>
                          <Icon size={18} className={isDown ? 'text-red-500' : 'text-green-500'} />
                       </div>
                       <span className="text-sm font-medium text-gray-300">{label}</span>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                       <div className="flex items-center gap-1">
                          {officialRow && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-gold-primary/20 text-gold-primary uppercase tracking-widest">
                              Official{providerName ? ` · ${providerName}` : ''}
                            </span>
                          )}
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${isDown ? 'bg-red-500/20 text-red-500' : 'bg-green-500/20 text-green-500'}`}>
                             {isDown ? (!officialRow && consensus.confirmed ? `OUTAGE (${consensus.reporters} reports)` : 'OUTAGE') : 'OPERATIONAL'}
                          </span>
                       </div>
                       {expiry && <span className="text-[9px] text-gray-500">{expiry}</span>}
                       <div className="flex items-center gap-1">
                          <select
                            value={selectedDuration}
                            onChange={e => setDurationByKey(prev => ({ ...prev, [key]: e.target.value }))}
                            className="bg-black border border-white/10 rounded px-1 py-0.5 text-[9px] text-gray-400 outline-none"
                            title="How long"
                          >
                            {DURATION_OPTIONS.map(opt => (
                              <option key={opt.key} value={opt.key}>{opt.label}</option>
                            ))}
                          </select>
                          <button
                            onClick={() => {
                              const opt = DURATION_OPTIONS.find(o => o.key === selectedDuration)
                              const endsAt = opt?.hours ? new Date(Date.now() + opt.hours * 60 * 60 * 1000).toISOString() : null
                              onReportStatus?.(key, 'down', endsAt)
                            }}
                            className="text-[9px] text-red-400 hover:text-red-300 uppercase font-bold"
                          >
                            Report down
                          </button>
                          <span className="text-gray-700">/</span>
                          <button
                            onClick={() => onReportStatus?.(key, 'up', null)}
                            className="text-[9px] text-green-400 hover:text-green-300 uppercase font-bold"
                          >
                            It&apos;s back
                          </button>
                       </div>
                    </div>
                 </div>
               )
             })}

             <div className="pt-4 border-t border-white/5">
                <p className="text-[10px] text-gray-500 uppercase font-bold">
                  Three neighbours reporting the same outage within 30 minutes confirms it.
                </p>
             </div>
          </div>
        </div>
      </div>
    </div>
  )
}
