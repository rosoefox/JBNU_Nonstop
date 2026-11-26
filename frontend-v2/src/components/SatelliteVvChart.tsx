// 위성 VV 값 그래프: 날짜별 VV 중앙값 + 담수·습윤·낙수 구간 음영. 점을 누르면 그 날짜를 선택
import {
  CartesianGrid, Line, LineChart, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import type { SatelliteObservation } from '../lib/api'

// 판정 기준 (서버 config.json의 flooded_vv_max, drained_vv_min과 같게 유지)
export const FLOODED_VV_MAX = -14
export const DRAINED_VV_MIN = -12

const COLOR = {
  flooded: '#11615b', // rain-600
  uncertain: '#8c857f', // soil-500
  drained: '#b49034', // mustard-500
} as const
const STATUS_KO = { flooded: '담수', uncertain: '습윤', drained: '낙수' } as const

interface Point {
  t: number
  v: number
  date: string
  status: SatelliteObservation['status']
  statusKo: string
  sceneId: string
}

const tick = (t: number) => {
  const d = new Date(t)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

export default function SatelliteVvChart({ observations, selectedId, onSelect, height = 300 }: {
  observations: SatelliteObservation[]
  selectedId: string
  onSelect: (sceneId: string) => void
  height?: number
}) {
  const points: Point[] = observations
    .filter((o) => o.VV_median != null)
    .map((o) => ({ t: Date.parse(o.timestamp), v: Number(o.VV_median!.toFixed(2)), date: o.date, status: o.status, statusKo: STATUS_KO[o.status], sceneId: o.scene_id }))
    .sort((a, b) => a.t - b.t)
  if (points.length === 0) return null

  const values = points.map((p) => p.v)
  const min = Math.min(FLOODED_VV_MAX - 4, Math.floor(Math.min(...values) - 1))
  const max = Math.max(DRAINED_VV_MIN + 4, Math.ceil(Math.max(...values) + 1))

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 12, right: 20, bottom: 0, left: -4 }}>
          <CartesianGrid stroke="#f1f1ec" vertical={false} />
          {/* 판정 구간 음영 */}
          <ReferenceArea y1={min} y2={FLOODED_VV_MAX} fill="#eaf5f5" fillOpacity={0.9} ifOverflow="hidden"
            label={{ value: '담수 구간', position: 'insideBottomLeft', fill: COLOR.flooded, fontSize: 11, fontWeight: 600 }} />
          <ReferenceArea y1={FLOODED_VV_MAX} y2={DRAINED_VV_MIN} fill="#f1f1ec" fillOpacity={0.9} ifOverflow="hidden"
            label={{ value: '습윤', position: 'insideLeft', fill: COLOR.uncertain, fontSize: 11, fontWeight: 600 }} />
          <ReferenceArea y1={DRAINED_VV_MIN} y2={max} fill="#f3efe3" fillOpacity={0.9} ifOverflow="hidden"
            label={{ value: '낙수 구간', position: 'insideTopLeft', fill: COLOR.drained, fontSize: 11, fontWeight: 600 }} />
          <ReferenceLine y={FLOODED_VV_MAX} stroke={COLOR.flooded} strokeDasharray="5 4"
            label={{ value: `담수 기준 ${FLOODED_VV_MAX} dB`, position: 'insideBottomRight', fill: COLOR.flooded, fontSize: 11 }} />
          <ReferenceLine y={DRAINED_VV_MIN} stroke={COLOR.drained} strokeDasharray="5 4"
            label={{ value: `낙수 기준 ${DRAINED_VV_MIN} dB`, position: 'insideTopRight', fill: COLOR.drained, fontSize: 11 }} />
          <XAxis dataKey="t" type="number" scale="time" domain={['dataMin', 'dataMax']} tickFormatter={tick} padding={{ left: 16, right: 16 }}
            tick={{ fontSize: 11, fill: '#8c857f' }} axisLine={{ stroke: '#d5d2cb' }} tickLine={false} minTickGap={32} />
          <YAxis domain={[min, max]} allowDecimals={false} tick={{ fontSize: 11, fill: '#8c857f' }} axisLine={false} tickLine={false}
            unit=" dB" width={56} />
          <Tooltip
            cursor={{ stroke: '#d5d2cb' }}
            contentStyle={{ borderRadius: 8, borderColor: '#d5d2cb', fontSize: 12 }}
            labelFormatter={(_, payload) => {
              const p = payload?.[0]?.payload as Point | undefined
              return p ? `${p.date} 촬영 · ${p.statusKo}` : ''
            }}
            formatter={(v) => [`${v} dB`, 'VV 값']}
          />
          <Line dataKey="v" stroke="#6b7468" strokeWidth={1.5} type="linear" isAnimationActive={false}
            dot={(props) => {
              const { cx, cy, payload } = props as { cx?: number; cy?: number; payload: Point }
              if (cx == null || cy == null) return <g key={payload.sceneId} />
              const selected = payload.sceneId === selectedId
              return (
                <g key={payload.sceneId} style={{ cursor: 'pointer' }} onClick={() => onSelect(payload.sceneId)}>
                  {selected && <circle cx={cx} cy={cy} r={9} fill="none" stroke={COLOR[payload.status]} strokeWidth={2} />}
                  <circle cx={cx} cy={cy} r={5} fill={COLOR[payload.status]} stroke="#fff" strokeWidth={1.5} />
                </g>
              )
            }}
            activeDot={{ r: 7 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
