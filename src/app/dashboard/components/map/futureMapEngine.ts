/**
 * futureMapEngine.ts — the 3D, moving VibeMap on MapLibre GL (VibeMap.tsx).
 *
 * Same engine as The Gruvs' Vibe Map, in The Resident's colours:
 *
 *   styleFor / rasterFallbackStyle  Vector basemaps from OpenFreeMap (keyless),
 *       Esri satellite imagery, and CARTO raster if the vector style can't load.
 *   installVibeLayers / applyCity   Neon 3D buildings + dusk sky, and every data
 *       layer (events, clustered room pills, safety alerts, walking rings) drawn
 *       on the one GPU canvas — not one DOM node per pin.
 *   createBeams      Light pillars over the soonest Gruvs events.
 *   createRadar      Sonar sweep + pings round you, sized to the 15-minute walk.
 *   createStreams    Route arcs from you to what's near, with sparks running along.
 *   createHazards    Warning sonar under the nearest safety alerts.
 *   cinematicIntro / focusOrbit     The fly-in, and the fly-to + slow orbit on a pick.
 *
 * Performance rule: nothing changes map paint properties on a timer — a paint
 * change makes MapLibre redraw the whole map, and a loop of them keeps the CPU
 * busy without a GPU. Constant motion is CSS on a capped handful of DOM markers
 * (futureMap.css), plus a 30 fps nudge of a few spark markers that stops when
 * the map is off screen or the tab is in the background. Camera moves happen on
 * open and when you pick something. Reduced motion: none of it moves.
 *
 * Text from the data (event titles, venues) only ever goes in via textContent.
 */
import type { GeoJSONSource, LayerSpecification, Map as MLMap, Marker, StyleSpecification } from 'maplibre-gl'
import { metresPerPixel, type EventPulse, type LatLon, type LngLatTuple } from '../../../../utils/futureMap'

export type Engine = typeof import('maplibre-gl')
export type MapTheme = 'dark' | 'light' | 'satellite'

export const reducedMotion = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

// ── Basemaps ────────────────────────────────────────────────────────────────
const OFM = 'https://tiles.openfreemap.org'
const GLYPHS = `${OFM}/fonts/{fontstack}/{range}.pbf`
const LABEL_FONT = ['Noto Sans Bold']

export function styleFor(theme: MapTheme): string | StyleSpecification {
  if (theme === 'satellite') return satelliteStyle()
  return theme === 'light' ? `${OFM}/styles/liberty` : `${OFM}/styles/dark`
}

function satelliteStyle(): StyleSpecification {
  return {
    version: 8,
    glyphs: GLYPHS,
    sources: {
      imagery: {
        type: 'raster',
        tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
        tileSize: 256,
        maxzoom: 19,
        attribution: 'Imagery &copy; Esri, Maxar, Earthstar Geographics',
      },
      // Building footprints and place names to lay over the imagery.
      openmaptiles: { type: 'vector', url: `${OFM}/planet` },
    },
    layers: [
      { id: 'imagery', type: 'raster', source: 'imagery' },
      {
        id: 'place-labels', type: 'symbol', source: 'openmaptiles', 'source-layer': 'place',
        filter: ['in', ['get', 'class'], ['literal', ['city', 'town', 'suburb', 'neighbourhood', 'quarter']]],
        layout: { 'text-field': ['coalesce', ['get', 'name:en'], ['get', 'name']], 'text-font': LABEL_FONT, 'text-size': 12 },
        paint: { 'text-color': '#ffffff', 'text-halo-color': 'rgba(0,0,0,0.75)', 'text-halo-width': 1.4 },
      },
    ],
  }
}

/** Keyless CARTO raster, used when the vector style can't be reached. */
export function rasterFallbackStyle(theme: MapTheme): StyleSpecification {
  const flavour = theme === 'light' ? 'voyager' : 'dark_all'
  return {
    version: 8,
    glyphs: GLYPHS,
    sources: {
      carto: {
        type: 'raster',
        tiles: ['a', 'b', 'c', 'd'].map(s => `https://${s}.basemaps.cartocdn.com/rastertiles/${flavour}/{z}/{x}/{y}@2x.png`),
        tileSize: 256,
        maxzoom: 20,
        attribution: '&copy; CARTO &copy; OpenStreetMap contributors',
      },
    },
    layers: [{ id: 'carto', type: 'raster', source: 'carto' }],
  }
}

// ── Layers ──────────────────────────────────────────────────────────────────
export const BUILDINGS = 'fm-buildings'

export const LAYER_GROUPS = {
  nightlife: ['fm-events-glow', 'fm-events-dot'],
  housing: ['fm-housing-cluster-glow', 'fm-housing-cluster', 'fm-housing-count', 'fm-housing-pill'],
  safety: ['fm-safety-halo', 'fm-safety-icon'],
} as const

/** Clickable layers, topmost first. */
export const INTERACTIVE_LAYERS = ['fm-safety-icon', 'fm-housing-pill', 'fm-housing-cluster', 'fm-events-dot'] as const

type FC = { type: 'FeatureCollection'; features: unknown[] }
export const emptyFC = (): FC => ({ type: 'FeatureCollection', features: [] })

export function setSourceData(map: MLMap, id: string, data: FC) {
  try { (map.getSource(id) as GeoJSONSource | undefined)?.setData(data as GeoJSON.FeatureCollection) } catch { /* style mid-reload */ }
}

export function setLayersVisible(map: MLMap, ids: readonly string[], visible: boolean) {
  for (const id of ids) {
    try { if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none') } catch { /* mid-reload */ }
  }
}

const firstSymbolId = (map: MLMap) => map.getStyle()?.layers?.find(l => l.type === 'symbol')?.id

const addLayer = (map: MLMap, layer: LayerSpecification, before?: string) => {
  if (!map.getLayer(layer.id)) map.addLayer(layer, before && map.getLayer(before) ? before : undefined)
}

/**
 * Everything The Resident draws, re-added after every style load (a style
 * switch drops custom sources and layers). Data comes from the caller's latest.
 */
export function installVibeLayers(map: MLMap, data: { events: FC; housing: FC; safety: FC; iso: FC }) {
  ensureIcons(map)
  const below = firstSymbolId(map)

  if (!map.getSource('fm-iso')) map.addSource('fm-iso', { type: 'geojson', data: data.iso as GeoJSON.FeatureCollection })
  addLayer(map, { id: 'fm-iso-fill', type: 'fill', source: 'fm-iso', paint: { 'fill-color': ['get', 'color'], 'fill-opacity': ['interpolate', ['linear'], ['get', 'mins'], 5, 0.09, 10, 0.045] } }, below)
  addLayer(map, { id: 'fm-iso-line', type: 'line', source: 'fm-iso', paint: { 'line-color': ['get', 'color'], 'line-width': 1.6, 'line-dasharray': [3, 2], 'line-opacity': 0.85 } }, below)

  if (!map.getSource('fm-events')) map.addSource('fm-events', { type: 'geojson', data: data.events as GeoJSON.FeatureCollection })
  addLayer(map, {
    id: 'fm-events-glow', type: 'circle', source: 'fm-events',
    paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 8, 16, 18], 'circle-color': ['get', 'color'], 'circle-opacity': 0.28, 'circle-blur': 0.9 },
  })
  addLayer(map, {
    id: 'fm-events-dot', type: 'circle', source: 'fm-events',
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 3.5, 16, 7],
      'circle-color': ['get', 'color'],
      'circle-stroke-color': '#ffffff', 'circle-stroke-width': 1.5, 'circle-stroke-opacity': 0.9,
    },
  })

  if (!map.getSource('fm-housing')) {
    map.addSource('fm-housing', {
      type: 'geojson', data: data.housing as GeoJSON.FeatureCollection,
      // Same feel as the old markercluster: 50px clusters, opening up at zoom 16.
      cluster: true, clusterRadius: 50, clusterMaxZoom: 15,
    })
  }
  addLayer(map, {
    id: 'fm-housing-cluster-glow', type: 'circle', source: 'fm-housing', filter: ['has', 'point_count'],
    paint: { 'circle-radius': ['step', ['get', 'point_count'], 26, 10, 32, 50, 40], 'circle-color': '#D4AF37', 'circle-opacity': 0.22, 'circle-blur': 0.8 },
  })
  addLayer(map, {
    id: 'fm-housing-cluster', type: 'circle', source: 'fm-housing', filter: ['has', 'point_count'],
    paint: {
      'circle-radius': ['step', ['get', 'point_count'], 15, 10, 19, 50, 24],
      'circle-color': 'rgba(5,31,32,0.92)', 'circle-stroke-color': '#D4AF37', 'circle-stroke-width': 2,
    },
  })
  addLayer(map, {
    id: 'fm-housing-count', type: 'symbol', source: 'fm-housing', filter: ['has', 'point_count'],
    layout: { 'text-field': ['get', 'point_count_abbreviated'], 'text-font': LABEL_FONT, 'text-size': 12, 'text-allow-overlap': true },
    paint: { 'text-color': '#FDE68A' },
  })
  addLayer(map, {
    id: 'fm-housing-pill', type: 'symbol', source: 'fm-housing', filter: ['!', ['has', 'point_count']],
    layout: {
      'icon-image': 'fm-pill', 'icon-text-fit': 'both', 'icon-text-fit-padding': [2, 4, 2, 4],
      'icon-allow-overlap': true, 'text-allow-overlap': true,
      'text-field': ['get', 'label'], 'text-font': LABEL_FONT, 'text-size': 11,
    },
    paint: { 'text-color': '#F0F7F4' },
  })

  if (!map.getSource('fm-safety')) map.addSource('fm-safety', { type: 'geojson', data: data.safety as GeoJSON.FeatureCollection })
  addLayer(map, {
    id: 'fm-safety-halo', type: 'circle', source: 'fm-safety',
    paint: { 'circle-radius': 20, 'circle-color': ['get', 'color'], 'circle-opacity': 0.18, 'circle-blur': 0.6 },
  })
  addLayer(map, {
    id: 'fm-safety-icon', type: 'symbol', source: 'fm-safety',
    layout: { 'icon-image': ['get', 'icon'], 'icon-allow-overlap': true, 'icon-size': 1 },
  })
}

// ── Neon city + sky ─────────────────────────────────────────────────────────
export function applyCity(map: MLMap, theme: MapTheme, show3D: boolean) {
  try {
    if (map.getSource('openmaptiles')) {
      // OpenFreeMap's own extrusions (Liberty has one) would double ours up.
      for (const l of map.getStyle().layers || []) {
        if (l.type === 'fill-extrusion' && l.id !== BUILDINGS) map.setLayoutProperty(l.id, 'visibility', 'none')
      }
      addLayer(map, {
        id: BUILDINGS, source: 'openmaptiles', 'source-layer': 'building', type: 'fill-extrusion', minzoom: 14,
        paint: {
          'fill-extrusion-color': theme === 'light'
            ? ['interpolate', ['linear'], ['coalesce', ['get', 'render_height'], 0], 0, '#e2e8f0', 40, '#cbd5e1', 120, '#a5b4fc']
            : ['interpolate', ['linear'], ['coalesce', ['get', 'render_height'], 0], 0, '#0c2a33', 25, '#0f5566', 60, '#1d4ed8', 140, '#7c3aed'],
          'fill-extrusion-height': ['interpolate', ['linear'], ['zoom'], 14, 0, 14.6, ['coalesce', ['get', 'render_height'], 0]],
          'fill-extrusion-base': ['interpolate', ['linear'], ['zoom'], 14, 0, 14.6, ['coalesce', ['get', 'render_min_height'], 0]],
          'fill-extrusion-opacity': theme === 'satellite' ? 0.55 : 0.85,
          'fill-extrusion-vertical-gradient': true,
        },
      }, map.getLayer('fm-iso-fill') ? 'fm-iso-fill' : firstSymbolId(map)) // walking rings stay readable over the city
      setLayersVisible(map, [BUILDINGS], show3D)
    }
  } catch { /* style without buildings */ }
  try {
    map.setSky(theme === 'light'
      ? { 'sky-color': '#7dd3fc', 'horizon-color': '#e0f2fe', 'fog-color': '#f1f5f9', 'sky-horizon-blend': 0.6, 'horizon-fog-blend': 0.5, 'fog-ground-blend': 0.8 }
      : { 'sky-color': '#04060c', 'horizon-color': '#0b4a5c', 'fog-color': '#04060c', 'sky-horizon-blend': 0.55, 'horizon-fog-blend': 0.45, 'fog-ground-blend': 0.75 })
  } catch { /* no sky support */ }
}

// ── Canvas-drawn icons (no sprite sheet to fetch) ───────────────────────────
function canvas2d(w: number, h: number) {
  const c = document.createElement('canvas')
  c.width = w; c.height = h
  return c.getContext('2d')
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function ensureIcons(map: MLMap) {
  if (typeof document === 'undefined') return
  const R = 2 // drawn at 2x for sharp edges
  if (!map.hasImage('fm-pill')) {
    const W = 52, H = 28
    const ctx = canvas2d(W * R, H * R)
    if (ctx) {
      ctx.scale(R, R)
      roundRect(ctx, 1.5, 1.5, W - 3, H - 3, 12.5)
      ctx.fillStyle = 'rgba(5,31,32,0.92)'
      ctx.fill()
      const sheen = ctx.createLinearGradient(0, 0, 0, H)
      sheen.addColorStop(0, 'rgba(255,255,255,0.22)')
      sheen.addColorStop(0.5, 'rgba(255,255,255,0)')
      ctx.fillStyle = sheen
      ctx.fill()
      ctx.lineWidth = 1.5
      ctx.strokeStyle = 'rgba(142,182,155,0.9)'
      ctx.stroke()
      map.addImage('fm-pill', ctx.getImageData(0, 0, W * R, H * R), {
        pixelRatio: R,
        stretchX: [[14 * R, 38 * R]],
        stretchY: [[13 * R, 15 * R]],
        content: [10 * R, 6 * R, 42 * R, 22 * R],
      })
    }
  }
  for (const [name, color, glyph] of [['fm-hazard-caution', '#f59e0b', 'bang'], ['fm-hazard-road', '#ef4444', 'bar']] as const) {
    if (map.hasImage(name)) continue
    const S = 30
    const ctx = canvas2d(S * R, S * R)
    if (!ctx) continue
    ctx.scale(R, R)
    roundRect(ctx, 2, 2, S - 4, S - 4, 9)
    ctx.fillStyle = color
    ctx.fill()
    ctx.lineWidth = 2
    ctx.strokeStyle = '#ffffff'
    ctx.stroke()
    ctx.fillStyle = '#ffffff'
    if (glyph === 'bang') {
      roundRect(ctx, S / 2 - 2, 8, 4, 10, 2); ctx.fill()
      ctx.beginPath(); ctx.arc(S / 2, 21.5, 2.2, 0, Math.PI * 2); ctx.fill()
    } else {
      roundRect(ctx, 8, S / 2 - 2.5, S - 16, 5, 2.5); ctx.fill()
    }
    map.addImage(name, ctx.getImageData(0, 0, S * R, S * R), { pixelRatio: R })
  }
}

// ── Camera ──────────────────────────────────────────────────────────────────
export function cinematicIntro(map: MLMap, loc: LatLon, show3D: boolean) {
  try {
    const target = { center: [loc.lon, loc.lat] as LngLatTuple, zoom: 14.6, pitch: show3D ? 55 : 0, bearing: show3D ? -20 : 0 }
    if (reducedMotion()) { map.jumpTo(target); return }
    map.flyTo({ ...target, duration: 2800, curve: 1.6, essential: false })
  } catch { /* mid-transition */ }
}

/**
 * Fly to a pick, tilt in, then slowly circle it until the user touches the
 * map (any drag, zoom or rotate stops the camera). Returns a stop function.
 */
export function focusOrbit(map: MLMap, loc: LatLon, { zoom = 16.2, show3D = true } = {}) {
  const center: LngLatTuple = [loc.lon, loc.lat]
  // Keep the pick above the bottom sheet that opens with it.
  const offset: [number, number] = [0, -Math.round((map.getContainer()?.clientHeight || 600) * 0.16)]
  if (reducedMotion()) {
    try { map.jumpTo({ center, zoom }); map.panBy([0, -offset[1]], { duration: 0 }) } catch { /* mid-reload */ }
    return () => {}
  }
  let alive = true
  const canvas = map.getCanvasContainer?.()
  const events = ['mousedown', 'touchstart', 'wheel', 'keydown'] as const
  const cleanup = () => { for (const t of events) canvas?.removeEventListener(t, onUser) }
  const onUser = () => { if (alive) { alive = false; cleanup() } }
  for (const t of events) canvas?.addEventListener(t, onUser, { passive: true })
  try {
    map.flyTo({ center, zoom, offset, pitch: show3D ? 60 : 0, bearing: show3D ? map.getBearing() - 30 : map.getBearing(), duration: 1900, curve: 1.4 })
    map.once('moveend', () => {
      if (!alive || !show3D) return
      map.easeTo({ bearing: map.getBearing() + 140, duration: 36000, easing: t => t })
      map.once('moveend', () => { alive = false; cleanup() })
    })
  } catch { /* mid-transition */ }
  return () => {
    if (alive) { alive = false; try { map.stop() } catch { /* gone */ } }
    cleanup()
  }
}

// ── DOM markers ─────────────────────────────────────────────────────────────
type MarkerOpts = ConstructorParameters<Engine['Marker']>[0]

/** One DOM marker that can be moved, hidden and removed. */
export function createPin(engine: Engine, map: MLMap, el: HTMLElement, opts: MarkerOpts = {}) {
  const marker = new engine.Marker({ element: el, anchor: 'center', ...opts })
  let added = false
  return {
    el,
    set(loc: LatLon | null) {
      if (!loc) { if (added) { marker.remove(); added = false } return }
      marker.setLngLat([loc.lon, loc.lat])
      if (!added) { marker.addTo(map); added = true }
    },
    destroy() { if (added) marker.remove(); added = false },
  }
}

export function el(className: string, html = '') {
  const node = document.createElement('div')
  node.className = className
  if (html) node.innerHTML = html // static markup only — never data
  return node
}

const rgba = (hex: string, a: number) => {
  const n = parseInt(hex.replace('#', '').slice(0, 6), 16)
  return Number.isFinite(n) ? `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})` : `rgba(0,242,255,${a})`
}

/** Sonar sweep + pings centred on a point, sized to `radiusM` on the ground. */
export function createRadar(engine: Engine, map: MLMap, { color = '#38bdf8', radiusM = 1200 } = {}) {
  const node = el('fm-radar', '<div class="fm-radar-sweep"></div><div class="fm-radar-ping"></div><div class="fm-radar-ping"></div><div class="fm-radar-ping"></div><div class="fm-radar-rim"></div>')
  node.setAttribute('aria-hidden', 'true')
  node.style.setProperty('--fm-radar-strong', rgba(color, 0.42))
  node.style.setProperty('--fm-radar-soft', rgba(color, 0.08))
  node.style.setProperty('--fm-radar-line', rgba(color, 0.75))
  const pin = createPin(engine, map, node, { pitchAlignment: 'map', rotationAlignment: 'map' })
  let loc: LatLon | null = null
  const resize = () => {
    if (!loc) return
    const d = Math.min(4000, Math.max(24, Math.round((2 * radiusM) / metresPerPixel(loc.lat, map.getZoom()))))
    node.style.width = `${d}px`
    node.style.height = `${d}px`
  }
  map.on('zoom', resize)
  return {
    setLocation(next: LatLon | null) { loc = next; pin.set(next); resize() },
    destroy() { map.off('zoom', resize); pin.destroy() },
  }
}

export interface BeamItem {
  id: string
  lat: number
  lon: number
  pulse: EventPulse
  color: string
  height: number
  title: string
  subtitle: string
}

/** Light pillars over events. Upright in a tilted map, keyboard-reachable. */
export function createBeams(engine: Engine, map: MLMap, { onPress }: { onPress: (id: string) => void }) {
  const beams = new Map<string, { marker: Marker; node: HTMLElement; title: HTMLElement; sub: HTMLElement }>()
  let visible = true
  let focusId: string | null = null
  const update = (items: BeamItem[]) => {
    const keep = new Set(items.map(i => i.id))
    for (const [id, b] of beams) if (!keep.has(id)) { b.marker.remove(); beams.delete(id) }
    items.forEach((it, i) => {
      let b = beams.get(it.id)
      if (!b) {
        const node = el('fm-beam', '<div class="fm-beam-body"><div class="fm-beam-base"><i></i><i></i></div><div class="fm-beam-pillar"><i class="fm-beam-packet"></i></div><div class="fm-beam-orb"></div></div><div class="fm-beam-tag"><span></span><small></small></div>')
        node.setAttribute('role', 'button')
        node.tabIndex = 0
        const press = (e: Event) => { e.stopPropagation(); onPress(it.id) }
        node.addEventListener('click', press)
        node.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); press(e) } })
        const marker = new engine.Marker({ element: node, anchor: 'bottom', pitchAlignment: 'viewport', rotationAlignment: 'viewport' })
          .setLngLat([it.lon, it.lat]).addTo(map)
        b = { marker, node, title: node.querySelector('.fm-beam-tag span')!, sub: node.querySelector('.fm-beam-tag small')! }
        beams.set(it.id, b)
      } else {
        b.marker.setLngLat([it.lon, it.lat])
      }
      b.title.textContent = it.title
      b.sub.textContent = it.subtitle
      b.node.setAttribute('aria-label', `${it.title}, ${it.subtitle}`)
      b.node.setAttribute('data-pulse', it.pulse)
      b.node.setAttribute('data-focus', it.id === focusId ? 'true' : 'false')
      b.node.setAttribute('data-hidden', visible ? 'false' : 'true')
      b.node.style.setProperty('--fm-beam', it.color)
      b.node.style.setProperty('--fm-beam-h', `${it.height}px`)
      b.node.style.setProperty('--fm-beam-d', `${(i % 5) * -0.37}s`) // de-sync the light packets
      b.node.style.setProperty('--fm-beam-in', `${Math.min(i, 11) * 70}ms`)
    })
  }
  return {
    update,
    setVisible(v: boolean) {
      visible = v
      for (const b of beams.values()) {
        b.node.setAttribute('data-hidden', v ? 'false' : 'true')
        b.node.tabIndex = v ? 0 : -1
      }
    },
    setFocus(id: string | null) {
      focusId = id
      for (const [bid, b] of beams) b.node.setAttribute('data-focus', bid === id ? 'true' : 'false')
    },
    destroy() { for (const b of beams.values()) b.marker.remove(); beams.clear() },
  }
}

export interface StreamRoute {
  pts: LngLatTuple[]
  color: string
  focus: boolean
  km: number
}

/** Glowing arcs with sparks flowing along them, like a live route. */
export function createStreams(engine: Engine, map: MLMap) {
  let routes: (StreamRoute & { sparks: Marker[]; ms: number })[] = []
  let raf = 0, last = 0, onScreen = true, shown = true
  const reduced = reducedMotion()

  const install = () => {
    try {
      if (!map.getSource('fm-streams')) {
        map.addSource('fm-streams', { type: 'geojson', lineMetrics: true, data: emptyFC() as GeoJSON.FeatureCollection })
      }
      addLayer(map, {
        id: 'fm-streams-glow', type: 'line', source: 'fm-streams',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': ['get', 'color'], 'line-width': ['case', ['get', 'focus'], 10, 6], 'line-opacity': 0.14, 'line-blur': 4 },
      }, 'fm-events-glow')
      addLayer(map, {
        id: 'fm-streams', type: 'line', source: 'fm-streams',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-width': ['case', ['get', 'focus'], 3, 1.6],
          // Fades in from you toward where you're going.
          'line-gradient': ['interpolate', ['linear'], ['line-progress'], 0, 'rgba(56,189,248,0)', 0.35, '#c084fc', 1, '#ffffff'],
          'line-opacity': ['case', ['get', 'focus'], 0.95, 0.55],
        },
      }, 'fm-events-glow')
      push()
      setLayersVisible(map, ['fm-streams', 'fm-streams-glow'], shown)
    } catch { /* style mid-reload */ }
  }

  const push = () => setSourceData(map, 'fm-streams', {
    type: 'FeatureCollection',
    features: shown ? routes.map(r => ({ type: 'Feature', properties: { color: r.color, focus: r.focus }, geometry: { type: 'LineString', coordinates: r.pts } })) : [],
  })

  const clearSparks = () => routes.forEach(r => r.sparks.forEach(s => s.remove()))
  const tick = (now: number) => {
    raf = 0
    if (!onScreen || document.hidden || !routes.length || !shown) return
    if (now - last > 33) { // 30 fps is plenty for a spark
      last = now
      for (const r of routes) {
        r.sparks.forEach((s, k) => {
          const t = ((now / r.ms) + k / r.sparks.length) % 1
          const f = t * (r.pts.length - 1), i = Math.floor(f), w = f - i
          const p = r.pts[i], q = r.pts[Math.min(i + 1, r.pts.length - 1)]
          s.setLngLat([p[0] + (q[0] - p[0]) * w, p[1] + (q[1] - p[1]) * w])
        })
      }
    }
    raf = requestAnimationFrame(tick)
  }
  const start = () => { if (!reduced && !raf && onScreen && shown && !document.hidden && routes.length) raf = requestAnimationFrame(tick) }

  let io: IntersectionObserver | null = null
  const container = map.getContainer()
  if (container && typeof IntersectionObserver !== 'undefined') {
    io = new IntersectionObserver(es => { onScreen = es.some(e => e.isIntersecting); if (onScreen) start() })
    io.observe(container)
  }
  const onVis = () => { if (!document.hidden) start() }
  document.addEventListener('visibilitychange', onVis)

  const update = (next: StreamRoute[]) => {
    clearSparks()
    routes = next.map(r => {
      const n = reduced || !shown ? 0 : r.focus ? 4 : 2
      const sparks = Array.from({ length: n }, () => {
        const s = el('fm-spark')
        s.style.setProperty('--fm-spark', r.color)
        return new engine.Marker({ element: s, anchor: 'center' }).setLngLat(r.pts[0]).addTo(map)
      })
      // ~2.4 s for a 1 km trip, capped so long routes don't crawl.
      return { ...r, sparks, ms: Math.min(6000, 1600 + r.km * 800) }
    })
    push()
    start()
  }

  return {
    install,
    update,
    setVisible(v: boolean) {
      if (shown === v) return
      shown = v
      setLayersVisible(map, ['fm-streams', 'fm-streams-glow'], v)
      update(routes.map(({ pts, color, focus, km }) => ({ pts, color, focus, km })))
    },
    destroy() {
      if (raf) cancelAnimationFrame(raf)
      raf = 0
      clearSparks()
      routes = []
      io?.disconnect()
      document.removeEventListener('visibilitychange', onVis)
    },
  }
}

/** Warning sonar under the nearest few safety alerts. */
export function createHazards(engine: Engine, map: MLMap, max = 8) {
  const pins: ReturnType<typeof createPin>[] = []
  let shown = true
  let last: { lat: number; lon: number; color: string }[] = []
  const draw = () => {
    pins.splice(0).forEach(p => p.destroy())
    if (!shown || reducedMotion()) return
    for (const z of last.slice(0, max)) {
      const node = el('fm-hazard', '<i></i><i></i>')
      node.setAttribute('aria-hidden', 'true')
      node.style.setProperty('--fm-hazard', z.color)
      const pin = createPin(engine, map, node, { pitchAlignment: 'map', rotationAlignment: 'map' })
      pin.set(z)
      pins.push(pin)
    }
  }
  return {
    update(zones: { lat: number; lon: number; color: string }[]) { last = zones; draw() },
    setVisible(v: boolean) { if (shown !== v) { shown = v; draw() } },
    destroy() { pins.splice(0).forEach(p => p.destroy()) },
  }
}
