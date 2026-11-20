import { test } from 'node:test'
import assert from 'node:assert'
import { osrmStepText } from './routeSteps'

const at: [number, number] = [28, -26]

test('turn instructions read naturally', () => {
  assert.strictEqual(osrmStepText({ name: 'Jan Smuts Avenue', distance: 0, maneuver: { type: 'depart', location: at } }), 'Head off on Jan Smuts Avenue')
  assert.strictEqual(osrmStepText({ name: 'Bree Street', distance: 300, maneuver: { type: 'turn', modifier: 'left', location: at } }), 'Turn left onto Bree Street')
  assert.strictEqual(osrmStepText({ name: '', ref: 'M1', distance: 900, maneuver: { type: 'on ramp', modifier: 'right', location: at } }), 'Take the on-ramp onto M1')
  assert.strictEqual(osrmStepText({ name: 'Empire Road', distance: 80, maneuver: { type: 'roundabout', exit: 2, location: at } }), 'At the circle, take exit 2 onto Empire Road')
  assert.strictEqual(osrmStepText({ distance: 0, maneuver: { type: 'arrive', location: at } }), 'You have arrived')
  assert.strictEqual(osrmStepText({ name: 'Main Rd', distance: 50, maneuver: { type: 'end of road', modifier: 'right', location: at } }), 'At the end of the road, turn right onto Main Rd')
})

test('the next instruction is the turn ahead, with its distance', async () => {
  const { nextInstruction } = await import('./routeSteps')
  const steps = [
    { text: 'Head off on A Street', distanceM: 500, at: [28.0, -26.0] as [number, number] },
    { text: 'Turn left onto B Road', distanceM: 300, at: [28.0, -25.9955] as [number, number] },
    { text: 'You have arrived', distanceM: 0, at: [27.997, -25.9955] as [number, number] }
  ]
  const start = nextInstruction({ lat: -26.0, lon: 28.0 }, steps)
  assert.strictEqual(start?.text, 'Turn left onto B Road')
  assert.ok(start!.inM > 450 && start!.inM < 550)
  const halfway = nextInstruction({ lat: -25.998, lon: 28.0 }, steps)
  assert.strictEqual(halfway?.text, 'Turn left onto B Road')
  const atTurn = nextInstruction({ lat: -25.9956, lon: 28.0 }, steps)
  assert.strictEqual(atTurn?.text, 'Turn left onto B Road')
  assert.strictEqual(nextInstruction({ lat: -26, lon: 28 }, []), null)
})
