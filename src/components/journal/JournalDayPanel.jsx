import { useState, useEffect } from 'react'
import {
  MISTAKE_CATEGORIES, OUTCOME_TAGS, MOOD_LABELS, CONFIDENCE_LABELS,
  todayLocalDate, formatEntryDate
} from '../../utils/journalConstants'

/**
 * JournalDayPanel
 *
 * Props:
 *   dateStr         — 'YYYY-MM-DD' of the selected day
 *   entry           — journal_entries row or null
 *   trades          — array of trade rows for this day
 *   tradeNotes      — array of trade_notes rows for this day's trades
 *   onSaveEntry     — async (fields) => { success, error }
 *   onSaveTradeNote — async (tradeId, fields) => { success, error }
 *   onDeleteTradeNote — async (tradeId) => { success, error }
 *   onClose         — () => void (for panel mode)
 *   embedded        — bool; when true, no close button / border (full page mode)
 */
export default function JournalDayPanel({
  dateStr,
  entry,
  trades = [],
  tradeNotes = [],
  onSaveEntry,
  onSaveTradeNote,
  onDeleteTradeNote,
  onClose,
  embedded = false,
}) {
  const isToday    = dateStr === todayLocalDate()
  const isEditable = isToday || (entry && entry.entry_date === todayLocalDate())
  const readOnly   = !isEditable

  // Daily entry form state
  const [note,       setNote]       = useState(entry?.note       ?? '')
  const [mood,       setMood]       = useState(entry?.mood       ?? null)
  const [confidence, setConfidence] = useState(entry?.confidence ?? null)
  const [saving,     setSaving]     = useState(false)
  const [saveMsg,    setSaveMsg]    = useState('')

  // Sync form when entry prop changes (e.g. navigating between days)
  useEffect(() => {
    setNote(entry?.note ?? '')
    setMood(entry?.mood ?? null)
    setConfidence(entry?.confidence ?? null)
    setSaveMsg('')
  }, [dateStr, entry])

  const handleSaveEntry = async () => {
    setSaving(true)
    setSaveMsg('')
    const result = await onSaveEntry({ entryDate: dateStr, note, mood, confidence })
    setSaving(false)
    setSaveMsg(result.success ? 'saved' : (result.error ?? 'Failed'))
    if (result.success) setTimeout(() => setSaveMsg(''), 2500)
  }

  const formattedDate = formatEntryDate(dateStr)

  return (
    <div style={{
      backgroundColor: embedded ? 'transparent' : 'var(--bg-card)',
      border:          embedded ? 'none' : '1px solid var(--border-color)',
      borderRadius:    embedded ? 0 : 'var(--radius-xl)',
      display:         'flex',
      flexDirection:   'column',
      height:          '100%',
      overflow:        'hidden',
    }}>

      {/* ── Panel header ──────────────────────────────────────── */}
      <div style={{
        padding:      '18px 22px',
        borderBottom: '1px solid var(--border-color)',
        display:      'flex',
        justifyContent: 'space-between',
        alignItems:   'center',
        flexShrink:   0,
      }}>
        <div>
          <div style={{ fontSize:'1rem', fontWeight:'700', color:'var(--text-main)' }}>
            {formattedDate}
          </div>
          <div style={{ fontSize:'0.75rem', color:'var(--text-muted)', marginTop:'2px' }}>
            {readOnly
              ? 'Read-only — entries lock after midnight'
              : 'Editable today only'}
          </div>
        </div>
        {!embedded && onClose && (
          <button onClick={onClose} style={{
            background:'none', border:'none', color:'var(--text-muted)',
            cursor:'pointer', fontSize:'1.1rem', lineHeight:1, padding:'4px 8px',
          }}>✕</button>
        )}
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:'20px 22px' }}>

        {/* ── Mood & Confidence ─────────────────────────────────── */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px', marginBottom:'20px' }}>
          <ScaleSelector
            label="Mood"
            value={mood}
            onChange={readOnly ? null : setMood}
            labels={MOOD_LABELS}
            readOnly={readOnly}
          />
          <ScaleSelector
            label="Confidence"
            value={confidence}
            onChange={readOnly ? null : setConfidence}
            labels={CONFIDENCE_LABELS}
            readOnly={readOnly}
          />
        </div>

        {/* ── Daily note ───────────────────────────────────────── */}
        <div style={{ marginBottom:'20px' }}>
          <label style={{
            display:'block', fontSize:'0.78rem', fontWeight:'600',
            color:'var(--text-muted)', letterSpacing:'0.05em',
            textTransform:'uppercase', marginBottom:'8px',
          }}>
            Daily Note
          </label>
          <textarea
            value={note}
            onChange={e => !readOnly && setNote(e.target.value)}
            readOnly={readOnly}
            placeholder={readOnly ? 'No note written for this day.' : 'What was your mindset today? What did you do well or poorly?'}
            rows={5}
            style={{
              width:'100%', boxSizing:'border-box',
              background: readOnly ? 'var(--bg-main)' : 'var(--bg-input)',
              border:`1px solid ${readOnly ? 'var(--border-color)' : 'var(--border-color)'}`,
              borderRadius:'8px', color:'var(--text-main)',
              fontSize:'0.875rem', padding:'12px 14px',
              outline:'none', resize:'vertical', fontFamily:'inherit',
              lineHeight:1.6,
              opacity: readOnly ? 0.7 : 1,
            }}
            onFocus={e => { if (!readOnly) e.target.style.borderColor = 'var(--accent-lime)' }}
            onBlur={e => { e.target.style.borderColor = 'var(--border-color)' }}
          />
        </div>

        {/* ── Save button (today only) ──────────────────────────── */}
        {!readOnly && (
          <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'24px' }}>
            <button
              onClick={handleSaveEntry}
              disabled={saving}
              style={{
                padding:'9px 22px',
                background: saving ? 'rgba(200,241,53,0.5)' : 'var(--accent-lime)',
                border:'none', borderRadius:'7px',
                color:'#0a0a0f', fontSize:'0.85rem', fontWeight:'700',
                cursor: saving ? 'not-allowed' : 'pointer', fontFamily:'inherit',
              }}
            >
              {saving ? 'Saving…' : entry ? 'Update Entry' : 'Save Entry'}
            </button>
            {saveMsg === 'saved' && (
              <span style={{ fontSize:'0.8rem', color:'var(--accent-lime)', fontWeight:'600' }}>✓ Saved</span>
            )}
            {saveMsg && saveMsg !== 'saved' && (
              <span style={{ fontSize:'0.8rem', color:'var(--color-loss)' }}>⚠ {saveMsg}</span>
            )}
          </div>
        )}

        {/* ── Trade notes for this day ──────────────────────────── */}
        {trades.length > 0 && (
          <div>
            <div style={{
              fontSize:'0.78rem', fontWeight:'600', color:'var(--text-muted)',
              letterSpacing:'0.05em', textTransform:'uppercase', marginBottom:'12px',
            }}>
              Trades ({trades.length})
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
              {trades.map(trade => {
                const tn = tradeNotes.find(n => n.trade_id === trade.id) ?? null
                return (
                  <TradeNoteCard
                    key={trade.id}
                    trade={trade}
                    tradeNote={tn}
                    onSave={(fields) => onSaveTradeNote(trade.id, fields)}
                    onDelete={() => onDeleteTradeNote(trade.id)}
                  />
                )
              })}
            </div>
          </div>
        )}

        {trades.length === 0 && (
          <div style={{
            textAlign:'center', padding:'32px 0',
            color:'var(--text-muted)', fontSize:'0.85rem',
          }}>
            No trades on this day
          </div>
        )}
      </div>
    </div>
  )
}

/* ── ScaleSelector ────────────────────────────────────────────── */
function ScaleSelector({ label, value, onChange, labels, readOnly }) {
  return (
    <div>
      <div style={{
        fontSize:'0.78rem', fontWeight:'600', color:'var(--text-muted)',
        letterSpacing:'0.05em', textTransform:'uppercase', marginBottom:'8px',
      }}>
        {label}
        {value && (
          <span style={{ color: labels[value]?.color, marginLeft:'8px', fontWeight:'700' }}>
            {labels[value]?.label}
          </span>
        )}
      </div>
      <div style={{ display:'flex', gap:'6px' }}>
        {[1,2,3,4,5].map(n => {
          const active = value === n
          return (
            <button
              key={n}
              onClick={() => !readOnly && onChange(active ? null : n)}
              disabled={readOnly}
              style={{
                flex:1, padding:'8px 0', borderRadius:'6px',
                border:`1px solid ${active ? labels[n].color : 'var(--border-color)'}`,
                background: active ? `${labels[n].color}22` : 'var(--bg-main)',
                color: active ? labels[n].color : 'var(--text-muted)',
                fontSize:'0.85rem', fontWeight: active ? '700' : '500',
                cursor: readOnly ? 'default' : 'pointer',
                fontFamily:'inherit', transition:'all 0.12s',
              }}
            >
              {n}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/* ── TradeNoteCard ────────────────────────────────────────────── */
function TradeNoteCard({ trade, tradeNote, onSave, onDelete }) {
  const [open,     setOpen]     = useState(false)
  const [note,     setNote]     = useState(tradeNote?.note             ?? '')
  const [category, setCategory] = useState(tradeNote?.mistake_category ?? '')
  const [outcome,  setOutcome]  = useState(tradeNote?.outcome_tag      ?? '')
  const [saving,   setSaving]   = useState(false)
  const [msg,      setMsg]      = useState('')

  useEffect(() => {
    setNote(tradeNote?.note ?? '')
    setCategory(tradeNote?.mistake_category ?? '')
    setOutcome(tradeNote?.outcome_tag ?? '')
  }, [tradeNote])

  const pnl      = trade.realized_pnl ?? 0
  const isProfit = pnl >= 0

  const handleSave = async () => {
    setSaving(true)
    setMsg('')
    const result = await onSave({ note, mistakeCategory: category || null, outcomeTag: outcome || null })
    setSaving(false)
    setMsg(result.success ? 'saved' : (result.error ?? 'Failed'))
    if (result.success) setTimeout(() => setMsg(''), 2000)
  }

  const handleDelete = async () => {
    await onDelete()
    setNote(''); setCategory(''); setOutcome('')
  }

  return (
    <div style={{
      background:'var(--bg-main)', border:'1px solid var(--border-color)',
      borderRadius:'8px', overflow:'hidden',
    }}>
      {/* Trade summary row */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width:'100%', padding:'10px 14px', background:'none', border:'none',
          cursor:'pointer', display:'flex', justifyContent:'space-between',
          alignItems:'center', fontFamily:'inherit',
        }}
      >
        <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
          <span style={{
            padding:'2px 8px', borderRadius:'5px', fontSize:'0.72rem', fontWeight:'700',
            background: trade.side === 'Buy' ? 'var(--accent-lime-dim)' : 'var(--color-loss-dim)',
            color:       trade.side === 'Buy' ? 'var(--accent-lime)'    : 'var(--color-loss)',
          }}>
            {trade.side}
          </span>
          <span style={{ fontSize:'0.85rem', fontWeight:'600', color:'var(--text-main)' }}>
            {trade.symbol}
          </span>
          {tradeNote && (
            <span style={{
              width:'6px', height:'6px', borderRadius:'50%',
              background:'var(--accent-lime)', display:'inline-block', flexShrink:0,
            }} title="Has note" />
          )}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
          <span style={{
            fontSize:'0.85rem', fontWeight:'700',
            color: isProfit ? 'var(--color-profit)' : 'var(--color-loss)',
          }}>
            {isProfit ? '+' : ''}${Math.abs(pnl).toFixed(2)}
          </span>
          <span style={{ color:'var(--text-muted)', fontSize:'0.75rem' }}>
            {open ? '▲' : '▼'}
          </span>
        </div>
      </button>

      {/* Expanded note editor */}
      {open && (
        <div style={{ padding:'0 14px 14px', borderTop:'1px solid var(--border-color)' }}>
          <div style={{ height:'12px' }} />

          {/* Dropdowns row */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'10px' }}>
            <div>
              <div style={{ fontSize:'0.7rem', color:'var(--text-muted)', fontWeight:'600', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:'5px' }}>Category</div>
              <PillSelect
                value={category}
                onChange={setCategory}
                options={MISTAKE_CATEGORIES}
                placeholder="Select…"
              />
            </div>
            <div>
              <div style={{ fontSize:'0.7rem', color:'var(--text-muted)', fontWeight:'600', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:'5px' }}>Outcome</div>
              <PillSelect
                value={outcome}
                onChange={setOutcome}
                options={OUTCOME_TAGS}
                placeholder="Select…"
              />
            </div>
          </div>

          {/* Note textarea */}
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Add a note about this trade…"
            rows={3}
            style={{
              width:'100%', boxSizing:'border-box',
              background:'var(--bg-input)', border:'1px solid var(--border-color)',
              borderRadius:'7px', color:'var(--text-main)', fontSize:'0.8rem',
              padding:'10px 12px', outline:'none', resize:'vertical',
              fontFamily:'inherit', lineHeight:1.5,
            }}
            onFocus={e => e.target.style.borderColor = 'var(--accent-lime)'}
            onBlur={e => e.target.style.borderColor = 'var(--border-color)'}
          />

          {/* Action row */}
          <div style={{ display:'flex', alignItems:'center', gap:'8px', marginTop:'8px' }}>
            <button onClick={handleSave} disabled={saving} style={{
              padding:'7px 16px', background: saving ? 'rgba(200,241,53,0.5)' : 'var(--accent-lime)',
              border:'none', borderRadius:'6px', color:'#0a0a0f',
              fontSize:'0.78rem', fontWeight:'700',
              cursor: saving ? 'not-allowed' : 'pointer', fontFamily:'inherit',
            }}>
              {saving ? 'Saving…' : tradeNote ? 'Update' : 'Save'}
            </button>
            {tradeNote && (
              <button onClick={handleDelete} style={{
                padding:'7px 12px', background:'transparent',
                border:'1px solid var(--color-loss-dim)', borderRadius:'6px',
                color:'var(--color-loss)', fontSize:'0.78rem',
                cursor:'pointer', fontFamily:'inherit',
              }}>
                Remove
              </button>
            )}
            {msg === 'saved' && <span style={{ fontSize:'0.75rem', color:'var(--accent-lime)' }}>✓ Saved</span>}
            {msg && msg !== 'saved' && <span style={{ fontSize:'0.75rem', color:'var(--color-loss)' }}>⚠ {msg}</span>}
          </div>
        </div>
      )}
    </div>
  )
}

/* ── PillSelect ───────────────────────────────────────────────── */
function PillSelect({ value, onChange, options, placeholder }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{
        width:'100%', background:'var(--bg-main)',
        border:'1px solid var(--border-color)', borderRadius:'6px',
        color: value ? 'var(--text-main)' : 'var(--text-muted)',
        fontSize:'0.78rem', padding:'7px 26px 7px 9px',
        outline:'none', fontFamily:'inherit', cursor:'pointer', appearance:'none',
        backgroundImage:`url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='%23666' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
        backgroundRepeat:'no-repeat', backgroundPosition:'right 8px center',
      }}
      onFocus={e => e.target.style.borderColor = 'var(--accent-lime)'}
      onBlur={e => e.target.style.borderColor = 'var(--border-color)'}
    >
      <option value="">{placeholder}</option>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  )
}