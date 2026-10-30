// 위성·드론 교차검증 (LX 제안서 (4)) — 계획만 보여주는 준비중 화면
import { Plane, Radar, ScanLine, Sigma } from 'lucide-react'
import { ComingSoon } from '../components/common'
import { Card, PageTitle } from '../components/ui'

const STEPS = [
  {
    icon: Radar,
    title: 'Sentinel-1 SAR',
    body: '구름·야간에 관계없이 찍히는 레이더 영상으로 논 표면의 물 고임(담수 여부)을 판별해요.',
    tag: '후방산란 계수 (VV·VH)',
  },
  {
    icon: ScanLine,
    title: 'Sentinel-2 광학',
    body: '광학 영상의 근적외선·단파적외선으로 수분 지표를 계산해 넓은 지역의 논 습윤 상태를 봐요.',
    tag: 'NDWI · MNDWI',
  },
  {
    icon: Sigma,
    title: '센서와 상관분석',
    body: '같은 날짜의 센서 수위와 위성 지표를 비교해, 센서가 없는 필지의 물관리 상태를 추정해요.',
    tag: '미설치 필지 추정 (Scaling)',
  },
  {
    icon: Plane,
    title: '드론 정사영상',
    body: '드론으로 찍은 고해상도 영상으로 위성·센서 결과를 현장에서 교차 확인해요.',
    tag: '교차검증 결과서 1건',
  },
]

export default function ValidationPage() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5 px-4 py-6 md:px-8">
      <PageTitle title="위성·드론 검증" subtitle="Sentinel-1/2 위성 수분 지표와 드론 정사영상으로 센서 측정을 교차검증해요" />

      <Card className="px-5 py-4 text-sm text-soil-700">
        위성 영상은 해상도가 낮아 cm 단위 수위를 직접 재지는 못해요. 그래서 탄소 감축량 산정은 센서 수위로 하고,
        위성·드론은 <b className="font-semibold text-forest-800">넓은 지역 감시와 현장 검증용 보조 지표</b>로 써요.
      </Card>

      <ComingSoon label="준비중 · 원격탐사 분석 단계에서 진행">
        <div className="grid gap-4 md:grid-cols-2">
          {STEPS.map(({ icon: Icon, title, body, tag }) => (
            <Card key={title} className="flex gap-4 p-5">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-rain-100 text-rain-600"><Icon className="size-5" /></div>
              <div>
                <p className="font-semibold">{title}</p>
                <p className="mt-1 text-sm text-soil-600">{body}</p>
                <p className="mt-2 inline-block rounded-md bg-soil-200 px-2 py-0.5 font-mono text-xs text-soil-700">{tag}</p>
              </div>
            </Card>
          ))}
        </div>
      </ComingSoon>
    </div>
  )
}
