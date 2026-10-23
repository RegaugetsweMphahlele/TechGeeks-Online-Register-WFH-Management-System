export function geolocationErrorMessage(error) {
  if (error?.code === 1) return 'Location permission was denied. Allow location access in your browser settings, then try again.'
  if (error?.code === 2) return 'Your device could not determine a location. Check that device location services are enabled and try again.'
  if (error?.code === 3) return 'Location detection timed out. Move to an area with a better signal and try again.'
  if (!globalThis.isSecureContext) return 'Location requires HTTPS, except on localhost during development.'
  return 'Location is unavailable in this browser. Use a supported browser and try again.'
}

function readableAddress(address = {}) {
  const parts = [
    [address.house_number, address.road].filter(Boolean).join(' '),
    address.suburb || address.neighbourhood || address.residential,
    address.city || address.town || address.village,
    address.state || address.province,
  ].filter(Boolean)
  return parts.length ? parts.join(', ') : null
}

export async function getCurrentLocation({ geolocation = globalThis.navigator?.geolocation, fetcher = globalThis.fetch } = {}) {
  if (!geolocation?.getCurrentPosition) throw new Error(geolocationErrorMessage())

  const position = await new Promise((resolve, reject) => {
    geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 })
  }).catch((error) => { throw new Error(geolocationErrorMessage(error)) })

  const latitude = Number(position.coords.latitude)
  const longitude = Number(position.coords.longitude)
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180)
    throw new Error('Your device returned invalid coordinates. Please try again.')

  let address = null
  try {
    const url = new URL('https://nominatim.openstreetmap.org/reverse')
    url.search = new URLSearchParams({ format: 'jsonv2', addressdetails: '1', lat: String(latitude), lon: String(longitude) })
    const response = await fetcher(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(8000) })
    if (response.ok) address = readableAddress((await response.json()).address)
  } catch {
    // Coordinates remain usable when the optional address service is unavailable.
  }

  return { latitude, longitude, address }
}