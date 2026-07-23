import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import type { ValueType } from 'recharts/types/component/DefaultTooltipContent'
import { formatCurrency } from '../../lib/utils'

type CategorySlice = {
  name: string
  revenue: number
}

type TopSellingCategoriesChartProps = {
  data: CategorySlice[]
}

const CATEGORY_COLORS = ['#0b8cbc', '#f59e0b', '#10b981', '#8b5cf6', '#ef4444']

export function TopSellingCategoriesChart({ data }: TopSellingCategoriesChartProps) {
  const total = data.reduce((sum, d) => sum + d.revenue, 0)

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:gap-8">
      <div className="h-[220px] w-[220px] shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="revenue"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={56}
              outerRadius={100}
              paddingAngle={3}
              strokeWidth={0}
              isAnimationActive={false}
            >
              {data.map((_entry, index) => (
                <Cell key={index} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />
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
                return [formatCurrency(Number.isFinite(amount) ? amount : 0), 'Revenue']
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="flex flex-col gap-2.5">
        {data.map((slice, index) => {
          const percentage = total > 0 ? ((slice.revenue / total) * 100).toFixed(1) : '0'
          return (
            <div key={slice.name} className="flex items-center gap-3">
              <span
                className="inline-block h-3 w-3 shrink-0 rounded-full"
                style={{ backgroundColor: CATEGORY_COLORS[index % CATEGORY_COLORS.length] }}
              />
              <span className="text-sm font-medium text-slate-800">{slice.name}</span>
              <span className="ml-auto text-sm tabular-nums text-[color:var(--muted)]">{percentage}%</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
