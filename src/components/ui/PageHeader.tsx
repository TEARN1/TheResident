'use client'

import React from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

// Items 148 and 149. Every screen invents its own header today: some have a
// title and no subtitle, some put the action above the title, and the ones
// with back navigation each style the arrow differently.

export function SectionHeader({
  title, subtitle, action, className
}: {
  title: string
  subtitle?: string
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div className={`flex items-start justify-between gap-3 mb-4 ${className || ''}`.trim()}>
      <div className="min-w-0">
        <h2 className="text-sm font-black uppercase tracking-widest text-content-subtle">{title}</h2>
        {subtitle && <p className="text-xs text-content-muted mt-1 leading-relaxed">{subtitle}</p>}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  )
}

export default function PageHeader({
  title, subtitle, backHref, backLabel = 'Back', action
}: {
  title: string
  subtitle?: string
  backHref?: string
  backLabel?: string
  action?: React.ReactNode
}) {
  return (
    <div className="space-y-3">
      {backHref && (
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 min-h-[44px] text-xs font-bold text-content-muted hover:text-content"
        >
          <ArrowLeft size={14} aria-hidden="true" /> {backLabel}
        </Link>
      )}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {/* One <h1> per page, and it always has text — the dashboard used to
              hide its heading text below 1024px, leaving a screen reader to
              announce "heading level one" and then nothing. */}
          <h1 className="text-xl font-bold text-content break-words">{title}</h1>
          {subtitle && <p className="text-xs text-content-muted mt-1 leading-relaxed">{subtitle}</p>}
        </div>
        {action && <div className="flex-shrink-0">{action}</div>}
      </div>
    </div>
  )
}
