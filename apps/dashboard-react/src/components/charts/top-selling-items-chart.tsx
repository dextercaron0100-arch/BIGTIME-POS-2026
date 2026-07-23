import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent'
import { formatCurrency } from '../../lib/utils'

type TopSellingItem = {
  name: string
  revenue: number
  quantity: number
}

type TopSellingItemsChartProps = {
  data: TopSellingItem[]
}

const ITEM_COLORS = ['#0b8cbc', '#0ea5e9', '#38bdf8', '#7dd3fc', '#bae6fd']

export function TopSellingItemsChart({ data }: TopSellingItemsChartProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 24, bottom: 4, left: 8 }}
        barCategoryGap="24%"
        maxBarSize={28}
      >
        <CartesianGrid
          horizontal={false}
          stroke="rgba(116, 148, 172, 0.14)"
          strokeDasharray="4 8"
        />
        <XAxis
          type="number"
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 12, fill: '#5d7386' }}
          tickFormatter={(v) => formatCurrency(v)}
        />
        <YAxis
          type="category"
          dataKey="name"
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 13, fill: '#1e3a4f', fontWeight: 500 }}
          width={230}
        />
        <Tooltip
          cursor={{ fill: 'rgba(13, 132, 173, 0.06)' }}
          contentStyle={{
            borderRadius: 16,
            border: '1px solid #d9e6ef',
            background: 'rgba(255,255,255,0.97)',
            boxShadow: '0 12px 32px rgba(42,93,118,0.14)',
          }}
          wrapperStyle={{ outline: 'none' }}
          formatter={(value: ValueType | undefined, name: NameType | undefined) => {
            const amount = typeof value === 'number' ? value : Number(value ?? 0)
            const safeAmount = Number.isFinite(amount) ? amount : 0
            return [
              name === 'revenue' ? formatCurrency(safeAmount) : `${safeAmount} sold`,
              name === 'revenue' ? 'Revenue' : 'Qty',
            ]
          }}
        />
        <Bar dataKey="revenue" radius={[0, 8, 8, 0]} isAnimationActive={false}>
          {data.map((_entry, index) => (
            <Cell key={index} fill={ITEM_COLORS[index % ITEM_COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
