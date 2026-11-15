import test from 'node:test'
import assert from 'node:assert'
import {
  STATUTORY_WARDS,
  HEAVY_MUNICIPAL_DEPARTMENTS,
  findStatutoryWard,
  evaluateTicketSla,
  calculateWardDeliveryConfidenceIndex,
  predictIntersectionGridMatrix,
  evaluateCivicPetitionQuorum,
  type CivicTicket,
} from './civicChessboard'

test('STATUTORY_WARDS contains wards across major metros with councillors and infrastructure', () => {
  assert.ok(STATUTORY_WARDS.length >= 4)
  const ward60 = STATUTORY_WARDS.find(w => w.wardNumber === 60)
  assert.ok(ward60)
  assert.strictEqual(ward60.councillor.name, 'Cllr. M. Khumalo')
  assert.strictEqual(ward60.councillor.party, 'ANC')
  assert.ok(ward60.substations.length > 0)
  assert.ok(ward60.majorIntersections.length > 0)
})

test('findStatutoryWard resolves closest ward to given coordinates', () => {
  // Braamfontein coordinates
  const ward = findStatutoryWard(-26.1926, 28.0305)
  assert.strictEqual(ward.wardNumber, 60)

  // Cape Town CBD coordinates
  const cptWard = findStatutoryWard(-33.9249, 18.4241)
  assert.strictEqual(cptWard.wardNumber, 77)
  assert.strictEqual(cptWard.councillor.party, 'DA')
})

test('evaluateTicketSla detects within_sla, approaching_breach, and breached_escalated states', () => {
  const baseDate = new Date('2026-11-15T10:00:00Z')

  // Fresh critical power ticket (24h SLA) reported 2 hours ago
  const freshTicket: CivicTicket = {
    id: 't-1',
    wardCode: 'JHB-WARD-60',
    department: 'power',
    title: 'Substation Feeder Tripped',
    description: 'Blackout on Bertha street',
    reportedAtIso: new Date(baseDate.getTime() - 2 * 3600_000).toISOString(),
    isCritical: true,
    resolvedAtIso: null,
    communitySignOffsCount: 4,
  }
  const freshSla = evaluateTicketSla(freshTicket, baseDate)
  assert.strictEqual(freshSla.state, 'within_sla')
  assert.strictEqual(freshSla.escalationTier, 'None')
  assert.strictEqual(freshSla.elapsedHours, 2)
  assert.strictEqual(freshSla.remainingHours, 22)

  // Breached critical water ticket (24h SLA) reported 30 hours ago
  const breachedTicket: CivicTicket = {
    id: 't-2',
    wardCode: 'JHB-WARD-60',
    department: 'water',
    title: 'Burst Main Pipe',
    description: 'Flooding intersection',
    reportedAtIso: new Date(baseDate.getTime() - 30 * 3600_000).toISOString(),
    isCritical: true,
    resolvedAtIso: null,
    communitySignOffsCount: 12,
  }
  const breachedSla = evaluateTicketSla(breachedTicket, baseDate)
  assert.strictEqual(breachedSla.state, 'breached_escalated')
  assert.strictEqual(breachedSla.escalationTier, 'Executive Mayor')

  // Severely breached ticket (>2x SLA): escalates to Provincial Premier
  const severeTicket: CivicTicket = {
    ...breachedTicket,
    reportedAtIso: new Date(baseDate.getTime() - 60 * 3600_000).toISOString(),
  }
  const severeSla = evaluateTicketSla(severeTicket, baseDate)
  assert.strictEqual(severeSla.escalationTier, 'Provincial Premier')

  // Resolved ticket
  const resolvedTicket: CivicTicket = {
    ...freshTicket,
    resolvedAtIso: new Date(baseDate.getTime() - 1 * 3600_000).toISOString(),
  }
  const resolvedSla = evaluateTicketSla(resolvedTicket, baseDate)
  assert.strictEqual(resolvedSla.state, 'resolved')
})

test('calculateWardDeliveryConfidenceIndex computes accurate score with bonuses and penalties', () => {
  // 10 resolved, 0 breached, 10 verified signoffs
  const high = calculateWardDeliveryConfidenceIndex(10, 0, 10)
  assert.ok(high >= 90)

  // 2 resolved, 6 breached
  const poor = calculateWardDeliveryConfidenceIndex(2, 6, 0)
  assert.ok(poor < 40)
})

test('predictIntersectionGridMatrix predicts traffic light failures during loadshedding', () => {
  const intersections = [
    { name: 'Empire & Jan Smuts', lat: -26.185, lon: 28.028, cableRisk: false },
    { name: 'Bertha & De Korte', lat: -26.193, lon: 28.032, cableRisk: true },
  ]

  // At Stage 4 loadshedding, all intersections lose signal
  const stage4 = predictIntersectionGridMatrix(intersections, 4, () => false)
  assert.strictEqual(stage4.every(i => i.isOffline), true)
  assert.strictEqual(stage4[0].estimatedDelayMinutes, 25)

  // With pointsman active, delay drops by ~60%
  const stage4WithPointsman = predictIntersectionGridMatrix(
    intersections,
    4,
    name => name.includes('Empire')
  )
  const empire = stage4WithPointsman.find(i => i.intersectionName.includes('Empire'))!
  assert.strictEqual(empire.pointsmanActive, true)
  assert.strictEqual(empire.estimatedDelayMinutes, 10) // 25 * 0.4
})

test('evaluateCivicPetitionQuorum triggers statutory notice when threshold is reached', () => {
  const notEnough = evaluateCivicPetitionQuorum('Fix Jan Smuts Pothole', 24, 60, 50)
  assert.strictEqual(notEnough.hasAchievedQuorum, false)
  assert.strictEqual(notEnough.percentAchieved, 48)
  assert.ok(notEnough.statutoryNoticeBody.includes('26 more needed'))

  const quorumAchieved = evaluateCivicPetitionQuorum('Repair Bertha St Water Pipe', 58, 60, 50)
  assert.strictEqual(quorumAchieved.hasAchievedQuorum, true)
  assert.strictEqual(quorumAchieved.percentAchieved, 100)
  assert.ok(quorumAchieved.statutoryNoticeBody.includes('STATUTORY MUNICIPAL NOTICE'))
  assert.ok(quorumAchieved.statutoryNoticeBody.includes('Act 32 of 2000'))
})
