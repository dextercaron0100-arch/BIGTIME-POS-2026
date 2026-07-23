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
            <stop offset="5%" stopColor="#a4492b" stopOpacity={0.45} />
            <stop offset="95%" stopColor="#a4492b" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="rgba(106, 92, 82, 0.14)" strokeDasharray="4 8" />
        <XAxis dataKey="label" stroke="#6a5c52" tickLine={false} axisLine={false} />
        <Tooltip
          formatter={(value) => formatCurrency(Number(value ?? 0))}
          contentStyle={{
            borderRadius: 20,
            border: '1px solid rgba(88, 58, 33, 0.12)',
            background: 'rgba(255, 249, 242, 0.96)',
          }}
        />
        <Area
          type="monotone"
          dataKey="sales"
          stroke="#a4492b"
          strokeWidth={3}
          fill="url(#sales-fill)"
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
