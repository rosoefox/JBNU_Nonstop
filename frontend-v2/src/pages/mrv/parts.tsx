// 보고서 문서 안에서 반복해서 쓰는 조각들
import clsx from 'clsx'
import type { ReactNode } from 'react'

// "KEY", "A" 같은 양식 섹션 번호 + 제목
export function Section({ code, title, en, children }: { code: string; title: string; en: string; children: ReactNode }) {
  return (
    <section className="grid gap-4 rounded-xl border border-soil-300/70 bg-white p-5">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="rounded-md bg-sprout-800 px-2 py-0.5 font-mono text-xs font-medium text-sprout-200">{code}</span>
        <h2 className="font-display text-lg font-bold">{title}</h2>
        <span className="text-xs text-soil-500">{en}</span>
      </div>
      {children}
    </section>
  )
}

// "A.1 사업 개요" 같은 하위 항목
export function Sub({ code, title, children }: { code: string; title: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="mb-2 text-sm font-semibold text-sprout-700"><span className="font-mono text-xs text-soil-500">{code}</span> {title}</p>
      {children}
    </div>
  )
}

// 왼쪽 항목명 / 오른쪽 값 2열 표
export function KeyValue({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-soil-200">
      <table className="w-full text-sm">
        <tbody className="divide-y divide-soil-200">
          {rows.map(([k, v]) => (
            <tr key={k}>
              <th className="w-[34%] bg-soil-100 px-3 py-2 text-left align-top font-semibold text-soil-700">{k}</th>
              <td className="px-3 py-2 text-forest-800">{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// 머리줄이 있는 표 (left: 왼쪽 정렬할 열 번호)
export function Grid({ headers, rows, left = [], minWidth = 560 }: { headers: string[]; rows: ReactNode[][]; left?: number[]; minWidth?: number }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-soil-200">
      <table className="w-full text-sm" style={{ minWidth }}>
        <thead className="bg-sprout-100 text-xs text-sprout-700">
          <tr>{headers.map((h) => <th key={h} className="px-3 py-2 text-center font-semibold whitespace-nowrap">{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-soil-200">
          {rows.map((r, i) => (
            <tr key={i} className="tabular-nums">
              {r.map((c, j) => (
                <td key={j} className={clsx('px-3 py-2 align-top', left.includes(j) ? 'text-left' : 'text-center', j === 0 && 'font-semibold')}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// 계산식 상자
export function Formula({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-lg border-l-4 border-sprout-500 bg-sprout-100 px-4 py-3 font-mono text-[13px] leading-7 text-forest-800">
      {children}
    </div>
  )
}

// 양식 규칙: 해당 없는 항목은 "Not Applicable"과 이유
export function NotApplicable({ reason }: { reason: string }) {
  return (
    <p className="rounded-lg border border-dashed border-soil-300 bg-soil-100 px-3 py-2 text-sm text-soil-600">
      <b className="font-semibold">해당 없음 (Not Applicable)</b> · {reason}
    </p>
  )
}

export function GsTag() {
  return <span className="rounded-md border border-lavender-200 bg-lavender-100 px-2 py-0.5 text-xs font-bold text-lavender-600">GS 등록 후 생성</span>
}
