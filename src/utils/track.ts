// Funnel tracking: a handful of named steps written to analytics_events (the
// table The Gruvs already uses), tagged platform 'resident' so the two apps'
// numbers never mix. No third-party script, no cookies, no personal data in
// props: just "how many visits became signups, listings and applications".
//
// The table's insert policy allows user_id null or your own id, and there is
// no select policy, so nobody can read the rows back except through the
// admin-only res_funnel_summary() function.

import { supabase } from './supabase'

export type FunnelEvent =
  | 'visit'
  | 'signup'
  | 'listing_created'
  | 'apply_sent'
  | 'share_whatsapp'
  | 'room_page_view'
  | 'concierge_click'

const SESSION_KEY = 'resident-analytics-session'

function sessionId(): string | null {
  try {
    if (typeof window === 'undefined') return null
    let id = window.sessionStorage.getItem(SESSION_KEY)
    if (!id) {
      id = crypto.randomUUID()
      window.sessionStorage.setItem(SESSION_KEY, id)
    }
    return id
  } catch {
    return null
  }
}

/** Props must be small and non-personal (ids, area names, counts). */
export function track(event: FunnelEvent, props: Record<string, string | number | boolean | null> = {}, userId?: string | null): void {
  if (!supabase || typeof window === 'undefined') return
  // Real auth ids only: the guest placeholder id isn't a Supabase user, and
  // the insert policy would reject it.
  const user_id = userId && /^[0-9a-f-]{36}$/i.test(userId) && !userId.startsWith('00000000') ? userId : null
  void supabase
    .from('analytics_events')
    .insert({ event, props, user_id, session_id: sessionId(), platform: 'resident' })
    .then(({ error }) => {
      if (error && process.env.NODE_ENV !== 'production') console.warn('track failed', event, error.message)
    })
}

/** 'visit' once per browser tab session, however many pages are opened. */
export function trackVisitOnce(props: Record<string, string | number | boolean | null> = {}): void {
  try {
    if (typeof window === 'undefined' || window.sessionStorage.getItem('resident-visit-tracked')) return
    window.sessionStorage.setItem('resident-visit-tracked', '1')
  } catch {
    return
  }
  track('visit', props)
}
