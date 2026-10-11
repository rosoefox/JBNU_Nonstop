import { useState } from 'react'
import { REGIONS } from '../../data/regions'
import FieldInfo, { FieldInfoSensor } from './FieldInfo'
import ParcelInfo from './ParcelInfo'
import { Field } from '../../types'
import { ApiError, createField, createNode, loadParcel } from '../../api'

const EMPTY_FIELD = { field_name: '', latitude: '', longitude: '', area_ha: '', location_desc: '' }
const EMPTY_NODE = { field_id: '', node_name: '', dev_eui: '', latitude: '', longitude: '', location_desc: '', has_pump: false }

const failMessage = (err: unknown) =>
  err instanceof ApiError && err.status < 500
    ? `추가 실패: ${err.message}`
    : '추가 실패: 백엔드 서버가 켜져 있는지 확인해주세요'

interface MapPanelProps {
  fields: Field[]
  selectedFieldId: number | null
  selectedRegion: string
  onFieldSelect: (fieldId: number | null) => void
  onRegionSelect: (region: string) => void
  onFieldsRefresh: () => void
  onNodesRefresh: () => void
  sensors: FieldInfoSensor[]
  fieldName: string
  onTogglePump?: (nodeId: number) => void
  pumpSavingId?: number | null
  pumpError?: string
  onFieldUpdated?: (field: Field) => void
}

export default function MapPanel({
  fields, selectedFieldId, selectedRegion,
  onFieldSelect, onRegionSelect,
  onFieldsRefresh, onNodesRefresh, sensors, fieldName,
  onTogglePump, pumpSavingId, pumpError, onFieldUpdated,
}: MapPanelProps) {
  const [showAddField, setShowAddField] = useState(false)
  const [showAddNode, setShowAddNode] = useState(false)
  const [newField, setNewField] = useState(EMPTY_FIELD)
  const [newNode, setNewNode] = useState(EMPTY_NODE)
  const [addLoading, setAddLoading] = useState(false)
  const [message, setMessage] = useState('')

  const showMessage = (msg: string) => {
    setMessage(msg)
    setTimeout(() => setMessage(''), 4000)
  }

  const selectedField = fields.find((f) => f.id === selectedFieldId)

  const filteredFields = selectedRegion
    ? fields.filter(f => f.location_desc?.includes(selectedRegion))
    : fields

  const handleAddField = async () => {
    if (!newField.field_name || !newField.latitude || !newField.longitude) {
      showMessage('논 이름, 위도, 경도는 필수예요')
      return
    }
    const latitude = Number(newField.latitude)
    const longitude = Number(newField.longitude)
    const areaHa = newField.area_ha ? Number(newField.area_ha) : null
    if (Number.isNaN(latitude) || Number.isNaN(longitude) || (areaHa !== null && !(areaHa > 0))) {
      showMessage('추가 실패: 위도, 경도, 면적은 숫자로 입력해주세요')
      return
    }

    setAddLoading(true)
    try {
      const created = await createField({
        field_name: newField.field_name,
        location_desc: newField.location_desc || null,
        latitude,
        longitude,
        area_ha: areaHa,
      })
      // 새 논 좌표의 필지 경계도 바로 불러옴 (실패해도 논 등록은 유지, 패널에서 다시 불러올 수 있음)
      const parcelLoaded = await loadParcel(created).then(() => true, () => false)
      showMessage(parcelLoaded ? '논이 추가됐어요! (필지 경계 포함)' : '논이 추가됐어요! 필지 경계는 패널에서 다시 불러와 주세요')
      setNewField(EMPTY_FIELD)
      setShowAddField(false)
      onFieldsRefresh()
    } catch (err) {
      console.error(err)
      showMessage(failMessage(err))
    } finally {
      setAddLoading(false)
    }
  }

  // 노드는 보통 논 안에 있으니, 논을 고르면 위도·경도가 비어 있을 때 논 좌표로 채워줌
  const handleNodeFieldChange = (fieldId: string) => {
    const field = fields.find(f => f.id === Number(fieldId))
    setNewNode({
      ...newNode,
      field_id: fieldId,
      latitude: newNode.latitude || (field ? String(field.latitude) : ''),
      longitude: newNode.longitude || (field ? String(field.longitude) : ''),
    })
  }

  const handleAddNode = async () => {
    if (!newNode.field_id || !newNode.node_name.trim() || !newNode.dev_eui || !newNode.latitude || !newNode.longitude) {
      showMessage('논, 노드 이름, DevEUI, 위도, 경도는 필수예요')
      return
    }
    const devEui = newNode.dev_eui.replace(/[\s:-]/g, '').toUpperCase()
    if (!/^[0-9A-F]{16}$/.test(devEui)) {
      showMessage('추가 실패: DevEUI는 16자리 영문(A~F)·숫자예요')
      return
    }
    const latitude = Number(newNode.latitude)
    const longitude = Number(newNode.longitude)
    if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
      showMessage('추가 실패: 위도, 경도는 숫자로 입력해주세요')
      return
    }

    setAddLoading(true)
    try {
      await createNode({
        field_id: Number(newNode.field_id),
        node_name: newNode.node_name.trim(),
        dev_eui: devEui,
        latitude,
        longitude,
        location_desc: newNode.location_desc || null,
        has_pump: newNode.has_pump,
      })
      showMessage('노드가 추가됐어요!')
      setNewNode(EMPTY_NODE)
      setShowAddNode(false)
      onNodesRefresh()
    } catch (err) {
      console.error(err)
      showMessage(failMessage(err))
    } finally {
      setAddLoading(false)
    }
  }

  const inputStyle = {
    width: '100%', fontSize: '12px', padding: '7px 10px',
    borderRadius: '6px', border: '0.5px solid #ccc',
    background: 'white', boxSizing: 'border-box' as const,
    marginBottom: '8px',
  }

  const btnStyle = (color = '#1D9E75') => ({
    fontSize: '12px', padding: '7px 14px', borderRadius: '6px',
    border: 'none', cursor: 'pointer', background: color, color: 'white', fontWeight: 500,
  })

  return (
    <div style={{ padding: '16px', minWidth: '320px' }}>
      {message && (
        <div style={{
          fontSize: '12px', padding: '8px 12px', borderRadius: '6px',
          background: message.includes('실패') || message.includes('필수') ? '#fce4ec' : '#e8f5e9',
          color: message.includes('실패') || message.includes('필수') ? '#c62828' : '#2e7d32',
          marginBottom: '12px',
        }}>
          {message}
        </div>
      )}

      <div style={{ marginBottom: '16px' }}>
        <p style={{ fontSize: '11px', color: '#888', marginBottom: '8px', fontWeight: 500 }}>추가</p>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
          <button onClick={() => { setShowAddField(!showAddField); setShowAddNode(false) }}
            style={{ ...btnStyle(), flex: 1 }}>+ 논 추가</button>
          <button onClick={() => { setShowAddNode(!showAddNode); setShowAddField(false) }}
            style={{ ...btnStyle('#378ADD'), flex: 1 }}>+ 노드 추가</button>
        </div>
        {showAddField && (
          <div style={{ background: '#f9f9f9', borderRadius: '8px', padding: '12px', marginBottom: '8px' }}>
            <p style={{ fontSize: '12px', fontWeight: 500, marginBottom: '8px' }}>논 추가</p>
            <input placeholder="논 이름 *" value={newField.field_name}
              onChange={e => setNewField({ ...newField, field_name: e.target.value })} style={inputStyle} />
            <input placeholder="위도 * (예: 35.8468)" value={newField.latitude}
              onChange={e => setNewField({ ...newField, latitude: e.target.value })} style={inputStyle} />
            <input placeholder="경도 * (예: 127.1294)" value={newField.longitude}
              onChange={e => setNewField({ ...newField, longitude: e.target.value })} style={inputStyle} />
            <input placeholder="면적 ha (예: 0.5)" inputMode="decimal" value={newField.area_ha}
              onChange={e => setNewField({ ...newField, area_ha: e.target.value })} style={inputStyle} />
            <select value={newField.location_desc}
              onChange={e => setNewField({ ...newField, location_desc: e.target.value })} style={inputStyle}>
              <option value="">지역 선택</option>
              {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={handleAddField} disabled={addLoading} style={{ ...btnStyle(), flex: 1 }}>
                {addLoading ? '추가 중...' : '추가'}
              </button>
              <button onClick={() => setShowAddField(false)} style={{ ...btnStyle('#888'), flex: 1 }}>취소</button>
            </div>
          </div>
        )}
        {showAddNode && (
          <div style={{ background: '#f9f9f9', borderRadius: '8px', padding: '12px', marginBottom: '8px' }}>
            <p style={{ fontSize: '12px', fontWeight: 500, marginBottom: '8px' }}>노드 추가</p>
            <select value={newNode.field_id}
              onChange={e => handleNodeFieldChange(e.target.value)} style={inputStyle}>
              <option value="">논 선택 *</option>
              {fields.map(f => <option key={f.id} value={f.id}>{f.field_name}</option>)}
            </select>
            <input placeholder="노드 이름 * (예: 노드 2번)" value={newNode.node_name}
              onChange={e => setNewNode({ ...newNode, node_name: e.target.value })} style={inputStyle} />
            <input placeholder="DevEUI * (16자리, TTN 콘솔에서 확인)" value={newNode.dev_eui}
              onChange={e => setNewNode({ ...newNode, dev_eui: e.target.value })} style={inputStyle} />
            <input placeholder="위도 *" value={newNode.latitude}
              onChange={e => setNewNode({ ...newNode, latitude: e.target.value })} style={inputStyle} />
            <input placeholder="경도 *" value={newNode.longitude}
              onChange={e => setNewNode({ ...newNode, longitude: e.target.value })} style={inputStyle} />
            <input placeholder="설명" value={newNode.location_desc}
              onChange={e => setNewNode({ ...newNode, location_desc: e.target.value })} style={inputStyle} />
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#555', marginBottom: '10px', cursor: 'pointer' }}>
              <input type="checkbox" checked={newNode.has_pump}
                onChange={e => setNewNode({ ...newNode, has_pump: e.target.checked })} />
              펌프 연결됨 (자동 재관개 사용)
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={handleAddNode} disabled={addLoading} style={{ ...btnStyle('#378ADD'), flex: 1 }}>
                {addLoading ? '추가 중...' : '추가'}
              </button>
              <button onClick={() => setShowAddNode(false)} style={{ ...btnStyle('#888'), flex: 1 }}>취소</button>
            </div>
          </div>
        )}
      </div>

      <div style={{ marginBottom: '16px' }}>
        <p style={{ fontSize: '11px', color: '#888', marginBottom: '8px', fontWeight: 500 }}>지역 선택</p>
        <select value={selectedRegion}
          onChange={e => onRegionSelect(e.target.value)}
          style={{ ...inputStyle, marginBottom: '8px' }}>
          <option value="">전체 지역</option>
          {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
        </select>

        <p style={{ fontSize: '11px', color: '#888', marginBottom: '4px', fontWeight: 500 }}>논 선택</p>
        <select
          value={selectedFieldId ?? ''}
          onChange={e => onFieldSelect(e.target.value ? Number(e.target.value) : null)}
          style={inputStyle}
        >
          <option value="">전체 논</option>
          {filteredFields.map(f => (
            <option key={f.id} value={f.id}>{f.field_name}</option>
          ))}
        </select>
      </div>

      <div style={{ borderTop: '0.5px solid #f0f0f0', marginBottom: '16px' }} />

      {selectedField && <ParcelInfo field={selectedField} onUpdated={onFieldUpdated} />}

      <FieldInfo fieldName={fieldName} sensors={sensors} onTogglePump={onTogglePump} pumpSavingId={pumpSavingId} pumpError={pumpError} />
    </div>
  )
}