'use client'

/**
 * RequestVerificationPanel — how a real ward councillor, library or clinic
 * asks to be verified and bound to the area it serves. Backlog A4.
 *
 * Until this existed the only route was you running SQL by hand for every
 * official in the country, which is not a route.
 *
 * The form asks for evidence rather than trusting the claim, and says plainly
 * what verification does and does not grant — an office that misunderstands
 * this is an office that broadcasts something it should not have.
 */
import React, { useCallback, useEffect, useState } from 'react'
import { BadgeCheck, Loader, Send, Info, X } from 'lucide-react'
import {
  fetchMyVerification, applyForVerification, withdrawVerification,
  describeVerification, canApply, isPlausibleEvidenceUrl, type MyVerification
} from '../../../../utils/officialVerification'
import { getErrorMessage } from '../../../../utils/errors'
import { cleanScriptTags, encodeHTMLEntities } from '../../../../utils/security'
import { goldButtonClass } from '../../../../components/ui/GoldButton'

const sanitize = (t: string) => encodeHTMLEntities(cleanScriptTags(t))

interface Props {
  unitId: string
  unitName: string
  unitVerified: boolean
  onChanged?: () => void
}

export default function RequestVerificationPanel({ unitId, unitName, unitVerified, onChanged }: Props) {
  const [state, setState] = useState<MyVerification | null>(null)
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [evidence, setEvidence] = useState('')
  const [email, setEmail] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setState(await fetchMyVerification(unitId))
    } catch {
      setState(null)
    } finally {
      setLoading(false)
    }
  }, [unitId])

  useEffect(() => { load() }, [load])

  const submit = async () => {
    if (!isPlausibleEvidenceUrl(evidence)) {
      setError('That evidence link does not look like a web address.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await applyForVerification({
        unitId,
        officialTitle: sanitize(title.trim()) || undefined,
        evidenceUrl: evidence.trim() || undefined,
        contactEmail: email.trim() || undefined,
        note: sanitize(note.trim()) || undefined
      })
      setOpen(false)
      await load()
      onChanged?.()
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const withdraw = async () => {
    setBusy(true)
    setError(null)
    try {
      await withdrawVerification(unitId)
      await load()
      onChanged?.()
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return <p className="text-[11px] text-gray-500 flex items-center gap-2">
      <Loader size={13} className="animate-spin" /> Checking verification…
    </p>
  }

  if (unitVerified) {
    return (
      <p className="text-[11px] text-green-400 flex items-center gap-1.5">
        <BadgeCheck size={13} /> {unitName} is verified and can send to its area.
      </p>
    )
  }

  return (
    <div className="bg-black/30 border border-white/5 rounded-xl p-3 space-y-2.5">
      <p className="text-[11px] text-gray-300 leading-relaxed">{describeVerification(state)}</p>

      {state?.status === 'pending' && (
        <button
          type="button"
          onClick={withdraw}
          disabled={busy}
          className="text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-red-400 disabled:opacity-50"
        >
          Withdraw application
        </button>
      )}

      {canApply(state, unitVerified) && !open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={`${goldButtonClass()} text-[10px] px-3 py-2 flex items-center gap-1.5`}
        >
          <BadgeCheck size={12} /> Apply to be verified
        </button>
      )}

      {open && (
        <div className="space-y-2.5">
          <div className="flex items-start gap-2 bg-blue-500/5 border border-blue-500/20 rounded-lg p-2.5">
            <Info size={12} className="text-blue-400 mt-0.5 shrink-0" />
            <p className="text-[10px] text-gray-400 leading-relaxed">
              Verification lets this office send notices to <strong className="text-gray-300">everyone living in
              a specific area</strong>, whether or not they follow you. Someone reviews the evidence before that
              is granted, and it can be withdrawn if the channel is misused.
            </p>
          </div>

          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Your role — e.g. Ward 12 Councillor, Branch Librarian"
            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
          />
          <input
            value={evidence}
            onChange={e => setEvidence(e.target.value)}
            placeholder="Link to something that shows this — an official page, a directory listing"
            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
          />
          <input
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="A contact address at the office (not a personal one)"
            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
          />
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            rows={2}
            placeholder="Which area do you serve, and anything else the reviewer should know?"
            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white resize-none"
          />

          <div className="flex gap-2">
            <button
              type="button"
              onClick={submit}
              disabled={busy}
              className={`${goldButtonClass()} text-[10px] px-4 py-2 flex items-center gap-1.5 disabled:opacity-50`}
            >
              <Send size={12} /> {busy ? 'Sending…' : 'Send application'}
            </button>
            <button
              type="button"
              onClick={() => { setOpen(false); setError(null) }}
              className="text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-white px-3 py-2"
            >
              <X size={12} />
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-[11px] text-red-400">{error}</p>}
    </div>
  )
}
