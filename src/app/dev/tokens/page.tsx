import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { parseTokens, type ColourToken, type TokenDecl } from '../../../styles/parseTokens'

export const metadata = { title: 'Design tokens — The Resident' }

// Borders are written long-hand here, not as `border border-subtle`.
//
// Preflight is off (tailwind.config.ts), and Tailwind's `border` utility
// only sets a border-WIDTH — the matching `border-style: solid` comes from
// Preflight, which this app does not load. So `border border-subtle`
// compiles to a 1px border of style `none`, and paints nothing. Every rule
// and outline on this page was invisible until it was written out.
//
// That is app-wide, not local to this file, and is tracked separately; it is
// not fixed here because zeroing border-width globally (the other half of
// Preflight's pair) would strip the user-agent borders off every input and
// needs its own visual pass. This page paints its own, so it is correct now.
const HAIRLINE_TOP = { borderTop: '1px solid var(--border-subtle)' } as const

/**
 * THE TOKEN REFERENCE. Dev-only.
 *
 * You cannot keep a system consistent that you cannot see. Every token in
 * this app exists in two versions — one for each theme — and until this page
 * there was no way to look at both at once. The dark accent was checked
 * against the dark surface by reading hex codes out of a stylesheet and
 * imagining them, which is how `--accent` shipped at 4.32:1 on
 * `--surface-sunken` and failed WCAG AA for weeks without anyone noticing.
 *
 * The cascade cannot render both themes on one page: the dark palette lives
 * on `:root[data-theme='dark']`, so a nested element claiming to be dark
 * still inherits light values. So the page parses `src/styles/tokens.css`
 * and paints resolved values directly. Nothing here is a hand-kept list —
 * see the docblock in parseTokens.ts, and the sync test that fails if a
 * token could ever be declared and not shown.
 *
 * Gated the same way the Automation Hub is (dashboard/layout.tsx): this is a
 * workbench, not a feature, and residents have no reason to see it.
 *
 * See docs/DESIGN-OVERHAUL.md items 20 and 198.
 */
export default function TokenReferencePage() {
  if (process.env.NODE_ENV === 'production') notFound()

  const css = readFileSync(join(process.cwd(), 'src', 'styles', 'tokens.css'), 'utf8')
  const { channels, colours, scales } = parseTokens(css)

  return (
    <div className="min-h-screen bg-surface text-content px-4 py-10">
      <main id="main-content" className="mx-auto max-w-4xl space-y-10">
        <header className="space-y-3">
          <Link href="/dashboard" className="inline-flex items-center min-h-tap text-xs text-accent font-black uppercase tracking-widest hover:underline">← The Resident</Link>
          <h1 className="text-2xl font-black">Design tokens</h1>
          <p className="text-sm text-content-muted leading-relaxed">
            Every token in <code className="text-accent">src/styles/tokens.css</code>, both themes side by side.
            This page is read from the stylesheet, so it cannot drift. It is not reachable in production.
          </p>
        </header>

        <Section
          title="Channels"
          note="The raw triplets. Everything else is built from these, and they are bare numbers so Tailwind opacity modifiers (bg-accent/10) work."
          count={channels.length}
        >
          <SwatchTable rows={channels} />
        </Section>

        <Section
          title="Colours"
          note="Resolved roles. A component should name one of these, never a colour."
          count={colours.length}
        >
          <SwatchTable rows={colours} showRaw />
        </Section>

        {scales.map(group => (
          <Section key={group.group} title={group.group} count={group.tokens.length}>
            <ScaleTable group={group.group} tokens={group.tokens} />
          </Section>
        ))}
      </main>
    </div>
  )
}

function Section({ title, note, count, children }: {
  title: string
  note?: string
  count: number
  children: React.ReactNode
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-baseline gap-3 flex-wrap">
        <h2 className="text-sm font-black uppercase tracking-widest">{title}</h2>
        <span className="text-xs text-content-subtle">{count} token{count === 1 ? '' : 's'}</span>
      </div>
      {note && <p className="text-xs text-content-muted leading-relaxed max-w-prose">{note}</p>}
      {children}
    </section>
  )
}

/** Both themes on one row. */
function SwatchTable({ rows, showRaw = false }: { rows: ColourToken[]; showRaw?: boolean }) {
  // Each swatch sits on its own theme's surface, in its own theme's ink.
  // A colour is only legible against the background it will actually sit on,
  // and the label has to survive both.
  const surface = rows.find(r => r.name === '--surface-rgb')
  const ink = rows.find(r => r.name === '--text-primary-rgb')
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse min-w-[34rem]">
        <thead>
          <tr className="text-left text-content-subtle uppercase tracking-widest">
            <th scope="col" className="py-2 pr-3 font-black">Token</th>
            <th scope="col" className="py-2 pr-3 font-black">Light</th>
            <th scope="col" className="py-2 font-black">Dark</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.name} className="align-top" style={HAIRLINE_TOP}>
              <td className="py-2 pr-3">
                <code className="font-black">{row.name}</code>
                {showRaw && <div className="text-content-subtle mt-0.5 break-all">{row.raw}</div>}
              </td>
              <Swatch value={row.light} on={surface?.light} ink={ink?.light} />
              <Swatch value={row.dark} on={surface?.dark} ink={ink?.dark} />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Swatch({ value, on, ink }: { value: string; on?: string; ink?: string }) {
  return (
    <td className="py-2 pr-3">
      <div className="flex items-center gap-2 rounded-md p-1.5" style={{ background: on, color: ink }}>
        {/* A hairline keeps a swatch that matches its backdrop from vanishing,
            which is exactly the case worth being able to see. */}
        <span
          aria-hidden="true"
          className="h-7 w-7 shrink-0 rounded-sm"
          style={{ background: value, border: '1px solid var(--border-strong)' }}
        />
        <code className="text-[11px] leading-tight break-all">{value}</code>
      </div>
    </td>
  )
}

/** Non-colour tokens, each shown doing the thing it describes. */
function ScaleTable({ group, tokens }: { group: string; tokens: TokenDecl[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse min-w-[30rem]">
        <tbody>
          {tokens.map(token => (
            <tr key={token.name} className="align-middle" style={HAIRLINE_TOP}>
              <td className="py-2 pr-3 w-1/3"><code className="font-black">{token.name}</code></td>
              <td className="py-2 pr-3 text-content-subtle break-all">{token.value}</td>
              <td className="py-2 w-1/3 overflow-hidden"><ScaleDemo group={group} value={token.value} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ScaleDemo({ group, value }: { group: string; value: string }) {
  if (group === 'Elevation') {
    return <span aria-hidden="true" className="block h-9 w-24 rounded-md bg-surface-raised" style={{ boxShadow: value }} />
  }
  if (group === 'Radius') {
    return <span aria-hidden="true" className="block h-9 w-24 bg-accent/20" style={{ borderRadius: value, border: '1px solid var(--border-strong)' }} />
  }
  if (group === 'Spacing' || group === 'Layout') {
    // Capped so --content-max (680px) does not run off a phone; the number
    // in the column beside it is the truth, this is only a sense of scale.
    // Square ends, deliberately: a rounded 4px bar reads as a dot rather
    // than as a measurement, which is the one thing this column is for.
    return <span aria-hidden="true" className="block h-3 bg-accent" style={{ width: `min(${value}, 100%)` }} />
  }
  if (group === 'Motion') {
    // A duration written as "180ms" tells you nothing about whether it feels
    // right. Hover the track and the dot runs the real timing. CSS-only, so
    // this page stays a server component; `motion-reduce` drops the travel
    // for anyone who has asked the OS for less movement.
    const isEase = value.startsWith('cubic-bezier')
    return (
      <span className="group/motion block w-24 py-2" tabIndex={0}>
        <span aria-hidden="true" className="block h-1 bg-accent/20" />
        <span
          aria-hidden="true"
          className="block h-2.5 w-2.5 -mt-[0.4375rem] bg-accent transition-transform group-hover/motion:translate-x-[5.375rem] group-focus/motion:translate-x-[5.375rem] motion-reduce:transition-none motion-reduce:transform-none"
          style={{
            transitionDuration: isEase ? 'var(--duration-slow)' : value,
            transitionTimingFunction: isEase ? value : 'var(--ease-out)',
          }}
        />
      </span>
    )
  }
  return null
}
