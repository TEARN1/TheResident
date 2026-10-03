'use client'

import React from 'react'

export default function DashboardLoading() {
  return (
    <div className="min-h-[70vh] w-full p-4 sm:p-6 lg:p-8 flex flex-col gap-6 animate-pulse">
      {/* Top Header Skeleton */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-white/5">
        <div className="space-y-2">
          <div className="h-4 w-28 bg-white/10 rounded-full" />
          <div className="h-8 w-64 bg-white/15 rounded-2xl" />
        </div>
        <div className="flex items-center gap-3">
          <div className="h-10 w-24 bg-white/10 rounded-xl" />
          <div className="h-10 w-10 bg-white/10 rounded-xl" />
        </div>
      </div>

      {/* Hero / Quick Stats Grid Skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-28 rounded-3xl bg-white/5 border border-white/10 p-4 flex flex-col justify-between"
          >
            <div className="h-8 w-8 rounded-xl bg-white/10" />
            <div className="space-y-1.5">
              <div className="h-5 w-16 bg-white/15 rounded-md" />
              <div className="h-3 w-24 bg-white/10 rounded-md" />
            </div>
          </div>
        ))}
      </div>

      {/* Main Content Cards Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-2">
        <div className="lg:col-span-2 h-96 rounded-3xl bg-white/5 border border-white/10 p-6 space-y-4">
          <div className="h-6 w-48 bg-white/15 rounded-xl" />
          <div className="h-4 w-full bg-white/5 rounded-lg" />
          <div className="h-4 w-3/4 bg-white/5 rounded-lg" />
          <div className="h-56 w-full rounded-2xl bg-white/10 mt-6" />
        </div>
        <div className="h-96 rounded-3xl bg-white/5 border border-white/10 p-6 space-y-4">
          <div className="h-6 w-36 bg-white/15 rounded-xl" />
          <div className="space-y-3 pt-2">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="flex items-center gap-3 p-3 rounded-2xl bg-white/5 border border-white/5">
                <div className="h-10 w-10 rounded-xl bg-white/10 shrink-0" />
                <div className="space-y-1 flex-1">
                  <div className="h-4 w-28 bg-white/15 rounded" />
                  <div className="h-3 w-40 bg-white/5 rounded" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
