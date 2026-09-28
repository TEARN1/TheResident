'use client'

import React, { useEffect, useState } from 'react'
import { Cpu, RefreshCw, CheckCircle2, XCircle, MinusCircle, AlertTriangle, Power, Check } from 'lucide-react'
import { isPlatformAdmin } from '../../../../utils/officialVerification'
import {
  fetchOpsOverview, setJobEnabled, acknowledgeFinding, nightlyRunIsStale,
  type OpsOverview, type OpsJob, type Severity
} from '../../../../utils/opsConsole'
import { withTimeout } from '../../../../utils/resilientCall'
import Card from '../../../../components/ui/Card'
import EmptyState from '../shared/EmptyState'

/**
 * Founder-only control room for everything the app does on its own.
 *
 * Replaces the old "Automation Hub", which printed payments, WhatsApp sends
 * and security dispatches that never happened. Every line here comes from a
 * real row: res_automation_jobs, res_maintenance_runs, res_ops_findings and
 * res_metrics_daily, through admin-gated RPCs (section 49).
 *
 * Renders nothing for anyone but a platform admin, same as the System Health
 * panel beside it. The RPCs refuse non-admins; this only decides whether to
 * render.
 */

const SEVERITY_TONE: Record<Severity, string> = {
  critical: 'border-danger/30 bg-danger/5 text-danger',
  warn: 'border-warning/30 bg-warning/5 text-warning',
  info: 'border-subtle bg-surface-sunken/30 text-content-muted'
}

const AUTONOMY_LABEL = ['Observes', 'Flags', 'Acts, reversibly', 'Acts, then reports', 'Upkeep']

function when(ts: string | null): string {
  return ts ? new Date(ts).toLocaleString() : 'never'
}

function JobRow({ job, busy, onToggle }: { job: OpsJob; busy: boolean; onToggle: () => void }) {
  const isGlobal = job.key === '*'
  const Icon = !job.enabled ? MinusCircle : job.lastOk === false ? XCircle : CheckCircle2
  const tone = !job.enabled ? 'text-content-muted' : job.lastOk === false ? 'text-danger' : 'text-success'
  return (
    <div className={`border rounded-xl p-3 flex gap-2.5 ${isGlobal ? 'border-default bg-surface-sunken/50' : 'border-subtle bg-surface-sunken/30'}`}>
      <Icon size={14} className={`${tone} shrink-0 mt-0.5`} />
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="text-xs font-bold text-content">{isGlobal ? 'All automation' : job.description}</p>
        {!isGlobal && (
          <p className="text-xs text-content-subtle">
            {job.schedule} · {AUTONOMY_LABEL[job.autonomy] ?? `level ${job.autonomy}`}
            {job.maxAffected != null && ` · stops itself above ${job.maxAffected} rows`}
          </p>
        )}
        {!isGlobal && job.schedule === 'nightly' && (
          <p className="text-xs text-content-muted">
            Last run {when(job.lastRun)}
            {job.lastAffected != null && ` · changed ${job.lastAffected}`}
            {job.failures48h > 0 && ` · ${job.failures48h} failure(s) in 48h`}
          </p>
        )}
        {job.lastError && job.lastError !== 'skipped: disabled' && (
          <p className="text-xs text-danger font-mono truncate">{job.lastError}</p>
        )}
        {!job.enabled && job.disabledReason && (
          <p className="text-xs text-warning">Off: {job.disabledReason}</p>
        )}
      </div>
      <button
        onClick={onToggle}
        disabled={busy}
        className={`self-start min-h-[44px] min-w-[44px] px-2 rounded-lg border text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-1 disabled:opacity-50 ${
          job.enabled ? 'border-default text-content-muted hover:text-content' : 'border-success/40 text-success'
        }`}
        title={job.enabled ? 'Switch off' : 'Switch on'}
        aria-label={`${job.enabled ? 'Switch off' : 'Switch on'}: ${isGlobal ? 'all automation' : job.description}`}
      >
        <Power size={12} />
        {job.enabled ? 'On' : 'Off'}
      </button>
    </div>
  )
}

export default function OpsConsolePanel() {
  const [admin, setAdmin] = useState(false)
  const [checked, setChecked] = useState(false)
  const [data, setData] = useState<OpsOverview | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busyKey, setBusyKey] = useState<string | null>(null)

  useEffect(() => {
    isPlatformAdmin().then(v => { setAdmin(v); setChecked(true) })
  }, [])

  // Depends on nothing: every refresh is an explicit call, never a reaction
  // to the state this sets (see MAINTENANCE.md on the refetch loop).
  const load = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setData(await withTimeout(fetchOpsOverview(), 15000, 'ops console'))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load the console.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (admin) load()
  }, [admin, load])

  if (!checked || !admin) return null

  const toggle = async (job: OpsJob) => {
    if (job.key === '*' && job.enabled &&
        !window.confirm('Stop ALL automation, including panic-alert escalation?')) return
    setBusyKey(job.key)
    try {
      await withTimeout(setJobEnabled(job.key, !job.enabled), 15000, 'job switch')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not change that job.')
    } finally {
      setBusyKey(null)
    }
  }

  const ack = async (id: string) => {
    setBusyKey(id)
    try {
      await withTimeout(acknowledgeFinding(id), 15000, 'acknowledge')
      await load()
    } finally {
      setBusyKey(null)
    }
  }

  const stale = data ? nightlyRunIsStale(data.lastNightlyRun) : false
  const latest = data?.metrics.at(-1)

  return (
    <Card className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Cpu size={16} className="text-accent" />
          <h3 className="text-sm font-black uppercase tracking-widest text-content">Ops Console</h3>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg border border-default text-content-muted hover:text-content disabled:opacity-50"
          title="Refresh"
          aria-label="Refresh the ops console"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <p className="text-xs text-content-subtle">
        Founder-only. Everything the app does on its own, what it found, and the switch for each.
      </p>

      {error && <p className="text-xs text-danger">{error}</p>}

      {stale && (
        <div className="border rounded-xl p-3 flex gap-2.5 border-danger/30 bg-danger/5">
          <XCircle size={14} className="text-danger shrink-0 mt-0.5" />
          <p className="text-xs text-content">
            The nightly run has not happened since {when(data?.lastNightlyRun ?? null)}. Every job below may look
            fine and still not be running.
          </p>
        </div>
      )}

      <p className="text-xs font-black uppercase tracking-widest text-content-muted pt-1">
        Needs you ({data?.findings.length ?? 0})
      </p>
      {!data || data.findings.length === 0 ? (
        <EmptyState icon={CheckCircle2} title="Nothing needs you" subtitle="No open findings." />
      ) : (
        <div className="space-y-2">
          {data.findings.map(f => (
            <div key={f.id} className={`border rounded-xl p-3 flex gap-2.5 ${SEVERITY_TONE[f.severity]}`}>
              <AlertTriangle size={14} className="shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-content">{f.summary}</p>
                <p className="text-xs text-content-muted">
                  {f.source} · {f.occurrences > 1 ? `${f.occurrences}× · ` : ''}last {when(f.lastSeen)}
                </p>
              </div>
              <button
                onClick={() => ack(f.id)}
                disabled={busyKey === f.id}
                className="self-start min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg border border-default text-content-muted hover:text-content disabled:opacity-50"
                title="Acknowledge"
                aria-label={`Acknowledge: ${f.summary}`}
              >
                <Check size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {latest && (
        <>
          <p className="text-xs font-black uppercase tracking-widest text-content-muted pt-1">
            Yesterday ({latest.day})
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              ['Residents', `${latest.residentsTotal} (+${latest.residentsNew})`],
              ['Open listings', latest.listingsOpen],
              ['Alerts', `${latest.alertsRaised} · ${latest.alertsUnanswered} unanswered`],
              ['First response', latest.medianFirstResponseSecs == null ? '—' : `${Math.round(latest.medianFirstResponseSecs / 60)} min`],
              ['Open reports', latest.reportsOpen],
              ['Notifications', latest.notificationsSent],
              ['Crashes', latest.clientErrors]
            ].map(([label, value]) => (
              <div key={label as string} className="bg-surface-sunken/30 border border-subtle rounded-xl p-2.5">
                <p className="text-xs text-content-subtle">{label}</p>
                <p className="text-sm font-bold text-content">{value}</p>
              </div>
            ))}
          </div>
        </>
      )}

      <p className="text-xs font-black uppercase tracking-widest text-content-muted pt-1">Jobs</p>
      <div className="space-y-2">
        {(data?.jobs ?? []).map(job => (
          <JobRow key={job.key} job={job} busy={busyKey === job.key} onToggle={() => toggle(job)} />
        ))}
      </div>
    </Card>
  )
}
