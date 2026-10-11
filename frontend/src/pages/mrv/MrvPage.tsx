// MRV 보고서: 사업자 입력을 받고 서버에서 모니터링 결과·감축량을 받아 보고서를 만듦
import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import ComingSoon from '../../components/common/ComingSoon'
import { ApiError, getFieldMrv, getFields } from '../../api'
import { useFieldContext } from '../../fieldContext'
import { Field } from '../../types'
import useIsMobile from '../../useIsMobile'
import ReportDocument from './ReportDocument'
import {
  EMPTY_INPUT, GsReport, METHODS, ORGANIC_TYPES, OperatorInput, PRESEASON_TYPES,
  inputStyle, kstStamp, labelStyle, mrvCardStyle,
} from './shared'

const groupTitleStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  color: '#0F6B4F',
  margin: '18px 0 10px',
  paddingTop: 14,
  borderTop: '1px solid #e5edf2',
}

export default function MrvPage() {
  const [fields, setFields] = useState<Field[]>([])
  const { selectedFieldId, selectField } = useFieldContext()
  const [input, setInput] = useState<OperatorInput>(EMPTY_INPUT)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [report, setReport] = useState<GsReport | null>(null)
  const isMobile = useIsMobile(640)

  useEffect(() => {
    getFields().then(setFields).catch(() => setFields([]))
  }, [])

  const set = <K extends keyof OperatorInput>(key: K, value: OperatorInput[K]) =>
    setInput((prev) => ({ ...prev, [key]: value }))

  const handleCreate = async () => {
    const field = fields.find((f) => f.id === selectedFieldId)
    const missing: string[] = []
    if (!field) missing.push('대상 논')
    if (!input.season_start) missing.push('이앙일')
    if (!input.season_end) missing.push('수확일')
    if (!input.organic_type) missing.push('유기물 투입')
    if (!input.preseason) missing.push('작기 전 물관리')
    if (!input.operator.trim()) missing.push('사업자 이름')
    if (missing.length > 0 || !field) {
      setError(`입력해 주세요: ${missing.join(', ')}`)
      return
    }
    if (input.season_end < input.season_start) {
      setError('수확일은 이앙일보다 뒤여야 합니다.')
      return
    }
    if (!(input.sf_o > 0) || !(input.sf_p > 0)) {
      setError('SF_o, SF_p는 0보다 큰 값이어야 합니다.')
      return
    }

    setError('')
    setLoading(true)
    try {
      const mrv = await getFieldMrv(field.id, input.season_start, input.season_end, input.sf_p, input.sf_o)
      if (mrv.sample_count === 0) {
        setReport(null)
        setError('선택한 재배기간에 수위 측정 기록이 없습니다.')
        return
      }
      setReport({
        ...input,
        field_name: field.field_name,
        location_desc: field.location_desc,
        latitude: field.latitude,
        longitude: field.longitude,
        pnu: field.pnu,
        jibun_addr: field.jibun_addr,
        mrv: {
          ...mrv,
          drain_events: mrv.drain_events.map((e) => ({
            ...e,
            dry_at: kstStamp(e.dry_at),
            reflood_at: e.reflood_at ? kstStamp(e.reflood_at) : null,
          })),
        },
      })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '서버에 연결하지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const grid = (cols: number): CSSProperties => ({
    display: 'grid',
    gridTemplateColumns: isMobile ? '1fr' : `repeat(${cols}, minmax(0, 1fr))`,
    gap: 12,
    alignItems: 'end',
  })

  return (
    <div style={{ padding: isMobile ? 10 : 16, maxWidth: 1200, margin: '0 auto', boxSizing: 'border-box' }}>
      <div style={{ marginBottom: 12 }}>
        <h2 style={{ fontSize: isMobile ? 18 : 19, fontWeight: 800, margin: 0, color: '#111827' }}>MRV 보고서</h2>
        <p style={{ fontSize: 12, color: '#667085', margin: '4px 0 0' }}>Gold Standard Monitoring Report 양식 기반 AWD 메탄 감축량 보고</p>
      </div>

      <div style={{ ...mrvCardStyle, marginBottom: 14, padding: isMobile ? 12 : mrvCardStyle.padding }}>
        <div style={grid(4)}>
          <label>
            <span style={labelStyle}>대상 논 *</span>
            <select
              value={selectedFieldId ?? ''}
              onChange={(e) => selectField(e.target.value ? Number(e.target.value) : null, fields)}
              style={inputStyle}
            >
              <option value="">논 선택</option>
              {fields.map((field) => (
                <option key={field.id} value={field.id}>{field.field_name}</option>
              ))}
            </select>
          </label>

          <label>
            <span style={labelStyle}>이앙일 (재배 시작) *</span>
            <input type="date" value={input.season_start} onChange={(e) => set('season_start', e.target.value)} style={inputStyle} />
          </label>

          <label>
            <span style={labelStyle}>수확일 (재배 종료) *</span>
            <input type="date" value={input.season_end} onChange={(e) => set('season_end', e.target.value)} style={inputStyle} />
          </label>

          <button
            type="button"
            onClick={handleCreate}
            disabled={loading}
            style={{
              fontSize: 13,
              padding: '9px 14px',
              borderRadius: 6,
              border: 'none',
              background: '#1D9E75',
              color: 'white',
              cursor: loading ? 'wait' : 'pointer',
              opacity: loading ? 0.7 : 1,
              fontWeight: 800,
              minHeight: 36,
            }}
          >
            {loading ? '생성 중...' : '보고서 생성'}
          </button>
        </div>
        {error && <p style={{ fontSize: 12, color: '#c62828', margin: '9px 0 0', fontWeight: 700 }}>{error}</p>}

        <span style={{ ...labelStyle, marginTop: 14 }}>산정 방법</span>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
          {METHODS.map((m) => {
            const content = (
              <>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#111827' }}>
                  방법 {m.no}. {m.name}
                  {m.ready && <span style={{ marginLeft: 6, fontSize: 11, color: '#1D9E75' }}>✓ 적용 중</span>}
                </div>
                <div style={{ fontSize: 11, color: '#667085', marginTop: 4 }}>{m.desc}</div>
              </>
            )
            return (
              <div
                key={m.no}
                style={{
                  border: m.ready ? '2px solid #1D9E75' : '1px solid #d9e2e8',
                  background: m.ready ? '#F2F7F5' : '#fff',
                  borderRadius: 8,
                  padding: '10px 12px',
                }}
              >
                {m.ready ? content : <ComingSoon size="sm" placement="right">{content}</ComingSoon>}
              </div>
            )
          })}
        </div>

        <p style={groupTitleStyle}>재배기간별 입력</p>
        <div style={grid(4)}>
          <label>
            <span style={labelStyle}>유기물 투입 *</span>
            <select value={input.organic_type} onChange={(e) => set('organic_type', e.target.value)} style={inputStyle}>
              <option value="">선택</option>
              {ORGANIC_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          <label>
            <span style={labelStyle}>SF_o (유기물 보정계수)</span>
            <input type="number" step="0.01" value={input.sf_o} onChange={(e) => set('sf_o', Number(e.target.value))} style={inputStyle} />
          </label>
          <label>
            <span style={labelStyle}>작기 전 물관리 *</span>
            <select value={input.preseason} onChange={(e) => set('preseason', e.target.value)} style={inputStyle}>
              <option value="">선택</option>
              {PRESEASON_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          <label>
            <span style={labelStyle}>SF_p (작기 전 물관리 보정계수)</span>
            <input type="number" step="0.01" value={input.sf_p} onChange={(e) => set('sf_p', Number(e.target.value))} style={inputStyle} />
          </label>
        </div>
        <div style={{ ...grid(4), marginTop: 12, alignItems: 'start' }}>
          <label>
            <span style={labelStyle}>보고서 버전</span>
            <input value={input.version} onChange={(e) => set('version', e.target.value)} style={inputStyle} />
          </label>
          <label style={{ gridColumn: isMobile ? undefined : 'span 3' }}>
            <span style={labelStyle}>이행 내용 메모 (설치일, 특이사항, 고장 등)</span>
            <textarea
              value={input.memo}
              onChange={(e) => set('memo', e.target.value)}
              rows={2}
              style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
            />
          </label>
        </div>

        <p style={groupTitleStyle}>사업 정보 (한 번만 입력)</p>
        <div style={grid(5)}>
          <label>
            <span style={labelStyle}>사업자 이름 *</span>
            <input value={input.operator} onChange={(e) => set('operator', e.target.value)} style={inputStyle} />
          </label>
          <label>
            <span style={labelStyle}>담당자</span>
            <input value={input.manager} onChange={(e) => set('manager', e.target.value)} style={inputStyle} />
          </label>
          <label>
            <span style={labelStyle}>사업명</span>
            <input value={input.project_title} onChange={(e) => set('project_title', e.target.value)} placeholder="비우면 자동 생성" style={inputStyle} />
          </label>
          <label>
            <span style={labelStyle}>광역 지자체</span>
            <input value={input.region} onChange={(e) => set('region', e.target.value)} placeholder="예: 전북특별자치도" style={inputStyle} />
          </label>
          <label>
            <span style={labelStyle}>모니터링 기간 번호</span>
            <input type="number" min={1} value={input.period_no} onChange={(e) => set('period_no', Math.max(1, Number(e.target.value) || 1))} style={inputStyle} />
          </label>
        </div>
      </div>

      {report ? (
        <ReportDocument report={report} isMobile={isMobile} />
      ) : (
        <div style={{ ...mrvCardStyle, textAlign: 'center', padding: 42, color: '#98a2b3', fontSize: 14 }}>
          필수 항목(*)을 입력하고 보고서를 생성하세요.
        </div>
      )}
    </div>
  )
}
