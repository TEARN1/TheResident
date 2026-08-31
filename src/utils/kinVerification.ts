// Kin verification links — a lighter, separate flow from the in-app trust
// circle (res_trust_connections). That graph already requires both people to
// have Resident accounts and to explicitly act. This one covers the case the
// user actually asked for: someone who may not have the app at all (a
// sibling, a parent) getting a link they can open with no login and answer a
// single yes/no question about a relationship claim.
//
// These pure functions mirror the SQL for UX only — the RPCs are the real
// security boundary (see theresident_kin_verification_link.sql).
import { supabase } from './supabase'
import { resilientCall } from './resilientCall'

export type KinLinkStatus = 'pending' | 'confirmed' | 'denied'

export interface KinVerificationLink {
  id: string
  claimedName: string
  claimedRelationship: string
  token: string
  status: KinLinkStatus
  createdAt: string
  respondedAt: string | null
}

export interface KinClaim {
  requesterName: string
  claimedName: string
  claimedRelationship: string
  status: KinLinkStatus
}

export const COMMON_RELATIONSHIPS = [
  'Brother', 'Sister', 'Parent', 'Child', 'Spouse/Partner', 'Cousin', 'Friend', 'Other'
] as const

export function verifyKinLinkUrl(token: string, origin: string): string {
  return `${origin}/verify-kin/${token}`
}

export function kinLinkStatusLabel(status: KinLinkStatus): string {
  if (status === 'confirmed') return 'Confirmed'
  if (status === 'denied') return 'Denied'
  return 'Waiting for a response'
}

interface DbLinkRow {
  id: string
  claimed_name: string
  claimed_relationship: string
  token: string
  status: KinLinkStatus
  created_at: string
  responded_at: string | null
}

function mapLinkRow(row: DbLinkRow): KinVerificationLink {
  return {
    id: row.id,
    claimedName: row.claimed_name,
    claimedRelationship: row.claimed_relationship,
    token: row.token,
    status: row.status,
    createdAt: row.created_at,
    respondedAt: row.responded_at
  }
}

export async function fetchMyKinLinks(): Promise<KinVerificationLink[]> {
  if (!supabase) return []
  const client = supabase
  return resilientCall(async () => {
    const { data, error } = await client.from('res_kin_verification_links').select('*').order('created_at', { ascending: false })
    if (error) throw error
    return (data as DbLinkRow[] || []).map(mapLinkRow)
  })
}

export async function createKinVerificationLink(claimedName: string, relationship: string): Promise<string> {
  if (!supabase) throw new Error('Not connected')
  const client = supabase
  return resilientCall(async () => {
    const { data, error } = await client.rpc('res_create_kin_verification_link', {
      p_claimed_name: claimedName,
      p_relationship: relationship
    })
    if (error) throw error
    const row = (Array.isArray(data) ? data[0] : data) as DbLinkRow
    return row.token
  })
}

export async function fetchKinClaim(token: string): Promise<KinClaim | null> {
  if (!supabase) throw new Error('Not connected')
  const client = supabase
  return resilientCall(async () => {
    const { data, error } = await client.rpc('res_get_kin_verification_link', { p_token: token })
    if (error) throw error
    const row = Array.isArray(data) ? data[0] : data
    if (!row) return null
    return {
      requesterName: row.requester_name,
      claimedName: row.claimed_name,
      claimedRelationship: row.claimed_relationship,
      status: row.status
    }
  })
}

export async function respondToKinClaim(token: string, confirmed: boolean, note?: string): Promise<void> {
  if (!supabase) throw new Error('Not connected')
  const client = supabase
  return resilientCall(async () => {
    const { error } = await client.rpc('res_respond_kin_verification_link', {
      p_token: token,
      p_confirmed: confirmed,
      p_note: note || null
    })
    if (error) throw error
  })
}
