// 서버 데이터 불러오기 (TanStack Query). 관제 화면이라 주기적으로 새로 받아옴
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { getAlerts, getExperimentMode, getFields, getLatestLogs, getNodeAwd, getNodeLogs, getNodeStats, getNodes } from './api'
import { useDataScope } from './dataScope'
import { summarizeFields } from './fieldSummary'
import type { Period, SensorLog } from './types'

const REFRESH_MS = 60_000 // 1분마다 최신값

export const useFields = () => useQuery({ queryKey: ['fields'], queryFn: getFields })

export const useExperimentMode = () =>
  useQuery({ queryKey: ['experiment-mode'], queryFn: getExperimentMode, refetchInterval: REFRESH_MS })

export const useNodes = () => useQuery({ queryKey: ['nodes'], queryFn: getNodes })

export const useLatestLogs = () => {
  const scope = useDataScope()
  return useQuery({ queryKey: ['latest', scope], queryFn: () => getLatestLogs(scope), refetchInterval: REFRESH_MS })
}

export const useAlerts = (fieldId?: number | null) => {
  const scope = useDataScope()
  return useQuery({ queryKey: ['alerts', fieldId ?? 'all', scope], queryFn: () => getAlerts(fieldId, scope), refetchInterval: REFRESH_MS })
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
  return useQuery({
    queryKey: ['logs', nodeId, period, scope],
    queryFn: () => getNodeLogs(nodeId!, period, scope),
    enabled: nodeId !== undefined,
    refetchInterval: REFRESH_MS,
  })
}

export const useNodeStats = (nodeId: number | undefined) => {
  const scope = useDataScope()
  return useQuery({ queryKey: ['stats', nodeId, scope], queryFn: () => getNodeStats(nodeId!, scope), enabled: nodeId !== undefined })
}

export const useNodeAwd = (nodeId: number | undefined, period: Period) => {
  const scope = useDataScope()
  return useQuery({ queryKey: ['awd', nodeId, period, scope], queryFn: () => getNodeAwd(nodeId!, period, scope), enabled: nodeId !== undefined })
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
