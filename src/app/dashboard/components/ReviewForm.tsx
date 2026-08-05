'use client'

import React, { useState } from 'react'
import { useDispatch } from 'react-redux'
import { Star, Send, Loader } from 'lucide-react'
import { submitReview } from '../../../store/actions'
import type { AppDispatch } from '../../../store'

interface ReviewFormProps {
  /** The other party's user id — landlord reviewing tenant, or vice versa. */
  subjectId: string
  onSubmitted?: () => void
}

/**
 * Star rating + body, posted via res_submit_review (subject_type='user').
 * Eligibility (must share an approved res_room_requests row) is enforced
 * server-side — this only surfaces whatever message comes back.
 */
export default function ReviewForm({ subjectId, onSubmitted }: ReviewFormProps) {
  const dispatch = useDispatch<AppDispatch>()
  const [rating, setRating] = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [body, setBody] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (rating < 1) {
      setError('Pick a star rating first.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await dispatch(submitReview({ subjectType: 'user', subjectId, rating, body: body.trim() || undefined })).unwrap()
      setSuccess(true)
      setBody('')
      setRating(0)
      onSubmitted?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not post that review.')
    } finally {
      setSubmitting(false)
    }
  }

  if (success) {
    return (
      <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 text-xs font-bold text-green-400 uppercase tracking-widest">
        Review posted — thanks.
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 bg-black/40 border border-white/5 rounded-2xl p-5">
      <div className="flex items-center gap-1.5">
        {[1, 2, 3, 4, 5].map(n => (
          <button
            key={n}
            type="button"
            onClick={() => setRating(n)}
            onMouseEnter={() => setHoverRating(n)}
            onMouseLeave={() => setHoverRating(0)}
            className="p-0.5"
          >
            <Star
              size={22}
              className={(hoverRating || rating) >= n ? 'text-gold-primary fill-gold-primary' : 'text-gray-700'}
            />
          </button>
        ))}
      </div>
      <textarea
        value={body}
        onChange={e => setBody(e.target.value)}
        placeholder="How was your experience with them? (optional)"
        className="w-full bg-black border border-white/10 rounded-xl p-3 text-sm text-white h-20 resize-none outline-none focus:border-gold-primary/40"
      />
      {error && <p className="text-[11px] text-red-400 font-bold">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="w-full bg-gold-primary hover:bg-gold-secondary text-black font-black py-3 rounded-xl transition-all active:scale-95 text-xs uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-50"
      >
        {submitting ? <Loader size={14} className="animate-spin" /> : <Send size={14} />}
        Post Review
      </button>
    </form>
  )
}
