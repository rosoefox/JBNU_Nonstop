import { useEffect, useRef, useState } from 'react'
import { CircleMarker, Polygon, TileLayer, useMapEvents } from 'react-leaflet'
import type { LatLngBoundsExpression } from 'leaflet'
import SatelliteMap from './SatelliteMap'
import { Card, CardHeader } from './ui'
import { analyzeSatellite, getSatelliteScene, type SatelliteObservation, type SatelliteSelection } from '../lib/api'
import { useFields } from '../lib/queries'
import { button, input } from '../lib/classes'

type Point = [number, number] // Leaflet: latitude, longitude

function MapClicks({ active, onAdd }: { active: boolean; onAdd: (point: Point) => void }) {
  useMapEvents({ click: (event) => {
    if (active) onAdd([event.latlng.lat, event.latlng.lng])
  } })
  return null
}

function polygonFromPoints(points: Point[]): GeoJSON.Polygon {
  const ring = points.map(([lat, lng]) => [lng, lat])
  return { type: 'Polygon', coordinates: [[...ring, ring[0]]] }
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : '요청을 완료하지 못했습니다.'
}

const today = new Date()
const defaultEnd = today.toISOString().slice(0, 10)
const defaultStart = new Date(today.getTime() - 90 * 86400000).toISOString().slice(0, 10)

export default function SatelliteAnalysis() {
  const fields = useFields()
  const [fieldId, setFieldId] = useState('')
  const [points, setPoints] = useState<Point[]>([])
  const [drawing, setDrawing] = useState(false)
  const [geometry, setGeometry] = useState<GeoJSON.Polygon | null>(null)
  const [start, setStart] = useState(defaultStart)
  const [end, setEnd] = useState(defaultEnd)
  const [observations, setObservations] = useState<SatelliteObservation[]>([])
  const [sceneId, setSceneId] = useState('')
  const [tileUrl, setTileUrl] = useState('')
  const [chartUrl, setChartUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [sceneLoading, setSceneLoading] = useState(false)
  const [error, setError] = useState('')
  const requestId = useRef(0)

  const selected = observations.find((o) => o.scene_id === sceneId)
  const bounds: LatLngBoundsExpression | null = points.length >= 2
    ? [points[0], ...points.slice(1)]
    : null

  function clearAnalysis() {
    ++requestId.current
    setObservations([])
    setSceneId('')
    setTileUrl('')
    setChartUrl(null)
    setError('')
    setLoading(false)
    setSceneLoading(false)
  }

  async function runAnalysis(polygon: GeoJSON.Polygon) {
    clearAnalysis()
    const id = requestId.current
    setGeometry(polygon)
    if (!start || !end || start >= end) {
      setError('조회 시작일은 종료일보다 빨라야 합니다.')
      return
    }
    setLoading(true)
    try {
      const result = await analyzeSatellite({ geometry: polygon, start, end })
      if (id !== requestId.current) return
      const sorted = [...result.observations].sort((a, b) => b.timestamp.localeCompare(a.timestamp))
      setObservations(sorted)
      setChartUrl(result.chart_url)
      setSceneId(sorted[0]?.scene_id ?? '')
    } catch (err) {
      if (id === requestId.current) setError(errorMessage(err))
    } finally {
      if (id === requestId.current) setLoading(false)
    }
  }

  useEffect(() => {
    if (!geometry || !sceneId) return
    let cancelled = false
    const selection: SatelliteSelection = { geometry, start, end }
    setTileUrl('')
    setSceneLoading(true)
    getSatelliteScene({ ...selection, scene_id: sceneId })
      .then((result) => { if (!cancelled) setTileUrl(result.tile_url) })
      .catch((err) => { if (!cancelled) setError(errorMessage(err)) })
      .finally(() => { if (!cancelled) setSceneLoading(false) })
    return () => { cancelled = true }
  }, [geometry, sceneId, start, end])

  function selectField(id: string) {
    setFieldId(id)
    const boundary = fields.data?.find((field) => field.id === Number(id))?.boundary
    if (!boundary) return
    const ring = boundary.coordinates[0]?.[0]
    if (!ring || ring.length < 4) return
    const nextPoints = ring.slice(0, -1).map(([lng, lat]) => [lat, lng] as Point)
    setPoints(nextPoints)
    setDrawing(false)
    void runAnalysis(polygonFromPoints(nextPoints))
  }

  function beginDrawing() {
    clearAnalysis()
    setFieldId('')
    setPoints([])
    setGeometry(null)
    setDrawing(true)
  }

  function changeDate(value: string, which: 'start' | 'end') {
    clearAnalysis()
    if (which === 'start') setStart(value)
    else setEnd(value)
  }

  return (
    <div className="flex flex-col gap-5">
      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="min-w-48 flex-1 text-sm">등록된 필지
            <select value={fieldId} onChange={(event) => selectField(event.target.value)} className={input}>
              <option value="">직접 그리기</option>
              {(fields.data ?? []).filter((field) => field.boundary).map((field) =>
                <option key={field.id} value={field.id}>{field.field_name}</option>)}
            </select>
          </label>
          <label className="text-sm">시작일<input type="date" value={start} onChange={(event) => changeDate(event.target.value, 'start')} className={input} /></label>
          <label className="text-sm">종료일 (제외)<input type="date" value={end} onChange={(event) => changeDate(event.target.value, 'end')} className={input} /></label>
          <button type="button" onClick={beginDrawing} className={button('primary')}>폴리곤 새로 그리기</button>
          {drawing && <button type="button" disabled={points.length < 3} onClick={() => {
            setDrawing(false)
            void runAnalysis(polygonFromPoints(points))
          }} className={button('primary')}>영역 완료 · 분석</button>}
          {!drawing && geometry && <button type="button" disabled={loading} onClick={() => void runAnalysis(geometry)} className={button('primary')}>
            {loading ? '분석 중...' : '이 기간 다시 분석'}
          </button>}
        </div>
        <p className="mt-2 text-xs text-soil-600">직접 그리기: 지도를 눌러 꼭짓점 3개 이상을 지정한 뒤 ‘영역 완료 · 분석’을 누르세요. 종료일은 포함되지 않습니다.</p>
      </Card>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Card className="h-[460px] overflow-hidden">
          <SatelliteMap bounds={bounds}>
            {tileUrl && <TileLayer key={tileUrl} url={tileUrl} opacity={0.8} attribution="© Google Earth Engine · Sentinel-1" />}
            <MapClicks active={drawing} onAdd={(point) => setPoints((previous) => [...previous, point])} />
            {points.length >= 3 && <Polygon positions={points} pathOptions={{ color: '#f97316', weight: 3, fillOpacity: 0.08 }} />}
            {drawing && points.map((point, index) => <CircleMarker key={index} center={point} radius={4} pathOptions={{ color: '#f97316' }} />)}
          </SatelliteMap>
        </Card>
        <Card className="p-4">
          <CardHeader title="관측 영상" />
          {loading && <p className="text-sm text-soil-600">선택 영역의 Sentinel-1 관측값을 계산하는 중입니다...</p>}
          {error && <p role="alert" className="mt-2 text-sm text-clay-600">{error}</p>}
          {!loading && geometry && observations.length === 0 && !error && <p className="text-sm text-soil-600">이 기간에는 관측 영상이 없습니다.</p>}
          {observations.length > 0 && <>
            <label className="mt-2 block text-sm">촬영 날짜
              <select value={sceneId} onChange={(event) => { setError(''); setSceneId(event.target.value) }} className={input}>
                {observations.map((item) => <option key={item.scene_id} value={item.scene_id}>
                  {item.date} · {item.status_ko} · VV {item.VV_median?.toFixed(1) ?? '-'} dB
                </option>)}
              </select>
            </label>
            <p className="mt-4 text-sm">{selected?.date} · <strong>{selected?.status_ko}</strong></p>
            <p className="mt-1 text-sm text-soil-600">VV 중앙값 {selected?.VV_median?.toFixed(2) ?? '-'} dB · 유효 픽셀 {selected?.valid_pixel_count ?? 0}개</p>
            <p className="mt-2 text-xs text-soil-600">{sceneLoading ? '지도 영상 불러오는 중...' : tileUrl ? '선택한 장면을 지도에 표시 중' : ''}</p>
          </>}
          <p className="mt-5 border-t border-soil-200 pt-3 text-xs text-soil-600">색상은 Sentinel-1 VV 레이더 반사도를 나타냅니다. 담수·낙수 판정은 검증 전 시험 규칙이며 광학 위성사진이 아닙니다.</p>
        </Card>
      </div>
      {chartUrl && <Card className="p-4">
        <CardHeader title="기간별 VV 반사도와 담수·낙수 판정" />
        <img src={chartUrl} alt="선택한 폴리곤의 관측 날짜별 VV 중앙값과 담수·낙수 판정 그래프" className="mx-auto w-full max-w-5xl" />
      </Card>}
    </div>
  )
}
