import {
  CategoryScale,
  Chart,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
  type ChartData,
  type ChartOptions,
} from 'chart.js'
import { Line } from 'react-chartjs-2'
import { abreviar, brl0 } from './formatos'

Chart.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend)

export interface Serie {
  nome: string
  cor: string
  pontos: number[]
  tracejada?: boolean
}

interface Props {
  series: Serie[]
  altura?: number
  ariaLabel: string
}

/** Gráfico de linhas por mês (Chart.js). Séries de tamanhos diferentes terminam onde acabam. */
export function GraficoLinha({ series, altura = 300, ariaLabel }: Props) {
  const n = Math.max(0, ...series.map((s) => s.pontos.length))
  const labels = Array.from({ length: n }, (_, i) => i + 1)

  const data: ChartData<'line'> = {
    labels,
    datasets: series.map((s) => ({
      label: s.nome,
      data: s.pontos,
      borderColor: s.cor,
      backgroundColor: s.cor,
      borderWidth: 3,
      borderDash: s.tracejada ? [7, 5] : undefined,
      pointRadius: 0,
      pointHitRadius: 10,
      tension: 0,
    })),
  }

  const options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { position: 'bottom', labels: { usePointStyle: true, boxHeight: 6 } },
      tooltip: {
        callbacks: {
          title: (itens) => `Mês ${itens[0]?.label ?? ''}`,
          label: (item) => `${item.dataset.label}: ${brl0(item.parsed.y ?? 0)}`,
        },
      },
    },
    scales: {
      x: { title: { display: true, text: 'Mês' }, ticks: { maxTicksLimit: 8, maxRotation: 0 } },
      y: { beginAtZero: true, ticks: { callback: (v) => abreviar(Number(v)) } },
    },
  }

  return (
    <div style={{ height: altura, position: 'relative' }}>
      <Line data={data} options={options} aria-label={ariaLabel} role="img" />
    </div>
  )
}
