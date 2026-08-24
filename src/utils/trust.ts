// Real reputation + trust signals for stranger-facing surfaces (rent tool,
// apply to room, book lift). Reputation comes from res_reputation (server
// authoritative, bumped via res_bump_reputation) — never the local Redux
// reputationScores placeholder. Trust columns come from the world-readable
// set in CONTRACT.md §3 on `profiles`.
import { supabase } from './supabase'
import { reputationTier } from './logic'

export interface TrustInfo {
  reputationScore: number
  reputationTier: string
  isVerified: boolean
  socialIntegrityScore: number | null
  residentTrustTier: string | null
  vibeScore: number | null
  badges: string[]
}

const DEFAULT_TRUST: TrustInfo = {
  reputationScore: 0,
  reputationTier: reputationTier(0),
  isVerified: false,
  socialIntegrityScore: null,
  residentTrustTier: null,
  vibeScore: null,
  badges: []
}

export async function getTrustInfo(userId: string): Promise<TrustInfo> {
  if (!supabase || !userId) return DEFAULT_TRUST

  const [repRes, profileRes] = await Promise.all([
    supabase.from('res_reputation').select('score').eq('user_id', userId).maybeSingle(),
    supabase.from('profiles').select('is_verified, social_integrity_score, resident_trust_tier, vibe_score, badges').eq('id', userId).maybeSingle()
  ])

  const score = repRes.data?.score ?? 0
  return {
    reputationScore: score,
    reputationTier: reputationTier(score),
    isVerified: !!profileRes.data?.is_verified,
    socialIntegrityScore: profileRes.data?.social_integrity_score ?? null,
    residentTrustTier: profileRes.data?.resident_trust_tier ?? null,
    vibeScore: profileRes.data?.vibe_score ?? null,
    badges: profileRes.data?.badges ?? []
  }
}

// Next of Kin onboarding requirement — every tenant gets a 6-month grace
// period from signup to add at least one confirmed trust connection (see
// TrustCirclePage / res_trust_connections). Deliberately does NOT auto-
// restrict anyone once the window lapses — it only flags the account so a
// landlord/admin can decide next steps, since silently locking someone out
// over a missed vouch could be worse than the risk it's meant to catch.
const NEXT_OF_KIN_GRACE_MONTHS = 6

export interface NextOfKinStatus {
  hasNextOfKin: boolean
  deadline: Date | null
  daysRemaining: number | null
  overdue: boolean
}

function addMonths(date: Date, months: number): Date {
  const result = new Date(date)
  result.setMonth(result.getMonth() + months)
  return result
}

export async function getNextOfKinStatus(userId: string, accountCreatedAt: string | null | undefined): Promise<NextOfKinStatus> {
  if (!supabase || !userId) {
    return { hasNextOfKin: false, deadline: null, daysRemaining: null, overdue: false }
  }

  const { count } = await supabase
    .from('res_trust_connections')
    .select('id', { count: 'exact', head: true })
    .or(`requester_id.eq.${userId},connection_id.eq.${userId}`)
    .eq('status', 'confirmed')

  const hasNextOfKin = (count ?? 0) > 0

  if (!accountCreatedAt) {
    return { hasNextOfKin, deadline: null, daysRemaining: null, overdue: false }
  }

  const deadline = addMonths(new Date(accountCreatedAt), NEXT_OF_KIN_GRACE_MONTHS)
  const msRemaining = deadline.getTime() - Date.now()
  const daysRemaining = Math.ceil(msRemaining / (24 * 60 * 60 * 1000))

  return {
    hasNextOfKin,
    deadline,
    daysRemaining,
    overdue: !hasNextOfKin && msRemaining <= 0
  }
}

export async function getTrustInfoBulk(userIds: string[]): Promise<Record<string, TrustInfo>> {
  if (!supabase || userIds.length === 0) return {}
  const ids = [...new Set(userIds)]

  const [repRes, profileRes] = await Promise.all([
    supabase.from('res_reputation').select('user_id, score').in('user_id', ids),
    supabase.from('profiles').select('id, is_verified, social_integrity_score, resident_trust_tier, vibe_score, badges').in('id', ids)
  ])

  const repMap = new Map((repRes.data || []).map(r => [r.user_id, r.score]))
  const profileMap = new Map((profileRes.data || []).map(p => [p.id, p]))

  const out: Record<string, TrustInfo> = {}
  for (const id of ids) {
    const score = repMap.get(id) ?? 0
    const profile = profileMap.get(id)
    out[id] = {
      reputationScore: score,
      reputationTier: reputationTier(score),
      isVerified: !!profile?.is_verified,
      socialIntegrityScore: profile?.social_integrity_score ?? null,
      residentTrustTier: profile?.resident_trust_tier ?? null,
      vibeScore: profile?.vibe_score ?? null,
      badges: profile?.badges ?? []
    }
  }
  return out
}
