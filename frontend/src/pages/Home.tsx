import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import TrendChart from '../components/dashboard/TrendChart'
import AlarmSummaryCard from '../components/dashboard/AlarmSummaryCard'
import FieldMap, { MapSensor } from '../components/map/FieldMap'
import { useFieldContext } from '../fieldContext'
import useIsMobile from '../useIsMobile'
import {
  DEFAULT_MAP_CENTER, DRY_LEVEL_CM, TARGET_LEVEL_CM, formatLevel, isStale, levelBadge, nodeLabel, timeAgo,
} from '../domain'
import { cardStyle } from '../styles'
import { Alert, Field, Node, NodeStats, SensorLog } from '../types'
import { getAlerts, getFields, getLatestLogs, getNodeLogs, getNodeStats, getNodes } from '../api'

const formatCm = (v: number | null | undefined) => (v === null || v === undefined ? '-' : `${v}cm`)

export default function Home() {
  const navigate = useNavigate()
  const { selectedFieldId, selectField } = useFieldContext()
  const isMobile = useIsMobile()

  const [fields, setFields] = useState<Field[]>([])
  const [nodes, setNodes] = useState<Node[]>([])
  const [latestLogs, setLatestLogs] = useState<Record<number, SensorLog>>({})
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [selectedNodeId, setSelectedNodeId] = useState<number | ''>('')
  const [logs, setLogs] = useState<SensorLog[]>([])
  const [stats, setStats] = useState<{ nodeId: number; data: NodeStats } | null>(null)

  useEffect(() => {
    Promise.all([getFields(), getNodes(), getLatestLogs()])
      .then(([fieldList, nodeList, latest]) => {
        setFields(fieldList)
        setNodes(nodeList)
        setLatestLogs(Object.fromEntries(latest.map((l) => [l.node_id, l])))
      })
      .catch((err) => console.error('대시보드 불러오기 실패', err))
  }, [])

  useEffect(() => {
    getAlerts(selectedFieldId)
      .then(setAlerts)
      .catch((err) => console.error('알람 불러오기 실패', err))
  }, [selectedFieldId])

  // 노드를 고르지 않았으면 선택한 논의 첫 노드(논도 안 골랐으면 전체 첫 노드)를 보여줌
  const fieldNodes = selectedFieldId ? nodes.filter((n) => n.field_id === selectedFieldId) : nodes
  const focusNode = nodes.find((n) => n.id === selectedNodeId) ?? fieldNodes[0]
  const focusNodeId = focusNode?.id

  useEffect(() => {
    if (focusNodeId === undefined) return
    getNodeLogs(focusNodeId, '1d')
      .then(setLogs)
      .catch((err) => console.error('수위 기록 불러오기 실패', err))
    getNodeStats(focusNodeId)
      .then((data) => setStats({ nodeId: focusNodeId, data }))
      .catch((err) => console.error('통계 불러오기 실패', err))
  }, [focusNodeId])

  const handleFieldSelect = (value: string) => {
    selectField(value ? Number(value) : null, fields)
    setSelectedNodeId('')
  }

  // 현재 수위: 30분 넘게 새 값이 없으면 수위 상태 대신 통신 끊김으로 표시
  const latest = focusNode ? latestLogs[focusNode.id] : undefined
  const stale = !!latest && isStale(latest.measured_at)
  const badge = levelBadge(latest?.inner_water_level, latest?.measured_at)
  const measuredText = latest ? `${timeAgo(latest.measured_at)} 측정` : ''
  const focusName = focusNode ? nodeLabel(focusNode) : '-'

  // 다른 노드로 바꾼 직후 이전 노드 데이터가 잠깐 보이지 않게 노드 번호로 거름
  const shownLogs = logs.filter((l) => l.node_id === focusNodeId)
  const chartData = shownLogs.map((l) => l.inner_water_level)
  const chartLabels = shownLogs.map((l) =>
    new Date(l.measured_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false }),
  )
  const shownStats = stats && stats.nodeId === focusNodeId ? stats.data : null

  // 수신 중·최근 측정은 고른 논의 노드 기준 (논을 안 고르면 전체)
  const fieldLatest = fieldNodes.map((n) => latestLogs[n.id]).filter((l): l is SensorLog => !!l)
  const latestMeasuredAt = fieldLatest.reduce<string | null>(
    (max, l) => (!max || l.measured_at > max ? l.measured_at : max), null,
  )
  const activeNodes = fieldLatest.filter((l) => !isStale(l.measured_at)).length
  const summaryItems = [
    { label: '수신 중', value: `${activeNodes} / ${fieldNodes.length}대`, danger: activeNodes < fieldNodes.length },
    { label: '최근 측정', value: timeAgo(latestMeasuredAt) },
  ]
  const unresolvedAlerts = alerts.filter((a) => !a.is_resolved)

  const selectedField = fields.find((f) => f.id === selectedFieldId) ?? fields[0]
  const mapCenter: [number, number] = selectedField ? [selectedField.latitude, selectedField.longitude] : DEFAULT_MAP_CENTER
  const mapSensors: MapSensor[] = nodes.map((n) => ({
    id: n.id,
    lat: n.latitude,
    lng: n.longitude,
    label: nodeLabel(n),
    level: latestLogs[n.id]?.inner_water_level ?? null,
  }))
  const mapFields = fields.map((f) => ({
    id: f.id,
    lat: f.latitude,
    lng: f.longitude,
    name: f.field_name,
    areaHa: f.area_ha,
    boundary: f.boundary,
  }))

  const selectStyle: React.CSSProperties = { flex: 1, minWidth: 0, width: '100%', boxSizing: 'border-box', fontSize: '14px', fontWeight: 500, padding: '9px 12px', borderRadius: '8px', border: '0.5px solid #e0e0e0', background: '#f5f5f5', color: '#222' }

  // 배치는 하나: 넓으면 2열, 좁으면(모바일) 같은 순서로 1열로 쌓임
  const twoCols = (left: string, right: string) => (isMobile ? '1fr' : `minmax(0, ${left}) minmax(0, ${right})`)

  return (
    <div style={{ padding: isMobile ? '12px 12px 24px' : '16px 24px 32px', maxWidth: '1200px', margin: '0 auto', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '12px' }}>

      {/* 1행: 논·노드 선택(왼쪽) + 요약 정보(오른쪽) */}
      <div style={{ ...cardStyle, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '6px', flex: '1 1 360px', maxWidth: '520px', minWidth: 0 }}>
          <select value={selectedFieldId ?? ''} onChange={(e) => handleFieldSelect(e.target.value)} style={selectStyle}>
            <option value="">전체 논 ({fields.length}개)</option>
            {fields.map((f) => <option key={f.id} value={f.id}>{f.field_name}</option>)}
          </select>
          <select value={selectedNodeId} onChange={(e) => setSelectedNodeId(e.target.value ? Number(e.target.value) : '')} style={selectStyle}>
            <option value="">전체 노드 ({fieldNodes.length}대)</option>
            {fieldNodes.map((n) => <option key={n.id} value={n.id}>{nodeLabel(n)}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', marginLeft: 'auto', justifyContent: 'flex-end', gap: isMobile ? '24px' : '40px', flexWrap: 'wrap' }}>
          {summaryItems.map((c) => (
            <div key={c.label} style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
              <span style={{ fontSize: '12px', color: '#888' }}>{c.label}</span>
              <span style={{ fontSize: '18px', fontWeight: 600, color: c.danger ? '#c62828' : '#222' }}>{c.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 2행: 현재 수위 + 지도 */}
      <div style={{ display: 'grid', gridTemplateColumns: twoCols('1fr', '2fr'), gridAutoRows: isMobile ? 'auto' : '300px', gap: '12px' }}>
        <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '14px' }}>
          <div>
            <p style={{ fontSize: '12px', color: '#888', marginBottom: '6px' }}>현재 수위 · {focusName}</p>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginBottom: '8px' }}>
              <span style={{ fontSize: '36px', fontWeight: 500, color: stale ? '#aaa' : '#222' }}>{formatLevel(latest?.inner_water_level)}</span>
              <span style={{ fontSize: '14px', color: '#888' }}>cm</span>
            </div>
            <span style={{
              display: 'inline-block', fontSize: '12px', padding: '3px 10px', borderRadius: '20px', fontWeight: 500,
              background: badge.color + '20', color: badge.color,
            }}>{badge.label}</span>
            {measuredText && <span style={{ fontSize: '11px', color: '#aaa', marginLeft: '8px' }}>{measuredText}</span>}
          </div>
          <div>
            <p style={{ fontSize: '12px', color: '#888', marginBottom: '8px' }}>24시간 통계</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '6px' }}>
              {[
                { label: '평균', value: formatCm(shownStats?.avg) },
                { label: '최고', value: formatCm(shownStats?.max) },
                { label: '최저', value: formatCm(shownStats?.min) },
              ].map((item) => (
                <div key={item.label} style={{ background: '#f5f5f5', borderRadius: '8px', padding: '8px 10px' }}>
                  <p style={{ fontSize: '10px', color: '#888', marginBottom: '4px' }}>{item.label}</p>
                  <p style={{ fontSize: '15px', fontWeight: 500 }}>{item.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ ...cardStyle, padding: '14px', display: 'flex', flexDirection: 'column', gap: '8px', height: isMobile ? '260px' : undefined }}>
          <div style={{ flex: 1, borderRadius: '8px', overflow: 'hidden', minHeight: 0 }}>
            {fields.length > 0 ? (
              <FieldMap sensors={mapSensors} center={mapCenter} fields={mapFields} selectedFieldId={selectedFieldId} />
            ) : (
              <div style={{ height: '100%', background: '#f5f5f5', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: '11px', color: '#888' }}>등록된 논이 없어요</span>
              </div>
            )}
          </div>
          <p onClick={() => navigate('/map')} style={{ fontSize: '11px', color: '#1D9E75', cursor: 'pointer', margin: 0 }}>지도 보기 →</p>
        </div>
      </div>

      {/* 3행: 수위 추이 + 알람 요약 */}
      <div style={{ display: 'grid', gridTemplateColumns: twoCols('2fr', '1fr'), gridAutoRows: isMobile ? 'auto' : '380px', gap: '12px' }}>
        <div style={{ ...cardStyle, padding: '14px', display: 'flex', flexDirection: 'column', height: isMobile ? '280px' : undefined }}>
          <p style={{ fontSize: '12px', color: '#888', marginBottom: '8px' }}>
            수위 추이 (24시간)
            <span style={{ fontSize: '10px', color: '#aaa', marginLeft: '8px' }}>
              <span style={{ color: '#E24B4A' }}>- -</span> 재관개 {DRY_LEVEL_CM}cm · <span style={{ color: '#378ADD' }}>- -</span> 목표 +{TARGET_LEVEL_CM}cm
            </span>
          </p>
          <div style={{ flex: 1, minHeight: 0 }}>
            <TrendChart data={chartData} labels={chartLabels} />
          </div>
        </div>
        <AlarmSummaryCard totalCount={alerts.length} unresolvedCount={unresolvedAlerts.length} unresolvedAlerts={unresolvedAlerts} />
      </div>

    </div>
  )
}
