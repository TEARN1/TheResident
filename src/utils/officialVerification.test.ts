import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  describeVerification, canApply, isPlausibleEvidenceUrl, type MyVerification
} from './officialVerification'

const v = (over: Partial<MyVerification> = {}): MyVerification => ({
  status: 'pending', decisionNote: null, decidedAt: null,
  requestedAt: '2026-09-01T10:00:00Z', ...over
})

test('a rejected applicant is always told why', () => {
  // The SQL refuses to record a rejection without a note precisely so this
  // can never read as an unexplained "no". An applicant who cannot tell why
  // they were refused simply applies again with the same evidence.
  const out = describeVerification(v({ status: 'rejected', decisionNote: 'Letterhead did not match the municipality' }))
  assert.match(out, /Letterhead did not match/)
  assert.match(out, /apply again/)
})

test('a pending applicant is told what they can still do', () => {
  // Not "please wait" — an office that thinks it is fully blocked stops using
  // the product entirely.
  const out = describeVerification(v())
  assert.match(out, /post to followers/)
  assert.match(out, /not to an area/)
})

test('the states are all distinguishable', () => {
  const outs = (['pending', 'approved', 'rejected', 'withdrawn'] as const)
    .map(status => describeVerification(v({ status, decisionNote: 'x' })))
  assert.equal(new Set(outs).size, 4)
  assert.match(describeVerification(null), /has not applied/)
})

test('applying is offered exactly when it would achieve something', () => {
  // Verified: nothing to ask for. Pending: asking again is noise for the
  // reviewer. Rejected or withdrawn: applying again is the whole point.
  assert.equal(canApply(null, false), true)
  assert.equal(canApply(v({ status: 'rejected' }), false), true)
  assert.equal(canApply(v({ status: 'withdrawn' }), false), true)
  assert.equal(canApply(v({ status: 'pending' }), false), false)
  assert.equal(canApply(v({ status: 'approved' }), true), false)
  assert.equal(canApply(null, true), false, 'an already-verified office has nothing to apply for')
})

test('evidence links are shape-checked, and blank stays allowed', () => {
  assert.equal(isPlausibleEvidenceUrl(''), true, 'evidence is optional')
  assert.equal(isPlausibleEvidenceUrl('   '), true)
  assert.equal(isPlausibleEvidenceUrl('https://tshwane.gov.za/councillor/12'), true)
  assert.equal(isPlausibleEvidenceUrl('not a url'), false)
  assert.equal(isPlausibleEvidenceUrl('javascript:alert(1)'), false, 'only http(s) may be offered as a link')
})
