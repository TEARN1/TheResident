'use client'

// One live job (bakkie, truck or tow truck) on the Vibe Map.
// The driver sees the route and the next turn and moves the job on; the
// customer sees the vehicle coming and when it will arrive.

import React, { useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useSelector } from 'react-redux'
import { ArrowLeft, Navigation, MapPin, AlertTriangle, CheckCircle2, X } from 'lucide-react'
import type { RootState } from '../../../../../store'
import { useLiveJob, useDriverBroadcast, useRoute } from '../useLiveJob'
import {
  STAGE_LABEL, NEXT_ACTION, nextStage, canCancel, currentTarget, isLive, formatDistance, formatEta
} from '../../../../../utils/liveJob'
import { nextInstruction } from '../../../../../utils/routeSteps'

const LiveJobMap = dynamic(() => import('../LiveJobMap'), { ssr: false, loading: () => <div className="w-full h-full min-h-[320px] rounded-2xl bg-white/5 animate-pulse" /> })

function vehicleIconFor(message: string): string {
  if (/TOW/i.test(message)) return '🏗️'
  if (/TRUCK/i.test(message)) return '🚚'
  return '🛻'
}

export default function LiveJobPage() {
  const { id } = useParams<{ id: string }>()
  const me = useSelector((s: RootState) => s.auth.currentUser)
  const theme = useSelector((s: RootState) => (s as unknown as { ui?: { theme?: string } }).ui?.theme) === 'light' ? 'light' : 'dark'
  const { job, driver, error, loading, setStage } = useLiveJob(id)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  // A clock for "position is stale", ticking every 15 s.
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15_000)
    return () => clearInterval(t)
  }, [])

  const isDriver = !!job && !!me?.id && job.driverId === me.id
  const isCustomer = !!job && !!me?.id && job.senderId === me.id
  const { own, gpsError } = useDriverBroadcast(id, isDriver ? me!.id : null, job?.stage, isDriver)

  // The driver's own fix is fresher on their phone; the customer sees the shared one.
  const vehicle = isDriver ? own ?? driver : driver
  const target = job ? currentTarget(job.stage, job.pickup, job.dropoff) : null
  // Before the driver sets off, show the whole trip: pick-up to drop-off.
  const from = vehicle ?? (job && !isLive(job.stage) ? job.pickup : null)
  const to = vehicle ? target : job?.dropoff ?? null
  const route = useRoute(from, to, vehicle?.accuracyM ?? 0)
  const turn = useMemo(() => (isDriver && vehicle && route?.source === 'road' ? nextInstruction(vehicle, route.steps) : null), [isDriver, vehicle, route])

  const stale = driver && now - new Date(driver.at).getTime() > 60_000

  const move = async (stage: Parameters<typeof setStage>[0]) => {
    setBusy(true)
    setNotice(null)
    const err = await setStage(stage)
    setBusy(false)
    if (err) setNotice(err)
  }

  if (loading) return <div className="p-6 text-sm text-gray-400">Loading the job…</div>
  if (error || !job) {
    return (
      <div className="p-6 space-y-3">
        <p className="text-sm text-gray-300">{error || 'This job was not found.'}</p>
        <Link href="/dashboard/services" className="text-gold-primary text-sm font-bold">Back to services</Link>
      </div>
    )
  }
  if (!isDriver && !isCustomer) return <div className="p-6 text-sm text-gray-300">Only the customer and the driver can see this job.</div>

  const next = nextStage(job.stage)
  const live = isLive(job.stage)
  const etaLine = route && vehicle && target
    ? `${formatEta(route.durationS)} · ${formatDistance(route.distanceM)}${route.source === 'straight' ? ' (estimate)' : ''}`
    : null

  return (
    <div className="flex flex-col gap-3 p-3 sm:p-5 h-[calc(100dvh-5rem)] min-h-[560px]">
      <header className="flex items-center gap-3">
        <Link href="/dashboard/services" aria-label="Back to services" className="p-2 rounded-xl bg-white/5 touch-target-44"><ArrowLeft size={18} /></Link>
        <div className="min-w-0 flex-1">
          <h1 className="m-0 text-base font-black text-white truncate">{isDriver ? 'Your job' : job.businessName}</h1>
          <p className="m-0 text-xs text-gray-300" aria-live="polite">{STAGE_LABEL[job.stage]}</p>
        </div>
        {etaLine && (
          <div className="text-right shrink-0" aria-live="polite">
            <p className="m-0 text-[10px] uppercase tracking-wider text-gray-400">{job.stage === 'loaded' ? 'To drop-off' : isDriver ? 'To pick-up' : 'Arrives in'}</p>
            <p className="m-0 text-sm font-black text-gold-primary">{etaLine}</p>
          </div>
        )}
      </header>

      {isDriver && turn && live && (
        <div className="flex items-center gap-3 p-3 rounded-2xl bg-gold-primary text-black" role="status" aria-live="assertive">
          <Navigation size={22} aria-hidden="true" />
          <div className="min-w-0">
            <p className="m-0 text-lg font-black leading-tight">{turn.text}</p>
            <p className="m-0 text-xs font-bold">in {formatDistance(turn.inM)}</p>
          </div>
        </div>
      )}

      {(gpsError || (route?.source === 'straight' && live) || (!isDriver && stale && live) || !job.pickup || notice) && (
        <div className="space-y-2">
          {gpsError && <p className="m-0 flex gap-2 text-xs text-amber-200 bg-amber-500/10 border border-amber-500/30 rounded-xl p-2.5"><AlertTriangle size={14} className="shrink-0 mt-0.5" />{gpsError}</p>}
          {route?.source === 'straight' && live && <p className="m-0 text-xs text-gray-300 bg-white/5 rounded-xl p-2.5">Road directions are not switched on yet, so the map shows a straight line and an estimated time.</p>}
          {!isDriver && stale && live && <p className="m-0 text-xs text-gray-300 bg-white/5 rounded-xl p-2.5">The driver&apos;s position has not updated for a minute. Their signal may be weak.</p>}
          {!job.pickup && <p className="m-0 text-xs text-gray-300 bg-white/5 rounded-xl p-2.5">This request has no pick-up pin, so only the driver&apos;s position can be shown.</p>}
          {notice && <p className="m-0 text-xs text-red-200 bg-red-500/10 border border-red-500/30 rounded-xl p-2.5" role="alert">{notice}</p>}
        </div>
      )}

      <div className="flex-1 min-h-[320px]">
        <LiveJobMap
          pickup={job.pickup}
          dropoff={job.dropoff}
          vehicle={live ? vehicle : null}
          vehicleIcon={vehicleIconFor(job.message)}
          line={route?.line ?? null}
          roadRoute={route?.source === 'road'}
          follow={isDriver && live}
          theme={theme}
        />
      </div>

      <p className="m-0 text-xs text-gray-400 line-clamp-2"><MapPin size={12} className="inline mr-1" />{job.message}</p>

      <div className="flex gap-2 flex-wrap">
        {isDriver && next && NEXT_ACTION[job.stage] && (
          <button type="button" disabled={busy} onClick={() => move(next)} className="flex-1 min-h-[48px] rounded-2xl bg-gold-primary text-black font-black text-sm uppercase tracking-wider disabled:opacity-50">
            {NEXT_ACTION[job.stage]}
          </button>
        )}
        {canCancel(job.stage) && (
          <button type="button" disabled={busy} onClick={() => { if (window.confirm('Cancel this job?')) move('cancelled') }} className="min-h-[48px] px-4 rounded-2xl bg-white/5 border border-white/10 text-gray-200 font-bold text-sm flex items-center gap-1.5">
            <X size={16} /> Cancel job
          </button>
        )}
        {(job.stage === 'delivered' || job.stage === 'cancelled') && (
          <p className="m-0 flex items-center gap-2 text-sm text-gray-200"><CheckCircle2 size={16} className="text-gold-primary" />{job.stage === 'delivered' ? 'This job is done. Location sharing has stopped.' : 'This job was cancelled.'}</p>
        )}
      </div>
      {isDriver && live && <p className="m-0 text-[11px] text-gray-400">Your location is shared with this customer only, until the job is delivered. Keep this screen open while you drive.</p>}
    </div>
  )
}
