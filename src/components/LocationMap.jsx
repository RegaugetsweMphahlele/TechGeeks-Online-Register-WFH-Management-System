import L from 'leaflet'
import { useEffect, useRef } from 'react'
import 'leaflet/dist/leaflet.css'

export default function LocationMap({ latitude, longitude, label = 'Selected location' }) {
  const container = useRef(null)
  const map = useRef(null)
  const marker = useRef(null)
  const lat = Number(latitude)
  const lon = Number(longitude)
  const valid = Number.isFinite(lat) && Number.isFinite(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180

  useEffect(() => {
    if (!container.current || !valid) return undefined
    if (!map.current) {
      map.current = L.map(container.current, { scrollWheelZoom: false }).setView([lat, lon], 15)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map.current)
      marker.current = L.circleMarker([lat, lon], {
        radius: 8, color: '#fff', weight: 2, fillColor: '#6115d0', fillOpacity: 1,
      }).addTo(map.current).bindPopup(label)
    } else {
      map.current.setView([lat, lon], 15)
      marker.current.setLatLng([lat, lon]).bindPopup(label)
    }
    map.current.invalidateSize()
    return undefined
  }, [lat, lon, valid, label])

  useEffect(() => () => {
    map.current?.remove()
    map.current = null
    marker.current = null
  }, [])

  if (!valid) return null
  return <div ref={container} className="h-48 w-full overflow-hidden rounded-md border border-line" role="img" aria-label={`Map showing ${label}`} />
}