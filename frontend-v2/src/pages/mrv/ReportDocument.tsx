// Gold Standard Monitoring Report 양식(v2.0) 순서대로 보여주는 보고서 문서
import { ComingSoon } from '../../components/common'
import { DRY_LEVEL_CM, REARM_LEVEL_CM, STALE_MINUTES, WATER_REGIMES } from '../../lib/domain'
import { Formula, Grid, GsTag, KeyValue, NotApplicable, Section, Sub } from './parts'
import { ddmmyyyy, fmt, toDms, type GsReport } from './shared'

export default function ReportDocument({ report }: { report: GsReport }) {
  const { mrv } = report
  const f = mrv.factors
  const c = mrv.calculation
  const ind = mrv.indicators
  const regime = WATER_REGIMES[mrv.water_regime]
  const unc = Math.round(f.uncertainty * 100)
  const period = `${ddmmyyyy(report.season_start)} ~ ${ddmmyyyy(report.season_end)}`
  const title = report.project_title.trim() || `AWD 논 물관리 메탄 감축 사업 (${report.field_name})`
  const operator = `${report.operator}${report.manager.trim() ? ` (담당: ${report.manager.trim()})` : ''}`
  const drains = mrv.drain_events.length

  const kpis = [
    { label: '모니터링 기간', value: `${mrv.season_days}일`, sub: period },
    { label: '낙수 (AWD 사이클)', value: `${drains}회`, sub: `${DRY_LEVEL_CM}cm 이하 도달 기준` },
    { label: '물관리 구분', value: regime.label, sub: `SF_w = ${f.sf_w}` },
    { label: '순 감축량 (GS VERs)', value: `${fmt(c.net_tco2e, 3)}`, unit: 'tCO2e', sub: `불확도 ${unc}% 차감 후` },
  ]

  return (
    <article className="grid gap-5">
      {/* 표지 */}
      <header className="overflow-hidden rounded-xl bg-sprout-800 text-sprout-100">
        <div className="flex flex-wrap items-start justify-between gap-4 px-6 py-6">
          <div className="min-w-0">
            <p className="font-mono text-xs tracking-wider text-sprout-300">MONITORING REPORT · 제{report.period_no}차 모니터링 기간</p>
            <h2 className="mt-2 font-display text-2xl font-bold text-white">{title}</h2>
            <p className="mt-2 text-sm text-sprout-200">{period} ({mrv.season_days}일) · {report.field_name}</p>
            <p className="mt-3 inline-block rounded-md bg-sprout-700 px-2.5 py-1 text-xs font-semibold text-sprout-200">
              Gold Standard for the Global Goals · Monitoring Report 양식(v2.0) 기준
            </p>
          </div>
          <button type="button" disabled title="준비중" className="cursor-not-allowed rounded-lg border border-sprout-600 px-3 py-2 text-xs font-semibold text-sprout-300/70">
            PDF·Excel 다운로드 (준비중)
          </button>
        </div>
        <div className="grid grid-cols-2 bg-sprout-900/40 md:grid-cols-4">
          {kpis.map((k) => (
            <div key={k.label} className="border-t border-sprout-700 px-6 py-4 md:border-l md:first:border-l-0">
              <p className="text-xs text-sprout-300">{k.label}</p>
              <p className="mt-1 font-display text-2xl font-bold text-sprout-200 tabular-nums">
                {k.value}{k.unit && <span className="ml-1 font-sans text-xs font-medium text-sprout-300">{k.unit}</span>}
              </p>
              <p className="mt-1 text-[11px] text-sprout-300/80">{k.sub}</p>
            </div>
          ))}
        </div>
      </header>

      <Section code="KEY" title="핵심 사업 정보" en="Key Project Information">
        <KeyValue rows={[
          ['GS 사업 ID', <GsTag key="id" />],
          ['사업명', title],
          ['PDD 버전 / 설계 인증일', <GsTag key="pdd" />],
          ['모니터링 보고서 버전', report.version || '-'],
          ['보고서 작성일', ddmmyyyy(report.generated_at)],
          ['모니터링 기간', `제${report.period_no}차 · ${period} (시작일·종료일 포함, ${mrv.season_days}일)`],
          ['사업자', operator],
          ['대상국', '대한민국 (Republic of Korea)'],
          ['사업 규모·유형', 'Micro scale · Small-holder activity · Emission reductions'],
          ['적용 활동 요건 / 상품 요건', 'Agriculture · GHG Emissions Reduction & Sequestration'],
          ['적용 방법론', '벼 재배 물관리 개선(AWD)에 의한 메탄 감축 방법론 · 방법 3 IPCC 기본값 간이법'],
        ]} />
        <div className="grid gap-4 lg:grid-cols-2">
          <Sub code="Table 1." title="지속가능발전 기여">
            <Grid minWidth={380} headers={['SDG', '영향', '달성량', '단위']}
              rows={[['SDG 13 기후 행동', 'Emission reductions', fmt(c.net_tco2e, 3), 'tCO2e (GS VERs)']]} />
          </Sub>
          <Sub code="Table 2." title="상품 빈티지">
            <Grid minWidth={380} headers={['상품', '달성량', '시작일', '종료일']}
              rows={[['GS VERs', `${fmt(c.net_tco2e, 3)} tCO2e`, ddmmyyyy(report.season_start), ddmmyyyy(report.season_end)]]} />
          </Sub>
        </div>
        <Sub code="Table 3." title="버퍼 기여">
          <ComingSoon gs><Grid minWidth={480} headers={['기간', '총 GS VERs', '버퍼 비율', '버퍼', '순 GS VERs']} rows={[['-', '-', '-', '-', '-']]} /></ComingSoon>
        </Sub>
      </Section>

      <Section code="A" title="사업 설명" en="Description of Project">
        <Sub code="A.1" title="사업 개요">
          <p className="max-w-[72ch] text-sm leading-7 text-soil-700">
            논에 수위 센서를 설치해 물 높이를 연속 측정하고, 수위가 {DRY_LEVEL_CM}cm까지 내려가면 다시 물을 대는
            AWD(Alternate Wetting and Drying, 물 걸러대기) 방식으로 물을 관리합니다. 상시담수 대비 줄어든 메탄(CH4) 배출량을
            Gold Standard 방법론의 IPCC 기본값 간이법으로 산정합니다.
          </p>
        </Sub>
        <div className="grid gap-4 lg:grid-cols-2">
          <Sub code="A.2" title="사업 위치">
            <KeyValue rows={[
              ['대상국 / 광역', `대한민국 / ${report.region.trim() || '-'}`],
              ['시·군·구', report.location_desc || '-'],
              ['지번 주소', report.jibun_addr ?? '필지 경계 미등록'],
              ['PNU', report.pnu ?? '-'],
              ['좌표 (DMS)', `${toDms(report.latitude, 'N', 'S')}, ${toDms(report.longitude, 'E', 'W')}`],
              ['사업 면적', `${fmt(mrv.area_ha)} ha`],
            ]} />
          </Sub>
          <div className="grid gap-4">
            <Sub code="A.3" title="적용 방법론 참조">
              <KeyValue rows={[
                ['방법론', 'Gold Standard 벼 재배 물관리 개선(AWD) 메탄 감축'],
                ['산정 방법', '방법 3 IPCC 기본값 간이법 (방법 1·2 준비중)'],
                ['참조 지침', 'IPCC 2019 Refinement Vol.4 Ch.5.5'],
              ]} />
            </Sub>
            <Sub code="A.4" title="인증 기간">
              <ComingSoon gs><KeyValue rows={[['시작일', '-'], ['종료일', '-'], ['갱신 주기', '-']]} /></ComingSoon>
            </Sub>
          </div>
        </div>
      </Section>

      <Section code="B" title="사업 이행" en="Implementation of Project">
        <Sub code="B.1" title="이행 내용">
          <p className="text-sm leading-7 text-soil-700">
            {ddmmyyyy(report.season_start)} 이앙과 함께 모니터링 센서({mrv.node_names.join(', ') || '-'})를 운영했고, 재배기간 동안 낙수 {drains}회를 실시했습니다.
          </p>
          {report.memo.trim() && <p className="mt-2 rounded-lg bg-soil-100 px-3 py-2 text-sm whitespace-pre-wrap text-soil-700">{report.memo.trim()}</p>}
        </Sub>
        <Sub code="B.1.1 · B.2" title="후속 조치 요청 / 설계 인증 이후 변경">
          <ComingSoon gs><KeyValue rows={[['후속 조치 요청 (FAR)', '-'], ['일시적 이탈 · 정정', '-'], ['영구 변경 · 설계 변경', '-']]} /></ComingSoon>
        </Sub>
      </Section>

      <Section code="C" title="모니터링 체계" en="Description of Monitoring System">
        <Formula>수위 센서 → STM32 보드 → LoRaWAN → 게이트웨이 → 서버(FastAPI) → DB(PostgreSQL/PostGIS) → 웹</Formula>
        <KeyValue rows={[
          ['측정 항목', '논 내부 수위 (cm, 지표면 기준)'],
          ['측정 주기', mrv.interval_min ? `약 ${mrv.interval_min}분 (측정 간격 중앙값)` : '-'],
          ['데이터 저장', '측정값마다 시각·센서·원본 메시지를 DB에 저장'],
          ['데이터 표준', 'OGC SensorThings API v1.1 (/v1.1), 위치는 OGC Simple Features (WGS84)'],
          ['이상 감지', `${STALE_MINUTES}분 무수신 시 통신 끊김, 기준 이탈 6시간 지속 시 수위 알림`],
          ['책임자', operator],
        ]} />
      </Section>

      <Section code="D" title="데이터 및 파라미터" en="Data and Parameters">
        <Sub code="D.1" title="고정 파라미터 (Fixed ex ante)">
          <Grid minWidth={720} left={[1]} headers={['파라미터', '설명', '단위', '사용 식', '값', '출처']} rows={[
            ['EF_c', '기본 배출계수 (한국)', 'kgCH4/ha/day', 'E.1, E.2', f.ef_c, 'IPCC 2019'],
            ['SF_w', '물관리 보정계수', '-', 'E.1, E.2', '1.0 / 0.71 / 0.55', 'IPCC 2019'],
            ['SF_p', `작기 전 물관리 (${report.preseason})`, '-', 'E.1, E.2', f.sf_p, 'IPCC 2019 · 사업자 입력'],
            ['SF_o', `유기물 투입 (${report.organic_type})`, '-', 'E.1, E.2', f.sf_o, 'IPCC 2019 · 사업자 입력'],
            ['GWP', '메탄 지구온난화지수', 'tCO2e/tCH4', 'E.1, E.2', f.gwp_ch4, 'IPCC AR5'],
            ['UNC', '불확도 차감', '%', 'E.4', unc, 'GS 방법론'],
          ]} />
        </Sub>
        <Sub code="D.2" title="모니터링 파라미터 (Monitored)">
          <Grid minWidth={820} left={[1, 4, 6]} headers={['파라미터', '설명', '단위', '값', '측정 방법', '주기', 'QA/QC']} rows={[
            ['A', '사업 면적', 'ha', fmt(mrv.area_ha), '논 등록 정보', '기간당 1회', '필지 정보와 대조'],
            ['t', '재배 일수', 'day', mrv.season_days, '이앙일·수확일 기록', '기간당 1회', '영농 기록과 대조'],
            ['WL', '논 내부 수위', 'cm', `${mrv.sample_count.toLocaleString('en-US')}건`, '수위 센서 연속 측정', mrv.interval_min ? `${mrv.interval_min}분` : '-', '결측·통신 끊김 알림, 원본 보관'],
            ['N_drain', '낙수 횟수 → SF_w', '회', `${drains}회 (${regime.label})`, `${DRY_LEVEL_CM}cm 이하 도달 시 1회`, '연속', `${REARM_LEVEL_CM}cm 회복 전 중복 집계 안 함`],
          ]} />
        </Sub>
        <Sub code="D.2" title="낙수 사건 기록 (N_drain 증빙)">
          <Grid minWidth={520} headers={['회차', `${DRY_LEVEL_CM}cm 도달`, '최저 수위', '재관개']} rows={mrv.drain_events.map((e) => [
            `${e.no}회`, `${ddmmyyyy(e.dry_at)} ${e.dry_at.slice(11)}`,
            <span key="min" className="font-semibold text-clay-600">{e.min_level_cm} cm</span>,
            e.reflood_at ? `${ddmmyyyy(e.reflood_at)} ${e.reflood_at.slice(11)}` : '-',
          ])} />
        </Sub>
        <Sub code="D.2" title="AWD 물관리 지표">
          <Grid minWidth={720} left={[3]} headers={['지표', '값', '단위', '산정 방법']} rows={[
            ['담수 일수', ind.flooded_days, 'day', '수위 0cm 이상인 시간 합계'],
            ['습윤 일수', ind.wet_days, 'day', `수위 ${DRY_LEVEL_CM} ~ 0cm인 시간 합계`],
            ['건조 일수', ind.dry_days, 'day', `수위 ${DRY_LEVEL_CM}cm 이하인 시간 합계`],
            ['준수율', ind.compliance_rate === null ? '-' : `${ind.compliance_rate} (${ind.compliant_events}/${ind.judged_events})`, '%', `${DRY_LEVEL_CM}cm 도달 후 ${ind.compliance_hours}시간 안에 재관개한 비율`],
            ['데이터 수집 가동률', ind.uptime_rate ?? '-', '%', `받은 측정 수 ÷ 받아야 할 측정 수 (${ind.expected_uplink_minutes}분 주기, 목표 90%)`],
          ]} />
        </Sub>
        <div className="grid gap-3 lg:grid-cols-3">
          <Sub code="D.3" title="이전 기간과 비교"><NotApplicable reason="1차 모니터링 기간이라 비교 대상이 없습니다." /></Sub>
          <Sub code="D.4" title="표본 계획"><NotApplicable reason="표본 추출 없이 전체를 연속 측정합니다." /></Sub>
          <Sub code="D.5 · D.6" title="반전 · PER"><NotApplicable reason="배출 감축 사업이라 흡수(Removal) 항목이 없습니다." /></Sub>
        </div>
      </Section>

      <Section code="E" title="감축량 산정" en="Calculation of Emission Reduction">
        <div className="grid gap-4 lg:grid-cols-2">
          <Sub code="E.1" title="기준 배출량 (상시담수)">
            <Formula>
              EF_BL = {f.ef_c} × 1.0 × {f.sf_p} × {f.sf_o} = <b>{fmt(c.ef_bl, 4)}</b> kgCH4/ha/day<br />
              BE = {fmt(c.ef_bl, 4)} × {mrv.area_ha} × {mrv.season_days} × 10⁻³ × {f.gwp_ch4} = <b>{fmt(c.baseline_tco2e, 3)}</b> tCO2e
            </Formula>
          </Sub>
          <Sub code="E.2" title={`사업 배출량 (${regime.label})`}>
            <Formula>
              EF_P = {f.ef_c} × {f.sf_w} × {f.sf_p} × {f.sf_o} = <b>{fmt(c.ef_p, 4)}</b> kgCH4/ha/day<br />
              PE = {fmt(c.ef_p, 4)} × {mrv.area_ha} × {mrv.season_days} × 10⁻³ × {f.gwp_ch4} = <b>{fmt(c.project_tco2e, 3)}</b> tCO2e
            </Formula>
          </Sub>
        </div>
        <Sub code="E.3" title="누출 배출량"><ComingSoon><Formula>LE = - tCO2e</Formula></ComingSoon></Sub>
        <Sub code="E.4" title="순 감축량">
          <Grid minWidth={600} headers={['SDG', '기준 배출', '사업 배출', '누출', '순 감축 (tCO2e)']}
            rows={[['13 · Emission reductions', fmt(c.baseline_tco2e, 3), fmt(c.project_tco2e, 3), '준비중', <b key="net" className="text-sprout-700">{fmt(c.net_tco2e, 3)}</b>]]} />
          <p className="mt-2 text-xs text-soil-500">
            순 감축 = (BE − PE) × (1 − {f.uncertainty}) = ({fmt(c.baseline_tco2e, 3)} − {fmt(c.project_tco2e, 3)}) × {1 - f.uncertainty} = {fmt(c.net_tco2e, 3)} tCO2e
          </p>
        </Sub>
        <Sub code="E.5 · E.6" title="PDD 예상치와 비교">
          <ComingSoon gs><Grid minWidth={420} headers={['SDG', 'PDD 예상치', '실제 달성치']} rows={[['13', '-', fmt(c.net_tco2e, 3)]]} /></ComingSoon>
        </Sub>
      </Section>

      <Section code="F–L" title="기타 보고 항목" en="Safeguards · Gender · SD · Stakeholder · Benefit · Co-benefits · Double issuance">
        <ComingSoon gs>
          <KeyValue rows={[
            ['F. 안전장치', 'Safeguards Reporting'], ['G. 젠더', 'Gender Reporting'], ['H. 지속가능발전 기여', 'SD Contribution'],
            ['I. 이해관계자 의견', 'Stakeholder Inputs'], ['J. 이익 공유', 'Benefit Sharing'], ['K·L. 부수 효과 · 이중 발행 방지', 'Co-benefits · Double Issuance'],
          ]} />
        </ComingSoon>
      </Section>
    </article>
  )
}
