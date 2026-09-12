'use client'

import React from 'react'
import Link from 'next/link'
import { Lock, ShieldCheck, UserPlus } from 'lucide-react'
import Button from './Button'

// Items 175 and 176.
//
// Two states in this app were expressed as an ABSENCE: a guest sees a banner
// on some screens and nothing on others, and an unverified resident simply
// finds that some things are not there. Neither says what is missing, why, or
// how to change it — the feature just is not on the screen, which reads as the
// app being broken or empty rather than as a gate.
//
// "Absence" is the wrong way to express a gate for the same reason the empty
// gossip feed was: the resident cannot tell "there is nothing here" apart from
// "this is not for you yet", and only one of those has an action.

export type GateReason = 'guest' | 'unverified'

const COPY: Record<GateReason, {
  icon: typeof Lock
  title: string
  body: string
  cta: string
  href: string
}> = {
  guest: {
    icon: UserPlus,
    title: 'Sign up to use this',
    // Says what they get, not what they lack. "You must be signed in" is a
    // rule; this is a reason.
    body: 'Guests can read the gossip and browse listings. An account lets you post, message neighbours, and build the trust circle other residents can see.',
    cta: 'Create an account',
    href: '/auth'
  },
  unverified: {
    icon: ShieldCheck,
    title: 'Verify your account to use this',
    // Deliberately does NOT promise a timeframe. The app has no queue it can
    // honestly quote, and inventing "within 24 hours" is the same failure as
    // "it will be reviewed" on a report queue nobody read.
    body: 'Some features stay closed until your account is verified — it is what lets other residents trust who they are dealing with.',
    cta: 'Start verification',
    href: '/dashboard/profile'
  }
}

export default function GatedNotice({
  reason, what, compact = false
}: {
  reason: GateReason
  /** Names the specific thing being gated, e.g. "Posting to the feed". */
  what?: string
  compact?: boolean
}) {
  const c = COPY[reason]
  const Icon = c.icon
  return (
    <div
      className={`glass-panel ${compact ? 'p-4' : 'p-6'} text-center`}
      // A gate is information about the resident's own account state, not a
      // decoration — worth announcing when it appears mid-page.
      role="status"
    >
      <div
        aria-hidden="true"
        className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-accent/10 text-accent flex items-center justify-center"
      >
        <Icon size={22} />
      </div>
      <p className="text-sm font-bold text-content">{what ? `${what} ${reason === 'guest' ? 'needs an account' : 'needs a verified account'}` : c.title}</p>
      <p className="text-xs text-content-muted mt-1.5 max-w-sm mx-auto leading-relaxed">{c.body}</p>
      <Link href={c.href} className="inline-block mt-4">
        <Button variant="secondary" size="sm">{c.cta}</Button>
      </Link>
    </div>
  )
}
