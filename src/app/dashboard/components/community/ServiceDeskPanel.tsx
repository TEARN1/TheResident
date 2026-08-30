'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useSelector } from 'react-redux'
import {
  Wrench, Plus, X, Clock, CheckCircle2, AlertTriangle, Users,
  ChevronDown, ChevronUp, Send, Gauge
} from 'lucide-react'
import { RootState, isGuestUser } from '../../../../store'
import {
  fetchServiceReports, fetchProviders, fetchConfirmationCounts, fetchReportUpdates,
  fetchProviderPerformance, submitServiceReport, confirmServiceReport,
  setServiceReportStatus, commentOnServiceReport,
  slaState, describeDuration, hoursBetween, sortByUrgency, targetDeadline,
  defaultTargetHours, isSettled, CATEGORY_LABEL,
  type ServiceReport, type ServiceReportUpdate, type ServiceCategory,
  type ServiceSeverity, type InfraProvider, type ProviderPerformance
} from '../../../../utils/serviceReports'
import { getErrorMessage } from '../../../../utils/errors'
import { cleanScriptTags } from '../../../../utils/security'
import { goldButtonClass } from '../../../../components/ui/GoldButton'
import EmptyState from '../shared/EmptyState'

// Strip scripts, but do NOT encodeHTMLEntities here: React already escapes on
// render, and running both is what left apostrophes stored as "&#x27;" in the
// older screens. One layer, at the right layer.
const clean = (text: string) => cleanScriptTags(text).trim()

const SEVERITIES: ServiceSeverity[] = ['low', 'medium', 'high', 'critical']
const CATEGORIES = Object.keys(CATEGORY_LABEL) as ServiceCategory[]

// Which provider kinds plausibly own which fault, so the picker isn't a list
// of every utility in the country. res_infra_providers.kind is
// power|water|network|fiber|road (verified against the live table).
const PROVIDER_KINDS_FOR: Record<ServiceCategory, string[]> = {
  power: ['power'], water: ['water'], sewerage: ['water'],
  network: ['network'], fiber: ['fiber', 'network'], road: ['road'],
  waste: [], streetlight: ['power', 'road'], other: []
}

const STATUS_LABEL: Record<string, string> = {
  submitted: 'Submitted', acknowledged: 'Acknowledged', in_progress: 'Being worked on',
  resolved: 'Resolved', closed: 'Closed', rejected: 'Rejected'
}

function SlaBadge({ report, now }: { report: ServiceReport; now: number }) {
  const state = slaState(report, now)
  const elapsed = hoursBetween(report.createdAt, now)

  if (state === 'done') {
    return (
      <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20 flex items-center gap-1">
        <CheckCircle2 size={10} /> {describeDuration(elapsed)} total
      </span>
    )
  }
  if (state === 'overdue') {
    const over = elapsed - report.targetHours
    return (
      <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20 flex items-center gap-1">
        <AlertTriangle size={10} /> {describeDuration(over)} overdue
      </span>
    )
  }
  const left = report.targetHours - elapsed
  return (
    <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border flex items-center gap-1 ${
      state === 'due_soon'
        ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
        : 'bg-white/5 text-gray-400 border-white/10'
    }`}>
      <Clock size={10} /> {describeDuration(left)} left
    </span>
  )
}

/**
 * The Service Desk: report a fault to whoever owes the fix, let neighbours
 * corroborate it, and keep a public record of how long the fix actually took.
 *
 * Deliberately distinct from the "Local Infrastructure" outage signal in
 * SafetyTab (which answers "is it out right now?") and from map hazard
 * reporting (transient road blockages). This answers "who owes me a fix, and
 * how long are they taking?" — see theresident_service_desk_schema.sql.
 */
export default function ServiceDeskPanel() {
  const currentUser = useSelector((state: RootState) => state.auth.currentUser)
  const myListings = useSelector((state: RootState) => state.listings.items)
  const guest = currentUser ? isGuestUser(currentUser) : true

  const [reports, setReports] = useState<ServiceReport[]>([])
  const [providers, setProviders] = useState<InfraProvider[]>([])
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [performance, setPerformance] = useState<ProviderPerformance[]>([])
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // A ticking "now" so the clocks move without a refetch. One minute is plenty
  // for durations measured in hours, and matches SafetyTab's existing tick.
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(id)
  }, [])

  const [showForm, setShowForm] = useState(false)
  const [category, setCategory] = useState<ServiceCategory>('sewerage')
  const [severity, setSeverity] = useState<ServiceSeverity>('high')
  const [title, setTitle] = useState('')
  const [detail, setDetail] = useState('')
  const [providerId, setProviderId] = useState('')
  const [providerNameRaw, setProviderNameRaw] = useState('')
  const [suburb, setSuburb] = useState('')
  const [city, setCity] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [timeline, setTimeline] = useState<ServiceReportUpdate[]>([])
  const [commentDraft, setCommentDraft] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)

  // Prefill locality from anything the resident has already told us, so the
  // common case is two fewer fields to fill in.
  useEffect(() => {
    if (!currentUser) return
    const mine = myListings.find(l => l.landlordId === currentUser.id) || myListings[0]
    if (mine) {
      setSuburb(prev => prev || mine.suburb || '')
      setCity(prev => prev || mine.location || '')
    }
  }, [currentUser, myListings])

  const load = useCallback(async () => {
    const [rows, provs, perf] = await Promise.all([
      fetchServiceReports(),
      fetchProviders(),
      fetchProviderPerformance()
    ])
    setReports(rows)
    setProviders(provs)
    setPerformance(perf)
    setCounts(await fetchConfirmationCounts(rows.map(r => r.id)))
    setLoaded(true)
  }, [])

  useEffect(() => {
    if (!currentUser || guest) return
    let cancelled = false
    load().catch(err => { if (!cancelled) setError(getErrorMessage(err)) })
    return () => { cancelled = true }
  }, [currentUser, guest, load])

  const relevantProviders = useMemo(() => {
    const kinds = PROVIDER_KINDS_FOR[category]
    if (kinds.length === 0) return providers
    return providers.filter(p => kinds.includes(p.kind))
  }, [providers, category])

  const ordered = useMemo(() => sortByUrgency(reports, now), [reports, now])
  const mine = useMemo(
    () => ordered.filter(r => currentUser && r.reporterId === currentUser.id),
    [ordered, currentUser]
  )
  const neighbours = useMemo(
    () => ordered.filter(r => !currentUser || r.reporterId !== currentUser.id),
    [ordered, currentUser]
  )

  const handleSubmit = async () => {
    if (!clean(title) || !clean(suburb) || !clean(city)) return
    setSubmitting(true)
    setError(null)
    try {
      await submitServiceReport({
        category, severity,
        title: clean(title),
        detail: clean(detail) || undefined,
        suburb: clean(suburb),
        city: clean(city),
        providerId: providerId || null,
        providerNameRaw: providerId ? null : (clean(providerNameRaw) || null)
      })
      setTitle(''); setDetail(''); setProviderNameRaw('')
      setShowForm(false)
      await load()
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  const handleConfirm = async (reportId: string) => {
    setBusyId(reportId)
    setError(null)
    try {
      const count = await confirmServiceReport(reportId)
      setCounts(c => ({ ...c, [reportId]: count }))
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setBusyId(null)
    }
  }

  const toggleExpand = async (reportId: string) => {
    if (expandedId === reportId) { setExpandedId(null); return }
    setExpandedId(reportId)
    setCommentDraft('')
    setTimeline(await fetchReportUpdates(reportId))
  }

  const handleComment = async (reportId: string) => {
    if (!clean(commentDraft)) return
    setBusyId(reportId)
    try {
      await commentOnServiceReport(reportId, clean(commentDraft))
      setCommentDraft('')
      setTimeline(await fetchReportUpdates(reportId))
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setBusyId(null)
    }
  }

  const handleClose = async (reportId: string) => {
    setBusyId(reportId)
    try {
      await setServiceReportStatus(reportId, 'closed', 'Closed by the resident who reported it.')
      await load()
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setBusyId(null)
    }
  }

  if (!currentUser || guest || !loaded) return null

  const expectedHours = defaultTargetHours(category, severity)

  const renderReport = (r: ServiceReport, isMine: boolean) => {
    const confirmations = counts[r.id] || 0
    const provider = providers.find(p => p.id === r.providerId)
    const expanded = expandedId === r.id

    return (
      <div key={r.id} className="bg-black/30 border border-white/5 rounded-xl p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[9px] font-mono text-gray-500">{r.reference}</span>
              <span className="text-[9px] font-black uppercase tracking-widest text-gold-primary">
                {CATEGORY_LABEL[r.category]}
              </span>
              <SlaBadge report={r} now={now} />
            </div>
            <p className="text-sm font-bold text-white mt-1 break-words">{r.title}</p>
            <p className="text-[10px] text-gray-500 mt-0.5">
              {STATUS_LABEL[r.status] || r.status}
              {provider ? ` · ${provider.name}` : r.providerNameRaw ? ` · ${r.providerNameRaw}` : ''}
              {r.suburb ? ` · ${r.suburb}` : ''}
            </p>
          </div>
          <button
            onClick={() => toggleExpand(r.id)}
            aria-label={expanded ? 'Hide history' : 'Show history'}
            className="text-gray-500 hover:text-white shrink-0"
          >
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] text-gray-500 flex items-center gap-1">
            <Users size={10} /> {confirmations} {confirmations === 1 ? 'neighbour' : 'neighbours'} confirmed
          </span>
          {!isMine && !isSettled(r.status) && (
            <button
              onClick={() => handleConfirm(r.id)}
              disabled={busyId === r.id}
              className="text-[10px] font-black uppercase tracking-widest text-gold-primary hover:underline disabled:opacity-50"
            >
              This is happening to me too
            </button>
          )}
          {isMine && !isSettled(r.status) && (
            <button
              onClick={() => handleClose(r.id)}
              disabled={busyId === r.id}
              className="text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-white disabled:opacity-50"
            >
              Mark sorted
            </button>
          )}
        </div>

        {expanded && (
          <div className="border-t border-white/5 pt-2 space-y-2">
            {r.detail && <p className="text-xs text-gray-400">{r.detail}</p>}
            <p className="text-[10px] text-gray-600">
              Expected within {describeDuration(r.targetHours)} of filing
              {' '}(by {new Date(targetDeadline(r)).toLocaleDateString()})
              {r.acknowledgedAt && ` · acknowledged after ${describeDuration(hoursBetween(r.createdAt, r.acknowledgedAt))}`}
              {r.resolvedAt && ` · resolved after ${describeDuration(hoursBetween(r.createdAt, r.resolvedAt))}`}
            </p>
            <div className="space-y-1">
              {timeline.map(u => (
                <div key={u.id} className="text-[10px] text-gray-500 flex gap-2">
                  <span className="text-gray-600 shrink-0">
                    {new Date(u.createdAt).toLocaleDateString()}
                  </span>
                  <span className="break-words">
                    {u.kind === 'status_change'
                      ? `Status → ${STATUS_LABEL[u.toStatus || ''] || u.toStatus}${u.body ? ` — ${u.body}` : ''}`
                      : u.body}
                  </span>
                </div>
              ))}
            </div>
            {!isSettled(r.status) && (
              <div className="flex gap-2">
                <input
                  value={commentDraft}
                  onChange={e => setCommentDraft(e.target.value)}
                  placeholder="Add what you're seeing…"
                  className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white"
                />
                <button
                  onClick={() => handleComment(r.id)}
                  disabled={busyId === r.id || !commentDraft.trim()}
                  aria-label="Post update"
                  className="text-gold-primary disabled:opacity-40"
                >
                  <Send size={14} />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="glass-panel p-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-gold-primary/10 rounded-xl">
            <Wrench size={18} className="text-gold-primary" />
          </div>
          <div>
            <p className="text-xs font-black text-white uppercase tracking-widest">Service Desk</p>
            <p className="text-[10px] text-gray-500">Report a fault — and track how long the fix takes</p>
          </div>
        </div>
        <button
          onClick={() => setShowForm(v => !v)}
          className={`${goldButtonClass({ size: 'sm' })} text-[10px] px-3 py-2 flex items-center gap-1`}
        >
          <Plus size={12} /> Report
        </button>
      </div>

      {error && (
        <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-2">{error}</div>
      )}

      {showForm && (
        <div className="bg-black/40 border border-white/5 rounded-xl p-4 space-y-3">
          <div className="flex gap-2">
            <select
              value={category}
              onChange={e => setCategory(e.target.value as ServiceCategory)}
              aria-label="What kind of problem"
              className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
            >
              {CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
            </select>
            <select
              value={severity}
              onChange={e => setSeverity(e.target.value as ServiceSeverity)}
              aria-label="How serious"
              className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
            >
              {SEVERITIES.map(s => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}
            </select>
          </div>

          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="What's wrong? (e.g. Sewer overflowing into Mahlangu Street)"
            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
          />
          <textarea
            value={detail}
            onChange={e => setDetail(e.target.value)}
            rows={2}
            placeholder="Any detail that helps — how long it's been, what's affected…"
            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white resize-none"
          />

          <div className="flex gap-2">
            <input
              value={suburb}
              onChange={e => setSuburb(e.target.value)}
              placeholder="Suburb"
              className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
            />
            <input
              value={city}
              onChange={e => setCity(e.target.value)}
              placeholder="City"
              className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
            />
          </div>

          {relevantProviders.length > 0 ? (
            <select
              value={providerId}
              onChange={e => setProviderId(e.target.value)}
              aria-label="Who is responsible"
              className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
            >
              <option value="">I don&apos;t know who&apos;s responsible</option>
              {relevantProviders.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          ) : (
            <input
              value={providerNameRaw}
              onChange={e => setProviderNameRaw(e.target.value)}
              placeholder="Who should fix it? (optional — e.g. City of Joburg)"
              className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
            />
          )}

          <p className="text-[10px] text-gray-500">
            A {severity} {CATEGORY_LABEL[category].toLowerCase()} problem is expected to be
            dealt with within {describeDuration(expectedHours)}. You&apos;ll get a reference
            number, and your neighbours can confirm they&apos;re affected too.
          </p>

          <div className="flex gap-2">
            <button
              onClick={handleSubmit}
              disabled={submitting || !title.trim() || !suburb.trim() || !city.trim()}
              className={`${goldButtonClass({ size: 'sm' })} text-[10px] px-4 py-2 disabled:opacity-50`}
            >
              {submitting ? 'Filing…' : 'File report'}
            </button>
            <button
              onClick={() => setShowForm(false)}
              aria-label="Cancel"
              className="text-gray-500 hover:text-white px-3 py-2"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {performance.length > 0 && (
        <div className="bg-black/20 border border-white/5 rounded-xl p-3 space-y-2">
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 flex items-center gap-1">
            <Gauge size={12} /> How long they actually take
          </p>
          {performance.map(p => (
            <div key={p.providerId} className="flex items-center justify-between gap-2 text-[10px]">
              <span className="text-white font-bold truncate">{p.providerName}</span>
              <span className="text-gray-500 shrink-0">
                {p.resolvedCount > 0
                  ? `typically ${describeDuration(p.medianResolveHours)} to fix`
                  : 'nothing resolved yet'}
                {p.openCount > 0 && ` · ${p.openCount} open`}
                {p.overdueCount > 0 && ` · ${p.overdueCount} overdue`}
              </span>
            </div>
          ))}
        </div>
      )}

      {mine.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Your reports</p>
          {mine.map(r => renderReport(r, true))}
        </div>
      )}

      {neighbours.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Reported near you</p>
          {neighbours.map(r => renderReport(r, false))}
        </div>
      )}

      {reports.length === 0 && (
        <EmptyState
          icon={Wrench}
          title="Nothing reported yet"
          subtitle="Water, power, sewerage, fibre — file it here and the clock starts on whoever owes the fix."
          compact
        />
      )}
    </div>
  )
}
