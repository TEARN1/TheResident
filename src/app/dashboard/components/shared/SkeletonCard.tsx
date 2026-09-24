'use client'

import React from 'react'

interface SkeletonCardProps {
  variant?: 'listing' | 'post' | 'tool' | 'compact'
  count?: number
}

export function SkeletonCard({ variant = 'listing', count = 1 }: SkeletonCardProps) {
  const items = Array.from({ length: count }, (_, i) => i)

  return (
    <>
      {items.map((key) => (
        <div
          key={key}
          className="relative overflow-hidden rounded-3xl border border-white/5 bg-white/[0.02] p-6 backdrop-blur-xl shadow-2xl animate-pulse"
        >
          {/* Shimmer linear gradient ray */}
          <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/[0.04] to-transparent" />

          {variant === 'listing' && (
            <div className="space-y-4">
              <div className="h-44 w-full rounded-2xl bg-white/[0.05]" />
              <div className="space-y-2">
                <div className="h-5 w-3/4 rounded-lg bg-white/[0.07]" />
                <div className="h-4 w-1/2 rounded-lg bg-white/[0.04]" />
              </div>
              <div className="flex justify-between items-center pt-2">
                <div className="h-6 w-24 rounded-lg bg-gold-primary/10" />
                <div className="h-8 w-28 rounded-xl bg-white/[0.06]" />
              </div>
            </div>
          )}

          {variant === 'post' && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-white/[0.08]" />
                <div className="space-y-1.5 flex-1">
                  <div className="h-4 w-32 rounded-lg bg-white/[0.07]" />
                  <div className="h-3 w-20 rounded-md bg-white/[0.04]" />
                </div>
              </div>
              <div className="space-y-2">
                <div className="h-4 w-full rounded-lg bg-white/[0.05]" />
                <div className="h-4 w-5/6 rounded-lg bg-white/[0.04]" />
              </div>
              <div className="flex gap-4 pt-2">
                <div className="h-7 w-16 rounded-xl bg-white/[0.05]" />
                <div className="h-7 w-16 rounded-xl bg-white/[0.05]" />
              </div>
            </div>
          )}

          {variant === 'tool' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <div className="h-5 w-32 rounded-lg bg-white/[0.07]" />
                <div className="h-6 w-16 rounded-full bg-gold-primary/10" />
              </div>
              <div className="h-4 w-full rounded-lg bg-white/[0.04]" />
              <div className="h-12 w-full rounded-xl bg-black/40" />
              <div className="h-9 w-full rounded-xl bg-white/[0.06]" />
            </div>
          )}

          {variant === 'compact' && (
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-2xl bg-white/[0.06]" />
              <div className="space-y-2 flex-1">
                <div className="h-4 w-1/3 rounded-lg bg-white/[0.07]" />
                <div className="h-3 w-1/2 rounded-md bg-white/[0.04]" />
              </div>
            </div>
          )}
        </div>
      ))}
    </>
  )
}
