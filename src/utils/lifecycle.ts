// Layer 1 of docs/SELF-MANAGING.md — the state machines.
//
// Nothing manages itself until "what state is this row in, and what may
// follow" is data rather than a rule scattered across reducers, components
// and jobs. This file is the single source of truth for both sides:
//
//   • TypeScript reads it directly (UI affordances, tests).
//   • Postgres reads a generated copy in res_transitions, so a job and the
//     UI can never disagree about what is legal.
//
// A transition not listed here is illegal, and res_transition() raises rather
// than silently no-opping — a job that quietly fails to act looks identical
// to a job that had nothing to do, which is the hardest kind of bug to see.

export type ActorKind = 'user' | 'job' | 'policy' | 'operator' | 'system'

export interface Transition {
  entity: string
  from: string
  to: string
  /** Who may make this move. A state changed only by automation lists just 'job'. */
  actors: ActorKind[]
  /** Named guard evaluated inside res_transition(); null = no extra condition. */
  guard: string | null
  /** Whether res_revert() may put the row back. Terminal/notified moves often can't. */
  reversible: boolean
  /** Why this transition exists — surfaced in the audit log's reason field. */
  note: string
}

/**
 * Status values that already exist in the live database keep their spelling
 * exactly (e.g. listings use 'open', never 'available' — the unapplied
 * deploy_production_schema.sql disagreed and was deleted, see the migration
 * 20260815000400 header).
 */
export const TRANSITIONS: Transition[] = [
  // ── res_listings ─────────────────────────────────────────────────────────
  { entity: 'res_listings', from: 'open', to: 'taken', actors: ['user'], guard: 'isLandlord', reversible: true,
    note: 'Landlord marks the room as filled.' },
  { entity: 'res_listings', from: 'open', to: 'paused', actors: ['user'], guard: 'isLandlord', reversible: true,
    note: 'Landlord temporarily hides the listing.' },
  { entity: 'res_listings', from: 'paused', to: 'open', actors: ['user'], guard: 'isLandlord', reversible: true,
    note: 'Landlord republishes.' },
  { entity: 'res_listings', from: 'taken', to: 'open', actors: ['user'], guard: 'isLandlord', reversible: true,
    note: 'Tenant fell through; room is available again.' },
  { entity: 'res_listings', from: 'open', to: 'expiring', actors: ['job'], guard: null, reversible: true,
    note: 'Approaching expires_at — warned, still visible.' },
  { entity: 'res_listings', from: 'expiring', to: 'open', actors: ['user'], guard: 'isLandlord', reversible: true,
    note: 'Landlord confirmed the room is still available; clock resets.' },
  { entity: 'res_listings', from: 'expiring', to: 'expired', actors: ['job'], guard: null, reversible: true,
    note: 'Passed expires_at with no landlord confirmation.' },
  { entity: 'res_listings', from: 'expired', to: 'open', actors: ['user'], guard: 'isLandlord', reversible: true,
    note: 'Landlord relists from the expiry notification.' },
  { entity: 'res_listings', from: 'expired', to: 'archived', actors: ['job'], guard: null, reversible: true,
    note: 'Long-expired listing removed from all surfaces.' },
  { entity: 'res_listings', from: 'open', to: 'flagged', actors: ['policy'], guard: null, reversible: true,
    note: 'A moderation rule matched. Still visible — flagged is a queue, not a punishment.' },
  { entity: 'res_listings', from: 'flagged', to: 'open', actors: ['operator', 'user'], guard: 'isReviewer', reversible: true,
    note: 'Review cleared the flag.' },
  { entity: 'res_listings', from: 'flagged', to: 'suspended', actors: ['operator'], guard: 'isReviewer', reversible: true,
    note: 'Review upheld the flag; listing hidden. Propose tier — never Auto.' },
  { entity: 'res_listings', from: 'suspended', to: 'open', actors: ['operator'], guard: 'isReviewer', reversible: true,
    note: 'Suspension lifted on appeal.' },

  // ── res_room_requests ────────────────────────────────────────────────────
  { entity: 'res_room_requests', from: 'pending', to: 'approved', actors: ['user'], guard: 'isLandlordOfRequest', reversible: false,
    note: 'Landlord accepts the applicant. Not reversible: the tenant has been told.' },
  { entity: 'res_room_requests', from: 'pending', to: 'rejected', actors: ['user'], guard: 'isLandlordOfRequest', reversible: false,
    note: 'Landlord declines.' },
  { entity: 'res_room_requests', from: 'pending', to: 'withdrawn', actors: ['user'], guard: 'isTenantOfRequest', reversible: false,
    note: 'Applicant pulls out.' },
  { entity: 'res_room_requests', from: 'pending', to: 'auto_expired', actors: ['job'], guard: null, reversible: true,
    note: 'No landlord response within the policy window. Both sides notified; no reputation penalty on a first offence.' },

  // ── res_service_dispatches ───────────────────────────────────────────────
  { entity: 'res_service_dispatches', from: 'pending', to: 'accepted', actors: ['user'], guard: 'isServiceOwner', reversible: true,
    note: 'Provider takes the job.' },
  { entity: 'res_service_dispatches', from: 'accepted', to: 'completed', actors: ['user'], guard: 'isDispatchParty', reversible: false,
    note: 'Work done. Settlement happens off-platform (CONTRACT.md §6).' },
  { entity: 'res_service_dispatches', from: 'pending', to: 'abandoned', actors: ['job'], guard: null, reversible: true,
    note: 'No provider accepted within the window; sender notified and offered alternatives.' },
  { entity: 'res_service_dispatches', from: 'accepted', to: 'disputed', actors: ['user'], guard: 'isDispatchParty', reversible: false,
    note: 'Either party escalates.' },

  // ── res_alerts (safety — the most conservative machine here) ─────────────
  { entity: 'res_alerts', from: 'active', to: 'responded', actors: ['system'], guard: null, reversible: false,
    note: 'A responder committed. Set by trigger when res_alert_responders gains a row.' },
  { entity: 'res_alerts', from: 'active', to: 'resolved', actors: ['user'], guard: 'isAlertOwner', reversible: true,
    note: 'Raiser stands the alert down.' },
  { entity: 'res_alerts', from: 'responded', to: 'resolved', actors: ['user'], guard: 'isAlertParty', reversible: true,
    note: 'Responder or raiser closes it out.' },
  { entity: 'res_alerts', from: 'active', to: 'false_alarm', actors: ['user'], guard: 'isAlertOwner', reversible: true,
    note: 'Raiser retracts.' },
  { entity: 'res_alerts', from: 'active', to: 'auto_closed', actors: ['job'], guard: 'notCritical', reversible: true,
    note: 'Timed out with no responder. CRITICAL alerts are excluded by the guard and escalate to a human instead — the cost of silently closing a real emergency is not symmetric.' },

  // ── res_utility_tokens ───────────────────────────────────────────────────
  { entity: 'res_utility_tokens', from: 'available', to: 'claimed', actors: ['user'], guard: null, reversible: true,
    note: 'A neighbour claims it. Coordination signal only — no money moves (CONTRACT.md §6).' },
  { entity: 'res_utility_tokens', from: 'claimed', to: 'available', actors: ['job', 'user'], guard: null, reversible: true,
    note: 'Uncollected past the hold window, or the claimer released it.' },

  // ── res_tool_library ─────────────────────────────────────────────────────
  { entity: 'res_tool_library', from: 'available', to: 'rented', actors: ['user'], guard: null, reversible: true,
    note: 'Borrower takes the tool.' },
  { entity: 'res_tool_library', from: 'rented', to: 'overdue', actors: ['job'], guard: null, reversible: true,
    note: 'Past rented_until. Both parties nudged. No late fee is ever computed (CONTRACT.md §6).' },
  { entity: 'res_tool_library', from: 'rented', to: 'available', actors: ['user'], guard: 'isToolOwner', reversible: true,
    note: 'Owner confirms the tool came back.' },
  { entity: 'res_tool_library', from: 'overdue', to: 'available', actors: ['user'], guard: 'isToolOwner', reversible: true,
    note: 'Returned late.' },

  // ── res_community_disputes ───────────────────────────────────────────────
  { entity: 'res_community_disputes', from: 'pending', to: 'mediating', actors: ['user'], guard: 'isDisputeParty', reversible: true,
    note: 'A mediator picks it up.' },
  { entity: 'res_community_disputes', from: 'mediating', to: 'resolved', actors: ['user'], guard: 'isDisputeParty', reversible: false,
    note: 'Outcome recorded.' },
  { entity: 'res_community_disputes', from: 'pending', to: 'escalated', actors: ['job'], guard: null, reversible: true,
    note: 'Day 7 with no mediator. Propose tier — a human sees it before it moves.' },
  { entity: 'res_community_disputes', from: 'escalated', to: 'stale_closed', actors: ['job'], guard: null, reversible: true,
    note: 'Day 21, still nothing. Closed with both parties notified, reopenable.' },

  // ── res_group_buys (status only; no money — CONTRACT.md §6) ──────────────
  { entity: 'res_group_buys', from: 'open', to: 'threshold_met', actors: ['job', 'system'], guard: null, reversible: true,
    note: 'Pledges reached target_quantity.' },
  { entity: 'res_group_buys', from: 'open', to: 'expired_short', actors: ['job'], guard: null, reversible: true,
    note: 'Deadline passed under target. Pledgers notified it will not proceed.' },
  { entity: 'res_group_buys', from: 'threshold_met', to: 'completed', actors: ['user'], guard: 'isOrganizer', reversible: false,
    note: 'Organiser confirms the buy happened.' },
  { entity: 'res_group_buys', from: 'open', to: 'cancelled', actors: ['user'], guard: 'isOrganizer', reversible: false,
    note: 'Organiser calls it off.' },

  // ── res_market_items ─────────────────────────────────────────────────────
  { entity: 'res_market_items', from: 'available', to: 'pending', actors: ['user'], guard: 'isItemOwner', reversible: true,
    note: 'Buyer lined up.' },
  { entity: 'res_market_items', from: 'pending', to: 'gone', actors: ['user'], guard: 'isItemOwner', reversible: true,
    note: 'Sold or given away.' },
  { entity: 'res_market_items', from: 'pending', to: 'available', actors: ['user', 'job'], guard: null, reversible: true,
    note: 'Buyer fell through, or the pending hold timed out.' },
  { entity: 'res_market_items', from: 'available', to: 'expired', actors: ['job'], guard: null, reversible: true,
    note: 'Untouched past the staleness window.' },

  // ── res_lost_found ───────────────────────────────────────────────────────
  { entity: 'res_lost_found', from: 'open', to: 'reunited', actors: ['user'], guard: 'isPostOwner', reversible: true,
    note: 'Found its way home.' },
  { entity: 'res_lost_found', from: 'open', to: 'stale_archived', actors: ['job'], guard: null, reversible: true,
    note: 'Open past the window. Archived, not deleted — a pet post may matter months later.' },

  // ── res_care_circle (welfare — escalates, never closes itself) ───────────
  { entity: 'res_care_circle', from: 'active', to: 'overdue', actors: ['job'], guard: null, reversible: true,
    note: 'last_ok_at older than the cadence. Carer notified.' },
  { entity: 'res_care_circle', from: 'overdue', to: 'escalated', actors: ['job'], guard: null, reversible: true,
    note: 'Still nothing 24h later. The whole circle is notified. There is no auto_closed state here on purpose.' },
  { entity: 'res_care_circle', from: 'overdue', to: 'active', actors: ['user'], guard: 'isCareParty', reversible: false,
    note: 'Check-in received.' },
  { entity: 'res_care_circle', from: 'escalated', to: 'active', actors: ['user'], guard: 'isCareParty', reversible: false,
    note: 'Check-in received after escalation.' },
  { entity: 'res_care_circle', from: 'active', to: 'paused', actors: ['user'], guard: 'isCareParty', reversible: true,
    note: 'Subject away or opted out.' },
  { entity: 'res_care_circle', from: 'paused', to: 'active', actors: ['user'], guard: 'isCareParty', reversible: true,
    note: 'Check-ins resume after a pause.' },

  // ── res_faults — collective infrastructure faults ────────────────────────
  // The machine that turns individual complaints into evidence a utility can
  // act on, and then holds them to what they said. See src/utils/faults.ts.
  { entity: 'res_faults', from: 'reported', to: 'corroborated', actors: ['job'], guard: null, reversible: true,
    note: 'Neighbours are confirming, but not yet enough to send to the provider.' },
  { entity: 'res_faults', from: 'reported', to: 'escalated', actors: ['job'], guard: null, reversible: true,
    note: 'Immediate physical danger — sent without waiting for corroboration.' },
  { entity: 'res_faults', from: 'corroborated', to: 'escalated', actors: ['job'], guard: null, reversible: true,
    note: 'Evidence threshold met; the provider has been notified.' },
  { entity: 'res_faults', from: 'escalated', to: 'acknowledged', actors: ['user'], guard: 'isProviderAdmin', reversible: true,
    note: 'The provider confirms they have received it, usually with a reference.' },
  { entity: 'res_faults', from: 'acknowledged', to: 'in_progress', actors: ['user'], guard: 'isProviderAdmin', reversible: true,
    note: 'A crew is assigned or on site.' },
  { entity: 'res_faults', from: 'in_progress', to: 'resolved', actors: ['user'], guard: 'isProviderAdmin', reversible: true,
    note: 'The provider says it is fixed. A claim, not yet a fact — residents verify next.' },
  { entity: 'res_faults', from: 'escalated', to: 'resolved', actors: ['user'], guard: 'isFaultParty', reversible: true,
    note: 'Fixed before anyone formally acknowledged it, which happens often.' },
  { entity: 'res_faults', from: 'corroborated', to: 'resolved', actors: ['user'], guard: 'isFaultParty', reversible: true,
    note: 'Came back on its own before it ever reached the provider.' },
  { entity: 'res_faults', from: 'resolved', to: 'verified', actors: ['job'], guard: null, reversible: true,
    note: 'Enough residents confirm it is genuinely fixed. This is what closes the loop — a provider marking a job done is a claim; the neighbours are the fact.' },
  { entity: 'res_faults', from: 'resolved', to: 'escalated', actors: ['job'], guard: null, reversible: true,
    note: 'Residents report it is still broken after a resolution claim. Reopened, and the false closure is on the record.' },
  { entity: 'res_faults', from: 'reported', to: 'rejected', actors: ['job'], guard: null, reversible: true,
    note: 'Neighbours actively dispute it. Held, not deleted — the reporter may still be right.' },
  { entity: 'res_faults', from: 'corroborated', to: 'lapsed', actors: ['job'], guard: null, reversible: true,
    note: 'Confidence decayed with nobody re-confirming; almost certainly fixed quietly.' },
  { entity: 'res_faults', from: 'reported', to: 'lapsed', actors: ['job'], guard: null, reversible: true,
    note: 'A lone report nobody ever confirmed.' },
]

/**
 * The state a row is born in. Declared rather than inferred: several machines
 * legitimately cycle back to their initial state (a care-circle check goes
 * overdue and returns to active, a listing expires and is relisted), so
 * "the state nothing transitions into" is not a reliable way to find it.
 */
export const INITIAL_STATES: Record<string, string> = {
  res_listings: 'open',
  res_room_requests: 'pending',
  res_service_dispatches: 'pending',
  res_alerts: 'active',
  res_utility_tokens: 'available',
  res_tool_library: 'available',
  res_community_disputes: 'pending',
  res_group_buys: 'open',
  res_market_items: 'available',
  res_lost_found: 'open',
  res_care_circle: 'active',
  res_faults: 'reported',
}

/** Every state an entity can be in, derived — never hand-maintained. */
export function statesOf(entity: string): string[] {
  const s = new Set<string>()
  for (const t of TRANSITIONS) {
    if (t.entity === entity) { s.add(t.from); s.add(t.to) }
  }
  return [...s].sort()
}

export function entities(): string[] {
  return [...new Set(TRANSITIONS.map(t => t.entity))].sort()
}

export function findTransition(entity: string, from: string, to: string): Transition | undefined {
  return TRANSITIONS.find(t => t.entity === entity && t.from === from && t.to === to)
}

export function canTransition(entity: string, from: string, to: string, actor: ActorKind): boolean {
  const t = findTransition(entity, from, to)
  return !!t && t.actors.includes(actor)
}

/** States no transition leads out of — a row here needs a human or stays put. */
export function terminalStates(entity: string): string[] {
  return statesOf(entity).filter(s => !TRANSITIONS.some(t => t.entity === entity && t.from === s))
}

/** States automation alone can produce. Used by the digest to explain itself. */
export function jobReachableStates(entity: string): string[] {
  return [...new Set(
    TRANSITIONS.filter(t => t.entity === entity && t.actors.includes('job')).map(t => t.to)
  )].sort()
}
