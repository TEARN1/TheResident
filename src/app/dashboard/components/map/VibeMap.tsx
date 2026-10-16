'use client'

/**
 * VibeMap — The Resident's live map, in 3D.
 *
 * MapLibre GL (WebGL) with the same engine as The Gruvs' Vibe Map
 * (futureMapEngine.ts): a neon 3D city under a dusk sky, light beams rising
 * over tonight's Gruvs events, a sonar radar round you, route arcs with sparks
 * running to what's near, warning sonar on safety alerts, a HUD and compass,
 * and a cinematic fly-in. Rooms, events and alerts are drawn on the one GPU
 * canvas (rooms cluster like before); only a capped handful of animated
 * markers are DOM, moved by CSS (futureMap.css).
 *
 * Everything the Leaflet version did is still here: GPS or ?lat=&lon=&beacon=true,
 * the SA metro hub jumps, search, the four filters, tap-to-drop with the
 * address looked up, the 5/10-minute walking rings on a room, the bottom
 * sheet, the Drop Vibe modal, dark / light / satellite basemaps with a
 * fallback, and recenter.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import 'maplibre-gl/dist/maplibre-gl.css'
import './futureMap.css'
import type { GeoJSONSource, Map as MLMap, MapGeoJSONFeature } from 'maplibre-gl'
import {
  LocateFixed, ShieldAlert, MapPin, Sparkles, Satellite, Flame, Home, Building2, Moon, Sun, Box
} from 'lucide-react'
import { useSelector } from 'react-redux'
import { RootState, type Listing } from '../../../../store'
import { fetchSharedZones, type SharedZone } from '../../../../utils/mapZones'
import { distanceMetres } from '../../../../utils/logic'
import { reverseGeocode } from '../../../../utils/geocode'
import { playTactileSound } from '../../../../utils/tactileSounds'
import MapSearchBox from './MapSearchBox'
import { fetchUpcomingGruvsEvents, formatGruvsEventWhen, type GruvsEvent } from '../../../../utils/gruvsEvents'
import { GRUVS } from '../../../../utils/sisterApps'
import VibeBottomSheet, { type VibeItem } from './VibeBottomSheet'
import QuickVibeReportModal from './QuickVibeReportModal'
import {
  PULSE_COLOR, PULSE_HEIGHT, arcPoints, distanceKm, formatDistance, isochroneFeatures, pickStreams, rankHotspots,
  type EventPulse, type LatLon,
} from '../../../../utils/futureMap'
import {
  BUILDINGS, INTERACTIVE_LAYERS, LAYER_GROUPS, applyCity, cinematicIntro, createBeams, createHazards, createPin,
  createRadar, createStreams, el, emptyFC, focusOrbit, installVibeLayers, rasterFallbackStyle, reducedMotion,
  setLayersVisible, setSourceData, styleFor, type BeamItem, type Engine, type MapTheme, type StreamRoute,
} from './futureMapEngine'

export const SA_METRO_HUBS = [
  { name: 'Braamfontein', city: 'JHB', lat: -26.1926, lon: 28.0305 },
  { name: 'Maboneng', city: 'JHB', lat: -26.2045, lon: 28.0598 },
  { name: 'Cape Town CBD', city: 'CPT', lat: -33.9249, lon: 18.4241 },
  { name: 'Observatory', city: 'CPT', lat: -33.9372, lon: 18.4715 },
  { name: 'Florida Rd', city: 'DUR', lat: -29.8398, lon: 31.0188 },
  { name: 'Hatfield', city: 'PTA', lat: -25.7516, lon: 28.2380 }
]

type VibeCategoryFilter = 'all' | 'nightlife' | 'housing' | 'safety' | 'chill'

const PULSE_LABEL: Record<EventPulse, string> = { live: 'On now', tonight: 'Tonight', soon: 'This week', later: 'Coming up' }
const MAX_BEAMS = 12
const TYPE_COLOR: Record<VibeItem['type'], string> = {
  nightlife: '#c084fc', housing: '#D4AF37', safety: '#f59e0b', chill: '#22d3ee', poi: '#38bdf8'
}

type Fx = {
  engine: Engine
  loadStyle: (theme: MapTheme) => void
  radar: ReturnType<typeof createRadar>
  me: ReturnType<typeof createPin>
  tap: ReturnType<typeof createPin>
  beams: ReturnType<typeof createBeams>
  streams: ReturnType<typeof createStreams>
  hazards: ReturnType<typeof createHazards>
}

type MapActions = {
  pickEvent: (id: string) => void
  onMapClick: (feature: MapGeoJSONFeature | undefined, coords: LatLon) => void
}

const pointFC = <P extends Record<string, unknown>>(items: { lat: number; lon: number; props: P }[]) => ({
  type: 'FeatureCollection' as const,
  features: items.map(i => ({ type: 'Feature' as const, properties: i.props, geometry: { type: 'Point' as const, coordinates: [i.lon, i.lat] } })),
})

export default function VibeMap({ fullscreen = false }: { fullscreen?: boolean }) {
  const listings = useSelector((state: RootState) => state.listings.items)

  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MLMap | null>(null)
  const fxRef = useRef<Fx | null>(null)
  const actionsRef = useRef<MapActions | null>(null)
  const compassRef = useRef<HTMLSpanElement>(null)
  const coordsRef = useRef<HTMLSpanElement>(null)
  // What the layers should show — read again whenever a style (re)loads.
  const layerDataRef = useRef({ events: emptyFC(), housing: emptyFC(), safety: emptyFC(), iso: emptyFC() })

  // State
  const [mapTheme, setMapTheme] = useState<MapTheme>('dark')
  const [show3D, setShow3D] = useState(true)
  const themeRef = useRef<MapTheme>(mapTheme)
  const show3DRef = useRef(show3D)
  const [activeVibeFilter, setActiveVibeFilter] = useState<VibeCategoryFilter>('all')
  const [center, setCenter] = useState<{ lat: number; lon: number } | null>(null)
  const [userLoc, setUserLoc] = useState<LatLon | null>(null)
  const [geoResolved, setGeoResolved] = useState(false)
  const [isGpsDefault, setIsGpsDefault] = useState(false)
  const [activeHub, setActiveHub] = useState<string | null>('Braamfontein')
  const [selectedVibeItem, setSelectedVibeItem] = useState<VibeItem | null>(null)
  const [isoCenter, setIsoCenter] = useState<LatLon | null>(null)
  const [showDropVibeModal, setShowDropVibeModal] = useState(false)
  const [gruvsEvents, setGruvsEvents] = useState<GruvsEvent[]>([])
  const [eventsAt, setEventsAt] = useState(0)
  const [sharedZones, setSharedZones] = useState<SharedZone[]>([])
  const [pendingTapCoords, setPendingTapCoords] = useState<{ lat: number; lon: number; label?: string } | null>(null)
  const [mapReady, setMapReady] = useState(false)
  // Bumped on every style load: layers were (re)installed, so re-apply visibility.
  const [styleEpoch, setStyleEpoch] = useState(0)

  const searchParams = useSearchParams()
  const queryLat = searchParams ? parseFloat(searchParams.get('lat') || '') : NaN
  const queryLon = searchParams ? parseFloat(searchParams.get('lon') || '') : NaN
  const isBeaconMode = searchParams ? searchParams.get('beacon') === 'true' : false

  // 1. Initial Geolocation (or focus directly if coordinates passed via beacon link)
  useEffect(() => {
    if (!isNaN(queryLat) && !isNaN(queryLon)) {
      setCenter({ lat: queryLat, lon: queryLon })
      setIsGpsDefault(false)
      setActiveHub(null)
      setGeoResolved(true)
      return
    }

    if (!('geolocation' in navigator)) {
      setCenter({ lat: -26.1926, lon: 28.0305 }) // Braamfontein / Joburg default
      setIsGpsDefault(true)
      setGeoResolved(true)
      return
    }

    navigator.geolocation.getCurrentPosition(
      pos => {
        const here = { lat: pos.coords.latitude, lon: pos.coords.longitude }
        setCenter(here)
        setUserLoc(here)
        setIsGpsDefault(false)
        setActiveHub(null)
        setGeoResolved(true)
      },
      () => {
        setCenter({ lat: -26.1926, lon: 28.0305 })
        setIsGpsDefault(true)
        setActiveHub('Braamfontein')
        setGeoResolved(true)
      },
      { timeout: 7000 }
    )
  }, [queryLat, queryLon])

  // 2. Fetch Gruvs events & Shared community zones
  const loadData = async (lat: number, lon: number) => {
    try {
      const [events, zones] = await Promise.all([
        fetchUpcomingGruvsEvents(60).catch(() => []),
        fetchSharedZones(lat, lon, 15000).catch(() => [])
      ])
      setGruvsEvents(events)
      setEventsAt(Date.now())
      setSharedZones(zones)
    } catch {
      // Silently handle offline or network hiccups
    }
  }

  useEffect(() => {
    if (!center) return
    loadData(center.lat, center.lon)
  }, [center])

  // 3. MapLibre lifecycle — created once geolocation resolves.
  useEffect(() => {
    if (!mapContainerRef.current || !center || !geoResolved) return
    let cancelled = false
    let teardown = () => {}
    const start = center

    import('maplibre-gl').then(mod => {
      const container = mapContainerRef.current
      if (cancelled || !container) return
      const engine = ((mod as unknown as { default?: Engine }).default ?? mod) as Engine

      const map = new engine.Map({
        container,
        style: styleFor(themeRef.current),
        center: [start.lon, start.lat],
        zoom: 11.6,
        pitch: 0,
        maxPitch: 70,
        attributionControl: { compact: true },
        // Retina is plenty; 3x phones would triple the fill cost for nothing visible.
        pixelRatio: Math.min(2, window.devicePixelRatio || 1),
        fadeDuration: 180,
      })
      mapRef.current = map

      // If the vector basemap can't load, fall back to keyless CARTO raster.
      const styleState = { pending: true, fellBack: false, timer: 0 }
      const fallBack = () => {
        if (!styleState.pending || styleState.fellBack) return
        styleState.fellBack = true
        map.setStyle(rasterFallbackStyle(themeRef.current), { diff: false })
      }
      const armTimer = () => {
        window.clearTimeout(styleState.timer)
        styleState.timer = window.setTimeout(fallBack, 12000)
      }
      armTimer()
      map.on('error', () => { if (styleState.pending) fallBack() })

      const fx: Fx = {
        engine,
        loadStyle: theme => {
          styleState.pending = true
          styleState.fellBack = false
          armTimer()
          // diff: false — a diffed switch drops our layers without firing style.load.
          map.setStyle(styleFor(theme), { diff: false })
        },
        radar: createRadar(engine, map, { color: '#38bdf8' }),
        me: createPin(engine, map, el('fm-me', '<div class="fm-me-halo"></div><div class="fm-me-core"></div>')),
        tap: createPin(engine, map, el('fm-tap', '<div class="fm-tap-body"><i></i><div class="fm-tap-core"></div></div>')),
        beams: createBeams(engine, map, { onPress: id => actionsRef.current?.pickEvent(id) }),
        streams: createStreams(engine, map),
        hazards: createHazards(engine, map),
      }
      fx.me.el.setAttribute('aria-hidden', 'true')
      fxRef.current = fx

      // If arrived via Find Me Beacon, render the glowing resident radar beacon
      let beacon: { destroy: () => void }[] = []
      if (isBeaconMode && !isNaN(queryLat) && !isNaN(queryLon)) {
        const spot = { lat: queryLat, lon: queryLon }
        const ring = createRadar(engine, map, { color: '#8EB69B', radiusM: 600 })
        ring.setLocation(spot)
        const tag = el('fm-beacon-tag', '<span aria-hidden="true">📍</span><span>Resident Beacon</span>')
        const label = createPin(engine, map, tag, { anchor: 'bottom', offset: [0, -14] })
        label.set(spot)
        beacon = [ring, label]
      }

      map.on('style.load', () => {
        styleState.pending = false
        window.clearTimeout(styleState.timer)
        try {
          installVibeLayers(map, layerDataRef.current)
          fx.streams.install()
          applyCity(map, themeRef.current, show3DRef.current)
        } catch { /* a half-loaded fallback style: the next load retries */ }
        setStyleEpoch(e => e + 1)
      })
      map.once('load', () => cinematicIntro(map, start, show3DRef.current))

      // Taps: a pin, room, cluster or alert opens it; empty ground drops a pin.
      map.on('click', e => {
        const layers = INTERACTIVE_LAYERS.filter(id => map.getLayer(id))
        const hit = layers.length ? map.queryRenderedFeatures(e.point, { layers })[0] : undefined
        actionsRef.current?.onMapClick(hit, { lat: e.lngLat.lat, lon: e.lngLat.lng })
      })
      for (const id of INTERACTIVE_LAYERS) {
        map.on('mouseenter', id, () => { map.getCanvas().style.cursor = 'pointer' })
        map.on('mouseleave', id, () => { map.getCanvas().style.cursor = '' })
      }

      // HUD: the compass turns with the map; the readout follows the centre.
      const turn = () => {
        if (compassRef.current) compassRef.current.style.transform = `rotate(${-map.getBearing()}deg)`
      }
      const readout = () => {
        const c = map.getCenter()
        if (coordsRef.current) {
          coordsRef.current.textContent = `${Math.abs(c.lat).toFixed(4)}°${c.lat < 0 ? 'S' : 'N'} ${Math.abs(c.lng).toFixed(4)}°${c.lng < 0 ? 'W' : 'E'} · Z${map.getZoom().toFixed(1)}`
        }
      }
      map.on('rotate', turn)
      map.on('moveend', readout)
      readout()

      setMapReady(true)

      teardown = () => {
        window.clearTimeout(styleState.timer)
        beacon.forEach(b => b.destroy())
        fx.radar.destroy(); fx.me.destroy(); fx.tap.destroy()
        fx.beams.destroy(); fx.streams.destroy(); fx.hazards.destroy()
        map.remove()
        mapRef.current = null
        fxRef.current = null
      }
    })

    return () => {
      cancelled = true
      teardown()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-time map creation once geolocation resolves
  }, [geoResolved])

  // 4. Basemap switch (a style switch drops custom layers; style.load re-adds them)
  const appliedThemeRef = useRef<MapTheme>(mapTheme)
  useEffect(() => {
    themeRef.current = mapTheme
    if (!mapReady || appliedThemeRef.current === mapTheme) return
    appliedThemeRef.current = mapTheme
    fxRef.current?.loadStyle(mapTheme)
  }, [mapTheme, mapReady])

  // 5. Nightlife (The Gruvs events): dots for all, light beams on the soonest.
  const hotspots = useMemo(() => rankHotspots(gruvsEvents, new Date(eventsAt || 0), Infinity), [gruvsEvents, eventsAt])
  const eventById = useMemo(() => new Map(gruvsEvents.map(ev => [ev.id, ev])), [gruvsEvents])
  const eventsFC = useMemo(
    () => pointFC(hotspots.map(h => ({ lat: h.lat, lon: h.lon, props: { id: h.id, color: PULSE_COLOR[h.pulse] } }))),
    [hotspots]
  )
  useEffect(() => {
    layerDataRef.current.events = eventsFC
    const map = mapRef.current
    if (map) setSourceData(map, 'fm-events', eventsFC)
    fxRef.current?.beams.update(hotspots.slice(0, MAX_BEAMS).map((h): BeamItem => {
      const ev = eventById.get(h.id)
      return {
        id: h.id, lat: h.lat, lon: h.lon, pulse: h.pulse,
        color: PULSE_COLOR[h.pulse], height: PULSE_HEIGHT[h.pulse],
        title: ev?.title || 'Event',
        subtitle: [PULSE_LABEL[h.pulse], ev?.venue].filter(Boolean).join(' · '),
      }
    }))
  }, [eventsFC, hotspots, eventById, mapReady, styleEpoch])

  // 6. Housing: clustered glass price pills.
  const housingFC = useMemo(() => pointFC(
    listings
      .filter(l => typeof l.lat === 'number' && typeof l.lon === 'number')
      .map(l => ({ lat: l.lat!, lon: l.lon!, props: { id: l.id, label: `${l.currency || 'R'} ${l.price.toLocaleString()}` } }))
  ), [listings])
  useEffect(() => {
    layerDataRef.current.housing = housingFC
    const map = mapRef.current
    if (map) setSourceData(map, 'fm-housing', housingFC)
  }, [housingFC, mapReady, styleEpoch])

  // 7. Safety & caution alerts, with a warning sonar on the nearest few.
  const safetyFC = useMemo(() => pointFC(sharedZones.map(z => {
    const isRoadClosed = z.kind === 'road_closed'
    return { lat: z.lat, lon: z.lon, props: { id: z.id, color: isRoadClosed ? '#ef4444' : '#f59e0b', icon: isRoadClosed ? 'fm-hazard-road' : 'fm-hazard-caution' } }
  })), [sharedZones])
  useEffect(() => {
    layerDataRef.current.safety = safetyFC
    const map = mapRef.current
    if (map) setSourceData(map, 'fm-safety', safetyFC)
    const origin = center
    const nearest = origin
      ? [...sharedZones].sort((a, b) => distanceKm(origin, a) - distanceKm(origin, b))
      : sharedZones
    fxRef.current?.hazards.update(nearest.map(z => ({ lat: z.lat, lon: z.lon, color: z.kind === 'road_closed' ? '#ef4444' : '#f59e0b' })))
  }, [safetyFC, sharedZones, center, mapReady, styleEpoch])

  // 8. Filters: show or hide whole layer groups (no rebuilding).
  useEffect(() => {
    const map = mapRef.current, fx = fxRef.current
    if (!map || !fx) return
    const show = (g: VibeCategoryFilter) => activeVibeFilter === 'all' || activeVibeFilter === g
    setLayersVisible(map, LAYER_GROUPS.nightlife, show('nightlife'))
    setLayersVisible(map, LAYER_GROUPS.housing, show('housing'))
    setLayersVisible(map, LAYER_GROUPS.safety, show('safety'))
    fx.beams.setVisible(show('nightlife'))
    fx.hazards.setVisible(show('safety'))
  }, [activeVibeFilter, mapReady, styleEpoch])

  // 9. Route streams: from you to the soonest events nearby, and to whatever you picked.
  const routes = useMemo((): StreamRoute[] => {
    if (!center) return []
    const out: StreamRoute[] = []
    if (activeVibeFilter === 'all' || activeVibeFilter === 'nightlife') {
      for (const h of pickStreams(center, hotspots)) {
        out.push({ pts: arcPoints(center, h), color: PULSE_COLOR[h.pulse], focus: selectedVibeItem?.id === h.id, km: h.km })
      }
    }
    const pick = selectedVibeItem
    if (pick && !out.some(r => r.focus)) {
      const km = distanceKm(center, pick)
      if (km > 0.03 && km <= 25) out.push({ pts: arcPoints(center, pick), color: TYPE_COLOR[pick.type], focus: true, km })
    }
    return out
  }, [center, hotspots, selectedVibeItem, activeVibeFilter])
  useEffect(() => { fxRef.current?.streams.update(routes) }, [routes, mapReady])

  // 10. Walking rings round a picked room.
  useEffect(() => {
    const iso = isochroneFeatures(isoCenter)
    layerDataRef.current.iso = iso
    const map = mapRef.current
    if (map) setSourceData(map, 'fm-iso', iso)
  }, [isoCenter, mapReady, styleEpoch])

  // 11. You: blue dot + radar sized to the 15-minute walk.
  useEffect(() => {
    fxRef.current?.radar.setLocation(userLoc)
    fxRef.current?.me.set(userLoc)
  }, [userLoc, mapReady])

  // 12. 3D buildings on/off.
  useEffect(() => {
    show3DRef.current = show3D
    const map = mapRef.current
    if (map) setLayersVisible(map, [BUILDINGS], show3D)
  }, [show3D, mapReady, styleEpoch])

  // 13. Picking something flies to it and slowly orbits until you touch the map.
  useEffect(() => {
    const map = mapRef.current, fx = fxRef.current
    if (!map || !fx) return
    fx.beams.setFocus(selectedVibeItem?.type === 'nightlife' ? selectedVibeItem.id : null)
    if (!selectedVibeItem) return
    return focusOrbit(map, selectedVibeItem, { zoom: selectedVibeItem.type === 'housing' ? 15.2 : 16.2, show3D: show3DRef.current })
  }, [selectedVibeItem, mapReady])

  // ── Picks (same cards as before) ───────────────────────────────────────
  const selectEvent = (ev: GruvsEvent) => {
    if (!center || ev.lat === undefined || ev.lon === undefined) return
    playTactileSound('pop')
    const eLat = ev.lat
    const eLon = ev.lon
    const distM = distanceMetres(center, { lat: eLat, lon: eLon })
    // Only what The Gruvs actually holds: title, venue, city, date. No
    // score, no guestlist or drink specials — none of those exist.
    const where = [ev.venue, ev.city].filter(Boolean).join(', ')
    setIsoCenter(null)
    setSelectedVibeItem({
      id: ev.id,
      type: 'nightlife',
      title: ev.title,
      subtitle: where || GRUVS.name,
      description: `${formatGruvsEventWhen(ev.startsAt, { long: true })} · listed on ${GRUVS.name}.`,
      lat: eLat,
      lon: eLon,
      badge: GRUVS.name,
      distanceLabel: formatDistance(distM),
      // A walking time is only worth quoting when walking is plausible.
      walkTimeMins: distM <= 3000 ? Math.round(distM / 80) : undefined,
      partnerLink: GRUVS.url ?? undefined
    })
  }

  const selectListing = (listing: Listing) => {
    if (!center || typeof listing.lat !== 'number' || typeof listing.lon !== 'number') return
    playTactileSound('pop')
    const spot = { lat: listing.lat, lon: listing.lon }
    const distM = distanceMetres(center, spot)
    setIsoCenter(spot) // 5- and 10-minute walking rings
    setSelectedVibeItem({
      id: listing.id,
      type: 'housing',
      title: listing.title,
      subtitle: listing.suburb || listing.location,
      description: listing.description || 'Room listing on The Resident.',
      price: listing.price,
      currency: listing.currency,
      lat: spot.lat,
      lon: spot.lon,
      // No score and no "Verified" badge: nothing here verifies a listing,
      // and a number with nothing behind it reads as a rating.
      badge: 'Room listing',
      distanceLabel: formatDistance(distM),
      walkTimeMins: Math.round(distM / 80)
    })
  }

  const selectZone = (zone: SharedZone) => {
    if (!center) return
    playTactileSound('pop')
    const isRoadClosed = zone.kind === 'road_closed'
    const distM = distanceMetres(center, zone)
    setIsoCenter(null)
    setSelectedVibeItem({
      id: zone.id,
      type: 'safety',
      title: zone.label || (isRoadClosed ? 'Road Closed' : 'Street Caution'),
      subtitle: `Reported by ${zone.source_app === 'gruvs' ? 'The Gruvs' : 'The Resident'} Resident`,
      description: zone.note || 'Reported by a resident. Take care, or choose another route.',
      lat: zone.lat,
      lon: zone.lon,
      badge: isRoadClosed ? 'Hazard Block' : 'Street Alert',
      distanceLabel: formatDistance(distM),
      walkTimeMins: Math.round(distM / 80)
    })
  }

  // Map callbacks read the latest data and handlers through this ref.
  useEffect(() => {
    actionsRef.current = {
      pickEvent: id => {
        const ev = eventById.get(id)
        if (ev) selectEvent(ev)
      },
      onMapClick: (feature, coords) => {
        const map = mapRef.current
        if (feature) {
          const id = String(feature.properties?.id ?? '')
          switch (feature.layer.id) {
            case 'fm-events-dot': {
              const ev = eventById.get(id)
              if (ev) selectEvent(ev)
              return
            }
            case 'fm-housing-pill': {
              const listing = listings.find(l => l.id === id)
              if (listing) selectListing(listing)
              return
            }
            case 'fm-safety-icon': {
              const zone = sharedZones.find(z => z.id === id)
              if (zone) selectZone(zone)
              return
            }
            case 'fm-housing-cluster': {
              playTactileSound('tab')
              const clusterId = Number(feature.properties?.cluster_id)
              const at = feature.geometry.type === 'Point' ? feature.geometry.coordinates as [number, number] : null
              const src = map?.getSource('fm-housing') as GeoJSONSource | undefined
              if (map && src && at && Number.isFinite(clusterId)) {
                src.getClusterExpansionZoom(clusterId)
                  .then(zoom => map.easeTo({ center: at, zoom: Math.min(18, zoom + 0.3), duration: reducedMotion() ? 0 : 700 }))
                  .catch(() => {})
              }
              return
            }
          }
        }

        // Empty ground: drop a glowing pin and look up the address.
        playTactileSound('pop')
        setPendingTapCoords(coords)
        fxRef.current?.tap.set(null) // re-adding restarts the drop animation
        fxRef.current?.tap.set(coords)
        reverseGeocode(coords.lat, coords.lon).then(address => {
          if (!address) return
          // Only label the pin it was asked for, not a newer one.
          setPendingTapCoords(prev => prev && prev.lat === coords.lat && prev.lon === coords.lon ? { ...prev, label: address } : prev)
        })
      },
    }
  })

  const flyTo = (spot: LatLon, zoom = 15) => {
    mapRef.current?.flyTo({
      center: [spot.lon, spot.lat], zoom,
      pitch: show3D ? 55 : 0,
      duration: reducedMotion() ? 0 : 1600,
      essential: true,
    })
  }

  // Recenter GPS Button
  const handleRecenter = () => {
    playTactileSound('click')
    if (!navigator.geolocation || !mapRef.current) return
    navigator.geolocation.getCurrentPosition(
      pos => {
        const newCoords = { lat: pos.coords.latitude, lon: pos.coords.longitude }
        setCenter(newCoords)
        setUserLoc(newCoords)
        setIsGpsDefault(false)
        setActiveHub(null)
        flyTo(newCoords)
      },
      () => {
        setIsGpsDefault(true)
      }
    )
  }

  // 1-Tap SA Metro Hub Jump
  const handleSelectHub = (hub: typeof SA_METRO_HUBS[0]) => {
    playTactileSound('tab')
    setActiveHub(hub.name)
    setCenter({ lat: hub.lat, lon: hub.lon })
    flyTo(hub)
  }

  const toggle3D = () => {
    playTactileSound('click')
    const next = !show3D
    setShow3D(next)
    mapRef.current?.easeTo({ pitch: next ? 55 : 0, bearing: next ? mapRef.current.getBearing() : 0, duration: reducedMotion() ? 0 : 900 })
  }

  const pointNorth = () => {
    playTactileSound('click')
    mapRef.current?.easeTo({ bearing: 0, duration: reducedMotion() ? 0 : 600 })
  }

  const closeSheet = () => {
    setSelectedVibeItem(null)
    setIsoCenter(null)
  }

  const counts = {
    events: hotspots.length,
    rooms: housingFC.features.length,
    alerts: sharedZones.length,
  }

  const themeButton = (theme: MapTheme, label: string, Icon: typeof Moon) => (
    <button
      onClick={() => { playTactileSound('click'); setMapTheme(theme) }}
      className={`p-2 rounded-xl text-xs font-bold transition-all ${mapTheme === theme ? 'bg-gold-primary text-black shadow-glow' : 'text-gray-400 hover:text-white'}`}
      title={label}
      aria-label={label}
      aria-pressed={mapTheme === theme}
    >
      <Icon size={16} />
    </button>
  )

  return (
    <div
      className={`fm-map relative w-full overflow-hidden ${fullscreen ? 'h-screen' : 'h-[calc(100vh-13rem)] min-h-[580px] rounded-3xl border border-white/10 shadow-glass'}`}
      // Not `data-theme`: that attribute is the app's palette switch (globals.css).
      data-map-theme={mapTheme}
    >
      {/* Map Target Canvas */}
      {/* Sized by width/height, not `absolute inset-0`: maplibre-gl.css makes the container position: relative. */}
      <div ref={mapContainerRef} className="w-full h-full" role="region" aria-label="Vibe map" />

      {/* HUD: vignette, faint grid, scan line, corner brackets */}
      <div className="fm-hud" aria-hidden="true">
        <div className="fm-hud-vignette" />
        {mapTheme !== 'light' && <div className="fm-hud-grid" />}
        <div className="fm-hud-scan" />
        <i className="fm-hud-c tl" /><i className="fm-hud-c tr" /><i className="fm-hud-c bl" /><i className="fm-hud-c br" />
      </div>

      {/* Boot screen until the first style has loaded */}
      {styleEpoch === 0 && (
        <div className="absolute inset-0 z-[3] flex items-center justify-center pointer-events-none">
          <div className="fm-glass flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-black/70 border border-white/10 text-[11px] font-black uppercase tracking-[0.18em] text-gray-200">
            <span className="fm-live-dot" style={{ background: '#22d3ee', boxShadow: '0 0 10px #22d3ee' }} />
            {geoResolved ? 'Rendering 3D city' : 'Locating you'}
          </div>
        </div>
      )}

      {/* Top Floating Control Bar */}
      {/* Fullscreen: the community page puts its Exit button top-left, so start after it. */}
      <div className={`absolute top-4 ${fullscreen ? 'left-[92px]' : 'left-4'} right-4 z-[500] flex flex-col gap-2.5 pointer-events-none`}>
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 w-full">
          {/* Search Input Box */}
          <div className="w-full sm:w-80 pointer-events-auto fm-rise">
            <MapSearchBox
              onSelect={(result) => {
                playTactileSound('tab')
                setActiveHub(null)
                setCenter({ lat: result.lat, lon: result.lon })
                flyTo(result)
              }}
            />
          </div>

        {/* Vibe Category Filter Pills */}
        <div className="fm-glass fm-rise flex items-center gap-1.5 bg-black/70 p-1.5 rounded-2xl border border-white/15 shadow-2xl overflow-x-auto max-w-full pointer-events-auto no-scrollbar" style={{ ['--fm-i' as string]: 1 }}>
          <button
            onClick={() => { playTactileSound('tab'); setActiveVibeFilter('all') }}
            aria-pressed={activeVibeFilter === 'all'}
            className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 shrink-0 ${
              activeVibeFilter === 'all'
                ? 'bg-gold-primary text-black shadow-glow'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Sparkles size={13} />
            <span>All Vibes</span>
          </button>

          <button
            onClick={() => { playTactileSound('tab'); setActiveVibeFilter('nightlife') }}
            aria-pressed={activeVibeFilter === 'nightlife'}
            className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 shrink-0 ${
              activeVibeFilter === 'nightlife'
                ? 'bg-purple-600 text-white shadow-[0_0_15px_rgba(168,85,247,0.5)]'
                : 'text-purple-300 hover:text-white hover:bg-purple-950/40'
            }`}
          >
            <Flame size={13} className="text-purple-400" />
            <span>Nightlife</span>
          </button>

          <button
            onClick={() => { playTactileSound('tab'); setActiveVibeFilter('housing') }}
            aria-pressed={activeVibeFilter === 'housing'}
            className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 shrink-0 ${
              activeVibeFilter === 'housing'
                ? 'bg-amber-500 text-black shadow-glow'
                : 'text-amber-300 hover:text-white hover:bg-amber-950/40'
            }`}
          >
            <Home size={13} className="text-amber-400" />
            <span>Rooms</span>
          </button>

          <button
            onClick={() => { playTactileSound('tab'); setActiveVibeFilter('safety') }}
            aria-pressed={activeVibeFilter === 'safety'}
            className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 shrink-0 ${
              activeVibeFilter === 'safety'
                ? 'bg-red-600 text-white shadow-[0_0_15px_rgba(239,68,68,0.5)]'
                : 'text-red-300 hover:text-white hover:bg-red-950/40'
            }`}
          >
            <ShieldAlert size={13} className="text-red-400" />
            <span>Safety</span>
          </button>
        </div>
      </div>

      {/* SA Metro Hubs Quick Jump Bar */}
      <div className="w-full flex items-center justify-between gap-2 pointer-events-auto">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
          <span className="fm-glass text-[10px] font-black uppercase tracking-wider text-gray-300 shrink-0 flex items-center gap-1 bg-black/60 px-2.5 py-1 rounded-xl border border-white/10">
            <Building2 size={12} className="text-gold-primary" /> Metro:
          </span>
          {SA_METRO_HUBS.map((hub, i) => (
            <button
              key={hub.name}
              onClick={() => handleSelectHub(hub)}
              aria-pressed={activeHub === hub.name}
              style={{ ['--fm-i' as string]: i + 2 }}
              className={`fm-rise px-2.5 py-1 rounded-xl text-[11px] font-bold tracking-tight shrink-0 transition-all border ${
                activeHub === hub.name
                  ? 'bg-gold-primary text-black border-gold-primary shadow-glow font-black'
                  : 'fm-glass bg-black/65 text-gray-300 border-white/10 hover:border-white/30 hover:text-white'
              }`}
            >
              {hub.name} <span className="text-[9px] opacity-70">({hub.city})</span>
            </button>
          ))}
        </div>

        {isGpsDefault && (
          <div className="hidden lg:flex items-center gap-1.5 bg-amber-400/10 border border-amber-400/25 px-2.5 py-1 rounded-xl text-[10px] text-amber-300 font-bold shrink-0 backdrop-blur-xl">
            <span>📍 Showing default hub. Tap GPS to locate.</span>
          </div>
        )}
      </div>
    </div>

      {/* Telemetry: what's on the map, and where the map is looking */}
      <div className="hidden md:block absolute left-4 bottom-[76px] z-[500] pointer-events-none">
        <div className="fm-glass fm-telemetry flex items-center gap-2.5 px-3 py-2 rounded-xl bg-black/65 border border-white/10 text-gray-200">
          <span className="fm-live-dot" aria-hidden="true" />
          <span>{counts.events} EVENTS · {counts.rooms} ROOMS · {counts.alerts} ALERTS</span>
          <span className="text-gray-600" aria-hidden="true">|</span>
          <span ref={coordsRef} className="text-gray-400" />
        </div>
      </div>

      {/* Floating Bottom Left: Drop Vibe CTA */}
      <div className="absolute bottom-20 md:bottom-5 left-4 z-[500] flex items-center gap-2">
        <button
          onClick={() => {
            playTactileSound('pop')
            setShowDropVibeModal(true)
          }}
          className="px-4 py-3 rounded-2xl bg-gradient-to-r from-gold-primary to-amber-500 text-black font-black text-xs uppercase tracking-wider shadow-[0_0_30px_rgb(var(--accent)/0.4)] hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
        >
          <Sparkles size={16} />
          <span>+ Drop Vibe</span>
        </button>

        {pendingTapCoords?.label && (
          <div className="fm-glass hidden md:flex items-center gap-2 bg-black/70 border border-white/10 px-3 py-2 rounded-2xl text-[11px] text-gray-300 max-w-xs truncate">
            <MapPin size={13} className="text-gold-primary shrink-0" />
            <span className="truncate">{pendingTapCoords.label}</span>
          </div>
        )}
      </div>

      {/* Floating Bottom Right: Map & Position Controls */}
      <div className="absolute bottom-20 md:bottom-12 right-4 z-[500] flex flex-col items-end gap-2.5">
        {/* Basemap Switcher (Neon / Day / Satellite) */}
        <div className="fm-glass bg-black/70 border border-white/10 rounded-2xl p-1 shadow-2xl flex flex-col gap-1">
          {themeButton('dark', 'Neon Night Map', Moon)}
          {themeButton('light', 'Day Map', Sun)}
          {themeButton('satellite', 'Satellite Imagery', Satellite)}
        </div>

        {/* 3D city on/off */}
        <button
          onClick={toggle3D}
          className={`fm-glass p-3 border rounded-2xl shadow-2xl transition-all active:scale-95 flex items-center justify-center ${show3D ? 'bg-gold-primary/15 border-gold-primary/50 text-gold-primary' : 'bg-black/70 border-white/10 text-gray-300 hover:text-white'}`}
          title={show3D ? 'Flat 2D map' : '3D city'}
          aria-label={show3D ? 'Switch to a flat 2D map' : 'Switch to the 3D city'}
          aria-pressed={show3D}
        >
          <Box size={18} />
        </button>

        {/* Compass: turns with the map, tap for north up */}
        <button
          onClick={pointNorth}
          className="fm-glass p-3 bg-black/70 border border-cyan-300/30 rounded-2xl shadow-[0_0_16px_rgba(0,242,255,0.18)] transition-all active:scale-95 flex items-center justify-center"
          title="Point the map north"
          aria-label="Point the map north"
        >
          <span ref={compassRef} className="fm-compass-dial" aria-hidden="true">
            <span className="fm-compass-n">N</span>
            <span className="fm-compass-needle" />
          </span>
        </button>

        {/* GPS Locate Me */}
        <button
          onClick={handleRecenter}
          className="fm-glass p-3 bg-black/70 hover:bg-black border border-white/10 text-gold-primary hover:text-white rounded-2xl shadow-2xl transition-all active:scale-95 flex items-center justify-center"
          title="Recenter to My GPS Location"
          aria-label="Recenter to My GPS Location"
        >
          <LocateFixed size={18} />
        </button>
      </div>

      {/* Interactive Bottom Sheet POI Details */}
      <VibeBottomSheet item={selectedVibeItem} onClose={closeSheet} />

      {/* Quick Vibe Dropper Modal */}
      <QuickVibeReportModal
        isOpen={showDropVibeModal}
        onClose={() => setShowDropVibeModal(false)}
        currentCoords={pendingTapCoords || center}
        onReportSuccess={() => {
          if (center) loadData(center.lat, center.lon)
        }}
      />
    </div>
  )
}
