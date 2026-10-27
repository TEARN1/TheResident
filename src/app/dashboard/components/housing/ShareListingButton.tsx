'use client'

import React, { useState } from 'react'
import { Share2, Check } from 'lucide-react'
import { listingShareText } from '../../../../utils/publicListings'
import { track } from '../../../../utils/track'
import { playTactileSound } from '../../../../utils/tactileSounds'

/**
 * Share a room listing via native share sheet or 1-tap in-app link copy.
 * The link is the public /rooms/<id> page, which anyone can
 * open without an account.
 */
interface Props {
  listing: { id: string; title: string; price: number; currency: string; suburb?: string; listingType?: string }
  userId?: string | null
  variant?: 'icon' | 'full'
}

export default function ShareListingButton({ listing, userId, variant = 'icon' }: Props) {
  const [copied, setCopied] = useState(false)

  const share = async () => {
    playTactileSound('pop')
    const url = typeof window !== 'undefined' ? `${window.location.origin}/rooms/${listing.id}` : `/rooms/${listing.id}`
    const shareText = listingShareText(listing, url)
    track('share_whatsapp', { type: listing.listingType || 'rent' }, userId)

    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: listing.title,
          text: shareText,
          url
        })
        return
      } catch {
        // User dismissed native share sheet, proceed to clipboard copy fallback
      }
    }

    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(`${shareText}\n${url}`)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    }
  }

  if (variant === 'full') {
    return (
      <button
        type="button"
        onClick={share}
        className="w-full border border-gold-primary/30 bg-gold-primary/10 hover:bg-gold-primary/20 text-gold-primary font-black py-3 rounded-2xl uppercase tracking-widest text-[11px] flex items-center justify-center gap-2 transition-all min-h-[44px] active:scale-95"
      >
        {copied ? <Check size={14} className="text-emerald-400" /> : <Share2 size={14} />}
        <span>{copied ? 'Copied Room Link!' : 'Share Room Link'}</span>
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={share}
      className="p-2.5 rounded-xl bg-white/5 hover:bg-gold-primary/15 border border-white/10 hover:border-gold-primary/30 text-gray-300 hover:text-gold-primary transition-all flex items-center gap-1.5 text-xs font-bold min-h-[44px] active:scale-95"
      title="Share or copy this room listing link"
      aria-label="Share or copy this room listing link"
    >
      {copied ? <Check size={14} className="text-emerald-400" /> : <Share2 size={14} className="text-gold-primary" />}
      <span className="hidden sm:inline text-[10px] uppercase font-black tracking-wider">{copied ? 'Copied' : 'Share'}</span>
    </button>
  )
}
