'use client'

import React, { useState } from 'react'
import { ShieldOff, Check } from 'lucide-react'
import { supabase } from '../../../utils/supabase'

interface BlockUserButtonProps {
  targetUserId: string
  currentUserId?: string
  className?: string
}

/**
 * Idempotent block via res_block_user — a simple button with a confirm step
 * so a mis-click doesn't silently block someone.
 */
export default function BlockUserButton({ targetUserId, currentUserId, className }: BlockUserButtonProps) {
  const [confirming, setConfirming] = useState(false)
  const [blocked, setBlocked] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!targetUserId || targetUserId === currentUserId) return null

  if (blocked) {
    return (
      <span className={className || 'flex items-center gap-1 text-[10px] font-bold text-gray-600'}>
        <Check size={12} /> Blocked
      </span>
    )
  }

  const doBlock = async () => {
    if (!supabase) return
    setLoading(true)
    setError(null)
    const { error: rpcError } = await supabase.rpc('res_block_user', { p_blocked: targetUserId })
    setLoading(false)
    if (rpcError) {
      setError(rpcError.message)
      return
    }
    setBlocked(true)
    setConfirming(false)
  }

  if (confirming) {
    return (
      <span className="inline-flex items-center gap-2">
        <button
          type="button"
          onClick={doBlock}
          disabled={loading}
          className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500 hover:text-white transition-all disabled:opacity-50"
        >
          {loading ? 'Blocking…' : 'Confirm block'}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="text-[10px] text-gray-500 hover:text-gray-300"
        >
          Cancel
        </button>
        {error && <span className="text-[10px] text-red-400">{error}</span>}
      </span>
    )
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      className={className || 'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest bg-white/5 text-gray-400 border border-white/10 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20 transition-all'}
    >
      <ShieldOff size={12} /> Block
    </button>
  )
}
