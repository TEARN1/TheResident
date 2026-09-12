'use client'

import React from 'react'

// Items 169 and 170.
//
// A bare spinner tells a resident "something is happening" and nothing else.
// A skeleton in the shape of the content tells them what is about to arrive
// and stops the page jumping when it does — this app currently renders a
// centred spinner and then a full list, so every screen reflows on load.
//
// The shimmer is guarded by prefers-reduced-motion in globals.css; the shapes
// remain, so nothing is lost for someone who asked for less movement.

export function SkeletonLine({ width = '100%', className }: { width?: string; className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`skeleton h-3 rounded-md ${className || ''}`.trim()}
      style={{ width }}
    />
  )
}

/**
 * A stand-in for one list row: avatar, a title line, a shorter detail line.
 * Matches the shape of the gossip, messages and listing rows closely enough
 * that the swap to real content does not move anything.
 */
export function SkeletonRow({ avatar = true }: { avatar?: boolean }) {
  return (
    <div className="flex items-start gap-3 p-4 rounded-xl bg-surface-sunken/30 border border-subtle">
      {avatar && <div aria-hidden="true" className="skeleton w-9 h-9 rounded-full flex-shrink-0" />}
      <div className="flex-1 min-w-0 space-y-2">
        <SkeletonLine width="45%" />
        <SkeletonLine width="85%" />
      </div>
    </div>
  )
}

/**
 * Several rows, announced once as a busy region rather than as a pile of
 * meaningless boxes. A screen reader gets "Loading…"; a sighted user gets the
 * shape.
 */
export default function SkeletonList({
  rows = 3, avatar = true, label = 'Loading'
}: {
  rows?: number
  avatar?: boolean
  label?: string
}) {
  return (
    <div role="status" aria-busy="true" aria-label={label} className="space-y-3">
      {Array.from({ length: rows }, (_, i) => <SkeletonRow key={i} avatar={avatar} />)}
    </div>
  )
}
