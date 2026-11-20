// Every "show me / take me there" in the app opens OUR Vibe Map, never an
// outside app: the shared reports (closures, traffic, safety alerts), saved
// pins and live jobs only exist on our map. VibeMap reads ?lat=&lon= (centre
// on a point) and ?place= (look an address up and drop a pin there).

const BASE = '/dashboard/community?tab=vibemap'

/** The Vibe Map centred on a point. */
export function vibeMapUrlForCoords(lat: number, lon: number): string {
  return `${BASE}&lat=${lat.toFixed(6)}&lon=${lon.toFixed(6)}`
}

/** The Vibe Map at an address (looked up on the map). */
export function vibeMapUrlForPlace(address: string): string {
  return `${BASE}&place=${encodeURIComponent(address.trim())}`
}

/** A live job (bakkie, truck, tow truck) on the Vibe Map. */
export function liveJobUrl(jobId: string): string {
  return `/dashboard/services/job/${encodeURIComponent(jobId)}`
}
