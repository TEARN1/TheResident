// Local business sponsorship — the placement rules.
//
// A sponsorship buys POSITION, never EXISTENCE. A paying business gets a
// clearly-labelled slot at the top of its suburb's list; every other business
// stays exactly where it was, in a list that is still complete. That rule is
// already written into src/utils/subscriptions.ts ("pay-for-priority, not
// pay-to-play") and this file is where it becomes enforceable.
//
// Pure — no Supabase, no React — so each rule below is testable on its own.
// See docs/SPONSORSHIP-PLAN.md for why the design is shaped this way.

// ── Surfaces ───────────────────────────────────────────────────────────────

export type Surface =
  | 'services' | 'vendors' | 'skills' | 'market'          // sellable
  | 'faults' | 'alerts' | 'care_circle' | 'disputes' | 'safety' | 'notifications'

/**
 * The only surfaces that may ever carry a sponsored slot.
 *
 * Kept as an allowlist rather than a denylist on purpose: a surface added to
 * the app in a year is un-sellable by default, and someone has to deliberately
 * add it here. A denylist would silently open every new screen to advertising.
 */
export const SELLABLE_SURFACES: readonly Surface[] = ['services', 'vendors', 'skills', 'market']

/**
 * Surfaces that must never be sold, at any price.
 *
 * A sponsored slot beside a panic alert or an elderly neighbour's missed
 * check-in would end this app's credibility in a single screenshot, and no
 * amount of monthly revenue buys that back. This is enforced in code because a
 * rule that lives only in a document gets broken by a well-meaning change in
 * eighteen months.
 */
export const NEVER_SELLABLE: readonly Surface[] = [
  'faults', 'alerts', 'care_circle', 'disputes', 'safety', 'notifications',
]

export function isSellableSurface(surface: string): boolean {
  return (SELLABLE_SURFACES as readonly string[]).includes(surface)
}

// ── The record ─────────────────────────────────────────────────────────────

export type SponsorshipStatus = 'pending' | 'active' | 'expired' | 'cancelled'

/** Tables a sponsorship may promote. It always points at a real listing. */
export type SubjectTable = 'res_handyman_services' | 'res_vendors' | 'res_skills' | 'res_market_items'

export const SUBJECT_FOR_SURFACE: Record<string, SubjectTable> = {
  services: 'res_handyman_services',
  vendors: 'res_vendors',
  skills: 'res_skills',
  market: 'res_market_items',
}

export interface Sponsorship {
  id: string
  subjectTable: SubjectTable
  subjectId: string
  sponsorUserId: string
  surface: Surface
  suburb: string
  category: string | null
  slot: number
  status: SponsorshipStatus
  startsAt: string
  endsAt: string
  /** What was agreed off-platform. A record, never a balance (CONTRACT.md §6). */
  rateZarCents: number
}

export interface SlotPolicy {
  maxPerSuburbCategory: number
}

/**
 * Two slots, deliberately.
 *
 * Scarcity IS the product. If every business can be sponsored then sponsorship
 * means nothing, the price can never rise, and the list becomes adverts. Two
 * also gives a true sales sentence — "there are two plumbing slots in Ivory
 * Park and one is taken" — which is the kind of urgency you do not have to
 * invent.
 */
export const DEFAULT_SLOT_POLICY: SlotPolicy = { maxPerSuburbCategory: 2 }

// ── Term and status ────────────────────────────────────────────────────────

export function isActive(s: Sponsorship, now: number = Date.now()): boolean {
  if (s.status !== 'active') return false
  const start = new Date(s.startsAt).getTime()
  const end = new Date(s.endsAt).getTime()
  return start <= now && now < end
}

export function hasExpired(s: Sponsorship, now: number = Date.now()): boolean {
  return s.status === 'active' && new Date(s.endsAt).getTime() <= now
}

export function daysRemaining(s: Sponsorship, now: number = Date.now()): number {
  const ms = new Date(s.endsAt).getTime() - now
  return Math.max(0, Math.ceil(ms / 86_400_000))
}

/**
 * Whether to nudge about renewal.
 *
 * A placement that lapses silently is a sponsor who quietly stops paying and a
 * relationship you find out about after it ended — so the reminder exists for
 * the seller's sake, not the system's.
 */
export function renewalDue(s: Sponsorship, withinDays = 7, now: number = Date.now()): boolean {
  return s.status === 'active' && daysRemaining(s, now) <= withinDays && !hasExpired(s, now)
}

// ── Slot allocation ────────────────────────────────────────────────────────

/** Slots already taken for a suburb + category, ignoring finished sponsorships. */
export function takenSlots(
  existing: Sponsorship[], suburb: string, category: string | null,
  now: number = Date.now()
): number[] {
  return existing
    .filter(s => s.suburb === suburb && s.category === category)
    .filter(s => s.status === 'pending' || isActive(s, now))
    .map(s => s.slot)
    .sort((a, b) => a - b)
}

/**
 * The next free slot, or null when the category is sold out.
 *
 * Returning null rather than overflowing is the point: selling a third slot in
 * a two-slot category would quietly devalue the two already sold.
 */
export function nextFreeSlot(
  existing: Sponsorship[], suburb: string, category: string | null,
  policy: SlotPolicy = DEFAULT_SLOT_POLICY, now: number = Date.now()
): number | null {
  const taken = new Set(takenSlots(existing, suburb, category, now))
  for (let slot = 1; slot <= policy.maxPerSuburbCategory; slot++) {
    if (!taken.has(slot)) return slot
  }
  return null
}

export function slotsRemaining(
  existing: Sponsorship[], suburb: string, category: string | null,
  policy: SlotPolicy = DEFAULT_SLOT_POLICY, now: number = Date.now()
): number {
  return Math.max(0, policy.maxPerSuburbCategory - takenSlots(existing, suburb, category, now).length)
}

// ── Rendering ──────────────────────────────────────────────────────────────

/**
 * The sponsored entries to show above a list.
 *
 * Refuses outright on a non-sellable surface rather than returning nothing
 * quietly — a caller asking to put adverts on the panic-alert screen is a bug
 * that should be loud.
 */
export function sponsoredFor(
  all: Sponsorship[], surface: Surface, suburb: string, category: string | null,
  policy: SlotPolicy = DEFAULT_SLOT_POLICY, now: number = Date.now()
): Sponsorship[] {
  if (!isSellableSurface(surface)) {
    throw new Error(
      `sponsoredFor: '${surface}' is not a sellable surface. ` +
      `Safety and civic screens are never for sale (see docs/SPONSORSHIP-PLAN.md).`)
  }

  const seen = new Set<number>()
  return all
    .filter(s => s.surface === surface && s.suburb === suburb && s.category === category)
    .filter(s => isActive(s, now))
    .sort((a, b) => a.slot - b.slot)
    .filter(s => {
      // Defensive: a duplicate slot should be impossible (the database has a
      // unique constraint) but if one ever exists, show one — never two ads in
      // the same position.
      if (seen.has(s.slot) || s.slot > policy.maxPerSuburbCategory) return false
      seen.add(s.slot)
      return true
    })
}

/**
 * The organic list, UNCHANGED.
 *
 * This function deliberately does nothing, and that is the whole point: it
 * exists so the rule has a name and a test. A sponsor buys a slot ABOVE the
 * list; they never displace anyone from it, and a sponsored business still
 * appears in its own natural position below. Appearing twice is a small
 * cosmetic cost in exchange for a list nobody has been pushed out of.
 */
export function organicList<T>(items: T[]): T[] {
  return items
}

/** The label. Always present, never dismissible, never softened. */
export const SPONSORED_LABEL = 'Sponsored'

/**
 * Every sponsored entry must be disclosed. South African advertising rules
 * require it, and more practically it is the thing that lets a resident trust
 * the rest of the list.
 */
export function requiresDisclosure(): true {
  return true
}
