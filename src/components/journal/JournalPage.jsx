import { useState, useMemo } from 'react'
import { useJournal } from '../../hooks/useJournal'
import { useTradingData } from '../../hooks/useTradingData'
import JournalDayPanel from './JournalDayPanel'
import { todayLocalDate, formatEntryDate, MOOD_LABELS, CONFIDENCE_LABELS } from '../../utils/journalConstants'
import { formatCurrency } from '../../utils/formatters'

/**
 * JournalPage
 * Route: /journal
 *
 * Left column  — scrollable list of all days that have either trades or journal entries
 * Right column — JournalDayPanel for the selected day
 */
export default function JournalPage({ sessionReady = true, showDemoData = true }) {
  const {
    entries, tradeNotes, loading: journalLoading, error: journalError,
    upsertEntry, upsertTradeNote, deleteTradeNote,
    getEntryForDate, getNoteForTrade,
  } = useJournal(sessionReady)

  const {
    trades, loading: tradesLoading,
  } = useTradingData(sessionReady, showDemoData)

  // Strip mock trades when demo is off — same pattern as Dashboard/Trades
  const baseTrades = useMemo(
    () => showDemoData ? (trades ?? []) : (trades ?? []).filter(t => !t.is_mock),
    [trades, showDemoData]
  )

  const [selectedDate, setSelectedDate] = useState(todayLocalDate())

  const loading = journalLoading || tradesLoading

  // Build a sorted list of unique dates that have trades or entries
  const activeDates = useMemo(() => {
    const dateSet = new Set()
    dateSet.add(todayLocalDate()) // always show today

    for (const t of baseTrades) {
      if (t.close_time) {
        const d = new Date(t.close_time)
        const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
        dateSet.add(key)
      }
    }
    for (const e of entries ?? []) {
      if (e.entry_date) dateSet.add(e.entry_date.slice(0,10))
    }

    return [...dateSet].sort((a, b) => b.localeCompare(a)) // newest first
  }, [baseTrades, entries])

  // Trades for the selected day
  const tradesForDay = useMemo(() => {
    if (!selectedDate) return []
    return baseTrades.filter(t => {
      if (!t.close_time) return false
      const d = new Date(t.close_time)
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
      return key === selectedDate
    })
  }, [baseTrades, selectedDate])

  // Trade notes for those trades
  const tradeNotesForDay = useMemo(() =>
    (tradeNotes ?? []).filter(tn =>
      tradesForDay.some(t => t.id === tn.trade_id)
    ),
    [tradeNotes, tradesForDay]
  )

  const today = todayLocalDate()

  if (loading) return (
    <div style={{ display:'flex', justifyContent:'center', alignItems:'center', minHeight:'60vh' }}>
      <p style={{ color:'var(--text-muted)', fontSize:'0.875rem' }}>Loading journal…</p>
    </div>
  )

  if (journalError) return (
    <div style={{ display:'flex', justifyContent:'center', alignItems:'center', minHeight:'60vh' }}>
      <p style={{ color:'var(--color-loss)', fontSize:'0.875rem' }}>Error: {journalError}</p>
    </div>
  )

  return (
    <>
    <div style={{
      padding:'2rem 2rem 4rem',
      minHeight:'calc(100vh - 70px)',
      background:'var(--bg-main)',
    }}>
      <div style={{ maxWidth:'1400px', margin:'0 auto' }}>

        {/* Page header */}
        <header style={{ marginBottom:'2rem', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div>
            <h1 style={{ fontSize:'1.5rem', fontWeight:'700', letterSpacing:'-0.03em', color:'var(--text-main)', margin:0 }}>
              Trading Journal
            </h1>
            <p style={{ color:'var(--text-muted)', fontSize:'0.85rem', marginTop:'5px' }}>
              {entries.length} entr{entries.length === 1 ? 'y' : 'ies'} written
            </p>
          </div>
        </header>

        {/* Two-column layout */}
        <div className="journal-layout" style={{
          display:'grid',
          gridTemplateColumns:'300px 1fr',
          gap:'1.5rem',
          alignItems:'start',
        }}>

          {/* ── Left: date list ───────────────────────────────── */}
          <div style={{
            background:'var(--bg-card)',
            border:'1px solid var(--border-color)',
            borderRadius:'var(--radius-xl)',
            overflow:'hidden',
            boxShadow:'var(--card-shadow)',
            maxHeight:'calc(100vh - 200px)',
            overflowY:'auto',
          }}>
            <div style={{
              padding:'14px 18px',
              borderBottom:'1px solid var(--border-color)',
              fontSize:'0.78rem', fontWeight:'600',
              color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.05em',
            }}>
              Trading Days
            </div>

            {activeDates.map(dateStr => {
              const entry   = getEntryForDate(dateStr)
              const dayTrades = baseTrades.filter(t => {
                if (!t.close_time) return false
                const d = new Date(t.close_time)
                const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
                return key === dateStr
              })
              const dayPnl = dayTrades.reduce((s, t) => s + Number(t.realized_pnl ?? 0), 0)
              const isSelected = selectedDate === dateStr
              const isToday    = dateStr === today

              return (
                <button
                  key={dateStr}
                  onClick={() => setSelectedDate(dateStr)}
                  style={{
                    width:'100%', padding:'12px 18px',
                    background: isSelected ? 'var(--bg-card-hover)' : 'transparent',
                    border:'none',
                    borderLeft: isSelected ? '3px solid var(--accent-lime)' : '3px solid transparent',
                    cursor:'pointer', fontFamily:'inherit', textAlign:'left',
                    transition:'background 0.1s',
                    borderBottom:'1px solid var(--border-color)',
                  }}
                  onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.02)' }}
                  onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent' }}
                >
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <div>
                      <div style={{
                        fontSize:'0.85rem', fontWeight: isToday ? '700' : '500',
                        color: isToday ? 'var(--accent-lime)' : 'var(--text-main)',
                      }}>
                        {isToday ? 'Today' : formatEntryDate(dateStr).replace(/\d{4}$/, '').trim()}
                      </div>
                      <div style={{ fontSize:'0.72rem', color:'var(--text-muted)', marginTop:'2px', display:'flex', gap:'8px' }}>
                        {dayTrades.length > 0 && (
                          <span>{dayTrades.length} trade{dayTrades.length !== 1 ? 's' : ''}</span>
                        )}
                        {entry?.mood && (
                          <span>Mood {entry.mood}/5</span>
                        )}
                        {!entry && !dayTrades.length && (
                          <span>No activity</span>
                        )}
                      </div>
                    </div>
                    <div style={{ textAlign:'right' }}>
                      {dayTrades.length > 0 && (
                        <div style={{
                          fontSize:'0.82rem', fontWeight:'700',
                          color: dayPnl >= 0 ? 'var(--color-profit)' : 'var(--color-loss)',
                        }}>
                          {dayPnl >= 0 ? '+' : ''}{formatCurrency(dayPnl)}
                        </div>
                      )}
                      {/* Dot indicators */}
                      <div style={{ display:'flex', gap:'4px', justifyContent:'flex-end', marginTop:'3px' }}>
                        {entry && (
                          <span style={{
                            width:'6px', height:'6px', borderRadius:'50%',
                            background:'var(--accent-lime)', display:'inline-block',
                          }} title="Journal entry written" />
                        )}
                        {(tradeNotes ?? []).some(tn => dayTrades.some(t => t.id === tn.trade_id)) && (
                          <span style={{
                            width:'6px', height:'6px', borderRadius:'50%',
                            background:'#74c0fc', display:'inline-block',
                          }} title="Trade notes written" />
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>

          {/* ── Right: day panel ──────────────────────────────── */}
          <div style={{
            background:'var(--bg-card)',
            border:'1px solid var(--border-color)',
            borderRadius:'var(--radius-xl)',
            boxShadow:'var(--card-shadow)',
            minHeight:'500px',
            overflow:'hidden',
          }}>
            {selectedDate ? (
              <JournalDayPanel
                dateStr={selectedDate}
                entry={getEntryForDate(selectedDate)}
                trades={tradesForDay}
                tradeNotes={tradeNotesForDay}
                onSaveEntry={upsertEntry}
                onSaveTradeNote={(tradeId, fields) => upsertTradeNote({ tradeId, ...fields })}
                onDeleteTradeNote={deleteTradeNote}
                embedded
              />
            ) : (
              <div style={{
                display:'flex', alignItems:'center', justifyContent:'center',
                height:'300px', color:'var(--text-muted)', fontSize:'0.875rem',
              }}>
                Select a day to view or write an entry
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
    <style>{`
      @media (max-width: 768px) {
        .journal-layout {
          grid-template-columns: 1fr !important;
        }
        .journal-layout > div:first-child {
          max-height: 220px !important;
        }
      }
    `}</style>
    </>
  )
}