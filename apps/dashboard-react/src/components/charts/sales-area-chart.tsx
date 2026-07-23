import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from 'recharts'
import type { ReportPoint } from '@apex-pos/shared-types'
import { formatCurrency } from '../../lib/utils'

type SalesAreaChartProps = {
  data: ReportPoint[]
}

export function SalesAreaChart({ data }: SalesAreaChartProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data}>
        <defs>
          <linearGradient id="sales-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="5%" stopColor="#2f88ff" stopOpacity={0.36} />
            <stop offset="95%" stopColor="#1f66f2" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="rgba(31, 102, 242, 0.12)" strokeDasharray="4 8" />
        <XAxis dataKey="label" stroke="#4e688a" tickLine={false} axisLine={false} />
        <Tooltip
          formatter={(value) => formatCurrency(Number(value ?? 0))}
          contentStyle={{
            borderRadius: 20,
            border: '1px solid rgba(31, 102, 242, 0.14)',
            background: 'rgba(246, 249, 255, 0.97)',
          }}
        />
        <Area
          type="monotone"
          dataKey="sales"
          stroke="#1f66f2"
          strokeWidth={3}
          fill="url(#sales-fill)"
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
