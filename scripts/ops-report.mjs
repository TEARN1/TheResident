// Reads the live ops tables (section 49) and prints a report, for the two
// scheduled workflows that watch the app from OUTSIDE the database.
//
//   node scripts/ops-report.mjs heartbeat   # exit 1 if the nightly run stopped
//   node scripts/ops-report.mjs digest      # weekly markdown digest on stdout
//
// WHY OUTSIDE. Every in-database check runs on pg_cron. If pg_cron stops, or
// the project is paused, every one of them goes quiet at once, and quiet looks
// exactly like healthy. Only something that does not live in Supabase can
// notice Supabase has stopped.
//
// Needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. The service role reads
// tables no client can; it lives only in GitHub Actions secrets.

const mode = process.argv[2]
const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !key) {
  console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (GitHub → Settings → Secrets).')
  process.exit(2)
}

const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }

async function rest(path, init = {}) {
  const res = await fetch(`${url}/rest/v1/${path}`, { ...init, headers, signal: AbortSignal.timeout(20000) })
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status} ${await res.text()}`)
  return res.json()
}

const HOUR = 60 * 60 * 1000
const ago = ts => (ts ? `${Math.round((Date.now() - Date.parse(ts)) / HOUR)}h ago` : 'never')

async function heartbeat() {
  const hb = await rest('rpc/res_ops_heartbeat', { method: 'POST', body: '{}' })
  const problems = []
  const last = hb.last_nightly_run
  if (!last || Date.now() - Date.parse(last) > 26 * HOUR) {
    problems.push(`The nightly maintenance run last ran ${ago(last)}. pg_cron may have stopped, or the project may be paused.`)
  }
  if (hb.global_stop) problems.push('The global stop is ON: every automated job is switched off.')
  if (hb.open_critical > 0) problems.push(`${hb.open_critical} critical finding(s) are unacknowledged. See the Ops Console.`)

  if (problems.length) {
    console.log(problems.map(p => `- ${p}`).join('\n'))
    process.exit(1)
  }
  console.log(`OK: nightly run ${ago(last)}, no open critical findings.`)
}

async function digest() {
  const [jobs, findings, metrics, runs] = await Promise.all([
    rest('res_automation_jobs?select=key,description,enabled,disabled_reason,schedule&order=key'),
    rest('res_ops_findings?select=severity,summary,source,occurrences,last_seen&acknowledged_at=is.null&order=last_seen.desc&limit=50'),
    rest('res_metrics_daily?select=*&order=day.desc&limit=14'),
    rest(`res_maintenance_runs?select=task,ok,affected,error,ran_at&ran_at=gte.${new Date(Date.now() - 7 * 24 * HOUR).toISOString()}&limit=2000`)
  ])

  const out = []
  const sev = { critical: 0, warn: 1, info: 2 }
  findings.sort((a, b) => sev[a.severity] - sev[b.severity])

  out.push('## 1. Needs you')
  const off = jobs.filter(j => !j.enabled)
  if (!findings.length && !off.length) out.push('Nothing. No open findings, and every job is on.')
  for (const f of findings) {
    out.push(`- **${f.severity}** — ${f.summary} _(${f.source}${f.occurrences > 1 ? `, ${f.occurrences}×` : ''}, last ${ago(f.last_seen)})_`)
  }
  for (const j of off) out.push(`- Job **off**: ${j.key === '*' ? 'GLOBAL STOP' : j.description} — ${j.disabled_reason || 'no reason recorded'}`)

  out.push('', '## 2. What the system did this week')
  const byTask = new Map()
  for (const r of runs) {
    const t = byTask.get(r.task) || { runs: 0, fails: 0, changed: 0 }
    t.runs++
    if (!r.ok) t.fails++
    t.changed += r.affected || 0
    byTask.set(r.task, t)
  }
  out.push('| Job | Runs | Failures | Rows changed |', '|---|---|---|---|')
  for (const j of jobs.filter(j => j.schedule === 'nightly' && j.key !== '*')) {
    const t = byTask.get(j.key) || { runs: 0, fails: 0, changed: 0 }
    out.push(`| ${j.description} | ${t.runs} | ${t.fails} | ${t.changed} |`)
  }

  out.push('', '## 3. Proof the monitors are alive')
  const lastRun = runs.map(r => r.ran_at).sort().at(-1)
  out.push(`- Nightly run: last ${ago(lastRun)}, ${runs.length} task runs in 7 days.`)
  out.push(`- Metrics rollup: ${metrics.length ? `latest day ${metrics[0].day}` : '**no metrics recorded**'}.`)
  out.push('- Hourly watchdog: this digest ran, so GitHub Actions is running.')

  out.push('', '## 4. Trends (last 14 days)')
  if (metrics.length) {
    const [now, then] = [metrics[0], metrics.at(-1)]
    out.push('| Metric | Now | 14 days ago |', '|---|---|---|')
    for (const [label, k] of [
      ['Residents', 'residents_total'], ['Open listings', 'listings_open'],
      ['Alerts raised (day)', 'alerts_raised'], ['Unanswered alerts (day)', 'alerts_unanswered'],
      ['Median first response (s)', 'median_first_response_secs'], ['Open reports', 'reports_open'],
      ['Crashes (day)', 'client_errors']
    ]) out.push(`| ${label} | ${now[k] ?? '—'} | ${then[k] ?? '—'} |`)
  } else {
    out.push('No metrics yet.')
  }

  out.push('', '---', '_Generated by `.github/workflows/ops-digest.yml` from the live ops tables. Acknowledge findings in the Ops Console (Profile page, admins only)._')
  console.log(out.join('\n'))
}

try {
  if (mode === 'heartbeat') await heartbeat()
  else if (mode === 'digest') await digest()
  else { console.error('usage: ops-report.mjs heartbeat|digest'); process.exit(2) }
} catch (e) {
  console.log(`- Could not reach the ops tables: ${e.message}`)
  process.exit(1)
}
