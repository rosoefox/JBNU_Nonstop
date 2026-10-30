// 백엔드 API 응답 모양 (화면 표시용 함수·기준값은 domain.ts)

export interface Field {
  id: number
  field_name: string
  latitude: number
  longitude: number
  location_desc: string
  area_ha: number | null // 사업 면적 (사용자가 입력, MRV 계산에 사용)
  // V-WORLD 연속지적도에서 불러온 필지 정보
  pnu: string | null
  jibun_addr: string | null
  boundary: GeoJSON.MultiPolygon | null
  parcel_area_ha: number | null // 필지 경계로 계산한 면적
}

export interface Node {
  id: number
  field_id: number
  node_name: string | null
  dev_eui: string
  latitude: number
  longitude: number
  location_desc: string
  is_active: boolean
  has_pump: boolean
}

export type AlertType = 'LOW_WATER' | 'HIGH_WATER' | 'COMM_LOST' | 'IRRIGATION_FAIL'

export interface Alert {
  id: number
  node_id: number
  node_name: string | null
  field_id: number
  has_pump: boolean
  alert_type: AlertType
  water_level: number
  message: string
  is_resolved: boolean
  resolved_at: string | null
  resolution_note: string | null
  created_at: string
}

export interface SensorLog {
  node_id: number
  inner_water_level: number
  pump_on: boolean | null
  battery_voltage: number | null
  measured_at: string
}

export interface NodeStats {
  avg: number | null
  max: number | null
  min: number | null
  alert_count: number
}

export type Period = '1h' | '1d' | '1w' | '1m'

export type WaterRegime = 'CONTINUOUS' | 'SINGLE' | 'MULTIPLE'

// AWD 물관리 지표 (서버 awd_indicators)
export interface AwdIndicators {
  flooded_days: number
  wet_days: number
  dry_days: number
  cycle_count: number
  compliance_rate: number | null // -15cm 도달 후 compliance_hours 안에 재관개한 비율(%)
  compliant_events: number
  judged_events: number
  compliance_hours: number
  uptime_rate: number | null // 데이터 수집 가동률(%)
  expected_uplink_minutes: number
}

export interface AwdSummary {
  sample_count: number
  drain_events: number
  last_drain_at: string | null
  water_regime: WaterRegime
  sf_w: number
  indicators: AwdIndicators
}

export interface DrainEvent {
  no: number
  dry_at: string
  min_level_cm: number
  reflood_at: string | null
}

// GET /fields/{id}/mrv
export interface FieldMrv {
  node_names: string[]
  sample_count: number
  interval_min: number | null
  drain_events: DrainEvent[]
  water_regime: WaterRegime
  area_ha: number
  season_days: number
  factors: { ef_c: number; sf_w: number; sf_p: number; sf_o: number; gwp_ch4: number; uncertainty: number }
  calculation: {
    ef_bl: number
    ef_p: number
    ef_er: number
    baseline_tco2e: number
    project_tco2e: number
    net_tco2e: number
  }
  indicators: AwdIndicators
}
