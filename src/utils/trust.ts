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
