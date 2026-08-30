// Batch 10: org/business broadcast messaging. Free, in-app + email only —
// no SMS/push gateway. See theresident_org_broadcast_schema.sql for the real access
// control (RLS + res_user_is_sender_of_or_above / res_is_unit_ancestor_or_self)
// — the pure functions here mirror that SQL logic for client-side UX
// (audience-size preview, "can I post as this unit" pre-check) and are unit
// tested since a Postgres RLS policy can't be exercised from `npm test`.
// They are NOT the security boundary; the DB is.
import { supabase } from './supabase'
import { resilientCall } from './resilientCall'

export type OrgTier =
  | 'department' | 'hod' | 'school' | 'teacher' | 'business' | 'branch'
  | 'municipality' | 'ward' | 'utility' | 'isp'
  | 'university' | 'faculty' | 'grade' | 'class'
  | 'clinic' | 'other'

export type OrgSector =
  | 'education' | 'utility' | 'government' | 'business' | 'health' | 'transport' | 'other'

/** Only 'urgent' and 'critical' reach the bell; only a verified unit may send them. */
export type BroadcastPriority = 'normal' | 'important' | 'urgent' | 'critical'

export interface OrgUnit {
  id: string
  parentId: string | null
  name: string
  tier: OrgTier
  ownerUserId: string | null
  sector: OrgSector | null
  verified: boolean
  suburb: string | null
  city: string | null
  description: string | null
}

export interface OrgBroadcast {
  id: string
  unitId: string
  senderId: string
  title: string
  body: string
  priority: BroadcastPriority
  category: string | null
  expiresAt: string | null
  createdAt: string
}

/** An urgent announcement this user has not acknowledged yet. */
export interface PendingUrgentBroadcast {
  id: string
  unitId: string
  unitName: string
  title: string
  body: string
  priority: BroadcastPriority
  createdAt: string
}

export const TIER_LABEL: Record<OrgTier, string> = {
  department: 'Department', hod: 'District office', school: 'School',
  teacher: 'Teacher', business: 'Business', branch: 'Branch',
  municipality: 'Municipality', ward: 'Ward', utility: 'Utility', isp: 'Internet provider',
  university: 'University', faculty: 'Faculty', grade: 'Grade', class: 'Class',
  clinic: 'Clinic', other: 'Other'
}

/** Which sector a tier belongs to, so the directory can group sensibly. */
export function sectorForTier(tier: OrgTier): OrgSector {
  switch (tier) {
    case 'department': case 'hod': case 'school': case 'teacher':
    case 'university': case 'faculty': case 'grade': case 'class':
      return 'education'
    case 'municipality': case 'ward':
      return 'government'
    case 'utility': case 'isp':
      return 'utility'
    case 'clinic':
      return 'health'
    case 'business': case 'branch':
      return 'business'
    default:
      return 'other'
  }
}

/**
 * Free-text search over the directory. Matches on the unit's own name, its
 * tier label, and any ancestor's name — so typing a school's name finds its
 * classes, which is how a parent actually looks for "Grade 10A".
 */
export function searchUnits(units: OrgUnit[], query: string): OrgUnit[] {
  const q = query.trim().toLowerCase()
  if (!q) return units
  return units.filter(u => {
    const trail = unitBreadcrumb(units, u.id).map(b => b.name).join(' ')
    return `${trail} ${TIER_LABEL[u.tier] ?? ''} ${u.suburb ?? ''} ${u.city ?? ''}`
      .toLowerCase()
      .includes(q)
  })
}

/** All descendant unit ids of `rootId`, including `rootId` itself. */
export function descendantUnitIds(units: OrgUnit[], rootId: string): string[] {
  const byParent = new Map<string, string[]>()
  for (const u of units) {
    if (!u.parentId) continue
    byParent.set(u.parentId, [...(byParent.get(u.parentId) || []), u.id])
  }
  const result = new Set<string>([rootId])
  const queue = [rootId]
  while (queue.length > 0) {
    const id = queue.shift()!
    for (const childId of byParent.get(id) || []) {
      if (!result.has(childId)) {
        result.add(childId)
        queue.push(childId)
      }
    }
  }
  return [...result]
}

/**
 * Recipients of a broadcast posted at `postUnitId`: followers of that unit,
 * plus followers of any of its descendants — a Department-level post reaches
 * a Teacher-level follower; a Teacher-level post never reaches a different
 * school's followers, since it has no descendants to inherit from.
 */
export function resolveAudience(
  units: OrgUnit[],
  follows: Array<{ unitId: string; followerUserId: string }>,
  postUnitId: string
): string[] {
  const reachableUnits = new Set(descendantUnitIds(units, postUnitId))
  const audience = new Set<string>()
  for (const f of follows) {
    if (reachableUnits.has(f.unitId)) audience.add(f.followerUserId)
  }
  return [...audience]
}

/** Ancestor chain from root down to `unitId`, inclusive — for a breadcrumb picker. */
export function unitBreadcrumb(units: OrgUnit[], unitId: string): OrgUnit[] {
  const byId = new Map(units.map(u => [u.id, u]))
  const chain: OrgUnit[] = []
  let current = byId.get(unitId)
  while (current) {
    chain.unshift(current)
    current = current.parentId ? byId.get(current.parentId) : undefined
  }
  return chain
}

/** Client-side pre-check only (UX) — mirrors res_user_is_sender_of_or_above; the DB enforces the real rule. */
export function canPostAsUnit(units: OrgUnit[], senderUnitIds: string[], targetUnitId: string): boolean {
  return senderUnitIds.some(senderUnitId => descendantUnitIds(units, senderUnitId).includes(targetUnitId))
}

function mapUnitRow(row: Record<string, unknown>): OrgUnit {
  return {
    id: row.id as string,
    parentId: (row.parent_id as string | null) ?? null,
    name: row.name as string,
    tier: row.tier as OrgTier,
    ownerUserId: (row.owner_user_id as string | null) ?? null,
    sector: (row.sector as OrgSector | null) ?? null,
    verified: !!row.verified,
    suburb: (row.suburb as string | null) ?? null,
    city: (row.city as string | null) ?? null,
    description: (row.description as string | null) ?? null
  }
}

function mapBroadcastRow(row: Record<string, unknown>): OrgBroadcast {
  return {
    id: row.id as string,
    unitId: row.unit_id as string,
    senderId: row.sender_id as string,
    title: row.title as string,
    body: row.body as string,
    priority: ((row.priority as BroadcastPriority | null) ?? 'normal'),
    category: (row.category as string | null) ?? null,
    expiresAt: (row.expires_at as string | null) ?? null,
    createdAt: row.created_at as string
  }
}

export async function fetchAllUnits(): Promise<OrgUnit[]> {
  if (!supabase) return []
  const { data, error } = await supabase.from('res_org_units').select('*').limit(500)
  if (error || !data) return []
  return data.map(mapUnitRow)
}

export async function fetchMySenderUnitIds(userId: string): Promise<string[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('res_org_memberships')
    .select('unit_id')
    .eq('user_id', userId)
    .eq('role', 'sender')
  if (error || !data) return []
  return data.map(r => r.unit_id as string)
}

export async function fetchMyFollowedUnitIds(userId: string): Promise<string[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('res_org_follows')
    .select('unit_id')
    .eq('follower_user_id', userId)
  if (error || !data) return []
  return data.map(r => r.unit_id as string)
}

/** Broadcasts the caller is allowed to see — RLS already scopes this to real recipients. */
export async function fetchBroadcastFeed(limit = 30): Promise<OrgBroadcast[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('res_org_broadcasts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error || !data) return []
  return data.map(mapBroadcastRow)
}

export async function followUnit(unitId: string, userId: string, emailOptIn: boolean): Promise<void> {
  if (!supabase) throw new Error('Not connected')
  const client = supabase
  await resilientCall(async () => {
    const { error } = await client
      .from('res_org_follows')
      .upsert({ unit_id: unitId, follower_user_id: userId, email_opt_in: emailOptIn }, { onConflict: 'unit_id,follower_user_id' })
    if (error) throw error
  })
}

export async function unfollowUnit(unitId: string, userId: string): Promise<void> {
  if (!supabase) throw new Error('Not connected')
  const client = supabase
  await resilientCall(async () => {
    const { error } = await client
      .from('res_org_follows')
      .delete()
      .eq('unit_id', unitId)
      .eq('follower_user_id', userId)
    if (error) throw error
  })
}

export interface NewOrgUnit {
  name: string
  tier: OrgUnit['tier']
  parentId: string | null
  ownerUserId: string
}

export async function createUnit(unit: NewOrgUnit): Promise<OrgUnit> {
  if (!supabase) throw new Error('Not connected')
  const client = supabase
  return resilientCall(async () => {
    const { data, error } = await client
      .from('res_org_units')
      .insert({ name: unit.name, tier: unit.tier, parent_id: unit.parentId, owner_user_id: unit.ownerUserId })
      .select('*')
      .single()
    if (error) throw error
    return mapUnitRow(data)
  })
}

export async function postBroadcast(
  unitId: string,
  senderId: string,
  title: string,
  body: string,
  priority: BroadcastPriority = 'normal',
  category?: string
): Promise<OrgBroadcast> {
  if (!supabase) throw new Error('Not connected')
  const client = supabase
  return resilientCall(async () => {
    const { data, error } = await client
      .from('res_org_broadcasts')
      .insert({ unit_id: unitId, sender_id: senderId, title, body, priority, category: category ?? null })
      .select('*')
      .single()
    if (error) throw error
    return mapBroadcastRow(data)
  })
  // resilientCall's default isRetryableError already excludes 'rate_limited'
  // messages — a rate-limit rejection surfaces immediately, not retried into
  // a second identical rejection.
}

/**
 * Urgent/critical announcements this user still has to acknowledge. Drives the
 * banner that does not go away on its own — the ask was something that "won't
 * stop blinking until you open it", so unlike every other dismissible thing in
 * this app the state lives in the DB (res_org_broadcast_receipts) rather than
 * sessionStorage, and therefore survives a refresh or a different device.
 */
export async function fetchPendingUrgentBroadcasts(): Promise<PendingUrgentBroadcast[]> {
  if (!supabase) return []
  const { data, error } = await supabase.rpc('res_pending_urgent_broadcasts')
  if (error || !data) return []
  return (data as Record<string, unknown>[]).map(r => ({
    id: r.id as string,
    unitId: r.unit_id as string,
    unitName: (r.unit_name as string) || 'Announcement',
    title: r.title as string,
    body: r.body as string,
    priority: r.priority as BroadcastPriority,
    createdAt: r.created_at as string
  }))
}

/** Marks it dealt with, and clears the matching bell entry so the two agree. */
export async function acknowledgeBroadcast(broadcastId: string): Promise<void> {
  if (!supabase) throw new Error('Not connected')
  const { error } = await supabase.rpc('res_ack_broadcast', { p_broadcast: broadcastId })
  if (error) throw error
}
