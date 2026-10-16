'use client'

import { useEffect } from 'react'
import { track } from '../../../../utils/track'

/** Counts a shared room being opened (the "room_page_view" funnel step). */
export default function TrackRoomView({ type }: { type: string }) {
  useEffect(() => {
    track('room_page_view', { type })
  }, [type])
  return null
}
