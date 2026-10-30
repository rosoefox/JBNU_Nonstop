// 자주 쓰는 Tailwind 클래스 묶음 (버튼, 입력칸)
import clsx from 'clsx'

export const button = (variant: 'primary' | 'secondary' | 'ghost' = 'secondary', className?: string) => clsx(
  'inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition-colors',
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rain-500 disabled:cursor-not-allowed disabled:opacity-60',
  variant === 'primary' && 'bg-sprout-800 text-sprout-100 hover:bg-sprout-700',
  variant === 'secondary' && 'border border-soil-300 bg-white text-forest-800 hover:bg-soil-50',
  variant === 'ghost' && 'text-rain-600 hover:bg-rain-100',
  className,
)

export const input = clsx(
  'w-full rounded-lg border border-soil-300 bg-white px-3 py-2 text-sm text-forest-800',
  'placeholder:text-soil-400 focus:border-rain-500 focus:ring-2 focus:ring-rain-200 focus:outline-none',
)

export const label = 'mb-1 block text-xs font-semibold text-soil-600'

// 여러 노드를 한 그래프에 그릴 때 선 색 (Regrow 팔레트)
export const SERIES_COLORS = ['#11615b', '#49650c', '#b49034', '#655fa4', '#ca3232']
