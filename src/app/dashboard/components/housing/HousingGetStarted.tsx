'use client'

import React from 'react'
import Link from 'next/link'
import { Building2, ClipboardList, MessageSquare, Plus } from 'lucide-react'
import { LAUNCH_AREA } from '../../../../utils/launch'
import { track } from '../../../../utils/track'

/**
 * What Housing shows when there are no rooms at all (as opposed to filters
 * hiding them). The old page showed invented sample rooms here instead; an
 * honest "nothing yet" plus a way to change that is better for a trust app.
 */
interface Props {
  isLandlord: boolean
  isGuest: boolean
  onListRoom: () => void
}

export default function HousingGetStarted({ isLandlord, isGuest, onListRoom }: Props) {
  const where = LAUNCH_AREA ? ` in ${LAUNCH_AREA}` : ' here'

  return (
    <div className="glass-panel p-6 sm:p-8 text-center space-y-5">
      <div className="mx-auto w-14 h-14 rounded-2xl bg-gold-primary/10 border border-gold-primary/30 flex items-center justify-center text-gold-primary">
        <Building2 size={26} />
      </div>
      <div className="space-y-1.5">
        <h3 className="m-0 text-lg font-black text-white">No rooms listed{where} yet</h3>
        <p className="m-0 text-sm text-gray-400 max-w-md mx-auto">
          The Resident is new. Every room here is real and posted by its landlord, so this fills up as people list.
          Be the first, and get seen before anyone else.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-2.5 justify-center">
        {isLandlord ? (
          <button
            onClick={onListRoom}
            className="bg-gold-primary hover:bg-gold-secondary text-black font-black px-5 py-3 rounded-2xl flex items-center justify-center gap-2 text-xs uppercase tracking-wider transition-all min-h-[44px] active:scale-95"
          >
            <Plus size={16} /> List a room
          </button>
        ) : (
          <Link
            href={isGuest ? '/auth?role=landlord' : '/dashboard/profile?role=landlord'}
            className="no-underline bg-gold-primary hover:bg-gold-secondary text-black font-black px-5 py-3 rounded-2xl flex items-center justify-center gap-2 text-xs uppercase tracking-wider transition-all min-h-[44px] active:scale-95"
          >
            <Plus size={16} /> I have a room to rent
          </Link>
        )}
        <Link
          href="/dashboard/messages"
          onClick={() => track('concierge_click', { area: LAUNCH_AREA || null })}
          className="no-underline border border-gold-primary/30 bg-gold-primary/10 hover:bg-gold-primary/20 text-gold-primary font-black px-5 py-3 rounded-2xl flex items-center justify-center gap-2 text-xs uppercase tracking-wider transition-all min-h-[44px] active:scale-95"
        >
          <MessageSquare size={16} /> In-App Listing Concierge
        </Link>
      </div>

      <div className="flex items-start gap-2.5 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-left max-w-md mx-auto">
        <ClipboardList size={18} className="text-gold-primary shrink-0 mt-0.5" />
        <p className="m-0 text-xs text-gray-400">
          <span className="font-bold text-white">Landlords: manage your rooms free.</span>{' '}
          Track who lives in each room, what rent comes in, and fill empty rooms in one tap, even before your tenants join.
        </p>
      </div>
    </div>
  )
}
