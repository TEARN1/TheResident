// THE TOKEN TABLE, READ FROM THE STYLESHEET ITSELF.
//
// The token reference page (/dev/tokens) exists because you cannot keep a
// system consistent that you cannot see. But a hand-written list of tokens
// on that page would be a second source of truth, and a second source of
// truth drifts — quietly, in the direction of being wrong.
//
// So the page does not hold a list. It parses `src/styles/tokens.css` and
// renders whatever is actually in it. A token added to the stylesheet
// appears on the page with no other edit; a token removed disappears. The
// page cannot be out of date, because there is nothing in it to update.
//
// These functions are pure string work so they can be tested without a
// browser, a stylesheet loader, or a render.
//
// See docs/DESIGN-OVERHAUL.md items 20 and 198.

export interface TokenDecl {
  name: string
  value: string
}

export interface ColourToken {
  name: string
  /** The value as written, e.g. `rgb(var(--accent-rgb) / 0.12)`. */
  raw: string
  /** Channels substituted for the light theme, e.g. `rgb(134 102 25 / 0.12)`. */
  light: string
  /** The same for dark. */
  dark: string
}

export interface TokenTable {
  /** The `--*-rgb` channel triplets, light and dark. */
  channels: ColourToken[]
  /** Everything built out of those channels, plus literal colours. */
  colours: ColourToken[]
  /** Tokens that carry no colour: radii, spacing, motion, layout, shadows. */
  scales: { group: string; tokens: TokenDecl[] }[]
}

/**
 * The body of the first block with this exact selector.
 *
 * Deliberately line-based rather than a brace counter: tokens.css nests no
 * blocks inside a `:root`, and a line-based reader cannot be confused by a
 * brace inside a comment the way a counter can.
 */
export function blockBody(css: string, selector: string): string {
  const lines = css.split('\n')
  const start = lines.findIndex(l => l.trim() === `${selector} {`)
  if (start === -1) return ''
  const end = lines.findIndex((l, i) => i > start && l.trim() === '}')
  if (end === -1) return ''
  return lines.slice(start + 1, end).join('\n')
}

/** Every `--name: value;` in a block, in source order, comments stripped. */
export function declarations(body: string): TokenDecl[] {
  const out: TokenDecl[] = []
  const withoutComments = body.replace(/\/\*[\s\S]*?\*\//g, '')
  for (const match of withoutComments.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    out.push({ name: match[1], value: match[2].trim().replace(/\s+/g, ' ') })
  }
  return out
}

/**
 * Substitute channel triplets into a value so it can be painted directly.
 *
 * The page renders both themes at once, side by side, which the cascade
 * cannot do on its own: the dark palette is defined on `:root[data-theme]`,
 * so a nested element claiming to be dark inherits the light values anyway.
 * Resolving numerically here is what makes a true side-by-side possible.
 */
export function resolve(value: string, channels: Map<string, string>): string {
  return value.replace(/var\((--[\w-]+)\)/g, (whole, name: string) =>
    channels.get(name) ?? whole)
}

const SCALE_GROUPS: { group: string; test: (name: string) => boolean }[] = [
  { group: 'Elevation', test: n => n.startsWith('--elevation-') },
  { group: 'Radius', test: n => n.startsWith('--radius-') },
  { group: 'Spacing', test: n => n.startsWith('--space-') },
  { group: 'Motion', test: n => n.startsWith('--duration-') || n.startsWith('--ease-') },
  { group: 'Layout', test: n => ['--content-max', '--gutter', '--nav-height', '--header-height', '--tap-min'].includes(n) },
]

export function parseTokens(css: string): TokenTable {
  const lightDecls = declarations(blockBody(css, ':root'))
  const darkDecls = declarations(blockBody(css, ":root[data-theme='dark']"))

  const lightChannels = new Map<string, string>()
  const darkChannels = new Map<string, string>()
  for (const d of lightDecls) {
    if (d.name.endsWith('-rgb')) {
      lightChannels.set(d.name, d.value)
      // A channel the dark block does not override keeps its light value,
      // which is the same rule the cascade applies.
      darkChannels.set(d.name, d.value)
    }
  }
  for (const d of darkDecls) {
    if (d.name.endsWith('-rgb')) darkChannels.set(d.name, d.value)
  }

  const channels: ColourToken[] = [...lightChannels.keys()].map(name => ({
    name,
    raw: lightChannels.get(name)!,
    light: `rgb(${lightChannels.get(name)!})`,
    dark: `rgb(${darkChannels.get(name)!})`,
  }))

  const colours: ColourToken[] = []
  const scaleTokens = new Map<string, TokenDecl[]>()

  for (const d of lightDecls) {
    if (d.name.endsWith('-rgb')) continue
    const group = SCALE_GROUPS.find(g => g.test(d.name))
    if (group) {
      const list = scaleTokens.get(group.group) ?? []
      list.push(d)
      scaleTokens.set(group.group, list)
      continue
    }
    if (!d.value.includes('rgb(')) continue
    colours.push({
      name: d.name,
      raw: d.value,
      light: resolve(d.value, lightChannels),
      dark: resolve(d.value, darkChannels),
    })
  }

  // `--focus-ring` is a shadow built from colour tokens; it has no place in
  // a swatch grid but belongs on the page, so it rides with Elevation.
  const focusRing = lightDecls.find(d => d.name === '--focus-ring')
  if (focusRing) scaleTokens.set('Elevation', [...(scaleTokens.get('Elevation') ?? []), focusRing])

  return {
    channels,
    colours,
    scales: SCALE_GROUPS
      .filter(g => scaleTokens.has(g.group))
      .map(g => ({ group: g.group, tokens: scaleTokens.get(g.group)! })),
  }
}
