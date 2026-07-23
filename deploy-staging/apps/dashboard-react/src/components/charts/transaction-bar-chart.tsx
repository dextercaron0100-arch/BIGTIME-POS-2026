import {
  Bar,
  BarChart,
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
      <BarChart data={data}>
        <CartesianGrid stroke="rgba(106, 92, 82, 0.14)" strokeDasharray="4 8" />
        <XAxis dataKey="label" stroke="#6a5c52" tickLine={false} axisLine={false} />
        <YAxis stroke="#6a5c52" tickLine={false} axisLine={false} />
        <Tooltip
          formatter={(value) => formatCurrency(Number(value ?? 0))}
          contentStyle={{
            borderRadius: 20,
            border: '1px solid rgba(88, 58, 33, 0.12)',
            background: 'rgba(255, 249, 242, 0.96)',
          }}
        />
        <Bar dataKey="sales" radius={[12, 12, 0, 0]} fill="#a4492b" />
      </BarChart>
    </ResponsiveContainer>
  )
}
