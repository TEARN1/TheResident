'use client'

import React, { useState } from 'react'
import { Loader, Sparkles } from 'lucide-react'
import { startCheckout } from '../../../utils/subscriptions'

const LABEL: Record<'priority' | 'premium' | 'plus', string> = {
  priority: 'Upgrade to Priority — R50/mo',
  premium: 'Upgrade to Premium — R100/mo',
  plus: 'Get Household Plus — R39/mo'
}

export default function UpgradeButton({ tier, className }: { tier: 'priority' | 'premium' | 'plus'; className?: string }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleClick = async () => {
    setLoading(true)
    setError(null)
    const { url, error: checkoutError } = await startCheckout(tier)
    setLoading(false)
    if (checkoutError) { setError(checkoutError); return }
    if (url) window.location.href = url
  }

  return (
    <div className="space-y-1.5">
      <button
        onClick={handleClick}
        disabled={loading}
        className={className || 'w-full flex items-center justify-center gap-2 bg-gold-primary hover:bg-gold-secondary text-black font-black py-2.5 rounded-xl text-xs uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50'}
      >
        {loading ? <Loader size={14} className="animate-spin" /> : <Sparkles size={14} />}
        {loading ? 'Starting checkout…' : LABEL[tier]}
      </button>
      {error && <p className="text-[10px] text-red-400 text-center">{error}</p>}
    </div>
  )
}
