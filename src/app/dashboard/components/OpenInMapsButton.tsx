'use client'

import React from 'react'
import { Navigation } from 'lucide-react'
import { directionsUrlForAddress } from '../../../utils/navigation'

/**
 * Deep-links into the resident's own Google Maps app rather than us building
 * turn-by-turn navigation from scratch — see src/utils/navigation.ts.
 */
export default function OpenInMapsButton({ address, className }: { address: string; className?: string }) {
  if (!address?.trim()) return null
  return (
    <a
      href={directionsUrlForAddress(address)}
      target="_blank"
      rel="noopener noreferrer"
      onClick={e => e.stopPropagation()}
      className={className || 'inline-flex items-center gap-1.5 text-[10px] font-black text-gold-primary uppercase tracking-widest hover:underline'}
    >
      <Navigation size={11} /> Directions
    </a>
  )
}
