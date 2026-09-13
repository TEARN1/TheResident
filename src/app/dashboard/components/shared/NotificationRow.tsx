'use client'

import React from 'react'
import {
  AlertTriangle, MessageCircle, Home, Wrench, Users, Bell, Check, ChevronRight
} from 'lucide-react'
import { relativeTime } from '../../../../utils/relativeTime'
import type { AppNotification } from '../../../../store'

// Items 142 and 110.
//
// The old row had three problems, and the third is the one that matters.
//
// 1. NO TIME. A list of alerts without times cannot be read as a timeline —
//    a water outage from last Tuesday and one from ten minutes ago looked
//    identical, and only one of them is worth getting up for.
//
// 2. UNREAD WAS CARRIED BY OPACITY AND A TINT. Colour and dimming alone
//    (item 38), which is exactly what a colour-blind resident or anyone in
//    sunlight cannot see. There is a dot now, and the accessible name says
//    "unread" in words.
//
// 3. ONLY ROWS WITH A DESTINATION WERE TAPPABLE. Everything else was an inert
//    div: you could not dismiss it, mark it read, or interact with it at all.
//    Most notifications in this app have no action_url, so most of the list
//    did nothing when touched — which reads as the app being broken rather
//    than as the row being informational.

/** Icon by notification family. Falls back to a bell rather than nothing. */
function iconFor(type: string | undefined) {
  if (!type) return Bell
  if (type.includes('panic') || type.includes('alert')) return AlertTriangle
  if (type.includes('message')) return MessageCircle
  if (type.includes('room') || type.includes('listing') || type.includes('housing')) return Home
  if (type.includes('dispatch') || type.includes('service') || type.includes('maintenance')) return Wrench
  if (type.includes('community') || type.includes('follow') || type.includes('org')) return Users
  return Bell
}

export default function NotificationRow({
  item, onOpen, onMarkRead
}: {
  item: AppNotification
  /** Only called for rows that have somewhere to go. */
  onOpen: (n: AppNotification) => void
  onMarkRead: (n: AppNotification) => void
}) {
  const Icon = iconFor(item.type)
  const when = relativeTime(item.timestamp)
  const hasDestination = !!item.actionUrl
  const urgent = !!item.type && (item.type.includes('panic') || item.type.includes('alert'))

  // Every row is a button. One navigates, the other marks itself read — but
  // both respond, which is the point. An informational row that ignores a tap
  // is indistinguishable from a broken one.
  const label = [
    item.read ? '' : 'Unread.',
    item.title,
    when,
    hasDestination ? 'Opens details.' : 'Marks as read.'
  ].filter(Boolean).join(' ')

  return (
    <button
      type="button"
      aria-label={label}
      onClick={() => (hasDestination ? onOpen(item) : onMarkRead(item))}
      className={`w-full text-left min-h-[44px] p-3 rounded-xl border flex items-start gap-3
        motion-base transition-colors
        ${item.read
          ? 'bg-surface-sunken/30 border-subtle'
          : 'bg-accent/5 border-accent/20 hover:border-accent/40'}`}
    >
      <span
        aria-hidden="true"
        className={`mt-0.5 w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0
          ${urgent ? 'bg-danger/10 text-danger' : 'bg-accent/10 text-accent'}`}
      >
        <Icon size={14} />
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          {/* A shape, not just a tint — item 38. */}
          {!item.read && (
            <span aria-hidden="true" className="w-1.5 h-1.5 rounded-full bg-accent flex-shrink-0" />
          )}
          <span className="text-xs font-black text-content uppercase tracking-tight break-words">
            {item.title}
          </span>
        </span>
        {item.message && (
          <span className="block text-xs text-content-muted mt-1 break-words">{item.message}</span>
        )}
        {when && <span className="block text-[10px] text-content-subtle mt-1">{when}</span>}
      </span>

      <span aria-hidden="true" className="text-content-subtle flex-shrink-0 mt-0.5">
        {hasDestination ? <ChevronRight size={14} /> : (!item.read && <Check size={14} />)}
      </span>
    </button>
  )
}
