import { supabase } from './supabase'

/**
 * Reads of the Gruvs-owned `events` table (CONTRACT.md §8) all go through here.
 *
 * That table carries THREE date-ish columns — `starts_at`, `date_time` and
 * `event_date` — and only `event_date` is ever populated: on the live project
 * it's set on all 196 rows while `starts_at` and `date_time` are null on every
 * single one. Every event picker in this app queried `starts_at`, so all of
 * them (guest-house "near which event", community event notices, lift clubs)
 * silently rendered an empty list forever, with no error to notice.
 *
 * Reading through one helper means that mismatch can only ever be wrong in one
 * place, instead of being re-derived — and re-broken — at each call site.
 */
export interface GruvsEvent {
  id: string
  title: string
  /**
   * Local wall-clock ISO string built from `event_date` + optional `event_time`
   * ('HH:MM' text, or null for an all-day/time-TBC event). Deliberately NOT
   * UTC-normalised: these are South African local event times, and the display
   * layer formats them as-is.
   */
  startsAt: string
}

const toStartsAt = (eventDate: string, eventTime: string | null): string =>
  eventTime && /^\d{2}:\d{2}/.test(eventTime) ? `${eventDate}T${eventTime.slice(0, 5)}` : eventDate

/**
 * Formats a `startsAt` from above for display. Many Gruvs events have no
 * `event_time` at all, and blindly formatting those with hour/minute renders a
 * confident "12:00 AM" that the source data never actually claimed — so a
 * date-only event is shown as a date only.
 */
export function formatGruvsEventWhen(startsAt: string, opts: { long?: boolean } = {}): string {
  const hasTime = startsAt.includes('T')
  const d = new Date(startsAt)
  if (Number.isNaN(d.getTime())) return startsAt
  return d.toLocaleString(undefined, {
    weekday: opts.long ? 'short' : undefined,
    month: 'short',
    day: 'numeric',
    ...(hasTime ? { hour: '2-digit' as const, minute: '2-digit' as const } : {})
  })
}

interface EventRow {
  id: string
  title: string
  event_date: string
  event_time: string | null
}

const SELECT = 'id, title, event_date, event_time'

/** Upcoming, non-deleted events, soonest first. */
export async function fetchUpcomingGruvsEvents(limit = 20): Promise<GruvsEvent[]> {
  if (!supabase) return []
  // Compares against a plain YYYY-MM-DD because event_date is a DATE, not a
  // timestamp — passing a full ISO string here silently matches nothing.
  const today = new Date().toISOString().slice(0, 10)
  const { data } = await supabase
    .from('events')
    .select(SELECT)
    .is('deleted_at', null)
    .gte('event_date', today)
    .order('event_date', { ascending: true })
    .limit(limit)
  return ((data || []) as EventRow[]).map(e => ({
    id: e.id,
    title: e.title,
    startsAt: toStartsAt(e.event_date, e.event_time)
  }))
}

/** Look up specific events by id — for records that already reference one. */
export async function fetchGruvsEventsByIds(
  ids: string[]
): Promise<Record<string, { title: string; startsAt: string }>> {
  if (!supabase || ids.length === 0) return {}
  const { data } = await supabase.from('events').select(SELECT).in('id', ids)
  return Object.fromEntries(
    ((data || []) as EventRow[]).map(e => [
      e.id,
      { title: e.title, startsAt: toStartsAt(e.event_date, e.event_time) }
    ])
  )
}
