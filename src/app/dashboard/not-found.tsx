'use client'

import React from 'react'
import Link from 'next/link'
import { Compass, Home, MapPin, Building2, Wrench } from 'lucide-react'

export default function DashboardNotFound() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center p-4">
      <div className="w-full max-w-lg p-8 rounded-3xl bg-[var(--card-bg,rgba(11,43,38,0.7))] border border-[var(--glass-border,rgba(142,182,155,0.2))] backdrop-blur-2xl shadow-2xl text-center space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-[var(--gold-dim,rgba(142,182,155,0.1))] border border-[var(--glass-border,rgba(142,182,155,0.2))] text-[var(--gold-primary,#8EB69B)] mx-auto flex items-center justify-center shadow-lg">
          <Compass size={32} className="animate-spin-slow" />
        </div>

        <div className="space-y-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-[var(--gold-primary,#8EB69B)] px-3 py-1 rounded-full bg-[var(--gold-dim,rgba(142,182,155,0.1))] border border-[var(--glass-border,rgba(142,182,155,0.2))]">
            404 — Resident Portal
          </span>
          <h1 className="text-2xl font-black tracking-tight text-white mt-2">
            Section Not Located
          </h1>
          <p className="text-xs text-gray-400 max-w-sm mx-auto">
            This part of the building or community portal is currently unavailable or has been relocated.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 pt-2">
          <Link
            href="/dashboard"
            className="p-3 rounded-2xl bg-[var(--gold-primary,#8EB69B)] text-black font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-lg"
          >
            <Home size={14} /> Dashboard
          </Link>
          <Link
            href="/dashboard/housing"
            className="p-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 active:scale-95 transition-all"
          >
            <Building2 size={14} /> Housing
          </Link>
          <Link
            href="/dashboard/community?tab=vibemap"
            className="p-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 active:scale-95 transition-all"
          >
            <MapPin size={14} /> VibeMap
          </Link>
          <Link
            href="/dashboard/services"
            className="p-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 active:scale-95 transition-all"
          >
            <Wrench size={14} /> Services
          </Link>
        </div>
      </div>
    </div>
  )
}
