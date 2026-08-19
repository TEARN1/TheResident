'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import 'leaflet/dist/leaflet.css'
import { Navigation, LocateFixed, Maximize, RefreshCw, Check, X, ShieldAlert, MapPin, Bell, Layers, Plus, Minus, Ban, Loader, Sun, Moon } from 'lucide-react'
import { useSelector } from 'react-redux'
import { RootState, isGuestUser } from '../../../store'
import { fetchSharedZones, verifyZone, reportZone, type SharedZone, type ReportableZoneKind } from '../../../utils/mapZones'
import { fetchSavedPins, saveNewPin, deleteSavedPin, type SavedPin } from '../../../utils/savedPins'
import { distanceMetres } from '../../../utils/logic'
import {
  fetchPlacesNear, visiblePlaces, countByKind, clusterPlaces, clusterCellFor,
  PLACE_ORDER, PLACE_LABEL, PLACE_COLOR, DEFAULT_VISIBLE,
  type Place
} from '../../../utils/mapPlaces'
import { formatDistance } from '../../../utils/measure'
import { searchPlaces, type GeocodeResult } from '../../../utils/geocode'
import MapSearchBox from './MapSearchBox'
import SavedPinsPanel from './SavedPinsPanel'
import DistanceMatrixPanel, { type MatrixPoint } from './DistanceMatrixPanel'
import LiveLocationToggle from './LiveLocationToggle'

// Colour by kind — matches map_zones' shared CHECK constraint
// (road_closed, heavy_traffic, detour, no_parking, route, zone, alert).
const KIND_COLOR: Record<string, string> = {
  road_closed: '#ef4444',
  heavy_traffic: '#f59e0b',
  detour: '#f59e0b',
  no_parking: '#3b82f6',
  alert: '#ef4444',
  route: '#22c55e',
  zone: '#D4AF37'
}

const KIND_LABEL: Record<string, string> = {
  road_closed: 'Road closed',
  heavy_traffic: 'Heavy traffic',
  detour: 'Detour',
  no_parking: 'No parking',
  alert: 'Safety alert',
  route: 'Route',
  zone: 'Zone'
}

// What a resident is allowed to report directly, and how long each option's
// window lasts. Kept small and predictable rather than a free-text duration
// field — "8 hours" and "3 days" cover almost every real closure; a rare
// longer one can be re-reported once it lapses.
const REPORTABLE_KINDS: Array<{ kind: ReportableZoneKind; label: string }> = [
  { kind: 'road_closed', label: 'Road closed' },
  { kind: 'detour', label: 'Detour' },
  { kind: 'heavy_traffic', label: 'Heavy traffic' },
  { kind: 'no_parking', label: 'No parking' }
]
const DURATION_OPTIONS: Array<{ hours: number; label: string }> = [
  { hours: 1, label: '1 hour' },
  { hours: 4, label: '4 hours' },
  { hours: 8, label: '8 hours' },
  { hours: 24, label: '24 hours' },
  { hours: 72, label: '3 days' },
  { hours: 168, label: '1 week' },
  { hours: 336, label: '2 weeks (max)' }
]

type Drawer = 'none' | 'pins' | 'matrix' | 'geofence'

// Place titles are user-supplied and go into a Leaflet popup as raw HTML,
// so they are escaped here rather than trusted. src/utils/security.ts covers
// the app's own inputs; this is the map's own last step before innerHTML.
const escapeHtml = (v: string): string =>
  v.replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))

export default function VibeMap({ fullscreen = false }: { fullscreen?: boolean }) {
  const searchParams = useSearchParams()
  const currentUser = useSelector((state: RootState) => state.auth.currentUser)
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<import('leaflet').Map | null>(null)
  const markersRef = useRef<import('leaflet').LayerGroup | null>(null)
  const searchMarkerRef = useRef<import('leaflet').LayerGroup | null>(null)
  const pinsLayerRef = useRef<import('leaflet').LayerGroup | null>(null)
  const liveMarkerRef = useRef<import('leaflet').LayerGroup | null>(null)
  const placesLayerRef = useRef<import('leaflet').LayerGroup | null>(null)
  const leafletRef = useRef<typeof import('leaflet') | null>(null)
  const tileLayerRef = useRef<import('leaflet').TileLayer | null>(null)

  // The map used to be locked to CARTO's light "Voyager" basemap — a bright
  // white rectangle sitting in the middle of an otherwise all-dark app.
  // Dark Matter is the same OSM data via CARTO's dark render, so this is a
  // reskin, not a different data source. Defaults to dark to match the rest
  // of the UI; Voyager stays available for anyone who finds streets/labels
  // easier to read on light.
  const [mapTheme, setMapTheme] = useState<'dark' | 'light'>('dark')
  const TILE_SOURCES: Record<'dark' | 'light', string> = {
    dark: 'https://{s}.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}{r}.png',
    light: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png'
  }

  const [center, setCenter] = useState<{ lat: number; lon: number } | null>(null)
  const [locationDenied, setLocationDenied] = useState(false)
  const [zones, setZones] = useState<SharedZone[]>([])
  const [loading, setLoading] = useState(false)
  const [voteError, setVoteError] = useState<string | null>(null)
  // Visible by default — a color-coded map with the legend hidden behind a
  // toggle just reads as a wash of same-ish dots; showing it up front is
  // what actually makes the color-by-kind strategy legible.
  const [showLegend, setShowLegend] = useState(true)
  const [drawer, setDrawer] = useState<Drawer>('none')

  // The legend used to be pure decoration — a static color key with no way
  // to act on it. Now each row is a real filter: unchecking "Heavy traffic"
  // actually hides those markers, and "Confirmed only" cuts noise from
  // unverified reports. Defaults to everything visible (opt-out, not opt-in),
  // so a first-time visitor sees the full picture before narrowing it down.
  const [activeKinds, setActiveKinds] = useState<Set<string>>(new Set(Object.keys(KIND_LABEL)))
  const [confirmedOnly, setConfirmedOnly] = useState(false)
  // Bumped on every pan/zoom so the legend's per-kind counts can reflect
  // "what's on screen right now" instead of the whole 15km fetch radius —
  // a count that never changes as you zoom in isn't telling you anything.
  const [boundsTick, setBoundsTick] = useState(0)

  // The places layer: the permanent half of the map. map_zones answers
  // "what is wrong here right now"; this answers "what is here at all" —
  // rooms, spaza shops, water points, wifi, generators. Sixteen tables in
  // this app carry coordinates and until now the map showed one of them.
  const [places, setPlaces] = useState<Place[]>([])
  const [activePlaceKinds, setActivePlaceKinds] = useState<Set<string>>(
    new Set(DEFAULT_VISIBLE))

  const [pendingPoint, setPendingPoint] = useState<{ label: string; lat: number; lon: number } | null>(null)
  const [savedPins, setSavedPins] = useState<SavedPin[]>([])
  const [pinsLoading, setPinsLoading] = useState(false)

  const [matrixPoints, setMatrixPoints] = useState<MatrixPoint[]>([])
  const [alertRadiusM, setAlertRadiusM] = useState(500)
  const [livePosition, setLivePosition] = useState<{ lat: number; lon: number; accuracy?: number } | null>(null)
  const [locationSharing, setLocationSharing] = useState(false)
  const [locating, setLocating] = useState(false)

  // Report-a-closure form, opened from the pending-point action card.
  const [showReportForm, setShowReportForm] = useState(false)
  const [reportKind, setReportKind] = useState<ReportableZoneKind>('road_closed')
  const [reportDurationHours, setReportDurationHours] = useState(8)
  const [reportNote, setReportNote] = useState('')
  const [reportSubmitting, setReportSubmitting] = useState(false)
  const [reportError, setReportError] = useState<string | null>(null)

  const currentUserId = !isGuestUser(currentUser) && currentUser ? currentUser.id : null

  const refreshSavedPins = async () => {
    if (!currentUserId) { setSavedPins([]); return }
    setPinsLoading(true)
    const pins = await fetchSavedPins()
    setSavedPins(pins)
    setPinsLoading(false)
  }

  useEffect(() => {
    refreshSavedPins()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserId])

  const geofenceHits = savedPins.flatMap(pin =>
    zones
      .filter(z => distanceMetres(pin, z) <= alertRadiusM)
      .map(z => ({ pin, zone: z }))
  )

  // What the legend/filter row and the marker layer both agree is "on the
  // map right now" — kept in one place so the legend's counts and what
  // actually renders can never drift apart. Memoized so toggling an
  // unrelated bit of UI state doesn't tear down and rebuild every marker.
  const filteredZones = useMemo(() => zones.filter(z => {
    if (!activeKinds.has(z.kind)) return false
    if (confirmedOnly && z.status !== 'confirmed' && z.status !== 'official') return false
    return true
  }), [zones, activeKinds, confirmedOnly])

  const toggleKind = (kind: string) => {
    setActiveKinds(prev => {
      const next = new Set(prev)
      if (next.has(kind)) next.delete(kind); else next.add(kind)
      return next
    })
  }

  // Reference point for "how far is this from me" in each popup — a live
  // GPS fix if the user has one running, otherwise wherever the map is
  // centred (their approximate location or a searched place).
  const distanceOrigin = livePosition || center

  // A "Directions" link elsewhere in the app (listings, services) routes here
  // as /dashboard/community?tab=vibemap&place=<address> rather than deep-linking
  // out to Google Maps — the shared zone reports, saved pins and geofence
  // alerts only exist on our own map, so handing the user to an external app
  // drops every layer that makes this map worth opening.
  const focusPlace = searchParams.get('place')

  useEffect(() => {
    // An explicit place from the URL wins over "where am I" — otherwise the
    // geolocation callback would land and yank the view back off the address
    // the user actually asked to see.
    if (focusPlace) return
    if (!('geolocation' in navigator)) {
      setLocationDenied(true)
      return
    }
    navigator.geolocation.getCurrentPosition(
      pos => setCenter({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => setLocationDenied(true),
      { timeout: 8000 }
    )
  }, [focusPlace])

  useEffect(() => {
    if (!focusPlace) return
    let cancelled = false
    searchPlaces(focusPlace).then(results => {
      if (cancelled || results.length === 0) return
      const hit = results[0]
      setCenter({ lat: hit.lat, lon: hit.lon })
      setPendingPoint({ label: hit.label, lat: hit.lat, lon: hit.lon })
    })
    return () => { cancelled = true }
  }, [focusPlace])

  const togglePlaceKind = (kind: string) => {
    setActivePlaceKinds(prev => {
      const next = new Set(prev)
      if (next.has(kind)) next.delete(kind)
      else next.add(kind)
      return next
    })
  }

  const loadZones = async (lat: number, lon: number) => {
    setLoading(true)
    // Both layers in one round trip. A places outage degrades the map rather
    // than breaking it — fetchPlacesNear returns [] on error, same as zones.
    const [zoneData, placeData] = await Promise.all([
      fetchSharedZones(lat, lon, 15000),
      fetchPlacesNear(lat, lon, 15000)
    ])
    setZones(zoneData)
    setPlaces(placeData)
    setLoading(false)
  }

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return

    const startLat = center?.lat ?? 20
    const startLon = center?.lon ?? 0
    const startZoom = center ? 14 : 2

    let cancelled = false
    import('leaflet').then(L => {
      if (cancelled || !mapContainerRef.current || mapRef.current) return
      leafletRef.current = L

      const map = L.map(mapContainerRef.current, { zoomControl: false }).setView([startLat, startLon], startZoom)
      // CARTO's basemaps, not tile.openstreetmap.org directly: same underlying
      // OSM street data, but CARTO's own render pipeline refreshes far more
      // often — tile.openstreetmap.org is OSM's lightweight demo server, it
      // renders under-mapped areas infrequently, and production hotlinking it
      // is against OSM's own tile usage policy. No API key required.
      tileLayerRef.current = L.tileLayer(TILE_SOURCES[mapTheme], {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        // CARTO's raster tiles are only rendered up to z19 (maxNativeZoom) —
        // past that Leaflet upscales the z19 tile instead of requesting a
        // tile that doesn't exist. Letting the map itself go to z21 gets the
        // scale bar down to roughly street-width (~10m) for road-closure
        // reports, where "which side of the road" actually matters.
        maxZoom: 21,
        maxNativeZoom: 19,
        subdomains: 'abcd'
      }).addTo(map)

      markersRef.current = L.layerGroup().addTo(map)
      searchMarkerRef.current = L.layerGroup().addTo(map)
      pinsLayerRef.current = L.layerGroup().addTo(map)
      liveMarkerRef.current = L.layerGroup().addTo(map)
      placesLayerRef.current = L.layerGroup().addTo(map)
      mapRef.current = map

      // Minimum zoom for a report pin to be trustworthy: at zoom 15 the scale
      // bar reads roughly 300m — any looser than that and a "road closed"
      // pin could land on the wrong street entirely. Clicking while zoomed
      // out further re-centres and zooms in on the clicked point instead of
      // dropping the pin at an unreliable location.
      const MIN_REPORT_ZOOM = 15
      map.on('click', (e: import('leaflet').LeafletMouseEvent) => {
        setShowReportForm(false)
        setReportError(null)
        setPendingPoint({ label: `Dropped pin (${e.latlng.lat.toFixed(4)}, ${e.latlng.lng.toFixed(4)})`, lat: e.latlng.lat, lon: e.latlng.lng })
        if (map.getZoom() < MIN_REPORT_ZOOM) {
          map.setView(e.latlng, MIN_REPORT_ZOOM)
        }
      })

      // Drives the legend's "in view" counts (see boundsTick) and gives a
      // real sense of real-world distance while panning/zooming.
      map.on('moveend zoomend', () => setBoundsTick(t => t + 1))
      L.control.scale({ imperial: false, position: 'bottomleft' }).addTo(map)

      if (center) loadZones(center.lat, center.lon)
    })

    return () => { cancelled = true }
  }, [center])

  // Swaps tiles in place via setUrl rather than tearing down/recreating the
  // layer — the map itself, its zoom/pan state, and every marker layer stay
  // untouched, only the underlying imagery changes.
  useEffect(() => {
    tileLayerRef.current?.setUrl(TILE_SOURCES[mapTheme])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapTheme])

  useEffect(() => {
    if (!center || !mapRef.current) return
    mapRef.current.setView([center.lat, center.lon], 14)
    loadZones(center.lat, center.lon)
  }, [center])

  // Places render underneath the hazard layer, deliberately: a burst pipe must
  // never be hidden behind a spaza shop pin.
  useEffect(() => {
    const L = leafletRef.current
    const layer = placesLayerRef.current
    const map = mapRef.current
    if (!L || !layer || !map) return
    layer.clearLayers()

    const zoom = map.getZoom()
    const shown = visiblePlaces(places, activePlaceKinds)
    const clusters = clusterPlaces(shown, clusterCellFor(zoom))

    clusters.forEach(cluster => {
      const head = cluster.places[0]
      const extra = cluster.places.length - 1
      const color = PLACE_COLOR[head.kind] ?? '#94a3b8'

      // A community is an area, not a point. radius_m has been sitting in the
      // schema since day one waiting for something to draw it.
      if (head.kind === 'community' && head.radiusM && extra === 0) {
        L.circle([head.lat, head.lon], {
          radius: head.radiusM, color, weight: 1,
          opacity: 0.5, fillColor: color, fillOpacity: 0.05
        }).addTo(layer)
      }

      const marker = extra > 0
        ? L.circleMarker([cluster.lat, cluster.lon], {
            radius: Math.min(9 + cluster.places.length, 18),
            color: '#0f172a', weight: 2, fillColor: color, fillOpacity: 0.85
          })
        : L.circleMarker([cluster.lat, cluster.lon], {
            radius: 6, color: '#0f172a', weight: 1.5,
            fillColor: color, fillOpacity: 0.9
          })

      const distance = livePosition
        ? formatDistance(distanceMetres(
            { lat: livePosition.lat, lon: livePosition.lon },
            { lat: head.lat, lon: head.lon }))
        : null

      const rows = cluster.places.slice(0, 6).map(pl => {
        const label = PLACE_LABEL[pl.kind] ?? pl.kind
        const sub = pl.subtitle ? ` — ${pl.subtitle}` : ''
        return `<div style="margin:2px 0"><b>${escapeHtml(pl.title)}</b><br/>` +
               `<span style="opacity:.7;font-size:11px">${label}${escapeHtml(sub)}</span></div>`
      }).join('')

      marker.bindPopup(
        rows +
        (cluster.places.length > 6
          ? `<div style="opacity:.7;font-size:11px">+${cluster.places.length - 6} more — zoom in</div>`
          : '') +
        (distance ? `<div style="opacity:.7;font-size:11px">${distance} away</div>` : '')
      )
      marker.addTo(layer)
    })
  }, [places, activePlaceKinds, boundsTick, livePosition])

  useEffect(() => {
    const L = leafletRef.current
    const group = markersRef.current
    if (!L || !group) return
    group.clearLayers()

    const now = Date.now()

    filteredZones.forEach(zone => {
      const color = KIND_COLOR[zone.kind] || '#D4AF37'
      const isGeofenceHit = geofenceHits.some(h => h.zone.id === zone.id)
      // A report with more disputes than confirmations shouldn't read as
      // trustworthy as one the community has backed up — flagged the same
      // way a geofence hit is (a pulsing outer ring), so "this is contested"
      // is visible before anyone opens the popup to read the raw counts.
      const isContested = zone.disputeCount > 0 && zone.disputeCount >= zone.confirmCount

      if (isGeofenceHit) {
        L.circleMarker([zone.lat, zone.lon], {
          radius: 16 + zone.severity * 2,
          color: '#ef4444',
          fillColor: '#ef4444',
          fillOpacity: 0.12,
          weight: 2,
          className: 'res-geofence-pulse'
        }).addTo(group)
      } else if (isContested) {
        L.circleMarker([zone.lat, zone.lon], {
          radius: 14 + zone.severity * 2,
          color: '#a855f7',
          fillColor: '#a855f7',
          fillOpacity: 0.1,
          weight: 1.5,
          dashArray: '4 3',
          className: 'res-geofence-pulse'
        }).addTo(group)
      }

      const isVerified = zone.status === 'confirmed' || zone.status === 'official'

      // Fade toward the last 2 hours before a report's own end time instead
      // of it just vanishing outright once expired — a report that's about
      // to clear should visibly read as "on its way out", not identical to
      // one that just went up.
      const FADE_WINDOW_MS = 2 * 60 * 60 * 1000
      let expiryFactor = 1
      if (zone.endsAt) {
        const msLeft = new Date(zone.endsAt).getTime() - now
        if (msLeft <= 0) expiryFactor = 0.3
        else if (msLeft < FADE_WINDOW_MS) expiryFactor = 0.4 + 0.6 * (msLeft / FADE_WINDOW_MS)
      }

      // A soft, borderless halo under every marker (not just geofence hits)
      // so the map reads as colored zones of activity rather than a scatter
      // of same-size dots — the halo is what carries the "strategy of color"
      // at a glance, before anyone reads a popup or the legend.
      L.circleMarker([zone.lat, zone.lon], {
        radius: (8 + zone.severity * 2) * 2.2,
        color: 'transparent',
        fillColor: color,
        fillOpacity: (isVerified ? 0.16 : 0.09) * expiryFactor,
        weight: 0,
        interactive: false
      }).addTo(group)

      const marker = L.circleMarker([zone.lat, zone.lon], {
        radius: 8 + zone.severity * 2,
        color: isVerified ? '#ffffff' : color,
        fillColor: color,
        fillOpacity: (isVerified ? 0.95 : 0.55) * expiryFactor,
        weight: isVerified ? 2.5 : 2
      })

      const sourceLabel = zone.source_app === 'gruvs' ? 'The Gruvs' : 'The Resident'
      const expiry = zone.endsAt
        ? new Date(zone.endsAt).toLocaleString(undefined, { weekday: 'short', hour: '2-digit', minute: '2-digit' })
        : null
      const distanceLabel = distanceOrigin
        ? (() => {
            const m = distanceMetres(distanceOrigin, zone)
            return m < 1000 ? `${Math.round(m)}m away` : `${(m / 1000).toFixed(1)}km away`
          })()
        : null
      const popupId = `zone-popup-${zone.id}`
      marker.bindPopup(`
        <div style="font-family:inherit;min-width:190px">
          <div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px">
            <strong>${KIND_LABEL[zone.kind] || zone.kind}</strong>
            ${distanceLabel ? `<span style="font-size:0.75em;opacity:0.6;white-space:nowrap">${distanceLabel}</span>` : ''}
          </div>
          ${zone.label ? `<div>${zone.label}</div>` : ''}
          ${zone.note ? `<div style="opacity:0.7;font-size:0.85em;margin-top:4px">${zone.note}</div>` : ''}
          ${expiry ? `<div style="font-size:0.75em;margin-top:6px;color:${expiryFactor < 1 ? '#f59e0b' : '#D4AF37'}">${now >= new Date(zone.endsAt as string).getTime() ? 'Cleared' : 'Clears by'} ${expiry}</div>` : ''}
          <div style="font-size:0.75em;opacity:0.6;margin-top:6px">
            Reported via ${sourceLabel} · ${zone.status}
          </div>
          <div style="font-size:0.75em;margin-top:4px;${isContested ? 'color:#c084fc;font-weight:600' : ''}">
            ✓ ${zone.confirmCount} confirmed &nbsp; ✗ ${zone.disputeCount} disputed${isContested ? ' — contested' : ''}
          </div>
          <div id="${popupId}" style="display:flex;gap:6px;margin-top:8px"></div>
        </div>
      `)

      marker.on('popupopen', () => {
        const container = document.getElementById(popupId)
        if (!container) return
        container.innerHTML = ''

        if (isGuestUser(currentUser)) {
          const note = document.createElement('span')
          note.textContent = 'Sign in to confirm or dispute this.'
          note.style.opacity = '0.6'
          note.style.fontSize = '0.75em'
          container.appendChild(note)
          return
        }

        const makeBtn = (text: string, vote: 'confirm' | 'dispute') => {
          const btn = document.createElement('button')
          btn.textContent = text
          btn.style.cssText = 'flex:1;padding:4px 8px;border-radius:6px;border:1px solid #D4AF37;background:transparent;color:#D4AF37;font-size:0.75em;cursor:pointer'
          btn.onclick = async () => {
            btn.disabled = true
            try {
              await verifyZone(zone.id, vote)
              setVoteError(null)
              if (center) loadZones(center.lat, center.lon)
              marker.closePopup()
            } catch (err) {
              setVoteError(err instanceof Error ? err.message : 'Could not record your vote')
            }
          }
          return btn
        }

        container.appendChild(makeBtn('Confirm', 'confirm'))
        container.appendChild(makeBtn('Dispute', 'dispute'))
      })

      marker.addTo(group)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredZones, currentUser, savedPins, alertRadiusM, distanceOrigin])

  useEffect(() => {
    const L = leafletRef.current
    const layer = searchMarkerRef.current
    if (!L || !layer) return
    layer.clearLayers()
    if (!pendingPoint) return

    L.marker([pendingPoint.lat, pendingPoint.lon], {
      icon: L.divIcon({
        className: '',
        html: `<div style="width:16px;height:16px;border-radius:50%;background:#22c55e;border:2px solid white;box-shadow:0 0 0 4px rgba(34,197,94,0.25)"></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8]
      })
    }).bindPopup(pendingPoint.label).addTo(layer).openPopup()
  }, [pendingPoint])

  useEffect(() => {
    const L = leafletRef.current
    const layer = pinsLayerRef.current
    if (!L || !layer) return
    layer.clearLayers()

    savedPins.forEach(pin => {
      L.marker([pin.lat, pin.lon], {
        icon: L.divIcon({
          className: '',
          html: `<div style="width:14px;height:14px;border-radius:4px;background:#D4AF37;border:2px solid white;transform:rotate(45deg)"></div>`,
          iconSize: [14, 14],
          iconAnchor: [7, 7]
        })
      }).bindPopup(`<strong>${pin.label}</strong>`).addTo(layer)
    })
  }, [savedPins])

  useEffect(() => {
    const L = leafletRef.current
    const layer = liveMarkerRef.current
    if (!L || !layer) return
    layer.clearLayers()
    if (!livePosition) return

    // A dot with a fixed 6px glow implies pinpoint precision the Geolocation
    // API never actually provides. Drawing the browser's own reported
    // accuracy as a real, to-scale circle (pos.coords.accuracy, metres) is
    // the honest version — the dot is where you probably are, the circle is
    // how sure the device actually is.
    if (livePosition.accuracy && Number.isFinite(livePosition.accuracy)) {
      L.circle([livePosition.lat, livePosition.lon], {
        radius: livePosition.accuracy,
        color: '#3b82f6',
        weight: 1,
        fillColor: '#3b82f6',
        fillOpacity: 0.08
      }).addTo(layer)
    }

    L.marker([livePosition.lat, livePosition.lon], {
      icon: L.divIcon({
        className: '',
        html: `<div style="width:14px;height:14px;border-radius:50%;background:#3b82f6;border:2px solid white;box-shadow:0 0 0 6px rgba(59,130,246,0.25)"></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7]
      })
    }).bindPopup(
      livePosition.accuracy
        ? `You (live) — accurate to ±${Math.round(livePosition.accuracy)}m`
        : 'You (live)'
    ).addTo(layer)
  }, [livePosition])

  const addMatrixPoint = (p: MatrixPoint) => {
    setMatrixPoints(prev => prev.some(x => x.id === p.id) ? prev : [...prev, p])
  }

  const handleSearchSelect = (result: GeocodeResult) => {
    setShowReportForm(false)
    setReportError(null)
    setPendingPoint({ label: result.label, lat: result.lat, lon: result.lon })
    mapRef.current?.setView([result.lat, result.lon], 15)
  }

  const handleSavePin = async (label: string) => {
    if (!pendingPoint) return
    await saveNewPin(label, pendingPoint.lat, pendingPoint.lon)
    setPendingPoint(null)
    await refreshSavedPins()
  }

  const handleDeletePin = async (id: string) => {
    await deleteSavedPin(id)
    setMatrixPoints(prev => prev.filter(p => p.id !== id))
    await refreshSavedPins()
  }

  const handleJumpToPin = (pin: SavedPin) => {
    mapRef.current?.setView([pin.lat, pin.lon], 15)
  }

  const submitClosureReport = async () => {
    if (!pendingPoint) return
    setReportSubmitting(true)
    setReportError(null)
    try {
      await reportZone({
        kind: reportKind,
        lat: pendingPoint.lat,
        lon: pendingPoint.lon,
        label: KIND_LABEL[reportKind],
        note: reportNote || undefined,
        durationHours: reportDurationHours
      })
      setShowReportForm(false)
      setPendingPoint(null)
      setReportNote('')
      if (center) loadZones(center.lat, center.lon)
    } catch (err) {
      // reportZone can reject with a Supabase PostgrestError, which is a
      // plain object (not an Error instance) — String(err) on that produces
      // the useless literal text "[object Object]" instead of the real
      // message.
      const msg = err instanceof Error
        ? err.message
        : (err && typeof err === 'object' && 'message' in err && typeof (err as { message: unknown }).message === 'string')
          ? (err as { message: string }).message
          : String(err)
      if (msg.includes('rate_limited')) {
        setReportError('Too many reports in the last hour — try again shortly.')
      } else {
        setReportError(msg || 'Could not submit the report.')
      }
    } finally {
      setReportSubmitting(false)
    }
  }

  const zoom = (delta: number) => {
    const map = mapRef.current
    if (map) map.setZoom(map.getZoom() + delta)
  }

  // Standard "locate me" behaviour (Google/Apple Maps): one tap turns on
  // live sharing AND jumps straight to your position at street level —
  // not two separate actions (a toggle, then a wait, then a manual
  // recenter). Zoom 18 puts the scale bar at roughly 40-50m, matching what
  // you'd actually want to judge "which street is this" at.
  const STREET_LEVEL_ZOOM = 18
  const handleLocateMe = () => {
    if (locationSharing && livePosition) {
      mapRef.current?.setView([livePosition.lat, livePosition.lon], STREET_LEVEL_ZOOM)
      return
    }
    // Guarded like the initial locate above: navigator.geolocation is absent in
    // some embedded webviews and when a policy blocks it, and an unguarded
    // property call there is a TypeError rather than a permission prompt.
    if (!('geolocation' in navigator)) {
      setLocationDenied(true)
      return
    }
    setLocationSharing(true)
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      pos => {
        mapRef.current?.setView([pos.coords.latitude, pos.coords.longitude], STREET_LEVEL_ZOOM)
        setLocating(false)
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
    )
  }

  return (
    <div className={fullscreen ? 'h-full w-full' : 'glass-panel p-3 md:p-4'}>
      {!fullscreen && (
        <div className="flex justify-between items-center mb-3 px-1">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Navigation size={20} className="text-gold-primary" /> Shared Living Map
            </h3>
            <p className="text-gray-500 text-xs mt-0.5">From both The Resident and The Gruvs — click anywhere to report or search a place.</p>
          </div>
        </div>
      )}

      {/* Full-bleed map with floating controls, like Google Maps rather than a boxed embed */}
      <div className={fullscreen ? 'relative overflow-hidden h-full w-full' : 'relative rounded-2xl overflow-hidden border border-white/5 h-[70vh] min-h-[420px]'}>
        <div ref={mapContainerRef} className="absolute inset-0" style={{ background: '#111' }} />

        {/* Search — floating top-left */}
        <div className="absolute top-3 left-3 right-3 md:right-auto md:w-[340px] z-[500]">
          <div className="bg-black/80 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl">
            <MapSearchBox onSelect={handleSearchSelect} localPlaces={places} />
          </div>
        </div>

        {/* Layers / legend toggle — floating top-right. Each row is now a
            real filter (see activeKinds/confirmedOnly), and counts reflect
            what's actually in view, not the whole 15km fetch radius. */}
        <div className="absolute top-3 right-3 z-[500] flex flex-col items-end gap-2">
          <button
            onClick={() => setShowLegend(v => !v)}
            className="bg-black/80 backdrop-blur-xl border border-white/10 rounded-xl p-2.5 text-gray-300 hover:text-white shadow-2xl"
            title="Legend and filters"
            aria-label={showLegend ? 'Hide map legend and filters' : 'Show map legend and filters'}
            aria-pressed={showLegend}
          >
            <Layers size={18} />
          </button>
          {showLegend && (
            // Compact icon-only strip below ~380px wide (a phone in portrait
            // with the map at full width); the full labelled key otherwise —
            // the 190px fixed panel used to eat most of a phone-width map.
            <div className="bg-black/80 backdrop-blur-xl border border-white/10 rounded-xl p-3 shadow-2xl w-[52px] sm:w-[200px]">
              <p className="hidden sm:block text-[9px] font-black uppercase tracking-widest text-gray-500 mb-2">Map key — tap to filter</p>
              {Object.entries(KIND_LABEL).map(([kind, label]) => {
                const bounds = mapRef.current?.getBounds()
                const count = zones.filter(z => z.kind === kind && (!bounds || bounds.contains([z.lat, z.lon]))).length
                const active = activeKinds.has(kind)
                // Referenced so this recomputes per pan/zoom via boundsTick;
                // the value itself isn't rendered, it's just the dependency.
                void boundsTick
                return (
                  <button
                    key={kind}
                    onClick={() => toggleKind(kind)}
                    aria-pressed={active}
                    aria-label={`${active ? 'Hide' : 'Show'} ${label} reports${count > 0 ? ` (${count} in view)` : ''}`}
                    title={label}
                    className={`w-full flex items-center gap-2 text-[11px] py-1.5 rounded-lg transition-opacity ${active ? 'text-gray-200' : 'text-gray-600 opacity-50'} hover:opacity-100`}
                  >
                    <div
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ background: KIND_COLOR[kind], boxShadow: active ? `0 0 8px ${KIND_COLOR[kind]}` : 'none' }}
                    />
                    <span className="hidden sm:inline flex-1 text-left">{label}</span>
                    {count > 0 && <span className="hidden sm:inline text-gray-500 font-bold">{count}</span>}
                  </button>
                )
              })}
              {/* Places — the permanent half of the map, kept in its own
                  section. "What is wrong here" and "what is here" are
                  different questions, and one merged list makes both harder
                  to read. Assets (water, wifi, power) sort first because on a
                  load-shedding evening they are the most useful rows here. */}
              <p className="hidden sm:block text-[9px] font-black uppercase tracking-widest text-gray-500 mb-2 mt-3 pt-3 border-t border-white/5">Places</p>
              <div className="sm:hidden border-t border-white/5 mt-2 pt-2" />
              {PLACE_ORDER.map(kind => {
                const bounds = mapRef.current?.getBounds()
                const inView = places.filter(pl =>
                  pl.kind === kind && (!bounds || bounds.contains([pl.lat, pl.lon])))
                const count = inView.length
                const active = activePlaceKinds.has(kind)
                void boundsTick
                // A layer with nothing in it is noise in the legend — but only
                // hide it when it is also switched off, so a resident who
                // turned something on never sees their choice vanish.
                if (count === 0 && !active) return null
                return (
                  <button
                    key={kind}
                    onClick={() => togglePlaceKind(kind)}
                    aria-pressed={active}
                    aria-label={`${active ? 'Hide' : 'Show'} ${PLACE_LABEL[kind]}${count > 0 ? ` (${count} in view)` : ''}`}
                    title={PLACE_LABEL[kind]}
                    className={`w-full flex items-center gap-2 text-[11px] py-1.5 rounded-lg transition-opacity ${active ? 'text-gray-200' : 'text-gray-600 opacity-50'} hover:opacity-100`}
                  >
                    <div
                      className="w-3 h-3 rounded-sm shrink-0"
                      style={{ background: PLACE_COLOR[kind], boxShadow: active ? `0 0 8px ${PLACE_COLOR[kind]}` : 'none' }}
                    />
                    <span className="hidden sm:inline flex-1 text-left">{PLACE_LABEL[kind]}</span>
                    {count > 0 && <span className="hidden sm:inline text-gray-500 font-bold">{count}</span>}
                  </button>
                )
              })}

              <label className="flex items-center gap-2 text-[10px] text-gray-400 pt-2 mt-1 border-t border-white/5 cursor-pointer py-1">
                <input
                  type="checkbox"
                  checked={confirmedOnly}
                  onChange={e => setConfirmedOnly(e.target.checked)}
                  className="accent-gold-primary w-3 h-3 shrink-0"
                  aria-label="Show confirmed and official reports only"
                />
                <span className="hidden sm:inline">Confirmed only</span>
              </label>
              <div className="hidden sm:flex items-center gap-2 text-[10px] text-gray-500 pt-1">
                <div className="w-3 h-3 rounded-full shrink-0 bg-white/80 border border-white" />
                Confirmed / official
              </div>
              <div className="hidden sm:flex items-center gap-2 text-[10px] text-gray-500 pt-1">
                <div className="w-3 h-3 rounded-sm shrink-0 bg-white/40 border border-white/60" />
                Square = a place, round = a report
              </div>
            </div>
          )}
        </div>

        {/* Zoom + refresh — floating bottom-right, Google-Maps-style stacked
            controls. p-2.5 rather than p-2: Leaflet's own zoom buttons are
            sized for a mouse, these are meant for a thumb. */}
        <div className="absolute bottom-3 right-3 z-[500] flex flex-col gap-1.5">
          <button onClick={() => zoom(1)} aria-label="Zoom in" className="bg-black/80 backdrop-blur-xl border border-white/10 rounded-lg p-2.5 text-gray-300 hover:text-white shadow-2xl" title="Zoom in"><Plus size={16} /></button>
          <button onClick={() => zoom(-1)} aria-label="Zoom out" className="bg-black/80 backdrop-blur-xl border border-white/10 rounded-lg p-2.5 text-gray-300 hover:text-white shadow-2xl" title="Zoom out"><Minus size={16} /></button>
          <button
            onClick={() => center && loadZones(center.lat, center.lon)}
            disabled={!center || loading}
            aria-label={loading ? 'Refreshing reports' : 'Refresh reports'}
            className="bg-black/80 backdrop-blur-xl border border-white/10 rounded-lg p-2.5 text-gray-300 hover:text-white shadow-2xl disabled:opacity-40"
            title="Refresh reports"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => mapRef.current?.invalidateSize()}
            aria-label="Fix map size"
            className="bg-black/80 backdrop-blur-xl border border-white/10 rounded-lg p-2.5 text-gray-300 hover:text-white shadow-2xl"
            title="Fix map size"
          >
            <Maximize size={16} />
          </button>
          {/* Live location was previously reachable only by opening the
              Alerts drawer — a setting almost nobody would stumble into —
              and even found, it just flipped a switch with no visible
              result. One tap now: turn on AND jump to street level, the way
              every map app's locate-me button actually behaves. */}
          <button
            onClick={handleLocateMe}
            disabled={locating}
            aria-label={locationSharing ? 'Recenter on my location' : 'Show my live location'}
            aria-pressed={locationSharing}
            title={locationSharing ? 'Back to my location' : 'Show my live location'}
            className={`bg-black/80 backdrop-blur-xl border border-white/10 rounded-lg p-2.5 shadow-2xl transition-all disabled:opacity-60 ${locationSharing ? 'text-gold-primary' : 'text-gray-300 hover:text-white'}`}
          >
            {locating ? <Loader size={16} className="animate-spin" /> : <LocateFixed size={16} className={locationSharing ? 'animate-pulse' : ''} />}
          </button>
          <button
            onClick={() => setMapTheme(t => t === 'dark' ? 'light' : 'dark')}
            aria-label={mapTheme === 'dark' ? 'Switch to light map' : 'Switch to dark map'}
            title={mapTheme === 'dark' ? 'Light map' : 'Dark map'}
            className="bg-black/80 backdrop-blur-xl border border-white/10 rounded-lg p-2.5 text-gray-300 hover:text-white shadow-2xl"
          >
            {mapTheme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>

        {/* Tools drawer toggle — floating left, below search */}
        <div className="absolute top-20 left-3 z-[500] flex flex-col gap-1.5">
          {(['pins', 'matrix', 'geofence'] as const).map(d => (
            <button
              key={d}
              onClick={() => setDrawer(v => v === d ? 'none' : d)}
              className={`px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest shadow-2xl border backdrop-blur-xl transition-all ${drawer === d ? 'bg-gold-primary text-black border-gold-primary' : 'bg-black/80 text-gray-300 border-white/10 hover:text-white'}`}
            >
              {d === 'pins' ? 'Saved places' : d === 'matrix' ? 'Distances' : 'Alerts'}
            </button>
          ))}
        </div>

        {/* Stats chip — floating bottom-left. Counts the FILTERED set, not
            the raw fetch — otherwise "12 nearby" while a filter has hidden
            9 of them would just read as broken. */}
        <div className="absolute bottom-3 left-3 z-[500] bg-black/80 backdrop-blur-xl border border-white/10 rounded-xl px-3 py-2 shadow-2xl flex items-center gap-3 text-[10px] text-gray-300">
          <span>{filteredZones.length}{filteredZones.length !== zones.length ? ` of ${zones.length}` : ''} nearby</span>
          <span className="text-gray-600">·</span>
          <span className="flex items-center gap-1"><Check size={10} className="text-green-500" /> {filteredZones.filter(z => z.status === 'confirmed' || z.status === 'official').length} confirmed</span>
          {geofenceHits.length > 0 && (
            <>
              <span className="text-gray-600">·</span>
              <span className="flex items-center gap-1 text-red-400"><Bell size={10} /> {geofenceHits.length} near your places</span>
            </>
          )}
        </div>

        {locationDenied && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[500] flex items-center gap-2 text-xs text-gray-300 bg-black/80 backdrop-blur-xl border border-white/10 rounded-xl p-2.5 shadow-2xl">
            <ShieldAlert size={14} className="text-gold-primary shrink-0" />
            Showing the whole world — zoom into your area for local reports.
          </div>
        )}

        {/* Pending-point action card — floating bottom-center, appears after a click or search */}
        {pendingPoint && (
          <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-[500] w-[92%] max-w-sm">
            <div className="bg-black/90 backdrop-blur-xl border border-white/10 rounded-2xl p-3.5 shadow-2xl space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-gray-300 truncate flex items-center gap-1.5"><MapPin size={13} className="text-green-500 shrink-0" /> {pendingPoint.label}</span>
                <button onClick={() => { setPendingPoint(null); setShowReportForm(false) }} className="text-gray-500 hover:text-white shrink-0"><X size={14} /></button>
              </div>

              {!showReportForm ? (
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setShowReportForm(true)}
                    className="flex-1 bg-red-500/10 hover:bg-red-500 hover:text-white border border-red-500/30 text-red-400 font-black px-3 py-2 rounded-lg text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-1.5"
                  >
                    <Ban size={12} /> Report closure
                  </button>
                  {currentUserId && (
                    <button
                      onClick={() => handleSavePin(pendingPoint.label)}
                      className="flex-1 bg-gold-primary/10 hover:bg-gold-primary hover:text-black border border-gold-primary/30 text-gold-primary font-black px-3 py-2 rounded-lg text-[10px] uppercase tracking-widest transition-all"
                    >
                      Save place
                    </button>
                  )}
                  <button
                    onClick={() => addMatrixPoint({ id: `pt-${pendingPoint.lat}-${pendingPoint.lon}`, label: pendingPoint.label, lat: pendingPoint.lat, lon: pendingPoint.lon })}
                    className="flex-1 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 font-black px-3 py-2 rounded-lg text-[10px] uppercase tracking-widest transition-all"
                  >
                    Add to distances
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={reportKind}
                      onChange={e => setReportKind(e.target.value as ReportableZoneKind)}
                      className="bg-black border border-white/10 rounded-lg px-2 py-2 text-xs text-white outline-none focus:border-red-500/40"
                    >
                      {REPORTABLE_KINDS.map(k => <option key={k.kind} value={k.kind}>{k.label}</option>)}
                    </select>
                    <select
                      value={reportDurationHours}
                      onChange={e => setReportDurationHours(Number(e.target.value))}
                      className="bg-black border border-white/10 rounded-lg px-2 py-2 text-xs text-white outline-none focus:border-red-500/40"
                    >
                      {DURATION_OPTIONS.map(d => <option key={d.hours} value={d.hours}>{d.label}</option>)}
                    </select>
                  </div>
                  <input
                    value={reportNote}
                    onChange={e => setReportNote(e.target.value)}
                    placeholder="Any detail that helps (optional)"
                    maxLength={500}
                    className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-red-500/40"
                  />
                  {reportError && <p className="text-[10px] text-red-400">{reportError}</p>}
                  <div className="flex gap-2">
                    <button
                      onClick={submitClosureReport}
                      disabled={reportSubmitting}
                      className="flex-1 bg-red-500 hover:bg-red-600 text-white font-black px-3 py-2 rounded-lg text-[10px] uppercase tracking-widest transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
                    >
                      {reportSubmitting ? <Loader size={12} className="animate-spin" /> : <Ban size={12} />}
                      {reportSubmitting ? 'Reporting…' : `Report for ${DURATION_OPTIONS.find(d => d.hours === reportDurationHours)?.label}`}
                    </button>
                    <button onClick={() => setShowReportForm(false)} className="text-gray-500 hover:text-white text-[10px] font-bold uppercase tracking-widest px-2">Cancel</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {voteError && (
          <div className="absolute top-16 left-1/2 -translate-x-1/2 z-[500] flex items-center gap-2 text-xs text-red-300 bg-black/90 backdrop-blur-xl border border-red-500/30 rounded-xl p-2.5 shadow-2xl">
            <span>{voteError}</span>
            <button onClick={() => setVoteError(null)}><X size={14} /></button>
          </div>
        )}

        {/* Slide-in tools drawer — right side, replaces the old always-visible stacked cards */}
        {drawer !== 'none' && (
          <div className="absolute top-0 right-0 bottom-0 w-full sm:w-[340px] z-[600] bg-black/95 backdrop-blur-xl border-l border-white/10 overflow-y-auto p-4">
            <button onClick={() => setDrawer('none')} className="absolute top-3 right-3 text-gray-500 hover:text-white"><X size={16} /></button>

            {drawer === 'pins' && (
              <SavedPinsPanel
                pending={pendingPoint}
                pins={savedPins}
                loading={pinsLoading}
                onSave={handleSavePin}
                onDelete={handleDeletePin}
                onJump={handleJumpToPin}
                onAddToMatrix={pin => addMatrixPoint({ id: pin.id, label: pin.label, lat: pin.lat, lon: pin.lon })}
              />
            )}

            {drawer === 'matrix' && (
              <DistanceMatrixPanel
                points={matrixPoints}
                onRemove={id => setMatrixPoints(prev => prev.filter(p => p.id !== id))}
              />
            )}

            {drawer === 'geofence' && (
              <div>
                <h4 className="text-sm font-bold text-white uppercase tracking-wide flex items-center gap-2 mb-4">
                  <Bell size={16} className="text-gold-primary" /> Geofenced Area Alerts
                </h4>
                <p className="text-[11px] text-gray-500 mb-4">
                  Highlights shared zones within a radius of any of your saved places — client-side, refreshed with the map.
                </p>
                <label className="block text-[10px] text-gray-500 uppercase font-bold mb-1">Alert radius (metres)</label>
                <input
                  type="number"
                  min={50}
                  max={20000}
                  step={50}
                  value={alertRadiusM}
                  onChange={e => setAlertRadiusM(Math.max(50, Number(e.target.value) || 50))}
                  className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-gold-primary/50 mb-4"
                />
                <div className="p-3 bg-white/2 border border-white/5 rounded-xl mb-4">
                  <p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Alerts near saved places</p>
                  <p className="text-lg font-bold text-white">{geofenceHits.length}</p>
                </div>
                <LiveLocationToggle userId={currentUserId} sharing={locationSharing} onSharingChange={setLocationSharing} onPosition={setLivePosition} />
              </div>
            )}
          </div>
        )}
      </div>

      <style jsx global>{`
        .res-geofence-pulse {
          animation: res-pulse-ring 1.6s ease-out infinite;
        }
        @keyframes res-pulse-ring {
          0% { opacity: 0.9; }
          70% { opacity: 0.15; }
          100% { opacity: 0.9; }
        }
        /* A pulsing ring is decorative, not informational — the contested/
           geofence marker underneath it already conveys the state, so it's
           safe to just hold it at a steady visible opacity instead. */
        @media (prefers-reduced-motion: reduce) {
          .res-geofence-pulse {
            animation: none;
            opacity: 0.5;
          }
        }
        /* Leaflet's scale control shares the bottom-left corner with our own
           floating stats chip — pushed up clear of it rather than the two
           overlapping. */
        .leaflet-bottom.leaflet-left {
          margin-bottom: 44px;
        }
        .leaflet-control-scale-line {
          background: rgba(0,0,0,0.6);
          border-color: rgba(255,255,255,0.4) !important;
          color: #e5e5e5;
          backdrop-filter: blur(4px);
        }
        /* Legally required, so it has to stay — but at the map's default
           faint grey-on-dark it was barely legible, which isn't "present",
           it's "technically present". */
        .leaflet-control-attribution {
          background: rgba(0,0,0,0.65) !important;
          color: #c7c7c7 !important;
        }
        .leaflet-control-attribution a {
          color: #e8c766 !important;
        }
      `}</style>
    </div>
  )
}
