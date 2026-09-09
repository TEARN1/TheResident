import { redirect } from 'next/navigation'

/**
 * The feed moved from /dashboard/gossip to /dashboard/news.
 *
 * This redirect stays. No stored notification deep-links pointed here when the
 * rename happened (checked: 0 of 108), but bookmarks, the installed PWA's
 * cached shell, and anything a resident has shared in a message do not update
 * themselves. A 404 on a link someone tapped is a worse outcome than one file.
 */
export default function GossipRedirect() {
  redirect('/dashboard/news')
}
