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

function ServiceClock({ report, now }: { report: ServiceReport; now: number }) {
  const state = slaState(report, now)
  const elapsed = hoursBetween(report.createdAt, now)

  // Item 143. This was a small pill sitting among the reference number and
  // the category. But the elapsed time IS the feature: the whole point of the
  // Service Desk is "how long has this been broken, and how long are they
  // taking" — the founder's sewerage running for three weeks. A number that
  // small says the opposite of what the product is for.
  //
  // So it reads as a clock: the duration large, what it means underneath, and
  // a bar showing how far through the target it is. Never colour alone — each
  // state carries an icon and words as well (item 38).
  const pct = report.targetHours > 0
    ? Math.min(100, Math.round((elapsed / report.targetHours) * 100))
    : 0

  const tone =
    state === 'done' ? { text: 'text-success', bar: 'bg-success', icon: CheckCircle2 }
    : state === 'overdue' ? { text: 'text-danger', bar: 'bg-danger', icon: AlertTriangle }
    : state === 'due_soon' ? { text: 'text-warning', bar: 'bg-warning', icon: Clock }
    : { text: 'text-content', bar: 'bg-accent', icon: Clock }
  const Icon = tone.icon

  const headline =
    state === 'done' ? describeDuration(elapsed)
    : describeDuration(elapsed)

  const caption =
    state === 'done' ? 'to resolve'
    : state === 'overdue' ? `${describeDuration(elapsed - report.targetHours)} past the ${describeDuration(report.targetHours)} target`
    : `of a ${describeDuration(report.targetHours)} target`

  return (
    <div className="rounded-xl bg-surface-sunken/40 border border-subtle p-3">
      <div className="flex items-baseline gap-2">
        <Icon size={14} className={`${tone.text} self-center flex-shrink-0`} aria-hidden="true" />
        <span className={`text-xl font-black leading-none ${tone.text}`}>{headline}</span>
        <span className="text-[10px] uppercase tracking-widest text-content-subtle">
          {state === 'done' ? 'resolved' : 'open'}
        </span>
      </div>
      <p className="text-[11px] text-content-muted mt-1.5">{caption}</p>
      {state !== 'done' && (
        // Not a progress bar toward completion — nothing here knows how close
        // the fix is. It is how much of the promised time has been used.
        <div
          className="mt-2 h-1.5 rounded-full bg-surface-raised/40 overflow-hidden"
          role="img"
          aria-label={`${pct}% of the target time used`}
        >
          <div className={`h-full ${tone.bar} motion-base transition-all`} style={{ width: `${pct}%` }} />
        </div>
      )}
    </div>
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
      <div key={r.id} className="bg-surface-sunken/30 border border-subtle rounded-xl p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <ServiceClock report={r} now={now} />

        <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-mono text-content-muted">{r.reference}</span>
              <span className="text-xs font-black uppercase tracking-widest text-accent">
                {CATEGORY_LABEL[r.category]}
              </span>
            </div>
            <p className="text-sm font-bold text-content mt-1 break-words">{r.title}</p>
            <p className="text-xs text-content-muted mt-0.5">
              {STATUS_LABEL[r.status] || r.status}
              {provider ? ` · ${provider.name}` : r.providerNameRaw ? ` · ${r.providerNameRaw}` : ''}
              {r.suburb ? ` · ${r.suburb}` : ''}
            </p>
          </div>
          <button
            onClick={() => toggleExpand(r.id)}
            aria-label={expanded ? 'Hide history' : 'Show history'}
            className="text-content-muted hover:text-content shrink-0"
          >
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-content-muted flex items-center gap-1">
            <Users size={10} /> {confirmations} {confirmations === 1 ? 'neighbour' : 'neighbours'} confirmed
          </span>
          {!isMine && !isSettled(r.status) && (
            <button
              onClick={() => handleConfirm(r.id)}
              disabled={busyId === r.id}
              className="text-xs font-black uppercase tracking-widest text-accent hover:underline disabled:opacity-50"
            >
              This is happening to me too
            </button>
          )}
          {isMine && !isSettled(r.status) && (
            <button
              onClick={() => handleClose(r.id)}
              disabled={busyId === r.id}
              className="text-xs font-black uppercase tracking-widest text-content-muted hover:text-content disabled:opacity-50"
            >
              Mark sorted
            </button>
          )}
        </div>

        {expanded && (
          <div className="border-t border-subtle pt-2 space-y-2">
            {r.detail && <p className="text-xs text-content-muted">{r.detail}</p>}
            <p className="text-xs text-content-subtle">
              Expected within {describeDuration(r.targetHours)} of filing
              {' '}(by {new Date(targetDeadline(r)).toLocaleDateString()})
              {r.acknowledgedAt && ` · acknowledged after ${describeDuration(hoursBetween(r.createdAt, r.acknowledgedAt))}`}
              {r.resolvedAt && ` · resolved after ${describeDuration(hoursBetween(r.createdAt, r.resolvedAt))}`}
            </p>
            <div className="space-y-1">
              {timeline.map(u => (
                <div key={u.id} className="text-xs text-content-muted flex gap-2">
                  <span className="text-content-subtle shrink-0">
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
                  className="flex-1 bg-surface-sunken/40 border border-default rounded-lg px-3 py-1.5 text-xs text-content"
                />
                <button
                  onClick={() => handleComment(r.id)}
                  disabled={busyId === r.id || !commentDraft.trim()}
                  aria-label="Post update"
                  className="text-accent disabled:opacity-40"
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
          <div className="p-2 bg-accent/10 rounded-xl">
            <Wrench size={18} className="text-accent" />
          </div>
          <div>
            <p className="text-xs font-black text-content uppercase tracking-widest">Service Desk</p>
            <p className="text-xs text-content-muted">Report a fault — and track how long the fix takes</p>
          </div>
        </div>
        <button
          onClick={() => setShowForm(v => !v)}
          className={`${goldButtonClass({ size: 'sm' })} text-xs px-3 py-2 flex items-center gap-1`}
        >
          <Plus size={12} /> Report
        </button>
      </div>

      {error && (
        <div className="text-xs text-danger bg-danger/10 border border-danger/20 rounded-lg p-2">{error}</div>
      )}

      {showForm && (
        <div className="bg-surface-sunken/40 border border-subtle rounded-xl p-4 space-y-3">
          <div className="flex gap-2">
            <select
              value={category}
              onChange={e => setCategory(e.target.value as ServiceCategory)}
              aria-label="What kind of problem"
              className="flex-1 bg-surface-sunken/40 border border-default rounded-lg px-3 py-2 text-sm text-content"
            >
              {CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
            </select>
            <select
              value={severity}
              onChange={e => setSeverity(e.target.value as ServiceSeverity)}
              aria-label="How serious"
              className="flex-1 bg-surface-sunken/40 border border-default rounded-lg px-3 py-2 text-sm text-content"
            >
              {SEVERITIES.map(s => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}
            </select>
          </div>

          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="What's wrong? (e.g. Sewer overflowing into Mahlangu Street)"
            className="w-full bg-surface-sunken/40 border border-default rounded-lg px-3 py-2 text-sm text-content"
          />
          <textarea
            value={detail}
            onChange={e => setDetail(e.target.value)}
            rows={2}
            placeholder="Any detail that helps — how long it's been, what's affected…"
            className="w-full bg-surface-sunken/40 border border-default rounded-lg px-3 py-2 text-sm text-content resize-none"
          />

          <div className="flex gap-2">
            <input
              value={suburb}
              onChange={e => setSuburb(e.target.value)}
              placeholder="Suburb"
              className="flex-1 bg-surface-sunken/40 border border-default rounded-lg px-3 py-2 text-sm text-content"
            />
            <input
              value={city}
              onChange={e => setCity(e.target.value)}
              placeholder="City"
              className="flex-1 bg-surface-sunken/40 border border-default rounded-lg px-3 py-2 text-sm text-content"
            />
          </div>

          {relevantProviders.length > 0 ? (
            <select
              value={providerId}
              onChange={e => setProviderId(e.target.value)}
              aria-label="Who is responsible"
              className="w-full bg-surface-sunken/40 border border-default rounded-lg px-3 py-2 text-sm text-content"
            >
              <option value="">I don&apos;t know who&apos;s responsible</option>
              {relevantProviders.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          ) : (
            <input
              value={providerNameRaw}
              onChange={e => setProviderNameRaw(e.target.value)}
              placeholder="Who should fix it? (optional — e.g. City of Joburg)"
              className="w-full bg-surface-sunken/40 border border-default rounded-lg px-3 py-2 text-sm text-content"
            />
          )}

          <p className="text-xs text-content-muted">
            A {severity} {CATEGORY_LABEL[category].toLowerCase()} problem is expected to be
            dealt with within {describeDuration(expectedHours)}. You&apos;ll get a reference
            number, and your neighbours can confirm they&apos;re affected too.
          </p>

          <div className="flex gap-2">
            <button
              onClick={handleSubmit}
              disabled={submitting || !title.trim() || !suburb.trim() || !city.trim()}
              className={`${goldButtonClass({ size: 'sm' })} text-xs px-4 py-2 disabled:opacity-50`}
            >
              {submitting ? 'Filing…' : 'File report'}
            </button>
            <button
              onClick={() => setShowForm(false)}
              aria-label="Cancel"
              className="text-content-muted hover:text-content px-3 py-2"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {performance.length > 0 && (
        <div className="bg-surface-sunken/20 border border-subtle rounded-xl p-3">
          <p className="text-xs font-black uppercase tracking-widest text-content-muted flex items-center gap-1 mb-3">
            <Gauge size={12} aria-hidden="true" /> How long they actually take
          </p>

          {/* Item 144: a real data display rather than a sentence per provider.
              ONE measure (median hours to resolve) across a handful of named
              providers, so: horizontal bars, one hue, direct labels, no legend
              — a legend for a single series is noise, and the title names it.
              Sorted slowest first, because the slowest is the one worth
              looking at; that is the whole reason this card exists.

              A provider with nothing resolved gets NO BAR and says so. A zero
              bar would claim they fix things instantly, which is the opposite
              of the truth — absent and zero are different claims. */}
          <ul className="space-y-2.5">
            {[...performance]
              .sort((a, b) => (b.medianResolveHours ?? -1) - (a.medianResolveHours ?? -1))
              .map((prov, _i, all) => {
                const slowest = Math.max(
                  ...all.map(x => (x.resolvedCount > 0 ? x.medianResolveHours ?? 0 : 0)), 1
                )
                const measured = prov.resolvedCount > 0 && prov.medianResolveHours != null
                const pct = measured ? Math.max(4, Math.round((prov.medianResolveHours! / slowest) * 100)) : 0
                return (
                  <li key={prov.providerId}>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-xs font-bold text-content truncate">{prov.providerName}</span>
                      {/* Text wears text tokens, never the series colour. */}
                      <span className="text-xs text-content-muted shrink-0 tabular-nums">
                        {measured ? describeDuration(prov.medianResolveHours!) : 'no fixes recorded yet'}
                      </span>
                    </div>
                    {measured && (
                      <div className="mt-1 h-1.5 rounded-full bg-surface-raised/40 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-accent"
                          style={{ width: `${pct}%` }}
                          role="img"
                          aria-label={`${prov.providerName}: typically ${describeDuration(prov.medianResolveHours!)} to fix`}
                        />
                      </div>
                    )}
                    {(prov.openCount > 0 || prov.overdueCount > 0) && (
                      <p className="text-[10px] text-content-subtle mt-1 flex items-center gap-1.5 flex-wrap">
                        {prov.openCount > 0 && <span>{prov.openCount} open</span>}
                        {prov.overdueCount > 0 && (
                          // Status colour, and never colour alone — icon plus
                          // the word, per item 38.
                          <span className="inline-flex items-center gap-1 text-danger font-bold">
                            <AlertTriangle size={9} aria-hidden="true" /> {prov.overdueCount} overdue
                          </span>
                        )}
                      </p>
                    )}
                  </li>
                )
              })}
          </ul>
        </div>
      )}

      {mine.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-black uppercase tracking-widest text-content-muted">Your reports</p>
          {mine.map(r => renderReport(r, true))}
        </div>
      )}

      {neighbours.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-black uppercase tracking-widest text-content-muted">Reported near you</p>
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
