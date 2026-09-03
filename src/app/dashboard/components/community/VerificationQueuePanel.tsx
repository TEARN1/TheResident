'use client'

/**
 * VerificationQueuePanel — where a platform admin decides who gets to message
 * everyone in an area. Backlog A1.
 *
 * This is the most consequential screen in the app. Approving one row here
 * grants an account the ability to interrupt thousands of residents who never
 * opted in, so the design is deliberately slow: the evidence is shown, the
 * area must be chosen explicitly rather than accepted from the applicant, and
 * a rejection cannot be recorded without a reason.
 *
 * Renders nothing at all for non-admins — the check is server-side too, so
 * this is presentation rather than protection.
 */
import React, { useCallback, useEffect, useState } from 'react'
import { ShieldCheck, Loader, ExternalLink, Search, Check, X } from 'lucide-react'
import {
  fetchPendingRequests, searchAreas, approveRequest, rejectRequest,
  type PendingRequest, type AreaOption
} from '../../../../utils/officialVerification'
import { LEVEL_LABEL } from '../../../../utils/jurisdictions'
import { getErrorMessage } from '../../../../utils/errors'
import { goldButtonClass } from '../../../../components/ui/GoldButton'
import EmptyState from '../shared/EmptyState'

export default function VerificationQueuePanel() {
  const [requests, setRequests] = useState<PendingRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [openId, setOpenId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [areas, setAreas] = useState<AreaOption[]>([])
  const [chosenArea, setChosenArea] = useState<AreaOption | null>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setRequests(await fetchPendingRequests())
    } catch {
      setRequests([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // Debounced so typing "Tshwane" is one query, not seven.
  useEffect(() => {
    if (!openId) return
    const id = setTimeout(() => {
      searchAreas(query).then(setAreas).catch(() => setAreas([]))
    }, 250)
    return () => clearTimeout(id)
  }, [query, openId])

  const reset = () => {
    setOpenId(null); setQuery(''); setAreas([]); setChosenArea(null); setNote(''); setError(null)
  }

  const approve = async (unitId: string) => {
    if (!chosenArea) return
    setBusy(true); setError(null)
    try {
      await approveRequest(unitId, chosenArea.id, note.trim() || undefined)
      reset()
      await load()
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const reject = async (unitId: string) => {
    if (!note.trim()) {
      setError('A rejection needs a reason — the applicant is shown it and will otherwise just reapply.')
      return
    }
    setBusy(true); setError(null)
    try {
      await rejectRequest(unitId, note.trim())
      reset()
      await load()
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return <p className="text-[11px] text-gray-500 flex items-center gap-2">
      <Loader size={13} className="animate-spin" /> Loading the queue…
    </p>
  }

  return (
    <div className="glass-panel p-5 space-y-4">
      <div className="flex items-center gap-2">
        <div className="p-2 bg-gold-primary/10 rounded-xl">
          <ShieldCheck size={18} className="text-gold-primary" />
        </div>
        <div>
          <p className="text-xs font-black text-white uppercase tracking-widest">Verification Queue</p>
          <p className="text-[10px] text-gray-500">
            Approving grants the power to message everyone in an area
          </p>
        </div>
      </div>

      {requests.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title="Nothing waiting"
          subtitle="Applications from councillors, libraries, clinics and municipalities appear here."
        />
      ) : (
        <div className="space-y-2">
          {requests.map(r => (
            <div key={r.requestId} className="bg-black/30 border border-white/5 rounded-xl p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-bold text-white">{r.unitName}</p>
                  <p className="text-[10px] text-gray-500">
                    {r.officialTitle || 'No role given'} · {r.unitTier}
                  </p>
                </div>
                <span className="text-[9px] text-gray-600 shrink-0">
                  {new Date(r.requestedAt).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })}
                </span>
              </div>

              {r.note && <p className="text-[11px] text-gray-400 leading-relaxed">{r.note}</p>}

              <div className="flex flex-wrap gap-3 text-[10px]">
                {r.evidenceUrl && (
                  <a
                    href={r.evidenceUrl}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="text-gold-primary hover:underline flex items-center gap-1"
                  >
                    <ExternalLink size={10} /> Evidence
                  </a>
                )}
                {r.contactEmail && <span className="text-gray-500">{r.contactEmail}</span>}
                {r.requestedJurisdictionName && (
                  <span className="text-gray-500">Asked for: {r.requestedJurisdictionName}</span>
                )}
              </div>

              {openId === r.requestId ? (
                <div className="space-y-2 pt-2 border-t border-white/5">
                  <div className="relative">
                    <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
                    <input
                      value={query}
                      onChange={e => setQuery(e.target.value)}
                      placeholder="Find the area to bind — type a municipality or ward name"
                      className="w-full bg-black/40 border border-white/10 rounded-lg pl-8 pr-3 py-2 text-xs text-white"
                    />
                  </div>

                  {/* Chosen explicitly, never inherited from what the applicant asked for. */}
                  <div className="max-h-44 overflow-y-auto space-y-1">
                    {areas.map(a => (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => setChosenArea(a)}
                        className={`w-full text-left px-2.5 py-1.5 rounded-lg text-[11px] transition-colors ${
                          chosenArea?.id === a.id
                            ? 'bg-gold-primary/15 text-gold-primary'
                            : 'bg-white/5 text-gray-300 hover:bg-white/10'
                        }`}
                      >
                        {a.name}
                        <span className="text-gray-500"> · {LEVEL_LABEL[a.level]}</span>
                        {a.parentName && <span className="text-gray-600"> · in {a.parentName}</span>}
                      </button>
                    ))}
                  </div>

                  <textarea
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    rows={2}
                    placeholder="What you checked, or why you are refusing"
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white resize-none"
                  />

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => approve(r.unitId)}
                      disabled={busy || !chosenArea}
                      className={`${goldButtonClass()} text-[10px] px-3 py-2 flex items-center gap-1.5 disabled:opacity-40`}
                    >
                      <Check size={12} />
                      {chosenArea ? `Verify and bind to ${chosenArea.name}` : 'Choose an area first'}
                    </button>
                    <button
                      type="button"
                      onClick={() => reject(r.unitId)}
                      disabled={busy}
                      className="text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-red-400 px-3 py-2 bg-white/5 rounded-lg disabled:opacity-50"
                    >
                      Reject
                    </button>
                    <button
                      type="button"
                      onClick={reset}
                      className="text-[10px] font-black uppercase tracking-widest text-gray-600 hover:text-white px-2 py-2"
                    >
                      <X size={12} />
                    </button>
                  </div>
                  {error && <p className="text-[11px] text-red-400">{error}</p>}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => { reset(); setOpenId(r.requestId); setQuery(r.requestedJurisdictionName || '') }}
                  className="text-[10px] font-black uppercase tracking-widest text-gold-primary hover:text-white"
                >
                  Review
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
