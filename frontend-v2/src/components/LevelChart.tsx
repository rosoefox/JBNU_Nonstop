// 수위 그래프: 노드별 선 + AWD 운영 구간(-15 ~ +5cm) 음영 + 재관개·목표 기준선
import {
  CartesianGrid, Legend, Line, LineChart, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { useState } from 'react'
import { DRY_LEVEL_CM, TARGET_LEVEL_CM } from '../lib/domain'
import type { Period } from '../lib/types'

export interface LevelSeries {
  id: number
  name: string
  color: string
  points: { t: number; v: number }[]
}

// 시각 표시: 1시간·1일(또는 2일이 안 되는 전체 기간)은 시:분, 그 밖에는 월/일
const formatTick = (period: Period, spanMs: number) => (t: number) => {
  const d = new Date(t)
  return period === '1h' || period === '1d' || (period === 'all' && spanMs < 2 * 86400000)
    ? d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })
    : `${d.getMonth() + 1}/${d.getDate()}`
}

// 데이터가 끊긴 구간은 선을 이어 그리지 않음: 평소 간격(중앙값)의 5배, 최소 10분보다 길게 빈 곳에 빈 점을 넣음
const MIN_GAP_MS = 10 * 60 * 1000
function withGaps(points: { t: number; v: number }[]): { t: number; v: number | null }[] {
  if (points.length < 3) return points
  const gaps = points.slice(1).map((p, i) => p.t - points[i].t).sort((a, b) => a - b)
  const limit = Math.max(MIN_GAP_MS, gaps[Math.floor(gaps.length / 2)] * 5)
  const out: { t: number; v: number | null }[] = [points[0]]
  for (let i = 1; i < points.length; i++) {
    if (points[i].t - points[i - 1].t > limit) out.push({ t: (points[i].t + points[i - 1].t) / 2, v: null })
    out.push(points[i])
  }
  return out
}

// 확대 배율: 1이면 전체, 2면 절반 구간만 보여주고 슬라이더로 옮겨 봄
const ZOOMS = [1, 2, 4, 8]

export default function LevelChart({ series, period, height = 300 }: { series: LevelSeries[]; period: Period; height?: number }) {
  const [zoom, setZoom] = useState(1)
  const [pos, setPos] = useState(1) // 0 = 맨 앞, 1 = 맨 끝(최신). 맨 끝이면 새 데이터가 와도 따라감
  const hasData = series.some((s) => s.points.length > 0)
  if (!hasData) {
    return <div className="flex items-center justify-center text-sm text-soil-500" style={{ height }}>이 기간에 측정 기록이 없어요</div>
  }
  const values = series.flatMap((s) => s.points.map((p) => p.v))
  const min = Math.min(DRY_LEVEL_CM - 5, Math.floor(Math.min(...values) - 2))
  const max = Math.max(TARGET_LEVEL_CM + 5, Math.ceil(Math.max(...values) + 2))
  const times = series.flatMap((s) => s.points.map((p) => p.t))
  const t0 = Math.min(...times), t1 = Math.max(...times)
  const spanMs = t1 - t0
  // 지금 보이는 구간
  const viewMs = spanMs / zoom
  const from = t0 + (spanMs - viewMs) * pos
  const to = from + viewMs
  const visible = (pts: { t: number; v: number }[]) => {
    if (zoom === 1) return pts
    // 화면 양끝 바로 바깥 점 하나씩은 남겨서 선이 가장자리까지 이어지게
    const i0 = Math.max(0, pts.findIndex((p) => p.t >= from) - 1)
    let i1 = pts.findIndex((p) => p.t > to)
    i1 = i1 === -1 ? pts.length : i1 + 1
    return pts.slice(i0, i1)
  }
  const fmtRange = (t: number) => new Date(t).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })

  return (
    <div>
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart margin={{ top: 8, right: 16, bottom: 0, left: -12 }}>
          <CartesianGrid stroke="#f1f1ec" vertical={false} />
          <ReferenceArea y1={DRY_LEVEL_CM} y2={TARGET_LEVEL_CM} fill="#e0ecc3" fillOpacity={0.45} ifOverflow="hidden" />
          <ReferenceLine y={DRY_LEVEL_CM} stroke="#ca3232" strokeDasharray="5 4"
            label={{ value: `재관개 ${DRY_LEVEL_CM}cm`, position: 'insideBottomRight', fill: '#ca3232', fontSize: 11 }} />
          <ReferenceLine y={TARGET_LEVEL_CM} stroke="#11615b" strokeDasharray="5 4"
            label={{ value: `목표 +${TARGET_LEVEL_CM}cm`, position: 'insideTopRight', fill: '#11615b', fontSize: 11 }} />
          <XAxis dataKey="t" type="number" scale="time" domain={zoom === 1 ? ['dataMin', 'dataMax'] : [from, to]} allowDataOverflow
            tickFormatter={formatTick(period, zoom === 1 ? spanMs : Math.min(spanMs, viewMs))}
            tick={{ fontSize: 11, fill: '#8c857f' }} axisLine={{ stroke: '#d5d2cb' }} tickLine={false} minTickGap={40} />
          <YAxis domain={[min, max]} tick={{ fontSize: 11, fill: '#8c857f' }} axisLine={false} tickLine={false}
            tickFormatter={(v: number) => `${v}`} unit="cm" width={56} />
          <Tooltip
            labelFormatter={(t) => new Date(Number(t)).toLocaleString('ko-KR')}
            formatter={(v) => [`${v} cm`]}
            contentStyle={{ borderRadius: 8, borderColor: '#d5d2cb', fontSize: 12 }}
          />
          {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
          {series.map((s) => (
            <Line key={s.id} data={withGaps(visible(s.points))} dataKey="v" connectNulls={false} name={s.name} stroke={s.color} strokeWidth={2} dot={false}
              isAnimationActive={false} type="monotone" />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
    {/* 확대 + 좌우로 옮겨 보기 */}
    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-soil-500">
      <span>확대</span>
      {ZOOMS.map((z) => (
        <button key={z} type="button" onClick={() => setZoom(z)}
          className={`rounded px-2 py-0.5 ${zoom === z ? 'bg-soil-700 text-white' : 'bg-soil-100 hover:bg-soil-200'}`}>
          {z === 1 ? '전체' : `×${z}`}
        </button>
      ))}
      {zoom > 1 && (
        <>
          <input type="range" min={0} max={1000} value={Math.round(pos * 1000)} onChange={(e) => setPos(Number(e.target.value) / 1000)}
            className="min-w-[120px] flex-1 accent-[#11615b]" aria-label="그래프 구간 옮기기" />
          <span className="whitespace-nowrap">{fmtRange(from)} ~ {fmtRange(to)}</span>
        </>
      )}
    </div>
    </div>
  )
}
