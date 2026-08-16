// Generates supabase/migrations/20260815000500_seed_transitions.sql from
// src/utils/lifecycle.ts.
//
// The point: the transition table exists in two places (TypeScript for the UI
// and tests, Postgres for res_transition()), and two hand-maintained copies of
// the same rules will diverge — usually silently, usually in the direction
// where a job is allowed to do something the UI thinks is impossible. So one
// is generated from the other, and CI fails if the checked-in file is stale.
//
//   npm run gen:transitions        # rewrite the migration
//   npm run gen:transitions -- --check   # fail if it would change (CI)

import { writeFileSync, readFileSync, existsSync } from 'node:fs'
import { TRANSITIONS, INITIAL_STATES, statesOf, entities } from '../src/utils/lifecycle'

const OUT = 'supabase/migrations/20260815000500_seed_transitions.sql'

const q = (s: string | null) => (s === null ? 'null' : `'${s.replace(/'/g, "''")}'`)

function build(): string {
  const lines: string[] = []

  lines.push('-- ═══════════════════════════════════════════════════════════════════════════')
  lines.push('-- 20260815000500_seed_transitions  ***GENERATED — DO NOT EDIT BY HAND***')
  lines.push('--')
  lines.push('-- Source: src/utils/lifecycle.ts')
  lines.push('-- Regenerate: npm run gen:transitions')
  lines.push('--')
  lines.push('-- Editing this file by hand makes TypeScript and Postgres disagree about')
  lines.push('-- what a job is allowed to do. CI runs `gen:transitions -- --check` to stop')
  lines.push('-- that happening.')
  lines.push('-- ═══════════════════════════════════════════════════════════════════════════')
  lines.push('')
  lines.push('-- Replace wholesale: the table is a projection of lifecycle.ts, so a')
  lines.push('-- transition deleted there must disappear here too.')
  lines.push('delete from public.res_transitions;')
  lines.push('')
  lines.push('insert into public.res_transitions')
  lines.push('  (entity, from_state, to_state, actors, guard, reversible, note)')
  lines.push('values')

  const rows = TRANSITIONS.map(t =>
    `  (${q(t.entity)}, ${q(t.from)}, ${q(t.to)}, ` +
    `array[${t.actors.map(a => q(a)).join(', ')}]::text[], ` +
    `${q(t.guard)}, ${t.reversible}, ${q(t.note)})`
  )
  lines.push(rows.join(',\n') + ';')
  lines.push('')

  // Initial states — res_transition() needs to know which state a row is born
  // in to validate the very first move out of it.
  lines.push('delete from public.res_initial_states;')
  lines.push('insert into public.res_initial_states (entity, state) values')
  lines.push(
    entities()
      .filter(e => INITIAL_STATES[e])
      .map(e => `  (${q(e)}, ${q(INITIAL_STATES[e])})`)
      .join(',\n') + ';'
  )
  lines.push('')

  // Widen each status check constraint to admit the states automation
  // introduces (expiring, expired, auto_expired, flagged, ...). Without this
  // the first job run would fail on a check violation.
  lines.push('-- ── Widen status check constraints to the full modelled state set ─────────')
  lines.push('do $$')
  lines.push('declare v_con text;')
  lines.push('begin')
  for (const e of entities()) {
    const states = statesOf(e)
    lines.push(`  -- ${e}`)
    lines.push(`  if to_regclass('public.${e}') is not null then`)
    lines.push(`    select conname into v_con from pg_constraint`)
    lines.push(`     where conrelid = 'public.${e}'::regclass and contype = 'c'`)
    lines.push(`       and pg_get_constraintdef(oid) ilike '%status%' limit 1;`)
    lines.push(`    if v_con is not null then`)
    lines.push(`      execute format('alter table public.${e} drop constraint %I', v_con);`)
    lines.push(`    end if;`)
    lines.push(`    alter table public.${e} add constraint ${e}_status_check`)
    lines.push(`      check (status in (${states.map(s => q(s)).join(', ')}));`)
    lines.push(`  end if;`)
  }
  lines.push('end $$;')
  lines.push('')

  return lines.join('\n')
}

const sql = build()
const check = process.argv.includes('--check')

if (check) {
  const current = existsSync(OUT) ? readFileSync(OUT, 'utf8') : ''
  if (current !== sql) {
    console.error(
      `${OUT} is out of date with src/utils/lifecycle.ts.\n` +
      'Run `npm run gen:transitions` and commit the result.'
    )
    process.exit(1)
  }
  console.log(`${OUT} is up to date (${TRANSITIONS.length} transitions).`)
} else {
  writeFileSync(OUT, sql)
  console.log(`Wrote ${OUT}: ${TRANSITIONS.length} transitions across ${entities().length} entities.`)
}
