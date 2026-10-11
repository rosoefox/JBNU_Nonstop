// 보고서 문서 안에서 반복해서 쓰는 작은 조각들
import type { CSSProperties, ReactNode } from 'react'
import { COMING_SOON_TONES } from '../../styles'
import { textStyle } from './shared'

const thStyle: CSSProperties = {
  padding: '9px 8px',
  background: '#EAF4EF',
  borderBottom: '1px solid #9bbcae',
  borderRight: '1px solid #b7c7c0',
  fontWeight: 800,
  color: '#111827',
  textAlign: 'center',
  whiteSpace: 'nowrap',
}

const tdStyle: CSSProperties = {
  padding: '9px 8px',
  borderTop: '1px solid #c2cdc8',
  borderRight: '1px solid #c2cdc8',
  textAlign: 'center',
  verticalAlign: 'top',
}

const labelCellStyle: CSSProperties = {
  padding: '8px 10px',
  background: '#F2F7F5',
  fontWeight: 800,
  width: '32%',
  border: '1px solid #d9e2e8',
  color: '#111827',
}

const valueCellStyle: CSSProperties = {
  padding: '8px 10px',
  border: '1px solid #d9e2e8',
  color: '#344054',
}

// "KEY", "A" 같은 양식 섹션 번호 + 제목
export function SectionHeader({ code, title, en }: { code: string; title: string; en: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <div
        style={{
          minWidth: 22,
          height: 22,
          padding: '0 5px',
          boxSizing: 'border-box',
          display: 'grid',
          placeItems: 'center',
          background: '#0F6B4F',
          color: 'white',
          fontSize: 11,
          fontWeight: 800,
          borderRadius: 4,
        }}
      >
        {code}
      </div>
      <span style={{ fontSize: 14, fontWeight: 800, color: '#111827' }}>{title}</span>
      <span style={{ fontSize: 11, color: '#98a2b3', fontWeight: 600 }}>{en}</span>
    </div>
  )
}

// "A.1 사업 개요" 같은 하위 항목
export function Sub({ code, title, children }: { code: string; title: string; children: ReactNode }) {
  return (
    <div>
      <p style={{ fontSize: 12, fontWeight: 800, color: '#0F6B4F', margin: '0 0 7px' }}>{code} {title}</p>
      {children}
    </div>
  )
}

// 왼쪽 항목명 / 오른쪽 값 2열 표
export function KeyValueTable({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
      <tbody>
        {rows.map(([label, value]) => (
          <tr key={label}>
            <td style={labelCellStyle}>{label}</td>
            <td style={valueCellStyle}>{value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// 머리줄이 있는 일반 표 (leftCols: 왼쪽 정렬할 열 번호)
export function GridTable({ headers, rows, minWidth = 560, leftCols = [] }: {
  headers: string[]; rows: ReactNode[][]; minWidth?: number; leftCols?: number[]
}) {
  return (
    <div style={{ overflowX: 'auto', border: '1px solid #b7c7c0', borderRadius: 8 }}>
      <table style={{ width: '100%', minWidth, borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr>
            {headers.map((h) => (
              <th key={h} style={thStyle}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#f8faf9' }}>
              {row.map((cell, j) => (
                <td key={j} style={{ ...tdStyle, textAlign: leftCols.includes(j) ? 'left' : 'center', fontWeight: j === 0 ? 800 : 400 }}>{cell}</td>
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
    <div style={{ background: '#F7F9FB', border: '1px solid #e5edf2', borderRadius: 6, padding: '10px 12px', fontSize: 12, color: '#111827', fontFamily: 'Consolas, monospace', lineHeight: 1.7, overflowX: 'auto' }}>
      {children}
    </div>
  )
}

// 표 안의 한 칸이 Gold Standard 등록 후 생기는 값일 때
export function GsTag() {
  const c = COMING_SOON_TONES.gs
  return (
    <span style={{ border: `1px solid ${c.border}`, color: c.color, background: c.background, borderRadius: 6, padding: '1px 8px', fontSize: 11, fontWeight: 700 }}>
      GS 등록 후 생성
    </span>
  )
}

// 양식 규칙: 해당 없는 항목은 "Not Applicable"과 이유를 명시
export function NotApplicable({ reason }: { reason: string }) {
  return (
    <p style={{ ...textStyle, color: '#667085', background: '#F7F9FB', border: '1px dashed #d0d5dd', borderRadius: 6, padding: '8px 10px' }}>
      <b>해당 없음 (Not Applicable)</b> — {reason}
    </p>
  )
}
