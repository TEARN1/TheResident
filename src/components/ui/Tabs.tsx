'use client'

import React from 'react'

// Items 135 and 136. Tabs are reimplemented on the community, housing,
// services and profile screens, each with its own active treatment, and none
// of them is reachable by keyboard as a tab list — they are rows of buttons
// that look like tabs.
//
// This uses the real roving-tabindex pattern: one stop in the tab order,
// arrow keys move between tabs. That is what a screen reader announces as a
// tab list, and what a keyboard user expects once they land on one.

export interface TabItem {
  id: string
  label: string
  icon?: React.ReactNode
  /** Shown as a count bubble — unread messages, pending requests. */
  count?: number
}

export default function Tabs({
  items, active, onChange, label, className
}: {
  items: TabItem[]
  active: string
  onChange: (id: string) => void
  /** Names the tab list for screen readers. Required, not optional. */
  label: string
  className?: string
}) {
  const move = (dir: 1 | -1) => {
    const i = items.findIndex(t => t.id === active)
    if (i < 0) return
    // Wraps, because stopping dead at the end of a tab list is a dead end the
    // user has no way to see coming.
    const next = items[(i + dir + items.length) % items.length]
    onChange(next.id)
  }

  return (
    <div
      role="tablist"
      aria-label={label}
      className={`flex gap-1 overflow-x-auto custom-scrollbar ${className || ''}`.trim()}
      onKeyDown={e => {
        if (e.key === 'ArrowRight') { e.preventDefault(); move(1) }
        if (e.key === 'ArrowLeft') { e.preventDefault(); move(-1) }
      }}
    >
      {items.map(t => {
        const selected = t.id === active
        return (
          <button
            key={t.id}
            role="tab"
            type="button"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(t.id)}
            className={`flex items-center gap-1.5 min-h-[44px] px-3 rounded-xl whitespace-nowrap
              text-xs font-black uppercase tracking-widest transition-all
              ${selected
                ? 'bg-accent/15 text-accent border border-accent/30'
                : 'text-content-muted border border-transparent hover:text-content hover:bg-surface-sunken/60'}`}
          >
            {t.icon}
            {t.label}
            {typeof t.count === 'number' && t.count > 0 && (
              <span className="ml-0.5 px-1.5 py-0.5 rounded-full bg-accent text-content-on-accent text-[9px] leading-none">
                {t.count > 99 ? '99+' : t.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

/**
 * Two or three mutually exclusive choices that are not navigation — "Rent or
 * buy", "All / Mine / Nearby". Visually a single control rather than separate
 * buttons, so it reads as one decision.
 */
export function SegmentedControl<T extends string>({
  options, value, onChange, label
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
  label: string
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="inline-flex p-1 rounded-xl bg-surface-sunken/60 border border-subtle"
    >
      {options.map(o => {
        const selected = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(o.value)}
            className={`min-h-[44px] px-4 rounded-lg text-xs font-black uppercase tracking-widest transition-all
              ${selected ? 'bg-accent text-content-on-accent' : 'text-content-muted hover:text-content'}`}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
