'use client'

import React from 'react'
import Link from 'next/link'
import { Navigation } from 'lucide-react'

/**
 * Opens the address on OUR OWN VibeMap rather than deep-linking out to Google
 * Maps. The shared zone reports (road closures, traffic, safety alerts), saved
 * pins and geofence alerts only exist on our map — handing the resident off to
 * an external app drops every layer that makes this map worth opening, and
 * loses them out of the product entirely.
 *
 * VibeMap geocodes the `place` param and drops a pending pin there, so the
 * resident lands on the address with "Save place" / "Report closure" /
 * "Add to distances" already in reach.
 */
export default function OpenInMapsButton({ address, className }: { address: string; className?: string }) {
  if (!address?.trim()) return null
  return (
    <Link
      href={`/dashboard/community?tab=vibemap&place=${encodeURIComponent(address)}`}
      onClick={e => e.stopPropagation()}
      className={className || 'inline-flex items-center gap-1.5 text-[10px] font-black text-gold-primary uppercase tracking-widest hover:underline'}
    >
      <Navigation size={11} /> View on map
    </Link>
  )
}
