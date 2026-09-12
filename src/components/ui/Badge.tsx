'use client'

import React from 'react'

// Item 134, and item 38 with it: never colour alone. A badge takes an icon
// precisely so that "urgent" is not distinguishable from "resolved" only by
// being red — which is how several status pills in this app currently work,
// and which is invisible to a colour-blind resident and to anyone reading a
// phone in the sun.

export type BadgeTone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info'

const TONES: Record<BadgeTone, string> = {
  neutral: 'bg-surface-sunken/60 text-content-muted border-subtle',
  accent:  'bg-accent/10 text-accent border-accent/20',
  success: 'bg-success/10 text-success border-success/20',
  warning: 'bg-warning/10 text-warning border-warning/20',
  danger:  'bg-danger/10 text-danger border-danger/20',
  info:    'bg-info/10 text-info border-info/20'
}

export default function Badge({
  tone = 'neutral', icon, children, className
}: {
  tone?: BadgeTone
  icon?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-[10px] font-black uppercase tracking-widest ${TONES[tone]} ${className || ''}`.trim()}
    >
      {icon}
      {children}
    </span>
  )
}
