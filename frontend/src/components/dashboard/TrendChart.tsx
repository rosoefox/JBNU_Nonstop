import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Filler,
} from 'chart.js'
import { DRY_LEVEL_CM, TARGET_LEVEL_CM } from '../../domain'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler)

interface TrendChartProps {
  data: number[]
  labels: string[]
}

// 대시보드용 작은 수위 그래프 (제목·카드 테두리는 바깥에서 그림)
export default function TrendChart({ data, labels }: TrendChartProps) {
  const chartData = {
    labels,
    datasets: [
      {
        label: '수위',
        data,
        borderColor: '#1D9E75',
        borderWidth: 1.8,
        pointRadius: 0,
        tension: 0.4,
        fill: false,
      },
      {
        label: `재관개 기준 (${DRY_LEVEL_CM}cm)`,
        data: Array(labels.length).fill(DRY_LEVEL_CM),
        borderColor: '#E24B4A',
        borderWidth: 1.2,
        pointRadius: 0,
        tension: 0,
        fill: false,
        borderDash: [5, 5],
      },
      // 바로 앞 데이터셋(재관개 기준선)까지 칠해서 AWD 운영 구간(재관개 기준 ~ 목표 수위)을 표시
      {
        label: `목표 수위 (+${TARGET_LEVEL_CM}cm)`,
        data: Array(labels.length).fill(TARGET_LEVEL_CM),
        borderColor: '#378ADD',
        borderWidth: 1.2,
        pointRadius: 0,
        tension: 0,
        fill: '-1',
        backgroundColor: 'rgba(29,158,117,0.07)',
        borderDash: [5, 5],
      },
    ],
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        mode: 'index' as const,
        intersect: false,
        callbacks: { label: (ctx: { dataset: { label?: string }; parsed: { y: number | null } }) => `${ctx.dataset.label}: ${ctx.parsed.y}cm` },
      },
    },
    scales: {
      x: { ticks: { font: { size: 10 }, maxTicksLimit: 6 } },
      y: {
        ticks: { font: { size: 10 }, callback: (v: number | string) => v + 'cm' },
        min: -20,
        max: 10,
      },
    },
  }

  if (data.length === 0) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#aaa', fontSize: 12 }}>
        최근 24시간 측정 기록 없음
      </div>
    )
  }

  return (
    <div style={{ position: 'relative', height: '100%', minHeight: 160 }}>
      <Line data={chartData} options={options} />
    </div>
  )
}
