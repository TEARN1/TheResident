'use client'

import React from 'react'
import type { LucideIcon } from 'lucide-react'
import { SearchX, WifiOff, AlertTriangle } from 'lucide-react'

// One shared shape for "there is nothing to show" — previously every page
// hand-rolled its own, with a different icon size, a different opacity and a
// different tone of copy, so the app read as several products stitched
// together.
//
// ITEM 165 is the substantive change here. "Nothing yet", "nothing matches
// your filter" and "we could not load this" were all rendering identically,
// and they are three different situations needing three different responses:
// the first wants encouragement to create something, the second wants the
// filter cleared, the third wants a retry. Telling a resident "No listings
// yet" when the fetch actually failed is the app lying about its own state —
// the same class of problem as the panic alert that reached nobody.
//
// ITEM 168: the icon used to render at opacity-10, which on a light surface
// is very nearly invisible — the thing meant to make an empty state look
// designed was effectively not drawn. It now sits in a tinted disc, toned to
// the variant, at a legible weight.

export type EmptyVariant = 'empty' | 'filtered' | 'error' | 'offline'

interface Props {
  /** Optional for every variant but 'empty', which has no sensible default. */
  icon?: LucideIcon
  title: string
  subtitle?: string
  action?: React.ReactNode
  compact?: boolean
  variant?: EmptyVariant
}

const FALLBACK_ICON: Record<EmptyVariant, LucideIcon | null> = {
  empty: null,
  filtered: SearchX,
  error: AlertTriangle,
  offline: WifiOff
}

const TONE: Record<EmptyVariant, string> = {
  empty: 'bg-accent/10 text-accent',
  filtered: 'bg-info/10 text-info',
  error: 'bg-danger/10 text-danger',
  offline: 'bg-warning/10 text-warning'
}

export default function EmptyState({
  icon, title, subtitle, action, compact = false, variant = 'empty'
}: Props) {
  const Icon = icon || FALLBACK_ICON[variant]
  return (
    <div
      className={`text-center ${compact ? 'py-8' : 'py-12'} px-4`}
      // An error or an offline state is a change the resident needs told
      // about, not just shown — a list that quietly swaps to "couldn't load"
      // while someone is looking elsewhere is a silent failure.
      role={variant === 'error' || variant === 'offline' ? 'status' : undefined}
    >
      {Icon && (
        <div
          aria-hidden="true"
          className={`w-14 h-14 mx-auto mb-4 rounded-2xl flex items-center justify-center ${TONE[variant]}`}
        >
          <Icon size={compact ? 22 : 26} />
        </div>
      )}
      <p className="text-sm font-bold text-content">{title}</p>
      {subtitle && (
        <p className="text-xs text-content-muted mt-1.5 max-w-xs mx-auto leading-relaxed">{subtitle}</p>
      )}
      {/* Item 166: an empty state with no next action is a dead end. Every
          variant should offer one — create the first thing, clear the filter,
          try again — and the call site is what knows which. */}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  )
}
