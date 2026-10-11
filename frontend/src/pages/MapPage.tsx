import { useState, useEffect, useCallback } from 'react'
import FieldMap, { MapSensor } from '../components/map/FieldMap'
import MapPanel from '../components/map/MapPanel'
import { FieldInfoSensor } from '../components/map/FieldInfo'
import { DEFAULT_MAP_CENTER, formatLevel, levelBadge, nodeLabel, pumpStatus, timeAgo } from '../domain'
import { pillStyle } from '../styles'
import { Field, Node, SensorLog } from '../types'
import { useFieldContext } from '../fieldContext'
import useIsMobile from '../useIsMobile'
import { ApiError, getFields, getLatestLogs, getNodes, updateNode } from '../api'

const BOTTOM_PANEL_HEIGHT = 350

export default function MapPage() {
  const { selectedFieldId, selectField, selectedRegion, setSelectedRegion } = useFieldContext()
  const isMobile = useIsMobile()
  const [fields, setFields] = useState<Field[]>([])
  const [nodes, setNodes] = useState<Node[]>([])
  const [latestLogs, setLatestLogs] = useState<Record<number, SensorLog>>({})
  const [isPanelOpen, setIsPanelOpen] = useState(true)
  const [selectedNodeId, setSelectedNodeId] = useState<number | null>(null)
  const [pumpSavingId, setPumpSavingId] = useState<number | null>(null)
  const [pumpError, setPumpError] = useState('')

  const fetchFields = useCallback(() => {
    getFields()
      .then(setFields)
      .catch((err) => console.error('논 목록 불러오기 실패', err))
  }, [])

  const fetchNodes = useCallback(() => {
    getNodes()
      .then(setNodes)
      .catch((err) => console.error('노드 목록 불러오기 실패', err))
    getLatestLogs()
      .then((latest) => setLatestLogs(Object.fromEntries(latest.map((l) => [l.node_id, l]))))
      .catch((err) => console.error('최신 수위 불러오기 실패', err))
  }, [])

  useEffect(() => {
    fetchFields()
    fetchNodes()
  }, [fetchFields, fetchNodes])

  const handleFieldSelect = (id: number | null) => selectField(id, fields)

  // 패널 센서 목록에서 노드별 펌프 연결 여부를 켜고 끔
  const togglePump = async (nodeId: number) => {
    const node = nodes.find((n) => n.id === nodeId)
    if (!node) return
    setPumpSavingId(nodeId)
    setPumpError('')
    try {
      const updated = await updateNode(nodeId, { has_pump: !node.has_pump })
      setNodes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)))
    } catch (err) {
      setPumpError(err instanceof ApiError ? err.message : '펌프 설정을 저장하지 못했어요')
    } finally {
      setPumpSavingId(null)
    }
  }

  const selectedField = fields.find((f) => f.id === selectedFieldId)

  const mapSensors: MapSensor[] = nodes.map((n) => ({
    id: n.id,
    lat: n.latitude,
    lng: n.longitude,
    label: nodeLabel(n),
    level: latestLogs[n.id]?.inner_water_level ?? null,
    pumpOn: latestLogs[n.id]?.pump_on ?? null,
  }))

  const fieldInfoSensors: FieldInfoSensor[] = nodes.filter((n) => n.field_id === selectedFieldId).map((n) => ({
    id: n.id,
    name: nodeLabel(n),
    latest_level: latestLogs[n.id]?.inner_water_level ?? null,
    measured_at: latestLogs[n.id]?.measured_at ?? null,
    has_pump: n.has_pump,
    pump_on: latestLogs[n.id]?.pump_on ?? null,
  }))

  // 지도에서 고른 노드 카드 (간단히 보는 용도)
  const selectedNode = nodes.find((n) => n.id === selectedNodeId)
  const selectedLog = selectedNode ? latestLogs[selectedNode.id] : undefined
  const selectedLevel = levelBadge(selectedLog?.inner_water_level, selectedLog?.measured_at)
  const selectedPump = pumpStatus(!!selectedNode?.has_pump, selectedLog?.pump_on)

  // PC(왼쪽 패널)와 모바일(아래 패널)이 같이 쓰는 값
  const panelProps = {
    fields,
    selectedFieldId,
    selectedRegion,
    onRegionSelect: setSelectedRegion,
    onFieldsRefresh: fetchFields,
    onNodesRefresh: fetchNodes,
    sensors: fieldInfoSensors,
    fieldName: selectedField?.field_name ?? '',
    onTogglePump: togglePump,
    pumpSavingId,
    pumpError,
    onFieldUpdated: (updated: Field) => setFields((prev) => prev.map((f) => (f.id === updated.id ? updated : f))),
  }

  return (
    <div style={{ position: 'fixed', top: '48px', left: 0, right: 0, bottom: 0 }}>
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0,
        bottom: isMobile && isPanelOpen ? `${BOTTOM_PANEL_HEIGHT}px` : 0,
        zIndex: 1,
        transition: 'bottom 0.3s ease',
      }}>
        <FieldMap
          sensors={mapSensors}
          center={selectedField ? [selectedField.latitude, selectedField.longitude] : DEFAULT_MAP_CENTER}
          onNodeClick={(node) => setSelectedNodeId(node.id)}
          selectedNodeId={selectedNodeId}
          fields={fields.map((f) => ({
            id: f.id,
            lat: f.latitude,
            lng: f.longitude,
            name: f.field_name,
            areaHa: f.area_ha,
            boundary: f.boundary,
          }))}
          selectedFieldId={selectedFieldId}
          onFieldClick={handleFieldSelect}
        />
      </div>

      {!isMobile && (
        <>
          <div style={{
            position: 'absolute', top: 0, left: 0, bottom: 0,
            width: isPanelOpen ? '360px' : '0px',
            background: 'white',
            borderRight: isPanelOpen ? '0.5px solid #e0e0e0' : 'none',
            overflowY: 'auto', overflowX: 'hidden',
            transition: 'width 0.3s ease', zIndex: 10,
            boxShadow: isPanelOpen ? '2px 0 8px rgba(0,0,0,0.1)' : 'none',
          }}>
            {isPanelOpen && (
              <MapPanel {...panelProps} onFieldSelect={handleFieldSelect} />
            )}
          </div>
          <button
            onClick={() => setIsPanelOpen(!isPanelOpen)}
            style={{
              position: 'absolute',
              left: isPanelOpen ? '360px' : '0px',
              top: '50%', transform: 'translateY(-50%)',
              zIndex: 1000, background: 'white',
              border: '0.5px solid #e0e0e0', borderLeft: 'none',
              borderRadius: '0 8px 8px 0', width: '24px', height: '48px',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '14px', color: '#555', transition: 'left 0.3s ease',
              boxShadow: '2px 0 6px rgba(0,0,0,0.15)', padding: 0,
            }}
          >
            {isPanelOpen ? '‹' : '›'}
          </button>
        </>
      )}

      {isMobile && (
        <>
          <button
            onClick={() => setIsPanelOpen(!isPanelOpen)}
            style={{
              position: 'absolute',
              bottom: isPanelOpen ? `${BOTTOM_PANEL_HEIGHT}px` : '0px',
              left: '50%', transform: 'translateX(-50%)',
              zIndex: 1000, background: 'white',
              border: '0.5px solid #e0e0e0', borderBottom: 'none',
              borderRadius: '8px 8px 0 0', width: '60px', height: '24px',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '12px', color: '#555', transition: 'bottom 0.3s ease',
              boxShadow: '0 -2px 6px rgba(0,0,0,0.1)', padding: 0,
            }}
          >
            {isPanelOpen ? '∨' : '∧'}
          </button>

          <div style={{
            position: 'absolute',
            bottom: 0, left: 0, right: 0,
            height: isPanelOpen ? `${BOTTOM_PANEL_HEIGHT}px` : '0px',
            background: 'white',
            borderTop: '0.5px solid #e0e0e0',
            overflowY: 'auto', overflowX: 'hidden',
            transition: 'height 0.3s ease',
            zIndex: 10,
            boxShadow: '0 -2px 8px rgba(0,0,0,0.1)',
          }}>
            <MapPanel
              {...panelProps}
              onFieldSelect={(id) => {
                handleFieldSelect(id)
                setIsPanelOpen(false)
              }}
            />
          </div>
        </>
      )}

      {selectedNode && (
        <div style={{
          position: 'absolute',
          bottom: isMobile ? (isPanelOpen ? `${BOTTOM_PANEL_HEIGHT + 8}px` : '36px') : '24px',
          right: isMobile ? '8px' : '24px',
          zIndex: 1000, background: 'white',
          borderRadius: '12px',
          border: '0.5px solid #e0e0e0', padding: '16px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
          minWidth: '200px',
          transition: 'bottom 0.3s ease',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <p style={{ fontSize: '14px', fontWeight: 600 }}>{nodeLabel(selectedNode)}</p>
            <button onClick={() => setSelectedNodeId(null)}
              style={{ fontSize: '16px', border: 'none', background: 'none', cursor: 'pointer', color: '#aaa', padding: 0 }}>✕</button>
          </div>
          <p style={{ fontSize: '11px', color: '#888', marginBottom: '10px' }}>{selectedNode.location_desc || `DevEUI ${selectedNode.dev_eui}`}</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div style={{ background: '#f5f5f5', borderRadius: '8px', padding: '8px 12px' }}>
              <p style={{ fontSize: '10px', color: '#888', marginBottom: '2px' }}>수위</p>
              <p style={{ fontSize: '16px', fontWeight: 500 }}>
                {selectedLog ? `${formatLevel(selectedLog.inner_water_level)}cm` : '-'}
              </p>
            </div>
            <div style={{ background: '#f5f5f5', borderRadius: '8px', padding: '8px 12px' }}>
              <p style={{ fontSize: '10px', color: '#888', marginBottom: '2px' }}>상태</p>
              <p style={{ fontSize: '13px', fontWeight: 500, color: selectedLevel.color }}>{selectedLevel.label}</p>
            </div>
          </div>
          <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
            <span style={pillStyle(selectedPump.bg, selectedPump.fg)}>{selectedPump.label}</span>
            <span style={{ fontSize: '11px', color: '#aaa', whiteSpace: 'nowrap' }}>
              {selectedLog ? `${timeAgo(selectedLog.measured_at)} 측정 기준` : '측정 기록 없음'}
            </span>
          </div>

        </div>
      )}
    </div>
  )
}
