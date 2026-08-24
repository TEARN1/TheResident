'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import 'leaflet/dist/leaflet.css'
import { Navigation, LocateFixed, Maximize, RefreshCw, Check, X, ShieldAlert, MapPin, Bell, Layers, Plus, Minus, Ban, Loader, Sun, Moon } from 'lucide-react'
import { useSelector } from 'react-redux'
import { RootState, isGuestUser } from '../../../../store'
import { fetchSharedZones, verifyZone, reportZone, type SharedZone, type ReportableZoneKind } from '../../../../utils/mapZones'
import { fetchSavedPins, saveNewPin, deleteSavedPin, type SavedPin } from '../../../../utils/savedPins'
import { distanceMetres } from '../../../../utils/logic'
import { searchPlaces, reverseGeocode, type GeocodeResult } from '../../../../utils/geocode'
import { supabase } from '../../../../utils/supabase'
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

const KIND_ICON_SYMBOL: Record<string, string> = {
  road_closed: '⛔',
  heavy_traffic: '🚦',
  detour: '↪️',
  no_parking: '🅿️',
  alert: '🚨',
  route: '🛣️',
  zone: '📍'
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

export default function VibeMap({ fullscreen = false }: { fullscreen?: boolean }) {
  const searchParams = useSearchParams()
  const currentUser = useSelector((state: RootState) => state.auth.currentUser)
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<import('leaflet').Map | null>(null)
  const markersRef = useRef<import('leaflet').LayerGroup | null>(null)
  const searchMarkerRef = useRef<import('leaflet').LayerGroup | null>(null)
  const pinsLayerRef = useRef<import('leaflet').LayerGroup | null>(null)
  const liveMarkerRef = useRef<import('leaflet').LayerGroup | null>(null)
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

  // O(pins × zones) distance scan. Computed inline it re-ran on EVERY render —
  // including every keystroke in the report form and every drawer toggle — and
  // handed back a new array identity each time, which then invalidated the
  // marker effect below and forced a full map rebuild. Memoised on the only
  // three inputs that can actually change the answer.
  const geofenceHits = useMemo(
    () => savedPins.flatMap(pin =>
      zones
        .filter(z => distanceMetres(pin, z) <= alertRadiusM)
        .map(z => ({ pin, zone: z }))
    ),
    [savedPins, zones, alertRadiusM]
  )

  // Set of zone ids that trip a geofence — lets the marker loop do an O(1)
  // lookup instead of a linear .some() scan per zone (it was O(zones × hits)).
  const geofenceZoneIds = useMemo(
    () => new Set(geofenceHits.map(h => h.zone.id)),
    [geofenceHits]
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

  const loadZones = async (lat: number, lon: number) => {
    setLoading(true)
    const data = await fetchSharedZones(lat, lon, 15000)
    setZones(data)
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

      // preferCanvas: every zone/pin is a circleMarker. Leaflet's default
      // renderer gives each one its own SVG DOM node, so a busy city becomes
      // hundreds of nodes that the browser lays out and repaints on every pan.
      // Canvas draws them all into ONE element — same visuals, a fraction of
      // the cost, and it degrades gracefully on a cheap Android handset, which
      // is the actual launch device here.
      const map = L.map(mapContainerRef.current, { zoomControl: false, preferCanvas: true })
        .setView([startLat, startLon], startZoom)
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
      mapRef.current = map

      // Minimum zoom for a report pin to be trustworthy: at zoom 15 the scale
      // bar reads roughly 300m — any looser than that and a "road closed"
      // pin could land on the wrong street entirely. Clicking while zoomed
      // out further re-centres and zooms in on the clicked point instead of
      // dropping the pin at an unreliable location.
      const MIN_REPORT_ZOOM = 15
      map.on('click', async (e: import('leaflet').LeafletMouseEvent) => {
        setShowReportForm(false)
        setReportError(null)
        const initialLabel = `Dropped pin (${e.latlng.lat.toFixed(4)}, ${e.latlng.lng.toFixed(4)})`
        setPendingPoint({ label: initialLabel, lat: e.latlng.lat, lon: e.latlng.lng })
        if (map.getZoom() < MIN_REPORT_ZOOM) {
          map.setView(e.latlng, MIN_REPORT_ZOOM)
        }
        const realAddress = await reverseGeocode(e.latlng.lat, e.latlng.lng)
        if (realAddress) {
          setPendingPoint(prev => (prev && prev.lat === e.latlng.lat && prev.lon === e.latlng.lng ? { ...prev, label: realAddress } : prev))
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

  // Live Supabase Realtime updates on map_zones table
  useEffect(() => {
    if (!supabase || !center) return
    const channel = supabase.channel('map_zones_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'map_zones' }, () => {
        loadZones(center.lat, center.lon)
      })
      .subscribe()
    return () => { supabase?.removeChannel(channel) }
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

  useEffect(() => {
    const L = leafletRef.current
    const group = markersRef.current
    if (!L || !group) return
    group.clearLayers()

    const now = Date.now()

    filteredZones.forEach(zone => {
      const color = KIND_COLOR[zone.kind] || '#D4AF37'
      // O(1) Set lookup rather than a linear .some() per zone — the scan was
      // O(zones x hits) inside a loop that already runs once per zone.
      const isGeofenceHit = geofenceZoneIds.has(zone.id)
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
    // Depends on geofenceZoneIds, NOT savedPins/alertRadiusM directly: dragging
    // the alert-radius slider used to tear down and rebuild every zone marker on
    // each tick, even when the set of tripped zones never changed. The memo
    // above keeps its identity stable, so the map only rebuilds when the picture
    // actually differs. (The disable below is pre-existing — it suppresses the
    // deliberate omission of `center`, which must NOT retrigger a rebuild on
    // every pan. Keep it on the line directly above the dep array.)
    // savedPins/alertRadiusM are deliberately absent: they feed geofenceZoneIds,
    // and depending on them directly rebuilt every marker on each drag of the
    // alert-radius slider even when the tripped set never changed. Verified the
    // body references neither (the only matches are in comments), so there is no
    // stale closure.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredZones, currentUser, geofenceZoneIds, distanceOrigin])

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
        {/* A Leaflet canvas is invisible to assistive tech: this component had
            ZERO aria/role/tabIndex, so a screen-reader or keyboard-only user got
            an unlabelled black rectangle and no way to learn what was on it.
            Labelling the region and exposing a text summary below is the minimum
            that makes the map's information available without sight — and the
            geofence count is safety information, so it must not be visual-only. */}
        <div
          ref={mapContainerRef}
          className="absolute inset-0"
          style={{ background: '#111' }}
          role="region"
          aria-label="Neighbourhood map showing reported zones near you"
        />

        {/* Screen-reader equivalent of the map + a polite live region so a new
            alert near a saved place is ANNOUNCED, not just drawn in red.
            Counts filteredZones, not zones: the legend filters are real, so the
            announcement must describe what is actually on the map right now. */}
        <div className="sr-only" aria-live="polite" aria-atomic="true">
          {filteredZones.length} zones shown nearby.
          {geofenceHits.length > 0
            ? ` ${geofenceHits.length} ${geofenceHits.length === 1 ? 'alert is' : 'alerts are'} near a place you saved.`
            : ' No alerts near your saved places.'}
        </div>

        {/* Search & Quick Filter Bar — floating top-left */}
        <div className="absolute top-3 left-3 right-3 md:right-auto md:w-[380px] z-[500] space-y-2">
          <div className="bg-black/80 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl">
            <MapSearchBox onSelect={handleSearchSelect} />
          </div>
          {/* Quick Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 px-0.5">
            <button
              onClick={() => setActiveKinds(new Set(Object.keys(KIND_LABEL)))}
              className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider backdrop-blur-xl border transition-all whitespace-nowrap ${
                activeKinds.size === Object.keys(KIND_LABEL).length
                  ? 'bg-gold-primary text-black border-gold-primary shadow-md'
                  : 'bg-black/80 text-gray-300 border-white/10 hover:text-white'
              }`}
            >
              All
            </button>
            {Object.entries(KIND_LABEL).map(([kind, label]) => {
              const active = activeKinds.has(kind)
              return (
                <button
                  key={kind}
                  onClick={() => toggleKind(kind)}
                  className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider backdrop-blur-xl border transition-all whitespace-nowrap flex items-center gap-1.5 ${
                    active
                      ? 'bg-gold-primary text-black border-gold-primary shadow-md'
                      : 'bg-black/80 text-gray-300 border-white/10 opacity-60 hover:opacity-100'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: KIND_COLOR[kind] }} />
                  {label}
                </button>
              )
            })}
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

        {/* Tools drawer toggle — floating left, below search & quick filters */}
        <div className="absolute top-28 left-3 z-[500] flex flex-col gap-1.5">
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
