import { useEffect, type ReactNode } from 'react'
import { MapContainer, TileLayer, useMap } from 'react-leaflet'
import type { LatLngBoundsExpression } from 'leaflet'

const vworldKey = import.meta.env.VITE_VWORLD_KEY
const imageryUrl = vworldKey
  ? `https://api.vworld.kr/req/wmts/1.0.0/${vworldKey}/Satellite/{z}/{y}/{x}.jpeg`
  : 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'

function FitBounds({ bounds }: { bounds: LatLngBoundsExpression | null }) {
  const map = useMap()
  const key = JSON.stringify(bounds)
  useEffect(() => {
    const target = JSON.parse(key) as LatLngBoundsExpression | null
    if (target) map.fitBounds(target, { padding: [40, 40], maxZoom: 17 })
  }, [key, map])
  return null
}

export default function SatelliteMap({ bounds, children }: {
  bounds: LatLngBoundsExpression | null
  children: ReactNode
}) {
  return (
    <MapContainer center={[35.8468, 127.1294]} zoom={15} className="h-full w-full" zoomControl={false}>
      <TileLayer
        url={imageryUrl}
        maxZoom={19}
        attribution={vworldKey ? '© 브이월드' : '© Esri, Maxar, Earthstar Geographics'}
      />
      <FitBounds bounds={bounds} />
      {children}
    </MapContainer>
  )
}
