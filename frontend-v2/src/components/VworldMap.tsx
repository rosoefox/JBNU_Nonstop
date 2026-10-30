import clsx from 'clsx'
import { useEffect, useState, type ReactNode } from 'react'
import { MapContainer, TileLayer, useMap } from 'react-leaflet'
import type { LatLngBoundsExpression } from 'leaflet'

const VWORLD_KEY = import.meta.env.VITE_VWORLD_KEY

// 처음 한 번, 그리고 맞출 범위가 바뀌었을 때만 지도를 이동 (리렌더마다 튀지 않게 문자열로 비교)
function FitBounds({ bounds }: { bounds: LatLngBoundsExpression | null }) {
  const map = useMap()
  const key = JSON.stringify(bounds)
  useEffect(() => {
    const target = JSON.parse(key) as LatLngBoundsExpression | null
    if (target) map.fitBounds(target, { padding: [40, 40], maxZoom: 17 })
  }, [key, map])
  return null
}

// V-WORLD 배경지도 (일반 / 위성) + 그 위에 그릴 레이어(children)
export default function VworldMap({ bounds, children, className }: {
  bounds: LatLngBoundsExpression | null
  children?: ReactNode
  className?: string
}) {
  const [satellite, setSatellite] = useState(false)
  return (
    <div className={clsx('relative isolate h-full w-full', className)}>
      <MapContainer center={[35.8468, 127.1294]} zoom={15} className="h-full w-full" zoomControl={false}>
        <TileLayer
          key={satellite ? 'sat' : 'base'}
          attribution="© 브이월드"
          maxZoom={19}
          url={satellite
            ? `https://api.vworld.kr/req/wmts/1.0.0/${VWORLD_KEY}/Satellite/{z}/{y}/{x}.jpeg`
            : `https://api.vworld.kr/req/wmts/1.0.0/${VWORLD_KEY}/Base/{z}/{y}/{x}.png`}
        />
        <FitBounds bounds={bounds} />
        {children}
      </MapContainer>

      <div className="absolute top-3 right-3 z-[1000] flex overflow-hidden rounded-lg bg-white text-xs font-semibold shadow-md ring-1 ring-soil-300">
        {[
          { label: '지도', value: false },
          { label: '위성', value: true },
        ].map((o) => (
          <button
            key={o.label}
            type="button"
            onClick={() => setSatellite(o.value)}
            className={clsx('px-3 py-1.5 transition-colors', satellite === o.value ? 'bg-sprout-800 text-sprout-200' : 'text-soil-600 hover:bg-soil-100')}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}
