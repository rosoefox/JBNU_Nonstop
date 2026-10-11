// AWD 물관리 기준값과 화면 표시용 공용 함수 (백엔드 main.py의 같은 이름 상수와 맞출 것)
import { AlertType, Node, WaterRegime } from './types'

export const DRY_LEVEL_CM = -15 // 이 아래로 내려가면 재관개 (낙수 1회)
export const TARGET_LEVEL_CM = 5 // 재관개 목표 수위
export const REARM_LEVEL_CM = -10 // 이 위로 회복돼야 다음 낙수를 셈 (중복 집계 방지)
// 업링크 주기를 아직 몰라서 30분으로 잡음 (백엔드 COMM_LOST_MINUTES와 같이 조정)
export const STALE_MINUTES = 30
// 논이 하나도 없을 때 지도 기본 위치 (전북대 전주캠퍼스)
export const DEFAULT_MAP_CENTER: [number, number] = [35.8468, 127.1294]

// 논 상태 3단계(담수/습윤/건조, LX 제안서 기준) + 목표 수위를 넘긴 경우 경고용 과담수
export type LevelStatus = 'OVERFLOODED' | 'FLOODED' | 'WET' | 'DRY' | 'NO_DATA'

export const classifyLevel = (level: number | null | undefined): LevelStatus => {
  if (level === null || level === undefined) return 'NO_DATA'
  if (level <= DRY_LEVEL_CM) return 'DRY' // -15cm 이하: 건조 (재관개 필요)
  if (level < 0) return 'WET' // -15 ~ 0cm: 습윤 (물은 빠졌지만 흙은 젖은 상태)
  if (level <= TARGET_LEVEL_CM) return 'FLOODED' // 0 ~ +5cm: 담수
  return 'OVERFLOODED' // +5cm 초과: 과담수 (경고)
}

const LEVEL_STATUS: Record<LevelStatus, { label: string; color: string }> = {
  OVERFLOODED: { label: '과담수 (경고)', color: '#e65100' },
  FLOODED: { label: '담수', color: '#1565c0' },
  WET: { label: '습윤', color: '#1D9E75' },
  DRY: { label: '건조', color: '#E24B4A' },
  NO_DATA: { label: '데이터 없음', color: '#aaaaaa' },
}

export const statusLabel = (status: LevelStatus) => LEVEL_STATUS[status].label
export const statusColor = (status: LevelStatus) => LEVEL_STATUS[status].color

export const isStale = (iso: string | null | undefined): boolean =>
  !iso || Date.now() - new Date(iso).getTime() > STALE_MINUTES * 60 * 1000

// 수위 상태 배지: 측정 기록이 없거나 오래됐으면 수위 대신 그 사실을 보여줌
export const levelBadge = (level: number | null | undefined, measuredAt: string | null | undefined) => {
  if (level === null || level === undefined || !measuredAt) return { label: '측정 기록 없음', color: '#aaaaaa' }
  if (isStale(measuredAt)) return { label: '통신 끊김', color: '#7F77DD' }
  return LEVEL_STATUS[classifyLevel(level)]
}

export const formatLevel = (level: number | null | undefined) =>
  level === null || level === undefined ? '-' : `${level > 0 ? '+' : ''}${level}`

export const nodeLabel = (n: Pick<Node, 'id' | 'node_name'>) => n.node_name || `Node ${n.id}`

// 측정 시각 → "3분 전" 같은 상대 시간
export const timeAgo = (iso: string | null | undefined): string => {
  if (!iso) return '-'
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (minutes < 1) return '방금 전'
  if (minutes < 60) return `${minutes}분 전`
  if (minutes < 1440) return `${Math.floor(minutes / 60)}시간 전`
  return `${Math.floor(minutes / 1440)}일 전`
}

// 수위 알람은 기준을 벗어난 상태가 6시간 이상 이어질 때 서버가 만듦 (main.py SUSTAINED_HOURS)
//  - 재관개 필요: 펌프 없는 노드가 -15cm 이하 6시간 / 재관개 실패: 펌프 노드인데 -15cm 이하 6시간
//  - 수위 높음: +5cm 초과 6시간 / 통신 끊김: 30분 넘게 측정값 없음
export const alertMeta = (alertType: AlertType) => {
  switch (alertType) {
    case 'LOW_WATER':
      return { label: '재관개 필요', bg: '#fce4ec', fg: '#c62828' }
    case 'HIGH_WATER':
      return { label: '수위 높음', bg: '#fff8e1', fg: '#f57f17' }
    case 'COMM_LOST':
      return { label: '통신 끊김', bg: '#f3e5f5', fg: '#7b1fa2' }
    case 'IRRIGATION_FAIL':
      return { label: '재관개 실패', bg: '#c62828', fg: '#ffffff' }
  }
}

// 펌프 상태 표시 (지도·패널·표 공용)
export const pumpStatus = (hasPump: boolean, pumpOn: boolean | null | undefined) =>
  !hasPump
    ? { label: '펌프 없음', bg: '#f5f5f5', fg: '#aaaaaa' }
    : pumpOn === true
      ? { label: '펌프 작동 중', bg: '#e3f2fd', fg: '#1565c0' }
      : pumpOn === false
        ? { label: '펌프 정지', bg: '#f0f0f0', fg: '#888888' }
        : { label: '펌프 상태 수신 전', bg: '#f5f5f5', fg: '#aaaaaa' }

// Gold Standard 물관리 구분 (낙수 횟수 → SF_w)
export const WATER_REGIMES: Record<WaterRegime, { label: string; rule: string }> = {
  CONTINUOUS: { label: '상시담수', rule: '낙수 0회' },
  SINGLE: { label: '단일 낙수', rule: '낙수 1회' },
  MULTIPLE: { label: 'AWD', rule: '낙수 2회 이상' },
}
