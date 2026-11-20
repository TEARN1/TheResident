// Plain-English turn instructions from OSRM's route steps, for the driver's
// screen on the Vibe Map. Tested in routeSteps.test.ts.

export interface RouteStep {
  text: string
  distanceM: number
  /** [lon, lat] where the step starts. */
  at: [number, number]
}

interface OsrmStep {
  name?: string
  ref?: string
  distance: number
  maneuver: { type: string; modifier?: string; location: [number, number]; exit?: number }
}

const TURN: Record<string, string> = {
  left: 'Turn left',
  right: 'Turn right',
  'slight left': 'Keep slightly left',
  'slight right': 'Keep slightly right',
  'sharp left': 'Turn sharp left',
  'sharp right': 'Turn sharp right',
  straight: 'Go straight',
  uturn: 'Make a U-turn'
}

export function osrmStepText(step: OsrmStep): string {
  const road = step.name?.trim() || step.ref?.trim() || ''
  const onto = road ? ` onto ${road}` : ''
  const on = road ? ` on ${road}` : ''
  const m = step.maneuver
  switch (m.type) {
    case 'depart':
      return `Head off${on}`
    case 'arrive':
      return 'You have arrived'
    case 'roundabout':
    case 'rotary':
      return m.exit ? `At the circle, take exit ${m.exit}${onto}` : `Go round the circle${onto}`
    case 'merge':
      return `Merge${onto}`
    case 'on ramp':
      return `Take the on-ramp${onto}`
    case 'off ramp':
      return `Take the off-ramp${onto}`
    case 'fork':
      return `${m.modifier?.includes('left') ? 'Keep left' : m.modifier?.includes('right') ? 'Keep right' : 'Continue'} at the fork${onto}`
    case 'end of road':
      return `At the end of the road, ${(TURN[m.modifier || ''] || 'turn').toLowerCase()}${onto}`
    case 'continue':
    case 'new name':
      return `Continue${onto || on}`
    default:
      return `${TURN[m.modifier || ''] || 'Continue'}${onto}`
  }
}

/**
 * The turn the driver should do next, and how far away it is: the first step
 * after the one whose start the vehicle has most recently passed.
 */
export function nextInstruction(pos: { lat: number; lon: number }, steps: RouteStep[]): { text: string; inM: number } | null {
  if (steps.length === 0) return null
  const d = (s: RouteStep) => {
    const k = Math.cos((pos.lat * Math.PI) / 180)
    return Math.hypot((s.at[0] - pos.lon) * 111_320 * k, (s.at[1] - pos.lat) * 110_540)
  }
  let nearest = 0
  for (let i = 1; i < steps.length; i++) if (d(steps[i]) < d(steps[nearest])) nearest = i
  // Within 25 m of a step's start: that turn is now; otherwise it is the next one.
  const idx = d(steps[nearest]) < 25 ? nearest : Math.min(nearest + 1, steps.length - 1)
  const step = idx === 0 && steps.length > 1 ? steps[1] : steps[idx]
  return { text: step.text, inM: Math.round(d(step)) }
}
