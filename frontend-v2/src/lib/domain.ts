// AWD 물관리 기준값과 화면 표시용 공용 함수 (백엔드 main.py의 같은 이름 상수와 맞출 것)
import type { AlertType, Node, Period, WaterRegime } from './types'

export const DRY_LEVEL_CM = -15 // 이 아래로 내려가면 재관개 (낙수 1회)
export const TARGET_LEVEL_CM = 5 // 재관개 목표 수위
export const REARM_LEVEL_CM = -10 // 이 위로 회복돼야 다음 낙수를 셈 (중복 집계 방지)
// 업링크 주기를 아직 몰라서 30분으로 잡음 (백엔드 COMM_LOST_MINUTES와 같이 조정)
export const STALE_MINUTES = 30
// 논이 하나도 없을 때 지도 기본 위치 (전북대 전주캠퍼스)
export const DEFAULT_MAP_CENTER: [number, number] = [35.8468, 127.1294]

// 화면 색 묶음: 배지·지도·그래프가 같은 이름을 씀 (Tone → Tailwind 클래스는 components/ui.tsx)
export type Tone = 'flooded' | 'wet' | 'dry' | 'over' | 'stale' | 'none' | 'info'

// 지도·그래프처럼 클래스가 아닌 색 값이 필요한 곳 (index.css 팔레트와 같은 값)
export const TONE_HEX: Record<Tone, string> = {
  flooded: '#11615b', // rain-600
  wet: '#82a632', // sprout-500
  dry: '#ca3232', // clay-500
  over: '#b49034', // mustard-500
  stale: '#655fa4', // lavender-500
  none: '#aba5a0', // soil-400
  info: '#063a21', // forest-800
}

// 논 상태 3단계(담수/습윤/건조, LX 제안서 기준) + 목표 수위를 넘긴 경우 경고용 과담수
export type LevelStatus = 'OVERFLOODED' | 'FLOODED' | 'WET' | 'DRY' | 'NO_DATA'

export const classifyLevel = (level: number | null | undefined): LevelStatus => {
  if (level === null || level === undefined) return 'NO_DATA'
  if (level <= DRY_LEVEL_CM) return 'DRY' // -15cm 이하: 건조 (재관개 필요)
  if (level < 0) return 'WET' // -15 ~ 0cm: 습윤 (물은 빠졌지만 흙은 젖은 상태)
  if (level <= TARGET_LEVEL_CM) return 'FLOODED' // 0 ~ +5cm: 담수
  return 'OVERFLOODED' // +5cm 초과: 과담수 (경고)
}

export const LEVEL_STATUS: Record<LevelStatus, { label: string; tone: Tone }> = {
  OVERFLOODED: { label: '과담수', tone: 'over' },
  FLOODED: { label: '담수', tone: 'flooded' },
  WET: { label: '습윤', tone: 'wet' },
  DRY: { label: '건조', tone: 'dry' },
  NO_DATA: { label: '데이터 없음', tone: 'none' },
}

export const isStale = (iso: string | null | undefined): boolean =>
  !iso || Date.now() - new Date(iso).getTime() > STALE_MINUTES * 60 * 1000

// 지금 상태: 측정 기록이 없거나 오래됐으면 수위 대신 그 사실을 보여줌
export const currentStatus = (level: number | null | undefined, measuredAt: string | null | undefined) => {
  if (level === null || level === undefined || !measuredAt) return { label: '측정 기록 없음', tone: 'none' as Tone }
  if (isStale(measuredAt)) return { label: '통신 끊김', tone: 'stale' as Tone }
  return LEVEL_STATUS[classifyLevel(level)]
}

export const formatLevel = (level: number | null | undefined) =>
  level === null || level === undefined ? '-' : `${level > 0 ? '+' : ''}${level}`

export const nodeLabel = (n: Pick<Node, 'id' | 'node_name'>) => n.node_name || `센서 ${n.id}`

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
export const ALERT_META: Record<AlertType, { label: string; tone: Tone }> = {
  LOW_WATER: { label: '재관개 필요', tone: 'dry' },
  IRRIGATION_FAIL: { label: '재관개 실패', tone: 'dry' },
  HIGH_WATER: { label: '수위 높음', tone: 'over' },
  COMM_LOST: { label: '통신 끊김', tone: 'stale' },
}

// 펌프 상태 (지도·패널·표 공용)
export const pumpStatus = (hasPump: boolean, pumpOn: boolean | null | undefined): { label: string; tone: Tone } =>
  !hasPump
    ? { label: '펌프 없음', tone: 'none' }
    : pumpOn === true
      ? { label: '펌프 작동 중', tone: 'flooded' }
      : pumpOn === false
        ? { label: '펌프 정지', tone: 'none' }
        : { label: '펌프 상태 수신 전', tone: 'none' }

// Gold Standard 물관리 구분 (낙수 횟수 → SF_w)
export const WATER_REGIMES: Record<WaterRegime, { label: string; rule: string }> = {
  CONTINUOUS: { label: '상시담수', rule: '낙수 0회' },
  SINGLE: { label: '단일 낙수', rule: '낙수 1회' },
  MULTIPLE: { label: 'AWD', rule: '낙수 2회 이상' },
}

// 알림이 생기는 조건 (서버 main.py refresh_derived_alerts와 같은 내용)
export const SUSTAINED_HOURS = 6
export const SUSTAINED_RULES: Record<AlertType, string> = {
  LOW_WATER: `${DRY_LEVEL_CM}cm 이하 ${SUSTAINED_HOURS}시간 이상 (펌프 없는 센서)`,
  IRRIGATION_FAIL: `${DRY_LEVEL_CM}cm 이하 ${SUSTAINED_HOURS}시간 이상 (펌프 연결 센서)`,
  HIGH_WATER: `+${TARGET_LEVEL_CM}cm 초과 ${SUSTAINED_HOURS}시간 이상`,
  COMM_LOST: `${STALE_MINUTES}분 넘게 측정값 없음`,
}

export const PERIODS: { value: Period; label: string }[] = [
  { value: '1h', label: '1시간' },
  { value: '1d', label: '1일' },
  { value: '1w', label: '1주' },
  { value: '1m', label: '1개월' },
]
