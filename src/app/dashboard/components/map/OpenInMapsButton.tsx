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
 * When the caller has real coordinates (a listing/service/item that captured
 * lat/lon at posting), this jumps straight there — no geocoding, no risk of
 * landing on the wrong building on a street with a common name. Only falls
 * back to re-geocoding the free-text address via VibeMap's `place` param
 * for records that predate coordinate capture.
 */
export default function OpenInMapsButton({ address, lat, lon, label, className }: {
  address: string
  lat?: number | null
  lon?: number | null
  label?: string
  className?: string
}) {
  const hasCoords = lat != null && lon != null && Number.isFinite(lat) && Number.isFinite(lon)
  if (!hasCoords && !address?.trim()) return null

  const href = hasCoords
    ? `/dashboard/community?tab=vibemap&lat=${lat}&lon=${lon}&label=${encodeURIComponent(label || address)}`
    : `/dashboard/community?tab=vibemap&place=${encodeURIComponent(address)}`

  return (
    <Link
      href={href}
      onClick={e => e.stopPropagation()}
      className={className || 'inline-flex items-center gap-1.5 text-[10px] font-black text-gold-primary uppercase tracking-widest hover:underline'}
    >
      <Navigation size={11} /> View on map
    </Link>
  )
}
