import { useState, useMemo, useEffect } from 'react';
import { Calendar } from 'lucide-react';
import { useJournal } from '../../hooks/useJournal';
import JournalSidePanel from '../journal/JournalSidePanel';
import '../../assets/styles/colors.css';
import '../../assets/styles/dashboard.css';
import { useTradingData } from '../../hooks/useTradingData';
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

export default function CalendarPage({ sessionReady, profile, showDemoData }) {
  const isMobile = useIsMobile();
  const { dailyPnl, weekTargets, upsertWeekTarget, trades } = useTradingData(sessionReady, showDemoData);

  const {
    entries, tradeNotes,
    upsertEntry, upsertTradeNote, deleteTradeNote, getEntryForDate,
  } = useJournal(sessionReady);

  const today = new Date();
  const localDateKey = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const todayKey = localDateKey(today);

  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  const [editingWeek, setEditingWeek] = useState(null); // 'YYYY-WW'
  const [editTarget, setEditTarget] = useState('');
  const [selectedDate, setSelectedDate] = useState(null); // 'YYYY-MM-DD'

  const defaultWeeklyTarget = profile?.weekly_default_target ?? 500;
  const themeColor = profile?.theme_color || 'var(--accent-lime)';

  // Build weekTargets lookup: { 'YYYY-MM-DD': target } keyed by week_start
  const weekTargetMap = Object.fromEntries(
    (weekTargets ?? []).map(r => [r.week_start, r.target])
  );

  // Build PnL lookup
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

  // ISO week key: 'YYYY-WW'
  function isoWeekKey(date) {
    const d = new Date(date);
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() + 4 - (d.getDay() || 7));
    const yearStart = new Date(d.getFullYear(), 0, 1);
    const week = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
    return `${d.getFullYear()}-${String(week).padStart(2, '0')}`;
  }

  // Build rows (weeks) with their cells
  const rows = useMemo(() => {
    const cells = Array.from({ length: totalCells }, (_, i) => {
      const dayNum = i - startPad + 1;
      if (dayNum < 1 || dayNum > daysInMonth) return null;
      const d = new Date(viewYear, viewMonth, dayNum);
      const key = localDateKey(d);
      const data = pnlMap[key] ?? null;
      const isToday = key === todayKey;
      const weekKey = isoWeekKey(d);
      return { dayNum, key, data, isToday, weekKey };
    });

    const result = [];
    for (let i = 0; i < cells.length; i += 7) {
      const week = cells.slice(i, i + 7);
      const validCells = week.filter(Boolean);
      if (validCells.length === 0) continue;
      const weekKey = validCells[0].weekKey;
      const weekPnl = validCells.reduce((s, c) => s + (c.data?.total_pnl ?? 0), 0);
      const _firstDate = new Date(viewYear, viewMonth, validCells[0].dayNum);
      const _dow = (_firstDate.getDay() + 6) % 7;
      const _mon = new Date(_firstDate);
      _mon.setDate(_firstDate.getDate() - _dow);
      const weekStart = `${_mon.getFullYear()}-${String(_mon.getMonth() + 1).padStart(2, '0')}-${String(_mon.getDate()).padStart(2, '0')}`;
      const weekTarget = weekTargetMap[weekStart] ?? defaultWeeklyTarget;
      result.push({ weekKey, weekStart, cells: week, weekPnl, weekTarget });
    }
    return result;
  }, [totalCells, startPad, daysInMonth, viewYear, viewMonth, pnlMap, weekTargetMap, defaultWeeklyTarget]);

  // Max abs pnl for colour intensity
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

  const saveWeekTarget = async (weekStart) => {
    const val = parseFloat(editTarget);
    if (isNaN(val)) { setEditingWeek(null); return; }
    await upsertWeekTarget(weekStart, val);
    setEditingWeek(null);
  };

  return (
    <>
      <div className="dashboard-container">
        <div style={{ maxWidth: '1400px', margin: '0 auto', width: '100%' }}>
          {/* Page header */}
          <div className="page-header-row">
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <Calendar size={isMobile ? 22 : 26} style={{ color: 'var(--accent-lime)' }} />
                <h1 style={{ fontSize: isMobile ? '1.25rem' : '1.4rem', fontWeight: '700', color: 'var(--text-main)', letterSpacing: '-0.03em', margin: 0 }}>
                  Trade Calendar
                </h1>
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: isMobile ? '0.78rem' : '0.82rem', marginTop: '4px' }}>
                Daily P&L heatmap · Weekly targets
              </p>
            </div>
          </div>

          {/* Month summary strip */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(auto-fit, minmax(130px, 1fr))',
            gap: isMobile ? '8px' : '1rem',
            marginBottom: isMobile ? '1rem' : '1.5rem',
          }}>
            {[
              { label: 'Month P&L', value: formatCurrency(monthTotal), color: monthTotal >= 0 ? 'var(--accent-lime)' : 'var(--color-loss)' },
              { label: 'Trades', value: monthTrades, color: 'var(--text-main)' },
              { label: 'Win Days', value: winDays, color: 'var(--accent-lime)' },
              { label: 'Loss Days', value: lossDays, color: 'var(--color-loss)' },
            ].map(({ label, value, color }) => (
              <div key={label} style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                borderRadius: '10px',
                padding: isMobile ? '10px 12px' : '14px 18px',
              }}>
                <div style={{ fontSize: isMobile ? '0.62rem' : '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '600', marginBottom: '3px' }}>
                  {label}
                </div>
                <div style={{ fontSize: isMobile ? '1.1rem' : '1.25rem', fontWeight: '700', color, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {value}
                </div>
              </div>
            ))}
          </div>

          {/* Calendar grid container */}
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '14px',
            overflow: 'hidden',
            width: '100%',
          }}>
            {/* Calendar Card Header: Far-Left / Far-Right Nav Buttons & Centered Month */}
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
            {/* Weekday headers */}
            <div
              className="calendar-header-grid"
              style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? 'repeat(7, 1fr)' : '100px repeat(7, 1fr)',
                gap: isMobile ? '3px' : '6px',
                padding: isMobile ? '10px 6px 6px' : '14px 16px 8px',
                borderBottom: '1px solid var(--border-color)',
              }}
            >
              {!isMobile && <div className="calendar-week-col" />}
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

            {/* Week rows */}
            <div style={{ padding: isMobile ? '6px' : '10px 16px 16px' }}>
              {rows.map(({ weekKey, weekStart, cells, weekPnl, weekTarget }) => {
                const progress = weekTarget > 0 ? Math.min(weekPnl / weekTarget, 1) : 0;
                const isEditing = editingWeek === weekKey;
                const ahead = weekPnl >= weekTarget;

                return (
                  <div key={weekKey} style={{ marginBottom: isMobile ? '6px' : '10px' }}>
                    {/* Day cells row */}
                    <div
                      className="calendar-row-grid"
                      style={{
                        display: 'grid',
                        gridTemplateColumns: isMobile ? 'repeat(7, 1fr)' : '100px repeat(7, 1fr)',
                        gap: isMobile ? '3px' : '6px',
                        marginBottom: '4px',
                      }}
                    >
                      {/* Weekly target column (Desktop only) */}
                      {!isMobile && (
                        <div className="calendar-week-col" style={{
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'center',
                          paddingRight: '4px',
                        }}>
                          {isEditing ? (
                            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                              <input
                                autoFocus
                                type="number"
                                value={editTarget}
                                onChange={e => setEditTarget(e.target.value)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') saveWeekTarget(weekStart);
                                  if (e.key === 'Escape') setEditingWeek(null);
                                }}
                                style={{
                                  width: '70px',
                                  background: 'var(--bg-main)',
                                  border: '1px solid var(--accent-lime)',
                                  borderRadius: '5px',
                                  color: 'var(--text-main)',
                                  fontSize: '0.72rem',
                                  padding: '4px 6px',
                                  outline: 'none',
                                  fontFamily: 'inherit',
                                }}
                              />
                              <button
                                onClick={() => saveWeekTarget(weekStart)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent-lime)', padding: '2px', fontSize: '0.7rem' }}
                              >✓</button>
                            </div>
                          ) : (
                            <WeekTargetButton
                              weekTarget={weekTarget}
                              ahead={ahead}
                              onClick={() => { setEditingWeek(weekKey); setEditTarget(String(weekTarget)); }}
                            />
                          )}
                        </div>
                      )}

                      {/* Day cells */}
                      {cells.map((cell, i) => {
                        if (!cell) return <div key={`empty-${weekKey}-${i}`} style={{ background: 'transparent' }} />;
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
                              border: `2px solid ${isSelected ? themeColor : (isToday ? 'var(--accent-lime)' : cellBorder(pnl))}`,
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
                            {/* Row 1: day number (top-left) + today/journal dots (top-right) */}
                            <div style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              width: '100%',
                            }}>
                              <span style={{
                                fontSize: isMobile ? '0.82rem' : '1.25rem',
                                fontWeight: '700',
                                color: isToday ? 'var(--accent-lime)' : 'var(--text-main)',
                                lineHeight: 1,
                              }}>
                                {dayNum}
                              </span>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
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
                                {!isToday && getEntryForDate(key) && (
                                  <span title="Journal entry" style={{
                                    width: isMobile ? '5px' : '6px',
                                    height: isMobile ? '5px' : '6px',
                                    borderRadius: '50%',
                                    background: '#74c0fc',
                                    display: 'inline-block',
                                    flexShrink: 0,
                                  }} />
                                )}
                              </div>
                            </div>

                            {/* Bottom Data Stack */}
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

                    {/* Weekly progress bar */}
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: isMobile ? 'auto 1fr' : '100px 1fr',
                      gap: '6px',
                      alignItems: 'center',
                      padding: isMobile ? '0 2px' : 0,
                    }}>
                      <div style={{
                        fontSize: isMobile ? '0.62rem' : '0.65rem',
                        fontWeight: '700',
                        color: weekPnl >= 0 ? 'var(--accent-lime)' : 'var(--color-loss)',
                        textAlign: isMobile ? 'left' : 'right',
                        paddingRight: '4px',
                        whiteSpace: 'nowrap',
                      }}>
                        {weekPnl !== 0 ? (weekPnl >= 0 ? '+' : '') + formatCalendarPnl(weekPnl, isMobile) : ''}
                      </div>
                      <div style={{
                        height: isMobile ? '3px' : '4px',
                        background: 'var(--border-color)',
                        borderRadius: '2px',
                        overflow: 'hidden',
                      }}>
                        {weekPnl !== 0 && (
                          <div style={{
                            height: '100%',
                            width: `${Math.min(Math.abs(progress) * 100, 100)}%`,
                            background: weekPnl >= 0
                              ? (ahead ? 'var(--accent-lime)' : 'rgba(var(--accent-lime-rgb), 0.65)')
                              : 'var(--color-loss)',
                            borderRadius: '2px',
                            transition: 'width 0.3s ease',
                          }} />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Legend */}
            <div style={{
              padding: isMobile ? '8px 12px 10px' : '10px 20px 14px',
              borderTop: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '8px',
            }}>
              <span style={{ fontSize: isMobile ? '0.65rem' : '0.7rem', color: 'var(--text-muted)' }}>
                ✏ Click a week's target to override it · Default: {formatCurrency(defaultWeeklyTarget)}/week
              </span>
              <div style={{ display: 'flex', gap: isMobile ? '10px' : '20px', alignItems: 'center', flexWrap: 'wrap' }}>
                {[
                  { color: 'rgba(var(--accent-lime-rgb), 0.45)', label: 'Profit day' },
                  { color: 'rgba(var(--color-loss-rgb), 0.45)', label: 'Loss day' },
                ].map(({ color, label }) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <div style={{ width: '8px', height: '8px', background: color, borderRadius: '2px' }} />
                    <span style={{ fontSize: isMobile ? '0.65rem' : '0.7rem', color: 'var(--text-muted)' }}>{label}</span>
                  </div>
                ))}
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <div style={{ width: '8px', height: '8px', border: `2px solid ${themeColor}`, borderRadius: '2px' }} />
                  <span style={{ fontSize: isMobile ? '0.65rem' : '0.7rem', color: 'var(--text-muted)' }}>Selected</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Journal side panel */}
      {selectedDate && (
        <>
          <div
            onClick={() => setSelectedDate(null)}
            style={{
              position: 'fixed', inset: 0,
              background: 'rgba(0,0,0,0.45)',
              zIndex: 399,
            }}
          />
          <JournalSidePanel
            dateStr={selectedDate}
            trades={trades ?? []}
            entries={entries}
            tradeNotes={tradeNotes}
            onSaveEntry={upsertEntry}
            onSaveTradeNote={(tradeId, fields) => upsertTradeNote({ tradeId, ...fields })}
            onDeleteTradeNote={deleteTradeNote}
            getEntryForDate={getEntryForDate}
            onClose={() => setSelectedDate(null)}
          />
        </>
      )}
      <style>{`
        @media (max-width: 768px) {
          .calendar-week-col { display: none !important; }
          .calendar-header-grid { grid-template-columns: repeat(7, 1fr) !important; padding: 8px 6px 4px !important; }
          .calendar-row-grid { grid-template-columns: repeat(7, 1fr) !important; }
        }
      `}</style>
    </>
  );
}

function WeekTargetButton({ weekTarget, ahead, onClick }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title="Click to set weekly target"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: '3px',
        background: hovered ? 'var(--bg-card-hover)' : 'transparent',
        border: `1px ${hovered ? 'dashed' : 'solid'} ${hovered ? 'var(--accent-lime)' : 'var(--border-color)'}`,
        borderRadius: '7px',
        padding: '6px 8px',
        cursor: 'pointer',
        fontFamily: 'inherit',
        width: '100%',
        transition: 'border-color 0.15s, background 0.15s, border-style 0.15s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <span style={{
          fontSize: '0.6rem',
          color: hovered ? 'var(--accent-lime)' : 'var(--text-muted)',
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          fontWeight: '600',
          transition: 'color 0.15s',
        }}>
          Target
        </span>
        <svg
          width="9" height="9" viewBox="0 0 12 12" fill="none"
          style={{ opacity: hovered ? 1 : 0.35, transition: 'opacity 0.15s' }}
        >
          <path
            d="M8 1.5L10.5 4L4.5 10H2V7.5L8 1.5Z"
            stroke={hovered ? 'var(--accent-lime)' : 'var(--text-muted)'}
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <span style={{
        fontSize: '0.72rem',
        fontWeight: '700',
        color: ahead
          ? 'var(--accent-lime)'
          : hovered ? 'var(--text-main)' : 'var(--text-muted)',
        transition: 'color 0.15s',
      }}>
        {formatCurrency(weekTarget)}
      </span>
    </button>
  );
}

function NavBtn({ children, onClick }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: '32px',
        height: '32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-card)',
        border: `1px solid ${hovered ? 'var(--accent-lime)' : 'var(--border-color)'}`,
        borderRadius: '7px',
        color: hovered ? 'var(--accent-lime)' : 'var(--text-muted)',
        cursor: 'pointer',
        fontSize: '0.9rem',
        fontFamily: 'inherit',
        transition: 'border-color 0.15s, color 0.15s',
      }}
    >
      {children}
    </button>
  );
}