// Reads for the sponsored slot.
//
// Read-only by design. There is no create/update here at all: placements are
// sold in a conversation and written by service_role, so a client that could
// insert one could hand itself free advertising. The rules live in
// ./sponsorship (pure, tested); the shape of a placement is decided server-side.

import { supabase } from './supabase'
import type { Surface } from './sponsorship'
import { isSellableSurface } from './sponsorship'

export interface SponsoredEntry {
  id: string
  slot: number
  subjectTable: string
  subjectId: string
  /** Name of the promoted listing, resolved server-side in one round trip. */
  subjectName: string
  sponsorUserId: string
  endsAt: string
}

interface SponsoredRow {
  id: string
  slot: number
  subject_table: string
  subject_id: string
  subject_name: string | null
  sponsor_user_id: string
  ends_at: string
}

/**
 * Live sponsored placements for one list.
 *
 * Throws on a non-sellable surface rather than returning nothing, matching the
 * server function: a caller trying to put adverts on the panic-alert screen is
 * a bug that must be loud, not a silent empty array.
 *
 * Any other failure returns an empty list. A sponsored slot is the least
 * important thing on the page — if it cannot load, the neighbour still gets
 * their full list of plumbers.
 */
export async function fetchSponsored(
  surface: Surface, suburb: string, category?: string | null
): Promise<SponsoredEntry[]> {
  if (!isSellableSurface(surface)) {
    throw new Error(
      `fetchSponsored: '${surface}' is not a sellable surface — ` +
      `safety and civic screens are never for sale.`)
  }
  if (!supabase || !suburb) return []

  const { data, error } = await supabase.rpc('res_sponsored_for', {
    p_surface: surface,
    p_suburb: suburb,
    p_category: category ?? null,
  })

  if (error) return []

  return ((data ?? []) as SponsoredRow[])
    .filter(r => !!r.subject_name)   // the promoted listing vanished mid-flight
    .map(r => ({
      id: r.id,
      slot: r.slot,
      subjectTable: r.subject_table,
      subjectId: r.subject_id,
      subjectName: r.subject_name as string,
      sponsorUserId: r.sponsor_user_id,
      endsAt: r.ends_at,
    }))
}

export interface SponsorshipInventory {
  surface: string
  suburb: string
  category: string | null
  totalSlots: number
  taken: number
  remaining: number
}

/**
 * What is still sellable in a suburb — the question you need answered while
 * standing in the shop, not back at a laptop.
 */
export async function fetchInventory(
  surface: Surface, suburb: string, category?: string | null
): Promise<SponsorshipInventory | null> {
  if (!supabase || !isSellableSurface(surface)) return null

  const { data, error } = await supabase.rpc('res_sponsorship_inventory', {
    p_surface: surface,
    p_suburb: suburb,
    p_category: category ?? null,
  })

  if (error || !data) return null

  const d = data as {
    surface: string; suburb: string; category: string | null
    total_slots: number; taken: number; remaining: number
  }
  return {
    surface: d.surface,
    suburb: d.suburb,
    category: d.category,
    totalSlots: d.total_slots,
    taken: d.taken,
    remaining: d.remaining,
  }
}
