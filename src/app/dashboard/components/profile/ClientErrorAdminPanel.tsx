'use client'

import React, { useEffect, useState } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { isPlatformAdmin, fetchClientErrorSummary, type ClientErrorSummaryRow } from '../../../../utils/officialVerification'
import Card from '../../../../components/ui/Card'
import EmptyState from '../shared/EmptyState'

/**
 * Founder-only view of real crashes real users hit. res_client_errors itself
 * stays exactly as locked down as it always was — no policy, no grant,
 * service_role only. This calls res_client_error_summary_for_admin(), which
 * checks res_is_platform_admin() again server-side; nothing here is the
 * actual security boundary, it just decides whether to render at all.
 *
 * Renders nothing for anyone but a platform admin — not a disabled state,
 * not an explanation, nothing. A resident should never learn this exists.
 */
export default function ClientErrorAdminPanel() {
  const [admin, setAdmin] = useState(false)
  const [checked, setChecked] = useState(false)
  const [rows, setRows] = useState<ClientErrorSummaryRow[]>([])
  const [loading, setLoading] = useState(false)
  const [hours, setHours] = useState(24)

  useEffect(() => {
    isPlatformAdmin().then(v => { setAdmin(v); setChecked(true) })
  }, [])

  const load = React.useCallback(async (h: number) => {
    setLoading(true)
    try {
      setRows(await fetchClientErrorSummary(h))
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
          <AlertTriangle size={16} className="text-gold-primary" />
          <h3 className="text-sm font-black uppercase tracking-widest text-white">Crash Reports</h3>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={hours}
            onChange={e => setHours(Number(e.target.value))}
            className="bg-black/40 border border-white/10 rounded-lg text-[10px] font-bold uppercase tracking-widest text-gray-300 px-2 py-1.5"
          >
            <option value={24}>24h</option>
            <option value={24 * 7}>7d</option>
            <option value={24 * 30}>30d</option>
          </select>
          <button
            onClick={() => load(hours)}
            disabled={loading}
            className="p-1.5 rounded-lg border border-white/10 text-gray-400 hover:text-white disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      <p className="text-[10px] text-gray-600">
        Real crashes from real users, grouped by kind. Founder-only — nobody else can see this,
        and this list changes nothing on its own.
      </p>

      {rows.length === 0 ? (
        <EmptyState icon={AlertTriangle} title="No crashes reported" subtitle="Nothing broke in this window." />
      ) : (
        <div className="space-y-2">
          {rows.map(row => (
            <div key={row.label} className="bg-black/30 border border-white/5 rounded-xl p-3 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-bold text-white">{row.label}</span>
                <span className="text-[10px] font-black uppercase tracking-widest text-red-400">
                  {row.occurrences}× &middot; {row.affectedUsers} user{row.affectedUsers === 1 ? '' : 's'}
                </span>
              </div>
              {row.sampleMessage && (
                <p className="text-[10px] text-gray-500 font-mono truncate">{row.sampleMessage}</p>
              )}
              <p className="text-[9px] text-gray-600">Last seen {new Date(row.lastSeen).toLocaleString()}</p>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
