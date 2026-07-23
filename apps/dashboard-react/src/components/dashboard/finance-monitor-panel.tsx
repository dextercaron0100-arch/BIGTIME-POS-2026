import { startTransition, useRef, useState } from 'react'
import type { ReportPoint } from '@apex-pos/shared-types'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { cn } from '../../lib/utils'

type FinanceMetricFormat = 'currency' | 'integer' | 'points'

type FinanceMetric = {
  label: string
  value: string
  hint: string
  format?: FinanceMetricFormat
}

type FinanceMonitorPanelProps = {
  title?: string
  description?: string
  badge?: string
  metrics: FinanceMetric[]
  data?: ReportPoint[]
  seriesByMetric?: Record<string, ReportPoint[]>
  initialActiveMetric?: string
}

const integerFormatter = new Intl.NumberFormat('en-PH')
const currencyFormatter = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

function formatTrendValue(value: number, format: FinanceMetricFormat) {
  if (format === 'integer') {
    return integerFormatter.format(Math.round(value))
  }

  if (format === 'points') {
    return `${integerFormatter.format(Math.round(value))} pts`
  }

  return currencyFormatter.format(value)
}

function FinanceMonitorTrend({
  data,
  metricLabel,
  metricFormat,
}: {
  data: ReportPoint[]
  metricLabel: string
  metricFormat: FinanceMetricFormat
}) {
  if (!data.length) {
    return <div className="h-[214px] rounded-[22px] bg-[#f1f5f9]" />
  }

  return (
    <div className="overflow-hidden rounded-[22px] border border-[color:var(--border)] bg-white px-3 py-3 sm:px-4 sm:py-4">
      <div className="h-[214px] w-full">
        <ResponsiveContainer width="100%" height="100%" debounce={80}>
          <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 12, left: 0 }}>
            <defs>
              <linearGradient id="finance-monitor-wave-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0db6af" stopOpacity={0.28} />
                <stop offset="65%" stopColor="#0db6af" stopOpacity={0.08} />
                <stop offset="100%" stopColor="#0db6af" stopOpacity={0.01} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="rgba(15, 23, 42, 0.07)" />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 12, fill: '#94a3b8' }}
              minTickGap={18}
            />
            <YAxis hide />
            <Tooltip
              cursor={{ stroke: 'rgba(13, 182, 175, 0.22)', strokeWidth: 1 }}
              formatter={(value) => formatTrendValue(Number(value ?? 0), metricFormat)}
              labelFormatter={(label) => `${label} | ${metricLabel}`}
              contentStyle={{
                borderRadius: 18,
                border: '1px solid rgba(15, 23, 42, 0.1)',
                background: '#ffffff',
                boxShadow: '0 8px 24px rgba(15, 23, 42, 0.1)',
                color: '#1e2d3d',
              }}
              wrapperStyle={{ outline: 'none' }}
            />
            <Area
              dataKey="sales"
              type="monotone"
              stroke="#0db6af"
              strokeWidth={3}
              fill="url(#finance-monitor-wave-fill)"
              dot={false}
              activeDot={{
                r: 5,
                strokeWidth: 0,
                fill: '#0db6af',
              }}
              isAnimationActive
              animationDuration={520}
              animationEasing="ease-out"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export function FinanceMonitorPanel({
  title,
  description,
  badge,
  metrics,
  data,
  seriesByMetric,
  initialActiveMetric,
}: FinanceMonitorPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [selectedMetricLabel, setSelectedMetricLabel] = useState(
    initialActiveMetric ?? metrics[0]?.label ?? '',
  )
  const activeMetricLabel = metrics.some((metric) => metric.label === selectedMetricLabel)
    ? selectedMetricLabel
    : (initialActiveMetric ?? metrics[0]?.label ?? '')

  const handleMetricStripWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    const scrollElement = scrollRef.current

    if (!scrollElement) {
      return
    }

    const maxScroll = Math.max(scrollElement.scrollWidth - scrollElement.clientWidth, 0)

    if (maxScroll <= 0) {
      return
    }

    const delta =
      Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY

    if (delta === 0) {
      return
    }

    event.preventDefault()
    scrollElement.scrollLeft += delta
  }

  const activeMetric =
    metrics.find((metric) => metric.label === activeMetricLabel) ?? metrics[0] ?? null
  const activeSeries =
    (activeMetric ? seriesByMetric?.[activeMetric.label] : undefined) ??
    data ??
    []

  return (
    <section className="finance-monitor-panel motion-enter min-w-0 overflow-hidden p-4 sm:p-5">
      {title || description || badge ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            {title ? (
              <h2 className="section-title text-[1.08rem] font-bold text-[color:var(--ink)]">{title}</h2>
            ) : null}
            {description ? (
              <p className="mt-1 max-w-3xl text-[0.88rem] text-[color:var(--muted)] sm:text-[0.92rem]">
                {description}
              </p>
            ) : null}
          </div>
          {badge ? <div className="finance-monitor-badge">{badge}</div> : null}
        </div>
      ) : null}

      <div
        className={cn(
          'w-full max-w-full overflow-hidden rounded-[24px] border border-[color:var(--border)] bg-white',
          (title || description || badge) && 'mt-5',
        )}
      >
        <div
          ref={scrollRef}
          className="finance-monitor-scroll w-full max-w-full overflow-x-auto overflow-y-hidden pb-2"
          data-lenis-prevent
          onWheel={handleMetricStripWheel}
        >
          <div className="flex min-w-max">
            {metrics.map((metric, index) => (
              <button
                type="button"
                key={metric.label}
                onClick={() => {
                  startTransition(() => {
                    setSelectedMetricLabel(metric.label)
                  })
                }}
                className={cn(
                  'relative min-h-[82px] min-w-[186px] border-r border-[color:var(--border)] px-4 py-3 text-left transition-colors duration-200 sm:min-w-[198px] sm:px-5 xl:min-w-[194px]',
                  index === metrics.length - 1 && 'border-r-0',
                  activeMetricLabel === metric.label
                    ? 'finance-monitor-primary'
                    : 'hover:bg-[color:rgba(13,182,175,0.06)]',
                )}
              >
                <p className="text-[0.84rem] font-medium text-[color:var(--muted)]">{metric.label}</p>
                <p className="mt-1.5 section-title text-[1.78rem] font-bold tracking-[-0.03em] text-[color:var(--accent)]">
                  {metric.value}
                </p>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-3 border-t border-[color:var(--border)] pt-4">
        <FinanceMonitorTrend
          data={activeSeries}
          metricLabel={activeMetric?.label ?? 'Metric'}
          metricFormat={activeMetric?.format ?? 'currency'}
        />
      </div>
    </section>
  )
}
