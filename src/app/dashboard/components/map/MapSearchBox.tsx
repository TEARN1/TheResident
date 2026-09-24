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
      <div className="flex items-center gap-2.5 bg-black/60 backdrop-blur-2xl border border-white/15 rounded-2xl px-3.5 py-2.5 shadow-glass transition-all focus-within:border-gold-primary/60 focus-within:shadow-glow">
        <Search size={16} className="text-gold-primary shrink-0 transition-transform group-focus-within:scale-110" />
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => (visibleResults.length > 0 || showRecent) && setOpen(true)}
          placeholder="Search places, suburbs, addresses..."
          className="bg-transparent outline-none text-xs text-white placeholder:text-gray-400 w-full font-medium"
        />
        {query && (
          <button
            onClick={() => { setQuery(''); setOpen(false) }}
            className="text-gray-400 hover:text-white p-0.5 rounded-full hover:bg-white/10 transition-colors"
          >
            <X size={13} />
          </button>
        )}
        {loading && <Loader2 size={14} className="animate-spin text-gold-primary shrink-0" />}
      </div>

      {open && visibleResults.length > 0 && (
        <div className="absolute z-[500] mt-2 w-full bg-black/80 backdrop-blur-3xl border border-white/15 rounded-2xl shadow-glass overflow-hidden max-h-72 overflow-y-auto custom-scrollbar p-1.5 space-y-1">
          {visibleResults.map(r => (
            <button
              key={r.id}
              onClick={() => selectResult(r)}
              className="flex items-start gap-2.5 w-full text-left px-3 py-2 rounded-xl text-xs text-gray-200 hover:bg-white/10 hover:text-white transition-all group"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-gold-primary/70 mt-1.5 shrink-0 group-hover:scale-125 transition-transform" />
              <span className="line-clamp-2 leading-relaxed">{r.label}</span>
            </button>
          ))}
        </div>
      )}

      {open && visibleResults.length === 0 && showRecent && (
        <div className="absolute z-[500] mt-2 w-full bg-black/80 backdrop-blur-3xl border border-white/15 rounded-2xl shadow-glass overflow-hidden max-h-72 overflow-y-auto custom-scrollbar p-1.5">
          <div className="flex items-center justify-between px-3 py-2 border-b border-white/10 mb-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">Recent Searches</span>
            <button
              onClick={clearRecent}
              className="text-[10px] text-gray-400 hover:text-red-400 font-semibold px-1.5 py-0.5 rounded hover:bg-white/5 transition-colors"
            >
              Clear
            </button>
          </div>
          {recent.map(r => (
            <button
              key={r.id}
              onClick={() => selectResult(r)}
              className="flex items-center gap-2.5 w-full text-left px-3 py-2 rounded-xl text-xs text-gray-300 hover:bg-white/10 hover:text-white transition-all group"
            >
              <Clock size={13} className="text-gray-500 group-hover:text-gold-primary transition-colors shrink-0" />
              <span className="truncate">{r.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
