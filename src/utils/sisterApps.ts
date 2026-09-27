// HOW THE RESIDENT ADVERTISES ITS SISTER APPS — one place, one set of rules.
//
// Every promo for The Gruvs and TEARN's Excellence reads its words and links
// from here, so the copy cannot drift apart across the feed, profile, auth
// screen, command palette and map. The rule both briefs share: advertise only
// what is live today, and nothing either app cannot back up.
//
// Guarded by src/utils/sisterApps.test.ts, which fails on the specific claims
// these ads used to make and must not make again — see that file for why.

export interface SisterApp {
  name: string
  /**
   * Where a tap goes. `null` means the ad is not shown at all: an ad with no
   * real destination is worse than no ad. TEARN's Excellence previously linked
   * to its GitHub source repository, which a job-seeker cannot use.
   */
  url: string | null
  /** The one promise the ad leads with. */
  headline: string
  /** One or two sentences under it. */
  body: string
  /** The button. */
  cta: string
  /** A short line for tight spaces: profile row, command palette subtitle. */
  short: string
}

// ── The Gruvs ────────────────────────────────────────────────────────────
// Brief: lead with trust ("real events, verified, near you"), then "what's on
// tonight", then zero friction (free, opens in the browser, no install).
// Do NOT advertise Reels, gifting, Path Map, Crossed Paths or Gruvs Pro —
// parked or "coming soon" on The Gruvs, and promoting them would break its
// own Truth Protocol. Gauteng is where the event depth is.
export const GRUVS: SisterApp = {
  name: 'The Gruvs',
  url: 'https://thegruvs.com',
  headline: 'Real events, verified, near you',
  body: "What's on tonight — big names and local shows, with real posters and sources. Free, and it opens in your browser. Nothing to install.",
  cta: "See what's on",
  short: "Real events near you — free, opens in your browser",
}

/** The Gruvs' attendance hook, kept to one line as its brief asks. */
export const GRUVS_TOUCH_DOWN = 'RSVP, then Touch Down to prove you showed up.'

// ── TEARN's Excellence ───────────────────────────────────────────────────
// Brief: an Excel-compatible practice app for South African workplaces.
// Lead with one specific pain ("your SUM is wrong and you don't know it"),
// then: nothing to install, graded on messy data with planted traps, built
// for SA (rand, day-first dates, SA public holidays).
// Do NOT claim "real Excel" or "everything in Excel", Microsoft certification
// or accreditation, full class management, or learner outcomes.
//
// It was previously advertised here as a software "Engineering Benchmark"
// with a "Certified A+ Standard" badge and a link to its source code — a
// different product, and a certification nobody issued.
export const TEARNS: SisterApp = {
  name: "TEARN's Excellence",
  // Set to the live app's address to switch every TEARN's ad back on.
  url: null,
  headline: "Your SUM is wrong and you don't know it",
  body: 'Hands-on spreadsheet practice on messy workplace data, marked instantly — traps included. Built for South Africa: rand, day-first dates, SA public holidays. Try it in 10 seconds, nothing to install.',
  cta: 'Try a lesson',
  short: 'Hands-on spreadsheet practice for SA workplaces',
}
