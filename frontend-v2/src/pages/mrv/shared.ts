// MRV 보고서 화면에서 같이 쓰는 타입·상수·포맷 함수
import type { FieldMrv } from '../../lib/types'

// Gold Standard 방법론의 배출량 산정 방법 3가지 (현재는 방법 3만 사용)
export const METHODS = [
  { no: 1, name: '직접 측정', desc: '폐쇄 챔버로 논에서 메탄을 직접 채취·분석', ready: false },
  { no: 2, name: '모델 기반', desc: '생지화학 모델(DNDC 등)로 배출량 추정', ready: false },
  { no: 3, name: 'IPCC 기본값 간이법', desc: 'IPCC 기본 배출계수 × 물관리 보정계수(SF_w)', ready: true },
]

export const ORGANIC_TYPES = ['투입 없음', '볏짚', '퇴비', '축분', '녹비', '기타']
export const PRESEASON_TYPES = ['180일 미만 비담수', '180일 이상 비담수', '30일 이상 담수', '365일 이상 비담수', '기타']

// 입력칸 기본값 (백엔드 DEFAULT_SF_P / DEFAULT_SF_O와 같은 값)
const DEFAULT_SF_P = 0.89
const DEFAULT_SF_O = 1.48

// 사업자가 직접 입력하는 정보
export interface OperatorInput {
  // 재배기간(보고서)마다
  season_start: string
  season_end: string
  organic_type: string
  sf_o: number
  preseason: string
  sf_p: number
  memo: string
  version: string
  // 사업 단위로 한 번
  operator: string
  manager: string
  project_title: string
  region: string
  period_no: number
}

export const EMPTY_INPUT: OperatorInput = {
  season_start: '',
  season_end: '',
  organic_type: '',
  sf_o: DEFAULT_SF_O,
  preseason: '',
  sf_p: DEFAULT_SF_P,
  memo: '',
  version: '1.0',
  operator: '',
  manager: '',
  project_title: '',
  region: '',
  period_no: 1,
}

// 보고서 한 건 = 사업자 입력 + 논 정보 + 서버가 계산한 모니터링 결과 (낙수 시각은 한국 시각으로 바꿔 둠)
export interface GsReport extends OperatorInput {
  field_name: string
  location_desc: string | null
  latitude: number
  longitude: number
  pnu: string | null
  jibun_addr: string | null
  generated_at: string // 보고서를 만든 시각 (ISO)
  mrv: FieldMrv
}

// 서버 시각(ISO) → 한국 시각 'YYYY-MM-DD HH:MM'
export const kstStamp = (iso: string) => {
  const d = new Date(new Date(iso).getTime() + 9 * 3600 * 1000)
  return d.toISOString().slice(0, 16).replace('T', ' ')
}

// 양식 규칙: 숫자는 1,000.00 / 날짜는 DD/MM/YYYY
export const fmt = (v: number, digits = 2) =>
  v.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })

export const ddmmyyyy = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

export const toDms = (deg: number, pos: string, neg: string) => {
  const abs = Math.abs(deg)
  const d = Math.floor(abs)
  const m = Math.floor((abs - d) * 60)
  const s = ((abs - d) * 60 - m) * 60
  return `${d}°${String(m).padStart(2, '0')}'${s.toFixed(1)}"${deg >= 0 ? pos : neg}`
}
