import { useState, useMemo, useEffect } from 'react';
import { formatCurrency } from '../../utils/formatters';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth <= 768 : false
  );

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return isMobile;
}

/**
 * Format P&L for calendar cell display to match compact screenshot style:
 * e.g., +$1.2k, +$12k, +$9.1k, +$4.0k, +$17k, +$18k, +$22k, +$23k, +$19k, +$3.9k
 */
function formatCalendarPnl(pnl, isMobile = false) {
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
  const isMobile = useIsMobile();
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
      {/* ── Header: Far-Left / Far-Right Nav Buttons & Centered Month ── */}
      <div style={{
        padding: isMobile ? '12px 14px' : '16px 20px',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: 'rgba(255, 255, 255, 0.015)',
      }}>
        {/* Far-Left Corner Previous Month Button */}
        <button
          onClick={prevMonth}
          aria-label="Previous month"
          title="Previous month"
          style={{
            width: isMobile ? '42px' : '48px',
            height: isMobile ? '42px' : '48px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '10px',
            color: 'var(--text-main)',
            cursor: 'pointer',
            fontSize: '1.25rem',
            fontWeight: '700',
            fontFamily: 'inherit',
            transition: 'all 0.15s ease',
            boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
            flexShrink: 0,
          }}
          onMouseEnter={e => {
            e.currentTarget.style.borderColor = 'var(--accent-lime)';
            e.currentTarget.style.color = 'var(--accent-lime)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = 'var(--border-color)';
            e.currentTarget.style.color = 'var(--text-main)';
          }}
        >
          &#8592;
        </button>

        {/* Centered Month & Year Label + Current Month Link */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '3px',
          textAlign: 'center',
          flex: 1,
          padding: '0 12px',
        }}>
          <h2 style={{
            fontSize: isMobile ? '1.2rem' : '1.5rem',
            fontWeight: '700',
            color: 'var(--text-main)',
            margin: 0,
            letterSpacing: '-0.02em',
            textAlign: 'center',
          }}>
            {monthLabel}
          </h2>

          {(viewYear !== today.getFullYear() || viewMonth !== today.getMonth()) && (
            <button
              onClick={() => { setViewYear(today.getFullYear()); setViewMonth(today.getMonth()); }}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--accent-lime)',
                fontSize: '0.8rem',
                fontWeight: '600',
                cursor: 'pointer',
                padding: 0,
                textDecoration: 'underline',
                fontFamily: 'inherit',
                marginTop: '2px',
                transition: 'opacity 0.15s ease',
              }}
              onMouseEnter={e => e.currentTarget.style.opacity = '0.8'}
              onMouseLeave={e => e.currentTarget.style.opacity = '1'}
            >
              Current Month
            </button>
          )}
        </div>

        {/* Far-Right Corner Next Month Button */}
        <button
          onClick={nextMonth}
          aria-label="Next month"
          title="Next month"
          style={{
            width: isMobile ? '42px' : '48px',
            height: isMobile ? '42px' : '48px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '10px',
            color: 'var(--text-main)',
            cursor: 'pointer',
            fontSize: '1.25rem',
            fontWeight: '700',
            fontFamily: 'inherit',
            transition: 'all 0.15s ease',
            boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
            flexShrink: 0,
          }}
          onMouseEnter={e => {
            e.currentTarget.style.borderColor = 'var(--accent-lime)';
            e.currentTarget.style.color = 'var(--accent-lime)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = 'var(--border-color)';
            e.currentTarget.style.color = 'var(--text-main)';
          }}
        >
          &#8594;
        </button>
      </div>

      {/* ── Month summary strip ──────────────────────────────────── */}
      <div style={{
        padding: isMobile ? '10px 12px' : '12px 24px',
        borderBottom: '1px solid var(--border-color)',
        display: 'grid',
        gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(auto-fit, minmax(120px, 1fr))',
        gap: isMobile ? '10px' : '28px',
      }}>
        {[
          { label: 'Month P&L', value: formatCurrency(monthTotal), color: monthTotal >= 0 ? 'var(--accent-lime)' : 'var(--color-loss)' },
          { label: 'Trades', value: monthTrades, color: 'var(--text-main)' },
          { label: 'Win Days', value: winDays, color: 'var(--accent-lime)' },
          { label: 'Loss Days', value: lossDays, color: 'var(--color-loss)' },
        ].map(({ label, value, color }) => (
          <div key={label}>
            <div style={{ fontSize: isMobile ? '0.62rem' : '0.7rem', color: 'var(--text-muted)', marginBottom: '2px', fontWeight: '600', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              {label}
            </div>
            <div style={{ fontSize: isMobile ? '1.05rem' : '1.15rem', fontWeight: '700', color, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {value}
            </div>
          </div>
        ))}
      </div>

      {/* ── Grid ───────────────────────────────────────────────────── */}
      <div style={{ padding: isMobile ? '8px 6px 12px' : '16px 20px 20px' }}>
        {/* Weekday headers: enlarged day labels */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: isMobile ? '3px' : '6px',
          marginBottom: isMobile ? '4px' : '8px',
        }}>
          {WEEKDAYS.map(d => (
            <div key={d} style={{
              textAlign: 'center',
              fontSize: isMobile ? '0.72rem' : '0.95rem',
              fontWeight: '700',
              color: 'var(--text-main)',
              letterSpacing: '0.03em',
              textTransform: 'uppercase',
              padding: isMobile ? '2px 0' : '6px 0',
            }}>
              {d}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: isMobile ? '3px' : '6px',
        }}>
          {cells.map((cell, i) => {
            if (!cell) {
              return <div key={`empty-${i}`} style={{ background: 'transparent' }} />;
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
                  minHeight: isMobile ? '60px' : '110px',
                  background: cellBg(pnl),
                  border: `2px solid ${isSelected ? 'var(--accent-lime)' : (isToday ? 'var(--accent-lime)' : cellBorder(pnl))}`,
                  borderRadius: isMobile ? '6px' : '8px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  padding: isMobile ? '5px 4px' : '12px 14px',
                  transition: 'transform 0.1s, border-color 0.1s',
                  cursor: 'pointer',
                  boxSizing: 'border-box',
                  position: 'relative',
                  boxShadow: isSelected ? '0 0 10px rgba(var(--accent-lime-rgb), 0.4)' : 'none',
                  zIndex: isSelected ? 2 : 1,
                  overflow: 'hidden',
                }}
              >
                {/* Row 1: day number top-left, today dot top-right */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                  <span style={{
                    fontSize: isMobile ? '0.82rem' : '1.25rem',
                    fontWeight: '700',
                    color: isToday ? 'var(--accent-lime)' : 'var(--text-main)',
                    lineHeight: 1,
                  }}>
                    {dayNum}
                  </span>
                  {isToday && (
                    <span style={{
                      width: isMobile ? '5px' : '7px',
                      height: isMobile ? '5px' : '7px',
                      borderRadius: '50%',
                      background: 'var(--accent-lime)',
                      display: 'inline-block',
                      flexShrink: 0,
                    }} />
                  )}
                </div>

                {/* Bottom Data Stack: Prominent P&L Amount & Trade Count */}
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  justifyContent: 'flex-end',
                  gap: isMobile ? '1px' : '3px',
                  width: '100%',
                  marginTop: 'auto',
                }}>
                  {pnl != null && (
                    <span style={{
                      fontSize: isMobile ? 'clamp(0.68rem, 2.7vw, 0.88rem)' : 'clamp(1.1rem, 1.35vw, 1.45rem)',
                      fontWeight: '700',
                      color: pnl >= 0 ? 'var(--accent-lime)' : 'var(--color-loss)',
                      lineHeight: 1.1,
                      maxWidth: '100%',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      textAlign: 'left',
                      letterSpacing: '-0.02em',
                    }}>
                      {formatCalendarPnl(pnl, isMobile)}
                    </span>
                  )}
                  {tradesCount > 0 && (
                    <span style={{
                      fontSize: isMobile ? 'clamp(0.58rem, 2vw, 0.72rem)' : 'clamp(0.82rem, 0.95vw, 0.95rem)',
                      fontWeight: '600',
                      color: 'var(--text-main)',
                      lineHeight: 1,
                      textAlign: 'left',
                      opacity: 0.9,
                      whiteSpace: 'nowrap',
                    }}>
                      {tradesCount}{isMobile ? 't' : ` trade${tradesCount !== 1 ? 's' : ''}`}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div style={{
          marginTop: isMobile ? '10px' : '14px',
          display: 'flex',
          gap: isMobile ? '10px' : '16px',
          justifyContent: 'flex-end',
          alignItems: 'center',
          flexWrap: 'wrap',
        }}>
          {[
            { color: 'rgba(var(--accent-lime-rgb), 0.45)', label: 'Profit day' },
            { color: 'rgba(var(--color-loss-rgb), 0.45)', label: 'Loss day' },
          ].map(({ color, label }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <div style={{ width: isMobile ? '8px' : '10px', height: isMobile ? '8px' : '10px', background: color, borderRadius: '2px' }} />
              <span style={{ fontSize: isMobile ? '0.65rem' : '0.68rem', color: 'var(--text-muted)' }}>{label}</span>
            </div>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <div style={{ width: isMobile ? '8px' : '10px', height: isMobile ? '8px' : '10px', border: '2px solid var(--accent-lime)', borderRadius: '2px' }} />
            <span style={{ fontSize: isMobile ? '0.65rem' : '0.68rem', color: 'var(--text-muted)' }}>Selected</span>
          </div>
        </div>
      </div>
    </div>
  );
}