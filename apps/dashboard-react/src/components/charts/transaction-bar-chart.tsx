import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { ReportPoint } from '@apex-pos/shared-types'
import { formatCurrency } from '../../lib/utils'

type TransactionBarChartProps = {
  data: ReportPoint[]
}

export function TransactionBarChart({ data }: TransactionBarChartProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="transaction-wave-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2f88ff" stopOpacity={0.36} />
            <stop offset="65%" stopColor="#1f66f2" stopOpacity={0.12} />
            <stop offset="100%" stopColor="#1f66f2" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="rgba(31, 102, 242, 0.12)" strokeDasharray="4 8" />
        <XAxis dataKey="label" stroke="#4e688a" tickLine={false} axisLine={false} />
        <YAxis stroke="#4e688a" tickLine={false} axisLine={false} />
        <Tooltip
          formatter={(value) => formatCurrency(Number(value ?? 0))}
          contentStyle={{
            borderRadius: 20,
            border: '1px solid rgba(31, 102, 242, 0.14)',
            background: 'rgba(246, 249, 255, 0.97)',
            boxShadow: '0 18px 48px rgba(12, 30, 54, 0.12)',
          }}
        />
        <Area
          dataKey="sales"
          type="monotone"
          stroke="#1f66f2"
          strokeWidth={4}
          fill="url(#transaction-wave-fill)"
          dot={false}
          activeDot={{
            r: 5,
            strokeWidth: 0,
            fill: '#2f88ff',
          }}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
