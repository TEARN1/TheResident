'use client'

import React from 'react'
import type { LucideIcon } from 'lucide-react'

interface Props {
  icon: LucideIcon
  title: string
  subtitle?: string
  action?: React.ReactNode
  compact?: boolean
}

// One shared shape for "nothing here yet" — previously every page hand-rolled
// its own version with a different icon size, a different opacity, and a
// different tone of copy (some technical, some warm), so the app read as
// several products stitched together rather than one.
export default function EmptyState({ icon: Icon, title, subtitle, action, compact = false }: Props) {
  return (
    <div className={`text-center text-gray-500 ${compact ? 'py-8' : 'py-12'}`}>
      <Icon size={compact ? 32 : 48} className="mx-auto mb-4 opacity-10" />
      <p className="text-sm font-bold text-gray-400">{title}</p>
      {subtitle && <p className="text-xs text-gray-600 mt-1">{subtitle}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
