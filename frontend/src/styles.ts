import type { CSSProperties } from 'react'

// 여러 화면에서 같이 쓰는 모양

export const cardStyle: CSSProperties = {
  background: 'white',
  border: '0.5px solid #e0e0e0',
  borderRadius: '12px',
  padding: '16px',
  boxSizing: 'border-box',
}

// 둥근 상태 배지 (수위 상태, 펌프 상태, 알람 종류 등)
export const pillStyle = (bg: string, fg: string, fontSize = 12): CSSProperties => ({
  display: 'inline-block',
  fontSize: `${fontSize}px`,
  padding: '3px 10px',
  borderRadius: '20px',
  fontWeight: 600,
  background: bg,
  color: fg,
  whiteSpace: 'nowrap',
})

// "준비중"(회색) / "GS 등록 후 생성"(파랑) 표시 색
export const COMING_SOON_TONES = {
  gray: { border: '#cccccc', color: '#888888', background: 'white' },
  gs: { border: '#b9c6e4', color: '#5b6f9e', background: '#f5f7fc' },
} as const
