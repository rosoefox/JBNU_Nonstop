// 수위 그래프: 노드별 선 + AWD 운영 구간(-15 ~ +5cm) 음영 + 재관개·목표 기준선
import {
  CartesianGrid, Legend, Line, LineChart, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { DRY_LEVEL_CM, TARGET_LEVEL_CM } from '../lib/domain'
import type { Period } from '../lib/types'

export interface LevelSeries {
  id: number
  name: string
  color: string
  points: { t: number; v: number }[]
}

const formatTick = (period: Period) => (t: number) => {
  const d = new Date(t)
  return period === '1h' || period === '1d'
    ? d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })
    : `${d.getMonth() + 1}/${d.getDate()}`
}

export default function LevelChart({ series, period, height = 300 }: { series: LevelSeries[]; period: Period; height?: number }) {
  const hasData = series.some((s) => s.points.length > 0)
  if (!hasData) {
    return <div className="flex items-center justify-center text-sm text-soil-500" style={{ height }}>이 기간에 측정 기록이 없어요</div>
  }
  const values = series.flatMap((s) => s.points.map((p) => p.v))
  const min = Math.min(DRY_LEVEL_CM - 5, Math.floor(Math.min(...values) - 2))
  const max = Math.max(TARGET_LEVEL_CM + 5, Math.ceil(Math.max(...values) + 2))

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart margin={{ top: 8, right: 16, bottom: 0, left: -12 }}>
          <CartesianGrid stroke="#f1f1ec" vertical={false} />
          <ReferenceArea y1={DRY_LEVEL_CM} y2={TARGET_LEVEL_CM} fill="#e0ecc3" fillOpacity={0.45} ifOverflow="hidden" />
          <ReferenceLine y={DRY_LEVEL_CM} stroke="#ca3232" strokeDasharray="5 4"
            label={{ value: `재관개 ${DRY_LEVEL_CM}cm`, position: 'insideBottomRight', fill: '#ca3232', fontSize: 11 }} />
          <ReferenceLine y={TARGET_LEVEL_CM} stroke="#11615b" strokeDasharray="5 4"
            label={{ value: `목표 +${TARGET_LEVEL_CM}cm`, position: 'insideTopRight', fill: '#11615b', fontSize: 11 }} />
          <XAxis dataKey="t" type="number" scale="time" domain={['dataMin', 'dataMax']} tickFormatter={formatTick(period)}
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
            <Line key={s.id} data={s.points} dataKey="v" name={s.name} stroke={s.color} strokeWidth={2} dot={false}
              isAnimationActive={false} type="monotone" />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
