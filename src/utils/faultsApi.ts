// Client for the collective fault layer.
//
// Every write goes through an RPC rather than a table insert, because the rules
// that make a fault credible — clustering into an existing report, the
// proximity gate, one vouch per person — are enforced server-side. A client
// that could insert rows directly could manufacture evidence, which would make
// the whole mechanism worthless.
//
// Scoring lives in ./faults (pure, unit-tested). This file only moves data.

import { supabase } from './supabase'
import type { FaultKind, VouchKind } from './faults'

export interface Fault {
  id: string
  kind: FaultKind
  sector: string
  status: string
  detail: string | null
  lat: number
  lon: number
  suburb: string | null
  distinctReporters: number
  affectedCount: number
  disputeCount: number
  confidence: number
  priority: number
  createdAt: string
  escalatedAt: string | null
  acknowledgedAt: string | null
  providerReference: string | null
  falseClosureCount: number
  myVouch?: VouchKind | null
}

interface FaultRow {
  id: string
  kind: string
  sector: string
  status: string
  detail: string | null
  lat: number
  lon: number
  suburb: string | null
  distinct_reporters: number
  affected_count: number
  dispute_count: number
  confidence: number
  priority: number
  created_at: string
  escalated_at: string | null
  acknowledged_at: string | null
  provider_reference: string | null
  false_closure_count: number
}

const toFault = (r: FaultRow): Fault => ({
  id: r.id,
  kind: r.kind as FaultKind,
  sector: r.sector,
  status: r.status,
  detail: r.detail,
  lat: r.lat,
  lon: r.lon,
  suburb: r.suburb,
  distinctReporters: r.distinct_reporters,
  affectedCount: r.affected_count,
  disputeCount: r.dispute_count,
  confidence: r.confidence,
  priority: r.priority,
  createdAt: r.created_at,
  escalatedAt: r.escalated_at,
  acknowledgedAt: r.acknowledged_at,
  providerReference: r.provider_reference,
  falseClosureCount: r.false_closure_count,
})

const COLUMNS =
  'id, kind, sector, status, detail, lat, lon, suburb, distinct_reporters, ' +
  'affected_count, dispute_count, confidence, priority, created_at, ' +
  'escalated_at, acknowledged_at, provider_reference, false_closure_count'

/**
 * Reports a fault. The server decides whether this starts a new fault or joins
 * one already open nearby — that clustering is what turns twenty individual
 * complaints into one piece of evidence, so it is never the client's call.
 *
 * Returns `joinedExisting` so the UI can say "you're the 7th neighbour to
 * report this" rather than implying a fresh report vanished into nothing.
 */
export async function reportFault(args: {
  kind: FaultKind
  lat: number
  lon: number
  detail?: string
  suburb?: string
  city?: string
}): Promise<{ faultId: string; joinedExisting: boolean; error: string | null }> {
  if (!supabase) return { faultId: '', joinedExisting: false, error: 'Not connected' }

  const { data, error } = await supabase.rpc('res_report_fault', {
    p_kind: args.kind,
    p_lat: args.lat,
    p_lon: args.lon,
    p_detail: args.detail ?? null,
    p_suburb: args.suburb ?? null,
    p_city: args.city ?? null,
  })

  if (error) return { faultId: '', joinedExisting: false, error: error.message }

  const result = data as { fault_id: string; joined_existing: boolean }
  return { faultId: result.fault_id, joinedExisting: result.joined_existing, error: null }
}

/**
 * Adds or changes your vouch. The location is required and checked server-side
 * against the fault's position — vouching is limited to people who are close
 * enough to actually see it, which is what stops a remote group manufacturing
 * an outage.
 *
 * The error is returned verbatim rather than swallowed, because "you are 812m
 * from this fault" is genuinely useful feedback and a silent failure is not.
 */
export async function vouchFault(
  faultId: string, kind: VouchKind, lat: number, lon: number, note?: string
): Promise<{ ok: boolean; error: string | null }> {
  if (!supabase) return { ok: false, error: 'Not connected' }

  const { error } = await supabase.rpc('res_vouch_fault', {
    p_fault_id: faultId,
    p_kind: kind,
    p_lat: lat,
    p_lon: lon,
    p_note: note ?? null,
  })

  return error ? { ok: false, error: error.message } : { ok: true, error: null }
}

/** Live faults in a suburb, most significant first. */
export async function fetchFaults(suburb?: string, limit = 50): Promise<Fault[]> {
  if (!supabase) return []

  let query = supabase
    .from('res_faults')
    .select(COLUMNS)
    .not('status', 'in', '("lapsed","rejected","verified")')
    .order('priority', { ascending: false })
    .limit(limit)

  if (suburb) query = query.eq('suburb', suburb)

  const { data, error } = await query
  if (error) return []
  return ((data ?? []) as unknown as FaultRow[]).map(toFault)
}

/** Which faults the signed-in user has already vouched on, so the UI can show it. */
export async function fetchMyVouches(faultIds: string[]): Promise<Record<string, VouchKind>> {
  if (!supabase || faultIds.length === 0) return {}
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return {}

  const { data } = await supabase
    .from('res_fault_vouches')
    .select('fault_id, kind')
    .eq('user_id', user.id)
    .in('fault_id', faultIds)

  const out: Record<string, VouchKind> = {}
  for (const row of (data ?? []) as Array<{ fault_id: string; kind: VouchKind }>) {
    out[row.fault_id] = row.kind
  }
  return out
}

/**
 * The provider-side queue. Returns nothing unless the signed-in user is a
 * listed admin of that provider — enforced inside the RPC, not here.
 */
export async function fetchProviderQueue(providerId: string): Promise<Fault[]> {
  if (!supabase) return []
  const { data, error } = await supabase.rpc('res_provider_queue', { p_provider: providerId })
  if (error) return []
  return ((data ?? []) as unknown as FaultRow[]).map(r => toFault({ ...r, detail: null }))
}

/**
 * Moves a fault along its lifecycle. Goes through res_transition_user, so
 * legality and authority are checked in the database — a resident cannot mark
 * a fault "acknowledged by the utility", and the audit trail records who did
 * what regardless.
 */
export async function advanceFault(
  faultId: string, to: string, reason: string
): Promise<{ ok: boolean; error: string | null }> {
  if (!supabase) return { ok: false, error: 'Not connected' }
  const { error } = await supabase.rpc('res_transition_user', {
    p_entity: 'res_faults',
    p_id: faultId,
    p_to: to,
    p_reason: reason,
  })
  return error ? { ok: false, error: error.message } : { ok: true, error: null }
}
