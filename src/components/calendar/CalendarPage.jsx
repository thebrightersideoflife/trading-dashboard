import { useState, useMemo } from 'react';
import { useJournal } from '../../hooks/useJournal';
import JournalSidePanel from '../journal/JournalSidePanel';
import '../../assets/styles/colors.css';
import '../../assets/styles/dashboard.css';
import { useTradingData } from '../../hooks/useTradingData';
import { formatCurrency } from '../../utils/formatters';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/**
 * CalendarPage
 * Full-page calendar view with:
 * - Daily P&L heatmap cells
 * - Weekly target progress bars (per-week target stored in Supabase or localStorage)
 * - Month navigator + summary strip
 * - Inline weekly target override editor
 */
export default function CalendarPage({ sessionReady, profile, showDemoData }) {
  const { dailyPnl, weekTargets, upsertWeekTarget, trades } = useTradingData(sessionReady, showDemoData);

  const {
    entries, tradeNotes,
    upsertEntry, upsertTradeNote, deleteTradeNote, getEntryForDate,
  } = useJournal(sessionReady);

  const today = new Date();
  // Format a local date as 'YYYY-MM-DD' without UTC conversion
  const localDateKey = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const todayKey = localDateKey(today);

  const [viewYear,  setViewYear]  = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  const [editingWeek,  setEditingWeek]  = useState(null); // 'YYYY-WW'
  const [editTarget,   setEditTarget]   = useState('');
  const [selectedDate, setSelectedDate] = useState(null); // 'YYYY-MM-DD'

  const defaultWeeklyTarget = profile?.weekly_default_target ?? 500;

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
  const monthKey     = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}`;
  const monthEntries = Object.entries(pnlMap).filter(([k]) => k.startsWith(monthKey));
  const monthTotal   = monthEntries.reduce((s, [, v]) => s + (v.total_pnl ?? 0), 0);
  const monthTrades  = monthEntries.reduce((s, [, v]) => s + (v.trades    ?? 0), 0);
  const winDays      = monthEntries.filter(([, v]) => v.total_pnl > 0).length;
  const lossDays     = monthEntries.filter(([, v]) => v.total_pnl < 0).length;

  // Calendar grid
  const firstDay = new Date(viewYear, viewMonth, 1);
  const lastDay  = new Date(viewYear, viewMonth + 1, 0);
  const isoWeekday = (d) => (d.getDay() + 6) % 7;
  const startPad   = isoWeekday(firstDay);
  const daysInMonth = lastDay.getDate();
  const totalCells  = Math.ceil((startPad + daysInMonth) / 7) * 7;

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
      const d   = new Date(viewYear, viewMonth, dayNum);
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
      const weekKey   = validCells[0].weekKey;
      const weekPnl   = validCells.reduce((s, c) => s + (c.data?.total_pnl ?? 0), 0);
      // Derive true Monday of this ISO week (not just first visible cell)
      const _firstDate = new Date(viewYear, viewMonth, validCells[0].dayNum);
      const _dow = (_firstDate.getDay() + 6) % 7; // 0=Mon … 6=Sun
      const _mon = new Date(_firstDate);
      _mon.setDate(_firstDate.getDate() - _dow);
      const weekStart = `${_mon.getFullYear()}-${String(_mon.getMonth()+1).padStart(2,'0')}-${String(_mon.getDate()).padStart(2,'0')}`;
      const weekTarget  = weekTargetMap[weekStart] ?? defaultWeeklyTarget;
      result.push({ weekKey, weekStart, cells: week, weekPnl, weekTarget });
    }
    return result;
  }, [totalCells, startPad, daysInMonth, viewYear, viewMonth, pnlMap, weekTargetMap, defaultWeeklyTarget]);

  // Max abs pnl for colour intensity
  const maxAbs = Math.max(...monthEntries.map(([, v]) => Math.abs(v.total_pnl ?? 0)), 1);

  function cellBg(pnl) {
    if (pnl == null) return 'transparent';
    const intensity = Math.min(Math.abs(pnl) / maxAbs, 1);
    if (pnl > 0) return `rgba(200, 241, 53, ${0.06 + intensity * 0.24})`;
    if (pnl < 0) return `rgba(240, 62, 62,  ${0.06 + intensity * 0.24})`;
    return 'transparent';
  }
  function cellBorder(pnl) {
    if (pnl == null) return 'var(--border-color)';
    if (pnl > 0) return 'rgba(200, 241, 53, 0.25)';
    if (pnl < 0) return 'rgba(240, 62, 62, 0.25)';
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
    <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
      {/* Page header */}
      <div style={{ marginBottom: '1.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: '700', color: 'var(--text-main)', letterSpacing: '-0.03em', margin: 0 }}>
            Trade Calendar
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: '5px' }}>
            Daily P&L heatmap · Weekly targets
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <NavBtn onClick={prevMonth}>&#8592;</NavBtn>
          <span style={{ minWidth: '155px', textAlign: 'center', fontSize: '0.9rem', fontWeight: '600', color: 'var(--text-main)' }}>
            {monthLabel}
          </span>
          <NavBtn onClick={nextMonth}>&#8594;</NavBtn>
        </div>
      </div>

      {/* Month summary strip */}
      <div style={{
        display: 'flex',
        gap: '1rem',
        marginBottom: '1.5rem',
        flexWrap: 'wrap',
      }}>
        {[
          { label: 'Month P&L',  value: formatCurrency(monthTotal),  color: monthTotal >= 0 ? 'var(--accent-lime)' : 'var(--color-loss)' },
          { label: 'Trades',     value: monthTrades,                  color: 'var(--text-main)' },
          { label: 'Win Days',   value: winDays,                      color: 'var(--accent-lime)' },
          { label: 'Loss Days',  value: lossDays,                     color: 'var(--color-loss)' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{
            flex: '1 1 120px',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '10px',
            padding: '14px 18px',
          }}>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: '600', marginBottom: '4px' }}>
              {label}
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: '700', color }}>
              {value}
            </div>
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
        borderRadius: '14px',
        overflow: 'hidden',
      }}>
        {/* Weekday headers */}
        <div className="calendar-header-grid" style={{
          display: 'grid',
          gridTemplateColumns: '1fr repeat(7, 1fr)',
          gap: '6px',
          padding: '14px 16px 6px',
          borderBottom: '1px solid var(--border-color)',
        }}>
          <div className="calendar-week-col" /> {/* week column header */}
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

        {/* Week rows */}
        <div style={{ padding: '10px 16px 16px' }}>
          {rows.map(({ weekKey, weekStart, cells, weekPnl, weekTarget }) => {
            const progress = weekTarget > 0 ? Math.min(weekPnl / weekTarget, 1) : 0;
            const isEditing = editingWeek === weekKey;
            const ahead = weekPnl >= weekTarget;

            return (
              <div key={weekKey} style={{ marginBottom: '10px' }}>
                {/* Day cells row */}
                <div className="calendar-row-grid" style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr repeat(7, 1fr)',
                  gap: '6px',
                  marginBottom: '5px',
                }}>
                  {/* Weekly target column */}
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

                  {/* Day cells */}
                  {cells.map((cell, i) => {
                    if (!cell) return <div key={`empty-${weekKey}-${i}`} />;
                    const { dayNum, key, data, isToday } = cell;
                    const pnl = data?.total_pnl ?? null;
                    return (
                      <div
                        key={key}
                        onClick={() => setSelectedDate(key)}
                        style={{
                          aspectRatio: '1',
                          background: cellBg(pnl),
                          border: `1px solid ${isToday ? 'var(--accent-lime)' : cellBorder(pnl)}`,
                          borderRadius: '7px',
                          display: 'grid',
                          gridTemplateRows: 'auto 1fr auto',
                          padding: '6px 6px 5px',
                          minHeight: '70px',
                          transition: 'transform 0.1s',
                          cursor: 'pointer',
                          boxSizing: 'border-box',
                          position: 'relative',
                        }}
                        onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
                        onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                      >
                        {/* ── Row 1: day number (top-left) + today dot (top-right) ── */}
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}>
                          <span style={{
                            fontSize: '0.78rem',
                            fontWeight: '700',
                            color: isToday ? 'var(--accent-lime)' : 'var(--text-main)',
                            lineHeight: 1,
                          }}>
                            {dayNum}
                          </span>
                          {/* Today indicator dot */}
                          {isToday && (
                            <span style={{
                              width: '6px',
                              height: '6px',
                              borderRadius: '50%',
                              background: 'var(--accent-lime)',
                              display: 'inline-block',
                              flexShrink: 0,
                            }} />
                          )}
                          {/* Journal entry dot */}
                          {!isToday && getEntryForDate(key) && (
                            <span title="Journal entry" style={{
                              width: '5px',
                              height: '5px',
                              borderRadius: '50%',
                              background: '#74c0fc',
                              display: 'inline-block',
                              flexShrink: 0,
                            }} />
                          )}
                        </div>

                        {/* ── Row 2: P&L centred vertically and horizontally ── */}
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}>
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

                        {/* ── Row 3: trade count bottom-right ── */}
                        <div style={{
                          display: 'flex',
                          justifyContent: 'flex-end',
                          alignItems: 'flex-end',
                        }}>
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
                    );
                  })}
                </div>

                {/* Weekly progress bar */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 7fr',
                  gap: '6px',
                  alignItems: 'center',
                }}>
                  {/* Week P&L label */}
                  <div style={{
                    fontSize: '0.65rem',
                    fontWeight: '700',
                    color: weekPnl >= 0 ? 'var(--accent-lime)' : 'var(--color-loss)',
                    textAlign: 'right',
                    paddingRight: '4px',
                  }}>
                    {weekPnl !== 0 ? (weekPnl >= 0 ? '+' : '') + weekPnl.toFixed(0) : ''}
                  </div>
                  {/* Bar */}
                  <div style={{
                    height: '4px',
                    background: 'var(--border-color)',
                    borderRadius: '2px',
                    overflow: 'hidden',
                  }}>
                    {weekPnl !== 0 && (
                      <div style={{
                        height: '100%',
                        width: `${Math.abs(progress) * 100}%`,
                        background: weekPnl >= 0
                          ? (ahead ? 'var(--accent-lime)' : 'rgba(200,241,53,0.5)')
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
          padding: '10px 20px 14px',
          borderTop: '1px solid var(--border-color)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '8px',
        }}>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
            ✏ Click a week's target to override it · Default: {formatCurrency(defaultWeeklyTarget)}/week
          </span>
          <div style={{ display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
            {[
              { color: 'rgba(200,241,53,0.3)', label: 'Profit day' },
              { color: 'rgba(240,62,62,0.3)',  label: 'Loss day'   },
            ].map(({ color, label }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <div style={{ width: '10px', height: '10px', background: color, borderRadius: '2px' }} />
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{label}</span>
              </div>
            ))}
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{
                fontSize: '0.58rem', fontWeight: '600', color: 'var(--text-main)',
                background: 'rgba(255,255,255,0.08)', borderRadius: '3px', padding: '1px 4px',
              }}>3</span>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Trade count</span>
            </div>
          </div>
        </div>
      </div>
    </div>
    </div>

      {/* ── Journal side panel ────────────────────────────── */}
      {selectedDate && (
        <>
          {/* Backdrop */}
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
        .calendar-header-grid { grid-template-columns: repeat(7, 1fr) !important; padding: 10px 10px 4px !important; }
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
      {/* Label row */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
      }}>
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
        {/* Pencil icon — always visible but dims when not hovered */}
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

      {/* Value */}
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