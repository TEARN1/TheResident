// Jurisdictions — the boundaries that decide who may broadcast to whom, and
// Phase B of docs/OFFICIAL-BROADCAST-STRATEGY.md.
//
// The rule these support: an official body may broadcast to any area fully
// contained within its own jurisdiction, and nowhere else. That check lives
// in SQL (res_can_broadcast_to_area) because it is the security boundary —
// nothing here re-implements it. These are for reading and for explaining.
import { supabase } from './supabase'
import { resilientCall } from './resilientCall'

export type JurisdictionLevel =
  | 'ward' | 'municipality' | 'district' | 'province' | 'national' | 'service_area'

export interface Jurisdiction {
  id: string
  name: string
  level: JurisdictionLevel
  externalRef: string | null
}

export const LEVEL_LABEL: Record<JurisdictionLevel, string> = {
  ward: 'Ward',
  municipality: 'Municipality',
  district: 'District',
  province: 'Province',
  national: 'National',
  service_area: 'Service area'
}

/**
 * Why a body may not broadcast to an area, in the words the composer shows.
 * Mirrors res_area_broadcast_block_reason's return values — the SQL decides,
 * this only translates.
 */
export type BlockReason =
  | 'unknown_unit' | 'not_verified' | 'no_jurisdiction' | 'no_target' | 'outside_jurisdiction'

export function describeBlockReason(reason: BlockReason | null): string | null {
  if (!reason) return null
  switch (reason) {
    case 'not_verified':
      return 'This account has not been verified yet, so it cannot send to an area. It can still post to people who follow it.'
    case 'no_jurisdiction':
      return 'No official area is on file for this account yet.'
    case 'outside_jurisdiction':
      return 'That area reaches outside the area this account is responsible for.'
    case 'no_target':
      return 'Choose an area to send to first.'
    case 'unknown_unit':
      return 'That account could not be found.'
  }
}

/**
 * Narrowest first — a resident cares that they are in Ward 12 before they
 * care that they are in South Africa. Matches the ordering the SQL returns,
 * and is here so a component can re-sort a merged list without a round trip.
 */
const LEVEL_ORDER: Record<JurisdictionLevel, number> = {
  ward: 1, service_area: 2, municipality: 3, district: 4, province: 5, national: 6
}

export function sortByNarrowest(list: Jurisdiction[]): Jurisdiction[] {
  return [...list].sort(
    (a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level] || a.name.localeCompare(b.name)
  )
}

/** "Ward 12" / "City of Tshwane (Municipality)" — for showing a resident where they are. */
export function describeJurisdiction(j: Jurisdiction): string {
  return j.name.toLowerCase().includes(LEVEL_LABEL[j.level].toLowerCase())
    ? j.name
    : `${j.name} (${LEVEL_LABEL[j.level]})`
}

// ── Network ────────────────────────────────────────────────────────────────

interface DbRow {
  id: string
  name: string
  level: JurisdictionLevel
  external_ref: string | null
}

const mapRow = (r: DbRow): Jurisdiction => ({
  id: r.id, name: r.name, level: r.level, externalRef: r.external_ref
})

/**
 * The areas the signed-in resident's own home area falls inside. Self-scoped
 * in SQL: it reads the caller's home area and nobody else's, and takes no
 * coordinates, so it cannot be turned into "who lives in this polygon".
 */
export async function fetchMyJurisdictions(): Promise<Jurisdiction[]> {
  if (!supabase) return []
  const client = supabase
  return resilientCall(async () => {
    const { data, error } = await client.rpc('res_my_jurisdictions')
    if (error) throw error
    return sortByNarrowest(((data as DbRow[]) || []).map(mapRow))
  })
}
