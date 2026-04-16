import { useState, useMemo } from 'react'
import { formatCurrency } from '../../utils/formatters'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

/**
 * TradeCalendar
 * Props:
 *   dailyPnl — array of { day: ISO date string, total_pnl: number, trades: number }
 *              from useTradingData().dailyPnl
 */
export default function TradeCalendar({ dailyPnl = [] }) {
  const today = new Date()
  // Format a local date as 'YYYY-MM-DD' — avoids UTC shift from toISOString()
  const localDateKey = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const todayKey = localDateKey(today)

  const [viewYear,  setViewYear]  = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth()) // 0-indexed

  // Build lookup: 'YYYY-MM-DD' → { total_pnl, trades }
  const pnlMap = useMemo(() => {
    const map = {}
    for (const row of dailyPnl) {
      const key = row.day?.slice(0, 10)
      if (key) map[key] = row
    }
    return map
  }, [dailyPnl])

  // Month stats
  const monthKey = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}`
  const monthEntries = Object.entries(pnlMap).filter(([k]) => k.startsWith(monthKey))
  const monthTotal   = monthEntries.reduce((s, [, v]) => s + (v.total_pnl ?? 0), 0)
  const monthTrades  = monthEntries.reduce((s, [, v]) => s + (v.trades ?? 0), 0)
  const winDays      = monthEntries.filter(([, v]) => v.total_pnl > 0).length
  const lossDays     = monthEntries.filter(([, v]) => v.total_pnl < 0).length

  // Calendar grid: weeks × days (Mon-Sun)
  const firstDay = new Date(viewYear, viewMonth, 1)
  const lastDay  = new Date(viewYear, viewMonth + 1, 0)

  // ISO weekday: Mon=0…Sun=6
  const isoWeekday = (d) => (d.getDay() + 6) % 7

  // Pad start so grid begins on Monday
  const startPad = isoWeekday(firstDay)
  const daysInMonth = lastDay.getDate()
  const totalCells = Math.ceil((startPad + daysInMonth) / 7) * 7

  const cells = Array.from({ length: totalCells }, (_, i) => {
    const dayNum = i - startPad + 1
    if (dayNum < 1 || dayNum > daysInMonth) return null
    const d = new Date(viewYear, viewMonth, dayNum)
    const key = localDateKey(d)
    const data = pnlMap[key] ?? null
    const isToday = key === todayKey
    return { dayNum, key, data, isToday }
  })

  // Nav
  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) }
    else setViewMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) }
    else setViewMonth(m => m + 1)
  }

  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })

  // Colour scale: normalise based on max absolute PnL in this month
  const maxAbs = Math.max(...monthEntries.map(([, v]) => Math.abs(v.total_pnl ?? 0)), 1)

  function cellBg(pnl) {
    if (pnl == null) return 'transparent'
    const intensity = Math.min(Math.abs(pnl) / maxAbs, 1)
    if (pnl > 0) return `rgba(37, 211, 102, ${0.07 + intensity * 0.22})`
    if (pnl < 0) return `rgba(240, 62, 62, ${0.07 + intensity * 0.22})`
    return 'transparent'
  }

  function cellBorder(pnl) {
    if (pnl == null) return 'var(--border-color)'
    if (pnl > 0) return 'rgba(37, 211, 102, 0.25)'
    if (pnl < 0) return 'rgba(240, 62, 62, 0.25)'
    return 'var(--border-color)'
  }

  return (
    <div style={{
      marginTop: '1.75rem',
      backgroundColor: 'var(--bg-card)',
      border: '1px solid var(--border-color)',
      borderRadius: 'var(--radius-xl)',
      overflow: 'hidden',
      boxShadow: 'var(--card-shadow)',
    }}>
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div style={{
        padding: '20px 24px',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '12px',
      }}>
        <div>
          <h2 style={{ fontSize: '1rem', fontWeight: '600', color: 'var(--text-main)', margin: 0 }}>
            Trade Calendar
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', margin: '4px 0 0' }}>
            Daily P&L overview
          </p>
        </div>

        {/* Month navigator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <NavBtn onClick={prevMonth}>&#8592;</NavBtn>
          <span style={{
            minWidth: '150px',
            textAlign: 'center',
            fontSize: '0.875rem',
            fontWeight: '600',
            color: 'var(--text-main)',
          }}>
            {monthLabel}
          </span>
          <NavBtn onClick={nextMonth}>&#8594;</NavBtn>
        </div>
      </div>

      {/* ── Month summary strip ──────────────────────────────────── */}
      <div style={{
        padding: '12px 24px',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        gap: '28px',
        flexWrap: 'wrap',
      }}>
        {[
          { label: 'Month P&L', value: formatCurrency(monthTotal), color: monthTotal >= 0 ? 'var(--accent-lime)' : 'var(--color-loss)' },
          { label: 'Trades',    value: monthTrades,                 color: 'var(--text-main)' },
          { label: 'Win Days',  value: winDays,                     color: 'var(--accent-lime)' },
          { label: 'Loss Days', value: lossDays,                    color: 'var(--color-loss)' },
        ].map(({ label, value, color }) => (
          <div key={label}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '2px', fontWeight: '500', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              {label}
            </div>
            <div style={{ fontSize: '1rem', fontWeight: '700', color }}>
              {value}
            </div>
          </div>
        ))}
      </div>

      {/* ── Grid ───────────────────────────────────────────────────── */}
      <div style={{ padding: '16px 20px 20px' }}>
        {/* Weekday headers */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: '6px',
          marginBottom: '6px',
        }}>
          {WEEKDAYS.map(d => (
            <div key={d} style={{
              textAlign: 'center',
              fontSize: '0.68rem',
              fontWeight: '600',
              color: 'var(--text-muted)',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              padding: '4px 0',
            }}>
              {d}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: '6px',
        }}>
          {cells.map((cell, i) => {
            if (!cell) {
              return <div key={`empty-${i}`} />
            }
            const { dayNum, key, data, isToday } = cell
            const pnl = data?.total_pnl ?? null

            return (
              <div
                key={key}
                style={{
                  aspectRatio: '1',
                  background: cellBg(pnl),
                  border: `1px solid ${isToday ? 'var(--accent-lime)' : cellBorder(pnl)}`,
                  borderRadius: '6px',
                  display: 'grid',
                  gridTemplateRows: 'auto 1fr auto',
                  padding: '6px 6px 5px',
                  minHeight: '70px',
                  transition: 'transform 0.1s',
                  cursor: 'default',
                  boxSizing: 'border-box',
                }}
                onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.04)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
              >
                {/* Row 1: day number top-left, today dot top-right */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{
                    fontSize: '0.78rem',
                    fontWeight: '700',
                    color: isToday ? 'var(--accent-lime)' : 'var(--text-main)',
                    lineHeight: 1,
                  }}>
                    {dayNum}
                  </span>
                  {isToday && (
                    <span style={{
                      width: '6px', height: '6px',
                      borderRadius: '50%',
                      background: 'var(--accent-lime)',
                      display: 'inline-block',
                      flexShrink: 0,
                    }} />
                  )}
                </div>

                {/* Row 2: P&L centred */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {pnl != null && (
                    <span style={{
                      fontSize: '0.78rem',
                      fontWeight: '800',
                      color: pnl >= 0 ? 'var(--accent-lime)' : 'var(--color-loss)',
                      lineHeight: 1,
                      maxWidth: '100%',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      textAlign: 'center',
                      letterSpacing: '-0.02em',
                    }}>
                      {pnl >= 0 ? '+' : '−'}${Math.abs(pnl).toFixed(0)}
                    </span>
                  )}
                </div>

                {/* Row 3: trade count bottom-right */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'flex-end' }}>
                  {data?.trades > 0 && (
                    <span style={{
                      fontSize: '0.62rem',
                      fontWeight: '600',
                      color: 'var(--text-main)',
                      lineHeight: 1,
                    }}>
                      {data.trades} trade{data.trades !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Legend */}
        <div style={{
          marginTop: '14px',
          display: 'flex',
          gap: '16px',
          justifyContent: 'flex-end',
          alignItems: 'center',
        }}>
          {[
            { color: 'rgba(37, 211, 102, 0.3)', label: 'Profit day' },
            { color: 'rgba(240, 62, 62, 0.3)', label: 'Loss day' },
          ].map(({ color, label }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <div style={{ width: '10px', height: '10px', background: color, borderRadius: '2px' }} />
              <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function NavBtn({ children, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '30px',
        height: '30px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-main)',
        border: '1px solid var(--border-color)',
        borderRadius: '6px',
        color: 'var(--text-muted)',
        cursor: 'pointer',
        fontSize: '0.85rem',
        fontFamily: 'inherit',
        transition: 'border-color 0.15s, color 0.15s',
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent-lime)'; e.currentTarget.style.color = 'var(--accent-lime)' }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.color = 'var(--text-muted)' }}
    >
      {children}
    </button>
  )
}