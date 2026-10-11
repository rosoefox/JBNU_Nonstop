import ComingSoon from '../common/ComingSoon'
import { formatLevel, levelBadge, pumpStatus } from '../../domain'
import { pillStyle } from '../../styles'

export interface FieldInfoSensor {
  id: number
  name: string
  latest_level: number | null
  measured_at: string | null
  has_pump: boolean
  pump_on: boolean | null
}

interface FieldInfoProps {
  fieldName: string
  sensors: FieldInfoSensor[]
  onTogglePump?: (nodeId: number) => void
  pumpSavingId?: number | null
  pumpError?: string
}

// 지도 왼쪽 패널: 선택한 논의 노드별 상태와 펌프 관리
export default function FieldInfo({ fieldName, sensors, onTogglePump, pumpSavingId, pumpError }: FieldInfoProps) {
  return (
    <div style={{
      background: 'white', border: '0.5px solid #e0e0e0',
      borderRadius: '12px', padding: '12px',
    }}>
      <p style={{ fontSize: '14px', color: '#666', marginBottom: '10px', fontWeight: 600 }}>센서 상태 · {fieldName}</p>
      {pumpError && <p style={{ fontSize: '12px', color: '#c62828', margin: '0 0 6px' }}>{pumpError}</p>}
      {sensors.length === 0 ? (
        <p style={{ fontSize: '14px', color: '#aaa' }}>센서 없음</p>
      ) : sensors.map((sensor, i) => {
        const level = levelBadge(sensor.latest_level, sensor.measured_at)
        const pump = pumpStatus(sensor.has_pump, sensor.pump_on)
        const saving = pumpSavingId === sensor.id
        return (
          <div key={sensor.id} style={{
            padding: '8px 0', borderBottom: i < sensors.length - 1 ? '0.5px solid #f0f0f0' : 'none',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <p style={{ fontSize: '15px', fontWeight: 600 }}>{sensor.name}</p>
                <p style={{ fontSize: '13px', color: '#666', marginTop: '2px' }}>
                  {sensor.latest_level !== null ? `${formatLevel(sensor.latest_level)}cm` : '데이터 없음'}
                </p>
              </div>
              <span style={pillStyle(level.color + '20', level.color, 13)}>{level.label}</span>
            </div>

            {/* 펌프 관리 */}
            <div style={{ marginTop: '8px', background: '#fafafa', borderRadius: '8px', padding: '8px 10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                <span style={pillStyle(pump.bg, pump.fg)}>{pump.label}</span>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#444' }}>
                  펌프 연결
                  <button
                    type="button"
                    onClick={() => onTogglePump?.(sensor.id)}
                    disabled={saving || !onTogglePump}
                    aria-pressed={sensor.has_pump}
                    title={sensor.has_pump ? '펌프 연결 해제' : '펌프 연결'}
                    style={{
                      width: '34px', height: '20px', borderRadius: '10px', border: 'none', padding: 0,
                      background: sensor.has_pump ? '#1D9E75' : '#ccc', position: 'relative',
                      cursor: saving ? 'wait' : 'pointer', transition: 'background 0.2s',
                    }}
                  >
                    <span style={{
                      position: 'absolute', top: '3px', left: sensor.has_pump ? '17px' : '3px',
                      width: '14px', height: '14px', borderRadius: '50%', background: 'white', transition: 'left 0.2s',
                    }} />
                  </button>
                </label>
              </div>

              {/* 수동 제어는 펌프 구매 후 TTN 다운링크 연결 예정 */}
              {sensor.has_pump && (
                <div style={{ marginTop: '8px' }}>
                  <ComingSoon size="sm">
                    <div style={{ display: 'flex', gap: '6px' }}>
                      {['펌프 켜기', '펌프 끄기'].map((t) => (
                        <button key={t} type="button" disabled style={{
                          flex: 1, fontSize: '13px', padding: '7px 0', borderRadius: '6px', border: 'none',
                          background: t === '펌프 켜기' ? '#378ADD' : '#888', color: 'white', fontWeight: 500,
                        }}>{t}</button>
                      ))}
                    </div>
                  </ComingSoon>
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
