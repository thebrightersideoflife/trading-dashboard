import { useState, Fragment } from 'react'
import { supabase } from '../../api/supabaseClient'
import { formatCurrency } from '../../utils/formatters'

const PAGE_SIZE = 20

const COLS = [
  { key: 'id',         label: 'ID',          w: '80px'  },
  { key: 'symbol',     label: 'Symbol',      w: '90px'  },
  { key: 'side',       label: 'Side',        w: '72px'  },
  { key: 'open_time',  label: 'Open Date',   w: '140px' },
  { key: 'close_time', label: 'Close Date',  w: '140px' },
  { key: 'entry_price',label: 'Entry',       w: '90px'  },
  { key: 'exit_price', label: 'Exit',        w: '90px'  },
  { key: 'quantity',   label: 'Qty',         w: '60px'  },
  { key: 'fees',       label: 'Fee',         w: '70px'  },
  { key: 'swap',       label: 'Swap',        w: '70px'  },
  { key: 'realized_pnl', label: 'P&L',       w: '90px'  },
  { key: '_actions',   label: '',            w: '80px'  },
]

function formatDatetime(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d)) return iso
  return d.toLocaleDateString('en-GB', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  }).replace(',', '')
}

function truncate(str, n = 10) {
  if (!str) return '—'
  return str.length > n ? str.slice(0, n) + '…' : str
}

export default function TradeTable({ trades = [], onTradeChanged }) {
  const [filter,      setFilter]      = useState('Both')   // Open | Closed | Both
  const [page,        setPage]        = useState(1)
  const [editingId,   setEditingId]   = useState(null)
  const [editValues,  setEditValues]  = useState({})
  const [deletingId,  setDeletingId]  = useState(null)
  const [confirmDel,  setConfirmDel]  = useState(null)     // trade id awaiting confirm
  const [savingEdit,  setSavingEdit]  = useState(false)
  const [rowError,    setRowError]    = useState({})       // { [id]: msg }

  // ── Filtering ───────────────────────────────────────────────────
  const filtered = trades.filter(t => {
    if (filter === 'Open')   return !t.close_time
    if (filter === 'Closed') return !!t.close_time
    return true
  })

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage   = Math.min(page, totalPages)
  const pageSlice  = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  // ── Delete ──────────────────────────────────────────────────────
  const handleDelete = async (id) => {
    setDeletingId(id)
    setRowError(e => ({ ...e, [id]: null }))
    try {
      const { error } = await supabase.rpc('delete_trade', { p_id: id })
      if (error) throw error
      setConfirmDel(null)
      onTradeChanged?.()
    } catch (err) {
      setRowError(e => ({ ...e, [id]: err.message || 'Delete failed' }))
    } finally {
      setDeletingId(null)
    }
  }

  // ── Edit ─────────────────────────────────────────────────────────
  const startEdit = (trade) => {
    setEditingId(trade.id)
    setEditValues({
      symbol:       trade.symbol      ?? '',
      side:         trade.side        ?? 'Buy',
      open_time:    trade.open_time   ? trade.open_time.slice(0, 16) : '',
      close_time:   trade.close_time  ? trade.close_time.slice(0, 16) : '',
      entry_price:  trade.entry_price ?? '',
      exit_price:   trade.exit_price  ?? '',
      quantity:     trade.quantity    ?? '',
      fees:         trade.fees        ?? '',
      swap:         trade.swap        ?? '',
      realized_pnl: trade.realized_pnl ?? '',
    })
    setRowError(e => ({ ...e, [trade.id]: null }))
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditValues({})
  }

  const saveEdit = async (id) => {
    setSavingEdit(true)
    setRowError(e => ({ ...e, [id]: null }))
    try {
      const payload = {
        symbol:       editValues.symbol,
        side:         editValues.side,
        open_time:    editValues.open_time  || null,
        close_time:   editValues.close_time || null,
        entry_price:  Number(editValues.entry_price),
        exit_price:   Number(editValues.exit_price),
        quantity:     Number(editValues.quantity),
        fees:         Number(editValues.fees),
        swap:         Number(editValues.swap),
        realized_pnl: Number(editValues.realized_pnl),
      }
      const { error } = await supabase
        .from('trades')
        .update(payload)
        .eq('id', id)
      if (error) throw error
      setEditingId(null)
      setEditValues({})
      onTradeChanged?.()
    } catch (err) {
      setRowError(e => ({ ...e, [id]: err.message || 'Save failed' }))
    } finally {
      setSavingEdit(false)
    }
  }

  // ── Styles ───────────────────────────────────────────────────────
  const cell = (extra = {}) => ({
    padding: '10px 12px',
    fontSize: '0.78rem',
    color: 'var(--text-main)',
    borderBottom: '1px solid var(--border-color)',
    whiteSpace: 'nowrap',
    verticalAlign: 'middle',
    ...extra,
  })

  const editInput = {
    background: 'var(--bg-main)',
    border: '1px solid var(--border-color)',
    borderRadius: '4px',
    color: 'var(--text-main)',
    fontSize: '0.75rem',
    padding: '4px 6px',
    width: '100%',
    outline: 'none',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
  }

  const iconBtn = (color = 'var(--text-muted)') => ({
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color,
    padding: '4px',
    borderRadius: '4px',
    display: 'inline-flex',
    alignItems: 'center',
    fontFamily: 'inherit',
    transition: 'background 0.12s',
  })

  return (
    <div style={{
      marginTop: '1.75rem',
      backgroundColor: 'var(--bg-card)',
      border: '1px solid var(--border-color)',
      borderRadius: 'var(--radius-xl)',
      overflow: 'hidden',
      boxShadow: 'var(--card-shadow)',
    }}>
      {/* ── Table header row ───────────────────────────────────────── */}
      <div style={{
        padding: '18px 24px 14px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: '1px solid var(--border-color)',
      }}>
        <h2 style={{ fontSize: '1rem', fontWeight: '600', color: 'var(--text-main)', margin: 0 }}>
          Trades
          <span style={{ color: 'var(--text-muted)', fontWeight: '400', fontSize: '0.8rem', marginLeft: '8px' }}>
            ({filtered.length})
          </span>
        </h2>

        {/* Filter tabs */}
        <div style={{
          display: 'flex',
          background: 'var(--bg-main)',
          borderRadius: '8px',
          padding: '3px',
          gap: '3px',
        }}>
          {['Open', 'Closed', 'Both'].map(f => (
            <button
              key={f}
              onClick={() => { setFilter(f); setPage(1) }}
              style={{
                padding: '5px 14px',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.78rem',
                fontWeight: '600',
                fontFamily: 'inherit',
                background: filter === f ? 'var(--bg-card)' : 'transparent',
                color: filter === f ? 'var(--text-main)' : 'var(--text-muted)',
                boxShadow: filter === f ? '0 1px 3px rgba(0,0,0,0.3)' : 'none',
                transition: 'all 0.15s',
              }}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* ── Scrollable table ───────────────────────────────────────── */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <colgroup>
            {COLS.map(c => <col key={c.key} style={{ width: c.w }} />)}
          </colgroup>
          <thead>
            <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
              {COLS.map(c => (
                <th key={c.key} style={{
                  ...cell({ color: 'var(--text-muted)', fontWeight: '600', fontSize: '0.72rem',
                            letterSpacing: '0.04em', textTransform: 'uppercase' }),
                  textAlign: 'left',
                }}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {pageSlice.length === 0 ? (
              <tr>
                <td colSpan={COLS.length} style={{ ...cell(), textAlign: 'center', color: 'var(--text-muted)', padding: '40px' }}>
                  No trades found.
                </td>
              </tr>
            ) : pageSlice.map(trade => {
              const isEditing = editingId === trade.id
              const isDeleting = deletingId === trade.id
              const err = rowError[trade.id]
              const pnl = trade.realized_pnl ?? 0

              return (
                <Fragment key={trade.id}>
                  <tr
                    style={{
                      transition: 'background 0.12s',
                      background: isEditing ? 'rgba(200,241,53,0.04)' : 'transparent',
                    }}
                    onMouseEnter={e => { if (!isEditing) e.currentTarget.style.background = 'var(--bg-card-hover)' }}
                    onMouseLeave={e => { if (!isEditing) e.currentTarget.style.background = 'transparent' }}
                  >
                    {/* ID */}
                    <td style={cell({ color: 'var(--text-muted)', fontSize: '0.72rem' })}>
                      {String(trade.id).slice(0, 6)}
                    </td>

                    {/* Symbol */}
                    <td style={cell({ fontWeight: '600' })}>
                      {isEditing
                        ? <input style={editInput} value={editValues.symbol} onChange={e => setEditValues(v => ({ ...v, symbol: e.target.value }))} />
                        : truncate(trade.symbol, 8)
                      }
                    </td>

                    {/* Side badge */}
                    <td style={cell()}>
                      {isEditing ? (
                        <select
                          style={{ ...editInput, width: '60px' }}
                          value={editValues.side}
                          onChange={e => setEditValues(v => ({ ...v, side: e.target.value }))}
                        >
                          <option>Buy</option>
                          <option>Sell</option>
                        </select>
                      ) : (
                        <span style={{
                          display: 'inline-block',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontSize: '0.72rem',
                          fontWeight: '700',
                          background: trade.side === 'Buy' ? 'var(--accent-lime-dim)' : 'var(--color-loss-dim)',
                          color: trade.side === 'Buy' ? 'var(--accent-lime)' : 'var(--color-loss)',
                        }}>
                          {trade.side}
                        </span>
                      )}
                    </td>

                    {/* Open Date */}
                    <td style={cell({ color: 'var(--text-muted)' })}>
                      {isEditing
                        ? <input type="datetime-local" style={editInput} value={editValues.open_time} onChange={e => setEditValues(v => ({ ...v, open_time: e.target.value }))} />
                        : formatDatetime(trade.open_time)
                      }
                    </td>

                    {/* Close Date */}
                    <td style={cell({ color: 'var(--text-muted)' })}>
                      {isEditing
                        ? <input type="datetime-local" style={editInput} value={editValues.close_time} onChange={e => setEditValues(v => ({ ...v, close_time: e.target.value }))} />
                        : formatDatetime(trade.close_time)
                      }
                    </td>

                    {/* Entry */}
                    <td style={cell()}>
                      {isEditing
                        ? <input type="number" style={editInput} value={editValues.entry_price} onChange={e => setEditValues(v => ({ ...v, entry_price: e.target.value }))} />
                        : `$${trade.entry_price?.toFixed(2) ?? '—'}`
                      }
                    </td>

                    {/* Exit */}
                    <td style={cell()}>
                      {isEditing
                        ? <input type="number" style={editInput} value={editValues.exit_price} onChange={e => setEditValues(v => ({ ...v, exit_price: e.target.value }))} />
                        : trade.exit_price ? `$${trade.exit_price.toFixed(2)}` : '—'
                      }
                    </td>

                    {/* Qty */}
                    <td style={cell({ color: 'var(--text-muted)' })}>
                      {isEditing
                        ? <input type="number" style={editInput} value={editValues.quantity} onChange={e => setEditValues(v => ({ ...v, quantity: e.target.value }))} />
                        : trade.quantity ?? '—'
                      }
                    </td>

                    {/* Fee */}
                    <td style={cell({ color: 'var(--text-muted)' })}>
                      {isEditing
                        ? <input type="number" style={editInput} value={editValues.fees} onChange={e => setEditValues(v => ({ ...v, fees: e.target.value }))} />
                        : trade.fees != null ? `$${trade.fees.toFixed(2)}` : '—'
                      }
                    </td>

                    {/* Swap */}
                    <td style={cell({ color: 'var(--text-muted)' })}>
                      {isEditing
                        ? <input type="number" style={editInput} value={editValues.swap} onChange={e => setEditValues(v => ({ ...v, swap: e.target.value }))} />
                        : trade.swap != null ? `$${trade.swap.toFixed(2)}` : '—'
                      }
                    </td>

                    {/* P&L */}
                    <td style={cell({ fontWeight: '700', color: pnl >= 0 ? 'var(--accent-lime)' : 'var(--color-loss)' })}>
                      {isEditing
                        ? <input type="number" style={editInput} value={editValues.realized_pnl} onChange={e => setEditValues(v => ({ ...v, realized_pnl: e.target.value }))} />
                        : formatCurrency(pnl)
                      }
                    </td>

                    {/* Actions */}
                    <td style={cell({ textAlign: 'right' })}>
                      {confirmDel === trade.id ? (
                        <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                          <button
                            onClick={() => handleDelete(trade.id)}
                            disabled={isDeleting}
                            style={{ ...iconBtn('var(--color-loss)'), fontSize: '0.7rem', padding: '3px 7px',
                              border: '1px solid var(--color-loss)', borderRadius: '4px',
                              opacity: isDeleting ? 0.5 : 1 }}
                          >
                            {isDeleting ? '…' : 'Yes'}
                          </button>
                          <button
                            onClick={() => setConfirmDel(null)}
                            style={{ ...iconBtn('var(--text-muted)'), fontSize: '0.7rem', padding: '3px 7px',
                              border: '1px solid var(--border-color)', borderRadius: '4px' }}
                          >
                            No
                          </button>
                        </div>
                      ) : isEditing ? (
                        <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                          {/* Save */}
                          <button
                            onClick={() => saveEdit(trade.id)}
                            disabled={savingEdit}
                            title="Save"
                            style={{ ...iconBtn('var(--accent-lime)'), opacity: savingEdit ? 0.5 : 1 }}
                          >
                            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                              <path d="M2 7L5.5 10.5L12 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </button>
                          {/* Cancel */}
                          <button onClick={cancelEdit} title="Cancel" style={iconBtn('var(--text-muted)')}>
                            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                              <path d="M3 3L11 11M11 3L3 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                            </svg>
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: '2px', justifyContent: 'flex-end' }}>
                          {/* Edit */}
                          <button
                            onClick={() => startEdit(trade)}
                            title="Edit trade"
                            style={iconBtn('var(--text-muted)')}
                            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-card-hover)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'none'}
                          >
                            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                              <path d="M8.5 2L11 4.5L4.5 11H2V8.5L8.5 2Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
                            </svg>
                          </button>
                          {/* Delete */}
                          <button
                            onClick={() => setConfirmDel(trade.id)}
                            title="Delete trade"
                            style={iconBtn('var(--text-muted)')}
                            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(240,62,62,0.1)'; e.currentTarget.style.color = 'var(--color-loss)' }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--text-muted)' }}
                          >
                            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                              <path d="M2 3.5H11M5 3.5V2.5H8V3.5M4.5 3.5L5 10.5H8L8.5 3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>

                  {/* Inline error row */}
                  {err && (
                    <tr key={`${trade.id}-err`}>
                      <td colSpan={COLS.length} style={{
                        padding: '4px 12px',
                        fontSize: '0.72rem',
                        color: 'var(--color-loss)',
                        background: 'rgba(240,62,62,0.05)',
                        borderBottom: '1px solid var(--border-color)',
                      }}>
                        ⚠ {err}
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* ── Pagination ─────────────────────────────────────────────── */}
      {totalPages > 1 && (
        <div style={{
          padding: '12px 20px',
          borderTop: '1px solid var(--border-color)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Showing {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filtered.length)} of {filtered.length}
          </span>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <PagBtn disabled={safePage === 1} onClick={() => setPage(p => p - 1)}>← Prev</PagBtn>

            {/* Page numbers — show at most 5 around current */}
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(p => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1)
              .reduce((acc, p, idx, arr) => {
                if (idx > 0 && p - arr[idx - 1] > 1) acc.push('…')
                acc.push(p)
                return acc
              }, [])
              .map((p, i) =>
                p === '…'
                  ? <span key={`ellipsis-${i}`} style={{ color: 'var(--text-muted)', fontSize: '0.75rem', padding: '0 2px' }}>…</span>
                  : <PagBtn key={p} active={p === safePage} onClick={() => setPage(p)}>{p}</PagBtn>
              )
            }

            <PagBtn disabled={safePage === totalPages} onClick={() => setPage(p => p + 1)}>Next →</PagBtn>
          </div>
        </div>
      )}
    </div>
  )
}

function PagBtn({ children, onClick, disabled, active }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '4px 10px',
        fontSize: '0.75rem',
        fontFamily: 'inherit',
        fontWeight: active ? '700' : '500',
        border: '1px solid',
        borderColor: active ? 'var(--accent-lime)' : 'var(--border-color)',
        borderRadius: '5px',
        background: active ? 'rgba(200,241,53,0.1)' : 'transparent',
        color: active ? 'var(--accent-lime)' : disabled ? 'var(--text-subtle, #2a2a3a)' : 'var(--text-muted)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'all 0.12s',
      }}
    >
      {children}
    </button>
  )
}