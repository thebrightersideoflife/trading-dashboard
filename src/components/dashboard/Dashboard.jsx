import { useState, useMemo, useEffect } from 'react'
import '../../assets/styles/colors.css'
import '../../assets/styles/dashboard.css'
import { useTradingData } from '../../hooks/useTradingData'
import StatCard from './StatCard'
import MainChart from './MainChart'
import ProfitGauge from './ProfitGauge'
import TradeTable from '../trades/TradeTable'
import AddTradeModal from '../trades/AddTradeModal'
import TradeCalendar from '../trades/TradeCalendar'
import { formatCurrency, formatDuration } from '../../utils/formatters'

const TIME_FILTERS = [
  { label: 'All', months: null },
  { label: '6M',  months: 6   },
  { label: '3M',  months: 3   },
  { label: '1M',  months: 1   },
]

/**
 * Dashboard
 *
 * Props:
 *   sessionReady  — bool passed from ProtectedRoute
 *   showDemoData  — bool from App state; determines which DB views are queried
 */
export default function Dashboard({ sessionReady = true, showDemoData: showDemoProp = true }) {
  const [showModal,    setShowModal]    = useState(false)
  const [chartFilter,  setChartFilter]  = useState('All')
  const [equityCutoff, setEquityCutoff] = useState(null)

  const {
    metrics, equityCurve, trades, dailyPnl,
    weekTargets, upsertWeekTarget,
    hasMockData, showDemoData,
    loading, error,
    refetch,
  } = useTradingData(sessionReady, showDemoProp, equityCutoff)


  // Update cutoff when chart filter changes
  useEffect(() => {
    const sel = TIME_FILTERS.find(f => f.label === chartFilter)
    if (!sel?.months) { setEquityCutoff(null); return }
    const d = new Date()
    d.setMonth(d.getMonth() - sel.months)
    setEquityCutoff(d.toISOString())
  }, [chartFilter])

  // ── Visibility filters ────────────────────────────────────────

  // Trades: filter out mock rows when demo is hidden
  const visibleTrades = useMemo(
    () => showDemoData ? trades : (trades ?? []).filter(t => !t.is_mock),
    [trades, showDemoData]
  )

  // dailyPnl already comes from the correct view (daily_pnl vs daily_pnl_real)
  // based on showDemoData — hook handles the switching, no client filter needed
  const visibleDailyPnl = dailyPnl ?? []

  // equityCurve from hook is already filtered by date (DB-level) and demo toggle

  // ── Render ────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="dashboard-container" style={{
        display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh',
      }}>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', letterSpacing: '0.05em' }}>
          Loading dashboard...
        </p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="dashboard-container" style={{
        display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh',
      }}>
        <p style={{ color: 'var(--color-loss)', fontSize: '0.875rem' }}>Error: {error}</p>
      </div>
    )
  }

  const m = metrics ?? {}

  return (
    <div className="dashboard-container">
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>

        {/* ── Demo data banner ──────────────────────────────────── */}
        {hasMockData && showDemoData && (
          <div style={{
            marginBottom: '1.5rem',
            backgroundColor: 'rgba(37, 211, 102, 0.06)',
            border: '1px solid rgba(37, 211, 102, 0.2)',
            borderRadius: 'var(--radius-md)',
            padding: '12px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}>
            <span style={{ fontSize: '0.9rem' }}>🎯</span>
            <span style={{ color: 'var(--text-main)', fontWeight: '600', fontSize: '0.875rem' }}>
              Viewing demo data
            </span>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              · Toggle off in your profile menu to hide it, or add real trades to get started.
            </span>
          </div>
        )}

        {/* ── Page Header ───────────────────────────────────────── */}
        <header style={{
          marginBottom: '2rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <h1 style={{
            fontSize: '1.5rem',
            fontWeight: '700',
            letterSpacing: '-0.03em',
            color: 'var(--text-main)',
          }}>
            Account Overview
          </h1>
          <button
            onClick={() => setShowModal(true)}
            style={{
              backgroundColor: 'var(--accent-lime)',
              color: '#000',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              padding: '9px 18px',
              fontWeight: '700',
              fontSize: '0.85rem',
              cursor: 'pointer',
            }}
          >
            + Add Trade
          </button>
        </header>

        {/* ── Row 1: Primary stat cards ─────────────────────────── */}
        <div className="stats-grid">
          <StatCard
            title="Net Profit"
            hint="Total realized PnL across all closed trades"
            value={formatCurrency(m.net_profit)}
            isNegative={m.net_profit < 0}
          />
          <StatCard
            title="Gross Profit"
            hint="Sum of all winning trades"
            value={formatCurrency(m.gross_profit)}
          />
          <StatCard
            title="Gross Loss"
            hint="Sum of all losing trades (absolute)"
            value={formatCurrency(m.gross_loss)}
            isNegative={m.gross_loss > 0}
          />
          <StatCard
            title="PnL From All Time HWM"
            hint="Distance from your highest ever balance"
            value={formatCurrency(m.pnl_from_hwm)}
            isNegative={m.pnl_from_hwm < 0}
          />
          <StatCard
            title="Profit Target"
            hint="How far you are from your profit target"
          >
            <ProfitGauge
              value={m.drawdown_from_target}
              target={m.profit_target_pct ?? 30}
            />
          </StatCard>
        </div>

        {/* ── Row 2: Secondary metrics ───────────────────────────── */}
        <div className="stats-grid" style={{ marginTop: '1rem' }}>
          <StatCard
            title="Profit Factor"
            hint="Gross Profit divided by Gross Loss"
            value={isFinite(m.profit_factor) ? m.profit_factor?.toFixed(2) : '\u221e'}
          />
          <StatCard
            title="Best Profit"
            hint="Highest single winning trade"
            value={formatCurrency(m.best_trade)}
          />
          <StatCard
            title="Biggest Loss"
            hint="Largest single losing trade"
            value={formatCurrency(m.worst_trade)}
            isNegative={m.worst_trade < 0}
          />
          <StatCard
            title="Win / Loss Rate"
            hint="% of trades that closed in profit"
            value={`${m.win_rate?.toFixed(1) ?? '0.0'}%`}
          />
          <StatCard
            title="Expectancy"
            hint="Average PnL per trade"
            value={formatCurrency(m.expectancy)}
            isNegative={m.expectancy < 0}
          />
          <StatCard
            title="Avg. Trade Duration"
            hint="Mean time between open and close"
            value={formatDuration(m.avg_duration_sec)}
          />
          <StatCard title="Total Trades" value={m.total_trades ?? 0} />
          <StatCard
            title="Avg. Trade Size"
            hint="Mean quantity per trade"
            value={m.avg_trade_size != null ? m.avg_trade_size.toFixed(2) : '—'}
          />
        </div>

        {/* ── Equity Curve ──────────────────────────────────────── */}
        <div style={{
          marginTop: '1.75rem',
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-xl)',
          height: '420px',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: 'var(--card-shadow)',
        }}>
          <div style={{
            padding: '20px 26px 0 26px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
          }}>
            <div>
              <h2 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '4px', color: 'var(--text-main)' }}>
                Account Balance
              </h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                Equity curve based on closed trades
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '10px' }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{
                  color: 'var(--accent-lime)',
                  fontSize: '1.5rem',
                  fontWeight: '700',
                  letterSpacing: '-0.03em',
                }}>
                  {formatCurrency(m.current_balance)}
                </div>
                <div style={{ display: 'flex', gap: '18px', justifyContent: 'flex-end', marginTop: '6px' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Current P&L{' '}
                    <span style={{
                      color: m.net_profit >= 0 ? 'var(--accent-lime)' : 'var(--color-loss)',
                      fontWeight: '600',
                    }}>
                      {formatCurrency(m.net_profit)}
                    </span>
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    HWM{' '}
                    <span style={{ color: 'var(--text-main)', fontWeight: '600' }}>
                      {formatCurrency(m.hwm)}
                    </span>
                  </span>
                </div>
              </div>

              {/* ── Time filter pills ── */}
              <div style={{ display: 'flex', gap: '4px' }}>
                {TIME_FILTERS.map(({ label }) => {
                  const active = chartFilter === label
                  return (
                    <button
                      key={label}
                      onClick={() => setChartFilter(label)}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '5px',
                        border: `1px solid ${active ? 'var(--accent-lime)' : 'var(--border-color)'}`,
                        background: active ? 'rgba(37, 211, 102,0.1)' : 'transparent',
                        color: active ? 'var(--accent-lime)' : 'var(--text-muted)',
                        fontSize: '0.72rem',
                        fontWeight: active ? '700' : '500',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                        transition: 'all 0.12s',
                      }}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          <div style={{ flex: 1, width: '100%', marginTop: '10px' }}>
            <MainChart data={equityCurve} />
          </div>
        </div>

        {/* ── Trade Calendar ────────────────────────────────────── */}
        <TradeCalendar
          dailyPnl={visibleDailyPnl}
          weekTargets={weekTargets}
          weeklyDefaultTarget={m.weekly_default_target}
          onUpsertWeekTarget={upsertWeekTarget}
        />

        {/* ── Trade Table ───────────────────────────────────────── */}
        <TradeTable trades={visibleTrades} onTradeChanged={refetch} />

      </div>

      {showModal && (
        <AddTradeModal
          onClose={() => setShowModal(false)}
          onTradeAdded={() => { refetch(); setShowModal(false); }}
        />
      )}
    </div>
  )
}