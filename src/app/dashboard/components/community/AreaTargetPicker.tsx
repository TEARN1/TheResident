'use client'

/**
 * AreaTargetPicker — how a verified official chooses the AREA a message
 * reaches, and sees the size of that audience before sending. Phase C of
 * docs/OFFICIAL-BROADCAST-STRATEGY.md.
 *
 * Three things this component deliberately does not do:
 *
 *   1. It never decides what is allowed. Which areas are offered comes from
 *      res_targetable_jurisdictions, and whether a target is permitted comes
 *      back from res_preview_area_audience as a block reason. The geometry
 *      check is the security boundary and it lives in SQL.
 *   2. It never builds geography client-side. A chosen area or a point plus a
 *      radius is sent to the server, which turns it into the target shape.
 *   3. It never blends the two audiences into one confident number. Residents
 *      with a home area set are counted separately from residents matched only
 *      on the suburb they typed, because a government message overstating its
 *      reach is a worse failure than an awkward sentence.
 *
 * Selecting an area re-queries the preview; the parent is told the result so
 * it can gate its own send button.
 */
import React, { useCallback, useEffect, useState } from 'react'
import { MapPin, Loader, Users, ShieldAlert, Crosshair } from 'lucide-react'
import MapSearchBox from '../map/MapSearchBox'
import type { GeocodeResult } from '../../../../utils/geocode'
import { LEVEL_LABEL, describeBlockReason, type BlockReason } from '../../../../utils/jurisdictions'
import {
  fetchTargetableAreas, previewAudience, describeAudience, canSend,
  clampRadius, describeRadius, MIN_RADIUS_M, MAX_RADIUS_M,
  type TargetableArea, type TargetMode, type AudiencePreview
} from '../../../../utils/areaTargeting'

export interface AreaTarget {
  mode: TargetMode
  jurisdictionId?: string
  lat?: number
  lon?: number
  radiusMetres?: number
  label: string
}

interface Props {
  unitId: string
  priority: string
  category?: string | null
  /** Fired whenever the target or its audience changes, so a parent can gate a send. */
  onChange?: (target: AreaTarget | null, preview: AudiencePreview | null) => void
}

const RADIUS_STEPS = [500, 1000, 3000, 5000, 10000, 25000, 50000]

export default function AreaTargetPicker({ unitId, priority, category, onChange }: Props) {
  const [areas, setAreas] = useState<TargetableArea[]>([])
  const [loadingAreas, setLoadingAreas] = useState(true)
  const [mode, setMode] = useState<TargetMode>('jurisdiction')
  const [jurisdictionId, setJurisdictionId] = useState('')
  const [point, setPoint] = useState<{ lat: number; lon: number; label: string } | null>(null)
  const [radius, setRadius] = useState(3000)
  const [preview, setPreview] = useState<AudiencePreview | null>(null)
  const [previewing, setPreviewing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoadingAreas(true)
    fetchTargetableAreas(unitId)
      .then(list => {
        if (cancelled) return
        setAreas(list)
        // Own jurisdiction first is the 90% case — "send to my whole ward" is
        // one tap, not a search.
        setJurisdictionId(list.find(a => a.isOwn)?.id || list[0]?.id || '')
      })
      .catch(() => { if (!cancelled) setAreas([]) })
      .finally(() => { if (!cancelled) setLoadingAreas(false) })
    return () => { cancelled = true }
  }, [unitId])

  const currentTarget = useCallback((): AreaTarget | null => {
    if (mode === 'jurisdiction') {
      const area = areas.find(a => a.id === jurisdictionId)
      if (!area) return null
      return { mode, jurisdictionId: area.id, label: `${area.name} (${LEVEL_LABEL[area.level]})` }
    }
    if (!point) return null
    return {
      mode,
      lat: point.lat,
      lon: point.lon,
      radiusMetres: clampRadius(radius),
      label: `Within ${describeRadius(radius)} of ${point.label}`
    }
  }, [mode, areas, jurisdictionId, point, radius])

  // Re-preview on every change to the target, the priority or the category:
  // muting is priority- and category-aware in SQL, so the headcount genuinely
  // moves when those change and a stale number would be a lie.
  useEffect(() => {
    const target = currentTarget()
    if (!target) {
      setPreview(null)
      onChange?.(null, null)
      return
    }
    let cancelled = false
    setPreviewing(true)
    setError(null)
    previewAudience({
      unitId,
      mode: target.mode,
      jurisdictionId: target.jurisdictionId,
      lat: target.lat,
      lon: target.lon,
      radiusMetres: target.radiusMetres,
      priority,
      category: category ?? null
    })
      .then(result => {
        if (cancelled) return
        setPreview(result)
        onChange?.(target, result)
      })
      .catch(err => {
        if (cancelled) return
        setPreview(null)
        onChange?.(target, null)
        setError(err instanceof Error ? err.message : 'Could not work out who this reaches.')
      })
      .finally(() => { if (!cancelled) setPreviewing(false) })
    return () => { cancelled = true }
    // onChange is a parent callback; including it would re-run this on every
    // parent render and re-hit the server for an unchanged target.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unitId, priority, category, currentTarget])

  const blocked = preview?.blockReason
    ? describeBlockReason(preview.blockReason as BlockReason)
    : null

  if (loadingAreas) {
    return (
      <p className="text-[11px] text-gray-500 flex items-center gap-2">
        <Loader size={13} className="animate-spin" /> Checking which areas this account may reach…
      </p>
    )
  }

  if (areas.length === 0) {
    return (
      <div className="flex items-start gap-2 bg-white/5 border border-white/10 rounded-lg p-3">
        <ShieldAlert size={13} className="text-gray-500 mt-0.5 shrink-0" />
        <p className="text-[10px] text-gray-400 leading-relaxed">
          This account has no official area on file, so it can only post to people who follow it.
          Area messaging is for verified councillors, municipalities and institutions.
        </p>
      </div>
    )
  }

  return (
    <div className="bg-black/30 border border-white/5 rounded-xl p-3 space-y-3">
      <div className="flex items-center gap-2">
        <MapPin size={13} className="text-gold-primary" />
        <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Send to an area</p>
      </div>

      <div className="flex gap-1.5">
        {(['jurisdiction', 'radius'] as const).map(m => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`flex-1 text-[10px] font-black uppercase tracking-widest py-2 rounded-lg transition-colors ${
              mode === m ? 'bg-gold-primary/15 text-gold-primary' : 'bg-white/5 text-gray-500 hover:text-white'
            }`}
          >
            {m === 'jurisdiction' ? 'A named area' : 'Around a place'}
          </button>
        ))}
      </div>

      {mode === 'jurisdiction' ? (
        <select
          value={jurisdictionId}
          onChange={e => setJurisdictionId(e.target.value)}
          className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
        >
          {areas.map(a => (
            <option key={a.id} value={a.id}>
              {a.name} ({LEVEL_LABEL[a.level]}){a.isOwn ? ' — your own area' : ''}
            </option>
          ))}
        </select>
      ) : (
        <div className="space-y-2">
          <MapSearchBox
            onSelect={(r: GeocodeResult) => setPoint({ lat: r.lat, lon: r.lon, label: r.label })}
          />
          {point && (
            <p className="text-[10px] text-gray-400 flex items-center gap-1.5">
              <Crosshair size={11} className="text-gold-primary shrink-0" />
              <span className="truncate">{point.label}</span>
            </p>
          )}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label htmlFor="area-radius" className="text-[9px] text-gray-600 font-black uppercase tracking-widest">
                Radius
              </label>
              <span className="text-[10px] text-white font-bold">{describeRadius(radius)}</span>
            </div>
            <input
              id="area-radius"
              type="range"
              min={MIN_RADIUS_M}
              max={MAX_RADIUS_M}
              step={50}
              value={radius}
              onChange={e => setRadius(clampRadius(Number(e.target.value)))}
              className="w-full accent-gold-primary"
            />
            <div className="flex flex-wrap gap-1">
              {RADIUS_STEPS.map(step => (
                <button
                  key={step}
                  type="button"
                  onClick={() => setRadius(step)}
                  className={`text-[9px] font-black px-2 py-1 rounded-md ${
                    radius === step ? 'bg-gold-primary/15 text-gold-primary' : 'bg-white/5 text-gray-500'
                  }`}
                >
                  {describeRadius(step)}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="border-t border-white/5 pt-3">
        {previewing ? (
          <p className="text-[11px] text-gray-500 flex items-center gap-2">
            <Loader size={13} className="animate-spin" /> Working out who this reaches…
          </p>
        ) : blocked ? (
          <p className="text-[11px] text-yellow-500 flex items-start gap-1.5">
            <ShieldAlert size={13} className="mt-0.5 shrink-0" /> {blocked}
          </p>
        ) : error ? (
          <p className="text-[11px] text-red-400">{error}</p>
        ) : (
          <p className={`text-[11px] flex items-start gap-1.5 ${canSend(preview) ? 'text-white' : 'text-gray-500'}`}>
            <Users size={13} className="mt-0.5 shrink-0 text-gold-primary" />
            <span>{describeAudience(preview)}</span>
          </p>
        )}
        {canSend(preview) && (
          <p className="text-[10px] text-gray-600 mt-1.5 leading-relaxed">
            Everyone counted here will be notified, whether or not they follow this account. Residents
            can mute this category — except emergencies, which always land.
          </p>
        )}
      </div>
    </div>
  )
}
