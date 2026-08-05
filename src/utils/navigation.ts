// "Outside the box" answer to not having our own turn-by-turn nav stack:
// deep-link into whatever mapping app is already installed on the user's
// phone. Google's universal directions link (`/maps/dir/?api=1&...`) opens
// the native Google Maps app on iOS/Android when one is installed and falls
// back to maps.google.com in a browser otherwise — zero maintenance, zero
// API cost, and it's the app most residents already have muscle memory for.

/** Destination as free text (an address/suburb string) — works with data we already store. */
export function directionsUrlForAddress(destination: string, origin?: string): string {
  const params = new URLSearchParams({ api: '1', destination })
  if (origin) params.set('origin', origin)
  return `https://www.google.com/maps/dir/?${params.toString()}`
}

/** Destination as coordinates — more precise once a record carries lat/lon. */
export function directionsUrlForCoords(lat: number, lon: number, origin?: string): string {
  const params = new URLSearchParams({ api: '1', destination: `${lat},${lon}` })
  if (origin) params.set('origin', origin)
  return `https://www.google.com/maps/dir/?${params.toString()}`
}

/** A Waze deep link as a second option — some residents have Waze, not Google Maps, as their daily driver. */
export function wazeUrlForAddress(destination: string): string {
  return `https://waze.com/ul?q=${encodeURIComponent(destination)}&navigate=yes`
}
