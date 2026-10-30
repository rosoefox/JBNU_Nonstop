// 필지 상세: 한 논의 필지 정보·수위 그래프·AWD 지표·노드·알림을 한곳에
import clsx from 'clsx'
import { ArrowRight, RefreshCw } from 'lucide-react'
import { CircleMarker, GeoJSON, Tooltip } from 'react-leaflet'
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import type { LatLngBoundsExpression } from 'leaflet'
import { useMutation, useQueries, useQueryClient } from '@tanstack/react-query'
import LevelChart, { type LevelSeries } from '../components/LevelChart'
import VworldMap from '../components/VworldMap'
import { Empty, InfoList, LoadState, PeriodTabs } from '../components/common'
import { Card, CardHeader, StatusBadge } from '../components/ui'
import { ApiError, getNodeLogs, loadParcel, updateNode } from '../lib/api'
import { SERIES_COLORS, button, input } from '../lib/classes'
import {
  ALERT_META, DRY_LEVEL_CM, TONE_HEX, WATER_REGIMES, currentStatus, formatLevel, nodeLabel, pumpStatus, timeAgo,
} from '../lib/domain'
import { useAlerts, useFieldSummaries, useNodeAwd, useNodeStats } from '../lib/queries'
import type { AwdIndicators, Field, Node, Period, SensorLog } from '../lib/types'

export function FieldIndexRedirect() {
  const queryClient = useQueryClient()
  const { summaries, isPending, isError } = useFieldSummaries()
  if (isError) return <LoadState error onRetry={() => queryClient.invalidateQueries()} />
  if (isPending) return <LoadState />
  if (!summaries.length) {
    return <Empty>등록된 필지가 없어요. <Link to="/admin" className="text-rain-600 underline">관리에서 논 추가하기</Link></Empty>
  }
  return <Navigate to={`/fields/${summaries[0].field.id}`} replace />
}

export default function FieldDetailPage() {
  const fieldId = Number(useParams().fieldId)
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const period = (params.get('period') as Period) || '1d'
  const queryClient = useQueryClient()
  const { summaries, latest, isPending, isError } = useFieldSummaries()
  const summary = summaries.find((s) => s.field.id === fieldId)
  const nodes = summary?.nodes ?? []
  const nodeParam = Number(params.get('node'))
  const focusNode = nodes.find((n) => n.id === nodeParam) ?? nodes[0]

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    next.set(key, value)
    setParams(next, { replace: true })
  }

  // 이 논의 모든 노드 수위 기록 (그래프 선 하나씩)
  const logQueries = useQueries({
    queries: nodes.map((n) => ({ queryKey: ['logs', n.id, period], queryFn: () => getNodeLogs(n.id, period), refetchInterval: 60_000 })),
  })
  const series: LevelSeries[] = nodes.map((n, i) => ({
    id: n.id,
    name: nodeLabel(n),
    color: SERIES_COLORS[i % SERIES_COLORS.length],
    points: (logQueries[i]?.data ?? []).map((l) => ({ t: new Date(l.measured_at).getTime(), v: l.inner_water_level })),
  }))
  const awd = useNodeAwd(focusNode?.id, period)
  const stats = useNodeStats(focusNode?.id)
  const alerts = useAlerts(fieldId)

  const bounds = fieldBounds(summary?.field)

  if (isError) return <LoadState error onRetry={() => queryClient.invalidateQueries()} />
  if (isPending) return <LoadState />
  if (!summary) return <Empty>필지를 찾을 수 없어요. <Link to="/" className="text-rain-600 underline">관제로 돌아가기</Link></Empty>

  const { field } = summary
  const unresolved = (alerts.data ?? []).filter((a) => !a.is_resolved)

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-6 md:px-8">
      {/* 머리줄 */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-2xl font-bold">{field.field_name}</h1>
            <StatusBadge tone={summary.status.tone}>{summary.status.label}</StatusBadge>
          </div>
          <p className="mt-1 text-sm text-soil-600">{field.jibun_addr ?? field.location_desc ?? '지번 정보 없음'}</p>
        </div>
        <select
          aria-label="필지 선택"
          value={field.id}
          onChange={(e) => navigate(`/fields/${e.target.value}`)}
          className={clsx(input, 'w-auto min-w-48')}
        >
          {summaries.map((s) => <option key={s.field.id} value={s.field.id}>{s.field.field_name}</option>)}
        </select>
      </div>

      {/* 지도 + 현재 상태 */}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card className="h-[320px] overflow-hidden">
          <VworldMap bounds={bounds}>
            {field.boundary && (
              <GeoJSON key={`${field.id}-${summary.status.tone}`} data={field.boundary}
                style={{ color: TONE_HEX[summary.status.tone], weight: 2.5, fillColor: TONE_HEX[summary.status.tone], fillOpacity: 0.2 }} />
            )}
            {nodes.map((n) => {
              const st = currentStatus(latest.map[n.id]?.inner_water_level, latest.map[n.id]?.measured_at)
              return (
                <CircleMarker key={n.id} center={[n.latitude, n.longitude]} radius={8}
                  pathOptions={{ color: '#fff', weight: 2, fillColor: TONE_HEX[st.tone], fillOpacity: 1 }}
                  eventHandlers={{ click: () => setParam('node', String(n.id)) }}>
                  <Tooltip direction="top" offset={[0, -8]} permanent>{nodeLabel(n)}</Tooltip>
                </CircleMarker>
              )
            })}
          </VworldMap>
        </Card>

        <div className="grid gap-5">
          <Card className="px-5 py-4">
            <p className="text-xs text-soil-600">현재 평균 수위</p>
            <p className={clsx('mt-1 font-display text-5xl font-bold tabular-nums', summary.level === null && 'text-soil-400')}>
              {formatLevel(summary.level ?? summary.lastLevel)}<span className="ml-1 font-sans text-base font-medium text-soil-500">cm</span>
            </p>
            <p className="mt-2 text-sm text-soil-600">
              센서 {nodes.length}대 중 {summary.activeNodes}대 수신 중 · {summary.lastMeasuredAt ? `${timeAgo(summary.lastMeasuredAt)} 측정` : '측정 기록 없음'}
            </p>
          </Card>
          <ParcelCard fieldId={field.id} latitude={field.latitude} longitude={field.longitude}
            rows={[
              ['PNU', field.pnu ?? '-'],
              ['필지 면적', field.parcel_area_ha !== null ? `${field.parcel_area_ha.toLocaleString('ko-KR')} ha` : '-'],
              ['사업 면적', field.area_ha !== null ? `${field.area_ha} ha` : '미입력'],
            ]}
            hasParcel={!!field.pnu} />
        </div>
      </div>

      {/* 수위 그래프 */}
      <Card>
        <CardHeader title="수위 변화" aside={<PeriodTabs value={period} onChange={(p) => setParam('period', p)} />} />
        <div className="px-2 pb-4">
          {nodes.length === 0 ? <Empty>이 필지에 등록된 센서가 없어요.</Empty> : <LevelChart series={series} period={period} />}
        </div>
      </Card>

      {/* AWD 지표 */}
      <Card>
        <CardHeader
          title={<>AWD 물관리 지표 <span className="font-normal text-soil-500">· {focusNode ? nodeLabel(focusNode) : '-'}, 선택 기간 기준</span></>}
          aside={nodes.length > 1 && (
            <div className="flex gap-1">
              {nodes.map((n) => (
                <button key={n.id} type="button" onClick={() => setParam('node', String(n.id))}
                  className={clsx('rounded-full px-2.5 py-1 text-xs font-semibold', focusNode?.id === n.id ? 'bg-sprout-800 text-sprout-100' : 'bg-soil-200 text-soil-700')}>
                  {nodeLabel(n)}
                </button>
              ))}
            </div>
          )}
        />
        <div className="px-4 pb-4">
          {awd.data
            ? <AwdGrid indicators={awd.data.indicators} regime={awd.data.water_regime} sfw={awd.data.sf_w} />
            : <Empty>{focusNode ? '불러오는 중...' : '센서가 없어요.'}</Empty>}
          {stats.data && (
            <p className="mt-3 text-xs text-soil-500">
              최근 24시간: 평균 {formatLevel(stats.data.avg)}cm · 최고 {formatLevel(stats.data.max)}cm · 최저 {formatLevel(stats.data.min)}cm · 알림 {stats.data.alert_count}건
            </p>
          )}
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <NodeTable nodes={nodes} latest={latest.map} />
        <Card>
          <CardHeader title={`이 필지의 미해결 알림 ${unresolved.length}건`}
            aside={<Link to={`/alerts?field=${field.id}`} className="inline-flex items-center gap-1 text-xs font-medium text-rain-600 hover:underline">알림에서 보기 <ArrowRight className="size-3" /></Link>} />
          <ul className="divide-y divide-soil-200">
            {unresolved.slice(0, 6).map((a) => (
              <li key={a.id} className="flex items-start gap-3 px-4 py-3">
                <StatusBadge tone={ALERT_META[a.alert_type].tone}>{ALERT_META[a.alert_type].label}</StatusBadge>
                <div className="min-w-0 text-sm">
                  <p className="truncate">{a.message}</p>
                  <p className="text-xs text-soil-500">{a.node_name ?? `Node ${a.node_id}`} · {timeAgo(a.created_at)}</p>
                </div>
              </li>
            ))}
            {unresolved.length === 0 && <Empty>미해결 알림이 없어요.</Empty>}
          </ul>
        </Card>
      </div>
    </div>
  )
}

function AwdGrid({ indicators: d, regime, sfw }: { indicators: AwdIndicators; regime: keyof typeof WATER_REGIMES; sfw: number }) {
  const pct = (v: number | null) => (v === null ? '-' : `${v}%`)
  const items: { label: string; value: string; sub?: string; color?: string }[] = [
    { label: '담수 일수', value: `${d.flooded_days}일`, color: 'text-rain-600' },
    { label: '습윤 일수', value: `${d.wet_days}일`, color: 'text-sprout-600' },
    { label: '건조 일수', value: `${d.dry_days}일`, color: 'text-clay-600' },
    { label: 'AWD 사이클 (낙수)', value: `${d.cycle_count}회`, sub: `${WATER_REGIMES[regime].label} · SF_w ${sfw}` },
    { label: '준수율', value: pct(d.compliance_rate), sub: d.judged_events ? `${DRY_LEVEL_CM}cm 후 ${d.compliance_hours}시간 내 재관개 ${d.compliant_events}/${d.judged_events}회` : '판정할 낙수 없음' },
    { label: '데이터 수집 가동률', value: pct(d.uptime_rate), sub: `목표 90% · ${d.expected_uplink_minutes}분 주기 기준` },
  ]
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      {items.map((it) => (
        <div key={it.label} className="rounded-lg bg-soil-100 px-3 py-3">
          <p className="text-xs text-soil-600">{it.label}</p>
          <p className={clsx('mt-1 font-display text-xl font-bold tabular-nums', it.color)}>{it.value}</p>
          {it.sub && <p className="mt-1 text-[11px] leading-snug text-soil-500">{it.sub}</p>}
        </div>
      ))}
    </div>
  )
}

function ParcelCard({ fieldId, latitude, longitude, rows, hasParcel }: {
  fieldId: number; latitude: number; longitude: number; rows: [string, string][]; hasParcel: boolean
}) {
  const queryClient = useQueryClient()
  const reload = useMutation({
    mutationFn: () => loadParcel({ id: fieldId, latitude, longitude }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['fields'] }),
  })
  return (
    <Card className="px-5 py-4">
      <div className="mb-1 flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">필지 정보 <span className="font-normal text-soil-500">V-WORLD 연속지적도</span></p>
        <button type="button" onClick={() => reload.mutate()} disabled={reload.isPending} className={button('ghost', 'px-2 py-1 text-xs')}>
          <RefreshCw className={clsx('size-3.5', reload.isPending && 'animate-spin')} /> {hasParcel ? '다시 불러오기' : '불러오기'}
        </button>
      </div>
      <InfoList rows={rows} />
      {reload.isError && <p className="mt-2 text-xs text-clay-600">{(reload.error as Error).message}</p>}
    </Card>
  )
}

function NodeTable({ nodes, latest }: { nodes: Node[]; latest: Record<number, SensorLog> }) {
  const queryClient = useQueryClient()
  const togglePump = useMutation({
    mutationFn: (n: Node) => updateNode(n.id, { has_pump: !n.has_pump }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['nodes'] }),
  })
  return (
    <Card>
      <CardHeader title="센서" />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[620px] text-sm">
          <thead className="bg-soil-100 text-left text-xs text-soil-600">
            <tr>{['센서', '수위', '상태', '배터리', '최근 측정', '펌프'].map((h) => <th key={h} className="px-4 py-2 font-semibold">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-soil-200">
            {nodes.map((n) => {
              const log = latest[n.id]
              const st = currentStatus(log?.inner_water_level, log?.measured_at)
              const pump = pumpStatus(n.has_pump, log?.pump_on)
              return (
                <tr key={n.id}>
                  <td className="px-4 py-3">
                    <p className="font-semibold">{nodeLabel(n)}</p>
                    <p className="font-mono text-[11px] text-soil-500">{n.dev_eui}</p>
                  </td>
                  <td className="px-4 py-3 tabular-nums">{log ? `${formatLevel(log.inner_water_level)}cm` : '-'}</td>
                  <td className="px-4 py-3"><StatusBadge tone={st.tone}>{st.label}</StatusBadge></td>
                  <td className="px-4 py-3 tabular-nums">{log?.battery_voltage != null ? `${log.battery_voltage}V` : '-'}</td>
                  <td className="px-4 py-3 text-soil-600">{log ? timeAgo(log.measured_at) : '-'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        type="button" role="switch" aria-checked={n.has_pump} aria-label="펌프 연결"
                        onClick={() => togglePump.mutate(n)} disabled={togglePump.isPending}
                        className={clsx('relative h-5 w-9 rounded-full transition-colors', n.has_pump ? 'bg-rain-600' : 'bg-soil-300')}
                      >
                        <span className={clsx('absolute top-0.5 size-4 rounded-full bg-white transition-all', n.has_pump ? 'left-[18px]' : 'left-0.5')} />
                      </button>
                      <span className="text-xs text-soil-600">{pump.label}</span>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {nodes.length === 0 && <Empty>센서가 없어요. 관리에서 센서를 추가해 주세요.</Empty>}
      </div>
      {togglePump.isError && (
        <p className="px-4 pb-3 text-xs text-clay-600">{togglePump.error instanceof ApiError ? togglePump.error.message : '저장하지 못했어요'}</p>
      )}
      <p className="px-4 pb-4 text-xs text-soil-500">펌프 원격 켜기/끄기는 펌프 구매 후 연결할 예정이에요.</p>
    </Card>
  )
}

// 필지 경계(없으면 논 좌표)가 들어오는 지도 범위
function fieldBounds(field: Field | undefined): LatLngBoundsExpression | null {
  if (!field) return null
  const ring = field.boundary?.coordinates.flatMap((p) => p[0]) ?? []
  const pts: [number, number][] = ring.length ? ring.map(([lng, lat]) => [lat, lng]) : [[field.latitude, field.longitude]]
  const lats = pts.map((p) => p[0]), lngs = pts.map((p) => p[1])
  return [[Math.min(...lats), Math.min(...lngs)], [Math.max(...lats), Math.max(...lngs)]]
}
