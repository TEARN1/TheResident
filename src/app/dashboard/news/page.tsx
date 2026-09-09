import { redirect } from 'next/navigation'

/**
 * The feed was briefly at /dashboard/news before moving back to
 * /dashboard/gossip. This redirect exists only so anything that captured the
 * short-lived URL — a bookmark, a shared message, the installed PWA's cached
 * shell — does not 404. It can be deleted once that is no longer a concern.
 */
export default function NewsRedirect() {
  redirect('/dashboard/gossip')
}
