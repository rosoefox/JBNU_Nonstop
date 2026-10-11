import { useNavigate } from 'react-router-dom'
import { alertMeta, timeAgo } from '../../domain'
import { cardStyle, pillStyle } from '../../styles'
import { Alert } from '../../types'

interface AlarmSummaryCardProps {
  totalCount: number
  unresolvedCount: number
  unresolvedAlerts: Alert[]
}

// 대시보드 알람 요약: 전체·미해결 건수 + 미해결 알람만 내용 표시
export default function AlarmSummaryCard({ totalCount, unresolvedCount, unresolvedAlerts }: AlarmSummaryCardProps) {
  const navigate = useNavigate()

  return (
    <div style={{
      ...cardStyle,
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      minHeight: 0,
    }}>
      <p style={{ fontSize: '12px', color: '#888', marginBottom: '10px', fontWeight: 500 }}>알람 요약</p>
      <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
        <div style={{ background: '#f5f5f5', borderRadius: '8px', padding: '10px 14px', flex: 1 }}>
          <p style={{ fontSize: '11px', color: '#888', marginBottom: '4px' }}>전체 알람</p>
          <p style={{ fontSize: '20px', fontWeight: 500 }}>{totalCount}건</p>
        </div>
        <div style={{
          background: unresolvedCount > 0 ? '#fce4ec' : '#e8f5e9',
          borderRadius: '8px', padding: '10px 14px', flex: 1,
        }}>
          <p style={{ fontSize: '11px', color: '#888', marginBottom: '4px' }}>미해결</p>
          <p style={{ fontSize: '20px', fontWeight: 500, color: unresolvedCount > 0 ? '#c62828' : '#2e7d32' }}>{unresolvedCount}건</p>
        </div>
      </div>

      <p style={{ fontSize: '11px', color: '#888', fontWeight: 500, margin: '0 0 4px' }}>미해결 알람</p>
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        {unresolvedAlerts.length === 0 ? (
          <p style={{ fontSize: '13px', color: '#aaa', textAlign: 'center', padding: '12px 0' }}>미해결 알람 없음</p>
        ) : (
          unresolvedAlerts.map((alert) => {
            const meta = alertMeta(alert.alert_type)
            return (
              <div key={alert.id} style={{ padding: '8px 0', borderTop: '0.5px solid #f0f0f0', fontSize: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                  <span style={{ fontWeight: 500 }}>
                    {alert.node_name || `Node ${alert.node_id}`}
                    <span style={{ color: '#888', fontWeight: 400, marginLeft: '6px' }}>{alert.water_level}cm</span>
                  </span>
                  <span style={pillStyle(meta.bg, meta.fg, 11)}>{meta.label}</span>
                </div>
                {alert.message && <p style={{ color: '#555', margin: '0 0 2px', lineHeight: 1.4 }}>{alert.message}</p>}
                <p style={{ color: '#aaa', margin: 0, fontSize: '11px' }}>
                  {timeAgo(alert.created_at)} · {new Date(alert.created_at).toLocaleString('ko-KR')}
                </p>
              </div>
            )
          })
        )}
      </div>

      <p onClick={() => navigate('/alerts')} style={{ fontSize: '11px', color: '#1D9E75', cursor: 'pointer', margin: '8px 0 0' }}>
        알람 전체 보기 →
      </p>
    </div>
  )
}
