// Follow / connections — built against Gruvs' EXISTING shared tables, not a
// Resident-only copy. `follows` and `mutual_follows` are unprefixed
// (Gruvs-owned per CONTRACT.md §2) but world-readable and self-writable, so
// there is nothing to duplicate here: following someone on Resident and
// following them on The Gruvs is the same row, not two separate graphs.
//
// This is deliberately the ONLY social-graph file that touches those tables.
// The next-of-kin / trust-circle feature (safety- and money-gated) is a
// SEPARATE, Resident-owned concept and must never read or write these tables
// — see the design notes in the app plan for why blending the two would
// undermine the trust circle's whole anti-scam purpose.
import { supabase } from './supabase'

export interface FollowCounts {
  followers: number
  following: number
}

export interface Connection {
  id: string
  displayName: string
  avatarUrl: string | null
  isVerified: boolean
  vibeScore: number | null
}

export async function followUser(targetUserId: string): Promise<void> {
  if (!supabase) throw new Error('Not connected')
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Sign in to follow people')
  if (user.id === targetUserId) return

  const { error } = await supabase
    .from('follows')
    .insert({ follower_id: user.id, following_id: targetUserId })
  // A duplicate follow is a harmless no-op, not a failure the UI needs to see.
  if (error && error.code !== '23505') throw error
}

export async function unfollowUser(targetUserId: string): Promise<void> {
  if (!supabase) throw new Error('Not connected')
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  const { error } = await supabase
    .from('follows')
    .delete()
    .eq('follower_id', user.id)
    .eq('following_id', targetUserId)
  if (error) throw error
}

export async function isFollowing(targetUserId: string): Promise<boolean> {
  if (!supabase) return false
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.id === targetUserId) return false
  const { data, error } = await supabase
    .from('follows')
    .select('follower_id')
    .eq('follower_id', user.id)
    .eq('following_id', targetUserId)
    .maybeSingle()
  if (error) return false
  return !!data
}

export async function getFollowCounts(userId: string): Promise<FollowCounts> {
  if (!supabase) return { followers: 0, following: 0 }
  const [followers, following] = await Promise.all([
    supabase.from('follows').select('follower_id', { count: 'exact', head: true }).eq('following_id', userId),
    supabase.from('follows').select('following_id', { count: 'exact', head: true }).eq('follower_id', userId)
  ])
  return {
    followers: followers.count || 0,
    following: following.count || 0
  }
}

/**
 * People the signed-in user already mutually follows — this is NOT a
 * follow-suggestion (they're already connected), it's making an existing
 * Gruvs relationship visible and useful inside Resident: "3 people you know
 * are also here." Uses only the world-readable profiles trust columns
 * (CONTRACT.md §3) — never the Gruvs-private ones.
 */
export async function getMutualConnections(limit = 12): Promise<Connection[]> {
  if (!supabase) return []
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  // mutual_follows stores both directions of a pair as separate rows (A,B)
  // and (B,A) — a limit here caps raw rows, not unique people, so fetch
  // generously and dedupe before applying the real, people-facing limit.
  const { data: pairs, error: pairsError } = await supabase
    .from('mutual_follows')
    .select('user_a, user_b')
    .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
    .limit(limit * 2)
  if (pairsError || !pairs) return []

  const otherIds = [...new Set(
    pairs.map(p => (p.user_a === user.id ? p.user_b : p.user_a))
  )].slice(0, limit)
  if (otherIds.length === 0) return []

  const { data: people, error: peopleError } = await supabase
    .from('profiles')
    .select('id, display_name, username, avatar_url, is_verified, vibe_score')
    .in('id', otherIds)
  if (peopleError || !people) return []

  return people.map(p => ({
    id: p.id,
    displayName: p.display_name || p.username || 'Resident',
    avatarUrl: p.avatar_url || null,
    isVerified: !!p.is_verified,
    vibeScore: p.vibe_score ?? null
  }))
}
