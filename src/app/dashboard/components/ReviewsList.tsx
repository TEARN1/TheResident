'use client'

import React, { useEffect, useState } from 'react'
import { Star } from 'lucide-react'
import { supabase } from '../../../utils/supabase'

interface ReviewRow {
  id: string
  rating: number
  body: string | null
  created_at: string
  author_id: string
  authorName: string
}

/**
 * Reviews on a person (subject_type='user') — visible to anyone viewing
 * their card, not gated to past dealings. Author display names are
 * batch-joined from profiles, not fetched per-row.
 */
export default function ReviewsList({ userId }: { userId: string }) {
  const [reviews, setReviews] = useState<ReviewRow[] | null>(null)

  useEffect(() => {
    let cancelled = false
    if (!supabase || !userId) return

    const load = async () => {
      const { data, error } = await supabase!
        .from('res_reviews')
        .select('id, rating, body, created_at, author_id')
        .eq('subject_type', 'user')
        .eq('subject_id', userId)
        .order('created_at', { ascending: false })

      if (error || !data || cancelled) {
        if (!cancelled) setReviews([])
        return
      }

      const authorIds = [...new Set(data.map(r => r.author_id))]
      const { data: authors } = authorIds.length
        ? await supabase!.from('profiles').select('id, display_name, username').in('id', authorIds)
        : { data: [] as { id: string; display_name: string | null; username: string | null }[] }

      const nameMap = new Map((authors || []).map(a => [a.id, a.display_name || a.username || 'Resident']))

      if (!cancelled) {
        setReviews(data.map(r => ({
          ...r,
          authorName: nameMap.get(r.author_id) || 'Resident'
        })))
      }
    }

    load()
    return () => { cancelled = true }
  }, [userId])

  if (reviews === null) {
    return <p className="text-[10px] text-gray-600 font-bold uppercase tracking-widest">Loading reviews…</p>
  }

  if (reviews.length === 0) {
    return <p className="text-[10px] text-gray-600 font-bold uppercase tracking-widest">No reviews yet.</p>
  }

  return (
    <div className="space-y-3">
      {reviews.map(r => (
        <div key={r.id} className="bg-black/40 border border-white/5 rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map(n => (
                <Star key={n} size={12} className={r.rating >= n ? 'text-gold-primary fill-gold-primary' : 'text-gray-700'} />
              ))}
            </div>
            <span className="text-[9px] text-gray-600 font-black uppercase tracking-widest">{r.authorName}</span>
          </div>
          {r.body && <p className="text-xs text-gray-400 leading-relaxed italic">&quot;{r.body}&quot;</p>}
        </div>
      ))}
    </div>
  )
}
