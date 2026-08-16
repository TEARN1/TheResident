// Realtime + the shared notifications rail.
//
// Two things existed and were never used:
//   - No res_* table was in the supabase_realtime publication, so the app could
//     only ever take a one-shot snapshot at login and never saw another change.
//   - The `notifications` table and its push-notify edge function were live, and
//     The Resident had never inserted a single row. The bell was Redux-only, so
//     nothing survived a refresh.
// Both are wired here.

import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '../utils/supabase'
import type { AppDispatch } from './index'
import { fetchSupabaseData, setNotifications } from './index'

export interface DbNotification {
  id: string
  type: string
  title: string
  body: string
  read: boolean
  createdAt: string
  data: Record<string, unknown>
}

/**
 * #45.3 — the bell now reads the shared table, so notifications survive a
 * refresh and follow the user across devices (and across The Gruvs).
 */
export const loadNotifications = async (dispatch: AppDispatch) => {
  if (!supabase) return
  const { data, error } = await supabase
    .from('notifications')
    .select('id, type, title, body, message, read, is_read, created_at, data')
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) {
    console.error('Failed to load notifications:', error.message)
    return
  }

  dispatch(setNotifications((data || []).map(n => ({
    id: String(n.id),
    title: n.title || 'Notification',
    message: n.body || n.message || '',
    read: !!(n.read ?? n.is_read),
    timestamp: n.created_at || new Date().toISOString()
  }))))
}

/** #45.5 — mark-as-read writes back to the shared table, not just local state. */
export const markNotificationsReadInDb = async () => {
  if (!supabase) return
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  await supabase.from('notifications').update({ read: true }).eq('recipient_id', user.id).eq('read', false)
}

/**
 * #44 — subscribe to the tables whose changes matter while the app is open.
 * Returns an unsubscribe function; the caller MUST call it on unmount, or the
 * channels leak.
 */
export const subscribeToRealtime = (dispatch: AppDispatch, userId: string): (() => void) => {
  if (!supabase) return () => {}

  const channels: RealtimeChannel[] = []

  // #44.2 — a change merges into the store via one targeted refetch rather than
  // re-pulling all 21 tables per event. Debounced so a burst is one fetch.
  let pending: ReturnType<typeof setTimeout> | null = null
  const refetchSoon = () => {
    if (pending) clearTimeout(pending)
    pending = setTimeout(() => {
      dispatch(fetchSupabaseData())
      pending = null
    }, 400)
  }

  const content = supabase
    .channel('res-content')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'res_notice_events' }, refetchSoon)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'res_listings' }, refetchSoon)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'res_market_items' }, refetchSoon)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'res_lift_clubs' }, refetchSoon)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'res_tool_library' }, refetchSoon)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'res_utility_tokens' }, refetchSoon)
    .subscribe()
  channels.push(content)

  // #44.5 — alerts stay subscribed app-wide, not per-tab. Safety is the one
  // thing that must reach you regardless of what you are looking at.
  const safety = supabase
    .channel('res-safety')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'res_alerts' }, refetchSoon)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'res_neighbourhood_status' }, refetchSoon)
    // Faults ride the safety channel deliberately. Watching the confirmation
    // count climb is what prompts the next neighbour to vouch, and a fault
    // that only updates on a tab change would lose that entirely.
    .on('postgres_changes', { event: '*', schema: 'public', table: 'res_faults' }, refetchSoon)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'res_fault_vouches' }, refetchSoon)
    .subscribe()
  channels.push(safety)

  // The shared notifications rail — only rows addressed to this user.
  const notifs = supabase
    .channel('res-notifications')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'notifications', filter: `recipient_id=eq.${userId}` },
      () => { loadNotifications(dispatch) }
    )
    .subscribe()
  channels.push(notifs)

  // #44.3 — unsubscribe, or the channels leak on every tab change.
  return () => {
    if (pending) clearTimeout(pending)
    channels.forEach(ch => { supabase!.removeChannel(ch) })
  }
}
