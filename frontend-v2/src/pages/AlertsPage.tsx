// 알림: 미해결 우선으로 보고, 조치 내용을 남기며 해결 처리
import clsx from 'clsx'
import { LineChart } from 'lucide-react'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Empty } from '../components/common'
import { Card, PageTitle, StatusBadge } from '../components/ui'
import { ApiError, resolveAlert } from '../lib/api'
import { button, input } from '../lib/classes'
import { ALERT_META, SUSTAINED_RULES, timeAgo } from '../lib/domain'
import { useAlerts, useFields } from '../lib/queries'
import type { Alert, AlertType, Period } from '../lib/types'

const DAY_MS = 86_400_000

// 알림 시점이 그래프에 들어오도록 기간을 고름
const periodFor = (iso: string): Period => {
  const age = Date.now() - new Date(iso).getTime()
  return age < DAY_MS ? '1d' : age < 7 * DAY_MS ? '1w' : '1m'
}

const duration = (from: string, to: string) => {
  const m = Math.max(0, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 60000))
  return m < 60 ? `${m}분` : m < 1440 ? `${Math.round(m / 60)}시간` : `${Math.round(m / 1440)}일`
}

export default function AlertsPage() {
  const [params, setParams] = useSearchParams()
  const fieldId = params.get('field') ? Number(params.get('field')) : null
  const [type, setType] = useState<AlertType | ''>('')
  const [showResolved, setShowResolved] = useState(false)
  const fields = useFields()
  const alerts = useAlerts(fieldId)

  const all = alerts.data ?? []
  const unresolved = all.filter((a) => !a.is_resolved)
  // 기준 시각 = 알림을 받아 온 시각 (렌더할 때마다 바뀌지 않게)
  const last24h = all.filter((a) => alerts.dataUpdatedAt - new Date(a.created_at).getTime() < DAY_MS)
  const shown = all
    .filter((a) => showResolved || !a.is_resolved)
    .filter((a) => !type || a.alert_type === type)

  const counts = (Object.keys(ALERT_META) as AlertType[]).map((t) => ({ t, n: unresolved.filter((a) => a.alert_type === t).length }))

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5 px-4 py-6 md:px-8">
      <PageTitle title="알림" subtitle="수위가 기준을 6시간 넘게 벗어나거나 30분 넘게 측정값이 없으면 자동으로 생겨요" />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {counts.map(({ t, n }) => (
          <button
            key={t}
            type="button"
            onClick={() => setType(type === t ? '' : t)}
            className={clsx('rounded-xl border bg-white px-4 py-3 text-left transition-colors', type === t ? 'border-sprout-600 ring-2 ring-sprout-300' : 'border-soil-300/70 hover:bg-soil-50')}
          >
            <StatusBadge tone={ALERT_META[t].tone}>{ALERT_META[t].label}</StatusBadge>
            <p className="mt-2 font-display text-2xl font-bold tabular-nums">{n}<span className="ml-1 font-sans text-xs font-medium text-soil-500">건 미해결</span></p>
            <p className="mt-1 text-[11px] text-soil-500">{SUSTAINED_RULES[t]}</p>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <select
          aria-label="필지"
          value={fieldId ?? ''}
          onChange={(e) => {
            const next = new URLSearchParams(params)
            if (e.target.value) next.set('field', e.target.value)
            else next.delete('field')
            setParams(next)
          }}
          className={clsx(input, 'w-auto min-w-44')}
        >
          <option value="">전체 필지</option>
          {(fields.data ?? []).map((f) => <option key={f.id} value={f.id}>{f.field_name}</option>)}
        </select>
        <label className="inline-flex items-center gap-2 text-sm text-soil-700">
          <input type="checkbox" checked={showResolved} onChange={(e) => setShowResolved(e.target.checked)} className="size-4 accent-sprout-700" />
          해결된 알림도 보기
        </label>
        <p className="ml-auto text-xs text-soil-500">미해결 {unresolved.length}건 · 24시간 내 {last24h.length}건 · 전체 {all.length}건</p>
      </div>

      <Card>
        {alerts.isPending ? <Empty>불러오는 중...</Empty> : shown.length === 0 ? (
          <Empty>{showResolved ? '알림이 없어요.' : '미해결 알림이 없어요.'}</Empty>
        ) : (
          <ul className="divide-y divide-soil-200">
            {shown.map((a) => <AlertRow key={a.id} alert={a} />)}
          </ul>
        )}
      </Card>
    </div>
  )
}

function AlertRow({ alert: a }: { alert: Alert }) {
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [note, setNote] = useState('')
  const resolve = useMutation({
    mutationFn: () => resolveAlert(a.id, note.trim() || undefined),
    onSuccess: () => {
      setEditing(false)
      queryClient.invalidateQueries({ queryKey: ['alerts'] })
    },
  })
  const meta = ALERT_META[a.alert_type]

  return (
    <li className={clsx('px-4 py-4', a.is_resolved && 'bg-soil-50')}>
      <div className="flex flex-wrap items-start gap-3">
        <StatusBadge tone={a.is_resolved ? 'none' : meta.tone}>{meta.label}</StatusBadge>
        <div className="min-w-0 flex-1">
          <p className={clsx('text-sm font-semibold', a.is_resolved && 'text-soil-500')}>
            {a.node_name ?? `Node ${a.node_id}`} <span className="font-normal text-soil-500">· {a.water_level}cm</span>
          </p>
          <p className="mt-0.5 text-sm text-soil-700">{a.message}</p>
          <p className="mt-1 text-xs text-soil-500" title={new Date(a.created_at).toLocaleString('ko-KR')}>
            {timeAgo(a.created_at)} · {new Date(a.created_at).toLocaleString('ko-KR')}
          </p>
          {a.is_resolved && a.resolved_at && (
            <p className="mt-1 text-xs text-forest-600">
              해결됨 · 발생 {duration(a.created_at, a.resolved_at)} 후{a.resolution_note && <> · 조치: {a.resolution_note}</>}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Link to={`/fields/${a.field_id}?node=${a.node_id}&period=${periodFor(a.created_at)}`} className={button('secondary', 'py-1.5 text-xs')}>
            <LineChart className="size-3.5" /> 그래프
          </Link>
          {!a.is_resolved && !editing && (
            <button type="button" onClick={() => setEditing(true)} className={button('primary', 'py-1.5 text-xs')}>해결</button>
          )}
        </div>
      </div>
      {editing && (
        <form
          className="mt-3 flex flex-wrap gap-2 sm:pl-24"
          onSubmit={(e) => { e.preventDefault(); resolve.mutate() }}
        >
          <input
            id={`note-${a.id}`}
            autoFocus
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={500}
            placeholder="조치 내용 (선택) 예: 수동으로 물 공급, 센서 재부팅"
            className={clsx(input, 'min-w-60 flex-1')}
          />
          <button type="submit" disabled={resolve.isPending} className={button('primary')}>{resolve.isPending ? '저장 중...' : '해결 처리'}</button>
          <button type="button" onClick={() => setEditing(false)} className={button('secondary')}>취소</button>
          {resolve.isError && (
            <p className="w-full text-xs text-clay-600">{resolve.error instanceof ApiError ? resolve.error.message : '해결 처리하지 못했어요'}</p>
          )}
        </form>
      )}
    </li>
  )
}
