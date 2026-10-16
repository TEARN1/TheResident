'use client'

import React from 'react'
import { MessageCircle } from 'lucide-react'
import { listingShareText, whatsappShareUrl } from '../../../../utils/publicListings'
import { track } from '../../../../utils/track'

/**
 * Share a room on WhatsApp, where people in South Africa actually pass
 * rooms around. The link is the public /rooms/<id> page, which anyone can
 * open (and which WhatsApp previews with the photo and price) without an
 * account.
 */
interface Props {
  listing: { id: string; title: string; price: number; currency: string; suburb?: string; listingType?: string }
  userId?: string | null
  variant?: 'icon' | 'full'
}

export default function ShareListingButton({ listing, userId, variant = 'icon' }: Props) {
  const share = () => {
    const url = `${window.location.origin}/rooms/${listing.id}`
    track('share_whatsapp', { type: listing.listingType || 'rent' }, userId)
    window.open(whatsappShareUrl(listingShareText(listing, url)), '_blank', 'noopener,noreferrer')
  }

  if (variant === 'full') {
    return (
      <button
        type="button"
        onClick={share}
        className="w-full border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-black py-3 rounded-2xl uppercase tracking-widest text-[11px] flex items-center justify-center gap-2 transition-all"
      >
        <MessageCircle size={14} /> Share on WhatsApp
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={share}
      className="p-2.5 rounded-xl bg-white/5 hover:bg-emerald-500/15 border border-white/10 hover:border-emerald-500/30 text-gray-300 hover:text-emerald-400 transition-all flex items-center gap-1.5 text-xs font-bold"
      title="Share this room on WhatsApp"
      aria-label="Share this room on WhatsApp"
    >
      <MessageCircle size={14} className="text-emerald-400" />
      <span className="hidden sm:inline text-[10px] uppercase font-black tracking-wider">Share</span>
    </button>
  )
}
