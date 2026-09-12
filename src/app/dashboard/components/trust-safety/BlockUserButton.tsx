'use client'

import React, { useState } from 'react'
import { ShieldOff, Check } from 'lucide-react'
import { supabase } from '../../../../utils/supabase'

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
      <span className={className || 'flex items-center gap-1 text-xs font-bold text-content-subtle'}>
        <Check size={12} /> Blocked
      </span>
    )
  }

  const doBlock = async () => {
    if (!supabase) return
    setLoading(true)
    // try/finally so the loading flag resolves on EVERY path. Without it a
    // rejected request skipped the setter at the end of the function and the
    // spinner stayed on screen for the rest of the session — see the Messages
    // page, where that was measured.
    try {
      setError(null)
      const { error: rpcError } = await supabase.rpc('res_block_user', { p_blocked: targetUserId })
      setLoading(false)
      if (rpcError) {
        setError(rpcError.message)
        return
      }
      setBlocked(true)
      setConfirming(false)

    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  if (confirming) {
    return (
      <span className="inline-flex items-center gap-2">
        <button
          type="button"
          onClick={doBlock}
          disabled={loading}
          className="min-h-[44px] inline-flex items-center justify-center px-2.5 py-1 rounded-lg text-xs font-black uppercase tracking-widest bg-danger/10 text-danger border border-danger/20 hover:bg-danger hover:text-content transition-all disabled:opacity-50"
        >
          {loading ? 'Blocking…' : 'Confirm block'}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="text-xs text-content-muted hover:text-content"
        >
          Cancel
        </button>
        {error && <span className="text-xs text-danger">{error}</span>}
      </span>
    )
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      className={className || 'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-black uppercase tracking-widest bg-surface-raised/5 text-content-muted border border-default hover:bg-danger/10 hover:text-danger hover:border-danger/20 transition-all'}
    >
      <ShieldOff size={12} /> Block
    </button>
  )
}
