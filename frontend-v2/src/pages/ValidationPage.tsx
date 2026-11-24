// 위성 교차검증: Sentinel-1 SAR 분석
import { Card, PageTitle } from '../components/ui'
import SatelliteAnalysis from '../components/SatelliteAnalysis'

export default function ValidationPage() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5 px-4 py-6 md:px-8">
      <PageTitle title="위성·드론 검증" subtitle="Sentinel-1/2 위성 수분 지표와 드론 정사영상으로 센서 측정을 교차검증해요" />

      <Card className="px-5 py-4 text-sm text-soil-700">
        위성 영상은 해상도가 낮아 cm 단위 수위를 직접 재지는 못해요. 그래서 탄소 감축량 산정은 센서 수위로 하고,
        위성·드론은 <b className="font-semibold text-forest-800">넓은 지역 감시와 현장 검증용 보조 지표</b>로 써요.
      </Card>

      <section aria-label="Sentinel-1 SAR 분석" className="flex flex-col gap-3">
        <h2 className="font-display text-xl font-bold text-forest-800">Sentinel-1 SAR</h2>
        <SatelliteAnalysis />
      </section>
    </div>
  )
}
