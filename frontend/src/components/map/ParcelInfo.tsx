import { useState } from 'react'
import { loadParcel } from '../../api'
import { Field } from '../../types'

// 선택한 논의 필지 정보 (V-WORLD 연속지적도): 지번 주소, PNU, 필지 면적
export default function ParcelInfo({ field, onUpdated }: { field: Field; onUpdated?: (field: Field) => void }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleRefresh = async () => {
    setLoading(true)
    setError('')
    try {
      onUpdated?.(await loadParcel(field))
    } catch (err) {
      setError(err instanceof Error ? err.message : '필지 경계를 불러오지 못했어요')
    } finally {
      setLoading(false)
    }
  }

  const rows: [string, string][] = field.pnu
    ? [
        ['지번 주소', field.jibun_addr ?? '-'],
        ['PNU (필지 고유번호)', field.pnu],
        ['필지 면적', field.parcel_area_ha !== null ? `${field.parcel_area_ha.toLocaleString('ko-KR')} ha` : '-'],
        ['사업 면적 (입력값)', field.area_ha !== null ? `${field.area_ha} ha` : '미입력'],
      ]
    : []

  return (
    <div style={{ background: 'white', border: '0.5px solid #e0e0e0', borderRadius: '12px', padding: '12px', marginBottom: '12px' }}>
      <p style={{ fontSize: '14px', color: '#666', marginBottom: '8px', fontWeight: 600 }}>필지 정보 · {field.field_name}</p>
      {rows.length === 0 ? (
        <p style={{ fontSize: '13px', color: '#aaa', marginBottom: '8px' }}>필지 경계를 아직 불러오지 않았어요</p>
      ) : (
        <div style={{ display: 'grid', gap: '4px', marginBottom: '8px' }}>
          {rows.map(([label, value]) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', fontSize: '13px' }}>
              <span style={{ color: '#888', flexShrink: 0 }}>{label}</span>
              <span style={{ color: '#222', textAlign: 'right', wordBreak: 'keep-all' }}>{value}</span>
            </div>
          ))}
        </div>
      )}
      {error && <p style={{ fontSize: '12px', color: '#c62828', margin: '0 0 6px' }}>{error}</p>}
      <button
        type="button"
        onClick={handleRefresh}
        disabled={loading}
        style={{
          width: '100%', fontSize: '12px', padding: '7px 0', borderRadius: '6px',
          border: '0.5px solid #1D9E75', background: 'white', color: '#1D9E75',
          cursor: loading ? 'wait' : 'pointer', fontWeight: 500,
        }}
      >
        {loading ? '불러오는 중...' : field.pnu ? '필지 경계 다시 불러오기' : '필지 경계 불러오기 (V-WORLD 연속지적도)'}
      </button>
    </div>
  )
}
