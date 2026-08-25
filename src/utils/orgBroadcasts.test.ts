import test from 'node:test'
import assert from 'node:assert'
import { resolveAudience, descendantUnitIds, canPostAsUnit, unitBreadcrumb, type OrgUnit } from './orgBroadcasts'

// Dept of Education -> HOD -> two Schools -> Teachers, mirroring the plan's
// worked example.
const units: OrgUnit[] = [
  { id: 'dept', parentId: null, name: 'Dept of Education', tier: 'department', ownerUserId: 'admin' },
  { id: 'hod', parentId: 'dept', name: 'Gauteng HOD', tier: 'hod', ownerUserId: 'admin' },
  { id: 'school-a', parentId: 'hod', name: 'School A', tier: 'school', ownerUserId: 'principal-a' },
  { id: 'school-b', parentId: 'hod', name: 'School B', tier: 'school', ownerUserId: 'principal-b' },
  { id: 'teacher-a1', parentId: 'school-a', name: 'Mrs A', tier: 'teacher', ownerUserId: 'teacher-a1' },
  { id: 'teacher-b1', parentId: 'school-b', name: 'Mr B', tier: 'teacher', ownerUserId: 'teacher-b1' }
]

const follows = [
  { unitId: 'teacher-a1', followerUserId: 'parent-1' }, // follows a Teacher
  { unitId: 'school-b', followerUserId: 'parent-2' },   // follows a School directly
  { unitId: 'dept', followerUserId: 'staff-1' }          // follows the Department itself
]

test('a Department-level post reaches a Teacher-level follower', () => {
  const audience = resolveAudience(units, follows, 'dept')
  assert.ok(audience.includes('parent-1'), 'Teacher-level follower should be reached by a Department post')
  assert.ok(audience.includes('parent-2'), 'School-level follower should be reached by a Department post')
  assert.ok(audience.includes('staff-1'), 'Direct Department followers are always reached')
})

test('a Teacher-level post does NOT reach a different school\'s followers', () => {
  const audience = resolveAudience(units, follows, 'teacher-a1')
  assert.ok(audience.includes('parent-1'), 'the teacher\'s own follower is reached')
  assert.ok(!audience.includes('parent-2'), 'a different school\'s follower must not be reached')
  assert.ok(!audience.includes('staff-1'), 'a Department follower is not reached by a leaf-level post — cascade only goes downward')
})

test('a School-level post reaches its own Teacher-level follower but not a sibling school\'s', () => {
  const audience = resolveAudience(units, follows, 'school-a')
  assert.ok(audience.includes('parent-1'))
  assert.ok(!audience.includes('parent-2'))
})

test('descendantUnitIds includes the root itself and every level beneath it', () => {
  const ids = descendantUnitIds(units, 'hod')
  assert.deepStrictEqual(new Set(ids), new Set(['hod', 'school-a', 'school-b', 'teacher-a1', 'teacher-b1']))
})

test('descendantUnitIds on a leaf returns only itself', () => {
  assert.deepStrictEqual(descendantUnitIds(units, 'teacher-a1'), ['teacher-a1'])
})

test('canPostAsUnit: a sender at Department level can post as a School beneath it', () => {
  assert.strictEqual(canPostAsUnit(units, ['dept'], 'school-a'), true)
})

test('canPostAsUnit: a sender at one School cannot post as a different School', () => {
  assert.strictEqual(canPostAsUnit(units, ['school-a'], 'school-b'), false)
})

test('unitBreadcrumb walks from root to the given unit', () => {
  const chain = unitBreadcrumb(units, 'teacher-a1').map(u => u.id)
  assert.deepStrictEqual(chain, ['dept', 'hod', 'school-a', 'teacher-a1'])
})
