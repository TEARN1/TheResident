'use client'

import React, { useEffect, useRef, useState } from 'react'
import 'leaflet/dist/leaflet.css'
import { Navigation, Maximize, RefreshCw, Check, X, ShieldAlert, MapPin, Bell } from 'lucide-react'
import { useSelector } from 'react-redux'
import { RootState } from '../../../store'
import { fetchSharedZones, verifyZone, type SharedZone } from '../../../utils/mapZones'
import { fetchSavedPins, saveNewPin, deleteSavedPin, type SavedPin } from '../../../utils/savedPins'
import { distanceMetres } from '../../../utils/logic'
import type { GeocodeResult } from '../../../utils/geocode'
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

export default function VibeMap() {
  const currentUser = useSelector((state: RootState) => state.auth.currentUser)
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<import('leaflet').Map | null>(null)
  const markersRef = useRef<import('leaflet').LayerGroup | null>(null)
  const searchMarkerRef = useRef<import('leaflet').LayerGroup | null>(null)
  const pinsLayerRef = useRef<import('leaflet').LayerGroup | null>(null)
  const liveMarkerRef = useRef<import('leaflet').LayerGroup | null>(null)
  const leafletRef = useRef<typeof import('leaflet') | null>(null)

  const [center, setCenter] = useState<{ lat: number; lon: number } | null>(null)
  const [locationDenied, setLocationDenied] = useState(false)
  const [zones, setZones] = useState<SharedZone[]>([])
  const [loading, setLoading] = useState(false)
  const [voteError, setVoteError] = useState<string | null>(null)

  // ── #1 Search-as-you-type + #2 Saved pins ─────────────────────────────────
  const [pendingPoint, setPendingPoint] = useState<{ label: string; lat: number; lon: number } | null>(null)
  const [savedPins, setSavedPins] = useState<SavedPin[]>([])
  const [pinsLoading, setPinsLoading] = useState(false)

  // ── #3 Multi-stop distance matrix ─────────────────────────────────────────
  const [matrixPoints, setMatrixPoints] = useState<MatrixPoint[]>([])

  // ── #4 Geofenced area alerts (client-side, informational) ────────────────
  const [alertRadiusM, setAlertRadiusM] = useState(500)

  // ── #5 Live location sharing (foundation) ─────────────────────────────────
  const [livePosition, setLivePosition] = useState<{ lat: number; lon: number } | null>(null)

  const currentUserId = currentUser && currentUser.id !== 'visitor-guest' ? currentUser.id : null

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

  // Geofence check: which saved pins have a shared zone within their alert radius.
  const geofenceHits = savedPins.flatMap(pin =>
    zones
      .filter(z => distanceMetres(pin, z) <= alertRadiusM)
      .map(z => ({ pin, zone: z }))
  )

  // No hardcoded home country: ask the device where it is. If the user says
  // no, the map still works — it just starts zoomed out to the whole world
  // rather than silently defaulting to one region.
  useEffect(() => {
    if (!('geolocation' in navigator)) {
      setLocationDenied(true)
      return
    }
    navigator.geolocation.getCurrentPosition(
      pos => setCenter({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => setLocationDenied(true),
      { timeout: 8000 }
    )
  }, [])

  const loadZones = async (lat: number, lon: number) => {
    setLoading(true)
    const data = await fetchSharedZones(lat, lon, 15000)
    setZones(data)
    setLoading(false)
  }

  // Build the Leaflet map once we know where to centre it.
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return

    const startLat = center?.lat ?? 20
    const startLon = center?.lon ?? 0
    const startZoom = center ? 13 : 2 // world view when we don't know where the user is

    let cancelled = false
    import('leaflet').then(L => {
      if (cancelled || !mapContainerRef.current || mapRef.current) return
      leafletRef.current = L

      const map = L.map(mapContainerRef.current).setView([startLat, startLon], startZoom)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19
      }).addTo(map)

      markersRef.current = L.layerGroup().addTo(map)
      searchMarkerRef.current = L.layerGroup().addTo(map)
      pinsLayerRef.current = L.layerGroup().addTo(map)
      liveMarkerRef.current = L.layerGroup().addTo(map)
      mapRef.current = map

      map.on('click', (e: import('leaflet').LeafletMouseEvent) => {
        setPendingPoint({ label: `Dropped pin (${e.latlng.lat.toFixed(4)}, ${e.latlng.lng.toFixed(4)})`, lat: e.latlng.lat, lon: e.latlng.lng })
      })

      if (center) loadZones(center.lat, center.lon)
    })

    return () => { cancelled = true }
  }, [center])

  // Recentre + refetch once geolocation resolves after the map already exists.
  useEffect(() => {
    if (!center || !mapRef.current) return
    mapRef.current.setView([center.lat, center.lon], 13)
    loadZones(center.lat, center.lon)
  }, [center])

  // Render markers whenever the zone list changes.
  useEffect(() => {
    const L = leafletRef.current
    const group = markersRef.current
    if (!L || !group) return
    group.clearLayers()

    zones.forEach(zone => {
      const color = KIND_COLOR[zone.kind] || '#D4AF37'
      const isGeofenceHit = geofenceHits.some(h => h.zone.id === zone.id)

      if (isGeofenceHit) {
        // #4 Geofenced alerts: a pulsing ring behind zones that fall inside
        // the radius of one of the user's saved places.
        L.circleMarker([zone.lat, zone.lon], {
          radius: 16 + zone.severity * 2,
          color: '#ef4444',
          fillColor: '#ef4444',
          fillOpacity: 0.12,
          weight: 2,
          className: 'res-geofence-pulse'
        }).addTo(group)
      }

      const marker = L.circleMarker([zone.lat, zone.lon], {
        radius: 8 + zone.severity * 2,
        color,
        fillColor: color,
        fillOpacity: zone.status === 'confirmed' || zone.status === 'official' ? 0.85 : 0.4,
        weight: 2
      })

      const sourceLabel = zone.source_app === 'gruvs' ? 'The Gruvs' : 'The Resident'
      const popupId = `zone-popup-${zone.id}`
      marker.bindPopup(`
        <div style="font-family:inherit;min-width:180px">
          <strong>${KIND_LABEL[zone.kind] || zone.kind}</strong>
          ${zone.label ? `<div>${zone.label}</div>` : ''}
          ${zone.note ? `<div style="opacity:0.7;font-size:0.85em;margin-top:4px">${zone.note}</div>` : ''}
          <div style="font-size:0.75em;opacity:0.6;margin-top:6px">
            Reported via ${sourceLabel} · ${zone.status}
          </div>
          <div style="font-size:0.75em;margin-top:4px">
            ✓ ${zone.confirmCount} confirmed &nbsp; ✗ ${zone.disputeCount} disputed
          </div>
          <div id="${popupId}" style="display:flex;gap:6px;margin-top:8px"></div>
        </div>
      `)

      marker.on('popupopen', () => {
        const container = document.getElementById(popupId)
        if (!container) return
        container.innerHTML = ''

        if (!currentUser || currentUser.id === 'visitor-guest') {
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
  }, [zones, currentUser, savedPins, alertRadiusM])

  // #1 Search marker — a temporary marker for the currently selected search result / dropped pin.
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

  // #2 Saved pins layer — persistent marker layer, distinct from zone markers.
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

  // #5 Live location marker — the current user's own position while sharing is on.
  useEffect(() => {
    const L = leafletRef.current
    const layer = liveMarkerRef.current
    if (!L || !layer) return
    layer.clearLayers()
    if (!livePosition) return

    L.marker([livePosition.lat, livePosition.lon], {
      icon: L.divIcon({
        className: '',
        html: `<div style="width:14px;height:14px;border-radius:50%;background:#3b82f6;border:2px solid white;box-shadow:0 0 0 6px rgba(59,130,246,0.25)"></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7]
      })
    }).bindPopup('You (live)').addTo(layer)
  }, [livePosition])

  const addMatrixPoint = (p: MatrixPoint) => {
    setMatrixPoints(prev => prev.some(x => x.id === p.id) ? prev : [...prev, p])
  }

  const handleSearchSelect = (result: GeocodeResult) => {
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

  return (
    <div className="space-y-6">
      <div className="glass-panel p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              <Navigation size={24} className="text-gold-primary" /> Shared Living Map
            </h3>
            <p className="text-gray-500 text-sm mt-1">
              Safety alerts, outage reports and traffic zones — from both The Resident and The Gruvs.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => center && loadZones(center.lat, center.lon)}
              disabled={!center || loading}
              className="bg-white/5 p-2 rounded-lg border border-white/10 text-gray-400 hover:text-white transition-all disabled:opacity-40"
              title="Refresh"
            >
              <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={() => mapRef.current?.invalidateSize()}
              className="bg-white/5 p-2 rounded-lg border border-white/10 text-gray-400 hover:text-white transition-all"
              title="Refresh map size"
            >
              <Maximize size={20} />
            </button>
          </div>
        </div>

        <div className="mb-4">
          <MapSearchBox onSelect={handleSearchSelect} />
        </div>

        {geofenceHits.length > 0 && (
          <div className="mb-4 flex items-center gap-2 text-xs text-red-300 bg-red-500/10 border border-red-500/20 rounded-xl p-3">
            <Bell size={14} className="text-red-400 shrink-0" />
            {geofenceHits.length} alert{geofenceHits.length === 1 ? '' : 's'} near your saved places (within {alertRadiusM}m)
          </div>
        )}

        {locationDenied && (
          <div className="mb-4 flex items-center gap-2 text-xs text-gray-500 bg-white/5 border border-white/10 rounded-xl p-3">
            <ShieldAlert size={14} className="text-gold-primary shrink-0" />
            Location access isn&apos;t available, so the map is showing the whole world. Zoom in to your area to see nearby reports.
          </div>
        )}

        {voteError && (
          <div className="mb-4 flex items-center justify-between gap-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl p-3">
            <span>{voteError}</span>
            <button onClick={() => setVoteError(null)}><X size={14} /></button>
          </div>
        )}

        <div
          ref={mapContainerRef}
          className="aspect-video rounded-2xl overflow-hidden border border-white/5"
          style={{ background: '#111' }}
        />

        {pendingPoint && (
          <div className="mt-3 flex items-center justify-between gap-2 text-xs text-gray-400 bg-white/2 border border-white/5 rounded-xl p-3">
            <span className="truncate flex items-center gap-2">
              <MapPin size={13} className="text-green-500 shrink-0" /> {pendingPoint.label}
            </span>
            <button
              onClick={() => addMatrixPoint({ id: `pt-${pendingPoint.lat}-${pendingPoint.lon}`, label: pendingPoint.label, lat: pendingPoint.lat, lon: pendingPoint.lon })}
              className="shrink-0 text-[11px] font-bold text-gold-primary border border-gold-primary/40 rounded-lg px-2 py-1 hover:bg-gold-primary/10 transition-colors"
            >
              Add to distance matrix
            </button>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
          {Object.entries(KIND_LABEL).map(([kind, label]) => (
            <div key={kind} className="flex items-center gap-2 text-[10px] text-gray-400">
              <div className="w-2 h-2 rounded-full" style={{ background: KIND_COLOR[kind] }} />
              {label}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          <div className="p-4 bg-white/2 border border-white/5 rounded-xl">
            <p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Active Reports Nearby</p>
            <p className="text-lg font-bold text-white">{zones.length}</p>
          </div>
          <div className="p-4 bg-white/2 border border-white/5 rounded-xl">
            <p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Confirmed</p>
            <p className="text-lg font-bold text-white">
              {zones.filter(z => z.status === 'confirmed' || z.status === 'official').length}
            </p>
          </div>
          <div className="p-4 bg-white/2 border border-white/5 rounded-xl">
            <p className="text-[10px] text-gray-500 uppercase font-bold mb-1 flex items-center gap-1">
              <Check size={10} /> From both apps
            </p>
            <p className="text-lg font-bold text-white">
              {new Set(zones.map(z => z.source_app)).size > 1 ? 'Yes' : zones.length > 0 ? zones[0].source_app : '—'}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SavedPinsPanel
          pending={pendingPoint}
          pins={savedPins}
          loading={pinsLoading}
          onSave={handleSavePin}
          onDelete={handleDeletePin}
          onJump={handleJumpToPin}
          onAddToMatrix={pin => addMatrixPoint({ id: pin.id, label: pin.label, lat: pin.lat, lon: pin.lon })}
        />

        <div className="glass-panel p-6">
          <h4 className="text-sm font-bold text-white uppercase tracking-wide flex items-center gap-2 mb-4">
            <Bell size={16} className="text-gold-primary" /> Geofenced Area Alerts
          </h4>
          <p className="text-[11px] text-gray-500 mb-4">
            Highlights shared zones that fall within a radius of any of your saved places — client-side only, refreshed with the map.
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
          <LiveLocationToggle userId={currentUserId} onPosition={setLivePosition} />
        </div>
      </div>

      <DistanceMatrixPanel
        points={matrixPoints}
        onRemove={id => setMatrixPoints(prev => prev.filter(p => p.id !== id))}
      />

      <style jsx global>{`
        .res-geofence-pulse {
          animation: res-pulse-ring 1.6s ease-out infinite;
        }
        @keyframes res-pulse-ring {
          0% { opacity: 0.9; }
          70% { opacity: 0.15; }
          100% { opacity: 0.9; }
        }
      `}</style>
    </div>
  )
}
