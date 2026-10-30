// 관제: 큰 지도에 모든 필지를 상태 색으로, 옆 패널에 요약·필지 목록·미해결 알림
import clsx from 'clsx'
import { ArrowRight, RefreshCw } from 'lucide-react'
import { useMemo, useState } from 'react'
import { CircleMarker, GeoJSON, Tooltip } from 'react-leaflet'
import { Link, useNavigate } from 'react-router-dom'
import type { LatLngBoundsExpression } from 'leaflet'
import { useQueryClient } from '@tanstack/react-query'
import VworldMap from '../components/VworldMap'
import { Card, CardHeader, StatusBadge } from '../components/ui'
import {
  ALERT_META, LEVEL_STATUS, TONE_HEX, currentStatus, formatLevel, nodeLabel, timeAgo, type Tone,
} from '../lib/domain'
import { summarizeFields, type FieldSummary } from '../lib/fieldSummary'
import { useAlerts, useFields, useLatestLogs, useNodes } from '../lib/queries'
import { TONE_DOT } from '../lib/tones'
import type { SensorLog } from '../lib/types'

// 지도 범례와 상태 분포에 쓰는 순서
const LEGEND: { tone: Tone; label: string }[] = [
  { tone: 'flooded', label: LEVEL_STATUS.FLOODED.label },
  { tone: 'wet', label: LEVEL_STATUS.WET.label },
  { tone: 'dry', label: LEVEL_STATUS.DRY.label },
  { tone: 'over', label: LEVEL_STATUS.OVERFLOODED.label },
  { tone: 'stale', label: '통신 끊김' },
]

export default function ControlPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const fields = useFields()
  const nodes = useNodes()
  const latestQuery = useLatestLogs()
  const alerts = useAlerts()
  const [hoverId, setHoverId] = useState<number | null>(null)

  const latest = useMemo<Record<number, SensorLog>>(
    () => Object.fromEntries((latestQuery.data ?? []).map((l) => [l.node_id, l])),
    [latestQuery.data],
  )
  const summaries = useMemo(
    () => summarizeFields(fields.data ?? [], nodes.data ?? [], latest),
    [fields.data, nodes.data, latest],
  )

  const allNodes = nodes.data ?? []
  const activeNodes = summaries.reduce((n, s) => n + s.activeNodes, 0)
  const unresolved = (alerts.data ?? []).filter((a) => !a.is_resolved)
  const nodeTones = allNodes.map((n) => currentStatus(latest[n.id]?.inner_water_level, latest[n.id]?.measured_at).tone)

  // 모든 필지 경계(없으면 좌표)가 들어오게 지도 범위를 맞춤
  const bounds = useMemo<LatLngBoundsExpression | null>(() => {
    const pts: [number, number][] = []
    for (const s of summaries) {
      const polys = s.field.boundary?.coordinates ?? []
      for (const poly of polys) for (const [lng, lat] of poly[0]) pts.push([lat, lng])
      if (!polys.length) pts.push([s.field.latitude, s.field.longitude])
    }
    if (!pts.length) return null
    const lats = pts.map((p) => p[0]), lngs = pts.map((p) => p[1])
    return [[Math.min(...lats), Math.min(...lngs)], [Math.max(...lats), Math.max(...lngs)]]
  }, [summaries])

  const loading = fields.isPending || nodes.isPending || latestQuery.isPending
  const failed = fields.isError || nodes.isError || latestQuery.isError
  const updatedAt = latestQuery.dataUpdatedAt ? new Date(latestQuery.dataUpdatedAt) : null

  return (
    <div className="flex h-full flex-col lg:flex-row">
      {/* 지도 */}
      <div className="relative h-[55vh] min-h-[320px] lg:h-full lg:flex-1">
        <VworldMap bounds={bounds}>
          {summaries.filter((s) => s.field.boundary).map((s) => {
            const color = TONE_HEX[s.status.tone]
            const active = hoverId === s.field.id
            return (
              <GeoJSON
                key={`${s.field.id}-${s.status.tone}-${active}`}
                data={s.field.boundary!}
                style={{ color, weight: active ? 3.5 : 2, fillColor: color, fillOpacity: active ? 0.32 : 0.18 }}
                eventHandlers={{
                  click: () => navigate(`/fields/${s.field.id}`),
                  mouseover: () => setHoverId(s.field.id),
                  mouseout: () => setHoverId(null),
                }}
              >
                <Tooltip sticky>
                  <b>{s.field.field_name}</b> · {s.status.label}
                  {s.level !== null && <> · {formatLevel(s.level)}cm</>}
                </Tooltip>
              </GeoJSON>
            )
          })}
          {allNodes.map((n, i) => (
            <CircleMarker
              key={n.id}
              center={[n.latitude, n.longitude]}
              radius={7}
              pathOptions={{ color: '#ffffff', weight: 2, fillColor: TONE_HEX[nodeTones[i]], fillOpacity: 1 }}
              eventHandlers={{ click: () => navigate(`/fields/${n.field_id}`) }}
            >
              <Tooltip direction="top" offset={[0, -6]} permanent>
                <span className="font-semibold">{nodeLabel(n)}</span>{' '}
                {latest[n.id] ? `${formatLevel(latest[n.id].inner_water_level)}cm` : '-'}
              </Tooltip>
            </CircleMarker>
          ))}
        </VworldMap>

        <div className="absolute bottom-3 left-3 z-[1000] flex flex-wrap gap-x-3 gap-y-1 rounded-lg bg-white/95 px-3 py-2 text-xs text-soil-700 shadow-md ring-1 ring-soil-300">
          {LEGEND.map((l) => (
            <span key={l.tone} className="inline-flex items-center gap-1.5">
              <span className={clsx('size-2.5 rounded-sm', TONE_DOT[l.tone])} />
              {l.label}
            </span>
          ))}
        </div>
      </div>

      {/* 옆 패널 */}
      <aside className="flex w-full flex-col gap-4 overflow-y-auto border-soil-300/70 bg-soil-100 p-4 lg:w-[400px] lg:border-l">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold">관제</h1>
            <p className="mt-1 text-xs text-soil-600">
              {updatedAt ? `${updatedAt.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })} 기준 · 1분마다 갱신` : '불러오는 중'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => queryClient.invalidateQueries()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-soil-300 bg-white px-2.5 py-1.5 text-xs font-medium text-soil-700 hover:bg-soil-50"
          >
            <RefreshCw className={clsx('size-3.5', latestQuery.isFetching && 'animate-spin')} /> 새로고침
          </button>
        </div>

        {failed && (
          <p className="rounded-lg bg-clay-100 px-3 py-2 text-sm text-clay-700">서버에서 데이터를 받지 못했어요. 잠시 후 새로고침해 주세요.</p>
        )}

        <Card className="grid grid-cols-3 divide-x divide-soil-200 py-3">
          <SummaryCell label="필지" value={`${summaries.length}`} unit="개" />
          <SummaryCell label="수신 중 센서" value={`${activeNodes}/${allNodes.length}`} unit="대" alert={activeNodes < allNodes.length} />
          <SummaryCell label="미해결 알림" value={`${unresolved.length}`} unit="건" alert={unresolved.length > 0} />
        </Card>

        <StatusDistribution tones={nodeTones} />

        <Card>
          <CardHeader title="필지" aside={<span className="text-xs text-soil-500">{loading ? '불러오는 중' : `${summaries.length}개`}</span>} />
          <ul className="divide-y divide-soil-200">
            {summaries.map((s) => (
              <FieldRow key={s.field.id} s={s} active={hoverId === s.field.id} onHover={setHoverId} />
            ))}
            {!loading && summaries.length === 0 && (
              <li className="px-4 pb-4 text-sm text-soil-500">등록된 필지가 없어요. 관리 메뉴에서 논을 추가해 주세요.</li>
            )}
          </ul>
        </Card>

        <Card>
          <CardHeader
            title="미해결 알림"
            aside={<Link to="/alerts" className="inline-flex items-center gap-1 text-xs font-medium text-rain-600 hover:underline">전체 보기 <ArrowRight className="size-3" /></Link>}
          />
          <ul className="divide-y divide-soil-200">
            {unresolved.slice(0, 5).map((a) => (
              <li key={a.id} className="flex items-start gap-3 px-4 py-3">
                <StatusBadge tone={ALERT_META[a.alert_type].tone}>{ALERT_META[a.alert_type].label}</StatusBadge>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{a.node_name ?? `Node ${a.node_id}`} <span className="font-normal text-soil-500">{a.water_level}cm</span></p>
                  <p className="truncate text-xs text-soil-500">{timeAgo(a.created_at)} · {a.message}</p>
                </div>
              </li>
            ))}
            {unresolved.length === 0 && <li className="px-4 pb-4 text-sm text-soil-500">미해결 알림이 없어요.</li>}
          </ul>
        </Card>
      </aside>
    </div>
  )
}

function SummaryCell({ label, value, unit, alert }: { label: string; value: string; unit: string; alert?: boolean }) {
  return (
    <div className="px-3 text-center">
      <p className="text-[11px] text-soil-600">{label}</p>
      <p className={clsx('mt-1 font-display text-xl font-bold tabular-nums', alert ? 'text-clay-600' : 'text-forest-800')}>
        {value}<span className="ml-0.5 font-sans text-xs font-medium text-soil-500">{unit}</span>
      </p>
    </div>
  )
}

// 노드 상태 분포를 막대 하나로 (어느 상태가 몇 대인지 한눈에)
function StatusDistribution({ tones }: { tones: Tone[] }) {
  const total = tones.length
  const counts = LEGEND.map((l) => ({ ...l, n: tones.filter((t) => t === l.tone).length })).filter((c) => c.n > 0)
  if (total === 0) return null
  return (
    <Card className="px-4 py-3">
      <p className="mb-2 text-xs text-soil-600">센서 상태 분포</p>
      <div className="flex h-2.5 overflow-hidden rounded-full bg-soil-200">
        {counts.map((c) => (
          <div key={c.tone} className={TONE_DOT[c.tone]} style={{ width: `${(c.n / total) * 100}%` }} title={`${c.label} ${c.n}대`} />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-soil-700">
        {counts.map((c) => (
          <span key={c.tone} className="inline-flex items-center gap-1.5">
            <span className={clsx('size-2 rounded-full', TONE_DOT[c.tone])} />{c.label} <b className="tabular-nums">{c.n}</b>
          </span>
        ))}
      </div>
    </Card>
  )
}

function FieldRow({ s, active, onHover }: { s: FieldSummary; active: boolean; onHover: (id: number | null) => void }) {
  return (
    <li onMouseEnter={() => onHover(s.field.id)} onMouseLeave={() => onHover(null)}>
      <Link
        to={`/fields/${s.field.id}`}
        className={clsx('flex items-center gap-3 px-4 py-3 transition-colors hover:bg-sprout-100', active && 'bg-sprout-100')}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate font-semibold">{s.field.field_name}</p>
            <StatusBadge tone={s.status.tone}>{s.status.label}</StatusBadge>
          </div>
          <p className="mt-0.5 truncate text-xs text-soil-500">{s.field.jibun_addr ?? s.field.location_desc ?? '지번 정보 없음'}</p>
          <p className="mt-0.5 text-xs text-soil-500">센서 {s.nodes.length}대 · {s.lastMeasuredAt ? `${timeAgo(s.lastMeasuredAt)} 측정` : '측정 기록 없음'}</p>
        </div>
        <div className="text-right">
          {/* 통신이 끊겼으면 마지막 값을 흐리게 */}
          <p className={clsx('font-display text-xl font-bold tabular-nums', s.level === null && 'text-soil-400')}>
            {formatLevel(s.level ?? s.lastLevel)}
          </p>
          <p className="text-[11px] text-soil-500">cm</p>
        </div>
      </Link>
    </li>
  )
}
