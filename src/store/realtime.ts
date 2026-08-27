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
import { fetchRealtimeTable, setNotifications, type RealtimeTable } from './index'
import { shouldDeliver } from '../utils/logic'
import { playNotificationSound } from '../utils/notificationSounds'

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
    timestamp: n.created_at || new Date().toISOString(),
    type: n.type || undefined
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

  // Loaded once per subscription (i.e. once per dashboard session) rather
  // than re-fetched per notification — matches NotificationPrefsPanel's own
  // load-once-per-mount behaviour, and a new notification arriving is rare
  // enough that this doesn't need to be perfectly live against a prefs
  // change made in another tab.
  let soundPrefs = { mutedTypes: [] as string[], quietHoursStart: null as number | null, quietHoursEnd: null as number | null }
  supabase
    .from('res_notification_prefs')
    .select('muted_types, quiet_hours_start, quiet_hours_end')
    .eq('user_id', userId)
    .maybeSingle()
    .then(({ data }) => {
      if (data) {
        soundPrefs = {
          mutedTypes: data.muted_types || [],
          quietHoursStart: data.quiet_hours_start ?? null,
          quietHoursEnd: data.quiet_hours_end ?? null
        }
      }
    })

  // #44.2 — a change merges into the store via a targeted refetch of just the
  // table that changed, not all 23 tables per event (fetchSupabaseData was
  // costing every connected client a full reload on any single row edit
  // anywhere). Debounced per table so a burst on one table is one fetch.
  const pending: Partial<Record<RealtimeTable, ReturnType<typeof setTimeout>>> = {}
  const refetchSoon = (table: RealtimeTable) => () => {
    if (pending[table]) clearTimeout(pending[table])
    pending[table] = setTimeout(() => {
      dispatch(fetchRealtimeTable(table))
      delete pending[table]
    }, 400)
  }

  const content = supabase
    .channel('res-content')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'res_notice_events' }, refetchSoon('res_notice_events'))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'res_listings' }, refetchSoon('res_listings'))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'res_market_items' }, refetchSoon('res_market_items'))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'res_lift_clubs' }, refetchSoon('res_lift_clubs'))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'res_tool_library' }, refetchSoon('res_tool_library'))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'res_utility_tokens' }, refetchSoon('res_utility_tokens'))
    .subscribe()
  channels.push(content)

  // #44.5 — alerts stay subscribed app-wide, not per-tab. Safety is the one
  // thing that must reach you regardless of what you are looking at.
  const safety = supabase
    .channel('res-safety')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'res_alerts' }, refetchSoon('res_alerts'))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'res_neighbourhood_status' }, refetchSoon('res_neighbourhood_status'))
    .subscribe()
  channels.push(safety)

  // The shared notifications rail — only rows addressed to this user.
  const notifs = supabase
    .channel('res-notifications')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'notifications', filter: `recipient_id=eq.${userId}` },
      (payload: { new?: { type?: string } }) => {
        const type = payload.new?.type
        if (type && shouldDeliver(type, soundPrefs)) {
          playNotificationSound(type)
        }
        loadNotifications(dispatch)
      }
    )
    .subscribe()
  channels.push(notifs)

  // #44.3 — unsubscribe, or the channels leak on every tab change.
  return () => {
    Object.values(pending).forEach(t => clearTimeout(t))
    channels.forEach(ch => { supabase!.removeChannel(ch) })
  }
}
