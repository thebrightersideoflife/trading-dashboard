import { useState, useMemo } from 'react'
import '../../assets/styles/colors.css'
import '../../assets/styles/dashboard.css'
import { useTradingData } from '../../hooks/useTradingData'
import TradeTable from '../trades/TradeTable'
import AddTradeModal from '../trades/AddTradeModal'

/**
 * TradesPage
 *
 * Props:
 *   sessionReady  — bool from ProtectedRoute
 *   showDemoData  — bool from App state
 */
export default function TradesPage({ sessionReady = true, showDemoData: showDemoProp = true }) {
  const {
    trades,
    showDemoData,
    loading,
    error,
    refetch,
  } = useTradingData(sessionReady, showDemoProp)

  const [showModal,    setShowModal]    = useState(false)
  const [symbolSearch, setSymbolSearch] = useState('')
  const [sideFilter,   setSideFilter]   = useState('All') // All | Buy | Sell

  // Apply demo filter (same pattern as Dashboard)
  const baseTrades = useMemo(
    () => showDemoData ? trades : (trades ?? []).filter(t => !t.is_mock),
    [trades, showDemoData]
  )

  // Apply symbol search + side filter
  const visibleTrades = useMemo(() => {
    let t = baseTrades ?? []
    if (symbolSearch.trim()) {
      const q = symbolSearch.trim().toLowerCase()
      t = t.filter(tr => tr.symbol?.toLowerCase().includes(q))
    }
    if (sideFilter !== 'All') {
      t = t.filter(tr => tr.side === sideFilter)
    }
    return t
  }, [baseTrades, symbolSearch, sideFilter])

  // Summary stats for the filtered set
  const stats = useMemo(() => {
    const closed = visibleTrades.filter(t => t.close_time)
    const totalPnl   = closed.reduce((s, t) => s + (t.realized_pnl ?? 0), 0)
    const winners    = closed.filter(t => (t.realized_pnl ?? 0) > 0)
    const winRate    = closed.length ? (winners.length / closed.length) * 100 : 0
    return { total: visibleTrades.length, closed: closed.length, totalPnl, winRate }
  }, [visibleTrades])

  if (loading) {
    return (
      <div className="dashboard-container" style={{
        display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh',
      }}>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', letterSpacing: '0.05em' }}>
          Loading trades...
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

  return (
    <div className="dashboard-container">
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>

        {/* ── Page header ───────────────────────────────────────────── */}
        <header style={{
          marginBottom: '2rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div>
            <h1 style={{
              fontSize: '1.5rem',
              fontWeight: '700',
              letterSpacing: '-0.03em',
              color: 'var(--text-main)',
              margin: 0,
            }}>
              Trades
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '5px' }}>
              Full trade history · edit and delete inline
            </p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            style={{
              backgroundColor: 'var(--accent-lime)',
              color: '#000',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              padding: '9px 18px',
              fontWeight: '700',
              fontSize: '0.875rem',
              cursor: 'pointer',
            }}
          >
            + Add Trade
          </button>
        </header>

        {/* ── Summary strip ─────────────────────────────────────────── */}
        <div className="trades-summary-grid" style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '1rem',
          marginBottom: '1.5rem',
        }}>
          {[
            {
              label: 'Total Trades',
              value: stats.total,
              color: 'var(--text-main)',
            },
            {
              label: 'Closed Trades',
              value: stats.closed,
              color: 'var(--text-main)',
            },
            {
              label: 'Realised P&L',
              value: `${stats.totalPnl >= 0 ? '+' : ''}$${Math.abs(stats.totalPnl).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
              color: stats.totalPnl >= 0 ? 'var(--accent-lime)' : 'var(--color-loss)',
            },
            {
              label: 'Win Rate',
              value: `${stats.winRate.toFixed(1)}%`,
              color: stats.winRate >= 50 ? 'var(--accent-lime)' : 'var(--color-loss)',
            },
          ].map(({ label, value, color }) => (
            <div key={label} style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              padding: '16px 20px',
            }}>
              <div style={{
                fontSize: '0.72rem',
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                fontWeight: '600',
                marginBottom: '6px',
              }}>
                {label}
              </div>
              <div style={{ fontSize: '1.3rem', fontWeight: '700', color, letterSpacing: '-0.02em' }}>
                {value}
              </div>
            </div>
          ))}
        </div>

        {/* ── Filters bar ───────────────────────────────────────────── */}
        <div style={{
          display: 'flex',
          gap: '10px',
          marginBottom: '1rem',
          alignItems: 'center',
          flexWrap: 'wrap',
        }}>
          {/* Symbol search */}
          <div style={{ position: 'relative', flex: '1', minWidth: '180px', maxWidth: '300px' }}>
            <svg
              width="14" height="14" viewBox="0 0 14 14" fill="none"
              style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
            >
              <circle cx="6" cy="6" r="4.5" stroke="var(--text-muted)" strokeWidth="1.3"/>
              <path d="M10 10L13 13" stroke="var(--text-muted)" strokeWidth="1.3" strokeLinecap="round"/>
            </svg>
            <input
              type="text"
              placeholder="Search symbol…"
              value={symbolSearch}
              onChange={e => setSymbolSearch(e.target.value)}
              style={{
                width: '100%',
                paddingLeft: '32px',
                paddingRight: '12px',
                paddingTop: '8px',
                paddingBottom: '8px',
                background: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-main)',
                fontSize: '0.875rem',
                outline: 'none',
                fontFamily: 'inherit',
                boxSizing: 'border-box',
                transition: 'border-color 0.15s',
              }}
              onFocus={e => e.target.style.borderColor = 'var(--accent-lime)'}
              onBlur={e => e.target.style.borderColor = 'var(--border-color)'}
            />
          </div>

          {/* Side filter pills */}
          <div style={{
            display: 'flex',
            background: 'var(--bg-card)',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-color)',
            padding: '3px',
            gap: '3px',
          }}>
            {['All', 'Buy', 'Sell'].map(s => (
              <button
                key={s}
                onClick={() => setSideFilter(s)}
                style={{
                  padding: '5px 14px',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '0.82rem',
                  fontWeight: '600',
                  fontFamily: 'inherit',
                  background: sideFilter === s ? 'var(--bg-main)' : 'transparent',
                  color: sideFilter === s
                    ? s === 'Buy' ? 'var(--accent-lime)' : s === 'Sell' ? 'var(--color-loss)' : 'var(--text-main)'
                    : 'var(--text-muted)',
                  boxShadow: sideFilter === s ? '0 1px 3px rgba(0,0,0,0.3)' : 'none',
                  transition: 'all 0.15s',
                }}
              >
                {s}
              </button>
            ))}
          </div>

          {/* Clear filters — only shown when active */}
          {(symbolSearch || sideFilter !== 'All') && (
            <button
              onClick={() => { setSymbolSearch(''); setSideFilter('All') }}
              style={{
                padding: '6px 12px',
                background: 'transparent',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-muted)',
                fontSize: '0.8rem',
                cursor: 'pointer',
                fontFamily: 'inherit',
                transition: 'color 0.15s, border-color 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-main)'; e.currentTarget.style.borderColor = 'var(--text-muted)' }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border-color)' }}
            >
              ✕ Clear filters
            </button>
          )}
        </div>

        {/* ── Trade table ───────────────────────────────────────────── */}
        <TradeTable
          trades={visibleTrades}
          onTradeChanged={refetch}
        />

      </div>

      <style>{`
        @media (max-width: 768px) {
          .trades-summary-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
        @media (max-width: 480px) {
          .trades-summary-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
      {showModal && (
        <AddTradeModal
          onClose={() => setShowModal(false)}
          onTradeAdded={() => { refetch(); setShowModal(false) }}
        />
      )}
    </div>
  )
}