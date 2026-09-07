// Browser smoke test — the only check here that actually renders anything.
//
// WHY THIS EXISTS. tsc proves types line up. npm test proves pure functions
// behave. npm run build proves it compiles. None of them render a single
// component or make a single request, which MAINTENANCE.md has said all
// along — so an entire class of failure ships invisibly:
//
//   * A route that throws on render and shows a blank screen.
//   * Middleware that returns 429 to a normal person. That one was real:
//     the throttle counted Next's own link prefetches against the user, so
//     four page views in a minute earned a raw JSON error blob. Every other
//     check in this repo passed while it did that.
//   * A CSP that silently blocks the map's geocoder.
//   * Anything that only breaks once JavaScript actually runs.
//
// It boots the production build, opens every route in a phone-sized
// Chromium, and fails on a bad status, an uncaught exception, a console
// error, or a page that renders almost nothing.
//
//   node scripts/smoke.mjs            # boots its own server on :3100
//   BASE_URL=http://localhost:3000 node scripts/smoke.mjs   # use a running one
//
// Needs a production build present (npm run build) when booting its own
// server, and Chromium via Playwright.

import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { setTimeout as sleep } from 'node:timers/promises'

const PORT = process.env.SMOKE_PORT || '3100'
const BASE = process.env.BASE_URL || `http://localhost:${PORT}`
const OWN_SERVER = !process.env.BASE_URL

// Guest mode reaches the dashboard without an auth record, which keeps this
// check free of credentials and safe to run anywhere. It does mean the
// landlord-only surfaces render their signed-out shape — worth knowing when
// reading a pass.
const ROUTES = [
  '/',
  '/auth',
  '/auth/onboarding',
  '/privacy',
  '/terms',
  '/dashboard',
  '/dashboard/housing',
  '/dashboard/community',
  '/dashboard/services',
  '/dashboard/business',
  '/dashboard/gossip',
  '/dashboard/messages',
  '/dashboard/profile',
  '/dashboard/trust-circle'
]

// A page whose visible text is shorter than this rendered a shell and then
// gave up. Chosen from observation: the thinnest legitimate route in this app
// renders ~230 characters; a throttled or crashed one renders ~100.
const MIN_TEXT = 150

/**
 * Console noise that is about the environment, not the app.
 *
 * In CI there is usually no reachable Supabase, and in the sandbox the egress
 * proxy blocks it outright. Failing on that would make this check report the
 * network rather than the code. Everything from the app's own origin is kept.
 */
function isEnvironmentNoise(text) {
  return /ERR_TUNNEL_CONNECTION_FAILED|ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED/.test(text)
    || /supabase\.co/.test(text)
    || /Failed to load resource.*net::/.test(text)
}

async function waitForServer(url, timeoutMs = 90_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { redirect: 'manual' })
      if (res.status > 0) return true
    } catch { /* not up yet */ }
    await sleep(500)
  }
  return false
}

let server
if (OWN_SERVER) {
  console.log(`→ starting the production build on :${PORT}`)
  server = spawn('npx', ['next', 'start', '-p', PORT], {
    stdio: 'ignore',
    env: { ...process.env, NODE_ENV: 'production' }
  })
  if (!(await waitForServer(BASE))) {
    console.error('FAILED: the server never came up. Did you run `npm run build`?')
    server.kill()
    process.exit(1)
  }
}

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined
})
// Phone-sized on purpose: this app's users are on phones, and a desktop
// viewport can hide a layout that collapses on a small screen.
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
await ctx.addCookies([{ name: 'guest-mode', value: '1', url: BASE }])

const failures = []
console.log(`→ loading ${ROUTES.length} routes in a 390x844 browser\n`)

for (const route of ROUTES) {
  const page = await ctx.newPage()
  const problems = []
  page.on('console', m => {
    if (m.type() !== 'error') return
    const text = m.text()
    if (!isEnvironmentNoise(text)) problems.push(`console: ${text.slice(0, 200)}`)
  })
  // An uncaught exception is never environment noise — it is the app.
  page.on('pageerror', e => problems.push(`uncaught: ${String(e).slice(0, 200)}`))

  let status = 0
  let chars = 0
  try {
    const resp = await page.goto(BASE + route, { waitUntil: 'networkidle', timeout: 45_000 })
    status = resp ? resp.status() : 0
    await page.waitForTimeout(700)
    chars = (await page.locator('body').innerText().catch(() => '')).trim().length
  } catch (err) {
    problems.push(`navigation: ${String(err).slice(0, 200)}`)
  }

  if (status >= 400) problems.push(`HTTP ${status}`)
  if (status && status < 400 && chars < MIN_TEXT) {
    problems.push(`rendered only ${chars} characters — blank or errored`)
  }

  const ok = problems.length === 0
  console.log(`   ${ok ? 'ok  ' : 'FAIL'}  ${String(status).padEnd(4)} ${route.padEnd(26)} ${String(chars).padStart(5)} chars`)
  for (const p of [...new Set(problems)].slice(0, 5)) console.log(`         ! ${p}`)
  if (!ok) failures.push({ route, problems: [...new Set(problems)] })

  await page.close()
}

await browser.close()
if (server) server.kill()

console.log()
if (failures.length) {
  console.log(`SMOKE TEST FAILED — ${failures.length} of ${ROUTES.length} route(s) are broken:`)
  for (const f of failures) console.log(`   ${f.route}: ${f.problems[0]}`)
  process.exit(1)
}

console.log(`SMOKE TEST PASSED — all ${ROUTES.length} routes render.`)
