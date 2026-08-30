import test from 'node:test'
import assert from 'node:assert'
import {
  resolveAudience, descendantUnitIds, canPostAsUnit, unitBreadcrumb,
  sectorForTier, searchUnits, TIER_LABEL, type OrgUnit
} from './orgBroadcasts'

// Dept of Education -> HOD -> two Schools -> Teachers, mirroring the plan's
// worked example.
// A unit as it comes back from the DB. Only the fields these pure functions
// actually read vary per row; the directory columns are constant here.
const unit = (
  id: string, parentId: string | null, name: string, tier: OrgUnit['tier'], ownerUserId: string
): OrgUnit => ({
  id, parentId, name, tier, ownerUserId,
  sector: null, verified: false, suburb: null, city: null, description: null
})

const units: OrgUnit[] = [
  unit('dept', null, 'Dept of Education', 'department', 'admin'),
  unit('hod', 'dept', 'Gauteng HOD', 'hod', 'admin'),
  unit('school-a', 'hod', 'School A', 'school', 'principal-a'),
  unit('school-b', 'hod', 'School B', 'school', 'principal-b'),
  unit('teacher-a1', 'school-a', 'Mrs A', 'teacher', 'teacher-a1'),
  unit('teacher-b1', 'school-b', 'Mr B', 'teacher', 'teacher-b1')
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

test('sectorForTier groups every tier, so the directory has no orphan rows', () => {
  assert.strictEqual(sectorForTier('school'), 'education')
  assert.strictEqual(sectorForTier('grade'), 'education')
  assert.strictEqual(sectorForTier('municipality'), 'government')
  assert.strictEqual(sectorForTier('isp'), 'utility')
  assert.strictEqual(sectorForTier('clinic'), 'health')
  assert.strictEqual(sectorForTier('branch'), 'business')
  // Every tier in the label map must resolve to a real sector.
  for (const tier of Object.keys(TIER_LABEL) as (keyof typeof TIER_LABEL)[]) {
    assert.ok(sectorForTier(tier), `${tier} has no sector`)
  }
})

test('searchUnits finds a child by its parent name — how a parent hunts for a class', () => {
  const tree: OrgUnit[] = [
    ...units,
    { id: 'g10a', parentId: 'school-a', name: 'Grade 10A', tier: 'class',
      ownerUserId: 'principal-a', sector: 'education', verified: true,
      suburb: 'Ivory Park', city: 'Midrand', description: null }
  ]

  // Typing the school's name surfaces the class beneath it.
  assert.ok(searchUnits(tree, 'School A').some(u => u.id === 'g10a'))
  // And the class's own name still works.
  assert.ok(searchUnits(tree, 'grade 10').some(u => u.id === 'g10a'))
  // As does where it is.
  assert.ok(searchUnits(tree, 'ivory').some(u => u.id === 'g10a'))
  // A blank query is not a filter.
  assert.strictEqual(searchUnits(tree, '   ').length, tree.length)
  assert.strictEqual(searchUnits(tree, 'nonexistent').length, 0)
})
