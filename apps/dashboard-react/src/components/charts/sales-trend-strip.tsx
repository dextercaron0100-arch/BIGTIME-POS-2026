import type { ReportPoint } from '@apex-pos/shared-types'
import { formatCurrency } from '../../lib/utils'

type SalesTrendStripProps = {
  data: ReportPoint[]
}

const chartWidth = 640
const chartHeight = 220
const paddingX = 28
const paddingTop = 18
const paddingBottom = 34

export function SalesTrendStrip({ data }: SalesTrendStripProps) {
  if (!data.length) {
    return <div className="h-full rounded-3xl bg-[color:var(--surface-soft)]" />
  }

  const maxValue = Math.max(...data.map((point) => point.sales), 1)
  const usableWidth = chartWidth - paddingX * 2
  const usableHeight = chartHeight - paddingTop - paddingBottom

  const points = data.map((point, index) => {
    const x =
      data.length === 1
        ? chartWidth / 2
        : paddingX + (usableWidth / (data.length - 1)) * index
    const y = paddingTop + usableHeight - (point.sales / maxValue) * usableHeight

    return {
      ...point,
      x,
      y,
    }
  })

  const linePath = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ')

  const areaPath = [
    `M ${points[0].x} ${chartHeight - paddingBottom}`,
    ...points.map((point) => `L ${point.x} ${point.y}`),
    `L ${points.at(-1)?.x ?? points[0].x} ${chartHeight - paddingBottom}`,
    'Z',
  ].join(' ')

  const peakPoint = data.reduce((highest, point) =>
    point.sales > highest.sales ? point : highest,
  )
  const weeklyTotal = data.reduce((sum, point) => sum + point.sales, 0)

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-2xl bg-[color:var(--surface-soft)] px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--muted)]">
            Weekly total
          </p>
          <p className="mt-2 section-title text-2xl font-bold">
            {formatCurrency(weeklyTotal)}
          </p>
        </div>
        <div className="rounded-2xl bg-[color:var(--accent-soft)]/50 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--muted)]">
            Peak day
          </p>
          <p className="mt-2 section-title text-2xl font-bold">
            {peakPoint.label} · {formatCurrency(peakPoint.sales)}
          </p>
        </div>
      </div>

      <div className="min-h-0 flex-1 rounded-[26px] border border-[color:var(--border)] bg-[color:var(--surface-soft)] p-4">
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          className="h-full w-full"
          role="img"
          aria-label="Weekly sales trend"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="trend-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2f88ff" stopOpacity="0.26" />
              <stop offset="100%" stopColor="#1f66f2" stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {[0.25, 0.5, 0.75].map((step) => {
            const y = paddingTop + usableHeight * step

            return (
              <line
                key={step}
                x1={paddingX}
                y1={y}
                x2={chartWidth - paddingX}
                y2={y}
                stroke="rgba(31, 102, 242, 0.12)"
                strokeDasharray="5 8"
              />
            )
          })}

          <path d={areaPath} fill="url(#trend-fill)" />
          <path
            d={linePath}
            fill="none"
            stroke="#1f66f2"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {points.map((point) => (
            <g key={point.label}>
              <circle cx={point.x} cy={point.y} r="6" fill="#f6f9ff" stroke="#1f66f2" strokeWidth="3" />
              <text
                x={point.x}
                y={chartHeight - 10}
                textAnchor="middle"
                fontSize="12"
                fill="#4e688a"
              >
                {point.label}
              </text>
            </g>
          ))}
        </svg>
      </div>
    </div>
  )
}
