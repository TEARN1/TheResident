'use client'

import React, { useEffect, useState } from 'react'
import { ShieldAlert } from 'lucide-react'
import { getNextOfKinStatus } from '../../../../utils/trust'
import { supabase } from '../../../../utils/supabase'

/**
 * Landlord/admin-facing flag only — separate from TrustBadge (stranger-
 * facing reputation) by design, since Next of Kin is a safety/onboarding
 * requirement, not a reputation signal. Only ever renders something when
 * the applicant is actually overdue (past their 6-month grace window with
 * no confirmed trust connection); silent otherwise, including while still
 * inside the grace period, so this doesn't read as a warning against every
 * new tenant.
 */
export default function NextOfKinFlag({ userId }: { userId: string }) {
  const [overdue, setOverdue] = useState(false)

  useEffect(() => {
    let cancelled = false
    if (!userId || !supabase) return
    supabase.from('res_profiles').select('created_at').eq('id', userId).maybeSingle()
      .then(({ data }) => getNextOfKinStatus(userId, data?.created_at))
      .then(status => { if (!cancelled) setOverdue(status.overdue) })
    return () => { cancelled = true }
  }, [userId])

  if (!overdue) return null

  return (
    <span
      className="inline-flex items-center gap-1 text-[10px] font-bold text-red-400"
      title="This applicant hasn't added a Next of Kin within their 6-month window"
    >
      <ShieldAlert size={11} /> Trust profile incomplete
    </span>
  )
}
