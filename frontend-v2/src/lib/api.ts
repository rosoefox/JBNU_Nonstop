import type { Alert, AwdSummary, Field, FieldMrv, Node, NodeStats, Period, SensorLog } from './types'

import { fetchParcel, type Parcel } from './vworld'

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  if (!res.ok) {
    let detail = res.statusText
    try {
      const body = await res.json()
      detail = typeof body.detail === 'string' ? body.detail : JSON.stringify(body.detail)
    } catch {
      // 응답 본문이 JSON이 아니면 상태 문구 그대로 사용
    }
    throw new ApiError(res.status, detail)
  }
  return res.json()
}

export interface FieldCreate {
  field_name: string
  location_desc: string | null
  latitude: number
  longitude: number
  area_ha: number | null
}

export interface FieldUpdate {
  field_name?: string
  location_desc?: string | null
  area_ha?: number | null
}

export interface NodeCreate {
  field_id: number
  node_name: string
  dev_eui: string
  latitude: number
  longitude: number
  location_desc: string | null
  has_pump: boolean
}

export interface NodeUpdate {
  node_name?: string
  location_desc?: string | null
  has_pump?: boolean
}

export const getFields = () => request<Field[]>('/fields')

export const createField = (body: FieldCreate) =>
  request<Field>('/fields', { method: 'POST', body: JSON.stringify(body) })

export const updateField = (fieldId: number, body: FieldUpdate) =>
  request<Field>(`/fields/${fieldId}`, { method: 'PATCH', body: JSON.stringify(body) })

// 브라우저가 V-WORLD에서 받은 필지 경계를 논에 저장 (vworld.ts fetchParcel 참고)
export const saveParcel = (fieldId: number, parcel: Parcel) =>
  request<Field>(`/fields/${fieldId}/parcel`, { method: 'PUT', body: JSON.stringify(parcel) })

// 논 좌표로 필지를 찾아서 저장까지
export const loadParcel = async (field: Pick<Field, 'id' | 'latitude' | 'longitude'>) =>
  saveParcel(field.id, await fetchParcel(field.latitude, field.longitude))

export const getNodes = () => request<Node[]>('/nodes')

export const createNode = (body: NodeCreate) =>
  request<Node>('/nodes', { method: 'POST', body: JSON.stringify(body) })

export const updateNode = (nodeId: number, body: NodeUpdate) =>
  request<Node>(`/nodes/${nodeId}`, { method: 'PATCH', body: JSON.stringify(body) })

export const getLatestLogs = () => request<SensorLog[]>('/nodes/latest')

export const getNodeLogs = (nodeId: number, period: Period) =>
  request<SensorLog[]>(`/nodes/${nodeId}/logs?period=${period}`)

export const getNodeStats = (nodeId: number) => request<NodeStats>(`/nodes/${nodeId}/stats`)

export const getNodeAwd = (nodeId: number, period: Period) =>
  request<AwdSummary>(`/nodes/${nodeId}/awd?period=${period}`)

export const getAlerts = (fieldId?: number | null) =>
  request<Alert[]>(fieldId ? `/alerts?field_id=${fieldId}` : '/alerts')

export const resolveAlert = (alertId: number, note?: string) =>
  request<Alert>(`/alerts/${alertId}/resolve`, { method: 'PATCH', body: JSON.stringify({ note: note ?? null }) })

// start, end: 'YYYY-MM-DD' (한국 날짜, 시작·종료일 포함). 감축량 계산은 서버에서 함
export const getFieldMrv = (fieldId: number, start: string, end: string, sfP: number, sfO: number) =>
  request<FieldMrv>(`/fields/${fieldId}/mrv?start=${start}&end=${end}&sf_p=${sfP}&sf_o=${sfO}`)
