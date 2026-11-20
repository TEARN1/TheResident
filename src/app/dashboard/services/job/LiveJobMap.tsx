'use client'

// The live job on the Vibe Map: pick-up and drop-off pins, the road route,
// and the vehicle moving along it. Same engine and styles as VibeMap.

import React, { useEffect, useRef, useState } from 'react'
import type { Map as MlMap, Marker as MlMarker, GeoJSONSource } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { styleFor, rasterFallbackStyle } from '../../components/map/futureMapEngine'
import type { LatLon } from '../../../../utils/liveJob'

interface Props {
  pickup: LatLon | null
  dropoff: LatLon | null
  vehicle: (LatLon & { accuracyM?: number | null; heading?: number | null }) | null
  vehicleIcon: string
  line: [number, number][] | null
  /** Straight-line fallback is drawn dashed, so it never looks like a road. */
  roadRoute: boolean
  /** Keep the vehicle in the middle (the driver's view). */
  follow: boolean
  theme: 'dark' | 'light'
}

function pin(label: string, colour: string): HTMLElement {
  const el = document.createElement('div')
  el.setAttribute('role', 'img')
  el.setAttribute('aria-label', label)
  el.style.cssText = `width:34px;height:34px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${colour};border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center`
  const inner = document.createElement('span')
  inner.textContent = label === 'Pick-up' ? 'A' : 'B'
  inner.style.cssText = 'transform:rotate(45deg);font:800 13px system-ui;color:#000'
  el.appendChild(inner)
  return el
}

export default function LiveJobMap({ pickup, dropoff, vehicle, vehicleIcon, line, roadRoute, follow, theme }: Props) {
  const box = useRef<HTMLDivElement>(null)
  const map = useRef<MlMap | null>(null)
  const ready = useRef(false)
  const [mapReady, setMapReady] = useState(false)
  const markers = useRef<{ a?: MlMarker; b?: MlMarker; v?: MlMarker }>({})
  const engine = useRef<typeof import('maplibre-gl') | null>(null)
  const fitted = useRef(false)

  // Create the map once.
  useEffect(() => {
    let cancelled = false
    import('maplibre-gl').then((mod) => {
      const ml = ((mod as unknown as { default?: typeof mod }).default ?? mod) as typeof mod
      if (cancelled || !box.current) return
      engine.current = ml
      const start = vehicle || pickup || dropoff || { lat: -26.2041, lon: 28.0473 }
      const m = new ml.Map({
        container: box.current,
        style: styleFor(theme),
        center: [start.lon, start.lat],
        zoom: 13,
        attributionControl: { compact: true },
        pixelRatio: Math.min(2, window.devicePixelRatio || 1)
      })
      let fellBack = false
      m.on('error', (e) => {
        if (!fellBack && !m.isStyleLoaded() && /style/i.test(String((e as unknown as { error?: { message?: string } }).error?.message ?? ''))) {
          fellBack = true
          m.setStyle(rasterFallbackStyle(theme))
        }
      })
      m.on('load', () => {
        m.addSource('job-route', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
        m.addLayer({ id: 'job-route-casing', type: 'line', source: 'job-route', paint: { 'line-color': '#000', 'line-width': 9, 'line-opacity': 0.35 }, layout: { 'line-cap': 'round', 'line-join': 'round' } })
        m.addLayer({ id: 'job-route-line', type: 'line', source: 'job-route', paint: { 'line-color': '#d4af37', 'line-width': 5 }, layout: { 'line-cap': 'round', 'line-join': 'round' } })
        ready.current = true
        setMapReady(true)
      })
      map.current = m
    })
    return () => {
      cancelled = true
      map.current?.remove()
      map.current = null
      ready.current = false
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps -- created once; props are applied below

  // Pins, vehicle and route, whenever they change.
  useEffect(() => {
    const m = map.current
    const ml = engine.current
    if (!m || !ml) return
    const apply = () => {
      const set = (key: 'a' | 'b', p: LatLon | null, label: string, colour: string) => {
        if (!p) { markers.current[key]?.remove(); markers.current[key] = undefined; return }
        if (!markers.current[key]) markers.current[key] = new ml.Marker({ element: pin(label, colour), anchor: 'bottom' }).setLngLat([p.lon, p.lat]).addTo(m)
        else markers.current[key]!.setLngLat([p.lon, p.lat])
      }
      set('a', pickup, 'Pick-up', '#22c55e')
      set('b', dropoff, 'Drop-off', '#d4af37')

      if (vehicle) {
        if (!markers.current.v) {
          const el = document.createElement('div')
          el.setAttribute('role', 'img')
          el.setAttribute('aria-label', 'Driver')
          el.style.cssText = 'font-size:30px;line-height:1;filter:drop-shadow(0 2px 4px rgba(0,0,0,.6));transition:transform .9s linear'
          el.textContent = vehicleIcon
          markers.current.v = new ml.Marker({ element: el }).setLngLat([vehicle.lon, vehicle.lat]).addTo(m)
        } else markers.current.v.setLngLat([vehicle.lon, vehicle.lat])
      } else { markers.current.v?.remove(); markers.current.v = undefined }

      if (ready.current) {
        const src = m.getSource('job-route') as GeoJSONSource | undefined
        src?.setData({ type: 'FeatureCollection', features: line && line.length > 1 ? [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: line } }] : [] })
        m.setPaintProperty('job-route-line', 'line-dasharray', roadRoute ? [1, 0] : [2, 2])
      }

      if (follow && vehicle) m.easeTo({ center: [vehicle.lon, vehicle.lat], zoom: Math.max(m.getZoom(), 15.5), duration: 800 })
      else if (!fitted.current) {
        const pts = [pickup, dropoff, vehicle].filter(Boolean) as LatLon[]
        if (pts.length >= 2) {
          const b = new ml.LngLatBounds()
          pts.forEach((p) => b.extend([p.lon, p.lat]))
          m.fitBounds(b, { padding: 70, maxZoom: 15, duration: 0 })
          fitted.current = true
        }
      }
    }
    apply()
  }, [mapReady, pickup?.lat, pickup?.lon, dropoff?.lat, dropoff?.lon, vehicle?.lat, vehicle?.lon, line, roadRoute, follow, vehicleIcon]) // eslint-disable-line react-hooks/exhaustive-deps -- compared by value

  return <div ref={box} className="w-full h-full min-h-[320px] rounded-2xl overflow-hidden" aria-label="Live job map" role="region" />
}
