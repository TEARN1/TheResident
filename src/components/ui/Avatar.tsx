'use client'

import React from 'react'

// Item 133. Most residents will never upload a photo, so the fallback is the
// normal case, not the edge case — and every screen was writing its own
// version of it. The one on the gossip feed took a single character; the one
// on the trust circle uppercased differently; one rendered an empty circle
// when the name was missing.

const SIZES = {
  sm: 'w-8 h-8 text-[10px] rounded-lg',
  md: 'w-9 h-9 text-xs rounded-full',
  lg: 'w-16 h-16 text-lg rounded-2xl'
} as const

export type AvatarSize = keyof typeof SIZES

/** First and last initial, at most two letters. Never empty. */
export function initialsFrom(name: string | null | undefined): string {
  const parts = (name || '').replace(/^@/, '').split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export default function Avatar({
  src, name, size = 'md', className
}: {
  src?: string | null
  name?: string | null
  size?: AvatarSize
  className?: string
}) {
  const base = `${SIZES[size]} flex-shrink-0 flex items-center justify-center overflow-hidden font-black`
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        // Decorative: the name is always rendered next to the avatar, and a
        // screen reader announcing it twice is noise, not access.
        alt=""
        className={`${base} object-cover border border-subtle ${className || ''}`.trim()}
      />
    )
  }
  return (
    <div aria-hidden="true" className={`${base} bg-accent/10 text-accent ${className || ''}`.trim()}>
      {initialsFrom(name)}
    </div>
  )
}
