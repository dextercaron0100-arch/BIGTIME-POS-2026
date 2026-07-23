import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import type { ValueType } from 'recharts/types/component/DefaultTooltipContent'
import { formatCurrency } from '../../lib/utils'

type PaymentSlice = {
  name: string
  amount: number
}

type PaymentSourceChartProps = {
  data: PaymentSlice[]
}

const PAYMENT_COLORS: Record<string, string> = {
  Cash: '#10b981',
  GCash: '#3b82f6',
  Maya: '#8b5cf6',
  Card: '#f59e0b',
  Others: '#94a3b8',
}

const FALLBACK_COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#94a3b8']

export function PaymentSourceChart({ data }: PaymentSourceChartProps) {
  const total = data.reduce((sum, d) => sum + d.amount, 0)

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:gap-8">
      <div className="h-[220px] w-[220px] shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="amount"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={56}
              outerRadius={100}
              paddingAngle={3}
              strokeWidth={0}
              isAnimationActive={false}
            >
              {data.map((entry, index) => (
                <Cell
                  key={index}
                  fill={PAYMENT_COLORS[entry.name] ?? FALLBACK_COLORS[index % FALLBACK_COLORS.length]}
                />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                borderRadius: 16,
                border: '1px solid #d9e6ef',
                background: 'rgba(255,255,255,0.97)',
                boxShadow: '0 12px 32px rgba(42,93,118,0.14)',
              }}
              wrapperStyle={{ outline: 'none' }}
              formatter={(value: ValueType | undefined) => {
                const amount = typeof value === 'number' ? value : Number(value ?? 0)
                return [formatCurrency(Number.isFinite(amount) ? amount : 0), 'Amount']
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="flex flex-col gap-3">
        {data.map((slice, index) => {
          const percentage = total > 0 ? ((slice.amount / total) * 100).toFixed(1) : '0'
          const color =
            PAYMENT_COLORS[slice.name] ?? FALLBACK_COLORS[index % FALLBACK_COLORS.length]

          return (
            <div key={slice.name} className="flex items-center gap-3">
              <span
                className="inline-block h-3 w-3 shrink-0 rounded-full"
                style={{ backgroundColor: color }}
              />
              <div className="flex flex-col">
                <span className="text-sm font-medium text-slate-800">{slice.name}</span>
                <span className="text-xs tabular-nums text-[color:var(--muted)]">
                  {formatCurrency(slice.amount)} · {percentage}%
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
