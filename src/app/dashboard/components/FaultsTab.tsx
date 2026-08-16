'use client'

import React, { useState, useCallback, useMemo } from 'react'
import {
  Zap, Droplets, Trash2, Wifi, Construction, Waves,
  AlertTriangle, MapPin, Check, X, Send, Users, ShieldCheck, Clock
} from 'lucide-react'
import type { Fault } from '../../../store'
import { reportFault, vouchFault } from '../../../utils/faultsApi'
import type { FaultKind, VouchKind } from '../../../utils/faults'
import { IMMEDIATE_DANGER, SECTOR_OF } from '../../../utils/faults'
import { distanceMetres } from '../../../utils/geo'
import { proximityLabel, formatDistance } from '../../../utils/measure'

// The whole point of this screen is the count. One person reporting an outage
// is a complaint; the number of neighbours confirming it is what turns it into
// something a utility can be held to — so the count is the largest thing on
// the card, and the "what's still needed" line is never hidden.

const VOUCH_RADIUS_M = 400

const KIND_LABELS: Record<FaultKind, string> = {
  power_outage: 'No electricity',
  power_line_down: 'Power line down',
  substation_damage: 'Substation / box damaged',
  meter_box_damage: 'Meter box damaged',
  streetlight_out: 'Streetlight out',
  water_outage: 'No water',
  water_leak: 'Water leak',
  burst_pipe: 'Burst pipe',
  sewage_spill: 'Sewage spill',
  refuse_uncollected: 'Refuse not collected',
  network_outage: 'No network / internet',
  road_damage: 'Road damage',
}

const SECTOR_ICON: Record<string, React.ReactNode> = {
  electricity: <Zap size={16} />,
  water: <Droplets size={16} />,
  sanitation: <Waves size={16} />,
  refuse: <Trash2 size={16} />,
  telecoms: <Wifi size={16} />,
  roads: <Construction size={16} />,
}

const STATUS_COPY: Record<string, { label: string; tone: string }> = {
  reported:     { label: 'Waiting for neighbours to confirm', tone: '#a16207' },
  corroborated: { label: 'Neighbours are confirming', tone: '#a16207' },
  escalated:    { label: 'Sent to the provider', tone: '#1d4ed8' },
  acknowledged: { label: 'Provider has acknowledged it', tone: '#1d4ed8' },
  in_progress:  { label: 'A crew is on it', tone: '#1d4ed8' },
  resolved:     { label: 'Marked fixed — confirm if it really is', tone: '#15803d' },
  verified:     { label: 'Confirmed fixed by residents', tone: '#15803d' },
}

/** Escalation threshold, mirrored from res_policies for the progress hint. */
const MIN_REPORTERS = 5

interface FaultsTabProps {
  faults: Fault[]
  currentUserId: string
  suburb: string
  myVouches: Record<string, VouchKind>
  onChanged: () => void
}

export default function FaultsTab({ faults, suburb, myVouches, onChanged }: FaultsTabProps) {
  const [position, setPosition] = useState<{ lat: number; lon: number } | null>(null)
  const [locating, setLocating] = useState(false)
  const [reporting, setReporting] = useState(false)
  const [kind, setKind] = useState<FaultKind>('power_outage')
  const [detail, setDetail] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  // Location is requested only when the user actually acts, never on mount —
  // a map of who opened the app is not something this feature needs.
  const getPosition = useCallback(async (): Promise<{ lat: number; lon: number } | null> => {
    if (position) return position
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setMessage('This device cannot share a location, so reporting is unavailable.')
      return null
    }
    setLocating(true)
    try {
      const coords = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000
        }))
      const p = { lat: coords.coords.latitude, lon: coords.coords.longitude }
      setPosition(p)
      return p
    } catch {
      setMessage('Could not get your location. Reporting needs it, so that a fault comes from someone who can actually see it.')
      return null
    } finally {
      setLocating(false)
    }
  }, [position])

  const submitReport = useCallback(async () => {
    const p = await getPosition()
    if (!p) return
    setBusy('report')
    const res = await reportFault({
      kind, lat: p.lat, lon: p.lon, detail: detail.trim() || undefined, suburb
    })
    setBusy(null)
    if (res.error) { setMessage(res.error); return }

    // Telling someone they are the 7th reporter is the difference between
    // "my report vanished" and "this is working".
    setMessage(res.joinedExisting
      ? 'Added to an existing report from your area — your confirmation counts towards it.'
      : 'Reported. Neighbours nearby can now confirm it.')
    setDetail('')
    setReporting(false)
    onChanged()
  }, [kind, detail, suburb, getPosition, onChanged])

  const submitVouch = useCallback(async (fault: Fault, vouch: VouchKind) => {
    const p = await getPosition()
    if (!p) return

    // Check the distance client-side first. The server enforces it regardless,
    // but being told the rule before you act beats being rejected after.
    const away = distanceMetres(p, { lat: fault.lat, lon: fault.lon })
    const prox = proximityLabel(away, VOUCH_RADIUS_M)
    if (!prox.withinLimit) { setMessage(prox.label); return }

    setBusy(fault.id)
    const res = await vouchFault(fault.id, vouch, p.lat, p.lon)
    setBusy(null)
    if (res.error) { setMessage(res.error); return }
    setMessage(null)
    onChanged()
  }, [getPosition, onChanged])

  const sorted = useMemo(
    () => [...faults].sort((a, b) => b.priority - a.priority),
    [faults])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>What is broken around here</h2>
        <p style={{ margin: '6px 0 0', color: '#57534e', fontSize: 14, lineHeight: 1.5 }}>
          Report it, and confirm what your neighbours report. Enough confirmations
          and it goes to the provider as evidence, not as one complaint.
        </p>
      </div>

      {message && (
        <div role="status" style={{
          padding: '10px 12px', borderRadius: 8, background: '#f5f5f4',
          border: '1px solid #e7e5e4', fontSize: 14, color: '#44403c'
        }}>
          {message}
        </div>
      )}

      {!reporting ? (
        <button
          onClick={() => setReporting(true)}
          style={primaryButton}
        >
          <AlertTriangle size={16} /> Report a fault
        </button>
      ) : (
        <div style={panel}>
          <label style={label}>What is wrong</label>
          <select
            value={kind}
            onChange={e => setKind(e.target.value as FaultKind)}
            style={input}
          >
            {(Object.keys(KIND_LABELS) as FaultKind[]).map(k => (
              <option key={k} value={k}>
                {KIND_LABELS[k]}{IMMEDIATE_DANGER.has(k) ? ' — dangerous' : ''}
              </option>
            ))}
          </select>

          {IMMEDIATE_DANGER.has(kind) && (
            <p style={{ margin: '8px 0 0', fontSize: 13, color: '#b91c1c', lineHeight: 1.5 }}>
              This is treated as an immediate danger and is sent to the provider
              straight away, without waiting for other neighbours to confirm.
              If anyone is in danger right now, call emergency services first.
            </p>
          )}

          <label style={label}>Anything useful to add</label>
          <textarea
            value={detail}
            onChange={e => setDetail(e.target.value)}
            rows={3}
            placeholder="Which street, since when, anything a crew should know"
            style={{ ...input, resize: 'vertical' }}
          />

          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button onClick={submitReport} disabled={busy === 'report' || locating} style={primaryButton}>
              <Send size={16} /> {locating ? 'Finding you…' : busy === 'report' ? 'Sending…' : 'Report it'}
            </button>
            <button onClick={() => { setReporting(false); setMessage(null) }} style={secondaryButton}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {sorted.length === 0 ? (
        <p style={{ color: '#78716c', fontSize: 14 }}>Nothing reported broken right now.</p>
      ) : (
        sorted.map(fault => {
          const mine = myVouches[fault.id]
          const status = STATUS_COPY[fault.status] ?? { label: fault.status, tone: '#57534e' }
          const needed = Math.max(0, MIN_REPORTERS - fault.distinctReporters)
          const danger = IMMEDIATE_DANGER.has(fault.kind as FaultKind)
          const away = position ? distanceMetres(position, { lat: fault.lat, lon: fault.lon }) : null
          const tooFar = away !== null && away > VOUCH_RADIUS_M

          return (
            <div key={fault.id} style={{
              ...panel,
              borderLeft: `4px solid ${danger ? '#dc2626' : status.tone}`
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                {SECTOR_ICON[fault.sector] ?? <AlertTriangle size={16} />}
                <strong style={{ fontSize: 15 }}>
                  {KIND_LABELS[fault.kind as FaultKind] ?? fault.kind}
                </strong>
                {danger && (
                  <span style={{ ...pill, background: '#fef2f2', color: '#b91c1c' }}>
                    Dangerous
                  </span>
                )}
                {fault.suburb && (
                  <span style={{ ...pill, color: '#57534e' }}>
                    <MapPin size={12} /> {fault.suburb}
                  </span>
                )}
                {away !== null && (
                  <span style={{ ...pill, color: '#57534e' }}>{formatDistance(away)} away</span>
                )}
              </div>

              {/* The count is the point of the whole screen. */}
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 10 }}>
                <Users size={18} color="#44403c" />
                <span style={{ fontSize: 24, fontWeight: 700, lineHeight: 1 }}>
                  {fault.distinctReporters}
                </span>
                <span style={{ fontSize: 14, color: '#57534e' }}>
                  {fault.distinctReporters === 1 ? 'neighbour confirms this' : 'neighbours confirm this'}
                  {fault.affectedCount > 0 && ` · ${fault.affectedCount} affected`}
                  {fault.disputeCount > 0 && ` · ${fault.disputeCount} dispute it`}
                </span>
              </div>

              <div style={{ marginTop: 8, fontSize: 13, color: status.tone, display: 'flex', alignItems: 'center', gap: 6 }}>
                {fault.status === 'escalated' || fault.status === 'acknowledged' || fault.status === 'in_progress'
                  ? <ShieldCheck size={14} /> : <Clock size={14} />}
                {status.label}
                {needed > 0 && fault.status !== 'escalated' && !danger &&
                  ` — ${needed} more needed`}
              </div>

              {fault.providerReference && (
                <div style={{ marginTop: 4, fontSize: 12, color: '#57534e' }}>
                  Provider reference: <code>{fault.providerReference}</code>
                </div>
              )}

              {/* An evidenced record of a closure that was not real. */}
              {fault.falseClosureCount > 0 && (
                <div style={{ marginTop: 6, fontSize: 12, color: '#b91c1c' }}>
                  Marked fixed {fault.falseClosureCount === 1 ? 'once' : `${fault.falseClosureCount} times`} while
                  residents reported it still broken.
                </div>
              )}

              {fault.detail && (
                <p style={{ margin: '8px 0 0', fontSize: 14, color: '#44403c' }}>{fault.detail}</p>
              )}

              {tooFar ? (
                <p style={{ margin: '10px 0 0', fontSize: 13, color: '#78716c' }}>
                  You are {formatDistance(away!)} away — too far to confirm this one.
                </p>
              ) : (
                <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                  <VouchButton
                    active={mine === 'affected'} disabled={busy === fault.id}
                    onClick={() => submitVouch(fault, 'affected')}
                    icon={<Check size={14} />} label="Happening to me too" />
                  <VouchButton
                    active={mine === 'witnessed'} disabled={busy === fault.id}
                    onClick={() => submitVouch(fault, 'witnessed')}
                    icon={<Check size={14} />} label="I can see it" />
                  <VouchButton
                    active={mine === 'resolved'} disabled={busy === fault.id}
                    onClick={() => submitVouch(fault, 'resolved')}
                    icon={<ShieldCheck size={14} />} label="It is fixed now" />
                  <VouchButton
                    active={mine === 'disputed'} disabled={busy === fault.id}
                    onClick={() => submitVouch(fault, 'disputed')}
                    icon={<X size={14} />} label="Not happening" />
                </div>
              )}
            </div>
          )
        })
      )}

      <p style={{ fontSize: 12, color: '#78716c', lineHeight: 1.6, marginTop: 4 }}>
        Confirmations only count from people near the fault, and each person
        counts once. Providers listed here have not necessarily joined the app —
        a fault is filed under the right service either way, so the record
        exists.
      </p>
    </div>
  )
}

function VouchButton({ active, disabled, onClick, icon, label }: {
  active: boolean; disabled: boolean; onClick: () => void
  icon: React.ReactNode; label: string
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '7px 11px', borderRadius: 8, fontSize: 13, cursor: 'pointer',
        border: `1px solid ${active ? '#0c4a6e' : '#d6d3d1'}`,
        background: active ? '#0c4a6e' : '#fff',
        color: active ? '#fff' : '#44403c',
        opacity: disabled ? 0.6 : 1
      }}
    >
      {icon} {label}
    </button>
  )
}

const panel: React.CSSProperties = {
  padding: 14, borderRadius: 10, border: '1px solid #e7e5e4', background: '#fff'
}
const label: React.CSSProperties = {
  display: 'block', fontSize: 13, fontWeight: 600, margin: '10px 0 4px', color: '#44403c'
}
const input: React.CSSProperties = {
  width: '100%', padding: '9px 10px', borderRadius: 8,
  border: '1px solid #d6d3d1', fontSize: 14, fontFamily: 'inherit'
}
const primaryButton: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 14px',
  borderRadius: 8, border: 'none', background: '#0c4a6e', color: '#fff',
  fontSize: 14, fontWeight: 600, cursor: 'pointer'
}
const secondaryButton: React.CSSProperties = {
  ...primaryButton, background: '#fff', color: '#44403c', border: '1px solid #d6d3d1'
}
const pill: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 4,
  fontSize: 12, padding: '2px 8px', borderRadius: 999, background: '#f5f5f4'
}

/** Re-exported so a caller can label a sector without importing the rules module. */
export { SECTOR_OF }
