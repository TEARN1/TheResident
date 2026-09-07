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
import { mkdir, writeFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { setTimeout as sleep } from 'node:timers/promises'

const PORT = process.env.SMOKE_PORT || '3100'
const BASE = process.env.BASE_URL || `http://localhost:${PORT}`
const OWN_SERVER = !process.env.BASE_URL

// If we are supposed to start our own server, the port must be free. A
// leftover `next start` from an earlier session answers on it, `next start`
// then fails to bind, waitForServer sees a healthy response, and the whole
// suite silently tests a STALE BUILD — reporting green on code that is not
// the code in the working tree, or red on a bug that was already fixed.
// That has now happened twice (ports 3000 and 3100), and both times it cost
// more than the check costs.
if (OWN_SERVER) {
  const alreadyUp = await fetch(BASE, { redirect: 'manual' })
    .then(() => true).catch(() => false)
  if (alreadyUp) {
    console.error(`\nSomething is already listening on ${BASE}.`)
    console.error('Refusing to run: this suite would test that server\'s build,')
    console.error('not the one just built here. Stop it first, e.g.')
    console.error(`  kill $(ss -lptn 'sport = :${PORT}' | grep -oP 'pid=\\K[0-9]+')`)
    console.error('or set BASE_URL=... to test it deliberately.')
    process.exit(1)
  }
}

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

// --shots also saves a full-page PNG of every route. The smoke test proves a
// route RENDERS; it cannot tell you the layout is a mess, that a heading is
// clipped, or that a panel overflows its card on a narrow phone. Those are
// the failures a founder finds by looking, and looking at fourteen routes on
// a real handset is a chore that quietly stops happening. This makes it one
// command.
const SHOTS = process.argv.includes('--shots')
const SHOT_DIR = process.env.SHOT_DIR || 'screenshots'
if (SHOTS) {
  await mkdir(SHOT_DIR, { recursive: true })
  console.log(`→ saving screenshots to ${SHOT_DIR}/`)
}

const failures = []
const shots = []
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

  // A page wider than the phone it is on. This is not cosmetic: it means the
  // layout can be swiped sideways, and it is invisible to tsc, the unit tests
  // and the build. It was real on /auth — globals.css never reset the
  // browser's default 8px body margin, and a `width: 100vw` container ignored
  // it, so the sign-in page (the first screen every user sees) was 398px wide
  // in a 390px viewport.
  //
  // 1px of slack for sub-pixel rounding; anything more is a real overflow.
  if (status && status < 400) {
    const overflow = await page.evaluate(() => {
      const d = document.documentElement
      if (d.scrollWidth <= d.clientWidth + 1) return null
      const vw = d.clientWidth
      let worst = null
      for (const el of document.querySelectorAll('body *')) {
        const b = el.getBoundingClientRect()
        if (b.width === 0 || b.right <= vw + 1) continue
        if (!worst || b.right > worst.right) {
          worst = { right: Math.round(b.right), tag: el.tagName.toLowerCase(),
                    cls: String(el.className || '').slice(0, 60) }
        }
      }
      return { scrollW: d.scrollWidth, vw, worst }
    }).catch(() => null)
    if (overflow) {
      const w = overflow.worst
      problems.push(`horizontal overflow: document is ${overflow.scrollW}px in a ` +
        `${overflow.vw}px viewport` +
        (w ? ` — widest offender <${w.tag} class="${w.cls}"> reaches ${w.right}px` : ''))
    }
  }

  if (status >= 400) problems.push(`HTTP ${status}`)
  if (status && status < 400 && chars < MIN_TEXT) {
    problems.push(`rendered only ${chars} characters — blank or errored`)
  }

  if (SHOTS && status && status < 400) {
    const name = (route === '/' ? 'home' : route.replace(/^\//, '').replace(/\//g, '-')) + '.png'
    // Full page, not just the fold: a layout that breaks below the fold
    // breaks for a user who scrolls, which is every user.
    await page.screenshot({ path: `${SHOT_DIR}/${name}`, fullPage: true }).catch(() => {})
    shots.push({ route, name })
  }

  const ok = problems.length === 0
  console.log(`   ${ok ? 'ok  ' : 'FAIL'}  ${String(status).padEnd(4)} ${route.padEnd(26)} ${String(chars).padStart(5)} chars`)
  for (const p of [...new Set(problems)].slice(0, 5)) console.log(`         ! ${p}`)
  if (!ok) failures.push({ route, problems: [...new Set(problems)] })

  await page.close()
}

// A folder of fourteen PNGs is not something anyone actually opens. One page
// showing all of them side by side is.
if (SHOTS && shots.length) {
  const cards = shots.map(s => `<figure><figcaption>${s.route}</figcaption>` +
    `<a href="${s.name}"><img src="${s.name}" alt="${s.route}"></a></figure>`).join('\n')
  await writeFile(`${SHOT_DIR}/index.html`, `<!doctype html>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>The Resident — mobile layout, every route</title>
<style>
 :root{color-scheme:light dark}
 body{font:14px system-ui,sans-serif;margin:0;padding:24px;background:#111;color:#eee}
 h1{font-size:18px;font-weight:600;margin:0 0 4px}
 p.sub{margin:0 0 24px;color:#999}
 .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:20px}
 figure{margin:0;background:#1c1c1c;border-radius:10px;overflow:hidden}
 figcaption{padding:8px 10px;font-family:ui-monospace,monospace;color:#d8b26a;border-bottom:1px solid #2a2a2a}
 img{display:block;width:100%;height:auto}
</style>
<h1>The Resident — every route at 390&times;844</h1>
<p class="sub">Full-page captures, guest mode, generated by <code>npm run smoke -- --shots</code>. Click any shot for the full image.</p>
<div class="grid">
${cards}
</div>`)
  console.log(`\n→ contact sheet: ${SHOT_DIR}/index.html (${shots.length} routes)`)
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
