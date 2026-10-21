'use client'

import React from 'react'
import { MapPin, Navigation, ExternalLink } from 'lucide-react'
import { mapsUrl, tileFor } from '../../../../utils/dmMedia'
import { directionsUrlForCoords } from '../../../../utils/navigation'

/**
 * A shared location: a small map drawn from nine map tiles with the pin in
 * the middle, plus buttons that open it in the phone's maps app. No map
 * library is loaded just for this.
 */
const ZOOM = 16
const W = 240
const H = 130

interface Props {
  lat: number
  lon: number
  isMe: boolean
}

export default function LocationCard({ lat, lon, isMe }: Props) {
  const t = tileFor(lat, lon, ZOOM)
  const tiles: { key: string; src: string; left: number; top: number }[] = []
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      tiles.push({
        key: `${dx}:${dy}`,
        src: `https://a.basemaps.cartocdn.com/rastertiles/voyager/${ZOOM}/${t.x + dx}/${t.y + dy}.png`,
        left: W / 2 - t.px + dx * 256,
        top: H / 2 - t.py + dy * 256
      })
    }
  }

  const btn = isMe
    ? 'bg-black/20 hover:bg-black/30 text-black border border-black/20'
    : 'bg-white/10 hover:bg-white/15 text-white border border-white/15'

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider">
        <MapPin size={13} className={isMe ? 'text-black' : 'text-gold-primary'} />
        <span>Shared location</span>
      </div>
      <a
        href={mapsUrl(lat, lon)}
        target="_blank"
        rel="noopener noreferrer"
        className="block relative overflow-hidden rounded-xl border border-black/10 bg-gray-200"
        style={{ width: W, height: H, maxWidth: '100%' }}
        aria-label="Open this location in maps"
      >
        {tiles.map(tile => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={tile.key} src={tile.src} alt="" width={256} height={256} className="absolute max-w-none select-none" style={{ left: tile.left, top: tile.top }} draggable={false} />
        ))}
        <MapPin size={30} className="absolute text-red-600 drop-shadow-[0_2px_2px_rgba(0,0,0,0.4)]" style={{ left: W / 2 - 15, top: H / 2 - 30 }} fill="currentColor" stroke="white" />
        <span className="absolute bottom-0 right-0 bg-white/80 text-[8px] text-gray-700 px-1">© OpenStreetMap © CARTO</span>
      </a>
      <div className="flex gap-2">
        <a href={mapsUrl(lat, lon)} target="_blank" rel="noopener noreferrer" className={`no-underline flex-1 inline-flex items-center justify-center gap-1 text-[10px] font-black uppercase tracking-wider px-2.5 py-1.5 rounded-xl ${btn}`}>
          <ExternalLink size={11} /> Open in maps
        </a>
        <a href={directionsUrlForCoords(lat, lon)} target="_blank" rel="noopener noreferrer" className={`no-underline flex-1 inline-flex items-center justify-center gap-1 text-[10px] font-black uppercase tracking-wider px-2.5 py-1.5 rounded-xl ${btn}`}>
          <Navigation size={11} /> Directions
        </a>
      </div>
    </div>
  )
}
