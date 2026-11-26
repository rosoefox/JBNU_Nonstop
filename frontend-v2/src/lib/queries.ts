// 서버 데이터 불러오기 (TanStack Query). 관제 화면이라 주기적으로 새로 받아옴
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { getAlerts, getExperimentMode, getFields, getLatestLogs, getNodeAwd, getNodeLogs, getNodeStats, getNodes } from './api'
import type { DataScope } from './dataScope'
import { summarizeFields } from './fieldSummary'
import type { Period, SensorLog } from './types'

const REFRESH_MS = 60_000 // 1분마다 최신값
const LIVE_MS = 5_000 // 실험 모드: 수위·그래프·알림·지표 모두 5초마다 (시연 때 바로 보이게)

// 실험 모드면 짧게, 운영 모드면 1분
export function useLiveRefresh(liveMs = LIVE_MS): number {
  const { data } = useExperimentMode()
  return data?.experiment_mode ? liveMs : REFRESH_MS
}

export const useFields = () => {
  const scope = useDataScope()
  return useQuery({ queryKey: ['fields', scope], queryFn: () => getFields(scope) })
}

export const useExperimentMode = () =>
  useQuery({ queryKey: ['experiment-mode'], queryFn: getExperimentMode, refetchInterval: REFRESH_MS })

// 화면 전체가 볼 데이터: 실험 모드면 실험 데이터만, 운영 모드에서는 실제 데이터만 (논·센서·측정·알림 모두)
export function useDataScope(): DataScope {
  const { data } = useExperimentMode()
  return data?.experiment_mode ? 'experiment' : 'real'
}

export const useNodes = () => {
  const scope = useDataScope()
  return useQuery({ queryKey: ['nodes', scope], queryFn: () => getNodes(scope) })
}

export const useLatestLogs = () => {
  const scope = useDataScope()
  const refresh = useLiveRefresh()
  return useQuery({ queryKey: ['latest', scope], queryFn: () => getLatestLogs(scope), refetchInterval: refresh })
}

export const useAlerts = (fieldId?: number | null) => {
  const scope = useDataScope()
  const refresh = useLiveRefresh()
  return useQuery({ queryKey: ['alerts', fieldId ?? 'all', scope], queryFn: () => getAlerts(fieldId, scope), refetchInterval: refresh })
}

// 서버와 DB 연결까지 확인 (/health/db)
export const useServerHealth = () =>
  useQuery({
    queryKey: ['health'],
    queryFn: async () => {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'}/health/db`)
      if (!res.ok) throw new Error('DB 연결 안 됨')
      return true
    },
    refetchInterval: REFRESH_MS,
    retry: 1,
  })

export const useNodeLogs = (nodeId: number | undefined, period: Period) => {
  const scope = useDataScope()
  const refresh = useLiveRefresh()
  return useQuery({
    queryKey: ['logs', nodeId, period, scope],
    queryFn: () => getNodeLogs(nodeId!, period, scope),
    enabled: nodeId !== undefined,
    refetchInterval: refresh,
  })
}

export const useNodeStats = (nodeId: number | undefined) => {
  const scope = useDataScope()
  const { data } = useExperimentMode()
  // 실험 모드에서만 5초마다 (운영 모드는 화면을 다시 볼 때 갱신)
  return useQuery({ queryKey: ['stats', nodeId, scope], queryFn: () => getNodeStats(nodeId!, scope), enabled: nodeId !== undefined,
    refetchInterval: data?.experiment_mode ? LIVE_MS : false })
}

export const useNodeAwd = (nodeId: number | undefined, period: Period) => {
  const scope = useDataScope()
  const { data } = useExperimentMode()
  return useQuery({ queryKey: ['awd', nodeId, period, scope], queryFn: () => getNodeAwd(nodeId!, period, scope), enabled: nodeId !== undefined,
    refetchInterval: data?.experiment_mode ? LIVE_MS : false })
}

// 노드별 최신값을 노드 번호로 바로 찾을 수 있게
export function useLatestMap() {
  const query = useLatestLogs()
  const map = useMemo<Record<number, SensorLog>>(
    () => Object.fromEntries((query.data ?? []).map((l) => [l.node_id, l])),
    [query.data],
  )
  return { ...query, map }
}

// 관제·필지 화면이 같이 쓰는 필지 요약
export function useFieldSummaries() {
  const fields = useFields()
  const nodes = useNodes()
  const latest = useLatestMap()
  const summaries = useMemo(
    () => summarizeFields(fields.data ?? [], nodes.data ?? [], latest.map),
    [fields.data, nodes.data, latest.map],
  )
  return {
    summaries,
    fields, nodes, latest,
    isPending: fields.isPending || nodes.isPending || latest.isPending,
    isError: fields.isError || nodes.isError || latest.isError,
  }
}
