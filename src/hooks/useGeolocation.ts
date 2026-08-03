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
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
            { headers: { 'Accept-Language': 'en' } }
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
          } else {
            setLocation(`Lat: ${latitude.toFixed(4)}, Lon: ${longitude.toFixed(4)}`)
          }

          if (setSuburb && resolvedSuburb) {
            setSuburb(resolvedSuburb)
          }

          setAlertNotification('Live location resolved successfully!')
          setTimeout(() => setAlertNotification(null), 3000)
        } catch {
          setLocation(`Lat: ${latitude.toFixed(4)}, Lon: ${longitude.toFixed(4)}`)
          if (setSuburb) {
            setSuburb('')
          }
          setAlertNotification('Location resolved to coordinates (reverse geocoding failed).')
          setTimeout(() => setAlertNotification(null), 4000)
        } finally {
          setLocationLoading(false)
        }
      },
      (error) => {
        setLocationLoading(false)
        setAlertNotification(`Geolocation failed: ${error.message}`)
        setTimeout(() => setAlertNotification(null), 4000)
      },
      { enableHighAccuracy: true, timeout: 8000 }
    )
  }

  return { locationLoading, handleGetLiveLocation }
}
