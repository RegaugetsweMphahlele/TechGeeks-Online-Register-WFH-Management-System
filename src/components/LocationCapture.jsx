import { MapPin } from 'lucide-react'
import { useState } from 'react'
import { getCurrentLocation } from '../lib/location.js'
import Button from './ui/Button.jsx'
import { Alert } from './ui/Feedback.jsx'
import LocationMap from './LocationMap.jsx'

export default function LocationCapture({ location, onChange, required = false }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [addressUnavailable, setAddressUnavailable] = useState(false)

  async function detect() {
    setBusy(true)
    setError(null)
    setAddressUnavailable(false)
    try {
      const detected = await getCurrentLocation()
      onChange(detected)
      setAddressUnavailable(!detected.address)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <Button type="button" variant="secondary" icon={MapPin} loading={busy} onClick={detect}>
          {location ? 'Refresh Current Location' : 'Get My Current Location'}
        </Button>
        <p className="mt-2 text-xs text-muted">
          {required ? 'Location is required to check in.' : 'Optional. Your location is only requested when you press this button.'}
          {' '}{required ? '' : 'This is your current device position, not a verified home address or an automatic approval.'}
          {' '}Coordinates are sent to OpenStreetMap Nominatim to look up a readable address. Browser location requires HTTPS in production; localhost is allowed during development.
        </p>
      </div>
      {error && <Alert type="error" title={error} />}
      {addressUnavailable && <Alert type="info" title="Coordinates captured; address lookup unavailable">You can continue with the coordinates shown below.</Alert>}
      {location && (
        <div className="flex flex-col gap-2 rounded-md border border-line p-3">
          <p className="font-medium">{location.address || 'Address unavailable'}</p>
          <p className="text-xs text-muted">{location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}</p>
          <LocationMap latitude={location.latitude} longitude={location.longitude} label={location.address || 'Detected location'} />
        </div>
      )}
    </div>
  )
}