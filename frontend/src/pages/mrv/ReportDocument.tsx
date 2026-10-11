// Gold Standard Monitoring Report 양식(v2.0) 순서대로 보여주는 보고서 문서
import type { CSSProperties } from 'react'
import ComingSoon from '../../components/common/ComingSoon'
import { DRY_LEVEL_CM, REARM_LEVEL_CM, STALE_MINUTES, WATER_REGIMES } from '../../domain'
import { Formula, GridTable, GsTag, KeyValueTable, NotApplicable, SectionHeader, Sub } from './parts'
import { GsReport, ddmmyyyy, fmt, sectionStyle, textStyle, toDms } from './shared'

const disabledButtonStyle: CSSProperties = {
  padding: '8px 11px',
  border: '1px solid rgba(255,255,255,0.35)',
  borderRadius: 6,
  color: 'rgba(255,255,255,0.6)',
  fontSize: 12,
  fontWeight: 700,
  background: 'transparent',
  cursor: 'not-allowed',
}

export default function ReportDocument({ report, isMobile }: { report: GsReport; isMobile: boolean }) {
  const { mrv } = report
  const f = mrv.factors
  const c = mrv.calculation
  const ind = mrv.indicators
  const regime = WATER_REGIMES[mrv.water_regime]
  const uncertaintyPct = Math.round(f.uncertainty * 100)
  const period = `${ddmmyyyy(report.season_start)} ~ ${ddmmyyyy(report.season_end)}`
  const projectTitle = report.project_title.trim() || `AWD 논 물관리 메탄 감축 사업 (${report.field_name})`
  const operatorText = `${report.operator}${report.manager.trim() ? ` (담당: ${report.manager.trim()})` : ''}`
  const today = ddmmyyyy(new Date().toISOString())
  const drains = mrv.drain_events.length

  const kpis = [
    { label: '모니터링 기간', value: `${mrv.season_days}일`, sub: period },
    { label: '낙수 횟수', value: `${drains}회`, sub: `${DRY_LEVEL_CM}cm 이하 도달 기준` },
    { label: '물관리 구분', value: regime.label, sub: `SF_w = ${f.sf_w}` },
    { label: '순 감축량 (GS VERs)', value: `${fmt(c.net_tco2e, 3)} tCO2e`, sub: `불확도 ${uncertaintyPct}% 차감 후` },
  ]

  return (
    <div
      style={{
        border: '1px solid #cfd8df',
        borderRadius: 8,
        overflow: 'hidden',
        background: '#fff',
        fontSize: 13,
        boxShadow: isMobile ? '0 8px 22px rgba(16, 24, 40, 0.07)' : '0 14px 35px rgba(16, 24, 40, 0.08)',
      }}
    >
      {/* 헤더 */}
      <div
        style={{
          background: '#0F6B4F',
          color: 'white',
          padding: isMobile ? '14px' : '18px 22px',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 14,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ minWidth: 0, flex: '1 1 220px' }}>
          <div style={{ fontSize: 11, opacity: 0.8, fontWeight: 700, letterSpacing: 0.5 }}>MONITORING REPORT</div>
          <div style={{ fontSize: isMobile ? 16 : 18, fontWeight: 800, marginTop: 2 }}>{projectTitle}</div>
          <div style={{ fontSize: 12, opacity: 0.9, marginTop: 5, lineHeight: 1.5 }}>
            모니터링 기간 {report.period_no}차 · {period} ({mrv.season_days}일)
          </div>
          <div
            style={{
              display: 'inline-flex',
              marginTop: 10,
              padding: '4px 8px',
              borderRadius: 4,
              background: 'rgba(255,255,255,0.14)',
              border: '1px solid rgba(255,255,255,0.25)',
              fontSize: 11,
              fontWeight: 700,
            }}
          >
            Gold Standard for the Global Goals · Monitoring Report 양식(v2.0) 기준
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" disabled title="준비중" style={disabledButtonStyle}>PDF 다운로드 (준비중)</button>
        </div>
      </div>

      {/* 핵심 수치 */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, minmax(0, 1fr))' : 'repeat(4, minmax(0, 1fr))', borderBottom: '1px solid #e5edf2' }}>
        {kpis.map((kpi, index) => (
          <div
            key={kpi.label}
            style={{
              padding: isMobile ? '12px 10px' : '14px 16px',
              borderRight: isMobile ? (index % 2 === 0 ? '1px solid #e5edf2' : 'none') : index < kpis.length - 1 ? '1px solid #e5edf2' : 'none',
              borderTop: isMobile && index > 1 ? '1px solid #e5edf2' : 'none',
              background: index % 2 === 0 ? '#f8faf9' : '#fbfcfe',
            }}
          >
            <div style={{ fontSize: 11, color: '#667085', marginBottom: 5, fontWeight: 700 }}>{kpi.label}</div>
            <div style={{ fontSize: isMobile ? 16 : 19, fontWeight: 800, color: '#0F6B4F', lineHeight: 1.15 }}>{kpi.value}</div>
            <div style={{ fontSize: 10, color: '#98a2b3', marginTop: 4 }}>{kpi.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ padding: isMobile ? '14px 12px' : '20px 22px', display: 'grid', gap: 16, background: '#fbfcfe' }}>
        {/* 핵심 사업 정보 */}
        <section style={sectionStyle}>
          <SectionHeader code="KEY" title="핵심 사업 정보" en="Key Project Information" />
          <KeyValueTable
            rows={[
              ['GS 사업 ID', <GsTag />],
              ['사업명', projectTitle],
              ['PDD 버전', <GsTag />],
              ['설계 인증일', <GsTag />],
              ['모니터링 보고서 버전', report.version || '-'],
              ['보고서 작성일', today],
              ['모니터링 기간 번호', `${report.period_no}차`],
              ['모니터링 기간', `${period} (시작일·종료일 포함, ${mrv.season_days}일)`],
              ['사업자', operatorText],
              ['대상국', '대한민국 (Republic of Korea)'],
              ['사업 규모·유형', 'Micro scale · Small-holder activity'],
              ['감축 활동 유형', 'Emission reductions activity (배출 감축)'],
              ['적용 활동 요건', 'Agriculture (농업)'],
              ['적용 방법론', '벼 재배 물관리 개선(AWD)에 의한 메탄 감축 방법론 — 방법 3: IPCC 기본값 간이법'],
              ['적용 상품 요건', 'GHG Emissions Reduction & Sequestration'],
            ]}
          />

          <Sub code="Table 1." title="지속가능발전 기여 (Sustainable Development Contributions)">
            <GridTable
              minWidth={480}
              headers={['SDG', 'SDG 영향', '달성량', '단위/상품']}
              rows={[['SDG 13 (기후 행동)', '✓ Emission reductions', fmt(c.net_tco2e, 3), 'tCO2e (GS VERs)']]}
            />
          </Sub>

          <Sub code="Table 2." title="상품 빈티지 (Product Vintages)">
            <GridTable
              minWidth={480}
              headers={['상품', '달성량', '시작일', '종료일']}
              rows={[['GS VERs', `${fmt(c.net_tco2e, 3)} tCO2e`, ddmmyyyy(report.season_start), ddmmyyyy(report.season_end)]]}
            />
          </Sub>

          <Sub code="Table 3." title="버퍼 기여 (Buffer contribution)">
            <ComingSoon tone="gs" label="GS 등록 후 생성">
              <GridTable minWidth={480} headers={['기간', '총 GS VERs', '버퍼 비율', '버퍼', '순 GS VERs']} rows={[['-', '-', '-', '-', '-']]} />
            </ComingSoon>
          </Sub>
        </section>

        {/* SECTION A */}
        <section style={sectionStyle}>
          <SectionHeader code="A" title="사업 설명" en="Description of Project" />
          <Sub code="A.1" title="사업 개요">
            <p style={textStyle}>
              논에 수위 센서 노드를 설치해 물 높이를 연속 측정하고, 수위가 {DRY_LEVEL_CM}cm까지 내려가면 다시 물을 대는
              AWD(Alternate Wetting and Drying, 물 걸러대기) 방식으로 물을 관리합니다. 상시담수 대비 메탄(CH4) 배출이 줄어든 양을
              Gold Standard 방법론의 IPCC 기본값 간이법으로 산정합니다.
            </p>
          </Sub>
          <Sub code="A.2" title="사업 위치">
            <KeyValueTable
              rows={[
                ['대상국', '대한민국'],
                ['광역 지자체', report.region.trim() || '-'],
                ['시·군·구', report.location_desc || '-'],
                ['지번 주소 / PNU', report.pnu ? `${report.jibun_addr ?? '-'} / ${report.pnu}` : '필지 경계 미등록'],
                ['좌표 (DMS)', `${toDms(report.latitude, 'N', 'S')}, ${toDms(report.longitude, 'E', 'W')}`],
                ['대상지 / 면적', `${report.field_name} / ${fmt(mrv.area_ha)} ha`],
              ]}
            />
          </Sub>
          <Sub code="A.3" title="적용 방법론 참조">
            <KeyValueTable
              rows={[
                ['감축·모니터링 방법론', 'Gold Standard 벼 재배 물관리 개선(AWD)에 의한 메탄 감축 방법론'],
                ['산정 방법', '방법 3. IPCC 기본값 간이법 (방법 1·2는 준비중)'],
                ['참조 지침', 'IPCC 2019 Refinement, Vol.4 Ch.5.5 벼 재배 (Rice Cultivation)'],
              ]}
            />
          </Sub>
          <Sub code="A.4" title="인증 기간 (Crediting period)">
            <ComingSoon tone="gs" label="GS 등록 후 생성">
              <KeyValueTable rows={[['시작일', '-'], ['종료일', '-'], ['기간', '-'], ['갱신 주기', '-']]} />
            </ComingSoon>
          </Sub>
        </section>

        {/* SECTION B */}
        <section style={sectionStyle}>
          <SectionHeader code="B" title="사업 이행" en="Implementation of Project" />
          <Sub code="B.1" title="이행 내용">
            <p style={textStyle}>
              {ddmmyyyy(report.season_start)} 이앙과 함께 모니터링 노드({mrv.node_names.join(', ')})를 설치하고 운영을 시작했습니다.
              재배기간 동안 낙수 {drains}회를 실시했습니다.
            </p>
            {report.memo.trim() && (
              <p style={{ ...textStyle, marginTop: 8, whiteSpace: 'pre-wrap', background: '#F7F9FB', border: '1px solid #e5edf2', borderRadius: 6, padding: '8px 10px' }}>
                {report.memo.trim()}
              </p>
            )}
          </Sub>
          <Sub code="B.1.1 · B.2" title="후속 조치 요청 / 설계 인증 이후 변경 사항">
            <ComingSoon tone="gs" label="GS 등록 후 생성">
              <KeyValueTable
                rows={[
                  ['B.1.1 후속 조치 요청 (FAR)', '-'],
                  ['B.2.1 일시적 이탈', '-'],
                  ['B.2.2 정정', '-'],
                  ['B.2.3 인증 기간 시작일 변경', '-'],
                  ['B.2.4 영구 변경', '-'],
                  ['B.2.5 설계 변경', '-'],
                ]}
              />
            </ComingSoon>
          </Sub>
        </section>

        {/* SECTION C */}
        <section style={sectionStyle}>
          <SectionHeader code="C" title="모니터링 체계" en="Description of Monitoring System" />
          <Formula>
            수위 센서 → STM32 노드 (NUCLEO-WL55JC1) → LoRaWAN (KR920) → 게이트웨이 (RAK7268V2) → TTN → 서버 (FastAPI) → DB (Supabase) → 웹 대시보드
          </Formula>
          <KeyValueTable
            rows={[
              ['측정 항목', '논 내부 수위 (cm, 지표면 기준)'],
              ['측정 주기', mrv.interval_min ? `약 ${mrv.interval_min}분 (측정 간격 중앙값)` : '-'],
              ['데이터 저장', '측정값마다 시각·노드 ID·원본 메시지를 DB(PostgreSQL/PostGIS)에 저장'],
              ['데이터 표준', 'OGC SensorThings API v1.1로 관측 데이터 제공 (/v1.1), 위치는 OGC Simple Features (WGS84)'],
              ['이상 감지', `${STALE_MINUTES}분 이상 수신이 없으면 통신 끊김 알림, 수위 이상 시 알림`],
              ['책임자', operatorText],
            ]}
          />
        </section>

        {/* SECTION D */}
        <section style={sectionStyle}>
          <SectionHeader code="D" title="데이터 및 파라미터" en="Data and Parameters" />
          <Sub code="D.1" title="고정 파라미터 (Fixed ex ante)">
            <GridTable
              minWidth={760}
              leftCols={[1]}
              headers={['파라미터', '설명', '단위', '사용 식', '용도', '값', '출처']}
              rows={[
                ['EF_c', '기본 배출계수 (한국)', 'kgCH4/ha/day', 'E.1, E.2', '기준·사업', String(f.ef_c), 'IPCC 2019'],
                ['SF_w', '물관리 보정계수', '-', 'E.1, E.2', '기준·사업', '1.0 / 0.71 / 0.55', 'IPCC 2019'],
                ['SF_p', `작기 전 물관리 보정계수 (${report.preseason})`, '-', 'E.1, E.2', '기준·사업', String(f.sf_p), 'IPCC 2019 · 사업자 입력'],
                ['SF_o', `유기물 투입 보정계수 (${report.organic_type})`, '-', 'E.1, E.2', '기준·사업', String(f.sf_o), 'IPCC 2019 · 사업자 입력'],
                ['GWP', '메탄 지구온난화지수', 'tCO2e/tCH4', 'E.1, E.2', '기준·사업', String(f.gwp_ch4), 'IPCC AR5'],
                ['UNC', '불확도 차감', '%', 'E.4', '기타', String(uncertaintyPct), 'GS 방법론'],
              ]}
            />
          </Sub>

          <Sub code="D.2" title="모니터링 파라미터 (Monitored)">
            <GridTable
              minWidth={900}
              leftCols={[1, 4, 6]}
              headers={['파라미터', '설명', '단위', '값', '측정 방법', '주기', 'QA/QC']}
              rows={[
                ['A', '사업 면적', 'ha', fmt(mrv.area_ha), '논 등록 정보 (측량값)', '기간당 1회', '등록 정보와 현장 확인'],
                ['t', '재배 일수', 'day', String(mrv.season_days), '이앙일·수확일 기록', '기간당 1회', '영농 기록과 대조'],
                ['WL', '논 내부 수위', 'cm', `${mrv.sample_count.toLocaleString('en-US')}건`, '수위 센서 연속 측정', mrv.interval_min ? `${mrv.interval_min}분` : '-', '결측·통신 끊김 알림, 원본 보관'],
                ['N_drain', '낙수 횟수 → SF_w 결정', '회', `${drains}회 (${regime.label})`, `WL이 ${DRY_LEVEL_CM}cm 이하 도달 시 1회`, '연속', `${REARM_LEVEL_CM}cm 회복 전 중복 집계 안 함`],
              ]}
            />
            <p style={{ ...textStyle, fontWeight: 800, margin: '12px 0 7px' }}>낙수 사건 기록 (N_drain 증빙)</p>
            <GridTable
              minWidth={520}
              headers={['회차', `${DRY_LEVEL_CM}cm 도달 시각`, '최저 수위', '재관개 시각']}
              rows={mrv.drain_events.map((e) => [
                `${e.no}회`,
                `${ddmmyyyy(e.dry_at)} ${e.dry_at.slice(11)}`,
                <span style={{ color: '#c2410c', fontWeight: 700 }}>{e.min_level_cm} cm</span>,
                e.reflood_at ? `${ddmmyyyy(e.reflood_at)} ${e.reflood_at.slice(11)}` : '-',
              ])}
            />
          </Sub>

          <Sub code="D.2" title="AWD 물관리 지표 (Monitoring indicators)">
            <GridTable
              minWidth={760}
              leftCols={[3]}
              headers={['지표', '값', '단위', '산정 방법']}
              rows={[
                ['담수 일수', String(ind.flooded_days), 'day', '수위 0cm 이상인 시간 합계'],
                ['습윤 일수', String(ind.wet_days), 'day', `수위 ${DRY_LEVEL_CM} ~ 0cm인 시간 합계`],
                ['건조 일수', String(ind.dry_days), 'day', `수위 ${DRY_LEVEL_CM}cm 이하인 시간 합계`],
                ['AWD 사이클', String(ind.cycle_count), '회', 'N_drain과 같음'],
                [
                  '준수율',
                  ind.compliance_rate === null ? '-' : `${ind.compliance_rate} (${ind.compliant_events}/${ind.judged_events})`,
                  '%',
                  `${DRY_LEVEL_CM}cm 도달 후 ${ind.compliance_hours}시간 안에 재관개(${REARM_LEVEL_CM}cm 위로 회복)한 비율`,
                ],
                [
                  '데이터 수집 가동률',
                  ind.uptime_rate === null ? '-' : String(ind.uptime_rate),
                  '%',
                  `받은 측정 수 ÷ 받아야 할 측정 수 (${ind.expected_uplink_minutes}분 주기 기준, 목표 90% 이상)`,
                ],
              ]}
            />
          </Sub>

          <Sub code="D.3" title="이전 모니터링 기간과 비교">
            <NotApplicable reason="1차 모니터링 기간이라 비교할 이전 기간이 없습니다." />
          </Sub>
          <Sub code="D.4" title="표본 계획 이행">
            <NotApplicable reason="표본 추출 없이 대상 논 전체를 연속 측정합니다." />
          </Sub>
          <Sub code="D.5 · D.6" title="반전(Reversal) 모니터링 / PER 보고">
            <NotApplicable reason="흡수(Removal) 사업이 아닌 배출 감축 사업이며, PER은 산림·블루카본 사업에만 적용됩니다." />
          </Sub>
        </section>

        {/* SECTION E — 계산은 서버(/fields/{id}/mrv)에서 하고 여기서는 과정만 보여줌 */}
        <section style={sectionStyle}>
          <SectionHeader code="E" title="감축량 산정" en="Calculation of Emission Reduction" />
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, minmax(0, 1fr))', gap: 14 }}>
            <Sub code="E.1" title="기준 배출량 (상시담수)">
              <Formula>
                EF_BL = EF_c × SF_w × SF_p × SF_o<br />
                = {f.ef_c} × 1.0 × {f.sf_p} × {f.sf_o} = <b>{fmt(c.ef_bl, 4)}</b> kgCH4/ha/day<br />
                BE = EF_BL × A × t × 10⁻³ × GWP<br />
                = {fmt(c.ef_bl, 4)} × {mrv.area_ha} × {mrv.season_days} × 10⁻³ × {f.gwp_ch4} = <b>{fmt(c.baseline_tco2e, 3)}</b> tCO2e
              </Formula>
            </Sub>
            <Sub code="E.2" title={`사업 배출량 (${regime.label})`}>
              <Formula>
                EF_P = EF_c × SF_w × SF_p × SF_o<br />
                = {f.ef_c} × {f.sf_w} × {f.sf_p} × {f.sf_o} = <b>{fmt(c.ef_p, 4)}</b> kgCH4/ha/day<br />
                PE = EF_P × A × t × 10⁻³ × GWP<br />
                = {fmt(c.ef_p, 4)} × {mrv.area_ha} × {mrv.season_days} × 10⁻³ × {f.gwp_ch4} = <b>{fmt(c.project_tco2e, 3)}</b> tCO2e
              </Formula>
            </Sub>
          </div>

          <Sub code="E.3" title="누출 배출량 (Leakage)">
            <ComingSoon>
              <Formula>LE = - tCO2e</Formula>
            </ComingSoon>
          </Sub>

          <Sub code="E.4" title="순 감축량 (Net benefits)">
            <GridTable
              minWidth={620}
              headers={['SDG', '기준 배출 (tCO2e)', '사업 배출 (tCO2e)', '누출 (tCO2e)', '순 감축 (tCO2e)']}
              rows={[['13 · Emission reductions', fmt(c.baseline_tco2e, 3), fmt(c.project_tco2e, 3), '준비중', <b style={{ color: '#0F6B4F' }}>{fmt(c.net_tco2e, 3)}</b>]]}
            />
            <p style={{ ...textStyle, color: '#667085', marginTop: 7, fontSize: 11 }}>
              순 감축 = (BE − PE) × (1 − {f.uncertainty}) = ({fmt(c.baseline_tco2e, 3)} − {fmt(c.project_tco2e, 3)}) × {1 - f.uncertainty} = {fmt(c.net_tco2e, 3)} tCO2e
            </p>
          </Sub>

          <Sub code="E.5 · E.6" title="승인 PDD 예상치와 비교">
            <ComingSoon tone="gs" label="GS 등록 후 생성">
              <GridTable minWidth={480} headers={['SDG', 'PDD 사전 예상치', '이번 기간 실제 달성치']} rows={[['13', '-', fmt(c.net_tco2e, 3)]]} />
            </ComingSoon>
          </Sub>
        </section>

        {/* SECTION F ~ L */}
        <section style={sectionStyle}>
          <SectionHeader code="F–L" title="기타 보고 항목" en="Safeguards · Gender · SD · Stakeholder · Benefit · Co-benefits · Double issuance" />
          <ComingSoon tone="gs" label="GS 등록 후 생성">
            <KeyValueTable
              rows={[
                ['F. 안전장치 보고', 'Safeguards Reporting'],
                ['G. 젠더 보고', 'Gender Reporting'],
                ['H. 지속가능발전 기여', 'Sustainable Development Contribution'],
                ['I. 이해관계자 의견·법적 분쟁', 'Stakeholder Inputs and Legal Disputes'],
                ['J. 이익 공유', 'Benefit Sharing'],
                ['K. 기타 부수 효과', 'Voluntary Disclosure of Co-benefits'],
                ['L. 이중 발행 방지 확인', 'Confirmation of Avoidance of Double Issuance'],
              ]}
            />
          </ComingSoon>
        </section>
      </div>
    </div>
  )
}
