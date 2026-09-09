'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { Flag, RefreshCw, EyeOff, Eye, Check } from 'lucide-react'
import { isPlatformAdmin } from '../../../../utils/officialVerification'
import {
  fetchPendingReports, resolveReport, describeSubject, severityOf,
  type PendingReport
} from '../../../../utils/contentReports'
import Card from '../../../../components/ui/Card'
import EmptyState from '../shared/EmptyState'

/**
 * Somebody has to be able to read the complaints.
 *
 * Residents could report content, and res_reports recorded it, but nothing in
 * the app ever read that table. There was no queue and no reviewer — while
 * every reporter was told their report "will be reviewed".
 *
 * Only rendered for a platform admin; the server refuses everyone else
 * regardless of what this component does.
 */
export default function ReportQueueAdminPanel() {
  const [admin, setAdmin] = useState(false)
  const [checked, setChecked] = useState(false)
  const [rows, setRows] = useState<PendingReport[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setRows(await fetchPendingReports())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load the queue.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const is = await isPlatformAdmin()
      if (cancelled) return
      setAdmin(is)
      setChecked(true)
      if (is) load()
    })()
    return () => { cancelled = true }
  }, [load])

  if (!checked || !admin) return null

  const act = async (r: PendingReport, action: 'hide' | 'restore' | 'dismiss') => {
    const key = `${r.subjectType}:${r.subjectId}`
    setBusy(key)
    try {
      await resolveReport(r.subjectType, r.subjectId, action)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That did not go through.')
    } finally {
      setBusy(null)
    }
  }

  const tone = { high: 'text-danger', medium: 'text-warning', low: 'text-content-muted' } as const

  return (
    <Card>
      <div className="flex items-center justify-between gap-3 mb-4">
        <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-accent">
          <Flag size={16} aria-hidden="true" /> Reported content
        </h2>
        <button
          onClick={load}
          disabled={loading}
          aria-label="Refresh the report queue"
          className="min-h-tap inline-flex items-center gap-2 rounded-xl border border-default px-3 text-xs font-bold text-content-muted hover:text-content"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} aria-hidden="true" />
          Refresh
        </button>
      </div>

      {error && (
        <p className="mb-3 rounded-lg bg-danger/10 p-3 text-xs text-danger">{error}</p>
      )}

      {rows.length === 0 && !loading ? (
        <EmptyState
          icon={Flag}
          title="Nothing reported"
          subtitle="Complaints from residents appear here, grouped by what was reported."
        />
      ) : (
        <ul className="space-y-3">
          {rows.map(r => {
            const key = `${r.subjectType}:${r.subjectId}`
            const sev = severityOf(r)
            return (
              <li key={key} className="rounded-xl border border-default bg-surface-raised p-4">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="text-sm font-bold text-content">{describeSubject(r.subjectType)}</span>
                  <span className={`text-xs font-black uppercase tracking-widest ${tone[sev]}`}>
                    {r.reportCount} {r.reportCount === 1 ? 'report' : 'reports'}
                  </span>
                  {r.currentlyHidden && (
                    <span className="text-xs font-bold uppercase tracking-widest text-warning">
                      Currently hidden
                    </span>
                  )}
                </div>

                <p className="mt-1 text-xs text-content-muted">
                  {r.reasons.join(', ')}
                  {' · '}
                  first reported {new Date(r.firstReportedAt).toLocaleDateString()}
                </p>

                {r.details.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {r.details.slice(0, 3).map((d, i) => (
                      <li key={i} className="border-l-2 border-default pl-2 text-xs text-content-muted">
                        &ldquo;{d}&rdquo;
                      </li>
                    ))}
                  </ul>
                )}

                <div className="mt-3 flex flex-wrap gap-2">
                  {r.currentlyHidden ? (
                    <button
                      onClick={() => act(r, 'restore')}
                      disabled={busy === key}
                      className="min-h-tap inline-flex items-center gap-2 rounded-xl border border-default px-3 text-xs font-bold text-content"
                    >
                      <Eye size={14} aria-hidden="true" /> Put it back
                    </button>
                  ) : (
                    <button
                      onClick={() => act(r, 'hide')}
                      disabled={busy === key}
                      className="min-h-tap inline-flex items-center gap-2 rounded-xl bg-danger px-3 text-xs font-bold text-content-on-accent"
                    >
                      <EyeOff size={14} aria-hidden="true" /> Take it down
                    </button>
                  )}
                  <button
                    onClick={() => act(r, 'dismiss')}
                    disabled={busy === key}
                    className="min-h-tap inline-flex items-center gap-2 rounded-xl border border-default px-3 text-xs font-bold text-content-muted"
                  >
                    <Check size={14} aria-hidden="true" /> Nothing wrong with it
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <p className="mt-4 text-xs text-content-subtle">
        Reporters are not named here. A reviewer needs to know what was said and how many people
        said it, not who — naming them invites retaliation. Every decision is recorded in the
        moderation log against your account.
      </p>
    </Card>
  )
}
