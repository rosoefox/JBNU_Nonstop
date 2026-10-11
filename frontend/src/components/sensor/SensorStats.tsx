import { DRY_LEVEL_CM, formatLevel } from '../../domain'
import { cardStyle, pillStyle } from '../../styles'

export type SensorStatus = '정상' | '수위 이상' | '통신 끊김' | '측정 기록 없음'

interface SensorStatsProps {
  currentLevel: number | null
  sensorStatus: SensorStatus
  updatedText: string
  avg: number | null
  max: number | null
  min: number | null
  alarmCount: number
}

const STATUS_COLORS: Record<SensorStatus, { bg: string; fg: string }> = {
  '정상': { bg: '#e8f5e9', fg: '#2e7d32' },
  '수위 이상': { bg: '#fce4ec', fg: '#c62828' },
  '통신 끊김': { bg: '#fff8e1', fg: '#f57f17' },
  '측정 기록 없음': { bg: '#f0f0f0', fg: '#888' },
}

// 값이 없으면 0이 아니라 "-"로 보여줌 (실제 0cm와 구분)
export default function SensorStats({
  currentLevel, sensorStatus, updatedText, avg, max, min, alarmCount,
}: SensorStatsProps) {
  const status = STATUS_COLORS[sensorStatus]
  const items = [
    { label: '평균', value: formatLevel(avg), unit: 'cm' },
    { label: '최고', value: formatLevel(max), unit: 'cm' },
    { label: '최저', value: formatLevel(min), unit: 'cm', danger: min !== null && min <= DRY_LEVEL_CM },
    { label: '알람', value: String(alarmCount), unit: '건' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={cardStyle}>
        <p style={{ fontSize: '11px', color: '#888', fontWeight: 500, marginBottom: '8px' }}>현재 상태</p>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginBottom: '6px' }}>
          <span style={{ fontSize: '26px', fontWeight: 500 }}>{formatLevel(currentLevel)}</span>
          <span style={{ fontSize: '13px', color: '#888' }}>cm</span>
        </div>
        <p style={{ fontSize: '12px', color: '#888', marginBottom: '8px' }}>{updatedText}</p>
        <span style={pillStyle(status.bg, status.fg, 11)}>{sensorStatus}</span>
      </div>

      <div style={cardStyle}>
        <p style={{ fontSize: '11px', color: '#888', fontWeight: 500, marginBottom: '10px' }}>24시간 통계</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          {items.map((item) => (
            <div key={item.label} style={{ background: '#f5f5f5', borderRadius: '8px', padding: '10px 12px' }}>
              <p style={{ fontSize: '11px', color: '#888', marginBottom: '4px' }}>{item.label}</p>
              <span style={{ fontSize: '18px', fontWeight: 500, color: item.danger ? '#E24B4A' : '#222' }}>
                {item.value}
                <small style={{ fontSize: '12px', fontWeight: 400, color: '#888', marginLeft: '2px' }}>{item.unit}</small>
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
