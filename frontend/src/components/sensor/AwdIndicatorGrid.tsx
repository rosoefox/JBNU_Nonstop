import { AwdIndicators } from '../../types'

const pct = (v: number | null) => (v === null ? '-' : `${v}%`)

// AWD 물관리 지표: 상태별 일수, 사이클, 준수율, 가동률 (Sensor Data · MRV 공용)
export default function AwdIndicatorGrid({ indicators: d }: { indicators: AwdIndicators }) {
  const items = [
    { label: '담수 일수', value: `${d.flooded_days}일`, color: '#1565c0' },
    { label: '습윤 일수', value: `${d.wet_days}일`, color: '#1D9E75' },
    { label: '건조 일수', value: `${d.dry_days}일`, color: '#E24B4A' },
    { label: 'AWD 사이클', value: `${d.cycle_count}회` },
    {
      label: `준수율 (${d.compliance_hours}시간 내 재관개)`,
      value: pct(d.compliance_rate),
      sub: d.judged_events > 0 ? `${d.compliant_events} / ${d.judged_events}회` : '판정할 낙수 없음',
    },
    { label: '데이터 수집 가동률', value: pct(d.uptime_rate), sub: '목표 90% 이상' },
  ]

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px', marginTop: '8px' }}>
      {items.map((item) => (
        <div key={item.label} style={{ background: '#f5f5f5', borderRadius: '8px', padding: '10px 12px' }}>
          <p style={{ fontSize: '11px', color: '#888', marginBottom: '4px' }}>{item.label}</p>
          <p style={{ fontSize: '16px', fontWeight: 500, color: item.color ?? '#222' }}>{item.value}</p>
          {item.sub && <p style={{ fontSize: '10px', color: '#aaa', marginTop: '2px' }}>{item.sub}</p>}
        </div>
      ))}
    </div>
  )
}
