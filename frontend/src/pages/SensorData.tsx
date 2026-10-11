import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import SensorChart from '../components/sensor/SensorChart'
import SensorStats, { SensorStatus } from '../components/sensor/SensorStats'
import AwdIndicatorGrid from '../components/sensor/AwdIndicatorGrid'
import {
  DRY_LEVEL_CM, TARGET_LEVEL_CM, WATER_REGIMES, classifyLevel, isStale, nodeLabel, pumpStatus, statusColor, statusLabel, timeAgo,
} from '../domain'
import { pillStyle } from '../styles'
import { AwdSummary, Field, Node, NodeStats, Period, SensorLog } from '../types'
import { useFieldContext } from '../fieldContext'
import { getFields, getLatestLogs, getNodeAwd, getNodeLogs, getNodeStats, getNodes } from '../api'

const timeRanges: { label: string; value: Period }[] = [
  { label: '1시간', value: '1h' },
  { label: '1일', value: '1d' },
  { label: '1주', value: '1w' },
  { label: '1개월', value: '1m' },
]

const formatLabel = (iso: string, period: Period) => {
  const d = new Date(iso)
  if (period === '1h' || period === '1d') {
    return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })
  }
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}시`
}

export default function SensorData() {
  const { selectedFieldId, selectField } = useFieldContext()
  const [fields, setFields] = useState<Field[]>([])
  const [nodes, setNodes] = useState<Node[]>([])
  const [latestLogs, setLatestLogs] = useState<Record<number, SensorLog>>({})
  // 알람 화면의 "그래프 보기"로 들어오면 해당 노드와 기간을 미리 선택
  const linked = useLocation().state as { nodeId?: number; period?: Period } | null
  const [selectedNodeId, setSelectedNodeId] = useState<number | null>(linked?.nodeId ?? null)
  const [period, setPeriod] = useState<Period>(linked?.period ?? '1d')
  const [logs, setLogs] = useState<SensorLog[]>([])
  const [stats, setStats] = useState<{ nodeId: number; data: NodeStats } | null>(null)
  const [awd, setAwd] = useState<{ key: string; data: AwdSummary } | null>(null)
  const [tableLoading, setTableLoading] = useState(true)

  useEffect(() => {
    Promise.all([getFields(), getNodes(), getLatestLogs()])
      .then(([fieldList, nodeList, latest]) => {
        setFields(fieldList)
        setNodes(nodeList)
        setLatestLogs(Object.fromEntries(latest.map((l) => [l.node_id, l])))
      })
      .catch((err) => console.error('센서 데이터 불러오기 실패', err))
      .finally(() => setTableLoading(false))
  }, [])

  useEffect(() => {
    if (selectedNodeId === null) return
    getNodeLogs(selectedNodeId, period)
      .then(setLogs)
      .catch((err) => console.error('수위 기록 불러오기 실패', err))
  }, [selectedNodeId, period])

  useEffect(() => {
    if (selectedNodeId === null) return
    getNodeStats(selectedNodeId)
      .then((data) => setStats({ nodeId: selectedNodeId, data }))
      .catch((err) => console.error('통계 불러오기 실패', err))
  }, [selectedNodeId])

  const awdKey = `${selectedNodeId}-${period}`
  useEffect(() => {
    if (selectedNodeId === null) return
    getNodeAwd(selectedNodeId, period)
      .then((data) => setAwd({ key: `${selectedNodeId}-${period}`, data }))
      .catch((err) => console.error('낙수 횟수 불러오기 실패', err))
  }, [selectedNodeId, period])
  // 노드나 기간을 바꾼 직후 이전 결과가 잠깐 보이지 않게 거름
  const shownAwd = awd && awd.key === awdKey ? awd.data : null
  const shownStats = stats && stats.nodeId === selectedNodeId ? stats.data : null
  const periodLabel = timeRanges.find((t) => t.value === period)?.label ?? ''

  const handleFieldSelect = (fieldId: number | null) => {
    selectField(fieldId, fields)
    setSelectedNodeId(null)
  }

  const fieldNodes = nodes.filter((n) => n.field_id === selectedFieldId)
  const selectedNode = nodes.find((n) => n.id === selectedNodeId)
  const latest = selectedNodeId !== null ? latestLogs[selectedNodeId] : undefined

  const singleMode = selectedNodeId !== null
  const datasets = selectedNode && logs.length > 0
    ? [{ nodeId: selectedNode.id, label: nodeLabel(selectedNode), data: logs.map((l) => l.inner_water_level) }]
    : []
  const chartLabels = logs.map((l) => formatLabel(l.measured_at, period))

  const sensorStatus: SensorStatus = !latest
    ? '측정 기록 없음'
    : isStale(latest.measured_at)
      ? '통신 끊김'
      : latest.inner_water_level <= DRY_LEVEL_CM || latest.inner_water_level > TARGET_LEVEL_CM
        ? '수위 이상'
        : '정상'

  return (
    <div style={{ padding: '16px', maxWidth: '1200px', margin: '0 auto', boxSizing: 'border-box' }}>
      <h2 style={{ fontSize: '18px', fontWeight: 500, marginBottom: '16px' }}>센서 데이터</h2>

      {/* 필터 */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
        <select
          value={selectedFieldId ?? ''}
          onChange={(e) => handleFieldSelect(e.target.value ? Number(e.target.value) : null)}
          style={{ fontSize: '13px', padding: '7px 12px', borderRadius: '8px', border: '0.5px solid #ccc', background: 'white', cursor: 'pointer', flex: '1 1 120px' }}
        >
          <option value="">논 선택</option>
          {fields.map((f) => <option key={f.id} value={f.id}>{f.field_name}</option>)}
        </select>

        <select
          value={selectedNodeId ?? ''}
          onChange={(e) => setSelectedNodeId(e.target.value ? Number(e.target.value) : null)}
          disabled={!selectedFieldId}
          style={{ fontSize: '13px', padding: '7px 12px', borderRadius: '8px', border: '0.5px solid #ccc', background: 'white', cursor: selectedFieldId ? 'pointer' : 'not-allowed', opacity: selectedFieldId ? 1 : 0.5, flex: '1 1 120px' }}
        >
          <option value="">노드 선택</option>
          {fieldNodes.map((n) => (
            <option key={n.id} value={n.id}>
              {nodeLabel(n)}{n.location_desc ? ` · ${n.location_desc}` : ''}
            </option>
          ))}
        </select>

        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {timeRanges.map((t) => (
            <button
              key={t.value}
              onClick={() => setPeriod(t.value)}
              style={{
                fontSize: '12px', padding: '5px 10px', borderRadius: '20px',
                border: '0.5px solid #ccc', cursor: 'pointer',
                background: period === t.value ? '#1D9E75' : 'white',
                color: period === t.value ? 'white' : '#888',
                fontWeight: period === t.value ? 500 : 400,
                whiteSpace: 'nowrap',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* 노드별 최신 측정 데이터 테이블 */}
      {selectedFieldId && (
        <div style={{ background: 'white', border: '0.5px solid #e0e0e0', borderRadius: '12px', padding: '16px', marginBottom: '16px', overflowX: 'auto' }}>
          <p style={{ fontSize: '13px', fontWeight: 500, marginBottom: '12px' }}>노드별 최신 측정 데이터</p>
          {tableLoading ? (
            <p style={{ fontSize: '13px', color: '#aaa', textAlign: 'center', padding: '12px 0' }}>불러오는 중...</p>
          ) : fieldNodes.length === 0 ? (
            <p style={{ fontSize: '13px', color: '#aaa', textAlign: 'center', padding: '12px 0' }}>이 논에 등록된 노드가 없어요</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', minWidth: '400px' }}>
              <thead>
                <tr style={{ borderBottom: '0.5px solid #e0e0e0' }}>
                  {['노드', '수위', '펌프', '배터리', '최근 측정', '상태'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '8px 10px', fontSize: '11px', color: '#888', fontWeight: 500, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {fieldNodes.map((node) => {
                  const log = latestLogs[node.id]
                  const currentStatus = classifyLevel(log?.inner_water_level)
                  const pump = pumpStatus(node.has_pump, log?.pump_on)
                  return (
                    <tr
                      key={node.id}
                      onClick={() => setSelectedNodeId(node.id)}
                      style={{
                        borderBottom: '0.5px solid #f0f0f0',
                        cursor: 'pointer',
                        background: selectedNodeId === node.id ? '#f0faf6' : 'white',
                      }}
                    >
                      <td style={{ padding: '10px', fontWeight: 500, whiteSpace: 'nowrap' }}>{nodeLabel(node)}</td>
                      <td style={{ padding: '10px', whiteSpace: 'nowrap' }}>{log ? `${log.inner_water_level}cm` : '-'}</td>
                      <td style={{ padding: '10px', whiteSpace: 'nowrap', fontSize: '12px', fontWeight: 500, color: pump.fg }}>
                        {pump.label}
                      </td>
                      <td style={{ padding: '10px', whiteSpace: 'nowrap' }}>{log?.battery_voltage != null ? `${log.battery_voltage}V` : '-'}</td>
                      <td style={{ padding: '10px', color: '#888', fontSize: '12px', whiteSpace: 'nowrap' }}>
                        {log ? new Date(log.measured_at).toLocaleString('ko-KR') : '-'}
                        {log && isStale(log.measured_at) && (
                          <span style={{ marginLeft: '6px', color: '#f57f17', fontWeight: 600 }}>통신 끊김</span>
                        )}
                      </td>
                      <td style={{ padding: '10px' }}>
                        <span style={pillStyle(statusColor(currentStatus) + '20', statusColor(currentStatus), 11)}>
                          {statusLabel(currentStatus)}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* 그래프 + 통계 */}
      {!selectedFieldId ? (
        <div style={{ textAlign: 'center', padding: '48px', color: '#aaa', fontSize: '14px', background: 'white', borderRadius: '12px', border: '0.5px solid #e0e0e0' }}>
          논을 선택하면 수위 데이터가 표시됩니다
        </div>
      ) : !selectedNodeId ? (
        <div style={{ textAlign: 'center', padding: '48px', color: '#aaa', fontSize: '14px', background: 'white', borderRadius: '12px', border: '0.5px solid #e0e0e0' }}>
          노드를 선택하면 그래프가 표시됩니다
        </div>
      ) : (
        <>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: '12px'
        }}>
          <SensorChart datasets={datasets} labels={chartLabels} singleMode={singleMode} />
          {shownStats && (
            <SensorStats
              currentLevel={latest?.inner_water_level ?? null}
              sensorStatus={sensorStatus}
              updatedText={latest ? `업데이트 ${timeAgo(latest.measured_at)}` : '측정 기록 없음'}
              avg={shownStats.avg}
              max={shownStats.max}
              min={shownStats.min}
              alarmCount={shownStats.alert_count}
            />
          )}
        </div>
          {shownAwd && (
            <div style={{ marginTop: '12px', background: 'white', border: '0.5px solid #e0e0e0', borderRadius: '12px', padding: '16px' }}>
              <p style={{ fontSize: '13px', fontWeight: 500, marginBottom: '12px' }}>
                AWD 물관리 판정 <span style={{ color: '#888', fontWeight: 400 }}>· 선택 기간({periodLabel}) 기준</span>
              </p>
              {shownAwd.sample_count === 0 ? (
                <p style={{ fontSize: '13px', color: '#aaa', textAlign: 'center', padding: '8px 0' }}>이 기간에 측정 기록이 없어요</p>
              ) : (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '8px' }}>
                    {[
                      { label: '낙수 횟수', value: `${shownAwd.drain_events}회` },
                      { label: '물관리 구분', value: `${WATER_REGIMES[shownAwd.water_regime].label} (${WATER_REGIMES[shownAwd.water_regime].rule})` },
                      { label: '물관리 계수 (SF_w)', value: shownAwd.sf_w.toFixed(2) },
                      { label: '마지막 낙수', value: shownAwd.last_drain_at ? timeAgo(shownAwd.last_drain_at) : '-' },
                    ].map((item) => (
                      <div key={item.label} style={{ background: '#f5f5f5', borderRadius: '8px', padding: '10px 12px' }}>
                        <p style={{ fontSize: '11px', color: '#888', marginBottom: '4px' }}>{item.label}</p>
                        <p style={{ fontSize: '16px', fontWeight: 500 }}>{item.value}</p>
                      </div>
                    ))}
                  </div>
                  <AwdIndicatorGrid indicators={shownAwd.indicators} />
                  <p style={{ fontSize: '11px', color: '#999', marginTop: '10px', lineHeight: 1.6 }}>
                    낙수 = 수위가 {DRY_LEVEL_CM}cm 이하까지 내려간 횟수예요. 이 횟수로 Gold Standard 방법론(IPCC 기본값) 탄소감축량 계산의
                    물관리 계수를 정해요: 0회 1.00 · 1회 0.71 · 2회 이상 0.55. 실제 보고서는 재배 시즌 전체 기준으로 계산해요.
                    준수율 = {DRY_LEVEL_CM}cm 도달 후 {shownAwd.indicators.compliance_hours}시간 안에 재관개한 비율,
                    가동률 = 받은 측정 수 ÷ 받아야 할 측정 수 ({shownAwd.indicators.expected_uplink_minutes}분 주기 기준).
                  </p>
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
