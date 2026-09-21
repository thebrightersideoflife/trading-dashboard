import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts'

/**
 * MainChart
 * Props:
 *   data — array of { date: ISO string | null, balance: number }
 *          comes from useTradingData().equityCurve
 */
const PLACEHOLDER = [
  { date: null,    balance: 5000 },
  { date: 'start', balance: 5000 },
]

function formatXTick(value) {
  if (!value) return ''
  const d = new Date(value)
  if (isNaN(d)) return ''
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
}

function formatYTick(value) {
  return `$${(value / 1000).toFixed(1)}K`
}

const CustomTooltip = ({ active, payload, label, textColor }) => {
  if (!active || !payload?.length) return null
  const value = payload[0]?.value
  return (
    <div style={{
      backgroundColor: 'var(--bg-card)',
      border: '1px solid var(--border-hover)',
      borderRadius: '10px',
      padding: '10px 14px',
      fontSize: '0.8rem',
      lineHeight: 1.6,
      boxShadow: 'var(--shadow-soft)',
    }}>
      {label && (
        <p style={{ color: 'var(--text-muted)', marginBottom: '4px', fontSize: '0.75rem', fontWeight: '500' }}>
          {formatXTick(label)}
        </p>
      )}
      <p style={{ color: textColor || 'var(--color-profit)', fontWeight: '700', fontSize: '1rem', margin: 0 }}>
        ${value?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </p>
    </div>
  )
}

export default function MainChart({ data, profileColor }) {
  const chartData = data?.length > 1 ? data : PLACEHOLDER

  const allBalances = chartData.map(d => d.balance)
  const minVal      = Math.min(...allBalances)
  const maxVal      = Math.max(...allBalances)
  const padding     = Math.max((maxVal - minVal) * 0.15, 50)

  const strokeColor = profileColor || 'var(--chart-line)'

  return (
    <div style={{ width: '100%', height: '100%', padding: '0 10px 20px 10px', minHeight: 0 }}>
      <ResponsiveContainer width="100%" height="100%" minHeight={0}>
        <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
          <defs>
            <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="var(--chart-fill-top)" />
              <stop offset="95%" stopColor="var(--chart-fill-bot)" />
            </linearGradient>
          </defs>

          <CartesianGrid
            vertical={false}
            stroke="var(--chart-grid)"
            strokeDasharray="3 3"
          />

          <XAxis
            dataKey="date"
            axisLine={false}
            tickLine={false}
            tick={{ fill: 'var(--chart-tick)', fontSize: 11, fontWeight: '500' }}
            tickFormatter={formatXTick}
            dy={10}
          />

          <YAxis
            domain={[minVal - padding, maxVal + padding]}
            axisLine={false}
            tickLine={false}
            tick={{ fill: 'var(--chart-tick)', fontSize: 11, fontWeight: '500' }}
            tickFormatter={formatYTick}
            width={55}
          />

          <Tooltip
            content={<CustomTooltip textColor={strokeColor} />}
            cursor={{ stroke: 'var(--border-hover)', strokeWidth: 1.5 }}
          />

          <Area
            type="monotone"
            dataKey="balance"
            stroke={strokeColor}
            strokeWidth={2.5}
            fillOpacity={1}
            fill="url(#colorBalance)"
            animationDuration={1200}
            dot={false}
            activeDot={{ r: 5, fill: strokeColor, stroke: 'var(--bg-card)', strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}