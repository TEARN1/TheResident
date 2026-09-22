import test from 'node:test'
import assert from 'node:assert'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// THE PAGE-TRANSITION WRAPPER MUST NOT ANIMATE A TRANSFORM.
//
// src/app/template.tsx wraps every page in the app. Per the CSS spec, a
// `transform`, `filter` or `perspective` on an element makes it the
// containing block for every `position: fixed` descendant — so animating one
// here un-pins everything fixed in the app for the length of the animation.
//
// Measured in the running app, not inferred: with `translateY(20px)` on that
// wrapper, a fixed bottom bar's viewport bottom went from 844px to 3350px.
// It stops being pinned and scrolls away with the page. That is precisely
// what the dashboard's bottom nav did on every navigation, for 750ms, while
// the template animated `y: 20`.
//
// This has now been the same bug twice. An earlier version animated `filter`
// and was fixed with a comment explaining the containing-block rule — and
// the `y` sitting two lines below it, which breaks the identical way, was
// left in place. A comment did not hold the line, so this does.
//
// Opacity is the safe one, and was measured too: the bar stayed at 844px.

const HERE = import.meta.dirname
// Comments stripped from both: the files explain this rule at length, and a
// comment describing a forbidden property must not read as using one.
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
const TEMPLATE = stripComments(readFileSync(join(HERE, 'template.tsx'), 'utf8'))
const GLOBALS = stripComments(readFileSync(join(HERE, 'globals.css'), 'utf8'))

test('the page wrapper animates nothing that creates a containing block', () => {
  for (const prop of ['transform', 'translate', 'scale', 'rotate', 'filter', 'perspective', 'backdrop-filter']) {
    assert.ok(!new RegExp(`\\b${prop}\\b`, 'i').test(TEMPLATE),
      `template.tsx mentions \`${prop}\`. Anything in that family on the page wrapper makes it the containing block for every position:fixed descendant, which un-pins the bottom nav app-wide. Animate opacity instead.`)
  }
  const pageEnter = GLOBALS.match(/@keyframes\s+page-enter\s*\{[^}]*(\{[^}]*\}[^}]*)*\}/)
  assert.ok(pageEnter, 'the page-enter keyframes are gone from globals.css')
  for (const prop of ['transform', 'translate', 'scale', 'rotate', 'filter', 'perspective']) {
    assert.ok(!new RegExp(`${prop}\\s*:`, 'i').test(pageEnter[0]),
      `the page-enter keyframes set \`${prop}\`, which un-pins every position:fixed element in the app while the animation runs`)
  }
})

test('the page wrapper does not ship opacity:0 from the server', () => {
  // Framer Motion serialises `initial` into the server-rendered HTML, so the
  // previous version shipped `opacity: 0` on this wrapper and the whole app
  // rendered blank until React hydrated — and stayed blank with JavaScript
  // off, or if hydration ever failed. Verified with JS disabled at the time.
  // DESIGN-OVERHAUL item 155: never let content start at zero opacity
  // without a no-JS fallback. A CSS animation cannot regress this, because
  // the element's resting state is visible; a JS animation library here can.
  assert.ok(!/framer-motion|motion\./.test(TEMPLATE),
    'template.tsx is using a JS animation library again. Its `initial` is server-rendered, so the app ships blank and stays blank without JavaScript.')
})

test('both animations are gated on prefers-reduced-motion (item 162)', () => {
  for (const name of ['page-enter', 'success-pop']) {
    const selector = name === 'page-enter' ? '.page-transition' : '.success-check'
    // The rule that APPLIES the animation must sit inside a no-preference
    // block, so reduced motion means no animation rather than one that some
    // JavaScript has to remember to skip.
    const guarded = GLOBALS.match(
      /@media\s*\(prefers-reduced-motion:\s*no-preference\)\s*\{(?:[^{}]|\{[^{}]*\})*\}/g) ?? []
    assert.ok(guarded.some(block => block.includes(selector) && block.includes(name)),
      `${selector} applies the ${name} animation outside a prefers-reduced-motion: no-preference block`)
  }
})

test('the success moment is announced, not only drawn', () => {
  // Item 161 read as "a success animation", but the banner it lives in had
  // no aria-live, so a screen-reader user filed a report and was told
  // nothing. Motion that only reaches people who can see it is decoration.
  const check = readFileSync(join(HERE, '..', 'components', 'ui', 'SuccessCheck.tsx'), 'utf8')
  assert.match(check, /announce\(/, 'SuccessCheck no longer speaks the message through the live region')
  const layout = readFileSync(join(HERE, 'dashboard', 'layout.tsx'), 'utf8')
  assert.match(layout, /top-alert-banner-stack"\s+aria-live="polite"/,
    'the alert banner stack lost its aria-live, so none of its states reach assistive technology')
})
