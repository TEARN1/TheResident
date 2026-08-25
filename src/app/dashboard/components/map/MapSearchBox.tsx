'use client'

/**
 * MapSearchBox — search-as-you-type over Nominatim, debounced so we don't
 * hammer the free OSM API on every keystroke. Selecting a result hands the
 * point back up to VibeMap, which recentres the map and drops a marker.
 */
import React, { useEffect, useRef, useState } from 'react'
import { Search, Loader2, Clock, X } from 'lucide-react'
import { searchPlaces, type GeocodeResult } from '../../../../utils/geocode'

interface Props {
  onSelect: (result: GeocodeResult) => void
}

// Recent searches only — free localStorage, no API. Only what a user
// actually PICKED (not every keystroke's results), same as a browser's own
// address-bar history, capped small since this is a quick-recall list, not
// an archive.
const RECENT_KEY = 'vibemap_recent_searches'
const MAX_RECENT = 5

function loadRecent(): GeocodeResult[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(RECENT_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveRecent(list: GeocodeResult[]) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(list))
  } catch {
    // Storage full/disabled — recent search history is a convenience, not
    // worth surfacing an error over.
  }
}

export default function MapSearchBox({ onSelect }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<GeocodeResult[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [recent, setRecent] = useState<GeocodeResult[]>([])
  const abortRef = useRef<AbortController | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  /* eslint-disable-next-line react-hooks/set-state-in-effect -- one-time sync from localStorage on mount */
  useEffect(() => { setRecent(loadRecent()) }, [])

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
  const showRecent = tooShort && recent.length > 0

  const selectResult = (r: GeocodeResult) => {
    onSelect(r)
    setQuery(r.label)
    setOpen(false)

    const next = [r, ...recent.filter(x => x.label !== r.label)].slice(0, MAX_RECENT)
    setRecent(next)
    saveRecent(next)
  }

  const clearRecent = (e: React.MouseEvent) => {
    e.stopPropagation()
    setRecent([])
    saveRecent([])
  }

  return (
    <div className="relative">
      <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2">
        <Search size={16} className="text-gold-primary shrink-0" />
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => (visibleResults.length > 0 || showRecent) && setOpen(true)}
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
              onClick={() => selectResult(r)}
              className="block w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-white/5 hover:text-white transition-colors border-b border-white/5 last:border-0"
            >
              {r.label}
            </button>
          ))}
        </div>
      )}

      {open && visibleResults.length === 0 && showRecent && (
        <div className="absolute z-[500] mt-1 w-full glass-panel border border-white/10 rounded-xl overflow-hidden max-h-64 overflow-y-auto">
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/5">
            <span className="text-[9px] font-black uppercase tracking-widest text-gray-500">Recent</span>
            <button onClick={clearRecent} className="text-gray-500 hover:text-white" aria-label="Clear recent searches">
              <X size={11} />
            </button>
          </div>
          {recent.map(r => (
            <button
              key={r.id}
              onClick={() => selectResult(r)}
              className="flex items-center gap-2 w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-white/5 hover:text-white transition-colors border-b border-white/5 last:border-0"
            >
              <Clock size={11} className="text-gray-600 shrink-0" />
              {r.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
