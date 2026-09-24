import { useState, useMemo } from 'react';
import { formatCurrency } from '../../utils/formatters';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/**
 * Format P&L for calendar cell display to match compact screenshot style:
 * e.g., +$1.2k, +$12k, +$9.1k, +$4.0k, +$17k, +$18k, +$22k, +$23k, +$19k, +$3.9k
 */
function formatCalendarPnl(pnl) {
  if (pnl == null || pnl === 0) return null;
  const abs = Math.abs(pnl);
  const sign = pnl >= 0 ? '+' : '−';
  if (abs >= 1000) {
    const k = abs / 1000;
    const formatted = (k >= 10 && Number.isInteger(k)) ? k.toFixed(0) : k.toFixed(1);
    return `${sign}$${formatted}k`;
  }
  return `${sign}$${abs.toFixed(0)}`;
}

/**
 * TradeCalendar
 * Dashboard mini-calendar component
 * Props:
 *   dailyPnl — array of { day: ISO date string, total_pnl: number, trades: number }
 */
export default function TradeCalendar({ dailyPnl = [] }) {
  const today = new Date();
  const localDateKey = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const todayKey = localDateKey(today);

  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState(null);

  // Build lookup: 'YYYY-MM-DD' -> { total_pnl, trades }
  const pnlMap = useMemo(() => {
    const map = {};
    for (const row of dailyPnl) {
      const key = row.day?.slice(0, 10);
      if (key) map[key] = row;
    }
    return map;
  }, [dailyPnl]);

  // Month stats
  const monthKey = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}`;
  const monthEntries = Object.entries(pnlMap).filter(([k]) => k.startsWith(monthKey));
  const monthTotal = monthEntries.reduce((s, [, v]) => s + (v.total_pnl ?? 0), 0);
  const monthTrades = monthEntries.reduce((s, [, v]) => s + (v.trades ?? 0), 0);
  const winDays = monthEntries.filter(([, v]) => v.total_pnl > 0).length;
  const lossDays = monthEntries.filter(([, v]) => v.total_pnl < 0).length;

  // Calendar grid
  const firstDay = new Date(viewYear, viewMonth, 1);
  const lastDay = new Date(viewYear, viewMonth + 1, 0);
  const isoWeekday = (d) => (d.getDay() + 6) % 7;
  const startPad = isoWeekday(firstDay);
  const daysInMonth = lastDay.getDate();
  const totalCells = Math.ceil((startPad + daysInMonth) / 7) * 7;

  const cells = Array.from({ length: totalCells }, (_, i) => {
    const dayNum = i - startPad + 1;
    if (dayNum < 1 || dayNum > daysInMonth) return null;
    const d = new Date(viewYear, viewMonth, dayNum);
    const key = localDateKey(d);
    const data = pnlMap[key] ?? null;
    const isToday = key === todayKey;
    return { dayNum, key, data, isToday };
  });

  // Nav
  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  };

  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

  const maxAbs = Math.max(...monthEntries.map(([, v]) => Math.abs(v.total_pnl ?? 0)), 1);

  function cellBg(pnl) {
    if (pnl == null) return 'transparent';
    const intensity = Math.min(Math.abs(pnl) / maxAbs, 1);
    if (pnl > 0) return `rgba(var(--accent-lime-rgb), ${0.15 + intensity * 0.35})`;
    if (pnl < 0) return `rgba(var(--color-loss-rgb), ${0.15 + intensity * 0.35})`;
    return 'transparent';
  }

  function cellBorder(pnl) {
    if (pnl == null) return 'var(--border-color)';
    if (pnl > 0) return 'rgba(var(--accent-lime-rgb), 0.45)';
    if (pnl < 0) return 'rgba(var(--color-loss-rgb), 0.45)';
    return 'var(--border-color)';
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
          { label: 'Trades', value: monthTrades, color: 'var(--text-main)' },
          { label: 'Win Days', value: winDays, color: 'var(--accent-lime)' },
          { label: 'Loss Days', value: lossDays, color: 'var(--color-loss)' },
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
        {/* Weekday headers: enlarged day labels */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: '6px',
          marginBottom: '8px',
        }}>
          {WEEKDAYS.map(d => (
            <div key={d} style={{
              textAlign: 'center',
              fontSize: '0.95rem',
              fontWeight: '700',
              color: 'var(--text-main)',
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              padding: '6px 0',
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
              return <div key={`empty-${i}`} />;
            }
            const { dayNum, key, data, isToday } = cell;
            const pnl = data?.total_pnl ?? null;
            const tradesCount = data?.trades ?? 0;
            const isSelected = selectedDate === key;

            return (
              <div
                key={key}
                onClick={() => setSelectedDate(key)}
                style={{
                  aspectRatio: '1.1 / 1',
                  minHeight: '110px',
                  background: cellBg(pnl),
                  border: `2px solid ${isSelected ? 'var(--accent-lime)' : (isToday ? 'var(--accent-lime)' : cellBorder(pnl))}`,
                  borderRadius: '8px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  padding: '12px 14px',
                  transition: 'transform 0.1s, border-color 0.1s',
                  cursor: 'pointer',
                  boxSizing: 'border-box',
                  position: 'relative',
                  boxShadow: isSelected ? '0 0 12px rgba(var(--accent-lime-rgb), 0.4)' : 'none',
                  zIndex: isSelected ? 2 : 1,
                }}
                onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.04)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
              >
                {/* Row 1: day number top-left, today dot top-right */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                  <span style={{
                    fontSize: '1.25rem',
                    fontWeight: '700',
                    color: isToday ? 'var(--accent-lime)' : 'var(--text-main)',
                    lineHeight: 1,
                  }}>
                    {dayNum}
                  </span>
                  {isToday && (
                    <span style={{
                      width: '7px', height: '7px',
                      borderRadius: '50%',
                      background: 'var(--accent-lime)',
                      display: 'inline-block',
                      flexShrink: 0,
                    }} />
                  )}
                </div>

                {/* Bottom-Left Data Stack: Prominent P&L Amount & Trade Count */}
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  justifyContent: 'flex-end',
                  gap: '3px',
                  width: '100%',
                  marginTop: 'auto',
                }}>
                  {pnl != null && (
                    <span style={{
                      fontSize: 'clamp(1.1rem, 1.35vw, 1.45rem)',
                      fontWeight: '700',
                      color: pnl >= 0 ? 'var(--accent-lime)' : 'var(--color-loss)',
                      lineHeight: 1.15,
                      maxWidth: '100%',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      textAlign: 'left',
                      letterSpacing: '-0.02em',
                    }}>
                      {formatCalendarPnl(pnl)}
                    </span>
                  )}
                  {tradesCount > 0 && (
                    <span style={{
                      fontSize: 'clamp(0.82rem, 0.95vw, 0.95rem)',
                      fontWeight: '600',
                      color: 'var(--text-main)',
                      lineHeight: 1.1,
                      textAlign: 'left',
                      opacity: 0.9,
                    }}>
                      {tradesCount} trade{tradesCount !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              </div>
            );
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
            { color: 'rgba(var(--accent-lime-rgb), 0.45)', label: 'Profit day' },
            { color: 'rgba(var(--color-loss-rgb), 0.45)', label: 'Loss day' },
          ].map(({ color, label }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <div style={{ width: '10px', height: '10px', background: color, borderRadius: '2px' }} />
              <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{label}</span>
            </div>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <div style={{ width: '10px', height: '10px', border: '2px solid var(--accent-lime)', borderRadius: '2px' }} />
            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Selected day</span>
          </div>
        </div>
      </div>
    </div>
  );
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
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent-lime)'; e.currentTarget.style.color = 'var(--accent-lime)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
    >
      {children}
    </button>
  );
}
