import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker, GeoJSON, useMap } from 'react-leaflet'
import L from 'leaflet'

delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

// 지도에 찍는 노드 (label: 마커에 보이는 이름, description: 노드 카드 설명)
export interface MapSensor {
  id: number
  lat: number
  lng: number
  label: string
  description?: string
  level: number | null
  pumpOn?: boolean | null
}

interface FieldMarker {
  id: number
  lat: number
  lng: number
  name: string
  areaHa: number | null
  boundary?: GeoJSON.MultiPolygon | null // V-WORLD 연속지적도 필지 경계
}

interface FieldMapProps {
  sensors: MapSensor[]
  center: [number, number]
  onNodeClick?: (sensor: MapSensor) => void
  selectedNodeId?: number | null
  fields?: FieldMarker[]
  selectedFieldId?: number | null
  onFieldClick?: (fieldId: number) => void
}

// 좌표 값이 바뀔 때만 이동 — 배열 자체를 의존성으로 두면 리렌더마다 지도가 원위치로 튐
function MapUpdater({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap()
  useEffect(() => {
    map.setView([lat, lng], 16)
  }, [lat, lng, map])
  return null
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string)

// 논 표시는 좌표점 "아래"에 붙여서, 같은 좌표의 노드 표시(점 위쪽)와 겹치지 않게 함
const createFieldIcon = (selected: boolean, name: string, areaHa: number | null) => {
  const area = areaHa !== null ? `${areaHa} ha` : '면적 미입력'
  const bg = selected ? '#1D9E75' : 'white'
  const fg = selected ? 'white' : '#0F6B4F'
  return L.divIcon({
    className: '',
    html: `
      <div style="display: inline-flex; flex-direction: column; align-items: center; transform: translate(-50%, -7px);">
        <div style="
          width: 10px;
          height: 10px;
          margin-bottom: 3px;
          border-radius: 50%;
          background: #1D9E75;
          border: 2px solid white;
          box-shadow: 0 1px 4px rgba(0,0,0,0.3);
        "></div>
        <div style="
          background: ${bg};
          color: ${fg};
          border: 2px solid #1D9E75;
          border-radius: 8px;
          padding: 4px 10px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.25);
          white-space: nowrap;
          text-align: center;
        ">
          <div style="font-size: 12px; font-weight: 700;">${escapeHtml(name)}</div>
          <div style="font-size: 11px; opacity: 0.85;">${area}</div>
        </div>
      </div>
    `,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  })
}

// 내용 높이가 바뀌어도(급수 중 표시 유무) 아래 꼭짓점이 항상 좌표점에 오도록 translate로 띄움
const createNodeIcon = (
  selected: boolean, level: number | null | undefined, name: string, pumpOn: boolean | null | undefined,
) => {
  const label = level !== null && level !== undefined ? `${level > 0 ? '+' : ''}${level} cm` : '-'
  const pumpTag = pumpOn
    ? `<div style="margin-top: 4px; display: inline-block; font-size: 10px; font-weight: 700; color: white;
         background: #1565c0; border-radius: 4px; padding: 1px 6px;">급수 중</div>`
    : ''
  return L.divIcon({
    className: '',
    html: `
      <div style="
        display: inline-block;
        transform: translate(-50%, calc(-100% - 6px));
        background: white;
        border-radius: 8px;
        padding: 6px 10px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        border: 1px solid ${selected ? '#1D9E75' : pumpOn ? '#1565c0' : '#e0e0e0'};
        position: relative;
        min-width: 70px;
        text-align: left;
      ">
        <div style="display: flex; align-items: center; gap: 4px; margin-bottom: 2px;">
          <div style="width: 8px; height: 8px; border-radius: 50%; background: #1D9E75;"></div>
          <span style="font-size: 12px; font-weight: 600; color: #222; white-space: nowrap;">${escapeHtml(name)}</span>
        </div>
        <span style="font-size: 12px; font-weight: 600; color: ${selected ? '#1D9E75' : '#333'};">${label}</span>
        ${pumpTag}
        <div style="
          position: absolute;
          bottom: -6px;
          left: 50%;
          transform: translateX(-50%);
          width: 0;
          height: 0;
          border-left: 6px solid transparent;
          border-right: 6px solid transparent;
          border-top: 6px solid white;
        "></div>
      </div>
    `,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  })
}

const VWORLD_KEY = import.meta.env.VITE_VWORLD_KEY

export default function FieldMap({
  sensors, center, onNodeClick, selectedNodeId,
  fields = [], selectedFieldId, onFieldClick,
}: FieldMapProps) {
  const [isSatellite, setIsSatellite] = useState(false)

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <MapContainer
        center={center}
        zoom={16}
        style={{ height: '100%', width: '100%' }}
        zoomControl={true}
      >
        <TileLayer
          attribution="© 브이월드"
          url={isSatellite
            ? `https://api.vworld.kr/req/wmts/1.0.0/${VWORLD_KEY}/Satellite/{z}/{y}/{x}.jpeg`
            : `https://api.vworld.kr/req/wmts/1.0.0/${VWORLD_KEY}/Base/{z}/{y}/{x}.png`}
        />
        <MapUpdater lat={center[0]} lng={center[1]} />
        {/* 필지 경계: 선택한 논은 진하게 칠하고 나머지는 점선 테두리 (선택이 바뀌면 key로 다시 그림) */}
        {fields.filter((field) => field.boundary).map((field) => {
          const selected = selectedFieldId === field.id
          return (
            <GeoJSON
              key={`parcel-${field.id}-${selected}`}
              data={field.boundary!}
              style={{
                color: '#1D9E75',
                weight: selected ? 3 : 2,
                dashArray: selected ? undefined : '6 4',
                fillColor: '#1D9E75',
                fillOpacity: selected ? 0.15 : 0.05,
              }}
              eventHandlers={{ click: () => onFieldClick?.(field.id) }}
            />
          )
        })}
        {fields.map((field) => (
          <Marker
            key={`field-${field.id}`}
            position={[field.lat, field.lng]}
            icon={createFieldIcon(selectedFieldId === field.id, field.name, field.areaHa)}
            zIndexOffset={selectedFieldId === field.id ? 1000 : 0}
            eventHandlers={{
              click: () => onFieldClick?.(field.id),
            }}
          />
        ))}
        {sensors.map((sensor) => (
          <Marker
            key={sensor.id}
            position={[sensor.lat, sensor.lng]}
            icon={createNodeIcon(selectedNodeId === sensor.id, sensor.level, sensor.label, sensor.pumpOn)}
            zIndexOffset={2000}
            eventHandlers={{
              click: () => onNodeClick?.(sensor),
            }}
          />
        ))}
      </MapContainer>

      {/* 지도/스카이뷰 전환 버튼 */}
      <div style={{
        position: 'absolute',
        top: '12px',
        right: '12px',
        zIndex: 1000,
        display: 'flex',
        background: 'white',
        borderRadius: '8px',
        border: '0.5px solid #e0e0e0',
        overflow: 'hidden',
        boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
      }}>
        {['지도', '스카이뷰'].map((label) => (
          <button
            key={label}
            onClick={() => setIsSatellite(label === '스카이뷰')}
            style={{
              padding: '6px 14px',
              fontSize: '12px',
              border: 'none',
              cursor: 'pointer',
              background: (label === '스카이뷰') === isSatellite ? '#1D9E75' : 'white',
              color: (label === '스카이뷰') === isSatellite ? 'white' : '#555',
              fontWeight: (label === '스카이뷰') === isSatellite ? 500 : 400,
            }}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}