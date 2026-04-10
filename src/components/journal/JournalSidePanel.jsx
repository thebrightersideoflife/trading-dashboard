import { useMemo } from 'react'
import JournalDayPanel from '../journal/JournalDayPanel'

/**
 * JournalSidePanel
 * Renders inside the calendar when a day cell is clicked.
 *
 * Props:
 *   dateStr         — 'YYYY-MM-DD'
 *   trades          — all trades (filtered to this day internally)
 *   entries         — all journal_entries from useJournal
 *   tradeNotes      — all trade_notes from useJournal
 *   onSaveEntry     — from useJournal
 *   onSaveTradeNote — from useJournal
 *   onDeleteTradeNote — from useJournal
 *   getEntryForDate — from useJournal
 *   onClose         — () => void
 */
export default function JournalSidePanel({
  dateStr,
  trades = [],
  entries = [],
  tradeNotes = [],
  onSaveEntry,
  onSaveTradeNote,
  onDeleteTradeNote,
  getEntryForDate,
  onClose,
}) {
  const tradesForDay = useMemo(() => {
    if (!dateStr) return []
    return trades.filter(t => {
      if (!t.close_time) return false
      const d = new Date(t.close_time)
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
      return key === dateStr
    })
  }, [trades, dateStr])

  const tradeNotesForDay = useMemo(() =>
    tradeNotes.filter(tn => tradesForDay.some(t => t.id === tn.trade_id)),
    [tradeNotes, tradesForDay]
  )

  return (
    <>
    <style>{`
      .journal-side-panel {
        position: fixed;
        top: 0;
        right: 0;
        width: 420px;
        height: 100vh;
        background: var(--bg-card);
        border-left: 1px solid var(--border-color);
        box-shadow: -8px 0 32px rgba(0,0,0,0.4);
        z-index: 400;
        display: flex;
        flex-direction: column;
      }
      @media (max-width: 480px) {
        .journal-side-panel {
          width: 100vw !important;
          left: 0;
          border-left: none;
        }
      }
    `}</style>
    <div className="journal-side-panel">
      <JournalDayPanel
        dateStr={dateStr}
        entry={getEntryForDate(dateStr)}
        trades={tradesForDay}
        tradeNotes={tradeNotesForDay}
        onSaveEntry={onSaveEntry}
        onSaveTradeNote={(tradeId, fields) => onSaveTradeNote({ tradeId, ...fields })}
        onDeleteTradeNote={onDeleteTradeNote}
        onClose={onClose}
        embedded={false}
      />
    </div>
    </>
  )
}