// "3 minutes ago" — the one piece of information a notification row was
// missing entirely. A list of alerts with no times cannot be read as a
// timeline: a water outage from last Tuesday and one from ten minutes ago
// looked identical, and only one of them is worth acting on.
//
// Pure and tested, because the boundaries are where this goes wrong: 59
// seconds, 60 seconds, 23 hours, a date in the future because two devices
// disagree about the clock.

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
const WEEK = 7 * DAY

export function relativeTime(iso: string | null | undefined, now: number = Date.now()): string {
  if (!iso) return ''
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''

  const delta = now - then

  // A timestamp slightly in the future is normal — the server clock and the
  // phone's clock disagree by seconds. Reading "in 4 seconds" on a
  // notification you were just sent looks broken, so anything within a minute
  // either side is simply "just now".
  if (delta < MINUTE && delta > -MINUTE) return 'just now'
  if (delta <= -MINUTE) {
    const days = Math.round(-delta / DAY)
    if (days >= 1) return `in ${days} day${days === 1 ? '' : 's'}`
    const hours = Math.round(-delta / HOUR)
    if (hours >= 1) return `in ${hours} hour${hours === 1 ? '' : 's'}`
    return `in ${Math.round(-delta / MINUTE)} minutes`
  }

  if (delta < HOUR) {
    const m = Math.floor(delta / MINUTE)
    return `${m} minute${m === 1 ? '' : 's'} ago`
  }
  if (delta < DAY) {
    const h = Math.floor(delta / HOUR)
    return `${h} hour${h === 1 ? '' : 's'} ago`
  }
  if (delta < WEEK) {
    const d = Math.floor(delta / DAY)
    return `${d} day${d === 1 ? '' : 's'} ago`
  }
  // Past a week, a date is more use than "37 days ago".
  return new Date(then).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}
