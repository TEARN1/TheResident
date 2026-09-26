'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import 'leaflet/dist/leaflet.css'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
import {
  Navigation, LocateFixed, RefreshCw, X, ShieldAlert, MapPin, Layers,
  Plus, Minus, Sparkles, Satellite, Zap, Flame, Home, Coffee, AlertTriangle, Compass, Heart
} from 'lucide-react'
import { useSelector } from 'react-redux'
import { RootState } from '../../../../store'
import { fetchSharedZones, type SharedZone } from '../../../../utils/mapZones'
import { distanceMetres } from '../../../../utils/logic'
import { reverseGeocode } from '../../../../utils/geocode'
import { supabase } from '../../../../utils/supabase'
import { playTactileSound } from '../../../../utils/tactileSounds'
import MapSearchBox from './MapSearchBox'
import { fetchUpcomingGruvsEvents, type GruvsEvent } from '../../../../utils/gruvsEvents'
import VibeBottomSheet, { type VibeItem } from './VibeBottomSheet'
import QuickVibeReportModal from './QuickVibeReportModal'

// High-definition basemaps
const TILE_SOURCES: Record<'dark' | 'light' | 'satellite', string> = {
  dark: 'https://{s}.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}{r}.png',
  light: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
  satellite: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
}

type VibeCategoryFilter = 'all' | 'nightlife' | 'housing' | 'safety' | 'chill'

export default function VibeMap({ fullscreen = false }: { fullscreen?: boolean }) {
  const currentUser = useSelector((state: RootState) => state.auth.currentUser)
  const listings = useSelector((state: RootState) => state.listings.items)

  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<import('leaflet').Map | null>(null)
  const leafletRef = useRef<typeof import('leaflet') | null>(null)
  const tileLayerRef = useRef<import('leaflet').TileLayer | null>(null)

  // Dedicated Leaflet feature layers
  const nightLayerRef = useRef<import('leaflet').LayerGroup | null>(null)
  const housingLayerRef = useRef<import('leaflet').MarkerClusterGroup | null>(null)
  const safetyLayerRef = useRef<import('leaflet').LayerGroup | null>(null)
  const chillLayerRef = useRef<import('leaflet').LayerGroup | null>(null)
  const isochroneLayerRef = useRef<import('leaflet').LayerGroup | null>(null)
  const userPinLayerRef = useRef<import('leaflet').LayerGroup | null>(null)

  // State
  const [mapTheme, setMapTheme] = useState<'dark' | 'light' | 'satellite'>('dark')
  const [activeVibeFilter, setActiveVibeFilter] = useState<VibeCategoryFilter>('all')
  const [center, setCenter] = useState<{ lat: number; lon: number } | null>(null)
  const [geoResolved, setGeoResolved] = useState(false)
  const [loading, setLoading] = useState(false)
  const [selectedVibeItem, setSelectedVibeItem] = useState<VibeItem | null>(null)
  const [showDropVibeModal, setShowDropVibeModal] = useState(false)
  const [gruvsEvents, setGruvsEvents] = useState<GruvsEvent[]>([])
  const [sharedZones, setSharedZones] = useState<SharedZone[]>([])
  const [pendingTapCoords, setPendingTapCoords] = useState<{ lat: number; lon: number; label?: string } | null>(null)

  // 1. Initial Geolocation
  useEffect(() => {
    if (!('geolocation' in navigator)) {
      setCenter({ lat: -26.1926, lon: 28.0305 }) // Braamfontein / Joburg default
      setGeoResolved(true)
      return
    }

    navigator.geolocation.getCurrentPosition(
      pos => {
        setCenter({ lat: pos.coords.latitude, lon: pos.coords.longitude })
        setGeoResolved(true)
      },
      () => {
        setCenter({ lat: -26.1926, lon: 28.0305 })
        setGeoResolved(true)
      },
      { timeout: 7000 }
    )
  }, [])

  // 2. Fetch Gruvs events & Shared community zones
  const loadData = async (lat: number, lon: number) => {
    setLoading(true)
    try {
      const [events, zones] = await Promise.all([
        fetchUpcomingGruvsEvents(20).catch(() => []),
        fetchSharedZones(lat, lon, 15000).catch(() => [])
      ])
      setGruvsEvents(events)
      setSharedZones(zones)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!center) return
    loadData(center.lat, center.lon)
  }, [center])

  // 3. Leaflet Map Lifecycle
  useEffect(() => {
    if (!mapContainerRef.current || !center || !geoResolved) return
    let isCancelled = false

    import('leaflet').then(async L => {
      await import('leaflet.markercluster')
      if (isCancelled || !mapContainerRef.current) return

      leafletRef.current = L

      // Delete default marker icons to avoid 404 asset bugs
      delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: '',
        iconUrl: '',
        shadowUrl: ''
      })

      if (mapRef.current) {
        mapRef.current.remove()
      }

      const map = L.map(mapContainerRef.current, {
        zoomControl: false,
        preferCanvas: true
      }).setView([center.lat, center.lon], 14)

      tileLayerRef.current = L.tileLayer(TILE_SOURCES[mapTheme], {
        attribution: '&copy; CARTO &copy; OpenStreetMap',
        maxZoom: 20,
        subdomains: 'abcd'
      }).addTo(map)

      // Initialize layers
      nightLayerRef.current = L.layerGroup().addTo(map)
      housingLayerRef.current = L.markerClusterGroup({
        disableClusteringAtZoom: 16,
        maxClusterRadius: 50,
        spiderfyOnMaxZoom: true
      }).addTo(map)
      safetyLayerRef.current = L.layerGroup().addTo(map)
      chillLayerRef.current = L.layerGroup().addTo(map)
      isochroneLayerRef.current = L.layerGroup().addTo(map)
      userPinLayerRef.current = L.layerGroup().addTo(map)

      mapRef.current = map

      // Map tap handler
      map.on('click', async (e: import('leaflet').LeafletMouseEvent) => {
        playTactileSound('pop')
        const coords = { lat: e.latlng.lat, lon: e.latlng.lng }
        setPendingTapCoords(coords)

        // Drop temporary glowing tap marker
        if (userPinLayerRef.current) {
          userPinLayerRef.current.clearLayers()
          L.circleMarker([coords.lat, coords.lon], {
            radius: 9,
            color: '#D4AF37',
            fillColor: '#F59E0B',
            fillOpacity: 0.9,
            weight: 2
          }).addTo(userPinLayerRef.current)
        }

        const address = await reverseGeocode(coords.lat, coords.lon)
        if (address) {
          setPendingTapCoords(prev => prev ? { ...prev, label: address } : null)
        }
      })
    })

    return () => {
      isCancelled = true
    }
  }, [geoResolved])

  // 4. Update basemap tile URL smoothly
  useEffect(() => {
    tileLayerRef.current?.setUrl(TILE_SOURCES[mapTheme])
  }, [mapTheme])

  // 5. Render Nightlife Layer (The Gruvs Events)
  useEffect(() => {
    const L = leafletRef.current
    const layer = nightLayerRef.current
    if (!L || !layer || !center) return
    layer.clearLayers()

    if (activeVibeFilter !== 'all' && activeVibeFilter !== 'nightlife') return

    gruvsEvents.forEach((ev, idx) => {
      const angle = (idx * (360 / Math.max(gruvsEvents.length, 1))) * (Math.PI / 180)
      const distKm = 0.6 + (idx % 4) * 0.45
      const dLat = (distKm / 111) * Math.cos(angle)
      const dLon = (distKm / (111 * Math.cos(center.lat * (Math.PI / 180)))) * Math.sin(angle)
      const eLat = center.lat + dLat
      const eLon = center.lon + dLon

      // Pulsing Neon Halo
      L.circleMarker([eLat, eLon], {
        radius: 22,
        color: '#c084fc',
        fillColor: '#9333ea',
        fillOpacity: 0.22,
        weight: 1.5,
        className: 'vibe-pulsing-marker'
      }).addTo(layer)

      // Hotspot Icon
      const marker = L.marker([eLat, eLon], {
        icon: L.divIcon({
          className: '',
          html: `
            <div style="display:flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:14px;background:linear-gradient(135deg,#c084fc,#7e22ce);box-shadow:0 0 20px rgba(168,85,247,0.7);border:2px solid #ffffff;cursor:pointer;transition:transform 0.2s;" onmouseover="this.style.transform='scale(1.2)'" onmouseout="this.style.transform='scale(1)'">
              <span style="font-size:16px;">🔥</span>
            </div>
          `,
          iconSize: [34, 34],
          iconAnchor: [17, 17]
        })
      })

      marker.on('click', () => {
        playTactileSound('pop')
        const distM = distanceMetres(center, { lat: eLat, lon: eLon })
        setSelectedVibeItem({
          id: ev.id,
          type: 'nightlife',
          title: ev.title,
          subtitle: 'The Gruvs Live Stage',
          description: `Live nightlife event verified on The Gruvs network. Resident guestlist passes and drink specials available.`,
          lat: eLat,
          lon: eLon,
          vibeScore: 94,
          badge: 'The Gruvs Nightlife',
          distanceLabel: distM < 1000 ? `${Math.round(distM)}m away` : `${(distM / 1000).toFixed(1)}km away`,
          walkTimeMins: Math.round(distM / 80),
          partnerLink: 'https://thegruvs.com'
        })
      })

      marker.addTo(layer)
    })
  }, [gruvsEvents, center, activeVibeFilter])

  // 6. Render Housing Layer (Price Chips & Walking Isochrones)
  useEffect(() => {
    const L = leafletRef.current
    const cluster = housingLayerRef.current
    if (!L || !cluster || !center) return
    cluster.clearLayers()

    if (activeVibeFilter !== 'all' && activeVibeFilter !== 'housing') return

    listings.forEach(listing => {
      if (typeof listing.lat !== 'number' || typeof listing.lon !== 'number') return

      const marker = L.marker([listing.lat, listing.lon], {
        icon: L.divIcon({
          className: '',
          html: `
            <div style="display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border-radius:9999px;background:rgba(12,14,20,0.95);border:1.5px solid #F59E0B;color:#fff;font-family:inherit;font-size:11px;font-weight:900;box-shadow:0 4px 16px rgba(0,0,0,0.6),0 0 12px rgba(245,158,11,0.3);cursor:pointer;white-space:nowrap;transition:transform 0.2s;" onmouseover="this.style.transform='scale(1.15)';this.style.background='#F59E0B';this.style.color='#000'" onmouseout="this.style.transform='scale(1)';this.style.background='rgba(12,14,20,0.95)';this.style.color='#fff'">
              <span>${listing.currency || 'R'} ${listing.price.toLocaleString()}</span>
            </div>
          `,
          iconSize: [64, 26],
          iconAnchor: [32, 13]
        })
      })

      marker.on('click', () => {
        playTactileSound('pop')
        const distM = distanceMetres(center, { lat: listing.lat!, lon: listing.lon! })

        // Draw walking radius rings on click
        if (isochroneLayerRef.current) {
          isochroneLayerRef.current.clearLayers()
          L.circle([listing.lat!, listing.lon!], {
            radius: 400, // 5 min
            color: '#22c55e',
            dashArray: '4 4',
            fillColor: '#22c55e',
            fillOpacity: 0.08,
            weight: 1.5
          }).addTo(isochroneLayerRef.current)

          L.circle([listing.lat!, listing.lon!], {
            radius: 800, // 10 min
            color: '#06b6d4',
            dashArray: '6 6',
            fillColor: '#06b6d4',
            fillOpacity: 0.04,
            weight: 1.2
          }).addTo(isochroneLayerRef.current)
        }

        setSelectedVibeItem({
          id: listing.id,
          type: 'housing',
          title: listing.title,
          subtitle: listing.suburb || listing.location,
          description: listing.description || 'Verified room listing on The Resident civic network.',
          price: listing.price,
          currency: listing.currency,
          lat: listing.lat!,
          lon: listing.lon!,
          vibeScore: 88,
          badge: 'Verified Co-Living',
          distanceLabel: distM < 1000 ? `${Math.round(distM)}m away` : `${(distM / 1000).toFixed(1)}km away`,
          walkTimeMins: Math.round(distM / 80)
        })
      })

      marker.addTo(cluster)
    })
  }, [listings, center, activeVibeFilter])

  // 7. Render Safety & Caution Layer
  useEffect(() => {
    const L = leafletRef.current
    const layer = safetyLayerRef.current
    if (!L || !layer || !center) return
    layer.clearLayers()

    if (activeVibeFilter !== 'all' && activeVibeFilter !== 'safety') return

    sharedZones.forEach(zone => {
      const isRoadClosed = zone.kind === 'road_closed'
      const color = isRoadClosed ? '#ef4444' : '#f59e0b'

      // Safety Halo
      L.circleMarker([zone.lat, zone.lon], {
        radius: 20,
        color,
        fillColor: color,
        fillOpacity: 0.16,
        weight: 1.5,
        className: 'vibe-pulsing-marker'
      }).addTo(layer)

      // Marker
      const marker = L.marker([zone.lat, zone.lon], {
        icon: L.divIcon({
          className: '',
          html: `
            <div style="display:flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:10px;background:${color};border:2px solid #fff;box-shadow:0 0 14px ${color};cursor:pointer;transition:transform 0.2s;" onmouseover="this.style.transform='scale(1.2)'" onmouseout="this.style.transform='scale(1)'">
              <span style="font-size:13px;color:#fff;">${isRoadClosed ? '🚧' : '⚠️'}</span>
            </div>
          `,
          iconSize: [28, 28],
          iconAnchor: [14, 14]
        })
      })

      marker.on('click', () => {
        playTactileSound('pop')
        const distM = distanceMetres(center, zone)
        setSelectedVibeItem({
          id: zone.id,
          type: 'safety',
          title: zone.label || (isRoadClosed ? 'Road Closed' : 'Street Caution'),
          subtitle: `Reported by ${zone.source_app === 'gruvs' ? 'The Gruvs' : 'The Resident'} Resident`,
          description: zone.note || 'Active crowd-verified hazard. Please proceed with caution or choose an alternate route.',
          lat: zone.lat,
          lon: zone.lon,
          vibeScore: 60,
          badge: isRoadClosed ? 'Hazard Block' : 'Street Alert',
          distanceLabel: distM < 1000 ? `${Math.round(distM)}m away` : `${(distM / 1000).toFixed(1)}km away`,
          walkTimeMins: Math.round(distM / 80)
        })
      })

      marker.addTo(layer)
    })
  }, [sharedZones, center, activeVibeFilter])

  // Recenter GPS Button
  const handleRecenter = () => {
    playTactileSound('click')
    if (!navigator.geolocation || !mapRef.current) return
    navigator.geolocation.getCurrentPosition(pos => {
      const newCoords = { lat: pos.coords.latitude, lon: pos.coords.longitude }
      setCenter(newCoords)
      mapRef.current?.setView([newCoords.lat, newCoords.lon], 15)
    })
  }

  return (
    <div className={`relative w-full overflow-hidden ${fullscreen ? 'h-screen' : 'h-[calc(100vh-13rem)] min-h-[580px] rounded-3xl border border-white/10 shadow-glass'}`}>
      {/* Map Target Canvas */}
      <div ref={mapContainerRef} className="w-full h-full bg-[#0a0a0c]" />

      {/* Top Floating Control Bar */}
      <div className="absolute top-4 left-4 right-4 z-[500] flex flex-col sm:flex-row items-center justify-between gap-3 pointer-events-none">
        {/* Search Input Box */}
        <div className="w-full sm:w-80 pointer-events-auto">
          <MapSearchBox
            onSelect={(result) => {
              playTactileSound('tab')
              setCenter({ lat: result.lat, lon: result.lon })
              mapRef.current?.setView([result.lat, result.lon], 15)
            }}
          />
        </div>

        {/* Vibe Category Filter Pills */}
        <div className="flex items-center gap-1.5 bg-black/85 backdrop-blur-2xl p-1.5 rounded-2xl border border-white/15 shadow-2xl overflow-x-auto max-w-full pointer-events-auto no-scrollbar">
          <button
            onClick={() => { playTactileSound('tab'); setActiveVibeFilter('all') }}
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

      {/* Floating Bottom Left: Drop Vibe CTA */}
      <div className="absolute bottom-20 md:bottom-5 left-4 z-[500] flex items-center gap-2">
        <button
          onClick={() => {
            playTactileSound('pop')
            setShowDropVibeModal(true)
          }}
          className="px-4 py-3 rounded-2xl bg-gradient-to-r from-gold-primary to-amber-500 text-black font-black text-xs uppercase tracking-wider shadow-[0_0_30px_rgba(212,175,55,0.4)] hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
        >
          <Sparkles size={16} />
          <span>+ Drop Vibe</span>
        </button>

        {pendingTapCoords?.label && (
          <div className="hidden md:flex items-center gap-2 bg-black/80 backdrop-blur-xl border border-white/10 px-3 py-2 rounded-2xl text-[11px] text-gray-300 max-w-xs truncate">
            <MapPin size={13} className="text-gold-primary shrink-0" />
            <span className="truncate">{pendingTapCoords.label}</span>
          </div>
        )}
      </div>

      {/* Floating Bottom Right: Map & Position Controls */}
      <div className="absolute bottom-20 md:bottom-5 right-4 z-[500] flex flex-col gap-2.5">
        {/* Basemap Switcher (Dark / Voyager / Satellite) */}
        <div className="bg-black/85 backdrop-blur-2xl border border-white/10 rounded-2xl p-1 shadow-2xl flex flex-col gap-1">
          <button
            onClick={() => { playTactileSound('click'); setMapTheme('dark') }}
            className={`p-2 rounded-xl text-xs font-bold transition-all ${mapTheme === 'dark' ? 'bg-gold-primary text-black' : 'text-gray-400 hover:text-white'}`}
            title="Dark Cyberpunk Map"
          >
            <Compass size={16} />
          </button>
          <button
            onClick={() => { playTactileSound('click'); setMapTheme('satellite') }}
            className={`p-2 rounded-xl text-xs font-bold transition-all ${mapTheme === 'satellite' ? 'bg-gold-primary text-black' : 'text-gray-400 hover:text-white'}`}
            title="Satellite Imagery"
          >
            <Satellite size={16} />
          </button>
        </div>

        {/* GPS Locate Me */}
        <button
          onClick={handleRecenter}
          className="p-3 bg-black/85 hover:bg-black backdrop-blur-2xl border border-white/10 text-gold-primary hover:text-white rounded-2xl shadow-2xl transition-all active:scale-95 flex items-center justify-center"
          title="Recenter to My GPS Location"
        >
          <LocateFixed size={18} />
        </button>
      </div>

      {/* Interactive Bottom Sheet POI Details */}
      <VibeBottomSheet
        item={selectedVibeItem}
        onClose={() => {
          setSelectedVibeItem(null)
          isochroneLayerRef.current?.clearLayers()
        }}
      />

      {/* Quick Vibe Dropper Modal */}
      <QuickVibeReportModal
        isOpen={showDropVibeModal}
        onClose={() => setShowDropVibeModal(false)}
        currentCoords={pendingTapCoords || center}
        onReportSuccess={() => {
          if (center) loadData(center.lat, center.lon)
        }}
      />

      {/* Global CSS for pulsing markers */}
      <style jsx global>{`
        .vibe-pulsing-marker {
          animation: vibePulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        @keyframes vibePulse {
          0%, 100% {
            opacity: 0.8;
            transform: scale(1);
          }
          50% {
            opacity: 0.2;
            transform: scale(1.15);
          }
        }
      `}</style>
    </div>
  )
}
