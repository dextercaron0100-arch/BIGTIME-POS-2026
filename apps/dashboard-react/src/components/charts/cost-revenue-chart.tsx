import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent'
import { formatCurrency } from '../../lib/utils'

type CostRevenuePoint = {
  label: string
  revenue: number
  cost: number
}

type CostRevenueChartProps = {
  data: CostRevenuePoint[]
}

export function CostRevenueChart({ data }: CostRevenueChartProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 10, right: 16, bottom: 4, left: 0 }}>
        <defs>
          <linearGradient id="revenue-gradient" x1="0" x2="0" y1="0" y2="1">
            <stop offset="5%" stopColor="#2f88ff" stopOpacity={0.32} />
            <stop offset="95%" stopColor="#2f88ff" stopOpacity={0.03} />
          </linearGradient>
        </defs>
        <CartesianGrid
          vertical={false}
          stroke="rgba(116, 148, 172, 0.14)"
          strokeDasharray="4 8"
        />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 12, fill: '#5d7386' }}
          minTickGap={18}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 12, fill: '#5d7386' }}
          tickFormatter={(value) =>
            value >= 1000 ? `P${(value / 1000).toFixed(0)}k` : `P${Math.round(value)}`
          }
        />
        <Tooltip
          contentStyle={{
            borderRadius: 16,
            border: '1px solid #d9e6ef',
            background: 'rgba(255,255,255,0.97)',
            boxShadow: '0 12px 32px rgba(42,93,118,0.14)',
          }}
          wrapperStyle={{ outline: 'none' }}
          formatter={(value: ValueType | undefined, name: NameType | undefined) => {
            const amount = typeof value === 'number' ? value : Number(value ?? 0)
            return [
              formatCurrency(Number.isFinite(amount) ? amount : 0),
              name === 'revenue' ? 'Revenue' : 'Cost',
            ]
          }}
        />
        <Legend
          verticalAlign="top"
          align="right"
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: 13, paddingBottom: 8 }}
          formatter={(value) => (value === 'revenue' ? 'Revenue' : 'Cost')}
        />
        <Area
          type="monotone"
          dataKey="revenue"
          stroke="#2f88ff"
          strokeWidth={3}
          fill="url(#revenue-gradient)"
          dot={{
            r: 3,
            strokeWidth: 2,
            stroke: '#ffffff',
            fill: '#2f88ff',
          }}
          activeDot={{
            r: 5,
            strokeWidth: 2,
            stroke: '#ffffff',
            fill: '#1f66f2',
          }}
          isAnimationActive={false}
        />
        <Line
          type="monotone"
          dataKey="cost"
          stroke="#f97316"
          strokeWidth={2.5}
          strokeDasharray="6 6"
          dot={{
            r: 3,
            strokeWidth: 2,
            stroke: '#ffffff',
            fill: '#f97316',
          }}
          activeDot={{
            r: 5,
            strokeWidth: 2,
            stroke: '#ffffff',
            fill: '#ea580c',
          }}
          isAnimationActive={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
