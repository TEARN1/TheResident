'use client'

import React, { useEffect, useState } from 'react'
import { AlertTriangle, RefreshCw, CheckCircle2, XCircle, MinusCircle } from 'lucide-react'
import {
  isPlatformAdmin, fetchClientErrorSummary, fetchPlatformHealth,
  type ClientErrorSummaryRow, type PlatformHealthRow
} from '../../../../utils/officialVerification'
import Card from '../../../../components/ui/Card'
import EmptyState from '../shared/EmptyState'

/**
 * Founder-only operational view: which subsystems are actually working, and
 * what crashed for real users.
 *
 * The health half exists because a subsystem can be completely broken while
 * everything around it looks healthy. Twelve residents had granted push
 * permission on real devices and not one notification had ever been
 * delivered — the dispatcher's vault key was never set, and nothing anywhere
 * said so. That is the failure this panel is for.
 *
 * Both halves call admin-gated RPCs (res_platform_health,
 * res_client_error_summary_for_admin) which check res_is_platform_admin()
 * server-side. res_client_errors itself stays as locked down as it always
 * was — no policy, no grant, service_role only. Nothing here is the security
 * boundary; it only decides whether to render at all.
 *
 * Renders nothing for anyone but a platform admin — not a disabled state,
 * not an explanation, nothing. A resident should never learn this exists.
 */
export default function ClientErrorAdminPanel() {
  const [admin, setAdmin] = useState(false)
  const [checked, setChecked] = useState(false)
  const [rows, setRows] = useState<ClientErrorSummaryRow[]>([])
  const [health, setHealth] = useState<PlatformHealthRow[]>([])
  const [loading, setLoading] = useState(false)
  const [hours, setHours] = useState(24)

  useEffect(() => {
    isPlatformAdmin().then(v => { setAdmin(v); setChecked(true) })
  }, [])

  const load = React.useCallback(async (h: number) => {
    setLoading(true)
    try {
      const [errs, hp] = await Promise.all([fetchClientErrorSummary(h), fetchPlatformHealth()])
      setRows(errs)
      setHealth(hp)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (admin) load(hours)
  }, [admin, hours, load])

  if (!checked || !admin) return null

  return (
    <Card className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <AlertTriangle size={16} className="text-accent" />
          <h3 className="text-sm font-black uppercase tracking-widest text-content">System Health</h3>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={hours}
            onChange={e => setHours(Number(e.target.value))}
            className="bg-surface-sunken/40 border border-default rounded-lg text-[10px] font-bold uppercase tracking-widest text-content px-2 py-1.5"
          >
            <option value={24}>24h</option>
            <option value={24 * 7}>7d</option>
            <option value={24 * 30}>30d</option>
          </select>
          <button
            onClick={() => load(hours)}
            disabled={loading}
            className="p-1.5 rounded-lg border border-default text-content-muted hover:text-content disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      <p className="text-[10px] text-content-subtle">
        Founder-only. Nothing here changes anything on its own — it reports.
      </p>

      {/* Subsystems that can be broken while everything downstream still looks
          fine. The one that prompted this: twelve people had granted push
          permission on real devices and not one notification had ever been
          delivered, because the dispatcher's vault key was never set. */}
      {health.length > 0 && (
        <div className="space-y-2">
          {health.map(h => {
            const tone =
              h.status === 'broken'   ? { icon: XCircle,      cls: 'text-danger',     border: 'border-danger/30 bg-danger/5' } :
              h.status === 'degraded' ? { icon: AlertTriangle, cls: 'text-warning',  border: 'border-warning/30 bg-warning/5' } :
              h.status === 'idle'     ? { icon: MinusCircle,   cls: 'text-content-muted',   border: 'border-subtle bg-surface-sunken/30' } :
                                        { icon: CheckCircle2,  cls: 'text-success', border: 'border-subtle bg-surface-sunken/30' }
            const Icon = tone.icon
            return (
              <div key={h.component} className={`border rounded-xl p-3 flex gap-2.5 ${tone.border}`}>
                <Icon size={14} className={`${tone.cls} shrink-0 mt-0.5`} />
                <div className="min-w-0">
                  <p className="text-xs font-bold text-content">{h.component}</p>
                  <p className="text-[10px] text-content-muted leading-relaxed">{h.detail}</p>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <p className="text-[10px] font-black uppercase tracking-widest text-content-muted pt-1">
        Crashes
      </p>

      {rows.length === 0 ? (
        <EmptyState icon={AlertTriangle} title="No crashes reported" subtitle="Nothing broke in this window." />
      ) : (
        <div className="space-y-2">
          {rows.map(row => (
            <div key={row.label} className="bg-surface-sunken/30 border border-subtle rounded-xl p-3 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-bold text-content">{row.label}</span>
                <span className="text-[10px] font-black uppercase tracking-widest text-danger">
                  {row.occurrences}× &middot; {row.affectedUsers} user{row.affectedUsers === 1 ? '' : 's'}
                </span>
              </div>
              {row.sampleMessage && (
                <p className="text-[10px] text-content-muted font-mono truncate">{row.sampleMessage}</p>
              )}
              <p className="text-[9px] text-content-subtle">Last seen {new Date(row.lastSeen).toLocaleString()}</p>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
