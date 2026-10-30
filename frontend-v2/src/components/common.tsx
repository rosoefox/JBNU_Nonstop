import clsx from 'clsx'
import type { ReactNode } from 'react'
import { PERIODS } from '../lib/domain'
import type { Period } from '../lib/types'

// 기간 선택 탭
export function PeriodTabs({ value, onChange }: { value: Period; onChange: (p: Period) => void }) {
  return (
    <div className="inline-flex rounded-lg bg-soil-200 p-0.5 text-xs font-semibold" role="tablist">
      {PERIODS.map((p) => (
        <button
          key={p.value}
          type="button"
          role="tab"
          aria-selected={value === p.value}
          onClick={() => onChange(p.value)}
          className={clsx('rounded-md px-3 py-1.5 transition-colors', value === p.value ? 'bg-white text-forest-800 shadow-sm' : 'text-soil-600 hover:text-forest-800')}
        >
          {p.label}
        </button>
      ))}
    </div>
  )
}

// 아직 안 되는 기능: 내용은 흐리게 두고 표시 (gs: Gold Standard 사업 등록 후 생기는 항목)
export function ComingSoon({ children, label = '준비중', gs = false, corner = false, className }: {
  children: ReactNode; label?: string; gs?: boolean; corner?: boolean; className?: string
}) {
  return (
    <div className={clsx('relative', className)}>
      <div aria-hidden className="pointer-events-none select-none opacity-40 grayscale">{children}</div>
      <span className={clsx(
        'absolute whitespace-nowrap rounded-lg border px-3 py-1 text-xs font-bold',
        corner ? 'top-2 right-2 px-2 py-0.5' : 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
        gs ? 'border-lavender-200 bg-lavender-100 text-lavender-600' : 'border-soil-300 bg-white text-soil-600',
      )}>
        {gs ? 'GS 등록 후 생성' : label}
      </span>
    </div>
  )
}

// 왼쪽 항목명 / 오른쪽 값 목록
export function InfoList({ rows }: { rows: [ReactNode, ReactNode][] }) {
  return (
    <dl className="divide-y divide-soil-200 text-sm">
      {rows.map(([k, v], i) => (
        <div key={i} className="flex justify-between gap-4 py-2">
          <dt className="shrink-0 text-soil-600">{k}</dt>
          <dd className="min-w-0 text-right break-keep text-forest-800">{v}</dd>
        </div>
      ))}
    </dl>
  )
}

// 빈 상태 안내
export function Empty({ children }: { children: ReactNode }) {
  return <p className="px-4 py-8 text-center text-sm text-soil-500">{children}</p>
}

// 불러오는 중 / 불러오기 실패 안내 (빈 화면이 되지 않게)
export function LoadState({ error, onRetry }: { error?: boolean; onRetry?: () => void }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 px-4 py-20 text-center">
      {error ? (
        <>
          <p className="text-base font-semibold text-clay-600">서버에서 데이터를 받지 못했어요</p>
          <p className="text-sm text-soil-600">서버나 DB가 잠시 꺼져 있을 수 있어요. 잠시 후 다시 시도해 주세요.</p>
          {onRetry && (
            <button type="button" onClick={onRetry} className="mt-1 rounded-lg bg-sprout-800 px-4 py-2 text-sm font-semibold text-sprout-100 hover:bg-sprout-700">
              다시 시도
            </button>
          )}
        </>
      ) : (
        <>
          <span className="size-6 animate-spin rounded-full border-2 border-soil-300 border-t-sprout-600" aria-hidden />
          <p className="text-sm text-soil-600">불러오는 중이에요</p>
        </>
      )}
    </div>
  )
}
