// daily_digest — the one message that makes a self-managing app trustworthy.
//
// Three sections, always, in this order:
//
//   what I did             — so nothing happens invisibly
//   what I could not decide — so the queue is a queue, not a black hole
//   what looks wrong        — so you learn it here, not from a resident
//
// The middle section is the one that matters. An autonomous system that only
// reports its successes is indistinguishable from one that has quietly stopped
// doing anything, and the honest admission "I did not know what to do with
// these three things" is what makes the other two sections believable.
//
// It is deliberately short. A digest nobody finishes reading is a digest that
// does not exist, so counts are grouped, the list is capped, and a quiet day
// produces a genuinely quiet message.

import type { Job, JobContext, JobResult } from '../lib/types.ts'
import { Guard } from '../lib/guard.ts'

interface Snapshot {
  generated_at: string
  did: Record<string, number>
  needs_you: Record<string, number>
  looks_wrong: Array<{ kind: string; severity: number; message: string; open_since: string }>
}

/** Turns 'fault.escalate' into 'faults escalated'. */
const ACTION_LABELS: Record<string, string> = {
  'traffic_report.expire': 'stale road hazards cleared',
  'fault.escalate': 'faults sent to providers',
  'fault.rescore': 'fault reports re-counted',
  'fault.false_closure': 'faults reopened after a false "fixed"',
  'res_faults.corroborated': 'faults gaining confirmations',
  'res_faults.verified': 'faults confirmed fixed by residents',
  'res_faults.lapsed': 'faults closed as quietly fixed',
  'res_sponsorships.expired': 'sponsorships ended',
  'incident.open': 'problems noticed',
}

const NEEDS_YOU_LABELS: Record<string, string> = {
  faults_awaiting_provider: 'faults waiting on a provider to acknowledge',
  faults_needing_more_confirmations: 'faults short of confirmations to escalate',
  sponsorships_pending_payment: 'sponsorships sold but not yet paid',
  sponsorships_ending_this_week: 'sponsorships ending this week',
  disputes_unmediated: 'disputes with no mediator',
}

export const dailyDigest: Job = {
  name: 'daily_digest',
  allowlist: [],   // sends a notification; changes no domain data

  async run(ctx: JobContext): Promise<JobResult> {
    const guard = new Guard(ctx.db, {
      jobName: ctx.jobName,
      allowlist: dailyDigest.allowlist,
      correlation: ctx.correlation,
      maxRows: ctx.maxRows,
      dryRun: ctx.dryRun,
    })

    const { data, error } = await ctx.db.rpc('res_daily_snapshot', { p_since: '24 hours' })
    if (error) throw new Error(`snapshot: ${error.message}`)

    const snap = data as Snapshot
    const recipients = await loadRecipients(ctx)

    const body = format(snap)
    const severity1 = snap.looks_wrong.filter(w => w.severity === 1)
    const title = severity1.length > 0
      ? `Needs attention now: ${severity1[0].message}`
      : 'Your neighbourhood, yesterday'

    if (ctx.dryRun) {
      ctx.log('digest preview', { title, body, recipients: recipients.length })
      return {
        rowsScanned: 1, rowsAffected: 0,
        wouldAffect: [{ title, body, recipients: recipients.length }],
      }
    }

    if (recipients.length === 0) {
      // Not a failure: nobody is configured to receive it yet. Say so plainly
      // in the run record rather than reporting a silent success.
      ctx.log('no digest recipients configured — set the automation.digest_recipients policy')
      return { rowsScanned: 1, rowsAffected: 0, detail: { skipped: 'no recipients' } }
    }

    // Keyed by date, so a retry today never sends twice but tomorrow still does.
    const day = new Date().toISOString().slice(0, 10)
    let sent = 0
    for (const userId of recipients) {
      const ok = await guard.notify(
        userId, 'res_status', title, body, `digest:${day}:${userId}`,
        { severity: severity1.length > 0 ? 1 : 4 })
      if (ok) sent++
    }

    return {
      rowsScanned: 1,
      rowsAffected: sent,
      detail: { sent, severity1: severity1.length, day },
    }
  },
}

/**
 * Builds the message.
 *
 * Written as prose rather than a table because it is read on a phone, often on
 * a slow connection, often in a notification preview where only the first line
 * survives — so the first line has to carry the most important thing.
 */
function format(snap: Snapshot): string {
  const parts: string[] = []

  // ── What looks wrong goes FIRST when it exists ──────────────────────────
  // Burying a severity-1 problem under yesterday's tidy-up statistics would be
  // an odd definition of a warning.
  if (snap.looks_wrong.length > 0) {
    const lines = snap.looks_wrong
      .slice(0, 5)
      .map(w => `• ${w.message}${w.severity === 1 ? ' (urgent)' : ''}`)
    parts.push(`Looks wrong:\n${lines.join('\n')}`)
  }

  // ── What I did ──────────────────────────────────────────────────────────
  const didEntries = Object.entries(snap.did).filter(([, n]) => n > 0)
  if (didEntries.length === 0) {
    parts.push('I made no changes yesterday.')
  } else {
    const lines = didEntries
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([action, n]) => `• ${n} ${ACTION_LABELS[action] ?? action.replace(/[._]/g, ' ')}`)
    parts.push(`What I did:\n${lines.join('\n')}`)
  }

  // ── What I could not decide ─────────────────────────────────────────────
  const pending = Object.entries(snap.needs_you).filter(([, n]) => n > 0)
  if (pending.length > 0) {
    const lines = pending.map(([k, n]) => `• ${n} ${NEEDS_YOU_LABELS[k] ?? k.replace(/_/g, ' ')}`)
    parts.push(`Needs you:\n${lines.join('\n')}`)
  } else {
    parts.push('Nothing is waiting on you.')
  }

  return parts.join('\n\n')
}

/**
 * Who gets it. A policy row rather than a hardcoded id, so adding a second
 * person later is a config change and not a deploy.
 */
async function loadRecipients(ctx: JobContext): Promise<string[]> {
  const { data } = await ctx.db
    .from('res_policies')
    .select('params, enabled')
    .eq('key', 'automation.digest_recipients')
    .maybeSingle()

  if (!data?.enabled) return []
  const params = data.params as { user_ids?: string[] } | null
  return (params?.user_ids ?? []).filter(Boolean)
}
