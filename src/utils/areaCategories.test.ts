import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  AREA_CATEGORIES, AREA_MUTE_ALL, areaMuteKey, categoryLabel, areaMuteOptions
} from './areaCategories'

test('the mute key matches what the SQL resolver compares against', () => {
  // res_resolve_area_audience matches on 'res_area_broadcast:' || category.
  // A mismatch here mutes nothing and fails silently, which is the worst
  // possible failure for a control a resident believes they have set.
  assert.equal(areaMuteKey('water'), 'res_area_broadcast:water')
  assert.equal(AREA_MUTE_ALL, 'res_area_broadcast')
})

test('every category produces a distinct, well-formed mute key', () => {
  const keys = AREA_CATEGORIES.map(c => areaMuteKey(c.value))
  assert.equal(new Set(keys).size, keys.length)
  for (const k of keys) {
    assert.match(k, /^res_area_broadcast:[a-z]+$/)
  }
})

test('category values are stable identifiers, not display text', () => {
  // These are written into the database on every notice; a label change must
  // never orphan the mutes residents already set.
  for (const c of AREA_CATEGORIES) {
    assert.match(c.value, /^[a-z]+$/, c.value)
    assert.ok(c.label.length > 0)
    assert.ok(c.hint.length > 0, `${c.value} needs a hint or an official will guess`)
  }
})

test('an uncategorised notice still reads sensibly', () => {
  // Notices sent before categories existed have a null category.
  assert.equal(categoryLabel(null), 'General')
  assert.equal(categoryLabel('water'), 'Water')
  // An unknown value falls back to itself rather than vanishing.
  assert.equal(categoryLabel('spaceflight'), 'spaceflight')
})

test('the mute list offers the blanket option and every topic', () => {
  const opts = areaMuteOptions()
  assert.equal(opts.length, AREA_CATEGORIES.length + 1)
  assert.equal(opts[0].value, AREA_MUTE_ALL)
  // Emergencies are never mutable — offering a control that does nothing
  // would be worse than offering none.
  assert.match(opts[0].label, /except emergencies/)
  assert.ok(!opts.some(o => /critical|emergenc/i.test(o.value)))
})
