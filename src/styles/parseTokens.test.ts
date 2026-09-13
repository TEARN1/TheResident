import test from 'node:test'
import assert from 'node:assert'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { blockBody, declarations, resolve, parseTokens } from './parseTokens'

const CSS = readFileSync(join(import.meta.dirname, 'tokens.css'), 'utf8')

test('blockBody reads a block and stops at its closing brace', () => {
  const css = ':root {\n  --a: 1;\n}\n:root[data-theme=\'dark\'] {\n  --a: 2;\n}\n'
  assert.match(blockBody(css, ':root'), /--a: 1/)
  assert.doesNotMatch(blockBody(css, ':root'), /--a: 2/)
})

test('blockBody returns empty for a selector that is not there', () => {
  assert.equal(blockBody(':root {\n}\n', ':root[data-theme=\'sepia\']'), '')
})

test('declarations strips comments so a hex note is not read as a value', () => {
  const decls = declarations('  --accent-rgb: 134 102 25;        /* #866619 */\n')
  assert.deepEqual(decls, [{ name: '--accent-rgb', value: '134 102 25' }])
})

test('resolve substitutes channels and leaves unknown vars alone', () => {
  const channels = new Map([['--accent-rgb', '134 102 25']])
  assert.equal(resolve('rgb(var(--accent-rgb) / 0.12)', channels), 'rgb(134 102 25 / 0.12)')
  assert.equal(resolve('rgb(var(--nope-rgb))', channels), 'rgb(var(--nope-rgb))')
})

test('a channel the dark block does not override keeps its light value', () => {
  // The cascade behaves this way; the parser has to agree with it or the
  // page shows a dark column that the app never actually renders.
  const css = ":root {\n  --a-rgb: 1 1 1;\n  --b-rgb: 2 2 2;\n}\n:root[data-theme='dark'] {\n  --a-rgb: 9 9 9;\n}\n"
  const b = parseTokens(css).channels.find(c => c.name === '--b-rgb')!
  assert.equal(b.light, 'rgb(2 2 2)')
  assert.equal(b.dark, 'rgb(2 2 2)')
})

test('every channel in the real stylesheet has both themes resolved', () => {
  const { channels } = parseTokens(CSS)
  assert.ok(channels.length >= 18, `expected the full channel set, got ${channels.length}`)
  for (const c of channels) {
    assert.match(c.light, /^rgb\(\d+ \d+ \d+\)$/, `${c.name} light`)
    assert.match(c.dark, /^rgb\(\d+ \d+ \d+\)$/, `${c.name} dark`)
  }
})

test('no colour token is left holding an unresolved var', () => {
  // An unresolved var paints nothing, which on a reference page reads as a
  // token that does not exist rather than one that failed to resolve.
  for (const c of parseTokens(CSS).colours) {
    assert.doesNotMatch(c.light, /var\(/, `${c.name} light did not resolve`)
    assert.doesNotMatch(c.dark, /var\(/, `${c.name} dark did not resolve`)
  }
})

test('THE SYNC GUARANTEE: every token in :root reaches the page', () => {
  // This is the whole point. If a token can be declared in tokens.css and
  // not appear in the parsed table, the reference page is lying by
  // omission — and it will do so silently, which is the failure mode this
  // project keeps hitting. Adding a token with a new prefix fails here
  // until SCALE_GROUPS knows where to put it.
  const table = parseTokens(CSS)
  const shown = new Set([
    ...table.channels.map(t => t.name),
    ...table.colours.map(t => t.name),
    ...table.scales.flatMap(g => g.tokens.map(t => t.name)),
  ])
  const declared = declarations(blockBody(CSS, ':root')).map(d => d.name)
  const missing = declared.filter(n => !shown.has(n))
  assert.deepEqual(missing, [], `tokens.css declares tokens the reference page never shows: ${missing.join(', ')}`)
})
