// Single source of truth for every price in the app — the Paystack edge
// functions, UpgradeButton, and any UI copy that mentions a rand amount all
// read from here, so a price never has to be updated in more than one place.
//
// Pricing philosophy (see the product plan): consumer prices stay low enough
// that paying is an impulse decision, not a barrier — the free floor always
// works, paying only buys speed/visibility. B2B prices are negotiation
// anchors for a sales conversation, not self-serve checkout amounts, since
// real enterprise deals get customized.

export type BillingType = 'self_serve' | 'contact_sales'
export type Cadence = 'monthly' | 'one_time'

export interface PriceEntry {
  amountZarCents: number
  cadence: Cadence
  billingType: BillingType
  label: string
  reasoning: string
}

export const PRICING: Record<string, PriceEntry> = {
  // ── Consumer subscriptions — self-serve via Paystack ──────────────────
  priority: {
    amountZarCents: 5000,
    cadence: 'monthly',
    billingType: 'self_serve',
    label: 'Priority',
    reasoning: 'Below a single load-shedding-proof candle pack; cheap enough that a working provider tries it for one month to see if it pays for itself.'
  },
  premium: {
    amountZarCents: 10000,
    cadence: 'monthly',
    billingType: 'self_serve',
    label: 'Premium',
    reasoning: 'Exactly 2x Priority — an easy mental doubling, not an arbitrary jump. Still under R120 where research on informal-sector willingness-to-pay for lead-gen tools tends to fall off.'
  },
  plus: {
    amountZarCents: 3500,
    cadence: 'monthly',
    billingType: 'self_serve',
    label: 'Household Plus',
    reasoning: 'Deliberately BELOW Priority — this is a comfort tier, not an income tier, and should read as an impulse "nice to have" rather than compete with the provider tiers for budget.'
  },

  // ── One-off purchases — self-serve via Paystack, single charge ────────
  verification_speedup: {
    amountZarCents: 2500,
    cadence: 'one_time',
    billingType: 'self_serve',
    label: 'Verification speed-up',
    reasoning: 'A one-time nudge to the front of a queue that is free and eventually arrives anyway — priced low so it never feels like paying for trust itself, only for speed.'
  },
  market_boost: {
    amountZarCents: 1500,
    cadence: 'one_time',
    billingType: 'self_serve',
    label: 'Boost a Market listing (48h)',
    reasoning: 'Cheapest item in the whole pricing table on purpose — a single second-hand item sale has a small margin, the boost fee must stay well under what most items sell for.'
  },
  room_boost: {
    amountZarCents: 3000,
    cadence: 'one_time',
    billingType: 'self_serve',
    label: 'Feature a room listing (7 days)',
    reasoning: 'Priced above the Market boost (longer window, higher-value transaction — a room, not a used item) but still under one night of the room itself.'
  },
  notice_boost: {
    amountZarCents: 1000,
    cadence: 'one_time',
    billingType: 'self_serve',
    label: 'Boost a notice to the top of the wall (24h)',
    reasoning: 'Cheapest boost in the table — a community notice has no transaction value behind it, this only buys attention, so it must stay impulse-cheap.'
  },
  notice_extend_visibility: {
    amountZarCents: 500,
    cadence: 'one_time',
    billingType: 'self_serve',
    label: 'Keep a notice visible past its free 8h window (+24h)',
    reasoning: 'Framed as an hourly cost (~R0.20/hr over the 24h block it buys) but sold as one self-serve block, the same way room_boost sells "7 days" rather than literal per-day charges — a real per-second meter has no natural checkout UI and no payment processor bills that granularly anyway.'
  },

  // ── Area messaging — licensed per OFFICE, not per person ─────────────
  // Priced by the reach being bought. Every one of these follows a six-month
  // free probation, and none of them gate an emergency: a `critical` notice
  // sends whether or not the licence is live (see
  // theresident_area_billing_schema.sql).
  area_ward: {
    amountZarCents: 19900,
    cadence: 'monthly',
    billingType: 'self_serve',
    label: 'Ward area messaging',
    reasoning: 'Sized against a ward councillor\'s constituency allowance rather than a personal budget — this is an office expense with a line item, so it can sit above the consumer tiers. Kept under R200 because a councillor signs this up themselves after the free six months, without a procurement process.'
  },
  area_institution: {
    amountZarCents: 29900,
    cadence: 'monthly',
    billingType: 'self_serve',
    label: 'Institution area messaging (library, clinic, school, station)',
    reasoning: 'Above the ward tier because an institution reaches a service area it defines rather than a fixed constituency, and typically has an operating budget rather than an allowance. Still self-serve: the point is that a librarian can start this without a tender.'
  },
  area_municipal: {
    amountZarCents: 250000,
    cadence: 'monthly',
    billingType: 'contact_sales',
    label: 'Municipal / metro area messaging',
    reasoning: 'An order of magnitude above the ward tier because the reach is: a metro speaks to millions, not a few thousand. Contact-sales rather than self-serve since municipal spend goes through procurement anyway, and the real number depends on population and how many wards are covered.'
  },
  area_provincial: {
    amountZarCents: 750000,
    cadence: 'monthly',
    billingType: 'contact_sales',
    label: 'Provincial area messaging',
    reasoning: 'An anchor for a negotiation, not a price. A province is a small number of very large customers, so each deal will be shaped by volume, SMS costs and how many departments sit under the licence.'
  },
  area_national: {
    amountZarCents: 1500000,
    cadence: 'monthly',
    billingType: 'contact_sales',
    label: 'National area messaging',
    reasoning: 'Entirely a negotiation anchor. At this level the conversation is about SMS spend, uptime commitments and the political weight of the channel, none of which is answered by a number on a pricing page.'
  },

  // ── B2B — anchors for a sales conversation, not self-serve amounts ────
  local_business_sponsorship: {
    amountZarCents: 15000,
    cadence: 'monthly',
    billingType: 'contact_sales',
    label: 'Local business sponsored placement',
    reasoning: 'Sized for a spaza shop or small security firm\'s real marketing budget — meaningfully above consumer tiers since it\'s commercial spend, not personal.'
  },
  infra_partner_placement: {
    amountZarCents: 50000,
    cadence: 'monthly',
    billingType: 'contact_sales',
    label: 'Infrastructure partner placement (Telkom/Eskom/fiber/water)',
    reasoning: 'A starting anchor for negotiation with a large utility, not a rigid price — real deals here will be custom and likely much larger once volume/exclusivity terms are discussed.'
  },
  white_label_base: {
    amountZarCents: 99900,
    cadence: 'monthly',
    billingType: 'contact_sales',
    label: 'White-label licensing (base, + per-household add-on)',
    reasoning: 'Standard small-business SaaS anchor; expected to scale with a per-registered-household add-on negotiated per estate/HOA rather than a single flat number.'
  },
  neighbourhood_insights_report: {
    amountZarCents: 250000,
    cadence: 'one_time',
    billingType: 'contact_sales',
    label: 'Anonymized neighbourhood insights report',
    reasoning: 'Priced as a one-off research deliverable (municipality/researcher budget), not a subscription — most buyers here want a single study, not a live feed.'
  }
}

export function formatPrice(key: keyof typeof PRICING): string {
  const entry = PRICING[key]
  const rand = entry.amountZarCents / 100
  const amount = new Intl.NumberFormat('en-ZA', {
    style: 'currency', currency: 'ZAR',
    minimumFractionDigits: Number.isInteger(rand) ? 0 : 2
  }).format(rand)
  return entry.cadence === 'monthly' ? `${amount}/mo` : amount
}
