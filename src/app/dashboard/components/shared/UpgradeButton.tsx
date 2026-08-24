'use client'

import React, { useState } from 'react'
import { Loader, Sparkles } from 'lucide-react'
import { startCheckout } from '../../../../utils/subscriptions'
import { PRICING, formatPrice } from '../../../../utils/pricing'

type SelfServeItem = 'priority' | 'premium' | 'plus' | 'verification_speedup' | 'market_boost' | 'room_boost' | 'notice_boost' | 'notice_extend_visibility'

const ACTION_VERB: Record<SelfServeItem, string> = {
  priority: 'Upgrade to',
  premium: 'Upgrade to',
  plus: 'Get',
  verification_speedup: 'Buy',
  market_boost: 'Buy',
  room_boost: 'Buy',
  notice_boost: 'Buy',
  notice_extend_visibility: 'Buy'
}

export default function UpgradeButton({ item, targetId, className }: { item: SelfServeItem; targetId?: string; className?: string }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleClick = async () => {
    setLoading(true)
    setError(null)
    const { url, error: checkoutError } = await startCheckout(item, targetId)
    setLoading(false)
    if (checkoutError) { setError(checkoutError); return }
    if (url) window.location.href = url
  }

  const label = `${ACTION_VERB[item]} ${PRICING[item].label} — ${formatPrice(item)}`

  return (
    <div className="space-y-1.5">
      <button
        onClick={handleClick}
        disabled={loading}
        className={className || 'w-full flex items-center justify-center gap-2 bg-gold-primary hover:bg-gold-secondary text-black font-black py-2.5 rounded-xl text-xs uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50'}
      >
        {loading ? <Loader size={14} className="animate-spin" /> : <Sparkles size={14} />}
        {loading ? 'Starting checkout…' : label}
      </button>
      {error && <p className="text-[10px] text-red-400 text-center">{error}</p>}
    </div>
  )
}
