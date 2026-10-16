import { test } from 'node:test'
import assert from 'node:assert'
import { conciergeWhatsAppUrl, safeNextPath } from './launch'

test('safeNextPath keeps same-site dashboard paths', () => {
  assert.strictEqual(safeNextPath('/dashboard/housing?listing=abc'), '/dashboard/housing?listing=abc')
  assert.strictEqual(safeNextPath('/dashboard'), '/dashboard')
  assert.strictEqual(safeNextPath('/dashboard?x=1'), '/dashboard?x=1')
})

test('safeNextPath rejects anything that could leave the site', () => {
  assert.strictEqual(safeNextPath(null), '/dashboard')
  assert.strictEqual(safeNextPath('https://evil.example/dashboard'), '/dashboard')
  assert.strictEqual(safeNextPath('//evil.example'), '/dashboard')
  assert.strictEqual(safeNextPath('/dashboardevil'), '/dashboard')
  assert.strictEqual(safeNextPath('/dashboard\\@evil.example'), '/dashboard')
  assert.strictEqual(safeNextPath('/auth'), '/dashboard')
})

test('conciergeWhatsAppUrl needs a number', () => {
  assert.strictEqual(conciergeWhatsAppUrl('Soweto', ''), null)
  const url = conciergeWhatsAppUrl('Soweto', '27821234567')
  assert.ok(url?.startsWith('https://wa.me/27821234567?text='))
  assert.ok(decodeURIComponent(url!).includes('Soweto'))
})
