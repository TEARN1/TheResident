// Batch 10: org/business broadcast messaging. Free, in-app + email only —
// no SMS/push gateway. See theresident_org_broadcast_schema.sql for the real access
// control (RLS + res_user_is_sender_of_or_above / res_is_unit_ancestor_or_self)
// — the pure functions here mirror that SQL logic for client-side UX
// (audience-size preview, "can I post as this unit" pre-check) and are unit
// tested since a Postgres RLS policy can't be exercised from `npm test`.
// They are NOT the security boundary; the DB is.
import { supabase } from './supabase'
import { resilientCall } from './resilientCall'

export interface OrgUnit {
  id: string
  parentId: string | null
  name: string
  tier: 'department' | 'hod' | 'school' | 'teacher' | 'business' | 'branch'
  ownerUserId: string | null
}

export interface OrgBroadcast {
  id: string
  unitId: string
  senderId: string
  title: string
  body: string
  createdAt: string
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
    tier: row.tier as OrgUnit['tier'],
    ownerUserId: (row.owner_user_id as string | null) ?? null
  }
}

function mapBroadcastRow(row: Record<string, unknown>): OrgBroadcast {
  return {
    id: row.id as string,
    unitId: row.unit_id as string,
    senderId: row.sender_id as string,
    title: row.title as string,
    body: row.body as string,
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

export async function postBroadcast(unitId: string, senderId: string, title: string, body: string): Promise<OrgBroadcast> {
  if (!supabase) throw new Error('Not connected')
  const client = supabase
  return resilientCall(async () => {
    const { data, error } = await client
      .from('res_org_broadcasts')
      .insert({ unit_id: unitId, sender_id: senderId, title, body })
      .select('*')
      .single()
    if (error) throw error
    return mapBroadcastRow(data)
  })
  // resilientCall's default isRetryableError already excludes 'rate_limited'
  // messages — a rate-limit rejection surfaces immediately, not retried into
  // a second identical rejection.
}
