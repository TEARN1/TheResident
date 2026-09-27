import test from 'node:test'
import assert from 'node:assert'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, extname } from 'node:path'
import { GRUVS, TEARNS } from './sisterApps'

// THE RESIDENT MAY ONLY ADVERTISE WHAT ITS SISTER APPS CAN BACK UP.
//
// Before this, the in-app ads for The Gruvs and TEARN's Excellence said
// things that were not true, and nothing noticed:
//
//  - TEARN's Excellence, an Excel-practice app for SA workplaces, was sold as
//    a software "Engineering Benchmark" with a "Quality Seal" and a
//    "Certified A+ Standard" badge. Every link to it went to its GitHub source
//    repository, which a job-seeker tapping an ad cannot use.
//  - Every Gruvs event on the map promised "Resident guestlist passes and
//    drink specials", with a hardcoded "94% Vibe" score. Neither exists.
//  - The map placed each Gruvs event on an invented ring around the viewer —
//    by list position, not venue — and quoted a distance and walking time to
//    that made-up spot.
//  - The Resident ID card promised "VIP access", queue-jumping and discounted
//    guestlists on The Gruvs. There are no such perks.
//
// Each of those was fixed, and each is a phrase this test now refuses. The
// lists come from the two apps' own advertising briefs.

const SRC = join(import.meta.dirname, '..')

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) sourceFiles(full, out)
    else if (['.ts', '.tsx'].includes(extname(full)) && !full.endsWith('.test.ts') && !full.endsWith('sisterApps.ts')) out.push(full)
  }
  return out
}

// Comments are stripped: several files now explain what used to be claimed,
// and a comment describing a removed claim is not the claim.
const stripComments = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/^\s*\/\/.*$/gm, '')

const APP = sourceFiles(SRC).map(f => ({ f: f.slice(SRC.length + 1), s: stripComments(readFileSync(f, 'utf8')) }))

const FORBIDDEN: [RegExp, string][] = [
  // TEARN's Excellence brief
  [/github\.com\/TEARN1\/TEARNs-Excellence/i, "links to TEARN's source code instead of the app"],
  [/Certified A\+|Quality Seal|Engineering Benchmark|Open Standard|Core Benchmark/i, "sells TEARN's as an engineering certification it never had"],
  [/\breal Excel\b|everything in Excel/i, 'claims real Excel — it is an Excel-compatible spreadsheet'],
  [/Microsoft[- ]certif|MOS[- ]aligned|accredit/i, 'claims a certification or accreditation nobody issued'],
  // The Gruvs brief: parked or "coming soon" features must not be advertised
  [/\bGruvs Pro\b|Crossed Paths|Path Map|\bReels?\b|gifting/i, 'advertises a Gruvs feature that is parked or coming soon'],
  // Invented perks
  [/guest ?list|drink specials?|queue-jump|VIP Access/i, 'promises a Gruvs perk that does not exist'],
]

test('no source file makes a claim the briefs rule out', () => {
  const hits: string[] = []
  for (const { f, s } of APP) {
    for (const [re, why] of FORBIDDEN) {
      const m = s.match(re)
      if (m) hits.push(`${f}: "${m[0]}" — ${why}`)
    }
  }
  assert.deepEqual(hits, [], hits.join('\n'))
})

test('no hardcoded vibe score is attached to a Gruvs event', () => {
  // "94% Vibe" on every event, computed from nothing.
  const map = APP.find(x => x.f.endsWith('VibeMap.tsx'))!
  assert.doesNotMatch(map.s, /vibeScore:\s*\d/, 'VibeMap sets a literal vibeScore on an item')
})

test('Gruvs events are placed at their venue, not around the viewer', () => {
  const map = APP.find(x => x.f.endsWith('VibeMap.tsx'))!
  // The old code derived a position from the list index around `center`.
  assert.doesNotMatch(map.s, /gruvsEvents\.forEach\(\(ev,\s*idx\)/, 'events are being positioned by list index again')
  assert.match(map.s, /ev\.lat/, 'VibeMap no longer reads the event venue position')
})

test('an ad with no real destination is not shown', () => {
  // TEARN's has no confirmed live address yet, so every TEARN's surface must
  // be gated on TEARNS.url rather than linking somewhere a user cannot use.
  for (const { f, s } of APP) {
    if (!/TEARNS\./.test(s)) continue
    assert.match(s, /TEARNS\.url\s*(&&|\?)/, `${f} renders a TEARN's ad without checking it has a destination`)
  }
})

test('the copy itself stays inside the briefs', () => {
  for (const app of [GRUVS, TEARNS]) {
    const all = [app.headline, app.body, app.cta, app.short].join(' ')
    for (const [re, why] of FORBIDDEN) assert.doesNotMatch(all, re, `${app.name} copy ${why}`)
    if (app.url) assert.match(app.url, /^https:\/\//, `${app.name} url must be a real https address`)
  }
})
