// RPC-backed thunks.
//
// Rules that must not be forgeable by a client — rate limits, eligibility,
// counters, reputation, fan-out — live in SQL (see resident_schema.sql §7-§9).
// These thunks are thin: they call the RPC, surface a real error, and refetch
// the affected slice. No optimistic arithmetic, which is what caused the
// double-booked-seat bug.

import { createAsyncThunk } from '@reduxjs/toolkit'
import { supabase } from '../utils/supabase'
import { addNotification, fetchSupabaseData, toUUID } from './index'

/** Turns a Postgres exception into something a human can read. */
export const humanizeDbError = (message: string): string => {
  const known: Record<string, string> = {
    verification_required: 'Only verified neighbours can respond to alerts. Get verified on The Gruvs first.',
    not_eligible: 'You can only review something you have actually used.',
    invite_required: 'This community is private — you need an invite code.',
    admin_required: 'Only a community admin can do that.',
    founder_required: 'Only the founder can do that.',
    invalid_code: 'That invite code is not valid.',
    code_expired: 'That invite code has expired.',
    code_used_up: 'That invite code has already been used.',
    code_revoked: 'That invite code was revoked.',
    not_household_member: 'Only members of this household can manage its chores.',
    tool_unavailable: 'Someone else borrowed it first.',
    voucher_unavailable: 'Someone else claimed that voucher first.',
    no_seats_available: 'That lift is full.',
    'no seats available': 'That lift is full — join the waitlist instead.',
    no_booking_to_cancel: 'You do not have a seat on that lift.',
    not_your_rental: 'That is not your rental.',
    not_your_tool: 'That is not your tool.',
    not_your_service: 'That is not your business.',
    proof_required: 'Attach proof of the work before marking it complete.',
    rate_limit_exceeded: 'You are doing that too often. Try again shortly.'
  }

  for (const [key, friendly] of Object.entries(known)) {
    if (message.includes(key)) return friendly
  }
  return message
}

/**
 * Every RPC goes through here so failures are always surfaced to the user
 * rather than swallowed — the original sin of this codebase.
 */
const callRpc = async <T = unknown>(
  fn: string,
  args: Record<string, unknown>,
  dispatch: (action: unknown) => unknown,
  { refetch = true, successTitle, successBody }: {
    refetch?: boolean
    successTitle?: string
    successBody?: string
  } = {}
): Promise<T | null> => {
  if (!supabase) {
    dispatch(addNotification({
      title: 'Offline',
      message: 'Not connected to the database — that change was not saved.',
      read: false
    }))
    return null
  }

  const { data, error } = await supabase.rpc(fn, args)

  if (error) {
    dispatch(addNotification({
      title: 'That did not work',
      message: humanizeDbError(error.message),
      read: false
    }))
    throw new Error(error.message)
  }

  if (successTitle) {
    dispatch(addNotification({ title: successTitle, message: successBody || '', read: false }))
  }
  if (refetch) {
    dispatch(fetchSupabaseData())
  }
  return data as T
}

// ── Safety (#1, #2, #3) ───────────────────────────────────────────────────────

export const raiseAlert = createAsyncThunk(
  'safety/raiseAlert',
  async (
    args: {
      kind: 'panic' | 'incident' | 'suspicious' | 'safe_walk'
      title: string
      description?: string
      lat?: number
      lon?: number
      severity?: 'low' | 'medium' | 'high' | 'critical'
      communityId?: string | null
      suburb?: string
      city?: string
    },
    { dispatch }
  ) =>
    callRpc<string>('res_raise_alert', {
      p_kind: args.kind,
      p_title: args.title,
      p_description: args.description ?? null,
      p_lat: args.lat ?? null,
      p_lon: args.lon ?? null,
      p_severity: args.severity ?? 'medium',
      p_community: args.communityId ?? null,
      p_suburb: args.suburb ?? null,
      p_city: args.city ?? null
    }, dispatch, {
      successTitle: args.kind === 'panic' ? 'Alert sent' : 'Reported',
      successBody: 'Verified neighbours nearby have been notified.'
    })
)

export const respondToAlert = createAsyncThunk(
  'safety/respondToAlert',
  async (args: { alertId: string; status: 'coming' | 'arrived' | 'stood_down'; note?: string }, { dispatch }) =>
    callRpc('res_respond_to_alert', {
      p_alert_id: toUUID(args.alertId),
      p_status: args.status,
      p_note: args.note ?? null
    }, dispatch, { successTitle: 'They know you are coming' })
)

export const resolveAlertRpc = createAsyncThunk(
  'safety/resolveAlert',
  async (args: { alertId: string; falseAlarm?: boolean }, { dispatch }) =>
    callRpc('res_resolve_alert', {
      p_alert_id: toUUID(args.alertId),
      p_false_alarm: args.falseAlarm ?? false
    }, dispatch, { successTitle: 'Alert closed' })
)

export const reportStatus = createAsyncThunk(
  'safety/reportStatus',
  async (
    args: { kind: 'power' | 'water' | 'network'; status: 'up' | 'down' | 'stage'; suburb: string; detail?: string; communityId?: string | null },
    { dispatch }
  ) =>
    callRpc('res_report_status', {
      p_kind: args.kind,
      p_status: args.status,
      p_suburb: args.suburb,
      p_detail: args.detail ?? null,
      p_community: args.communityId ?? null,
      p_lat: null,
      p_lon: null
    }, dispatch, { successTitle: 'Thanks — reported' })
)

// ── Community (#11–#15) ───────────────────────────────────────────────────────

export const createCommunity = createAsyncThunk(
  'community/create',
  async (
    args: { name: string; kind: 'street' | 'block' | 'complex' | 'estate' | 'suburb'; suburb?: string; city?: string; lat?: number; lon?: number; radiusM?: number; isPrivate?: boolean },
    { dispatch }
  ) =>
    callRpc<string>('res_create_community', {
      p_name: args.name,
      p_kind: args.kind,
      p_suburb: args.suburb ?? null,
      p_city: args.city ?? null,
      p_lat: args.lat ?? null,
      p_lon: args.lon ?? null,
      p_radius_m: args.radiusM ?? null,
      p_private: args.isPrivate ?? false
    }, dispatch, { successTitle: 'Community created', successBody: 'You are its founder.' })
)

export const joinCommunity = createAsyncThunk(
  'community/join',
  async (communityId: string, { dispatch }) =>
    callRpc('res_join_community', { p_community: toUUID(communityId) }, dispatch, {
      successTitle: 'Joined'
    })
)

export const leaveCommunity = createAsyncThunk(
  'community/leave',
  async (communityId: string, { dispatch }) =>
    callRpc('res_leave_community', { p_community: toUUID(communityId) }, dispatch, {
      successTitle: 'You left the community'
    })
)

export const redeemInvite = createAsyncThunk(
  'community/redeemInvite',
  async (code: string, { dispatch }) =>
    callRpc<string>('res_redeem_invite', { p_code: code.trim().toUpperCase() }, dispatch, {
      successTitle: 'Invite accepted'
    })
)

export const createInvite = createAsyncThunk(
  'community/createInvite',
  async (args: { communityId: string; maxUses?: number }, { dispatch }) =>
    callRpc<string>('res_create_invite', {
      p_community: toUUID(args.communityId),
      p_max_uses: args.maxUses ?? 1,
      p_expires_at: null
    }, dispatch, { refetch: false })
)

// ── Trust (#20, #23) ──────────────────────────────────────────────────────────

export const submitReview = createAsyncThunk(
  'trust/submitReview',
  async (
    args: { subjectType: 'service' | 'tool' | 'listing' | 'skill' | 'user'; subjectId: string; rating: number; body?: string },
    { dispatch }
  ) =>
    callRpc('res_submit_review', {
      p_subject_type: args.subjectType,
      p_subject_id: toUUID(args.subjectId),
      p_rating: args.rating,
      p_body: args.body ?? null
    }, dispatch, { successTitle: 'Review posted', successBody: 'Thanks — it helps your neighbours.' })
)

export const reportContent = createAsyncThunk(
  'trust/reportContent',
  async (
    args: { subjectType: string; subjectId: string; reason: 'spam' | 'scam' | 'abuse' | 'unsafe' | 'wrong_info' | 'other'; detail?: string },
    { dispatch }
  ) =>
    callRpc('res_report_content', {
      p_subject_type: args.subjectType,
      p_subject_id: toUUID(args.subjectId),
      p_reason: args.reason,
      p_detail: args.detail ?? null
    }, dispatch, {
      successTitle: 'Reported',
      successBody: 'It is hidden from you now and will be reviewed.'
    })
)

export const blockUser = createAsyncThunk(
  'trust/blockUser',
  async (userId: string, { dispatch }) =>
    callRpc('res_block_user', { p_blocked: toUUID(userId) }, dispatch, {
      successTitle: 'Blocked',
      successBody: 'You will not see them, and they cannot message you.'
    })
)

// ── Rooms & household (#34, #35, #36) ─────────────────────────────────────────

export const approveRequest = createAsyncThunk(
  'requests/approve',
  async (requestId: string, { dispatch }) =>
    callRpc('res_approve_request', { p_request: toUUID(requestId) }, dispatch, {
      successTitle: 'Approved',
      successBody: 'Other applicants were told, and the room is now marked taken.'
    })
)

export const rejectRequest = createAsyncThunk(
  'requests/reject',
  async (requestId: string, { dispatch }) =>
    callRpc('res_reject_request', { p_request: toUUID(requestId) }, dispatch, {
      successTitle: 'Declined'
    })
)

export const waitlistRequest = createAsyncThunk(
  'requests/waitlist',
  async (requestId: string, { dispatch }) =>
    callRpc('res_waitlist_request', { p_request: toUUID(requestId) }, dispatch, {
      successTitle: 'Waitlisted',
      successBody: 'The applicant has been told they are on the waitlist.'
    })
)

export const saveRequest = createAsyncThunk(
  'requests/save',
  async (requestId: string, { dispatch }) =>
    callRpc('res_save_request', { p_request: toUUID(requestId) }, dispatch, {
      successTitle: 'Saved for later',
      successBody: 'A private bookmark — the applicant is not notified.'
    })
)

export const rotateChores = createAsyncThunk(
  'chores/rotate',
  async (args: { listingId: string; tasks: string[]; days: string[] }, { dispatch }) =>
    callRpc<number>('res_rotate_chores', {
      p_listing: toUUID(args.listingId),
      p_tasks: args.tasks,
      p_days: args.days
    }, dispatch, {
      successTitle: 'Chores rotated',
      successBody: 'Everyone in the household has been assigned this week.'
    })
)

export const completeChore = createAsyncThunk(
  'chores/complete',
  async (choreId: string, { dispatch }) =>
    callRpc('res_complete_chore', { p_chore: toUUID(choreId) }, dispatch, {
      successTitle: 'Nice one',
      successBody: 'Chore done — reputation awarded.'
    })
)

// ── Tools (#38, #39) ──────────────────────────────────────────────────────────

export const borrowTool = createAsyncThunk(
  'tools/borrow',
  async (args: { toolId: string; until: string }, { dispatch }) =>
    callRpc('res_borrow_tool', {
      p_tool: toUUID(args.toolId),
      p_until: args.until
    }, dispatch, {
      successTitle: 'Borrowed',
      successBody: 'Settle any deposit with the owner directly — the app never handles money.'
    })
)

export const requestToolReturn = createAsyncThunk(
  'tools/requestReturn',
  async (toolId: string, { dispatch }) =>
    callRpc('res_request_tool_return', { p_tool: toUUID(toolId) }, dispatch, {
      successTitle: 'Marked as returned',
      successBody: 'Waiting for the owner to confirm.'
    })
)

export const confirmToolReturn = createAsyncThunk(
  'tools/confirmReturn',
  async (toolId: string, { dispatch }) =>
    callRpc('res_confirm_tool_return', { p_tool: toUUID(toolId) }, dispatch, {
      successTitle: 'Return confirmed'
    })
)

// ── Vouchers, dispatches, lifts, lost & found ─────────────────────────────────

export const claimVoucher = createAsyncThunk(
  'utilities/claimVoucher',
  async (tokenId: string, { dispatch }) =>
    callRpc('res_claim_voucher', { p_token: toUUID(tokenId) }, dispatch, {
      successTitle: 'Voucher claimed',
      successBody: 'Arrange the handover directly — no money moves through the app.'
    })
)

export const completeDispatch = createAsyncThunk(
  'dispatches/complete',
  async (args: { dispatchId: string; proofUrl: string }, { dispatch }) =>
    callRpc('res_complete_dispatch', {
      p_dispatch: toUUID(args.dispatchId),
      p_proof_url: args.proofUrl
    }, dispatch, { successTitle: 'Job completed' })
)

export const joinWaitlist = createAsyncThunk(
  'lifts/joinWaitlist',
  async (liftId: string, { dispatch }) =>
    callRpc('res_join_waitlist', { p_lift_id: toUUID(liftId) }, dispatch, {
      successTitle: 'On the waitlist',
      successBody: 'You get the next seat that opens up.'
    })
)

export const cancelSeat = createAsyncThunk(
  'lifts/cancelSeat',
  async (liftId: string, { dispatch }) =>
    callRpc<number>('res_release_seat', { p_lift_id: toUUID(liftId) }, dispatch, {
      successTitle: 'Seat cancelled',
      successBody: 'If anyone was waiting, the seat went to them.'
    })
)

export const reuniteLostFound = createAsyncThunk(
  'lostFound/reunite',
  async (id: string, { dispatch }) =>
    callRpc('res_reunite_lost_found', { p_id: toUUID(id) }, dispatch, {
      successTitle: 'Reunited',
      successBody: 'Reputation awarded — thank you.'
    })
)

export const careCheckIn = createAsyncThunk(
  'care/checkIn',
  async (careId: string, { dispatch }) =>
    callRpc('res_care_check_in', { p_care_id: toUUID(careId) }, dispatch, {
      successTitle: 'Checked in'
    })
)
