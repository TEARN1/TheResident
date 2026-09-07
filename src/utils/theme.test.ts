import test from 'node:test'
import assert from 'node:assert'
import { parseTheme, resolveTheme, THEME_BOOT_SCRIPT } from './theme'

test('an explicit choice is honoured', () => {
  assert.strictEqual(parseTheme('light'), 'light')
  assert.strictEqual(parseTheme('dark'), 'dark')
})

test('the legacy "night" value still means dark', () => {
  // Someone who deliberately chose dark before the rename keeps their choice.
  assert.strictEqual(parseTheme('night'), 'dark')
})

test('no stored choice means SYSTEM, not dark', () => {
  // This is the actual bug. The old code was `t === 'light' ? 'light' : 'night'`,
  // so never having chosen was treated as having chosen dark — forever, with
  // prefers-color-scheme never consulted.
  assert.strictEqual(parseTheme(null), 'system')
  assert.strictEqual(parseTheme(undefined), 'system')
  assert.strictEqual(parseTheme(''), 'system')
  assert.strictEqual(parseTheme('garbage'), 'system')
})

test('system follows the device, both ways', () => {
  assert.strictEqual(resolveTheme('system', true), 'dark')
  assert.strictEqual(resolveTheme('system', false), 'light')
})

test('an explicit choice beats the device, both ways', () => {
  assert.strictEqual(resolveTheme('light', true), 'light')
  assert.strictEqual(resolveTheme('dark', false), 'dark')
})

test('the boot script removes the attribute when there is no choice', () => {
  // If it set one instead, the media query in tokens.css could never apply
  // and "system" would silently be impossible.
  assert.match(THEME_BOOT_SCRIPT, /removeAttribute\('data-theme'\)/)
  assert.match(THEME_BOOT_SCRIPT, /'dark'\s*\|\|\s*t === 'night'/)
})
