import { useMemo, useState } from 'react'
import '../../assets/styles/colors.css'
import '../../assets/styles/dashboard.css'
import { useTradingData } from '../../hooks/useTradingData'
import { formatCurrency } from '../../utils/formatters'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Cell, ScatterChart, Scatter, ReferenceLine,
} from 'recharts'

/**
 * AnalyticsPage
 *
 * Props:
 *   sessionReady  — bool from ProtectedRoute
 *   showDemoData  — bool from App state
 */
export default function AnalyticsPage({ sessionReady = true, showDemoData: showDemoProp = true }) {
  const { trades, showDemoData, loading, error } = useTradingData(sessionReady, showDemoProp)

  const [activeSection, setActiveSection] = useState('edge') // edge | timing | risk | progress

  // ── Base: closed trades only, respecting demo toggle ──────────
  const closedTrades = useMemo(() => {
    const base = showDemoData ? trades : (trades ?? []).filter(t => !t.is_mock)
    return (base ?? []).filter(t => t.close_time && t.realized_pnl != null)
  }, [trades, showDemoData])

  // ── 1. EDGE: P&L by symbol ────────────────────────────────────
  const bySymbol = useMemo(() => {
    const map = {}
    for (const t of closedTrades) {
      const sym = t.symbol ?? 'Unknown'
      if (!map[sym]) map[sym] = { symbol: sym, pnl: 0, trades: 0, wins: 0 }
      map[sym].pnl    += t.realized_pnl
      map[sym].trades += 1
      if (t.realized_pnl > 0) map[sym].wins += 1
    }
    return Object.values(map)
      .map(r => ({ ...r, winRate: r.trades ? (r.wins / r.trades) * 100 : 0 }))
      .sort((a, b) => b.pnl - a.pnl)
  }, [closedTrades])

  // ── 2. EDGE: P&L by side ─────────────────────────────────────
  const bySide = useMemo(() => {
    const map = { Buy: { pnl: 0, trades: 0, wins: 0 }, Sell: { pnl: 0, trades: 0, wins: 0 } }
    for (const t of closedTrades) {
      const s = t.side ?? 'Buy'
      if (!map[s]) continue
      map[s].pnl    += t.realized_pnl
      map[s].trades += 1
      if (t.realized_pnl > 0) map[s].wins += 1
    }
    return Object.entries(map).map(([side, v]) => ({
      side,
      pnl: v.pnl,
      trades: v.trades,
      winRate: v.trades ? (v.wins / v.trades) * 100 : 0,
    }))
  }, [closedTrades])

  // ── 3. TIMING: P&L by day of week ────────────────────────────
  const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const byDow = useMemo(() => {
    const map = {}
    DAYS.forEach(d => { map[d] = { day: d, pnl: 0, trades: 0, wins: 0 } })
    for (const t of closedTrades) {
      const d = new Date(t.close_time)
      const dow = DAYS[(d.getDay() + 6) % 7]
      map[dow].pnl    += t.realized_pnl
      map[dow].trades += 1
      if (t.realized_pnl > 0) map[dow].wins += 1
    }
    return DAYS.map(d => ({ ...map[d], winRate: map[d].trades ? (map[d].wins / map[d].trades) * 100 : 0 }))
  }, [closedTrades])

  // ── 4. TIMING: P&L by hour of day ────────────────────────────
  const byHour = useMemo(() => {
    const map = {}
    for (let h = 0; h < 24; h++) map[h] = { hour: h, pnl: 0, trades: 0, wins: 0 }
    for (const t of closedTrades) {
      const h = new Date(t.close_time).getHours()
      map[h].pnl    += t.realized_pnl
      map[h].trades += 1
      if (t.realized_pnl > 0) map[h].wins += 1
    }
    // Only return hours that have trades, or a compressed 6–22 window
    return Object.values(map).filter(h => h.trades > 0 || (h.hour >= 6 && h.hour <= 22))
  }, [closedTrades])

  // ── 5. RISK: P&L distribution histogram ──────────────────────
  const histogram = useMemo(() => {
    if (!closedTrades.length) return []
    const pnls = closedTrades.map(t => t.realized_pnl)
    const min  = Math.floor(Math.min(...pnls))
    const max  = Math.ceil(Math.max(...pnls))
    const range = max - min || 1
    const buckets = 12
    const size = range / buckets
    const bins = Array.from({ length: buckets }, (_, i) => ({
      label: `$${(min + i * size).toFixed(0)}`,
      from:   min + i * size,
      to:     min + (i + 1) * size,
      count:  0,
      isProfit: (min + i * size + size / 2) >= 0,
    }))
    for (const pnl of pnls) {
      const idx = Math.min(Math.floor((pnl - min) / size), buckets - 1)
      if (bins[idx]) bins[idx].count++
    }
    return bins
  }, [closedTrades])

  // ── 6. RISK: Avg win vs avg loss ──────────────────────────────
  const winLossRatio = useMemo(() => {
    const wins   = closedTrades.filter(t => t.realized_pnl > 0)
    const losses = closedTrades.filter(t => t.realized_pnl < 0)
    const avgWin  = wins.length   ? wins.reduce((s, t)   => s + t.realized_pnl, 0) / wins.length   : 0
    const avgLoss = losses.length ? losses.reduce((s, t) => s + t.realized_pnl, 0) / losses.length : 0
    return { avgWin, avgLoss: Math.abs(avgLoss), ratio: avgLoss !== 0 ? avgWin / Math.abs(avgLoss) : 0 }
  }, [closedTrades])

  // ── 7. PROGRESS: Monthly P&L ─────────────────────────────────
  const byMonth = useMemo(() => {
    const map = {}
    for (const t of closedTrades) {
      const d   = new Date(t.close_time)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const label = d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })
      if (!map[key]) map[key] = { key, label, pnl: 0, trades: 0, wins: 0 }
      map[key].pnl    += t.realized_pnl
      map[key].trades += 1
      if (t.realized_pnl > 0) map[key].wins += 1
    }
    return Object.values(map)
      .map(r => ({ ...r, winRate: r.trades ? (r.wins / r.trades) * 100 : 0 }))
      .sort((a, b) => a.key.localeCompare(b.key))
  }, [closedTrades])

  // ── 8. PROGRESS: Drawdown series ─────────────────────────────
  const drawdownSeries = useMemo(() => {
    if (!closedTrades.length) return []
    const sorted = [...closedTrades].sort((a, b) => new Date(a.close_time) - new Date(b.close_time))
    let equity = 0, hwm = 0
    return sorted.map((t, i) => {
      equity += t.realized_pnl
      if (equity > hwm) hwm = equity
      const dd = hwm > 0 ? ((equity - hwm) / hwm) * 100 : 0
      return {
        i,
        date:     new Date(t.close_time).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
        drawdown: parseFloat(dd.toFixed(2)),
        equity:   parseFloat(equity.toFixed(2)),
      }
    })
  }, [closedTrades])

  const maxDrawdown = drawdownSeries.length
    ? Math.min(...drawdownSeries.map(d => d.drawdown))
    : 0

  // ── 9. PROGRESS: Streaks ─────────────────────────────────────
  const streaks = useMemo(() => {
    const sorted = [...closedTrades].sort((a, b) => new Date(a.close_time) - new Date(b.close_time))
    let curWin = 0, curLoss = 0, maxWin = 0, maxLoss = 0
    for (const t of sorted) {
      if (t.realized_pnl > 0) {
        curWin++; curLoss = 0
        if (curWin > maxWin) maxWin = curWin
      } else {
        curLoss++; curWin = 0
        if (curLoss > maxLoss) maxLoss = curLoss
      }
    }
    return { maxWin, maxLoss, curWin, curLoss }
  }, [closedTrades])

  if (loading) return (
    <div className="dashboard-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading analytics...</p>
    </div>
  )

  if (error) return (
    <div className="dashboard-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
      <p style={{ color: 'var(--color-loss)', fontSize: '0.875rem' }}>Error: {error}</p>
    </div>
  )

  if (!closedTrades.length) return (
    <div className="dashboard-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
      <div style={{ textAlign: 'center' }}>
        <p style={{ color: 'var(--text-muted)', fontSize: '1rem', marginBottom: '8px' }}>No closed trades yet</p>
        <p style={{ color: 'var(--text-subtle)', fontSize: '0.85rem' }}>Analytics will appear once you have closed trades.</p>
      </div>
    </div>
  )

  const SECTIONS = [
    { id: 'edge',     label: 'Edge'     },
    { id: 'timing',   label: 'Timing'   },
    { id: 'risk',     label: 'Risk'     },
    { id: 'progress', label: 'Progress' },
  ]

  return (
    <div className="dashboard-container">
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>

        {/* ── Page header ──────────────────────────────────────────── */}
        <header style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: '700', letterSpacing: '-0.03em', color: 'var(--text-main)', margin: 0 }}>
              Analytics
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '5px' }}>
              {closedTrades.length} closed trades analysed
            </p>
          </div>

          {/* Section nav */}
          <div className="analytics-section-nav" style={{ display: 'flex', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '3px', gap: '3px', flexWrap: 'wrap' }}>
            {SECTIONS.map(s => (
              <button
                key={s.id}
                onClick={() => setActiveSection(s.id)}
                style={{
                  padding: '6px 18px',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  fontWeight: '600',
                  fontFamily: 'inherit',
                  background: activeSection === s.id ? 'var(--bg-main)' : 'transparent',
                  color: activeSection === s.id ? 'var(--accent-lime)' : 'var(--text-muted)',
                  boxShadow: activeSection === s.id ? '0 1px 3px rgba(0,0,0,0.3)' : 'none',
                  transition: 'all 0.15s',
                }}
              >
                {s.label}
              </button>
            ))}
          </div>
        </header>

        {/* ══════════════════════════════════════════════════════════
            SECTION: EDGE
        ══════════════════════════════════════════════════════════ */}
        {activeSection === 'edge' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

            {/* P&L by Symbol */}
            <ChartCard
              title="P&L by Symbol"
              subtitle="Which instruments are driving your results"
            >
              {bySymbol.length === 0 ? <EmptyState /> : (
                <div className="analytics-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', alignItems: 'start' }}>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={bySymbol} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
                      <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--chart-tick)' }} tickFormatter={v => `$${v}`} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="symbol" tick={{ fontSize: 12, fill: 'var(--text-muted)', fontWeight: 600 }} width={70} axisLine={false} tickLine={false} />
                      <Tooltip content={<CustomTooltip />} />
                      <ReferenceLine x={0} stroke="var(--border-color)" />
                      <Bar dataKey="pnl" radius={[0, 4, 4, 0]} maxBarSize={28} activeBar={{ stroke: "#000", strokeWidth: 2 }}>
                        {bySymbol.map((entry, i) => (
                          <Cell key={i} fill={entry.pnl >= 0 ? 'var(--accent-lime)' : 'var(--color-loss)'} fillOpacity={0.85} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>

                  {/* Symbol table */}
                  <div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: '0 16px', marginBottom: '8px', padding: '0 4px' }}>
                      {['Symbol', 'P&L', 'Trades', 'Win %'].map(h => (
                        <span key={h} style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</span>
                      ))}
                    </div>
                    {bySymbol.map(r => (
                      <div key={r.symbol} style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr auto auto auto',
                        gap: '0 16px',
                        padding: '10px 4px',
                        borderTop: '1px solid var(--border-color)',
                        alignItems: 'center',
                      }}>
                        <span style={{ fontWeight: '700', fontSize: '0.875rem', color: 'var(--text-main)' }}>{r.symbol}</span>
                        <span style={{ fontSize: '0.875rem', fontWeight: '700', color: r.pnl >= 0 ? 'var(--accent-lime)' : 'var(--color-loss)' }}>
                          {r.pnl >= 0 ? '+' : ''}{formatCurrency(r.pnl)}
                        </span>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{r.trades}</span>
                        <span style={{ fontSize: '0.85rem', color: r.winRate >= 50 ? 'var(--accent-lime)' : 'var(--color-loss)' }}>
                          {r.winRate.toFixed(0)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </ChartCard>

            {/* P&L by Side */}
            <ChartCard
              title="P&L by Side"
              subtitle="Long vs short performance — reveals directional bias"
            >
              <div className="analytics-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                {bySide.map(r => (
                  <div key={r.side} style={{
                    background: 'var(--bg-main)',
                    border: `1px solid ${r.side === 'Buy' ? 'rgba(37, 211, 102,0.2)' : 'rgba(240,62,62,0.2)'}`,
                    borderRadius: 'var(--radius-md)',
                    padding: '24px 28px',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                      <span style={{
                        fontSize: '0.8rem',
                        fontWeight: '700',
                        padding: '3px 10px',
                        borderRadius: '4px',
                        background: r.side === 'Buy' ? 'var(--accent-lime-dim)' : 'var(--color-loss-dim)',
                        color: r.side === 'Buy' ? 'var(--accent-lime)' : 'var(--color-loss)',
                      }}>{r.side}</span>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{r.trades} trades</span>
                    </div>
                    <div style={{ fontSize: '2rem', fontWeight: '800', color: r.pnl >= 0 ? 'var(--accent-lime)' : 'var(--color-loss)', letterSpacing: '-0.03em', marginBottom: '8px' }}>
                      {r.pnl >= 0 ? '+' : ''}{formatCurrency(r.pnl)}
                    </div>
                    <div style={{ display: 'flex', gap: '20px' }}>
                      <Micro label="Win rate" value={`${r.winRate.toFixed(1)}%`} positive={r.winRate >= 50} />
                    </div>
                    {/* Win rate bar */}
                    <div style={{ marginTop: '16px', height: '4px', background: 'var(--border-color)', borderRadius: '2px', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%',
                        width: `${r.winRate}%`,
                        background: r.side === 'Buy' ? 'var(--accent-lime)' : 'var(--color-loss)',
                        borderRadius: '2px',
                        transition: 'width 0.5s ease',
                      }} />
                    </div>
                  </div>
                ))}
              </div>
            </ChartCard>

          </div>
        )}

        {/* ══════════════════════════════════════════════════════════
            SECTION: TIMING
        ══════════════════════════════════════════════════════════ */}
        {activeSection === 'timing' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

            {/* P&L by Day of Week */}
            <ChartCard
              title="P&L by Day of Week"
              subtitle="Which days are consistently profitable or problematic"
            >
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={byDow} margin={{ left: 4, right: 4, top: 8, bottom: 4 }}>
                  <XAxis dataKey="day" tick={{ fontSize: 12, fill: 'var(--text-muted)', fontWeight: 600 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--chart-tick)' }} tickFormatter={v => `$${v}`} axisLine={false} tickLine={false} width={50} />
                  <Tooltip content={<CustomTooltip />} />
                  <ReferenceLine y={0} stroke="var(--border-color)" />
                  <Bar dataKey="pnl" radius={[4, 4, 0, 0]} maxBarSize={56} activeBar={{ stroke: "#000", strokeWidth: 2 }}>
                    {byDow.map((entry, i) => (
                      <Cell key={i} fill={entry.pnl >= 0 ? 'var(--accent-lime)' : 'var(--color-loss)'} fillOpacity={entry.trades === 0 ? 0.15 : 0.85} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              {/* Day summary row */}
              <div className="analytics-grid-7" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px', marginTop: '12px' }}>
                {byDow.map(d => (
                  <div key={d.day} style={{
                    background: 'var(--bg-main)',
                    borderRadius: '8px',
                    padding: '8px 6px',
                    textAlign: 'center',
                    border: '1px solid var(--border-color)',
                  }}>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: '600', marginBottom: '4px' }}>{d.day}</div>
                    <div style={{ fontSize: '0.72rem', fontWeight: '700', color: d.pnl >= 0 ? 'var(--accent-lime)' : d.pnl < 0 ? 'var(--color-loss)' : 'var(--text-muted)' }}>
                      {d.trades === 0 ? '—' : (d.pnl >= 0 ? '+' : '') + '$' + Math.abs(d.pnl).toFixed(0)}
                    </div>
                    <div style={{ fontSize: '0.62rem', color: 'var(--text-subtle)', marginTop: '2px' }}>{d.trades}t</div>
                  </div>
                ))}
              </div>
            </ChartCard>

            {/* P&L by Hour */}
            <ChartCard
              title="P&L by Hour of Day"
              subtitle="Your best and worst trading sessions — times are local to your browser"
            >
              {byHour.filter(h => h.trades > 0).length === 0 ? <EmptyState /> : (
                <>
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={byHour} margin={{ left: 4, right: 4, top: 8, bottom: 4 }}>
                      <XAxis
                        dataKey="hour"
                        tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                        tickFormatter={h => h % 3 === 0 ? `${String(h).padStart(2,'0')}:00` : ''}
                        axisLine={false} tickLine={false}
                      />
                      <YAxis tick={{ fontSize: 11, fill: 'var(--chart-tick)' }} tickFormatter={v => `$${v}`} axisLine={false} tickLine={false} width={50} />
                      <Tooltip content={<HourTooltip />} />
                      <ReferenceLine y={0} stroke="var(--border-color)" />
                      <Bar dataKey="pnl" radius={[3, 3, 0, 0]} maxBarSize={36} activeBar={{ stroke: "#000", strokeWidth: 2 }}>
                        {byHour.map((entry, i) => (
                          <Cell key={i}
                            fill={entry.pnl >= 0 ? 'var(--accent-lime)' : 'var(--color-loss)'}
                            fillOpacity={entry.trades === 0 ? 0 : 0.85}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  {/* Best / Worst hour callout */}
                  {(() => {
                    const withTrades = byHour.filter(h => h.trades > 0)
                    if (!withTrades.length) return null
                    const best  = withTrades.reduce((a, b) => b.pnl > a.pnl ? b : a)
                    const worst = withTrades.reduce((a, b) => b.pnl < a.pnl ? b : a)
                    return (
                      <div style={{ display: 'flex', gap: '1rem', marginTop: '16px' }}>
                        <Callout label="Best hour" value={`${String(best.hour).padStart(2,'0')}:00`} sub={formatCurrency(best.pnl)} positive />
                        <Callout label="Worst hour" value={`${String(worst.hour).padStart(2,'0')}:00`} sub={formatCurrency(worst.pnl)} positive={false} />
                      </div>
                    )
                  })()}
                </>
              )}
            </ChartCard>

          </div>
        )}

        {/* ══════════════════════════════════════════════════════════
            SECTION: RISK
        ══════════════════════════════════════════════════════════ */}
        {activeSection === 'risk' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

            {/* Win vs Loss ratio cards */}
            <div className="analytics-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
              {[
                { label: 'Avg Winning Trade', value: formatCurrency(winLossRatio.avgWin), positive: true },
                { label: 'Avg Losing Trade',  value: `-${formatCurrency(winLossRatio.avgLoss)}`, positive: false },
                {
                  label: 'Win/Loss Ratio',
                  value: winLossRatio.ratio.toFixed(2) + 'x',
                  positive: winLossRatio.ratio >= 1,
                  hint: winLossRatio.ratio >= 1
                    ? 'Winners are larger than losers ✓'
                    : 'Losers are larger than winners — consider cutting losses earlier',
                },
              ].map(({ label, value, positive, hint }) => (
                <div key={label} style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  padding: '20px 24px',
                }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: '600', marginBottom: '8px' }}>
                    {label}
                  </div>
                  <div style={{ fontSize: '1.6rem', fontWeight: '800', color: positive ? 'var(--accent-lime)' : 'var(--color-loss)', letterSpacing: '-0.03em' }}>
                    {value}
                  </div>
                  {hint && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '8px', lineHeight: 1.4 }}>{hint}</div>}
                </div>
              ))}
            </div>

            {/* P&L Distribution Histogram */}
            <ChartCard
              title="P&L Distribution"
              subtitle="Shape of your trades — healthy distribution has more frequent small losses and occasional large wins"
            >
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={histogram} margin={{ left: 4, right: 4, top: 8, bottom: 4 }}>
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} interval={1} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--chart-tick)' }} axisLine={false} tickLine={false} width={32} allowDecimals={false} />
                  <Tooltip content={<HistogramTooltip />} />
                  <ReferenceLine x="$0" stroke="var(--border-color)" />
                  <Bar dataKey="count" radius={[3, 3, 0, 0]} activeBar={{ stroke: "#000", strokeWidth: 2 }}>
                    {histogram.map((entry, i) => (
                      <Cell key={i} fill={entry.isProfit ? 'var(--accent-lime)' : 'var(--color-loss)'} fillOpacity={0.8} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div style={{ marginTop: '12px', fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                <strong style={{ color: 'var(--text-main)' }}>How to read this:</strong> each bar shows how many trades landed in that P&L range.
                A left-skewed peak (many small losses, few large wins) is typical of momentum traders.
                A right-skewed peak is typical of mean-reversion. A wide flat distribution may indicate inconsistent sizing.
              </div>
            </ChartCard>

            {/* Streak cards */}
            <div className="analytics-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
              {[
                { label: 'Longest Win Streak',  value: streaks.maxWin,  positive: true  },
                { label: 'Longest Loss Streak', value: streaks.maxLoss, positive: false },
                { label: 'Current Win Streak',  value: streaks.curWin,  positive: true  },
                { label: 'Current Loss Streak', value: streaks.curLoss, positive: false },
              ].map(({ label, value, positive }) => (
                <div key={label} style={{
                  background: 'var(--bg-card)',
                  border: `1px solid ${value > 0 ? (positive ? 'rgba(37, 211, 102,0.15)' : 'rgba(240,62,62,0.15)') : 'var(--border-color)'}`,
                  borderRadius: 'var(--radius-md)',
                  padding: '16px 20px',
                }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: '600', marginBottom: '8px' }}>
                    {label}
                  </div>
                  <div style={{ fontSize: '2rem', fontWeight: '800', color: value === 0 ? 'var(--text-muted)' : positive ? 'var(--accent-lime)' : 'var(--color-loss)', letterSpacing: '-0.03em' }}>
                    {value}
                  </div>
                </div>
              ))}
            </div>

          </div>
        )}

        {/* ══════════════════════════════════════════════════════════
            SECTION: PROGRESS
        ══════════════════════════════════════════════════════════ */}
        {activeSection === 'progress' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

            {/* Monthly P&L */}
            <ChartCard
              title="Monthly P&L"
              subtitle="Month-by-month results — reveals whether you are improving over time"
            >
              {byMonth.length === 0 ? <EmptyState /> : (
                <>
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={byMonth} margin={{ left: 4, right: 4, top: 8, bottom: 4 }}>
                      <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--text-muted)', fontWeight: 600 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: 'var(--chart-tick)' }} tickFormatter={v => `$${v}`} axisLine={false} tickLine={false} width={56} />
                      <Tooltip content={<CustomTooltip />} />
                      <ReferenceLine y={0} stroke="var(--border-color)" />
                      <Bar dataKey="pnl" radius={[4, 4, 0, 0]} maxBarSize={64} activeBar={{ stroke: "#000", strokeWidth: 2 }}>
                        {byMonth.map((entry, i) => (
                          <Cell key={i} fill={entry.pnl >= 0 ? 'var(--accent-lime)' : 'var(--color-loss)'} fillOpacity={0.85} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  {/* Monthly table */}
                  <div style={{ marginTop: '16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '8px' }}>
                    {byMonth.map(m => (
                      <div key={m.key} style={{
                        background: 'var(--bg-main)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '8px',
                        padding: '10px 12px',
                      }}>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: '600', marginBottom: '4px' }}>{m.label}</div>
                        <div style={{ fontSize: '0.95rem', fontWeight: '700', color: m.pnl >= 0 ? 'var(--accent-lime)' : 'var(--color-loss)' }}>
                          {m.pnl >= 0 ? '+' : ''}{formatCurrency(m.pnl)}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-subtle)', marginTop: '2px' }}>{m.trades} trades</div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </ChartCard>

            {/* Drawdown */}
            <ChartCard
              title="Drawdown"
              subtitle={`Max drawdown ${maxDrawdown.toFixed(1)}% — how far equity fell from its peak at each point`}
            >
              {drawdownSeries.length < 2 ? <EmptyState text="Need at least 2 trades for drawdown." /> : (
                <>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={drawdownSeries} margin={{ left: 4, right: 4, top: 8, bottom: 4 }}>
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false}
                        interval={Math.floor(drawdownSeries.length / 8)} />
                      <YAxis tick={{ fontSize: 11, fill: 'var(--chart-tick)' }} tickFormatter={v => `${v}%`} axisLine={false} tickLine={false} width={44} />
                      <Tooltip content={<DrawdownTooltip />} />
                      <ReferenceLine y={0} stroke="var(--border-color)" />
                      <Bar dataKey="drawdown" radius={[0, 0, 3, 3]} maxBarSize={12} activeBar={{ stroke: "#000", strokeWidth: 2 }}>
                        {drawdownSeries.map((_, i) => (
                          <Cell key={i} fill="var(--color-loss)" fillOpacity={0.7} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  <div style={{ display: 'flex', gap: '1rem', marginTop: '16px' }}>
                    <Callout label="Max Drawdown" value={`${maxDrawdown.toFixed(1)}%`} sub="Worst peak-to-trough" positive={false} />
                    <Callout
                      label="Current Drawdown"
                      value={`${drawdownSeries[drawdownSeries.length - 1]?.drawdown.toFixed(1)}%`}
                      sub="From current HWM"
                      positive={drawdownSeries[drawdownSeries.length - 1]?.drawdown >= 0}
                    />
                  </div>
                </>
              )}
            </ChartCard>

          </div>
        )}

      <style>{mobileStyles}</style>
      </div>
    </div>
  )
}

/* ── Mobile CSS ──────────────────────────────────────────────────── */
const mobileStyles = `
  @media (max-width: 768px) {
    .analytics-section-nav button { font-size: 0.78rem !important; padding: 5px 10px !important; }
    .analytics-grid-2 { grid-template-columns: 1fr !important; }
    .analytics-grid-3 { grid-template-columns: repeat(2, 1fr) !important; }
    .analytics-grid-4 { grid-template-columns: repeat(2, 1fr) !important; }
    .analytics-grid-7 { grid-template-columns: repeat(4, 1fr) !important; }
  }
  @media (max-width: 480px) {
    .analytics-grid-3 { grid-template-columns: 1fr !important; }
    .analytics-grid-7 { grid-template-columns: repeat(3, 1fr) !important; }
  }
`;

/* ── Shared sub-components ─────────────────────────────────────── */

function ChartCard({ title, subtitle, children }) {
  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border-color)',
      borderRadius: 'var(--radius-xl)',
      overflow: 'hidden',
      boxShadow: 'var(--card-shadow)',
    }}>
      <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border-color)' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: '600', color: 'var(--text-main)', margin: 0 }}>{title}</h2>
        {subtitle && <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', margin: '4px 0 0' }}>{subtitle}</p>}
      </div>
      <div style={{ padding: '20px 24px 24px' }}>{children}</div>
    </div>
  )
}

function Micro({ label, value, positive }) {
  return (
    <div>
      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '600' }}>{label}</div>
      <div style={{ fontSize: '0.9rem', fontWeight: '700', color: positive ? 'var(--accent-lime)' : 'var(--color-loss)' }}>{value}</div>
    </div>
  )
}

function Callout({ label, value, sub, positive }) {
  return (
    <div style={{
      background: 'var(--bg-main)',
      border: `1px solid ${positive ? 'rgba(37, 211, 102,0.15)' : 'rgba(240,62,62,0.15)'}`,
      borderRadius: '10px',
      padding: '12px 16px',
      flex: 1,
    }}>
      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>{label}</div>
      <div style={{ fontSize: '1.3rem', fontWeight: '800', color: positive ? 'var(--accent-lime)' : 'var(--color-loss)', letterSpacing: '-0.02em' }}>{value}</div>
      {sub && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>{sub}</div>}
    </div>
  )
}

function EmptyState({ text = 'No data for this period.' }) {
  return (
    <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
      {text}
    </div>
  )
}

/* ── Custom Recharts tooltips ─────────────────────────────────── */

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border-color)',
      borderRadius: '8px',
      padding: '10px 14px',
      fontSize: '0.8rem',
    }}>
      <div style={{ color: 'var(--text-muted)', marginBottom: '4px', fontWeight: '600' }}>{label || d.symbol || d.side || d.label}</div>
      <div style={{ color: d.pnl >= 0 ? 'var(--accent-lime)' : 'var(--color-loss)', fontWeight: '700' }}>
        P&L: {d.pnl >= 0 ? '+' : ''}{formatCurrency(d.pnl)}
      </div>
      {d.trades > 0 && <div style={{ color: 'var(--text-muted)', marginTop: '2px' }}>{d.trades} trade{d.trades !== 1 ? 's' : ''}{d.winRate != null ? ` · ${d.winRate.toFixed(0)}% win` : ''}</div>}
    </div>
  )
}

function HourTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  if (d.trades === 0) return null
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '10px 14px', fontSize: '0.8rem' }}>
      <div style={{ color: 'var(--text-muted)', marginBottom: '4px', fontWeight: '600' }}>{String(d.hour).padStart(2,'0')}:00 – {String(d.hour + 1).padStart(2,'0')}:00</div>
      <div style={{ color: d.pnl >= 0 ? 'var(--accent-lime)' : 'var(--color-loss)', fontWeight: '700' }}>P&L: {d.pnl >= 0 ? '+' : ''}{formatCurrency(d.pnl)}</div>
      <div style={{ color: 'var(--text-muted)', marginTop: '2px' }}>{d.trades} trades</div>
    </div>
  )
}

function HistogramTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '10px 14px', fontSize: '0.8rem' }}>
      <div style={{ color: 'var(--text-muted)', marginBottom: '4px', fontWeight: '600' }}>{d.label} to ${d.to?.toFixed(0)}</div>
      <div style={{ color: 'var(--text-main)', fontWeight: '700' }}>{d.count} trade{d.count !== 1 ? 's' : ''}</div>
    </div>
  )
}

function DrawdownTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '10px 14px', fontSize: '0.8rem' }}>
      <div style={{ color: 'var(--text-muted)', marginBottom: '4px', fontWeight: '600' }}>{d.date}</div>
      <div style={{ color: d.drawdown < 0 ? 'var(--color-loss)' : 'var(--accent-lime)', fontWeight: '700' }}>Drawdown: {d.drawdown.toFixed(1)}%</div>
      <div style={{ color: 'var(--text-muted)', marginTop: '2px' }}>Equity: {formatCurrency(d.equity)}</div>
    </div>
  )
}