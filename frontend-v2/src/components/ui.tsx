import clsx from 'clsx'
import type { ReactNode } from 'react'
import type { Tone } from '../lib/domain'
import { TONE_BADGE, TONE_DOT } from '../lib/tones'

// 상태 배지: 점 + 이름 (담수/습윤/건조/과담수/통신 끊김 등)
export function StatusBadge({ tone, children, className }: { tone: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={clsx('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset', TONE_BADGE[tone], className)}>
      <span className={clsx('size-1.5 rounded-full', TONE_DOT[tone])} aria-hidden />
      {children}
    </span>
  )
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={clsx('rounded-xl border border-soil-300/70 bg-white', className)}>{children}</section>
}

// 카드 머리줄: 제목 + 오른쪽 보조 요소(링크, 버튼 등)
export function CardHeader({ title, aside }: { title: ReactNode; aside?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 pt-4 pb-2">
      <h2 className="text-sm font-semibold text-forest-800">{title}</h2>
      {aside}
    </div>
  )
}

// 숫자 하나를 크게 보여주는 칸
export function Stat({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: ReactNode; tone?: 'alert' }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-soil-600">{label}</p>
      <p className={clsx('mt-1 font-display text-2xl font-bold leading-none tabular-nums', tone === 'alert' ? 'text-clay-600' : 'text-forest-800')}>{value}</p>
      {hint && <p className="mt-1 truncate text-xs text-soil-500">{hint}</p>}
    </div>
  )
}

// 페이지 맨 위 제목
export function PageTitle({ title, subtitle, aside }: { title: string; subtitle?: string; aside?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-2xl font-bold text-forest-800">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-soil-600">{subtitle}</p>}
      </div>
      {aside}
    </div>
  )
}
