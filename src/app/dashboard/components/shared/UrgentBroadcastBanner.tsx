'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { useSelector } from 'react-redux'
import { AlertTriangle, Check } from 'lucide-react'
import { RootState, isGuestUser } from '../../../../store'
import {
  fetchPendingUrgentBroadcasts, acknowledgeBroadcast,
  type PendingUrgentBroadcast
} from '../../../../utils/orgBroadcasts'
import { getErrorMessage } from '../../../../utils/errors'

/**
 * An urgent announcement from an organisation the resident follows — a school
 * closing tomorrow, a water shut-off — that keeps signalling until they
 * actually deal with it.
 *
 * Why this is not another dismissible banner: every other one in this app
 * (guest prompt, next-of-kin, map tip) stores its dismissal in
 * session/localStorage, so it dies on a refresh and never crosses devices.
 * "Won't stop until you open it" has to mean something stronger, so the
 * acknowledgement is a row in res_org_broadcast_receipts. Clearing your
 * browser does not clear the notice; reading it on your phone clears it on
 * your laptop.
 *
 * Only a VERIFIED org can send at this priority — see the
 * res_check_broadcast_priority trigger. Anyone can name a unit "Eskom"; nobody
 * unverified can use that name to interrupt you.
 */
export default function UrgentBroadcastBanner() {
  const currentUser = useSelector((state: RootState) => state.auth.currentUser)
  const guest = currentUser ? isGuestUser(currentUser) : true

  const [pending, setPending] = useState<PendingUrgentBroadcast[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setPending(await fetchPendingUrgentBroadcasts())
  }, [])

  useEffect(() => {
    if (!currentUser || guest) return
    let cancelled = false
    const run = () => { load().catch(() => { /* best-effort; a banner must never break the page */ }) }
    run()
    // Cheap poll: these are rare, and realtime on res_org_broadcasts would
    // still need this fallback for a notice that arrived while the tab was shut.
    const id = setInterval(() => { if (!cancelled) run() }, 120_000)
    return () => { cancelled = true; clearInterval(id) }
  }, [currentUser, guest, load])

  const handleAck = async (id: string) => {
    setBusy(true)
    setError(null)
    try {
      await acknowledgeBroadcast(id)
      setPending(list => list.filter(b => b.id !== id))
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  if (!currentUser || guest || pending.length === 0) return null

  // Worst first, one at a time — matching the layout's existing banner policy
  // rather than stacking five notices on top of each other.
  const notice = pending[0]
  const critical = notice.priority === 'critical'

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={`urgent-broadcast rounded-xl border p-4 space-y-2 ${
        critical
          ? 'bg-red-500/10 border-red-500/40 urgent-broadcast--pulse'
          : 'bg-yellow-500/10 border-yellow-500/40'
      }`}
    >
      <div className="flex items-start gap-3">
        <AlertTriangle size={18} className={critical ? 'text-red-400 shrink-0 mt-0.5' : 'text-yellow-400 shrink-0 mt-0.5'} />
        <div className="min-w-0 flex-1">
          <p className={`text-[9px] font-black uppercase tracking-widest ${critical ? 'text-red-400' : 'text-yellow-400'}`}>
            {notice.unitName}
          </p>
          <p className="text-sm font-bold text-white mt-0.5 break-words">{notice.title}</p>
          <p className="text-xs text-gray-300 mt-1 break-words">{notice.body}</p>
          {pending.length > 1 && (
            <p className="text-[10px] text-gray-500 mt-1">
              {pending.length - 1} more {pending.length - 1 === 1 ? 'notice' : 'notices'} after this
            </p>
          )}
        </div>
      </div>

      {error && <p className="text-[10px] text-red-400">{error}</p>}

      <button
        onClick={() => handleAck(notice.id)}
        disabled={busy}
        className={`w-full flex items-center justify-center gap-1.5 text-[10px] font-black uppercase tracking-widest px-3 py-2 rounded-lg transition-colors disabled:opacity-50 ${
          critical
            ? 'bg-red-500/20 text-red-300 hover:bg-red-500/30'
            : 'bg-yellow-500/20 text-yellow-300 hover:bg-yellow-500/30'
        }`}
      >
        <Check size={12} /> {busy ? 'Saving…' : 'Got it'}
      </button>
    </div>
  )
}
