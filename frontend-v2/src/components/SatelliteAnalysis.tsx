import clsx from 'clsx'
import { useEffect, useRef, useState } from 'react'
import { CircleMarker, Polygon, TileLayer, useMapEvents } from 'react-leaflet'
import type { LatLngBoundsExpression } from 'leaflet'
import SatelliteMap from './SatelliteMap'
import SatelliteVvChart, { DRAINED_VV_MIN, FLOODED_VV_MAX } from './SatelliteVvChart'
import { Card, CardHeader } from './ui'
import { analyzeSatellite, getSatelliteScene, type SatelliteObservation, type SatelliteSelection } from '../lib/api'
import { useFields } from '../lib/queries'
import { button, input, label } from '../lib/classes'

type Point = [number, number] // Leaflet: latitude, longitude

// 서버가 받는 꼭짓점 수 한도(200)보다 여유 있게 줄임
const MAX_VERTICES = 150

// 판정 배지 색 (담수 = 물빛, 낙수 = 흙빛, 불확실 = 회색)
const STATUS_STYLE: Record<SatelliteObservation['status'], string> = {
  flooded: 'bg-rain-100 text-rain-600',
  drained: 'bg-mustard-100 text-mustard-600',
  uncertain: 'bg-soil-200 text-soil-700',
}
const DOT_STYLE: Record<SatelliteObservation['status'], string> = {
  flooded: 'bg-rain-600',
  uncertain: 'bg-soil-500',
  drained: 'bg-mustard-500',
}
const LABEL: Record<SatelliteObservation['status'], string> = { flooded: '담수', uncertain: '불확실', drained: '낙수' }

// 판정 기준 안내 (값은 SatelliteVvChart, 서버 config.json과 같게 유지)
const dB = (v: number) => `${v < 0 ? '−' : ''}${Math.abs(v)}`
const VV_RULES: { status: SatelliteObservation['status']; range: string; note: string }[] = [
  { status: 'flooded', range: `${dB(FLOODED_VV_MAX)} dB 이하`, note: '물이 고여 신호가 약함' },
  { status: 'uncertain', range: `${dB(FLOODED_VV_MAX)} ~ ${dB(DRAINED_VV_MIN)} dB`, note: '물과 흙이 섞였거나 애매함' },
  { status: 'drained', range: `${dB(DRAINED_VV_MIN)} dB 이상`, note: '물이 빠져 신호가 강함' },
]

function MapClicks({ active, onAdd }: { active: boolean; onAdd: (point: Point) => void }) {
  useMapEvents({ click: (event) => {
    if (active) onAdd([event.latlng.lat, event.latlng.lng])
  } })
  return null
}

// 점에서 선분까지 거리 (좌표 단위, 짧은 거리라 평면으로 계산)
function distanceToSegment([y, x]: Point, [y1, x1]: Point, [y2, x2]: Point) {
  const dx = x2 - x1
  const dy = y2 - y1
  const len = dx * dx + dy * dy
  const t = len ? Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / len)) : 0
  return Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy))
}

// 더글러스-포이커: 모양을 지키면서 덜 중요한 꼭짓점부터 뺌
function douglasPeucker(points: Point[], tolerance: number): Point[] {
  if (points.length < 3) return points
  let index = 0
  let farthest = 0
  for (let i = 1; i < points.length - 1; i++) {
    const d = distanceToSegment(points[i], points[0], points[points.length - 1])
    if (d > farthest) { farthest = d; index = i }
  }
  if (farthest <= tolerance) return [points[0], points[points.length - 1]]
  const left = douglasPeucker(points.slice(0, index + 1), tolerance)
  return [...left.slice(0, -1), ...douglasPeucker(points.slice(index), tolerance)]
}

// 필지 경계처럼 꼭짓점이 많은 영역을 MAX_VERTICES 이하로 줄임 (10m 픽셀 분석이라 결과 차이는 거의 없음)
function simplifyRing(points: Point[]): Point[] {
  if (points.length <= MAX_VERTICES) return points
  let tolerance = 0.000002 // 약 0.2m
  let result = points
  while (result.length > MAX_VERTICES) {
    result = douglasPeucker([...points, points[0]], tolerance).slice(0, -1)
    tolerance *= 1.6
  }
  return result
}

function polygonFromPoints(points: Point[]): GeoJSON.Polygon {
  const ring = simplifyRing(points).map(([lat, lng]) => [lng, lat])
  return { type: 'Polygon', coordinates: [[...ring, ring[0]]] }
}

// 서버 검증 오류(JSON 배열)는 문장만 뽑아서 보여줌
function errorMessage(error: unknown) {
  if (!(error instanceof Error)) return '요청을 완료하지 못했어요. 잠시 후 다시 시도해 주세요.'
  try {
    const detail = JSON.parse(error.message)
    if (Array.isArray(detail)) {
      return detail.map((item) => String(item?.msg ?? '').replace(/^Value error,\s*/, '')).filter(Boolean).join(' ')
        || '입력값을 확인해 주세요.'
    }
  } catch {
    // JSON이 아니면 서버 문구 그대로
  }
  return error.message
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
      <Card className="p-5">
        <div className="grid items-end gap-x-3 gap-y-4 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)] xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
          <label className="block min-w-0">
            <span className={clsx(label, 'pl-1')}>분석 영역</span>
            <select value={fieldId} onChange={(event) => selectField(event.target.value)} className={clsx(input, 'h-10')}>
              <option value="">직접 그리기</option>
              {(fields.data ?? []).filter((field) => field.boundary).map((field) =>
                <option key={field.id} value={field.id}>{field.field_name} (등록 필지)</option>)}
            </select>
          </label>
          <label className="block min-w-0">
            <span className={clsx(label, 'pl-1')}>시작일</span>
            <input type="date" value={start} onChange={(event) => changeDate(event.target.value, 'start')} className={clsx(input, 'h-10')} />
          </label>
          <label className="block min-w-0">
            <span className={clsx(label, 'pl-1')}>종료일 (이 날은 제외)</span>
            <input type="date" value={end} onChange={(event) => changeDate(event.target.value, 'end')} className={clsx(input, 'h-10')} />
          </label>
          <div className="flex flex-wrap gap-2 md:col-span-3 xl:col-span-1">
            <button type="button" onClick={beginDrawing} className={button(drawing || geometry ? 'secondary' : 'primary', 'h-10 px-4')}>
              {geometry || points.length ? '영역 새로 그리기' : '영역 그리기'}
            </button>
            {drawing && <button type="button" disabled={points.length < 3} onClick={() => {
              setDrawing(false)
              void runAnalysis(polygonFromPoints(points))
            }} className={button('primary', 'h-10 px-4')}>영역 완료 · 분석</button>}
            {!drawing && geometry && <button type="button" disabled={loading} onClick={() => void runAnalysis(geometry)} className={button('primary', 'h-10 px-4')}>
              {loading ? '분석 중...' : '이 기간 다시 분석'}
            </button>}
          </div>
        </div>
        <ul className="mt-4 flex flex-col gap-1 border-t border-soil-200 pt-3 text-xs leading-relaxed text-soil-600">
          <li>· {drawing
            ? `지도를 눌러 꼭짓점을 찍어 주세요 (${points.length}개). 3개 이상이면 ‘영역 완료 · 분석’을 누를 수 있어요.`
            : '등록 필지를 고르거나 ‘영역 그리기’로 지도에 직접 영역을 지정하세요.'}</li>
          <li>· 벼가 자라기 전인 <strong className="text-forest-800">5월 ~ 7월 초</strong>를 고르면 담수·낙수 판정이 가장 믿을 만해요.</li>
        </ul>
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
        <Card className="flex flex-col">
          <CardHeader title={<span className="text-base font-bold">날짜별 관측 결과</span>} />
          <div className="flex flex-1 flex-col px-4 pb-4">
            {!geometry && !loading && !error && <p className="text-sm text-soil-600">분석할 영역을 먼저 지정해 주세요.</p>}
            {loading && <p className="text-sm text-soil-600">선택 영역의 Sentinel-1 관측값을 계산하는 중이에요...</p>}
            {error && <p role="alert" className="rounded-lg bg-clay-100 px-3 py-2 text-sm text-clay-600">{error}</p>}
            {!loading && geometry && observations.length === 0 && !error && <p className="text-sm text-soil-600">이 기간에는 촬영된 영상이 없어요.</p>}
            {observations.length > 0 && <>
              <label className="block">
                <span className="mb-1 flex items-baseline justify-between gap-2 pl-1">
                  <span className="text-xs font-semibold text-soil-600">촬영 날짜</span>
                  <span className="text-xs text-soil-500">기간 동안 총 <b className="font-semibold text-forest-800">{observations.length}회</b> 촬영</span>
                </span>
                <select value={sceneId} onChange={(event) => { setError(''); setSceneId(event.target.value) }} className={clsx(input, 'h-10')}>
                  {observations.map((item) => <option key={item.scene_id} value={item.scene_id}>
                    {item.date} · {item.status_ko} · VV {item.VV_median?.toFixed(1) ?? '-'} dB
                  </option>)}
                </select>
              </label>
              {selected && <div className="mt-4 rounded-lg border border-soil-200 bg-soil-50 p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-forest-800">{selected.date}</p>
                  <span className={clsx('rounded-full px-2.5 py-0.5 text-xs font-bold', STATUS_STYLE[selected.status])}>{selected.status_ko}</span>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-3">
                  <div>
                    <dt className="text-xs text-soil-500">VV 중앙값</dt>
                    <dd className="mt-0.5 text-lg font-bold text-forest-800 tabular-nums">{selected.VV_median?.toFixed(2) ?? '-'} <span className="text-xs font-normal text-soil-500">dB</span></dd>
                  </div>
                  <div>
                    <dt className="text-xs text-soil-500">유효 픽셀 (10m×10m 칸)</dt>
                    <dd className="mt-0.5 text-lg font-bold text-forest-800 tabular-nums">{selected.valid_pixel_count ?? 0} <span className="text-xs font-normal text-soil-500">개</span></dd>
                  </div>
                </dl>
              </div>}
              <p className="mt-2 pl-1 text-xs text-soil-500">{sceneLoading ? '지도에 영상을 불러오는 중...' : tileUrl ? '선택한 날짜의 레이더 영상을 지도에 겹쳐 보여주고 있어요.' : ''}</p>
            </>}
            {geometry && <div className="mt-4">
              <p className="pl-1 text-xs font-semibold text-soil-600">판정 기준 (VV 중앙값)</p>
              <ul className="mt-1.5 flex flex-col gap-1.5">
                {VV_RULES.map(({ status, range, note }) => (
                  <li key={status} className="flex items-center gap-2 text-xs">
                    <span className={clsx('w-12 shrink-0 rounded-full py-0.5 text-center font-bold', STATUS_STYLE[status])}>{LABEL[status]}</span>
                    <span className="w-24 shrink-0 font-semibold text-forest-800 tabular-nums">{range}</span>
                    <span className="text-soil-500">{note}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 rounded-lg bg-soil-50 px-3 py-2 text-xs leading-relaxed text-soil-600">
                <b className="font-semibold text-forest-800">VV란?</b> 위성이 레이더를 세로 방향 전파로 쏘고, 땅에서 튕겨 돌아온 세로 방향 신호의 세기(dB)예요.
                물이 찬 논은 수면이 거울처럼 전파를 다른 쪽으로 튕겨 보내서 값이 <b className="font-semibold text-forest-800">낮고</b>,
                물이 빠진 흙은 울퉁불퉁해서 전파가 되돌아와 값이 <b className="font-semibold text-forest-800">높아요</b>.
              </p>
            </div>}
            <p className="mt-auto border-t border-soil-200 pt-3 text-xs leading-relaxed text-soil-600">
              지도 색상은 Sentinel-1 VV 레이더 반사도예요 (파란색일수록 물이 고였을 가능성). 담수·낙수 판정은 검증 전 시험 규칙이며 광학 위성사진이 아니에요.
            </p>
          </div>
        </Card>
      </div>
      {observations.length > 0 && <Card>
        <CardHeader
          title={<span className="text-base font-bold">날짜별 VV 값과 판정</span>}
          aside={<div className="flex items-center gap-3 text-xs text-soil-600">
            {(['flooded', 'uncertain', 'drained'] as const).map((s) => (
              <span key={s} className="flex items-center gap-1.5">
                <span className={clsx('size-2.5 rounded-full', DOT_STYLE[s])} />{LABEL[s]}
              </span>
            ))}
          </div>}
        />
        <div className="px-4 pb-4">
          <SatelliteVvChart observations={observations} selectedId={sceneId} onSelect={(id) => { setError(''); setSceneId(id) }} />
          <p className="mt-2 pl-1 text-xs text-soil-500">
            점 하나가 위성이 한 번 찍은 날이에요. 아래(파란 구간)로 내려갈수록 물이 고였을 가능성이 커요. 점을 누르면 그날 영상을 지도에서 볼 수 있어요.
          </p>
        </div>
      </Card>}
    </div>
  )
}
