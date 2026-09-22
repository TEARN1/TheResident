// PAGE TRANSITION. Opacity only, in CSS, deliberately — all three of those
// words are load-bearing, and each replaces something that was wrong here.
//
// OPACITY ONLY. This wraps every page in the app, and any `transform`,
// `filter` or `perspective` on such a wrapper makes it the containing block
// for every `position: fixed` descendant. Measured in the running app: with
// `translateY(20px)` on this element, a fixed bottom bar's viewport bottom
// goes from 844px to 3350px — it stops being pinned and scrolls away with
// the page. The previous version animated `y: 20`, so the dashboard's bottom
// nav did exactly that on every navigation. The comment that used to live
// here had already caught the identical bug from `filter: blur(0px)` and
// removed it, without noticing that `y` breaks it the same way. Opacity was
// measured too, and does not: the bar stays at 844px.
//
// IN CSS, NOT FRAMER MOTION. Framer serialises `initial` into the server-
// rendered HTML, so every page shipped with `opacity: 0` on this wrapper and
// only became visible once React hydrated. With JavaScript disabled the
// whole app rendered blank — and a hydration failure or a slow phone meant
// the same thing for real users. DESIGN-OVERHAUL item 155 is the rule this
// broke: never let content start at zero opacity without a no-JS fallback.
// A CSS animation cannot do that, because the element's resting state is
// visible and the animation is what departs from it.
//
// The keyframes sit in globals.css inside a `prefers-reduced-motion:
// no-preference` block (item 162), so a reduced-motion visitor gets no
// animation at all rather than one JavaScript has to remember to skip. The
// old 750ms was also three times the slowest duration token; content was
// still at 27% opacity 300ms after a click. It now runs at
// --duration-slow (240ms).
//
// Guarded by src/app/pageTransition.test.ts.
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-transition">{children}</div>
}
