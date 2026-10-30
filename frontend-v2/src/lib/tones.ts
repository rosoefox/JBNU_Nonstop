import type { Tone } from './domain'

// 상태 톤 → Tailwind 클래스 (클래스 이름을 문자열 그대로 둬야 Tailwind가 찾아서 만듦)
export const TONE_BADGE: Record<Tone, string> = {
  flooded: 'bg-rain-100 text-rain-700 ring-rain-300',
  wet: 'bg-sprout-200 text-sprout-700 ring-sprout-300',
  dry: 'bg-clay-100 text-clay-700 ring-clay-200',
  over: 'bg-mustard-200 text-mustard-600 ring-mustard-500/40',
  stale: 'bg-lavender-100 text-lavender-600 ring-lavender-200',
  none: 'bg-soil-200 text-soil-600 ring-soil-300',
  info: 'bg-forest-100 text-forest-800 ring-forest-200',
}

export const TONE_DOT: Record<Tone, string> = {
  flooded: 'bg-rain-600',
  wet: 'bg-sprout-500',
  dry: 'bg-clay-500',
  over: 'bg-mustard-500',
  stale: 'bg-lavender-500',
  none: 'bg-soil-400',
  info: 'bg-forest-800',
}

export const TONE_TEXT: Record<Tone, string> = {
  flooded: 'text-rain-600',
  wet: 'text-sprout-600',
  dry: 'text-clay-600',
  over: 'text-mustard-600',
  stale: 'text-lavender-500',
  none: 'text-soil-500',
  info: 'text-forest-800',
}
