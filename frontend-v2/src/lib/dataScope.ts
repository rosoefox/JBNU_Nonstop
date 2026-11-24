// 실험 모드에서 들어온 데이터(is_experiment)를 볼지 고르는 설정. 화면 전체가 같이 따름 (브라우저에 기억)
import { useSyncExternalStore } from 'react'

export type DataScope = 'all' | 'real' | 'experiment'

export const DATA_SCOPE_LABEL: Record<DataScope, string> = { all: '전체', real: '실제', experiment: '실험' }

const KEY = 'nonstop.dataScope'
const listeners = new Set<() => void>()

function read(): DataScope {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'real' || v === 'experiment' ? v : 'all'
  } catch {
    return 'all'
  }
}

let current: DataScope = read()

export function setDataScope(next: DataScope) {
  current = next
  try {
    localStorage.setItem(KEY, next)
  } catch {
    // 저장이 막혀 있어도 이번 화면에서는 적용
  }
  listeners.forEach((l) => l())
}

export function useDataScope(): DataScope {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => current,
    () => 'all',
  )
}
