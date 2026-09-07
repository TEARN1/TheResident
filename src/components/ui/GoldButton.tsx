'use client'

import React from 'react'

// The gold-outline CTA ("bg-accent/10 hover:bg-accent
// hover:text-content-on-accent border border-accent/30 …") was hand-copied across
// 8+ call sites (Profile, Housing, NoticeBoardTab, VibeMap, SafetyTab) with
// only padding/width drifting between them — this is that button, extracted
// once so future call sites stop re-typing it and any future style tweak
// only needs to happen here.
export function goldButtonClass(opts: { size?: 'sm' | 'md'; fullWidth?: boolean } = {}): string {
  const { size = 'md', fullWidth = false } = opts
  const padding = size === 'sm' ? 'px-3 py-2 text-[10px]' : 'px-4 py-2.5 text-xs'
  return [
    fullWidth ? 'w-full' : '',
    'flex items-center justify-center gap-2',
    'bg-accent/10 hover:bg-accent hover:text-content-on-accent',
    'border border-accent/30 text-accent',
    'font-black rounded-xl uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50',
    padding
  ].filter(Boolean).join(' ')
}

interface GoldButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  size?: 'sm' | 'md'
  fullWidth?: boolean
}

export default function GoldButton({ size, fullWidth, className, children, ...rest }: GoldButtonProps) {
  return (
    <button className={className || goldButtonClass({ size, fullWidth })} {...rest}>
      {children}
    </button>
  )
}
