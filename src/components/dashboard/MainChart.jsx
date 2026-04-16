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

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  const value = payload[0]?.value
  return (
    <div style={{
      backgroundColor: '#111118',
      border: '1px solid #1e1e2a',
      borderRadius: '10px',
      padding: '10px 14px',
      fontSize: '0.8rem',
      lineHeight: 1.6,
    }}>
      {label && (
        <p style={{ color: '#52526a', marginBottom: '4px', fontSize: '0.75rem' }}>
          {formatXTick(label)}
        </p>
      )}
      <p style={{ color: '#25D366', fontWeight: '700', fontSize: '1rem', margin: 0 }}>
        ${value?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </p>
    </div>
  )
}

export default function MainChart({ data }) {
  const chartData = data?.length > 1 ? data : PLACEHOLDER

  const allBalances = chartData.map(d => d.balance)
  const minVal      = Math.min(...allBalances)
  const maxVal      = Math.max(...allBalances)
  const padding     = Math.max((maxVal - minVal) * 0.15, 50)

  return (
    <div style={{ width: '100%', height: '100%', padding: '0 10px 20px 10px', minHeight: 0 }}>
      <ResponsiveContainer width="100%" height="100%" minHeight={0}>
        <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
          <defs>
            <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#61616f" stopOpacity={0.55} />
              <stop offset="95%" stopColor="#3a3a55" stopOpacity={0} />
            </linearGradient>
          </defs>

          <CartesianGrid
            vertical={false}
            stroke="#1a1a24"
            strokeDasharray="3 3"
          />

          <XAxis
            dataKey="date"
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#52526a', fontSize: 11 }}
            tickFormatter={formatXTick}
            dy={10}
          />

          <YAxis
            domain={[minVal - padding, maxVal + padding]}
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#52526a', fontSize: 11 }}
            tickFormatter={formatYTick}
            width={55}
          />

          <Tooltip
            content={<CustomTooltip />}
            cursor={{ stroke: '#2a2a3a', strokeWidth: 1 }}
          />

          <Area
            type="monotone"
            dataKey="balance"
            stroke="#25D366"
            strokeWidth={2.5}
            fillOpacity={1}
            fill="url(#colorBalance)"
            animationDuration={1200}
            dot={false}
            activeDot={{ r: 5, fill: '#25D366', stroke: '#111118', strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}