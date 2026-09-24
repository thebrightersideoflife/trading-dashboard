import { useState, Fragment } from 'react'
import { Trash2, Edit3, Check, X, CheckSquare, Square } from 'lucide-react'
import { supabase } from '../../api/supabaseClient'
import { formatCurrency } from '../../utils/formatters'

const PAGE_SIZE = 20

const COLS = [
  { key: '_select',     label: '',            w: '40px'  },
  { key: 'id',          label: 'ID',          w: '80px'  },
  { key: 'symbol',      label: 'Symbol',      w: '90px'  },
  { key: 'side',        label: 'Side',        w: '72px'  },
  { key: 'open_time',   label: 'Open Date',   w: '140px' },
  { key: 'close_time',  label: 'Close Date',  w: '140px' },
  { key: 'entry_price', label: 'Entry',       w: '90px'  },
  { key: 'exit_price',  label: 'Exit',        w: '90px'  },
  { key: 'quantity',    label: 'Qty',         w: '60px'  },
  { key: 'fees',        label: 'Fee',         w: '70px'  },
  { key: 'swap',        label: 'Swap',        w: '70px'  },
  { key: 'realized_pnl',label: 'P&L',       w: '90px'  },
  { key: '_actions',    label: '',            w: '80px'  },
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
  const [filter, setFilter] = useState('Both') // Open | Closed | Both
  const [page, setPage] = useState(1)
  const [editingId, setEditingId] = useState(null)
  const [editValues, setEditValues] = useState({})
  const [deletingId, setDeletingId] = useState(null)
  const [confirmDel, setConfirmDel] = useState(null) // trade id awaiting confirm
  const [savingEdit, setSavingEdit] = useState(false)
  const [rowError, setRowError] = useState({}) // { [id]: msg }

  // ── Bulk Selection State ─────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState([])
  const [showBulkEditModal, setShowBulkEditModal] = useState(false)
  const [showBulkDeleteConfirm, setShowBulkDeleteModal] = useState(false)
  const [bulkSaving, setBulkSaving] = useState(false)
  const [bulkError, setBulkError] = useState(null)

  const [bulkForm, setBulkForm] = useState({
    updateSymbol: false,
    symbol: '',
    updateSide: false,
    side: 'Buy',
    updateQuantity: false,
    quantity: '',
    updateFees: false,
    fees: '',
    updateSwap: false,
    swap: '',
  })

  // ── Filtering & Pagination ──────────────────────────────────────
  const filtered = trades.filter((t) => {
    if (filter === 'Open') return !t.close_time
    if (filter === 'Closed') return !!t.close_time
    return true
  })

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const pageSlice = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  // ── Selection Logic ──────────────────────────────────────────────
  const pageIds = pageSlice.map((t) => t.id)
  const isPageAllSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.includes(id))

  const toggleSelectAllPage = () => {
    if (isPageAllSelected) {
      setSelectedIds((prev) => prev.filter((id) => !pageIds.includes(id)))
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...pageIds])))
    }
  }

  const toggleSelect = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    )
  }

  // ── Single Delete ────────────────────────────────────────────────
  const handleDelete = async (id) => {
    setDeletingId(id)
    setRowError((e) => ({ ...e, [id]: null }))
    try {
      // 1. Try RPC delete_trade first
      const { error: rpcErr } = await supabase.rpc('delete_trade', { p_id: id })
      if (rpcErr) {
        // 2. Direct delete fallback
        const { error: delErr } = await supabase.from('trades').delete().eq('id', id)
        if (delErr) throw delErr
      }
      setConfirmDel(null)
      setSelectedIds((prev) => prev.filter((item) => item !== id))
      onTradeChanged?.()
    } catch (err) {
      setRowError((e) => ({ ...e, [id]: err.message || 'Delete failed' }))
    } finally {
      setDeletingId(null)
    }
  }

  // ── Bulk Delete ──────────────────────────────────────────────────
  const handleBulkDelete = async () => {
    if (!selectedIds.length) return
    setBulkSaving(true)
    setBulkError(null)
    try {
      // 1. Execute delete_trade RPC for each selected trade ID
      const rpcPromises = selectedIds.map((id) =>
        supabase.rpc('delete_trade', { p_id: id })
      )
      const rpcResults = await Promise.all(rpcPromises)

      // 2. Direct table delete for any remaining selected trade IDs
      const { error: directErr } = await supabase
        .from('trades')
        .delete()
        .in('id', selectedIds)

      if (directErr && rpcResults.some((r) => r.error)) {
        throw directErr
      }

      setSelectedIds([])
      setShowBulkDeleteModal(false)
      onTradeChanged?.()
    } catch (err) {
      setBulkError(err.message || 'Bulk delete failed')
    } finally {
      setBulkSaving(false)
    }
  }

  // ── Bulk Edit (Mass Update symbol, side, quantity, fee, swap) ───
  const handleBulkUpdate = async (e) => {
    e.preventDefault()
    if (!selectedIds.length) return

    const payload = {}
    if (bulkForm.updateSymbol && bulkForm.symbol.trim()) {
      payload.symbol = bulkForm.symbol.trim()
    }
    if (bulkForm.updateSide) {
      payload.side = bulkForm.side
    }
    if (bulkForm.updateQuantity && bulkForm.quantity !== '') {
      payload.quantity = Math.max(0.00001, Number(bulkForm.quantity))
    }
    if (bulkForm.updateFees && bulkForm.fees !== '') {
      payload.fees = Number(bulkForm.fees)
    }
    if (bulkForm.updateSwap && bulkForm.swap !== '') {
      payload.swap = Number(bulkForm.swap)
    }

    if (Object.keys(payload).length === 0) {
      setBulkError('Please check at least one field to update.')
      return
    }

    setBulkSaving(true)
    setBulkError(null)

    try {
      const { error } = await supabase
        .from('trades')
        .update(payload)
        .in('id', selectedIds)

      if (error) throw error

      setSelectedIds([])
      setShowBulkEditModal(false)
      onTradeChanged?.()
    } catch (err) {
      setBulkError(err.message || 'Bulk update failed')
    } finally {
      setBulkSaving(false)
    }
  }

  // ── Single Edit ──────────────────────────────────────────────────
  const startEdit = (trade) => {
    setEditingId(trade.id)
    setEditValues({
      symbol: trade.symbol ?? '',
      side: trade.side ?? 'Buy',
      open_time: trade.open_time ? trade.open_time.slice(0, 16) : '',
      close_time: trade.close_time ? trade.close_time.slice(0, 16) : '',
      entry_price: trade.entry_price ?? '',
      exit_price: trade.exit_price ?? '',
      quantity: trade.quantity ?? '',
      fees: trade.fees ?? '',
      swap: trade.swap ?? '',
      realized_pnl: trade.realized_pnl ?? '',
    })
    setRowError((e) => ({ ...e, [trade.id]: null }))
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditValues({})
  }

  const saveEdit = async (id) => {
    setSavingEdit(true)
    setRowError((e) => ({ ...e, [id]: null }))
    try {
      const payload = {
        symbol: editValues.symbol,
        side: editValues.side,
        open_time: editValues.open_time || null,
        close_time: editValues.close_time || null,
        entry_price: Number(editValues.entry_price),
        exit_price: Number(editValues.exit_price),
        quantity: Number(editValues.quantity),
        fees: Number(editValues.fees),
        swap: Number(editValues.swap),
        realized_pnl: Number(editValues.realized_pnl),
      }
      const { error } = await supabase.from('trades').update(payload).eq('id', id)
      if (error) throw error
      setEditingId(null)
      setEditValues({})
      onTradeChanged?.()
    } catch (err) {
      setRowError((e) => ({ ...e, [id]: err.message || 'Save failed' }))
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
    <div
      style={{
        marginTop: '1.75rem',
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-xl)',
        overflow: 'hidden',
        boxShadow: 'var(--card-shadow)',
      }}
    >
      {/* ── Table header row & Bulk Actions Bar ─────────────────────── */}
      <div
        style={{
          padding: '18px 24px 14px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid var(--border-color)',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: '600', color: 'var(--text-main)', margin: 0 }}>
            Trades
            <span style={{ color: 'var(--text-muted)', fontWeight: '400', fontSize: '0.8rem', marginLeft: '8px' }}>
              ({filtered.length})
            </span>
          </h2>

          {/* Bulk Selection Indicator & Actions */}
          {selectedIds.length > 0 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                backgroundColor: 'rgba(37,211,102,0.08)',
                border: '1px solid var(--accent-lime)',
                borderRadius: '8px',
                padding: '4px 12px',
                fontSize: '0.78rem',
              }}
            >
              <span style={{ color: 'var(--accent-lime)', fontWeight: '700' }}>
                {selectedIds.length} Selected
              </span>

              <button
                type="button"
                onClick={() => setShowBulkEditModal(true)}
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '4px',
                  color: 'var(--text-main)',
                  cursor: 'pointer',
                  padding: '4px 10px',
                  fontSize: '0.75rem',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <Edit3 size={13} /> Mass Edit
              </button>

              <button
                type="button"
                onClick={() => setShowBulkDeleteModal(true)}
                style={{
                  background: 'rgba(240,62,62,0.15)',
                  border: '1px solid var(--color-loss)',
                  borderRadius: '4px',
                  color: 'var(--color-loss)',
                  cursor: 'pointer',
                  padding: '4px 10px',
                  fontSize: '0.75rem',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <Trash2 size={13} /> Mass Delete
              </button>

              <button
                type="button"
                onClick={() => setSelectedIds([])}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                  textDecoration: 'underline',
                  padding: '2px 4px',
                }}
              >
                Clear
              </button>
            </div>
          )}
        </div>

        {/* Filter tabs */}
        <div
          style={{
            display: 'flex',
            background: 'var(--bg-main)',
            borderRadius: '8px',
            padding: '3px',
            gap: '3px',
          }}
        >
          {['Open', 'Closed', 'Both'].map((f) => (
            <button
              key={f}
              onClick={() => {
                setFilter(f)
                setPage(1)
              }}
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
            {COLS.map((c) => (
              <col key={c.key} style={{ width: c.w }} />
            ))}
          </colgroup>
          <thead>
            <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
              {COLS.map((c) => {
                if (c.key === '_select') {
                  return (
                    <th key={c.key} style={{ ...cell(), textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={isPageAllSelected}
                        onChange={toggleSelectAllPage}
                        title="Select/Deselect all on page"
                        style={{ cursor: 'pointer', accentColor: 'var(--accent-lime)' }}
                      />
                    </th>
                  )
                }
                return (
                  <th
                    key={c.key}
                    style={{
                      ...cell({
                        color: 'var(--text-muted)',
                        fontWeight: '600',
                        fontSize: '0.72rem',
                        letterSpacing: '0.04em',
                        textTransform: 'uppercase',
                      }),
                      textAlign: 'left',
                    }}
                  >
                    {c.label}
                  </th>
                )
              })}
            </tr>
          </thead>

          <tbody>
            {pageSlice.length === 0 ? (
              <tr>
                <td colSpan={COLS.length} style={{ ...cell(), textAlign: 'center', color: 'var(--text-muted)', padding: '40px' }}>
                  No trades found.
                </td>
              </tr>
            ) : (
              pageSlice.map((trade) => {
                const isEditing = editingId === trade.id
                const isDeleting = deletingId === trade.id
                const isSelected = selectedIds.includes(trade.id)
                const err = rowError[trade.id]
                const pnl = trade.realized_pnl ?? 0

                return (
                  <Fragment key={trade.id}>
                    <tr
                      style={{
                        transition: 'background 0.12s',
                        background: isSelected
                          ? 'rgba(37,211,102,0.06)'
                          : isEditing
                          ? 'var(--accent-lime-glow)'
                          : 'transparent',
                      }}
                      onMouseEnter={(e) => {
                        if (!isEditing && !isSelected) e.currentTarget.style.background = 'var(--bg-card-hover)'
                      }}
                      onMouseLeave={(e) => {
                        if (!isEditing && !isSelected) e.currentTarget.style.background = 'transparent'
                      }}
                    >
                      {/* Checkbox Column */}
                      <td style={cell({ textAlign: 'center' })}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(trade.id)}
                          style={{ cursor: 'pointer', accentColor: 'var(--accent-lime)' }}
                        />
                      </td>

                      {/* ID */}
                      <td style={cell({ color: 'var(--text-muted)', fontSize: '0.72rem', fontFamily: 'monospace' })}>
                        {String(trade.id).slice(0, 6)}
                      </td>

                      {/* Symbol */}
                      <td style={cell({ fontWeight: '600' })}>
                        {isEditing ? (
                          <input
                            style={editInput}
                            value={editValues.symbol}
                            onChange={(e) => setEditValues((v) => ({ ...v, symbol: e.target.value }))}
                          />
                        ) : (
                          truncate(trade.symbol, 8)
                        )}
                      </td>

                      {/* Side badge */}
                      <td style={cell()}>
                        {isEditing ? (
                          <select
                            style={{ ...editInput, width: '60px' }}
                            value={editValues.side}
                            onChange={(e) => setEditValues((v) => ({ ...v, side: e.target.value }))}
                          >
                            <option>Buy</option>
                            <option>Sell</option>
                          </select>
                        ) : (
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontSize: '0.72rem',
                              fontWeight: '700',
                              background: trade.side === 'Buy' ? 'var(--accent-lime-dim)' : 'var(--color-loss-dim)',
                              color: trade.side === 'Buy' ? 'var(--accent-lime)' : 'var(--color-loss)',
                            }}
                          >
                            {trade.side}
                          </span>
                        )}
                      </td>

                      {/* Open Date */}
                      <td style={cell({ color: 'var(--text-muted)' })}>
                        {isEditing ? (
                          <input
                            type="datetime-local"
                            style={editInput}
                            value={editValues.open_time}
                            onChange={(e) => setEditValues((v) => ({ ...v, open_time: e.target.value }))}
                          />
                        ) : (
                          formatDatetime(trade.open_time)
                        )}
                      </td>

                      {/* Close Date */}
                      <td style={cell({ color: 'var(--text-muted)' })}>
                        {isEditing ? (
                          <input
                            type="datetime-local"
                            style={editInput}
                            value={editValues.close_time}
                            onChange={(e) => setEditValues((v) => ({ ...v, close_time: e.target.value }))}
                          />
                        ) : (
                          formatDatetime(trade.close_time)
                        )}
                      </td>

                      {/* Entry */}
                      <td style={cell()}>
                        {isEditing ? (
                          <input
                            type="number"
                            style={editInput}
                            value={editValues.entry_price}
                            onChange={(e) => setEditValues((v) => ({ ...v, entry_price: e.target.value }))}
                          />
                        ) : (
                          `$${trade.entry_price?.toFixed(2) ?? '—'}`
                        )}
                      </td>

                      {/* Exit */}
                      <td style={cell()}>
                        {isEditing ? (
                          <input
                            type="number"
                            style={editInput}
                            value={editValues.exit_price}
                            onChange={(e) => setEditValues((v) => ({ ...v, exit_price: e.target.value }))}
                          />
                        ) : trade.exit_price ? (
                          `$${trade.exit_price.toFixed(2)}`
                        ) : (
                          '—'
                        )}
                      </td>

                      {/* Qty */}
                      <td style={cell({ color: 'var(--text-muted)' })}>
                        {isEditing ? (
                          <input
                            type="number"
                            style={editInput}
                            value={editValues.quantity}
                            onChange={(e) => setEditValues((v) => ({ ...v, quantity: e.target.value }))}
                          />
                        ) : (
                          trade.quantity ?? '—'
                        )}
                      </td>

                      {/* Fee */}
                      <td style={cell({ color: 'var(--text-muted)' })}>
                        {isEditing ? (
                          <input
                            type="number"
                            style={editInput}
                            value={editValues.fees}
                            onChange={(e) => setEditValues((v) => ({ ...v, fees: e.target.value }))}
                          />
                        ) : trade.fees != null ? (
                          `$${trade.fees.toFixed(2)}`
                        ) : (
                          '—'
                        )}
                      </td>

                      {/* Swap */}
                      <td style={cell({ color: 'var(--text-muted)' })}>
                        {isEditing ? (
                          <input
                            type="number"
                            style={editInput}
                            value={editValues.swap}
                            onChange={(e) => setEditValues((v) => ({ ...v, swap: e.target.value }))}
                          />
                        ) : trade.swap != null ? (
                          `$${trade.swap.toFixed(2)}`
                        ) : (
                          '—'
                        )}
                      </td>

                      {/* P&L */}
                      <td style={cell({ fontWeight: '700', color: pnl >= 0 ? 'var(--accent-lime)' : 'var(--color-loss)' })}>
                        {isEditing ? (
                          <input
                            type="number"
                            style={editInput}
                            value={editValues.realized_pnl}
                            onChange={(e) => setEditValues((v) => ({ ...v, realized_pnl: e.target.value }))}
                          />
                        ) : (
                          formatCurrency(pnl)
                        )}
                      </td>

                      {/* Actions */}
                      <td style={cell({ textAlign: 'right' })}>
                        {confirmDel === trade.id ? (
                          <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                            <button
                              onClick={() => handleDelete(trade.id)}
                              disabled={isDeleting}
                              style={{
                                ...iconBtn('var(--color-loss)'),
                                fontSize: '0.7rem',
                                padding: '3px 7px',
                                border: '1px solid var(--color-loss)',
                                borderRadius: '4px',
                                opacity: isDeleting ? 0.5 : 1,
                              }}
                            >
                              {isDeleting ? '…' : 'Yes'}
                            </button>
                            <button
                              onClick={() => setConfirmDel(null)}
                              style={{
                                ...iconBtn('var(--text-muted)'),
                                fontSize: '0.7rem',
                                padding: '3px 7px',
                                border: '1px solid var(--border-color)',
                                borderRadius: '4px',
                              }}
                            >
                              No
                            </button>
                          </div>
                        ) : isEditing ? (
                          <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                            <button
                              onClick={() => saveEdit(trade.id)}
                              disabled={savingEdit}
                              title="Save"
                              style={{ ...iconBtn('var(--accent-lime)'), opacity: savingEdit ? 0.5 : 1 }}
                            >
                              <Check size={14} />
                            </button>
                            <button onClick={cancelEdit} title="Cancel" style={iconBtn('var(--text-muted)')}>
                              <X size={14} />
                            </button>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', gap: '2px', justifyContent: 'flex-end' }}>
                            <button
                              onClick={() => startEdit(trade)}
                              title="Edit trade"
                              style={iconBtn('var(--text-muted)')}
                              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-card-hover)')}
                              onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                            >
                              <Edit3 size={13} />
                            </button>
                            <button
                              onClick={() => setConfirmDel(trade.id)}
                              title="Delete trade"
                              style={iconBtn('var(--text-muted)')}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = 'rgba(240,62,62,0.1)'
                                e.currentTarget.style.color = 'var(--color-loss)'
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'none'
                                e.currentTarget.style.color = 'var(--text-muted)'
                              }}
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>

                    {/* Inline error row */}
                    {err && (
                      <tr key={`${trade.id}-err`}>
                        <td
                          colSpan={COLS.length}
                          style={{
                            padding: '4px 12px',
                            fontSize: '0.72rem',
                            color: 'var(--color-loss)',
                            background: 'rgba(240,62,62,0.05)',
                            borderBottom: '1px solid var(--border-color)',
                          }}
                        >
                          ⚠ {err}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ── Pagination ─────────────────────────────────────────────── */}
      {totalPages > 1 && (
        <div
          style={{
            padding: '12px 20px',
            borderTop: '1px solid var(--border-color)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Showing {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filtered.length)} of {filtered.length}
          </span>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <PagBtn disabled={safePage === 1} onClick={() => setPage((p) => p - 1)}>
              ← Prev
            </PagBtn>

            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((p) => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1)
              .reduce((acc, p, idx, arr) => {
                if (idx > 0 && p - arr[idx - 1] > 1) acc.push('…')
                acc.push(p)
                return acc
              }, [])
              .map((p, i) =>
                p === '…' ? (
                  <span key={`ellipsis-${i}`} style={{ color: 'var(--text-muted)', fontSize: '0.75rem', padding: '0 2px' }}>
                    …
                  </span>
                ) : (
                  <PagBtn key={p} active={p === safePage} onClick={() => setPage(p)}>
                    {p}
                  </PagBtn>
                )
              )}

            <PagBtn disabled={safePage === totalPages} onClick={() => setPage((p) => p + 1)}>
              Next →
            </PagBtn>
          </div>
        </div>
      )}

      {/* ── Mass Edit Modal ──────────────────────────────────────────── */}
      {showBulkEditModal && (
        <div
          onClick={() => setShowBulkEditModal(false)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.75)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: '16px',
              padding: '28px',
              width: '100%',
              maxWidth: '460px',
              boxShadow: 'var(--card-shadow)',
              color: 'var(--text-main)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: '700', margin: 0 }}>
                  Mass Edit Trades ({selectedIds.length})
                </h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: '4px 0 0 0' }}>
                  Check the fields you want to update across all {selectedIds.length} selected trades.
                </p>
              </div>
              <button
                onClick={() => setShowBulkEditModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleBulkUpdate} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Symbol Field */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  <input
                    type="checkbox"
                    checked={bulkForm.updateSymbol}
                    onChange={(e) => setBulkForm((f) => ({ ...f, updateSymbol: e.target.checked }))}
                    style={{ accentColor: 'var(--accent-lime)' }}
                  />
                  Update Symbol
                </label>
                {bulkForm.updateSymbol && (
                  <input
                    type="text"
                    placeholder="e.g. NAS100"
                    value={bulkForm.symbol}
                    onChange={(e) => setBulkForm((f) => ({ ...f, symbol: e.target.value }))}
                    style={editInput}
                  />
                )}
              </div>

              {/* Side Field */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  <input
                    type="checkbox"
                    checked={bulkForm.updateSide}
                    onChange={(e) => setBulkForm((f) => ({ ...f, updateSide: e.target.checked }))}
                    style={{ accentColor: 'var(--accent-lime)' }}
                  />
                  Update Side
                </label>
                {bulkForm.updateSide && (
                  <select
                    value={bulkForm.side}
                    onChange={(e) => setBulkForm((f) => ({ ...f, side: e.target.value }))}
                    style={editInput}
                  >
                    <option value="Buy">Buy</option>
                    <option value="Sell">Sell</option>
                  </select>
                )}
              </div>

              {/* Quantity Field */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  <input
                    type="checkbox"
                    checked={bulkForm.updateQuantity}
                    onChange={(e) => setBulkForm((f) => ({ ...f, updateQuantity: e.target.checked }))}
                    style={{ accentColor: 'var(--accent-lime)' }}
                  />
                  Update Quantity
                </label>
                {bulkForm.updateQuantity && (
                  <input
                    type="number"
                    step="any"
                    placeholder="0.01"
                    value={bulkForm.quantity}
                    onChange={(e) => setBulkForm((f) => ({ ...f, quantity: e.target.value }))}
                    style={editInput}
                  />
                )}
              </div>

              {/* Fees Field */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  <input
                    type="checkbox"
                    checked={bulkForm.updateFees}
                    onChange={(e) => setBulkForm((f) => ({ ...f, updateFees: e.target.checked }))}
                    style={{ accentColor: 'var(--accent-lime)' }}
                  />
                  Update Fee
                </label>
                {bulkForm.updateFees && (
                  <input
                    type="number"
                    step="any"
                    placeholder="0.00"
                    value={bulkForm.fees}
                    onChange={(e) => setBulkForm((f) => ({ ...f, fees: e.target.value }))}
                    style={editInput}
                  />
                )}
              </div>

              {/* Swap Field */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  <input
                    type="checkbox"
                    checked={bulkForm.updateSwap}
                    onChange={(e) => setBulkForm((f) => ({ ...f, updateSwap: e.target.checked }))}
                    style={{ accentColor: 'var(--accent-lime)' }}
                  />
                  Update Swap
                </label>
                {bulkForm.updateSwap && (
                  <input
                    type="number"
                    step="any"
                    placeholder="0.00"
                    value={bulkForm.swap}
                    onChange={(e) => setBulkForm((f) => ({ ...f, swap: e.target.value }))}
                    style={editInput}
                  />
                )}
              </div>

              {bulkError && (
                <div style={{ color: 'var(--color-loss)', fontSize: '0.8rem' }}>
                  ⚠️ {bulkError}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => setShowBulkEditModal(false)}
                  style={{
                    padding: '8px 16px',
                    background: 'transparent',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    color: 'var(--text-muted)',
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={bulkSaving}
                  style={{
                    padding: '8px 20px',
                    background: 'var(--accent-lime)',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#000',
                    fontWeight: '700',
                    fontSize: '0.85rem',
                    cursor: bulkSaving ? 'not-allowed' : 'pointer',
                    opacity: bulkSaving ? 0.7 : 1,
                  }}
                >
                  {bulkSaving ? 'Saving…' : `Update ${selectedIds.length} Trades`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Mass Delete Confirmation Modal ──────────────────────────── */}
      {showBulkDeleteConfirm && (
        <div
          onClick={() => setShowBulkDeleteModal(false)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.75)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: '16px',
              padding: '28px',
              width: '100%',
              maxWidth: '420px',
              boxShadow: 'var(--card-shadow)',
              color: 'var(--text-main)',
            }}
          >
            <h3 style={{ fontSize: '1.1rem', fontWeight: '700', margin: '0 0 10px 0', color: 'var(--color-loss)' }}>
              Confirm Mass Delete
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', lineHeight: '1.5', margin: '0 0 20px 0' }}>
              Are you sure you want to delete <strong>{selectedIds.length}</strong> selected trades? This action cannot be undone.
            </p>

            {bulkError && (
              <div style={{ color: 'var(--color-loss)', fontSize: '0.8rem', marginBottom: '14px' }}>
                ⚠️ {bulkError}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setShowBulkDeleteModal(false)}
                style={{
                  padding: '8px 16px',
                  background: 'transparent',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  color: 'var(--text-muted)',
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleBulkDelete}
                disabled={bulkSaving}
                style={{
                  padding: '8px 20px',
                  background: 'var(--color-loss)',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#fff',
                  fontWeight: '700',
                  fontSize: '0.85rem',
                  cursor: bulkSaving ? 'not-allowed' : 'pointer',
                  opacity: bulkSaving ? 0.7 : 1,
                }}
              >
                {bulkSaving ? 'Deleting…' : `Yes, Delete ${selectedIds.length} Trades`}
              </button>
            </div>
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
        background: active ? 'rgba(var(--accent-lime-rgb), 0.16)' : 'transparent',
        color: active ? 'var(--accent-lime)' : disabled ? 'var(--text-subtle, #2a2a3a)' : 'var(--text-muted)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'all 0.12s',
      }}
    >
      {children}
    </button>
  )
}
