'use client'

import React from 'react'

// Item 150. Occupancy, provider performance and the profile scores all show
// "a number with a word under it" and all three built it separately.
//
// A two-column grid rather than flex-wrap, for a measured reason: the flex
// version needed min-width: calc(50% - 4px), which came to exactly the parent
// width for a pair, and sub-pixel rounding then dropped every tile onto its
// own row. An odd last tile spans both columns so it reads as deliberate.
export function StatGrid({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`grid grid-cols-2 sm:grid-cols-4 gap-2 [&>*:last-child:nth-child(odd)]:col-span-2 sm:[&>*:last-child:nth-child(odd)]:col-span-1 ${className || ''}`.trim()}
    >
      {children}
    </div>
  )
}

export default function StatTile({
  label, value, hint
}: {
  label: string
  value: string
  hint?: string
}) {
  return (
    <div className="text-center px-2 py-3 rounded-xl bg-surface-sunken/40 border border-subtle">
      <div className="text-lg font-black text-content leading-none">{value}</div>
      <div className="text-[10px] uppercase tracking-widest text-content-subtle mt-1.5">{label}</div>
      {hint && <div className="text-[10px] text-content-subtle mt-1">{hint}</div>}
    </div>
  )
}
