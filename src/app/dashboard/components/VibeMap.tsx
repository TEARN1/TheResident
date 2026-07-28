'use client'

import React, { useEffect, useRef, useState } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { 
  RootState, 
  Listing, 
  Vendor, 
  SharedResource, 
  Alert, 
  TrafficReport,
  updateListingVerification,
  updateVendorVerification,
  updateResourceVerification,
  addTrafficReport,
  addNotification,
  updateSharedResourceStatus
} from '../../../store'
import { MapPin, Navigation, Camera, AlertTriangle, Eye, Shield, Check, Info, Star } from 'lucide-react'
import { distanceMetres, calculateWaterWaitTime } from '../../../utils/logic'
import { supabase } from '../../../utils/supabase'
import { fetchSharedZones, SharedZone } from '../../../utils/mapZones'

// Default Ivory Park / Midrand center
const DEFAULT_CENTER: [number, number] = [-25.9983, 28.2144]

const DEFAULT_MOCK_LISTINGS: Listing[] = [
  {
    id: 'mock-listing-1',
    title: 'Cozy Room near Stand 459',
    description: 'Clean backyard room with pre-paid sub-meter electricity.',
    price: 1200,
    currency: 'ZAR',
    suburb: 'Ivory Park Zone 5',
    location: 'Stand 4592, Zone 5',
    safetyNotes: 'Secure yard',
    landlordId: 'll-1',
    landlordName: 'Amahle Nkwali',
    landlordLivesHere: true,
    lat: -25.9983,
    lon: 28.2144,
    safetyRating: 'high',
    images: [],
    amenities: { wifi: true, parking: false, bathroom: 'shared' },
    requirements: { genderPreference: 'any', childrenAllowed: true, maxChildren: 2, smokingAllowed: false, petsAllowed: false }
  },
  {
    id: 'mock-listing-2',
    title: 'Spacious Shack Unit',
    description: 'Near communal borehole and taxi rank.',
    price: 950,
    currency: 'ZAR',
    suburb: 'Ivory Park Zone 2',
    location: 'Stand 1201, Zone 2',
    safetyNotes: 'Well-lit street',
    landlordId: 'll-2',
    landlordName: 'Sipho Zulu',
    landlordLivesHere: false,
    lat: -25.9950,
    lon: 28.2180,
    safetyRating: 'medium',
    images: [],
    amenities: { wifi: false, parking: true, bathroom: 'shared' },
    requirements: { genderPreference: 'any', childrenAllowed: true, maxChildren: 2, smokingAllowed: false, petsAllowed: false }
  }
]

const DEFAULT_MOCK_VENDORS: Vendor[] = [
  {
    id: 'mock-vendor-1',
    name: 'Sipho Fresh Produce Spaza',
    category: 'Food & Fresh Produce',
    description: 'Open 06:00 - 20:00 Daily',
    contactNumber: '0812345678',
    status: 'active',
    rating: 4.8,
    reviewsCount: 12,
    lat: -25.9975,
    lon: 28.2130
  },
  {
    id: 'mock-vendor-2',
    name: 'Mama Khumalo General Dealer',
    category: 'Groceries & Paraffin',
    description: 'Open 07:00 - 21:00 Daily',
    contactNumber: '0823456789',
    status: 'active',
    rating: 4.9,
    reviewsCount: 24,
    lat: -25.9990,
    lon: 28.2160
  }
]

const DEFAULT_MOCK_RESOURCES: SharedResource[] = [
  {
    id: 'mock-tap-1',
    name: 'Community Borehole Standpipe #1',
    type: 'borehole',
    status: 'pressure:high|buckets:3|wait:9',
    description: 'Community water standpipe with solar pump',
    location: 'Ivory Park Zone 5',
    latitude: -25.9983,
    longitude: 28.2144
  },
  {
    id: 'mock-tap-2',
    name: 'Zone 2 Solar Standpipe',
    type: 'borehole',
    status: 'pressure:dribble|buckets:8|wait:24',
    description: 'Solar-powered communal tap',
    location: 'Ivory Park Zone 2',
    latitude: -25.9945,
    longitude: 28.2175
  }
]

const DEFAULT_MOCK_ALERTS: Alert[] = [
  {
    id: 'mock-alert-1',
    title: 'Pothole Alert - Zone 5 Main Rd',
    description: 'Deep pothole near intersection.',
    category: 'utility',
    severity: 'warning',
    status: 'active',
    createdBy: 'system',
    createdAt: new Date().toISOString(),
    lat: -25.9970,
    lon: 28.2150
  }
]

export default function VibeMap() {
  const dispatch = useDispatch()
  const mapRef = useRef<any>(null)
  const routingControlRef = useRef<any>(null)
  
  const [L, setL] = useState<any>(null)
  const [mapReady, setMapReady] = useState(false)

  // The SHARED living map: Gruvs closures/events + mirrored civic alerts.
  const [gruvsZones, setGruvsZones] = useState<SharedZone[]>([])
  
  // Select data from Redux with fallback to default mock items when empty
  const reduxListings = useSelector((state: RootState) => state.listings.items)
  const reduxVendors = useSelector((state: RootState) => state.community.vendors)
  const reduxSharedResources = useSelector((state: RootState) => state.community.sharedResources)
  const reduxAlerts = useSelector((state: RootState) => state.community.alerts)

  const listings = reduxListings.length > 0 ? reduxListings : DEFAULT_MOCK_LISTINGS
  const vendors = reduxVendors.length > 0 ? reduxVendors : DEFAULT_MOCK_VENDORS
  const sharedResources = reduxSharedResources.length > 0 ? reduxSharedResources : DEFAULT_MOCK_RESOURCES
  const alerts = reduxAlerts.length > 0 ? reduxAlerts : DEFAULT_MOCK_ALERTS

  const trafficReports = useSelector((state: RootState) => state.networking.trafficReports)
  const currentUser = useSelector((state: RootState) => state.auth.currentUser)

  // Interactive UI state
  const [activeCategory, setActiveCategory] = useState<string>('all')
  const [radiusKm, setRadiusKm] = useState<number>(2) // Default 2km radius
  const [searchCenter, setSearchCenter] = useState<[number, number]>(DEFAULT_CENTER)
  const [selectedEntity, setSelectedEntity] = useState<any>(null)
  const [entityType, setEntityType] = useState<'listing' | 'vendor' | 'resource' | 'alert' | null>(null)
  
  const [editPressure, setEditPressure] = useState<string>('high')
  const [editBuckets, setEditBuckets] = useState<number>(0)

  const parseWaterStatus = (statusStr: string) => {
    const parts = (statusStr || '').split('|')
    const statusObj = {
      pressure: 'high',
      buckets: 0,
      wait: 0
    }
    parts.forEach(part => {
      const [key, val] = part.split(':')
      if (key === 'pressure') statusObj.pressure = val
      if (key === 'buckets') statusObj.buckets = parseInt(val) || 0
      if (key === 'wait') statusObj.wait = parseInt(val) || 0
    })
    if (parts.length === 1 && !statusStr.includes(':')) {
      statusObj.pressure = statusStr || 'high'
    }
    return statusObj
  }

  useEffect(() => {
    if (selectedEntity && entityType === 'resource' && selectedEntity.type === 'borehole') {
      const parsed = parseWaterStatus(selectedEntity.status)
      setEditPressure(parsed.pressure)
      setEditBuckets(parsed.buckets)
    }
  }, [selectedEntity, entityType])

  // Verification form state
  const [showVerifyModal, setShowVerifyModal] = useState(false)
  const [verificationPhotoUrl, setVerificationPhotoUrl] = useState('')
  const [verificationFeedback, setVerificationFeedback] = useState('')
  const [surveyorReputationXP, setSurveyorReputationXP] = useState<number>(0)
  const [showXpBadge, setShowXpBadge] = useState(false)

  // Traffic reporting state
  const [showReportTrafficModal, setShowReportTrafficModal] = useState(false)
  const [reportType, setReportType] = useState<TrafficReport['reportType']>('congestion')
  const [reportDescription, setReportDescription] = useState('')
  const [reportCoords, setReportCoords] = useState<[number, number] | null>(null)

  // Routing navigation state
  const [navigationMode, setNavigationMode] = useState(false)
  const [routeDirections, setRouteDirections] = useState<string[]>([])
  const [routeEta, setRouteEta] = useState<number | null>(null)
  const [routeDistance, setRouteDistance] = useState<string | null>(null)
  const [navigationDestination, setNavigationDestination] = useState<any>(null)

  // Load Leaflet dynamically to bypass NextJS server-side compilation issues
  useEffect(() => {
    if (typeof window === 'undefined') return

    const loadLeaflet = async () => {
      try {
        const Leaflet = await import('leaflet')
        // @ts-ignore
        await import('leaflet/dist/leaflet.css')
        
        const leafletInstance = Leaflet.default || Leaflet

        // Reconfigure default marker icon paths to use cdn resources (otherwise build splits break them)
        delete (leafletInstance.Icon.Default.prototype as any)._getIconUrl
        leafletInstance.Icon.Default.mergeOptions({
          iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
          iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
          shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
        })

        // Dynamically load leaflet-routing-machine
        // @ts-ignore
        await import('leaflet-routing-machine')

        setL(leafletInstance)
      } catch (err) {
        console.error('Error loading Leaflet packages:', err)
      }
    }

    loadLeaflet()
  }, [])

  // Initialize Map
  useEffect(() => {
    if (!L || mapRef.current) return

    const map = L.map('vibe-map-container', {
      zoomControl: false
    }).setView(DEFAULT_CENTER, 14)

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map)

    // Add zoom control at bottom-right for clean visual aesthetics
    L.control.zoom({ position: 'bottomright' }).addTo(map)

    // Set up click handler to place traffic reports
    map.on('click', (e: any) => {
      setReportCoords([e.latlng.lat, e.latlng.lng])
    })

    mapRef.current = map
    setMapReady(true)

    return () => {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, [L])

  // Pull the shared living-map zones around the current search centre. Refreshes
  // when the centre/radius moves. Best-effort — a failure just shows no zones.
  useEffect(() => {
    let alive = true
    fetchSharedZones(searchCenter[0], searchCenter[1], Math.max(2000, radiusKm * 1000))
      .then((z) => { if (alive) setGruvsZones(z) })
    return () => { alive = false }
  }, [searchCenter, radiusKm])

  // Haversine formula to compute distance in km using unified logic
  const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    return distanceMetres({ lat: lat1, lon: lon1 }, { lat: lat2, lon: lon2 }) / 1000
  }

  // Filter listings, vendors, and resources by category and proximity
  const filteredListings = listings.filter((item: Listing) => {
    const lat = item.lat ?? DEFAULT_CENTER[0]
    const lon = item.lon ?? DEFAULT_CENTER[1]
    const dist = getDistance(searchCenter[0], searchCenter[1], lat, lon)
    const categoryMatch = activeCategory === 'all' || activeCategory === 'listing'
    return categoryMatch && dist <= radiusKm
  })

  const filteredVendors = vendors.filter((item: Vendor) => {
    const lat = item.lat ?? DEFAULT_CENTER[0]
    const lon = item.lon ?? DEFAULT_CENTER[1]
    const dist = getDistance(searchCenter[0], searchCenter[1], lat, lon)
    const categoryMatch = activeCategory === 'all' || activeCategory === 'vendor'
    return categoryMatch && dist <= radiusKm
  })

  const filteredResources = sharedResources.filter((item: SharedResource) => {
    const lat = item.latitude ?? DEFAULT_CENTER[0]
    const lon = item.longitude ?? DEFAULT_CENTER[1]
    const dist = getDistance(searchCenter[0], searchCenter[1], lat, lon)
    const categoryMatch = activeCategory === 'all' || activeCategory === 'resource'
    return categoryMatch && dist <= radiusKm
  })

  const filteredAlerts = alerts.filter((item: Alert) => {
    const lat = item.lat ?? DEFAULT_CENTER[0]
    const lon = item.lon ?? DEFAULT_CENTER[1]
    const dist = getDistance(searchCenter[0], searchCenter[1], lat, lon)
    const categoryMatch = activeCategory === 'all' || activeCategory === 'alert'
    return categoryMatch && dist <= radiusKm
  })

  // Synchronize Markers to Map
  useEffect(() => {
    if (!mapReady || !L || !mapRef.current) return

    const map = mapRef.current

    // Clear existing markers (excluding routing controls)
    map.eachLayer((layer: any) => {
      if (layer instanceof L.Marker) {
        map.removeLayer(layer)
      }
    })

    // 1. Draw search radius circle overlay
    const circle = L.circle(searchCenter, {
      color: '#4f46e5',
      fillColor: '#818cf8',
      fillOpacity: 0.08,
      radius: radiusKm * 1000
    }).addTo(map)

    // 2. Room Listings Markers (Gold Luxury House Icon Theme)
    filteredListings.forEach((item: Listing) => {
      const lat = item.lat ?? DEFAULT_CENTER[0]
      const lon = item.lon ?? DEFAULT_CENTER[1]
      const markerHtml = `
        <div style="
          background: linear-gradient(135deg, #fbbf24, #d97706);
          border: 2px solid #ffffff;
          border-radius: 50%;
          width: 34px;
          height: 34px;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 0 12px rgba(251, 191, 36, 0.6);
        ">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#000000" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
        </div>
      `
      const customIcon = L.divIcon({
        html: markerHtml,
        className: 'custom-map-marker',
        iconSize: [34, 34]
      })

      const marker = L.marker([lat, lon], { icon: customIcon }).addTo(map)
      marker.on('click', () => {
        setSelectedEntity(item)
        setEntityType('listing')
      })
    })

    // 3. Handyman Gigs / Vendors Markers (Emerald Storefront Icon Theme)
    filteredVendors.forEach((item: Vendor) => {
      const lat = item.lat ?? DEFAULT_CENTER[0]
      const lon = item.lon ?? DEFAULT_CENTER[1]
      const markerHtml = `
        <div style="
          background: linear-gradient(135deg, #10b981, #059669);
          border: 2px solid #ffffff;
          border-radius: 50%;
          width: 34px;
          height: 34px;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 0 12px rgba(16, 185, 129, 0.6);
        ">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/><path d="M2 7h20"/></svg>
        </div>
      `
      const customIcon = L.divIcon({
        html: markerHtml,
        className: 'custom-map-marker',
        iconSize: [34, 34]
      })

      const marker = L.marker([lat, lon], { icon: customIcon }).addTo(map)
      marker.on('click', () => {
        setSelectedEntity(item)
        setEntityType('vendor')
      })
    })

    // 4. Shared Resources Markers (Cyan Droplet Water Theme)
    filteredResources.forEach((item: SharedResource) => {
      const lat = item.latitude ?? DEFAULT_CENTER[0]
      const lon = item.longitude ?? DEFAULT_CENTER[1]
      const markerHtml = `
        <div style="
          background: linear-gradient(135deg, #0ea5e9, #0284c7);
          border: 2px solid #ffffff;
          border-radius: 50%;
          width: 34px;
          height: 34px;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 0 12px rgba(14, 165, 233, 0.6);
        ">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/></svg>
        </div>
      `
      const customIcon = L.divIcon({
        html: markerHtml,
        className: 'custom-map-marker',
        iconSize: [34, 34]
      })

      const marker = L.marker([lat, lon], { icon: customIcon }).addTo(map)
      marker.on('click', () => {
        setSelectedEntity(item)
        setEntityType('resource')
      })
    })

    // 5. Active Safety Alerts Markers (Glowing Rose Hazard Theme)
    filteredAlerts.forEach((item: Alert) => {
      const lat = item.lat ?? DEFAULT_CENTER[0]
      const lon = item.lon ?? DEFAULT_CENTER[1]
      const markerHtml = `
        <div style="
          background: linear-gradient(135deg, #ef4444, #dc2626);
          border: 2px solid #ffffff;
          border-radius: 50%;
          width: 38px;
          height: 38px;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 0 16px rgba(239, 68, 68, 0.8);
        ">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
        </div>
      `
      const customIcon = L.divIcon({
        html: markerHtml,
        className: 'custom-map-marker',
        iconSize: [38, 38]
      })

      const marker = L.marker([lat, lon], { icon: customIcon }).addTo(map)
      marker.on('click', () => {
        setSelectedEntity(item)
        setEntityType('alert')
      })
    })

    // 6. Draw Traffic Reports (Flashing Caution Icons)
    trafficReports.forEach((report: TrafficReport) => {
      const typeIcons: Record<string, string> = {
        congestion: '🚗',
        pothole: '🕳️',
        roadblock: '🚧',
        accident: '💥',
        dead_robots: '🚦',
        other: '⚠️'
      }
      const markerHtml = `
        <div style="
          background: rgba(220, 38, 38, 0.9);
          border: 2px solid #fbbf24;
          border-radius: 50%;
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
        ">
          ${typeIcons[report.reportType] || '⚠️'}
        </div>
      `
      const customIcon = L.divIcon({
        html: markerHtml,
        className: 'custom-traffic-marker',
        iconSize: [28, 28]
      })

      const marker = L.marker([report.lat, report.lon], { icon: customIcon }).addTo(map)
      marker.bindPopup(`
        <div class="p-2 text-slate-800">
          <p class="font-bold text-sm capitalize">${report.reportType.replace('_', ' ')}</p>
          <p class="text-xs mt-1">${report.description || 'Reported delay bottleneck'}</p>
          <p class="text-[10px] text-slate-400 mt-1">${report.createdAt ? new Date(report.createdAt).toLocaleTimeString() : ''}</p>
        </div>
      `)
    })

    // 7. SHARED living-map zones (from The Gruvs + mirrored civic alerts).
    //    Distinct violet "shared" pins. Popups are built with textContent only —
    //    never innerHTML — so a hostile alert title can never inject script.
    gruvsZones.forEach((z: SharedZone) => {
      const isResident = z.source_app === 'resident'
      const ring = isResident ? '#eab308' : '#8b5cf6'
      const glyph = isResident ? '!' : '◆'
      const markerHtml = `
        <div style="
          background: ${isResident ? 'linear-gradient(135deg,#eab308,#ca8a04)' : 'linear-gradient(135deg,#8b5cf6,#6d28d9)'};
          border: 2px solid #ffffff; border-radius: 50%;
          width: 30px; height: 30px; display: flex; align-items: center; justify-content: center;
          color: #fff; font-weight: 800; font-size: 14px;
          box-shadow: 0 0 12px ${ring}99;
        ">${glyph}</div>`
      const icon = L.divIcon({ html: markerHtml, className: 'custom-shared-marker', iconSize: [30, 30] })
      const marker = L.marker([z.lat, z.lon], { icon }).addTo(map)

      // Safe popup: DOM nodes with textContent (XSS-proof for user-supplied text).
      const el = document.createElement('div')
      el.style.cssText = 'padding:4px 2px;color:#0f172a;max-width:220px'
      const tag = document.createElement('p')
      tag.style.cssText = 'font-weight:800;font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:' + (isResident ? '#a16207' : '#6d28d9') + ';margin:0 0 2px'
      tag.textContent = isResident ? 'Community report · The Resident' : 'The Gruvs · live map'
      const title = document.createElement('p')
      title.style.cssText = 'font-weight:700;font-size:13px;margin:0'
      title.textContent = z.label || z.kind || 'Zone'
      el.appendChild(tag); el.appendChild(title)
      if (z.note) {
        const note = document.createElement('p')
        note.style.cssText = 'font-size:11px;margin:3px 0 0;color:#475569'
        note.textContent = z.note
        el.appendChild(note)
      }
      marker.bindPopup(el)
    })

    return () => {
      map.removeLayer(circle)
    }
  }, [mapReady, activeCategory, radiusKm, searchCenter, listings, vendors, sharedResources, alerts, trafficReports, gruvsZones])

  // Routing Engine Implementation
  useEffect(() => {
    if (!L || !mapReady || !mapRef.current) return

    const map = mapRef.current

    // Clear existing routing control
    if (routingControlRef.current) {
      map.removeControl(routingControlRef.current)
      routingControlRef.current = null
    }

    if (navigationMode && navigationDestination) {
      const destLat = navigationDestination.lat ?? navigationDestination.latitude
      const destLon = navigationDestination.lon ?? navigationDestination.longitude

      if (destLat && destLon) {
        try {
          const control = L.Routing.control({
            waypoints: [
              L.latLng(DEFAULT_CENTER[0], DEFAULT_CENTER[1]), // current simulation start
              L.latLng(destLat, destLon)
            ],
            routeWhileDragging: false,
            addWaypoints: false,
            fitSelectedRoutes: true,
            show: false, // hide Leaflet default overlay panel to render in custom sidebar
            createMarker: () => null, // hide default markers on path endpoints
            router: L.Routing.osrmv1({
              serviceUrl: 'https://router.project-osrm.org/route/v1'
            })
          }).addTo(map)

          control.on('routesfound', (e: any) => {
            const routes = e.routes
            if (routes && routes[0]) {
              const coordinates = routes[0].coordinates || []
              let extraDelayMinutes = 0
              let speedDecayMultiplier = 1.0
              let detectedHazards: string[] = []

              // Check proximity (< 100m) of each active traffic report to the route coordinates
              trafficReports.forEach((report: TrafficReport) => {
                const reportLat = report.lat
                const reportLon = report.lon
                
                // Find if any point on the route is within 100m (0.1km) of this report
                const isNearRoute = coordinates.some((coord: any) => {
                  const dist = getDistance(coord.lat, coord.lng, reportLat, reportLon)
                  return dist <= 0.1 // 100 meters
                })

                if (isNearRoute) {
                  if (report.reportType === 'dead_robots') {
                    extraDelayMinutes += 10
                    detectedHazards.push('Dead Robots (+10m)')
                  } else if (report.reportType === 'pothole') {
                    speedDecayMultiplier += 0.15
                    detectedHazards.push('Pothole Hazard (+15% speed decay)')
                  } else if (report.reportType === 'roadblock') {
                    extraDelayMinutes += 15
                    detectedHazards.push('Roadblock Detour (+15m)')
                  } else if (report.reportType === 'congestion') {
                    extraDelayMinutes += 5
                    detectedHazards.push('Heavy Congestion (+5m)')
                  }
                }
              })

              const baseEta = Math.round(routes[0].summary.totalTime / 60)
              const adjustedEta = Math.round((baseEta * speedDecayMultiplier) + extraDelayMinutes)

              const instructions = routes[0].instructions.map((inst: any) => inst.text)
              if (detectedHazards.length > 0) {
                instructions.unshift(`⚠️ Traffic delays applied for: ${detectedHazards.join(', ')}`)
              }
              
              setRouteDirections(instructions)
              setRouteEta(adjustedEta)
              setRouteDistance((routes[0].summary.totalDistance / 1000).toFixed(1))
            }
          })

          routingControlRef.current = control
        } catch (err) {
          console.error('Failed to plot route with OSRM:', err)
        }
      }
    } else {
      setRouteDirections([])
      setRouteEta(null)
      setRouteDistance(null)
    }
  }, [navigationMode, navigationDestination, mapReady, L])

  // Verification submit logic
  const handleVerifySubmit = () => {
    if (!selectedEntity || !entityType) return

    const photoUrl = verificationPhotoUrl.trim() || 'https://images.unsplash.com/photo-1582268611958-ebfd161ef9cf?w=500' // mock fresh verification photo
    const timestamp = new Date().toISOString()
    const userId = currentUser?.id || '00000000-0000-4000-8000-000000000000'

    if (entityType === 'listing') {
      dispatch(updateListingVerification({
        id: selectedEntity.id,
        approachPhotoUrl: photoUrl,
        lastVerifiedAt: timestamp,
        verifiedByUserId: userId
      }))
    } else if (entityType === 'vendor') {
      dispatch(updateVendorVerification({
        id: selectedEntity.id,
        approachPhotoUrl: photoUrl,
        lastVerifiedAt: timestamp,
        verifiedByUserId: userId
      }))
    } else if (entityType === 'resource') {
      dispatch(updateResourceVerification({
        id: selectedEntity.id,
        approachPhotoUrl: photoUrl,
        lastVerifiedAt: timestamp,
        verifiedByUserId: userId
      }))
    }

    // Award XP
    setSurveyorReputationXP((prev: number) => prev + 50)
    setShowXpBadge(true)
    setTimeout(() => setShowXpBadge(false), 3000)

    dispatch(addNotification({
      title: 'Survey Verified!',
      message: `Thank you for updating the map. You earned 50 VibePoints!`,
      read: false
    }))

    // Update state & close modal
    setSelectedEntity((prev: any) => ({
      ...prev,
      approachPhotoUrl: photoUrl,
      lastVerifiedAt: timestamp,
      verifiedByUserId: userId
    }))

    setShowVerifyModal(false)
    setVerificationPhotoUrl('')
    setVerificationFeedback('')
  }

  // Traffic submit logic
  const handleReportTrafficSubmit = () => {
    if (!reportCoords) return

    const reportId = `report-${Date.now()}`
    const userId = currentUser?.id || '00000000-0000-4000-8000-000000000000'

    dispatch(addTrafficReport({
      id: reportId,
      reporterId: userId,
      lat: reportCoords[0],
      lon: reportCoords[1],
      reportType,
      description: reportDescription,
      suburb: 'Ivory Park',
      city: 'Midrand',
      createdAt: new Date().toISOString()
    }))

    dispatch(addNotification({
      title: 'Traffic Constraint Logged',
      message: `Reported roadblock/delay bottleneck added to driver routing engines.`,
      read: false
    }))

    // Push to the SHARED living map so it also shows on The Gruvs. Writes a
    // neighbourhood-status row; a server-side trigger mirrors it into map_zones
    // (source forced to 'resident', validated + auto-expiring). Best-effort, and
    // only for a real signed-in user (guests have no auth session / profile row).
    const isRealUser = !!supabase && !!userId && userId !== 'visitor-guest'
      && userId !== '00000000-0000-4000-8000-000000000000'
    if (isRealUser) {
      supabase!.from('res_neighbourhood_status').insert({
        reporter_id: userId,
        kind: reportType,
        status: 'active',
        detail: reportDescription || null,
        suburb: 'Ivory Park',
        city: 'Midrand',
        lat: reportCoords[0],
        lon: reportCoords[1],
      }).then(() => {}, () => {})
    }

    setShowReportTrafficModal(false)
    setReportDescription('')
    setReportCoords(null)
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[80vh] relative overflow-hidden bg-slate-950 text-white rounded-xl border border-slate-800">
      
      {/* 1. Left Sidebar: Radius Filter, Explorer panel, and Routing Navigation instructions */}
      <div className="lg:col-span-4 bg-slate-900 border-r border-slate-800 flex flex-col overflow-y-auto">
        <div className="p-5 border-b border-slate-800">
          <h2 className="text-xl font-bold text-indigo-400 flex items-center gap-2">
            <Navigation className="w-5 h-5" /> VibeMap Hyperlocal
          </h2>
          <p className="text-xs text-slate-400 mt-1">Community navigation and accuracy surveyor engine</p>
          
          {/* Proximity Radius Slider */}
          <div className="mt-4">
            <div className="flex justify-between text-xs text-slate-300 font-semibold mb-1">
              <span>Proximity Search Distance:</span>
              <span className="text-indigo-400 font-bold">{radiusKm} km</span>
            </div>
            <input 
              type="range" 
              min="0.5" 
              max="5" 
              step="0.5"
              value={radiusKm} 
              onChange={(e) => setRadiusKm(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500" 
            />
          </div>

          {/* Category Tabs */}
          <div className="flex gap-1.5 mt-4 overflow-x-auto pb-1">
            {['all', 'listing', 'vendor', 'resource', 'alert'].map((cat) => (
              <button
                key={cat}
                onClick={() => {
                  setActiveCategory(cat)
                  setSelectedEntity(null)
                  setEntityType(null)
                }}
                className={`text-[10px] uppercase font-bold tracking-wider px-3 py-1.5 rounded-md border transition-all ${
                  activeCategory === cat 
                    ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg' 
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'
                }`}
              >
                {cat === 'all' ? 'All Pins' : cat === 'listing' ? 'Rooms' : cat === 'vendor' ? 'Vendors' : cat === 'resource' ? 'Utilities' : 'Alerts'}
              </button>
            ))}
          </div>
        </div>

        {/* Dynamic Navigation Instructions Panel */}
        {navigationMode && routeDirections.length > 0 ? (
          <div className="p-5 flex-1 flex flex-col bg-slate-900 border-t border-indigo-950">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-sm font-bold text-emerald-400 flex items-center gap-1.5">
                <Navigation className="w-4 h-4 animate-pulse" /> Driver Navigation Path
              </h3>
              <button 
                onClick={() => {
                  setNavigationMode(false)
                  setNavigationDestination(null)
                }}
                className="text-xs text-slate-400 hover:text-white px-2 py-0.5 rounded border border-slate-800 bg-slate-950"
              >
                Exit GPS
              </button>
            </div>
            
            {/* OSRM Route Summary */}
            <div className="grid grid-cols-2 gap-2 bg-slate-950 p-3 rounded-lg border border-slate-850 mb-4">
              <div className="text-center border-r border-slate-800">
                <p className="text-[10px] text-slate-400 font-semibold uppercase">Estimated Time</p>
                <p className="text-lg font-extrabold text-white mt-0.5">{routeEta} mins</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] text-slate-400 font-semibold uppercase">Distance</p>
                <p className="text-lg font-extrabold text-white mt-0.5">{routeDistance} km</p>
              </div>
            </div>

            {/* Directions list */}
            <div className="flex-1 overflow-y-auto max-h-[40vh] space-y-2 pr-1">
              {routeDirections.map((step, idx) => (
                <div key={idx} className="flex gap-2 p-2.5 rounded bg-slate-950 border border-slate-900 text-xs text-slate-300">
                  <span className="text-indigo-400 font-bold">{idx + 1}.</span>
                  <span>{step}</span>
                </div>
              ))}
            </div>
          </div>
        ) : selectedEntity ? (
          /* Selected Pin Details Panel */
          <div className="p-5 flex-1 overflow-y-auto space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded uppercase border tracking-wider ${
                  entityType === 'listing' ? 'bg-amber-500/20 border-amber-500/30 text-amber-300' :
                  entityType === 'vendor' ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300' :
                  entityType === 'resource' ? 'bg-sky-500/20 border-sky-500/30 text-sky-300' :
                  'bg-red-500/20 border-red-500/30 text-red-300'
                }`}>
                  {entityType === 'listing' ? 'Room Listing' : entityType === 'vendor' ? 'Spaza/Handyman' : entityType === 'resource' ? 'Utility Point' : 'Security Alert'}
                </span>
                <h3 className="text-lg font-extrabold text-white mt-1.5">
                  {selectedEntity.title || selectedEntity.name}
                </h3>
              </div>
              <button 
                onClick={() => {
                  setSelectedEntity(null)
                  setEntityType(null)
                }}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            {/* Geofenced Proximity Warning for Security Alerts */}
            {entityType === 'alert' && (() => {
              const alertLat = selectedEntity.lat ?? DEFAULT_CENTER[0]
              const alertLon = selectedEntity.lon ?? DEFAULT_CENTER[1]
              const distToUser = getDistance(searchCenter[0], searchCenter[1], alertLat, alertLon)
              const isDangerouslyClose = distToUser <= 0.2 // Within 200 meters
              return (
                <div className={`p-3 rounded-lg border text-xs flex items-start gap-2 ${
                  isDangerouslyClose 
                    ? 'bg-rose-950/40 border-rose-500 text-rose-300 animate-pulse'
                    : 'bg-slate-900 border-slate-800 text-slate-400'
                }`}>
                  <AlertTriangle className={`w-4 h-4 mt-0.5 flex-shrink-0 ${isDangerouslyClose ? 'text-rose-500 animate-bounce' : 'text-slate-500'}`} />
                  <div>
                    <span className="font-bold block uppercase tracking-wider text-[10px]">
                      {isDangerouslyClose ? '🚨 Geofenced Danger Zone' : 'Radar Proximity Check'}
                    </span>
                    <p className="mt-0.5">
                      {isDangerouslyClose 
                        ? `HIGH RISK: This hazard is only ${(distToUser * 1000).toFixed(0)} meters from your radar position! Avoid this street segment.`
                        : `This hazard is located ${(distToUser * 1000).toFixed(0)} meters away from your current center coordinate.`}
                    </p>
                  </div>
                </div>
              )
            })()}

            {/* Description & Details */}
            <div className="bg-slate-950 p-4 rounded-lg border border-slate-850 space-y-3">
              <p className="text-xs text-slate-350 leading-relaxed">
                {selectedEntity.description || selectedEntity.accessNote || 'No description provided.'}
              </p>

              {entityType === 'listing' && (
                <div className="grid grid-cols-2 gap-2 text-xs border-t border-slate-800 pt-3">
                  <div>
                    <span className="text-slate-500 block">Monthly Price</span>
                    <span className="font-extrabold text-amber-400">{selectedEntity.currency} {selectedEntity.price}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Landlord</span>
                    <span className="font-semibold text-white">{selectedEntity.landlordName}</span>
                  </div>
                </div>
              )}

              {entityType === 'vendor' && (
                <div className="grid grid-cols-2 gap-2 text-xs border-t border-slate-800 pt-3">
                  <div>
                    <span className="text-slate-500 block">Contact Number</span>
                    <span className="font-semibold text-white">{selectedEntity.contactNumber || 'None'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Status</span>
                    <span className="font-bold text-emerald-400 capitalize">{selectedEntity.status}</span>
                  </div>
                </div>
              )}

              {entityType === 'resource' && (
                selectedEntity.type === 'borehole' ? (
                  (() => {
                    const parsed = parseWaterStatus(selectedEntity.status)
                    const statusColors: Record<string, string> = {
                      high: 'text-emerald-400',
                      dribble: 'text-amber-500',
                      dry: 'text-rose-500'
                    }
                    const pressureNames: Record<string, string> = {
                      high: 'High Flow 🟢',
                      dribble: 'Dribble 🟡',
                      dry: 'Dry / No Flow 🔴'
                    }
                    return (
                      <div className="space-y-4 border-t border-slate-800 pt-3 text-xs">
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <span className="text-slate-500 block">Pressure Level</span>
                            <span className={`font-bold ${statusColors[parsed.pressure] || 'text-slate-300'}`}>
                              {pressureNames[parsed.pressure] || parsed.pressure}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-500 block">Queue Size</span>
                            <span className="font-semibold text-slate-200">{parsed.buckets} Buckets</span>
                          </div>
                          <div>
                            <span className="text-slate-500 block">Est. Wait Time</span>
                            <span className="font-bold text-indigo-400">{calculateWaterWaitTime(parsed.buckets)} Mins</span>
                          </div>
                        </div>

                        {/* Water Status Update Form */}
                        <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800/80 space-y-3">
                          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Report Water Status</span>
                          
                          {/* Pressure level picker */}
                          <div className="space-y-1">
                            <label className="text-[10px] text-slate-500">Flow Pressure</label>
                            <div className="flex gap-1">
                              {['high', 'dribble', 'dry'].map(pres => (
                                <button
                                  key={pres}
                                  type="button"
                                  onClick={() => setEditPressure(pres)}
                                  className={`flex-1 py-1 rounded text-[10px] font-bold border transition-colors ${
                                    editPressure === pres
                                      ? pres === 'high' ? 'bg-emerald-950/40 border-emerald-500 text-emerald-400'
                                        : pres === 'dribble' ? 'bg-amber-950/40 border-amber-500 text-amber-400'
                                        : 'bg-rose-950/40 border-rose-500 text-rose-400'
                                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                                  }`}
                                >
                                  {pres === 'high' ? 'High' : pres === 'dribble' ? 'Dribble' : 'Dry'}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Buckets picker */}
                          <div className="space-y-1">
                            <label className="text-[10px] text-slate-500">Buckets in Queue: {editBuckets}</label>
                            <div className="flex gap-1">
                              {[0, 5, 10, 20].map(val => (
                                <button
                                  key={val}
                                  type="button"
                                  onClick={() => setEditBuckets(val)}
                                  className={`flex-1 py-1 rounded text-[10px] font-bold border transition-colors ${
                                    editBuckets === val
                                      ? 'bg-indigo-950/40 border-indigo-500 text-indigo-300'
                                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                                  }`}
                                >
                                  {val}
                                </button>
                              ))}
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              const waitVal = calculateWaterWaitTime(editBuckets)
                              const nextStatus = `pressure:${editPressure}|buckets:${editBuckets}|wait:${waitVal}`
                              dispatch(updateSharedResourceStatus({
                                id: selectedEntity.id,
                                status: nextStatus
                              }))
                              // Update selectedEntity so UI details match immediately
                              setSelectedEntity({
                                ...selectedEntity,
                                status: nextStatus
                              })
                              dispatch(addNotification({
                                title: 'Water Status Logged',
                                message: `Updated communal tap: Flow set to ${editPressure.toUpperCase()} with ${editBuckets} buckets in queue (${waitVal} min wait).`,
                                read: false
                              }))
                            }}
                            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-1.5 rounded text-[10px] transition-colors"
                          >
                            Update Tap Status
                          </button>
                        </div>
                      </div>
                    )
                  })()
                ) : (
                  <div className="grid grid-cols-2 gap-2 text-xs border-t border-slate-800 pt-3">
                    <div>
                      <span className="text-slate-500 block">Access Note</span>
                      <span className="font-semibold text-slate-300">{selectedEntity.status}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Kind</span>
                      <span className="font-bold text-sky-400 capitalize">{selectedEntity.type.replace('_', ' ')}</span>
                    </div>
                  </div>
                )
              )}
            </div>

            {/* Micro-Landmark Access Guide */}
            {selectedEntity.microLandmark && (
              <div className="bg-indigo-950/20 border border-indigo-900/30 p-4 rounded-lg">
                <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider block mb-1">Micro-Landmark Navigation Aid</span>
                <p className="text-xs text-indigo-200 font-medium italic">"{selectedEntity.microLandmark}"</p>
              </div>
            )}

            {/* Verification Photo View */}
            <div className="bg-slate-950 border border-slate-850 p-4 rounded-lg space-y-2">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">First-Person Approach Verification</span>
              {selectedEntity.approachPhotoUrl ? (
                <div className="relative group rounded overflow-hidden border border-slate-800">
                  <img 
                    src={selectedEntity.approachPhotoUrl} 
                    alt="Approach verification" 
                    className="w-full h-32 object-cover transition-transform group-hover:scale-105" 
                  />
                  <div className="absolute inset-0 bg-slate-950/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-xs font-bold text-white flex items-center gap-1"><Eye className="w-4 h-4" /> Fresh Approach Photo</span>
                  </div>
                </div>
              ) : (
                <div className="bg-slate-900 p-4 rounded border border-dashed border-slate-800 text-center text-xs text-slate-500">
                  No verified entrance photo uploaded yet. Be the first to verify!
                </div>
              )}

              {/* Timestamp of last verify */}
              {selectedEntity.lastVerifiedAt && (
                <div className="flex justify-between items-center text-[10px] text-slate-500 pt-1">
                  <span>Last Verified:</span>
                  <span className="font-semibold text-slate-400">{new Date(selectedEntity.lastVerifiedAt).toLocaleDateString()}</span>
                </div>
              )}
            </div>

            {/* Action CTAs */}
            <div className="flex flex-col gap-2">
              {/* OSRM Route Navigation Trigger */}
              <button
                onClick={() => {
                  setNavigationDestination(selectedEntity)
                  setNavigationMode(true)
                }}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-indigo-600 text-white font-bold text-xs hover:bg-indigo-500 transition-colors shadow-lg shadow-indigo-900/20"
              >
                <Navigation className="w-4 h-4" /> Start Turn-by-Turn GPS
              </button>

              {/* Verify Map Photo / Details Button */}
              <button
                onClick={() => setShowVerifyModal(true)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-750 border border-slate-750 text-white font-bold text-xs transition-colors"
              >
                <Camera className="w-4 h-4 text-emerald-400" /> Verify Entrance & Coordinates
              </button>

              {/* The Gruvs Integration Link */}
              <a
                href="#thegruvs-dm"
                onClick={(e) => {
                  e.preventDefault()
                  dispatch(addNotification({
                    title: 'Deep-Linking to The Gruvs',
                    message: `Opening direct message dialogue with ${selectedEntity.landlordName || selectedEntity.name || 'Owner'} on thegruvs.com...`,
                    read: false
                  }))
                }}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-slate-950 border border-slate-800 hover:bg-slate-900 text-slate-400 hover:text-white font-semibold text-xs transition-colors"
              >
                <Star className="w-4 h-4 text-amber-500" /> Chat on thegruvs.com
              </a>
            </div>
          </div>
        ) : (
          /* Empty State Explorer List */
          <div className="p-5 flex-1 space-y-3">
            <span className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wider block">Hyperlocal Points of Interest</span>
            <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
              
              {/* Room listings preview */}
              {filteredListings.slice(0, 3).map((item: Listing) => (
                <div 
                  key={item.id} 
                  onClick={() => { setSelectedEntity(item); setEntityType('listing') }}
                  className="p-3 bg-slate-950 border border-slate-850 rounded-lg hover:border-slate-700 cursor-pointer transition-all flex justify-between items-center"
                >
                  <div>
                    <h4 className="font-bold text-xs text-white">{item.title}</h4>
                    <span className="text-[10px] text-slate-500 block mt-0.5">{item.suburb} &bull; {item.safetyRating} safety</span>
                  </div>
                  <span className="text-xs font-bold text-amber-400">{item.currency} {item.price}</span>
                </div>
              ))}

              {/* Vendors preview */}
              {filteredVendors.slice(0, 3).map((item: Vendor) => (
                <div 
                  key={item.id} 
                  onClick={() => { setSelectedEntity(item); setEntityType('vendor') }}
                  className="p-3 bg-slate-950 border border-slate-850 rounded-lg hover:border-slate-700 cursor-pointer transition-all flex justify-between items-center"
                >
                  <div>
                    <h4 className="font-bold text-xs text-white">{item.name}</h4>
                    <span className="text-[10px] text-slate-500 block mt-0.5">{item.category} &bull; {item.status}</span>
                  </div>
                  <span className="text-xs font-bold text-emerald-400 flex items-center gap-0.5"><Star className="w-3 h-3 fill-emerald-400" /> 5.0</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Surveyor Reputation Points status at the bottom of the sidebar */}
        <div className="p-4 border-t border-slate-800 bg-slate-950 flex justify-between items-center text-xs">
          <span className="text-slate-400 font-semibold flex items-center gap-1.5"><Shield className="w-4 h-4 text-emerald-400" /> Surveyor Reputation</span>
          <span className="text-emerald-400 font-extrabold text-sm">{surveyorReputationXP} XP</span>
        </div>
      </div>

      {/* 2. Right Canvas: Interactive Map Container */}
      <div className="lg:col-span-8 relative h-full flex flex-col">
        
        {/* Floating action overlays */}
        <div className="absolute top-4 left-4 z-[999] flex gap-2">
          {/* Report Bottlenecks button */}
          <button
            onClick={() => setShowReportTrafficModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-red-650 hover:bg-red-600 text-white font-bold text-xs shadow-lg transition-colors border border-red-500"
          >
            <AlertTriangle className="w-4 h-4" /> Report Traffic / Hazard
          </button>
        </div>

        {/* Surveyor XP badge modal feedback popup */}
        {showXpBadge && (
          <div className="absolute top-4 right-4 z-[999] bg-emerald-600 border border-emerald-500 text-white font-bold text-xs px-4 py-2.5 rounded-lg shadow-xl animate-bounce flex items-center gap-2">
            <Check className="w-4 h-4" /> Surveyor Bounty XP +50
          </div>
        )}

        {/* Leaflet hook div */}
        <div id="vibe-map-container" className="w-full h-full flex-1"></div>
      </div>

      {/* 3. Surveyor Gamification Photo Verification Modal */}
      {showVerifyModal && selectedEntity && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 p-4">
          <div className="bg-slate-900 border border-slate-800 max-w-md w-full rounded-xl overflow-hidden shadow-2xl p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Camera className="w-5 h-5 text-indigo-400" /> Verify Entrance Photo & Accuracy
              </h3>
              <button onClick={() => setShowVerifyModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Help your community navigate accurately. Take a photo of the entrance approach view (or paste verification URL) and verify micro-landmarks.
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-300 font-semibold block mb-1">Approach Photo URL</label>
                <input 
                  type="text" 
                  value={verificationPhotoUrl}
                  onChange={(e) => setVerificationPhotoUrl(e.target.value)}
                  placeholder="https://images.unsplash.com/photo-..." 
                  className="w-full text-xs bg-slate-950 border border-slate-850 px-3 py-2 rounded-lg text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500" 
                />
              </div>

              <div>
                <label className="text-xs text-slate-300 font-semibold block mb-1">Surveyor Feedback notes</label>
                <textarea 
                  value={verificationFeedback}
                  onChange={(e) => setVerificationFeedback(e.target.value)}
                  placeholder="Street name is correct, entrance is on the left side of the barber shop."
                  rows={3} 
                  className="w-full text-xs bg-slate-950 border border-slate-850 px-3 py-2 rounded-lg text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500" 
                />
              </div>
            </div>

            <div className="bg-indigo-950/20 border border-indigo-900/30 p-3.5 rounded-lg flex items-start gap-2 text-[11px] text-indigo-300">
              <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
              <span>Verifying this pin awards you <strong>50 VibePoints (XP)</strong> and updates the "last verified" status timestamp for commuters.</span>
            </div>

            <div className="flex gap-3 justify-end pt-3 border-t border-slate-800">
              <button 
                onClick={() => setShowVerifyModal(false)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-750 text-xs font-semibold"
              >
                Cancel
              </button>
              <button 
                onClick={handleVerifySubmit}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-bold"
              >
                Submit Verification
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Traffic / Road Bottleneck reporting modal */}
      {showReportTrafficModal && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 p-4">
          <div className="bg-slate-900 border border-slate-800 max-w-md w-full rounded-xl overflow-hidden shadow-2xl p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-500 animate-pulse" /> Report Traffic bottleneck
              </h3>
              <button onClick={() => setShowReportTrafficModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              {reportCoords 
                ? `Coordinates captured: [${reportCoords[0].toFixed(5)}, ${reportCoords[1].toFixed(5)}]` 
                : 'Click anywhere on the map grid behind this modal first to pin the hazard coordinate!'}
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-300 font-semibold block mb-1">Delay / Hazard Type</label>
                <select
                  value={reportType}
                  onChange={(e) => setReportType(e.target.value as TrafficReport['reportType'])}
                  className="w-full text-xs bg-slate-950 border border-slate-850 px-3 py-2 rounded-lg text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="congestion">Traffic / Congestion</option>
                  <option value="pothole">Deep Pothole</option>
                  <option value="roadblock">Police check-point / roadblock</option>
                  <option value="accident">Accident</option>
                  <option value="dead_robots">Dead Robots / Load shedding</option>
                  <option value="other">Other delay obstacle</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-300 font-semibold block mb-1">Description / Details</label>
                <textarea 
                  value={reportDescription}
                  onChange={(e) => setReportDescription(e.target.value)}
                  placeholder="e.g. Stage 2 load shedding has intersection offline; heavy bumper-to-bumper queue."
                  rows={3} 
                  className="w-full text-xs bg-slate-950 border border-slate-850 px-3 py-2 rounded-lg text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500" 
                />
              </div>
            </div>

            <div className="flex gap-3 justify-end pt-3 border-t border-slate-800">
              <button 
                onClick={() => setShowReportTrafficModal(false)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-750 text-xs font-semibold"
              >
                Cancel
              </button>
              <button 
                onClick={handleReportTrafficSubmit}
                disabled={!reportCoords}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-xs font-bold disabled:bg-slate-800 disabled:text-slate-550 disabled:cursor-not-allowed"
              >
                Submit Report
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
