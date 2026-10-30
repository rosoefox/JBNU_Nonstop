// 논(필지) 단위 요약: 노드 여러 개의 최신값을 모아 논 하나의 상태로
import { currentStatus, type Tone } from './domain'
import type { Field, Node, SensorLog } from './types'

// 여러 노드 중 가장 주의가 필요한 상태를 논의 대표 상태로 씀
const PRIORITY: Tone[] = ['dry', 'over', 'stale', 'wet', 'flooded', 'none']

export interface FieldSummary {
  field: Field
  nodes: Node[]
  status: { label: string; tone: Tone }
  level: number | null // 수신 중인 센서들의 평균 수위
  lastLevel: number | null // 통신이 끊겼어도 마지막으로 받은 값들의 평균
  lastMeasuredAt: string | null
  activeNodes: number
}

export function summarizeFields(fields: Field[], nodes: Node[], latest: Record<number, SensorLog>): FieldSummary[] {
  return fields.map((field) => {
    const fieldNodes = nodes.filter((n) => n.field_id === field.id)
    const statuses = fieldNodes.map((n) => currentStatus(latest[n.id]?.inner_water_level, latest[n.id]?.measured_at))
    const fresh = fieldNodes.filter((_, i) => statuses[i].tone !== 'stale' && statuses[i].tone !== 'none')
    const levels = fresh.map((n) => latest[n.id].inner_water_level)
    const lastLevels = fieldNodes.map((n) => latest[n.id]?.inner_water_level).filter((v): v is number => v !== undefined)
    const times = fieldNodes.map((n) => latest[n.id]?.measured_at).filter((t): t is string => !!t).sort()
    const status = statuses.length === 0
      ? { label: '센서 없음', tone: 'none' as Tone }
      : statuses.reduce((worst, s) => (PRIORITY.indexOf(s.tone) < PRIORITY.indexOf(worst.tone) ? s : worst))
    return {
      field,
      nodes: fieldNodes,
      status,
      level: average(levels),
      lastLevel: average(lastLevels),
      lastMeasuredAt: times.at(-1) ?? null,
      activeNodes: fresh.length,
    }
  })
}

const average = (values: number[]) =>
  values.length ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10 : null
