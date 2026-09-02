'use client'

/**
 * HomeAreaPanel — where a resident sets, changes, or removes their home area.
 *
 * This is the resident-facing half of Phase A in
 * docs/OFFICIAL-BROADCAST-STRATEGY.md. It exists so that a ward councillor,
 * library or municipality can eventually reach "everyone who lives here"
 * without the app ever tracking anybody: the only way a home area exists is
 * that someone deliberately set one here.
 *
 * Two deliberate choices in this UI:
 *   1. Address, never coordinates. Residents search a real place (reusing
 *      MapSearchBox / Nominatim) or use their current location, and are shown
 *      the resolved address back. Raw lat/lon is not a thing people recognise
 *      as their home.
 *   2. Approximate by default. The "about 1.1km" option is preselected and
 *      explained, because a ward-containment test never needs a street
 *      address and the honest default is the less precise one.
 */
import React, { useCallback, useEffect, useState } from 'react'
import { MapPin, Crosshair, Loader, Trash2, Check, Info } from 'lucide-react'
import MapSearchBox from '../map/MapSearchBox'
import { reverseGeocodeParts, type GeocodeResult } from '../../../../utils/geocode'
import {
  fetchMyHomeArea, setHomeArea, clearHomeArea, describeHomeArea, coarsen,
  COARSE_GRID_KM, type HomeArea, type HomeAreaGranularity
} from '../../../../utils/homeArea'
import { goldButtonClass } from '../../../../components/ui/GoldButton'

interface PendingPick {
  lat: number
  lon: number
  label: string | null
  suburb: string | null
  city: string | null
}

export default function HomeAreaPanel() {
  const [area, setArea] = useState<HomeArea | null>(null)
  const [loading, setLoading] = useState(true)
  const [granularity, setGranularity] = useState<HomeAreaGranularity>('coarse')
  const [pending, setPending] = useState<PendingPick | null>(null)
  const [locating, setLocating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const mine = await fetchMyHomeArea()
      setArea(mine)
      if (mine) setGranularity(mine.granularity)
    } catch {
      // A missing home area is the normal state, not an error worth shouting
      // about on a settings screen.
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // Both entry points (search a place / use my location) converge here, so the
  // resident always gets a resolved address to confirm before anything saves.
  const resolveAndStage = useCallback(async (lat: number, lon: number, fallbackLabel?: string) => {
    const parts = await reverseGeocodeParts(lat, lon)
    setPending({
      lat,
      lon,
      label: parts.label || fallbackLabel || null,
      suburb: parts.suburb,
      city: parts.city
    })
  }, [])

  const handleSearchSelect = (result: GeocodeResult) => {
    setError(null)
    setSaved(false)
    resolveAndStage(result.lat, result.lon, result.label)
  }

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      setError('This device cannot share a location with the browser.')
      return
    }
    setLocating(true)
    setError(null)
    setSaved(false)
    navigator.geolocation.getCurrentPosition(
      async pos => {
        await resolveAndStage(pos.coords.latitude, pos.coords.longitude)
        setLocating(false)
      },
      err => {
        setLocating(false)
        setError(
          err.code === err.PERMISSION_DENIED
            ? 'Location access is blocked — allow it in your browser settings, or search for your address instead.'
            : 'Could not get your location — try again, or search for your address instead.'
        )
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
    )
  }

  const handleSave = async () => {
    if (!pending) return
    setSaving(true)
    setError(null)
    try {
      const next = await setHomeArea({
        lat: pending.lat,
        lon: pending.lon,
        granularity,
        suburb: pending.suburb,
        city: pending.city,
        label: pending.label
      })
      setArea(next)
      setPending(null)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your home area.')
    } finally {
      setSaving(false)
    }
  }

  const handleClear = async () => {
    setClearing(true)
    setError(null)
    try {
      await clearHomeArea()
      setArea(null)
      setPending(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove your home area.')
    } finally {
      setClearing(false)
    }
  }

  // Show the resident the actual point that will be stored, not the one they
  // picked — if they chose "approximate", the blunted value is the truth.
  const previewPoint = pending
    ? (granularity === 'coarse' ? coarsen(pending.lat, pending.lon) : { lat: pending.lat, lon: pending.lon })
    : null

  return (
    <div className="glass-panel p-6 space-y-4">
      <div className="flex items-start gap-3">
        <div className="p-2 bg-gold-primary/10 rounded-lg text-gold-primary shrink-0">
          <MapPin size={18} />
        </div>
        <div>
          <h3 className="text-sm font-black text-white uppercase tracking-widest">Home Area</h3>
          <p className="text-[11px] text-gray-500 mt-1 leading-relaxed">
            Optional. Setting this lets your municipality, ward councillor, library or clinic
            reach you when something affects your area — a water shutdown, a road closure, an
            emergency. It also improves how nearby listings and neighbourhood alerts are matched to you.
          </p>
        </div>
      </div>

      <div className="flex items-start gap-2 bg-blue-500/5 border border-blue-500/20 rounded-lg p-3">
        <Info size={13} className="text-blue-400 mt-0.5 shrink-0" />
        <p className="text-[10px] text-gray-400 leading-relaxed">
          Nobody can see this — not other residents, not landlords, not officials. It is never
          shown on a map or shared. It is only ever used to answer &quot;is this person inside the
          area being notified&quot;, and you can remove it at any time. The app never tracks your
          location in the background.
        </p>
      </div>

      {loading ? (
        <p className="text-[11px] text-gray-500 flex items-center gap-2">
          <Loader size={13} className="animate-spin" /> Loading…
        </p>
      ) : (
        <>
          <div className="bg-black/40 border border-white/5 rounded-xl p-4 space-y-1">
            <p className="text-[9px] text-gray-600 font-black uppercase tracking-widest">Currently set to</p>
            <p className="text-sm text-white font-bold">{describeHomeArea(area)}</p>
            {area && (
              <p className="text-[10px] text-gray-500">
                {area.granularity === 'exact'
                  ? 'Stored as an exact location.'
                  : `Stored approximately, to about ${COARSE_GRID_KM}km.`}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-[10px] text-gray-500 uppercase font-black tracking-widest">
              Search your address
            </label>
            <MapSearchBox onSelect={handleSearchSelect} />
            <button
              type="button"
              onClick={handleUseMyLocation}
              disabled={locating}
              className="flex items-center gap-1.5 text-[10px] text-gray-400 hover:text-gold-primary font-black uppercase tracking-widest transition-colors disabled:opacity-50"
            >
              {locating ? <Loader size={12} className="animate-spin" /> : <Crosshair size={12} />}
              {locating ? 'Finding you…' : 'Or use my current location'}
            </button>
          </div>

          {pending && (
            <div className="bg-gold-primary/5 border border-gold-primary/20 rounded-xl p-4 space-y-3">
              <div>
                <p className="text-[9px] text-gold-primary font-black uppercase tracking-widest">About to save</p>
                <p className="text-sm text-white font-bold mt-1">
                  {pending.label || [pending.suburb, pending.city].filter(Boolean).join(', ') || 'Selected location'}
                </p>
              </div>

              <div className="space-y-1.5">
                <p className="text-[9px] text-gray-500 font-black uppercase tracking-widest">How precisely?</p>
                {(['coarse', 'exact'] as const).map(option => (
                  <label key={option} className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="home-granularity"
                      checked={granularity === option}
                      onChange={() => setGranularity(option)}
                      className="accent-gold-primary mt-0.5"
                    />
                    <span className="text-[11px] text-gray-300 leading-relaxed">
                      {option === 'coarse' ? (
                        <>
                          <strong className="text-white">Approximate</strong> — rounded to about {COARSE_GRID_KM}km.
                          Enough to know which ward or suburb you&apos;re in. <span className="text-gray-500">Recommended.</span>
                        </>
                      ) : (
                        <>
                          <strong className="text-white">Exact</strong> — stored as picked. Slightly better matching
                          for nearby listings, but more precise than area notifications need.
                        </>
                      )}
                    </span>
                  </label>
                ))}
                {previewPoint && granularity === 'coarse' && (
                  <p className="text-[10px] text-gray-600 pl-6">
                    Stored as {previewPoint.lat.toFixed(2)}, {previewPoint.lon.toFixed(2)} — not your exact address.
                  </p>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { setPending(null); setError(null) }}
                  className="flex-1 bg-white/5 text-gray-300 font-black py-3 rounded-xl text-[10px] uppercase tracking-widest"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className={`flex-1 ${goldButtonClass()} disabled:opacity-50`}
                >
                  {saving ? 'Saving…' : 'Save Home Area'}
                </button>
              </div>
            </div>
          )}

          {saved && (
            <p className="text-[11px] text-green-400 flex items-center gap-1.5">
              <Check size={13} /> Home area saved.
            </p>
          )}
          {error && <p className="text-[11px] text-red-400">{error}</p>}

          {area && !pending && (
            <button
              type="button"
              onClick={handleClear}
              disabled={clearing}
              className="flex items-center gap-1.5 text-[10px] text-gray-600 hover:text-red-400 font-black uppercase tracking-widest transition-colors disabled:opacity-50"
            >
              <Trash2 size={12} /> {clearing ? 'Removing…' : 'Remove my home area'}
            </button>
          )}
        </>
      )}
    </div>
  )
}
