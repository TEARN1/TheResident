import { useState } from 'react'

export const useGeolocation = (setAlertNotification: (msg: string | null) => void) => {
  const [locationLoading, setLocationLoading] = useState(false)

  const handleGetLiveLocation = (
    setLocation: (loc: string) => void,
    setSuburb?: (sub: string) => void
  ) => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      setAlertNotification('Geolocation is not supported by your browser.')
      setTimeout(() => setAlertNotification(null), 4000)
      return
    }

    setLocationLoading(true)
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords
        // The browser's own geolocation call is bounded (timeout: 8000 below).
        // THIS fetch was not, and it is a third-party service we do not run.
        // If Nominatim accepts the connection and then never answers — which
        // is what a rate-limited or overloaded public endpoint does — the
        // promise never settles, the finally never runs, and the button spins
        // for the rest of the session. The user has reported this feature as
        // unreliable; an unbounded call to someone else's free API is the
        // most likely reason.
        const abort = new AbortController()
        const timer = setTimeout(() => abort.abort(), 8000)
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
            { headers: { 'Accept-Language': 'en' }, signal: abort.signal }
          )
          if (!res.ok) throw new Error('OSM Reverse Geocode failed')
          const data = await res.json()

          const addr = data.address || {}
          const resolvedSuburb = addr.suburb || addr.neighbourhood || addr.village || addr.quarter || addr.city_district || ''
          const resolvedCity = addr.city || addr.town || addr.municipality || addr.state || ''
          const resolvedCountry = addr.country || ''

          let cityCountryStr = resolvedCity
          if (resolvedCountry) {
            cityCountryStr = cityCountryStr ? `${cityCountryStr}, ${resolvedCountry}` : resolvedCountry
          }

          if (cityCountryStr) {
            setLocation(cityCountryStr)
            setAlertNotification('Live location resolved successfully!')
          } else {
            // Coordinates resolved but Nominatim had no address for them
            // (rare, but happens near borders/water) — a raw "Lat: -25.9955,
            // Lon: 28.2024" string used to land straight in the search box,
            // which reads as broken rather than as a location. Leave whatever
            // the user already typed alone and just say so.
            setAlertNotification("Got your location, but couldn't resolve it to an address — try entering your suburb.")
          }

          if (setSuburb && resolvedSuburb) {
            setSuburb(resolvedSuburb)
          }

          setTimeout(() => setAlertNotification(null), 4000)
        } catch (err) {
          if (setSuburb) {
            setSuburb('')
          }
          // An abort means the address lookup timed out, not that the
          // location failed — we DID get their coordinates. Saying "could not
          // determine your location" there would be wrong, and would send
          // someone to check permissions they have already granted.
          const timedOut = err instanceof DOMException && err.name === 'AbortError'
          setAlertNotification(
            timedOut
              ? 'Got your location, but the address lookup is not responding — try entering your suburb.'
              : 'Could not resolve your location to an address — try entering your suburb.'
          )
          setTimeout(() => setAlertNotification(null), 4000)
        } finally {
          clearTimeout(timer)
          setLocationLoading(false)
        }
      },
      (error) => {
        setLocationLoading(false)
        // error.message is a raw browser string ("User denied Geolocation")
        // that reads like a crash report. error.code is the same three
        // outcomes every time (the standard GeolocationPositionError codes),
        // so map those to something a resident can actually act on instead.
        const friendly =
          error.code === error.PERMISSION_DENIED
            ? 'Location access is blocked — allow it for this site in your browser settings, then try again.'
            : error.code === error.POSITION_UNAVAILABLE
            ? 'Could not determine your location right now — try again in a moment, or enter your suburb manually.'
            : 'Location took too long to respond — try again, or enter your suburb manually.'
        setAlertNotification(friendly)
        setTimeout(() => setAlertNotification(null), 4000)
      },
      { enableHighAccuracy: true, timeout: 8000 }
    )
  }

  return { locationLoading, handleGetLiveLocation }
}
