import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  sortByNarrowest, describeJurisdiction, describeBlockReason, LEVEL_LABEL,
  type Jurisdiction
} from './jurisdictions'

const j = (over: Partial<Jurisdiction> = {}): Jurisdiction => ({
  id: 'x', name: 'Somewhere', level: 'ward', externalRef: null, ...over
})

test('sortByNarrowest puts the area a resident actually lives in first', () => {
  const sorted = sortByNarrowest([
    j({ name: 'South Africa', level: 'national' }),
    j({ name: 'Gauteng', level: 'province' }),
    j({ name: 'Ward 12', level: 'ward' }),
    j({ name: 'City of Tshwane', level: 'municipality' })
  ])
  assert.deepEqual(sorted.map(x => x.name), ['Ward 12', 'City of Tshwane', 'Gauteng', 'South Africa'])
})

test('describeJurisdiction does not repeat a level already in the name', () => {
  assert.equal(describeJurisdiction(j({ name: 'Ward 12', level: 'ward' })), 'Ward 12')
  assert.equal(
    describeJurisdiction(j({ name: 'City of Tshwane', level: 'municipality' })),
    'City of Tshwane (Municipality)'
  )
})

test('describeBlockReason explains a refusal instead of just denying it', () => {
  assert.equal(describeBlockReason(null), null)

  const unverified = describeBlockReason('not_verified')
  assert.ok(unverified)
  assert.match(unverified, /not been verified/)
  // A refusal should also say what they CAN still do, not just say no.
  assert.match(unverified, /follow/)

  const outside = describeBlockReason('outside_jurisdiction')
  assert.ok(outside)
  assert.match(outside, /outside the area/)
})

test('every level has a label', () => {
  for (const level of Object.keys(LEVEL_LABEL)) {
    assert.ok(LEVEL_LABEL[level as keyof typeof LEVEL_LABEL].length > 0)
  }
})
