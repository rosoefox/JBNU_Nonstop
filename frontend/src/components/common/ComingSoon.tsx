import type { CSSProperties, ReactNode } from 'react'
import { COMING_SOON_TONES } from '../../styles'

interface ComingSoonProps {
  children: ReactNode
  label?: string
  tone?: keyof typeof COMING_SOON_TONES
  size?: 'sm' | 'md' | 'lg'
  // center: 가운데 / right: 오른쪽 끝 (카드 안 버튼 줄) / top: 위쪽 가운데 (페이지 전체)
  placement?: 'center' | 'right' | 'top'
}

const SIZES = {
  sm: { fontSize: 13, padding: '2px 14px' },
  md: { fontSize: 14, padding: '6px 22px' },
  lg: { fontSize: 24, padding: '18px 48px' },
}

const PLACEMENTS: Record<NonNullable<ComingSoonProps['placement']>, CSSProperties> = {
  center: { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' },
  right: { top: '50%', right: 12, transform: 'translateY(-50%)' },
  top: { top: 200, left: '50%', transform: 'translateX(-50%)', boxShadow: '0 4px 16px rgba(0,0,0,0.12)' },
}

// 아직 안 되는 기능: 원래 화면은 그대로 두고 회색 처리 + 조작 막기 + 표시
export default function ComingSoon({
  children, label = '준비중', tone = 'gray', size = 'md', placement = 'center',
}: ComingSoonProps) {
  const colors = COMING_SOON_TONES[tone]
  return (
    <div style={{ position: 'relative' }}>
      <div
        aria-hidden
        style={{
          filter: 'grayscale(1)', opacity: 0.45, pointerEvents: 'none', userSelect: 'none',
          paddingRight: placement === 'right' ? 90 : undefined,
        }}
      >
        {children}
      </div>
      <div style={{
        position: 'absolute', ...PLACEMENTS[placement], ...SIZES[size],
        background: colors.background, border: `1.5px solid ${colors.border}`, color: colors.color,
        borderRadius: 8, fontWeight: 700, whiteSpace: 'nowrap',
      }}>
        {label}
      </div>
    </div>
  )
}
