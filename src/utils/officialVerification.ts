// Getting an office verified and bound to an area — the on-ramp for the whole
// officials feature (backlog A1 and A4).
//
// Before this, res_org_units.verified and .jurisdiction_id could only be set
// by hand in the SQL editor, so no councillor, library or clinic could ever
// reach an area no matter what the rest of the system did.
//
// The shape: an official asks, a platform admin decides. Nothing here lets a
// unit verify itself — "authority is a polygon" only holds if somebody outside
// the office draws it. Every rule is enforced in SQL; these are for building
// the request and phrasing the answer.
import { supabase } from './supabase'
import { resilientCall } from './resilientCall'
import type { JurisdictionLevel } from './jurisdictions'

export type VerificationStatus = 'pending' | 'approved' | 'rejected' | 'withdrawn'

export interface MyVerification {
  status: VerificationStatus
  decisionNote: string | null
  decidedAt: string | null
  requestedAt: string
}

export interface PendingRequest {
  requestId: string
  unitId: string
  unitName: string
  unitTier: string
  officialTitle: string | null
  evidenceUrl: string | null
  contactEmail: string | null
  note: string | null
  requestedJurisdictionId: string | null
  requestedJurisdictionName: string | null
  requestedAt: string
}

export interface AreaOption {
  id: string
  name: string
  level: JurisdictionLevel
  externalRef: string | null
  parentName: string | null
}

/**
 * What an applicant is told about where they stand.
 *
 * A rejection always shows its reason: the SQL refuses to record one without
 * a note, precisely so this line can never be "no". An applicant who cannot
 * tell why they were refused simply applies again.
 */
export function describeVerification(v: MyVerification | null): string {
  if (!v) return 'This office has not applied to be verified yet.'
  switch (v.status) {
    case 'pending':
      return 'Application received. Until it is approved this account can post to followers, but not to an area.'
    case 'approved':
      return 'Verified. This office can send to the area it was bound to.'
    case 'rejected':
      return `Not approved — ${v.decisionNote || 'no reason was recorded'}. You can apply again with more evidence.`
    case 'withdrawn':
      return 'Application withdrawn.'
  }
}

/** Applying is only meaningful while the office is unverified and not waiting. */
export function canApply(v: MyVerification | null, unitVerified: boolean): boolean {
  if (unitVerified) return false
  return !v || v.status === 'rejected' || v.status === 'withdrawn'
}

/**
 * An evidence link is the reviewer's whole basis for a decision, so a
 * malformed one wastes a round trip. Checked here for shape only — whether the
 * page actually proves anything is a human judgement.
 */
export function isPlausibleEvidenceUrl(url: string): boolean {
  if (!url.trim()) return true // optional
  try {
    const u = new URL(url.trim())
    return u.protocol === 'https:' || u.protocol === 'http:'
  } catch {
    return false
  }
}

// ── Network ────────────────────────────────────────────────────────────────

export async function isPlatformAdmin(): Promise<boolean> {
  if (!supabase) return false
  const client = supabase
  try {
    const { data, error } = await client.rpc('res_is_platform_admin')
    if (error) throw error
    return !!data
  } catch {
    // Not being an admin is the overwhelmingly common case; a failure here
    // must never block a page from rendering.
    return false
  }
}

export async function fetchMyVerification(unitId: string): Promise<MyVerification | null> {
  if (!supabase) return null
  const client = supabase
  return resilientCall(async () => {
    const { data, error } = await client.rpc('res_my_unit_verification', { p_unit: unitId })
    if (error) throw error
    const row = (Array.isArray(data) ? data[0] : data) as {
      status: VerificationStatus; decision_note: string | null
      decided_at: string | null; requested_at: string
    } | undefined
    if (!row) return null
    return {
      status: row.status,
      decisionNote: row.decision_note,
      decidedAt: row.decided_at,
      requestedAt: row.requested_at
    }
  })
}

export interface ApplyArgs {
  unitId: string
  officialTitle?: string
  evidenceUrl?: string
  contactEmail?: string
  note?: string
  jurisdictionId?: string | null
}

export async function applyForVerification(args: ApplyArgs): Promise<string> {
  if (!supabase) throw new Error('Not connected')
  const client = supabase
  return resilientCall(async () => {
    const { data, error } = await client.rpc('res_request_unit_verification', {
      p_unit: args.unitId,
      p_official_title: args.officialTitle ?? null,
      p_evidence_url: args.evidenceUrl ?? null,
      p_contact_email: args.contactEmail ?? null,
      p_note: args.note ?? null,
      p_jurisdiction: args.jurisdictionId ?? null
    })
    if (error) throw error
    return data as string
  })
}

export async function withdrawVerification(unitId: string): Promise<void> {
  if (!supabase) throw new Error('Not connected')
  const client = supabase
  await resilientCall(async () => {
    const { error } = await client.rpc('res_withdraw_unit_verification', { p_unit: unitId })
    if (error) throw error
  })
}

export async function fetchPendingRequests(): Promise<PendingRequest[]> {
  if (!supabase) return []
  const client = supabase
  return resilientCall(async () => {
    const { data, error } = await client.rpc('res_pending_verification_requests')
    if (error) throw error
    const rows = (data as {
      request_id: string; unit_id: string; unit_name: string; unit_tier: string
      official_title: string | null; evidence_url: string | null; contact_email: string | null
      note: string | null; requested_jurisdiction_id: string | null
      requested_jurisdiction_name: string | null; requested_at: string
    }[]) || []
    return rows.map(r => ({
      requestId: r.request_id, unitId: r.unit_id, unitName: r.unit_name, unitTier: r.unit_tier,
      officialTitle: r.official_title, evidenceUrl: r.evidence_url, contactEmail: r.contact_email,
      note: r.note, requestedJurisdictionId: r.requested_jurisdiction_id,
      requestedJurisdictionName: r.requested_jurisdiction_name, requestedAt: r.requested_at
    }))
  })
}

export async function searchAreas(query: string): Promise<AreaOption[]> {
  if (!supabase) return []
  const client = supabase
  return resilientCall(async () => {
    const { data, error } = await client.rpc('res_search_jurisdictions', { p_query: query, p_limit: 25 })
    if (error) throw error
    const rows = (data as {
      id: string; name: string; level: JurisdictionLevel
      external_ref: string | null; parent_name: string | null
    }[]) || []
    return rows.map(r => ({
      id: r.id, name: r.name, level: r.level,
      externalRef: r.external_ref, parentName: r.parent_name
    }))
  })
}

/** Approval verifies AND binds in one act — either alone leaves an office that looks approved and reaches nobody. */
export async function approveRequest(unitId: string, jurisdictionId: string, note?: string): Promise<void> {
  if (!supabase) throw new Error('Not connected')
  const client = supabase
  await resilientCall(async () => {
    const { error } = await client.rpc('res_approve_unit_verification', {
      p_unit: unitId, p_jurisdiction: jurisdictionId, p_note: note ?? null
    })
    if (error) throw error
  })
}

export async function rejectRequest(unitId: string, note: string): Promise<void> {
  if (!supabase) throw new Error('Not connected')
  const client = supabase
  await resilientCall(async () => {
    const { error } = await client.rpc('res_reject_unit_verification', { p_unit: unitId, p_note: note })
    if (error) throw error
  })
}

export async function revokeVerification(unitId: string, note: string): Promise<void> {
  if (!supabase) throw new Error('Not connected')
  const client = supabase
  await resilientCall(async () => {
    const { error } = await client.rpc('res_revoke_unit_verification', { p_unit: unitId, p_note: note })
    if (error) throw error
  })
}
