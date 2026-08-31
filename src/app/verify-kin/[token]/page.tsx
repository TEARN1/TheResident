'use client'

import React, { use, useEffect, useState } from 'react'
import { ShieldCheck, Check, X, Loader } from 'lucide-react'
import { fetchKinClaim, respondToKinClaim, type KinClaim } from '../../../utils/kinVerification'

/**
 * Public, no-login page. Someone who may not have (or want) a Resident
 * account gets sent this link to answer a single question about a
 * relationship a resident claimed — "is this really your brother/sister?"
 * There is nothing else reachable from here: no other data, no sign-up
 * push, just the claim and two buttons.
 */
export default function VerifyKinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)

  const [claim, setClaim] = useState<KinClaim | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [answered, setAnswered] = useState<'confirmed' | 'denied' | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchKinClaim(token)
      .then(result => {
        if (cancelled) return
        if (!result) { setLoadError('This link is invalid or has expired.'); return }
        setClaim(result)
        if (result.status !== 'pending') setAnswered(result.status)
      })
      .catch(err => { if (!cancelled) setLoadError(err instanceof Error ? err.message : 'Could not load this link.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [token])

  const respond = async (confirmed: boolean) => {
    setSubmitting(true)
    setSubmitError(null)
    try {
      await respondToKinClaim(token, confirmed)
      setAnswered(confirmed ? 'confirmed' : 'denied')
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Could not submit your answer — try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="glass-panel w-full max-w-md p-8 space-y-6 text-center">
        <div className="w-12 h-12 mx-auto rounded-full bg-gold-primary/10 flex items-center justify-center">
          <ShieldCheck size={24} className="text-gold-primary" />
        </div>
        <h1 className="text-lg font-black text-white uppercase tracking-tight">Confirm a relationship</h1>

        {loading && (
          <div className="flex items-center justify-center gap-2 text-gray-500 text-sm">
            <Loader size={16} className="animate-spin" /> Loading…
          </div>
        )}

        {!loading && loadError && (
          <p className="text-sm text-red-400">{loadError}</p>
        )}

        {!loading && claim && answered === null && (
          <>
            <p className="text-sm text-gray-300 leading-relaxed">
              <strong className="text-white">{claim.requesterName}</strong> listed <strong className="text-white">{claim.claimedName}</strong> as their <strong className="text-gold-primary">{claim.claimedRelationship.toLowerCase()}</strong> on The Resident.
            </p>
            <p className="text-xs text-gray-500">If you&apos;re {claim.claimedName}, is that true?</p>
            {submitError && <p className="text-[11px] text-red-400">{submitError}</p>}
            <div className="flex gap-3">
              <button
                onClick={() => respond(true)}
                disabled={submitting}
                className="flex-1 flex items-center justify-center gap-2 bg-gold-primary text-black font-black py-3 rounded-xl text-xs uppercase tracking-widest disabled:opacity-50"
              >
                <Check size={14} /> Yes, that&apos;s true
              </button>
              <button
                onClick={() => respond(false)}
                disabled={submitting}
                className="flex-1 flex items-center justify-center gap-2 bg-white/5 border border-white/10 text-gray-300 font-black py-3 rounded-xl text-xs uppercase tracking-widest disabled:opacity-50"
              >
                <X size={14} /> No
              </button>
            </div>
            <p className="text-[10px] text-gray-600">You don&apos;t need a Resident account to answer this.</p>
          </>
        )}

        {!loading && answered === 'confirmed' && (
          <p className="text-sm text-green-400">Thanks — you&apos;ve confirmed this relationship. You can close this page.</p>
        )}
        {!loading && answered === 'denied' && (
          <p className="text-sm text-gray-400">Thanks for letting us know. You can close this page.</p>
        )}
      </div>
    </div>
  )
}
