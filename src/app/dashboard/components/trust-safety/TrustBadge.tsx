'use client'

import React, { useEffect, useState } from 'react'
import { ShieldCheck, Star, Sparkles, Award } from 'lucide-react'
import { getTrustInfo, type TrustInfo } from '../../../../utils/trust'

/**
 * Trust signal for stranger-facing surfaces (rent tool, apply to room, book
 * lift): real server-side reputation tier + verified badge. Deliberately has
 * nothing to do with the next-of-kin trust circle or follows/mutual_follows —
 * see src/utils/social.ts for why those stay separate.
 */
export default function TrustBadge({ userId, compact = false }: { userId: string; compact?: boolean }) {
  const [info, setInfo] = useState<TrustInfo | null>(null)

  useEffect(() => {
    let cancelled = false
    if (!userId) return
    getTrustInfo(userId).then(result => { if (!cancelled) setInfo(result) })
    return () => { cancelled = true }
  }, [userId])

  if (!info) return null

  return (
    <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-gray-400">
      {info.isVerified && (
        <span className="inline-flex items-center gap-0.5 text-gold-primary" title="Verified resident">
          <ShieldCheck size={11} /> {!compact && 'Verified'}
        </span>
      )}
      <span className="inline-flex items-center gap-0.5" title={`${info.reputationScore} reputation points`}>
        <Star size={11} className="text-gold-primary" /> {info.reputationTier}
      </span>
      {typeof info.vibeScore === 'number' && (
        <span className="inline-flex items-center gap-0.5 text-purple-400" title={`${info.vibeScore} Gruvs vibe score`}>
          <Sparkles size={11} /> {info.vibeScore}{!compact && ' vibe'}
        </span>
      )}
      {info.badges.length > 0 && !compact && (
        <span className="inline-flex items-center gap-0.5 text-gray-400" title={info.badges.join(', ')}>
          <Award size={11} className="text-gold-primary" /> {info.badges.length}
        </span>
      )}
    </span>
  )
}
