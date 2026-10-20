import test from 'node:test'
import assert from 'node:assert/strict'
import {
  extractBudget,
  extractLocation,
  analyzeMunicipalQuery
} from './conciergeEngine'

test('Concierge: extractBudget accurately parses multiple currency formats', () => {
  assert.deepEqual(extractBudget('I need a bakkie under R400'), { amount: 400, formatted: 'R400' })
  assert.deepEqual(extractBudget('Room under 2500 per month'), { amount: 2500, formatted: 'R2,500' })
  assert.deepEqual(extractBudget('Apartment for $1200'), { amount: 1200, formatted: '$1,200' })
  assert.deepEqual(extractBudget('Studio £850 pm'), { amount: 850, formatted: '£850' })
  assert.deepEqual(extractBudget('No price mentioned'), null)
})

test('Concierge: extractLocation detects known suburbs and regex prepositions', () => {
  assert.equal(extractLocation('Looking for a room in Braamfontein'), 'Braamfontein')
  assert.equal(extractLocation('Bakkie moving to Hatfield'), 'Hatfield')
  assert.equal(extractLocation('Flat near Auckland Park'), 'Auckland Park')
  assert.equal(extractLocation('Unknown query with no location'), null)
})

test('Concierge: EMERGENCY_DEFENSE detects panic and stalking triggers', () => {
  const res = analyzeMunicipalQuery('Someone is following me on a dark street, help!')
  assert.equal(res.category, 'EMERGENCY_DEFENSE')
  assert.equal(res.confidenceScore >= 95, true)
  assert.equal(res.tactileSound, 'alert')
  // Real help first: a call button, then the neighbour alert in Safety.
  assert.equal(res.actions.some(a => a.externalUrl === 'tel:10111'), true)
  assert.equal(res.actions.some(a => a.path === '/dashboard/community?tab=safety'), true)
})

test('Concierge: HAULING_DISPATCH extracts budget and location for bakkie logistics', () => {
  const res = analyzeMunicipalQuery('I need a bakkie in Braamfontein under R400')
  assert.equal(res.category, 'HAULING_DISPATCH')
  assert.equal(res.params.some(p => p.key === 'Target Sector' && p.value === 'Braamfontein'), true)
  assert.equal(res.params.some(p => p.key === 'Declared Budget' && p.value === 'R400'), true)
  assert.equal(res.actions[0].primary, true)
})

test('Concierge: TRIBUNAL_LEGAL_TRIAGE handles illegal utility disconnections', () => {
  const res = analyzeMunicipalQuery('My landlord cut off my electricity because rent was late')
  assert.equal(res.category, 'TRIBUNAL_LEGAL_TRIAGE')
  assert.equal(res.ruleApplied, 'RHA_SECTION_16_SPOLIATION')
  assert.equal(res.diagnosis.includes('unlawful spoliation'), true)
})

test('Concierge: TRIBUNAL_LEGAL_TRIAGE handles illegal lockouts', () => {
  const res = analyzeMunicipalQuery('Landlord changed the lock and locked me out without notice')
  assert.equal(res.category, 'TRIBUNAL_LEGAL_TRIAGE')
  assert.equal(res.ruleApplied, 'PIE_ACT_UNLAWFUL_EVICTION_GUARD')
})

test('Concierge: SHELTER_DISCOVERY flags suspicious low prices', () => {
  const res = analyzeMunicipalQuery('Furnished ensuite room in Sandton for R600')
  assert.equal(res.category, 'SHELTER_DISCOVERY')
  assert.equal(res.params.some(p => p.badge === 'SCAM_RISK_WARNING'), true)
})

test('Concierge: MUNICIPAL_RESILIENCE enforces 3-report consensus rule', () => {
  const res = analyzeMunicipalQuery('Power outage in Melville, street is blacked out')
  assert.equal(res.category, 'MUNICIPAL_RESILIENCE')
  assert.equal(res.params.some(p => p.key === 'Consensus Quorum'), true)
})

test('Concierge: DIRECTIVE_CASCADE routes educational circulars', () => {
  const res = analyzeMunicipalQuery('Department of education circular on matric exam timetable')
  assert.equal(res.category, 'DIRECTIVE_CASCADE')
  assert.equal(res.actions.some(a => a.path === '/dashboard/community?tab=departments'), true)
})

test('Concierge: CULTURE_RADAR links to The Gruvs verified events', () => {
  const res = analyzeMunicipalQuery('Any live music or amapiano concert tonight?')
  assert.equal(res.category, 'CULTURE_RADAR')
  assert.equal(res.actions.some(a => a.path || a.externalUrl), true)
})

test('Concierge: WORKFORCE_FORGE links to TEARNs Excellence for formulas', () => {
  const res = analyzeMunicipalQuery('How to use excel formula to split rent between roommates')
  assert.equal(res.category, 'WORKFORCE_FORGE')
  assert.equal(res.ruleApplied, 'TEARNS_WORKFORCE_COMPUTATION_ENGINE')
})

test('Concierge: TRADES_ARTISAN classifies urgency for leaks vs routine', () => {
  const urgentRes = analyzeMunicipalQuery('Emergency burst geyser leaking water everywhere')
  assert.equal(urgentRes.category, 'TRADES_ARTISAN')
  assert.equal(urgentRes.params.some(p => p.badge === 'URGENT'), true)

  const routineRes = analyzeMunicipalQuery('Need a painter to paint bedroom walls')
  assert.equal(routineRes.category, 'TRADES_ARTISAN')
  assert.equal(routineRes.params.some(p => p.badge === 'STANDARD'), true)
})

test('Concierge: GENERAL_QUERY fallback provides multi-door navigation', () => {
  const res = analyzeMunicipalQuery('random words xyz 123')
  assert.equal(res.category, 'GENERAL_QUERY')
  assert.equal(res.actions.length >= 2, true)
})
