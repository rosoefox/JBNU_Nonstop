import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { alertMeta, nodeLabel, timeAgo } from '../domain'
import { pillStyle } from '../styles'
import { Alert, AlertType, Field, Period } from '../types'
import { useFieldContext } from '../fieldContext'
import { getAlerts, getFields, resolveAlert } from '../api'

const TYPE_OPTIONS: { value: AlertType; label: string }[] = [
  { value: 'LOW_WATER', label: '재관개 필요' },
  { value: 'HIGH_WATER', label: '수위 높음' },
  { value: 'COMM_LOST', label: '통신 끊김' },
  { value: 'IRRIGATION_FAIL', label: '재관개 실패' },
]

const DAY_MS = 24 * 60 * 60 * 1000

const formatDuration = (fromIso: string, toIso: string) => {
  const minutes = Math.max(0, Math.round((new Date(toIso).getTime() - new Date(fromIso).getTime()) / 60000))
  if (minutes < 60) return `${minutes}분`
  if (minutes < 1440) return `${Math.round(minutes / 60)}시간`
  return `${Math.round(minutes / 1440)}일`
}

// 알람 시점이 그래프에 들어오도록 기간을 고름
const periodForAlert = (iso: string): Period => {
  const age = Date.now() - new Date(iso).getTime()
  if (age < DAY_MS) return '1d'
  if (age < 7 * DAY_MS) return '1w'
  return '1m'
}

const selectStyle = {
  fontSize: '13px', padding: '7px 12px', borderRadius: '8px', border: '0.5px solid #ccc',
  background: 'white', cursor: 'pointer', flex: '1 1 120px',
}

export default function AlertPage() {
  const navigate = useNavigate()
  const { selectedFieldId, setSelectedFieldId, selectField } = useFieldContext()
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [fields, setFields] = useState<Field[]>([])
  const [showAll, setShowAll] = useState(false)
  const [selectedType, setSelectedType] = useState('')
  const [resolvingId, setResolvingId] = useState<number | null>(null)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getFields()
      .then(setFields)
      .catch((err) => console.error('논 목록 불러오기 실패', err))
  }, [])

  useEffect(() => {
    getAlerts(selectedFieldId)
      .then(setAlerts)
      .catch((err) => console.error('알람 불러오기 실패', err))
  }, [selectedFieldId])

  const nodeNames: Record<number, string> = {}
  alerts.forEach((a) => {
    nodeNames[a.node_id] = nodeLabel({ id: a.node_id, node_name: a.node_name })
  })

  const startResolve = (id: number) => {
    setResolvingId(id)
    setNote('')
  }

  const handleResolve = async (id: number) => {
    setSaving(true)
    try {
      const updated = await resolveAlert(id, note.trim() || undefined)
      setAlerts((prev) => prev.map((a) => (a.id === id ? updated : a)))
      setResolvingId(null)
    } catch (err) {
      console.error('알람 해결 처리 실패', err)
      window.alert('해결 처리에 실패했어요. 백엔드 서버가 켜져 있는지 확인해주세요.')
    } finally {
      setSaving(false)
    }
  }

  const openGraph = (alert: Alert) => {
    setSelectedFieldId(alert.field_id)
    navigate('/sensor', { state: { nodeId: alert.node_id, period: periodForAlert(alert.created_at) } })
  }

  const now = new Date()
  const last24h = alerts.filter(a => (now.getTime() - new Date(a.created_at).getTime()) < DAY_MS)
  const unresolvedAlerts = alerts.filter(a => !a.is_resolved)

  const nodeAlertCount: Record<number, number> = {}
  last24h.forEach(a => {
    nodeAlertCount[a.node_id] = (nodeAlertCount[a.node_id] ?? 0) + 1
  })
  const maxCount = Math.max(...Object.values(nodeAlertCount), 1)

  const filtered = alerts
    .filter((a) => showAll ? true : !a.is_resolved)
    .filter((a) => selectedType ? a.alert_type === selectedType : true)

  return (
    <div style={{ padding: '16px', maxWidth: '1200px', margin: '0 auto', boxSizing: 'border-box' }}>
      <h2 style={{ fontSize: '18px', fontWeight: 500, marginBottom: '16px' }}>알람</h2>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
        gap: '10px', marginBottom: '16px'
      }}>
        {[
          { label: '미해결 알람', value: `${unresolvedAlerts.length}건`, danger: unresolvedAlerts.length > 0 },
          { label: '24시간 내 발생', value: `${last24h.length}건`, danger: false },
          { label: '전체 알람', value: `${alerts.length}건`, danger: false },
        ].map((card) => (
          <div key={card.label} style={{ background: 'white', border: '0.5px solid #e0e0e0', borderRadius: '10px', padding: '12px 16px' }}>
            <p style={{ fontSize: '11px', color: '#888', marginBottom: '4px' }}>{card.label}</p>
            <p style={{ fontSize: '20px', fontWeight: 500, color: card.danger ? '#c62828' : '#222' }}>{card.value}</p>
          </div>
        ))}
      </div>

      {Object.keys(nodeAlertCount).length > 0 && (
        <div style={{ background: 'white', border: '0.5px solid #e0e0e0', borderRadius: '12px', padding: '16px', marginBottom: '16px' }}>
          <p style={{ fontSize: '13px', fontWeight: 500, marginBottom: '12px' }}>노드별 알람 집중도 (24시간)</p>
          {Object.entries(nodeAlertCount).map(([nodeId, count]) => (
            <div key={nodeId} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <span style={{ fontSize: '12px', color: '#555', width: '72px', flexShrink: 0 }}>{nodeNames[Number(nodeId)]}</span>
              <div style={{ flex: 1, background: '#f5f5f5', borderRadius: '4px', height: '8px', overflow: 'hidden' }}>
                <div style={{ width: `${(count / maxCount) * 100}%`, background: '#1D9E75', height: '100%', borderRadius: '4px' }} />
              </div>
              <span style={{ fontSize: '12px', color: '#888', width: '30px', textAlign: 'right', flexShrink: 0 }}>{count}건</span>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
        <select
          value={selectedFieldId ?? ''}
          onChange={(e) => selectField(e.target.value ? Number(e.target.value) : null, fields)}
          style={selectStyle}
        >
          <option value="">논 선택</option>
          {fields.map((f) => <option key={f.id} value={f.id}>{f.field_name}</option>)}
        </select>

        <select value={selectedType} onChange={(e) => setSelectedType(e.target.value)} style={selectStyle}>
          <option value="">알람 종류 전체</option>
          {TYPE_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>

        <button
          onClick={() => setShowAll(!showAll)}
          style={{
            fontSize: '12px', padding: '6px 14px', borderRadius: '20px',
            border: '0.5px solid #ccc', background: showAll ? '#f0f0f0' : 'white',
            cursor: 'pointer', fontWeight: showAll ? 500 : 400, whiteSpace: 'nowrap',
          }}
        >
          {showAll ? '미해결만 보기' : '전체 알람 보기'}
        </button>
      </div>

      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px', color: '#aaa', fontSize: '14px' }}>
          {showAll ? '알람이 없어요' : '미해결 알람이 없어요'}
        </div>
      ) : (
        <div style={{ background: 'white', border: '0.5px solid #e0e0e0', borderRadius: '12px', overflow: 'hidden' }}>
          {filtered.map((alert, i) => {
            const meta = alertMeta(alert.alert_type)
            const showMessage = !!alert.message
            return (
              <div key={alert.id} style={{
                padding: '12px 16px',
                borderTop: i === 0 ? 'none' : '0.5px solid #f0f0f0',
                background: alert.is_resolved ? '#fcfcfc' : 'white',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <span style={pillStyle(meta.bg, meta.fg, 11)}>{meta.label}</span>
                  <span style={{ fontSize: '14px', fontWeight: 500, color: alert.is_resolved ? '#888' : '#222' }}>
                    {nodeNames[alert.node_id]}
                  </span>
                  <span style={{ fontSize: '13px', color: '#555' }}>{alert.water_level}cm</span>
                  <span
                    title={new Date(alert.created_at).toLocaleString('ko-KR')}
                    style={{ fontSize: '12px', color: '#999' }}
                  >
                    {timeAgo(alert.created_at)}
                  </span>

                  <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <button
                      onClick={() => openGraph(alert)}
                      style={{
                        fontSize: '12px', padding: '5px 10px', borderRadius: '8px',
                        border: '0.5px solid #ccc', background: 'white', color: '#555', cursor: 'pointer',
                      }}
                    >
                      그래프 보기
                    </button>
                    {!alert.is_resolved && resolvingId !== alert.id && (
                      <button
                        onClick={() => startResolve(alert.id)}
                        style={{
                          fontSize: '12px', padding: '5px 12px', borderRadius: '8px',
                          border: '0.5px solid #1D9E75', background: 'white', color: '#1D9E75', cursor: 'pointer',
                        }}
                      >
                        해결
                      </button>
                    )}
                  </div>
                </div>

                <div style={{ fontSize: '12px', color: '#999', marginTop: '4px' }}>
                  {new Date(alert.created_at).toLocaleString('ko-KR')}
                  {showMessage && <> · {alert.message}</>}
                </div>

                {alert.is_resolved && alert.resolved_at && (
                  <div style={{ fontSize: '12px', color: '#2e7d32', marginTop: '4px' }}>
                    해결됨 · 발생 {formatDuration(alert.created_at, alert.resolved_at)} 후
                    {alert.resolution_note && <span style={{ color: '#555' }}> · 조치: {alert.resolution_note}</span>}
                  </div>
                )}

                {resolvingId === alert.id && (
                  <div style={{ display: 'flex', gap: '6px', marginTop: '10px', flexWrap: 'wrap' }}>
                    <input
                      autoFocus
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && !saving) handleResolve(alert.id) }}
                      placeholder="조치 내용 (선택) 예: 수동으로 물 공급, 센서 재부팅"
                      maxLength={500}
                      style={{
                        flex: '1 1 240px', fontSize: '13px', padding: '7px 10px',
                        borderRadius: '8px', border: '0.5px solid #ccc',
                      }}
                    />
                    <button
                      onClick={() => handleResolve(alert.id)}
                      disabled={saving}
                      style={{
                        fontSize: '12px', padding: '7px 14px', borderRadius: '8px', border: 'none',
                        background: '#1D9E75', color: 'white', cursor: 'pointer', opacity: saving ? 0.6 : 1,
                      }}
                    >
                      {saving ? '저장 중...' : '해결 처리'}
                    </button>
                    <button
                      onClick={() => setResolvingId(null)}
                      style={{
                        fontSize: '12px', padding: '7px 12px', borderRadius: '8px',
                        border: '0.5px solid #ccc', background: 'white', color: '#888', cursor: 'pointer',
                      }}
                    >
                      취소
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
