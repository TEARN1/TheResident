/**
 * Route-level loading state for /dashboard and every child route that
 * doesn't define its own. Next renders this instantly on navigation while
 * the target segment's JS loads — which now matters more than it used to,
 * because Community's ten tabs and Housing's heavy panels are code-split
 * (next/dynamic), so there is real chunk-fetching between a tap and the
 * first paint.
 *
 * Deliberately a static skeleton rather than a spinner: it reserves roughly
 * the shape of the page that is about to appear, so the layout doesn't jump
 * once content arrives. No animation library — a CSS pulse costs nothing
 * and this must never be the heaviest thing on the route.
 */
export default function DashboardLoading() {
  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6 animate-pulse" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading…</span>

      {/* Header line */}
      <div className="h-8 w-48 rounded-xl bg-white/5" />

      {/* Tab/filter bar */}
      <div className="flex gap-2">
        <div className="h-9 w-24 rounded-xl bg-white/5" />
        <div className="h-9 w-28 rounded-xl bg-white/5" />
        <div className="h-9 w-20 rounded-xl bg-white/5" />
      </div>

      {/* Card grid — the shape most dashboard routes settle into */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="glass-panel p-5 space-y-3">
            <div className="h-32 w-full rounded-lg bg-white/5" />
            <div className="h-4 w-3/4 rounded bg-white/5" />
            <div className="h-3 w-1/2 rounded bg-white/5" />
          </div>
        ))}
      </div>
    </div>
  )
}
