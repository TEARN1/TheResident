'use client'

import React, { useState } from 'react'
import { Download } from 'lucide-react'
import { supabase } from '../../../../utils/supabase'
import { withTimeout } from '../../../../utils/resilientCall'

/**
 * POPIA section 23: a resident may have a copy of what we hold about them.
 * Deletion already had a button; access did not. The work is done by
 * res_export_my_data() (section 50), which returns only rows the caller owns
 * and never reveals who has blocked them. This only saves the result.
 */
export default function DownloadMyDataButton() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const download = async () => {
    if (!supabase) return
    setBusy(true)
    setError(null)
    try {
      const { data, error: rpcError } = await withTimeout(
        supabase.rpc('res_export_my_data'), 30000, 'data export')
      if (rpcError) throw rpcError
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const href = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = href
      a.download = `the-resident-my-data-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(href)
    } catch (e) {
      setError(e instanceof Error && e.message.includes('rate_limit')
        ? 'You have downloaded your data several times this hour. Try again later.'
        : 'Could not prepare your data. Try again, or contact support.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={download}
        disabled={busy}
        className="w-full min-h-[44px] flex items-center justify-center gap-2 text-content-muted hover:text-content font-bold py-2 text-xs uppercase tracking-widest transition-all disabled:opacity-50"
      >
        <Download size={14} /> {busy ? 'Preparing…' : 'Download my data'}
      </button>
      {error && <p className="text-xs text-danger text-center">{error}</p>}
    </div>
  )
}
