'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import 'leaflet/dist/leaflet.css'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
import { Navigation, LocateFixed, RefreshCw, Check, X, ShieldAlert, MapPin, Bell, Layers, Plus, Minus, Ban, Loader, Sun, Moon, Wrench } from 'lucide-react'
import { useSelector } from 'react-redux'
import { RootState, isGuestUser } from '../../../../store'
import { fetchSharedZones, verifyZone, reportZone, type SharedZone, type ReportableZoneKind } from '../../../../utils/mapZones'
import { fetchNearbyHandymen, type NearbyHandyman } from '../../../../utils/mapHandymen'
import { fetchNearbyMarketItems, type NearbyMarketItem } from '../../../../utils/mapMarket'
import { fetchNearbyCommunities, type NearbyCommunity } from '../../../../utils/mapCommunities'
import { fetchSavedPins, saveNewPin, deleteSavedPin, type SavedPin } from '../../../../utils/savedPins'
import { distanceMetres } from '../../../../utils/logic'
import { searchPlaces, reverseGeocode, type GeocodeResult } from '../../../../utils/geocode'
import { supabase } from '../../../../utils/supabase'
import { encodeHTMLEntities } from '../../../../utils/security'
import { getErrorMessage } from '../../../../utils/errors'
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

// Module-level so the reference is stable across renders. Declared inside the
// component it was a fresh object every render, which made it a churning
// dependency of the map-init effect below.
const TILE_SOURCES: Record<'dark' | 'light', string> = {
  dark: 'https://{s}.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}{r}.png',
  light: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png'
}

export default function VibeMap({ fullscreen = false }: { fullscreen?: boolean }) {
  const searchParams = useSearchParams()
  const currentUser = useSelector((state: RootState) => state.auth.currentUser)
  const listings = useSelector((state: RootState) => state.listings.items)
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<import('leaflet').Map | null>(null)
  const markersRef = useRef<import('leaflet').LayerGroup | null>(null)
  const searchMarkerRef = useRef<import('leaflet').LayerGroup | null>(null)
  const pinsLayerRef = useRef<import('leaflet').LayerGroup | null>(null)
  const liveMarkerRef = useRef<import('leaflet').LayerGroup | null>(null)
  // Separate from `markersRef` (shared-zone reports) on purpose: each zone
  // there is 2-3 stacked circleMarkers (a halo + an optional contested/
  // geofence ring + the real marker), so clustering that group would badly
  // miscount — a "12" badge could mean 4 zones × 3 circles. Listing pins are
  // one simple marker each, so they're the layer that's actually safe to
  // cluster.
  const listingsClusterRef = useRef<import('leaflet').MarkerClusterGroup | null>(null)
  // Same clustering reasoning as listingsClusterRef — one simple marker per
  // business/item, safe to cluster. Communities stay a plain layer group
  // (below): each one draws a catchment circle, not a point, and clustering
  // circles the way markers are clustered would be meaningless.
  const handymenClusterRef = useRef<import('leaflet').MarkerClusterGroup | null>(null)
  const marketClusterRef = useRef<import('leaflet').MarkerClusterGroup | null>(null)
  const communitiesLayerRef = useRef<import('leaflet').LayerGroup | null>(null)
  const leafletRef = useRef<typeof import('leaflet') | null>(null)
  const tileLayerRef = useRef<import('leaflet').TileLayer | null>(null)

  // The map used to be locked to CARTO's light "Voyager" basemap — a bright
  // white rectangle sitting in the middle of an otherwise all-dark app.
  // Dark Matter is the same OSM data via CARTO's dark render, so this is a
  // reskin, not a different data source. Defaults to dark to match the rest
  // of the UI; Voyager stays available for anyone who finds streets/labels
  // easier to read on light.
  const [mapTheme, setMapTheme] = useState<'dark' | 'light'>('dark')

  const [center, setCenter] = useState<{ lat: number; lon: number } | null>(null)
  const [locationDenied, setLocationDenied] = useState(false)
  // Gates map creation until the geolocation attempt has actually resolved
  // (success, failure, or "no geolocation at all") — without this, the map
  // used to initialize immediately at a hardcoded whole-world view and only
  // recenter afterward, so every load flashed the whole world for a moment
  // with no explanation before either snapping to the real location or (on
  // failure) showing the "Showing the whole world" banner. Waiting means the
  // map now initializes directly at the right place, or the fallback and its
  // explanation appear together instead of one after the other.
  const [geoResolved, setGeoResolved] = useState(false)
  const [zones, setZones] = useState<SharedZone[]>([])
  const [loading, setLoading] = useState(false)
  const [voteError, setVoteError] = useState<string | null>(null)
  // Closed by default — a color-coded map with the legend open on every
  // load competes with the map itself for attention before the user has
  // asked for it. The Layers toggle is one tap away.
  const [showLegend, setShowLegend] = useState(false)
  const [drawer, setDrawer] = useState<Drawer>('none')
  // The three drawer-toggle pills (Saved places / Distances / Alerts) used
  // to be their own floating stack on the left, competing with search for
  // the same corner. One "Tools" button + a small popover here consolidates
  // them onto the right side alongside Layers instead.
  const [showToolsMenu, setShowToolsMenu] = useState(false)

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

  // The map's own content layers beyond civic zone reports — handymen,
  // marketplace items, and communities previously had zero presence on the
  // map at all, despite it being the one place a resident could see
  // "what's actually near me" across every part of the app at once.
  const [handymen, setHandymen] = useState<NearbyHandyman[]>([])
  const [showHandymenLayer, setShowHandymenLayer] = useState(true)
  const [marketItemsNearby, setMarketItemsNearby] = useState<NearbyMarketItem[]>([])
  const [showMarketLayer, setShowMarketLayer] = useState(true)
  const [communities, setCommunities] = useState<NearbyCommunity[]>([])
  const [showCommunitiesLayer, setShowCommunitiesLayer] = useState(true)

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
    // A focusPlace deep-link resolves geoResolved itself once the place
    // lookup below finishes, rather than here — its center isn't known yet.
    if (focusPlace) return
    if (!('geolocation' in navigator)) {
      setLocationDenied(true)
      setGeoResolved(true)
      return
    }
    navigator.geolocation.getCurrentPosition(
      pos => {
        setCenter({ lat: pos.coords.latitude, lon: pos.coords.longitude })
        setGeoResolved(true)
      },
      () => {
        setLocationDenied(true)
        setGeoResolved(true)
      },
      { timeout: 8000 }
    )
  }, [focusPlace])

  useEffect(() => {
    if (!focusPlace) return
    let cancelled = false
    searchPlaces(focusPlace).then(results => {
      if (cancelled) return
      if (results.length > 0) {
        const hit = results[0]
        setCenter({ lat: hit.lat, lon: hit.lon })
        setPendingPoint({ label: hit.label, lat: hit.lat, lon: hit.lon })
      }
      // Resolves geoResolved even when the lookup comes back empty — the map
      // still needs to initialize somewhere (the world-view fallback) rather
      // than staying on the loading state forever.
      setGeoResolved(true)
    })
    return () => { cancelled = true }
  }, [focusPlace])

  const loadZones = async (lat: number, lon: number) => {
    setLoading(true)
    // Refreshing the map means "give me everything current here" — the
    // civic zone reports and every content layer share the same gesture
    // (the refresh button, recentring, an initial location fix).
    const [zonesData, handymenData, marketData, communitiesData] = await Promise.all([
      fetchSharedZones(lat, lon, 15000),
      fetchNearbyHandymen(lat, lon, 15000),
      fetchNearbyMarketItems(lat, lon, 15000),
      fetchNearbyCommunities(lat, lon, 15000)
    ])
    setZones(zonesData)
    setHandymen(handymenData)
    setMarketItemsNearby(marketData)
    setCommunities(communitiesData)
    setLoading(false)
  }

  useEffect(() => {
    if (!geoResolved || !mapContainerRef.current || mapRef.current) return

    const startLat = center?.lat ?? 20
    const startLon = center?.lon ?? 0
    const startZoom = center ? 14 : 2

    let cancelled = false
    Promise.all([import('leaflet'), import('leaflet.markercluster')]).then(([L]) => {
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
      // disableClusteringAtZoom: once you're zoomed in enough to tell streets
      // apart (16 ≈ block-level), individual pins are more useful than a
      // cluster badge — matches the same "which street" threshold used
      // elsewhere on this map (MIN_REPORT_ZOOM).
      listingsClusterRef.current = L.markerClusterGroup({
        disableClusteringAtZoom: 16,
        maxClusterRadius: 60,
        spiderfyOnMaxZoom: true
      }).addTo(map)
      handymenClusterRef.current = L.markerClusterGroup({
        disableClusteringAtZoom: 16,
        maxClusterRadius: 60,
        spiderfyOnMaxZoom: true
      }).addTo(map)
      marketClusterRef.current = L.markerClusterGroup({
        disableClusteringAtZoom: 16,
        maxClusterRadius: 60,
        spiderfyOnMaxZoom: true
      }).addTo(map)
      communitiesLayerRef.current = L.layerGroup().addTo(map)
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
    // `mapTheme` is read here only to pick the INITIAL tile URL. It is
    // deliberately not a dependency: including it would tear down and rebuild
    // the entire map on every theme toggle, throwing away the user's pan,
    // zoom, pins and open popups. The dedicated [mapTheme] effect below swaps
    // the tile layer's URL in place instead, which is the whole point of
    // holding tileLayerRef.
  }, [center, geoResolved])

  // Replaces the old manual "Fix map size" button — Leaflet only recomputes
  // its internal tile grid on window resize, so any layout change that
  // resizes THIS container (a drawer opening, a parent flex reflow, rotating
  // the device) used to leave the map visibly cut off until someone found
  // and tapped that button. ResizeObserver catches all of those automatically.
  useEffect(() => {
    if (!mapContainerRef.current) return
    const observer = new ResizeObserver(() => {
      mapRef.current?.invalidateSize()
    })
    observer.observe(mapContainerRef.current)
    return () => observer.disconnect()
  }, [])

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
      // Leaflet's bindPopup sets innerHTML directly — React's JSX escaping
      // never touches this string, so anything user-submitted (label, note)
      // going in unescaped is stored XSS: a malicious closure report with
      // <img src=x onerror=...> in its note would execute for every user
      // who opens that popup. encodeHTMLEntities (utils/security.ts) is the
      // same sanitizer already used at signup, applied here too.
      marker.bindPopup(`
        <div style="font-family:inherit;min-width:190px">
          <div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px">
            <strong>${encodeHTMLEntities(KIND_LABEL[zone.kind] || zone.kind)}</strong>
            ${distanceLabel ? `<span style="font-size:0.75em;opacity:0.6;white-space:nowrap">${distanceLabel}</span>` : ''}
          </div>
          ${zone.label ? `<div>${encodeHTMLEntities(zone.label)}</div>` : ''}
          ${zone.note ? `<div style="opacity:0.7;font-size:0.85em;margin-top:4px">${encodeHTMLEntities(zone.note)}</div>` : ''}
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
    }).bindPopup(encodeHTMLEntities(pendingPoint.label)).addTo(layer).openPopup()
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
      }).bindPopup(`<strong>${encodeHTMLEntities(pin.label)}</strong>`).addTo(layer)
    })
  }, [savedPins])

  // Room/property listings as a clustered pin layer — the map previously had
  // zero awareness of listings at all, even though "Shared Living Map" is
  // the header text right above it. Only listings with coordinates render;
  // most existing listings predate lat/lon capture, so this fills in as
  // landlords verify addresses rather than needing a backfill migration.
  useEffect(() => {
    const L = leafletRef.current
    const cluster = listingsClusterRef.current
    if (!L || !cluster) return
    cluster.clearLayers()

    listings.forEach(listing => {
      if (typeof listing.lat !== 'number' || typeof listing.lon !== 'number') return
      const marker = L.marker([listing.lat, listing.lon], {
        icon: L.divIcon({
          className: '',
          html: `<div style="display:flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:6px;background:#D4AF37;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.4);color:#000;font-size:11px;font-weight:900">R</div>`,
          iconSize: [22, 22],
          iconAnchor: [11, 11]
        })
      })
      marker.bindPopup(`
        <div style="font-family:inherit;min-width:170px">
          <strong>${encodeHTMLEntities(listing.title)}</strong>
          <div style="opacity:0.7;font-size:0.85em;margin-top:2px">${encodeHTMLEntities(listing.suburb || listing.location)}</div>
          <div style="font-size:0.9em;margin-top:4px;color:#D4AF37;font-weight:700">${listing.currency} ${listing.price}</div>
        </div>
      `)
      marker.addTo(cluster)
    })
  }, [listings])

  // Handymen/services layer — one marker per business, no proximity
  // grouping needed (a service call-out spot isn't "the same house number"
  // the way two independent room listings sharing an address can be).
  useEffect(() => {
    const L = leafletRef.current
    const cluster = handymenClusterRef.current
    if (!L || !cluster) return
    cluster.clearLayers()
    if (!showHandymenLayer) return

    handymen.forEach(h => {
      const marker = L.marker([h.lat, h.lon], {
        icon: L.divIcon({
          className: '',
          html: `<div style="display:flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:6px;background:#a855f7;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.4)">
                   <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/></svg>
                 </div>`,
          iconSize: [22, 22],
          iconAnchor: [11, 11]
        })
      })
      const distanceLabel = distanceOrigin
        ? (() => {
            const m = distanceMetres(distanceOrigin, h)
            return m < 1000 ? `${Math.round(m)}m away` : `${(m / 1000).toFixed(1)}km away`
          })()
        : null
      const stars = h.rating > 0 ? `★ ${h.rating.toFixed(1)}` : ''
      // encodeHTMLEntities on every field pulled from user content — the
      // same stored-XSS risk flagged on the zone popups above applies here.
      marker.bindPopup(`
        <div style="font-family:inherit;min-width:170px">
          <div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px">
            <strong>${encodeHTMLEntities(h.category)}</strong>
            ${distanceLabel ? `<span style="font-size:0.75em;opacity:0.6;white-space:nowrap">${distanceLabel}</span>` : ''}
          </div>
          <div style="font-weight:700;font-size:0.9em;margin-top:2px">${encodeHTMLEntities(h.businessName)}</div>
          <div style="font-size:0.8em;opacity:0.75;margin-top:2px">${[stars, h.priceEstimate ? encodeHTMLEntities(h.priceEstimate) : ''].filter(Boolean).join(' · ')}</div>
        </div>
      `)
      marker.addTo(cluster)
    })
  }, [handymen, showHandymenLayer, distanceOrigin])

  // Marketplace layer — same reasoning as handymen, one marker per item.
  useEffect(() => {
    const L = leafletRef.current
    const cluster = marketClusterRef.current
    if (!L || !cluster) return
    cluster.clearLayers()
    if (!showMarketLayer) return

    marketItemsNearby.forEach(m => {
      const marker = L.marker([m.lat, m.lon], {
        icon: L.divIcon({
          className: '',
          html: `<div style="display:flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:6px;background:#22c55e;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.4)">
                   <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 01-8 0"/></svg>
                 </div>`,
          iconSize: [22, 22],
          iconAnchor: [11, 11]
        })
      })
      const distanceLabel = distanceOrigin
        ? (() => {
            const dm = distanceMetres(distanceOrigin, m)
            return dm < 1000 ? `${Math.round(dm)}m away` : `${(dm / 1000).toFixed(1)}km away`
          })()
        : null
      marker.bindPopup(`
        <div style="font-family:inherit;min-width:170px">
          <div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px">
            <strong>${encodeHTMLEntities(m.category)}</strong>
            ${distanceLabel ? `<span style="font-size:0.75em;opacity:0.6;white-space:nowrap">${distanceLabel}</span>` : ''}
          </div>
          <div style="font-weight:700;font-size:0.9em;margin-top:2px">${encodeHTMLEntities(m.title)}</div>
          <div style="font-size:0.9em;margin-top:2px;color:#D4AF37;font-weight:700">${m.price ? `${m.currency} ${m.price}` : 'Free'}</div>
        </div>
      `)
      marker.addTo(cluster)
    })
  }, [marketItemsNearby, showMarketLayer, distanceOrigin])

  // Communities layer — each community is an area, not a point, so it draws
  // its actual catchment circle (radius_m) plus a small center marker for
  // visibility at zoom levels where the circle itself is imperceptible.
  useEffect(() => {
    const L = leafletRef.current
    const layer = communitiesLayerRef.current
    if (!L || !layer) return
    layer.clearLayers()
    if (!showCommunitiesLayer) return

    communities.forEach(c => {
      const distanceLabel = c.distanceM < 1000 ? `${Math.round(c.distanceM)}m away` : `${(c.distanceM / 1000).toFixed(1)}km away`
      const popupHtml = `
        <div style="font-family:inherit;min-width:170px">
          <div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px">
            <strong>${encodeHTMLEntities(c.name)}</strong>
            <span style="font-size:0.75em;opacity:0.6;white-space:nowrap">${distanceLabel}</span>
          </div>
          <div style="font-size:0.8em;opacity:0.75;margin-top:2px">
            ${encodeHTMLEntities(c.kind)}${c.isPrivate ? ' · Private' : ' · Public'}
          </div>
          <div style="font-size:0.8em;opacity:0.75">${c.memberCount} member${c.memberCount === 1 ? '' : 's'}</div>
        </div>
      `
      if (c.radiusM > 0) {
        L.circle([c.lat, c.lon], {
          radius: c.radiusM,
          color: '#14b8a6',
          weight: 1.5,
          fillColor: '#14b8a6',
          fillOpacity: 0.08
        }).bindPopup(popupHtml).addTo(layer)
      }
      L.marker([c.lat, c.lon], {
        icon: L.divIcon({
          className: '',
          html: `<div style="display:flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:50%;background:#14b8a6;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.4)">
                   <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
                 </div>`,
          iconSize: [20, 20],
          iconAnchor: [10, 10]
        })
      }).bindPopup(popupHtml).addTo(layer)
    })
  }, [communities, showCommunitiesLayer])

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
      const msg = getErrorMessage(err)
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

  // Deliberately separate from live-location sharing (LiveLocationToggle,
  // rendered below in the same stack). This used to be one overloaded
  // button: it silently meant either "just recenter" or "also start
  // continuous watchPosition tracking" depending on hidden state (whether
  // the Alerts drawer had ever been opened), so a tap on what looked like a
  // simple recenter button could start sharing your live position without
  // any clear signal that had happened. A one-shot position read with no
  // state change and no continuous tracking is the honest version of
  // "center the map on me" — sharing is now its own explicit, visibly-
  // toggled control. Zoom 18 puts the scale bar at roughly 40-50m, matching
  // what you'd actually want to judge "which street is this" at.
  const STREET_LEVEL_ZOOM = 18
  const handleCenterOnMe = () => {
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

        {!geoResolved && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#111] text-gray-400" role="status" aria-live="polite">
            <Loader size={22} className="animate-spin text-gold-primary" />
            <span className="text-xs">Finding your location…</span>
          </div>
        )}

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
              <button
                onClick={() => setShowHandymenLayer(v => !v)}
                aria-pressed={showHandymenLayer}
                aria-label={`${showHandymenLayer ? 'Hide' : 'Show'} handymen and services${handymen.length > 0 ? ` (${handymen.length} nearby)` : ''}`}
                title="Handymen & services"
                className={`w-full flex items-center gap-2 text-[11px] py-1.5 rounded-lg transition-opacity ${showHandymenLayer ? 'text-gray-200' : 'text-gray-600 opacity-50'} hover:opacity-100`}
              >
                <div className="w-3 h-3 rounded-full shrink-0" style={{ background: '#a855f7', boxShadow: showHandymenLayer ? '0 0 8px #a855f7' : 'none' }} />
                <span className="hidden sm:inline flex-1 text-left">Handymen &amp; services</span>
                {handymen.length > 0 && <span className="hidden sm:inline text-gray-500 font-bold">{handymen.length}</span>}
              </button>
              <button
                onClick={() => setShowMarketLayer(v => !v)}
                aria-pressed={showMarketLayer}
                aria-label={`${showMarketLayer ? 'Hide' : 'Show'} marketplace items${marketItemsNearby.length > 0 ? ` (${marketItemsNearby.length} nearby)` : ''}`}
                title="Marketplace"
                className={`w-full flex items-center gap-2 text-[11px] py-1.5 rounded-lg transition-opacity ${showMarketLayer ? 'text-gray-200' : 'text-gray-600 opacity-50'} hover:opacity-100`}
              >
                <div className="w-3 h-3 rounded-full shrink-0" style={{ background: '#22c55e', boxShadow: showMarketLayer ? '0 0 8px #22c55e' : 'none' }} />
                <span className="hidden sm:inline flex-1 text-left">Marketplace</span>
                {marketItemsNearby.length > 0 && <span className="hidden sm:inline text-gray-500 font-bold">{marketItemsNearby.length}</span>}
              </button>
              <button
                onClick={() => setShowCommunitiesLayer(v => !v)}
                aria-pressed={showCommunitiesLayer}
                aria-label={`${showCommunitiesLayer ? 'Hide' : 'Show'} communities${communities.length > 0 ? ` (${communities.length} nearby)` : ''}`}
                title="Communities"
                className={`w-full flex items-center gap-2 text-[11px] py-1.5 rounded-lg transition-opacity ${showCommunitiesLayer ? 'text-gray-200' : 'text-gray-600 opacity-50'} hover:opacity-100`}
              >
                <div className="w-3 h-3 rounded-full shrink-0" style={{ background: '#14b8a6', boxShadow: showCommunitiesLayer ? '0 0 8px #14b8a6' : 'none' }} />
                <span className="hidden sm:inline flex-1 text-left">Communities</span>
                {communities.length > 0 && <span className="hidden sm:inline text-gray-500 font-bold">{communities.length}</span>}
              </button>
              <div className="border-t border-white/5 my-1.5" />
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

          <button
            onClick={() => setShowToolsMenu(v => !v)}
            className={`bg-black/80 backdrop-blur-xl border rounded-xl p-2.5 shadow-2xl ${drawer !== 'none' ? 'text-gold-primary border-gold-primary/40' : 'text-gray-300 border-white/10 hover:text-white'}`}
            title="Tools: saved places, distances, alerts"
            aria-label={showToolsMenu ? 'Hide map tools menu' : 'Show map tools menu'}
            aria-pressed={showToolsMenu}
          >
            <Wrench size={18} />
          </button>
          {showToolsMenu && (
            <div className="bg-black/80 backdrop-blur-xl border border-white/10 rounded-xl p-2 shadow-2xl w-[160px] flex flex-col gap-1">
              {(['pins', 'matrix', 'geofence'] as const).map(d => (
                <button
                  key={d}
                  onClick={() => { setDrawer(v => v === d ? 'none' : d); setShowToolsMenu(false) }}
                  className={`text-left px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${drawer === d ? 'bg-gold-primary text-black' : 'text-gray-300 hover:bg-white/5 hover:text-white'}`}
                >
                  {d === 'pins' ? 'Saved places' : d === 'matrix' ? 'Distances' : 'Alerts'}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Bottom-right controls — grouped into two clusters rather than one
            continuous stack of loose buttons: "map controls" (zoom/refresh)
            and "location controls" (locate-me/theme) each get their own
            rounded container, Google-Maps-style, so it's clear at a glance
            which buttons act on the view vs. on you. */}
        <div className="absolute bottom-3 right-3 z-[500] flex flex-col gap-2.5">
          <div className="bg-black/85 backdrop-blur-xl border border-white/10 rounded-lg shadow-2xl overflow-hidden flex flex-col divide-y divide-white/10">
            <button onClick={() => zoom(1)} aria-label="Zoom in" className="p-2.5 text-gray-300 hover:text-white" title="Zoom in"><Plus size={16} /></button>
            <button onClick={() => zoom(-1)} aria-label="Zoom out" className="p-2.5 text-gray-300 hover:text-white" title="Zoom out"><Minus size={16} /></button>
            <button
              onClick={() => center && loadZones(center.lat, center.lon)}
              disabled={!center || loading}
              aria-label={loading ? 'Refreshing reports' : 'Refresh reports'}
              className="p-2.5 text-gray-300 hover:text-white disabled:opacity-40"
              title="Refresh reports"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>

          <div className="bg-black/85 backdrop-blur-xl border border-white/10 rounded-lg shadow-2xl overflow-hidden flex flex-col divide-y divide-white/10">
            {/* One-shot only — see the comment on handleCenterOnMe for why
                this no longer starts live tracking as a side effect. */}
            <button
              onClick={handleCenterOnMe}
              disabled={locating}
              aria-label="Center map on my location"
              title="Center map on my location"
              className="p-2.5 text-gray-300 hover:text-white transition-all disabled:opacity-60"
            >
              {locating ? <Loader size={16} className="animate-spin" /> : <LocateFixed size={16} />}
            </button>
            <button
              onClick={() => setMapTheme(t => t === 'dark' ? 'light' : 'dark')}
              aria-label={mapTheme === 'dark' ? 'Switch to light map' : 'Switch to dark map'}
              title={mapTheme === 'dark' ? 'Light map' : 'Dark map'}
              className="p-2.5 text-gray-300 hover:text-white"
            >
              {mapTheme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          </div>

          {/* Explicit, always-visible live-sharing control — previously
              reachable only by opening the Alerts drawer, where almost
              nobody would find it. Same lifted sharing/livePosition state as
              the full-description instance rendered inside that drawer
              below, so the two never disagree; this is a second, more
              discoverable place to flip the same switch, matching the
              intent already written into LiveLocationToggle's own comment.
              Deliberately its own pill rather than folded into either box
              above — sharing your live position is a privacy-relevant
              decision and shouldn't visually blend in with plain view
              controls like zoom or theme. */}
          <LiveLocationToggle
            compact
            userId={currentUserId}
            sharing={locationSharing}
            onSharingChange={setLocationSharing}
            onPosition={setLivePosition}
          />
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
            <div className="bg-black/85 backdrop-blur-xl border border-white/10 rounded-2xl p-3.5 shadow-2xl space-y-2.5">
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
