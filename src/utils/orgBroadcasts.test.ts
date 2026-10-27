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

// Civic Governance Hierarchy: Presidency -> Premier -> Executive Mayor -> Ward Councillor
const civicUnits: OrgUnit[] = [
  { id: 'za-pres', parentId: null, name: 'The Presidency (RSA)', tier: 'presidency', ownerUserId: 'pres-1' },
  { id: 'gp-premier', parentId: 'za-pres', name: 'Gauteng Office of the Premier', tier: 'premier', ownerUserId: 'prem-1' },
  { id: 'jhb-mayor', parentId: 'gp-premier', name: 'City of Johannesburg Executive Mayor', tier: 'mayor', ownerUserId: 'mayor-1' },
  { id: 'ward-60', parentId: 'jhb-mayor', name: 'Ward 60 Councillor (Braamfontein)', tier: 'councillor', ownerUserId: 'councillor-60' },
  { id: 'ward-58', parentId: 'jhb-mayor', name: 'Ward 58 Councillor (Fordsburg)', tier: 'councillor', ownerUserId: 'councillor-58' }
]

const civicFollows = [
  { unitId: 'ward-60', followerUserId: 'resident-braam' },
  { unitId: 'ward-58', followerUserId: 'resident-fordsburg' }
]

test('Civic cascade: Presidency and Executive Mayor broadcasts reach all Ward followers, while a Ward Councillor broadcast stays scoped to their Ward', () => {
  const nationalAudience = resolveAudience(civicUnits, civicFollows, 'za-pres')
  assert.deepStrictEqual(new Set(nationalAudience), new Set(['resident-braam', 'resident-fordsburg']))

  const mayoralAudience = resolveAudience(civicUnits, civicFollows, 'jhb-mayor')
  assert.deepStrictEqual(new Set(mayoralAudience), new Set(['resident-braam', 'resident-fordsburg']))

  const ward60Audience = resolveAudience(civicUnits, civicFollows, 'ward-60')
  assert.deepStrictEqual(ward60Audience, ['resident-braam'])
  assert.strictEqual(canPostAsUnit(civicUnits, ['jhb-mayor'], 'ward-60'), true)
  assert.strictEqual(canPostAsUnit(civicUnits, ['ward-60'], 'ward-58'), false)
})

// Political Party Hierarchy: National HQ -> Provincial Structure -> Ward Branch
const partyUnits: OrgUnit[] = [
  { id: 'party-hq', parentId: null, name: 'National Party HQ', tier: 'political_party', ownerUserId: 'sec-gen' },
  { id: 'party-gp', parentId: 'party-hq', name: 'Gauteng Provincial Structure', tier: 'political_party', ownerUserId: 'prov-chair' },
  { id: 'branch-soweto', parentId: 'party-gp', name: 'Soweto Ward 39 Branch', tier: 'party_branch', ownerUserId: 'branch-sec-39' },
  { id: 'branch-alex', parentId: 'party-gp', name: 'Alexandra Ward 105 Branch', tier: 'party_branch', ownerUserId: 'branch-sec-105' }
]

const partyFollows = [
  { unitId: 'branch-soweto', followerUserId: 'voter-soweto' },
  { unitId: 'branch-alex', followerUserId: 'voter-alex' }
]

test('Political Party cascade: National HQ rally announcement reaches all Ward Branch voters, while a Ward Branch meeting notice only reaches that Ward Branch', () => {
  const hqAudience = resolveAudience(partyUnits, partyFollows, 'party-hq')
  assert.deepStrictEqual(new Set(hqAudience), new Set(['voter-soweto', 'voter-alex']))

  const sowetoBranchAudience = resolveAudience(partyUnits, partyFollows, 'branch-soweto')
  assert.deepStrictEqual(sowetoBranchAudience, ['voter-soweto'])
  assert.strictEqual(canPostAsUnit(partyUnits, ['party-hq'], 'branch-soweto'), true)
  assert.strictEqual(canPostAsUnit(partyUnits, ['branch-soweto'], 'branch-alex'), false)
})
