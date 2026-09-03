// Area-messaging licences — Phase F of docs/OFFICIAL-BROADCAST-STRATEGY.md.
//
// A licence belongs to an OFFICE, not a person: a ward councillor's unit may
// have several senders, and the licence has to survive the councillor's
// account being replaced by their successor. So everything here is keyed by
// unit id, not user id, which is why it does not go through subscriptions.ts.
//
// The database decides entitlement (res_area_billing_state) and the send path
// enforces it. Nothing here re-implements that — these are for showing an
// official where they stand and getting them to checkout.
import { supabase } from './supabase'
import { resilientCall } from './resilientCall'
import { PRICING, formatPrice } from './pricing'

export type BillingState = 'none' | 'probation' | 'active' | 'lapsed' | 'exempt'

export interface AreaLicence {
  state: BillingState
  plan: string | null
  /** Days left in the trial or the paid period; null when neither applies. */
  daysRemaining: number | null
  /** Whether anything below `critical` may currently be sent. */
  allowsRoutine: boolean
}

/**
 * The line an official reads above the composer.
 *
 * Two deliberate choices. A trial that is ending says how long is left rather
 * than going quiet until it breaks — "12 days" is what gets a licence renewed;
 * a button that stops working one morning is what gets an angry phone call.
 * And a lapsed office is told, in the same breath, that emergencies still
 * work, because the alternative is an official believing they have no way to
 * warn anyone.
 */
export function describeLicence(licence: AreaLicence | null): string {
  if (!licence) return ''
  switch (licence.state) {
    case 'exempt':
      return 'This office is not billed for area messaging.'
    case 'active':
      return licence.daysRemaining !== null && licence.daysRemaining <= 7
        ? `Your licence renews in ${licence.daysRemaining} ${licence.daysRemaining === 1 ? 'day' : 'days'}.`
        : 'Area messaging is active for this office.'
    case 'probation':
      if (licence.daysRemaining === null) return 'Your free period is running.'
      if (licence.daysRemaining <= 30) {
        return `Free period ends in ${licence.daysRemaining} ${licence.daysRemaining === 1 ? 'day' : 'days'}. After that you can still send emergencies, but routine notices need a licence.`
      }
      return `Free for another ${licence.daysRemaining} days.`
    case 'lapsed':
      return 'Routine area notices need a licence. Emergencies still send — those are never charged for.'
    case 'none':
      return 'Area messaging is not set up for this office yet.'
  }
}

/** Only 'critical' escapes the licence check — mirrors the SQL exactly. */
export function canSendAtPriority(licence: AreaLicence | null, priority: string): boolean {
  if (priority === 'critical') return true
  return !!licence && licence.allowsRoutine
}

/** True when an official should be shown a way to pay. */
export function shouldOfferCheckout(licence: AreaLicence | null): boolean {
  if (!licence) return false
  if (licence.state === 'lapsed' || licence.state === 'none') return true
  return licence.state === 'probation' && licence.daysRemaining !== null && licence.daysRemaining <= 30
}

export interface PlanOffer {
  key: string
  label: string
  price: string
  selfServe: boolean
}

/** What this office would pay, and whether they can just click and pay it. */
export function planOffer(planKey: string | null): PlanOffer | null {
  if (!planKey) return null
  const entry = PRICING[planKey]
  if (!entry) return null
  return {
    key: planKey,
    label: entry.label,
    price: formatPrice(planKey),
    selfServe: entry.billingType === 'self_serve'
  }
}

// ── Network ────────────────────────────────────────────────────────────────

export async function fetchAreaLicence(unitId: string): Promise<AreaLicence | null> {
  if (!supabase) return null
  const client = supabase
  return resilientCall(async () => {
    const { data, error } = await client.rpc('res_area_billing_state', { p_unit: unitId })
    if (error) throw error
    const row = (Array.isArray(data) ? data[0] : data) as {
      state: BillingState; plan: string | null
      days_remaining: number | null; allows_routine: boolean
    } | undefined
    if (!row) return null
    return {
      state: row.state,
      plan: row.plan,
      daysRemaining: row.days_remaining,
      allowsRoutine: row.allows_routine
    }
  })
}

/**
 * Starts checkout for an office licence. The unit id travels as `targetId`,
 * which is what the webhook reads to know WHICH office was paid for — a
 * licence attached to the person who happened to click would be lost the
 * moment they left the job.
 */
export async function startAreaCheckout(
  planKey: string,
  unitId: string
): Promise<{ url: string | null; error: string | null }> {
  if (!supabase) return { url: null, error: 'Not connected' }
  const { data, error } = await supabase.functions.invoke('paystack-checkout', {
    body: { item: planKey, targetId: unitId }
  })
  if (error) return { url: null, error: error.message || 'Could not start checkout' }
  if (data?.error === 'payments_not_configured') {
    return { url: null, error: "Payments aren't set up yet — try again soon." }
  }
  if (data?.error === 'invalid_item') {
    return { url: null, error: 'This plan is arranged directly rather than online — please get in touch.' }
  }
  if (!data?.authorization_url) return { url: null, error: 'Could not start checkout' }
  return { url: data.authorization_url as string, error: null }
}
