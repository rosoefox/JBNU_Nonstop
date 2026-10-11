import { useState } from 'react'
import { useFieldContext } from '../fieldContext'
import { Field, Node } from '../types'

const SURFACE_STATUS_OPTIONS = [
  { label: '물 있음', value: 'WATER_VISIBLE' },
  { label: '물 없음', value: 'NO_WATER_VISIBLE' },
  { label: '애매함', value: 'UNKNOWN' },
]

const SURFACE_STATUS_OPTIONS_AUTO = [
  { label: 'low', value: 'WATER_VISIBLE' },
  { label: 'mid', value: 'NO_WATER_VISIBLE' },
  { label: 'high', value: 'UNKNOWN' },
]

const STATUS_ALIAS_MAP: Record<string, string> = {
  WATER_VISIBLE: 'low',
  NO_WATER_VISIBLE: 'mid',
  UNKNOWN: 'high',
  LOW: 'low',
  MID: 'mid',
  HIGH: 'high',
}

function toAutoStatusLabel(raw?: string): string {
  const key = (raw ?? '').toUpperCase()
  return STATUS_ALIAS_MAP[key] ?? raw ?? '-'
}

const ANGLE_OPTIONS = ['수직', '좌', '우', '기타']
const DISTANCE_OPTIONS = ['50cm', '80cm', '110cm', '140cm', '170cm', '200cm', '기타']
const CONDITION_OPTIONS = ['햇빛 강함', '그림자 있음', '물 반사 있음', '흙 젖음', '흐림', '화질 흐림', '수초·벼 가림', '기타']

const STATUS_LABEL_MAP: Record<string, string> = {
  WATER_VISIBLE: '물있음',
  NO_WATER_VISIBLE: '물없음',
  UNKNOWN: '애매함',
}

function createImageTitle(observedStatus: string, angle: string, distance: string) {
  const statusLabel = STATUS_LABEL_MAP[observedStatus] ?? '상태미정'
  const parts = [statusLabel]
  if (angle) parts.push(angle)
  if (distance) parts.push(distance)
  return parts.join('_')
}

const NODE_ID_FOR_LOG = 7

export default function ValidationPage() {
  const { selectedFieldId, setSelectedFieldId, setSelectedRegion } = useFieldContext()
  const [tab, setTab] = useState<'field' | 'auto'>('field')
  const [latestLog] = useState<any>(null)

  const [fields] = useState<Field[]>([])
  const [nodes] = useState<Node[]>([])
  const [fieldId, setFieldId] = useState<number | ''>('')
  const [nodeId, setNodeId] = useState<number | ''>('')

  const [observedStatus, setObservedStatus] = useState('WATER_VISIBLE')
  const [angle, setAngle] = useState('')
  const [distance, setDistance] = useState('')
  const [conditions, setConditions] = useState<string[]>([])
  const [extraNote, setExtraNote] = useState('')
  const [recordDate, setRecordDate] = useState('')
  const [captureTime, setCaptureTime] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [uploadError] = useState('')
  const [uploadSuccess] = useState(false)

  const [records] = useState<any[]>([])
  const [analyzingId] = useState<number | null>(null)
  const [modalImage, setModalImage] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState('')
  const [filterDate, setFilterDate] = useState('')

  const [filterNodeId, setFilterNodeId] = useState<number | ''>('')
  const [filterNodes] = useState<any[]>([])

  const filteredRecords = records
  .filter(r => selectedFieldId ? r.field_id === selectedFieldId : true)
  .filter(r => filterNodeId ? r.node_id === Number(filterNodeId) : true)
  .filter(r => filterStatus ? toAutoStatusLabel(r.ai_predicted_status) === filterStatus : true)
  .filter(r => filterDate ? r.record_date === filterDate : true)

  const handleConditionToggle = (c: string) => {
    setConditions(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c])
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) {
      setFile(f)
      setPreview(URL.createObjectURL(f))
    }
  }

  const handleUpload = () => {
    // 백엔드 연동 전: UI만 유지, 실제 업로드 없음
    void createImageTitle
  }

  const handleAnalyze = (_id: number) => {
    // 백엔드 연동 전: UI만 유지, 실제 AI 분석 없음
  }

  const handleFilterFieldSelect = (value: string) => {
    const fieldId = value ? Number(value) : null
     setSelectedFieldId(fieldId)
     if (fieldId) {
       const field = fields.find(f => f.id === fieldId)
        if (field?.location_desc) setSelectedRegion(field.location_desc)
      }
    }

  const inputStyle = {
    fontSize: '13px', padding: '7px 12px', borderRadius: '8px',
    border: '0.5px solid #ccc', background: 'white', width: '100%',
    boxSizing: 'border-box' as const,
    color: '#333', // iOS Safari date/time input 텍스트 표시 버그 수정
  }

  const requiredInputStyle = {
    ...inputStyle,
    border: '0.5px solid #1D9E75',
  }

  const chipStyle = (selected: boolean) => ({
    fontSize: '12px', padding: '4px 10px', borderRadius: '20px',
    border: `0.5px solid ${selected ? '#1D9E75' : '#ccc'}`,
    background: selected ? '#e8f5e9' : 'white',
    color: selected ? '#1D9E75' : '#555',
    cursor: 'pointer',
  })

  return (
    <div style={{ padding: '16px', maxWidth: '1200px', margin: '0 auto', boxSizing: 'border-box' }}>
      <h2 style={{ fontSize: '18px', fontWeight: 500, marginBottom: '16px' }}>검증 사진</h2>

      {/* 탭 */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
        {[
          { key: 'field', label: '현장 테스트' },
          { key: 'auto', label: '자동 분석' },
        ].map((t) => (
          <button key={t.key} onClick={() => setTab(t.key as 'field' | 'auto')}
            style={{
              fontSize: '13px', padding: '7px 18px', borderRadius: '8px',
              border: 'none', cursor: 'pointer', fontWeight: 500,
              background: tab === t.key ? '#1D9E75' : '#f0f0f0',
              color: tab === t.key ? 'white' : '#888',
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'auto' ? (
        <>
          {/* 검증 사진 목록 */}
          <div style={{ background: 'white', border: '0.5px solid #e0e0e0', borderRadius: '12px', padding: '8px 16px' }}>
            <div style={{ display: 'flex', gap: '8px', padding: '8px 0 10px', borderBottom: '0.5px solid #f0f0f0', flexWrap: 'wrap' }}>
              <select
                value={selectedFieldId ?? ''}
                onChange={(e) => handleFilterFieldSelect(e.target.value)}
                style={{ fontSize: '13px', padding: '5px 8px', borderRadius: '8px', border: '0.5px solid #ccc', background: 'white', color: '#333' }}
              >
                <option value="">전체 논</option>
                {fields.map(f => (
                  <option key={f.id} value={f.id}>{f.field_name}</option>
                ))}
              </select>

              <select
                value={filterNodeId}
                onChange={(e) => setFilterNodeId(e.target.value ? Number(e.target.value) : '')}
                style={{ fontSize: '13px', padding: '5px 8px', borderRadius: '8px', border: '0.5px solid #ccc', background: 'white', color: '#333' }}
              >
                <option value="">전체 노드</option>
                {filterNodes.map(n => (
                  <option key={n.id} value={n.id}>Node {n.id}</option>
                ))}
              </select>

              <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
                style={{ fontSize: '13px', padding: '5px 8px', borderRadius: '8px', border: '0.5px solid #ccc', background: 'white', color: '#333' }}>
                <option value="">전체 상태</option>
                {SURFACE_STATUS_OPTIONS_AUTO.map(s => (
                  <option key={s.label} value={s.label}>{s.label}</option>
                ))}
              </select>
              <input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)}
                style={{ fontSize: '12px', padding: '5px 8px', borderRadius: '8px', border: '0.5px solid #ccc', background: 'white', minWidth: '130px', color: '#333' }} />
              {(selectedFieldId || filterNodeId || filterStatus || filterDate) && (
                <button onClick={() => {
                    setSelectedFieldId(null)
                    setFilterNodeId('')
                    setFilterStatus('')
                    setFilterDate('')
                  }}
                  style={{ fontSize: '13px', padding: '5px 10px', borderRadius: '8px', border: '0.5px solid #ccc', background: 'white', cursor: 'pointer', color: '#888' }}>
                  초기화
                </button>
              )}
            </div>
            <p style={{ fontSize: '13px', color: '#888', padding: '8px 0 10px', borderBottom: '0.5px solid #f0f0f0' }}>
              검증 기록 총 {filteredRecords.length}건
            </p>
            {filteredRecords.length === 0 ? (
              <p style={{ fontSize: '14px', color: '#aaa', padding: '24px 0', textAlign: 'center' }}>검증 기록이 없습니다</p>
            ) : (
              filteredRecords.map((record, i) => (
                <div key={record.id} style={{
                  display: 'flex', gap: '12px', alignItems: 'flex-start',
                  padding: '14px 0', borderBottom: i < filteredRecords.length - 1 ? '0.5px solid #f0f0f0' : 'none',
                }}>
                  {record.image_url && (
                    <img
                      src={record.image_url}
                      alt="검증사진"
                      onClick={() => setModalImage(record.image_url)}
                      style={{ width: '72px', height: '72px', objectFit: 'cover', borderRadius: '8px', flexShrink: 0, cursor: 'pointer' }}
                    />
                  )}

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px', gap: '8px', flexWrap: 'wrap' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: '15px', fontWeight: 500, wordBreak: 'break-word', margin: 0 }}>
                          {record.image_title || '제목 없음'} · {record.record_date}
                        </p>
                        <p style={{ fontSize: '12px', color: '#666', margin: '2px 0' }}>
                          논: {fields.find(f => f.id === record.field_id)?.field_name ?? `Field ${record.field_id}`} · Node {record.node_id ?? '-'}
                        </p>
                      </div>

                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
                        {record.ai_sensor_match !== null && record.ai_sensor_match !== undefined && (
                          <span style={{
                            fontSize: '12px',
                            padding: '2px 8px',
                            borderRadius: '20px',
                            fontWeight: 500,
                            background: record.ai_sensor_match ? '#e8f5e9' : '#fce4ec',
                            color: record.ai_sensor_match ? '#2e7d32' : '#c62828',
                          }}>
                            {record.ai_sensor_match ? 'AI-센서 일치' : 'AI-센서 불일치'}
                          </span>
                        )}

                        <button
                          onClick={() => handleAnalyze(record.id)}
                          disabled={analyzingId === record.id}
                          style={{
                            fontSize: '12px',
                            padding: '4px 10px',
                            borderRadius: '8px',
                            border: '0.5px solid #1D9E75',
                            background: 'white',
                            cursor: 'pointer',
                            color: '#1D9E75',
                            opacity: analyzingId === record.id ? 0.6 : 1,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {analyzingId === record.id ? 'AI 분석 중...' : 'AI 분석'}
                        </button>
                      </div>
                    </div>

                    <p style={{ fontSize: '13px', color: '#888', marginBottom: '2px' }}>
                      사람: {SURFACE_STATUS_OPTIONS.find(s => s.value === record.observed_surface_status)?.label ?? record.observed_surface_status}
                      {record.ai_predicted_status && ` · AI: ${toAutoStatusLabel(record.ai_predicted_status)}`}
                      {record.ai_confidence != null && ` · 신뢰도 ${record.ai_confidence}%`}
                    </p>

                    {record.note && <p style={{ fontSize: '13px', color: '#aaa' }}>{record.note}</p>}

                    <p style={{ fontSize: '12px', color: '#bbb', marginTop: '2px' }}>
                      {new Date(record.created_at).toLocaleString('ko-KR')}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      ) : (
        <>
          {/* 최신 센서값 카드 */}
          <div style={{ background: 'white', border: '0.5px solid #e0e0e0', borderRadius: '12px', padding: '16px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <p style={{ fontSize: '13px', fontWeight: 500 }}>최신 LoRa 센서값 · Node {NODE_ID_FOR_LOG}</p>
              <button style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '8px', border: '0.5px solid #ccc', background: 'white', cursor: 'pointer' }}>
                새로고침
              </button>
            </div>
            {latestLog ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '8px' }}>
                {[
                  { label: '내부 수위', value: `${latestLog.inner_water_level}cm` },
                  { label: '배터리', value: `${latestLog.battery_voltage}V` },
                  { label: '측정 시간', value: new Date(latestLog.measured_at).toLocaleString('ko-KR') },
                ].map((item) => (
                  <div key={item.label} style={{ background: '#f5f5f5', borderRadius: '8px', padding: '8px 12px' }}>
                    <p style={{ fontSize: '10px', color: '#888', marginBottom: '2px' }}>{item.label}</p>
                    <p style={{ fontSize: '14px', fontWeight: 500 }}>{item.value}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: '13px', color: '#aaa', textAlign: 'center', padding: '12px 0' }}>센서 데이터 없음</p>
            )}
          </div>

          {/* 사진 업로드 폼 */}
          <div style={{ background: 'white', border: '0.5px solid #e0e0e0', borderRadius: '12px', padding: '16px', marginBottom: '16px' }}>
            <p style={{ fontSize: '13px', fontWeight: 500, marginBottom: '4px' }}>사진 업로드</p>
            <p style={{ fontSize: '11px', color: '#1D9E75', marginBottom: '12px' }}>* 표시는 필수 항목입니다</p>

            <div style={{ marginBottom: '10px' }}>
              <p style={{ fontSize: '11px', color: '#888', marginBottom: '4px' }}>논 선택 *</p>
              <select value={fieldId} onChange={(e) => { setFieldId(e.target.value ? Number(e.target.value) : ''); setNodeId('') }}
                style={requiredInputStyle}>
                <option value="">논 선택</option>
                {fields.map((f) => <option key={f.id} value={f.id}>{f.field_name}</option>)}
              </select>
            </div>

            <div style={{ marginBottom: '10px' }}>
              <p style={{ fontSize: '11px', color: '#888', marginBottom: '4px' }}>센서 노드 *</p>
              <select value={nodeId} onChange={(e) => setNodeId(e.target.value ? Number(e.target.value) : '')}
                disabled={!fieldId}
                style={{ ...requiredInputStyle, opacity: fieldId ? 1 : 0.5 }}>
                <option value="">노드 선택</option>
                {nodes.map((n) => <option key={n.id} value={n.id}>Node {n.id} · {n.location_desc}</option>)}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
              <div>
                <p style={{ fontSize: '11px', color: '#888', marginBottom: '4px' }}>촬영 날짜 *</p>
                <input type="date" value={recordDate} onChange={(e) => setRecordDate(e.target.value)} style={requiredInputStyle} />
              </div>
              <div>
                <p style={{ fontSize: '11px', color: '#888', marginBottom: '4px' }}>촬영 시각 *</p>
                <input type="time" value={captureTime} onChange={(e) => setCaptureTime(e.target.value)} style={requiredInputStyle} />
              </div>
            </div>

            <div style={{ marginBottom: '10px' }}>
              <p style={{ fontSize: '11px', color: '#888', marginBottom: '4px' }}>관찰 상태 *</p>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {SURFACE_STATUS_OPTIONS.map((s) => (
                  <button key={s.value} onClick={() => setObservedStatus(s.value)} style={chipStyle(observedStatus === s.value)}>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: '10px' }}>
              <p style={{ fontSize: '11px', color: '#888', marginBottom: '4px' }}>촬영 각도</p>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {ANGLE_OPTIONS.map((a) => (
                  <button key={a} onClick={() => setAngle(angle === a ? '' : a)} style={chipStyle(angle === a)}>{a}</button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: '10px' }}>
              <p style={{ fontSize: '11px', color: '#888', marginBottom: '4px' }}>촬영 높이</p>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {DISTANCE_OPTIONS.map((d) => (
                  <button key={d} onClick={() => setDistance(distance === d ? '' : d)} style={chipStyle(distance === d)}>{d}</button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: '10px' }}>
              <p style={{ fontSize: '11px', color: '#888', marginBottom: '4px' }}>빛/방해요소</p>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {CONDITION_OPTIONS.map((c) => (
                  <button key={c} onClick={() => handleConditionToggle(c)} style={chipStyle(conditions.includes(c))}>{c}</button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: '12px' }}>
              <p style={{ fontSize: '11px', color: '#888', marginBottom: '4px' }}>메모</p>
              <input type="text" value={extraNote} onChange={(e) => setExtraNote(e.target.value)} placeholder="추가 메모" style={inputStyle} />
            </div>

            <div style={{ marginBottom: '12px' }}>
              <p style={{ fontSize: '11px', color: '#888', marginBottom: '4px' }}>사진 선택 *</p>
              <input type="file" accept="image/*" capture="environment" onChange={handleFileChange}
                style={{ fontSize: '13px', width: '100%' }} />
              {preview && (
                <img src={preview} alt="미리보기" style={{ marginTop: '10px', maxWidth: '100%', maxHeight: '200px', borderRadius: '8px', border: '0.5px solid #e0e0e0' }} />
              )}
            </div>

            {uploadError && <p style={{ fontSize: '12px', color: '#c62828', marginBottom: '8px' }}>{uploadError}</p>}
            {uploadSuccess && <p style={{ fontSize: '12px', color: '#2e7d32', marginBottom: '8px' }}>업로드 성공!</p>}

            <button onClick={handleUpload}
              style={{
                fontSize: '13px', padding: '8px 20px', borderRadius: '8px',
                border: 'none', background: '#1D9E75', color: 'white',
                cursor: 'pointer', fontWeight: 500,
                width: '100%',
              }}>
              저장
            </button>
          </div>
        </>
      )}

      {modalImage && (
        <div onClick={() => setModalImage(null)}
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.7)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', zIndex: 1000, cursor: 'pointer',
          }}>
          <img src={modalImage} alt="크게보기" style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: '12px' }} />
        </div>
      )}
    </div>
  )
}
