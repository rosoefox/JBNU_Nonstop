// MRV 보고서 화면에서 같이 쓰는 타입·상수·포맷 함수
import type { FieldMrv } from '../../lib/types'


// 유기물 종류별 환산계수 CFOA (IPCC 2019 Refinement 표 5.14). '기타'는 퇴비 값을 씀
export const ORGANIC_TYPES = [
  { name: '투입 없음', cfoa: 0 },
  { name: '볏짚 (재배 30일 이상 전 투입)', cfoa: 0.19 },
  { name: '볏짚 (재배 30일 이내 투입)', cfoa: 1.0 },
  { name: '퇴비', cfoa: 0.17 },
  { name: '축분', cfoa: 0.21 },
  { name: '녹비', cfoa: 0.45 },
  { name: '기타 (유박 등, 퇴비 계수 적용)', cfoa: 0.17 },
]
// 작기 전 물관리 보정계수 SF_p (IPCC 2019 Refinement 표 5.12)
export const PRESEASON_TYPES = [
  { name: '180일 미만 비담수', sf: 1.0 },
  { name: '180일 이상 비담수', sf: 0.89 },
  { name: '30일 이상 담수', sf: 2.41 },
  { name: '365일 이상 비담수', sf: 0.59 },
]

// SF_o = (1 + 투입량(t/ha) × CFOA)^0.59 (IPCC 2019 식 5.3)
export const calcSfO = (type: string, amountTPerHa: number) => {
  const cfoa = ORGANIC_TYPES.find((o) => o.name === type)?.cfoa ?? 0
  return Math.round(Math.pow(1 + Math.max(0, amountTPerHa) * cfoa, 0.59) * 100) / 100
}

// 입력칸 기본값 (백엔드 DEFAULT_SF_P / DEFAULT_SF_O와 같은 값)
const DEFAULT_SF_P = 0.89
const DEFAULT_SF_O = 1.48

// 사업자가 직접 입력하는 정보
export interface OperatorInput {
  // 재배기간(보고서)마다
  season_start: string
  season_end: string
  organic_type: string
  organic_amount: number // 유기물 투입량 (t/ha)
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
  organic_amount: 0,
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
  field_id: number
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
