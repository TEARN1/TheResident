// The public face of a resident — what a neighbour sees when they tap your
// name on the gossip feed.
//
// Everything here goes through res_public_profile / res_public_profile_posts
// (schema part 3, section 46) rather than selecting from `profiles`. That is
// not a style preference. `profiles` belongs to The Gruvs and The Resident may
// read exactly eleven of its columns (CONTRACT.md §3); `res_profiles` holds a
// resident's legal name, gender, employment status and children count, none of
// which is public. The server decides the column list once so that a future
// addition to the profile card has to be a deliberate edit to a SECURITY
// DEFINER function, not a `select *` nobody reviews.
//
// The pure functions below are for display only. They never decide access.
import { supabase } from './supabase'
import { resilientCall } from './resilientCall'

export interface PublicProfile {
  id: string
  username: string | null
  displayName: string | null
  avatarUrl: string | null
  bio: string | null
  city: string | null
  suburb: string | null
  isVerified: boolean
  vibeScore: number | null
  socialIntegrityScore: number | null
  badges: string[]
  xp: number | null
  memberSince: string | null
  role: string | null
  gossipPostCount: number
  isSelf: boolean
}

export interface PublicProfilePost {
  id: string
  body: string | null
  createdAt: string
  mediaUrl: string | null
  mediaType: string | null
  backgroundStyle: string | null
}

/** Raised when a block in either direction hides the resident. */
export const UNAVAILABLE = 'resident_unavailable'

/** Raised by both RPCs when there is no signed-in caller. */
export const NOT_SIGNED_IN = 'not signed in'

/**
 * Supabase errors are PostgrestError objects, not Error instances, so
 * `String(err)` on one renders the literal text "[object Object]" — which is
 * what this page showed a visitor before this existed. Pull the message out
 * of whatever shape actually arrived.
 */
export function messageOf(err: unknown): string {
  if (err instanceof Error) return err.message
  if (typeof err === 'string') return err
  if (err && typeof err === 'object') {
    const o = err as { message?: unknown; error?: unknown; details?: unknown }
    for (const v of [o.message, o.error, o.details]) {
      if (typeof v === 'string' && v) return v
    }
  }
  return 'Something went wrong.'
}

// ── Pure display helpers ───────────────────────────────────────────────────

/**
 * What to call someone. Display name, then their handle, and only then a
 * generic word — never a raw uuid, which is what several screens in this app
 * used to show when a profile row was missing.
 */
export function nameOf(p: Pick<PublicProfile, 'displayName' | 'username'>): string {
  const name = p.displayName?.trim()
  if (name) return name
  const handle = p.username?.trim()
  if (handle) return `@${handle}`
  return 'A resident'
}

/** Initials for the avatar fallback. At most two letters, always uppercase. */
export function initialsOf(name: string): string {
  const parts = name.replace(/^@/, '').split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

/** "Sunnyside, Pretoria" — and nothing at all when neither is set. */
export function placeOf(p: Pick<PublicProfile, 'suburb' | 'city'>): string {
  return [p.suburb, p.city].map(s => s?.trim()).filter(Boolean).join(', ')
}

/**
 * "Neighbour since March 2026". Deliberately month-level: the exact day
 * someone signed up is not information a stranger needs, and a full date
 * invites the "account is only 3 days old" judgement this app has no evidence
 * to support.
 */
export function memberSinceLabel(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `Neighbour since ${d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}`
}

/**
 * A resident's role, in words a neighbour understands. The database stores
 * 'tenant' | 'landlord' | 'visitor'; "Tenant" alone reads like a status being
 * asserted about someone, so these say what the person does here.
 */
export function roleLabel(role: string | null): string {
  switch (role) {
    case 'landlord': return 'Lists rooms'
    case 'tenant':   return 'Looking for or renting a room'
    case 'visitor':  return 'Just looking around'
    default:         return ''
  }
}

/**
 * Trust scores are shown only when the database actually has one. A missing
 * score rendered as 0 reads as "this person scored zero", which is a specific
 * and damaging claim to make about someone by accident — the same class of
 * bug as the empty <h1>: the UI asserting something it does not know.
 */
export function hasScore(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

// ── Network ────────────────────────────────────────────────────────────────

interface ProfileRow {
  id: string
  username: string | null
  display_name: string | null
  avatar_url: string | null
  bio: string | null
  city: string | null
  suburb: string | null
  is_verified: boolean | null
  vibe_score: number | null
  social_integrity_score: number | null
  badges: string[] | null
  xp: number | null
  member_since: string | null
  role: string | null
  gossip_post_count: number | null
  is_self: boolean | null
}

interface PostRow {
  id: string
  body: string | null
  created_at: string
  media_url: string | null
  media_type: string | null
  background_style: string | null
}

function mapProfile(row: ProfileRow): PublicProfile {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    bio: row.bio,
    city: row.city,
    suburb: row.suburb,
    isVerified: !!row.is_verified,
    vibeScore: row.vibe_score,
    socialIntegrityScore: row.social_integrity_score,
    badges: Array.isArray(row.badges) ? row.badges : [],
    xp: row.xp,
    memberSince: row.member_since,
    role: row.role,
    gossipPostCount: row.gossip_post_count ?? 0,
    isSelf: !!row.is_self
  }
}

/**
 * Returns null when there is no such resident, and throws with UNAVAILABLE in
 * the message when a block hides them. The caller needs to tell those apart:
 * "no such person" and "you cannot see this person" deserve different words.
 */
export async function fetchPublicProfile(userId: string): Promise<PublicProfile | null> {
  if (!supabase) return null
  const client = supabase
  return resilientCall(async () => {
    const { data, error } = await client.rpc('res_public_profile', { p_user_id: userId })
    if (error) throw error
    const rows = (data || []) as ProfileRow[]
    return rows.length ? mapProfile(rows[0]) : null
  })
}

export async function fetchPublicProfilePosts(
  userId: string,
  limit = 20
): Promise<PublicProfilePost[]> {
  if (!supabase) return []
  const client = supabase
  return resilientCall(async () => {
    const { data, error } = await client.rpc('res_public_profile_posts', {
      p_user_id: userId,
      p_limit: limit
    })
    if (error) throw error
    return ((data || []) as PostRow[]).map(r => ({
      id: r.id,
      body: r.body,
      createdAt: r.created_at,
      mediaUrl: r.media_url,
      mediaType: r.media_type,
      backgroundStyle: r.background_style
    }))
  })
}
