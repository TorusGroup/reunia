'use client'

// =============================================================
// Sighting Map — Map placeholder (Sprint 6)
// Real Leaflet integration in Sprint 7+
// =============================================================

interface SightingMapProps {
  sightings: Array<{
    id: string
    latitude: number
    longitude: number
    status: string
  }>
  center?: { lat: number; lng: number }
  zoom?: number
}

export function SightingMap({ sightings, center = { lat: -15.78, lng: -47.93 }, zoom = 5 }: SightingMapProps) {
  return (
    <div
      className="w-full rounded-xl flex items-center justify-center border"
      style={{
        height: 320,
        backgroundColor: 'var(--color-data-blue-light)',
        borderColor: 'var(--color-data-blue)',
        color: 'var(--color-data-blue-dark)',
      }}
    >
      <div className="text-center">
        <p className="text-2xl mb-2">🗺</p>
        <p className="font-medium text-sm">Mapa de Avistamentos</p>
        <p className="text-xs mt-1 opacity-70">
          {sightings.length} avistamento{sightings.length !== 1 ? 's' : ''}
          &nbsp;·&nbsp; Centro: {center.lat.toFixed(2)}, {center.lng.toFixed(2)}
          &nbsp;·&nbsp; Zoom: {zoom}
        </p>
        <p className="text-xs mt-2 opacity-60">
          Integração Leaflet em Sprint 7
        </p>
      </div>
    </div>
  )
}
