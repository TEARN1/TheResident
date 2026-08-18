// expire_sponsorships — ends a paid placement when its term is up, and warns
// before it happens.
//
// The reminder half is the part that earns money. A placement that lapses
// quietly is a customer who stops paying without ever being asked to renew —
// you find out weeks later, if at all. So this job's real job is to put a
// renewal conversation in front of a human while there is still time to have
// it.
//
// Note what this job CANNOT do: it can end a placement, never start one.
// Activating a sponsorship is an operator action gated by isSponsorshipAdmin,
// because payment lands off-platform and a person has to confirm it. That
// asymmetry means no bug in here can ever give a business free advertising.

import type { Job, JobContext, JobResult } from '../lib/types.ts'
import { Guard } from '../lib/guard.ts'

interface SponsorshipRow {
  id: string
  sponsor_user_id: string
  surface: string
  suburb: string
  category: string | null
  slot: number
  ends_at: string
  subject_table: string
  subject_id: string
}

const DAY_MS = 86_400_000

export const expireSponsorships: Job = {
  name: 'expire_sponsorships',
  allowlist: ['res_sponsorships'],

  async run(ctx: JobContext): Promise<JobResult> {
    const guard = new Guard(ctx.db, {
      jobName: ctx.jobName,
      allowlist: expireSponsorships.allowlist,
      correlation: ctx.correlation,
      maxRows: ctx.maxRows,
      dryRun: ctx.dryRun,
    })

    const noticeDays = await loadNoticeDays(ctx)
    const now = Date.now()
    const horizon = new Date(now + noticeDays * DAY_MS).toISOString()

    // Everything active that ends within the notice window — which covers both
    // the ones already past their end and the ones about to be.
    const { data, error } = await ctx.db
      .from('res_sponsorships')
      .select('id, sponsor_user_id, surface, suburb, category, slot, ends_at, subject_table, subject_id')
      .eq('status', 'active')
      .is('archived_at', null)
      .lte('ends_at', horizon)
      .order('ends_at', { ascending: true })
      .limit(ctx.batchSize)

    if (error) throw new Error(`select sponsorships: ${error.message}`)

    const rows = (data ?? []) as SponsorshipRow[]
    const wouldAffect: Array<Record<string, unknown>> = []
    let expired = 0
    let reminded = 0

    for (const s of rows) {
      const endsAt = new Date(s.ends_at).getTime()
      const where = s.category ? `${s.suburb} · ${s.category}` : s.suburb

      if (endsAt <= now) {
        if (ctx.dryRun) {
          wouldAffect.push({ id: s.id, action: 'expire', suburb: s.suburb, slot: s.slot, ends_at: s.ends_at })
        } else {
          await guard.transition('res_sponsorships', s.id, 'expired',
            `term ended ${s.ends_at}; slot ${s.slot} in ${where} is free again`)

          // Tell the sponsor plainly. They paid for something that has now
          // stopped, and finding that out from the app is far better than
          // noticing their listing quietly dropped.
          await guard.notify(
            s.sponsor_user_id,
            'res_status',
            'Your sponsored placement has ended',
            `Your slot in ${where} finished on ${new Date(s.ends_at).toLocaleDateString('en-ZA')}. ` +
            `Your business is still listed as normal — get in touch to renew the top spot.`,
            `sponsorship:${s.id}:expired`,
            { sponsorship_id: s.id, surface: s.surface },
          )
        }
        expired++
        continue
      }

      // Still running, but inside the notice window.
      const daysLeft = Math.ceil((endsAt - now) / DAY_MS)
      if (ctx.dryRun) {
        wouldAffect.push({ id: s.id, action: 'renewal_reminder', suburb: s.suburb, days_left: daysLeft })
      } else {
        // Effect-keyed on the exact end date, so renewing to a new term
        // produces a fresh reminder while a retry today does not.
        const sent = await guard.notify(
          s.sponsor_user_id,
          'res_status',
          'Your sponsored placement ends soon',
          `Your slot in ${where} ends in ${daysLeft} day${daysLeft === 1 ? '' : 's'}. ` +
          `Let us know if you would like to keep it.`,
          `sponsorship:${s.id}:renewal:${s.ends_at}`,
          { sponsorship_id: s.id, days_left: daysLeft },
        )
        if (sent) reminded++
      }
      if (ctx.dryRun) reminded++
    }

    ctx.log(`${rows.length} placements in window: ${expired} expired, ${reminded} reminders`)

    return {
      rowsScanned: rows.length,
      rowsAffected: guard.rowsAffected,
      wouldAffect: ctx.dryRun ? wouldAffect : undefined,
      detail: { expired, reminded, noticeDays },
    }
  },
}

async function loadNoticeDays(ctx: JobContext): Promise<number> {
  const { data } = await ctx.db
    .from('res_policies')
    .select('params, enabled')
    .eq('key', 'sponsorship.renewal_notice_days')
    .maybeSingle()

  if (!data?.enabled) return 7
  const params = data.params as { days?: number } | null
  return params?.days ?? 7
}
