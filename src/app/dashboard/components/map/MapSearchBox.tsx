'use client'

/**
 * MapSearchBox — search-as-you-type over Nominatim, debounced so we don't
 * hammer the free OSM API on every keystroke. Selecting a result hands the
 * point back up to VibeMap, which recentres the map and drops a marker.
 */
import React, { useEffect, useRef, useState } from 'react'
import { Search, Loader2 } from 'lucide-react'
import { searchPlaces, type GeocodeResult } from '../../../../utils/geocode'

interface Props {
  onSelect: (result: GeocodeResult) => void
}

export default function MapSearchBox({ onSelect }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<GeocodeResult[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const tooShort = query.trim().length < 3

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (tooShort) return

    timerRef.current = setTimeout(() => {
      setLoading(true)
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller
      searchPlaces(query, controller.signal)
        .then(r => { setResults(r); setOpen(true) })
        .finally(() => setLoading(false))
    }, 350)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [query, tooShort])

  const visibleResults = tooShort ? [] : results

  return (
    <div className="relative">
      <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2">
        <Search size={16} className="text-gold-primary shrink-0" />
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => visibleResults.length > 0 && setOpen(true)}
          placeholder="Search a place or address…"
          className="bg-transparent outline-none text-sm text-white placeholder:text-gray-500 w-full"
        />
        {loading && <Loader2 size={14} className="animate-spin text-gray-500 shrink-0" />}
      </div>

      {open && visibleResults.length > 0 && (
        <div className="absolute z-[500] mt-1 w-full glass-panel border border-white/10 rounded-xl overflow-hidden max-h-64 overflow-y-auto">
          {visibleResults.map(r => (
            <button
              key={r.id}
              onClick={() => {
                onSelect(r)
                setQuery(r.label)
                setOpen(false)
              }}
              className="block w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-white/5 hover:text-white transition-colors border-b border-white/5 last:border-0"
            >
              {r.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
