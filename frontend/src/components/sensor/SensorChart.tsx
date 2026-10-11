import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Filler,
  Legend,
} from 'chart.js'
import { DRY_LEVEL_CM, TARGET_LEVEL_CM } from '../../domain'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler, Legend)

interface SensorData {
  nodeId: number
  label: string
  data: number[]
}

interface SensorChartProps {
  datasets: SensorData[]
  labels: string[]
  singleMode: boolean
}

const LINE_COLORS = ['#1D9E75', '#378ADD', '#BA7517', '#7F77DD', '#D85A30']

export default function SensorChart({ datasets, labels, singleMode }: SensorChartProps) {
  const chartDatasets = [
    ...datasets.map((ds, i) => ({
      label: ds.label,
      data: ds.data,
      borderColor: LINE_COLORS[i % LINE_COLORS.length],
      borderWidth: 2,
      pointRadius: 0,
      tension: 0.4,
      fill: false,
      backgroundColor: 'transparent',
    })),
    {
      label: `재관개 기준 (${DRY_LEVEL_CM}cm)`,
      data: Array(labels.length).fill(DRY_LEVEL_CM),
      borderColor: '#E24B4A',
      borderWidth: 1.5,
      pointRadius: 0,
      tension: 0,
      fill: false,
      backgroundColor: 'transparent',
      borderDash: [5, 5],
    },
    // 바로 앞 데이터셋(재관개 기준선)까지 칠해서 AWD 운영 구간(재관개 기준 ~ 목표 수위)을 표시
    {
      label: `목표 수위 (+${TARGET_LEVEL_CM}cm)`,
      data: Array(labels.length).fill(TARGET_LEVEL_CM),
      borderColor: '#378ADD',
      borderWidth: 1.5,
      pointRadius: 0,
      tension: 0,
      fill: '-1',
      backgroundColor: 'rgba(29,158,117,0.07)',
      borderDash: [5, 5],
    },
  ]

  return (
    <div style={{
      background: 'white',
      border: '0.5px solid #e0e0e0',
      borderRadius: '12px',
      padding: '16px',
    }}>
      <p style={{ fontSize: '12px', color: '#888', marginBottom: '10px' }}>
        수위 변화 (cm) · {singleMode ? '단일 기기' : '전체 기기 비교'}
      </p>
      <Line
        data={{ labels, datasets: chartDatasets }}
        options={{
          responsive: true,
          plugins: {
            legend: {
              display: true,
              position: 'bottom' as const,
              labels: { font: { size: 11 }, boxWidth: 20 },
            },
            tooltip: {
                mode: 'index' as const,
                intersect: false,
                 position: 'nearest' as const,
                 callbacks: {
                      label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y}cm`,
                 },
            },
          },
          scales: {
            x: { ticks: { font: { size: 10 }, maxTicksLimit: 8 } },
            y: {
              ticks: {
                font: { size: 10 },
                callback: (v) => v + 'cm',
              },
              min: -20,
              max: 10,
            },
          },
        }}
      />
    </div>
  )
}
