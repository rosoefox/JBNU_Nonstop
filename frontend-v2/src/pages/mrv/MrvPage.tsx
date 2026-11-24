// MRV 보고서: 사업자 입력 → 서버가 재배기간 모니터링 결과·감축량 계산 → Gold Standard 양식 보고서
import clsx from 'clsx'
import { ChevronRight } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Card, PageTitle } from '../../components/ui'
import { ApiError, getFieldMrv } from '../../lib/api'
import { button, input, label } from '../../lib/classes'
import { useDataScope, useFields } from '../../lib/queries'
import ReportDocument from './ReportDocument'
import {
  EMPTY_INPUT, ORGANIC_TYPES, PRESEASON_TYPES, calcSfO, kstStamp, type GsReport, type OperatorInput,
} from './shared'

function Field({ label: text, required, children, className }: { label: string; required?: boolean; children: ReactNode; className?: string }) {
  return (
    <label className={clsx('block min-w-0', className)}>
      <span className={label}>{text}{required && <span className="text-clay-500"> *</span>}</span>
      {children}
    </label>
  )
}

// 실험 모드 시연용: MRV예시용 논(오승가·조영손 2024 시험 논)의 공개 값
const EXAMPLE_FIELD = 'MRV예시용'
const EXAMPLE_ORGANIC = '기타 (유박 등, 퇴비 계수 적용)'
const EXAMPLE_PRESEASON = '180일 이상 비담수'
const EXAMPLE_INPUT: Partial<OperatorInput> = {
  season_start: '2022-06-10',
  season_end: '2022-10-25',
  organic_type: EXAMPLE_ORGANIC,
  organic_amount: 1.2,
  sf_o: calcSfO(EXAMPLE_ORGANIC, 1.2),
  preseason: EXAMPLE_PRESEASON,
  sf_p: PRESEASON_TYPES.find((p) => p.name === EXAMPLE_PRESEASON)?.sf ?? 0.89,
  operator: 'Nonstop예시',
  memo: '논·재배 정보: 오승가·조영손(2024), 기후변화연구 15(5_1):665-677 (경남 의령 시험 논, 유박 120kg/10a). '
    + '수위는 논문의 4MD-2 물관리 일정(중간낙수 4주 + 얕게걸러대기)을 재현한 예시 데이터.',
}

export default function MrvPage() {
  const fields = useFields()
  const [fieldId, setFieldId] = useState<number | ''>('')
  const [form, setForm] = useState<OperatorInput>(EMPTY_INPUT)
  const [error, setError] = useState('')
  const [report, setReport] = useState<GsReport | null>(null)
  // 보고서에 쓸 데이터: 실험 모드면 실험 데이터, 운영 모드에서는 실제 데이터
  const scope = useDataScope()
  const set = <K extends keyof OperatorInput>(key: K, value: OperatorInput[K]) => setForm((p) => ({ ...p, [key]: value }))
  // 유기물·작기 전 물관리를 고르면 IPCC 보정계수를 바로 계산해 넣음
  const setOrganic = (type: string, amount: number) =>
    setForm((p) => ({ ...p, organic_type: type, organic_amount: type === '투입 없음' ? 0 : amount, sf_o: calcSfO(type, type === '투입 없음' ? 0 : amount) }))
  const exampleField = fields.data?.find((f) => f.field_name === EXAMPLE_FIELD)
  const fillExample = () => {
    if (exampleField) setFieldId(exampleField.id)
    setForm((p) => ({ ...p, ...EXAMPLE_INPUT }))
    setError('')
  }
  const setPreseason = (name: string) =>
    setForm((p) => ({ ...p, preseason: name, sf_p: PRESEASON_TYPES.find((x) => x.name === name)?.sf ?? p.sf_p }))

  const generate = useMutation({
    mutationFn: async () => {
      const field = fields.data?.find((f) => f.id === fieldId)
      const missing = [
        !field && '대상 논', !form.season_start && '이앙일', !form.season_end && '수확일',
        !form.organic_type && '유기물 투입', !form.preseason && '작기 전 물관리',
      ].filter(Boolean)
      if (missing.length || !field) throw new Error(`입력해 주세요: ${missing.join(', ')}`)
      if (form.season_end < form.season_start) throw new Error('수확일은 이앙일보다 뒤여야 해요.')
      if (!(form.sf_o > 0) || !(form.sf_p > 0)) throw new Error('SF_o, SF_p는 0보다 커야 해요.')
      const mrv = await getFieldMrv(field.id, form.season_start, form.season_end, form.sf_p, form.sf_o, scope)
      if (mrv.sample_count === 0) {
        throw new Error(scope === 'experiment'
          ? '선택한 재배기간에 실험 데이터가 없어요.'
          : '선택한 재배기간에 실제 수위 기록이 없어요. (실험 데이터는 실험 모드에서만 보여요)')
      }
      return {
        ...form,
        operator: form.operator.trim() || '미입력',
        region: form.region.trim() || (field.jibun_addr?.split(' ')[0] ?? ''),
        field_name: field.field_name,
        location_desc: field.location_desc,
        latitude: field.latitude,
        longitude: field.longitude,
        pnu: field.pnu,
        jibun_addr: field.jibun_addr,
        generated_at: new Date().toISOString(),
        mrv: {
          ...mrv,
          drain_events: mrv.drain_events.map((e) => ({ ...e, dry_at: kstStamp(e.dry_at), reflood_at: e.reflood_at ? kstStamp(e.reflood_at) : null })),
        },
      } satisfies GsReport
    },
    onMutate: () => setError(''),
    onSuccess: setReport,
    onError: (e) => setError(e instanceof ApiError || e instanceof Error ? e.message : '서버에 연결하지 못했어요.'),
  })

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5 px-4 py-6 md:px-8">
      <PageTitle title="MRV 보고서" subtitle="Gold Standard 방법론 기반 AWD 메탄 감축량 보고 · 재배기간 단위" />

      <Card className="grid gap-5 p-5">
        {/* 1. 꼭 필요한 것: 논 · 재배기간 */}
        <div className="grid gap-4 md:grid-cols-[1.3fr_1fr_1fr_auto] md:items-end">
          <Field label="대상 논" required>
            <select value={fieldId} onChange={(e) => setFieldId(e.target.value ? Number(e.target.value) : '')} className={input}>
              <option value="">논 선택</option>
              {(fields.data ?? []).map((f) => <option key={f.id} value={f.id}>{f.field_name}</option>)}
            </select>
          </Field>
          <Field label="이앙일 (재배 시작)" required>
            <input id="season-start" type="date" value={form.season_start} onChange={(e) => set('season_start', e.target.value)} className={input} />
          </Field>
          <Field label="수확일 (재배 종료)" required>
            <input id="season-end" type="date" value={form.season_end} onChange={(e) => set('season_end', e.target.value)} className={input} />
          </Field>
          <button type="button" onClick={() => generate.mutate()} disabled={generate.isPending} className={button('primary', 'h-[38px] px-5')}>
            {generate.isPending ? '계산 중...' : '보고서 생성'}
          </button>
        </div>

        {/* 2. 논 조건: 고르면 보정계수가 자동으로 정해짐 */}
        <div className="grid gap-4 md:grid-cols-[1.3fr_0.7fr_1.3fr]">
          <Field label="유기물 투입" required>
            <select value={form.organic_type} onChange={(e) => setOrganic(e.target.value, form.organic_amount)} className={input}>
              <option value="">선택</option>
              {ORGANIC_TYPES.map((o) => <option key={o.name}>{o.name}</option>)}
            </select>
          </Field>
          <Field label="투입량 (t/ha)">
            <input
              id="organic-amount" type="number" min={0} step="0.1" value={form.organic_amount}
              disabled={!form.organic_type || form.organic_type === '투입 없음'}
              onChange={(e) => setOrganic(form.organic_type, Number(e.target.value))} className={input}
            />
          </Field>
          <Field label="작기 전 물관리 (모내기 전 논 상태)" required>
            <select value={form.preseason} onChange={(e) => setPreseason(e.target.value)} className={input}>
              <option value="">선택</option>
              {PRESEASON_TYPES.map((p) => <option key={p.name}>{p.name}</option>)}
            </select>
          </Field>
        </div>
        <p className="-mt-2 text-xs text-soil-500">
          산정 방법: IPCC 기본값 간이법 (Gold Standard 방법 3) · 보정계수 SF_o {form.sf_o} · SF_p {form.sf_p} (IPCC 2019 값 자동 적용)
        </p>
        {error && <p className="-mt-2 text-sm font-medium text-clay-600">{error}</p>}
        {scope === 'experiment' && exampleField && (
          <div className="-mt-1 flex flex-wrap items-center gap-3 rounded-lg bg-sprout-100 px-4 py-2.5">
            <p className="text-xs text-soil-700">실험 모드 · <b>{EXAMPLE_FIELD}</b> 논의 공개 값(논문)과 예시 수위로 보고서를 만들어 볼 수 있어요.</p>
            <button type="button" onClick={fillExample} className={button('ghost', 'ml-auto px-3 py-1.5 text-xs')}>예시 값 채우기</button>
          </div>
        )}

        {/* 3. 나머지는 보고서 표지에 찍히는 정보 → 접어 둠 */}
        <details className="group rounded-lg border border-soil-200">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-2.5 text-sm font-semibold text-soil-700 [&::-webkit-details-marker]:hidden">
            <ChevronRight className="size-4 text-soil-500 transition-transform group-open:rotate-90" />
            세부 설정
            <span className="font-normal text-soil-500">사업자 · 사업명 · 메모 · 보정계수 직접 입력 (비워도 돼요)</span>
          </summary>
          <div className="grid gap-4 border-t border-soil-200 p-4">
            <div className="grid gap-4 md:grid-cols-4">
              <Field label="사업자 이름"><input id="operator" value={form.operator} onChange={(e) => set('operator', e.target.value)} placeholder="비우면 '미입력'" className={input} /></Field>
              <Field label="담당자"><input id="manager" value={form.manager} onChange={(e) => set('manager', e.target.value)} className={input} /></Field>
              <Field label="사업명"><input id="title" value={form.project_title} onChange={(e) => set('project_title', e.target.value)} placeholder="비우면 자동 생성" className={input} /></Field>
              <Field label="광역 지자체"><input id="region" value={form.region} onChange={(e) => set('region', e.target.value)} placeholder="비우면 필지 주소에서" className={input} /></Field>
            </div>
            <div className="grid gap-4 md:grid-cols-4">
              <Field label="SF_o 유기물 보정계수"><input id="sf-o" type="number" step="0.01" value={form.sf_o} onChange={(e) => set('sf_o', Number(e.target.value))} className={input} /></Field>
              <Field label="SF_p 작기 전 물관리 보정계수"><input id="sf-p" type="number" step="0.01" value={form.sf_p} onChange={(e) => set('sf_p', Number(e.target.value))} className={input} /></Field>
              <Field label="보고서 버전"><input id="version" value={form.version} onChange={(e) => set('version', e.target.value)} className={input} /></Field>
              <Field label="모니터링 기간 번호">
                <input id="period-no" type="number" min={1} value={form.period_no} onChange={(e) => set('period_no', Math.max(1, Number(e.target.value) || 1))} className={input} />
              </Field>
            </div>
            <Field label="이행 내용 메모 (설치일, 특이사항, 고장 등)">
              <textarea id="memo" rows={2} value={form.memo} onChange={(e) => set('memo', e.target.value)} className={clsx(input, 'resize-y')} />
            </Field>
          </div>
        </details>
      </Card>

      {report ? <ReportDocument report={report} /> : (
        <Card className="px-6 py-12 text-center text-sm text-soil-500">필수 항목(*)을 입력하고 보고서를 생성하세요.</Card>
      )}
    </div>
  )
}
