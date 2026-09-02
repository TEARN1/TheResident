// Area targeting — choosing WHO a verified official's message reaches, and
// showing them that number before they can send it. Phase C of
// docs/OFFICIAL-BROADCAST-STRATEGY.md.
//
// Everything that decides reach or permission lives in SQL: the containment
// gate (res_can_broadcast_to_area), the audience resolver
// (res_resolve_area_audience) and the gated preview
// (res_preview_area_audience). Nothing here re-implements any of it — these
// are for building the request and phrasing the answer.
import { supabase } from './supabase'
import { resilientCall } from './resilientCall'
import type { JurisdictionLevel } from './jurisdictions'

export type TargetMode = 'jurisdiction' | 'radius'

export interface TargetableArea {
  id: string
  name: string
  level: JurisdictionLevel
  isOwn: boolean
}

export interface AudiencePreview {
  /** Matched by an exact home-area pin — the confident number. */
  pinnedCount: number
  /** Matched only on typed suburb/city text — real, but fuzzy. */
  textMatchedCount: number
  totalCount: number
  /** Non-null when the target was refused; then all counts are zero. */
  blockReason: string | null
}

/** Matches the clamp inside res_radius_target — mirrored so the slider agrees. */
export const MIN_RADIUS_M = 50
export const MAX_RADIUS_M = 50000

export function clampRadius(metres: number): number {
  if (!Number.isFinite(metres)) return MIN_RADIUS_M
  return Math.min(Math.max(Math.round(metres), MIN_RADIUS_M), MAX_RADIUS_M)
}

export function describeRadius(metres: number): string {
  const m = clampRadius(metres)
  return m >= 1000 ? `${(m / 1000).toFixed(m % 1000 === 0 ? 0 : 1)}km` : `${m}m`
}

/**
 * The sentence the composer shows above the send button.
 *
 * Deliberately does not blend the two populations into one confident-looking
 * total. An official is told how many people are certainly inside the area,
 * and separately how many are included on the strength of typed suburb text,
 * because those are different levels of confidence and pretending otherwise
 * would overstate the reach of a government message.
 */
export function describeAudience(preview: AudiencePreview | null): string {
  if (!preview) return 'Choose an area to see how many residents it reaches.'
  if (preview.blockReason) return 'This area cannot be sent to.'
  if (preview.totalCount === 0) {
    return 'No residents are matched in this area yet — nobody here has set a home area.'
  }
  const people = (n: number) => `${n.toLocaleString()} ${n === 1 ? 'resident' : 'residents'}`
  if (preview.textMatchedCount === 0) {
    return `This will reach ${people(preview.pinnedCount)} in this area.`
  }
  if (preview.pinnedCount === 0) {
    return `This will reach ${people(preview.textMatchedCount)}, matched on the suburb they entered rather than a set home area.`
  }
  return `This will reach ${people(preview.pinnedCount)} with a home area here, plus ${preview.textMatchedCount.toLocaleString()} more matched on the suburb they entered.`
}

/** A send should be impossible until a real, allowed audience has been seen. */
export function canSend(preview: AudiencePreview | null): boolean {
  return !!preview && !preview.blockReason && preview.totalCount > 0
}

// ── Network ────────────────────────────────────────────────────────────────

export async function fetchTargetableAreas(unitId: string): Promise<TargetableArea[]> {
  if (!supabase) return []
  const client = supabase
  return resilientCall(async () => {
    const { data, error } = await client.rpc('res_targetable_jurisdictions', { p_unit: unitId })
    if (error) throw error
    return ((data as { id: string; name: string; level: JurisdictionLevel; is_own: boolean }[]) || [])
      .map(r => ({ id: r.id, name: r.name, level: r.level, isOwn: r.is_own }))
  })
}

interface PreviewArgs {
  unitId: string
  mode: TargetMode
  jurisdictionId?: string
  lat?: number
  lon?: number
  radiusMetres?: number
  priority?: string
  category?: string | null
  suburbs?: string[] | null
  cities?: string[] | null
}

/**
 * Gated server-side: the caller must be a sender for the unit AND the unit
 * must be allowed to target the area, so this cannot be used as a population
 * probe. A refusal comes back as blockReason with all counts zero.
 */
export async function previewAudience(args: PreviewArgs): Promise<AudiencePreview> {
  if (!supabase) throw new Error('Not connected')
  const client = supabase

  return resilientCall(async () => {
    // The client never constructs geography; the server turns a chosen
    // jurisdiction or a point+radius into the target shape.
    const target = args.mode === 'jurisdiction'
      ? { p_jurisdiction: args.jurisdictionId }
      : { p_lat: args.lat, p_lon: args.lon, p_metres: clampRadius(args.radiusMetres ?? 3000) }

    const { data: geom, error: geomError } = await client.rpc(
      args.mode === 'jurisdiction' ? 'res_jurisdiction_target' : 'res_radius_target',
      target
    )
    if (geomError) throw geomError

    const { data, error } = await client.rpc('res_preview_area_audience', {
      p_unit: args.unitId,
      p_target: geom,
      p_priority: args.priority ?? 'important',
      p_category: args.category ?? null,
      p_suburbs: args.suburbs ?? null,
      p_cities: args.cities ?? null
    })
    if (error) throw error

    const row = (Array.isArray(data) ? data[0] : data) as {
      pinned_count: number; text_matched_count: number; total_count: number; block_reason: string | null
    }
    return {
      pinnedCount: row?.pinned_count ?? 0,
      textMatchedCount: row?.text_matched_count ?? 0,
      totalCount: row?.total_count ?? 0,
      blockReason: row?.block_reason ?? null
    }
  })
}
