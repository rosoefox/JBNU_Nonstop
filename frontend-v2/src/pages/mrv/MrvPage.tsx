// MRV 보고서: 사업자 입력 → 서버가 재배기간 모니터링 결과·감축량 계산 → Gold Standard 양식 보고서
import clsx from 'clsx'
import { Check } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useMutation } from '@tanstack/react-query'
import { ComingSoon } from '../../components/common'
import { Card, PageTitle } from '../../components/ui'
import { ApiError, getFieldMrv } from '../../lib/api'
import { button, input, label } from '../../lib/classes'
import { useFields } from '../../lib/queries'
import ReportDocument from './ReportDocument'
import {
  EMPTY_INPUT, METHODS, ORGANIC_TYPES, PRESEASON_TYPES, kstStamp, type GsReport, type OperatorInput,
} from './shared'

function Field({ label: text, required, children, className }: { label: string; required?: boolean; children: ReactNode; className?: string }) {
  return (
    <label className={clsx('block min-w-0', className)}>
      <span className={label}>{text}{required && <span className="text-clay-500"> *</span>}</span>
      {children}
    </label>
  )
}

export default function MrvPage() {
  const fields = useFields()
  const [fieldId, setFieldId] = useState<number | ''>('')
  const [form, setForm] = useState<OperatorInput>(EMPTY_INPUT)
  const [error, setError] = useState('')
  const [report, setReport] = useState<GsReport | null>(null)
  const set = <K extends keyof OperatorInput>(key: K, value: OperatorInput[K]) => setForm((p) => ({ ...p, [key]: value }))

  const generate = useMutation({
    mutationFn: async () => {
      const field = fields.data?.find((f) => f.id === fieldId)
      const missing = [
        !field && '대상 논', !form.season_start && '이앙일', !form.season_end && '수확일',
        !form.organic_type && '유기물 투입', !form.preseason && '작기 전 물관리', !form.operator.trim() && '사업자 이름',
      ].filter(Boolean)
      if (missing.length || !field) throw new Error(`입력해 주세요: ${missing.join(', ')}`)
      if (form.season_end < form.season_start) throw new Error('수확일은 이앙일보다 뒤여야 해요.')
      if (!(form.sf_o > 0) || !(form.sf_p > 0)) throw new Error('SF_o, SF_p는 0보다 커야 해요.')
      const mrv = await getFieldMrv(field.id, form.season_start, form.season_end, form.sf_p, form.sf_o)
      if (mrv.sample_count === 0) throw new Error('선택한 재배기간에 수위 측정 기록이 없어요.')
      return {
        ...form,
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

      <Card className="grid gap-6 p-5">
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
        {error && <p className="-mt-3 text-sm font-medium text-clay-600">{error}</p>}

        <div>
          <p className={label}>산정 방법</p>
          <div className="grid gap-3 md:grid-cols-3">
            {METHODS.map((m) => {
              const body = (
                <div className={clsx('h-full rounded-lg border px-4 py-3', m.ready ? 'border-sprout-500 bg-sprout-100' : 'border-soil-300 bg-white')}>
                  <p className="flex items-center gap-1.5 text-sm font-semibold">
                    방법 {m.no}. {m.name}{m.ready && <Check className="size-4 text-sprout-600" aria-label="적용 중" />}
                  </p>
                  <p className="mt-1 text-xs text-soil-600">{m.desc}</p>
                </div>
              )
              return m.ready ? <div key={m.no}>{body}</div> : <ComingSoon key={m.no} corner>{body}</ComingSoon>
            })}
          </div>
        </div>

        <fieldset className="grid gap-4 border-t border-soil-200 pt-5">
          <legend className="text-sm font-semibold text-sprout-700">재배기간별 입력</legend>
          <div className="grid gap-4 md:grid-cols-4">
            <Field label="유기물 투입" required>
              <select value={form.organic_type} onChange={(e) => set('organic_type', e.target.value)} className={input}>
                <option value="">선택</option>
                {ORGANIC_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="SF_o 유기물 보정계수">
              <input id="sf-o" type="number" step="0.01" value={form.sf_o} onChange={(e) => set('sf_o', Number(e.target.value))} className={input} />
            </Field>
            <Field label="작기 전 물관리" required>
              <select value={form.preseason} onChange={(e) => set('preseason', e.target.value)} className={input}>
                <option value="">선택</option>
                {PRESEASON_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="SF_p 작기 전 물관리 보정계수">
              <input id="sf-p" type="number" step="0.01" value={form.sf_p} onChange={(e) => set('sf_p', Number(e.target.value))} className={input} />
            </Field>
          </div>
          <div className="grid gap-4 md:grid-cols-4">
            <Field label="보고서 버전">
              <input id="version" value={form.version} onChange={(e) => set('version', e.target.value)} className={input} />
            </Field>
            <Field label="이행 내용 메모 (설치일, 특이사항, 고장 등)" className="md:col-span-3">
              <textarea id="memo" rows={2} value={form.memo} onChange={(e) => set('memo', e.target.value)} className={clsx(input, 'resize-y')} />
            </Field>
          </div>
        </fieldset>

        <fieldset className="grid gap-4 border-t border-soil-200 pt-5">
          <legend className="text-sm font-semibold text-sprout-700">사업 정보</legend>
          <div className="grid gap-4 md:grid-cols-5">
            <Field label="사업자 이름" required><input id="operator" value={form.operator} onChange={(e) => set('operator', e.target.value)} className={input} /></Field>
            <Field label="담당자"><input id="manager" value={form.manager} onChange={(e) => set('manager', e.target.value)} className={input} /></Field>
            <Field label="사업명"><input id="title" value={form.project_title} onChange={(e) => set('project_title', e.target.value)} placeholder="비우면 자동 생성" className={input} /></Field>
            <Field label="광역 지자체"><input id="region" value={form.region} onChange={(e) => set('region', e.target.value)} placeholder="예: 전북특별자치도" className={input} /></Field>
            <Field label="모니터링 기간 번호">
              <input id="period-no" type="number" min={1} value={form.period_no} onChange={(e) => set('period_no', Math.max(1, Number(e.target.value) || 1))} className={input} />
            </Field>
          </div>
        </fieldset>
      </Card>

      {report ? <ReportDocument report={report} /> : (
        <Card className="px-6 py-12 text-center text-sm text-soil-500">필수 항목(*)을 입력하고 보고서를 생성하세요.</Card>
      )}
    </div>
  )
}
