'use client'

// Data for one live job on the Vibe Map: the job itself, the driver's
// position (live, from Supabase Realtime), the driver's own GPS broadcast,
// and the road route from our routing engine (/api/route).

import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../../../../utils/supabase'
import { isLive, isOffRoute, parseStage, shouldSend, type JobStage, type LatLon } from '../../../../utils/liveJob'
import type { RouteAnswer } from '../../../api/route/route'

export interface LiveJob {
  id: string
  serviceId: string
  senderId: string
  driverId: string | null
  businessName: string
  message: string
  stage: JobStage
  stageAt: string
  pickup: LatLon | null
  dropoff: LatLon | null
}

export interface DriverFix extends LatLon {
  accuracyM: number | null
  heading: number | null
  speedMps: number | null
  at: string
}

const pt = (lat: unknown, lon: unknown): LatLon | null =>
  typeof lat === 'number' && typeof lon === 'number' ? { lat, lon } : null

type Row = Record<string, unknown> & { res_handyman_services?: { owner_id?: string; business_name?: string } | null }

function toJob(r: Row): LiveJob {
  return {
    id: String(r.id),
    serviceId: String(r.service_id),
    senderId: String(r.sender_id),
    driverId: r.res_handyman_services?.owner_id ?? null,
    businessName: r.res_handyman_services?.business_name ?? 'Driver',
    message: String(r.message ?? ''),
    stage: parseStage(r.job_stage),
    stageAt: String(r.stage_at ?? ''),
    pickup: pt(r.pickup_lat, r.pickup_lon),
    dropoff: pt(r.dropoff_lat, r.dropoff_lon)
  }
}

function toFix(r: Record<string, unknown>): DriverFix {
  return {
    lat: Number(r.lat),
    lon: Number(r.lon),
    accuracyM: r.accuracy_m == null ? null : Number(r.accuracy_m),
    heading: r.heading == null ? null : Number(r.heading),
    speedMps: r.speed_mps == null ? null : Number(r.speed_mps),
    at: String(r.at)
  }
}

/** The job and the driver's latest position, kept live. */
export function useLiveJob(jobId: string) {
  const [job, setJob] = useState<LiveJob | null>(null)
  const [driver, setDriver] = useState<DriverFix | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!supabase) { setError('Not connected.'); setLoading(false); return }
    const { data, error: e } = await supabase
      .from('res_service_dispatches')
      .select('*, res_handyman_services(owner_id, business_name)')
      .eq('id', jobId)
      .maybeSingle()
    if (e) setError('Could not load this job.')
    else if (!data) setError('This job was not found, or it is not yours.')
    else { setJob(toJob(data as Row)); setError(null) }
    const { data: pos } = await supabase.from('res_dispatch_positions').select('*').eq('dispatch_id', jobId).maybeSingle()
    setDriver(pos ? toFix(pos) : null)
    setLoading(false)
  }, [jobId])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loads the job once, then Realtime keeps it current
    load()
    if (!supabase) return
    const client = supabase
    const channel = client
      .channel(`job-${jobId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'res_dispatch_positions', filter: `dispatch_id=eq.${jobId}` }, (p) => {
        if (p.eventType === 'DELETE') setDriver(null)
        else setDriver(toFix(p.new as Record<string, unknown>))
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'res_service_dispatches', filter: `id=eq.${jobId}` }, (p) => {
        const r = p.new as Record<string, unknown>
        setJob((j) => (j ? { ...j, stage: parseStage(r.job_stage), stageAt: String(r.stage_at ?? j.stageAt) } : j))
      })
      .subscribe()
    return () => { client.removeChannel(channel) }
  }, [jobId, load])

  const setStage = useCallback(async (stage: JobStage) => {
    if (!supabase) return 'Not connected.'
    const { error: e } = await supabase.rpc('res_set_job_stage', { p_dispatch: jobId, p_stage: stage })
    if (e) return e.message || 'Could not update the job.'
    setJob((j) => (j ? { ...j, stage, stageAt: new Date().toISOString() } : j))
    if (stage === 'delivered' || stage === 'cancelled') setDriver(null)
    return null
  }, [jobId])

  return { job, driver, error, loading, setStage, reload: load }
}

/**
 * On the driver's phone while the job is under way: precise GPS, sent to the
 * job's position row when the driver has moved or every 10 s. Keeps the
 * screen awake so the browser keeps reading GPS. Stops when the job ends.
 */
export function useDriverBroadcast(jobId: string, driverId: string | null, stage: JobStage | undefined, enabled: boolean) {
  const [own, setOwn] = useState<DriverFix | null>(null)
  const [gpsError, setGpsError] = useState<string | null>(null)
  const last = useRef<{ at: number; lat: number; lon: number } | null>(null)
  const live = enabled && !!driverId && !!stage && isLive(stage)

  useEffect(() => {
    if (!live || typeof navigator === 'undefined' || !navigator.geolocation) return
    let lock: { release: () => Promise<void> } | null = null
    const wl = (navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } }).wakeLock
    wl?.request('screen').then((l) => { lock = l }).catch(() => {})

    const id = navigator.geolocation.watchPosition(
      (pos) => {
        setGpsError(null)
        const fix: DriverFix = {
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          accuracyM: Number.isFinite(pos.coords.accuracy) ? pos.coords.accuracy : null,
          heading: pos.coords.heading ?? null,
          speedMps: pos.coords.speed ?? null,
          at: new Date(pos.timestamp || Date.now()).toISOString()
        }
        setOwn(fix)
        const now = { at: pos.timestamp || Date.now(), lat: fix.lat, lon: fix.lon }
        if (!supabase || !shouldSend(last.current, now)) return
        last.current = now
        supabase.from('res_dispatch_positions').upsert({
          dispatch_id: jobId,
          driver_id: driverId,
          lat: fix.lat,
          lon: fix.lon,
          accuracy_m: fix.accuracyM,
          heading: fix.heading,
          speed_mps: fix.speedMps,
          at: fix.at
        }).then(({ error }) => { if (error) last.current = null })
      },
      (err) => setGpsError(err.code === err.PERMISSION_DENIED
        ? 'Location is blocked. Allow location for this site so the customer can see you coming.'
        : 'Waiting for a GPS signal…'),
      // Precise and fresh: this is navigation, not a background check-in.
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 }
    )
    return () => {
      navigator.geolocation.clearWatch(id)
      lock?.release().catch(() => {})
      last.current = null
    }
  }, [live, jobId, driverId])

  return { own: live ? own : null, gpsError: live ? gpsError : null }
}

/**
 * The road route from `from` to `to`. Asks again when the target changes,
 * when the vehicle leaves the route, or after it has covered 300 m since the
 * last answer (so the arrival time stays honest).
 */
export function useRoute(from: LatLon | null, to: LatLon | null, accuracyM = 0) {
  const [route, setRoute] = useState<RouteAnswer | null>(null)
  const asked = useRef<{ from: LatLon; to: LatLon } | null>(null)
  const busy = useRef(false)

  useEffect(() => {
    if (!from || !to) { asked.current = null; return }
    const prev = asked.current
    const targetChanged = !prev || prev.to.lat !== to.lat || prev.to.lon !== to.lon
    const moved = prev ? Math.hypot(from.lat - prev.from.lat, from.lon - prev.from.lon) * 111_000 : Infinity
    const off = route?.source === 'road' && isOffRoute(from, route.line, accuracyM)
    if (!targetChanged && moved < 300 && !off) return
    if (busy.current) return
    busy.current = true
    asked.current = { from, to }
    const q = new URLSearchParams({ fromLat: String(from.lat), fromLon: String(from.lon), toLat: String(to.lat), toLon: String(to.lon) })
    fetch(`/api/route?${q}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((a: RouteAnswer | null) => { if (a) setRoute(a) })
      .catch(() => {})
      .finally(() => { busy.current = false })
  }, [from?.lat, from?.lon, to?.lat, to?.lon, accuracyM]) // eslint-disable-line react-hooks/exhaustive-deps -- compared by value above

  return from && to ? route : null
}
