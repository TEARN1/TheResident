import test from 'node:test'
import assert from 'node:assert'
import {
  isSellableSurface,
  sponsoredFor,
  organicList,
  takenSlots,
  nextFreeSlot,
  slotsRemaining,
  isActive,
  hasExpired,
  daysRemaining,
  renewalDue,
  requiresDisclosure,
  SELLABLE_SURFACES,
  NEVER_SELLABLE,
  SPONSORED_LABEL,
  SUBJECT_FOR_SURFACE,
  DEFAULT_SLOT_POLICY
} from './sponsorship'
import type { Sponsorship, Surface } from './sponsorship'

const NOW = Date.parse('2026-08-16T12:00:00Z')
const DAY = 86_400_000
const at = (days: number) => new Date(NOW + days * DAY).toISOString()

const sponsorship = (over: Partial<Sponsorship> = {}): Sponsorship => ({
  id: 's-1',
  subjectTable: 'res_handyman_services',
  subjectId: 'biz-1',
  sponsorUserId: 'u-1',
  surface: 'services',
  suburb: 'Ivory Park',
  category: 'plumbing',
  slot: 1,
  status: 'active',
  startsAt: at(-10),
  endsAt: at(20),
  rateZarCents: 15000,
  ...over,
})

// ── The rule that must never bend ──────────────────────────────────────────

test('safety and civic surfaces are not sellable at any price', () => {
  for (const surface of NEVER_SELLABLE) {
    assert.ok(!isSellableSurface(surface), `${surface} must never be sellable`)
  }
})

test('asking to place an advert on a safety surface throws, loudly', () => {
  // Returning an empty array would let the mistake pass silently into
  // production. A caller putting ads on the panic-alert screen is a bug.
  for (const surface of ['faults', 'alerts', 'care_circle', 'safety'] as Surface[]) {
    assert.throws(
      () => sponsoredFor([sponsorship({ surface })], surface, 'Ivory Park', 'plumbing', DEFAULT_SLOT_POLICY, NOW),
      /not a sellable surface/,
      `${surface} should refuse`)
  }
})

test('an unknown surface is not sellable by default', () => {
  // Allowlist, not denylist: a screen added next year is un-sellable until
  // somebody deliberately adds it.
  assert.ok(!isSellableSurface('some_new_screen'))
  assert.ok(!isSellableSurface(''))
})

test('the four sellable surfaces each map to a real listing table', () => {
  for (const s of SELLABLE_SURFACES) {
    assert.ok(SUBJECT_FOR_SURFACE[s], `${s} has no subject table — a sponsorship must promote a real listing`)
  }
  assert.strictEqual(SELLABLE_SURFACES.length, 4)
})

test('sponsorship never removes anyone from the organic list', () => {
  // A sponsor buys a slot ABOVE the list, never a place IN it. If this ever
  // filters, a paying business is displacing a free one and the promise in
  // subscriptions.ts is broken.
  const all = ['a', 'b', 'sponsored-biz', 'c']
  assert.deepStrictEqual(organicList(all), all)
})

test('disclosure is not optional', () => {
  assert.strictEqual(requiresDisclosure(), true)
  assert.strictEqual(SPONSORED_LABEL, 'Sponsored')
})

// ── Selection ──────────────────────────────────────────────────────────────

test('only active, in-term sponsorships are shown', () => {
  const all = [
    sponsorship({ id: 'live', slot: 1 }),
    sponsorship({ id: 'pending', slot: 2, status: 'pending' }),
    sponsorship({ id: 'cancelled', slot: 2, status: 'cancelled' }),
    sponsorship({ id: 'expired', slot: 2, status: 'expired' }),
    sponsorship({ id: 'not-started', slot: 2, startsAt: at(5), endsAt: at(35) }),
    sponsorship({ id: 'term-passed', slot: 2, startsAt: at(-40), endsAt: at(-1) }),
  ]
  const shown = sponsoredFor(all, 'services', 'Ivory Park', 'plumbing', DEFAULT_SLOT_POLICY, NOW)
  assert.deepStrictEqual(shown.map(s => s.id), ['live'])
})

test('sponsors from another suburb or category never leak in', () => {
  const all = [
    sponsorship({ id: 'mine' }),
    sponsorship({ id: 'other-suburb', slot: 2, suburb: 'Tembisa' }),
    sponsorship({ id: 'other-category', slot: 2, category: 'electrical' }),
    sponsorship({ id: 'other-surface', slot: 2, surface: 'market' }),
  ]
  const shown = sponsoredFor(all, 'services', 'Ivory Park', 'plumbing', DEFAULT_SLOT_POLICY, NOW)
  assert.deepStrictEqual(shown.map(s => s.id), ['mine'])
})

test('sponsored entries render in slot order', () => {
  const all = [sponsorship({ id: 'second', slot: 2 }), sponsorship({ id: 'first', slot: 1 })]
  const shown = sponsoredFor(all, 'services', 'Ivory Park', 'plumbing', DEFAULT_SLOT_POLICY, NOW)
  assert.deepStrictEqual(shown.map(s => s.id), ['first', 'second'])
})

test('a duplicate slot shows once — never two adverts in one position', () => {
  const all = [sponsorship({ id: 'a', slot: 1 }), sponsorship({ id: 'b', slot: 1 })]
  assert.strictEqual(sponsoredFor(all, 'services', 'Ivory Park', 'plumbing', DEFAULT_SLOT_POLICY, NOW).length, 1)
})

test('a slot beyond the cap is never rendered, even if one exists in the data', () => {
  const all = [sponsorship({ id: 'over', slot: 9 })]
  assert.strictEqual(sponsoredFor(all, 'services', 'Ivory Park', 'plumbing', DEFAULT_SLOT_POLICY, NOW).length, 0)
})

test('an uncategorised surface (null category) is its own inventory', () => {
  const all = [
    sponsorship({ id: 'general', category: null }),
    sponsorship({ id: 'plumbing', slot: 2, category: 'plumbing' }),
  ]
  assert.deepStrictEqual(
    sponsoredFor(all, 'services', 'Ivory Park', null, DEFAULT_SLOT_POLICY, NOW).map(s => s.id),
    ['general'])
})

// ── Scarcity ───────────────────────────────────────────────────────────────

test('scarcity holds: a third sponsor cannot be sold into a two-slot category', () => {
  // Overflowing would quietly devalue the two slots already sold.
  const existing = [sponsorship({ slot: 1 }), sponsorship({ id: 's-2', slot: 2 })]
  assert.strictEqual(nextFreeSlot(existing, 'Ivory Park', 'plumbing', DEFAULT_SLOT_POLICY, NOW), null)
  assert.strictEqual(slotsRemaining(existing, 'Ivory Park', 'plumbing', DEFAULT_SLOT_POLICY, NOW), 0)
})

test('slot 1 is offered first, then 2', () => {
  assert.strictEqual(nextFreeSlot([], 'Ivory Park', 'plumbing', DEFAULT_SLOT_POLICY, NOW), 1)
  assert.strictEqual(
    nextFreeSlot([sponsorship({ slot: 1 })], 'Ivory Park', 'plumbing', DEFAULT_SLOT_POLICY, NOW), 2)
})

test('a slot freed by expiry or cancellation becomes sellable again', () => {
  const existing = [
    sponsorship({ slot: 1, status: 'expired' }),
    sponsorship({ id: 's-2', slot: 2, status: 'cancelled' }),
  ]
  assert.strictEqual(nextFreeSlot(existing, 'Ivory Park', 'plumbing', DEFAULT_SLOT_POLICY, NOW), 1)
  assert.strictEqual(slotsRemaining(existing, 'Ivory Park', 'plumbing', DEFAULT_SLOT_POLICY, NOW), 2)
})

test('a pending sale holds its slot — you cannot sell the same position twice', () => {
  const existing = [sponsorship({ slot: 1, status: 'pending' })]
  assert.deepStrictEqual(takenSlots(existing, 'Ivory Park', 'plumbing', NOW), [1])
  assert.strictEqual(nextFreeSlot(existing, 'Ivory Park', 'plumbing', DEFAULT_SLOT_POLICY, NOW), 2)
})

test('inventory is counted per suburb and per category, not globally', () => {
  const existing = [sponsorship({ slot: 1 }), sponsorship({ id: 's-2', slot: 2 })]
  // Sold out for Ivory Park plumbing, wide open next suburb over.
  assert.strictEqual(slotsRemaining(existing, 'Ivory Park', 'plumbing', DEFAULT_SLOT_POLICY, NOW), 0)
  assert.strictEqual(slotsRemaining(existing, 'Tembisa', 'plumbing', DEFAULT_SLOT_POLICY, NOW), 2)
  assert.strictEqual(slotsRemaining(existing, 'Ivory Park', 'electrical', DEFAULT_SLOT_POLICY, NOW), 2)
})

test('the cap is configurable without touching code', () => {
  const existing = [sponsorship({ slot: 1 }), sponsorship({ id: 's-2', slot: 2 })]
  assert.strictEqual(nextFreeSlot(existing, 'Ivory Park', 'plumbing', { maxPerSuburbCategory: 3 }, NOW), 3)
})

// ── Term ───────────────────────────────────────────────────────────────────

test('isActive respects both status and the agreed term', () => {
  assert.ok(isActive(sponsorship(), NOW))
  assert.ok(!isActive(sponsorship({ status: 'pending' }), NOW))
  assert.ok(!isActive(sponsorship({ startsAt: at(1), endsAt: at(31) }), NOW), 'not started yet')
  assert.ok(!isActive(sponsorship({ startsAt: at(-40), endsAt: at(-1) }), NOW), 'term finished')
})

test('the end of the term is exclusive — a placement stops the moment it is up', () => {
  assert.ok(!isActive(sponsorship({ endsAt: new Date(NOW).toISOString() }), NOW))
  assert.ok(hasExpired(sponsorship({ endsAt: new Date(NOW).toISOString() }), NOW))
})

test('daysRemaining rounds up and never goes negative', () => {
  assert.strictEqual(daysRemaining(sponsorship({ endsAt: at(5) }), NOW), 5)
  assert.strictEqual(daysRemaining(sponsorship({ endsAt: at(-5) }), NOW), 0)
})

test('renewal is flagged a week out, so a placement never lapses silently', () => {
  assert.ok(renewalDue(sponsorship({ endsAt: at(3) }), 7, NOW))
  assert.ok(!renewalDue(sponsorship({ endsAt: at(20) }), 7, NOW))
  assert.ok(!renewalDue(sponsorship({ endsAt: at(3), status: 'cancelled' }), 7, NOW),
    'a cancelled placement is not a renewal opportunity')
})
